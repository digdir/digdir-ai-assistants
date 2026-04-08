import { useState, useRef, useEffect } from "react";
import { useConversation, conversationKeys } from "@/hooks/useConversations";
import { useUIStore } from "@/stores/ui";
import { apiClient } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { CodeBlock } from "./CodeBlock";
import { CitationMarker } from "./CitationMarker";
import { SuggestionChips } from "./SuggestionChips";
import { processCitations } from "@/utils/citations";
import { extractSuggestions } from "@/utils/suggestions";
import { useTranslation } from "@/i18n";
import type { MessageChunk } from "@/types";

/** Allow citation: scheme through ReactMarkdown's URL sanitizer */
function urlTransform(url: string): string {
  if (url.startsWith("citation:")) return url;
  return defaultUrlTransform(url);
}

export function ChatArea() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeConversationId, setActiveConversationId, setActiveChunks, setHighlightedChunkIndex } = useUIStore();
  const { data: conversationData, isLoading } = useConversation(activeConversationId || undefined);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsStrippedSuffix, setSuggestionsStrippedSuffix] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = conversationData?.messages || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getMarkdownComponents = (chunks?: MessageChunk[]): any => ({
    code: CodeBlock,
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href?.startsWith("citation:")) {
        const index = parseInt(href.split(":")[1], 10);
        return (
          <CitationMarker
            index={index}
            chunks={chunks || []}
          />
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary-light">
          {children}
        </a>
      );
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const sendQuery = async (query: string) => {
    if (!query || isStreaming) return;

    setInput("");
    setSuggestions([]);
    setSuggestionsStrippedSuffix(null);
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      const { conversationId: returnedConversationId } = await apiClient.sendMessage(
        {
          query,
          conversationId: activeConversationId || undefined,
        },
        (chunk) => {
          setStreamingMessage((prev) => prev + chunk);
        }
      );

      // Extract suggestions from the completed streaming text (text-based only;
      // chunks aren't available until after refetch)
      setStreamingMessage((prev) => {
        const { cleanedText, suggestions: extracted } = extractSuggestions(prev);
        setSuggestions(extracted);
        if (cleanedText !== prev) {
          setSuggestionsStrippedSuffix(prev.slice(cleanedText.length));
        }
        return prev;
      });

      setStreamingMessage("");
      setIsStreaming(false);

      // If we didn't have a conversation ID but got one back, set it as active
      if (!activeConversationId && returnedConversationId) {
        setActiveConversationId(returnedConversationId);
      }

      // Refetch the conversation to get the new messages
      const conversationIdToRefetch = activeConversationId || returnedConversationId;
      if (conversationIdToRefetch) {
        queryClient.invalidateQueries({
          queryKey: conversationKeys.detail(conversationIdToRefetch),
        });
      }

      // Refetch the conversations list (in case the topic changed or new conversation was created)
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setStreamingMessage("");
      setIsStreaming(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    sendQuery(input.trim());
  };

  const handleRetry = (messageId: string) => {
    if (isStreaming) return;

    // Find the preceding user message
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex < 1) return;

    const userMessage = messages
      .slice(0, messageIndex)
      .reverse()
      .find((m) => m.role === "user");
    if (!userMessage) return;

    sendQuery(userMessage.text);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendQuery(suggestion);
  };

  const handleViewSources = (chunks: MessageChunk[]) => {
    setHighlightedChunkIndex(null);
    setActiveChunks(chunks);
  };

  const visibleMessages = messages.filter((m) => m.role !== "system");

  /**
   * Get the display text for a message, stripping the suggestions section
   * from the last assistant message when suggestions are active.
   */
  const getMessageText = (message: typeof messages[number], idx: number): string => {
    if (
      message.role === "assistant" &&
      suggestions.length > 0 &&
      suggestionsStrippedSuffix &&
      idx === visibleMessages.length - 1 &&
      message.text.endsWith(suggestionsStrippedSuffix)
    ) {
      return message.text.slice(0, message.text.length - suggestionsStrippedSuffix.length).trimEnd();
    }
    return message.text;
  };

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {t("welcome.title")}
          </h1>
          <p className="text-gray-600 mb-8">
            {t("welcome.subtitle")}
          </p>
          <div className="text-sm text-gray-500">
            <p>{t("welcome.sidebarHint")}</p>
            <ul className="mt-2 space-y-1 text-left ml-8">
              <li>• {t("welcome.createConversation")}</li>
              <li>• {t("welcome.browseHistory")}</li>
              <li>• {t("welcome.searchPast")}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {conversationData?.conversation?.topic || t("chat.newConversation")}
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">{t("chat.loadingMessages")}</div>
        ) : visibleMessages.length === 0 && !streamingMessage && !isStreaming ? (
          <div className="text-center text-gray-500 py-8">
            {t("chat.noMessages")}
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {visibleMessages.map((message, idx) => {
              const displayText = getMessageText(message, idx);
              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {message.role === "user" ? (
                      <div className="whitespace-pre-wrap">{message.text}</div>
                    ) : (
                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          urlTransform={urlTransform}
                          components={getMarkdownComponents(message.chunks)}
                        >
                          {message.chunks && message.chunks.length > 0
                            ? processCitations(displayText, message.chunks.length)
                            : displayText}
                        </ReactMarkdown>
                      </div>
                    )}
                    {message.role === "assistant" && (
                      <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-3 text-xs">
                        {message.chunks && message.chunks.length > 0 && (
                          <button
                            onClick={() => handleViewSources(message.chunks || [])}
                            className="font-medium text-primary hover:text-primary-dark underline cursor-pointer"
                          >
                            {t("chat.viewSources", { count: message.chunks.length })}
                          </button>
                        )}
                        <button
                          onClick={() => handleRetry(message.id)}
                          disabled={isStreaming}
                          className="flex items-center gap-1 text-gray-500 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {t("chat.retry")}
                        </button>
                      </div>
                    )}
                    <div
                      className={`text-xs mt-1 ${
                        message.role === "user" ? "text-white/70" : "text-gray-500"
                      }`}
                    >
                      {new Date(message.created).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Waiting indicator — shown after send, before first token arrives */}
            {isStreaming && !streamingMessage && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100 text-gray-900">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            {streamingMessage && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100 text-gray-900">
                  <div className="markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      urlTransform={urlTransform}
                      components={getMarkdownComponents()}
                    >
                      {streamingMessage}
                    </ReactMarkdown>
                  </div>
                  <div className="text-xs mt-1 text-gray-500">{t("chat.streaming")}</div>
                </div>
              </div>
            )}

            {!isStreaming && suggestions.length > 0 && (
              <SuggestionChips
                suggestions={suggestions}
                onSelect={handleSuggestionClick}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("chat.placeholder")}
              disabled={isStreaming}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStreaming ? t("chat.sending") : t("chat.send")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
