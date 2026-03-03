'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CookSessionCard from '@/components/CookSessionCard';
import Link from 'next/link';

export default function ProfilePage() {
    const [profileData, setProfileData] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [followers, setFollowers] = useState([]);
    const [followingList, setFollowingList] = useState([]);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [editBio, setEditBio] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [activeTab, setActiveTab] = useState('cooks'); // 'cooks' | 'followers' | 'following'
    const { user, signOut, refreshProfile } = useAuth();
    const supabase = getSupabase();

    useEffect(() => { if (user) fetchAll(); }, [user]);

    async function fetchAll() {
        setLoading(true);
        const [profileRes, sessionsRes, followersRes, followingRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('cook_sessions').select(`*, profiles:user_id(id, name, username, avatar_url), recipes:recipe_id(id, title, url, image_url), likes(user_id), comments(count)`).eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('follows').select('follower_id, profiles:follower_id(id, name, username, avatar_url)').eq('following_id', user.id),
            supabase.from('follows').select('following_id, profiles:following_id(id, name, username, avatar_url)').eq('follower_id', user.id),
        ]);
        setProfileData(profileRes.data);
        setEditName(profileRes.data?.name || '');
        setEditUsername(profileRes.data?.username || '');
        setEditBio(profileRes.data?.bio || '');
        setSessions(sessionsRes.data || []);
        setFollowers(followersRes.data || []);
        setFollowingList(followingRes.data || []);
        setFollowerCount(followersRes.data?.length || 0);
        setFollowingCount(followingRes.data?.length || 0);
        setLoading(false);
    }

    async function saveProfile() {
        setSaving(true);
        setSaveError('');
        const cleanUsername = editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (cleanUsername.length < 3) {
            setSaveError('Username must be at least 3 characters');
            setSaving(false);
            return;
        }
        // Check uniqueness if changed
        if (cleanUsername !== profileData?.username) {
            const { data: existing } = await supabase.from('profiles').select('id').eq('username', cleanUsername).neq('id', user.id).single();
            if (existing) {
                setSaveError('That username is taken');
                setSaving(false);
                return;
            }
        }
        const { error } = await supabase.from('profiles').update({ name: editName.trim(), username: cleanUsername, bio: editBio.trim() }).eq('id', user.id);
        if (error) { setSaveError(error.message); setSaving(false); return; }
        setEditMode(false);
        setSaving(false);
        await refreshProfile();
        fetchAll();
    }

    if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>;

    return (
        <div className="px-4 py-6">
            {/* Profile header */}
            <div className="flex items-start gap-4 mb-4">
                <div className="avatar avatar-lg">
                    {profileData?.avatar_url ? (
                        <img src={profileData.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (profileData?.name?.[0]?.toUpperCase() || '?')}
                </div>
                <div className="flex-1">
                    {editMode ? (
                        <div className="space-y-2">
                            {saveError && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{saveError}</p>}
                            <input type="text" className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" />
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-muted)' }}>@</span>
                                <input type="text" className="input-field" style={{ paddingLeft: '1.75rem' }} value={editUsername} onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="username" />
                            </div>
                            <textarea className="input-field" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="A few words about you..." rows={2} />
                            <div className="flex gap-2">
                                <button onClick={saveProfile} className="btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                                <button onClick={() => { setEditMode(false); setSaveError(''); }} className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{profileData?.name}</h2>
                            {profileData?.username && (
                                <p className="text-sm" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>@{profileData.username}</p>
                            )}
                            {profileData?.bio && <p className="note-text text-sm mt-1">{profileData.bio}</p>}
                        </>
                    )}
                </div>
            </div>

            {/* Stats — tappable */}
            {!editMode && (
                <div className="flex gap-0 mb-4 rounded-md overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                    <button
                        onClick={() => setActiveTab('cooks')}
                        className="flex-1 py-2.5 text-center transition-colors"
                        style={{
                            background: activeTab === 'cooks' ? 'var(--color-bg-card)' : 'transparent',
                            borderRight: '1px solid var(--color-border)',
                        }}
                    >
                        <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{sessions.length}</p>
                        <p className="meta-label">cooks</p>
                    </button>
                    <button
                        onClick={() => setActiveTab('followers')}
                        className="flex-1 py-2.5 text-center transition-colors"
                        style={{
                            background: activeTab === 'followers' ? 'var(--color-bg-card)' : 'transparent',
                            borderRight: '1px solid var(--color-border)',
                        }}
                    >
                        <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{followerCount}</p>
                        <p className="meta-label">followers</p>
                    </button>
                    <button
                        onClick={() => setActiveTab('following')}
                        className="flex-1 py-2.5 text-center transition-colors"
                        style={{ background: activeTab === 'following' ? 'var(--color-bg-card)' : 'transparent' }}
                    >
                        <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{followingCount}</p>
                        <p className="meta-label">following</p>
                    </button>
                </div>
            )}

            {/* Actions */}
            {!editMode && (
                <div className="flex gap-2 mb-6">
                    <button onClick={() => setEditMode(true)} className="btn-secondary flex-1" style={{ fontSize: '0.8rem' }}>Edit Profile</button>
                    <button onClick={signOut} className="btn-secondary" style={{ fontSize: '0.8rem', color: 'var(--color-accent)' }}>Log Out</button>
                </div>
            )}

            {/* Tab content */}
            {activeTab === 'cooks' && (
                <>
                    <p className="label mb-3">Your cook log</p>
                    {sessions.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="note-text text-sm">Nothing logged yet. <Link href="/post" style={{ color: 'var(--color-accent)' }}>Cook something!</Link></p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sessions.map((session) => (<CookSessionCard key={session.id} session={session} currentUserId={user.id} />))}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'followers' && (
                <>
                    <p className="label mb-3">People who follow you</p>
                    {followers.length === 0 ? (
                        <p className="note-text text-sm text-center py-8">No followers yet</p>
                    ) : (
                        <div className="space-y-2">
                            {followers.map((f) => {
                                const p = f.profiles;
                                return (
                                    <Link key={p.id} href={`/profile/${p.id}`}
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
                    )}
                </>
            )}

            {activeTab === 'following' && (
                <>
                    <p className="label mb-3">People you follow</p>
                    {followingList.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="note-text text-sm">Not following anyone yet. <Link href="/discover" style={{ color: 'var(--color-accent)' }}>Find friends!</Link></p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {followingList.map((f) => {
                                const p = f.profiles;
                                return (
                                    <Link key={p.id} href={`/profile/${p.id}`}
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
                    )}
                </>
            )}
        </div>
    );
}
