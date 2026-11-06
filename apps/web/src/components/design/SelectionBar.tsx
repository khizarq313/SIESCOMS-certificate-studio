'use client';
import { useApp } from '@/lib/store';

export function SelectionBar() {
  const selIds = useApp((s) => s.selIds);
  const items = useApp((s) => s.design.items);
  const {
    alignSelection,
    distributeSelection,
    reorder,
    setLocked,
    setHidden,
    duplicateSelection,
    removeMany,
    copy,
    cut,
  } = useApp.getState();

  const selected = items.filter((it) => selIds.includes(it.id));
  const count = selected.length;
  const isVisible = count > 0;

  const title = count === 1 ? selected[0].label || '1 selected' : `${count} selected`;
  const allLocked = selected.length > 0 && selected.every((it) => it.locked);
  const allHidden = selected.length > 0 && selected.every((it) => it.hidden);
  const hasRecipient = selected.some(
    (it) => it.kind === 'field' && it.type === 'recipient_name'
  );
  const canDistribute = count >= 3;

  return (
    <div className="selection-bar-slot">
      <div
        className={`sel-bar-placeholder${!isVisible ? ' active' : ''}`}
        aria-hidden={isVisible}
      >
        <span>Select any element on the certificate to edit · Press <kbd>?</kbd> for shortcuts</span>
      </div>

      <div
        className={`selection-bar${isVisible ? ' active' : ''}`}
        role="toolbar"
        aria-label="Selection toolbar"
        aria-hidden={!isVisible}
      >
        <div className="sel-bar-title" title={title}>
          {title}
        </div>

        <div className="sel-bar-divider" />

        {/* Align Buttons (Canva Style) */}
        <div className="sel-bar-group" title={count === 1 ? 'Align to page' : 'Align selected'}>
          <button
            type="button"
            className="sel-btn"
            title="Align Left"
            aria-label="Align Left"
            disabled={!isVisible}
            onClick={() => alignSelection('left')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="1.5" height="12" rx="0.5" fill="currentColor" />
              <rect x="4.5" y="4" width="9" height="3" rx="0.5" fill="currentColor" />
              <rect x="4.5" y="9" width="6" height="3" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="sel-btn"
            title="Align Centre (X)"
            aria-label="Align Centre (X)"
            disabled={!isVisible}
            onClick={() => alignSelection('centerX')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <rect x="7.25" y="1.5" width="1.5" height="13" rx="0.5" fill="currentColor" opacity="0.6" />
              <rect x="2.5" y="4" width="11" height="3" rx="0.5" fill="currentColor" />
              <rect x="4.5" y="9" width="7" height="3" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="sel-btn"
            title="Align Right"
            aria-label="Align Right"
            disabled={!isVisible}
            onClick={() => alignSelection('right')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <rect x="12.5" y="2" width="1.5" height="12" rx="0.5" fill="currentColor" />
              <rect x="2.5" y="4" width="9" height="3" rx="0.5" fill="currentColor" />
              <rect x="5.5" y="9" width="6" height="3" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="sel-btn"
            title="Align Top"
            aria-label="Align Top"
            disabled={!isVisible}
            onClick={() => alignSelection('top')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="12" height="1.5" rx="0.5" fill="currentColor" />
              <rect x="4" y="4.5" width="3" height="9" rx="0.5" fill="currentColor" />
              <rect x="9" y="4.5" width="3" height="6" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="sel-btn"
            title="Align Middle (Y)"
            aria-label="Align Middle (Y)"
            disabled={!isVisible}
            onClick={() => alignSelection('middleY')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1.5" y="7.25" width="13" height="1.5" rx="0.5" fill="currentColor" opacity="0.6" />
              <rect x="4" y="2.5" width="3" height="11" rx="0.5" fill="currentColor" />
              <rect x="9" y="4.5" width="3" height="7" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="sel-btn"
            title="Align Bottom"
            aria-label="Align Bottom"
            disabled={!isVisible}
            onClick={() => alignSelection('bottom')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="12.5" width="12" height="1.5" rx="0.5" fill="currentColor" />
              <rect x="4" y="2.5" width="3" height="9" rx="0.5" fill="currentColor" />
              <rect x="9" y="5.5" width="3" height="6" rx="0.5" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className="sel-bar-divider" />

        {/* Distribute Buttons (Canva Style) */}
        <div className="sel-bar-group" title="Distribute (requires 3 or more)">
          <button
            type="button"
            className="sel-btn"
            title="Distribute Horizontally"
            aria-label="Distribute Horizontally"
            disabled={!canDistribute}
            onClick={() => distributeSelection('x')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1.5" y="2" width="1.5" height="12" rx="0.5" fill="currentColor" />
              <rect x="13" y="2" width="1.5" height="12" rx="0.5" fill="currentColor" />
              <rect x="5.5" y="4" width="2" height="8" rx="0.5" fill="currentColor" />
              <rect x="9" y="4" width="2" height="8" rx="0.5" fill="currentColor" />
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
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="1.5" width="12" height="1.5" rx="0.5" fill="currentColor" />
              <rect x="2" y="13" width="12" height="1.5" rx="0.5" fill="currentColor" />
              <rect x="4" y="5.5" width="8" height="2" rx="0.5" fill="currentColor" />
              <rect x="4" y="9" width="8" height="2" rx="0.5" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className="sel-bar-divider" />

        {/* Layer Order */}
        <div className="sel-bar-group" title="Layer order">
          <button
            type="button"
            className="sel-btn"
            title="Bring Forward (Ctrl + ])"
            aria-label="Bring Forward"
            disabled={!isVisible}
            onClick={() => reorder('forward')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2l4 4H9v6H7V6H4l4-4z" />
            </svg>
          </button>
          <button
            type="button"
            className="sel-btn"
            title="Send Backward (Ctrl + [)"
            aria-label="Send Backward"
            disabled={!isVisible}
            onClick={() => reorder('backward')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 14l-4-4h3V4h2v6h3l-4 4z" />
            </svg>
          </button>
          <button
            type="button"
            className="sel-btn"
            title="Bring to Front (Ctrl + Shift + ])"
            aria-label="Bring to Front"
            disabled={!isVisible}
            onClick={() => reorder('front')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h12v2H2V2zm6 2l4 4H9v6H7V8H4l4-4z" />
            </svg>
          </button>
          <button
            type="button"
            className="sel-btn"
            title="Send to Back (Ctrl + Shift + [)"
            aria-label="Send to Back"
            disabled={!isVisible}
            onClick={() => reorder('back')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
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
            title={allLocked ? 'Unlock (locked elements cannot be moved)' : 'Lock element'}
            aria-label={allLocked ? 'Unlock' : 'Lock'}
            disabled={!isVisible}
            onClick={() => setLocked(selIds, !allLocked)}
          >
            {allLocked ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a4 4 0 00-4 4v2H3v8h10V7h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5zm2 5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10 5a2 2 0 10-4 0v2h5v8H3V7h1V5a4 4 0 118 0v1h-2V5zm-2 5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className={`sel-btn${allHidden ? ' on' : ''}`}
            title={
              hasRecipient && !allHidden
                ? 'The recipient name cannot be hidden'
                : allHidden
                ? 'Show on certificate'
                : 'Hide from certificate'
            }
            aria-label={allHidden ? 'Show' : 'Hide'}
            disabled={!isVisible || (hasRecipient && !allHidden)}
            onClick={() => setHidden(selIds, !allHidden)}
          >
            {allHidden ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.36 14.77L1.23 2.64l1.41-1.41 12.13 12.13-1.41 1.41zM8 3.5c3.5 0 6.64 2.18 7.9 5.5-1 2.63-3.23 4.54-5.9 5.21l-1.63-1.63a3.5 3.5 0 00-4.45-4.45L2.24 6.45C3.5 4.67 5.6 3.5 8 3.5z" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 3.5C4.5 3.5 1.36 5.68.1 9c1.26 3.32 4.4 5.5 7.9 5.5s6.64-2.18 7.9-5.5c-1.26-3.32-4.4-5.5-7.9-5.5zm0 9a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0-5.5a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className="sel-btn"
            title="Duplicate (Ctrl + D)"
            aria-label="Duplicate"
            disabled={!isVisible || allLocked}
            onClick={() => duplicateSelection()}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2h8v2H4V2zm-2 4h10v2H2V6zm12 4H2v5h12v-5z" />
            </svg>
          </button>

          <button
            type="button"
            className="sel-btn danger"
            title="Delete (Backspace / Del)"
            aria-label="Delete"
            disabled={!isVisible || allLocked}
            onClick={() => removeMany(selIds)}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 4h10v1H3V4zm2 2h6v8H5V6zm1-4h4v1H6V2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
