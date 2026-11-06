import type { Item } from '../model';

export type LayerOp = 'forward' | 'backward' | 'front' | 'back';

/**
 * Reorders items according to paint order (index 0 = back, last index = front).
 * Returns a new array without mutating the input.
 */
export function reorderItems(
  items: Item[],
  ids: string[],
  op: LayerOp
): Item[] {
  const idSet = new Set(ids);
  if (items.length <= 1 || idSet.size === 0) return [...items];

  if (op === 'front') {
    const unselected = items.filter((it) => !idSet.has(it.id));
    const selected = items.filter((it) => idSet.has(it.id));
    return [...unselected, ...selected];
  }

  if (op === 'back') {
    const unselected = items.filter((it) => !idSet.has(it.id));
    const selected = items.filter((it) => idSet.has(it.id));
    return [...selected, ...unselected];
  }

  if (op === 'forward') {
    const arr = [...items];
    for (let i = arr.length - 2; i >= 0; i--) {
      if (idSet.has(arr[i].id) && !idSet.has(arr[i + 1].id)) {
        const tmp = arr[i];
        arr[i] = arr[i + 1];
        arr[i + 1] = tmp;
      }
    }
    return arr;
  }

  if (op === 'backward') {
    const arr = [...items];
    for (let i = 1; i < arr.length; i++) {
      if (idSet.has(arr[i].id) && !idSet.has(arr[i - 1].id)) {
        const tmp = arr[i];
        arr[i] = arr[i - 1];
        arr[i - 1] = tmp;
      }
    }
    return arr;
  }

  return [...items];
}

/** Moves an item with id to the specified index in the paint order. */
export function moveLayer(
  items: Item[],
  id: string,
  toIndex: number
): Item[] {
  const fromIndex = items.findIndex((it) => it.id === id);
  if (fromIndex === -1) return [...items];

  const targetIndex = Math.max(0, Math.min(items.length - 1, toIndex));
  if (fromIndex === targetIndex) return [...items];

  const result = [...items];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(targetIndex, 0, removed);
  return result;
}
