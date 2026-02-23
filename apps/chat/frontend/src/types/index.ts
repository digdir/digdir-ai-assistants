// User types
export interface User {
  email: string;
}

// Auth types
export interface LoginResponse {
  user: User;
  sessionId: string;
}

export interface MeResponse {
  user: User;
}

// Conversation types
export interface Conversation {
  id: string;
  topic: string;
  entityId: string;
  userId: string;
  folder?: string;
  created: number;
}

export interface Message {
  id: string;
  text: string;
  role: "user" | "assistant" | "system";
  created: number;
  chunks?: MessageChunk[];
}

export interface MessageChunk {
  chunkId: string;
  docTitle: string;
  docNum: string;
  contentMarkdown?: string;
}

// RAG types
export interface RagRequest {
  query: string;
  conversationId?: string;
  model?: string;
  rerankTopK?: number;
  contextTopK?: number;
  maxContextLength?: number;
}

export interface RagResponse {
  answer: string;
  conversationId: string;
  model: string;
  chunksUsed: Array<{
    chunkId: string;
    docTitle: string;
    docNum: string;
    contentMarkdown?: string;
  }>;
}

// Filter types
export interface Filter {
  field: string;
  selectedOptions: string[];
}

export interface FilterOption {
  value: string;
  count: number;
  selected: boolean;
}

export interface FilterField {
  field: string;
  options: FilterOption[];
}

// API response types
export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface ConversationResponse {
  conversation: Conversation;
  messages: Message[];
}

export interface CreateConversationRequest {
  title?: string;
  entityId?: string;
  folder?: string;
}

export interface UpdateConversationRequest {
  title?: string;
  folder?: string;
}

// Error types
export interface ApiError {
  error: string;
  message?: string;
}
