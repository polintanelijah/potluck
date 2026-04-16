/**
 * POST /api/scrape-recipe
 *
 * Accepts { url } and returns extracted recipe data by parsing JSON-LD
 * structured data (schema.org/Recipe) from the target page.
 *
 * Returns: { title, ingredients, instructions, source_site, extracted_data }
 */

export async function POST(request) {
    try {
        const { url } = await request.json();

        if (!url || typeof url !== 'string') {
            return Response.json({ error: 'URL is required' }, { status: 400 });
        }

        // Validate URL format
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            return Response.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        // Fetch the page with a browser-like User-Agent
        let html;
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
                return Response.json(
                    { error: `Could not fetch URL (status ${res.status})` },
                    { status: 422 },
                );
            }

            html = await res.text();
        } catch (fetchErr) {
            const message =
                fetchErr.name === 'TimeoutError'
                    ? 'Request timed out — the site took too long to respond'
                    : 'Could not reach that URL';
            return Response.json({ error: message }, { status: 422 });
        }

        // Extract all JSON-LD script blocks
        const jsonLdBlocks = [];
        const scriptRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        while ((match = scriptRegex.exec(html)) !== null) {
            try {
                const parsed = JSON.parse(match[1]);
                jsonLdBlocks.push(parsed);
            } catch {
                // Skip malformed JSON-LD blocks
            }
        }

        // Find the Recipe object in JSON-LD
        const recipe = findRecipe(jsonLdBlocks);

        if (!recipe) {
            return Response.json(
                { error: 'No recipe data found on this page. You can enter the details manually.' },
                { status: 422 },
            );
        }

        // Map schema.org fields to our format
        const title = recipe.name || '';
        const ingredients = formatIngredients(recipe.recipeIngredient);
        const instructions = formatInstructions(recipe.recipeInstructions);
        const sourceSite = parsedUrl.hostname.replace(/^www\./, '');

        const extractedData = {};
        if (recipe.prepTime) extractedData.prep_time = formatDuration(recipe.prepTime);
        if (recipe.cookTime) extractedData.cook_time = formatDuration(recipe.cookTime);
        if (recipe.totalTime) extractedData.total_time = formatDuration(recipe.totalTime);
        if (recipe.recipeYield) {
            extractedData.servings = Array.isArray(recipe.recipeYield)
                ? recipe.recipeYield[0]
                : recipe.recipeYield;
        }
        if (recipe.nutrition && typeof recipe.nutrition === 'object') {
            const { '@type': _type, ...nutritionData } = recipe.nutrition;
            if (Object.keys(nutritionData).length > 0) {
                extractedData.nutrition = nutritionData;
            }
        }
        if (recipe.description) extractedData.description = recipe.description;

        // Get image URL
        if (recipe.image) {
            if (typeof recipe.image === 'string') {
                extractedData.image_url = recipe.image;
            } else if (Array.isArray(recipe.image) && recipe.image.length > 0) {
                extractedData.image_url =
                    typeof recipe.image[0] === 'string' ? recipe.image[0] : recipe.image[0]?.url;
            } else if (recipe.image.url) {
                extractedData.image_url = recipe.image.url;
            }
        }

        return Response.json({
            title,
            ingredients,
            instructions,
            source_site: sourceSite,
            extracted_data: Object.keys(extractedData).length > 0 ? extractedData : null,
        });
    } catch (err) {
        console.error('Scrape recipe error:', err);
        return Response.json({ error: 'Something went wrong while extracting recipe data' }, { status: 500 });
    }
}

/**
 * Recursively search JSON-LD blocks for a Recipe object.
 * Handles top-level objects, arrays, and @graph patterns.
 */
function findRecipe(data) {
    if (!data) return null;

    if (Array.isArray(data)) {
        for (const item of data) {
            const found = findRecipe(item);
            if (found) return found;
        }
        return null;
    }

    if (typeof data === 'object') {
        const type = data['@type'];
        if (
            type === 'Recipe' ||
            (Array.isArray(type) && type.includes('Recipe'))
        ) {
            return data;
        }

        // Check @graph arrays (common pattern on many recipe sites)
        if (data['@graph']) {
            return findRecipe(data['@graph']);
        }
    }

    return null;
}

/**
 * Format recipeIngredient array to newline-separated text.
 */
function formatIngredients(ingredients) {
    if (!ingredients) return '';
    if (Array.isArray(ingredients)) {
        return ingredients.map((i) => (typeof i === 'string' ? i.trim() : '')).filter(Boolean).join('\n');
    }
    return String(ingredients);
}

/**
 * Format recipeInstructions to newline-separated text.
 * Handles HowToStep objects, HowToSection groups, and plain strings.
 */
function formatInstructions(instructions) {
    if (!instructions) return '';

    if (typeof instructions === 'string') return instructions;

    if (Array.isArray(instructions)) {
        const steps = [];
        for (const item of instructions) {
            if (typeof item === 'string') {
                steps.push(item.trim());
            } else if (item?.['@type'] === 'HowToStep') {
                steps.push((item.text || item.name || '').trim());
            } else if (item?.['@type'] === 'HowToSection') {
                // Section with sub-steps
                if (item.name) steps.push(`— ${item.name} —`);
                if (Array.isArray(item.itemListElement)) {
                    for (const subItem of item.itemListElement) {
                        if (typeof subItem === 'string') {
                            steps.push(subItem.trim());
                        } else {
                            steps.push((subItem.text || subItem.name || '').trim());
                        }
                    }
                }
            }
        }
        return steps.filter(Boolean).join('\n');
    }

    return String(instructions);
}

/**
 * Convert ISO 8601 duration (e.g. "PT1H30M") to a readable string.
 */
function formatDuration(isoDuration) {
    if (!isoDuration || typeof isoDuration !== 'string') return isoDuration;

    const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
    if (!match) return isoDuration;

    const parts = [];
    if (match[1]) parts.push(`${match[1]}h`);
    if (match[2]) parts.push(`${match[2]}m`);
    if (match[3]) parts.push(`${match[3]}s`);

    return parts.join(' ') || isoDuration;
}
