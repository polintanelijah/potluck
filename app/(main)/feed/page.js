'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import PostCard from '@/components/PostCard';

export default function FeedPage() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => {
        let cancelled = false;

        async function fetchFeed() {
            if (!user) return;

            setLoading(true);

            const { data: following } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.id);

            const followingIds = following?.map((item) => item.following_id) || [];
            followingIds.push(user.id);

            const { data } = await supabase
                .from('posts')
                .select(`
                    *,
                    profiles:user_id(id, name, username, avatar_url),
                    recipes:recipe_id(id, title, url, image_url),
                    likes(user_id),
                    want_to_cook_actions(user_id),
                    comments(count)
                `)
                .is('deleted_at', null)
                .in('user_id', followingIds)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!cancelled) {
                setPosts(data || []);
                setLoading(false);
            }
        }

        fetchFeed();
        return () => {
            cancelled = true;
        };
    }, [supabase, user]);

    return (
        <div className="px-4 py-6">
            <div className="mb-6">
                <h1 className="text-2xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    Potluck
                </h1>
                <p className="note-text text-xs mt-0.5">what your friends are cooking</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="spinner" />
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-16 animate-fade-in">
                    <h2 className="text-lg mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Your table is empty
                    </h2>
                    <p className="note-text text-sm mb-1">
                        Follow some friends to see what they&apos;re making,
                    </p>
                    <p className="note-text text-sm">
                        or log your first cook.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <PostCard key={post.id} post={post} currentUserId={user.id} />
                    ))}
                </div>
            )}
        </div>
    );
}
