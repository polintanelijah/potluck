'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import RankingFlow from './RankingFlow';

export default function HaveCookedButton({ postId, recipeId, recipeTitle, initialCooked = false, initialCount = 0, isOwnPost = false, className = '' }) {
    const [cooked, setCooked] = useState(initialCooked);
    const [count, setCount] = useState(initialCount);
    const [animating, setAnimating] = useState(false);
    const [showRanking, setShowRanking] = useState(false);
    const { user } = useAuth();
    const supabase = getSupabase();

    if (isOwnPost) return null;

    async function handleCook() {
        if (!user || !recipeId || cooked) return;

        setCooked(true);
        setCount((c) => c + 1);
        setAnimating(true);
        setTimeout(() => setAnimating(false), 300);

        try {
            const { error } = await supabase.from('user_recipes').insert({
                user_id: user.id,
                recipe_id: recipeId,
                post_id: postId,
                status: 'cooked',
                cooked_at: new Date().toISOString(),
            });

            if (error) {
                if (error.code === '23505') {
                    // Already cooked — not an error, just stale UI state
                    return;
                }
                throw error;
            }

            setShowRanking(true);
        } catch {
            setCooked(false);
            setCount((c) => c - 1);
        }
    }

    return (
        <>
            <button
                onClick={handleCook}
                disabled={cooked}
                className={`flex items-center gap-1.5 transition-all duration-150 ${animating ? 'heart-pop' : ''} ${className}`}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: cooked ? 'default' : 'pointer',
                    color: cooked ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    fontSize: '0.85rem',
                    padding: '4px 0',
                    opacity: cooked ? 0.8 : 1,
                }}
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={cooked ? 'var(--color-accent)' : 'none'}
                    stroke={cooked ? 'var(--color-accent)' : 'currentColor'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M7 11a4 4 0 0 1 0-8 4.7 4.7 0 0 1 2.8.9A4.9 4.9 0 0 1 18 7a3 3 0 0 1-1 5.82V15a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2.18A3 3 0 0 1 7 11Z" />
                    <path d="M9 17v2" />
                    <path d="M15 17v2" />
                    <path d="M10 21h4" />
                </svg>
                {count > 0 && (
                    <span className="text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{count}</span>
                )}
            </button>

            {showRanking && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                >
                    <div className="glass-card p-6 mx-4 w-full max-w-md max-h-[80vh] overflow-y-auto">
                        <RankingFlow
                            recipeId={recipeId}
                            recipeTitle={recipeTitle}
                            onComplete={() => setShowRanking(false)}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
