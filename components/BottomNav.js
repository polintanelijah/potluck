'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
    {
        label: 'Feed',
        href: '/feed',
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'var(--color-accent)' : 'none'} stroke={active ? 'var(--color-accent)' : 'var(--color-text-muted)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        ),
    },
    {
        label: 'Discover',
        href: '/discover',
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-accent)' : 'var(--color-text-muted)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
        ),
    },
    {
        label: 'Cook',
        href: '/post',
        icon: (active) => (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-accent)' : 'var(--color-text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
        ),
    },
    {
        label: 'Profile',
        href: '/profile',
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-accent)' : 'var(--color-text-muted)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        ),
    },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50"
            style={{
                background: 'rgba(250, 246, 241, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid var(--color-border)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
        >
            <div className="flex items-center justify-around max-w-lg mx-auto h-14">
                {tabs.map((tab) => {
                    const isActive =
                        pathname === tab.href || pathname.startsWith(tab.href + '/');
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className="flex flex-col items-center gap-0.5 px-3 py-1 transition-all duration-150"
                            style={{
                                color: isActive
                                    ? 'var(--color-accent)'
                                    : 'var(--color-text-muted)',
                            }}
                        >
                            {tab.icon(isActive)}
                            <span
                                className="text-[0.6rem] tracking-wider"
                                style={{
                                    fontFamily: "'DM Mono', monospace",
                                    textTransform: 'uppercase',
                                    fontWeight: isActive ? 500 : 400,
                                }}
                            >
                                {tab.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
