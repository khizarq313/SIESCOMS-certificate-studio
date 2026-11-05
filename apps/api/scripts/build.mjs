import fs from 'node:fs';
import path from 'node:path';

// Locate packages/certificate
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
  console.log(`✓ Found certificate package at ${rootPkg}`);

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
    console.log('✓ Copied fonts.css');
  }
} else {
  console.warn('⚠ Could not locate packages/certificate static assets');
}

console.log('✓ SIESCOMS API build assets and fonts ready for Vercel.');
