import { describe, expect, it } from 'vitest';
import {
  cloneItems,
  designFromTemplate,
  makeField,
  letteringFor,
  DesignSchema,
  ItemSchema,
  type Item,
  type FieldItem,
} from '@siescoms/certificate';

describe('Phase 5: Clipboard and cloning (clipboard.ts)', () => {
  let counter = 1;
  const mockMakeId = () => `id-${counter++}`;

  it('1. gives new unique ids, adds the offset, and does not share object references', () => {
    const item: Item = {
      id: 'src-1',
      kind: 'shape',
      fill: '#123456',
      stroke: '',
      sw: 1,
      radius: 4,
      sides: 'all',
      dbl: false,
      dash: false,
      opacity: 1,
      grad: '',
      label: 'Rectangle',
      x: 100,
      y: 100,
      w: 80,
      h: 50,
    };

    const design = { items: [item] };
    const [clone] = cloneItems([item], design, 14, mockMakeId);

    expect(clone.id).not.toBe(item.id);
    expect(clone.x).toBe(114);
    expect(clone.y).toBe(114);

    // Deep clone assertion (mutating clone does not mutate source)
    clone.label = 'Modified Clone';
    expect(item.label).toBe('Rectangle');
  });

  it('2. field keys: cloning authority_name twice gives authority_name_2 then authority_name_3, custom_text keeps key', () => {
    const tpl = designFromTemplate('classic', false, 'Test');
    const authField = makeField('authority_name', 100, 100, letteringFor(tpl)) as FieldItem;
    expect(authField.key).toBe('authority_name');

    const customField = makeField('custom_text', 100, 200, letteringFor(tpl)) as FieldItem;
    customField.key = 'text';
    expect(customField.key).toBe('text');

    const baseDesign = { ...tpl, items: [...tpl.items, authField, customField] };

    // First clone
    const [clone1] = cloneItems([authField], baseDesign, 14, mockMakeId);
    expect((clone1 as FieldItem).key).toBe('authority_name_2');
    expect(clone1.label).toBe(`${authField.label} copy`);

    // Second clone with evolving items
    const evolving = { items: [...baseDesign.items, clone1] };
    const [clone2] = cloneItems([authField], evolving, 28, mockMakeId);
    expect((clone2 as FieldItem).key).toBe('authority_name_3');

    // custom_text keeps key 'text' and its label
    const [cloneCustom] = cloneItems([customField], baseDesign, 14, mockMakeId);
    expect((cloneCustom as FieldItem).key).toBe('text');
    expect(cloneCustom.label).toBe(customField.label);

    // recipient_name clone gets a free key when recipient_name exists
    const recField = makeField('recipient_name', 100, 300, letteringFor(tpl)) as FieldItem;
    const designWithRec = { ...baseDesign, items: [...baseDesign.items, recField] };
    const [cloneRec] = cloneItems([recField], designWithRec, 14, mockMakeId);
    expect((cloneRec as FieldItem).key).toBe('recipient_name_2');
  });

  it('3. sample and campus are cleared, locked and hidden are reset, label gets copy', () => {
    const sampleField: Item = {
      id: 'field-1',
      kind: 'field',
      type: 'event_name',
      key: 'event_name',
      label: 'Event Name',
      isDynamic: true,
      sampleValue: 'Symposium',
      defaultValue: 'Event',
      sample: true,
      locked: true,
      hidden: true,
      style: {
        fontFamily: 'Cinzel',
        fontSize: 24,
        isBold: false,
        isItalic: false,
        color: '#000000',
        alignment: 'center',
        autoShrink: true,
        minFontSize: 12,
        letterSpacing: 0,
      },
      x: 50,
      y: 50,
      w: 200,
      h: 40,
    };

    const campusImg: Item = {
      id: 'campus-1',
      kind: 'image',
      src: 'campus.png',
      campus: true,
      locked: true,
      hidden: true,
      label: 'Campus',
      x: 0,
      y: 0,
      w: 842,
      h: 595,
      opacity: 0.1,
      blend: '',
    };

    const [clonedField, clonedImg] = cloneItems(
      [sampleField, campusImg],
      { items: [] },
      14,
      mockMakeId
    );

    expect((clonedField as FieldItem).sample).toBe(false);
    expect(clonedField.locked).toBe(false);
    expect(clonedField.hidden).toBeUndefined();
    expect(clonedField.label).toBe('Event Name copy');

    expect((clonedImg as { campus?: boolean }).campus).toBe(false);
    expect(clonedImg.locked).toBe(false);
    expect(clonedImg.hidden).toBeUndefined();
  });

  it('4. every clone passes ItemSchema.safeParse and a design built from it passes DesignSchema.safeParse', () => {
    const tpl = designFromTemplate('classic', false, 'Test');
    const clones = cloneItems(tpl.items, tpl, 14, mockMakeId);

    for (const c of clones) {
      const res = ItemSchema.safeParse(c);
      expect(res.success).toBe(true);
    }

    const newDesign = {
      ...tpl,
      items: [...tpl.items, ...clones],
    };
    expect(DesignSchema.safeParse(newDesign).success).toBe(true);
  });

  it('5. cloning 0 items returns []', () => {
    expect(cloneItems([], { items: [] }, 14, mockMakeId)).toEqual([]);
  });
});
