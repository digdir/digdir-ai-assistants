// User types
export interface User {
  email: string;
}

// Auth types
export interface LoginResponse {
  user: User;
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
  tags?: string[];
  created: number;
}

export interface Message {
  id: string;
  text: string;
  role: "user" | "assistant" | "system";
  tags?: string[];
  created: number;
  chunks?: MessageChunk[];
}

export interface MessageChunk {
  chunkId: string;
  docTitle: string;
  docNum: string;
  contentMarkdown?: string;
}

// Dataset types
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
  conversationId?: string;
  model?: string;
  rerankTopK?: number;
  contextTopK?: number;
  maxContextLength?: number;
  tenant?: string;
  datasetConfigKey?: string;
  runtimeConfigKey?: string;
  agentId?: string;
}

export interface RagResponse {
  answer: string;
  conversationId?: string;
  "conversation-id"?: string;
  model: string;
  chunksUsed?: RagChunk[];
  "chunks-used"?: RagChunk[];
}

export interface RagChunk {
  chunkId?: string;
  docTitle?: string;
  docNum?: string;
  contentMarkdown?: string;
  "chunk-id"?: string;
  "doc-title"?: string;
  "doc-num"?: string;
  "content-markdown"?: string;
}

export interface RagQueryResponse {
  answer: string;
  "conversation-id"?: string;
  conversationId?: string;
  model: string;
  "chunks-used"?: RagChunk[];
  chunksUsed?: RagChunk[];
}

export interface RetrieveRequest {
  query: string;
  tenant?: string;
  datasetConfigKey?: string;
}

export interface RetrieveResponse {
  datasetScope: {
    tenant: string;
    datasetConfigKey: string;
  };
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
  total?: number;
}

export interface ConversationResponse {
  conversation: Conversation;
  messages: Message[];
}

export interface DatasetsResponse {
  datasets: Dataset[];
}

export interface DatasetResponse {
  dataset: Dataset;
}

export interface ConfigNodesResponse {
  nodes: ConfigNode[];
}

export interface ResolveRuntimeConfigRequest {
  tenant?: string;
  nodeSlug?: string;
  agentId?: string;
  datasetId?: string;
  paths?: string[];
}

export interface ResolveDatasetConfigRequest {
  tenant?: string;
  nodeSlug?: string;
  datasetId?: string;
  paths?: string[];
}

export interface CreateConversationRequest {
  title?: string;
  entityId?: string;
  folder?: string;
  tags?: string[];
}

export interface UpdateConversationRequest {
  title?: string;
  folder?: string;
  tags?: string[];
}

// Error types
export interface ApiError {
  error: string;
  message?: string;
}
