import { Router } from "express";
import type { Request, Response } from "express";
import { config } from "../config.js";
import { logger, sanitizeForLogsValue } from "../utils/logger.js";

const proxy = Router();
const MAX_LOG_BODY_LENGTH = 2_000;

function getRequestScopeMeta(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") {
    return {};
  }

  const record = body as Record<string, unknown>;
  return {
    hasTenant: typeof record.tenant === "string" && record.tenant.trim() !== "",
    hasDatasetConfigKey:
      typeof record["dataset-config-key"] === "string" && record["dataset-config-key"].trim() !== "",
    hasRuntimeConfigKey:
      typeof record["runtime-config-key"] === "string" && record["runtime-config-key"].trim() !== "",
    hasAgentId: typeof record["agent-id"] === "string" && record["agent-id"].trim() !== "",
    hasConversationId:
      typeof record["conversation-id"] === "string" && record["conversation-id"].trim() !== "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRequestId(req: Request): string {
  return req.requestId || "unknown";
}

function isStreamingContentType(contentType: string | null): boolean {
  return Boolean(contentType?.includes("stream") || contentType?.includes("event-stream"));
}

function isJsonContentType(contentType: string | null): boolean {
  return Boolean(contentType?.includes("application/json") || contentType?.includes("+json"));
}

function truncateText(value: string): string {
  if (value.length <= MAX_LOG_BODY_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_LOG_BODY_LENGTH)}…[truncated ${value.length - MAX_LOG_BODY_LENGTH} chars]`;
}

function getRequestBodyForLogs(body: unknown): unknown {
  if (body == null) {
    return undefined;
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return truncateText(body);
    }
  }

  if (body instanceof URLSearchParams) {
    return truncateText(body.toString());
  }

  return "[NonInspectableBody]";
}

async function getResponsePreview(response: globalThis.Response): Promise<string | undefined> {
  const contentType = response.headers.get("content-type");
  if (isStreamingContentType(contentType)) {
    return undefined;
  }

  try {
    return truncateText(await response.text());
  } catch (error) {
    return `<<failed to read response preview: ${error instanceof Error ? error.message : String(error)}>>`;
  }
}

function getJsonResponseSummary(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    return {
      responseType: Array.isArray(data) ? "array" : typeof data,
    };
  }

  const rawChunks = Array.isArray(data["chunks-used"])
    ? data["chunks-used"]
    : Array.isArray(data.chunksUsed)
      ? data.chunksUsed
      : [];
  const firstChunk = rawChunks[0];

  return {
    responseKeys: Object.keys(data),
    conversationId:
      typeof data["conversation-id"] === "string"
        ? data["conversation-id"]
        : typeof data.conversationId === "string"
          ? data.conversationId
          : null,
    chunkCount: rawChunks.length,
    firstChunkKeys: isRecord(firstChunk) ? Object.keys(firstChunk) : [],
    firstChunkSummary: isRecord(firstChunk)
      ? {
          chunkId:
            typeof firstChunk["chunk-id"] === "string"
              ? firstChunk["chunk-id"]
              : typeof firstChunk.chunkId === "string"
                ? firstChunk.chunkId
                : null,
          docTitle:
            typeof firstChunk["doc-title"] === "string"
              ? firstChunk["doc-title"]
              : typeof firstChunk.docTitle === "string"
                ? firstChunk.docTitle
                : null,
          docNum:
            typeof firstChunk["doc-num"] === "string"
              ? firstChunk["doc-num"]
              : typeof firstChunk.docNum === "string"
                ? firstChunk.docNum
                : null,
          contentMarkdownLength:
            typeof firstChunk["content-markdown"] === "string"
              ? firstChunk["content-markdown"].length
              : typeof firstChunk.contentMarkdown === "string"
                ? firstChunk.contentMarkdown.length
                : null,
        }
      : null,
  };
}

async function sendProxyResponse(
  req: Request,
  res: Response,
  response: globalThis.Response,
  operation: string
): Promise<Response> {
  const contentType = response.headers.get("content-type");
  const shouldPreviewBody = logger.isEnabled("debug") || !response.ok;
  const preview = shouldPreviewBody ? await getResponsePreview(response.clone()) : undefined;
  const meta = {
    requestId: getRequestId(req),
    operation,
    method: req.method,
    path: req.originalUrl,
    upstreamStatus: response.status,
    upstreamContentType: contentType,
    upstreamBodyPreview: preview,
  };

  if (isJsonContentType(contentType)) {
    const data = await response.json();
    const jsonMeta = {
      ...meta,
      ...(shouldPreviewBody ? { responseShape: getJsonResponseSummary(data) } : {}),
    };
    if (response.ok) {
      logger.debug("Proxy upstream response", jsonMeta);
    } else {
      logger.warn("Proxy upstream response was not OK", jsonMeta);
    }
    return res.status(response.status).json(data);
  }

  if (response.ok) {
    logger.debug("Proxy upstream response", meta);
  } else {
    logger.warn("Proxy upstream response was not OK", meta);
  }

  const text = await response.text();
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }

  return res.status(response.status).send(text);
}

function handleProxyError(
  req: Request,
  res: Response,
  operation: string,
  error: unknown,
  publicMessage: string
): Response {
  logger.error("Proxy request failed", {
    requestId: getRequestId(req),
    operation,
    method: req.method,
    path: req.originalUrl,
    error,
  });

  return res.status(500).json({ error: publicMessage });
}

/**
 * Generic proxy function to forward requests to Clojure API
 * Adds authentication headers and user context
 */
async function proxyRequest(
  req: Request,
  path: string,
  options: RequestInit = {}
): Promise<globalThis.Response> {
  if (!config.clojureApiKey) {
    throw new Error("RAG_API_KEY is not configured");
  }

  const userEmail = req.userEmail;
  if (!userEmail) {
    throw new Error("Authenticated user email is missing");
  }

  const url = `${config.clojureApiUrl}${path}`;
  const headers = {
    ...options.headers,
    "X-API-Key": config.clojureApiKey,
    "X-User-Id": userEmail,
    "Content-Type": "application/json",
  };

  logger.debug("Proxy upstream request", {
    requestId: getRequestId(req),
    localMethod: req.method,
    localPath: req.originalUrl,
    upstreamMethod: options.method || req.method,
    upstreamUrl: url,
    query: req.query,
    body: sanitizeForLogsValue(getRequestBodyForLogs(options.body)),
    requestScope: getRequestScopeMeta(options.body),
  });

  try {
    return await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    logger.error("Upstream fetch failed", {
      requestId: getRequestId(req),
      localMethod: req.method,
      localPath: req.originalUrl,
      upstreamMethod: options.method || req.method,
      upstreamUrl: url,
      error,
    });
    throw error;
  }
}

function getTenantQuery(req: Request): string {
  const tenant = req.query.tenant;
  if (typeof tenant === "string" && tenant.trim()) {
    return tenant.trim();
  }

  return config.ragTenant;
}

/**
 * POST /api/rag
 * RAG query endpoint with streaming support
 */
proxy.post("/rag", async (req, res) => {
  try {
    const hasConversationId =
      typeof req.body?.["conversation-id"] === "string" && req.body["conversation-id"].trim() !== "";
    const body = {
      ...req.body,
      ...(config.ragPublicTenant && { tenant: config.ragPublicTenant }),
      ...(config.ragPublicDatasetConfigKey && {
        "dataset-config-key": config.ragPublicDatasetConfigKey,
      }),
      ...(config.ragPublicRuntimeConfigKey && {
        "runtime-config-key": config.ragPublicRuntimeConfigKey,
      }),
      ...(!hasConversationId && config.ragPublicAgentId && { "agent-id": config.ragPublicAgentId }),
    };

    if (hasConversationId) {
      delete body["agent-id"];
    }

    const response = await proxyRequest(req, "/api/rag", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get("content-type");
    if (isStreamingContentType(contentType)) {
      logger.debug("Proxy upstream streaming response started", {
        requestId: getRequestId(req),
        operation: "rag",
        method: req.method,
        path: req.originalUrl,
        upstreamStatus: response.status,
        upstreamContentType: contentType,
      });

      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (response.body) {
        const reader = response.body.getReader();
        try {
          const decoder = new TextDecoder();
          let bytesStreamed = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytesStreamed += value.byteLength;
            res.write(decoder.decode(value, { stream: true }));
          }

          logger.debug("Proxy upstream streaming response completed", {
            requestId: getRequestId(req),
            operation: "rag",
            method: req.method,
            path: req.originalUrl,
            upstreamStatus: response.status,
            bytesStreamed,
          });
        } finally {
          reader.releaseLock();
        }
      }

      return res.end();
    }

    return await sendProxyResponse(req, res, response, "rag");
  } catch (error) {
    return handleProxyError(req, res, "rag", error, "RAG query failed");
  }
});

/**
 * POST /api/retrieve
 * Retrieve supporting chunks for a dataset-first public request
 */
proxy.post("/retrieve", async (req, res) => {
  try {
    const body = {
      ...req.body,
      ...(config.ragPublicTenant && { tenant: config.ragPublicTenant }),
      ...(config.ragPublicDatasetConfigKey && {
        "dataset-config-key": config.ragPublicDatasetConfigKey,
      }),
    };

    const response = await proxyRequest(req, "/api/retrieve", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return await sendProxyResponse(req, res, response, "retrieve");
  } catch (error) {
    return handleProxyError(req, res, "retrieve", error, "Retrieve query failed");
  }
});

/**
 * GET /api/config/:root/nodes?tenant=...
 * List visible config nodes for a root under this API key's ceilings
 */
proxy.get("/config/:root/nodes", async (req, res) => {
  try {
    const root = encodeURIComponent(req.params.root);
    const query = new URLSearchParams();
    const tenant = getTenantQuery(req);

    if (tenant) {
      query.set("tenant", tenant);
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const response = await proxyRequest(req, `/api/config/${root}/nodes${suffix}`);
    return await sendProxyResponse(req, res, response, "configNodes");
  } catch (error) {
    return handleProxyError(req, res, "configNodes", error, "Failed to get config nodes");
  }
});

/**
 * POST /api/runtime/config/resolve
 * Resolve runtime config for an explicit node slug
 */
proxy.post("/runtime/config/resolve", async (req, res) => {
  try {
    const body = {
      ...req.body,
      ...(config.ragTenant && { tenant: config.ragTenant }),
      ...(config.ragRuntimeConfig && { "node-slug": config.ragRuntimeConfig.nodeSlug }),
    };

    const response = await proxyRequest(req, "/api/runtime/config/resolve", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return await sendProxyResponse(req, res, response, "resolveRuntimeConfig");
  } catch (error) {
    return handleProxyError(
      req,
      res,
      "resolveRuntimeConfig",
      error,
      "Failed to resolve runtime config"
    );
  }
});

/**
 * POST /api/dataset/config/resolve
 * Resolve dataset config for an explicit node slug
 */
proxy.post("/dataset/config/resolve", async (req, res) => {
  try {
    const body = {
      ...req.body,
      ...(config.ragTenant && { tenant: config.ragTenant }),
      ...(config.ragDatasetConfig && { "node-slug": config.ragDatasetConfig.nodeSlug }),
    };

    const response = await proxyRequest(req, "/api/dataset/config/resolve", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return await sendProxyResponse(req, res, response, "resolveDatasetConfig");
  } catch (error) {
    return handleProxyError(
      req,
      res,
      "resolveDatasetConfig",
      error,
      "Failed to resolve dataset config"
    );
  }
});

/**
 * GET /api/conversations
 * List user's conversations
 */
proxy.get("/conversations", async (req, res) => {
  try {
    const response = await proxyRequest(req, req.originalUrl);
    return await sendProxyResponse(req, res, response, "getConversations");
  } catch (error) {
    return handleProxyError(req, res, "getConversations", error, "Failed to get conversations");
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
proxy.post("/conversations", async (req, res) => {
  try {
    const body = req.body;
    const response = await proxyRequest(req, "/api/conversations", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return await sendProxyResponse(req, res, response, "createConversation");
  } catch (error) {
    return handleProxyError(
      req,
      res,
      "createConversation",
      error,
      "Failed to create conversation"
    );
  }
});

/**
 * GET /api/conversations/:id
 * Get a specific conversation with messages
 */
proxy.get("/conversations/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const response = await proxyRequest(req, `/api/conversations/${id}`);
    return await sendProxyResponse(req, res, response, "getConversation");
  } catch (error) {
    return handleProxyError(req, res, "getConversation", error, "Failed to get conversation");
  }
});

/**
 * PUT /api/conversations/:id
 * Update a conversation (title, folder, etc.)
 */
proxy.put("/conversations/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;
    const response = await proxyRequest(req, `/api/conversations/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return await sendProxyResponse(req, res, response, "updateConversation");
  } catch (error) {
    return handleProxyError(req, res, "updateConversation", error, "Failed to update conversation");
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a conversation
 */
proxy.delete("/conversations/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const response = await proxyRequest(req, `/api/conversations/${id}`, {
      method: "DELETE",
    });
    return await sendProxyResponse(req, res, response, "deleteConversation");
  } catch (error) {
    return handleProxyError(req, res, "deleteConversation", error, "Failed to delete conversation");
  }
});

/**
 * GET /api/datasets
 * List datasets visible to this API key
 */
proxy.get("/datasets", async (req, res) => {
  try {
    const response = await proxyRequest(req, "/api/datasets");
    return await sendProxyResponse(req, res, response, "getDatasets");
  } catch (error) {
    return handleProxyError(req, res, "getDatasets", error, "Failed to get datasets");
  }
});

/**
 * GET /api/datasets/:datasetId
 * Get one visible dataset
 */
proxy.get("/datasets/:datasetId", async (req, res) => {
  try {
    const datasetId = encodeURIComponent(req.params.datasetId);
    const response = await proxyRequest(req, `/api/datasets/${datasetId}`);
    return await sendProxyResponse(req, res, response, "getDataset");
  } catch (error) {
    return handleProxyError(req, res, "getDataset", error, "Failed to get dataset");
  }
});

/**
 * GET /api/filters
 * Get user's active filters
 */
proxy.get("/filters", async (req, res) => {
  try {
    const response = await proxyRequest(req, "/api/filters");
    return await sendProxyResponse(req, res, response, "getFilters");
  } catch (error) {
    return handleProxyError(req, res, "getFilters", error, "Failed to get filters");
  }
});

/**
 * PUT /api/filters
 * Update user's active filters
 */
proxy.put("/filters", async (req, res) => {
  try {
    const body = req.body;
    const response = await proxyRequest(req, "/api/filters", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return await sendProxyResponse(req, res, response, "updateFilters");
  } catch (error) {
    return handleProxyError(req, res, "updateFilters", error, "Failed to update filters");
  }
});

/**
 * GET /api/changelog
 * Get changelog entries
 */
proxy.get("/changelog", async (req, res) => {
  try {
    const response = await proxyRequest(req, "/api/changelog");
    return await sendProxyResponse(req, res, response, "getChangelog");
  } catch (error) {
    return handleProxyError(req, res, "getChangelog", error, "Failed to get changelog");
  }
});

/**
 * GET /api/onboarding
 * Get onboarding content
 */
proxy.get("/onboarding", async (req, res) => {
  try {
    const response = await proxyRequest(req, "/api/onboarding");
    return await sendProxyResponse(req, res, response, "getOnboarding");
  } catch (error) {
    return handleProxyError(req, res, "getOnboarding", error, "Failed to get onboarding content");
  }
});

/**
 * GET /api/about
 * Get about content
 */
proxy.get("/about", async (req, res) => {
  try {
    const response = await proxyRequest(req, "/api/about");
    return await sendProxyResponse(req, res, response, "getAbout");
  } catch (error) {
    return handleProxyError(req, res, "getAbout", error, "Failed to get about content");
  }
});

export default proxy;
