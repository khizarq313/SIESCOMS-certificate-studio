import app from '../dist/index.js';

export default function handler(req, res) {
  return app(req, res);
}
