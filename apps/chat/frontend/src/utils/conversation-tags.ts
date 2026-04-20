export const AI_SEARCH_TAG = "ai-search";

export function normalizeTags(tags?: string[] | null): string[] {
  if (!tags || tags.length === 0) {
    return [];
  }

  const normalized = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return Array.from(new Set(normalized));
}

export function hasTag(tags: string[] | undefined, tag: string): boolean {
  return Boolean(tags?.includes(tag));
}
