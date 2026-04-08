import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUIStore } from "@/stores/ui";
import type { MessageChunk } from "@/types";

interface ChunksSidebarProps {
  chunks: MessageChunk[];
}

export function ChunksSidebar({ chunks }: ChunksSidebarProps) {
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);
  const { highlightedChunkIndex, setHighlightedChunkIndex, setRightSidebarOpen } = useUIStore();
  const chunkRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Handle citation click -> auto-expand and scroll to highlighted chunk
  useEffect(() => {
    if (highlightedChunkIndex === null) return;
    if (highlightedChunkIndex < 0 || highlightedChunkIndex >= chunks.length) return;

    const chunk = chunks[highlightedChunkIndex];
    if (chunk) {
      setExpandedChunkId(chunk.chunkId);
    }

    // Scroll into view after a brief delay to allow expansion
    const scrollTimer = setTimeout(() => {
      chunkRefs.current[highlightedChunkIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);

    // Clear highlight after 3 seconds
    const clearTimer = setTimeout(() => {
      setHighlightedChunkIndex(null);
    }, 3000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightedChunkIndex, chunks, setHighlightedChunkIndex]);

  if (chunks.length === 0) {
    return null;
  }

  const toggleChunk = (chunkId: string) => {
    setExpandedChunkId(expandedChunkId === chunkId ? null : chunkId);
  };

  return (
    <div className="w-96 bg-gray-50 border-l border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Sources ({chunks.length})
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Chunks used to generate the answer
          </p>
        </div>
        <button
          onClick={() => { setHighlightedChunkIndex(null); setRightSidebarOpen(false); }}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close sources panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Chunks List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chunks.map((chunk, idx) => (
          <div
            key={chunk.chunkId || idx}
            ref={(el) => { chunkRefs.current[idx] = el; }}
            className={`bg-white border rounded-lg overflow-hidden transition-all ${
              highlightedChunkIndex === idx
                ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                : "border-gray-200"
            }`}
          >
            {/* Chunk Header - Always visible */}
            <button
              onClick={() => toggleChunk(chunk.chunkId)}
              className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-semibold bg-primary/10 text-primary rounded-full">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {chunk.docTitle || "Untitled Document"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 ml-7">
                    Document: {chunk.docNum || "N/A"}
                  </div>
                  {chunk.chunkId && (
                    <div className="text-xs text-gray-400 mt-0.5 ml-7 truncate">
                      Chunk ID: {chunk.chunkId}
                    </div>
                  )}
                </div>
                <div className="ml-2 flex-shrink-0">
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedChunkId === chunk.chunkId ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </button>

            {/* Chunk Content - Expandable */}
            {expandedChunkId === chunk.chunkId && chunk.contentMarkdown && (
              <div className="border-t border-gray-200 p-3 bg-gray-50">
                <div className="text-xs text-gray-700 prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {chunk.contentMarkdown}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Show message if no content available */}
            {expandedChunkId === chunk.chunkId && !chunk.contentMarkdown && (
              <div className="border-t border-gray-200 p-3 bg-gray-50 text-xs text-gray-500 italic">
                Content not available
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
