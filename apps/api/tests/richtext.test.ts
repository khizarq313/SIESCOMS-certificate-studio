import { afterAll, describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  displaySize,
  wrapLines,
  fitTextBoxHeight,
  designFromTemplate,
  makeField,
  letteringFor,
  DesignSchema,
  ItemSchema,
  TextStyleSchema,
  type FieldItem,
} from '@siescoms/certificate';
import { renderer } from '../src/render/renderer';

afterAll(async () => {
  await renderer.close();
});

describe('Phase 6: Rich text formatting & multi-line text boxes', () => {
  it('1. schema validation: backward compatible with old styles and accepts new optional properties', () => {
    // Old style object without new properties
    const oldStyle = {
      fontFamily: 'Helvetica',
      fontSize: 20,
      isBold: false,
      isItalic: false,
      color: '#000000',
      alignment: 'center' as const,
      autoShrink: true,
      minFontSize: 8,
      letterSpacing: 0,
    };
    expect(TextStyleSchema.safeParse(oldStyle).success).toBe(true);

    // New style with all rich text options
    const newStyle = {
      ...oldStyle,
      lineHeight: 1.4,
      underline: true,
      uppercase: true,
      shadow: true,
      wrap: true,
    };
    expect(TextStyleSchema.safeParse(newStyle).success).toBe(true);
  });

  it('2. uppercase auto-shrink: uppercase text causes greater width and smaller or equal fitted size', () => {
    const tpl = designFromTemplate('classic', false, 'Test');
    const field = makeField('recipient_name', 100, 100, letteringFor(tpl)) as FieldItem;
    field.w = 150; // Constrained width to trigger auto-shrink
    field.style.fontSize = 24;
    field.style.autoShrink = true;

    const normalSize = displaySize(field, 'Alexander Montgomery');
    field.style.uppercase = true;
    const upperSize = displaySize(field, 'Alexander Montgomery');

    expect(upperSize).toBeLessThanOrEqual(normalSize);
    expect(upperSize).toBeGreaterThanOrEqual(field.style.minFontSize || 8);
  });

  it('3. wrap mode never auto-shrinks: returns st.fontSize regardless of text length', () => {
    const tpl = designFromTemplate('classic', false, 'Test');
    const field = makeField('custom_text', 100, 100, letteringFor(tpl)) as FieldItem;
    field.w = 100;
    field.style.fontSize = 18;
    field.style.autoShrink = true;
    field.style.wrap = true;

    const size = displaySize(
      field,
      'This is an exceptionally long paragraph that would definitely shrink if wrap was false.'
    );
    expect(size).toBe(18);
  });

  it('4. wrapLines splits text accurately according to width and handles manual newlines', () => {
    const text = 'Line one\nLine two with several words that will wrap inside a narrow container';
    const lines = wrapLines(text, 'Helvetica', 14, 150, false, false, 0);

    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[0]).toBe('Line one');
    expect(lines[1]).toMatch(/^Line two/);
  });

  it('5. wrapLines handles single words wider than box by character breaking', () => {
    const longWord = 'SupercalifragilisticexpialidociousLongWord';
    const lines = wrapLines(longWord, 'Helvetica', 16, 80, false, false, 0);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe(longWord);
  });

  it('6. fitTextBoxHeight calculates proportional height with line height', () => {
    const tpl = designFromTemplate('classic', false, 'Test');
    const field = makeField('custom_text', 100, 100, letteringFor(tpl)) as FieldItem;
    field.w = 200;
    field.style.fontSize = 14;
    field.style.lineHeight = 1.5;
    field.style.wrap = true;

    const shortHeight = fitTextBoxHeight(field, 'Single short line');
    const multilineText = 'First line of the description.\nSecond line of description.\nThird line of description.';
    const multilineHeight = fitTextBoxHeight(field, multilineText);

    expect(multilineHeight).toBeGreaterThan(shortHeight);
    // 3 lines * 14 * 1.5 + 4 = 67
    expect(multilineHeight).toBeCloseTo(67, 0);
  });

  it('7. renders a certificate with rich text formatting and wrapped text boxes to a valid PDF', async () => {
    const d = designFromTemplate('royal', false, 'Test Rich Text PDF');
    const smp = d.items.find((i) => i.kind === 'field' && i.sample) as FieldItem;
    expect(smp).toBeDefined();

    const rec = makeField('recipient_name', smp.x + smp.w / 2 - 210, smp.y - 4, letteringFor(d)) as FieldItem;
    rec.style.uppercase = true;
    rec.style.underline = true;
    rec.style.shadow = true;
    rec.style.letterSpacing = 1.5;

    // Add a multi-line wrapped paragraph box
    const paragraph = makeField('custom_text', 200, 360, letteringFor(d)) as FieldItem;
    paragraph.w = 442;
    paragraph.h = 80;
    paragraph.defaultValue =
      'In recognition of outstanding performance and dedicated leadership during the 2026 Academic Year at SIES College of Management Studies.';
    paragraph.style.wrap = true;
    paragraph.style.fontSize = 13;
    paragraph.style.lineHeight = 1.4;

    d.items = d.items.map((i) => (i.id === smp.id ? rec : i));
    d.items.push(paragraph);

    // Validate the complete design against DesignSchema
    const validated = DesignSchema.parse(d);
    expect(validated).toBeDefined();

    const pdf = await renderer.renderPdf(d, { recipient_name: 'Priyanka Sen' });
    expect(pdf).toBeDefined();
    expect(pdf.length).toBeGreaterThan(1000);

    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  });
});
