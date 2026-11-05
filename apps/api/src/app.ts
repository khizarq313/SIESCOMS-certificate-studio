import './config/env';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import multer from 'multer';
import { authRouter, requireAuth } from './auth';
import { api } from './routes';
import { PKG_DIR } from './paths';


export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(express.json({ limit: '25mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => { res.json({ ok: true }); });
  app.use('/api/auth', authRouter);
  // Built-in certificate art and fonts are public.
  app.use('/api/static/assets', express.static(path.join(PKG_DIR, 'assets'), { maxAge: '7d', fallthrough: false }));
  app.use('/api/static/fonts', express.static(path.join(PKG_DIR, 'fonts'), { maxAge: '30d', fallthrough: false }));
  app.use('/api', requireAuth, api);
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found.' }); });

  app.use((err: Error & { status?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too big.' : 'That upload could not be read.';
      res.status(400).json({ error: msg });
      return;
    }
    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error('Server error:', err);
    res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : err.message });
  });
  return app;
}
