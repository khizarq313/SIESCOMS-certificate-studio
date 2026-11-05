// Draws an uploaded certificate (PDF page or image) to a canvas in the browser,
// for the editor background and for picking cover-patch colours. The server
// still prints from the original vector file.
import type { Background } from '@siescoms/certificate';
import { resolveApiUrl } from './api';

export interface RenderedBackground { url: string; canvas: HTMLCanvasElement }
const cache = new Map<string, Promise<RenderedBackground>>();

async function renderPdfPage(fileKey: string, pageIndex: number): Promise<HTMLCanvasElement> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const task = pdfjs.getDocument({ url: resolveApiUrl(`/api/files/${fileKey}`), withCredentials: true });
  const doc = await task.promise;
  const page = await doc.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(3, 2000 / Math.max(base.width, base.height)) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  await page.render({ canvas, viewport: vp }).promise;
  await task.destroy();
  return canvas;
}

async function renderImage(fileKey: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = resolveApiUrl(`/api/files/${fileKey}`);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return canvas;
}

export function renderBackground(bg: Background): Promise<RenderedBackground> {
  const key = `${bg.fileKey}#${bg.pageIndex}`;
  let p = cache.get(key);
  if (!p) {
    p = (bg.fileType === 'pdf' ? renderPdfPage(bg.fileKey, bg.pageIndex) : renderImage(bg.fileKey)).then(
      (canvas) => new Promise<RenderedBackground>((res, rej) => canvas.toBlob((b) => (b ? res({ url: URL.createObjectURL(b), canvas }) : rej(new Error('render failed'))), 'image/png')),
    );
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** The most common colour along the edge of a box (page points), to match paper colour under old text. */
export function paperColorAround(canvas: HTMLCanvasElement, page: { w: number; h: number }, box: { x: number; y: number; w: number; h: number }): string {
  const k = canvas.width / page.w;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '#FFFFFF';
  const counts = new Map<string, number>();
  const sample = (x: number, y: number) => {
    const px = Math.round(Math.max(0, Math.min(canvas.width - 1, x * k)));
    const py = Math.round(Math.max(0, Math.min(canvas.height - 1, y * k)));
    const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    counts.set(hex, (counts.get(hex) || 0) + 1);
  };
  for (let i = 0; i <= 20; i++) {
    const x = box.x + (box.w * i) / 20, y = box.y + (box.h * i) / 20;
    sample(x, box.y - 2); sample(x, box.y + box.h + 2); sample(box.x - 2, y); sample(box.x + box.w + 2, y);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0].toUpperCase() || '#FFFFFF';
}
