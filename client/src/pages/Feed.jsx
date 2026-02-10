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
                <div className="container">
                    <div className="feed">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="card loading" style={{ height: '300px' }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page">
                <div className="container">
                    <div className="feed-empty">
                        <p className="text-secondary">Error loading recipes: {error}</p>
                        <button className="btn btn-primary mt-lg" onClick={fetchRecipes}>
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div className="flex justify-between items-center mb-xl">
                    <h1>What's Cooking</h1>
                </div>

                {recipes.length === 0 ? (
                    <div className="feed-empty">
                        <div className="feed-empty-icon">🍳</div>
                        <h2>Your feed is empty</h2>
                        <p className="text-secondary mt-sm mb-lg">
                            Join a group and start sharing what you're cooking!
                        </p>
                        <div className="flex gap-md justify-center">
                            <Link to="/groups" className="btn btn-secondary">
                                Find Groups
                            </Link>
                            <Link to="/new" className="btn btn-primary">
                                Add Your First Recipe
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="feed">
                        {recipes.map((recipe) => (
                            <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Feed;
