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
} from "@/types";

class ApiClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private userEmail: string | null = null;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
    this.sessionId = localStorage.getItem("sessionId");
    this.userEmail = localStorage.getItem("userEmail");
  }

  setSession(sessionId: string, email?: string) {
    this.sessionId = sessionId;
    localStorage.setItem("sessionId", sessionId);
    if (email) {
      this.userEmail = email;
      localStorage.setItem("userEmail", email);
    }
  }

  clearSession() {
    this.sessionId = null;
    this.userEmail = null;
    localStorage.removeItem("sessionId");
    localStorage.removeItem("userEmail");
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getUserEmail(): string | null {
    return this.userEmail;
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
    const errorData = await response.json().catch(() => ({}));
    const errorCode =
      this.isObject(errorData) && typeof errorData.code === "string"
        ? errorData.code
        : undefined;

    if (
      response.status === 401 &&
      (errorCode === "SESSION_MISSING" || errorCode === "SESSION_INVALID")
    ) {
      this.clearSession();
      window.location.href = "/login";
    }

    throw new Error(this.getErrorMessage(errorData, fallbackMessage));
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(this.sessionId && { "X-Session-ID": this.sessionId }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      cache: options.cache ?? this.getDefaultCacheMode(endpoint),
      headers,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response, `API error: ${response.statusText}`);
    }

    return await response.json();
  }

  // ========== Auth ==========

  async login(email: string): Promise<User> {
    const data = await this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    this.setSession(data.sessionId, data.user.email);
    return data.user;
  }

  getSlackLoginUrl(): string {
    const params =
      typeof window !== "undefined"
        ? `?${new URLSearchParams({ returnTo: window.location.origin }).toString()}`
        : "";
    return `${this.baseUrl}/auth/slack/start${params}`;
  }

  completeOAuthLogin(sessionId: string, email: string): User {
    const normalizedEmail = email.toLowerCase();
    this.setSession(sessionId, normalizedEmail);
    return { email: normalizedEmail };
  }

  async logout(): Promise<void> {
    await this.request("/auth/logout", { method: "POST" });
    this.clearSession();
  }

  async getMe(): Promise<User> {
    const data = await this.request<MeResponse>("/auth/me");
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

  // ========== Chat (RAG with streaming) ==========

  async sendMessage(
    request: RagRequest,
    onChunk: (chunk: string) => void
  ): Promise<{ conversationId?: string }> {
    const response = await fetch(
      `${this.baseUrl}/api/rag`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(this.sessionId && { "X-Session-ID": this.sessionId }),
        },
        body: JSON.stringify({
          query: request.query,
          "conversation-id": request.conversationId,
          model: request.model,
          "rerank-top-k": request.rerankTopK,
          "context-top-k": request.contextTopK,
          "max-context-length": request.maxContextLength,
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
