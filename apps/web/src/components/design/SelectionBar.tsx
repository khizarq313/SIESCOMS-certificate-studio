'use client';
import { useApp } from '@/lib/store';
import type { AlignMode, LayerOp } from '@siescoms/certificate';

export function SelectionBar() {
  const selIds = useApp((s) => s.selIds);
  const items = useApp((s) => s.design.items);
  const {
    alignSelection,
    distributeSelection,
    reorder,
    setLocked,
    setHidden,
    dupMany,
    removeMany,
  } = useApp.getState();

  if (selIds.length === 0) return null;

  const selected = items.filter((it) => selIds.includes(it.id));
  const count = selected.length;
  if (count === 0) return null;

  const title = count === 1 ? selected[0].label || '1 selected' : `${count} selected`;
  const allLocked = selected.every((it) => it.locked);
  const allHidden = selected.every((it) => it.hidden);
  const hasRecipient = selected.some(
    (it) => it.kind === 'field' && it.type === 'recipient_name'
  );
  const canDistribute = count >= 3;

  return (
    <div className="selection-bar" role="toolbar" aria-label="Selection toolbar">
      <div className="sel-bar-title" title={title}>
        {title}
      </div>

      <div className="sel-bar-divider" />

      {/* Align Buttons */}
      <div className="sel-bar-group" title={count === 1 ? 'Align to page' : 'Align selected'}>
        <span className="sel-bar-label">{count === 1 ? 'Align to page' : 'Align'}</span>
        <button
          type="button"
          className="sel-btn"
          title="Align Left"
          aria-label="Align Left"
          onClick={() => alignSelection('left')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 1v14h2V1H2zm4 2v3h7V3H6zm0 7v3h5v-3H6z" />
          </svg>
        </button>
        <button
          type="button"
          className="sel-btn"
          title="Align Centre (X)"
          aria-label="Align Centre (X)"
          onClick={() => alignSelection('centerX')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7 1v2H3v3h4v4H4v3h3v2h2v-2h3v-3H9V6h4V3H9V1H7z" />
          </svg>
        </button>
        <button
          type="button"
          className="sel-btn"
          title="Align Right"
          aria-label="Align Right"
          onClick={() => alignSelection('right')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12 1v14h2V1h-2zM3 3v3h7V3H3zm2 7v3h5v-3H5z" />
          </svg>
        </button>
        <button
          type="button"
          className="sel-btn"
          title="Align Top"
          aria-label="Align Top"
          onClick={() => alignSelection('top')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2h14v2H1V2zm2 4h3v7H3V6zm7 0h3v5h-3V6z" />
          </svg>
        </button>
        <button
          type="button"
          className="sel-btn"
          title="Align Middle (Y)"
          aria-label="Align Middle (Y)"
          onClick={() => alignSelection('middleY')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 7h2V3h3v4h4V4h3v3h2v2h-2v3h-3V9H6v4H3V9H1V7z" />
          </svg>
        </button>
        <button
          type="button"
          className="sel-btn"
          title="Align Bottom"
          aria-label="Align Bottom"
          onClick={() => alignSelection('bottom')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 12h14v2H1v-2zm2-9h3v7H3V3zm7 2h3v5h-3V5z" />
          </svg>
        </button>
      </div>

      <div className="sel-bar-divider" />

      {/* Distribute Buttons */}
      <div className="sel-bar-group" title="Distribute (requires 3 or more)">
        <button
          type="button"
          className="sel-btn"
          title="Distribute Horizontally"
          aria-label="Distribute Horizontally"
          disabled={!canDistribute}
          onClick={() => distributeSelection('x')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1v14h2V1H1zm12 0v14h2V1h-2zM6 4h4v8H6V4z" />
          </svg>
        </button>
        <button
          type="button"
          className="sel-btn"
          title="Distribute Vertically"
          aria-label="Distribute Vertically"
          disabled={!canDistribute}
          onClick={() => distributeSelection('y')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1h14v2H1V1zm0 12h14v2H1v-2zM4 6h8v4H4V6z" />
          </svg>
        </button>
      </div>

      <div className="sel-bar-divider" />

      {/* Layer Order */}
      <div className="sel-bar-group" title="Layer order">
        <button
          type="button"
          className="sel-btn"
          title="Bring Forward"
          aria-label="Bring Forward"
          onClick={() => reorder('forward')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2l4 4H9v6H7V6H4l4-4z" />
          </svg>
        </button>
        <button
          type="button"
          className="sel-btn"
          title="Send Backward"
          aria-label="Send Backward"
          onClick={() => reorder('backward')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 14l-4-4h3V4h2v6h3l-4 4z" />
          </svg>
        </button>
        <button
          type="button"
          className="sel-btn"
          title="Bring to Front"
          aria-label="Bring to Front"
          onClick={() => reorder('front')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2h12v2H2V2zm6 2l4 4H9v6H7V8H4l4-4z" />
          </svg>
        </button>
        <button
          type="button"
          className="sel-btn"
          title="Send to Back"
          aria-label="Send to Back"
          onClick={() => reorder('back')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 12h12v2H2v-2zm6-2l-4-4h3V2h2v4h3l-4 4z" />
          </svg>
        </button>
      </div>

      <div className="sel-bar-divider" />

      {/* Item States & Actions */}
      <div className="sel-bar-group">
        <button
          type="button"
          className={`sel-btn${allLocked ? ' on' : ''}`}
          title={allLocked ? 'Unlock' : 'Lock'}
          aria-label={allLocked ? 'Unlock' : 'Lock'}
          onClick={() => setLocked(selIds, !allLocked)}
        >
          {allLocked ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a4 4 0 00-4 4v2H3v8h10V7h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5zm2 5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 5a2 2 0 10-4 0v2h5v8H3V7h1V5a4 4 0 118 0v1h-2V5zm-2 5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={`sel-btn${allHidden ? ' on' : ''}`}
          title={
            hasRecipient && !allHidden
              ? 'The recipient name can not be hidden'
              : allHidden
              ? 'Show'
              : 'Hide'
          }
          aria-label={allHidden ? 'Show' : 'Hide'}
          disabled={hasRecipient && !allHidden}
          onClick={() => setHidden(selIds, !allHidden)}
        >
          {allHidden ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.36 14.77L1.23 2.64l1.41-1.41 12.13 12.13-1.41 1.41zM8 3.5c3.5 0 6.64 2.18 7.9 5.5-1 2.63-3.23 4.54-5.9 5.21l-1.63-1.63a3.5 3.5 0 00-4.45-4.45L2.24 6.45C3.5 4.67 5.6 3.5 8 3.5z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3.5C4.5 3.5 1.36 5.68.1 9c1.26 3.32 4.4 5.5 7.9 5.5s6.64-2.18 7.9-5.5c-1.26-3.32-4.4-5.5-7.9-5.5zm0 9a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0-5.5a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="sel-btn"
          title="Duplicate"
          aria-label="Duplicate"
          onClick={() => dupMany(selIds)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2h8v2H4V2zm-2 4h10v2H2V6zm12 4H2v5h12v-5z" />
          </svg>
        </button>

        <button
          type="button"
          className="sel-btn danger"
          title="Delete"
          aria-label="Delete"
          onClick={() => removeMany(selIds)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 4h10v1H3V4zm2 2h6v8H5V6zm1-4h4v1H6V2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
