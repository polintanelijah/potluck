export const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
export const MAX_INPUT_LENGTH = 4000;

const SYSTEM_INSTRUCTIONS = {
    instructions:
        "You are a recipe formatter. Rewrite the user's messy text as a sequence of short imperative cooking steps, one per array entry in the 'lines' field. Capitalize the first word of each step and end it with a period. Do not invent steps, ingredients, or quantities that aren't in the input — only split, punctuate, and clarify.",
    ingredients:
        "You are a recipe formatter. Split the user's messy text into one ingredient per array entry in the 'lines' field. Keep each entry lowercase and preserve any quantities or units stated in the input. Do not invent quantities, units, or ingredients that aren't in the input — only split and clean.",
};

const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        lines: {
            type: 'ARRAY',
            items: { type: 'STRING' },
        },
    },
    required: ['lines'],
};

export function buildGeminiBody(field, raw) {
    if (field !== 'ingredients' && field !== 'instructions') {
        throw new Error(`Unknown field: ${field}`);
    }
    return {
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTIONS[field] }],
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: raw }],
            },
        ],
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.2,
        },
    };
}

export function parseGeminiResponse(json) {
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Gemini returned no text');
    }
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.lines)) {
        throw new Error('Gemini response missing lines[]');
    }
    const lines = parsed.lines
        .map((line) => (typeof line === 'string' ? line.trim() : ''))
        .filter(Boolean);
    if (lines.length === 0) {
        throw new Error('Gemini returned empty lines[]');
    }
    return { lines };
}
