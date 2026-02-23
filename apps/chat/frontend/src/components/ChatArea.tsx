import { useState, useRef, useEffect } from "react";
import { useConversation, conversationKeys } from "@/hooks/useConversations";
import { useUIStore } from "@/stores/ui";
import { apiClient } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export function ChatArea() {
  const queryClient = useQueryClient();
  const { activeConversationId, setActiveConversationId, setActiveChunks } = useUIStore();
  const { data: conversationData, isLoading } = useConversation(activeConversationId || undefined);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = conversationData?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const query = input.trim();
    setInput("");
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

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to Chat App
          </h1>
          <p className="text-gray-600 mb-8">
            Start a new conversation or select an existing one from the sidebar.
          </p>
          <div className="text-sm text-gray-500">
            <p>Use the sidebar to:</p>
            <ul className="mt-2 space-y-1 text-left ml-8">
              <li>• Create a new conversation</li>
              <li>• Browse your conversation history</li>
              <li>• Search through past conversations</li>
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
          {conversationData?.conversation?.topic || "New Conversation"}
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">Loading messages...</div>
        ) : messages.length === 0 && !streamingMessage ? (
          <div className="text-center text-gray-500 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((message) => (
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
                      >
                        {message.text}
                      </ReactMarkdown>
                    </div>
                  )}
                  {message.chunks && message.chunks.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
                      <button
                        onClick={() => setActiveChunks(message.chunks || [])}
                        className="font-medium mb-1 text-primary hover:text-primary-dark underline cursor-pointer"
                      >
                        View {message.chunks.length} source{message.chunks.length !== 1 ? 's' : ''} →
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
            ))}

            {streamingMessage && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100 text-gray-900">
                  <div className="markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {streamingMessage}
                    </ReactMarkdown>
                  </div>
                  <div className="text-xs mt-1 text-gray-500">Streaming...</div>
                </div>
              </div>
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
              placeholder="Type your message..."
              disabled={isStreaming}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStreaming ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
