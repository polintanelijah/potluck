'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function RecipeCard({ recipe }) {
    return (
        <Link href={`/recipe/${recipe.id}`}>
            <div className="glass-card overflow-hidden animate-fade-in">
                {recipe.image_url && (
                    <Image
                        src={recipe.image_url}
                        alt={recipe.title}
                        width={400}
                        height={160}
                        className="w-full h-40 object-cover"
                        unoptimized
                    />
                )}
                <div className="px-4 py-3">
                    <h3 className="text-base font-semibold mb-0.5"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        {recipe.title}
                    </h3>

                    {recipe.source_site && (
                        <p className="text-xs mb-1.5"
                            style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                            {recipe.source_site}
                        </p>
                    )}

                    {recipe.description && (
                        <p className="text-sm line-clamp-2 mb-2"
                            style={{ color: 'var(--color-text-secondary)' }}>
                            {recipe.description}
                        </p>
                    )}

                    <div className="flex items-center gap-3">
                        {recipe.avg_rating > 0 && (
                            <span className="text-xs flex items-center gap-1"
                                style={{ color: 'var(--color-ochre)', fontFamily: "'DM Mono', monospace" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-ochre)" stroke="none">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                {Number(recipe.avg_rating).toFixed(1)}
                            </span>
                        )}
                        {recipe.total_cooks > 0 && (
                            <span className="text-xs"
                                style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                                {recipe.total_cooks} cook{recipe.total_cooks !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {recipe.tags && recipe.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {recipe.tags.slice(0, 4).map((tag) => (
                                <span key={tag} className="text-xs px-2 py-0.5 rounded-full"
                                    style={{
                                        background: 'var(--color-bg-secondary)',
                                        color: 'var(--color-text-secondary)',
                                        border: '1px solid var(--color-border-light)',
                                        fontFamily: "'DM Mono', monospace",
                                    }}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
