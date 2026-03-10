import * as cheerio from 'cheerio';

const USER_AGENT =
    'Mozilla/5.0 (compatible; Potluck/1.0; +https://potluck.app)';

/**
 * Fetch a URL and extract recipe metadata server-side.
 * Returns { title, description, image_url, source_site, extracted_data }.
 */
export async function extractRecipe(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch URL (${res.status})`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const hostname = new URL(url).hostname.replace(/^www\./, '');

    // 1. Try JSON-LD structured data (most recipe sites use this)
    const jsonLd = extractJsonLd($);

    // 2. Fall back to Open Graph + meta tags
    const og = extractOpenGraph($);

    const title = jsonLd.name || og.title || $('title').text().trim() || null;
    const description =
        jsonLd.description || og.description || null;
    const image_url =
        jsonLd.image || og.image || null;

    // Build the full extracted_data blob for the JSONB column
    const extracted_data = {};

    if (jsonLd.name) extracted_data.name = jsonLd.name;
    if (jsonLd.description) extracted_data.description = jsonLd.description;
    if (jsonLd.image) extracted_data.image = jsonLd.image;
    if (jsonLd.ingredients) extracted_data.ingredients = jsonLd.ingredients;
    if (jsonLd.instructions) extracted_data.instructions = jsonLd.instructions;
    if (jsonLd.cookTime) extracted_data.cookTime = jsonLd.cookTime;
    if (jsonLd.prepTime) extracted_data.prepTime = jsonLd.prepTime;
    if (jsonLd.totalTime) extracted_data.totalTime = jsonLd.totalTime;
    if (jsonLd.servings) extracted_data.servings = jsonLd.servings;
    if (jsonLd.nutrition) extracted_data.nutrition = jsonLd.nutrition;
    if (jsonLd.author) extracted_data.author = jsonLd.author;
    if (jsonLd.category) extracted_data.category = jsonLd.category;
    if (jsonLd.cuisine) extracted_data.cuisine = jsonLd.cuisine;

    // Include OG data as fallback context
    if (!jsonLd.name && og.title) extracted_data.og_title = og.title;
    if (!jsonLd.description && og.description)
        extracted_data.og_description = og.description;
    if (!jsonLd.image && og.image) extracted_data.og_image = og.image;

    return {
        title,
        description,
        image_url,
        source_site: hostname,
        extracted_data,
    };
}

/**
 * Parse all <script type="application/ld+json"> blocks and find a Recipe.
 */
function extractJsonLd($) {
    const result = {};

    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const data = JSON.parse($(el).html());
            const recipe = findRecipeInLd(data);
            if (recipe) {
                result.name = recipe.name || null;
                result.description = recipe.description || null;
                result.image = normalizeImage(recipe.image);
                result.ingredients = recipe.recipeIngredient || null;
                result.instructions = normalizeInstructions(
                    recipe.recipeInstructions
                );
                result.cookTime = recipe.cookTime || null;
                result.prepTime = recipe.prepTime || null;
                result.totalTime = recipe.totalTime || null;
                result.servings = recipe.recipeYield || null;
                result.nutrition = recipe.nutrition || null;
                result.author = normalizeAuthor(recipe.author);
                result.category = recipe.recipeCategory || null;
                result.cuisine = recipe.recipeCuisine || null;
            }
        } catch {
            // Malformed JSON-LD — skip
        }
    });

    return result;
}

/**
 * Recursively search for a Recipe @type in JSON-LD (handles @graph arrays).
 */
function findRecipeInLd(data) {
    if (!data) return null;

    if (Array.isArray(data)) {
        for (const item of data) {
            const found = findRecipeInLd(item);
            if (found) return found;
        }
        return null;
    }

    const type = data['@type'];
    if (
        type === 'Recipe' ||
        (Array.isArray(type) && type.includes('Recipe'))
    ) {
        return data;
    }

    if (data['@graph']) {
        return findRecipeInLd(data['@graph']);
    }

    return null;
}

/**
 * Extract Open Graph and meta description.
 */
function extractOpenGraph($) {
    return {
        title:
            $('meta[property="og:title"]').attr('content') ||
            $('meta[name="title"]').attr('content') ||
            null,
        description:
            $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            null,
        image:
            $('meta[property="og:image"]').attr('content') || null,
    };
}

/**
 * Normalize the image field — JSON-LD image can be a string, array, or object.
 */
function normalizeImage(image) {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) return image[0]?.url || image[0] || null;
    if (image.url) return image.url;
    return null;
}

/**
 * Normalize recipeInstructions — can be strings, HowToStep objects, or HowToSection arrays.
 */
function normalizeInstructions(instructions) {
    if (!instructions) return null;
    if (typeof instructions === 'string') return [instructions];

    if (Array.isArray(instructions)) {
        return instructions.flatMap((item) => {
            if (typeof item === 'string') return item;
            if (item.text) return item.text;
            if (item.itemListElement) {
                return item.itemListElement.map((sub) => sub.text || sub);
            }
            return [];
        });
    }

    return null;
}

/**
 * Normalize author — can be a string, object, or array.
 */
function normalizeAuthor(author) {
    if (!author) return null;
    if (typeof author === 'string') return author;
    if (Array.isArray(author)) return author.map((a) => a.name || a).join(', ');
    if (author.name) return author.name;
    return null;
}
