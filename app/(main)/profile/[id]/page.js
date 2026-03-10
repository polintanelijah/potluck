'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

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

    useEffect(() => { if (user && id) fetchAll(); }, [user, id]);

    async function fetchAll() {
        setLoading(true);
        const [profileRes, recipesRes, wantToCookRes, haveCookedRes, followersRes, followingRes, followCheckRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', id).single(),
            supabase.from('recipes').select('id, title, url, image_url, source_site, avg_rating, total_cooks, created_at').eq('created_by', id).order('created_at', { ascending: false }),
            supabase.from('user_recipes').select('id, created_at, recipe_id, recipes:recipe_id(id, title, url, image_url, source_site)').eq('user_id', id).eq('status', 'want_to_cook').order('created_at', { ascending: false }),
            supabase.from('user_recipes').select('id, rating, cooked_at, created_at, recipe_id, recipes:recipe_id(id, title, url, image_url, source_site)').eq('user_id', id).eq('status', 'cooked').order('cooked_at', { ascending: false }),
            supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', id),
            supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', id),
            supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', id).single(),
        ]);
        setProfileData(profileRes.data);
        setRecipes(recipesRes.data || []);
        setWantToCook(wantToCookRes.data || []);
        setHaveCooked(haveCookedRes.data || []);
        setFollowerCount(followersRes.count || 0);
        setFollowingCount(followingRes.count || 0);
        setIsFollowing(!!followCheckRes.data);
        setLoading(false);
    }

    async function toggleFollow() {
        const wasFollowing = isFollowing;
        setIsFollowing(!wasFollowing);
        setFollowerCount((c) => (wasFollowing ? c - 1 : c + 1));
        if (wasFollowing) {
            await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id);
        } else {
            await supabase.from('follows').insert({ follower_id: user.id, following_id: id });
        }
    }

    if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>;
    if (!profileData) return <div className="text-center py-16"><p className="note-text">User not found</p></div>;

    function RecipeCard({ recipe, rating }) {
        return (
            <Link href={`/recipe/${recipe.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-md"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                {recipe.image_url ? (
                    <img src={recipe.image_url} alt="" className="w-12 h-12 rounded-md object-cover" />
                ) : (
                    <div className="w-12 h-12 rounded-md flex items-center justify-center" style={{ background: 'var(--color-bg-input)' }}>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem' }}>🍽</span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ fontFamily: "'Playfair Display', serif" }}>{recipe.title}</p>
                    {recipe.source_site && (
                        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>{recipe.source_site}</p>
                    )}
                </div>
                {rating && (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                        {rating}/10
                    </span>
                )}
            </Link>
        );
    }

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

            {/* Follower/following stats (non-tappable) */}
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

            {/* Tab bar: Your Recipes / Want to Cook / Have Cooked */}
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

            {/* Tab content */}
            {activeTab === 'recipes' && (
                <>
                    {recipes.length === 0 ? (
                        <p className="note-text text-sm text-center py-8">No recipes yet</p>
                    ) : (
                        <div className="space-y-2">
                            {recipes.map((recipe) => (
                                <RecipeCard key={recipe.id} recipe={recipe} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'want_to_cook' && (
                <>
                    {wantToCook.length === 0 ? (
                        <p className="note-text text-sm text-center py-8">Nothing saved yet</p>
                    ) : (
                        <div className="space-y-2">
                            {wantToCook.map((item) => (
                                <RecipeCard key={item.id} recipe={item.recipes} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'have_cooked' && (
                <>
                    {haveCooked.length === 0 ? (
                        <p className="note-text text-sm text-center py-8">No cooks logged yet</p>
                    ) : (
                        <div className="space-y-2">
                            {haveCooked.map((item) => (
                                <RecipeCard key={item.id} recipe={item.recipes} rating={item.rating} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
