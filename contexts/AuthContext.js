'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getSupabase } from '@/lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const initialized = useRef(false);
    const supabase = getSupabase();

    async function fetchProfile(userId) {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            setProfile(data);
        } catch (err) {
            console.error('Failed to fetch profile:', err);
        }
    }

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        // Safety timeout — never stay loading forever
        const timeout = setTimeout(() => {
            console.warn('Auth loading timed out — forcing load complete');
            setLoading(false);
        }, 3000);

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            }
            setLoading(false);
            clearTimeout(timeout);
        }).catch((err) => {
            console.error('Auth session error:', err);
            setUser(null);
            setLoading(false);
            clearTimeout(timeout);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setUser(session?.user ?? null);
                if (session?.user) {
                    fetchProfile(session.user.id).catch(() => { });
                } else {
                    setProfile(null);
                }
                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    async function signUp(email, password, name, username) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name, username },
            },
        });
        if (error) throw error;

        // Safety net: explicitly update the profile row in case the
        // trigger didn't receive the metadata or ran before it was set.
        if (data?.user?.id) {
            await supabase.from('profiles').upsert({
                id: data.user.id,
                name: name || '',
                username: username || '',
                email: email,
            }, { onConflict: 'id' });
        }

        return data;
    }

    async function signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    }

    async function signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setUser(null);
        setProfile(null);
    }

    async function refreshProfile() {
        if (user) {
            await fetchProfile(user.id);
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                loading,
                signUp,
                signIn,
                signOut,
                refreshProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
