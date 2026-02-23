export interface Session {
  email: string;
  createdAt: number;
}

// User object
export interface User {
  email: string;
}

// Auth responses
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
  userId: string;
  title?: string;
  folder?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: {
    chunksUsed?: Array<{
      chunkId: string;
      docTitle: string;
      docNum: string;
      contentMarkdown?: string;
    }>;
    model?: string;
  };
  createdAt: string;
}

// RAG types
export interface RagRequest {
  query: string;
  "conversation-id"?: string;
  model?: string;
  "rerank-top-k"?: number;
  "context-top-k"?: number;
  "max-context-length"?: number;
}

export interface RagResponse {
  answer: string;
  "conversation-id": string;
  model: string;
  "chunks-used": Array<{
    "chunk-id": string;
    "doc-title": string;
    "doc-num": string;
    "content-markdown": string;
  }>;
}

// Filter types
export interface Filter {
  type: string;
  value: string;
}
