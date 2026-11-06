'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  itemBox,
  pct,
  sampleValues,
  snapTargets,
  snapMove,
  snapResize,
  distancesFor,
  unionBox,
  itemBounds,
  marqueeHits,
  nextSelection,
  type Box,
  type Item,
} from '@siescoms/certificate';
import { EMPTY_SNAP, useApp } from '@/lib/store';
import { CertView } from '../common';
import { ItemPopover } from './ItemPopover';
import { SnapGuides } from './SnapGuides';
import { SelectionBar } from './SelectionBar';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const NUDGE = 1;

/** Moves, resizes, nudges and keyboard shortcuts. */
function useEditorKeys() {
  const guideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState();
      if (s.step !== 2) return;
      const t = e.target as HTMLElement | null;
      if (t && /INPUT|SELECT|TEXTAREA/.test(t.tagName)) return;

      const mod = e.metaKey || e.ctrlKey;
      const k = (e.key || '').toLowerCase();

      // Undo / Redo
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }

      // Select All (visible, unlocked items except campus illustration)
      if (mod && k === 'a') {
        e.preventDefault();
        const all = s.design.items
          .filter(
            (it) =>
              !it.locked &&
              !it.hidden &&
              !(it.kind === 'image' && (it as { campus?: boolean }).campus)
          )
          .map((it) => it.id);
        s.select(all);
        return;
      }

      // Clear selection
      if (e.key === 'Escape') {
        s.select([]);
        return;
      }

      // Layer ordering shortcuts
      if (mod && e.key === ']') {
        e.preventDefault();
        if (e.shiftKey) s.reorder('front');
        else s.reorder('forward');
        return;
      }
      if (mod && e.key === '[') {
        e.preventDefault();
        if (e.shiftKey) s.reorder('back');
        else s.reorder('backward');
        return;
      }

      // Delete / Backspace removes selected unlocked items
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selIds.length > 0) {
          e.preventDefault();
          s.removeMany(s.selIds);
          return;
        }
      }

      // Arrow keys nudge all selected unlocked items
      const st = e.shiftKey ? 10 : NUDGE;
      const d = (
        {
          ArrowLeft: [-st, 0],
          ArrowRight: [st, 0],
          ArrowUp: [0, -st],
          ArrowDown: [0, st],
        } as Record<string, number[]>
      )[e.key];

      if (d) {
        if (s.selIds.length > 0) {
          e.preventDefault();
          s.nudgeSelection(d[0], d[1]);
          // Clean up helping lines after nudging stops
          if (guideTimerRef.current) clearTimeout(guideTimerRef.current);
          guideTimerRef.current = setTimeout(() => {
            useApp.getState().setSnap(EMPTY_SNAP);
          }, 1200);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (guideTimerRef.current) clearTimeout(guideTimerRef.current);
    };
  }, []);
}

export function EditorStage() {
  const design = useApp((s) => s.design);
  const selIds = useApp((s) => s.selIds);
  const sel = useApp((s) => s.sel);
  const multiMode = useApp((s) => s.multiMode);
  const clean = useApp((s) => s.clean);
  const longName = useApp((s) => s.longName);
  const pastN = useApp((s) => s.past.length);
  const futureN = useApp((s) => s.future.length);
  const { set, select, undo, redo, go } = useApp.getState();
  const ref = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);

  // Marquee state
  const [marquee, setMarquee] = useState<Box | null>(null);

  useEditorKeys();

  const page = design.page;
  const items = design.items;
  const hasName = items.some((i) => i.kind === 'field' && i.type === 'recipient_name');
  const selItem = selIds.length === 1 ? items.find((i) => i.id === selIds[0]) || null : null;
  const sample = items.find((i) => i.kind === 'field' && i.sample);
  const hiBox =
    !hasName && !clean
      ? sample
        ? { x: sample.x, y: sample.y, w: sample.w, h: sample.h }
        : design.detected
      : null;

  // Item interaction handler (Move or Resize)
  const down = (id: string, mode: 'move' | 'size') => (e: React.PointerEvent) => {
    const s = useApp.getState();
    if (s.clean) return;
    const it = s.design.items.find((i) => i.id === id);
    if (!it || it.locked || it.hidden || !ref.current) return;

    e.stopPropagation();
    e.preventDefault();

    const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey || s.multiMode;

    if (mode === 'move' && isAdditive) {
      // Toggle item in selection and do not start drag
      s.select(nextSelection(s.selIds, id, true));
      return;
    }

    let activeSelIds = s.selIds;
    if (!s.selIds.includes(id)) {
      activeSelIds = [id];
      s.select([id]);
    }

    const isMultiMove = activeSelIds.length > 1;
    const movingItems = s.design.items.filter(
      (item) => activeSelIds.includes(item.id) && !item.locked && !item.hidden
    );
    const initialPositions = new Map(
      movingItems.map((item) => [item.id, { x: item.x, y: item.y }])
    );
    const initialUnion = unionBox(movingItems.map(itemBounds));

    // Compute snap targets ONCE when gesture starts
    const targets = snapTargets(items, new Set(activeSelIds), page);

    const k = page.w / ref.current.getBoundingClientRect().width;
    const sx = e.clientX,
      sy = e.clientY;
    let moved = false;

    const mv = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) * k,
        dy = (ev.clientY - sy) * k;
      if (!moved) {
        if (Math.abs(dx) + Math.abs(dy) < 2) return;
        moved = true;
        s.record();
      }

      const thresholdPt = 6 * k;

      if (mode === 'move') {
        const noSnap = ev.ctrlKey || ev.metaKey;
        const showDist = ev.altKey;

        const rawUnionBox: Box = {
          x: initialUnion.x + dx,
          y: initialUnion.y + dy,
          w: initialUnion.w,
          h: initialUnion.h,
        };

        let shiftX = dx;
        let shiftY = dy;
        let guides: typeof s.snap.guides = [];
        let gaps: typeof s.snap.gaps = [];

        if (noSnap) {
          if (showDist) {
            gaps = distancesFor(rawUnionBox, targets, page);
          }
        } else {
          const snapRes = snapMove(rawUnionBox, targets, page, {
            threshold: thresholdPt,
            margin: 36,
          });
          shiftX = dx + snapRes.dx;
          shiftY = dy + snapRes.dy;
          guides = snapRes.guides;
          gaps = snapRes.gaps;
          if (showDist) {
            const extraGaps = distancesFor(
              {
                x: rawUnionBox.x + snapRes.dx,
                y: rawUnionBox.y + snapRes.dy,
                w: rawUnionBox.w,
                h: rawUnionBox.h,
              },
              targets,
              page
            );
            gaps = [...gaps, ...extraGaps];
          }
        }

        s.edit(
          (d) => ({
            ...d,
            items: d.items.map((item) => {
              const init = initialPositions.get(item.id);
              if (!init) return item;
              return {
                ...item,
                x: Math.round((init.x + shiftX) * 100) / 100,
                y: Math.round((init.y + shiftY) * 100) / 100,
              };
            }),
          }),
          false
        );

        s.setSnap({ guides, gaps, badge: null });
      } else {
        // 'size' mode (single item only)
        const rawW = clamp(it.w + dx, 8, 2400);
        const rawH = clamp(it.h + dy, 4, 2400);
        const keepAspect = ev.shiftKey || it.kind === 'lockup';

        const snapRes = snapResize(
          { x: it.x, y: it.y, w: rawW, h: rawH },
          targets,
          page,
          { threshold: thresholdPt, margin: 36, keepAspect }
        );

        const w = Math.round((rawW + snapRes.dw) * 100) / 100;
        let h = it.kind === 'line' ? it.h : Math.round((rawH + snapRes.dh) * 100) / 100;
        if (it.kind === 'lockup') {
          h = Math.round(w * 0.52 * 100) / 100;
        }

        const badge = {
          x: it.x + w,
          y: it.y + h,
          text: `${((w * 25.4) / 72).toFixed(1)} x ${((h * 25.4) / 72).toFixed(1)} mm`,
        };

        const p: Partial<Item> =
          it.kind === 'lockup' ? { w, h } : it.kind === 'line' ? { w } : { w, h };

        s.updItem(id, p, false);
        s.setSnap({ guides: snapRes.guides, gaps: [], badge });
      }
    };

    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      s.setSnap(EMPTY_SNAP);
      if (!moved && isMultiMove) {
        // Release without move collapses selection to just that item
        s.select([id]);
      }
      force((n) => n + 1);
    };

    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // Canvas Marquee / Background PointerDown
  const onCanvasDown = (e: React.PointerEvent) => {
    const s = useApp.getState();
    if (s.clean || !ref.current) return;

    // Touch devices scroll instead of marquee
    if (e.pointerType === 'touch') {
      if (s.selIds.length > 0 && !s.multiMode) {
        s.select([]);
      }
      return;
    }

    const rect = ref.current.getBoundingClientRect();
    const k = page.w / rect.width;
    const sx = (e.clientX - rect.left) * k;
    const sy = (e.clientY - rect.top) * k;
    const clientStartX = e.clientX;
    const clientStartY = e.clientY;
    const isAdditive = e.shiftKey || s.multiMode;
    const initialSel = isAdditive ? s.selIds : [];

    let activeMarquee = false;

    const onMv = (ev: PointerEvent) => {
      const curX = (ev.clientX - rect.left) * k;
      const curY = (ev.clientY - rect.top) * k;
      const distPx = Math.hypot(ev.clientX - clientStartX, ev.clientY - clientStartY);

      if (!activeMarquee) {
        if (distPx < 4) return;
        activeMarquee = true;
      }

      const mBox: Box = {
        x: Math.min(sx, curX),
        y: Math.min(sy, curY),
        w: Math.abs(curX - sx),
        h: Math.abs(curY - sy),
      };

      setMarquee(mBox);

      const entries = s.design.items.map((item) => ({
        id: item.id,
        box: itemBounds(item),
        locked: item.locked,
        hidden: item.hidden,
      }));

      const hits = marqueeHits(entries, mBox, page);
      const next = isAdditive ? Array.from(new Set([...initialSel, ...hits])) : hits;
      s.select(next);
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMv);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setMarquee(null);

      const distPx = Math.hypot(ev.clientX - clientStartX, ev.clientY - clientStartY);
      if (distPx < 4 && !isAdditive) {
        s.select([]);
      }
    };

    window.addEventListener('pointermove', onMv);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <section className="stage">
      <div className="stage-bar">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="toggle-chip"
            style={{ height: 34 }}
            disabled={!pastN}
            onClick={undo}
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            className="toggle-chip"
            style={{ height: 34 }}
            disabled={!futureN}
            onClick={redo}
            title="Redo (Ctrl+Y)"
          >
            Redo ↷
          </button>
          <button
            type="button"
            className={`toggle-chip${clean ? ' on' : ''}`}
            style={{ height: 34 }}
            onClick={() => set({ clean: !clean, sel: null, selIds: [] })}
          >
            {clean ? 'Back to editing' : 'Preview'}
          </button>
          <button
            type="button"
            className={`toggle-chip${multiMode ? ' on' : ''}`}
            style={{ height: 34 }}
            onClick={() => set({ multiMode: !multiMode })}
            title="Toggle multi-select for touch"
          >
            Select several
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-ghost btn-top" onClick={() => go(1)}>
            ← Back
          </button>
          <button
            type="button"
            className="btn btn-primary btn-top"
            disabled={!hasName}
            onClick={() => go(3)}
          >
            Continue to recipients →
          </button>
        </div>
      </div>

      {/* Selection Toolbar Bar */}
      <SelectionBar />

      <div className="editor" ref={ref} onPointerDown={onCanvasDown}>
        <CertView design={design} values={sampleValues(design, longName)}>
          {!clean
            ? items.map((it) => {
                if (it.hidden) return null;

                const isSel = selIds.includes(it.id);

                if (it.locked) {
                  // A selected locked item shows a non-interactive dashed outline
                  if (isSel) {
                    return (
                      <div
                        key={it.id}
                        className="hit locked sel"
                        style={itemBox(it, page)}
                      />
                    );
                  }
                  return null;
                }

                const frame =
                  it.kind === 'shape' && !it.fill && !it.grad && !!it.stroke;
                const cls = [
                  'hit',
                  frame && 'frame',
                  isSel && 'sel',
                  it.kind === 'field' && it.isDynamic && 'dyn',
                  it.kind === 'patch' && 'patch',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={it.id}
                    className={cls}
                    style={itemBox(it, page)}
                    onPointerDown={frame ? undefined : down(it.id, 'move')}
                  >
                    {frame
                      ? (['t', 'b', 'l', 'r'] as const).map((s) => (
                          <div
                            key={s}
                            className={`edge ${s}`}
                            onPointerDown={down(it.id, 'move')}
                          />
                        ))
                      : null}
                    {isSel && selIds.length === 1 ? (
                      <div className="handle" onPointerDown={down(it.id, 'size')} />
                    ) : null}
                  </div>
                );
              })
            : null}

          {/* Group Bounding Box when 2+ items selected */}
          {!clean &&
            selIds.length >= 2 &&
            (() => {
              const selectedItems = items.filter(
                (it) => selIds.includes(it.id) && !it.hidden
              );
              if (selectedItems.length < 2) return null;
              const groupBox = unionBox(selectedItems.map(itemBounds));
              return (
                <div
                  className="group-bounding-box"
                  style={{
                    position: 'absolute',
                    left: pct(groupBox.x, page.w),
                    top: pct(groupBox.y, page.h),
                    width: pct(groupBox.w, page.w),
                    height: pct(groupBox.h, page.h),
                    border: '1.5px dashed #2563eb',
                    pointerEvents: 'none',
                    zIndex: 8,
                  }}
                />
              );
            })()}

          {/* Marquee Selection Rectangle */}
          {marquee && (
            <div
              className="marquee-box"
              style={{
                position: 'absolute',
                left: pct(marquee.x, page.w),
                top: pct(marquee.y, page.h),
                width: pct(marquee.w, page.w),
                height: pct(marquee.h, page.h),
                border: '1px dashed #2563eb',
                background: 'rgba(37, 99, 235, 0.08)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />
          )}

          {hiBox ? (
            <div
              className="hilite"
              style={{
                left: pct(hiBox.x - 6, page.w),
                top: pct(hiBox.y - 3, page.h),
                width: pct(hiBox.w + 12, page.w),
                height: pct(hiBox.h + 6, page.h),
              }}
            />
          ) : null}

          <SnapGuides page={page} />

          <AnimatePresence>
            {selItem && !clean && !selItem.locked && selIds.length === 1 ? (
              <ItemPopover key={selItem.id} item={selItem} />
            ) : null}
          </AnimatePresence>
        </CertView>
      </div>
      <div className="stage-hint">
        {clean
          ? 'Preview: this is how the printed certificate will look.'
          : 'Arrow keys nudge · Hold Ctrl to move without snapping · Hold Alt to see distances · Ctrl+Z undoes'}
      </div>
    </section>
  );
}
