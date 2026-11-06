'use client';
import { useEffect } from 'react';
import { useApp } from '@/lib/store';

export function ShortcutsHelp() {
  const helpOpen = useApp((s) => s.helpOpen);
  const setHelp = useApp((s) => s.setHelp);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelp(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen, setHelp]);

  if (!helpOpen) return null;

  const sections = [
    {
      title: 'Selection',
      items: [
        { desc: 'Select element', keys: ['Click'] },
        { desc: 'Add / remove from selection', keys: ['Shift', 'Click'] },
        { desc: 'Multi-select marquee box', keys: ['Drag empty canvas'] },
        { desc: 'Select all elements', keys: ['Ctrl', 'A'] },
        { desc: 'Clear selection', keys: ['Esc'] },
      ],
    },
    {
      title: 'Clipboard & Duplicate',
      items: [
        { desc: 'Copy selected', keys: ['Ctrl', 'C'] },
        { desc: 'Cut selected', keys: ['Ctrl', 'X'] },
        { desc: 'Paste elements', keys: ['Ctrl', 'V'] },
        { desc: 'Duplicate selected', keys: ['Ctrl', 'D'] },
        { desc: 'Delete selected', keys: ['Del / Backspace'] },
      ],
    },
    {
      title: 'Movement & Snapping',
      items: [
        { desc: 'Nudge element by 1 pt', keys: ['Arrow keys'] },
        { desc: 'Nudge element by 10 pt', keys: ['Shift', 'Arrow keys'] },
        { desc: 'Move without snapping', keys: ['Ctrl', 'Drag'] },
        { desc: 'Show distance measurements', keys: ['Alt', 'Drag'] },
      ],
    },
    {
      title: 'Layers & History',
      items: [
        { desc: 'Bring layer forward', keys: ['Ctrl', ']'] },
        { desc: 'Send layer backward', keys: ['Ctrl', '['] },
        { desc: 'Bring to very front', keys: ['Ctrl', 'Shift', ']'] },
        { desc: 'Send to very back', keys: ['Ctrl', 'Shift', '['] },
        { desc: 'Undo last action', keys: ['Ctrl', 'Z'] },
        { desc: 'Redo last action', keys: ['Ctrl', 'Y'] },
      ],
    },
  ];

  return (
    <div
      className="shortcuts-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={() => setHelp(false)}
    >
      <div
        className="shortcuts-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-head">
          <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
          <button
            type="button"
            className="x"
            aria-label="Close keyboard shortcuts dialog"
            onClick={() => setHelp(false)}
          >
            ×
          </button>
        </div>

        <div className="shortcuts-grid">
          {sections.map((sec) => (
            <div key={sec.title} className="shortcuts-section">
              <h3>{sec.title}</h3>
              <div className="shortcuts-list">
                {sec.items.map((it, idx) => (
                  <div key={idx} className="shortcuts-row">
                    <span className="shortcuts-desc">{it.desc}</span>
                    <span className="shortcuts-keys">
                      {it.keys.map((k, ki) => (
                        <kbd key={ki}>{k}</kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-foot">
          <span>Tip: Right-click any element or the canvas for quick actions.</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setHelp(false)}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
