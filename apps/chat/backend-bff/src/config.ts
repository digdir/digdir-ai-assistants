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
  port: parseInt(process.env.PORT || "5173"),

  // Frontend URL for redirects and CORS (first value is used for redirects)
  frontendUrls:
    process.env.FRONTEND_URLS?.split(",").map(url => url.trim()).filter(Boolean) ||
    [process.env.FRONTEND_URL || "http://localhost:3000"],

  // Slack OpenID Connect
  slackClientId: process.env.SLACK_CLIENT_ID || "",
  slackClientSecret: process.env.SLACK_CLIENT_SECRET || "",
  slackRedirectUri:
    process.env.SLACK_REDIRECT_URI || "http://localhost:3000/auth/slack/callback",
  slackTeamId: process.env.SLACK_TEAM_ID || "",
};

// Validate required configuration
if (!config.clojureApiKey && process.env.NODE_ENV === "production") {
  console.error("ERROR: RAG_API_KEY is required in production");
  process.exit(1);
}
