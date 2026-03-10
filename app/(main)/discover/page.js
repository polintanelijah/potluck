'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import RecipeCard from '@/components/RecipeCard';
import SearchBar from '@/components/SearchBar';
import TagFilter from '@/components/TagFilter';

export default function DiscoverPage() {
    const [tab, setTab] = useState('recipes');

    return (
        <div className="px-4 py-6">
            <h1 className="text-2xl mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Discover
            </h1>
            <p className="note-text text-sm mb-4">browse recipes and find friends</p>

            {/* Sub-tab switcher */}
            <div className="flex gap-1 mb-5 p-0.5 rounded-md"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                {['recipes', 'people'].map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className="flex-1 py-2 text-xs rounded-md transition-all duration-150"
                        style={{
                            fontFamily: "'DM Mono', monospace",
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            fontWeight: tab === t ? 500 : 400,
                            background: tab === t ? 'var(--color-bg-card)' : 'transparent',
                            color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                            boxShadow: tab === t ? '0 1px 3px rgba(44,36,22,0.08)' : 'none',
                            cursor: 'pointer',
                            border: 'none',
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === 'recipes' ? <RecipesTab /> : <PeopleTab />}
        </div>
    );
}

function RecipesTab() {
    const [recipes, setRecipes] = useState([]);
    const [allTags, setAllTags] = useState([]);
    const [selectedTag, setSelectedTag] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const supabase = getSupabase();

    // Fetch available tags once
    useEffect(() => {
        let cancelled = false;
        supabase
            .from('recipes')
            .select('tags')
            .then(({ data }) => {
                if (cancelled || !data) return;
                const tagSet = new Set();
                data.forEach((r) => {
                    if (r.tags) r.tags.forEach((t) => tagSet.add(t));
                });
                setAllTags([...tagSet].sort());
            });
        return () => { cancelled = true; };
    }, [supabase]);

    // Fetch recipes when filters change
    useEffect(() => {
        let cancelled = false;

        let q = supabase
            .from('recipes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (selectedTag) {
            q = q.contains('tags', [selectedTag]);
        }

        if (searchQuery) {
            q = q.ilike('title', `%${searchQuery}%`);
        }

        q.then(({ data }) => {
            if (cancelled) return;
            setRecipes(data || []);
            setLoading(false);
        });

        return () => { cancelled = true; };
    }, [supabase, selectedTag, searchQuery]);

    const handleSearch = useCallback((q) => {
        setSearchQuery(q);
    }, []);

    return (
        <div>
            <SearchBar placeholder="Search recipes..." onSearch={handleSearch} />

            <div className="mt-3 mb-4">
                <TagFilter tags={allTags} selectedTag={selectedTag} onTagSelect={setSelectedTag} />
            </div>

            {loading ? (
                <div className="flex justify-center py-8"><div className="spinner" /></div>
            ) : recipes.length === 0 ? (
                <div className="text-center py-12">
                    <p className="note-text text-sm">
                        {searchQuery || selectedTag
                            ? 'No recipes match those filters'
                            : 'No recipes yet — be the first to add one!'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {recipes.map((recipe) => (
                        <RecipeCard key={recipe.id} recipe={recipe} />
                    ))}
                </div>
            )}
        </div>
    );
}

function PeopleTab() {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState([]);
    const [followingIds, setFollowingIds] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [suggested, setSuggested] = useState([]);
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => {
        if (!user) return;
        let cancelled = false;

        supabase.from('follows').select('following_id').eq('follower_id', user.id)
            .then(({ data }) => {
                if (cancelled) return;
                setFollowingIds(new Set(data?.map((f) => f.following_id) || []));
            });

        supabase.from('profiles')
            .select('id, name, username, avatar_url, bio')
            .neq('id', user.id)
            .order('created_at', { ascending: false })
            .limit(20)
            .then(({ data }) => {
                if (cancelled) return;
                setSuggested(data || []);
            });

        return () => { cancelled = true; };
    }, [user, supabase]);

    async function searchUsers(q) {
        if (!q.trim()) { setUsers([]); return; }
        setLoading(true);
        const { data } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url, bio')
            .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
            .neq('id', user.id)
            .limit(20);
        setUsers(data || []);
        setLoading(false);
    }

    async function toggleFollow(targetId) {
        const isFollowing = followingIds.has(targetId);
        setFollowingIds((prev) => {
            const next = new Set(prev);
            isFollowing ? next.delete(targetId) : next.add(targetId);
            return next;
        });
        if (isFollowing) {
            await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
        } else {
            await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
        }
    }

    const displayUsers = query.trim() ? users : suggested;

    return (
        <div>
            <input
                type="text"
                className="input-field mb-4"
                placeholder="Search by name or @username..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); searchUsers(e.target.value); }}
            />

            {!query.trim() && <p className="label mb-3">People on Potluck</p>}

            {loading ? (
                <div className="flex justify-center py-8"><div className="spinner" /></div>
            ) : displayUsers.length === 0 ? (
                <div className="text-center py-12">
                    <p className="note-text text-sm">
                        {query.trim() ? 'No one by that name yet' : 'No one else here yet — invite your friends!'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {displayUsers.map((u) => {
                        const isFollowing = followingIds.has(u.id);
                        return (
                            <div
                                key={u.id}
                                className="flex items-center gap-3 px-4 py-3 rounded-md animate-fade-in"
                                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}
                            >
                                <Link href={`/profile/${u.id}`}>
                                    <div className="avatar">
                                        {u.avatar_url ? (
                                            <Image src={u.avatar_url} alt="" width={40} height={40} className="w-full h-full rounded-full object-cover" unoptimized />
                                        ) : (u.name?.[0]?.toUpperCase() || '?')}
                                    </div>
                                </Link>
                                <div className="flex-1 min-w-0">
                                    <Link href={`/profile/${u.id}`}>
                                        <p className="font-semibold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{u.name}</p>
                                    </Link>
                                    {u.username && <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>@{u.username}</p>}
                                    {u.bio && <p className="note-text text-xs truncate mt-0.5">{u.bio}</p>}
                                </div>
                                <button
                                    onClick={() => toggleFollow(u.id)}
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
