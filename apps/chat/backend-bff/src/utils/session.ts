import type { Session } from "../types/api.js";
import { randomUUID } from "crypto";

// In-memory session store (replace with Redis or database in production)
const sessions = new Map<string, Session>();

// Session expiration time (7 days in milliseconds)
const SESSION_EXPIRATION = 7 * 24 * 60 * 60 * 1000;

/**
 * Create a new session for a user
 * @param data Session data to store
 * @returns Session ID
 */
export async function createSession(data: { email: string }): Promise<string> {
  const sessionId = randomUUID();
  const session: Session = {
    email: data.email,
    createdAt: Date.now(),
  };

  sessions.set(sessionId, session);

  return sessionId;
}

/**
 * Get session data by session ID
 * @param sessionId Session ID to look up
 * @returns Session data or null if not found/expired
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if session is expired
  const now = Date.now();
  if (now - session.createdAt > SESSION_EXPIRATION) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Delete a session
 * @param sessionId Session ID to delete
 */
export async function deleteSession(sessionId: string): Promise<void> {
  sessions.delete(sessionId);
}

/**
 * Clean up expired sessions (called periodically)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const now = Date.now();

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_EXPIRATION) {
      sessions.delete(sessionId);
    }
  }
}

// Run cleanup every hour
setInterval(() => {
  cleanupExpiredSessions();
}, 60 * 60 * 1000);
