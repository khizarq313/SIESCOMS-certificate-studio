import path from 'node:path';
import fs from 'node:fs';

const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

function findPkgDir(): string {
  const candidates = [
    // 1. Local copy inside apps/api
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), 'apps/api'),
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'public/static'),
    path.resolve(baseDir, '..'),
    // 2. Monorepo packages/certificate directory
    path.resolve(baseDir, '../../packages/certificate'),
    path.resolve(baseDir, '../../../packages/certificate'),
    path.resolve(process.cwd(), '../../packages/certificate'),
    path.resolve(process.cwd(), '../packages/certificate'),
    path.resolve(process.cwd(), 'packages/certificate'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'assets')) || fs.existsSync(path.join(c, 'fonts'))) {
      return c;
    }
  }
  return candidates[0];
}

/** The shared certificate package (fonts, art, fonts.css). */
export const PKG_DIR = findPkgDir();
