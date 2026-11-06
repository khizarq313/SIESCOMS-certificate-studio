import './config/env';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import multer from 'multer';
import { authRouter, requireAuth } from './auth';
import { api } from './routes';
import { PKG_DIR } from './paths';
import { isDbConnected } from './storage/db';
import { logger } from './utils/logger';
import { env } from './config/env';
import { mimeFor, safePath } from './utils/fileStorage';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // CORS middleware for separate frontend/backend deployments
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(express.json({ limit: '4.5mb' }));
  app.use(cookieParser());

  // Health and root status endpoints
  app.get('/', (_req, res) => {
    res.json({ name: 'SIESCOMS Certificate Studio API', status: 'online', ok: true });
  });
  app.get('/api', (_req, res) => {
    res.json({ name: 'SIESCOMS Certificate Studio API', status: 'online', ok: true });
  });
  app.get('/health', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });
  app.get('/api/readiness', async (_req, res) => {
    const dbOk = await isDbConnected();
    res.json({
      ok: true,
      status: 'ready',
      database: dbOk ? 'connected' : (env.mongoUri ? 'disconnected' : 'local-storage-mode'),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);

  // Explicit font stylesheet serving via res.sendFile
  const serveFontsCss = (_req: Request, res: Response) => {
    const candidates = [
      path.join(PKG_DIR, 'fonts.css'),
      path.resolve(process.cwd(), 'fonts.css'),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        return res.sendFile(file);
      }
    }
    return res.status(404).send('/* fonts.css not found */');
  };

  app.get('/api/static/fonts.css', serveFontsCss);
  app.get('/static/fonts.css', serveFontsCss);

  // Explicit built-in certificate art and font serving via res.sendFile
  const serveAsset = (req: Request, res: Response) => {
    try {
      const fileName = req.params.name;
      const file = safePath(path.join(PKG_DIR, 'assets'), fileName);
      if (fs.existsSync(file)) {
        res.setHeader('Content-Type', mimeFor(file));
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.sendFile(file);
      }
    } catch {}
    return res.status(404).json({ error: 'Asset not found' });
  };

  const serveFont = (req: Request, res: Response) => {
    try {
      const fileName = req.params.name;
      const file = safePath(path.join(PKG_DIR, 'fonts'), fileName);
      if (fs.existsSync(file)) {
        res.setHeader('Content-Type', mimeFor(file));
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        return res.sendFile(file);
      }
    } catch {}
    return res.status(404).json({ error: 'Font not found' });
  };

  app.get('/api/static/assets/:name', serveAsset);
  app.get('/static/assets/:name', serveAsset);
  app.get('/api/static/fonts/:name', serveFont);
  app.get('/static/fonts/:name', serveFont);

  app.use('/api', requireAuth, api);
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found.' }); });

  app.use((err: Error & { status?: number; code?: string }, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'File exceeds the 4.5 MB serverless upload limit. Please compress or resize the file.'
        : 'That upload could not be read.';
      res.status(400).json({ error: msg });
      return;
    }
    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) {
      logger.error('Unhandled server error', err, { url: req.url, method: req.method });
    }
    res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : err.message });
  });

  return app;
}
