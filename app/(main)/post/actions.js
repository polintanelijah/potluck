'use server';

import { getSupabaseServer } from '@/lib/supabase-server';
import {
    GEMINI_ENDPOINT,
    MAX_INPUT_LENGTH,
    buildGeminiBody,
    parseGeminiResponse,
} from '@/lib/format-recipe';
import {
    URL_GEMINI_ENDPOINT,
    MAX_GEMINI_TEXT_LENGTH,
    parseJsonLdRecipe,
    htmlToPlainText,
    buildGeminiUrlBody,
    parseGeminiUrlResponse,
    hostnameFromUrl,
    isCloudflareChallenge,
    buildGeminiUrlContextBody,
    parseGeminiUrlContextResponse,
} from '@/lib/recipe-scrape';

const TIMEOUT_MS = 10_000;
const MAX_PAGE_BYTES = 512_000;
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
};

function isBlockedHost(hostname) {
    if (!hostname) return true;
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0') return true;
    if (host === '127.0.0.1') return true;
    if (host.startsWith('10.')) return true;
    if (host.startsWith('192.168.')) return true;
    if (host.startsWith('169.254.')) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return true;
    return false;
}

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

export async function extractRecipeFromUrl(rawUrl) {
    const supabase = await getSupabaseServer();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'unauthorized' };

    if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
        return { error: 'invalid_url' };
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(rawUrl.trim());
    } catch {
        return { error: 'invalid_url' };
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return { error: 'invalid_url' };
    }
    if (isBlockedHost(parsedUrl.hostname)) {
        return { error: 'invalid_url' };
    }

    const sourceSite = hostnameFromUrl(parsedUrl.toString());
    const apiKey = process.env.GEMINI_API_KEY;

    // --- Step 1: Direct fetch with browser-like headers ---
    let body = null;
    let blocked = false;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(parsedUrl.toString(), {
            method: 'GET',
            redirect: 'follow',
            headers: BROWSER_HEADERS,
            signal: controller.signal,
        });
        if (!res.ok) {
            blocked = true;
        } else {
            const raw = await res.text();
            body = raw.length > MAX_PAGE_BYTES ? raw.slice(0, MAX_PAGE_BYTES) : raw;
            if (isCloudflareChallenge(body)) {
                blocked = true;
                body = null;
            }
        }
    } catch (err) {
        if (err?.name === 'AbortError') return { error: 'timeout' };
        blocked = true;
    } finally {
        clearTimeout(timer);
    }

    // --- Step 2: JSON-LD parse (free, fast) ---
    if (body) {
        const jsonLd = parseJsonLdRecipe(body);
        if (jsonLd && jsonLd.ingredients.length > 0 && jsonLd.instructions.length > 0) {
            return {
                ingredients: jsonLd.ingredients,
                instructions: jsonLd.instructions,
                title: jsonLd.title,
                sourceSite,
                via: 'jsonld',
            };
        }
    }

    // --- Step 3: HTML-to-text Gemini parse (only if we have real page content) ---
    if (body && apiKey) {
        const plainText = htmlToPlainText(body).slice(0, MAX_GEMINI_TEXT_LENGTH);
        if (plainText) {
            const geminiController = new AbortController();
            const geminiTimer = setTimeout(() => geminiController.abort(), TIMEOUT_MS);
            try {
                const res = await fetch(`${URL_GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildGeminiUrlBody(plainText)),
                    signal: geminiController.signal,
                });
                if (res.ok) {
                    const json = await res.json();
                    const parsed = parseGeminiUrlResponse(json);
                    if (parsed.ingredients.length > 0 && parsed.instructions.length > 0) {
                        return { ingredients: parsed.ingredients, instructions: parsed.instructions, sourceSite, via: 'gemini' };
                    }
                }
            } catch { /* fall through to url_context */ }
            finally { clearTimeout(geminiTimer); }
        }
    }

    // --- Step 4: Gemini url_context (Google fetches the URL, bypasses Cloudflare) ---
    if (apiKey) {
        const ctxController = new AbortController();
        const ctxTimer = setTimeout(() => ctxController.abort(), TIMEOUT_MS);
        try {
            const ctxRes = await fetch(`${URL_GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildGeminiUrlContextBody(parsedUrl.toString())),
                signal: ctxController.signal,
            });
            if (ctxRes.ok) {
                const ctxJson = await ctxRes.json();
                const ctxParsed = parseGeminiUrlContextResponse(ctxJson);
                if (ctxParsed.ingredients.length > 0 && ctxParsed.instructions.length > 0) {
                    return { ingredients: ctxParsed.ingredients, instructions: ctxParsed.instructions, sourceSite, via: 'url_context' };
                }
            }
        } catch { /* fall through */ }
        finally { clearTimeout(ctxTimer); }
    }

    return { error: apiKey ? 'no_recipe_found' : 'not_configured' };
}
