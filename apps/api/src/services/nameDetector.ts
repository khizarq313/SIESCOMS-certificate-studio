// Finds the sample recipient name printed on an uploaded PDF certificate, so the
// editor can offer to cover it and put each person's name there instead.
// Adapted from the original bulk-certificate-generator detector.

export interface DetectedName { text: string; x: number; y: number; w: number; h: number; fontSize: number }

interface TextItem { str: string; x: number; y: number; w: number; h: number; fontSize: number }

const ANCHOR = /(presented to|certify that|certifies that|awarded to|in recognition of|conferred upon|appreciation to|given to|name of participant|participant name|student name|recipient name|certificate awarded to|honors to)/i;
const PLACEHOLDER = /(participant|recipient|candidate|john doe|jane doe|jane sample|student name|full name|your name|name here|first last|\[name\]|<name>|\{\{name\}\})/i;
const FOLLOW_UP = /^(for|in|on|with|during|dated|date|has|have|is|was|of|the)\b/i;

export async function detectName(bytes: Buffer, pageIndex = 0): Promise<DetectedName | null> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true, verbosity: 0 });
    const doc = await task.promise;
    const page = await doc.getPage(Math.min(pageIndex + 1, doc.numPages));
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const raw of content.items as Array<{ str?: string; transform?: number[]; width?: number }>) {
      const str = raw.str?.trim();
      if (!str || !raw.transform) continue;
      // Convert to top-left page coordinates (handles rotated pages via the viewport).
      const [x0, base] = vp.convertToViewportPoint(raw.transform[4], raw.transform[5]);
      const fontSize = Math.hypot(raw.transform[0], raw.transform[1]) || 12;
      const w = raw.width || fontSize * str.length * 0.55;
      items.push({ str, x: x0, y: base - fontSize * 0.85, w, h: fontSize * 1.15, fontSize });
    }
    await task.destroy();
    if (!items.length) return null;
    items.sort((a, b) => a.y - b.y);
    const box = (it: TextItem): DetectedName => ({
      text: it.str, x: Math.round(it.x - 6), y: Math.round(it.y - 3), w: Math.round(it.w + 12), h: Math.round(it.h + 6), fontSize: Math.round(it.fontSize * 10) / 10,
    });

    // 1. The line after "presented to", "certify that", …
    for (let i = 0; i < items.length; i++) {
      if (!ANCHOR.test(items[i].str)) continue;
      const next = items.slice(i + 1).find((c) => c.y - items[i].y > 6 && c.y - items[i].y < 150 && !FOLLOW_UP.test(c.str) && !ANCHOR.test(c.str));
      if (next) return box(next);
    }
    // 2. Obvious placeholder text.
    const ph = items.find((it) => PLACEHOLDER.test(it.str));
    if (ph) return box(ph);
    // 3. The largest text in the middle of the page that isn't the title.
    const mid = items.filter((it) => it.y > vp.height * 0.25 && it.y < vp.height * 0.65 && it.str.length > 2 && !/certificate|achievement|appreciation|excellence|participation/i.test(it.str));
    if (mid.length) return box(mid.sort((a, b) => b.fontSize - a.fontSize)[0]);
    return null;
  } catch (err) {
    console.warn('Name detection failed:', (err as Error).message);
    return null;
  }
}
