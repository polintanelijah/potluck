'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const router = useRouter();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signIn(email, password);
            router.push('/feed');
        } catch (err) {
            setError(err.message || 'Failed to sign in');
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
                        share what you&apos;re actually cooking
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
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary w-full"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Don&apos;t have an account?{' '}
                    <Link href="/signup" className="font-semibold" style={{ color: 'var(--color-accent)' }}>
                        Sign Up
                    </Link>
                </p>
            </div>
        </div>
    );
}
