'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function CommentSection({ sessionId }) {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const { user } = useAuth();
    const supabase = getSupabase();

    useEffect(() => {
        fetchComments();
    }, [sessionId]);

    async function fetchComments() {
        const { data } = await supabase
            .from('comments')
            .select('*, profiles:user_id(name, avatar_url)')
            .eq('cook_session_id', sessionId)
            .order('created_at', { ascending: true });
        setComments(data || []);
        setLoading(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!newComment.trim() || !user) return;

        setSubmitting(true);
        const { error } = await supabase.from('comments').insert({
            user_id: user.id,
            cook_session_id: sessionId,
            content: newComment.trim(),
        });

        if (!error) {
            setNewComment('');
            await fetchComments();
        }
        setSubmitting(false);
    }

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d`;
        return `${Math.floor(days / 7)}w`;
    }

    return (
        <div className="space-y-4">
            {loading ? (
                <div className="flex justify-center py-4">
                    <div className="spinner" />
                </div>
            ) : comments.length === 0 ? (
                <p className="note-text text-sm py-2">
                    No comments yet. Be the first to chime in.
                </p>
            ) : (
                <div className="space-y-3">
                    {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 animate-fade-in">
                            <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.75rem' }}>
                                {comment.profiles?.avatar_url ? (
                                    <img src={comment.profiles.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    comment.profiles?.name?.[0]?.toUpperCase() || '?'
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                    <span className="font-semibold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
                                        {comment.profiles?.name}
                                    </span>
                                    <span className="meta-label" style={{ textTransform: 'none' }}>
                                        {timeAgo(comment.created_at)}
                                    </span>
                                </div>
                                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                                    {comment.content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Comment input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    className="input-field flex-1"
                    placeholder="Add a note..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    style={{ padding: '0.6rem 0.85rem', fontSize: '0.875rem' }}
                />
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={!newComment.trim() || submitting}
                    style={{ padding: '0.6rem 1rem', fontSize: '0.8rem' }}
                >
                    {submitting ? '...' : 'Post'}
                </button>
            </form>
        </div>
    );
}
