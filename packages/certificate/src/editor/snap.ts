import type { Box } from './geometry';

export type GuideKind = 'page' | 'margin' | 'item';

export interface Guide {
  axis: 'v' | 'h'; // 'v' = vertical line at x = pos; 'h' = horizontal line at y = pos
  pos: number;
  from: number;
  to: number;
  kind: GuideKind;
}

export interface GapMark {
  dir: 'horizontal' | 'vertical';
  a: number;
  b: number;
  at: number;
  value: number; // b - a in points
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
  gaps: GapMark[];
}

interface TargetLine {
  val: number;
  kind: GuideKind;
  target?: Box;
}

const KIND_PRIORITY: Record<GuideKind, number> = {
  page: 3,
  margin: 2,
  item: 1,
};

function overlapsY(a: Box, b: Box): boolean {
  if (a.h === 0) return a.y >= b.y && a.y <= b.y + b.h;
  if (b.h === 0) return b.y >= a.y && b.y <= a.y + a.h;
  return Math.max(a.y, b.y) < Math.min(a.y + a.h, b.y + b.h);
}

function overlapsX(a: Box, b: Box): boolean {
  if (a.w === 0) return a.x >= b.x && a.x <= b.x + b.w;
  if (b.w === 0) return b.x >= a.x && b.x <= a.x + a.w;
  return Math.max(a.x, b.x) < Math.min(a.x + a.w, b.x + b.w);
}

/** Snap a moving box to page lines, margins, items, and equal spacing. */
export function snapMove(
  moving: Box,
  targets: Box[],
  page: { w: number; h: number },
  opts: { threshold: number; margin?: number }
): SnapResult {
  const threshold = opts.threshold;
  const margin = opts.margin ?? 36;

  // 1. Vertical alignment lines (x-coordinates)
  const xTargets: TargetLine[] = [
    { val: 0, kind: 'page' },
    { val: page.w / 2, kind: 'page' },
    { val: page.w, kind: 'page' },
    { val: margin, kind: 'margin' },
    { val: page.w - margin, kind: 'margin' },
  ];
  for (const t of targets) {
    xTargets.push({ val: t.x, kind: 'item', target: t });
    xTargets.push({ val: t.x + t.w / 2, kind: 'item', target: t });
    xTargets.push({ val: t.x + t.w, kind: 'item', target: t });
  }

  const movingXLines = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];

  let bestDx: number | null = null;
  let bestXAbs = Infinity;
  let bestXKindPri = -1;
  let bestXTgtVal = -Infinity;

  for (const m of movingXLines) {
    for (const tgt of xTargets) {
      const diff = tgt.val - m;
      const absDiff = Math.abs(diff);
      if (absDiff <= threshold) {
        const pri = KIND_PRIORITY[tgt.kind];
        if (
          absDiff < bestXAbs - 1e-4 ||
          (Math.abs(absDiff - bestXAbs) <= 1e-4 &&
            (pri > bestXKindPri || (pri === bestXKindPri && tgt.val < bestXTgtVal)))
        ) {
          bestDx = diff;
          bestXAbs = absDiff;
          bestXKindPri = pri;
          bestXTgtVal = tgt.val;
        }
      }
    }
  }

  // 2. Horizontal alignment lines (y-coordinates)
  const yTargets: TargetLine[] = [
    { val: 0, kind: 'page' },
    { val: page.h / 2, kind: 'page' },
    { val: page.h, kind: 'page' },
    { val: margin, kind: 'margin' },
    { val: page.h - margin, kind: 'margin' },
  ];
  for (const t of targets) {
    yTargets.push({ val: t.y, kind: 'item', target: t });
    yTargets.push({ val: t.y + t.h / 2, kind: 'item', target: t });
    yTargets.push({ val: t.y + t.h, kind: 'item', target: t });
  }

  const movingYLines = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];

  let bestDy: number | null = null;
  let bestYAbs = Infinity;
  let bestYKindPri = -1;
  let bestYTgtVal = -Infinity;

  for (const m of movingYLines) {
    for (const tgt of yTargets) {
      const diff = tgt.val - m;
      const absDiff = Math.abs(diff);
      if (absDiff <= threshold) {
        const pri = KIND_PRIORITY[tgt.kind];
        if (
          absDiff < bestYAbs - 1e-4 ||
          (Math.abs(absDiff - bestYAbs) <= 1e-4 &&
            (pri > bestYKindPri || (pri === bestYKindPri && tgt.val < bestYTgtVal)))
        ) {
          bestDy = diff;
          bestYAbs = absDiff;
          bestYKindPri = pri;
          bestYTgtVal = tgt.val;
        }
      }
    }
  }

  let dx = bestDx !== null ? bestDx : 0;
  let dy = bestDy !== null ? bestDy : 0;
  const gaps: GapMark[] = [];

  // 3. Equal Spacing (only on axes where rule 1 found NO alignment snap)
  if (bestDx === null) {
    // Horizontal equal spacing
    const vTargets = targets.filter((t) => overlapsY(t, moving));
    const leftTargets = vTargets.filter((t) => t.x + t.w <= moving.x);
    const rightTargets = vTargets.filter((t) => t.x >= moving.x + moving.w);

    let candA: { shift: number; gaps: GapMark[] } | null = null;
    let candB: { shift: number; gaps: GapMark[] } | null = null;

    // (a) Between
    if (leftTargets.length > 0 || rightTargets.length > 0) {
      let maxLeftEdge = 0;
      for (const t of leftTargets) {
        if (t.x + t.w > maxLeftEdge) maxLeftEdge = t.x + t.w;
      }
      let minRightEdge = page.w;
      for (const t of rightTargets) {
        if (t.x < minRightEdge) minRightEdge = t.x;
      }

      const gapLeft = moving.x - maxLeftEdge;
      const gapRight = minRightEdge - (moving.x + moving.w);
      if (gapLeft >= 0 && gapRight >= 0) {
        const shiftA = (gapRight - gapLeft) / 2;
        if (Math.abs(shiftA) <= threshold) {
          const snappedX = moving.x + shiftA;
          const val = Math.round((gapLeft + shiftA) * 10) / 10;
          const at = moving.y + moving.h / 2;
          candA = {
            shift: shiftA,
            gaps: [
              { dir: 'horizontal', a: maxLeftEdge, b: snappedX, at, value: val },
              { dir: 'horizontal', a: snappedX + moving.w, b: minRightEdge, at, value: val },
            ],
          };
        }
      }
    }

    // (b) Repeat spacing
    // Search pairs of targets T1, T2 where T1 is left of T2 with gap g
    const sortedTargets = [...vTargets].sort((a, b) => a.x - b.x);
    let bestShiftB: number | null = null;
    let bestGapsB: GapMark[] = [];
    let bestShiftBAbs = Infinity;

    for (let i = 0; i < sortedTargets.length; i++) {
      for (let j = i + 1; j < sortedTargets.length; j++) {
        const t1 = sortedTargets[i];
        const t2 = sortedTargets[j];
        if (t1.x + t1.w > t2.x) continue;
        // Check if there is another target strictly between t1 and t2
        const between = sortedTargets.some(
          (other, k) => k !== i && k !== j && other.x >= t1.x + t1.w && other.x + other.w <= t2.x
        );
        if (between) continue;

        const g = t2.x - (t1.x + t1.w);
        if (g <= 0) continue;

        // Check if moving sits next to t2 on the right
        if (moving.x >= t2.x + t2.w) {
          const curGap = moving.x - (t2.x + t2.w);
          const shift = g - curGap;
          if (Math.abs(shift) <= threshold && Math.abs(shift) < bestShiftBAbs) {
            bestShiftBAbs = Math.abs(shift);
            bestShiftB = shift;
            const snappedX = moving.x + shift;
            const at = moving.y + moving.h / 2;
            const val = Math.round(g * 10) / 10;
            bestGapsB = [
              { dir: 'horizontal', a: t1.x + t1.w, b: t2.x, at, value: val },
              { dir: 'horizontal', a: t2.x + t2.w, b: snappedX, at, value: val },
            ];
          }
        }

        // Check if moving sits next to t1 on the left
        if (moving.x + moving.w <= t1.x) {
          const curGap = t1.x - (moving.x + moving.w);
          const shift = curGap - g;
          if (Math.abs(shift) <= threshold && Math.abs(shift) < bestShiftBAbs) {
            bestShiftBAbs = Math.abs(shift);
            bestShiftB = shift;
            const snappedX = moving.x + shift;
            const at = moving.y + moving.h / 2;
            const val = Math.round(g * 10) / 10;
            bestGapsB = [
              { dir: 'horizontal', a: t1.x + t1.w, b: t2.x, at, value: val },
              { dir: 'horizontal', a: snappedX + moving.w, b: t1.x, at, value: val },
            ];
          }
        }
      }
    }

    if (bestShiftB !== null) {
      candB = { shift: bestShiftB, gaps: bestGapsB };
    }

    if (candA && candB) {
      const chosen = Math.abs(candA.shift) <= Math.abs(candB.shift) ? candA : candB;
      dx = chosen.shift;
      gaps.push(...chosen.gaps);
    } else if (candA) {
      dx = candA.shift;
      gaps.push(...candA.gaps);
    } else if (candB) {
      dx = candB.shift;
      gaps.push(...candB.gaps);
    }
  }

  if (bestDy === null) {
    // Vertical equal spacing
    const hTargets = targets.filter((t) => overlapsX(t, moving));
    const topTargets = hTargets.filter((t) => t.y + t.h <= moving.y);
    const bottomTargets = hTargets.filter((t) => t.y >= moving.y + moving.h);

    let candA: { shift: number; gaps: GapMark[] } | null = null;
    let candB: { shift: number; gaps: GapMark[] } | null = null;

    // (a) Between
    if (topTargets.length > 0 || bottomTargets.length > 0) {
      let maxTopEdge = 0;
      for (const t of topTargets) {
        if (t.y + t.h > maxTopEdge) maxTopEdge = t.y + t.h;
      }
      let minBottomEdge = page.h;
      for (const t of bottomTargets) {
        if (t.y < minBottomEdge) minBottomEdge = t.y;
      }

      const gapTop = moving.y - maxTopEdge;
      const gapBottom = minBottomEdge - (moving.y + moving.h);
      if (gapTop >= 0 && gapBottom >= 0) {
        const shiftA = (gapBottom - gapTop) / 2;
        if (Math.abs(shiftA) <= threshold) {
          const snappedY = moving.y + shiftA;
          const val = Math.round((gapTop + shiftA) * 10) / 10;
          const at = moving.x + moving.w / 2;
          candA = {
            shift: shiftA,
            gaps: [
              { dir: 'vertical', a: maxTopEdge, b: snappedY, at, value: val },
              { dir: 'vertical', a: snappedY + moving.h, b: minBottomEdge, at, value: val },
            ],
          };
        }
      }
    }

    // (b) Repeat spacing
    const sortedTargets = [...hTargets].sort((a, b) => a.y - b.y);
    let bestShiftB: number | null = null;
    let bestGapsB: GapMark[] = [];
    let bestShiftBAbs = Infinity;

    for (let i = 0; i < sortedTargets.length; i++) {
      for (let j = i + 1; j < sortedTargets.length; j++) {
        const t1 = sortedTargets[i];
        const t2 = sortedTargets[j];
        if (t1.y + t1.h > t2.y) continue;
        const between = sortedTargets.some(
          (other, k) => k !== i && k !== j && other.y >= t1.y + t1.h && other.y + other.h <= t2.y
        );
        if (between) continue;

        const g = t2.y - (t1.y + t1.h);
        if (g <= 0) continue;

        // Moving below t2
        if (moving.y >= t2.y + t2.h) {
          const curGap = moving.y - (t2.y + t2.h);
          const shift = g - curGap;
          if (Math.abs(shift) <= threshold && Math.abs(shift) < bestShiftBAbs) {
            bestShiftBAbs = Math.abs(shift);
            bestShiftB = shift;
            const snappedY = moving.y + shift;
            const at = moving.x + moving.w / 2;
            const val = Math.round(g * 10) / 10;
            bestGapsB = [
              { dir: 'vertical', a: t1.y + t1.h, b: t2.y, at, value: val },
              { dir: 'vertical', a: t2.y + t2.h, b: snappedY, at, value: val },
            ];
          }
        }

        // Moving above t1
        if (moving.y + moving.h <= t1.y) {
          const curGap = t1.y - (moving.y + moving.h);
          const shift = curGap - g;
          if (Math.abs(shift) <= threshold && Math.abs(shift) < bestShiftBAbs) {
            bestShiftBAbs = Math.abs(shift);
            bestShiftB = shift;
            const snappedY = moving.y + shift;
            const at = moving.x + moving.w / 2;
            const val = Math.round(g * 10) / 10;
            bestGapsB = [
              { dir: 'vertical', a: t1.y + t1.h, b: t2.y, at, value: val },
              { dir: 'vertical', a: snappedY + moving.h, b: t1.y, at, value: val },
            ];
          }
        }
      }
    }

    if (bestShiftB !== null) {
      candB = { shift: bestShiftB, gaps: bestGapsB };
    }

    if (candA && candB) {
      const chosen = Math.abs(candA.shift) <= Math.abs(candB.shift) ? candA : candB;
      dy = chosen.shift;
      gaps.push(...chosen.gaps);
    } else if (candA) {
      dy = candA.shift;
      gaps.push(...candA.gaps);
    } else if (candB) {
      dy = candB.shift;
      gaps.push(...candB.gaps);
    }
  }

  // 4. Collect coincident guides after applying dx and dy
  const snappedBox: Box = {
    x: moving.x + dx,
    y: moving.y + dy,
    w: moving.w,
    h: moving.h,
  };

  const guidesMap = new Map<string, Guide>();

  // Check vertical guides (x axis)
  const snappedXLines = [snappedBox.x, snappedBox.x + snappedBox.w / 2, snappedBox.x + snappedBox.w];
  for (const m of snappedXLines) {
    for (const tgt of xTargets) {
      if (Math.abs(tgt.val - m) < 0.25) {
        const key = `v-${tgt.kind}-${Math.round(tgt.val * 10) / 10}`;
        if (tgt.kind === 'page' || tgt.kind === 'margin') {
          guidesMap.set(key, {
            axis: 'v',
            pos: tgt.val,
            from: 0,
            to: page.h,
            kind: tgt.kind,
          });
        } else if (tgt.target) {
          const from = Math.min(snappedBox.y, tgt.target.y);
          const to = Math.max(snappedBox.y + snappedBox.h, tgt.target.y + tgt.target.h);
          const existing = guidesMap.get(key);
          if (existing) {
            existing.from = Math.min(existing.from, from);
            existing.to = Math.max(existing.to, to);
          } else {
            guidesMap.set(key, {
              axis: 'v',
              pos: tgt.val,
              from,
              to,
              kind: 'item',
            });
          }
        }
      }
    }
  }

  // Check horizontal guides (y axis)
  const snappedYLines = [snappedBox.y, snappedBox.y + snappedBox.h / 2, snappedBox.y + snappedBox.h];
  for (const m of snappedYLines) {
    for (const tgt of yTargets) {
      if (Math.abs(tgt.val - m) < 0.25) {
        const key = `h-${tgt.kind}-${Math.round(tgt.val * 10) / 10}`;
        if (tgt.kind === 'page' || tgt.kind === 'margin') {
          guidesMap.set(key, {
            axis: 'h',
            pos: tgt.val,
            from: 0,
            to: page.w,
            kind: tgt.kind,
          });
        } else if (tgt.target) {
          const from = Math.min(snappedBox.x, tgt.target.x);
          const to = Math.max(snappedBox.x + snappedBox.w, tgt.target.x + tgt.target.w);
          const existing = guidesMap.get(key);
          if (existing) {
            existing.from = Math.min(existing.from, from);
            existing.to = Math.max(existing.to, to);
          } else {
            guidesMap.set(key, {
              axis: 'h',
              pos: tgt.val,
              from,
              to,
              kind: 'item',
            });
          }
        }
      }
    }
  }

  return {
    dx: Number.isFinite(dx) ? dx : 0,
    dy: Number.isFinite(dy) ? dy : 0,
    guides: Array.from(guidesMap.values()),
    gaps,
  };
}

/** Snap resize of right edge (x+w) and bottom edge (y+h). */
export function snapResize(
  box: Box,
  targets: Box[],
  page: { w: number; h: number },
  opts: { threshold: number; margin?: number; keepAspect?: boolean }
): { dw: number; dh: number; guides: Guide[] } {
  const threshold = opts.threshold;
  const margin = opts.margin ?? 36;
  const keepAspect = !!opts.keepAspect;

  const currRight = box.x + box.w;
  const currBottom = box.y + box.h;

  const xTargets: TargetLine[] = [
    { val: 0, kind: 'page' },
    { val: page.w / 2, kind: 'page' },
    { val: page.w, kind: 'page' },
    { val: margin, kind: 'margin' },
    { val: page.w - margin, kind: 'margin' },
  ];
  for (const t of targets) {
    xTargets.push({ val: t.x, kind: 'item', target: t });
    xTargets.push({ val: t.x + t.w / 2, kind: 'item', target: t });
    xTargets.push({ val: t.x + t.w, kind: 'item', target: t });
  }

  const yTargets: TargetLine[] = [
    { val: 0, kind: 'page' },
    { val: page.h / 2, kind: 'page' },
    { val: page.h, kind: 'page' },
    { val: margin, kind: 'margin' },
    { val: page.h - margin, kind: 'margin' },
  ];
  for (const t of targets) {
    yTargets.push({ val: t.y, kind: 'item', target: t });
    yTargets.push({ val: t.y + t.h / 2, kind: 'item', target: t });
    yTargets.push({ val: t.y + t.h, kind: 'item', target: t });
  }

  let bestDw: number | null = null;
  let bestWAbs = Infinity;
  let bestWKindPri = -1;
  let bestWTgtVal = -Infinity;

  for (const tgt of xTargets) {
    const diff = tgt.val - currRight;
    const absDiff = Math.abs(diff);
    if (absDiff <= threshold) {
      const pri = KIND_PRIORITY[tgt.kind];
      if (
        absDiff < bestWAbs - 1e-4 ||
        (Math.abs(absDiff - bestWAbs) <= 1e-4 &&
          (pri > bestWKindPri || (pri === bestWKindPri && tgt.val < bestWTgtVal)))
      ) {
        bestDw = diff;
        bestWAbs = absDiff;
        bestWKindPri = pri;
        bestWTgtVal = tgt.val;
      }
    }
  }

  let bestDh: number | null = null;
  let bestHAbs = Infinity;
  let bestHKindPri = -1;
  let bestHTgtVal = -Infinity;

  for (const tgt of yTargets) {
    const diff = tgt.val - currBottom;
    const absDiff = Math.abs(diff);
    if (absDiff <= threshold) {
      const pri = KIND_PRIORITY[tgt.kind];
      if (
        absDiff < bestHAbs - 1e-4 ||
        (Math.abs(absDiff - bestHAbs) <= 1e-4 &&
          (pri > bestHKindPri || (pri === bestHKindPri && tgt.val < bestHTgtVal)))
      ) {
        bestDh = diff;
        bestHAbs = absDiff;
        bestHKindPri = pri;
        bestHTgtVal = tgt.val;
      }
    }
  }

  let dw = bestDw !== null ? bestDw : 0;
  let dh = bestDh !== null ? bestDh : 0;

  if (keepAspect && box.h > 0) {
    const r = box.w / box.h;
    if (bestDw !== null && bestDh !== null) {
      if (Math.abs(bestDw) <= Math.abs(bestDh)) {
        dh = (box.w + dw) / r - box.h;
      } else {
        dw = (box.h + dh) * r - box.w;
      }
    } else if (bestDw !== null) {
      dh = (box.w + dw) / r - box.h;
    } else if (bestDh !== null) {
      dw = (box.h + dh) * r - box.w;
    }
  }

  const snappedRight = box.x + box.w + dw;
  const snappedBottom = box.y + box.h + dh;
  const guidesMap = new Map<string, Guide>();

  for (const tgt of xTargets) {
    if (Math.abs(tgt.val - snappedRight) < 0.25) {
      const key = `v-${tgt.kind}-${Math.round(tgt.val * 10) / 10}`;
      if (tgt.kind === 'page' || tgt.kind === 'margin') {
        guidesMap.set(key, {
          axis: 'v',
          pos: tgt.val,
          from: 0,
          to: page.h,
          kind: tgt.kind,
        });
      } else if (tgt.target) {
        const from = Math.min(box.y, tgt.target.y);
        const to = Math.max(snappedBottom, tgt.target.y + tgt.target.h);
        const existing = guidesMap.get(key);
        if (existing) {
          existing.from = Math.min(existing.from, from);
          existing.to = Math.max(existing.to, to);
        } else {
          guidesMap.set(key, {
            axis: 'v',
            pos: tgt.val,
            from,
            to,
            kind: 'item',
          });
        }
      }
    }
  }

  for (const tgt of yTargets) {
    if (Math.abs(tgt.val - snappedBottom) < 0.25) {
      const key = `h-${tgt.kind}-${Math.round(tgt.val * 10) / 10}`;
      if (tgt.kind === 'page' || tgt.kind === 'margin') {
        guidesMap.set(key, {
          axis: 'h',
          pos: tgt.val,
          from: 0,
          to: page.w,
          kind: tgt.kind,
        });
      } else if (tgt.target) {
        const from = Math.min(box.x, tgt.target.x);
        const to = Math.max(snappedRight, tgt.target.x + tgt.target.w);
        const existing = guidesMap.get(key);
        if (existing) {
          existing.from = Math.min(existing.from, from);
          existing.to = Math.max(existing.to, to);
        } else {
          guidesMap.set(key, {
            axis: 'h',
            pos: tgt.val,
            from,
            to,
            kind: 'item',
          });
        }
      }
    }
  }

  return { dw, dh, guides: Array.from(guidesMap.values()) };
}

/** Gap to nearest neighbour or page edge on each of the 4 sides. */
export function distancesFor(
  moving: Box,
  targets: Box[],
  page: { w: number; h: number }
): GapMark[] {
  const gaps: GapMark[] = [];

  // 1. Left side (horizontal)
  const vLeft = targets.filter((t) => t.x + t.w <= moving.x && overlapsY(t, moving));
  let leftEdge = 0;
  for (const t of vLeft) {
    if (t.x + t.w > leftEdge) leftEdge = t.x + t.w;
  }
  if (moving.x > leftEdge) {
    gaps.push({
      dir: 'horizontal',
      a: leftEdge,
      b: moving.x,
      at: moving.y + moving.h / 2,
      value: Math.round((moving.x - leftEdge) * 10) / 10,
    });
  }

  // 2. Right side (horizontal)
  const vRight = targets.filter((t) => t.x >= moving.x + moving.w && overlapsY(t, moving));
  let rightEdge = page.w;
  for (const t of vRight) {
    if (t.x < rightEdge) rightEdge = t.x;
  }
  if (rightEdge > moving.x + moving.w) {
    gaps.push({
      dir: 'horizontal',
      a: moving.x + moving.w,
      b: rightEdge,
      at: moving.y + moving.h / 2,
      value: Math.round((rightEdge - (moving.x + moving.w)) * 10) / 10,
    });
  }

  // 3. Top side (vertical)
  const hTop = targets.filter((t) => t.y + t.h <= moving.y && overlapsX(t, moving));
  let topEdge = 0;
  for (const t of hTop) {
    if (t.y + t.h > topEdge) topEdge = t.y + t.h;
  }
  if (moving.y > topEdge) {
    gaps.push({
      dir: 'vertical',
      a: topEdge,
      b: moving.y,
      at: moving.x + moving.w / 2,
      value: Math.round((moving.y - topEdge) * 10) / 10,
    });
  }

  // 4. Bottom side (vertical)
  const hBottom = targets.filter((t) => t.y >= moving.y + moving.h && overlapsX(t, moving));
  let bottomEdge = page.h;
  for (const t of hBottom) {
    if (t.y < bottomEdge) bottomEdge = t.y;
  }
  if (bottomEdge > moving.y + moving.h) {
    gaps.push({
      dir: 'vertical',
      a: moving.y + moving.h,
      b: bottomEdge,
      at: moving.x + moving.w / 2,
      value: Math.round((bottomEdge - (moving.y + moving.h)) * 10) / 10,
    });
  }

  return gaps;
}
