import fs from 'node:fs';
import path from 'node:path';

const rootPkg = path.resolve(process.cwd(), '../../packages/certificate');
const localAssets = path.resolve(process.cwd(), 'assets');
const localFonts = path.resolve(process.cwd(), 'fonts');

try {
  if (fs.existsSync(rootPkg)) {
    const assetsSrc = path.join(rootPkg, 'assets');
    const fontsSrc = path.join(rootPkg, 'fonts');
    if (fs.existsSync(assetsSrc)) {
      fs.cpSync(assetsSrc, localAssets, { recursive: true });
      console.log('✓ Copied certificate assets to apps/api/assets');
    }
    if (fs.existsSync(fontsSrc)) {
      fs.cpSync(fontsSrc, localFonts, { recursive: true });
      console.log('✓ Copied certificate fonts to apps/api/fonts');
    }
  }
} catch (err) {
  console.warn('Warning: Could not copy static assets during build:', err);
}

console.log('✓ SIESCOMS API build ready for Vercel.');
