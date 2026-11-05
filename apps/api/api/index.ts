import type { Request, Response } from 'express';
import { createApp } from '../src/app';

let app: any = null;
let initError: any = null;

try {
  app = createApp();
} catch (err: any) {
  initError = err;
  console.error('FATAL: Express app initialization error in api/index.ts:', err);
}

export default function handler(req: Request, res: Response) {
  if (initError) {
    return res.status(500).json({
      error: 'API Initialization Failed',
      message: initError?.message || String(initError),
      stack: initError?.stack,
    });
  }
  if (!app) {
    try {
      app = createApp();
    } catch (err: any) {
      initError = err;
      return res.status(500).json({
        error: 'API Lazy Initialization Failed',
        message: err?.message || String(err),
        stack: err?.stack,
      });
    }
  }
  return app(req, res);
}
