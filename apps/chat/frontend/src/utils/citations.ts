/**
 * Transforms citation markers [N] in text into markdown links [N](citation:N-1)
 * so ReactMarkdown renders them as <a> elements that we intercept as CitationMarker components.
 *
 * Only transforms [N] where N is within the range of available chunks.
 * Does NOT transform markdown links [text](url) or reference definitions [1]: url.
 */
export function processCitations(text: string, chunkCount: number): string {
  if (chunkCount === 0) return text;

  return text.replace(/\[(\d+)\](?!\(|:)/g, (match, numStr) => {
    const num = parseInt(numStr, 10);
    if (num < 1 || num > chunkCount) return match;
    return `[${num}](citation:${num - 1})`;
  });
}
