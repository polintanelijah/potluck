'use client';

import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function MainLayout({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="spinner" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
            <main className="pb-nav max-w-lg mx-auto">
                {children}
            </main>
            <BottomNav />
        </div>
    );
}
