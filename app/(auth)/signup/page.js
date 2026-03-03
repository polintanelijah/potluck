'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function SignUpPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const router = useRouter();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            await signUp(email, password, name);
            router.push('/feed');
        } catch (err) {
            setError(err.message || 'Failed to sign up');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6"
            style={{ background: 'var(--color-bg-primary)' }}>
            <div className="w-full max-w-sm animate-fade-in">
                {/* Logo */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Potluck
                    </h1>
                    <p className="note-text text-sm">
                        join your friends in the kitchen
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="text-sm px-4 py-3 rounded-md"
                            style={{ background: 'rgba(192,71,42,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(192,71,42,0.15)' }}>
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="label" htmlFor="name">Name</label>
                        <input
                            id="name"
                            type="text"
                            className="input-field"
                            placeholder="What your friends call you"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoComplete="name"
                        />
                    </div>

                    <div>
                        <label className="label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="input-field"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div>
                        <label className="label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="input-field"
                            placeholder="At least 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary w-full"
                        disabled={loading}
                    >
                        {loading ? 'Creating account...' : 'Join the Table'}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Already have an account?{' '}
                    <Link href="/login" className="font-semibold" style={{ color: 'var(--color-accent)' }}>
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    );
}
