import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';

const COOKIE = 'cc_session';
const MAX_AGE_MS = 7 * 24 * 3600_000;

// Without SESSION_SECRET, sessions last until the API restarts.
const secret = env.sessionSecret || crypto.randomBytes(32).toString('hex');

const sign = (payload: string) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

function makeToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function validToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}

function passwordMatches(input: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(env.appPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (validToken(req.cookies?.[COOKIE])) return next();
  res.status(401).json({ error: 'Please sign in.' });
}

export const authRouter = Router();

authRouter.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in a few minutes.' } }),
  (req: Request, res: Response) => {
    if (!env.appPassword) { res.status(500).json({ error: 'APP_PASSWORD is not set on the server.' }); return; }
    const pw = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!passwordMatches(pw)) { res.status(401).json({ error: "That password isn't right." }); return; }
    res.cookie(COOKIE, makeToken(), { httpOnly: true, sameSite: 'lax', secure: env.isProd && process.env.COOKIE_SECURE !== 'false', maxAge: MAX_AGE_MS, path: '/' });
    res.json({ ok: true });
  });

authRouter.post('/logout', (_req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });
authRouter.get('/me', (req, res) => { res.json({ signedIn: validToken(req.cookies?.[COOKIE]) }); });
