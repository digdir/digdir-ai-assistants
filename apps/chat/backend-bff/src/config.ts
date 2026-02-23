// Load environment variables from .env file if it exists
import dotenv from "dotenv";
dotenv.config();

export const config = {
  // Allowed email domains for authentication
  allowedDomains: process.env.ALLOWED_DOMAINS?.split(",").map(d => d.trim()) || [
    "example.com",
  ],

  // Clojure backend API
  clojureApiUrl: process.env.RAG_API_URL || "http://localhost:8080",
  clojureApiKey: process.env.RAG_API_KEY || "",

  // Session secret for signing
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-change-in-production",

  // Server port
  port: parseInt(process.env.PORT || "3000"),

  // Frontend URL for CORS
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};

// Validate required configuration
if (!config.clojureApiKey && process.env.NODE_ENV === "production") {
  console.error("ERROR: RAG_API_KEY is required in production");
  process.exit(1);
}
