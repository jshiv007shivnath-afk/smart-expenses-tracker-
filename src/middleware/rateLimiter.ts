import { Request, Response, NextFunction } from "express";

/**
 * All rate limiters disabled per user request ("na rate limiting kuch bhi nhi").
 * All middlewares passthrough directly without throttling or blocking.
 */
export const authExponentialBackoffLimiter = (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  next();
};

export const publicEndpointLimiter = (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  next();
};

export const authenticatedUserLimiter = (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  next();
};

export const aiFeatureLimiter = (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  next();
};

export const stripeOperationsLimiter = (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  next();
};
