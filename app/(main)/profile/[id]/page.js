'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CookSessionCard from '@/components/CookSessionCard';
import Link from 'next/link';

export default function OtherProfilePage({ params }) {
    const { id } = use(params);
    const [profileData, setProfileData] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [followers, setFollowers] = useState([]);
    const [followingList, setFollowingList] = useState([]);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('cooks');
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => { if (user && id) fetchAll(); }, [user, id]);

    async function fetchAll() {
        setLoading(true);
        const [profileRes, sessionsRes, followersRes, followingRes, followCheckRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', id).single(),
            supabase.from('cook_sessions').select(`*, profiles:user_id(id, name, username, avatar_url), recipes:recipe_id(id, title, url, image_url), likes(user_id), comments(count)`).eq('user_id', id).order('created_at', { ascending: false }),
            supabase.from('follows').select('follower_id, profiles:follower_id(id, name, username, avatar_url)').eq('following_id', id),
            supabase.from('follows').select('following_id, profiles:following_id(id, name, username, avatar_url)').eq('follower_id', id),
            supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', id).single(),
        ]);
        setProfileData(profileRes.data);
        setSessions(sessionsRes.data || []);
        setFollowers(followersRes.data || []);
        setFollowingList(followingRes.data || []);
        setFollowerCount(followersRes.data?.length || 0);
        setFollowingCount(followingRes.data?.length || 0);
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

    function UserList({ users, emptyText }) {
        if (users.length === 0) return <p className="note-text text-sm text-center py-8">{emptyText}</p>;
        return (
            <div className="space-y-2">
                {users.map((f) => {
                    const p = f.profiles;
                    return (
                        <Link key={p.id} href={p.id === user.id ? '/profile' : `/profile/${p.id}`}
                            className="flex items-center gap-3 px-4 py-3 rounded-md"
                            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                            <div className="avatar" style={{ width: '2.25rem', height: '2.25rem', fontSize: '0.85rem' }}>
                                {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : (p.name?.[0]?.toUpperCase() || '?')}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{p.name}</p>
                                {p.username && <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>@{p.username}</p>}
                            </div>
                        </Link>
                    );
                })}
            </div>
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

            {/* Stats — tappable */}
            <div className="flex gap-0 mb-4 rounded-md overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                <button onClick={() => setActiveTab('cooks')} className="flex-1 py-2.5 text-center transition-colors"
                    style={{ background: activeTab === 'cooks' ? 'var(--color-bg-card)' : 'transparent', borderRight: '1px solid var(--color-border)' }}>
                    <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{sessions.length}</p>
                    <p className="meta-label">cooks</p>
                </button>
                <button onClick={() => setActiveTab('followers')} className="flex-1 py-2.5 text-center transition-colors"
                    style={{ background: activeTab === 'followers' ? 'var(--color-bg-card)' : 'transparent', borderRight: '1px solid var(--color-border)' }}>
                    <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{followerCount}</p>
                    <p className="meta-label">followers</p>
                </button>
                <button onClick={() => setActiveTab('following')} className="flex-1 py-2.5 text-center transition-colors"
                    style={{ background: activeTab === 'following' ? 'var(--color-bg-card)' : 'transparent' }}>
                    <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{followingCount}</p>
                    <p className="meta-label">following</p>
                </button>
            </div>

            <button onClick={toggleFollow} className={`w-full mb-6 ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}>
                {isFollowing ? 'Following' : 'Follow'}
            </button>

            {activeTab === 'cooks' && (
                <>
                    <p className="label mb-3">Cook log</p>
                    {sessions.length === 0 ? <p className="text-center py-8 note-text text-sm">No cook sessions yet</p> : (
                        <div className="space-y-4">{sessions.map((session) => (<CookSessionCard key={session.id} session={session} currentUserId={user.id} />))}</div>
                    )}
                </>
            )}

            {activeTab === 'followers' && (
                <>
                    <p className="label mb-3">Followers</p>
                    <UserList users={followers} emptyText="No followers yet" />
                </>
            )}

            {activeTab === 'following' && (
                <>
                    <p className="label mb-3">Following</p>
                    <UserList users={followingList} emptyText="Not following anyone yet" />
                </>
            )}
        </div>
    );
}
