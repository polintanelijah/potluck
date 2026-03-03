'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CookSessionCard from '@/components/CookSessionCard';

export default function OtherProfilePage({ params }) {
    const { id } = use(params);
    const [profileData, setProfileData] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => {
        if (user && id) fetchAll();
    }, [user, id]);

    async function fetchAll() {
        setLoading(true);

        const [profileRes, sessionsRes, followersRes, followingRes, followCheckRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', id).single(),
            supabase
                .from('cook_sessions')
                .select(`
          *,
          profiles:user_id(id, name, avatar_url),
          recipes:recipe_id(id, title, url, image_url),
          likes(user_id),
          comments(count)
        `)
                .eq('user_id', id)
                .order('created_at', { ascending: false }),
            supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', id),
            supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', id),
            supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', id).single(),
        ]);

        setProfileData(profileRes.data);
        setSessions(sessionsRes.data || []);
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

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="spinner" />
            </div>
        );
    }

    if (!profileData) {
        return (
            <div className="text-center py-16">
                <p style={{ color: 'var(--color-text-secondary)' }}>User not found</p>
            </div>
        );
    }

    return (
        <div className="px-4 py-6">
            {/* Profile header */}
            <div className="flex items-start gap-4 mb-6">
                <div className="avatar avatar-lg">
                    {profileData.avatar_url ? (
                        <img src={profileData.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                        profileData.name?.[0]?.toUpperCase() || '?'
                    )}
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold">{profileData.name}</h2>
                    {profileData.bio && (
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            {profileData.bio}
                        </p>
                    )}
                    <div className="flex gap-4 mt-3">
                        <div className="text-center">
                            <p className="font-bold text-sm">{sessions.length}</p>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Cooks</p>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-sm">{followerCount}</p>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Followers</p>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-sm">{followingCount}</p>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Following</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Follow button */}
            <button
                onClick={toggleFollow}
                className={`w-full mb-6 ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
            >
                {isFollowing ? 'Following' : 'Follow'}
            </button>

            {/* Cook sessions */}
            <p className="text-xs font-medium uppercase tracking-wider mb-4"
                style={{ color: 'var(--color-text-secondary)' }}>
                Cook Sessions
            </p>

            {sessions.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    No cook sessions yet
                </p>
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
