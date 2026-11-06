import type { Box } from './geometry';

/** Checks which item boxes intersect a marquee selection rectangle. */
export function marqueeHits(
  entries: { id: string; box: Box; locked?: boolean; hidden?: boolean }[],
  marquee: Box,
  page: { w: number; h: number }
): string[] {
  // Normalize marquee in case it was dragged backwards
  const mx = marquee.w < 0 ? marquee.x + marquee.w : marquee.x;
  const my = marquee.h < 0 ? marquee.y + marquee.h : marquee.y;
  const mw = Math.abs(marquee.w);
  const mh = Math.abs(marquee.h);

  const hits: string[] = [];

  for (const e of entries) {
    if (e.locked || e.hidden) continue;

    const b = e.box;
    // Skip background items whose box covers > 70% of the page in both directions
    if (b.w >= 0.7 * page.w && b.h >= 0.7 * page.h) continue;

    // Check intersection
    const overlapX =
      b.w === 0
        ? b.x >= mx && b.x <= mx + mw
        : Math.max(0, Math.min(b.x + b.w, mx + mw) - Math.max(b.x, mx)) > 0;

    const overlapY =
      b.h === 0
        ? b.y >= my && b.y <= my + mh
        : Math.max(0, Math.min(b.y + b.h, my + mh) - Math.max(b.y, my)) > 0;

    if (overlapX && overlapY) {
      hits.push(e.id);
    }
  }

  return hits;
}

/** Toggles an item in or out of selection (if additive) or sets selection to just [id]. */
export function nextSelection(
  current: string[],
  id: string,
  additive: boolean
): string[] {
  if (!additive) return [id];
  if (current.includes(id)) {
    return current.filter((x) => x !== id);
  }
  return [...current, id];
}
