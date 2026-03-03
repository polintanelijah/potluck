'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function DiscoverPage() {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState([]);
    const [followingIds, setFollowingIds] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [suggested, setSuggested] = useState([]);
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => {
        if (user) {
            fetchFollowing();
            fetchSuggested();
        }
    }, [user]);

    async function fetchFollowing() {
        const { data } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id);
        setFollowingIds(new Set(data?.map((f) => f.following_id) || []));
    }

    async function fetchSuggested() {
        const { data } = await supabase
            .from('profiles')
            .select('id, name, avatar_url, bio')
            .neq('id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
        setSuggested(data || []);
    }

    async function searchUsers(q) {
        if (!q.trim()) {
            setUsers([]);
            return;
        }
        setLoading(true);
        const { data } = await supabase
            .from('profiles')
            .select('id, name, avatar_url, bio')
            .ilike('name', `%${q}%`)
            .neq('id', user.id)
            .limit(20);
        setUsers(data || []);
        setLoading(false);
    }

    async function toggleFollow(targetId) {
        const isFollowing = followingIds.has(targetId);

        // Optimistic update
        setFollowingIds((prev) => {
            const next = new Set(prev);
            if (isFollowing) {
                next.delete(targetId);
            } else {
                next.add(targetId);
            }
            return next;
        });

        if (isFollowing) {
            await supabase
                .from('follows')
                .delete()
                .eq('follower_id', user.id)
                .eq('following_id', targetId);
        } else {
            await supabase.from('follows').insert({
                follower_id: user.id,
                following_id: targetId,
            });
        }
    }

    const displayUsers = query.trim() ? users : suggested;

    return (
        <div className="px-4 py-6">
            <h1 className="text-2xl font-bold mb-6">Discover</h1>

            {/* Search */}
            <input
                type="text"
                className="input-field mb-6"
                placeholder="Search people..."
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    searchUsers(e.target.value);
                }}
            />

            {!query.trim() && (
                <p className="text-xs font-medium uppercase tracking-wider mb-4"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    People on Potluck
                </p>
            )}

            {loading ? (
                <div className="flex justify-center py-8">
                    <div className="spinner" />
                </div>
            ) : displayUsers.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {query.trim() ? 'No users found' : 'No one else is here yet!'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {displayUsers.map((u) => {
                        const isFollowing = followingIds.has(u.id);
                        return (
                            <div
                                key={u.id}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl animate-fade-in"
                                style={{ background: 'var(--color-bg-card)' }}
                            >
                                <Link href={`/profile/${u.id}`}>
                                    <div className="avatar">
                                        {u.avatar_url ? (
                                            <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            u.name?.[0]?.toUpperCase() || '?'
                                        )}
                                    </div>
                                </Link>
                                <div className="flex-1 min-w-0">
                                    <Link href={`/profile/${u.id}`}>
                                        <p className="font-semibold text-sm truncate">{u.name}</p>
                                    </Link>
                                    {u.bio && (
                                        <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                            {u.bio}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => toggleFollow(u.id)}
                                    className={isFollowing ? 'btn-secondary' : 'btn-outline'}
                                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                                >
                                    {isFollowing ? 'Following' : 'Follow'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
