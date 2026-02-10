import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import RecipeCard from '../components/RecipeCard';

function Feed() {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchRecipes();
    }, []);

    const fetchRecipes = async () => {
        try {
            const data = await api.get('/recipes');
            setRecipes(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="page">
                <h1 className="page-title">Feed</h1>
                <div className="feed-list">
                    {[1, 2, 3].map((i) => (
                        <div key={i} style={{ marginBottom: 'var(--sp-md)' }}>
                            <div className="skeleton" style={{ aspectRatio: '4/3', borderRadius: 'var(--r-lg)' }} />
                            <div className="skeleton mt-sm" style={{ height: 16, width: '60%', borderRadius: 4 }} />
                            <div className="skeleton mt-xs" style={{ height: 12, width: '40%', borderRadius: 4 }} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page">
                <h1 className="page-title">Feed</h1>
                <div className="feed-empty">
                    <p className="text-secondary">Error: {error}</p>
                    <button className="btn btn-primary mt-lg" onClick={fetchRecipes}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <h1 className="page-title">Feed</h1>

            {recipes.length === 0 ? (
                <div className="feed-empty">
                    <div className="feed-empty-icon">🍳</div>
                    <h2>Your feed is empty</h2>
                    <p>Join a group and start sharing what you're cooking!</p>
                    <div className="flex gap-sm justify-center">
                        <Link to="/groups" className="btn btn-secondary">
                            Find Groups
                        </Link>
                        <Link to="/new" className="btn btn-primary">
                            Add Recipe
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="feed-list">
                    {recipes.map((recipe) => (
                        <RecipeCard key={recipe.id} recipe={recipe} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Feed;
