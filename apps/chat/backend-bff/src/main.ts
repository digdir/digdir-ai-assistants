import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import { config } from "./config.js";
import { corsMiddleware } from "./middleware/cors.js";
import { authMiddleware } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import proxyRoutes from "./routes/proxy.js";
import { logger } from "./utils/logger.js";
import { createHash } from "crypto";

function fingerprint(value: string): string {
  if (!value) {
    return "";
  }

  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

// Create Express app
const app = express();

// Global middleware
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});
morgan.token("req-id", req => (req as express.Request).requestId || "-");
app.use(morgan(":method :url :status :response-time ms - :res[content-length] [req_id=:req-id]"));
app.use(express.json()); // Parse JSON bodies
app.use(cookieParser(config.sessionSecret)); // Parse and sign cookies
app.use(corsMiddleware); // CORS headers

// Public routes
app.use("/auth", authRoutes);

// Protected routes (require authentication)
app.use("/api", authMiddleware, proxyRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  return res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    config: {
      allowedDomains: config.allowedDomains,
      clojureApiUrl: config.clojureApiUrl,
      hasClojureApiKey: !!config.clojureApiKey,
      port: config.port,
      frontendUrls: config.frontendUrls,
    },
  });
});

// Root endpoint
app.get("/", (req, res) => {
  return res.json({
    name: "Chat App BFF",
    version: "1.0.0",
    description: "Backend-for-Frontend for Chat Application",
    endpoints: {
      health: "/health",
      auth: {
        login: "POST /auth/login",
        slackStart: "GET /auth/slack/start",
        slackCallback: "GET /auth/slack/callback",
        logout: "POST /auth/logout",
        me: "GET /auth/me",
      },
      api: {
        rag: "POST /api/rag",
        retrieve: "POST /api/retrieve",
        configNodes: "GET /api/config/:root/nodes?tenant=...",
        resolveRuntimeConfig: "POST /api/runtime/config/resolve",
        resolveDatasetConfig: "POST /api/dataset/config/resolve",
        conversations: "GET /api/conversations",
        createConversation: "POST /api/conversations",
        getConversation: "GET /api/conversations/:id",
        updateConversation: "PUT /api/conversations/:id",
        deleteConversation: "DELETE /api/conversations/:id",
        datasets: "GET /api/datasets",
        getDataset: "GET /api/datasets/:datasetId",
        filters: "GET /api/filters",
        updateFilters: "PUT /api/filters",
        changelog: "GET /api/changelog",
        onboarding: "GET /api/onboarding",
        about: "GET /api/about",
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn("Route not found", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
  });
  return res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Unhandled server error", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error: err,
  });
  return res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// Start server
logger.info(`
╔════════════════════════════════════════╗
║     🚀 Chat App BFF Server             ║
╚════════════════════════════════════════╝

Starting server on port ${config.port}...
Environment: ${process.env.NODE_ENV || "development"}

Endpoints:
  - Health:  http://localhost:${config.port}/health
  - Auth:    http://localhost:${config.port}/auth/*
  - API:     http://localhost:${config.port}/api/*

Allowed domains: ${config.allowedDomains.join(", ")}
Frontend URLs:   ${config.frontendUrls.join(", ")}
Clojure API:     ${config.clojureApiUrl}
API key set:     ${config.clojureApiKey ? "yes" : "no"}

Ready to accept connections!
`);

logger.info("BFF RAG configuration snapshot", {
  ragApiUrl: config.clojureApiUrl,
  hasRagApiKey: Boolean(config.clojureApiKey),
  ragApiKeyFingerprint: fingerprint(config.clojureApiKey),
  ragApiKeyLength: config.clojureApiKey.length,
  ragPublicTenant: config.ragPublicTenant || null,
  ragPublicDatasetConfigKey: config.ragPublicDatasetConfigKey || null,
  ragPublicRuntimeConfigKey: config.ragPublicRuntimeConfigKey || null,
  ragPublicAgentId: config.ragPublicAgentId || null,
  ragPlatformConfig: config.ragPlatformConfig
    ? `${config.ragPlatformConfig.tenant}/${config.ragPlatformConfig.root}/${config.ragPlatformConfig.nodeSlug}`
    : null,
  ragRuntimeConfig: config.ragRuntimeConfig
    ? `${config.ragRuntimeConfig.tenant}/${config.ragRuntimeConfig.root}/${config.ragRuntimeConfig.nodeSlug}`
    : null,
  ragDatasetConfig: config.ragDatasetConfig
    ? `${config.ragDatasetConfig.tenant}/${config.ragDatasetConfig.root}/${config.ragDatasetConfig.nodeSlug}`
    : null,
});

app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`);
});
