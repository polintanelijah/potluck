'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function RankingFlow({ recipeId, recipeTitle, onComplete }) {
    const [rankedRecipes, setRankedRecipes] = useState([]);
    const [low, setLow] = useState(0);
    const [high, setHigh] = useState(0);
    const [currentCompare, setCurrentCompare] = useState(null);
    const [phase, setPhase] = useState('loading'); // 'loading' | 'comparing' | 'done'
    const [comparisonsCount, setComparisonsCount] = useState(0);
    const [totalExpected, setTotalExpected] = useState(0);
    const { user } = useAuth();
    const supabase = getSupabase();

    const initRanking = useCallback(async () => {
        if (!user) return;

        // Fetch user's existing Elo ratings with recipe info, excluding the new recipe
        const { data: ratings } = await supabase
            .from('recipe_elo_ratings')
            .select('recipe_id, elo_score, recipes:recipe_id(id, title, image_url)')
            .eq('user_id', user.id)
            .neq('recipe_id', recipeId)
            .order('elo_score', { ascending: false });

        const existing = (ratings || []).filter((r) => r.recipes);

        if (existing.length === 0) {
            // First recipe — initialize Elo and skip comparisons
            await supabase.from('recipe_elo_ratings').upsert({
                user_id: user.id,
                recipe_id: recipeId,
                elo_score: 1500,
                total_comparisons: 0,
                wins: 0,
                losses: 0,
            });
            setPhase('done');
            return;
        }

        setRankedRecipes(existing);
        const h = existing.length;
        setLow(0);
        setHigh(h);
        setTotalExpected(Math.ceil(Math.log2(h + 1)));
        const mid = Math.floor(h / 2);
        setCurrentCompare(existing[mid]);
        setPhase('comparing');
    }, [user, recipeId, supabase]);

    useEffect(() => {
        initRanking();
    }, [initRanking]);

    async function handleVote(preferNew) {
        if (!currentCompare) return;

        const compareRecipeId = currentCompare.recipe_id;

        // Canonical ordering: smaller UUID = recipe_a
        const aId = recipeId < compareRecipeId ? recipeId : compareRecipeId;
        const bId = recipeId < compareRecipeId ? compareRecipeId : recipeId;
        const winnerId = preferNew ? recipeId : compareRecipeId;

        // Insert vote — trigger handles Elo update
        await supabase.from('pairwise_votes').insert({
            user_id: user.id,
            recipe_a_id: aId,
            recipe_b_id: bId,
            winner_id: winnerId,
        });

        const newCount = comparisonsCount + 1;
        setComparisonsCount(newCount);

        // Binary search: narrow the window
        const mid = Math.floor((low + high) / 2);
        let newLow = low;
        let newHigh = high;

        if (preferNew) {
            // New recipe is better than mid — search upper half
            newHigh = mid;
        } else {
            // Existing recipe is better — search lower half
            newLow = mid + 1;
        }

        if (newLow >= newHigh) {
            // Search complete
            setPhase('done');
            return;
        }

        setLow(newLow);
        setHigh(newHigh);
        const nextMid = Math.floor((newLow + newHigh) / 2);
        setCurrentCompare(rankedRecipes[nextMid]);
    }

    if (phase === 'loading') {
        return (
            <div className="flex justify-center py-12">
                <div className="spinner" />
            </div>
        );
    }

    if (phase === 'done') {
        return (
            <div className="text-center py-8 animate-fade-in">
                <div className="text-4xl mb-3">&#127942;</div>
                <h3 className="text-lg font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    Ranked!
                </h3>
                <p className="note-text text-sm mb-6">
                    {comparisonsCount === 0
                        ? `${recipeTitle} is your first ranked recipe.`
                        : `${recipeTitle} has been placed after ${comparisonsCount} comparison${comparisonsCount !== 1 ? 's' : ''}.`
                    }
                </p>
                <button onClick={onComplete} className="btn-primary">
                    Done
                </button>
            </div>
        );
    }

    // Comparing phase
    return (
        <div className="animate-fade-in">
            <div className="text-center mb-5">
                <p className="meta-label mb-1">
                    comparison {comparisonsCount + 1}{totalExpected > 0 ? ` of ~${totalExpected}` : ''}
                </p>
                <h3 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    Which do you prefer?
                </h3>
            </div>

            <div className="space-y-3">
                {/* New recipe */}
                <button
                    onClick={() => handleVote(true)}
                    className="w-full text-left px-4 py-4 rounded-md transition-colors"
                    style={{
                        background: 'var(--color-bg-card)',
                        border: '2px solid var(--color-border)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                    <p className="meta-label mb-1" style={{ textTransform: 'none' }}>new</p>
                    <p className="font-bold text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
                        {recipeTitle}
                    </p>
                </button>

                {/* vs divider */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                    <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>vs</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                </div>

                {/* Existing recipe */}
                <button
                    onClick={() => handleVote(false)}
                    className="w-full text-left px-4 py-4 rounded-md transition-colors"
                    style={{
                        background: 'var(--color-bg-card)',
                        border: '2px solid var(--color-border)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                    <div className="flex items-center gap-3">
                        {currentCompare?.recipes?.image_url ? (
                            <img src={currentCompare.recipes.image_url} alt="" className="w-10 h-10 rounded-md object-cover" />
                        ) : null}
                        <div className="flex-1 min-w-0">
                            <p className="meta-label mb-1" style={{ textTransform: 'none' }}>ranked</p>
                            <p className="font-bold text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
                                {currentCompare?.recipes?.title}
                            </p>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
}
