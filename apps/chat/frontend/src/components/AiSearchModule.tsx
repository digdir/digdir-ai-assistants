import { useEffect, useRef, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { apiClient } from "@/api/client";
import { useUpdateConversation } from "@/hooks/useConversations";
import { CodeBlock } from "./CodeBlock";
import { CitationMarker } from "./CitationMarker";
import { processCitations } from "@/utils/citations";
import { AI_SEARCH_TAG, normalizeTags } from "@/utils/conversation-tags";
import { useTranslation } from "@/i18n";
import type { MessageChunk, RagQueryResponse } from "@/types";

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

function normalizeSearchChunks(response: RagQueryResponse): SearchChunk[] {
  return response["chunks-used"].map((chunk) => ({
    chunkId: chunk.chunkId,
    docTitle: chunk.docTitle,
    docNum: chunk.docNum,
    contentMarkdown: chunk.contentMarkdown,
  }));
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

export function AiSearchModule() {
  const { t } = useTranslation();
  const updateConversation = useUpdateConversation();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedChunkIndex, setHighlightedChunkIndex] = useState<number | null>(null);
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);
  const chunkRefs = useRef<(HTMLElement | null)[]>([]);

  const chunks = result?.chunks || [];

  const getMarkdownComponents = (sourceChunks: SearchChunk[], onCitationClick?: (index: number) => void): any => ({
    code: CodeBlock,
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href?.startsWith("citation:")) {
        const index = parseInt(href.split(":")[1], 10);
        return (
          <CitationMarker
            index={index}
            chunks={sourceChunks}
            onSelect={onCitationClick}
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
    chunkRefs.current = [];

    try {
      const datasetScope = await apiClient.retrieve({ query: trimmedQuery });
      const response = await apiClient.query({
        query: trimmedQuery,
        tenant: datasetScope.datasetScope.tenant,
        datasetConfigKey: datasetScope.datasetScope.datasetConfigKey,
      });
      const nextResult: SearchResult = {
        query: trimmedQuery,
        answer: response.answer,
        model: response.model,
        chunks: normalizeSearchChunks(response),
      };

      setResult(nextResult);
      setExpandedChunkId(null);

      void updateConversation.mutateAsync({
        id: response["conversation-id"],
        request: {
          title: buildSearchTitle(trimmedQuery),
          tags: normalizeTags([AI_SEARCH_TAG]),
        },
      }).catch((updateError) => {
        console.warn("Failed to tag AI search conversation:", updateError);
      });
    } catch (err) {
      console.error("Failed to run AI search:", err);
      setError(err instanceof Error ? err.message : t("search.error"));
    } finally {
      setIsSearching(false);
    }
  };

  const handleToggleChunk = (chunkId: string) => {
    setExpandedChunkId((current) => (current === chunkId ? null : chunkId));
  };

  useEffect(() => {
    if (highlightedChunkIndex === null) return;
    const chunk = chunks[highlightedChunkIndex];
    if (!chunk) return;

    setExpandedChunkId(chunk.chunkId);

    const scrollTimer = window.setTimeout(() => {
      chunkRefs.current[highlightedChunkIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);

    return () => {
      window.clearTimeout(scrollTimer);
    };
  }, [chunks, highlightedChunkIndex]);

  const answerMarkdown = result ? processCitations(result.answer, chunks.length) : "";

  return (
    <section className="shrink-0 border-b border-gray-200 bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="px-4 py-4">
        <div className="mx-auto max-h-[48vh] max-w-4xl overflow-y-auto pr-1 md:max-h-[42vh]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                {t("search.title")}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {t("search.subtitle")}
              </p>
            </div>
            <div className="hidden sm:block text-right text-xs text-slate-500">
              {t("search.compactHint")}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-3">
            <div className="flex gap-2">
              <input
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

          {!result && !isSearching && !error && (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
              {t("search.empty")}
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {(result || isSearching) && (
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    {t("search.answer")}
                  </div>
                  {result && (
                    <div className="text-xs text-slate-500">
                      {t("search.basedOn", { count: chunks.length })}
                    </div>
                  )}
                </div>

                {isSearching && !result ? (
                  <div className="mt-3 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                  </div>
                ) : result ? (
                  <div className="markdown-content mt-3 text-sm text-slate-900">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      urlTransform={urlTransform}
                      components={getMarkdownComponents(chunks, handleCitationSelect)}
                    >
                      {answerMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : null}
              </div>

              {result && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                      {t("search.sources", { count: chunks.length })}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t("search.sourcesHint")}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {chunks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">
                        {t("search.noSources")}
                      </div>
                    ) : (
                      chunks.map((chunk, idx) => {
                        const isExpanded = expandedChunkId === chunk.chunkId;
                        const isHighlighted = highlightedChunkIndex === idx;
                        const preview = chunk.contentMarkdown ? stripMarkdownPreview(chunk.contentMarkdown) : "";

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
                              onClick={() => handleToggleChunk(chunk.chunkId)}
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
                                    {t("search.document", { value: chunk.docNum || t("search.na") })}
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
                                      components={getMarkdownComponents(chunks, handleCitationSelect)}
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
