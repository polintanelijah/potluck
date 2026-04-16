import { describe, it, expect } from 'vitest';
import {
    GEMINI_MODEL,
    buildGeminiBody,
    parseGeminiResponse,
} from './format-recipe';

describe('GEMINI_MODEL', () => {
    it('is the preview flash-lite id', () => {
        expect(GEMINI_MODEL).toBe('gemini-3.1-flash-lite-preview');
    });
});

describe('buildGeminiBody', () => {
    it('uses the imperative-steps system prompt for instructions', () => {
        const body = buildGeminiBody('instructions', 'add pork season salt and pepper fry');
        expect(body.systemInstruction.parts[0].text).toMatch(/imperative cooking steps/i);
        expect(body.contents[0].parts[0].text).toBe('add pork season salt and pepper fry');
        expect(body.generationConfig.responseMimeType).toBe('application/json');
        expect(body.generationConfig.responseSchema.required).toEqual(['lines']);
    });

    it('uses the ingredient-splitter system prompt for ingredients', () => {
        const body = buildGeminiBody('ingredients', 'pork salt pepper oil');
        expect(body.systemInstruction.parts[0].text).toMatch(/one ingredient per array entry/i);
        expect(body.contents[0].parts[0].text).toBe('pork salt pepper oil');
    });

    it('rejects unknown fields', () => {
        expect(() => buildGeminiBody('notes', 'x')).toThrow(/unknown field/i);
    });
});

describe('parseGeminiResponse', () => {
    const wrap = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });

    it('extracts the lines array from the JSON text payload', () => {
        const res = parseGeminiResponse(
            wrap('{"lines":["Add pork.","Season with salt and pepper.","Fry in pan."]}'),
        );
        expect(res.lines).toEqual([
            'Add pork.',
            'Season with salt and pepper.',
            'Fry in pan.',
        ]);
    });

    it('trims whitespace and drops empty entries', () => {
        const res = parseGeminiResponse(wrap('{"lines":["  Add pork.  ","",""]}'));
        expect(res.lines).toEqual(['Add pork.']);
    });

    it('throws when the response has no candidates', () => {
        expect(() => parseGeminiResponse({})).toThrow();
    });

    it('throws on malformed JSON inside the text part', () => {
        expect(() => parseGeminiResponse(wrap('not json'))).toThrow();
    });

    it('throws when lines[] is missing', () => {
        expect(() => parseGeminiResponse(wrap('{"other":[]}'))).toThrow(/missing lines/i);
    });

    it('throws when lines[] ends up empty after cleaning', () => {
        expect(() => parseGeminiResponse(wrap('{"lines":["","   "]}'))).toThrow(/empty/i);
    });
});
