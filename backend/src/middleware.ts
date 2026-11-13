import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { db } from './db.js';
import { ACCESS_SECRET } from './config.js';
import { ApiError } from './ledger.js';

export type Role = 'customer' | 'teller' | 'loan_officer' | 'admin';
export type User = { id: string; email: string; name: string; phone: string; role: Role; status: string; kyc_status: string; pin_hash: string };
declare global {
  namespace Express { interface Request { user?: User } }
}

export const validate = <T>(schema: import('zod').ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, result.error.issues.map((issue) => issue.message).join(' '), 'validation_error');
  return result.data;
};

export const auth = (allowed?: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new ApiError(401, 'Sign in to continue.', 'unauthorized');
    const payload = jwt.verify(token, ACCESS_SECRET) as JwtPayload;
    if (payload.type !== 'access' || typeof payload.sub !== 'string') throw new ApiError(401, 'Session expired. Sign in again.', 'session_expired');
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(payload.sub) as User | undefined;
    if (!user || (allowed && !allowed.includes(user.role))) throw new ApiError(403, 'You do not have permission to perform this action.', 'forbidden');
    req.user = user;
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, 'Session expired. Sign in again.', 'session_expired'));
  }
};

export const customerAuth = auth(['customer']);
export const staffAuth = auth(['teller', 'loan_officer', 'admin']);
export const managementAuth = auth(['admin']);
