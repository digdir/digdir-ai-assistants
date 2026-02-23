import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MessageChunk } from "@/types";

interface ChunksSidebarProps {
  chunks: MessageChunk[];
}

export function ChunksSidebar({ chunks }: ChunksSidebarProps) {
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);

  if (chunks.length === 0) {
    return null;
  }

  const toggleChunk = (chunkId: string) => {
    setExpandedChunkId(expandedChunkId === chunkId ? null : chunkId);
  };

  return (
    <div className="w-96 bg-gray-50 border-l border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Sources ({chunks.length})
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Chunks used to generate the answer
        </p>
      </div>

      {/* Chunks List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chunks.map((chunk, idx) => (
          <div
            key={chunk.chunkId || idx}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* Chunk Header - Always visible */}
            <button
              onClick={() => toggleChunk(chunk.chunkId)}
              className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">
                    {chunk.docTitle || "Untitled Document"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Document: {chunk.docNum || "N/A"}
                  </div>
                  {chunk.chunkId && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
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
