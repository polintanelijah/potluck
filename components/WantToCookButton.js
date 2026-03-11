'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function WantToCookButton({ postId, recipeId, initialWanted = false, initialCount = 0, isOwnPost = false }) {
    const [wanted, setWanted] = useState(initialWanted);
    const [count, setCount] = useState(initialCount);
    const [animating, setAnimating] = useState(false);
    const { user } = useAuth();
    const supabase = getSupabase();

    if (isOwnPost) return null;

    async function toggleWantToCook() {
        if (!user || !recipeId) return;

        const wasWanted = wanted;
        setWanted(!wasWanted);
        setCount((c) => (wasWanted ? c - 1 : c + 1));
        setAnimating(true);
        setTimeout(() => setAnimating(false), 300);

        try {
            if (wasWanted) {
                await supabase
                    .from('want_to_cook_actions')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('post_id', postId);
                await supabase
                    .from('user_recipes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('recipe_id', recipeId)
                    .eq('status', 'want_to_cook');
            } else {
                await supabase.from('want_to_cook_actions').insert({
                    user_id: user.id,
                    post_id: postId,
                    recipe_id: recipeId,
                });
                await supabase.from('user_recipes').upsert({
                    user_id: user.id,
                    recipe_id: recipeId,
                    status: 'want_to_cook',
                }, { onConflict: 'user_id,recipe_id,status' });
            }
        } catch {
            setWanted(wasWanted);
            setCount((c) => (wasWanted ? c + 1 : c - 1));
        }
    }

    return (
        <button
            onClick={toggleWantToCook}
            className={`flex items-center gap-1.5 transition-all duration-150 ${animating ? 'heart-pop' : ''}`}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: wanted ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontSize: '0.85rem',
                padding: '4px 0',
            }}
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={wanted ? 'var(--color-accent)' : 'none'}
                stroke={wanted ? 'var(--color-accent)' : 'currentColor'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {count > 0 && (
                <span className="text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{count}</span>
            )}
        </button>
    );
}
