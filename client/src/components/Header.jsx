import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Header() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    return (
        <header className="header">
            <div className="container header-content">
                <Link to="/" className="logo">
                    <img src="/potluck.svg" alt="Potluck logo" />
                    <span>Potluck</span>
                </Link>

                <nav className="nav">
                    <Link
                        to="/"
                        className={`nav-link ${isActive('/') ? 'active' : ''}`}
                    >
                        Feed
                    </Link>
                    <Link
                        to="/groups"
                        className={`nav-link ${isActive('/groups') ? 'active' : ''}`}
                    >
                        Groups
                    </Link>
                    <Link
                        to="/new"
                        className="btn btn-primary"
                    >
                        + Add Recipe
                    </Link>
                    <button
                        onClick={logout}
                        className="btn btn-ghost"
                        title={`Logged in as ${user?.displayName}`}
                    >
                        Logout
                    </button>
                </nav>
            </div>
        </header>
    );
}

export default Header;
