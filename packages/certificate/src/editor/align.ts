import type { Box } from './geometry';

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'middleY' | 'bottom';

/** Computes dx and dy for each entry to align with the reference box. */
export function alignDeltas(
  entries: { id: string; box: Box }[],
  mode: AlignMode,
  ref: Box
): { id: string; dx: number; dy: number }[] {
  return entries.map((e) => {
    let dx = 0;
    let dy = 0;
    switch (mode) {
      case 'left':
        dx = ref.x - e.box.x;
        break;
      case 'centerX':
        dx = ref.x + ref.w / 2 - (e.box.x + e.box.w / 2);
        break;
      case 'right':
        dx = ref.x + ref.w - (e.box.x + e.box.w);
        break;
      case 'top':
        dy = ref.y - e.box.y;
        break;
      case 'middleY':
        dy = ref.y + ref.h / 2 - (e.box.y + e.box.h / 2);
        break;
      case 'bottom':
        dy = ref.y + ref.h - (e.box.y + e.box.h);
        break;
    }
    return {
      id: e.id,
      dx: Math.round(dx * 100) / 100,
      dy: Math.round(dy * 100) / 100,
    };
  });
}

/** Computes deltas to distribute 3 or more entries with equal gaps along an axis. */
export function distributeDeltas(
  entries: { id: string; box: Box }[],
  axis: 'x' | 'y'
): { id: string; dx: number; dy: number }[] {
  if (entries.length < 3) return [];

  if (axis === 'x') {
    const sorted = [...entries].sort((a, b) => a.box.x - b.box.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const left = first.box.x;
    const right = last.box.x + last.box.w;
    const sumW = sorted.reduce((sum, e) => sum + e.box.w, 0);
    const totalGap = right - left - sumW;
    const equalGap = totalGap / (sorted.length - 1);

    const deltas = new Map<string, { dx: number; dy: number }>();
    deltas.set(first.id, { dx: 0, dy: 0 });
    deltas.set(last.id, { dx: 0, dy: 0 });

    let currentEdge = left + first.box.w;
    for (let i = 1; i < sorted.length - 1; i++) {
      const e = sorted[i];
      const targetX = currentEdge + equalGap;
      const dx = Math.round((targetX - e.box.x) * 100) / 100;
      deltas.set(e.id, { dx, dy: 0 });
      currentEdge = targetX + e.box.w;
    }

    return entries.map((e) => ({
      id: e.id,
      ...(deltas.get(e.id) || { dx: 0, dy: 0 }),
    }));
  }

  // axis === 'y'
  const sorted = [...entries].sort((a, b) => a.box.y - b.box.y);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const top = first.box.y;
  const bottom = last.box.y + last.box.h;
  const sumH = sorted.reduce((sum, e) => sum + e.box.h, 0);
  const totalGap = bottom - top - sumH;
  const equalGap = totalGap / (sorted.length - 1);

  const deltas = new Map<string, { dx: number; dy: number }>();
  deltas.set(first.id, { dx: 0, dy: 0 });
  deltas.set(last.id, { dx: 0, dy: 0 });

  let currentEdge = top + first.box.h;
  for (let i = 1; i < sorted.length - 1; i++) {
    const e = sorted[i];
    const targetY = currentEdge + equalGap;
    const dy = Math.round((targetY - e.box.y) * 100) / 100;
    deltas.set(e.id, { dx: 0, dy });
    currentEdge = targetY + e.box.h;
  }

  return entries.map((e) => ({
    id: e.id,
    ...(deltas.get(e.id) || { dx: 0, dy: 0 }),
  }));
}
