import type { MessageChunk } from "@/types";

interface SuggestionsResult {
  cleanedText: string;
  suggestions: string[];
}

/**
 * Extracts follow-up suggestions from assistant response text.
 *
 * Primary: looks for a structured section (## Suggested questions, ### Follow-up, etc.)
 * and extracts bullet items from it, stripping the section from the displayed text.
 *
 * Fallback: generates suggestions from chunk titles if available.
 *
 * Returns at most 3 suggestions.
 */
export function extractSuggestions(
  text: string,
  chunks?: MessageChunk[]
): SuggestionsResult {
  // Try to find a structured suggestions section at the end of the text
  const sectionPattern =
    /\n(#{1,3}\s*(?:Suggested|Follow[- ]?up|Related)\s*(?:questions?|topics?)?)\s*\n([\s\S]*?)$/i;
  const sectionMatch = text.match(sectionPattern);

  if (sectionMatch) {
    const sectionContent = sectionMatch[2];
    const cleanedText = text.slice(0, sectionMatch.index).trimEnd();

    // Extract bullet items (- or * or numbered)
    const bulletPattern = /^[\s]*(?:[-*]|\d+[.)]) \s*(.+)/gm;
    const suggestions: string[] = [];
    let bulletMatch;
    while (
      (bulletMatch = bulletPattern.exec(sectionContent)) !== null &&
      suggestions.length < 3
    ) {
      const suggestion = bulletMatch[1].trim().replace(/[*_`]/g, "");
      if (suggestion.length > 0) {
        suggestions.push(suggestion);
      }
    }

    if (suggestions.length > 0) {
      return { cleanedText, suggestions };
    }
  }

  // Fallback: generate from chunk titles
  if (chunks && chunks.length > 0) {
    const seen = new Set<string>();
    const suggestions: string[] = [];

    for (const chunk of chunks) {
      if (chunk.docTitle && !seen.has(chunk.docTitle) && suggestions.length < 3) {
        seen.add(chunk.docTitle);
        suggestions.push(`Tell me more about ${chunk.docTitle}`);
      }
    }

    return { cleanedText: text, suggestions };
  }

  return { cleanedText: text, suggestions: [] };
}
