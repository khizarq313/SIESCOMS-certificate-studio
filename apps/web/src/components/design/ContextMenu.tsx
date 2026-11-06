'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/lib/store';

export function ContextMenu() {
  const ctx = useApp((s) => s.ctx);
  const selIds = useApp((s) => s.selIds);
  const items = useApp((s) => s.design.items);
  const clipboard = useApp((s) => s.clipboard);
  const {
    closeCtx,
    copy,
    cut,
    paste,
    duplicateSelection,
    removeMany,
    reorder,
    setLocked,
    setHidden,
    alignSelection,
    select,
    setHelp,
  } = useApp.getState();

  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!ctx) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeCtx();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCtx();
      }
    };

    const onScroll = () => {
      closeCtx();
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('touchstart', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [ctx, closeCtx]);

  if (!mounted || !ctx) return null;

  const selected = items.filter((it) => selIds.includes(it.id));
  const isSingle = selected.length === 1;
  const isMulti = selected.length > 1;
  const allLocked = selected.length > 0 && selected.every((it) => it.locked);
  const allHidden = selected.length > 0 && selected.every((it) => it.hidden);
  const hasRecipient = selected.some(
    (it) => it.kind === 'field' && it.type === 'recipient_name'
  );
  const hasClipboard = !!clipboard && clipboard.items.length > 0;

  // Viewport clamping
  const menuWidth = 200;
  const menuHeight = ctx.target === 'item' ? 320 : 120;
  const x = Math.min(ctx.x, window.innerWidth - menuWidth - 12);
  const y = Math.min(ctx.y, window.innerHeight - menuHeight - 12);

  const act = (fn: () => void) => {
    fn();
    closeCtx();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="ctx-menu"
      style={{ left: Math.max(8, x), top: Math.max(8, y) }}
      role="menu"
      aria-label="Context Menu"
    >
      {ctx.target === 'item' ? (
        <>
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            onClick={() => act(() => copy())}
          >
            <span>Copy</span>
            <kbd>Ctrl+C</kbd>
          </button>
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            disabled={allLocked}
            onClick={() => act(() => cut())}
          >
            <span>Cut</span>
            <kbd>Ctrl+X</kbd>
          </button>
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            disabled={!hasClipboard}
            onClick={() => act(() => paste({ px: ctx.px, py: ctx.py }))}
          >
            <span>Paste</span>
            <kbd>Ctrl+V</kbd>
          </button>
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            disabled={allLocked}
            onClick={() => act(() => duplicateSelection())}
          >
            <span>Duplicate</span>
            <kbd>Ctrl+D</kbd>
          </button>
          <button
            type="button"
            className="ctx-item danger"
            role="menuitem"
            disabled={allLocked}
            onClick={() => act(() => removeMany(selIds))}
          >
            <span>Delete</span>
            <kbd>Del</kbd>
          </button>

          <div className="ctx-divider" />

          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            onClick={() => act(() => reorder('forward'))}
          >
            <span>Bring Forward</span>
            <kbd>Ctrl+]</kbd>
          </button>
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            onClick={() => act(() => reorder('backward'))}
          >
            <span>Send Backward</span>
            <kbd>Ctrl+[</kbd>
          </button>
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            onClick={() => act(() => reorder('front'))}
          >
            <span>Bring to Front</span>
            <kbd>Ctrl+Shift+]</kbd>
          </button>
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            onClick={() => act(() => reorder('back'))}
          >
            <span>Send to Back</span>
            <kbd>Ctrl+Shift+[</kbd>
          </button>

          <div className="ctx-divider" />

          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            onClick={() => act(() => setLocked(selIds, !allLocked))}
          >
            <span>{allLocked ? 'Unlock Element' : 'Lock Element'}</span>
          </button>
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            disabled={hasRecipient && !allHidden}
            onClick={() => act(() => setHidden(selIds, !allHidden))}
          >
            <span>{allHidden ? 'Show Element' : 'Hide Element'}</span>
          </button>

          {isMulti && (
            <>
              <div className="ctx-divider" />
              <div className="ctx-header">Align</div>
              <div className="ctx-grid">
                <button
                  type="button"
                  className="ctx-sub-item"
                  title="Align Left"
                  onClick={() => act(() => alignSelection('left'))}
                >
                  Left
                </button>
                <button
                  type="button"
                  className="ctx-sub-item"
                  title="Align Center"
                  onClick={() => act(() => alignSelection('centerX'))}
                >
                  Center
                </button>
                <button
                  type="button"
                  className="ctx-sub-item"
                  title="Align Right"
                  onClick={() => act(() => alignSelection('right'))}
                >
                  Right
                </button>
                <button
                  type="button"
                  className="ctx-sub-item"
                  title="Align Top"
                  onClick={() => act(() => alignSelection('top'))}
                >
                  Top
                </button>
                <button
                  type="button"
                  className="ctx-sub-item"
                  title="Align Middle"
                  onClick={() => act(() => alignSelection('middleY'))}
                >
                  Middle
                </button>
                <button
                  type="button"
                  className="ctx-sub-item"
                  title="Align Bottom"
                  onClick={() => act(() => alignSelection('bottom'))}
                >
                  Bottom
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            disabled={!hasClipboard}
            onClick={() => act(() => paste({ px: ctx.px, py: ctx.py }))}
          >
            <span>Paste here</span>
            <kbd>Ctrl+V</kbd>
          </button>
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            onClick={() => {
              const all = items
                .filter(
                  (it) =>
                    !it.locked &&
                    !it.hidden &&
                    !(it.kind === 'image' && (it as { campus?: boolean }).campus)
                )
                .map((it) => it.id);
              act(() => select(all));
            }}
          >
            <span>Select All</span>
            <kbd>Ctrl+A</kbd>
          </button>
          <div className="ctx-divider" />
          <button
            type="button"
            className="ctx-item"
            role="menuitem"
            onClick={() => act(() => setHelp(true))}
          >
            <span>Keyboard Shortcuts</span>
            <kbd>?</kbd>
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
