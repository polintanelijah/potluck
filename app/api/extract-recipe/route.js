import { getSupabaseServer } from '@/lib/supabase-server';
import { extractRecipe } from '@/lib/extract-recipe';

export async function POST(request) {
    const supabase = await getSupabaseServer();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { url } = body;

    if (!url || typeof url !== 'string') {
        return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    // Basic URL validation
    let parsed;
    try {
        parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Invalid protocol');
        }
    } catch {
        return Response.json({ error: 'Invalid URL' }, { status: 400 });
    }

    let extracted;
    try {
        extracted = await extractRecipe(url);
    } catch (err) {
        return Response.json(
            { error: `Failed to extract recipe: ${err.message}` },
            { status: 422 }
        );
    }

    const { data: recipe, error: insertError } = await supabase
        .from('recipes')
        .insert({
            title: extracted.title || 'Untitled Recipe',
            description: extracted.description,
            url,
            source_site: extracted.source_site,
            image_url: extracted.image_url,
            extracted_data: extracted.extracted_data,
            created_by: user.id,
        })
        .select()
        .single();

    if (insertError) {
        return Response.json(
            { error: `Failed to save recipe: ${insertError.message}` },
            { status: 500 }
        );
    }

    return Response.json({ recipe });
}
