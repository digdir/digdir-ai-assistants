import { useState } from "react";
import { useConversations, useCreateConversation, useDeleteConversation } from "@/hooks/useConversations";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { apiClient } from "@/api/client";

export function Sidebar() {
  const { data: conversationsData, isLoading } = useConversations();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const { activeConversationId, setActiveConversationId } = useUIStore();
  const { logout } = useAuthStore();
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
    apiClient.logout();
    logout();
  };

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Conversations</h2>
        <button
          onClick={handleNewChat}
          disabled={createConversation.isPending}
          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createConversation.isPending ? "Creating..." : "+ New Chat"}
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? "No conversations found" : "No conversations yet"}
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
                      {conversation.topic || "New Conversation"}
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
                    title="Delete conversation"
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

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 truncate flex-1">
            {apiClient.getUserEmail() || "User"}
          </div>
          <button
            onClick={handleLogout}
            className="ml-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
