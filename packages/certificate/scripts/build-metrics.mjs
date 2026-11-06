// Builds src/metrics.data.json: advance widths for every certificate font face,
// so the editor and the PDF renderer shrink long names identically.
import * as fontkit from 'fontkit';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decompress } from 'wawoff2';

const dir = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(dir, '..', 'fonts');

// [regular, bold, italic, boldItalic] file + weight. Missing faces fall back to regular
// (the browser synthesises them without changing advance widths).
const V = (f) => [[f, 400], [f, 700], [f.replace('.woff2', '-Italic.woff2'), 400], [f.replace('.woff2', '-Italic.woff2'), 700]];
const S = (f) => [[f, 400], [f, 400], [f, 400], [f, 400]];
const Q = (b) => [[`${b}-Regular.woff2`], [`${b}-Bold.woff2`], [`${b}-Italic.woff2`], [`${b}-BoldItalic.woff2`]];
const FACES = {
  GreatVibes: S('GreatVibes.woff2'), AlexBrush: S('AlexBrush.woff2'), PinyonScript: S('PinyonScript.woff2'), Allura: S('Allura.woff2'),
  Parisienne: S('Parisienne.woff2'), Italianno: S('Italianno.woff2'), Marcellus: S('Marcellus.woff2'),
  DancingScript: [['DancingScript.woff2', 400], ['DancingScript.woff2', 700], ['DancingScript.woff2', 400], ['DancingScript.woff2', 700]],
  Cinzel: [['Cinzel.woff2', 400], ['Cinzel.woff2', 700], ['Cinzel.woff2', 400], ['Cinzel.woff2', 700]],
  CinzelDecorative: [['CinzelDecorative.woff2'], ['CinzelDecorative-Bold.woff2'], ['CinzelDecorative.woff2'], ['CinzelDecorative-Bold.woff2']],
  PlayfairDisplay: V('PlayfairDisplay.woff2'), CormorantGaramond: V('CormorantGaramond.woff2'), EBGaramond: V('EBGaramond.woff2'),
  LibreBaskerville: V('LibreBaskerville.woff2'), Montserrat: V('Montserrat.woff2'), Raleway: V('Raleway.woff2'), JosefinSans: V('JosefinSans.woff2'),
  Helvetica: V('Arimo.woff2'), Poppins: Q('Poppins'), TimesRoman: Q('Tinos'), Courier: Q('Cousine'),
};

const chars = [];
for (let c = 32; c < 127; c++) chars.push(c);
for (let c = 160; c < 384; c++) chars.push(c);
chars.push(0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20b9);

const cache = new Map();
const open = (file) => {
  if (!cache.has(file)) {
    cache.set(file, (async () => {
      const filePath = path.join(fontsDir, file);
      const woff2Buf = readFileSync(filePath);
      const ttfU8 = await decompress(woff2Buf);
      const ttfBuf = Buffer.from(ttfU8.buffer, ttfU8.byteOffset, ttfU8.byteLength);
      return fontkit.create(ttfBuf);
    })());
  }
  return cache.get(file);
};

const out = { chars: String.fromCodePoint(...chars), faces: {} };
for (const [key, faces] of Object.entries(FACES)) {
  out.faces[key] = [];
  for (const [file, wght] of faces) {
    let font = await open(file);
    if (wght && font.variationAxes?.wght) {
      const ax = font.variationAxes.wght;
      font = font.getVariation({ wght: Math.max(ax.min, Math.min(ax.max, wght)) });
    }
    const upm = font.unitsPerEm;
    const widths = chars.map((c) => {
      const run = font.layout(String.fromCodePoint(c));
      const adv = run.positions.reduce((a, p) => a + p.xAdvance, 0);
      return Math.round((adv / upm) * 1000);
    });
    // Fallback for characters outside the table: average lowercase width.
    const lower = chars.map((c, i) => (c >= 97 && c <= 122 ? widths[i] : null)).filter((x) => x != null);
    const avg = Math.round(lower.reduce((a, b) => a + b, 0) / lower.length);
    out.faces[key].push({ w: widths, avg });
  }
}
writeFileSync(path.join(dir, '..', 'src', 'metrics.data.json'), JSON.stringify(out));
console.log('metrics written for', Object.keys(out.faces).length, 'fonts');
