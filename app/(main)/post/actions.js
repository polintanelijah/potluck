'use server';

import { getSupabaseServer } from '@/lib/supabase-server';
import {
    GEMINI_ENDPOINT,
    MAX_INPUT_LENGTH,
    buildGeminiBody,
    parseGeminiResponse,
} from '@/lib/format-recipe';

const TIMEOUT_MS = 10_000;

export async function formatRecipeField(field, raw) {
    const supabase = await getSupabaseServer();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'unauthorized' };

    if (field !== 'ingredients' && field !== 'instructions') {
        return { error: 'invalid_input' };
    }
    if (typeof raw !== 'string') return { error: 'invalid_input' };
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_INPUT_LENGTH) {
        return { error: 'invalid_input' };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { error: 'not_configured' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildGeminiBody(field, trimmed)),
            signal: controller.signal,
        });

        if (!res.ok) {
            return { error: 'upstream', status: res.status };
        }

        const json = await res.json();
        return parseGeminiResponse(json);
    } catch (err) {
        if (err?.name === 'AbortError') return { error: 'timeout' };
        return { error: 'parse_failed' };
    } finally {
        clearTimeout(timer);
    }
}
