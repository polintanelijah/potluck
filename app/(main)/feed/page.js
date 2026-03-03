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

        const { data: following } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id);

        const followingIds = following?.map((f) => f.following_id) || [];
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
            <div className="mb-6">
                <h1 className="text-2xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    Potluck
                </h1>
                <p className="note-text text-xs mt-0.5">what your friends are cooking</p>
            </div>

            {/* Feed */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="spinner" />
                </div>
            ) : sessions.length === 0 ? (
                <div className="text-center py-16 animate-fade-in">
                    <h2 className="text-lg mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Your table is empty
                    </h2>
                    <p className="note-text text-sm mb-1">
                        Follow some friends to see what they&apos;re making,
                    </p>
                    <p className="note-text text-sm">
                        or post your first cook session.
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
