'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import LikeButton from '@/components/LikeButton';
import WantToCookButton from '@/components/WantToCookButton';
import CommentSection from '@/components/CommentSection';
import Link from 'next/link';

export default function PostDetailPage({ params }) {
    const { id } = use(params);
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => { if (id) fetchPost(); }, [id]);

    async function fetchPost() {
        const { data } = await supabase
            .from('posts')
            .select(`*, profiles:user_id(id, name, avatar_url), recipes:recipe_id(id, title, url, image_url, ingredients, instructions), likes(user_id), want_to_cook_actions(user_id)`)
            .eq('id', id).single();
        setPost(data);
        setLoading(false);
    }

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return `${Math.floor(days / 7)}w ago`;
    }

    if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>;
    if (!post) return <div className="text-center py-16"><p className="note-text">Post not found</p></div>;

    const profile = post.profiles;
    const recipe = post.recipes;
    const isLiked = post.likes?.some((l) => l.user_id === user?.id);
    const likeCount = post.likes?.length || 0;
    const isWanted = post.want_to_cook_actions?.some((w) => w.user_id === user?.id);
    const wantToCookCount = post.want_to_cook_actions?.length || 0;

    return (
        <div className="px-4 py-6 animate-fade-in">
            <Link href="/feed" className="flex items-center gap-1 text-sm mb-4"
                style={{ color: 'var(--color-accent)', fontFamily: "'DM Mono', monospace" }}>← back to feed</Link>

            {/* User header */}
            <div className="flex items-center gap-3 mb-4">
                <Link href={profile?.id === user?.id ? '/profile' : `/profile/${profile?.id}`}>
                    <div className="avatar">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (profile?.name?.[0]?.toUpperCase() || '?')}
                    </div>
                </Link>
                <div>
                    <p className="font-semibold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{profile?.name}</p>
                    <p className="meta-label" style={{ textTransform: 'none' }}>{timeAgo(post.created_at)}</p>
                </div>
            </div>

            {/* Image */}
            {post.image_url && (
                <div className="rounded-md overflow-hidden mb-4" style={{ maxHeight: '380px' }}>
                    <img src={post.image_url} alt={recipe?.title} className="w-full object-cover" />
                </div>
            )}

            {/* Recipe title */}
            <div className="mb-2">
                <Link href={`/recipe/${recipe?.id}`}>
                    <h1 className="text-xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{recipe?.title}</h1>
                </Link>
            </div>

            {post.caption && (
                <p className="note-text text-sm leading-relaxed mb-4">&ldquo;{post.caption}&rdquo;</p>
            )}

            {recipe?.url && (
                <a href={recipe.url} target="_blank" rel="noopener noreferrer"
                    className="block text-sm mb-4" style={{ color: 'var(--color-sage)', fontFamily: "'DM Mono', monospace" }}>
                    ↗ recipe source
                </a>
            )}

            <div className="flex items-center gap-4 pb-4 mb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <LikeButton postId={post.id} initialLiked={isLiked} initialCount={likeCount} />
                <WantToCookButton postId={post.id} recipeId={recipe?.id} initialWanted={isWanted} initialCount={wantToCookCount} isOwnPost={post.user_id === user?.id} />
            </div>

            <h2 className="font-bold text-sm mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Comments</h2>
            <CommentSection postId={post.id} />
        </div>
    );
}
