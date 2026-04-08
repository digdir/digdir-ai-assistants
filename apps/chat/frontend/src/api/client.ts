import type {
  User,
  LoginResponse,
  MeResponse,
  Conversation,
  ConversationsResponse,
  ConversationResponse,
  CreateConversationRequest,
  UpdateConversationRequest,
  RagRequest,
  RetrieveRequest,
  RetrieveResponse,
  Dataset,
  DatasetsResponse,
  DatasetResponse,
  ConfigRoot,
  ConfigNode,
  ConfigNodesResponse,
  ResolveRuntimeConfigRequest,
  ResolveDatasetConfigRequest,
} from "@/types";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  private getDefaultCacheMode(endpoint: string): RequestCache | undefined {
    return endpoint.startsWith("/auth/") ? "no-store" : undefined;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private getErrorMessage(errorData: unknown, fallback: string): string {
    if (
      this.isObject(errorData) &&
      typeof errorData.error === "string"
    ) {
      return errorData.error;
    }

    return fallback;
  }

  private async handleErrorResponse(response: Response, fallbackMessage: string): Promise<never> {
    return await this.handleErrorResponseWithOptions(response, fallbackMessage, {
      redirectOnAuthFailure: true,
    });
  }

  private async handleErrorResponseWithOptions(
    response: Response,
    fallbackMessage: string,
    options: { redirectOnAuthFailure: boolean }
  ): Promise<never> {
    const errorData = await response.json().catch(() => ({}));
    const errorCode =
      this.isObject(errorData) && typeof errorData.code === "string"
        ? errorData.code
        : undefined;

    if (
      options.redirectOnAuthFailure &&
      response.status === 401 &&
      (errorCode === "SESSION_MISSING" || errorCode === "SESSION_INVALID")
    ) {
      window.location.href = "/login";
    }

    throw new Error(this.getErrorMessage(errorData, fallbackMessage));
  }

  private extractCollection<T>(data: unknown, key: string): T[] {
    if (Array.isArray(data)) {
      return data as T[];
    }

    if (this.isObject(data) && Array.isArray(data[key])) {
      return data[key] as T[];
    }

    throw new Error(`Invalid API response: expected ${key} collection`);
  }

  private extractResource<T>(data: unknown, key: string): T {
    if (this.isObject(data) && key in data) {
      return data[key] as T;
    }

    return data as T;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requestOptions: { redirectOnAuthFailure?: boolean } = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      cache: options.cache ?? this.getDefaultCacheMode(endpoint),
      credentials: "same-origin",
      headers,
    });

    if (!response.ok) {
      await this.handleErrorResponseWithOptions(
        response,
        `API error: ${response.statusText}`,
        {
          redirectOnAuthFailure: requestOptions.redirectOnAuthFailure ?? true,
        }
      );
    }

    return await response.json();
  }

  // ========== Auth ==========

  async login(email: string): Promise<User> {
    const data = await this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return data.user;
  }

  getSlackLoginUrl(): string {
    return `${this.baseUrl}/auth/slack/start`;
  }

  async logout(): Promise<void> {
    await this.request("/auth/logout", { method: "POST" });
  }

  async getMe(options: { redirectOnAuthFailure?: boolean } = {}): Promise<User> {
    const data = await this.request<MeResponse>("/auth/me", undefined, options);
    return data.user;
  }

  // ========== Conversations ==========

  async getConversations(): Promise<Conversation[]> {
    const data = await this.request<ConversationsResponse>("/api/conversations");
    return data.conversations;
  }

  async createConversation(
    request: CreateConversationRequest
  ): Promise<Conversation> {
    const data = await this.request<{ conversation: Conversation }>(
      "/api/conversations",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
    return data.conversation;
  }

  async getConversation(id: string): Promise<ConversationResponse> {
    return await this.request<ConversationResponse>(
      `/api/conversations/${id}`
    );
  }

  async updateConversation(
    id: string,
    request: UpdateConversationRequest
  ): Promise<Conversation> {
    const data = await this.request<{ conversation: Conversation }>(
      `/api/conversations/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(request),
      }
    );
    return data.conversation;
  }

  async deleteConversation(id: string): Promise<void> {
    await this.request(`/api/conversations/${id}`, { method: "DELETE" });
  }

  // ========== Datasets ==========

  async getDatasets(): Promise<Dataset[]> {
    const data = await this.request<DatasetsResponse | Dataset[]>("/api/datasets");
    return this.extractCollection<Dataset>(data, "datasets");
  }

  async getDataset(datasetId: string): Promise<Dataset> {
    const data = await this.request<DatasetResponse | Dataset>(
      `/api/datasets/${encodeURIComponent(datasetId)}`
    );
    return this.extractResource<Dataset>(data, "dataset");
  }

  // ========== Config ==========

  async getConfigNodes(root: ConfigRoot, tenant?: string): Promise<ConfigNode[]> {
    const query = new URLSearchParams();
    if (tenant) {
      query.set("tenant", tenant);
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const data = await this.request<ConfigNodesResponse | ConfigNode[]>(
      `/api/config/${encodeURIComponent(root)}/nodes${suffix}`
    );
    return this.extractCollection<ConfigNode>(data, "nodes");
  }

  async resolveRuntimeConfig(request: ResolveRuntimeConfigRequest): Promise<Record<string, unknown>> {
    return await this.request<Record<string, unknown>>("/api/runtime/config/resolve", {
      method: "POST",
      body: JSON.stringify({
        tenant: request.tenant,
        "node-slug": request.nodeSlug,
        "agent-id": request.agentId,
        "dataset-id": request.datasetId,
        paths: request.paths,
      }),
    });
  }

  async resolveDatasetConfig(request: ResolveDatasetConfigRequest): Promise<Record<string, unknown>> {
    return await this.request<Record<string, unknown>>("/api/dataset/config/resolve", {
      method: "POST",
      body: JSON.stringify({
        tenant: request.tenant,
        "node-slug": request.nodeSlug,
        "dataset-id": request.datasetId,
        paths: request.paths,
      }),
    });
  }

  // ========== Chat (RAG with streaming) ==========

  async retrieve(request: RetrieveRequest): Promise<RetrieveResponse> {
    const data = await this.request<{
      "dataset-scope": {
        tenant: string;
        "dataset-config-key": string;
      };
    }>("/api/retrieve", {
      method: "POST",
      body: JSON.stringify({
        query: request.query,
        tenant: request.tenant,
        "dataset-config-key": request.datasetConfigKey,
      }),
    });

    return {
      datasetScope: {
        tenant: data["dataset-scope"].tenant,
        datasetConfigKey: data["dataset-scope"]["dataset-config-key"],
      },
    };
  }

  async sendMessage(
    request: RagRequest,
    onChunk: (chunk: string) => void
  ): Promise<{ conversationId?: string }> {
    const response = await fetch(
      `${this.baseUrl}/api/rag`,
      {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: request.query,
          "conversation-id": request.conversationId,
          model: request.model,
          "rerank-top-k": request.rerankTopK,
          "context-top-k": request.contextTopK,
          "max-context-length": request.maxContextLength,
          tenant: request.tenant,
          "dataset-config-key": request.datasetConfigKey,
          "runtime-config-key": request.runtimeConfigKey,
          "agent-id": request.agentId,
        }),
      }
    );

    if (!response.ok) {
      await this.handleErrorResponse(
        response,
        `Failed to send message: ${response.statusText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let conversationId: string | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);

        // Try to extract conversation-id from the response if it's JSON
        // This is a simple heuristic - you may need to adjust based on actual response format
        if (!conversationId && chunk.includes('"conversation-id"')) {
          try {
            const match = chunk.match(/"conversation-id":\s*"([^"]+)"/);
            if (match) {
              conversationId = match[1];
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { conversationId };
  }

  // Simple non-streaming RAG query (for testing/simple use cases)
  async query(request: RagRequest) {
    return await this.request("/api/rag", {
      method: "POST",
      body: JSON.stringify({
        query: request.query,
        "conversation-id": request.conversationId,
        model: request.model,
        "rerank-top-k": request.rerankTopK,
        "context-top-k": request.contextTopK,
        "max-context-length": request.maxContextLength,
        tenant: request.tenant,
        "dataset-config-key": request.datasetConfigKey,
        "runtime-config-key": request.runtimeConfigKey,
        "agent-id": request.agentId,
      }),
    });
  }

  // ========== Filters ==========

  async getFilters() {
    return await this.request("/api/filters");
  }

  async updateFilters(filters: any) {
    return await this.request("/api/filters", {
      method: "PUT",
      body: JSON.stringify(filters),
    });
  }

  // ========== Content ==========

  async getChangelog() {
    return await this.request("/api/changelog");
  }

  async getOnboarding() {
    return await this.request("/api/onboarding");
  }

  async getAbout() {
    return await this.request("/api/about");
  }
}

export const apiClient = new ApiClient(
  import.meta.env.VITE_API_URL || ""
);
