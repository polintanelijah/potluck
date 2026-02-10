import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function RecipeDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    useEffect(() => {
        fetchRecipe();
    }, [id]);

    const fetchRecipe = async () => {
        try {
            const data = await api.get(`/recipes/${id}`);
            setRecipe(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setSubmittingComment(true);
        try {
            await api.post(`/recipes/${id}/comments`, { content: newComment });
            setNewComment('');
            fetchRecipe(); // Refresh to get new comment
        } catch (err) {
            console.error('Failed to add comment:', err);
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this recipe?')) return;

        try {
            await api.delete(`/recipes/${id}`);
            navigate('/');
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getInitials = (name) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const renderStars = (rating) => {
        return [...Array(5)].map((_, i) => (
            <span key={i} className={`star ${i < rating ? 'filled' : ''}`}>
                ★
            </span>
        ));
    };

    if (loading) {
        return (
            <div className="page">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <div className="card loading" style={{ height: '500px' }} />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <div className="feed-empty">
                        <h2>Recipe not found</h2>
                        <p className="text-secondary mt-sm mb-lg">{error}</p>
                        <Link to="/" className="btn btn-primary">
                            Back to Feed
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const isOwner = user?.id === recipe.author.id;

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: '800px' }}>
                {/* Back button */}
                <button
                    className="btn btn-ghost mb-lg"
                    onClick={() => navigate(-1)}
                >
                    ← Back
                </button>

                <div className="card">
                    {/* Author header */}
                    <div className="recipe-card-header">
                        {recipe.author.avatarUrl ? (
                            <img
                                src={recipe.author.avatarUrl}
                                alt={recipe.author.name}
                                className="recipe-card-avatar"
                            />
                        ) : (
                            <div className="recipe-card-avatar">
                                {getInitials(recipe.author.name)}
                            </div>
                        )}
                        <div className="recipe-card-meta">
                            <div className="recipe-card-author">{recipe.author.name}</div>
                            <div className="recipe-card-group">
                                {recipe.group.name} • {formatDate(recipe.createdAt)}
                            </div>
                        </div>
                        {isOwner && (
                            <button
                                className="btn btn-ghost"
                                onClick={handleDelete}
                                title="Delete recipe"
                            >
                                🗑️
                            </button>
                        )}
                    </div>

                    {/* Recipe image */}
                    {recipe.imageUrl && (
                        <img
                            src={recipe.imageUrl}
                            alt={recipe.title}
                            className="card-image"
                            style={{ aspectRatio: '16/9' }}
                        />
                    )}

                    {/* Recipe content */}
                    <div className="card-content">
                        <h1 style={{ marginBottom: '0.5rem' }}>{recipe.title}</h1>

                        {recipe.rating && (
                            <div className="flex items-center gap-sm mb-md">
                                <div className="recipe-card-rating" style={{ fontSize: '1.5rem' }}>
                                    {renderStars(recipe.rating)}
                                </div>
                                <span className="text-secondary">{recipe.rating}/5</span>
                            </div>
                        )}

                        {recipe.cookDate && (
                            <p className="text-muted mb-md">
                                Cooked on {formatDate(recipe.cookDate)}
                            </p>
                        )}

                        {recipe.notes && (
                            <div className="mb-lg">
                                <h3 className="mb-sm">Notes</h3>
                                <p style={{ whiteSpace: 'pre-wrap' }}>{recipe.notes}</p>
                            </div>
                        )}

                        {(recipe.sourceUrl || recipe.sourceName) && (
                            <div className="mb-lg">
                                <h3 className="mb-sm">Recipe Source</h3>
                                {recipe.sourceUrl ? (
                                    <a
                                        href={recipe.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                    >
                                        {recipe.sourceName || 'View Original Recipe'} →
                                    </a>
                                ) : (
                                    <p>{recipe.sourceName}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Comments section */}
                    <div style={{ borderTop: '1px solid var(--color-border)', padding: 'var(--spacing-lg)' }}>
                        <h3 className="mb-lg">Comments ({recipe.comments?.length || 0})</h3>

                        {/* Add comment form */}
                        <form onSubmit={handleAddComment} className="mb-lg">
                            <div className="flex gap-md">
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Add a comment..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    disabled={submittingComment}
                                />
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submittingComment || !newComment.trim()}
                                >
                                    {submittingComment ? '...' : 'Post'}
                                </button>
                            </div>
                        </form>

                        {/* Comments list */}
                        {recipe.comments && recipe.comments.length > 0 ? (
                            <div className="flex flex-col gap-md">
                                {recipe.comments.map((comment) => (
                                    <div key={comment.id} className="flex gap-md" style={{ padding: 'var(--spacing-md)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                                        {comment.author.avatarUrl ? (
                                            <img
                                                src={comment.author.avatarUrl}
                                                alt={comment.author.name}
                                                className="recipe-card-avatar"
                                                style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}
                                            />
                                        ) : (
                                            <div className="recipe-card-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
                                                {getInitials(comment.author.name)}
                                            </div>
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <div className="flex justify-between items-center mb-sm">
                                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{comment.author.name}</span>
                                                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                    {formatDate(comment.createdAt)}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '0.875rem' }}>{comment.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted text-center">No comments yet. Be the first to comment!</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RecipeDetail;
