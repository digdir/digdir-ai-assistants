import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { corsMiddleware } from "./middleware/cors.js";
import { authMiddleware } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import proxyRoutes from "./routes/proxy.js";

// Create Express app
const app = express();

// Global middleware
app.use(morgan("dev")); // Request logging
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
        conversations: "GET /api/conversations",
        createConversation: "POST /api/conversations",
        getConversation: "GET /api/conversations/:id",
        updateConversation: "PUT /api/conversations/:id",
        deleteConversation: "DELETE /api/conversations/:id",
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
  return res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Server error:", err);
  return res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// Start server
console.log(`
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

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
