import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Login from './pages/Login';
import Register from './pages/Register';
import Feed from './pages/Feed';
import Groups from './pages/Groups';
import NewRecipe from './pages/NewRecipe';
import RecipeDetail from './pages/RecipeDetail';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="page flex items-center justify-center">
                <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="page flex items-center justify-center">
                <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
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
        <div className="app-shell">
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
            {user && <Header />}
        </div>
    );
}

export default App;
