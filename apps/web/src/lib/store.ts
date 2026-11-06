// App state, ported from the prototype's single component.
'use client';
import { create } from 'zustand';
import {
  campusItem, designFromTemplate, freeKey, letteringFor, makeField, makePatch, newId, templateById,
  type ColumnMap, type Design, type FieldItem, type Item, type Row, type TextStyle,
  type Guide, type GapMark,
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
  sel: string | null;
  clean: boolean;
  snap: SnapState;
  longName: boolean;
  triedLong: boolean;
  layersOpen: boolean;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  past: Design[];
  future: Design[];
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
  remove: (id: string) => void;
  dup: (id: string) => void;
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
  designId: null, design: DEFAULT_DESIGN, sel: null, clean: false, snap: EMPTY_SNAP, longName: false, triedLong: false, layersOpen: false,
  saveState: 'idle', past: [], future: [],
  recipMode: 'single', manualPeople: [{ id: '1', values: {}, email: '' }], single: {}, singleEmail: '', rows: [], headers: [], map: {}, emailCol: '', prevIdx: 0, dataName: '', dataNote: '', listBusy: false, listError: '',
  delivery: 'download', fmt: 'zip', baseName: 'symposium_certificates', sender: 'system', smtp: { host: '', port: '587', user: '', pass: '' },
  smtpTest: null, smtpMsg: '',
  subject: 'Your certificate for {{event_name}}',
  body: 'Dear {{recipient_name}},\n\nThank you for taking part in {{event_name}}. Your certificate is attached to this email.\n\nWarm regards,\nDr. Meera Iyer\nHead of Department',
  run: null,

  set: (p) => set(p as never),
  go: (n) => set((s) => ({ step: n, maxStep: (Math.max(s.maxStep, n) as Step), sel: null, snap: EMPTY_SNAP })),
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
  undo: () => set((s) => (s.past.length ? { design: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [...s.future, s.design], sel: null } : {})),
  redo: () => set((s) => (s.future.length ? { design: s.future[s.future.length - 1], future: s.future.slice(0, -1), past: [...s.past, s.design], sel: null } : {})),

  updItem: (id, p, record = true) => get().edit((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? ({ ...i, ...p } as Item) : i)) }), record),
  updStyle: (id, p) => get().edit((d) => ({ ...d, items: d.items.map((i) => (i.id === id && i.kind === 'field' ? { ...i, style: { ...i.style, ...p } } : i)) })),
  remove: (id) => { get().edit((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) })); set({ sel: null }); },
  dup: (id) => {
    const { design } = get();
    const it = design.items.find((i) => i.id === id);
    if (!it) return;
    const c = { ...it, id: newId(), x: it.x + 14, y: it.y + 14 } as Item;
    if (c.kind === 'field') {
      c.sample = false;
      c.style = { ...c.style };
      if (c.type !== 'custom_text') {
        c.key = freeKey(design, c.type);
        c.label = `${it.label} copy`;
      }
    }
    if (c.kind === 'image') c.campus = false;
    get().edit((d) => ({ ...d, items: [...d.items, c] }));
    set({ sel: c.id });
  },
  addItems: (items) => {
    get().edit((d) => ({ ...d, items: [...d.items, ...items] }));
    set({ sel: items[items.length - 1]?.id ?? null });
  },

  useTemplate: (id, campus, name) => {
    const s = get();
    // Keep edits if the same template is picked again.
    if (s.design.templateId === id && s.design.items.some((i) => i.kind === 'image' && i.campus) === campus && s.designId) return;
    set({ design: designFromTemplate(id, campus, name || s.design.name), designId: null, past: [], future: [], sel: null, longName: false, triedLong: false, clean: false, saveState: 'idle' });
  },
  useUpload: (info, pageIndex, name) => {
    set({
      design: {
        name, templateId: 'upload', page: info.page, bg: '#FFFFFF', pattern: '', dark: false,
        background: { fileKey: info.fileKey, fileType: info.fileType, pageIndex, pages: info.pages, fileName: info.fileName },
        detected: info.detected, items: [],
      },
      designId: null, past: [], future: [], sel: null, longName: false, triedLong: false, clean: false, saveState: 'idle',
    });
  },
  loadSaved: (id, design) => set({ design, designId: id, past: [], future: [], sel: null, longName: false, triedLong: false, clean: false, saveState: 'saved', tplPick: design.templateId === 'upload' ? get().tplPick : design.templateId }),

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
      set({ sel: rec.id });
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
    set({ sel: rec.id });
  },
  toggleCampus: () => {
    const { design } = get();
    const t = templateById(design.templateId);
    get().edit((d) => ({ ...d, items: d.items.some((i) => i.kind === 'image' && i.campus) ? d.items.filter((i) => !(i.kind === 'image' && i.campus)) : [campusItem(t, d.page), ...d.items] }));
    set({ sel: null });
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
