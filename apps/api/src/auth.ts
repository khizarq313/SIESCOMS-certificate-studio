import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';

const COOKIE = 'cc_session';
const MAX_AGE_MS = 7 * 24 * 3600_000;

// Fallback random secret for local development only
const devSecret = crypto.randomBytes(32).toString('hex');

function getSecret(): string {
  if (env.sessionSecret) return env.sessionSecret;
  if (env.isProd || Boolean(process.env.VERCEL)) {
    return '';
  }
  return devSecret;
}

const sign = (payload: string, secret: string) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

function makeToken(): string {
  const secret = getSecret();
  if (!secret) throw new Error('SESSION_SECRET is missing');
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE_MS })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

function validToken(token: string | undefined): boolean {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload, secret);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}

function passwordMatches(input: string): boolean {
  if (!env.appPassword) return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(env.appPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

function extractToken(req: Request): string | undefined {
  if (req.cookies?.[COOKIE]) return req.cookies[COOKIE];
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (validToken(extractToken(req))) return next();
  res.status(401).json({ error: 'Please sign in.' });
}

export const authRouter = Router();

authRouter.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in a few minutes.' } }),
  (req: Request, res: Response) => {
    if ((env.isProd || Boolean(process.env.VERCEL)) && !env.sessionSecret) {
      res.status(500).json({ error: 'SESSION_SECRET is not configured on the server. Please set SESSION_SECRET in Vercel project settings.' });
      return;
    }
    if (!env.appPassword) {
      res.status(500).json({ error: 'APP_PASSWORD is not set on the server.' });
      return;
    }
    const pw = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!passwordMatches(pw)) {
      res.status(401).json({ error: "That password isn't right." });
      return;
    }
    const token = makeToken();
    const isCrossDomain = process.env.COOKIE_SAMESITE === 'none';
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: isCrossDomain ? 'none' : 'lax',
      secure: isCrossDomain || (env.isProd && process.env.COOKIE_SECURE !== 'false'),
      maxAge: MAX_AGE_MS,
      path: '/'
    });
    res.json({ ok: true, token });
  });

authRouter.post('/logout', (_req, res) => {
  const isCrossDomain = process.env.COOKIE_SAMESITE === 'none';
  res.clearCookie(COOKIE, {
    path: '/',
    sameSite: isCrossDomain ? 'none' : 'lax',
    secure: isCrossDomain || (env.isProd && process.env.COOKIE_SECURE !== 'false'),
  });
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ signedIn: validToken(extractToken(req)) });
});
