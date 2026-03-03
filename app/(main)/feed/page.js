'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CookSessionCard from '@/components/CookSessionCard';

export default function FeedPage() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => {
        if (user) fetchFeed();
    }, [user]);

    async function fetchFeed() {
        setLoading(true);

        // Get users the current user follows
        const { data: following } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id);

        const followingIds = following?.map((f) => f.following_id) || [];
        // Include own posts in feed
        followingIds.push(user.id);

        const { data } = await supabase
            .from('cook_sessions')
            .select(`
        *,
        profiles:user_id(id, name, avatar_url),
        recipes:recipe_id(id, title, url, image_url),
        likes(user_id),
        comments(count)
      `)
            .in('user_id', followingIds)
            .order('created_at', { ascending: false })
            .limit(50);

        setSessions(data || []);
        setLoading(false);
    }

    return (
        <div className="px-4 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">
                    <span style={{ color: 'var(--color-accent)' }}>🍲</span> Potluck
                </h1>
            </div>

            {/* Feed */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="spinner" />
                </div>
            ) : sessions.length === 0 ? (
                <div className="text-center py-16 animate-fade-in">
                    <p className="text-5xl mb-4">👋</p>
                    <h2 className="text-lg font-bold mb-2">Your feed is empty</h2>
                    <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                        Follow some friends to see what they&apos;re cooking, or post your first cook session!
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sessions.map((session) => (
                        <CookSessionCard
                            key={session.id}
                            session={session}
                            currentUserId={user.id}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
