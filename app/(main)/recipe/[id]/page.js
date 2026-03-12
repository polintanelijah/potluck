'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { formatRecipeTextList } from '@/lib/rankings';

export default function RecipeDetailPage({ params }) {
    const { id } = use(params);
    const [recipe, setRecipe] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const supabase = getSupabase();

    useEffect(() => {
        let cancelled = false;

        async function fetchRecipe() {
            const [recipeRes, sessionsRes] = await Promise.all([
                supabase.from('recipes').select('*, profiles:created_by(name)').eq('id', id).single(),
                supabase.from('posts').select('*, profiles:user_id(id, name, avatar_url)').eq('recipe_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
            ]);

            if (cancelled) return;

            setRecipe(recipeRes.data);
            setSessions(sessionsRes.data || []);
            setLoading(false);
        }

        if (id) {
            fetchRecipe();
        }

        return () => {
            cancelled = true;
        };
    }, [id, supabase]);

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

    const ingredients = formatRecipeTextList(recipe?.ingredients);
    const instructions = formatRecipeTextList(recipe?.instructions);

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

            <div className="flex items-center gap-4 mb-4 px-4 py-3 rounded-md" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div className="text-center flex-1">
                    <p className="font-bold text-lg" style={{ fontFamily: "'DM Mono', monospace" }}>{sessions.length}</p>
                    <p className="meta-label">times cooked</p>
                </div>
            </div>

            {recipe.url && (
                <a href={recipe.url} target="_blank" rel="noopener noreferrer"
                    className="block text-sm mb-4 px-4 py-3 rounded-md"
                    style={{ background: 'var(--color-ochre-glow)', color: 'var(--color-ochre)', border: '1px solid var(--color-ochre)', fontFamily: "'DM Mono', monospace" }}>
                    ↗ view original recipe
                </a>
            )}

            {ingredients.length > 0 && (
                <div className="mb-4">
                    <h2 className="text-sm mb-2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>Ingredients</h2>
                    <div className="px-4 py-3 rounded-md text-sm leading-relaxed"
                        style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                        <ul className="space-y-2">
                            {ingredients.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {instructions.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-sm mb-2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>Instructions</h2>
                    <div className="px-4 py-3 rounded-md text-sm leading-relaxed"
                        style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>
                        <ol className="space-y-2 list-decimal list-inside">
                            {instructions.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ol>
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
                    {sessions.map((session) => (
                        <Link key={session.id} href={`/session/${session.id}`}
                            className="flex items-center gap-3 px-4 py-3 rounded-md"
                            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)' }}>
                            <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.75rem' }}>
                                {session.profiles?.avatar_url ? (
                                    <img src={session.profiles.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (session.profiles?.name?.[0]?.toUpperCase() || '?')}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{session.profiles?.name}</p>
                                {session.caption && <p className="note-text text-xs truncate">{session.caption}</p>}
                            </div>
                            <span className="meta-label" style={{ textTransform: 'none' }}>{timeAgo(session.created_at)}</span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
