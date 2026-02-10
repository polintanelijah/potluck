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
            fetchRecipe();
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
            month: 'short',
            day: 'numeric',
            year: 'numeric'
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

    const getScore = (rating) => {
        if (!rating) return null;
        return (rating * 2).toFixed(1);
    };

    if (loading) {
        return (
            <div className="page">
                <div className="skeleton" style={{ aspectRatio: '4/3', borderRadius: 'var(--r-lg)' }} />
                <div className="skeleton mt-md" style={{ height: 24, width: '70%', borderRadius: 4 }} />
                <div className="skeleton mt-sm" style={{ height: 16, width: '40%', borderRadius: 4 }} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="page">
                <div className="feed-empty">
                    <h2>Recipe not found</h2>
                    <p>{error}</p>
                    <Link to="/" className="btn btn-primary mt-lg">
                        Back to Feed
                    </Link>
                </div>
            </div>
        );
    }

    const isOwner = user?.id === recipe.author.id;

    return (
        <div className="page">
            {/* Hero Image */}
            {recipe.imageUrl ? (
                <div className="detail-hero">
                    <img src={recipe.imageUrl} alt={recipe.title} />
                    <div className="detail-hero-overlay" />
                    <button className="detail-back" onClick={() => navigate(-1)}>←</button>
                    {recipe.rating && (
                        <div className="detail-score">
                            <div className="score-badge score-badge-lg">{getScore(recipe.rating)}</div>
                        </div>
                    )}
                </div>
            ) : (
                <button className="btn btn-ghost mb-md" onClick={() => navigate(-1)}>← Back</button>
            )}

            {/* Content */}
            <div className="detail-content">
                <h1 className="detail-title">{recipe.title}</h1>

                {/* Author */}
                <div className="detail-author">
                    <div className="detail-author-avatar">
                        {recipe.author.avatarUrl ? (
                            <img src={recipe.author.avatarUrl} alt="" />
                        ) : (
                            getInitials(recipe.author.name)
                        )}
                    </div>
                    <div>
                        <div className="detail-author-name">{recipe.author.name}</div>
                        <div className="detail-author-group">
                            {recipe.group.name} · {formatDate(recipe.createdAt)}
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--sp-sm)', alignItems: 'center' }}>
                        {!recipe.imageUrl && recipe.rating && (
                            <div className="score-badge score-badge-lg">{getScore(recipe.rating)}</div>
                        )}
                        {isOwner && (
                            <button className="btn btn-ghost btn-danger" onClick={handleDelete} title="Delete">
                                🗑
                            </button>
                        )}
                    </div>
                </div>

                {/* Cook date */}
                {recipe.cookDate && (
                    <div className="detail-section">
                        <div className="detail-section-title">Cooked</div>
                        <p>{formatDate(recipe.cookDate)}</p>
                    </div>
                )}

                {/* Notes */}
                {recipe.notes && (
                    <div className="detail-section">
                        <div className="detail-section-title">Notes</div>
                        <p>{recipe.notes}</p>
                    </div>
                )}

                {/* Source */}
                {(recipe.sourceUrl || recipe.sourceName) && (
                    <div className="detail-section">
                        <div className="detail-section-title">Recipe Source</div>
                        {recipe.sourceUrl ? (
                            <p>
                                <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                                    {recipe.sourceName || 'View original recipe'} →
                                </a>
                            </p>
                        ) : (
                            <p>{recipe.sourceName}</p>
                        )}
                    </div>
                )}

                {/* Comments */}
                <div className="comments-section">
                    <div className="comments-title">
                        Comments ({recipe.comments?.length || 0})
                    </div>

                    {recipe.comments && recipe.comments.length > 0 ? (
                        recipe.comments.map((comment) => (
                            <div key={comment.id} className="comment-item">
                                <div className="comment-avatar">
                                    {comment.author.avatarUrl ? (
                                        <img src={comment.author.avatarUrl} alt="" />
                                    ) : (
                                        getInitials(comment.author.name)
                                    )}
                                </div>
                                <div className="comment-body">
                                    <div className="comment-author">{comment.author.name}</div>
                                    <div className="comment-text">{comment.content}</div>
                                    <div className="comment-date">{formatDate(comment.createdAt)}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted text-sm text-center" style={{ padding: 'var(--sp-md) 0' }}>
                            No comments yet
                        </p>
                    )}

                    <form onSubmit={handleAddComment} className="comment-input-row">
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
                    </form>
                </div>
            </div>
        </div>
    );
}

export default RecipeDetail;
