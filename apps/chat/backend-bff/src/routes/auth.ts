import { Router } from "express";
import { config } from "../config.js";
import { createSession, deleteSession } from "../utils/session.js";
import { authMiddleware } from "../middleware/auth.js";
import type { LoginResponse, MeResponse } from "../types/api.js";

const auth = Router();

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

    // Extract domain from email
    const domain = email.split("@")[1].toLowerCase();

    // Check if domain is allowed
    const normalizedAllowedDomains = config.allowedDomains.map(d => d.toLowerCase());
    if (!normalizedAllowedDomains.includes(domain)) {
      console.log(`Login attempt from unauthorized domain: ${domain}`);
      return res.status(403).json({
        error: "Domain not authorized",
        message: `The email domain "${domain}" is not authorized to access this application.`,
      });
    }

    // Create session
    const sessionId = await createSession({ email: email.toLowerCase() });

    const response: LoginResponse = {
      user: { email: email.toLowerCase() },
      sessionId,
    };

    console.log(`User logged in: ${email}`);
    return res.json(response);
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /auth/logout
 * Delete the current session
 */
auth.post("/logout", async (req, res) => {
  try {
    const sessionId = req.header("X-Session-ID");

    if (sessionId) {
      await deleteSession(sessionId);
    }

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
