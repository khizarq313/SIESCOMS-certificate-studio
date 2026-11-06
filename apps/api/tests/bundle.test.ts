import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

describe('production bundle and vercel entry point verification', () => {
  let app: any;
  let vercelHandler: any;

  beforeAll(async () => {
    process.env.VERCEL = '1';
    process.env.APP_PASSWORD = 'test-password-123';
    delete process.env.SESSION_SECRET;
    delete process.env.MONGODB_URI;

    // Import the compiled production bundle from bundle/index.js
    // @ts-ignore
    const bundle = await import('../bundle/index.js');
    app = bundle.default;

    // Import the Vercel function entrypoint from api/index.ts
    // @ts-ignore
    const apiEntry = await import('../api/index');
    vercelHandler = apiEntry.default;
  });

  it('verifies generated bundle resolves all dependencies and loads the Express app', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
    expect(typeof vercelHandler).toBe('function');
  });

  it('responds with 200 JSON on / and /health (never raw JS source)', async () => {
    const resRoot = await request(app).get('/');
    expect(resRoot.status).toBe(200);
    expect(resRoot.body.ok).toBe(true);
    expect(resRoot.body.name).toBe('SIESCOMS Certificate Studio API');
    expect(resRoot.headers['content-type']).toContain('application/json');

    const resHealth = await request(app).get('/health');
    expect(resHealth.status).toBe(200);
    expect(resHealth.body.ok).toBe(true);
    expect(typeof resHealth.body.uptime).toBe('number');
  });

  it('responds with 200 on /api/health and /api', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.uptime).toBe('number');

    const resApi = await request(app).get('/api');
    expect(resApi.status).toBe(200);
    expect(resApi.body.ok).toBe(true);
  });

  it('responds with 200 on /api/readiness', async () => {
    const res = await request(app).get('/api/readiness');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe('ready');
    expect(res.body.database).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it('serves static font stylesheet at /api/static/fonts.css and /static/fonts.css', async () => {
    const r1 = await request(app).get('/api/static/fonts.css');
    expect(r1.status).toBe(200);
    expect(r1.headers['content-type']).toContain('text/css');
    expect(r1.text).toContain('@font-face');
    expect(r1.text).toContain('woff2');

    const r2 = await request(app).get('/static/fonts.css');
    expect(r2.status).toBe(200);
    expect(r2.headers['content-type']).toContain('text/css');
  });

  it('serves built-in static asset sun.svg from bundled app', async () => {
    const res = await request(app).get('/api/static/assets/sun.svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('svg');
  });

  it('serves built-in woff2 font GreatVibes.woff2 with correct mime type', async () => {
    const res = await request(app).get('/api/static/fonts/GreatVibes.woff2');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('font/woff2');
  });

  it('handles unauthenticated /api/auth/me cleanly', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.signedIn).toBe(false);
  });

  it('enforces SESSION_SECRET in production / Vercel during login with clear 500 error', async () => {
    delete process.env.SESSION_SECRET;
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'test-password-123' });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('SESSION_SECRET');
  });

  it('authenticates with valid password when SESSION_SECRET is set', async () => {
    process.env.SESSION_SECRET = 'a-secure-32-byte-secret-for-testing-only';
    const failRes = await request(app)
      .post('/api/auth/login')
      .send({ password: 'wrong-password' });
    expect(failRes.status).toBe(401);
    expect(failRes.body.error).toContain("password");

    const okRes = await request(app)
      .post('/api/auth/login')
      .send({ password: 'test-password-123' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.ok).toBe(true);
    expect(okRes.body.token).toBeDefined();

    const cookie = okRes.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect(meRes.status).toBe(200);
    expect(meRes.body.signedIn).toBe(true);
  });

  it('requires MONGODB_URI on Vercel for jobs with a clear error JSON', async () => {
    delete process.env.MONGODB_URI;
    process.env.SESSION_SECRET = 'a-secure-32-byte-secret-for-testing-only';
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ password: 'test-password-123' });
    const authCookie = loginRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/jobs')
      .set('Cookie', authCookie)
      .send({ delivery: 'download' });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('MONGODB_URI');
  });

  it('returns 404 JSON for bundle and source file paths, never raw source', async () => {
    const paths = ['/dist/index.js', '/bundle/index.js', '/src/app.ts', '/package.json'];
    for (const p of paths) {
      const res = await request(app).get(p);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found.');
      expect(res.headers['content-type']).toContain('application/json');
    }
  });

  it('executes Vercel serverless function entrypoint handler directly via supertest and returns JSON', async () => {
    const res = await request(vercelHandler).get('/');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.name).toBe('SIESCOMS Certificate Studio API');
  });
});
