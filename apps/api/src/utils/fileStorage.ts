import fs from 'node:fs';
import path from 'node:path';

const isVercel = Boolean(process.env.VERCEL);
export const UPLOADS_ROOT = process.env.UPLOADS_DIR || (isVercel ? '/tmp/siescoms-uploads' : path.resolve(__dirname, '../../uploads'));
/** Uploaded certificate backgrounds, signatures and logos. */
export const FILES_DIR = path.join(UPLOADS_ROOT, 'files');
/** Finished PDFs and ZIPs, deleted after a day. */
export const GENERATED_DIR = path.join(UPLOADS_ROOT, 'generated');

for (const dir of [FILES_DIR, GENERATED_DIR]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.warn(`Could not create storage directory ${dir}:`, err);
  }
}

/** Resolves a stored file name inside `dir`, refusing anything that could escape it. */
export function safePath(dir: string, fileName: string): string {
  if (!/^[\w.-]+$/.test(fileName) || fileName.startsWith('.')) throw Object.assign(new Error('Invalid file name'), { status: 400 });
  const resolved = path.resolve(dir, fileName);
  if (path.dirname(resolved) !== path.resolve(dir)) throw Object.assign(new Error('Invalid file name'), { status: 400 });
  return resolved;
}

/** Real file type from the first bytes, so a renamed file can't pass as a PDF or image. */
export function detectMagicBytes(buffer: Buffer): 'pdf' | 'png' | 'jpg' | null {
  if (buffer.length < 8) return null;
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  return null;
}

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.zip': 'application/zip',
  '.css': 'text/css', '.ttf': 'font/ttf', '.svg': 'image/svg+xml',
};
export const mimeFor = (file: string) => MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';

/** Deletes generated files older than `maxAgeMs`. */
export function cleanGenerated(maxAgeMs = 24 * 3600_000): void {
  const now = Date.now();
  for (const f of fs.readdirSync(GENERATED_DIR)) {
    const p = path.join(GENERATED_DIR, f);
    try { if (now - fs.statSync(p).mtimeMs > maxAgeMs) fs.rmSync(p, { force: true }); } catch { /* already gone */ }
  }
}

/** RFC 6266 Content-Disposition that keeps non-ASCII names. */
export function contentDisposition(name: string, inline = false): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
