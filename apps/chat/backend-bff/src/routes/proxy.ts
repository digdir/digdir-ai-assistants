import { Router } from "express";
import type { Request, Response } from "express";
import { config } from "../config.js";

const proxy = Router();

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
    "X-User-Email": userEmail,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

/**
 * POST /api/rag
 * RAG query endpoint with streaming support
 */
proxy.post("/rag", async (req, res) => {
  try {
    const body = req.body;

    const response = await proxyRequest(req, "/api/rag", {
      method: "POST",
      body: JSON.stringify(body),
    });

    // Check if response is streaming
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("stream") || contentType?.includes("event-stream")) {
      // Pass through streaming response directly
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      }

      return res.end();
    }

    // Non-streaming response
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("RAG error:", error);
    return res.status(500).json({ error: "RAG query failed" });
  }
});

/**
 * GET /api/conversations
 * List user's conversations
 */
proxy.get("/conversations", async (req, res) => {
  try {
    const response = await proxyRequest(req, "/api/conversations");
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Get conversations error:", error);
    return res.status(500).json({ error: "Failed to get conversations" });
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
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Create conversation error:", error);
    return res.status(500).json({ error: "Failed to create conversation" });
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
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Get conversation error:", error);
    return res.status(500).json({ error: "Failed to get conversation" });
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
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Update conversation error:", error);
    return res.status(500).json({ error: "Failed to update conversation" });
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
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Delete conversation error:", error);
    return res.status(500).json({ error: "Failed to delete conversation" });
  }
});

/**
 * GET /api/filters
 * Get user's active filters
 */
proxy.get("/filters", async (req, res) => {
  try {
    const response = await proxyRequest(req, "/api/filters");
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Get filters error:", error);
    return res.status(500).json({ error: "Failed to get filters" });
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
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Update filters error:", error);
    return res.status(500).json({ error: "Failed to update filters" });
  }
});

/**
 * GET /api/changelog
 * Get changelog entries
 */
proxy.get("/changelog", async (req, res) => {
  try {
    const response = await proxyRequest(req, "/api/changelog");
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Get changelog error:", error);
    return res.status(500).json({ error: "Failed to get changelog" });
  }
});

/**
 * GET /api/onboarding
 * Get onboarding content
 */
proxy.get("/onboarding", async (req, res) => {
  try {
    const response = await proxyRequest(req, "/api/onboarding");
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Get onboarding error:", error);
    return res.status(500).json({ error: "Failed to get onboarding content" });
  }
});

/**
 * GET /api/about
 * Get about content
 */
proxy.get("/about", async (req, res) => {
  try {
    const response = await proxyRequest(req, "/api/about");
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Get about error:", error);
    return res.status(500).json({ error: "Failed to get about content" });
  }
});

export default proxy;
