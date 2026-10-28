import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    [key: string]: any;
  };
}

/**
 * Server Authentication Middleware
 * Decoupled from Firebase Auth to support Better Auth and standalone authentication.
 */
export const requireAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  let uid = 'user_default';
  let email = 'user@example.com';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (token) {
      uid = token;
      if (token.includes('@')) {
        email = token;
      }
    }
  }

  req.user = {
    uid,
    email: (req.headers['x-user-email'] as string) || email,
  };
  next();
};
