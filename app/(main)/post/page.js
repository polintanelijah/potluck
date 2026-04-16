'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import RankingFlow from '@/components/RankingFlow';
import { getBucketPriority, normalizeRecipeText } from '@/lib/rankings';
import { formatRecipeField, extractRecipeFromUrl } from './actions';

export default function PostPage() {
    const [step, setStep] = useState(1);
    const [existingRecipes, setExistingRecipes] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [isNewRecipe, setIsNewRecipe] = useState(false);
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [ingredients, setIngredients] = useState('');
    const [instructions, setInstructions] = useState('');
    const [notes, setNotes] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [rankedRecipeId, setRankedRecipeId] = useState(null);
    const [rankedRecipeTitle, setRankedRecipeTitle] = useState('');
    const [formatting, setFormatting] = useState({ ingredients: false, instructions: false });
    const [formatError, setFormatError] = useState({ ingredients: '', instructions: '' });
    const [lastFormatted, setLastFormatted] = useState({ ingredients: '', instructions: '' });
    const [extracting, setExtracting] = useState(false);
    const [extractStatus, setExtractStatus] = useState('');
    const [sourceSite, setSourceSite] = useState('');
    const [lastExtractedUrl, setLastExtractedUrl] = useState('');
    const { user } = useAuth();
    const supabase = getSupabase();
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;

        async function fetchRecipes() {
            const { data } = await supabase
                .from('recipes')
                .select('id, title, url, image_url, source_site, created_by, user_recipe_rankings!left(user_id, bucket, rank_position)')
                .order('created_at', { ascending: false });

            if (!cancelled) {
                setExistingRecipes(data || []);
            }
        }

        fetchRecipes();
        return () => {
            cancelled = true;
        };
    }, [supabase]);

    function handleImageChange(e) {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    }

    async function uploadImage() {
        if (!imageFile || !user) return null;

        try {
            const ext = imageFile.name.split('.').pop();
            const filePath = `${user.id}/${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('images').upload(filePath, imageFile);
            if (uploadError) {
                console.error('Image upload error:', uploadError);
                return null;
            }

            const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
            return publicUrl;
        } catch (err) {
            console.error('Image upload exception:', err);
            return null;
        }
    }

    async function handleFormat(field) {
        const raw = field === 'ingredients' ? ingredients : instructions;
        if (!raw.trim()) return;
        setFormatting((s) => ({ ...s, [field]: true }));
        setFormatError((s) => ({ ...s, [field]: '' }));
        try {
            const res = await formatRecipeField(field, raw);
            if (res?.error || !Array.isArray(res?.lines)) {
                setFormatError((s) => ({
                    ...s,
                    [field]: 'Formatting failed — your text was kept as-is.',
                }));
            } else {
                const joined = res.lines.join('\n');
                if (field === 'ingredients') setIngredients(joined);
                else setInstructions(joined);
                setLastFormatted((s) => ({ ...s, [field]: joined }));
            }
        } catch {
            setFormatError((s) => ({
                ...s,
                [field]: 'Formatting failed — your text was kept as-is.',
            }));
        } finally {
            setFormatting((s) => ({ ...s, [field]: false }));
        }
    }

    async function handleExtract(urlValue, { onlyIfEmpty }) {
        const trimmed = (urlValue || '').trim();
        if (!trimmed) return;
        try { new URL(trimmed); } catch { return; }
        if (onlyIfEmpty && (ingredients.trim() || instructions.trim())) return;

        setExtracting(true);
        setExtractStatus('');
        try {
            const res = await extractRecipeFromUrl(trimmed);
            if (res?.error || !Array.isArray(res?.ingredients) || !Array.isArray(res?.instructions)) {
                setExtractStatus('Couldn\u2019t auto-fill \u2014 you can still type it in.');
                return;
            }
            const ingJoined = res.ingredients.join('\n');
            const instJoined = res.instructions.join('\n');
            setIngredients(ingJoined);
            setInstructions(instJoined);
            setLastFormatted({ ingredients: '', instructions: '' });
            if (!title.trim() && res.title) setTitle(res.title);
            setSourceSite(res.sourceSite || '');
            setLastExtractedUrl(trimmed);
            setExtractStatus(res.sourceSite ? `Pulled from ${res.sourceSite}` : 'Pulled successfully');
        } catch {
            setExtractStatus('Couldn\u2019t auto-fill \u2014 you can still type it in.');
        } finally {
            setExtracting(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!user) return;

        setError('');
        setSubmitting(true);

        try {
            let recipeId = selectedRecipe?.id;
            let recipeName = selectedRecipe?.title;

            if (isNewRecipe) {
                if (!title.trim()) {
                    setError('Every recipe needs a name');
                    setSubmitting(false);
                    return;
                }

                const { data: newRecipe, error: recipeError } = await supabase
                    .from('recipes')
                    .insert({
                        title: title.trim(),
                        url: url.trim() || null,
                        source_site: sourceSite || null,
                        ingredients: normalizeRecipeText(ingredients),
                        instructions: normalizeRecipeText(instructions),
                        created_by: user.id,
                    })
                    .select()
                    .single();

                if (recipeError) throw recipeError;
                recipeId = newRecipe.id;
                recipeName = newRecipe.title;
            }

            if (!recipeId) {
                throw new Error('Pick a recipe before logging your cook');
            }

            const imageUrl = imageFile ? await uploadImage() : null;

            const { data: createdPost, error: postError } = await supabase
                .from('posts')
                .insert({
                    user_id: user.id,
                    recipe_id: recipeId,
                    type: 'cook_log',
                    caption: notes.trim() || null,
                    image_url: imageUrl,
                })
                .select('id')
                .single();

            if (postError) throw postError;

            if (imageUrl) {
                const recipeHasImage = isNewRecipe ? false : !!selectedRecipe?.image_url;

                if (!recipeHasImage) {
                    const { error: recipeImageError } = await supabase
                        .from('recipes')
                        .update({ image_url: imageUrl })
                        .eq('id', recipeId)
                        .is('image_url', null);

                    if (recipeImageError) {
                        console.error('Recipe image update error:', recipeImageError);
                    }
                }
            }

            const { error: cookedError } = await supabase
                .from('user_recipes')
                .upsert({
                    user_id: user.id,
                    recipe_id: recipeId,
                    status: 'cooked',
                    post_id: createdPost.id,
                    cooked_at: new Date().toISOString(),
                }, { onConflict: 'user_id,recipe_id,status' });

            if (cookedError) throw cookedError;

            setRankedRecipeId(recipeId);
            setRankedRecipeTitle(recipeName || selectedRecipe?.title || title.trim());
            setStep(3);
        } catch (err) {
            console.error('Post error:', err);
            setError(err.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    }

    const filteredRecipes = existingRecipes
        .filter((recipe) => recipe.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            const aRanking = a.user_recipe_rankings?.find((ranking) => ranking.user_id === user?.id);
            const bRanking = b.user_recipe_rankings?.find((ranking) => ranking.user_id === user?.id);

            if (aRanking && bRanking) {
                const bucketDiff = getBucketPriority(aRanking.bucket) - getBucketPriority(bRanking.bucket);
                if (bucketDiff !== 0) return bucketDiff;
                return aRanking.rank_position - bRanking.rank_position;
            }

            if (aRanking) return -1;
            if (bRanking) return 1;
            return a.title.localeCompare(b.title);
        });

    return (
        <div className="px-4 py-6">
            <h1 className="text-2xl mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {step === 3 ? 'Rank It' : 'Log a Cook'}
            </h1>
            <p className="note-text text-sm mb-6">
                {step === 3 ? 'where does it land on your list?' : 'reuse an existing recipe or create a new one'}
            </p>

            {error && (
                <div className="text-sm px-4 py-3 rounded-md mb-4"
                    style={{ background: 'rgba(192,71,42,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(192,71,42,0.15)' }}>
                    {error}
                </div>
            )}

            {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="label">Search existing recipes</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Search recipes by name..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsNewRecipe(false);
                                setSelectedRecipe(null);
                            }}
                        />
                        <p className="note-text text-xs mt-2">
                            Results favor recipes you&apos;ve already ranked highly.
                        </p>
                    </div>

                    {searchQuery && filteredRecipes.length > 0 && !isNewRecipe && (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {filteredRecipes.map((recipe) => {
                                const ranking = recipe.user_recipe_rankings?.find((item) => item.user_id === user?.id);

                                return (
                                    <div
                                        key={recipe.id}
                                        className="px-4 py-3 rounded-md"
                                        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{recipe.title}</p>
                                                {recipe.source_site && (
                                                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                                                        {recipe.source_site}
                                                    </p>
                                                )}
                                                {ranking && (
                                                    <p className="note-text text-xs mt-1">
                                                        Already ranked in {ranking.bucket.replace('_', ' ')} at #{ranking.rank_position}
                                                    </p>
                                                )}
                                            </div>
                                            <Link
                                                href={`/recipe/${recipe.id}`}
                                                className="text-xs"
                                                style={{ color: 'var(--color-accent)', fontFamily: "'DM Mono', monospace" }}
                                            >
                                                View
                                            </Link>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedRecipe(recipe);
                                                setStep(2);
                                            }}
                                            className="btn-secondary mt-3"
                                            style={{ padding: '0.45rem 0.8rem', fontSize: '0.75rem' }}
                                        >
                                            Use this recipe
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex items-center gap-3 py-1">
                        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                        <span className="meta-label" style={{ textTransform: 'none' }}>or</span>
                        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                    </div>

                    <button
                        onClick={() => {
                            setIsNewRecipe(true);
                            setSelectedRecipe(null);
                        }}
                        className="w-full text-left px-4 py-3 rounded-md transition-colors"
                        style={{
                            background: isNewRecipe ? 'var(--color-ochre-glow)' : 'var(--color-bg-card)',
                            border: `1px solid ${isNewRecipe ? 'var(--color-ochre)' : 'var(--color-border)'}`,
                        }}
                    >
                        <p className="font-semibold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
                            + Create a brand new recipe
                        </p>
                    </button>

                    {isNewRecipe && (
                        <div className="space-y-3 animate-fade-in">
                            <div>
                                <label className="label">Recipe name</label>
                                <input type="text" className="input-field" placeholder="e.g. Grandma's butter chicken" value={title} onChange={(e) => setTitle(e.target.value)} />
                            </div>
                            <div>
                                <label className="label">Recipe link (optional)</label>
                                <input
                                    type="url"
                                    className="input-field"
                                    placeholder="Paste the URL if you found it online"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    onPaste={(e) => {
                                        const pasted = e.clipboardData.getData('text');
                                        queueMicrotask(() => handleExtract(pasted, { onlyIfEmpty: true }));
                                    }}
                                />
                                <div className="flex items-center justify-between mt-1 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleExtract(url, { onlyIfEmpty: false })}
                                        disabled={
                                            extracting ||
                                            !url.trim() ||
                                            (lastExtractedUrl !== '' && url.trim() === lastExtractedUrl)
                                        }
                                        className="text-xs"
                                        style={{
                                            color: 'var(--color-accent)',
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            cursor:
                                                extracting ||
                                                !url.trim() ||
                                                (lastExtractedUrl !== '' && url.trim() === lastExtractedUrl)
                                                    ? 'default'
                                                    : 'pointer',
                                            opacity:
                                                extracting ||
                                                !url.trim() ||
                                                (lastExtractedUrl !== '' && url.trim() === lastExtractedUrl)
                                                    ? 0.5
                                                    : 1,
                                            fontFamily: "'DM Mono', monospace",
                                        }}
                                    >
                                        {extracting
                                            ? 'Pulling\u2026'
                                            : lastExtractedUrl !== '' && url.trim() === lastExtractedUrl
                                                ? '\u2713 Already pulled'
                                                : '\u21B4 Pull from link'}
                                    </button>
                                    {extractStatus && (
                                        <span
                                            className="text-xs"
                                            style={{
                                                color: extractStatus.startsWith('Pulled')
                                                    ? 'var(--color-text-muted)'
                                                    : 'var(--color-danger)',
                                            }}
                                        >
                                            {extractStatus}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="label">Ingredients</label>
                                <textarea className="input-field" placeholder="One ingredient per line" value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={4} />
                                {(() => {
                                    const alreadyFormatted =
                                        lastFormatted.ingredients !== '' && ingredients === lastFormatted.ingredients;
                                    const disabled = formatting.ingredients || !ingredients.trim() || alreadyFormatted;
                                    return (
                                        <div className="flex items-center justify-between mt-1 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleFormat('ingredients')}
                                                disabled={disabled}
                                                className="text-xs"
                                                style={{
                                                    color: 'var(--color-accent)',
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    cursor: disabled ? 'default' : 'pointer',
                                                    opacity: disabled ? 0.5 : 1,
                                                    fontFamily: "'DM Mono', monospace",
                                                }}
                                            >
                                                {formatting.ingredients
                                                    ? 'Formatting\u2026'
                                                    : alreadyFormatted
                                                        ? '\u2713 Already formatted'
                                                        : '\u2728 Format with AI'}
                                            </button>
                                            {formatError.ingredients && (
                                                <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
                                                    {formatError.ingredients}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                            <div>
                                <label className="label">Instructions</label>
                                <textarea className="input-field" placeholder="One step per line" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={5} />
                                {(() => {
                                    const alreadyFormatted =
                                        lastFormatted.instructions !== '' && instructions === lastFormatted.instructions;
                                    const disabled = formatting.instructions || !instructions.trim() || alreadyFormatted;
                                    return (
                                        <div className="flex items-center justify-between mt-1 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleFormat('instructions')}
                                                disabled={disabled}
                                                className="text-xs"
                                                style={{
                                                    color: 'var(--color-accent)',
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    cursor: disabled ? 'default' : 'pointer',
                                                    opacity: disabled ? 0.5 : 1,
                                                    fontFamily: "'DM Mono', monospace",
                                                }}
                                            >
                                                {formatting.instructions
                                                    ? 'Formatting\u2026'
                                                    : alreadyFormatted
                                                        ? '\u2713 Already formatted'
                                                        : '\u2728 Format with AI'}
                                            </button>
                                            {formatError.instructions && (
                                                <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
                                                    {formatError.instructions}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                            <button onClick={() => setStep(2)} className="btn-primary w-full" disabled={!title.trim()}>
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {step === 2 && (
                <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex items-center gap-1 text-sm"
                        style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}
                    >
                        ← back
                    </button>

                    <div className="px-4 py-3 rounded-md" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                        <p className="meta-label" style={{ textTransform: 'none', marginBottom: '0.25rem' }}>cooking</p>
                        <div className="flex items-center justify-between gap-3">
                            <p className="font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                                {isNewRecipe ? title : selectedRecipe?.title}
                            </p>
                            {!isNewRecipe && selectedRecipe?.id && (
                                <Link
                                    href={`/recipe/${selectedRecipe.id}`}
                                    className="text-xs"
                                    style={{ color: 'var(--color-accent)', fontFamily: "'DM Mono', monospace" }}
                                >
                                    View details
                                </Link>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="label">Notes</label>
                        <textarea
                            className="input-field"
                            placeholder="Any thoughts? Would you make it again? Tips for next time?"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div>
                        <label className="label">Photo</label>
                        {imagePreview ? (
                            <div className="relative rounded-md overflow-hidden mb-2" style={{ maxHeight: '280px' }}>
                                <img src={imagePreview} alt="Preview" className="w-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImageFile(null);
                                        setImagePreview(null);
                                    }}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs"
                                    style={{ background: 'rgba(44,36,22,0.6)', color: '#FFF9F4', border: 'none', cursor: 'pointer' }}
                                >
                                    ×
                                </button>
                            </div>
                        ) : (
                            <label
                                className="flex flex-col items-center justify-center gap-2 py-8 rounded-md cursor-pointer transition-colors"
                                style={{ background: 'var(--color-bg-input)', border: '1.5px dashed var(--color-border)' }}
                            >
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                                <span className="note-text text-sm">snap a photo of your creation</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                        )}
                    </div>

                    <button type="submit" className="btn-primary w-full" disabled={submitting}>
                        {submitting ? 'Posting...' : 'Log This Cook'}
                    </button>
                </form>
            )}

            {step === 3 && (
                <RankingFlow
                    recipeId={rankedRecipeId}
                    recipeTitle={rankedRecipeTitle}
                    onComplete={() => router.push('/profile')}
                />
            )}
        </div>
    );
}
