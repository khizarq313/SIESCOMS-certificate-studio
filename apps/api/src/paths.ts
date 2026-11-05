import path from 'node:path';
import fs from 'node:fs';

function findPkgDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../packages/certificate'),
    path.resolve(__dirname, '../../../packages/certificate'),
    path.resolve(process.cwd(), 'packages/certificate'),
    path.resolve(process.cwd(), '../packages/certificate'),
    path.resolve(process.cwd(), '../../packages/certificate'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'package.json'))) return c;
  }
  return candidates[0];
}

/** The shared certificate package (fonts, art, fonts.css). */
export const PKG_DIR = findPkgDir();
