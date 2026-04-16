const JSON_LD_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const SCRIPT_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const TAG_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;

const HTML_ENTITIES = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
};

function typeIncludesRecipe(t) {
    if (!t) return false;
    if (Array.isArray(t)) return t.some((x) => typeof x === 'string' && x.includes('Recipe'));
    return typeof t === 'string' && t.includes('Recipe');
}

function findRecipeNode(node) {
    if (!node || typeof node !== 'object') return null;
    if (typeIncludesRecipe(node['@type'])) return node;
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findRecipeNode(child);
            if (found) return found;
        }
        return null;
    }
    if (Array.isArray(node['@graph'])) {
        for (const child of node['@graph']) {
            const found = findRecipeNode(child);
            if (found) return found;
        }
    }
    return null;
}

function splitInstructionBlob(text) {
    if (!text) return [];
    const lines = String(text)
        .split(/\r?\n|(?<=[.!?])\s+(?=[A-Z0-9])|(?:^|\s)\d+[.)]\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    return lines;
}

function normalizeInstructions(value) {
    if (value == null) return [];
    if (typeof value === 'string') return splitInstructionBlob(value);
    if (!Array.isArray(value)) return [];

    const out = [];
    for (const item of value) {
        if (!item) continue;
        if (typeof item === 'string') {
            out.push(item.trim());
            continue;
        }
        if (typeof item !== 'object') continue;
        const type = item['@type'];
        if (typeIncludesRecipe(type) === false && typeof type === 'string' && type.includes('HowToSection')) {
            if (Array.isArray(item.itemListElement)) {
                out.push(...normalizeInstructions(item.itemListElement));
            }
            continue;
        }
        if (typeof item.text === 'string') {
            out.push(item.text.trim());
            continue;
        }
        if (typeof item.name === 'string') {
            out.push(item.name.trim());
        }
    }
    return out.filter(Boolean);
}

function normalizeIngredients(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object' && typeof item.text === 'string') return item.text.trim();
            return '';
        })
        .filter(Boolean);
}

function firstImageUrl(value) {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = firstImageUrl(item);
            if (found) return found;
        }
        return undefined;
    }
    if (typeof value === 'object' && typeof value.url === 'string') return value.url;
    return undefined;
}

export function parseJsonLdRecipe(html) {
    if (typeof html !== 'string' || !html) return null;
    JSON_LD_RE.lastIndex = 0;
    let match;
    while ((match = JSON_LD_RE.exec(html)) !== null) {
        const block = match[1];
        if (!block) continue;
        // Strip CDATA wrappers used by WordPress/Yoast before JSON.parse
        // Pattern: "// <![CDATA[" at start and "// ]]>" at end (space between // and markers is optional)
        const cleaned = block
            .replace(/^[\s]*\/\/\s*<!\[CDATA\[[\r\n]*/i, '')
            .replace(/[\r\n]*\/\/\s*\]\]>[\s]*$/i, '')
            .trim();
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            continue;
        }
        const recipe = findRecipeNode(parsed);
        if (!recipe) continue;
        const ingredients = normalizeIngredients(recipe.recipeIngredient);
        const instructions = normalizeInstructions(recipe.recipeInstructions);
        const title = typeof recipe.name === 'string' ? recipe.name.trim() : undefined;
        const imageUrl = firstImageUrl(recipe.image);
        return { ingredients, instructions, title, imageUrl };
    }
    return null;
}

export function htmlToPlainText(html) {
    if (typeof html !== 'string' || !html) return '';
    let text = html.replace(SCRIPT_STYLE_RE, ' ');
    text = text.replace(TAG_RE, ' ');
    text = text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
    for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
        text = text.split(entity).join(replacement);
    }
    return text.replace(WHITESPACE_RE, ' ').trim();
}

import { GEMINI_MODEL } from './format-recipe';

export const URL_GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
export const MAX_GEMINI_TEXT_LENGTH = 12000;

const URL_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
        instructions: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['ingredients', 'instructions'],
};

const URL_SYSTEM_INSTRUCTION =
    "You are extracting a recipe from scraped webpage text. Return JSON with two arrays: 'ingredients' (one ingredient per entry, preserve quantities and units stated on the page) and 'instructions' (one short imperative step per entry, capitalized, ending with a period). Do not invent ingredients, quantities, or steps that aren't in the source text. If either list cannot be found, return it as an empty array.";

export function buildGeminiUrlBody(text) {
    return {
        systemInstruction: { parts: [{ text: URL_SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: URL_RESPONSE_SCHEMA,
            temperature: 0.2,
        },
    };
}

export function parseGeminiUrlResponse(json) {
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Gemini returned no text');
    }
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.instructions)) {
        throw new Error('Gemini response missing ingredients/instructions');
    }
    const clean = (arr) =>
        arr.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    return {
        ingredients: clean(parsed.ingredients),
        instructions: clean(parsed.instructions),
    };
}

export function hostnameFromUrl(url) {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
}

export function isCloudflareChallenge(html) {
    if (typeof html !== 'string') return false;
    const lc = html.toLowerCase();
    return (
        lc.includes('just a moment') ||
        lc.includes('challenge-platform') ||
        lc.includes('cf-browser-verification') ||
        lc.includes('enable javascript and cookies to continue')
    );
}

const URL_CONTEXT_PROMPT = (url) =>
    `Extract the full recipe from this webpage: ${url}\n\n` +
    `Return ONLY a valid JSON object with exactly these two keys:\n` +
    `{"ingredients": ["one ingredient per entry with quantity"], "instructions": ["one imperative step per entry"]}\n\n` +
    `Do not include any explanation or markdown. Output raw JSON only.`;

export function buildGeminiUrlContextBody(url) {
    return {
        tools: [{ url_context: {} }],
        contents: [{ role: 'user', parts: [{ text: URL_CONTEXT_PROMPT(url) }] }],
        generationConfig: { temperature: 0.1 },
    };
}

export function parseGeminiUrlContextResponse(json) {
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('url_context: no response text');
    }
    // Extract the first {...} JSON block — model may prepend prose
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('url_context: no JSON block in response');
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.instructions)) {
        throw new Error('url_context: missing ingredients/instructions');
    }
    const clean = (arr) =>
        arr.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    return {
        ingredients: clean(parsed.ingredients),
        instructions: clean(parsed.instructions),
    };
}
