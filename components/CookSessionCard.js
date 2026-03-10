'use client';

import Link from 'next/link';
import StarRating from './StarRating';
import LikeButton from './LikeButton';
import WantToCookButton from './WantToCookButton';

export default function CookSessionCard({ session, currentUserId }) {
    const profile = session.profiles;
    const recipe = session.recipes;

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return `${Math.floor(days / 7)}w ago`;
    }

    const isLiked = session.likes?.some((l) => l.user_id === currentUserId);
    const likeCount = session.likes?.length || 0;
    const commentCount = session.comments?.[0]?.count || 0;
    const isWanted = session.want_to_cook_actions?.some((w) => w.user_id === currentUserId);
    const wantToCookCount = session.want_to_cook_actions?.length || 0;

    return (
        <div className="glass-card overflow-hidden animate-slide-up">
            {/* Header — friend's name is front and center */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <Link href={profile?.id === currentUserId ? '/profile' : `/profile/${profile?.id}`}>
                    <div className="avatar">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            profile?.name?.[0]?.toUpperCase() || '?'
                        )}
                    </div>
                </Link>
                <div className="flex-1 min-w-0">
                    <Link href={profile?.id === currentUserId ? '/profile' : `/profile/${profile?.id}`}>
                        <p className="font-semibold text-sm" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                            {profile?.name}
                        </p>
                    </Link>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: "'DM Mono', monospace" }}>
                        {profile?.username ? `@${profile.username}` : ''} · {timeAgo(session.created_at)}
                    </p>
                </div>
                <StarRating rating={session.rating} size="sm" />
            </div>

            {/* Recipe title — always visible at a glance */}
            <div className="px-4 pb-2">
                <Link href={`/recipe/${recipe?.id}`}>
                    <h3 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        {recipe?.title}
                    </h3>
                </Link>
            </div>

            {/* Image — secondary to the text */}
            {session.image_url && (
                <Link href={`/session/${session.id}`}>
                    <div className="relative w-full mx-4 rounded-md overflow-hidden" style={{ aspectRatio: '4/3', width: 'calc(100% - 2rem)' }}>
                        <img
                            src={session.image_url}
                            alt={recipe?.title || 'Cook session'}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </Link>
            )}

            {/* Notes — the honest review */}
            <div className="px-4 py-3 space-y-2">
                {session.notes && (
                    <p className="text-sm leading-relaxed note-text">
                        &ldquo;{session.notes}&rdquo;
                    </p>
                )}

                {/* Recipe URL */}
                {recipe?.url && (
                    <a
                        href={recipe.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs inline-flex items-center gap-1"
                        style={{ color: 'var(--color-sage)', fontFamily: "'DM Mono', monospace" }}
                    >
                        ↗ recipe source
                    </a>
                )}

                {/* Actions — subtle, not shouty */}
                <div className="flex items-center gap-4 pt-2"
                    style={{ borderTop: '1px solid var(--color-border-light)' }}>
                    <LikeButton
                        sessionId={session.id}
                        initialLiked={isLiked}
                        initialCount={likeCount}
                    />
                    <WantToCookButton
                        postId={session.id}
                        recipeId={recipe?.id}
                        initialWanted={isWanted}
                        initialCount={wantToCookCount}
                    />
                    <Link
                        href={`/session/${session.id}`}
                        className="flex items-center gap-1.5"
                        style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        {commentCount > 0 && (
                            <span className="text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{commentCount}</span>
                        )}
                    </Link>
                </div>
            </div>
        </div>
    );
}
