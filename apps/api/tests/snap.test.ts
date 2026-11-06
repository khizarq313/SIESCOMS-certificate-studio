import { describe, expect, it } from 'vitest';
import {
  distancesFor,
  itemBounds,
  snapMove,
  snapResize,
  snapTargets,
  unionBox,
  type Box,
  type Item,
} from '@siescoms/certificate';

describe('Phase 3: Canva-style smart guides and snapping (geometry & snap)', () => {
  const page = { w: 842, h: 595 };

  it('1. snaps to vertical centre (x = 421) and horizontal centre (y = 297.5) with page guides', () => {
    // Page vertical centre is 421. Moving box centre is 4 pt to the left (417)
    // Box w = 100 -> left = 417 - 50 = 367
    const movingV: Box = { x: 367, y: 200, w: 100, h: 50 };
    const resV = snapMove(movingV, [], page, { threshold: 6 });
    expect(resV.dx).toBe(4);
    const vGuide = resV.guides.find((g) => g.axis === 'v' && g.kind === 'page' && g.pos === 421);
    expect(vGuide).toBeDefined();
    expect(vGuide?.from).toBe(0);
    expect(vGuide?.to).toBe(595);

    // Page horizontal centre is 297.5. Moving box centre is 4 pt above (293.5)
    // Box h = 50 -> top = 293.5 - 25 = 268.5
    const movingH: Box = { x: 100, y: 268.5, w: 100, h: 50 };
    const resH = snapMove(movingH, [], page, { threshold: 6 });
    expect(resH.dy).toBe(4);
    const hGuide = resH.guides.find((g) => g.axis === 'h' && g.kind === 'page' && g.pos === 297.5);
    expect(hGuide).toBeDefined();
    expect(hGuide?.from).toBe(0);
    expect(hGuide?.to).toBe(842);
  });

  it('2. returns dx = 0, dy = 0 and no guides when 9 pt away from every line (threshold 6)', () => {
    // Choose coordinates well away from margins (36), page edges (0, 842, 595), and centres
    const moving: Box = { x: 120, y: 120, w: 50, h: 50 };
    const res = snapMove(moving, [], page, { threshold: 6 });
    expect(res.dx).toBe(0);
    expect(res.dy).toBe(0);
    expect(res.guides).toHaveLength(0);
  });

  it('3. snaps to item left edge, centre-to-centre, and moving-left to target-right', () => {
    const target: Box = { x: 200, y: 100, w: 100, h: 50 };

    // Left edge to left edge (target x = 200, moving x = 203 -> dx = -3)
    // Use y = 220, h = 40 (away from page horizontal centre 297.5)
    const movingLeft: Box = { x: 203, y: 220, w: 80, h: 40 };
    const res1 = snapMove(movingLeft, [target], page, { threshold: 6 });
    expect(res1.dx).toBe(-3);
    const g1 = res1.guides.find((g) => g.axis === 'v' && g.kind === 'item' && g.pos === 200);
    expect(g1).toBeDefined();
    expect(g1?.from).toBe(100);
    expect(g1?.to).toBe(260); // covers target y: 100-150 and moving y: 220-260

    // Centre-to-centre (target centre = 250, moving centre = 252 -> moving x = 212)
    const movingCentre: Box = { x: 212, y: 220, w: 80, h: 40 };
    const res2 = snapMove(movingCentre, [target], page, { threshold: 6 });
    expect(res2.dx).toBe(-2);
    const g2 = res2.guides.find((g) => g.axis === 'v' && g.kind === 'item' && g.pos === 250);
    expect(g2).toBeDefined();

    // Moving left to target right (target right = 300, moving x = 302 -> dx = -2)
    const movingRight: Box = { x: 302, y: 220, w: 80, h: 40 };
    const res3 = snapMove(movingRight, [target], page, { threshold: 6 });
    expect(res3.dx).toBe(-2);
    const g3 = res3.guides.find((g) => g.axis === 'v' && g.kind === 'item' && g.pos === 300);
    expect(g3).toBeDefined();
  });

  it('4. returns two coincident guides at once when top aligns with item A and bottom with item B', () => {
    // Item A top at 150
    const itemA: Box = { x: 100, y: 150, w: 50, h: 50 };
    // Item B bottom at 300 (y: 250, h: 50)
    const itemB: Box = { x: 400, y: 250, w: 50, h: 50 };

    // Moving box with top at 150 and bottom at 300 (h = 150)
    const moving: Box = { x: 200, y: 150, w: 60, h: 150 };
    const res = snapMove(moving, [itemA, itemB], page, { threshold: 6 });
    expect(res.dy).toBe(0);

    const hGuides = res.guides.filter((g) => g.axis === 'h' && g.kind === 'item');
    expect(hGuides.length).toBeGreaterThanOrEqual(2);
    expect(hGuides.some((g) => Math.abs(g.pos - 150) < 0.25)).toBe(true);
    expect(hGuides.some((g) => Math.abs(g.pos - 300) < 0.25)).toBe(true);
  });

  it('5. snaps left edge 3 pt from x = 36 to margin with a margin guide', () => {
    const moving: Box = { x: 39, y: 200, w: 100, h: 50 };
    const res = snapMove(moving, [], page, { threshold: 6, margin: 36 });
    expect(res.dx).toBe(-3);
    const guide = res.guides.find((g) => g.axis === 'v' && g.kind === 'margin' && g.pos === 36);
    expect(guide).toBeDefined();
    expect(guide?.from).toBe(0);
    expect(guide?.to).toBe(595);
  });

  it('6. applies equal spacing (between): A at 100-200, B at 500-600, moving w=100 at x=303 -> dx = -3 and two GapMarks with value 100', () => {
    const A: Box = { x: 100, y: 200, w: 100, h: 50 };
    const B: Box = { x: 500, y: 200, w: 100, h: 50 };
    const moving: Box = { x: 303, y: 200, w: 100, h: 50 };

    const res = snapMove(moving, [A, B], page, { threshold: 6 });
    expect(res.dx).toBe(-3);
    expect(res.gaps).toHaveLength(2);
    expect(res.gaps[0].value).toBe(100);
    expect(res.gaps[1].value).toBe(100);
  });

  it('7. applies repeat spacing: A 100-200, B 300-400 (gap 100), moving w=100 at x=502 -> snaps to x=500 and returns marks for both gaps', () => {
    const A: Box = { x: 100, y: 200, w: 100, h: 50 };
    const B: Box = { x: 300, y: 200, w: 100, h: 50 };
    const moving: Box = { x: 502, y: 200, w: 100, h: 50 };

    const res = snapMove(moving, [A, B], page, { threshold: 6 });
    expect(res.dx).toBe(-2);
    expect(res.gaps).toHaveLength(2);
    expect(res.gaps[0].value).toBe(100);
    expect(res.gaps[1].value).toBe(100);
  });

  it('8. computes itemBounds correctly for rotated items and lines', () => {
    const itemRot90 = {
      id: 'test-1',
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

    const bRot = itemBounds(itemRot90);
    expect(bRot).toEqual({ x: 240, y: 160, w: 20, h: 100 });

    const lineItem = {
      id: 'test-2',
      kind: 'line',
      x: 100,
      y: 200,
      w: 300,
      h: 8,
      thick: 1,
      color: '#000',
      dash: false,
    } as Item;

    const bLine = itemBounds(lineItem);
    expect(bLine).toEqual({ x: 100, y: 204, w: 300, h: 0 });
  });

  it('9. snapTargets drops the excluded id, campus images, and items sticking far outside the page', () => {
    const items: Item[] = [
      // 1. Excluded id
      {
        id: 'exclude-me',
        kind: 'field',
        type: 'custom_text',
        key: 'k1',
        isDynamic: false,
        sample: false,
        style: { fontFamily: 'Cinzel', fontSize: 20, isBold: false, isItalic: false, color: '#000', alignment: 'center' },
        x: 100,
        y: 100,
        w: 100,
        h: 50,
      } as Item,
      // 2. Campus background image
      {
        id: 'campus-img',
        kind: 'image',
        src: 'campus.png',
        campus: true,
        x: 0,
        y: 0,
        w: 842,
        h: 595,
        opacity: 1,
      } as Item,
      // 3. Sticking outside by > 20% (left: x = -30, w = 100 -> outLeft 30 > 20)
      {
        id: 'outside-item',
        kind: 'shape',
        fill: '#000',
        stroke: '',
        sw: 0,
        radius: 0,
        sides: 'all',
        dbl: false,
        dash: false,
        opacity: 1,
        grad: '',
        label: '',
        x: -30,
        y: 100,
        w: 100,
        h: 50,
      } as Item,
      // 4. Valid item inside page
      {
        id: 'valid-item',
        kind: 'field',
        type: 'custom_text',
        key: 'k2',
        isDynamic: false,
        sample: false,
        style: { fontFamily: 'Cinzel', fontSize: 20, isBold: false, isItalic: false, color: '#000', alignment: 'center' },
        x: 150,
        y: 150,
        w: 120,
        h: 40,
      } as Item,
    ];

    const targets = snapTargets(items, new Set(['exclude-me']), page);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ x: 150, y: 150, w: 120, h: 40 });
  });

  it('10. snapResize: right edge 4 pt short of page snaps, bottom edge near target top snaps, and keepAspect maintains ratio', () => {
    const target: Box = { x: 500, y: 320, w: 100, h: 50 };

    // Box at x = 100, w = 738 -> right edge = 838 (4 pt short of page.w = 842)
    // Box y = 100, h = 218 -> bottom edge = 318 (2 pt short of target.y = 320, safely away from page.h/2 = 297.5)
    const box: Box = { x: 100, y: 100, w: 738, h: 218 };

    // Without keepAspect:
    const resNoAspect = snapResize(box, [target], page, { threshold: 6, keepAspect: false });
    expect(resNoAspect.dw).toBe(4);
    expect(resNoAspect.dh).toBe(2);
    expect(resNoAspect.guides.some((g) => g.axis === 'v' && g.pos === 842)).toBe(true);
    expect(resNoAspect.guides.some((g) => g.axis === 'h' && g.pos === 320)).toBe(true);

    // With keepAspect (dominant shift is dh = 2 vs dw = 4, so dh is dominant):
    const resAspect = snapResize(box, [target], page, { threshold: 6, keepAspect: true });
    expect(resAspect.dh).toBe(2);
    const expectedW = (218 + 2) * (738 / 218);
    expect(Math.abs(resAspect.dw - (expectedW - 738))).toBeLessThan(0.01);
  });

  it('11. distancesFor returns the right gaps and ignores non-overlapping neighbours', () => {
    const leftNeighbour: Box = { x: 100, y: 200, w: 100, h: 50 }; // x: 100-200, y: 200-250
    const nonOverlapping: Box = { x: 50, y: 400, w: 100, h: 50 }; // y: 400-450 (does not overlap y: 200-250)
    const moving: Box = { x: 250, y: 200, w: 100, h: 50 }; // x: 250-350, y: 200-250

    const gaps = distancesFor(moving, [leftNeighbour, nonOverlapping], page);

    // Left gap: moving.x (250) - (100 + 100) = 50
    const leftGap = gaps.find((g) => g.dir === 'horizontal' && g.a === 200 && g.b === 250);
    expect(leftGap).toBeDefined();
    expect(leftGap?.value).toBe(50);

    // Right gap: to page edge 842 - 350 = 492
    const rightGap = gaps.find((g) => g.dir === 'horizontal' && g.b === 842);
    expect(rightGap).toBeDefined();
    expect(rightGap?.value).toBe(492);
  });

  it('12. shuffling the targets array gives identical results', () => {
    const targets: Box[] = [
      { x: 100, y: 100, w: 80, h: 40 },
      { x: 250, y: 150, w: 60, h: 50 },
      { x: 400, y: 200, w: 100, h: 60 },
      { x: 600, y: 100, w: 90, h: 45 },
      { x: 300, y: 350, w: 70, h: 30 },
    ];

    const moving: Box = { x: 248, y: 198, w: 90, h: 40 };

    const res1 = snapMove(moving, targets, page, { threshold: 6 });

    // Reversed
    const res2 = snapMove(moving, [...targets].reverse(), page, { threshold: 6 });
    expect(res1.dx).toBe(res2.dx);
    expect(res1.dy).toBe(res2.dy);
    expect(res1.guides.length).toBe(res2.guides.length);
    expect(res1.gaps.length).toBe(res2.gaps.length);

    // Permuted
    const permuted = [targets[2], targets[4], targets[0], targets[3], targets[1]];
    const res3 = snapMove(moving, permuted, page, { threshold: 6 });
    expect(res1.dx).toBe(res3.dx);
    expect(res1.dy).toBe(res3.dy);
    expect(res1.guides.length).toBe(res3.guides.length);
    expect(res1.gaps.length).toBe(res3.gaps.length);
  });
});
