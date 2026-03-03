'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CookSessionCard from '@/components/CookSessionCard';
import Link from 'next/link';

export default function ProfilePage() {
    const [profileData, setProfileData] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState('');
    const [editBio, setEditBio] = useState('');
    const [saving, setSaving] = useState(false);
    const { user, signOut, refreshProfile } = useAuth();
    const supabase = getSupabase();

    useEffect(() => { if (user) fetchAll(); }, [user]);

    async function fetchAll() {
        setLoading(true);
        const [profileRes, sessionsRes, followersRes, followingRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('cook_sessions').select(`*, profiles:user_id(id, name, avatar_url), recipes:recipe_id(id, title, url, image_url), likes(user_id), comments(count)`).eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', user.id),
            supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', user.id),
        ]);
        setProfileData(profileRes.data);
        setEditName(profileRes.data?.name || '');
        setEditBio(profileRes.data?.bio || '');
        setSessions(sessionsRes.data || []);
        setFollowerCount(followersRes.count || 0);
        setFollowingCount(followingRes.count || 0);
        setLoading(false);
    }

    async function saveProfile() {
        setSaving(true);
        await supabase.from('profiles').update({ name: editName.trim(), bio: editBio.trim() }).eq('id', user.id);
        setEditMode(false);
        setSaving(false);
        await refreshProfile();
        fetchAll();
    }

    if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>;

    return (
        <div className="px-4 py-6">
            {/* Profile header */}
            <div className="flex items-start gap-4 mb-6">
                <div className="avatar avatar-lg">
                    {profileData?.avatar_url ? (
                        <img src={profileData.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                        profileData?.name?.[0]?.toUpperCase() || '?'
                    )}
                </div>
                <div className="flex-1">
                    {editMode ? (
                        <div className="space-y-2">
                            <input type="text" className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" />
                            <textarea className="input-field" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="A few words about you..." rows={2} />
                            <div className="flex gap-2">
                                <button onClick={saveProfile} className="btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button onClick={() => setEditMode(false)} className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{profileData?.name}</h2>
                            {profileData?.bio && <p className="note-text text-sm mt-1">{profileData.bio}</p>}
                            <div className="flex gap-5 mt-3">
                                <div>
                                    <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{sessions.length}</p>
                                    <p className="meta-label">cooks</p>
                                </div>
                                <div>
                                    <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{followerCount}</p>
                                    <p className="meta-label">followers</p>
                                </div>
                                <div>
                                    <p className="font-bold text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{followingCount}</p>
                                    <p className="meta-label">following</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Actions */}
            {!editMode && (
                <div className="flex gap-2 mb-6">
                    <button onClick={() => setEditMode(true)} className="btn-secondary flex-1" style={{ fontSize: '0.8rem' }}>Edit Profile</button>
                    <button onClick={signOut} className="btn-secondary" style={{ fontSize: '0.8rem', color: 'var(--color-accent)' }}>Log Out</button>
                </div>
            )}

            {/* Cook sessions */}
            <p className="label mb-3">Your cook log</p>

            {sessions.length === 0 ? (
                <div className="text-center py-8">
                    <p className="note-text text-sm">
                        Nothing logged yet. <Link href="/post" style={{ color: 'var(--color-accent)' }}>Cook something!</Link>
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sessions.map((session) => (
                        <CookSessionCard key={session.id} session={session} currentUserId={user.id} />
                    ))}
                </div>
            )}
        </div>
    );
}
