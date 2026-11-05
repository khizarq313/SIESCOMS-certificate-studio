// Builds src/metrics.data.json: advance widths for every certificate font face,
// so the editor and the PDF renderer shrink long names identically.
import * as fontkit from 'fontkit';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(dir, '..', 'fonts');

// [regular, bold, italic, boldItalic] file + weight. Missing faces fall back to regular
// (the browser synthesises them without changing advance widths).
const V = (f) => [[f, 400], [f, 700], [f.replace('.ttf', '-Italic.ttf'), 400], [f.replace('.ttf', '-Italic.ttf'), 700]];
const S = (f) => [[f, 400], [f, 400], [f, 400], [f, 400]];
const Q = (b) => [[`${b}-Regular.ttf`], [`${b}-Bold.ttf`], [`${b}-Italic.ttf`], [`${b}-BoldItalic.ttf`]];
const FACES = {
  GreatVibes: S('GreatVibes.ttf'), AlexBrush: S('AlexBrush.ttf'), PinyonScript: S('PinyonScript.ttf'), Allura: S('Allura.ttf'),
  Parisienne: S('Parisienne.ttf'), Italianno: S('Italianno.ttf'), Marcellus: S('Marcellus.ttf'),
  DancingScript: [['DancingScript.ttf', 400], ['DancingScript.ttf', 700], ['DancingScript.ttf', 400], ['DancingScript.ttf', 700]],
  Cinzel: [['Cinzel.ttf', 400], ['Cinzel.ttf', 700], ['Cinzel.ttf', 400], ['Cinzel.ttf', 700]],
  CinzelDecorative: [['CinzelDecorative.ttf'], ['CinzelDecorative-Bold.ttf'], ['CinzelDecorative.ttf'], ['CinzelDecorative-Bold.ttf']],
  PlayfairDisplay: V('PlayfairDisplay.ttf'), CormorantGaramond: V('CormorantGaramond.ttf'), EBGaramond: V('EBGaramond.ttf'),
  LibreBaskerville: V('LibreBaskerville.ttf'), Montserrat: V('Montserrat.ttf'), Raleway: V('Raleway.ttf'), JosefinSans: V('JosefinSans.ttf'),
  Helvetica: V('Arimo.ttf'), Poppins: Q('Poppins'), TimesRoman: Q('Tinos'), Courier: Q('Cousine'),
};

const chars = [];
for (let c = 32; c < 127; c++) chars.push(c);
for (let c = 160; c < 384; c++) chars.push(c);
chars.push(0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20b9);

const cache = new Map();
const open = (file) => { if (!cache.has(file)) cache.set(file, fontkit.openSync(path.join(fontsDir, file))); return cache.get(file); };

const out = { chars: String.fromCodePoint(...chars), faces: {} };
for (const [key, faces] of Object.entries(FACES)) {
  out.faces[key] = faces.map(([file, wght]) => {
    let font = open(file);
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
    return { w: widths, avg };
  });
}
writeFileSync(path.join(dir, '..', 'src', 'metrics.data.json'), JSON.stringify(out));
console.log('metrics written for', Object.keys(out.faces).length, 'fonts');
