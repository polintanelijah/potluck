'use client';

export default function StarRating({ rating, onChange, size = 'md' }) {
    const sizeClass = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl';
    const interactive = !!onChange;

    return (
        <div className={`flex gap-0.5 ${sizeClass}`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={!interactive}
                    onClick={() => interactive && onChange(star)}
                    className="transition-transform duration-150 disabled:cursor-default"
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px',
                        color: star <= rating ? 'var(--color-star)' : 'var(--color-star-empty)',
                        transform: interactive ? undefined : 'none',
                    }}
                    onMouseEnter={(e) => interactive && (e.target.style.transform = 'scale(1.2)')}
                    onMouseLeave={(e) => interactive && (e.target.style.transform = 'scale(1)')}
                >
                    ★
                </button>
            ))}
        </div>
    );
}
