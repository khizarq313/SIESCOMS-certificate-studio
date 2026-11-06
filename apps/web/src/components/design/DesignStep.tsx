'use client';
import { useState } from 'react';
import {
  FIELD_PRESETS, Ln, Lk, POS, fontCss, freeKey, letteringFor, makeField, templateById,
  type FieldItem, type Item, nextSelection,
} from '@siescoms/certificate';
import { useApp } from '@/lib/store';
import { renderBackground, paperColorAround } from '@/lib/pdfBackground';
import { Badge, Switch } from '../common';
import { EditorStage } from './EditorStage';

const KIND: Record<Item['kind'], string> = { field: 'text', shape: 'shape', line: 'line', image: 'image', lockup: 'logo', patch: 'cover' };

/** The "Other details" chips, with the prototype's placement rules. */
function useDetailChips() {
  const design = useApp((s) => s.design);
  const addItems = useApp((s) => s.addItems);
  const items = design.items;
  const L = letteringFor(design);
  const dx = design.templateId === 'upload' ? 0 : templateById(design.templateId).dx || 0;
  // Positions are laid out for A4 landscape; scale them for other page sizes.
  const sx = design.page.w / 842, sy = design.page.h / 595;
  const X = (x: number) => Math.round(x * sx), Y = (y: number) => Math.round(y * sy);
  const cnt = (t: string) => items.filter((i) => (i.kind === 'field' || i.kind === 'image') && i.type === t && (t !== 'custom_text' || /^Custom Text/.test(i.label))).length;
  const mk = (type: keyof typeof FIELD_PRESETS, x: number, y: number) => {
    const f = makeField(type, X(x), Y(y), L);
    const n = cnt(type);
    if (n) f.label = `${f.label} ${n + 1}`;
    if (f.kind === 'field') f.key = freeKey(design, type);
    return f;
  };
  const SLOT = [195, 647, 421];
  const slot = (n: number) => SLOT[n % 3] + dx;
  const row = (n: number) => Math.floor(n / 3) * -64;
  const near = (x: number, y: number) => items.some((i) => i.kind === 'line' && Math.abs(i.y + 4 - Y(y)) < 10 && Math.abs(i.x + i.w / 2 - X(x)) < 50);
  const CH: { t: string; kind?: Item['kind']; label: string; once?: boolean; make: (n: number) => Item[] }[] = [
    { t: 'event_name', label: 'Event name', once: true, make: () => [mk('event_name', POS.event_name[0] + dx, POS.event_name[1])] },
    { t: 'issue_date', label: 'Date of issue', make: (n) => { const p = [[562, 466], [110, 466], [336, 466]][n % 3]; return [mk('issue_date', p[0] + dx, p[1] + row(n))]; } },
    { t: 'authority_name', label: 'Signatory', make: (n) => {
      const cx = slot(n), y = row(n);
      const out: Item[] = [mk('authority_name', cx - 85, 494 + y), mk('authority_designation', cx - 85, 514 + y)];
      if (!near(cx, 490 + y)) out.unshift(Ln(X(cx - 85), Y(490 + y), X(170), L.ink, 0.67, { label: 'Signature line' }));
      return out;
    } },
    { t: 'signature_image', label: 'Signature', make: (n) => [mk('signature_image', slot(n) - 65, 442 + row(n))] },
    { t: 'logo_image', label: 'Seal or logo', make: (n) => { const p = [[389, 449], [60, 40], [718, 40], [389, 40]][n % 4]; return [mk('logo_image', p[0] + dx, p[1] + Math.floor(n / 4) * 20)]; } },
    { t: 'lockup', kind: 'lockup', label: 'SIES logo', make: (n) => [Lk(X(351 + dx + n * 20), Y(37 + n * 20), 140)] },
    { t: 'line', kind: 'line', label: 'Line', make: (n) => [Ln(X(336 + dx), Y(380 + n * 14), X(170), L.ink, 0.67)] },
    { t: 'roll_number', label: 'Roll number / ID', once: true, make: () => [mk('roll_number', POS.roll_number[0] + dx, POS.roll_number[1])] },
    { t: 'custom_text', label: 'Extra text', make: (n) => [mk('custom_text', POS.custom_text[0] + dx + n * 16, POS.custom_text[1] + n * 24)] },
  ];
  const chips = CH.map((c) => {
    const n = c.kind ? items.filter((i) => i.kind === c.kind).length : cnt(c.t);
    const done = !!c.once && n > 0;
    return { key: c.t, text: `${done ? '✓ ' : '+ '}${c.label}${!c.once && n && !c.kind ? ` · ${n}` : ''}`, done, add: () => { if (!done) addItems(c.make(n)); } };
  });
  const details = CH.some((c) => !c.kind && c.t !== 'custom_text' && cnt(c.t) > 0);
  return { chips, details };
}

function Sidebar() {
  const design = useApp((s) => s.design);
  const set = useApp((s) => s.set);
  const go = useApp((s) => s.go);
  const replaceSampleName = useApp((s) => s.replaceSampleName);
  const addItems = useApp((s) => s.addItems);
  const toggleCampus = useApp((s) => s.toggleCampus);
  const edit = useApp((s) => s.edit);
  const select = useApp((s) => s.select);
  const setLocked = useApp((s) => s.setLocked);
  const setHidden = useApp((s) => s.setHidden);
  const moveLayer = useApp((s) => s.moveLayer);
  const removeMany = useApp((s) => s.removeMany);
  const { longName, triedLong, layersOpen, selIds, multiMode } = useApp();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const { chips, details } = useDetailChips();
  const items = design.items;
  const hasName = items.some((i) => i.kind === 'field' && i.type === 'recipient_name');
  const sampleItem = items.find((i): i is FieldItem => i.kind === 'field' && !!i.sample);
  const sampleText = sampleItem?.defaultValue || design.detected?.text || '';
  const hasSample = !hasName && (!!sampleItem || !!design.detected);
  const isUpload = design.templateId === 'upload';
  const campusOn = items.some((i) => i.kind === 'image' && i.campus);
  const editable = items.filter((i) => !i.locked);
  const L = letteringFor(design);

  const replace = async () => {
    let color: string | undefined;
    if (!sampleItem && design.detected && design.background) {
      try {
        const r = await renderBackground(design.background);
        color = paperColorAround(r.canvas, design.page, design.detected);
      } catch { /* fall back to white */ }
    }
    replaceSampleName(color);
  };
  const placeName = () => {
    const w = 420, x = Math.round(design.page.w / 2 - w / 2), y = Math.round(design.page.h * 0.64);
    const f = makeField('recipient_name', x, y, L);
    addItems([f]);
  };

  return (
    <aside className="side">
      <div className="side-head">
        <h2>Set up your certificate</h2>
        <p>Click anything on the certificate to change it. Drag to move it, and use the corner dot to resize.</p>
      </div>
      <div className="card">
        <div className="card-title"><Badge done={hasName} n="1" />Recipient name</div>
        {hasSample ? (
          <>
            <p className="text">We found <span style={sampleItem ? { fontFamily: fontCss(sampleItem.style.fontFamily), fontSize: 20, color: 'var(--ink)' } : { fontWeight: 600 }}>{sampleText}</span> on the certificate. Show each person&apos;s name there instead?</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={replace}>Yes, replace it</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={placeName}>I&apos;ll place it myself</button>
            </div>
          </>
        ) : null}
        {!hasName && !hasSample ? (
          <>
            <p className="text">Add a spot where each person&apos;s name will appear.</p>
            <button type="button" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={placeName}>Add recipient name</button>
          </>
        ) : null}
        {hasName ? <p className="text">Names from your list will appear here. Click the name on the certificate to change its lettering.</p> : null}
      </div>
      <div className="card">
        <div className="card-title"><Badge done={details} n="2" />Other details<span className="opt">optional</span></div>
        <p className="text-sm">Add as many signatories, dates, lines and logos as you need. Each tap adds one more.</p>
        <div className="chips">{chips.map((c) => <button key={c.key} type="button" className={`chip${c.done ? ' done' : ''}`} onClick={c.add}>{c.text}</button>)}</div>
      </div>
      <div className="card">
        <div className="card-title"><Badge done={triedLong} n="3" />Check a long name</div>
        <p className="text">Long names shrink automatically so they never run off the edge.</p>
        <button type="button" className={`toggle-chip${longName ? ' on' : ''}`} style={{ height: 36, alignSelf: 'flex-start' }} onClick={() => set({ longName: !longName, triedLong: true })}>{longName ? 'Back to a short name' : 'Preview a long name'}</button>
      </div>
      <div className="card">
        <span className="card-title">Background</span>
        {isUpload ? (
          <p className="text">Your uploaded certificate is the background. It prints exactly as it is, with your details on top.</p>
        ) : (
          <>
            <Switch on={campusOn} onClick={toggleCampus} title="Campus illustration" sub="A faint sketch of the SIES campus along the bottom" />
            <label className="color-label">Page colour<span>{design.bg}<input type="color" value={design.bg} onChange={(e) => edit((d) => ({ ...d, bg: e.target.value.toUpperCase() }))} /></span></label>
          </>
        )}
      </div>
      <div className="card" style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => set({ layersOpen: !layersOpen })}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            border: 0,
            background: 'none',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          <span>Everything on the certificate · {items.length}</span>
          <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 400 }}>
            {layersOpen ? 'Hide' : 'Show'}
          </span>
        </button>
        {layersOpen ? (
          <div
            className="layers"
            onPointerLeave={() => {
              if (dragId) {
                setDragId(null);
                setDropIdx(null);
              }
            }}
          >
            {items
              .slice()
              .reverse()
              .map((it, revIdx) => {
                const origIdx = items.length - 1 - revIdx;
                const isSel = selIds.includes(it.id);
                const isRecipient = it.kind === 'field' && it.type === 'recipient_name';
                const isDropTarget = dropIdx === revIdx && dragId !== it.id;

                return (
                  <div
                    key={it.id}
                    className={`layer${isSel ? ' on' : ''}${it.hidden ? ' dimmed' : ''}${
                      isDropTarget ? ' drop-target' : ''
                    }`}
                    onClick={(e) => {
                      const add = e.shiftKey || e.ctrlKey || e.metaKey || multiMode;
                      select(nextSelection(selIds, it.id, add));
                      set({ clean: false });
                    }}
                    onPointerEnter={() => {
                      if (dragId) setDropIdx(revIdx);
                    }}
                  >
                    {/* Drag Handle */}
                    <span
                      className="layer-handle"
                      title="Drag to reorder"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        setDragId(it.id);
                        setDropIdx(revIdx);
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        if (dragId && dropIdx !== null) {
                          const toIndex = items.length - 1 - dropIdx;
                          moveLayer(dragId, toIndex);
                        }
                        setDragId(null);
                        setDropIdx(null);
                      }}
                    >
                      <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2.5" cy="3" r="1.5" />
                        <circle cx="7.5" cy="3" r="1.5" />
                        <circle cx="2.5" cy="8" r="1.5" />
                        <circle cx="7.5" cy="8" r="1.5" />
                        <circle cx="2.5" cy="13" r="1.5" />
                        <circle cx="7.5" cy="13" r="1.5" />
                      </svg>
                    </span>

                    {/* Up / Down Buttons for quick/keyboard reordering */}
                    <button
                      type="button"
                      className="layer-btn"
                      title="Move up (toward front)"
                      aria-label="Move up"
                      disabled={origIdx === items.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(it.id, origIdx + 1);
                      }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="layer-btn"
                      title="Move down (toward back)"
                      aria-label="Move down"
                      disabled={origIdx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(it.id, origIdx - 1);
                      }}
                    >
                      ▼
                    </button>

                    {/* Label and Kind Badge */}
                    <span className="l">
                      {it.kind === 'field' && !it.isDynamic && it.type === 'custom_text'
                        ? `${it.label} · ${it.defaultValue}`
                        : it.label}
                    </span>
                    <span className="k">{KIND[it.kind]}</span>

                    {/* Hide / Show Eye Button */}
                    <button
                      type="button"
                      className={`layer-btn${it.hidden ? ' on' : ''}`}
                      title={
                        isRecipient
                          ? 'The recipient name can not be hidden'
                          : 'Hidden items are not printed'
                      }
                      aria-label={it.hidden ? 'Show item' : 'Hide item'}
                      disabled={isRecipient}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHidden([it.id], !it.hidden);
                      }}
                    >
                      {it.hidden ? (
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.36 14.77L1.23 2.64l1.41-1.41 12.13 12.13-1.41 1.41zM8 3.5c3.5 0 6.64 2.18 7.9 5.5-1 2.63-3.23 4.54-5.9 5.21l-1.63-1.63a3.5 3.5 0 00-4.45-4.45L2.24 6.45C3.5 4.67 5.6 3.5 8 3.5z" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 3.5C4.5 3.5 1.36 5.68.1 9c1.26 3.32 4.4 5.5 7.9 5.5s6.64-2.18 7.9-5.5c-1.26-3.32-4.4-5.5-7.9-5.5zm0 9a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0-5.5a2 2 0 100 4 2 2 0 000-4z" />
                        </svg>
                      )}
                    </button>

                    {/* Padlock Lock / Unlock Button */}
                    <button
                      type="button"
                      className={`layer-btn${it.locked ? ' on' : ''}`}
                      title={it.locked ? 'Unlock item' : 'Lock item'}
                      aria-label={it.locked ? 'Unlock item' : 'Lock item'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocked([it.id], !it.locked);
                      }}
                    >
                      {it.locked ? (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 1a4 4 0 00-4 4v2H3v8h10V7h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5zm2 5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M10 5a2 2 0 10-4 0v2h5v8H3V7h1V5a4 4 0 118 0v1h-2V5zm-2 5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                        </svg>
                      )}
                    </button>

                    {/* Remove Button */}
                    <button
                      type="button"
                      className="x"
                      aria-label={`Remove ${it.label}`}
                      disabled={it.locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMany([it.id]);
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
          </div>
        ) : null}
      </div>
      <div className="spacer" />
      <div className="side-foot">
        <button type="button" className="btn btn-ghost" onClick={() => go(1)}>← Back</button>
        <button type="button" className="btn btn-primary btn-grow" disabled={!hasName} onClick={() => go(3)}>Continue to recipients →</button>
      </div>
    </aside>
  );
}

export function DesignStep() {
  return (
    <div className="body">
      <Sidebar />
      <EditorStage />
    </div>
  );
}
