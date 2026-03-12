'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RANKING_BUCKETS } from '@/lib/rankings';

export default function RankingFlow({ recipeId, recipeTitle, onComplete }) {
    const [phase, setPhase] = useState('bucket');
    const [bucket, setBucket] = useState(null);
    const [bucketRecipes, setBucketRecipes] = useState([]);
    const [existingRanking, setExistingRanking] = useState(null);
    const [currentCompare, setCurrentCompare] = useState(null);
    const [low, setLow] = useState(0);
    const [high, setHigh] = useState(0);
    const [comparisonsCount, setComparisonsCount] = useState(0);
    const [totalExpected, setTotalExpected] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => {
        let cancelled = false;

        async function loadExistingRanking() {
            if (!user || !recipeId) return;

            const { data } = await supabase
                .from('user_recipe_rankings')
                .select('bucket, rank_position')
                .eq('user_id', user.id)
                .eq('recipe_id', recipeId)
                .maybeSingle();

            if (!cancelled && data) {
                setExistingRanking(data);
                setBucket(data.bucket);
            }
        }

        loadExistingRanking();
        return () => {
            cancelled = true;
        };
    }, [recipeId, supabase, user]);

    async function beginBucketRanking(nextBucket) {
        if (!user) return;

        setSaving(true);
        setError('');
        setBucket(nextBucket);
        setComparisonsCount(0);
        setPhase('loading');

        const { data } = await supabase
            .from('user_recipe_rankings')
            .select('recipe_id, rank_position, recipes:recipe_id(id, title, image_url)')
            .eq('user_id', user.id)
            .eq('bucket', nextBucket)
            .neq('recipe_id', recipeId)
            .order('rank_position', { ascending: true });

        const ranked = (data || []).filter((item) => item.recipes);
        setBucketRecipes(ranked);

        if (ranked.length === 0) {
            await persistRanking(nextBucket, 0);
            return;
        }

        const upperBound = ranked.length;
        const mid = Math.floor(upperBound / 2);
        setLow(0);
        setHigh(upperBound);
        setTotalExpected(Math.ceil(Math.log2(upperBound + 1)));
        setCurrentCompare(ranked[mid]);
        setPhase('comparing');
        setSaving(false);
    }

    async function persistRanking(targetBucket, insertionIndex) {
        if (!user) return;

        setSaving(true);
        setError('');

        const { data: allRankings, error: fetchError } = await supabase
            .from('user_recipe_rankings')
            .select('recipe_id, bucket, rank_position')
            .eq('user_id', user.id)
            .neq('recipe_id', recipeId);

        if (fetchError) {
            setError(fetchError.message || 'Failed to save ranking');
            setPhase('bucket');
            setSaving(false);
            return;
        }

        const grouped = {
            loved: [],
            fine: [],
            didnt_like: [],
        };

        (allRankings || []).forEach((item) => {
            if (grouped[item.bucket]) {
                grouped[item.bucket].push(item);
            }
        });

        Object.keys(grouped).forEach((key) => {
            grouped[key].sort((a, b) => a.rank_position - b.rank_position);
        });

        const targetItems = [...grouped[targetBucket]];
        targetItems.splice(insertionIndex, 0, { recipe_id: recipeId, bucket: targetBucket });
        grouped[targetBucket] = targetItems;

        const payload = Object.entries(grouped).flatMap(([groupBucket, items]) =>
            items.map((item, index) => ({
                user_id: user.id,
                recipe_id: item.recipe_id,
                bucket: groupBucket,
                rank_position: index + 1,
            }))
        );

        const { error: upsertError } = await supabase
            .from('user_recipe_rankings')
            .upsert(payload, { onConflict: 'user_id,recipe_id' });

        if (upsertError) {
            setError(upsertError.message || 'Failed to save ranking');
            setPhase('bucket');
            setSaving(false);
            return;
        }

        setSaving(false);
        setPhase('done');
    }

    async function handleVote(preferNew) {
        if (!currentCompare || !user) return;

        setSaving(true);
        setError('');

        const compareRecipeId = currentCompare.recipe_id;
        const recipeAId = recipeId < compareRecipeId ? recipeId : compareRecipeId;
        const recipeBId = recipeId < compareRecipeId ? compareRecipeId : recipeId;
        const winnerId = preferNew ? recipeId : compareRecipeId;

        const { error: voteError } = await supabase.from('pairwise_votes').insert({
            user_id: user.id,
            recipe_a_id: recipeAId,
            recipe_b_id: recipeBId,
            winner_id: winnerId,
        });

        if (voteError) {
            setError(voteError.message || 'Failed to save comparison');
            setSaving(false);
            return;
        }

        const nextCount = comparisonsCount + 1;
        const mid = Math.floor((low + high) / 2);
        let nextLow = low;
        let nextHigh = high;

        if (preferNew) {
            nextHigh = mid;
        } else {
            nextLow = mid + 1;
        }

        setComparisonsCount(nextCount);

        if (nextLow >= nextHigh) {
            await persistRanking(bucket, nextLow);
            return;
        }

        const nextMid = Math.floor((nextLow + nextHigh) / 2);
        setLow(nextLow);
        setHigh(nextHigh);
        setCurrentCompare(bucketRecipes[nextMid]);
        setSaving(false);
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
                        ? `${recipeTitle} is now ranked in ${RANKING_BUCKETS.find((item) => item.id === bucket)?.label || 'your list'}.`
                        : `${recipeTitle} has been placed after ${comparisonsCount} comparison${comparisonsCount !== 1 ? 's' : ''}.`}
                </p>
                <button onClick={onComplete} className="btn-primary">
                    Done
                </button>
            </div>
        );
    }

    if (phase === 'comparing') {
        return (
            <div className="animate-fade-in">
                {error && (
                    <div className="text-sm px-4 py-3 rounded-md mb-4"
                        style={{ background: 'rgba(192,71,42,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(192,71,42,0.15)' }}>
                        {error}
                    </div>
                )}
                <div className="text-center mb-5">
                    <p className="meta-label mb-1">
                        comparison {comparisonsCount + 1}{totalExpected > 0 ? ` of ~${totalExpected}` : ''}
                    </p>
                    <h3 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Which do you prefer?
                    </h3>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => handleVote(true)}
                        className="w-full text-left px-4 py-4 rounded-md transition-colors"
                        style={{ background: 'var(--color-bg-card)', border: '2px solid var(--color-border)' }}
                        disabled={saving}
                    >
                        <p className="meta-label mb-1" style={{ textTransform: 'none' }}>new</p>
                        <p className="font-bold text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {recipeTitle}
                        </p>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                        <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>vs</span>
                        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                    </div>

                    <button
                        onClick={() => handleVote(false)}
                        className="w-full text-left px-4 py-4 rounded-md transition-colors"
                        style={{ background: 'var(--color-bg-card)', border: '2px solid var(--color-border)' }}
                        disabled={saving}
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

    return (
        <div className="animate-fade-in">
            {error && (
                <div className="text-sm px-4 py-3 rounded-md mb-4"
                    style={{ background: 'rgba(192,71,42,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(192,71,42,0.15)' }}>
                    {error}
                </div>
            )}
            <div className="text-center mb-6">
                <h3 className="text-lg font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    Where did it land?
                </h3>
                <p className="note-text text-sm">
                    Start by choosing the bucket that best fits {recipeTitle}.
                </p>
            </div>

            <div className="space-y-3">
                {RANKING_BUCKETS.map((option) => (
                    <button
                        key={option.id}
                        onClick={() => beginBucketRanking(option.id)}
                        className="w-full text-left px-4 py-4 rounded-md transition-colors"
                        style={{
                            background: bucket === option.id ? 'var(--color-ochre-glow)' : 'var(--color-bg-card)',
                            border: `1px solid ${bucket === option.id ? 'var(--color-ochre)' : 'var(--color-border)'}`,
                        }}
                        disabled={saving}
                    >
                        <p className="font-bold text-base mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {option.label}
                        </p>
                        <p className="note-text text-xs">
                            Score band {option.min}–{option.max}
                            {existingRanking?.bucket === option.id ? ' · current bucket' : ''}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
}
