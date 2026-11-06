import type { Item } from '../model';
import { freeKey } from '../values';

/**
 * Deeply clones items, applying an offset, generating new IDs,
 * updating keys and labels, and resetting locked/hidden flags.
 */
export function cloneItems(
  source: Item[],
  design: { items: Item[] },
  offset: number,
  makeId: () => string
): Item[] {
  if (source.length === 0) return [];

  const clones: Item[] = [];
  const evolvingItems = [...design.items];

  for (const it of source) {
    const c = structuredClone(it) as Item;
    c.id = makeId();
    c.x = Math.round((c.x + offset) * 100) / 100;
    c.y = Math.round((c.y + offset) * 100) / 100;
    c.locked = false;
    c.hidden = undefined;

    if (c.kind === 'field') {
      c.sample = false;
      if (c.type !== 'custom_text') {
        c.key = freeKey({ items: evolvingItems }, c.type);
        c.label = `${it.label} copy`;
      }
    }

    if (c.kind === 'image') {
      (c as { campus?: boolean }).campus = false;
    }

    clones.push(c);
    evolvingItems.push(c);
  }

  return clones;
}

