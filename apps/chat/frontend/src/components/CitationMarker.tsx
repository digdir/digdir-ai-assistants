import { useUIStore } from "@/stores/ui";
import { useTranslation } from "@/i18n";
import type { MessageChunk } from "@/types";

interface CitationMarkerProps {
  index: number;
  chunks: MessageChunk[];
  onSelect?: (index: number) => void;
  className?: string;
}

export function CitationMarker({ index, chunks, onSelect, className }: CitationMarkerProps) {
  const { t } = useTranslation();
  const { setActiveChunks, setHighlightedChunkIndex } = useUIStore();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onSelect) {
      onSelect(index);
      return;
    }
    setActiveChunks(chunks);
    setHighlightedChunkIndex(index);
  };

  const displayNum = index + 1;

  return (
    <sup>
      <button
        onClick={handleClick}
        className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-semibold bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors cursor-pointer ${
          className || ""
        }`}
        title={chunks[index]?.docTitle || t("citation.source", { num: displayNum })}
      >
        {displayNum}
      </button>
    </sup>
  );
}
