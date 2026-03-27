import { Router } from "express";
import type { Request } from "express";
import { randomUUID } from "crypto";
import { config } from "../config.js";
import { createSession, deleteSession } from "../utils/session.js";
import { setSessionCookie, clearSessionCookie } from "../utils/cookie.js";
import { authMiddleware } from "../middleware/auth.js";
import type { LoginResponse, MeResponse } from "../types/api.js";

const auth = Router();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const MAX_OAUTH_STATES = 1000;

interface OAuthStateData {
  createdAt: number;
  returnTo?: string;
}

const oauthStates = new Map<string, OAuthStateData>();

interface SlackTokenResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
}

interface SlackUserInfoResponse {
  ok: boolean;
  error?: string;
  email?: string;
  "https://slack.com/team_id"?: string;
}

function isAllowedDomain(email: string): boolean {
  const domain = email.split("@")[1].toLowerCase();
  const normalizedAllowedDomains = config.allowedDomains.map(d => d.toLowerCase());
  return normalizedAllowedDomains.includes(domain);
}

function cleanupExpiredOauthStates() {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.createdAt > OAUTH_STATE_TTL_MS) {
      oauthStates.delete(state);
    }
  }
}

function isAllowedFrontendUrl(url: string): boolean {
  return config.frontendUrls.includes(url);
}

function normalizeFrontendUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

function resolveFrontendReturnUrl(req: Request): string | undefined {
  const returnToQuery = typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;

  if (!returnToQuery) {
    return undefined;
  }

  const normalized = normalizeFrontendUrl(returnToQuery);
  return normalized && isAllowedFrontendUrl(normalized) ? normalized : undefined;
}

/**
 * POST /auth/login
 * Simple domain-based authentication
 * Checks if the email domain is in the allowed list
 */
auth.post("/login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if domain is allowed
    const domain = email.split("@")[1].toLowerCase();
    if (!isAllowedDomain(email)) {
      console.log(`Login attempt from unauthorized domain: ${domain}`);
      return res.status(403).json({
        error: "Domain not authorized",
        message: `The email domain "${domain}" is not authorized to access this application.`,
      });
    }

    // Create session
    const sessionId = await createSession({ email: email.toLowerCase() });
    setSessionCookie(res, sessionId);

    const response: LoginResponse = {
      user: { email: email.toLowerCase() },
    };

    console.log(`User logged in: ${email}`);
    return res.json(response);
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /auth/slack/start
 * Starts Slack OpenID Connect flow
 */
auth.get("/slack/start", async (req, res) => {
  if (!config.slackClientId || !config.slackClientSecret) {
    return res.status(500).json({ error: "Slack authentication is not configured" });
  }

  cleanupExpiredOauthStates();
  if (oauthStates.size >= MAX_OAUTH_STATES) {
    return res.status(429).json({ error: "Too many pending OAuth logins" });
  }

  const state = randomUUID();
  oauthStates.set(state, {
    createdAt: Date.now(),
    returnTo: resolveFrontendReturnUrl(req),
  });

  const authUrl = new URL("https://slack.com/openid/connect/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.slackClientId);
  authUrl.searchParams.set("redirect_uri", config.slackRedirectUri);
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);

  if (config.slackTeamId) {
    authUrl.searchParams.set("team", config.slackTeamId);
  }

  return res.redirect(authUrl.toString());
});

/**
 * GET /auth/slack/callback
 * Completes Slack OpenID Connect flow and creates an app session
 */
auth.get("/slack/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const state = req.query.state;

    if (typeof code !== "string" || typeof state !== "string") {
      return res.status(400).json({ error: "Missing OAuth code or state" });
    }

    cleanupExpiredOauthStates();
    const stateData = oauthStates.get(state);
    oauthStates.delete(state);

    if (!stateData || Date.now() - stateData.createdAt > OAUTH_STATE_TTL_MS) {
      return res.status(400).json({ error: "Invalid or expired OAuth state" });
    }

    const tokenResponse = await fetch("https://slack.com/api/openid.connect.token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: config.slackClientId,
        client_secret: config.slackClientSecret,
        grant_type: "authorization_code",
        redirect_uri: config.slackRedirectUri,
      }).toString(),
    });

    const tokenData = (await tokenResponse.json()) as SlackTokenResponse;
    if (!tokenResponse.ok || !tokenData.ok || !tokenData.access_token) {
      console.error("Slack token exchange failed:", tokenData.error || tokenResponse.statusText);
      return res.status(401).json({ error: "Slack authentication failed" });
    }

    const userInfoResponse = await fetch("https://slack.com/api/openid.connect.userInfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userInfoData = (await userInfoResponse.json()) as SlackUserInfoResponse;
    if (!userInfoResponse.ok || !userInfoData.ok || !userInfoData.email) {
      console.error("Slack user info lookup failed:", userInfoData.error || userInfoResponse.statusText);
      return res.status(401).json({ error: "Slack authentication failed" });
    }

    if (config.slackTeamId && userInfoData["https://slack.com/team_id"] !== config.slackTeamId) {
      return res.status(403).json({ error: "Unauthorized Slack workspace" });
    }

    const email = userInfoData.email.toLowerCase();
    if (!isAllowedDomain(email)) {
      const domain = email.split("@")[1];
      console.log(`Slack login from unauthorized domain: ${domain}`);
      return res.status(403).json({
        error: "Domain not authorized",
        message: `The email domain "${domain}" is not authorized to access this application.`,
      });
    }

    const sessionId = await createSession({ email });
    setSessionCookie(res, sessionId);

    const redirectBaseUrl = stateData.returnTo || config.frontendUrls[0];
    const redirectUrl = new URL("/", redirectBaseUrl);

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("Slack callback error:", error);
    return res.status(500).json({ error: "Slack authentication failed" });
  }
});

/**
 * POST /auth/logout
 * Delete the current session
 */
auth.post("/logout", async (req, res) => {
  try {
    const sessionId = req.signedCookies?.session;

    if (sessionId) {
      await deleteSession(sessionId);
    }

    clearSessionCookie(res);
    return res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Logout failed" });
  }
});

/**
 * GET /auth/me
 * Get current user info (requires authentication)
 */
auth.get("/me", authMiddleware, async (req, res) => {
  const session = req.session!;

  const response: MeResponse = {
    user: { email: session.email },
  };

  return res.json(response);
});

export default auth;
