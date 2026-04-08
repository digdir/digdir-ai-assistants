interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export function SuggestionChips({ suggestions, onSelect }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {suggestions.map((suggestion, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(suggestion)}
          className="border border-primary/30 text-primary rounded-full px-3 py-1.5 text-sm hover:bg-primary/10 transition-colors text-left"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
