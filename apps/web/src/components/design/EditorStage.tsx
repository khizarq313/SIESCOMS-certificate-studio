'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { itemBox, pct, sampleValues, type Item } from '@siescoms/certificate';
import { useApp } from '@/lib/store';
import { CertView } from '../common';
import { ItemPopover } from './ItemPopover';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const NUDGE = 1;

/** Moves, resizes, nudges and keyboard shortcuts, ported from the prototype's down()/key(). */
function useEditorKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState();
      if (s.step !== 2) return;
      const t = e.target as HTMLElement | null;
      if (t && /INPUT|SELECT|TEXTAREA/.test(t.tagName)) return;
      const mod = e.metaKey || e.ctrlKey, k = (e.key || '').toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); s.redo(); return; }
      if (e.key === 'Escape') { s.set({ sel: null }); return; }
      const it = s.design.items.find((i) => i.id === s.sel);
      if (!it || s.clean || it.locked) return;
      const st = e.shiftKey ? 10 : NUDGE;
      const d = ({ ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] } as Record<string, number[]>)[e.key];
      if (d) { e.preventDefault(); s.updItem(it.id, { x: it.x + d[0], y: it.y + d[1] }); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); s.remove(it.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function EditorStage() {
  const design = useApp((s) => s.design);
  const sel = useApp((s) => s.sel);
  const clean = useApp((s) => s.clean);
  const guide = useApp((s) => s.guide);
  const longName = useApp((s) => s.longName);
  const pastN = useApp((s) => s.past.length);
  const futureN = useApp((s) => s.future.length);
  const { set, undo, redo, go } = useApp.getState();
  const ref = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);
  useEditorKeys();

  const page = design.page;
  const items = design.items;
  const hasName = items.some((i) => i.kind === 'field' && i.type === 'recipient_name');
  const selItem = items.find((i) => i.id === sel) || null;
  const sample = items.find((i) => i.kind === 'field' && i.sample);
  const hiBox = !hasName && !clean ? (sample ? { x: sample.x, y: sample.y, w: sample.w, h: sample.h } : design.detected) : null;

  const down = (id: string, mode: 'move' | 'size') => (e: React.PointerEvent) => {
    const s = useApp.getState();
    if (s.clean) return;
    const it = s.design.items.find((i) => i.id === id);
    if (!it || it.locked || !ref.current) return;
    e.stopPropagation();
    e.preventDefault();
    if (s.sel !== id) s.set({ sel: id });
    const k = page.w / ref.current.getBoundingClientRect().width;
    const sx = e.clientX, sy = e.clientY;
    let moved = false, g0 = false;
    const mv = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) * k, dy = (ev.clientY - sy) * k;
      if (!moved) { if (Math.abs(dx) + Math.abs(dy) < 2) return; moved = true; s.record(); }
      if (mode === 'move') {
        let x = clamp(it.x + dx, -it.w + 12, page.w - 12);
        const y = clamp(it.y + dy, -it.h + 6, page.h - 6);
        let g = false;
        if (Math.abs(x + it.w / 2 - page.w / 2) < 5) { x = page.w / 2 - it.w / 2; g = true; }
        s.updItem(id, { x: Math.round(x), y: Math.round(y) }, false);
        if (g !== g0) { g0 = g; s.set({ guide: g }); }
      } else {
        const w = Math.round(clamp(it.w + dx, 8, 2400));
        const p: Partial<Item> = it.kind === 'lockup' ? { w, h: Math.round(w * 0.52) } : it.kind === 'line' ? { w } : { w, h: Math.round(clamp(it.h + dy, 4, 2400)) };
        s.updItem(id, p, false);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      if (g0) s.set({ guide: false });
      force((n) => n + 1);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };

  return (
    <section className="stage">
      <div className="stage-bar">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="toggle-chip" style={{ height: 34 }} disabled={!pastN} onClick={undo} title="Undo (Ctrl+Z)">↶ Undo</button>
          <button type="button" className="toggle-chip" style={{ height: 34 }} disabled={!futureN} onClick={redo} title="Redo (Ctrl+Y)">Redo ↷</button>
          <button type="button" className={`toggle-chip${clean ? ' on' : ''}`} style={{ height: 34 }} onClick={() => set({ clean: !clean, sel: null })}>{clean ? 'Back to editing' : 'Preview'}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-ghost btn-top" onClick={() => go(1)}>← Back</button>
          <button type="button" className="btn btn-primary btn-top" disabled={!hasName} onClick={() => go(3)}>Continue to recipients →</button>
        </div>
      </div>
      <div className="editor" ref={ref} onPointerDown={() => { if (useApp.getState().sel) set({ sel: null }); }}>
        <CertView design={design} values={sampleValues(design, longName)}>
          {!clean ? items.filter((it) => !it.locked).map((it) => {
            const frame = it.kind === 'shape' && !it.fill && !it.grad && !!it.stroke;
            const isSel = it.id === sel;
            const cls = ['hit', frame && 'frame', isSel && 'sel', it.kind === 'field' && it.isDynamic && 'dyn', it.kind === 'patch' && 'patch'].filter(Boolean).join(' ');
            return (
              <div key={it.id} className={cls} style={itemBox(it, page)} onPointerDown={frame ? undefined : down(it.id, 'move')}>
                {frame ? (['t', 'b', 'l', 'r'] as const).map((s) => <div key={s} className={`edge ${s}`} onPointerDown={down(it.id, 'move')} />) : null}
                {isSel ? <div className="handle" onPointerDown={down(it.id, 'size')} /> : null}
              </div>
            );
          }) : null}
          {hiBox ? <div className="hilite" style={{ left: pct(hiBox.x - 6, page.w), top: pct(hiBox.y - 3, page.h), width: pct(hiBox.w + 12, page.w), height: pct(hiBox.h + 6, page.h) }} /> : null}
          {guide ? <div className="center-guide" /> : null}
          <AnimatePresence>
            {selItem && !clean && !selItem.locked ? <ItemPopover key={selItem.id} item={selItem} /> : null}
          </AnimatePresence>
        </CertView>
      </div>
      <div className="stage-hint">{clean ? 'Preview: this is how the printed certificate will look.' : 'Arrow keys nudge · Delete removes · Ctrl+Z undoes'}</div>
    </section>
  );
}
