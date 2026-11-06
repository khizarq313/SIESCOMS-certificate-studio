import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

console.log('==> Starting SIESCOMS API Production Build Pipeline...');

// 1. Prepare dist directory
const outdir = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

// 2. Clean up any accidental or legacy JS files in source directories
const apiDir = path.resolve(process.cwd(), 'api');
const strayApiJs = path.join(apiDir, 'index.js');
if (fs.existsSync(strayApiJs)) {
  try {
    fs.rmSync(strayApiJs, { force: true });
    console.log('✓ Removed stray api/index.js build artifact');
  } catch {}
}

// 3. Bundle API application using esbuild into dist/index.js
// Inlines @siescoms/certificate and JSON metrics; externalizes packages that cannot be bundled.
const entryPoint = path.resolve(process.cwd(), 'src/bundleEntry.ts');
const bundleOut = path.resolve(outdir, 'index.js');

console.log(`✓ Bundling API entrypoint with esbuild: ${entryPoint} -> ${bundleOut}`);

try {
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    outfile: bundleOut,
    external: [
      'playwright-core',
      '@sparticuz/chromium',
      'playwright',
      'mongodb',
      '@vercel/functions',
      'pdfjs-dist',
    ],
    sourcemap: true,
    logLevel: 'warning',
    loader: {
      '.json': 'json',
    },
  });
  const stat = fs.statSync(bundleOut);
  console.log(`✓ Production bundle generated successfully (${(stat.size / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('❌ esbuild bundling failed:', err);
  process.exit(1);
}

// 4. Ensure api/index.ts exists as the sole source entrypoint importing dist/index.js
const apiIndexTs = path.join(apiDir, 'index.ts');
if (!fs.existsSync(apiIndexTs)) {
  const apiIndexTsContent = `import type { Request, Response } from 'express';
// @ts-ignore - dist/index.js is created during build
import app from '../dist/index.js';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
`;
  fs.writeFileSync(apiIndexTs, apiIndexTsContent);
}

console.log('✓ Vercel source function entrypoint confirmed at api/index.ts');
console.log('✓ SIESCOMS API build pipeline completed successfully.');
