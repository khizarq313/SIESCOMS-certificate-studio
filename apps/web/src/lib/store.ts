// App state, ported from the prototype's single component.
'use client';
import { create } from 'zustand';
import {
  campusItem, designFromTemplate, freeKey, letteringFor, makeField, makePatch, newId, templateById,
  type ColumnMap, type Design, type FieldItem, type Item, type Row, type TextStyle,
  type Guide, type GapMark,
  alignDeltas, distributeDeltas, reorderItems, moveLayer as reorderLayer, itemBounds, unionBox,
  snapTargets, snapMove, cloneItems,
  type AlignMode, type LayerOp,
} from '@siescoms/certificate';
import type { JobResult, UploadInfo } from './api';

export type Step = 1 | 2 | 3 | 4;
export const STEP_SLUGS = ['start', 'design', 'recipients', 'delivery'] as const;

export interface SnapState {
  guides: Guide[];
  gaps: GapMark[];
  badge: { x: number; y: number; text: string } | null;
}

export const EMPTY_SNAP: SnapState = { guides: [], gaps: [], badge: null };

export interface ManualPerson {
  id: string;
  values: Record<string, string>;
  email: string;
}

export interface RunState {
  jobId: string | null;
  kind: 'download' | 'email';
  total: number;
  done: number;
  results: JobResult[]; // newest first
  finished: boolean;
  cancelled: boolean;
  err: string;
  testOnly: boolean;
  fileName: string | null;
}

interface State {
  step: Step;
  maxStep: Step;
  // Start
  srcMode: 'tpl' | 'upload';
  tplPick: string;
  campus: boolean;
  upload: { status: 'idle' | 'busy' | 'done'; pct: number; phase: 'upload' | 'read'; fileName: string; error: string; info: UploadInfo | null; pageIndex: number };
  // Design
  designId: string | null;
  design: Design;
  selIds: string[];
  sel: string | null;
  multiMode: boolean;
  clean: boolean;
  snap: SnapState;
  longName: boolean;
  triedLong: boolean;
  layersOpen: boolean;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  past: Design[];
  future: Design[];
  // Clipboard, context menu & shortcuts
  clipboard: { items: Item[]; pastes: number } | null;
  ctx: { x: number; y: number; target: 'item' | 'canvas'; px: number; py: number } | null;
  helpOpen: boolean;
  notice: string | null;
  // Recipients
  recipMode: 'single' | 'list';
  manualPeople: ManualPerson[];
  single: Record<string, string>;
  singleEmail: string;
  rows: Row[];
  headers: string[];
  map: ColumnMap;
  emailCol: string;
  prevIdx: number;
  dataName: string;
  dataNote: string;
  listBusy: boolean;
  listError: string;
  // Delivery
  delivery: 'download' | 'email';
  fmt: 'zip' | 'pdf';
  baseName: string;
  sender: 'system' | 'smtp';
  smtp: { host: string; port: string; user: string; pass: string };
  smtpTest: null | 'testing' | 'ok' | 'fail';
  smtpMsg: string;
  subject: string;
  body: string;
  run: RunState | null;
}

interface Actions {
  set: (p: Partial<State> | ((s: State) => Partial<State>)) => void;
  go: (n: Step) => void;
  /** Change the design and record an undo step. */
  edit: (fn: (d: Design) => Design, record?: boolean) => void;
  record: () => void;
  undo: () => void;
  redo: () => void;
  updItem: (id: string, p: Partial<Item>, record?: boolean) => void;
  updStyle: (id: string, p: Partial<TextStyle>) => void;
  select: (ids: string[]) => void;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  dup: (id: string) => void;
  dupMany: (ids: string[]) => void;
  copy: () => void;
  cut: () => void;
  paste: (at?: { px: number; py: number }) => void;
  duplicateSelection: () => void;
  openCtx: (ctx: { x: number; y: number; target: 'item' | 'canvas'; px: number; py: number }) => void;
  closeCtx: () => void;
  setHelp: (open: boolean) => void;
  setNotice: (msg: string | null) => void;
  setLocked: (ids: string[], value: boolean) => void;
  setHidden: (ids: string[], value: boolean) => void;
  alignSelection: (mode: AlignMode) => void;
  distributeSelection: (axis: 'x' | 'y') => void;
  reorder: (op: LayerOp) => void;
  moveLayer: (id: string, toIndex: number) => void;
  nudgeSelection: (dx: number, dy: number) => void;
  addItems: (items: Item[]) => void;
  useTemplate: (id: string, campus: boolean, name?: string) => void;
  useUpload: (info: UploadInfo, pageIndex: number, name: string) => void;
  loadSaved: (id: string, design: Design) => void;
  replaceSampleName: (paperColor?: string) => void;
  toggleCampus: () => void;
  addManualPerson: () => void;
  removeManualPerson: (id: string) => void;
  updateManualPerson: (id: string, patch: { values?: Record<string, string>; email?: string }) => void;
  setSnap: (next: SnapState) => void;
}

const DEFAULT_DESIGN = designFromTemplate('classic', false, 'Tech Symposium — Participation');
const HISTORY = 120;

export const useApp = create<State & Actions>()((set, get) => ({
  step: 1, maxStep: 1,
  srcMode: 'tpl', tplPick: 'classic', campus: false,
  upload: { status: 'idle', pct: 0, phase: 'upload', fileName: '', error: '', info: null, pageIndex: 0 },
  designId: null, design: DEFAULT_DESIGN, selIds: [], sel: null, multiMode: false, clean: false, snap: EMPTY_SNAP, longName: false, triedLong: false, layersOpen: false,
  saveState: 'idle', past: [], future: [],
  clipboard: null, ctx: null, helpOpen: false, notice: null,
  recipMode: 'single', manualPeople: [{ id: '1', values: {}, email: '' }], single: {}, singleEmail: '', rows: [], headers: [], map: {}, emailCol: '', prevIdx: 0, dataName: '', dataNote: '', listBusy: false, listError: '',
  delivery: 'download', fmt: 'zip', baseName: 'symposium_certificates', sender: 'system', smtp: { host: '', port: '587', user: '', pass: '' },
  smtpTest: null, smtpMsg: '',
  subject: 'Your certificate for {{event_name}}',
  body: 'Dear {{recipient_name}},\n\nThank you for taking part in {{event_name}}. Your certificate is attached to this email.\n\nWarm regards,\nDr. Meera Iyer\nHead of Department',
  run: null,

  set: (p) => set(p as never),
  select: (ids) => set({ selIds: ids, sel: ids.length === 1 ? ids[0] : null }),
  go: (n) => set((s) => ({ step: n, maxStep: (Math.max(s.maxStep, n) as Step), sel: null, selIds: [], snap: EMPTY_SNAP, ctx: null, helpOpen: false })),
  setSnap: (next) => {
    const cur = get().snap;
    if (JSON.stringify(cur) !== JSON.stringify(next)) {
      set({ snap: next });
    }
  },

  record: () => set((s) => ({ past: [...s.past.slice(-(HISTORY - 1)), s.design], future: [] })),
  edit: (fn, record = true) => {
    if (record) get().record();
    set((s) => ({ design: fn(s.design) }));
  },
  undo: () => set((s) => (s.past.length ? { design: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [...s.future, s.design], sel: null, selIds: [] } : {})),
  redo: () => set((s) => (s.future.length ? { design: s.future[s.future.length - 1], future: s.future.slice(0, -1), past: [...s.past, s.design], sel: null, selIds: [] } : {})),

  updItem: (id, p, record = true) => get().edit((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? ({ ...i, ...p } as Item) : i)) }), record),
  updStyle: (id, p) => get().edit((d) => ({ ...d, items: d.items.map((i) => (i.id === id && i.kind === 'field' ? { ...i, style: { ...i.style, ...p } } : i)) })),
  remove: (id) => get().removeMany([id]),
  removeMany: (ids) => {
    const idSet = new Set(ids);
    get().edit((d) => ({ ...d, items: d.items.filter((i) => !idSet.has(i.id) || i.locked) }));
    const remaining = get().selIds.filter((id) => !idSet.has(id));
    get().select(remaining);
  },
  dup: (id) => get().dupMany([id]),
  dupMany: (ids) => {
    const { design } = get();
    const idSet = new Set(ids);
    const toDup = design.items.filter((i) => idSet.has(i.id) && !i.locked);
    if (toDup.length === 0) return;
    if (design.items.length + toDup.length > 500) {
      get().setNotice('Maximum 500 items per certificate');
      return;
    }
    const copies = cloneItems(toDup, design, 14, newId);
    get().edit((d) => ({ ...d, items: [...d.items, ...copies] }));
    get().select(copies.map((c) => c.id));
  },
  copy: () => {
    const { design, selIds } = get();
    const idSet = new Set(selIds);
    const selected = design.items.filter((i) => idSet.has(i.id) && !i.hidden);
    if (selected.length === 0) return;
    set({ clipboard: { items: structuredClone(selected), pastes: 0 } });
  },
  cut: () => {
    const { design, selIds } = get();
    const idSet = new Set(selIds);
    const selected = design.items.filter((i) => idSet.has(i.id) && !i.locked && !i.hidden);
    if (selected.length === 0) return;
    set({ clipboard: { items: structuredClone(selected), pastes: 0 } });
    get().removeMany(selIds);
  },
  paste: (at) => {
    const { clipboard, design } = get();
    if (!clipboard || clipboard.items.length === 0) return;
    if (design.items.length + clipboard.items.length > 500) {
      get().setNotice('Maximum 500 items per certificate');
      return;
    }
    let clones: Item[];
    if (at) {
      const bounds = unionBox(clipboard.items.map(itemBounds));
      const dx = Math.round(at.px - (bounds.x + bounds.w / 2));
      const dy = Math.round(at.py - (bounds.y + bounds.h / 2));
      clones = cloneItems(clipboard.items, design, { dx, dy }, newId);
    } else {
      const offset = (clipboard.pastes + 1) * 10;
      clones = cloneItems(clipboard.items, design, offset, newId);
    }
    set({ clipboard: { ...clipboard, pastes: clipboard.pastes + 1 } });
    get().edit((d) => ({ ...d, items: [...d.items, ...clones] }));
    get().select(clones.map((c) => c.id));
  },
  duplicateSelection: () => {
    const { selIds } = get();
    get().dupMany(selIds);
  },
  openCtx: (ctx) => set({ ctx }),
  closeCtx: () => set({ ctx: null }),
  setHelp: (open) => set({ helpOpen: open }),
  setNotice: (msg) => {
    set({ notice: msg });
    if (msg) {
      setTimeout(() => {
        if (get().notice === msg) set({ notice: null });
      }, 3000);
    }
  },
  setLocked: (ids, value) => {
    const idSet = new Set(ids);
    get().edit((d) => ({
      ...d,
      items: d.items.map((i) => (idSet.has(i.id) ? ({ ...i, locked: value } as Item) : i)),
    }));
  },
  setHidden: (ids, value) => {
    const idSet = new Set(ids);
    get().edit((d) => ({
      ...d,
      items: d.items.map((i) => {
        if (idSet.has(i.id)) {
          if (i.kind === 'field' && i.type === 'recipient_name') return i;
          return { ...i, hidden: value } as Item;
        }
        return i;
      }),
    }));
  },
  alignSelection: (mode) => {
    const { design, selIds } = get();
    const selected = design.items.filter((i) => selIds.includes(i.id) && !i.locked);
    if (selected.length === 0) return;
    const entries = selected.map((i) => ({ id: i.id, box: itemBounds(i) }));
    const ref =
      entries.length >= 2
        ? unionBox(entries.map((e) => e.box))
        : { x: 0, y: 0, w: design.page.w, h: design.page.h };
    const deltas = alignDeltas(entries, mode, ref);
    const deltaMap = new Map(deltas.map((d) => [d.id, d]));
    get().edit((d) => ({
      ...d,
      items: d.items.map((i) => {
        const delta = deltaMap.get(i.id);
        if (delta) {
          return {
            ...i,
            x: Math.round((i.x + delta.dx) * 100) / 100,
            y: Math.round((i.y + delta.dy) * 100) / 100,
          } as Item;
        }
        return i;
      }),
    }));
  },
  distributeSelection: (axis) => {
    const { design, selIds } = get();
    const selected = design.items.filter((i) => selIds.includes(i.id) && !i.locked);
    if (selected.length < 3) return;
    const entries = selected.map((i) => ({ id: i.id, box: itemBounds(i) }));
    const deltas = distributeDeltas(entries, axis);
    const deltaMap = new Map(deltas.map((d) => [d.id, d]));
    get().edit((d) => ({
      ...d,
      items: d.items.map((i) => {
        const delta = deltaMap.get(i.id);
        if (delta) {
          return {
            ...i,
            x: Math.round((i.x + delta.dx) * 100) / 100,
            y: Math.round((i.y + delta.dy) * 100) / 100,
          } as Item;
        }
        return i;
      }),
    }));
  },
  reorder: (op) => {
    const { selIds } = get();
    get().edit((d) => ({ ...d, items: reorderItems(d.items, selIds, op) }));
  },
  moveLayer: (id, toIndex) => {
    get().edit((d) => ({ ...d, items: reorderLayer(d.items, id, toIndex) }));
  },
  nudgeSelection: (dx, dy) => {
    const { design, selIds } = get();
    const idSet = new Set(selIds);
    get().edit(
      (d) => ({
        ...d,
        items: d.items.map((i) =>
          idSet.has(i.id) && !i.locked
            ? ({
                ...i,
                x: Math.round((i.x + dx) * 100) / 100,
                y: Math.round((i.y + dy) * 100) / 100,
              } as Item)
            : i
        ),
      }),
      true
    );
    const selected = get().design.items.filter((i) => idSet.has(i.id) && !i.locked);
    if (selected.length > 0) {
      const movingBox = unionBox(selected.map(itemBounds));
      const targets = snapTargets(get().design.items, idSet, design.page);
      const snapRes = snapMove(movingBox, targets, design.page, { threshold: 1, margin: 36 });
      if (snapRes.guides.length > 0) {
        get().setSnap({ guides: snapRes.guides, gaps: snapRes.gaps, badge: null });
      }
    }
  },
  addItems: (items) => {
    get().edit((d) => ({ ...d, items: [...d.items, ...items] }));
    const last = items[items.length - 1];
    get().select(last ? [last.id] : []);
  },

  useTemplate: (id, campus, name) => {
    const s = get();
    // Keep edits if the same template is picked again.
    if (s.design.templateId === id && s.design.items.some((i) => i.kind === 'image' && i.campus) === campus && s.designId) return;
    set({ design: designFromTemplate(id, campus, name || s.design.name), designId: null, past: [], future: [], sel: null, selIds: [], longName: false, triedLong: false, clean: false, saveState: 'idle' });
  },
  useUpload: (info, pageIndex, name) => {
    set({
      design: {
        name, templateId: 'upload', page: info.page, bg: '#FFFFFF', pattern: '', dark: false,
        background: { fileKey: info.fileKey, fileType: info.fileType, pageIndex, pages: info.pages, fileName: info.fileName },
        detected: info.detected, items: [],
      },
      designId: null, past: [], future: [], sel: null, selIds: [], longName: false, triedLong: false, clean: false, saveState: 'idle',
    });
  },
  loadSaved: (id, design) => set({ design, designId: id, past: [], future: [], sel: null, selIds: [], longName: false, triedLong: false, clean: false, saveState: 'saved', tplPick: design.templateId === 'upload' ? get().tplPick : design.templateId }),

  replaceSampleName: (paperColor) => {
    const { design } = get();
    const L = letteringFor(design);
    const smp = design.items.find((i): i is FieldItem => i.kind === 'field' && !!i.sample);
    if (smp) {
      // Built-in design: the sample text becomes the recipient-name field, keeping its lettering.
      const cx = smp.x + smp.w / 2;
      const rec: FieldItem = {
        ...smp, id: newId(), type: 'recipient_name', key: 'recipient_name', label: 'Recipient Name', isDynamic: true, sampleValue: 'Aarav Sharma', defaultValue: '', sample: false, locked: false,
        x: Math.round(cx - 210), w: 420, y: smp.y - 4, h: Math.max(smp.h + 8, 50), style: { ...smp.style, autoShrink: true, minFontSize: 12 },
      };
      get().edit((d) => ({ ...d, items: d.items.map((i) => (i.id === smp.id ? rec : i)) }));
      get().select([rec.id]);
      return;
    }
    const det = design.detected;
    if (!det) return;
    // Uploaded certificate: cover the printed name, then put the recipient name there.
    const patch = makePatch(det.x, det.y, det.w, det.h, paperColor || '#FFFFFF');
    const rec = makeField('recipient_name', 0, 0, L) as FieldItem;
    const size = Math.round(Math.max(16, Math.min(60, det.fontSize * 1.1)));
    const w = Math.max(det.w + 80, Math.min(design.page.w * 0.7, 520));
    Object.assign(rec, { x: Math.round(det.x + det.w / 2 - w / 2), y: Math.round(det.y + det.h / 2 - size * 0.75), w: Math.round(w), h: Math.round(size * 1.5) });
    rec.style = { ...rec.style, fontSize: size };
    get().edit((d) => ({ ...d, items: [...d.items, patch, rec] }));
    get().select([rec.id]);
  },
  toggleCampus: () => {
    const { design } = get();
    const t = templateById(design.templateId);
    get().edit((d) => ({ ...d, items: d.items.some((i) => i.kind === 'image' && i.campus) ? d.items.filter((i) => !(i.kind === 'image' && i.campus)) : [campusItem(t, d.page), ...d.items] }));
    set({ sel: null, selIds: [] });
  },

  addManualPerson: () => {
    const s = get();
    const nextId = String(Date.now() + Math.random());
    const nextList: ManualPerson[] = [...s.manualPeople, { id: nextId, values: {}, email: '' }];
    set({
      manualPeople: nextList,
      prevIdx: nextList.length - 1,
    });
  },
  removeManualPerson: (id) => {
    const s = get();
    if (s.manualPeople.length <= 1) return;
    const nextList = s.manualPeople.filter((p) => p.id !== id);
    const nextIdx = Math.min(s.prevIdx, Math.max(0, nextList.length - 1));
    set({
      manualPeople: nextList,
      prevIdx: nextIdx,
      single: nextList[0]?.values || {},
      singleEmail: nextList[0]?.email || '',
    });
  },
  updateManualPerson: (id, patch) => {
    const s = get();
    const nextList = s.manualPeople.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        values: patch.values !== undefined ? { ...p.values, ...patch.values } : p.values,
        email: patch.email !== undefined ? patch.email : p.email,
      };
    });
    set({
      manualPeople: nextList,
      single: nextList[0]?.values || {},
      singleEmail: nextList[0]?.email || '',
    });
  },
}));
