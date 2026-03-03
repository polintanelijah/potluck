'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import StarRating from '@/components/StarRating';

export default function PostPage() {
    const [step, setStep] = useState(1); // 1 = recipe, 2 = session details
    const [existingRecipes, setExistingRecipes] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [isNewRecipe, setIsNewRecipe] = useState(false);

    // New recipe fields
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [ingredients, setIngredients] = useState('');
    const [instructions, setInstructions] = useState('');

    // Session fields
    const [rating, setRating] = useState(0);
    const [notes, setNotes] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const { user } = useAuth();
    const supabase = getSupabase();
    const router = useRouter();

    useEffect(() => {
        fetchRecipes();
    }, []);

    async function fetchRecipes() {
        const { data } = await supabase
            .from('recipes')
            .select('id, title, url')
            .order('created_at', { ascending: false });
        setExistingRecipes(data || []);
    }

    function handleImageChange(e) {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setImagePreview(url);
        }
    }

    async function uploadImage() {
        if (!imageFile || !user) return null;

        try {
            const ext = imageFile.name.split('.').pop();
            const filePath = `${user.id}/${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, imageFile);

            if (uploadError) {
                console.error('Image upload error:', uploadError);
                // Don't block the post if image upload fails
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (err) {
            console.error('Image upload exception:', err);
            return null;
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (rating === 0) {
            setError('Please rate this cook session');
            return;
        }
        setError('');
        setSubmitting(true);

        try {
            let recipeId = selectedRecipe?.id;

            // Create new recipe if needed
            if (isNewRecipe) {
                if (!title.trim()) {
                    setError('Recipe title is required');
                    setSubmitting(false);
                    return;
                }

                const { data: newRecipe, error: recipeError } = await supabase
                    .from('recipes')
                    .insert({
                        title: title.trim(),
                        url: url.trim() || null,
                        ingredients: ingredients.trim() || null,
                        instructions: instructions.trim() || null,
                        created_by: user.id,
                    })
                    .select()
                    .single();

                if (recipeError) throw recipeError;
                recipeId = newRecipe.id;
            }

            // Upload image (non-blocking — post will succeed even if image fails)
            let imageUrl = null;
            if (imageFile) {
                imageUrl = await uploadImage();
            }

            // Create cook session
            const { error: sessionError } = await supabase
                .from('cook_sessions')
                .insert({
                    user_id: user.id,
                    recipe_id: recipeId,
                    rating,
                    notes: notes.trim() || null,
                    image_url: imageUrl,
                });

            if (sessionError) throw sessionError;

            router.push('/feed');
        } catch (err) {
            console.error('Post error:', err);
            setError(err.message || 'Failed to post');
        } finally {
            setSubmitting(false);
        }
    }

    const filteredRecipes = existingRecipes.filter((r) =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="px-4 py-6">
            <h1 className="text-2xl font-bold mb-6">Post a Cook Session</h1>

            {error && (
                <div className="text-sm px-4 py-3 rounded-xl mb-4"
                    style={{ background: 'rgba(244,63,94,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(244,63,94,0.2)' }}>
                    {error}
                </div>
            )}

            {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        What did you cook?
                    </p>

                    {/* Search existing recipes */}
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Search recipes..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsNewRecipe(false);
                            setSelectedRecipe(null);
                        }}
                    />

                    {/* Existing recipes */}
                    {searchQuery && filteredRecipes.length > 0 && !isNewRecipe && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {filteredRecipes.map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => {
                                        setSelectedRecipe(r);
                                        setStep(2);
                                    }}
                                    className="w-full text-left px-4 py-3 rounded-xl transition-colors"
                                    style={{
                                        background: 'var(--color-bg-card)',
                                        border: '1px solid var(--color-border)',
                                    }}
                                >
                                    <p className="font-semibold text-sm">{r.title}</p>
                                    {r.url && (
                                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                                            {r.url}
                                        </p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-3 py-2">
                        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>or</span>
                        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                    </div>

                    {/* New recipe form */}
                    <button
                        onClick={() => {
                            setIsNewRecipe(true);
                            setSelectedRecipe(null);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${isNewRecipe ? '' : ''}`}
                        style={{
                            background: isNewRecipe ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                            border: `1px solid ${isNewRecipe ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        }}
                    >
                        <p className="font-semibold text-sm">
                            ✨ Add a new recipe
                        </p>
                    </button>

                    {isNewRecipe && (
                        <div className="space-y-3 animate-fade-in">
                            <div>
                                <label className="label">Recipe Title *</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="e.g. Butter Chicken"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label">Recipe URL (optional)</label>
                                <input
                                    type="url"
                                    className="input-field"
                                    placeholder="https://..."
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label">Ingredients (optional)</label>
                                <textarea
                                    className="input-field"
                                    placeholder="List ingredients..."
                                    value={ingredients}
                                    onChange={(e) => setIngredients(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="label">Instructions (optional)</label>
                                <textarea
                                    className="input-field"
                                    placeholder="How to make it..."
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    rows={4}
                                />
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                className="btn-primary w-full"
                                disabled={!title.trim()}
                            >
                                Next: Rate Your Cook
                            </button>
                        </div>
                    )}
                </div>
            )}

            {step === 2 && (
                <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
                    {/* Back button */}
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex items-center gap-1 text-sm"
                        style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        ← Back to recipe
                    </button>

                    {/* Recipe name */}
                    <div className="px-4 py-3 rounded-xl" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Cooking</p>
                        <p className="font-bold">{isNewRecipe ? title : selectedRecipe?.title}</p>
                    </div>

                    {/* Rating */}
                    <div>
                        <label className="label">How was it? *</label>
                        <StarRating rating={rating} onChange={setRating} size="lg" />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="label">Notes (optional)</label>
                        <textarea
                            className="input-field"
                            placeholder="Any thoughts? Tips? Would you make it again?"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Photo */}
                    <div>
                        <label className="label">Photo (optional)</label>
                        {imagePreview ? (
                            <div className="relative rounded-xl overflow-hidden mb-2" style={{ maxHeight: '300px' }}>
                                <img src={imagePreview} alt="Preview" className="w-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImageFile(null);
                                        setImagePreview(null);
                                    }}
                                    className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                                    style={{ background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', cursor: 'pointer' }}
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <label
                                className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl cursor-pointer transition-colors"
                                style={{
                                    background: 'var(--color-bg-input)',
                                    border: '2px dashed var(--color-border)',
                                }}
                            >
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Tap to add a photo</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageChange}
                                />
                            </label>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="btn-primary w-full"
                        disabled={submitting || rating === 0}
                    >
                        {submitting ? 'Posting...' : 'Post Cook Session 🍳'}
                    </button>
                </form>
            )}
        </div>
    );
}
