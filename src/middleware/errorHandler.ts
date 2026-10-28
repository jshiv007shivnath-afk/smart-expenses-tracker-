import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth.ts";

/**
 * Global Leak-Proof Error Handling Middleware
 * Ensures internal exceptions, stack traces, file paths, and database messages
 * are NEVER leaked to client responses, while logging full details server-side.
 */
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const authReq = req as AuthRequest;
  const timestamp = new Date().toISOString();
  const userId = authReq.user?.uid || "anonymous";

  // Server-Side Detailed Logging
  console.error(`[${timestamp}] ERROR on ${req.method} ${req.originalUrl} (User: ${userId}):`, {
    message: err?.message || err,
    stack: err?.stack,
    body: req.body,
    query: req.query,
    ip: req.ip,
  });

  // Client-Side Sanitized Response
  // Check if headers have already been sent
  if (res.headersSent) {
    return;
  }

  const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;

  // Controlled, safe user messages
  let userMessage = "An unexpected error occurred. Please try again later.";

  if (statusCode === 400) {
    userMessage = "Invalid request payload or parameters.";
  } else if (statusCode === 401) {
    userMessage = "Authentication required.";
  } else if (statusCode === 403) {
    userMessage = "Access denied.";
  } else if (statusCode === 404) {
    userMessage = "Requested resource not found.";
  } else if (statusCode === 429) {
    userMessage = "Rate limit exceeded. Please try again later.";
  }

  res.status(statusCode).json({
    error: userMessage,
    requestId: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  });
};
