// Prints certificates to vector PDF with headless Chromium, using the exact
// React component the editor shows. Uploaded PDF certificates keep their
// original (vector) page: only the overlay is printed, then stamped on top.
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, type Browser, type Page, type Route } from 'playwright';
import { PDFDocument, degrees } from 'pdf-lib';
import { ASSET_FILES, Certificate, fontFamilyName, fontsUsed, type Design, type Values } from '@siescoms/certificate';
import { FILES_DIR, mimeFor, safePath } from '../utils/fileStorage';
import { PKG_DIR } from '../paths';

// A made-up origin. Every request to it is answered from disk; everything else is blocked.
const ORIGIN = 'http://siescoms.render';
const POOL_SIZE = Math.max(1, Number(process.env.RENDER_PAGES || 3));

export const resolveServerSrc = (ref: string): string => {
  if (ref.startsWith('asset:')) return `/static/assets/${ASSET_FILES[ref.slice(6)] || 'sun.svg'}`;
  if (ref.startsWith('upload:')) return `/files/${ref.slice(7)}`;
  return '';
};

function shellHtml(design: Design, values: Values, transparent: boolean): string {
  const { w, h } = design.page;
  const bgUrl = design.background && design.background.fileType !== 'pdf' ? `/files/${design.background.fileKey}` : null;
  const markup = renderToStaticMarkup(
    createElement(Certificate, { design, values, resolveSrc: resolveServerSrc, backgroundUrl: bgUrl, transparent }),
  );
  // 1pt = 4/3 CSS px, so the page is exactly w × h points when printed.
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/static/fonts.css">
<style>@page{size:${w}pt ${h}pt;margin:0}html,body{margin:0;padding:0;background:transparent;-webkit-print-color-adjust:exact;print-color-adjust:exact}
#root{width:${(w * 4) / 3}px;height:${(h * 4) / 3}px;overflow:hidden}</style></head><body><div id="root">${markup}</div></body></html>`;
}

// Fonts, art and fonts.css never change while the API runs, so read each one once
// instead of on every certificate. Uploads are read fresh.
const staticCache = new Map<string, Buffer>();
function readStatic(file: string): Buffer {
  if (!file.startsWith(PKG_DIR + path.sep)) return fs.readFileSync(file);
  let buf = staticCache.get(file);
  if (!buf) { buf = fs.readFileSync(file); staticCache.set(file, buf); }
  return buf;
}

async function serveLocal(route: Route, pages: Map<string, string>) {
  const url = new URL(route.request().url());
  try {
    if (url.origin !== ORIGIN) return route.abort();
    const p = decodeURIComponent(url.pathname);
    if (p.startsWith('/render/')) {
      const html = pages.get(p.slice(8));
      return html ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort();
    }
    let file: string | null = null;
    if (p === '/static/fonts.css') file = path.join(PKG_DIR, 'fonts.css');
    else if (p.startsWith('/static/fonts/')) file = safePath(path.join(PKG_DIR, 'fonts'), p.slice(14));
    else if (p.startsWith('/static/assets/')) file = safePath(path.join(PKG_DIR, 'assets'), p.slice(15));
    else if (p.startsWith('/files/')) file = safePath(FILES_DIR, p.slice(7));
    if (!file || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: mimeFor(file), body: readStatic(file) });
  } catch {
    return route.abort();
  }
}

class Renderer {
  private browser: Promise<Browser> | null = null;
  private idle: Page[] = [];
  private total = 0;
  private waiting: Array<{ resolve: (p: Page) => void; reject: (err: unknown) => void }> = [];
  private htmlById = new Map<string, string>();
  private seq = 0;

  private launch(): Promise<Browser> {
    if (!this.browser) {
      this.browser = chromium.launch({ args: ['--font-render-hinting=none', '--disable-gpu'] }).then((b) => {
        // Pages still in use give their slot back when their render fails; only idle ones are dropped here.
        b.on('disconnected', () => { this.browser = null; this.total -= this.idle.length; this.idle = []; });
        return b;
      });
      this.browser.catch(() => { this.browser = null; });
    }
    return this.browser;
  }

  private async acquire(): Promise<Page> {
    for (let free = this.idle.pop(); free; free = this.idle.pop()) {
      if (!free.isClosed()) return free;
      this.total--;
    }
    if (this.total < POOL_SIZE) {
      this.total++;
      try {
        const browser = await this.launch();
        const ctx = await browser.newContext({ javaScriptEnabled: true, offline: false });
        const page = await ctx.newPage();
        await page.route('**/*', (r) => serveLocal(r, this.htmlById));
        // No default white canvas: unpainted areas stay see-through (needed for stamping).
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
        return page;
      } catch (err) {
        this.total--;
        throw err;
      }
    }
    return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }));
  }

  private release(page: Page) {
    const next = this.waiting.shift();
    if (next) next.resolve(page);
    else this.idle.push(page);
  }

  /** One certificate as a 1-page PDF. */
  async renderPdf(design: Design, values: Values, opts: { backgroundBytes?: Buffer } = {}): Promise<Buffer> {
    const stamp = design.background?.fileType === 'pdf';
    const id = String(++this.seq);
    const page = await this.acquire();
    let broken = false;
    try {
      this.htmlById.set(id, shellHtml(design, values, stamp));
      await page.goto(`${ORIGIN}/render/${id}`, { waitUntil: 'load', timeout: 30_000 });
      const faces = fontsUsed(design.items).map((f) => `${f.italic ? 'italic ' : ''}${f.bold ? 700 : 400} 16px "${fontFamilyName(f.font)}"`);
      faces.push('400 16px Tinos', '700 16px Tinos');
      await page.evaluate(async (list) => {
        await Promise.all(list.map((f) => document.fonts.load(f).catch(() => null)));
        await document.fonts.ready;
        // CSS background images: make sure each one has finished decoding.
        const urls = new Set<string>();
        document.querySelectorAll<HTMLElement>('*').forEach((el) => {
          const m = getComputedStyle(el).backgroundImage.match(/url\("?(.*?)"?\)/);
          if (m) urls.add(m[1]);
        });
        document.querySelectorAll('img').forEach((i) => urls.add(i.src));
        await Promise.all([...urls].map((u) => new Promise((res) => { const im = new Image(); im.onload = im.onerror = res; im.src = u; })));
      }, faces);
      const pdf = await page.pdf({
        width: `${design.page.w / 72}in`, height: `${design.page.h / 72}in`,
        printBackground: true, pageRanges: '1', margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      if (!stamp) return Buffer.from(pdf);
      return await stampOnto(opts.backgroundBytes ?? fs.readFileSync(safePath(FILES_DIR, design.background!.fileKey)), design.background!.pageIndex, pdf, design.page);
    } catch (err) {
      broken = true;
      throw err;
    } finally {
      this.htmlById.delete(id);
      if (broken) {
        this.total--;
        page.context().close().catch(() => {});
        // Hand a replacement page to the next waiter, or fail it, so no render waits forever.
        const next = this.waiting.shift();
        if (next) this.acquire().then(next.resolve, next.reject);
      }
      else this.release(page);
    }
  }

  async close() {
    const b = this.browser;
    this.browser = null;
    if (b) await (await b).close().catch(() => {});
  }
}

/** Draws the original PDF page, then the printed overlay on top. Keeps the original as vectors. */
async function stampOnto(bgBytes: Buffer, pageIndex: number, overlay: Uint8Array, size: { w: number; h: number }): Promise<Buffer> {
  const out = await PDFDocument.create();
  const src = await PDFDocument.load(bgBytes, { updateMetadata: false });
  const index = Math.min(pageIndex, src.getPageCount() - 1);
  const angle = ((src.getPage(index).getRotation().angle % 360) + 360) % 360;
  const [bg] = await out.embedPdf(src, [index]);
  const [ov] = await out.embedPdf(overlay, [0]);
  const { w, h } = size;
  const page = out.addPage([w, h]);
  // Undo the source page's /Rotate so the page reads the way the user saw it.
  const place = angle === 90 ? { x: 0, y: h } : angle === 180 ? { x: w, y: h } : angle === 270 ? { x: w, y: 0 } : { x: 0, y: 0 };
  page.drawPage(bg, { ...place, rotate: degrees(-angle), width: angle % 180 ? h : w, height: angle % 180 ? w : h });
  page.drawPage(ov, { x: 0, y: 0, width: w, height: h });
  return Buffer.from(await out.save());
}

export const renderer = new Renderer();
