import { getSession } from "../utils/session.js";
import type { Session } from "../types/api.js";
import type { Request, Response, NextFunction } from "express";

// Extend Express Request to include session data
declare global {
  namespace Express {
    interface Request {
      session?: Session;
      userEmail?: string;
    }
  }
}

/**
 * Authentication middleware
 * Checks for valid session ID in X-Session-ID header
 * Adds session data to request for downstream handlers
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.header("X-Session-ID");

  if (!sessionId) {
    return res.status(401).json({ error: "No session ID provided" });
  }

  const session = await getSession(sessionId);

  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  // Add session data to request
  req.session = session;
  req.userEmail = session.email;

  next();
};
