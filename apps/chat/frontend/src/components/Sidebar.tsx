import { useState } from "react";
import { useConversations, useCreateConversation, useDeleteConversation } from "@/hooks/useConversations";
import { useLogout } from "@/hooks/useAuth";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { useTranslation } from "@/i18n";
import type { Locale } from "@/i18n";

export function Sidebar() {
  const { t, locale, setLocale } = useTranslation();
  const { data: conversationsData, isLoading } = useConversations();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const { activeConversationId, setActiveConversationId, leftSidebarOpen, toggleLeftSidebar } =
    useUIStore();
  const { user } = useAuthStore();
  const logoutMutation = useLogout();
  const [searchQuery, setSearchQuery] = useState("");

  const conversations = conversationsData || [];

  const filteredConversations = conversations.filter((conv) =>
    conv.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewChat = async () => {
    try {
      const conversation = await createConversation.mutateAsync({});
      setActiveConversationId(conversation.id);
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this conversation?")) {
      try {
        await deleteConversation.mutateAsync(id);
        if (activeConversationId === id) {
          setActiveConversationId(null);
        }
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (!leftSidebarOpen) {
    return (
      <div className="w-14 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-4 gap-3">
        <button
          onClick={handleNewChat}
          disabled={createConversation.isPending}
          className="p-2 text-primary hover:text-primary-dark hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t("sidebar.createNewChat")}
          title={createConversation.isPending ? t("sidebar.creatingChat") : t("sidebar.createNewChat")}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={toggleLeftSidebar}
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
          aria-label={t("sidebar.expandPanel")}
          title={t("sidebar.expandPanel")}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">{t("sidebar.conversations")}</h2>
          <button
            onClick={toggleLeftSidebar}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label={t("sidebar.collapsePanel")}
            title={t("sidebar.collapsePanel")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <button
          onClick={handleNewChat}
          disabled={createConversation.isPending}
          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createConversation.isPending ? t("sidebar.creating") : t("sidebar.newChat")}
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          placeholder={t("sidebar.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">{t("sidebar.loading")}</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? t("sidebar.noConversationsFound") : t("sidebar.noConversationsYet")}
          </div>
        ) : (
          <div className="p-2">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setActiveConversationId(conversation.id)}
                className={`
                  p-3 mb-1 rounded-lg cursor-pointer group relative
                  ${
                    activeConversationId === conversation.id
                      ? "bg-primary text-white"
                      : "hover:bg-gray-100 text-gray-900"
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {conversation.topic || t("chat.newConversation")}
                    </div>
                    {conversation.folder && (
                      <div
                        className={`text-xs mt-1 ${
                          activeConversationId === conversation.id
                            ? "text-white/70"
                            : "text-gray-500"
                        }`}
                      >
                        {conversation.folder}
                      </div>
                    )}
                    <div
                      className={`text-xs mt-1 ${
                        activeConversationId === conversation.id
                          ? "text-white/70"
                          : "text-gray-400"
                      }`}
                    >
                      {new Date(conversation.created).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(conversation.id, e)}
                    className={`
                      ml-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity
                      ${
                        activeConversationId === conversation.id
                          ? "hover:bg-white/20 text-white"
                          : "hover:bg-gray-200 text-gray-600"
                      }
                    `}
                    title={t("sidebar.deleteConversation")}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Language & User Info */}
      <div className="p-4 border-t border-gray-200 space-y-3">
        <div className="flex items-center gap-1 rounded-lg bg-gray-200 p-0.5">
          {(["en", "no"] as Locale[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLocale(lang)}
              className={`flex-1 text-xs py-1 rounded-md transition-colors ${
                locale === lang
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t(`language.${lang}` as const)}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 truncate flex-1">
            {user?.email || "User"}
          </div>
          <button
            onClick={handleLogout}
            className="ml-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            {t("sidebar.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
