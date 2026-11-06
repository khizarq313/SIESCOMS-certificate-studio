import type { Item } from '../model';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned bounding box of an item after its rotation about its centre. */
export function itemBounds(it: Item): Box {
  if (it.kind === 'line') {
    const cy = it.y + it.h / 2;
    if (!it.rot || it.rot === 0) {
      return { x: it.x, y: cy, w: it.w, h: 0 };
    }
    const cx = it.x + it.w / 2;
    const rad = (it.rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const p1x = cx + (it.x - cx) * cos;
    const p1y = cy + (it.x - cx) * sin;
    const p2x = cx + (it.x + it.w - cx) * cos;
    const p2y = cy + (it.x + it.w - cx) * sin;
    const minX = Math.round(Math.min(p1x, p2x) * 10000) / 10000;
    const maxX = Math.round(Math.max(p1x, p2x) * 10000) / 10000;
    const minY = Math.round(Math.min(p1y, p2y) * 10000) / 10000;
    const maxY = Math.round(Math.max(p1y, p2y) * 10000) / 10000;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  if (!it.rot || it.rot === 0) {
    return { x: it.x, y: it.y, w: it.w, h: it.h };
  }

  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  const rad = (it.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: it.x, y: it.y },
    { x: it.x + it.w, y: it.y },
    { x: it.x + it.w, y: it.y + it.h },
    { x: it.x, y: it.y + it.h },
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const c of corners) {
    const rx = cx + (c.x - cx) * cos - (c.y - cy) * sin;
    const ry = cy + (c.x - cx) * sin + (c.y - cy) * cos;
    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;
  }

  minX = Math.round(minX * 10000) / 10000;
  maxX = Math.round(maxX * 10000) / 10000;
  minY = Math.round(minY * 10000) / 10000;
  maxY = Math.round(maxY * 10000) / 10000;

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Axis-aligned bounding box enclosing all provided boxes. */
export function unionBox(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Filter and extract target boxes for snapping. */
export function snapTargets(
  items: Item[],
  excludeIds: Set<string>,
  page: { w: number; h: number }
): Box[] {
  const targets: Box[] = [];
  for (const it of items) {
    if (excludeIds.has(it.id)) continue;
    if (it.hidden) continue;
    if (it.kind === 'image' && (it as { campus?: boolean }).campus) continue;
    const b = itemBounds(it);
    if (it.kind !== 'line' && (b.w <= 0 || b.h <= 0)) continue;
    const outLeft = -b.x;
    const outRight = b.x + b.w - page.w;
    const outTop = -b.y;
    const outBottom = b.y + b.h - page.h;
    if (b.w > 0 && (outLeft > 0.2 * b.w || outRight > 0.2 * b.w)) continue;
    if (b.h > 0 && (outTop > 0.2 * b.h || outBottom > 0.2 * b.h)) continue;
    if (it.kind === 'line' && (b.y < 0 || b.y > page.h)) continue;
    targets.push(b);
  }
  return targets;
}
