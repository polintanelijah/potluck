'use client';

import Link from 'next/link';
import StarRating from './StarRating';
import LikeButton from './LikeButton';

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

    return (
        <div className="glass-card overflow-hidden animate-slide-up">
            {/* Header — user info */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
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
                        <p className="font-semibold text-sm truncate">{profile?.name}</p>
                    </Link>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {timeAgo(session.created_at)}
                    </p>
                </div>
                <StarRating rating={session.rating} size="sm" />
            </div>

            {/* Image */}
            {session.image_url && (
                <Link href={`/session/${session.id}`}>
                    <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
                        <img
                            src={session.image_url}
                            alt={recipe?.title || 'Cook session'}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </Link>
            )}

            {/* Content */}
            <div className="px-4 py-3 space-y-2">
                {/* Recipe title */}
                <Link href={`/recipe/${recipe?.id}`}>
                    <h3 className="font-bold text-base hover:underline">{recipe?.title}</h3>
                </Link>

                {/* Notes */}
                {session.notes && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        {session.notes}
                    </p>
                )}

                {/* Recipe URL */}
                {recipe?.url && (
                    <a
                        href={recipe.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium inline-flex items-center gap-1"
                        style={{ color: 'var(--color-accent)' }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        View recipe source
                    </a>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 pt-1"
                    style={{ borderTop: '1px solid var(--color-border)' }}>
                    <LikeButton
                        sessionId={session.id}
                        initialLiked={isLiked}
                        initialCount={likeCount}
                    />
                    <Link
                        href={`/session/${session.id}`}
                        className="flex items-center gap-1.5"
                        style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        {commentCount > 0 && <span className="font-medium text-sm">{commentCount}</span>}
                    </Link>
                </div>
            </div>
        </div>
    );
}
