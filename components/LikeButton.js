'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function LikeButton({ sessionId, initialLiked = false, initialCount = 0 }) {
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [animating, setAnimating] = useState(false);
    const { user } = useAuth();
    const supabase = getSupabase();

    async function toggleLike() {
        if (!user) return;

        // Optimistic update
        const wasLiked = liked;
        setLiked(!wasLiked);
        setCount((c) => (wasLiked ? c - 1 : c + 1));
        setAnimating(true);
        setTimeout(() => setAnimating(false), 350);

        try {
            if (wasLiked) {
                await supabase
                    .from('likes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('cook_session_id', sessionId);
            } else {
                await supabase.from('likes').insert({
                    user_id: user.id,
                    cook_session_id: sessionId,
                });
            }
        } catch {
            // Revert on error
            setLiked(wasLiked);
            setCount((c) => (wasLiked ? c + 1 : c - 1));
        }
    }

    return (
        <button
            onClick={toggleLike}
            className={`flex items-center gap-1.5 transition-all duration-200 ${animating ? 'heart-pop' : ''}`}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: liked ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                fontSize: '0.9rem',
                padding: '4px 0',
            }}
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={liked ? 'var(--color-danger)' : 'none'}
                stroke={liked ? 'var(--color-danger)' : 'currentColor'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {count > 0 && <span className="font-medium text-sm">{count}</span>}
        </button>
    );
}
