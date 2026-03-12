export const RANKING_BUCKETS = [
    { id: 'loved', label: 'Loved', min: 7, max: 10, priority: 0 },
    { id: 'fine', label: 'It was fine', min: 4, max: 7, priority: 1 },
    { id: 'didnt_like', label: "Didn't like it", min: 0, max: 4, priority: 2 },
];

export function getBucketConfig(bucketId) {
    return RANKING_BUCKETS.find((bucket) => bucket.id === bucketId) || RANKING_BUCKETS[0];
}

export function getBucketPriority(bucketId) {
    return getBucketConfig(bucketId).priority;
}

export function sortRankings(rankings) {
    return [...rankings].sort((a, b) => {
        const bucketDiff = getBucketPriority(a.bucket) - getBucketPriority(b.bucket);
        if (bucketDiff !== 0) return bucketDiff;
        return a.rank_position - b.rank_position;
    });
}

export function getBucketScore(bucketId, rankPosition, totalInBucket) {
    const bucket = getBucketConfig(bucketId);
    if (totalInBucket <= 1) return bucket.max.toFixed(1);

    const progress = (rankPosition - 1) / (totalInBucket - 1);
    const score = bucket.max - (bucket.max - bucket.min) * progress;
    return score.toFixed(1);
}

export function normalizeRecipeText(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        return value
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => ({ text: line }));
    }
    return [];
}

export function formatRecipeTextList(value) {
    return normalizeRecipeText(value).map((item) => item.text || '').filter(Boolean);
}
