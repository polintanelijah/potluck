'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function DiscoverPage() {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState([]);
    const [followingIds, setFollowingIds] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [suggested, setSuggested] = useState([]);
    const [copied, setCopied] = useState(false);
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => {
        let cancelled = false;

        async function loadDiscoverState() {
            if (!user) return;

            const [followingRes, suggestedRes] = await Promise.all([
                supabase.from('follows').select('following_id').eq('follower_id', user.id),
                supabase.from('profiles').select('id, name, username, avatar_url, bio').neq('id', user.id).order('created_at', { ascending: false }).limit(20),
            ]);

            if (cancelled) return;

            setFollowingIds(new Set(followingRes.data?.map((item) => item.following_id) || []));
            setSuggested(suggestedRes.data || []);
        }

        loadDiscoverState();
        return () => {
            cancelled = true;
        };
    }, [supabase, user]);

    async function searchUsers(nextQuery) {
        if (!nextQuery.trim()) {
            setUsers([]);
            return;
        }

        setLoading(true);
        const { data } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url, bio')
            .or(`name.ilike.%${nextQuery}%,username.ilike.%${nextQuery}%`)
            .neq('id', user.id)
            .limit(20);

        setUsers(data || []);
        setLoading(false);
    }

    async function toggleFollow(targetId) {
        const isFollowing = followingIds.has(targetId);
        setFollowingIds((previous) => {
            const next = new Set(previous);
            if (isFollowing) {
                next.delete(targetId);
            } else {
                next.add(targetId);
            }
            return next;
        });

        if (isFollowing) {
            await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
        } else {
            await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
        }
    }

    async function handleInvite() {
        const shareData = {
            title: 'Potluck',
            text: 'Come share what you\'re actually cooking!',
            url: window.location.origin,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch {
                // User cancelled the share sheet
            }
        } else {
            await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    const displayUsers = query.trim() ? users : suggested;

    return (
        <div className="px-4 py-6">
            <h1 className="text-2xl mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Discover
            </h1>
            <p className="note-text text-sm mb-6">find friends to cook with</p>

            <div
                className="flex items-center justify-between px-4 py-3 rounded-md mb-4"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}
            >
                <p className="note-text text-sm">Lonely? Tell your friends to join the Potluck! </p>
                <button onClick={handleInvite} className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    {copied ? 'Link Copied!' : 'Invite Friends'}
                </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', marginBottom: '1rem' }} />

            <input
                type="text"
                className="input-field mb-6"
                placeholder="Search by name or @username..."
                value={query}
                onChange={(e) => {
                    const nextQuery = e.target.value;
                    setQuery(nextQuery);
                    searchUsers(nextQuery);
                }}
            />

            {!query.trim() && <p className="label mb-3">People on Potluck</p>}

            {loading ? (
                <div className="flex justify-center py-8"><div className="spinner" /></div>
            ) : displayUsers.length === 0 ? (
                <div className="text-center py-12">
                    <p className="note-text text-sm">
                        {query.trim() ? 'No one by that name yet' : 'No one else here yet - invite your friends!'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {displayUsers.map((profile) => {
                        const isFollowing = followingIds.has(profile.id);
                        return (
                            <div
                                key={profile.id}
                                className="flex items-center gap-3 px-4 py-3 rounded-md animate-fade-in"
                                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}
                            >
                                <Link href={`/profile/${profile.id}`}>
                                    <div className="avatar">
                                        {profile.avatar_url ? (
                                            <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                        ) : (profile.name?.[0]?.toUpperCase() || '?')}
                                    </div>
                                </Link>
                                <div className="flex-1 min-w-0">
                                    <Link href={`/profile/${profile.id}`}>
                                        <p className="font-semibold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{profile.name}</p>
                                    </Link>
                                    {profile.username && <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>@{profile.username}</p>}
                                    {profile.bio && <p className="note-text text-xs truncate mt-0.5">{profile.bio}</p>}
                                </div>
                                <button
                                    onClick={() => toggleFollow(profile.id)}
                                    className={isFollowing ? 'btn-secondary' : 'btn-outline'}
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
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
