import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

function NewRecipe() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [title, setTitle] = useState('');
    const [groupId, setGroupId] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [sourceName, setSourceName] = useState('');
    const [rating, setRating] = useState(0);
    const [notes, setNotes] = useState('');
    const [cookDate, setCookDate] = useState('');
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const data = await api.get('/groups');
            setGroups(data);
            if (data.length > 0) {
                setGroupId(data[0].id.toString());
            }
        } catch (err) {
            setError('Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError('Please enter a recipe title');
            return;
        }
        if (!groupId) {
            setError('Please select a group');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('groupId', groupId);
            if (sourceUrl) formData.append('sourceUrl', sourceUrl);
            if (sourceName) formData.append('sourceName', sourceName);
            if (rating) formData.append('rating', rating.toString());
            if (notes) formData.append('notes', notes);
            if (cookDate) formData.append('cookDate', cookDate);
            if (image) formData.append('image', image);

            await api.post('/recipes', formData);
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="page">
                <h1 className="page-title">New Recipe</h1>
                <div className="skeleton" style={{ aspectRatio: '4/3', borderRadius: 'var(--r-lg)' }} />
            </div>
        );
    }

    if (groups.length === 0) {
        return (
            <div className="page">
                <h1 className="page-title">New Recipe</h1>
                <div className="feed-empty">
                    <div className="feed-empty-icon">🍳</div>
                    <h2>No groups yet</h2>
                    <p>Join or create a group before sharing recipes.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/groups')}>
                        Go to Groups
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <h1 className="page-title">New Recipe</h1>

            <form onSubmit={handleSubmit}>
                {/* Image Upload */}
                <div className="form-group">
                    <div
                        className={`image-upload ${imagePreview ? 'has-image' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {imagePreview ? (
                            <img src={imagePreview} alt="Preview" />
                        ) : (
                            <>
                                <div className="image-upload-icon">📸</div>
                                <p className="image-upload-text">Tap to add a photo</p>
                            </>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                    />
                </div>

                {/* Title */}
                <div className="form-group">
                    <label className="form-label" htmlFor="title">What did you make?</label>
                    <input
                        id="title"
                        type="text"
                        className="form-input"
                        placeholder="e.g., Butter Chicken"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={submitting}
                    />
                </div>

                {/* Group Selection */}
                <div className="form-group">
                    <label className="form-label" htmlFor="group">Share with</label>
                    <select
                        id="group"
                        className="form-input"
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        disabled={submitting}
                    >
                        {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                                {group.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Rating — tappable circles */}
                <div className="form-group">
                    <label className="form-label">Rating</label>
                    <div className="rating-input">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                className={`rating-dot ${n <= rating ? 'active' : ''}`}
                                onClick={() => setRating(n === rating ? 0 : n)}
                                disabled={submitting}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Source */}
                <div className="form-group">
                    <label className="form-label" htmlFor="sourceUrl">Recipe link (optional)</label>
                    <input
                        id="sourceUrl"
                        type="url"
                        className="form-input"
                        placeholder="https://..."
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        disabled={submitting}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="sourceName">Source name (optional)</label>
                    <input
                        id="sourceName"
                        type="text"
                        className="form-input"
                        placeholder="e.g., NYT Cooking"
                        value={sourceName}
                        onChange={(e) => setSourceName(e.target.value)}
                        disabled={submitting}
                    />
                </div>

                {/* Notes */}
                <div className="form-group">
                    <label className="form-label" htmlFor="notes">Notes (optional)</label>
                    <textarea
                        id="notes"
                        className="form-input"
                        placeholder="Tips, modifications, thoughts..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={submitting}
                        rows={3}
                    />
                </div>

                {/* Cook Date */}
                <div className="form-group">
                    <label className="form-label" htmlFor="cookDate">Date cooked (optional)</label>
                    <input
                        id="cookDate"
                        type="date"
                        className="form-input"
                        value={cookDate}
                        onChange={(e) => setCookDate(e.target.value)}
                        disabled={submitting}
                        max={new Date().toISOString().split('T')[0]}
                    />
                </div>

                {error && <p className="text-error text-sm mb-md">{error}</p>}

                <div className="flex gap-sm">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate(-1)}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        style={{ flex: 1 }}
                        disabled={submitting}
                    >
                        {submitting ? 'Sharing...' : 'Share'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default NewRecipe;
