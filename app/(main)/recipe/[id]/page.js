'use client';

import { useState, useEffect, use } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import StarRating from '@/components/StarRating';
import Link from 'next/link';

export default function RecipeDetailPage({ params }) {
    const { id } = use(params);
    const [recipe, setRecipe] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => { if (id) fetchRecipe(); }, [id]);

    async function fetchRecipe() {
        const [recipeRes, sessionsRes] = await Promise.all([
            supabase.from('recipes').select('*, profiles:created_by(name)').eq('id', id).single(),
            supabase.from('cook_sessions').select('*, profiles:user_id(id, name, avatar_url)').eq('recipe_id', id).order('created_at', { ascending: false }),
        ]);
        setRecipe(recipeRes.data);
        setSessions(sessionsRes.data || []);
        setLoading(false);
    }

    function avgRating() {
        if (!sessions.length) return 0;
        return (sessions.reduce((sum, s) => sum + s.rating, 0) / sessions.length).toFixed(1);
    }

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return `${Math.floor(days / 7)}w ago`;
    }

    if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>;
    if (!recipe) return <div className="text-center py-16"><p className="note-text">Recipe not found</p></div>;

    return (
        <div className="px-4 py-6 animate-fade-in">
            <Link href="/feed" className="flex items-center gap-1 text-sm mb-4"
                style={{ color: 'var(--color-accent)', fontFamily: "'DM Mono', monospace" }}>← back</Link>

            {recipe.image_url && (
                <div className="rounded-md overflow-hidden mb-4" style={{ maxHeight: '280px' }}>
                    <img src={recipe.image_url} alt={recipe.title} className="w-full object-cover" />
                </div>
            )}

            <h1 className="text-2xl mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{recipe.title}</h1>
            <p className="meta-label mb-4" style={{ textTransform: 'none' }}>added by {recipe.profiles?.name || 'unknown'}</p>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-4 px-4 py-3 rounded-md" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div className="text-center flex-1">
                    <p className="font-bold text-lg" style={{ fontFamily: "'DM Mono', monospace" }}>{sessions.length}</p>
                    <p className="meta-label">times cooked</p>
                </div>
                <div className="w-px h-8" style={{ background: 'var(--color-border)' }} />
                <div className="text-center flex-1">
                    <p className="font-bold text-lg" style={{ fontFamily: "'DM Mono', monospace" }}>{avgRating()}</p>
                    <p className="meta-label">avg rating</p>
                </div>
            </div>

            {recipe.url && (
                <a href={recipe.url} target="_blank" rel="noopener noreferrer"
                    className="block text-sm mb-4 px-4 py-3 rounded-md"
                    style={{ background: 'var(--color-ochre-glow)', color: 'var(--color-ochre)', border: '1px solid var(--color-ochre)', fontFamily: "'DM Mono', monospace" }}>
                    ↗ view original recipe
                </a>
            )}

            {recipe.ingredients && (
                <div className="mb-4">
                    <h2 className="text-sm mb-2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>Ingredients</h2>
                    <div className="px-4 py-3 rounded-md text-sm whitespace-pre-wrap leading-relaxed"
                        style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                        {recipe.ingredients}
                    </div>
                </div>
            )}

            {recipe.instructions && (
                <div className="mb-6">
                    <h2 className="text-sm mb-2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>Instructions</h2>
                    <div className="px-4 py-3 rounded-md text-sm whitespace-pre-wrap leading-relaxed"
                        style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                        {recipe.instructions}
                    </div>
                </div>
            )}

            <h2 className="text-sm mb-3" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                Who&apos;s cooked this ({sessions.length})
            </h2>

            {sessions.length === 0 ? (
                <p className="note-text text-sm py-4 text-center">No one has tried this yet — be the first!</p>
            ) : (
                <div className="space-y-2">
                    {sessions.map((s) => (
                        <Link key={s.id} href={`/session/${s.id}`}
                            className="flex items-center gap-3 px-4 py-3 rounded-md"
                            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                            <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.75rem' }}>
                                {s.profiles?.avatar_url ? (
                                    <img src={s.profiles.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (s.profiles?.name?.[0]?.toUpperCase() || '?')}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{s.profiles?.name}</p>
                                {s.notes && <p className="note-text text-xs truncate">{s.notes}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <StarRating rating={s.rating} size="sm" />
                                <span className="meta-label" style={{ textTransform: 'none' }}>{timeAgo(s.created_at)}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
