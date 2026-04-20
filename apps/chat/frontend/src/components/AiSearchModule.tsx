import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { apiClient } from "@/api/client";
import { useUpdateConversation } from "@/hooks/useConversations";
import { useUIStore } from "@/stores/ui";
import { CodeBlock } from "./CodeBlock";
import { CitationMarker } from "./CitationMarker";
import { processCitations } from "@/utils/citations";
import { AI_SEARCH_TAG, normalizeTags } from "@/utils/conversation-tags";
import { useTranslation } from "@/i18n";
import type { MessageChunk, RagChunk, RagQueryResponse } from "@/types";

/** Allow citation: scheme through ReactMarkdown's URL sanitizer */
function urlTransform(url: string): string {
  if (url.startsWith("citation:")) return url;
  return defaultUrlTransform(url);
}

type SearchChunk = MessageChunk;

type SearchResult = {
  query: string;
  answer: string;
  model: string;
  chunks: SearchChunk[];
};

const shouldTraceAiSearch =
  import.meta.env.DEV || import.meta.env.VITE_TRACE_AI_SEARCH === "1";

function readChunkText(chunk: RagChunk, camelKey: keyof RagChunk, kebabKey: keyof RagChunk): string | undefined {
  const value = chunk[camelKey] ?? chunk[kebabKey];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSearchChunks(response: RagQueryResponse): SearchChunk[] {
  const rawChunks = response["chunks-used"] ?? response.chunksUsed ?? [];

  return rawChunks.map((chunk, index) => ({
    chunkId: readChunkText(chunk, "chunkId", "chunk-id") ?? `source-${index + 1}`,
    docTitle: readChunkText(chunk, "docTitle", "doc-title") ?? "",
    docNum: readChunkText(chunk, "docNum", "doc-num") ?? "",
    contentMarkdown: readChunkText(chunk, "contentMarkdown", "content-markdown"),
  }));
}

function getResponseConversationId(response: RagQueryResponse): string | undefined {
  const conversationId = response.conversationId ?? response["conversation-id"];
  if (typeof conversationId !== "string") {
    return undefined;
  }

  const trimmed = conversationId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getAiSearchTraceSummary(response: RagQueryResponse): Record<string, unknown> {
  const rawChunks = response["chunks-used"] ?? response.chunksUsed ?? [];
  const firstChunk = rawChunks[0];

  return {
    responseKeys: Object.keys(response),
    conversationId: getResponseConversationId(response),
    chunkCount: rawChunks.length,
    firstChunkKeys:
      firstChunk && typeof firstChunk === "object" && !Array.isArray(firstChunk)
        ? Object.keys(firstChunk as Record<string, unknown>)
        : [],
    firstChunkSummary:
      firstChunk && typeof firstChunk === "object" && !Array.isArray(firstChunk)
        ? {
            chunkId: readChunkText(firstChunk as RagChunk, "chunkId", "chunk-id") ?? null,
            docTitle: readChunkText(firstChunk as RagChunk, "docTitle", "doc-title") ?? null,
            docNum: readChunkText(firstChunk as RagChunk, "docNum", "doc-num") ?? null,
            contentMarkdownLength:
              readChunkText(firstChunk as RagChunk, "contentMarkdown", "content-markdown")?.length ?? 0,
          }
        : null,
  };
}

function stripMarkdownPreview(content: string): string {
  const withoutImages = content.replace(/\!\[[^\]]*\]\([^)]+\)/g, "");
  const withoutLinks = withoutImages.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const withoutSyntax = withoutLinks
    .replace(/[#>*_`~]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (withoutSyntax.length <= 280) {
    return withoutSyntax;
  }

  return `${withoutSyntax.slice(0, 280).trimEnd()}…`;
}

function buildSearchTitle(query: string): string {
  const collapsed = query.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 80) {
    return collapsed;
  }

  return `${collapsed.slice(0, 77).trimEnd()}…`;
}

function SearchAnswerPanel({
  answer,
  chunks,
  loading,
  onCitationSelect,
}: {
  answer: string | null;
  chunks: SearchChunk[];
  loading: boolean;
  onCitationSelect: (index: number) => void;
}) {
  const { t } = useTranslation();
  const answerMarkdown = answer ? processCitations(answer, chunks.length) : "";

  const getMarkdownComponents = (sourceChunks: SearchChunk[]): any => ({
    code: CodeBlock,
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href?.startsWith("citation:")) {
        const index = parseInt(href.split(":")[1], 10);
        return (
          <CitationMarker
            index={index}
            chunks={sourceChunks}
            onSelect={onCitationSelect}
          />
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary-light"
        >
          {children}
        </a>
      );
    },
  });

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {t("search.answer")}
          </div>
          {!loading && answer && (
            <div className="text-xs text-slate-500">
              {t("search.basedOn", { count: chunks.length })}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading && !answer ? (
          <div className="space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        ) : answer ? (
          <div className="markdown-content text-sm text-slate-900">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              urlTransform={urlTransform}
              components={getMarkdownComponents(chunks)}
            >
              {answerMarkdown}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-sm text-slate-500">{t("search.empty")}</div>
        )}
      </div>
    </section>
  );
}

function SearchResultsPanel({
  chunks,
  activeIndex,
  expandedChunkId,
  onToggle,
  onCitationSelect,
}: {
  chunks: SearchChunk[];
  activeIndex: number | null;
  expandedChunkId: string | null;
  onToggle: (chunkId: string) => void;
  onCitationSelect: (index: number) => void;
}) {
  const { t } = useTranslation();
  const chunkRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (activeIndex === null) return;
    if (activeIndex < 0 || activeIndex >= chunks.length) return;

    const chunk = chunks[activeIndex];
    if (!chunk) return;

    const scrollTimer = window.setTimeout(() => {
      chunkRefs.current[activeIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);

    return () => {
      window.clearTimeout(scrollTimer);
    };
  }, [activeIndex, chunks]);

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {t("search.sources", { count: chunks.length })}
          </div>
          <div className="text-xs text-slate-500">
            {t("search.sourcesHint")}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {chunks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">
            {t("search.noSources")}
          </div>
        ) : (
          chunks.map((chunk, idx) => {
            const isExpanded = expandedChunkId === chunk.chunkId;
            const isHighlighted = activeIndex === idx;
            const preview = chunk.contentMarkdown
              ? stripMarkdownPreview(chunk.contentMarkdown)
              : "";

            return (
              <article
                key={chunk.chunkId || idx}
                ref={(el) => {
                  chunkRefs.current[idx] = el;
                }}
                className={`overflow-hidden rounded-xl border transition-all ${
                  isHighlighted
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-slate-200 bg-slate-50/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(chunk.chunkId)}
                  className="w-full px-3 py-3 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                          {idx + 1}
                        </span>
                        <span className="truncate text-sm font-medium text-slate-900">
                          {chunk.docTitle || t("search.untitledDocument")}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {t("search.document", {
                          value: chunk.docNum || t("search.na"),
                        })}
                      </div>
                      {chunk.chunkId && (
                        <div className="mt-0.5 truncate text-xs text-slate-400">
                          {t("search.chunkId", { value: chunk.chunkId })}
                        </div>
                      )}
                    </div>
                    <svg
                      className={`mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
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
                </button>

                <div className="border-t border-slate-200 bg-white px-3 py-3">
                  {chunk.contentMarkdown ? (
                    isExpanded ? (
                      <div className="markdown-content prose prose-sm max-w-none text-sm text-slate-800">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          urlTransform={urlTransform}
                          components={{
                            code: CodeBlock,
                            pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
                            a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
                              if (href?.startsWith("citation:")) {
                                const index = parseInt(href.split(":")[1], 10);
                                return (
                                  <CitationMarker
                                    index={index}
                                    chunks={chunks}
                                    onSelect={onCitationSelect}
                                  />
                                );
                              }

                              return (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline hover:text-primary-light"
                                >
                                  {children}
                                </a>
                              );
                            },
                          }}
                        >
                          {chunk.contentMarkdown}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="max-h-24 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {preview}
                      </p>
                    )
                  ) : (
                    <p className="text-sm italic text-slate-500">
                      {t("search.noContent")}
                    </p>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export function AiSearchModule() {
  const { t } = useTranslation();
  const updateConversation = useUpdateConversation();
  const { aiSearchOpen, setAiSearchOpen } = useUIStore();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedChunkIndex, setHighlightedChunkIndex] = useState<number | null>(null);
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const chunks = result?.chunks || [];

  useEffect(() => {
    if (!aiSearchOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAiSearchOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [aiSearchOpen, setAiSearchOpen]);

  const handleCitationSelect = (index: number) => {
    setHighlightedChunkIndex(index);
    const chunk = chunks[index];
    if (chunk) {
      setExpandedChunkId(chunk.chunkId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || isSearching) return;

    setError(null);
    setIsSearching(true);
    setHighlightedChunkIndex(null);

    try {
      const datasetScope = await apiClient.retrieve({ query: trimmedQuery });
      const response = await apiClient.query({
        query: trimmedQuery,
        tenant: datasetScope.datasetScope.tenant,
        datasetConfigKey: datasetScope.datasetScope.datasetConfigKey,
      });

      if (shouldTraceAiSearch) {
        console.debug("AI Search response trace", getAiSearchTraceSummary(response));
      }

      const nextResult: SearchResult = {
        query: trimmedQuery,
        answer: response.answer,
        model: response.model,
        chunks: normalizeSearchChunks(response),
      };

      setResult(nextResult);
      setExpandedChunkId(null);

      const conversationId = getResponseConversationId(response);
      if (conversationId) {
        void updateConversation.mutateAsync({
          id: conversationId,
          request: {
            title: buildSearchTitle(trimmedQuery),
            tags: normalizeTags([AI_SEARCH_TAG]),
          },
        }).catch((updateError) => {
          console.warn("Failed to tag AI search conversation:", updateError);
        });
      }
    } catch (err) {
      console.error("Failed to run AI search:", err);
      setError(err instanceof Error ? err.message : t("search.error"));
    } finally {
      setIsSearching(false);
    }
  };

  if (!aiSearchOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
        onMouseDown={() => setAiSearchOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("search.title")}
          className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  {t("search.title")}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {t("search.subtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiSearchOpen(false)}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label={t("sources.close")}
                title={t("sources.close")}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <form onSubmit={handleSubmit}>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("search.placeholder")}
                  aria-busy={isSearching}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || isSearching}
                  className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSearching ? t("search.loading") : t("search.submit")}
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="min-h-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r lg:p-5">
                <SearchAnswerPanel
                  answer={result?.answer || null}
                  chunks={chunks}
                  loading={isSearching}
                  onCitationSelect={handleCitationSelect}
                />
              </div>
              <div className="min-h-0 p-4 lg:p-5">
                <SearchResultsPanel
                  chunks={chunks}
                  activeIndex={highlightedChunkIndex}
                  expandedChunkId={expandedChunkId}
                  onToggle={(chunkId) => {
                    setExpandedChunkId((current) => (current === chunkId ? null : chunkId));
                  }}
                  onCitationSelect={handleCitationSelect}
                />
              </div>
            </div>
          </div>
        </div>
      </div>,
    document.body
  );
}
