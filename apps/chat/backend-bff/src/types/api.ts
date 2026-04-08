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

export type DatasetStatus = "configured" | "running" | "ready" | "degraded" | string;

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  "enabled?": boolean;
  status?: DatasetStatus | string;
}

export type ConfigRoot = "platform" | "runtime" | "dataset";

export interface ConfigNode {
  tenant?: string;
  root?: ConfigRoot | string;
  id?: string;
  name?: string;
  "node-slug"?: string;
  [key: string]: unknown;
}

// RAG types
export interface RagRequest {
  query: string;
  "conversation-id"?: string;
  model?: string;
  "rerank-top-k"?: number;
  "context-top-k"?: number;
  "max-context-length"?: number;
  tenant?: string;
  "dataset-config-key"?: string;
  "runtime-config-key"?: string;
  "agent-id"?: string;
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

export interface RetrieveRequest {
  query: string;
  tenant?: string;
  "dataset-config-key"?: string;
}

export interface RetrieveResponse {
  "dataset-scope": {
    tenant: string;
    "dataset-config-key": string;
  };
}

// Filter types
export interface Filter {
  type: string;
  value: string;
}
