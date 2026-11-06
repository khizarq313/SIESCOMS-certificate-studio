import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

describe('production bundle and vercel entry point verification', () => {
  let app: any;
  let vercelHandler: any;

  beforeAll(async () => {
    process.env.VERCEL = '1';
    // Import the compiled production bundle
    // @ts-ignore
    const bundle = await import('../dist/index.js');
    app = bundle.default;

    // Import the Vercel function entrypoint
    // @ts-ignore
    const apiEntry = await import('../api/index.js');
    vercelHandler = apiEntry.default;
  });

  it('verifies generated bundle resolves all dependencies and loads the Express app', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
    expect(typeof vercelHandler).toBe('function');
  });

  it('responds with 200 on /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.uptime).toBe('number');
  });

  it('responds with 200 on /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.uptime).toBe('number');
  });

  it('responds with 200 on /api/readiness', async () => {
    const res = await request(app).get('/api/readiness');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe('ready');
    expect(res.body.database).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it('responds with 200 on root endpoints / and /api', async () => {
    const r1 = await request(app).get('/');
    expect(r1.status).toBe(200);
    expect(r1.body.ok).toBe(true);
    expect(r1.body.name).toBe('SIESCOMS Certificate Studio API');

    const r2 = await request(app).get('/api');
    expect(r2.status).toBe(200);
    expect(r2.body.ok).toBe(true);
  });

  it('serves static font stylesheet at /api/static/fonts.css and /static/fonts.css', async () => {
    const r1 = await request(app).get('/api/static/fonts.css');
    expect(r1.status).toBe(200);
    expect(r1.headers['content-type']).toContain('text/css');
    expect(r1.text).toContain('@font-face');

    const r2 = await request(app).get('/static/fonts.css');
    expect(r2.status).toBe(200);
    expect(r2.headers['content-type']).toContain('text/css');
  });

  it('serves built-in static asset sun.svg from bundled app', async () => {
    const res = await request(app).get('/api/static/assets/sun.svg');
    expect(res.status).toBe(200);
  });

  it('handles unauthenticated /api/auth/me cleanly', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.signedIn).toBe(false);
  });

  it('executes Vercel serverless function entrypoint handler directly via supertest', async () => {
    const res = await request(vercelHandler).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
