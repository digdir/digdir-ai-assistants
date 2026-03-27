import type { Response, CookieOptions } from "express";

const COOKIE_NAME = "session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  signed: true,
};

export function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(COOKIE_NAME, sessionId, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
}
