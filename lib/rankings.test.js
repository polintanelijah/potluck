import { describe, it, expect } from 'vitest';
import {
  RANKING_BUCKETS,
  getBucketConfig,
  getBucketPriority,
  sortRankings,
  getBucketScore,
  normalizeRecipeText,
  formatRecipeTextList,
} from './rankings';

describe('RANKING_BUCKETS', () => {
  it('has three buckets in priority order', () => {
    expect(RANKING_BUCKETS).toHaveLength(3);
    expect(RANKING_BUCKETS.map((b) => b.id)).toEqual(['loved', 'fine', 'didnt_like']);
  });

  it('bucket score bands do not overlap at boundaries', () => {
    // loved: 7-10, fine: 4-7, didnt_like: 0-4
    // A last-place loved recipe should score >= first-place fine recipe
    expect(RANKING_BUCKETS[0].min).toBeGreaterThanOrEqual(RANKING_BUCKETS[1].max);
  });
});

describe('getBucketConfig', () => {
  it('returns correct config for each bucket', () => {
    expect(getBucketConfig('loved')).toMatchObject({ id: 'loved', min: 7, max: 10 });
    expect(getBucketConfig('fine')).toMatchObject({ id: 'fine', min: 4, max: 7 });
    expect(getBucketConfig('didnt_like')).toMatchObject({ id: 'didnt_like', min: 0, max: 4 });
  });

  it('falls back to loved for unknown bucket', () => {
    expect(getBucketConfig('unknown')).toMatchObject({ id: 'loved' });
  });
});

describe('getBucketPriority', () => {
  it('loved has highest priority (0)', () => {
    expect(getBucketPriority('loved')).toBe(0);
  });

  it('didnt_like has lowest priority (2)', () => {
    expect(getBucketPriority('didnt_like')).toBe(2);
  });
});

describe('sortRankings', () => {
  it('sorts by bucket priority first, then rank_position', () => {
    const rankings = [
      { bucket: 'fine', rank_position: 1 },
      { bucket: 'loved', rank_position: 2 },
      { bucket: 'loved', rank_position: 1 },
      { bucket: 'didnt_like', rank_position: 1 },
    ];
    const sorted = sortRankings(rankings);
    expect(sorted.map((r) => r.bucket)).toEqual(['loved', 'loved', 'fine', 'didnt_like']);
    expect(sorted[0].rank_position).toBe(1);
    expect(sorted[1].rank_position).toBe(2);
  });

  it('does not mutate the original array', () => {
    const rankings = [
      { bucket: 'fine', rank_position: 1 },
      { bucket: 'loved', rank_position: 1 },
    ];
    const sorted = sortRankings(rankings);
    expect(sorted).not.toBe(rankings);
    expect(rankings[0].bucket).toBe('fine');
  });
});

describe('getBucketScore', () => {
  it('returns max score for single item in bucket', () => {
    expect(getBucketScore('loved', 1, 1)).toBe('10.0');
    expect(getBucketScore('fine', 1, 1)).toBe('7.0');
    expect(getBucketScore('didnt_like', 1, 1)).toBe('4.0');
  });

  it('first position gets max score', () => {
    expect(getBucketScore('loved', 1, 5)).toBe('10.0');
  });

  it('last position gets min score', () => {
    expect(getBucketScore('loved', 5, 5)).toBe('7.0');
  });

  it('middle position gets midpoint score', () => {
    // 3 items in loved: positions 1,2,3
    // position 2 of 3: progress = 0.5, score = 10 - 3*0.5 = 8.5
    expect(getBucketScore('loved', 2, 3)).toBe('8.5');
  });

  it('loved scores are always >= fine scores', () => {
    const worstLoved = parseFloat(getBucketScore('loved', 10, 10));
    const bestFine = parseFloat(getBucketScore('fine', 1, 10));
    expect(worstLoved).toBeGreaterThanOrEqual(bestFine);
  });

  it('fine scores are always >= didnt_like scores', () => {
    const worstFine = parseFloat(getBucketScore('fine', 10, 10));
    const bestDidntLike = parseFloat(getBucketScore('didnt_like', 1, 10));
    expect(worstFine).toBeGreaterThanOrEqual(bestDidntLike);
  });
});

describe('normalizeRecipeText', () => {
  it('returns empty array for falsy values', () => {
    expect(normalizeRecipeText(null)).toEqual([]);
    expect(normalizeRecipeText(undefined)).toEqual([]);
    expect(normalizeRecipeText('')).toEqual([]);
  });

  it('returns arrays as-is', () => {
    const arr = [{ text: 'chop onions' }];
    expect(normalizeRecipeText(arr)).toBe(arr);
  });

  it('splits string by newlines into text objects', () => {
    const result = normalizeRecipeText('1 cup flour\n2 eggs\n3 tbsp sugar');
    expect(result).toEqual([
      { text: '1 cup flour' },
      { text: '2 eggs' },
      { text: '3 tbsp sugar' },
    ]);
  });

  it('trims whitespace and filters empty lines', () => {
    const result = normalizeRecipeText('  flour  \n\n  sugar  \n');
    expect(result).toEqual([{ text: 'flour' }, { text: 'sugar' }]);
  });

  it('handles Windows-style line endings', () => {
    const result = normalizeRecipeText('flour\r\nsugar');
    expect(result).toEqual([{ text: 'flour' }, { text: 'sugar' }]);
  });

  it('returns empty array for non-string non-array values', () => {
    expect(normalizeRecipeText(42)).toEqual([]);
    expect(normalizeRecipeText({})).toEqual([]);
  });
});

describe('formatRecipeTextList', () => {
  it('extracts text strings from normalized recipe data', () => {
    const result = formatRecipeTextList('flour\nsugar\nbutter');
    expect(result).toEqual(['flour', 'sugar', 'butter']);
  });

  it('filters out items with empty text', () => {
    const result = formatRecipeTextList([{ text: 'flour' }, { text: '' }, { text: 'sugar' }]);
    expect(result).toEqual(['flour', 'sugar']);
  });

  it('handles falsy input', () => {
    expect(formatRecipeTextList(null)).toEqual([]);
  });
});
