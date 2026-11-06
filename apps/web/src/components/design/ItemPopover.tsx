'use client';
import { useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import {
  FIELD_PRESETS,
  FONTS,
  FONT_GROUPS,
  letteringFor,
  pct,
  fitTextBoxHeight,
  type Item,
} from '@siescoms/certificate';
import { uploadFile } from '@/lib/api';
import { useApp } from '@/lib/store';
import { ImageStudio } from './ImageStudio';

const hex6 = (c: string) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#888888');
const colorOf = (it: Item) =>
  it.kind === 'field'
    ? it.style.color
    : it.kind === 'shape'
    ? it.fill || it.stroke
    : it.kind === 'line'
    ? it.color
    : it.kind === 'patch'
    ? it.fill
    : '#000000';

export function ItemPopover({ item: it }: { item: Item }) {
  const design = useApp((s) => s.design);
  const { updItem, updStyle, record, dup, remove } = useApp.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState('');
  const [studioFile, setStudioFile] = useState<File | null>(null);
  const [moreTextOpts, setMoreTextOpts] = useState(false);
  const { w: W, h: H } = design.page;
  const id = it.id;

  // Typing in a box records one undo step when you start, not one per letter.
  const live = (p: Partial<Item>) => updItem(id, p, false);

  const setColor = (c: string, rec = true) => {
    const p: Partial<Item> | null =
      it.kind === 'field'
        ? null
        : it.kind === 'shape'
        ? it.fill || it.grad
          ? { fill: c, grad: '' }
          : { stroke: c }
        : it.kind === 'line'
        ? { color: c }
        : it.kind === 'patch'
        ? { fill: c }
        : null;
    if (it.kind === 'field') {
      if (!rec) {
        updItem(id, { style: { ...it.style, color: c } } as Partial<Item>, false);
      } else {
        updStyle(id, { color: c });
      }
    } else if (p) {
      updItem(id, p, rec);
    }
  };

  const handleStudioApply = async (out: {
    blob: Blob;
    width: number;
    height: number;
    transparent: boolean;
  }) => {
    setImgBusy(true);
    setImgErr('');
    try {
      const isSig = it.kind === 'image' && it.type === 'signature_image';
      const fileName = isSig ? 'signature.png' : 'logo.png';
      const file = new File([out.blob], fileName, { type: 'image/png' });
      const r = await uploadFile<{ key: string; width: number; height: number }>(
        '/api/uploads/image',
        file
      );

      let h = Math.round((it.w * out.height) / out.width);
      let w = it.w;
      if (h > 160) {
        h = 160;
        w = Math.round((160 * out.width) / out.height);
      }

      updItem(id, {
        src: `upload:${r.key}`,
        w,
        h,
        dark: false,
        blend: out.transparent ? '' : it.kind === 'image' ? it.blend : '',
      } as Partial<Item>);
      setStudioFile(null);
    } catch (err) {
      setImgErr((err as Error).message);
    } finally {
      setImgBusy(false);
    }
  };

  // Placement: below if there's room, otherwise above, clamped inside certificate bounds.
  const big = it.h > H * 0.5 || it.w > W * 0.71;
  const below = it.y + it.h < H * 0.605,
    above = it.y > H * 0.403;
  const centerRatio = (it.x + it.w / 2) / W;
  const pop: CSSProperties = {};

  if (big) pop.top = '12px';
  else if (below) pop.top = `calc(${pct(it.y + it.h, H)} + 12px)`;
  else if (above) pop.bottom = `calc(${pct(H - it.y, H)} + 12px)`;
  else pop.top = '12px';

  if (centerRatio <= 0.35) {
    pop.left = '12px';
    pop.transform = 'none';
  } else if (centerRatio >= 0.65) {
    pop.right = '12px';
    pop.left = 'auto';
    pop.transform = 'none';
  } else {
    pop.left = `${Math.round(centerRatio * 100)}%`;
    pop.transform = 'translateX(-50%)';
  }

  const L = letteringFor(design);
  const pal = [
    ...new Set([L.ink, L.color, '#2954A8', '#FB8D31', '#B08D57', '#1F1D1A', '#FFFFFF']),
  ];
  const cur = colorOf(it).toLowerCase();
  const hasColor = ['field', 'shape', 'line', 'patch'].includes(it.kind);
  const hasOpacity = ['shape', 'image', 'patch'].includes(it.kind);
  const opacity = Math.round(((it as { opacity?: number }).opacity ?? 1) * 100);
  const canReplaceImage = it.kind === 'image' && !it.campus;

  const isWrap = it.kind === 'field' && !!it.style.wrap;
  const currentText =
    it.kind === 'field' ? (it.isDynamic ? it.sampleValue : it.defaultValue) : '';

  return (
    <motion.div
      className="pop"
      style={pop}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="pop-head">
        <b>{it.label}</b>
        <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
          <button type="button" className="pop-act" onClick={() => dup(id)}>
            Duplicate
          </button>
          <button type="button" className="pop-act bad" onClick={() => remove(id)}>
            Remove
          </button>
        </div>
      </div>

      {it.kind === 'field' ? (
        <>
          {/* Single line vs Wrapped Text Box toggle */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className={`toggle-chip grow${!isWrap ? ' on' : ''}`}
              onClick={() => updStyle(id, { wrap: false })}
            >
              Single line
            </button>
            <button
              type="button"
              className={`toggle-chip grow${isWrap ? ' on' : ''}`}
              onClick={() => {
                updStyle(id, { wrap: true });
                if (it.h < 30) {
                  updItem(id, { h: 60 });
                }
              }}
            >
              Text box (wrap)
            </button>
          </div>

          {it.isDynamic ? (
            <label className="field">
              Preview text
              {isWrap ? (
                <textarea
                  className="textarea"
                  rows={3}
                  value={it.sampleValue}
                  onFocus={record}
                  onChange={(e) => live({ sampleValue: e.target.value })}
                />
              ) : (
                <input
                  className="input"
                  value={it.sampleValue}
                  onFocus={record}
                  onChange={(e) => live({ sampleValue: e.target.value })}
                />
              )}
              <span className="hint">Each certificate uses the value from your list.</span>
            </label>
          ) : (
            <label className="field">
              Text
              {isWrap ? (
                <textarea
                  className="textarea"
                  rows={3}
                  value={it.defaultValue}
                  onFocus={record}
                  onChange={(e) => live({ defaultValue: e.target.value })}
                />
              ) : (
                <input
                  className="input"
                  value={it.defaultValue}
                  onFocus={record}
                  onChange={(e) => live({ defaultValue: e.target.value })}
                />
              )}
            </label>
          )}

          {isWrap && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: 'flex-start', fontSize: 11, padding: '2px 8px', height: 26 }}
              onClick={() => {
                const autoH = fitTextBoxHeight(it, currentText);
                updItem(id, { h: autoH });
              }}
            >
              Fit box height to text
            </button>
          )}

          <select
            className="select"
            aria-label="Font"
            value={it.style.fontFamily}
            onChange={(e) => updStyle(id, { fontFamily: e.target.value as never })}
          >
            {FONT_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {Object.entries(FONTS)
                  .filter(([, f]) => f.group === g)
                  .map(([k, f]) => (
                    <option key={k} value={k}>
                      {f.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>

          <div className="row-between">
            <div className="row">
              <button
                type="button"
                className="round-btn"
                aria-label="Smaller font size"
                onClick={() => {
                  const s = it.style.fontSize;
                  updStyle(id, {
                    fontSize: Math.max(5, Math.round((s - (s > 20 ? 2 : 1)) * 10) / 10),
                  });
                }}
              >
                −
              </button>
              <span style={{ width: 34, textAlign: 'center', fontSize: 13 }}>
                {Math.round(it.style.fontSize * 10) / 10}
              </span>
              <button
                type="button"
                className="round-btn"
                aria-label="Bigger font size"
                onClick={() => {
                  const s = it.style.fontSize;
                  updStyle(id, {
                    fontSize: Math.round((s + (s >= 20 ? 2 : 1)) * 10) / 10,
                  });
                }}
              >
                +
              </button>
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 3 }}>
              <button
                type="button"
                className={`toggle-chip sq${it.style.isBold ? ' on' : ''}`}
                style={{ fontWeight: 700 }}
                aria-pressed={it.style.isBold}
                title="Bold"
                onClick={() => updStyle(id, { isBold: !it.style.isBold })}
              >
                B
              </button>
              <button
                type="button"
                className={`toggle-chip sq${it.style.isItalic ? ' on' : ''}`}
                style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontSize: 15 }}
                aria-pressed={it.style.isItalic}
                title="Italic"
                onClick={() => updStyle(id, { isItalic: !it.style.isItalic })}
              >
                I
              </button>
              <button
                type="button"
                className={`toggle-chip sq${it.style.underline ? ' on' : ''}`}
                style={{ textDecoration: 'underline', fontWeight: 600 }}
                aria-pressed={it.style.underline}
                title="Underline"
                onClick={() => updStyle(id, { underline: !it.style.underline })}
              >
                U
              </button>
              <button
                type="button"
                className={`toggle-chip sq${it.style.uppercase ? ' on' : ''}`}
                style={{ fontSize: 11, fontWeight: 700 }}
                aria-pressed={it.style.uppercase}
                title="All Uppercase"
                onClick={() => updStyle(id, { uppercase: !it.style.uppercase })}
              >
                AA
              </button>
              <button
                type="button"
                className={`toggle-chip sq${it.style.shadow ? ' on' : ''}`}
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.4)', fontWeight: 600 }}
                aria-pressed={it.style.shadow}
                title="Drop Shadow"
                onClick={() => updStyle(id, { shadow: !it.style.shadow })}
              >
                S
              </button>
              <button
                type="button"
                className={`toggle-chip sq${it.style.alignment === 'left' ? ' on' : ''}`}
                aria-label="Align left"
                title="Align Left"
                onClick={() => updStyle(id, { alignment: 'left' })}
              >
                ⇤
              </button>
              <button
                type="button"
                className={`toggle-chip sq${it.style.alignment === 'center' ? ' on' : ''}`}
                aria-label="Centre"
                title="Align Center"
                onClick={() => updStyle(id, { alignment: 'center' })}
              >
                ≡
              </button>
              <button
                type="button"
                className={`toggle-chip sq${it.style.alignment === 'right' ? ' on' : ''}`}
                aria-label="Align right"
                title="Align Right"
                onClick={() => updStyle(id, { alignment: 'right' })}
              >
                ⇥
              </button>
            </div>
          </div>

          {/* More text options collapsible */}
          <button
            type="button"
            className="btn-link"
            style={{
              fontSize: 11,
              alignSelf: 'flex-start',
              color: 'var(--muted)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: '2px 0',
            }}
            onClick={() => setMoreTextOpts(!moreTextOpts)}
          >
            {moreTextOpts
              ? 'Fewer typography options ↑'
              : 'More typography options (letter spacing, line height) ↓'}
          </button>

          {moreTextOpts && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '8px 10px',
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: 11 }}>
                  Letter spacing · {it.style.letterSpacing ?? 0} pt
                </span>
                <input
                  type="range"
                  min={-2}
                  max={20}
                  step={0.5}
                  value={it.style.letterSpacing ?? 0}
                  onPointerDown={record}
                  onChange={(e) => updStyle(id, { letterSpacing: Number(e.target.value) })}
                />
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: 11 }}>
                  Line height · {Math.round((it.style.lineHeight ?? 1.15) * 100) / 100}x
                </span>
                <input
                  type="range"
                  min={0.8}
                  max={2.5}
                  step={0.05}
                  value={it.style.lineHeight ?? 1.15}
                  onPointerDown={record}
                  onChange={(e) => updStyle(id, { lineHeight: Number(e.target.value) })}
                />
              </label>
            </div>
          )}

          {it.type !== 'custom_text' ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className={`toggle-chip grow${it.isDynamic ? ' on' : ''}`}
                onClick={() =>
                  updItem(id, {
                    isDynamic: true,
                    sampleValue:
                      it.sampleValue ||
                      it.defaultValue ||
                      FIELD_PRESETS[it.type]?.sample ||
                      '',
                  })
                }
              >
                Different per person
              </button>
              <button
                type="button"
                className={`toggle-chip grow${!it.isDynamic ? ' on' : ''}`}
                onClick={() =>
                  updItem(id, {
                    isDynamic: false,
                    defaultValue: it.defaultValue || it.sampleValue,
                  })
                }
              >
                Same for everyone
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {hasColor ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {pal.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              className={`swatch${cur === c.toLowerCase() ? ' on' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <input
            type="color"
            className="color-input"
            aria-label="Custom colour"
            value={hex6(colorOf(it))}
            onFocus={record}
            onChange={(e) => setColor(e.target.value.toUpperCase(), false)}
          />
        </div>
      ) : null}

      {hasOpacity ? (
        <label className="field">
          Opacity · {opacity}%
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            onPointerDown={record}
            onChange={(e) =>
              live({ opacity: Number(e.target.value) / 100 } as Partial<Item>)
            }
          />
        </label>
      ) : null}

      {canReplaceImage ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) setStudioFile(f);
            }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={imgBusy}
            onClick={() => fileRef.current?.click()}
          >
            {imgBusy
              ? 'Uploading…'
              : it.kind === 'image' && it.type === 'signature_image'
              ? 'Upload your signature'
              : 'Replace image'}
          </button>
          <span className="hint">We will help you crop it and remove the background.</span>
          {imgErr ? <span className="note">{imgErr}</span> : null}
          {studioFile && (
            <ImageStudio
              file={studioFile}
              kind={it.kind === 'image' && it.type === 'signature_image' ? 'signature' : 'logo'}
              onCancel={() => setStudioFile(null)}
              onApply={handleStudioApply}
            />
          )}
        </>
      ) : null}

      {it.kind === 'patch' ? (
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
          Covers the old name printed on your certificate. Match its colour to the paper.
        </p>
      ) : null}
      {it.kind === 'lockup' ? (
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
          Official SIES logo. Resize it from the corner dot.
        </p>
      ) : null}
    </motion.div>
  );
}
