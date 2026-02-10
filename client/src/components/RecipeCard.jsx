import { Link } from 'react-router-dom';

function RecipeCard({ recipe }) {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
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

    // Convert 1-5 rating to Beli-style display score
    const getScore = (rating) => {
        if (!rating) return null;
        return (rating * 2).toFixed(1);
    };

    return (
        <Link to={`/recipe/${recipe.id}`} className="recipe-card">
            <div className="recipe-card-img-wrap">
                {recipe.imageUrl ? (
                    <img src={recipe.imageUrl} alt={recipe.title} />
                ) : (
                    <div className="recipe-card-img-placeholder">🍽</div>
                )}
                {recipe.rating && (
                    <div className="recipe-card-score">
                        {getScore(recipe.rating)}
                    </div>
                )}
            </div>

            <div className="recipe-card-body">
                <div className="recipe-card-title">{recipe.title}</div>
                {recipe.notes && (
                    <div className="recipe-card-notes">{recipe.notes}</div>
                )}
                <div className="recipe-card-meta">
                    <div className="recipe-card-avatar">
                        {recipe.author.avatarUrl ? (
                            <img src={recipe.author.avatarUrl} alt="" />
                        ) : (
                            getInitials(recipe.author.name)
                        )}
                    </div>
                    <div className="recipe-card-info">
                        <span>{recipe.author.name}</span>
                        <span>{recipe.group.name}</span>
                        <span>{recipe.cookDate ? formatDate(recipe.cookDate) : formatDate(recipe.createdAt)}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}

export default RecipeCard;
