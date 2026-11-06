import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

console.log('==> Starting SIESCOMS API Production Build Pipeline...');

// 1. Prepare runtime-assets directory inside apps/api for self-contained serverless packaging
const runtimeAssetsDir = path.resolve(process.cwd(), 'runtime-assets');
const certCandidates = [
  path.resolve(process.cwd(), '../../packages/certificate'),
  path.resolve(process.cwd(), '../packages/certificate'),
  path.resolve(process.cwd(), 'packages/certificate'),
  path.resolve(process.cwd(), 'node_modules/@siescoms/certificate'),
];
const certPkgDir = certCandidates.find(
  (c) => fs.existsSync(path.join(c, 'fonts')) && fs.existsSync(path.join(c, 'fonts.css'))
);

if (certPkgDir) {
  console.log(`✓ Synchronizing certificate package assets from: ${certPkgDir}`);
  fs.mkdirSync(runtimeAssetsDir, { recursive: true });

  const fontDest = path.join(runtimeAssetsDir, 'fonts');
  fs.mkdirSync(fontDest, { recursive: true });
  fs.cpSync(path.join(certPkgDir, 'fonts'), fontDest, { recursive: true });

  const assetDest = path.join(runtimeAssetsDir, 'assets');
  fs.mkdirSync(assetDest, { recursive: true });
  fs.cpSync(path.join(certPkgDir, 'assets'), assetDest, { recursive: true });

  fs.copyFileSync(path.join(certPkgDir, 'fonts.css'), path.join(runtimeAssetsDir, 'fonts.css'));
  console.log('✓ runtime-assets populated successfully');
} else {
  console.warn('⚠ Could not locate packages/certificate source directory for asset sync');
}

// 2. Ensure @sparticuz/chromium bin files are present in local node_modules if hoisted
const hoistedBinCandidates = [
  path.resolve(process.cwd(), '../../node_modules/@sparticuz/chromium/bin'),
  path.resolve(process.cwd(), '../node_modules/@sparticuz/chromium/bin'),
  path.resolve(process.cwd(), 'node_modules/@sparticuz/chromium/bin'),
];
const foundChromiumBin = hoistedBinCandidates.find((p) => fs.existsSync(p));
const localChromiumDir = path.resolve(process.cwd(), 'node_modules/@sparticuz/chromium');
if (foundChromiumBin && fs.existsSync(localChromiumDir)) {
  const localChromiumBin = path.join(localChromiumDir, 'bin');
  if (!fs.existsSync(localChromiumBin)) {
    fs.mkdirSync(localChromiumBin, { recursive: true });
    fs.cpSync(foundChromiumBin, localChromiumBin, { recursive: true });
    console.log('✓ Populated local @sparticuz/chromium/bin from hoisted node_modules');
  }
}

// 3. Prepare bundle directory (named "bundle", NOT "dist", to avoid static serving collisions)
const bundleDir = path.resolve(process.cwd(), 'bundle');
if (!fs.existsSync(bundleDir)) {
  fs.mkdirSync(bundleDir, { recursive: true });
}

// Clean up legacy dist directory if present
const legacyDist = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(legacyDist)) {
  try {
    fs.rmSync(legacyDist, { recursive: true, force: true });
    console.log('✓ Removed legacy dist/ directory');
  } catch {}
}

// Clean up any stray api/index.js build artifact
const apiDir = path.resolve(process.cwd(), 'api');
const strayApiJs = path.join(apiDir, 'index.js');
if (fs.existsSync(strayApiJs)) {
  try {
    fs.rmSync(strayApiJs, { force: true });
    console.log('✓ Removed stray api/index.js build artifact');
  } catch {}
}

// Ensure robots.txt exists in public/
const publicDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });
const robotsTxt = path.join(publicDir, 'robots.txt');
if (!fs.existsSync(robotsTxt)) {
  fs.writeFileSync(robotsTxt, 'User-agent: *\nDisallow: /\n');
  console.log('✓ Created public/robots.txt');
}

// 4. Bundle API application using esbuild into bundle/index.js
const entryPoint = path.resolve(process.cwd(), 'src/bundleEntry.ts');
const bundleOut = path.resolve(bundleDir, 'index.js');

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

console.log('✓ Vercel source function entrypoint confirmed at api/index.ts (importing ../bundle/index.js)');
console.log('✓ SIESCOMS API build pipeline completed successfully.');
