interface FuzzyMatch {
  score: number;
  indices: number[];
}

export function fuzzySearch(query: string, target: string): FuzzyMatch | null {
  if (!query) return { score: 0, indices: [] };

  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  let queryIdx = 0;
  let score = 0;
  let prevMatchIdx = -2;
  const indices: number[] = [];

  for (let i = 0; i < targetLower.length && queryIdx < queryLower.length; i++) {
    if (targetLower[i] === queryLower[queryIdx]) {
      indices.push(i);

      // Consecutive matches score higher
      if (prevMatchIdx === i - 1) {
        score += 10;
      }

      // Match at start of word scores higher
      if (i === 0 || target[i - 1] === ' ' || target[i - 1] === '-' || target[i - 1] === '_') {
        score += 5;
      }

      // Exact case match scores higher
      if (target[i] === query[queryIdx]) {
        score += 1;
      }

      prevMatchIdx = i;
      queryIdx++;
    }
  }

  // All query characters must match
  if (queryIdx !== queryLower.length) return null;

  // Prefer shorter targets (tighter match)
  score += Math.max(0, 20 - (targetLower.length - queryLower.length));

  return { score, indices };
}

export function filterCommands<T extends { label: string; keywords?: string[] }>(
  query: string,
  items: T[]
): T[] {
  if (!query.trim()) return items;

  const scored = items
    .map((item) => {
      const labelMatch = fuzzySearch(query, item.label);
      const keywordMatch = item.keywords?.reduce<FuzzyMatch | null>((best, keyword) => {
        const match = fuzzySearch(query, keyword);
        if (!best || (match && match.score > best.score)) return match;
        return best;
      }, null);

      if (labelMatch && keywordMatch) {
        return { item, score: labelMatch.score + keywordMatch.score };
      }
      if (labelMatch) return { item, score: labelMatch.score };
      if (keywordMatch) return { item, score: keywordMatch.score };
      return null;
    })
    .filter(Boolean) as { item: T; score: number }[];

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
