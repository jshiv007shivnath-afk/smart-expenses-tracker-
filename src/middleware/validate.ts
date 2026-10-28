import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Middleware factory to strictly validate request body against a Zod schema.
 * Rejects non-matching input with HTTP 400 Bad Request instead of attempting sanitization.
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedBody = schema.parse(req.body);
      req.body = parsedBody; // Replace req.body with clean, typed parsed value
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return res.status(400).json({
          error: "Invalid request body structure or parameters",
          details: issues,
        });
      }
      return res.status(400).json({ error: "Malformed request payload" });
    }
  };
};

/**
 * Middleware factory to strictly validate query parameters against a Zod schema.
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedQuery = schema.parse(req.query);
      req.query = parsedQuery as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return res.status(400).json({
          error: "Invalid query parameters",
          details: issues,
        });
      }
      return res.status(400).json({ error: "Malformed query string" });
    }
  };
};
