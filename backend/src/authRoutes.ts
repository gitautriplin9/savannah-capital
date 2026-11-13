import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import { ACCESS_SECRET, REFRESH_SECRET } from './config.js';
import { db } from './db.js';
import { audit, ApiError } from './ledger.js';
import { auth, validate, type Role, type User } from './middleware.js';

export const authRoutes = express.Router();
const demoUsers: Record<Role, string> = { customer: 'u-salim', teller: 'u-teller', loan_officer: 'u-loan', admin: 'u-admin' };
const tokens = (user: User) => ({
  accessToken: jwt.sign({ sub: user.id, role: user.role, type: 'access' }, ACCESS_SECRET, { expiresIn: '15m' }),
  refreshToken: jwt.sign({ sub: user.id, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '7d' }),
});
const safeUser = (user: User) => ({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, kycStatus: user.kyc_status });
const normalizePhone = (value: string) => value.replace(/\s+/g, '').replace(/[()\-]/g, '').replace(/^\+/, '').replace(/\D/g, '');
const findUserByIdentifier = (identifier: string) => {
  const target = identifier.trim();
  if (!target) return undefined;
  const users = db.prepare('SELECT * FROM users').all() as User[];
  const normalizedPhone = normalizePhone(target);
  const normalizedEmail = target.toLowerCase();
  return users.find((user) => user.email.toLowerCase() === normalizedEmail || normalizePhone(user.phone) === normalizedPhone || user.phone === target || user.phone.replace(/\s+/g, '') === target.replace(/\s+/g, ''));
};

authRoutes.post('/login', (req, res, next) => {
  try {
    const input = validate(z.object({ identifier: z.string().trim().min(1).optional(), email: z.string().trim().optional(), phone: z.string().trim().optional(), password: z.string().min(1) }), req.body);
    const identifier = input.identifier ?? input.email ?? input.phone;
    if (!identifier) throw new ApiError(400, 'Email or phone number is required.', 'missing_identifier');
    const user = findUserByIdentifier(identifier) as (User & { password_hash: string; locked_until: string | null; failed_logins: number }) | undefined;
    if (!user) throw new ApiError(401, 'Email or password is incorrect.', 'invalid_credentials');
    if (user.locked_until && Date.parse(user.locked_until) > Date.now()) throw new ApiError(423, 'Account is temporarily locked. Try again in 15 minutes.', 'account_locked');
    if (!bcrypt.compareSync(input.password, user.password_hash)) {
      const failed = user.failed_logins + 1;
      db.prepare('UPDATE users SET failed_logins=?,locked_until=? WHERE id=?').run(failed, failed >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null, user.id);
      audit(user.id, 'login_failed', { attempts: failed });
      throw new ApiError(failed >= 5 ? 423 : 401, failed >= 5 ? 'Account locked for 15 minutes after five failed attempts.' : 'Email or password is incorrect.', failed >= 5 ? 'account_locked' : 'invalid_credentials');
    }
    db.prepare('UPDATE users SET failed_logins=0,locked_until=NULL WHERE id=?').run(user.id);
    audit(user.id, 'login', { role: user.role });
    res.json({ user: safeUser(user), ...tokens(user) });
  } catch (error) { next(error); }
});

authRoutes.post('/register', (req, res, next) => {
  try {
    const input = validate(z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email(),
      phone: z.string().trim().min(7).max(20),
      password: z.string().min(8).max(128),
    }), req.body);

    const email = input.email.toLowerCase();
    if (db.prepare('SELECT 1 FROM users WHERE email=? OR phone=?').get(email, input.phone.trim())) {
      throw new ApiError(409, 'An account with that email or phone number already exists.', 'user_exists');
    }

    const userId = `u-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const pinHash = bcrypt.hashSync('1234', 10);
    db.prepare(`INSERT INTO users (id,email,password_hash,pin_hash,name,phone,role,status,kyc_status,created_at)
      VALUES (?,?,?,?,?,?,?,'active','approved',?)`).run(
      userId,
      email,
      bcrypt.hashSync(input.password, 10),
      pinHash,
      input.name.trim(),
      input.phone.trim(),
      'customer',
      createdAt,
    );

    const createAccount = (type: string, name: string) => {
      const accountId = crypto.randomUUID();
      const number = `${Math.floor(10000000 + Math.random() * 90000000)}`;
      db.prepare('INSERT INTO accounts (id,user_id,type,name,number,created_at) VALUES (?,?,?,?,?,?)')
        .run(accountId, userId, type, name, number, createdAt);
      return accountId;
    };

    createAccount('current', 'Current Account');
    createAccount('savings', 'KCB Goal Savings');
    createAccount('mobile', 'M-Pesa Virtual Account');

    const user = db.prepare('SELECT * FROM users WHERE id=?').get(userId) as User;
    audit(user.id, 'user_registered', { email, role: user.role });
    res.status(201).json({ user: safeUser(user), ...tokens(user) });
  } catch (error) { next(error); }
});

authRoutes.post('/reset-password', (req, res, next) => {
  try {
    const input = validate(z.object({
      identifier: z.string().trim().min(2).max(120),
      password: z.string().min(8).max(128),
    }), req.body);

    const user = findUserByIdentifier(input.identifier);
    if (!user) {
      return res.json({ success: true, message: 'If an account matches that email or phone number, the password has been updated.' });
    }

    db.prepare('UPDATE users SET password_hash=?,failed_logins=0,locked_until=NULL WHERE id=?').run(bcrypt.hashSync(input.password, 10), user.id);
    audit(user.id, 'password_reset', { via: 'email_or_phone' });
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) { next(error); }
});

authRoutes.post('/demo-login', (req, res, next) => {
  try {
    const { role } = validate(z.object({ role: z.enum(['customer', 'teller', 'loan_officer', 'admin']) }), req.body);
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(demoUsers[role]) as User;
    audit(user.id, 'demo_login', { role });
    res.json({ user: safeUser(user), ...tokens(user) });
  } catch (error) { next(error); }
});

authRoutes.post('/refresh', (req, res, next) => {
  try {
    const { refreshToken } = validate(z.object({ refreshToken: z.string().min(1) }), req.body);
    const payload = jwt.verify(refreshToken, REFRESH_SECRET) as JwtPayload;
    if (payload.type !== 'refresh' || typeof payload.sub !== 'string') throw new ApiError(401, 'Session expired. Sign in again.');
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(payload.sub) as User | undefined;
    if (!user) throw new ApiError(401, 'Session expired. Sign in again.');
    res.json(tokens(user));
  } catch (error) { next(error instanceof ApiError ? error : new ApiError(401, 'Session expired. Sign in again.')); }
});

authRoutes.get('/me', auth(), (req, res) => res.json(safeUser(req.user!)));
