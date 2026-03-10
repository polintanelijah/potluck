'use client';

export default function TagFilter({ tags, selectedTag, onTagSelect }) {
    if (!tags || tags.length === 0) return null;

    return (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button
                onClick={() => onTagSelect(null)}
                className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
                style={{
                    fontFamily: "'DM Mono', monospace",
                    background: !selectedTag ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                    color: !selectedTag ? '#FFF9F4' : 'var(--color-text-secondary)',
                    border: `1px solid ${!selectedTag ? 'var(--color-accent)' : 'var(--color-border-light)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                }}
            >
                All
            </button>
            {tags.map((tag) => (
                <button
                    key={tag}
                    onClick={() => onTagSelect(tag === selectedTag ? null : tag)}
                    className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
                    style={{
                        fontFamily: "'DM Mono', monospace",
                        background: tag === selectedTag ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                        color: tag === selectedTag ? '#FFF9F4' : 'var(--color-text-secondary)',
                        border: `1px solid ${tag === selectedTag ? 'var(--color-accent)' : 'var(--color-border-light)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}
                >
                    {tag}
                </button>
            ))}
        </div>
    );
}
