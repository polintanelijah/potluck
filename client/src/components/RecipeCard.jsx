import { Link } from 'react-router-dom';

function RecipeCard({ recipe }) {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
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

    return (
        <Link to={`/recipe/${recipe.id}`} className="card recipe-card">
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
                    <div className="recipe-card-group">{recipe.group.name}</div>
                </div>
                {recipe.rating && (
                    <div className="recipe-card-rating">
                        {renderStars(recipe.rating)}
                    </div>
                )}
            </div>

            {recipe.imageUrl && (
                <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="card-image"
                />
            )}

            <div className="card-content">
                <h3 className="card-title">{recipe.title}</h3>
                {recipe.notes && (
                    <p className="recipe-card-notes">{recipe.notes}</p>
                )}
            </div>

            <div className="recipe-card-footer">
                <span className="recipe-card-date">
                    {recipe.cookDate ? `Cooked ${formatDate(recipe.cookDate)}` : formatDate(recipe.createdAt)}
                </span>
                {recipe.sourceUrl && (
                    <span className="recipe-card-source">View Recipe →</span>
                )}
            </div>
        </Link>
    );
}

export default RecipeCard;
