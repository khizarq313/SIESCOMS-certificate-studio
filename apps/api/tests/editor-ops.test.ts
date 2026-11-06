import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import {
  alignDeltas,
  distributeDeltas,
  itemBounds,
  reorderItems,
  moveLayer,
  marqueeHits,
  nextSelection,
  unionBox,
  DesignSchema,
  Certificate,
  designFromTemplate,
  sampleValues,
  type Box,
  type Item,
} from '@siescoms/certificate';

describe('Phase 4: Multi-select, Align, Layers, Lock, Hide (editor-ops)', () => {
  const page = { w: 842, h: 595 };

  it('1. computes alignDeltas for all 6 modes with 3 boxes and with a single box aligned to page', () => {
    const b1: Box = { x: 100, y: 100, w: 50, h: 40 };
    const b2: Box = { x: 200, y: 150, w: 80, h: 60 };
    const b3: Box = { x: 300, y: 220, w: 60, h: 80 };
    const entries = [
      { id: '1', box: b1 },
      { id: '2', box: b2 },
      { id: '3', box: b3 },
    ];
    const u = unionBox([b1, b2, b3]); // x: 100, y: 100, w: 260 (right: 360), h: 200 (bottom: 300)

    // Left
    const dLeft = alignDeltas(entries, 'left', u);
    expect(dLeft.map((d) => d.dx)).toEqual([0, -100, -200]);
    expect(dLeft.map((d) => d.dy)).toEqual([0, 0, 0]);

    // CenterX (u.center = 100 + 130 = 230)
    // b1.center = 125 -> dx = 105; b2.center = 240 -> dx = -10; b3.center = 330 -> dx = -100
    const dCenterX = alignDeltas(entries, 'centerX', u);
    expect(dCenterX.map((d) => d.dx)).toEqual([105, -10, -100]);

    // Right (u.right = 360)
    // b1.right = 150 -> dx = 210; b2.right = 280 -> dx = 80; b3.right = 360 -> dx = 0
    const dRight = alignDeltas(entries, 'right', u);
    expect(dRight.map((d) => d.dx)).toEqual([210, 80, 0]);

    // Top (u.top = 100)
    const dTop = alignDeltas(entries, 'top', u);
    expect(dTop.map((d) => d.dy)).toEqual([0, -50, -120]);

    // MiddleY (u.middle = 100 + 100 = 200)
    // b1.middle = 120 -> dy = 80; b2.middle = 180 -> dy = 20; b3.middle = 260 -> dy = -60
    const dMiddleY = alignDeltas(entries, 'middleY', u);
    expect(dMiddleY.map((d) => d.dy)).toEqual([80, 20, -60]);

    // Bottom (u.bottom = 300)
    // b1.bottom = 140 -> dy = 160; b2.bottom = 210 -> dy = 90; b3.bottom = 300 -> dy = 0
    const dBottom = alignDeltas(entries, 'bottom', u);
    expect(dBottom.map((d) => d.dy)).toEqual([160, 90, 0]);

    // Single box aligned to page box
    const pageBox: Box = { x: 0, y: 0, w: page.w, h: page.h };
    const single = [{ id: '1', box: b1 }];
    const dPageCenter = alignDeltas(single, 'centerX', pageBox);
    expect(dPageCenter[0].dx).toBe(page.w / 2 - (b1.x + b1.w / 2));
  });

  it('2. distributes four boxes with uneven gaps into equal gaps; returns [] for fewer than 3', () => {
    // 4 boxes along X:
    // 1: x: 100, w: 50 -> right = 150
    // 2: x: 180, w: 50 (gap 30) -> right = 230
    // 3: x: 310, w: 50 (gap 80) -> right = 360
    // 4: x: 450, w: 50 (gap 90) -> right = 500
    // Total span: 100 to 500 = 400. Sum of 4 widths = 200.
    // Total gap = 400 - 200 = 200.
    // 3 gaps -> each gap = 200 / 3 = 66.67.
    const b1: Box = { x: 100, y: 100, w: 50, h: 40 };
    const b2: Box = { x: 180, y: 100, w: 50, h: 40 };
    const b3: Box = { x: 310, y: 100, w: 50, h: 40 };
    const b4: Box = { x: 450, y: 100, w: 50, h: 40 };

    const entries = [
      { id: '1', box: b1 },
      { id: '2', box: b2 },
      { id: '3', box: b3 },
      { id: '4', box: b4 },
    ];

    const deltas = distributeDeltas(entries, 'x');
    expect(deltas[0].dx).toBe(0); // outer box 1 does not move
    expect(deltas[3].dx).toBe(0); // outer box 4 does not move

    const newX2 = b2.x + deltas[1].dx;
    const newX3 = b3.x + deltas[2].dx;

    const gap1 = newX2 - (b1.x + b1.w);
    const gap2 = newX3 - (newX2 + b2.w);
    const gap3 = b4.x - (newX3 + b3.w);

    expect(Math.abs(gap1 - gap2)).toBeLessThan(0.05);
    expect(Math.abs(gap2 - gap3)).toBeLessThan(0.05);

    // Fewer than 3 returns []
    expect(distributeDeltas([entries[0], entries[1]], 'x')).toEqual([]);
    expect(distributeDeltas([], 'x')).toEqual([]);
  });

  it('3. aligns rotated item via itemBounds so visible bounds end up on target edge', () => {
    // 100x20 item rotated 90deg: bounds is { x: 240, y: 160, w: 20, h: 100 }
    const rotatedItem = {
      id: 'rot-1',
      kind: 'field',
      type: 'custom_text',
      key: 'text',
      isDynamic: false,
      sample: false,
      style: {
        fontFamily: 'GreatVibes',
        fontSize: 24,
        isBold: false,
        isItalic: false,
        color: '#000',
        alignment: 'center' as const,
      },
      x: 200,
      y: 200,
      w: 100,
      h: 20,
      rot: 90,
    } as Item;

    const b = itemBounds(rotatedItem);
    expect(b).toEqual({ x: 240, y: 160, w: 20, h: 100 });

    // Align left to ref x = 50
    const targetRef: Box = { x: 50, y: 50, w: 200, h: 200 };
    const [delta] = alignDeltas([{ id: rotatedItem.id, box: b }], 'left', targetRef);
    expect(delta.dx).toBe(-190);

    // Apply delta to item.x: 200 + (-190) = 10
    const movedItem = { ...rotatedItem, x: rotatedItem.x + delta.dx };
    const movedBounds = itemBounds(movedItem);
    expect(movedBounds.x).toBe(50); // visible left edge is exactly at 50!
  });

  it('4. reorderItems: forward, backward, front, back with limits and non-mutating', () => {
    const items = [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
      { id: 'D' },
      { id: 'E' },
    ] as Item[];

    // Forward for non-adjacent selection ['B', 'D']:
    // D swaps with E -> [A, B, C, E, D]
    // B swaps with C -> [A, C, B, E, D]
    const fwd = reorderItems(items, ['B', 'D'], 'forward');
    expect(fwd.map((i) => i.id)).toEqual(['A', 'C', 'B', 'E', 'D']);
    // Original not mutated
    expect(items.map((i) => i.id)).toEqual(['A', 'B', 'C', 'D', 'E']);

    // Backward for ['B', 'D']:
    // B swaps with A -> [B, A, C, D, E]
    // D swaps with C -> [B, A, D, C, E]
    const bwd = reorderItems(items, ['B', 'D'], 'backward');
    expect(bwd.map((i) => i.id)).toEqual(['B', 'A', 'D', 'C', 'E']);

    // Front for ['B', 'D']:
    const front = reorderItems(items, ['B', 'D'], 'front');
    expect(front.map((i) => i.id)).toEqual(['A', 'C', 'E', 'B', 'D']);

    // Back for ['B', 'D']:
    const back = reorderItems(items, ['B', 'D'], 'back');
    expect(back.map((i) => i.id)).toEqual(['B', 'D', 'A', 'C', 'E']);

    // Limit check: item at top cannot move forward
    const topLimit = reorderItems(items, ['E'], 'forward');
    expect(topLimit.map((i) => i.id)).toEqual(['A', 'B', 'C', 'D', 'E']);

    // Limit check: item at bottom cannot move back
    const bottomLimit = reorderItems(items, ['A'], 'backward');
    expect(bottomLimit.map((i) => i.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('5. moveLayer moves an item to requested index in both directions', () => {
    const items = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }] as Item[];

    // Move 'A' (index 0) to index 2 -> [B, C, A, D]
    const m1 = moveLayer(items, 'A', 2);
    expect(m1.map((i) => i.id)).toEqual(['B', 'C', 'A', 'D']);

    // Move 'D' (index 3) to index 1 -> [A, D, B, C]
    const m2 = moveLayer(items, 'D', 1);
    expect(m2.map((i) => i.id)).toEqual(['A', 'D', 'B', 'C']);
  });

  it('6. marqueeHits intersects partially covered items and skips locked, hidden, and background items', () => {
    const entries = [
      { id: '1', box: { x: 100, y: 100, w: 50, h: 50 } }, // hit
      { id: '2', box: { x: 300, y: 300, w: 50, h: 50 } }, // outside
      { id: '3', box: { x: 120, y: 120, w: 50, h: 50 }, locked: true }, // locked -> skip
      { id: '4', box: { x: 110, y: 110, w: 50, h: 50 }, hidden: true }, // hidden -> skip
      { id: '5', box: { x: 0, y: 0, w: 800, h: 500 } }, // background (>70% page) -> skip
    ];

    const marquee: Box = { x: 80, y: 80, w: 100, h: 100 }; // spans 80-180 in x and y
    const hits = marqueeHits(entries, marquee, page);
    expect(hits).toEqual(['1']);
  });

  it('7. nextSelection toggles selection correctly', () => {
    expect(nextSelection([], '1', false)).toEqual(['1']);
    expect(nextSelection(['1', '2'], '3', true)).toEqual(['1', '2', '3']);
    expect(nextSelection(['1', '2', '3'], '2', true)).toEqual(['1', '3']);
    expect(nextSelection(['1', '2'], '3', false)).toEqual(['3']);
  });

  it('8. schema validates hidden property', () => {
    const valid = designFromTemplate('classic', false, 'Test');
    // Existing design without hidden passes
    expect(DesignSchema.safeParse(valid).success).toBe(true);

    // With hidden: true passes
    const withHidden = {
      ...valid,
      items: valid.items.map((it, idx) => (idx === 0 ? { ...it, hidden: true } : it)),
    };
    expect(DesignSchema.safeParse(withHidden).success).toBe(true);

    // With hidden: 'yes' (invalid type) fails
    const invalidHidden = {
      ...valid,
      items: valid.items.map((it, idx) => (idx === 0 ? { ...it, hidden: 'yes' } : it)),
    };
    expect(DesignSchema.safeParse(invalidHidden).success).toBe(false);
  });

  it('9. Certificate does not render hidden items in output', () => {
    const design = designFromTemplate('classic', false, 'Test');
    const firstId = design.items[0].id;
    const secondId = design.items[1].id;

    const designWithHidden = {
      ...design,
      items: design.items.map((it) => (it.id === firstId ? { ...it, hidden: true } : it)),
    };

    const values = sampleValues(design, false);
    const html = renderToStaticMarkup(
      React.createElement(Certificate, {
        design: designWithHidden,
        values,
        resolveSrc: (s: string) => s,
      })
    );

    expect(html).not.toContain(`data-item="${firstId}"`);
    expect(html).toContain(`data-item="${secondId}"`);
  });
});
