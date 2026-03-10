'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function AddRecipePage() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recipe, setRecipe] = useState(null);
    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setRecipe(null);
        setLoading(true);

        try {
            const res = await fetch('/api/extract-recipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Something went wrong');
                return;
            }

            setRecipe(data.recipe);
        } catch {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-lg mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold mb-6"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Add a Recipe
            </h1>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="label" htmlFor="recipe-url">
                        Paste a recipe URL
                    </label>
                    <input
                        id="recipe-url"
                        type="url"
                        className="input-field"
                        placeholder="https://www.allrecipes.com/recipe/..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>

                <button
                    type="submit"
                    className="btn-primary w-full"
                    disabled={loading || !url.trim()}
                >
                    {loading ? 'Extracting...' : 'Import Recipe'}
                </button>
            </form>

            {error && (
                <div className="mt-4 text-sm px-4 py-3 rounded-md"
                    style={{
                        background: 'rgba(192,71,42,0.08)',
                        color: 'var(--color-danger)',
                        border: '1px solid rgba(192,71,42,0.15)',
                    }}>
                    {error}
                </div>
            )}

            {recipe && (
                <div className="mt-6 rounded-lg overflow-hidden border"
                    style={{
                        background: 'var(--color-bg-secondary)',
                        borderColor: 'var(--color-border)',
                    }}>
                    {recipe.image_url && (
                        <Image
                            src={recipe.image_url}
                            alt={recipe.title}
                            width={600}
                            height={192}
                            className="w-full h-48 object-cover"
                            unoptimized
                        />
                    )}
                    <div className="p-4">
                        <h2 className="text-lg font-semibold mb-1">
                            {recipe.title}
                        </h2>
                        {recipe.source_site && (
                            <p className="text-xs mb-2"
                                style={{ color: 'var(--color-text-tertiary)' }}>
                                from {recipe.source_site}
                            </p>
                        )}
                        {recipe.description && (
                            <p className="text-sm line-clamp-3"
                                style={{ color: 'var(--color-text-secondary)' }}>
                                {recipe.description}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
