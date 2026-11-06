import type { Request, Response } from 'express';

let appPromise: Promise<any> | null = null;

function getApp() {
  if (!appPromise) {
    // @ts-ignore - bundle/index.js is created during build
    appPromise = import('../bundle/index.js')
      .then((m) => m.default || m)
      .catch((err) => {
        appPromise = null; // Reset cached promise on failure so subsequent requests can retry
        throw err;
      });
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err: any) {
    console.error('SERVERLESS FUNCTION BOOT FAILED:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'server_boot_failed',
        message: err?.message || String(err),
        ...(process.env.DEBUG_BOOT === '1' ? { detail: String(err?.stack || err?.message || err) } : {}),
      });
    }
  }
}
