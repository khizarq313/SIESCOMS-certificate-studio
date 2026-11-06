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

// 2. Prepare dist directory for bundled outputs (separated from source files)
const outdir = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

// 3. Clean up any accidental or legacy JS files in source directories (e.g. api/index.js)
const apiDir = path.resolve(process.cwd(), 'api');
const strayApiJs = path.join(apiDir, 'index.js');
if (fs.existsSync(strayApiJs)) {
  try {
    fs.rmSync(strayApiJs, { force: true });
    console.log('✓ Removed stray api/index.js build artifact');
  } catch {}
}

// 4. Bundle API application using esbuild into dist/index.js
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

// 5. Ensure api/index.ts exists as the sole source entrypoint importing dist/index.js
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

console.log('✓ Vercel source function entrypoint confirmed at api/index.ts (importing ../dist/index.js)');
console.log('✓ SIESCOMS API build pipeline completed successfully.');
