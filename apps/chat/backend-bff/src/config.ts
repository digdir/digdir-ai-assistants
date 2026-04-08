// Load environment variables from .env file if it exists
import dotenv from "dotenv";
dotenv.config();

type ConfigRoot = "platform" | "runtime" | "dataset";

interface ConfigSelector {
  tenant: string;
  root: ConfigRoot;
  nodeSlug: string;
}

const port = parseInt(process.env.PORT || "5173");
const ragPublicTenant = process.env.RAG_PUBLIC_TENANT?.trim() || "";
const ragPublicDatasetConfigKey = process.env.RAG_PUBLIC_DATASET_CONFIG_KEY?.trim() || "";
const ragPublicRuntimeConfigKey = process.env.RAG_PUBLIC_RUNTIME_CONFIG_KEY?.trim() || "";
const ragPublicAgentId = process.env.RAG_PUBLIC_AGENT_ID?.trim() || "";

function parseConfigSelector(
  envName: "RAG_PLATFORM_CONFIG" | "RAG_RUNTIME_CONFIG" | "RAG_DATASET_CONFIG",
  expectedRoot: ConfigRoot
): ConfigSelector | null {
  const rawValue = process.env[envName]?.trim() || "";
  if (!rawValue) {
    return null;
  }

  const parts = rawValue.split("/").filter(Boolean);
  if (parts.length !== 3) {
    throw new Error(
      `${envName} must use the format "<tenant>/${expectedRoot}/<node-slug>"`
    );
  }

  const [tenant, root, nodeSlug] = parts;
  if (root !== expectedRoot) {
    throw new Error(
      `${envName} must use the ${expectedRoot} root, got "${root}" instead`
    );
  }

  return {
    tenant,
    root,
    nodeSlug,
  };
}

const ragPlatformConfig = parseConfigSelector("RAG_PLATFORM_CONFIG", "platform");
const ragRuntimeConfig = parseConfigSelector("RAG_RUNTIME_CONFIG", "runtime");
const ragDatasetConfig = parseConfigSelector("RAG_DATASET_CONFIG", "dataset");
const configuredSelectors = [
  ragPlatformConfig,
  ragRuntimeConfig,
  ragDatasetConfig,
].filter((selector): selector is ConfigSelector => selector !== null);
const hasPartialRagConfigSelectors =
  configuredSelectors.length > 0 && configuredSelectors.length !== 3;
const ragTenantCandidates = new Set(configuredSelectors.map(selector => selector.tenant));
const ragTenant = configuredSelectors[0]?.tenant || "";
const hasPartialPinnedPublicDatasetRef =
  [ragPublicTenant, ragPublicDatasetConfigKey].some(Boolean) &&
  ![ragPublicTenant, ragPublicDatasetConfigKey].every(Boolean);
const hasPinnedRuntimeWithoutDataset =
  Boolean(ragPublicRuntimeConfigKey) && !Boolean(ragPublicTenant && ragPublicDatasetConfigKey);
const hasPinnedAgentWithoutDataset =
  Boolean(ragPublicAgentId) && !Boolean(ragPublicTenant && ragPublicDatasetConfigKey);

export const config = {
  // Allowed email domains for authentication
  allowedDomains: process.env.ALLOWED_DOMAINS?.split(",").map(d => d.trim()) || [
    "example.com",
  ],

  // Clojure backend API
  clojureApiUrl: process.env.RAG_API_URL || "http://localhost:8080",
  clojureApiKey: process.env.RAG_API_KEY || "",

  // Explicit request-time node selectors for config helper endpoints
  ragPlatformConfig,
  ragRuntimeConfig,
  ragDatasetConfig,
  ragTenant,

  // Optional fixed public selectors for proxied RAG/retrieve requests
  ragPublicTenant,
  ragPublicDatasetConfigKey,
  ragPublicRuntimeConfigKey,
  ragPublicAgentId,

  // Session secret for signing
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-change-in-production",

  // Server port
  port,

  // Frontend URL for redirects and CORS (first value is used for redirects)
  frontendUrls:
    process.env.FRONTEND_URLS?.split(",").map(url => url.trim()).filter(Boolean) ||
    [process.env.FRONTEND_URL || "http://localhost:3000"],

  // Slack OpenID Connect
  slackClientId: process.env.SLACK_CLIENT_ID || "",
  slackClientSecret: process.env.SLACK_CLIENT_SECRET || "",
  slackRedirectUri:
    process.env.SLACK_REDIRECT_URI || `http://localhost:${port}/auth/slack/callback`,
  slackTeamId: process.env.SLACK_TEAM_ID || "",
};

// Validate required configuration
if (!config.clojureApiKey) {
  const message = "RAG_API_KEY is not configured; proxied API requests will fail";

  if (process.env.NODE_ENV === "production") {
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }

  console.warn(`WARNING: ${message}`);
}

if (hasPartialRagConfigSelectors) {
  const message =
    "RAG_PLATFORM_CONFIG, RAG_RUNTIME_CONFIG, and RAG_DATASET_CONFIG must either all be set or all be empty";

  if (process.env.NODE_ENV === "production") {
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }

  console.warn(`WARNING: ${message}`);
}

if (ragTenantCandidates.size > 1) {
  const message =
    "RAG_PLATFORM_CONFIG, RAG_RUNTIME_CONFIG, and RAG_DATASET_CONFIG must all target the same tenant";

  if (process.env.NODE_ENV === "production") {
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }

  console.warn(`WARNING: ${message}`);
}

if (hasPartialPinnedPublicDatasetRef) {
  const message =
    "RAG_PUBLIC_TENANT and RAG_PUBLIC_DATASET_CONFIG_KEY must either both be set or both be empty";

  if (process.env.NODE_ENV === "production") {
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }

  console.warn(`WARNING: ${message}`);
}

if (hasPinnedAgentWithoutDataset) {
  const message =
    "RAG_PUBLIC_AGENT_ID requires both RAG_PUBLIC_TENANT and RAG_PUBLIC_DATASET_CONFIG_KEY";

  if (process.env.NODE_ENV === "production") {
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }

  console.warn(`WARNING: ${message}`);
}
