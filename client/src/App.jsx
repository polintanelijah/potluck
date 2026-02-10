import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Login from './pages/Login';
import Register from './pages/Register';
import Feed from './pages/Feed';
import Groups from './pages/Groups';
import NewRecipe from './pages/NewRecipe';
import RecipeDetail from './pages/RecipeDetail';

// Protected route wrapper
function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="page flex items-center justify-center">
                <div className="loading">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

// Public route wrapper (redirects to feed if logged in)
function PublicRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="page flex items-center justify-center">
                <div className="loading">Loading...</div>
            </div>
        );
    }

    if (user) {
        return <Navigate to="/" replace />;
    }

    return children;
}

function App() {
    const { user } = useAuth();

    return (
        <>
            {user && <Header />}
            <Routes>
                <Route path="/login" element={
                    <PublicRoute>
                        <Login />
                    </PublicRoute>
                } />
                <Route path="/register" element={
                    <PublicRoute>
                        <Register />
                    </PublicRoute>
                } />
                <Route path="/" element={
                    <ProtectedRoute>
                        <Feed />
                    </ProtectedRoute>
                } />
                <Route path="/groups" element={
                    <ProtectedRoute>
                        <Groups />
                    </ProtectedRoute>
                } />
                <Route path="/new" element={
                    <ProtectedRoute>
                        <NewRecipe />
                    </ProtectedRoute>
                } />
                <Route path="/recipe/:id" element={
                    <ProtectedRoute>
                        <RecipeDetail />
                    </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
    );
}

export default App;
