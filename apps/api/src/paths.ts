import path from 'node:path';
import fs from 'node:fs';

const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

function findPkgDir(): string {
  const candidates = [
    // 1. Dedicated runtime-assets inside apps/api (isolated serverless container deployment)
    path.resolve(process.cwd(), 'runtime-assets'),
    path.resolve(process.cwd(), 'apps/api/runtime-assets'),
    path.resolve(baseDir, 'runtime-assets'),
    path.resolve(baseDir, '../runtime-assets'),
    path.resolve(baseDir, '../../runtime-assets'),
    // 2. Monorepo packages/certificate directory from various working directories
    path.resolve(process.cwd(), '../../packages/certificate'),
    path.resolve(process.cwd(), '../packages/certificate'),
    path.resolve(process.cwd(), 'packages/certificate'),
    path.resolve(baseDir, '../../packages/certificate'),
    path.resolve(baseDir, '../packages/certificate'),
    path.resolve(baseDir, 'packages/certificate'),
    path.resolve(baseDir, '..'),
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), 'apps/api'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'fonts.css')) && fs.existsSync(path.join(c, 'fonts'))) {
      return c;
    }
  }
  return candidates[0];
}

/** The shared certificate package (fonts, art, fonts.css). */
export const PKG_DIR = findPkgDir();
