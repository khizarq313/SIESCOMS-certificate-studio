export * from './fonts';
export * from './model';
export * from './metrics';
export * from './templates';
export * from './values';
export * from './Certificate';
export * from './editor/imageTools';
export * from './editor/geometry';
export * from './editor/snap';

/** Built-in art, served as static files by the API at /api/static/assets/<file>. */
export const ASSET_FILES: Record<string, string> = { sun: 'sun.svg', badge: 'badge.png', campus: 'campus.png', sig: 'sig.png' };

/** Every font key used by a design's text, for preloading before printing. */
export function fontsUsed(items: { kind: string; style?: { fontFamily: string; isBold: boolean; isItalic: boolean } }[]) {
  const out = new Map<string, { font: string; bold: boolean; italic: boolean }>();
  for (const it of items) if (it.kind === 'field' && it.style) out.set(`${it.style.fontFamily}|${it.style.isBold}|${it.style.isItalic}`, { font: it.style.fontFamily, bold: it.style.isBold, italic: it.style.isItalic });
  return [...out.values()];
}
