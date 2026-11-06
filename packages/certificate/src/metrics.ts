// Text measurement from real font metrics (see scripts/build-metrics.mjs).
// Used for auto-shrinking long names, identically in the editor and the PDF.
import data from './metrics.data.json';
import type { FieldItem } from './model';

interface Face {
  w: number[];
  avg: number;
}
const faces = data.faces as Record<string, Face[]>;
const index = new Map<number, number>();
Array.from(data.chars as string).forEach((ch, i) => index.set(ch.codePointAt(0)!, i));

/** Width in points of `text` set in `font` at `size`, plus letter spacing after each character. */
export function estimateWidth(
  text: string,
  font: string,
  size: number,
  bold = false,
  italic = false,
  letterSpacing = 0
): number {
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
  if (st.wrap) return st.fontSize;
  if (!st.autoShrink) return st.fontSize;

  const processedText = st.uppercase ? text.toUpperCase() : text;
  const room = it.w * 0.96;
  const width = estimateWidth(
    processedText,
    st.fontFamily,
    st.fontSize,
    st.isBold,
    st.isItalic,
    st.letterSpacing || 0
  );
  if (width <= room) return st.fontSize;

  // Letter spacing doesn't scale with the font size, so solve for size with it held fixed.
  const ls = (st.letterSpacing || 0) * [...processedText].length;
  const perPoint = (width - ls) / st.fontSize;
  const fit = perPoint > 0 ? (room - ls) / perPoint : st.fontSize;
  return Math.max(st.minFontSize || 8, Math.floor(fit * 10) / 10);
}

/** Wrap text into lines according to box width and font metrics. */
export function wrapLines(
  text: string,
  font: string,
  size: number,
  boxWidth: number,
  bold = false,
  italic = false,
  letterSpacing = 0
): string[] {
  if (!text) return [];
  const paragraphs = text.split('\n');
  const allLines: string[] = [];

  for (const para of paragraphs) {
    if (para === '') {
      allLines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const w = estimateWidth(testLine, font, size, bold, italic, letterSpacing);
      if (w <= boxWidth || !currentLine) {
        if (w > boxWidth && !currentLine) {
          // Single word wider than box: break by characters
          let subWord = '';
          for (const ch of word) {
            const testSub = subWord + ch;
            if (
              estimateWidth(testSub, font, size, bold, italic, letterSpacing) <= boxWidth ||
              !subWord
            ) {
              subWord = testSub;
            } else {
              allLines.push(subWord);
              subWord = ch;
            }
          }
          currentLine = subWord;
        } else {
          currentLine = testLine;
        }
      } else {
        allLines.push(currentLine);
        if (estimateWidth(word, font, size, bold, italic, letterSpacing) > boxWidth) {
          let subWord = '';
          for (const ch of word) {
            const testSub = subWord + ch;
            if (
              estimateWidth(testSub, font, size, bold, italic, letterSpacing) <= boxWidth ||
              !subWord
            ) {
              subWord = testSub;
            } else {
              allLines.push(subWord);
              subWord = ch;
            }
          }
          currentLine = subWord;
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) {
      allLines.push(currentLine);
    }
  }

  return allLines.length > 0 ? allLines : [''];
}

/** Compute the required height for a wrapped text box item. */
export function fitTextBoxHeight(item: FieldItem, text: string): number {
  const st = item.style;
  const processedText = st.uppercase ? text.toUpperCase() : text;
  const lines = wrapLines(
    processedText,
    st.fontFamily,
    st.fontSize,
    item.w,
    st.isBold,
    st.isItalic,
    st.letterSpacing || 0
  );
  const lineCount = Math.max(1, lines.length);
  const lh = st.lineHeight ?? 1.15;
  return Math.round(lineCount * st.fontSize * lh + 4);
}
