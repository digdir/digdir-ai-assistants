import { config } from "../config.js";
import type { Request, Response, NextFunction } from "express";

/**
 * CORS middleware
 * Allows requests from the configured frontend URL
 */
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestOrigin = req.header("Origin");
  const allowedOrigin =
    requestOrigin && config.frontendUrls.includes(requestOrigin)
      ? requestOrigin
      : config.frontendUrls[0];

  // Set CORS headers
  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Session-ID, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
};
