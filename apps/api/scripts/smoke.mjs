import http from 'node:http';

console.log('==> Running Production Bundle Smoke Test in plain Node...');

process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

let app;
try {
  const mod = await import('../bundle/index.js');
  app = mod.default || mod;
} catch (err) {
  console.error('❌ Failed to import ../bundle/index.js:', err);
  process.exit(1);
}

const server = http.createServer(app);

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const addr = server.address();
const baseUrl = `http://127.0.0.1:${addr.port}`;
console.log(`✓ Ephemeral test server listening on ${baseUrl}`);

const checks = [
  { path: '/', expectedStatus: 200, checkBody: (b, h) => h.get('content-type')?.includes('application/json') },
  { path: '/health', expectedStatus: 200, checkBody: (b, h) => h.get('content-type')?.includes('application/json') },
  { path: '/api/health', expectedStatus: 200, checkBody: (b, h) => h.get('content-type')?.includes('application/json') },
  { path: '/api/static/fonts.css', expectedStatus: 200, checkBody: (b, h) => h.get('content-type')?.includes('text/css') },
  { path: '/api/static/fonts/GreatVibes.woff2', expectedStatus: 200, checkBody: (b, h) => h.get('content-type')?.includes('font/woff2') },
  { path: '/api/static/assets/sun.svg', expectedStatus: 200, checkBody: (b, h) => h.get('content-type')?.includes('svg') },
  { path: '/dist/index.js', expectedStatus: 404, checkBody: (b, h) => b.includes('"error"') && h.get('content-type')?.includes('application/json') },
  { path: '/api/auth/me', expectedStatus: 200, checkBody: (b) => { try { return JSON.parse(b).signedIn === false; } catch { return false; } } },
];

let failed = 0;
for (const check of checks) {
  try {
    const res = await fetch(`${baseUrl}${check.path}`);
    const text = await res.text();
    const statusMatch = res.status === check.expectedStatus;
    const bodyMatch = check.checkBody ? check.checkBody(text, res.headers) : true;
    if (statusMatch && bodyMatch) {
      console.log(`  [OK] ${check.path} -> ${res.status}`);
    } else {
      console.error(`  [FAIL] ${check.path} -> expected ${check.expectedStatus}, got ${res.status}. Body: ${text.slice(0, 150)}`);
      failed++;
    }
  } catch (err) {
    console.error(`  [FAIL] ${check.path} -> request threw:`, err.message);
    failed++;
  }
}

server.close();

if (failed > 0) {
  console.error(`❌ Smoke test failed: ${failed} check(s) did not pass.`);
  process.exit(1);
} else {
  console.log('✓ All smoke test checks passed successfully!');
  process.exit(0);
}
