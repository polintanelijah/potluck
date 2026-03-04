import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Use getUser with a timeout to prevent hanging
    // If Supabase is slow/down, let the page load anyway and let
    // client-side auth handle the redirect
    let user = null;
    try {
        const result = await Promise.race([
            supabase.auth.getUser(),
            new Promise((resolve) =>
                setTimeout(() => resolve({ data: { user: null }, error: 'timeout' }), 3000)
            ),
        ]);
        user = result?.data?.user ?? null;
    } catch {
        // If getUser fails, let the request through — client-side will handle auth
        return supabaseResponse;
    }

    const isAuthPage =
        request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/signup';

    // Redirect unauthenticated users to login (except auth pages and root)
    if (!user && !isAuthPage && request.nextUrl.pathname !== '/') {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from auth pages
    if (user && isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = '/feed';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
