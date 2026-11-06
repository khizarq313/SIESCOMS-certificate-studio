import type { Request, Response } from 'express';
// @ts-ignore - dist/index.js is created during build
import app from '../dist/index.js';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
