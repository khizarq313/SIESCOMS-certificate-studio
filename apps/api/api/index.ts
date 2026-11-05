import type { Request, Response } from 'express';
import app from '../src/index';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
