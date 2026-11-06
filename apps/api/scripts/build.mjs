import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

console.log('==> Starting SIESCOMS API Production Build Pipeline...');

// 1. Locate packages/certificate static assets and fonts
const candidates = [
  path.resolve(process.cwd(), '../../packages/certificate'),
  path.resolve(process.cwd(), '../packages/certificate'),
  path.resolve(process.cwd(), 'packages/certificate'),
  path.resolve(process.cwd(), 'node_modules/@siescoms/certificate'),
];

const rootPkg = candidates.find(
  (c) => fs.existsSync(path.join(c, 'assets')) && fs.existsSync(path.join(c, 'fonts'))
);

if (rootPkg) {
  console.log(`✓ Located certificate package at: ${rootPkg}`);

  // Copy assets and fonts to local and public directories
  const copies = [
    { src: path.join(rootPkg, 'assets'), dest: path.resolve(process.cwd(), 'assets') },
    { src: path.join(rootPkg, 'fonts'), dest: path.resolve(process.cwd(), 'fonts') },
    { src: path.join(rootPkg, 'assets'), dest: path.resolve(process.cwd(), 'public/static/assets') },
    { src: path.join(rootPkg, 'fonts'), dest: path.resolve(process.cwd(), 'public/static/fonts') },
    { src: path.join(rootPkg, 'assets'), dest: path.resolve(process.cwd(), 'public/assets') },
    { src: path.join(rootPkg, 'fonts'), dest: path.resolve(process.cwd(), 'public/fonts') },
  ];

  for (const { src, dest } of copies) {
    if (fs.existsSync(src)) {
      fs.mkdirSync(dest, { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
    }
  }

  // Copy fonts.css
  const fontsCssSrc = path.join(rootPkg, 'fonts.css');
  if (fs.existsSync(fontsCssSrc)) {
    const cssDests = [
      path.resolve(process.cwd(), 'fonts.css'),
      path.resolve(process.cwd(), 'public/fonts.css'),
      path.resolve(process.cwd(), 'public/static/fonts.css'),
    ];
    for (const dest of cssDests) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(fontsCssSrc, dest);
    }
    console.log('✓ Synchronized fonts.css to root and public distributions');
  }
} else {
  console.warn('⚠ Could not locate external packages/certificate directory; skipping asset copy');
}

// 2. Prepare dist directory
const outdir = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

// Clean up any test artifacts if present
const testBundle = path.join(outdir, 'test-bundle.js');
if (fs.existsSync(testBundle)) {
  try { fs.rmSync(testBundle, { force: true }); } catch {}
}

// 3. Bundle API application using esbuild
const entryPoint = path.resolve(process.cwd(), 'src/index.ts');
const bundleOut = path.resolve(outdir, 'index.js');

console.log(`✓ Bundling API entrypoint with esbuild: ${entryPoint} -> ${bundleOut}`);

try {
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: bundleOut,
    packages: 'external',
    sourcemap: true,
    logLevel: 'warning',
  });
  const stat = fs.statSync(bundleOut);
  console.log(`✓ Production bundle generated successfully (${(stat.size / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('❌ esbuild bundling failed:', err);
  process.exit(1);
}

// 4. Ensure Vercel Serverless Function entry point imports generated output
const apiDir = path.resolve(process.cwd(), 'api');
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

const apiIndexJs = path.join(apiDir, 'index.js');
const apiIndexJsContent = `import app from '../dist/index.js';

export default function handler(req, res) {
  return app(req, res);
}
`;
fs.writeFileSync(apiIndexJs, apiIndexJsContent);

const apiIndexTs = path.join(apiDir, 'index.ts');
const apiIndexTsContent = `import type { Request, Response } from 'express';
// @ts-ignore - dist/index.js is created during build
import app from '../dist/index.js';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
`;
fs.writeFileSync(apiIndexTs, apiIndexTsContent);

console.log('✓ Vercel function entrypoints configured to import generated output (../dist/index.js)');
console.log('✓ SIESCOMS API build pipeline completed successfully.');
