import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') || '/feed';

    if (code) {
        const supabase = await getSupabaseServer();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            return NextResponse.redirect(new URL(next, origin));
        }
    }

    // No code or exchange failed — send to login
    return NextResponse.redirect(new URL('/login', origin));
}
