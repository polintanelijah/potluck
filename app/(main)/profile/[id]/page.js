'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getBucketConfig, getBucketScore, sortRankings } from '@/lib/rankings';

export default function OtherProfilePage({ params }) {
    const { id } = use(params);
    const [profileData, setProfileData] = useState(null);
    const [recipes, setRecipes] = useState([]);
    const [wantToCook, setWantToCook] = useState([]);
    const [haveCooked, setHaveCooked] = useState([]);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('recipes');
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => {
        let cancelled = false;

        async function fetchAll() {
            if (!user || !id) return;

            setLoading(true);

            const [profileRes, recipesRes, followersRes, followingRes, followCheckRes, savedRes, rankingRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', id).single(),
                supabase.from('recipes').select('id, title, url, image_url, source_site, created_at, posts(image_url)').eq('created_by', id).order('created_at', { ascending: false }),
                supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', id),
                supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', id),
                supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', id).maybeSingle(),
                supabase.from('want_to_cook_actions').select('post_id, created_at, posts:post_id(id, caption, image_url, created_at, recipes:recipe_id(id, title, url, image_url, source_site))').eq('user_id', id).order('created_at', { ascending: false }),
                supabase.from('user_recipe_rankings').select('recipe_id, bucket, rank_position, recipes:recipe_id(id, title, url, image_url, source_site, posts(image_url))').eq('user_id', id),
            ]);

            if (cancelled) return;

            setProfileData(profileRes.data);
            setRecipes(recipesRes.data || []);
            setFollowerCount(followersRes.count || 0);
            setFollowingCount(followingRes.count || 0);
            setIsFollowing(!!followCheckRes.data);
            setWantToCook((savedRes.data || []).filter((item) => item.posts?.recipes));
            setHaveCooked(sortRankings((rankingRes.data || []).filter((item) => item.recipes)));
            setLoading(false);
        }

        fetchAll();
        return () => {
            cancelled = true;
        };
    }, [id, supabase, user]);

    async function toggleFollow() {
        if (!user) return;

        const wasFollowing = isFollowing;
        setIsFollowing(!wasFollowing);
        setFollowerCount((count) => (wasFollowing ? count - 1 : count + 1));

        if (wasFollowing) {
            await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id);
        } else {
            await supabase.from('follows').insert({ follower_id: user.id, following_id: id });
        }
    }

    function getRecipeImage(recipe) {
        if (recipe.image_url) return recipe.image_url;
        const postWithImage = recipe.posts?.find((post) => post.image_url);
        return postWithImage?.image_url || null;
    }

    function getScoreDetails(item) {
        const totalInBucket = haveCooked.filter((entry) => entry.bucket === item.bucket).length;
        return {
            label: getBucketConfig(item.bucket).label,
            score: getBucketScore(item.bucket, item.rank_position, totalInBucket),
        };
    }

    if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>;
    if (!profileData) return <div className="text-center py-16"><p className="note-text">User not found</p></div>;

    return (
        <div className="px-4 py-6">
            <div className="flex items-start gap-4 mb-4">
                <div className="avatar avatar-lg">
                    {profileData.avatar_url ? (
                        <img src={profileData.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (profileData.name?.[0]?.toUpperCase() || '?')}
                </div>
                <div className="flex-1">
                    <h2 className="text-xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{profileData.name}</h2>
                    {profileData.username && (
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>@{profileData.username}</p>
                    )}
                    {profileData.bio && <p className="note-text text-sm mt-1">{profileData.bio}</p>}
                </div>
            </div>

            <div className="flex gap-4 mb-4 px-1">
                <span className="text-sm">
                    <span className="font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{followerCount}</span>
                    <span className="ml-1" style={{ color: 'var(--color-text-muted)' }}>followers</span>
                </span>
                <span className="text-sm">
                    <span className="font-bold" style={{ fontFamily: "'DM Mono', monospace" }}>{followingCount}</span>
                    <span className="ml-1" style={{ color: 'var(--color-text-muted)' }}>following</span>
                </span>
            </div>

            <button onClick={toggleFollow} className={`w-full mb-5 ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}>
                {isFollowing ? 'Following' : 'Follow'}
            </button>

            <div className="flex gap-0 mb-4 rounded-md overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                <button onClick={() => setActiveTab('recipes')} className="flex-1 py-2.5 text-center transition-colors"
                    style={{ background: activeTab === 'recipes' ? 'var(--color-bg-card)' : 'transparent', borderRight: '1px solid var(--color-border)' }}>
                    <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{recipes.length}</p>
                    <p className="meta-label">Recipes</p>
                </button>
                <button onClick={() => setActiveTab('want_to_cook')} className="flex-1 py-2.5 text-center transition-colors"
                    style={{ background: activeTab === 'want_to_cook' ? 'var(--color-bg-card)' : 'transparent', borderRight: '1px solid var(--color-border)' }}>
                    <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{wantToCook.length}</p>
                    <p className="meta-label">Want to Cook</p>
                </button>
                <button onClick={() => setActiveTab('have_cooked')} className="flex-1 py-2.5 text-center transition-colors"
                    style={{ background: activeTab === 'have_cooked' ? 'var(--color-bg-card)' : 'transparent' }}>
                    <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{haveCooked.length}</p>
                    <p className="meta-label">Have Cooked</p>
                </button>
            </div>

            {activeTab === 'recipes' && (
                recipes.length === 0 ? (
                    <p className="note-text text-sm text-center py-8">No recipes yet</p>
                ) : (
                    <div className="space-y-2">
                        {recipes.map((recipe) => {
                            const image = getRecipeImage(recipe);
                            return (
                                <Link key={recipe.id} href={`/recipe/${recipe.id}`}
                                    className="flex items-center gap-3 px-4 py-3 rounded-md"
                                    style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                                    {image ? (
                                        <img src={image} alt="" className="w-12 h-12 rounded-md object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-md flex items-center justify-center" style={{ background: 'var(--color-bg-input)' }}>
                                            <span style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem' }}>&#127869;</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate" style={{ fontFamily: "'Playfair Display', serif" }}>{recipe.title}</p>
                                        {recipe.source_site && (
                                            <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>{recipe.source_site}</p>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )
            )}

            {activeTab === 'want_to_cook' && (
                wantToCook.length === 0 ? (
                    <p className="note-text text-sm text-center py-8">Nothing saved yet</p>
                ) : (
                    <div className="space-y-2">
                        {wantToCook.map((item) => {
                            const post = item.posts;
                            const recipe = post.recipes;
                            const image = post.image_url || recipe?.image_url || null;
                            return (
                                <Link key={`${item.post_id}-${item.created_at}`} href={`/session/${post.id}`}
                                    className="flex items-center gap-3 px-4 py-3 rounded-md"
                                    style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                                    {image ? (
                                        <img src={image} alt="" className="w-12 h-12 rounded-md object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-md flex items-center justify-center" style={{ background: 'var(--color-bg-input)' }}>
                                            <span style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem' }}>&#127869;</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate" style={{ fontFamily: "'Playfair Display', serif" }}>{recipe?.title}</p>
                                        {post.caption && <p className="note-text text-xs truncate mt-0.5">{post.caption}</p>}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )
            )}

            {activeTab === 'have_cooked' && (
                haveCooked.length === 0 ? (
                    <p className="note-text text-sm text-center py-8">No cooks logged yet</p>
                ) : (
                    <div className="space-y-2">
                        {haveCooked.map((item) => {
                            const image = getRecipeImage(item.recipes);
                            const details = getScoreDetails(item);
                            return (
                                <Link key={item.recipe_id} href={`/recipe/${item.recipes.id}`}
                                    className="flex items-center gap-3 px-4 py-3 rounded-md"
                                    style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                                    <div className="flex-shrink-0 w-9 text-center">
                                        <span className="text-xs font-bold block" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                                            #{item.rank_position}
                                        </span>
                                        <span className="text-[0.6rem]" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                                            {details.label}
                                        </span>
                                    </div>
                                    {image ? (
                                        <img src={image} alt="" className="w-12 h-12 rounded-md object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-md flex items-center justify-center" style={{ background: 'var(--color-bg-input)' }}>
                                            <span style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem' }}>&#127869;</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate" style={{ fontFamily: "'Playfair Display', serif" }}>{item.recipes.title}</p>
                                        {item.recipes.source_site && (
                                            <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>{item.recipes.source_site}</p>
                                        )}
                                    </div>
                                    <span className="text-sm font-bold" style={{ color: 'var(--color-accent)', fontFamily: "'DM Mono', monospace" }}>
                                        {details.score}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
}
