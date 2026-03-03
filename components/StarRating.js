'use client';

export default function StarRating({ rating, onChange, size = 'md' }) {
    const sizeClass = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg';
    const interactive = !!onChange;

    return (
        <div className={`flex gap-0.5 ${sizeClass}`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={!interactive}
                    onClick={() => interactive && onChange(star)}
                    className="transition-transform duration-100 disabled:cursor-default"
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: '1px',
                        color: star <= rating ? 'var(--color-ochre)' : 'var(--color-star-empty)',
                    }}
                    onMouseEnter={(e) => interactive && (e.target.style.transform = 'scale(1.15)')}
                    onMouseLeave={(e) => interactive && (e.target.style.transform = 'scale(1)')}
                >
                    ★
                </button>
            ))}
        </div>
    );
}
