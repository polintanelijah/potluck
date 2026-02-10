import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Header() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const getInitials = (name) => {
        if (!name) return '?';
        return name
            .split(' ')
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <nav className="bottom-nav">
            <Link to="/" className={`nav-tab ${isActive('/') ? 'active' : ''}`}>
                <span className="nav-tab-icon">🏠</span>
                <span>Feed</span>
            </Link>
            <Link to="/groups" className={`nav-tab ${isActive('/groups') ? 'active' : ''}`}>
                <span className="nav-tab-icon">👥</span>
                <span>Groups</span>
            </Link>
            <Link to="/new" className="nav-tab-add" aria-label="Add recipe">
                +
            </Link>
            <button
                className={`nav-tab ${false ? 'active' : ''}`}
                onClick={logout}
                title={`Signed in as ${user?.displayName}. Tap to log out.`}
            >
                <span className="nav-tab-icon">
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'var(--color-bg-hover)',
                        fontSize: '0.55rem',
                        fontWeight: 600
                    }}>
                        {getInitials(user?.displayName)}
                    </span>
                </span>
                <span>Profile</span>
            </button>
        </nav>
    );
}

export default Header;
