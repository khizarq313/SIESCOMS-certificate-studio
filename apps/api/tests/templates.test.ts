import { afterAll, describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  TEMPLATES, designFromTemplate, makeField, templateById,
  type FieldItem, type Item,
} from '@siescoms/certificate';
import { DesignSchema } from '@siescoms/certificate';
import { renderer } from '../src/render/renderer';

const NEW_TEMPLATE_IDS = ['royal', 'emerald', 'copper', 'slate'] as const;
const FIRST_16_IDS = [
  'classic', 'midnight', 'saffron', 'modern', 'deco', 'sage', 'campus', 'tech',
  'rose', 'diagonal', 'minimal', 'ivory', 'teal', 'graphite', 'lavender', 'crimson',
];

afterAll(async () => {
  await renderer.close();
});

describe('Phase 1: Four new formal templates (16 -> 20)', () => {
  it('has 20 templates with unique ids and names, preserving the first 16 unchanged', () => {
    expect(TEMPLATES.length).toBe(20);
    const ids = TEMPLATES.map((t) => t.id);
    const names = TEMPLATES.map((t) => t.name);

    expect(new Set(ids).size).toBe(20);
    expect(new Set(names).size).toBe(20);
    expect(ids.slice(0, 16)).toEqual(FIRST_16_IDS);
    expect(ids.slice(16)).toEqual(NEW_TEMPLATE_IDS);
  });

  it('validates designFromTemplate for all new templates with and without campus art', () => {
    for (const id of NEW_TEMPLATE_IDS) {
      const withoutCampus = designFromTemplate(id, false);
      const withCampus = designFromTemplate(id, true);

      const parsedWithout = DesignSchema.safeParse(withoutCampus);
      expect(parsedWithout.success, `designFromTemplate(${id}, false) failed schema validation: ${JSON.stringify(parsedWithout.error?.format())}`).toBe(true);

      const parsedWith = DesignSchema.safeParse(withCampus);
      expect(parsedWith.success, `designFromTemplate(${id}, true) failed schema validation: ${JSON.stringify(parsedWith.error?.format())}`).toBe(true);
    }
  });

  it('enforces clean white background, no patterns, no image items, no grad, and max shape area <= 2600', () => {
    for (const id of NEW_TEMPLATE_IDS) {
      const t = templateById(id);
      expect(t.bg).toBe('#FFFFFF');
      expect(t.pattern ?? '').toBe('');
      expect(t.dark ?? false).toBe(false);

      const items = t.build();
      for (const it of items) {
        expect(it.kind).not.toBe('image');
        if (it.kind === 'shape') {
          expect(it.grad ?? '').toBe('');
          if (it.fill && it.fill !== 'transparent') {
            const area = it.w * it.h;
            expect(area).toBeLessThanOrEqual(2600);
          }
        }
      }
    }
  });

  it('places exactly one lockup item top-left and keeps text boxes below y 140 at least 24 pt away', () => {
    for (const id of NEW_TEMPLATE_IDS) {
      const t = templateById(id);
      const items = t.build();

      const lockups = items.filter((i) => i.kind === 'lockup');
      expect(lockups.length).toBe(1);
      const lk = lockups[0];
      expect(lk.x).toBeLessThanOrEqual(56);
      expect(lk.y).toBeLessThanOrEqual(50);
      expect(lk.w).toBe(150);

      const lkBox = { x1: lk.x, y1: lk.y, x2: lk.x + lk.w, y2: lk.y + lk.h };

      // Text fields whose y is below 140 (i.e. y < 140)
      const headerFields = items.filter((i): i is FieldItem => i.kind === 'field' && i.y < 140);
      for (const field of headerFields) {
        const fBox = { x1: field.x, y1: field.y, x2: field.x + field.w, y2: field.y + field.h };

        // Distance between two axis-aligned rectangles
        const dx = Math.max(0, Math.max(lkBox.x1 - fBox.x2, fBox.x1 - lkBox.x2));
        const dy = Math.max(0, Math.max(lkBox.y1 - fBox.y2, fBox.y1 - lkBox.y2));
        const dist = Math.hypot(dx, dy);

        expect(dist, `Template ${id} field "${field.label}" is too close to lockup (${dist.toFixed(1)} pt < 24 pt)`).toBeGreaterThanOrEqual(24);
      }
    }
  });

  it('respects the keep-out area x: 195-650, y: 330-480 for non-text items', () => {
    const keepOut = { x1: 195, y1: 330, x2: 650, y2: 480 };

    function intersects(it: Item) {
      const x1 = it.x;
      const y1 = it.y;
      const x2 = it.x + it.w;
      const y2 = it.y + it.h;
      return !(x2 <= keepOut.x1 || x1 >= keepOut.x2 || y2 <= keepOut.y1 || y1 >= keepOut.y2);
    }

    const ALLOWED_LABELS = new Set([
      'Outer frame', 'Inner frame', 'Thin frame',
      'Corner bracket TL', 'Corner bracket BR',
      'Corner diamond TL', 'Corner diamond TR', 'Corner diamond BL', 'Corner diamond BR',
      'Divider diamond', 'Copper rule',
      'Top rule sky', 'Top rule silver', 'Bottom rule silver', 'Bottom rule sky',
      'Square silver', 'Square sky', 'Square slate',
      'Signature line', 'Date line', 'Name line',
    ]);

    for (const id of NEW_TEMPLATE_IDS) {
      const items = templateById(id).build();
      for (const it of items) {
        if (it.kind === 'field') continue;
        if (ALLOWED_LABELS.has(it.label)) continue;

        expect(intersects(it), `Template ${id} item "${it.label}" intersects keep-out area`).toBe(false);
      }
    }
  });

  it('renders one new template to a valid single-page vector PDF', async () => {
    const d = designFromTemplate('royal', false, 'Test Royal Clean');
    const smp = d.items.find((i) => i.kind === 'field' && i.sample) as FieldItem;
    expect(smp).toBeDefined();

    const rec = makeField('recipient_name', smp.x + smp.w / 2 - 210, smp.y - 4, templateById('royal')) as FieldItem;
    d.items = d.items.map((i) => (i.id === smp.id ? rec : i));

    const pdf = await renderer.renderPdf(d, { recipient_name: 'Aarav Sharma' });
    expect(pdf).toBeDefined();
    expect(pdf.length).toBeGreaterThan(1000);

    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  });
});
