import { describe, it, expect } from 'vitest';
import {
    parseJsonLdRecipe,
    htmlToPlainText,
    buildGeminiUrlBody,
    parseGeminiUrlResponse,
    hostnameFromUrl,
    URL_GEMINI_ENDPOINT,
    isCloudflareChallenge,
    buildGeminiUrlContextBody,
    parseGeminiUrlContextResponse,
} from './recipe-scrape';

const wrapScript = (obj) =>
    `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head><body></body></html>`;

describe('parseJsonLdRecipe', () => {
    it('finds a Recipe with HowToStep[] instructions (AllRecipes pattern)', () => {
        const html = wrapScript({
            '@context': 'https://schema.org',
            '@type': 'Recipe',
            name: 'Simple Pork Fry',
            recipeIngredient: ['1 lb pork', 'salt', 'pepper'],
            recipeInstructions: [
                { '@type': 'HowToStep', text: 'Add pork to the pan.' },
                { '@type': 'HowToStep', text: 'Season with salt and pepper.' },
                { '@type': 'HowToStep', text: 'Fry until golden.' },
            ],
        });
        const res = parseJsonLdRecipe(html);
        expect(res.title).toBe('Simple Pork Fry');
        expect(res.ingredients).toEqual(['1 lb pork', 'salt', 'pepper']);
        expect(res.instructions).toEqual([
            'Add pork to the pan.',
            'Season with salt and pepper.',
            'Fry until golden.',
        ]);
    });

    it('finds a Recipe with plain-string recipeInstructions and splits steps', () => {
        const html = wrapScript({
            '@type': 'Recipe',
            name: 'Blog Recipe',
            recipeIngredient: ['flour', 'water'],
            recipeInstructions: 'Mix flour and water. Knead the dough. Bake at 400F.',
        });
        const res = parseJsonLdRecipe(html);
        expect(res.instructions.length).toBeGreaterThanOrEqual(3);
        expect(res.instructions[0]).toMatch(/^Mix/);
    });

    it('finds a Recipe nested inside @graph (Yoast/WordPress pattern)', () => {
        const html = wrapScript({
            '@context': 'https://schema.org',
            '@graph': [
                { '@type': 'WebPage', name: 'Some page' },
                {
                    '@type': 'Recipe',
                    name: 'Nested Recipe',
                    recipeIngredient: ['sugar'],
                    recipeInstructions: ['Stir sugar.'],
                },
            ],
        });
        const res = parseJsonLdRecipe(html);
        expect(res.title).toBe('Nested Recipe');
        expect(res.ingredients).toEqual(['sugar']);
    });

    it('flattens HowToSection > HowToStep arrays', () => {
        const html = wrapScript({
            '@type': 'Recipe',
            recipeIngredient: ['a'],
            recipeInstructions: [
                {
                    '@type': 'HowToSection',
                    name: 'Prep',
                    itemListElement: [
                        { '@type': 'HowToStep', text: 'Chop.' },
                        { '@type': 'HowToStep', text: 'Measure.' },
                    ],
                },
                {
                    '@type': 'HowToSection',
                    name: 'Cook',
                    itemListElement: [{ '@type': 'HowToStep', text: 'Fry.' }],
                },
            ],
        });
        const res = parseJsonLdRecipe(html);
        expect(res.instructions).toEqual(['Chop.', 'Measure.', 'Fry.']);
    });

    it('extracts first image from string / array / object', () => {
        const stringImg = parseJsonLdRecipe(
            wrapScript({ '@type': 'Recipe', recipeIngredient: [], recipeInstructions: [], image: 'https://a/x.jpg' }),
        );
        expect(stringImg.imageUrl).toBe('https://a/x.jpg');

        const arrImg = parseJsonLdRecipe(
            wrapScript({ '@type': 'Recipe', recipeIngredient: [], recipeInstructions: [], image: ['https://a/1.jpg', 'https://a/2.jpg'] }),
        );
        expect(arrImg.imageUrl).toBe('https://a/1.jpg');

        const objImg = parseJsonLdRecipe(
            wrapScript({ '@type': 'Recipe', recipeIngredient: [], recipeInstructions: [], image: { url: 'https://a/obj.jpg' } }),
        );
        expect(objImg.imageUrl).toBe('https://a/obj.jpg');
    });

    it('skips malformed JSON-LD blocks without throwing', () => {
        const html = `
            <script type="application/ld+json">{this is not json</script>
            <script type="application/ld+json">${JSON.stringify({
                '@type': 'Recipe',
                recipeIngredient: ['salt'],
                recipeInstructions: ['Season.'],
            })}</script>
        `;
        const res = parseJsonLdRecipe(html);
        expect(res).not.toBeNull();
        expect(res.ingredients).toEqual(['salt']);
    });

    it('returns null when JSON-LD exists but has no Recipe node', () => {
        const html = wrapScript({ '@type': 'Article', headline: 'Not a recipe' });
        expect(parseJsonLdRecipe(html)).toBeNull();
    });

    it('returns null when the page has no JSON-LD at all', () => {
        expect(parseJsonLdRecipe('<html><body><p>hi</p></body></html>')).toBeNull();
    });

    it('returns null for non-string input', () => {
        expect(parseJsonLdRecipe(null)).toBeNull();
        expect(parseJsonLdRecipe('')).toBeNull();
    });
});

describe('htmlToPlainText', () => {
    it('strips script and style blocks including their contents', () => {
        const html = '<html><head><script>alert("x")</script><style>.a{}</style></head><body>Hello <b>world</b></body></html>';
        expect(htmlToPlainText(html)).toBe('Hello world');
    });

    it('decodes common HTML entities', () => {
        expect(htmlToPlainText('<p>Tom &amp; Jerry&#39;s &quot;tea&quot;&nbsp;time</p>')).toBe(
            'Tom & Jerry\'s "tea" time',
        );
    });

    it('collapses whitespace', () => {
        expect(htmlToPlainText('<p>a\n\n\tb   c</p>')).toBe('a b c');
    });
});

describe('buildGeminiUrlBody', () => {
    it('asks for both ingredients and instructions arrays', () => {
        const body = buildGeminiUrlBody('some scraped text');
        expect(body.generationConfig.responseSchema.required).toEqual(['ingredients', 'instructions']);
        expect(body.contents[0].parts[0].text).toBe('some scraped text');
        expect(body.systemInstruction.parts[0].text).toMatch(/extracting a recipe/i);
    });
});

describe('URL_GEMINI_ENDPOINT', () => {
    it('uses the flash-lite preview model', () => {
        expect(URL_GEMINI_ENDPOINT).toMatch(/gemini-3\.1-flash-lite-preview/);
    });
});

describe('parseGeminiUrlResponse', () => {
    const wrap = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });

    it('returns both arrays cleaned', () => {
        const res = parseGeminiUrlResponse(
            wrap('{"ingredients":[" pork ","salt",""],"instructions":["Add pork."]}'),
        );
        expect(res.ingredients).toEqual(['pork', 'salt']);
        expect(res.instructions).toEqual(['Add pork.']);
    });

    it('throws when either array is missing', () => {
        expect(() => parseGeminiUrlResponse(wrap('{"ingredients":["a"]}'))).toThrow(/missing/i);
    });

    it('throws on malformed JSON', () => {
        expect(() => parseGeminiUrlResponse(wrap('not json'))).toThrow();
    });

    it('throws when there is no candidate text', () => {
        expect(() => parseGeminiUrlResponse({})).toThrow();
    });
});

describe('hostnameFromUrl', () => {
    it('strips leading www.', () => {
        expect(hostnameFromUrl('https://www.allrecipes.com/recipe/123')).toBe('allrecipes.com');
    });

    it('leaves non-www hosts alone', () => {
        expect(hostnameFromUrl('https://cooking.nytimes.com/recipes/1')).toBe('cooking.nytimes.com');
    });

    it('throws on garbage input', () => {
        expect(() => hostnameFromUrl('not a url')).toThrow();
    });
});

describe('parseJsonLdRecipe — CDATA handling', () => {
    it('parses JSON-LD wrapped in WordPress/Yoast CDATA markers', () => {
        const cdataHtml = `<html><head><script type="application/ld+json">// <![CDATA[
${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'CDATA Stew',
    recipeIngredient: ['beef', 'carrots'],
    recipeInstructions: [{ '@type': 'HowToStep', text: 'Brown the beef.' }],
})}
// ]]></script></head></html>`;
        const res = parseJsonLdRecipe(cdataHtml);
        expect(res).not.toBeNull();
        expect(res.title).toBe('CDATA Stew');
        expect(res.ingredients).toEqual(['beef', 'carrots']);
        expect(res.instructions).toEqual(['Brown the beef.']);
    });

    it('still handles non-CDATA JSON-LD after the CDATA fix', () => {
        const html = `<script type="application/ld+json">{"@type":"Recipe","recipeIngredient":["a"],"recipeInstructions":["Do it."]}</script>`;
        const res = parseJsonLdRecipe(html);
        expect(res).not.toBeNull();
        expect(res.ingredients).toEqual(['a']);
    });
});

describe('isCloudflareChallenge', () => {
    it('returns true for a Cloudflare "Just a moment" challenge page', () => {
        const cfHtml = '<html><head><title>Just a moment...</title></head><body><div id="challenge-platform"></div></body></html>';
        expect(isCloudflareChallenge(cfHtml)).toBe(true);
    });

    it('returns true for old-style cf-browser-verification page', () => {
        expect(isCloudflareChallenge('<div id="cf-browser-verification">Please wait</div>')).toBe(true);
    });

    it('returns true for the JS-required message', () => {
        expect(isCloudflareChallenge('<p>Enable JavaScript and cookies to continue</p>')).toBe(true);
    });

    it('returns false for a normal recipe page', () => {
        const normal = '<html><body><script type="application/ld+json">{"@type":"Recipe"}</script></body></html>';
        expect(isCloudflareChallenge(normal)).toBe(false);
    });

    it('returns false for non-string input', () => {
        expect(isCloudflareChallenge(null)).toBe(false);
    });
});

describe('buildGeminiUrlContextBody', () => {
    it('includes the url_context tool', () => {
        const body = buildGeminiUrlContextBody('https://www.allrecipes.com/recipe/123');
        expect(body.tools).toEqual([{ url_context: {} }]);
    });

    it('embeds the URL in the user prompt', () => {
        const body = buildGeminiUrlContextBody('https://www.allrecipes.com/recipe/123');
        expect(body.contents[0].parts[0].text).toContain('https://www.allrecipes.com/recipe/123');
    });

    it('does not use responseMimeType (incompatible with url_context)', () => {
        const body = buildGeminiUrlContextBody('https://example.com');
        expect(body.generationConfig?.responseMimeType).toBeUndefined();
    });
});

describe('parseGeminiUrlContextResponse', () => {
    const wrap = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });

    it('extracts JSON from a clean response', () => {
        const res = parseGeminiUrlContextResponse(
            wrap('{"ingredients":["1 lb pork","salt"],"instructions":["Add pork.","Season."]}'),
        );
        expect(res.ingredients).toEqual(['1 lb pork', 'salt']);
        expect(res.instructions).toEqual(['Add pork.', 'Season.']);
    });

    it('extracts JSON when model prepends prose', () => {
        const res = parseGeminiUrlContextResponse(
            wrap('Here is the recipe extracted from the page:\n\n{"ingredients":["flour"],"instructions":["Mix well."]}'),
        );
        expect(res.ingredients).toEqual(['flour']);
        expect(res.instructions).toEqual(['Mix well.']);
    });

    it('trims and drops empty entries', () => {
        const res = parseGeminiUrlContextResponse(
            wrap('{"ingredients":["  salt  ","","pepper"],"instructions":["Stir."]}'),
        );
        expect(res.ingredients).toEqual(['salt', 'pepper']);
    });

    it('throws when no JSON block found', () => {
        expect(() => parseGeminiUrlContextResponse(wrap('No recipe found on this page.'))).toThrow(/no JSON block/i);
    });

    it('throws when arrays are missing', () => {
        expect(() => parseGeminiUrlContextResponse(wrap('{"title":"Pasta"}'))).toThrow(/missing/i);
    });

    it('throws when there is no candidate text', () => {
        expect(() => parseGeminiUrlContextResponse({})).toThrow();
    });
});
