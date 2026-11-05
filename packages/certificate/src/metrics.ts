// Text measurement from real font metrics (see scripts/build-metrics.mjs).
// Used for auto-shrinking long names, identically in the editor and the PDF.
import data from './metrics.data.json';
import type { FieldItem } from './model';

interface Face { w: number[]; avg: number }
const faces = data.faces as Record<string, Face[]>;
const index = new Map<number, number>();
Array.from(data.chars as string).forEach((ch, i) => index.set(ch.codePointAt(0)!, i));

/** Width in points of `text` set in `font` at `size`, plus letter spacing after each character. */
export function estimateWidth(text: string, font: string, size: number, bold = false, italic = false, letterSpacing = 0): number {
  const set = faces[font] || faces.Helvetica;
  const face = set[(bold ? 1 : 0) + (italic ? 2 : 0)];
  let units = 0;
  let n = 0;
  for (const ch of text) {
    const i = index.get(ch.codePointAt(0)!);
    units += i === undefined ? face.avg : face.w[i];
    n++;
  }
  return (units / 1000) * size + letterSpacing * n;
}

/** The font size a text field is actually drawn at, after auto-shrink. */
export function displaySize(it: FieldItem, text: string): number {
  const st = it.style;
  if (!st.autoShrink) return st.fontSize;
  const room = it.w * 0.96;
  const width = estimateWidth(text, st.fontFamily, st.fontSize, st.isBold, st.isItalic, st.letterSpacing || 0);
  if (width <= room) return st.fontSize;
  // Letter spacing doesn't scale with the font size, so solve for size with it held fixed.
  const ls = (st.letterSpacing || 0) * [...text].length;
  const perPoint = (width - ls) / st.fontSize;
  const fit = perPoint > 0 ? (room - ls) / perPoint : st.fontSize;
  return Math.max(st.minFontSize || 8, Math.floor(fit * 10) / 10);
}
