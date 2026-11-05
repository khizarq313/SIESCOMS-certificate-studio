'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, type SavedDesign } from '@/lib/api';
import { STEP_SLUGS, useApp, type Step } from '@/lib/store';
import { StartStep } from './start/StartStep';
import { DesignStep } from './design/DesignStep';
import { RecipientsStep } from './recipients/RecipientsStep';
import { DeliveryStep } from './delivery/DeliveryStep';
import { TopLoadingBar } from './TopLoadingBar';

const LABELS = ['Upload', 'Design', 'Recipients', 'Send'];
export const LAST_DESIGN_KEY = 'siescoms:lastDesign';

function Header() {
  const step = useApp((s) => s.step);
  const maxStep = useApp((s) => s.maxStep);
  const go = useApp((s) => s.go);
  const saveState = useApp((s) => s.saveState);
  const signOut = async () => { await api.send('/api/auth/logout', 'POST').catch(() => {}); location.href = '/login'; };
  return (
    <header className="header">
      <div
        className="brand"
        onClick={() => go(1)}
        role="button"
        tabIndex={0}
        title="Go to Certificate Studio Home"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') go(1); }}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/static/assets/sun.svg" alt="SIES" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className="brand-name"><span className="brand-long">SIES College of Management Studies</span><span className="brand-short">SIES</span></span>
          <span className="brand-sub">Certificate Studio</span>
        </div>
      </div>
      <nav className="steps" aria-label="Steps">
        {LABELS.map((l, i) => {
          const n = (i + 1) as Step, done = n < step, cur = n === step, reach = n <= maxStep && !cur;
          return (
            <span key={l} style={{ display: 'contents' }}>
              <button type="button" className={`step${done ? ' done' : ''}${cur ? ' cur' : ''}${reach ? ' reach' : ''}`} onClick={reach ? () => go(n) : undefined} aria-current={cur ? 'step' : undefined}>
                <span className="step-dot">{done ? '✓' : n}</span><span className="label">{l}</span>
              </button>
              {n < 4 ? <span className="step-sep" /> : null}
            </span>
          );
        })}
      </nav>
      <div className="header-right">
        {step > 1 ? (
          <span className={`save-state${saveState === 'error' ? ' error' : ''}`}>
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Couldn’t save changes' : ''}
          </span>
        ) : null}
        <button type="button" className="link-btn plain" onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}

/** Saves the design a moment after each change, once the user is past the first step. Saves run one at a time. */
let saving: Promise<void> = Promise.resolve();
function useAutosave() {
  const design = useApp((s) => s.design);
  const step = useApp((s) => s.step);
  useEffect(() => {
    if (step < 2) return;
    const t = setTimeout(() => {
      saving = saving.then(async () => {
        const { designId, design: current, set } = useApp.getState();
        set({ saveState: 'saving' });
        try {
          const rec = designId
            ? await api.send<SavedDesign>(`/api/designs/${designId}`, 'PUT', { design: current })
            : await api.send<SavedDesign>('/api/designs', 'POST', { design: current });
          set({ designId: rec.id, saveState: useApp.getState().design === current ? 'saved' : 'saving' });
          localStorage.setItem(LAST_DESIGN_KEY, rec.id);
        } catch {
          set({ saveState: 'error' });
        }
      });
    }, 800);
    return () => clearTimeout(t);
  }, [design, step]);
}

/** Keeps the step in the address bar so Back and Forward work. */
function useStepUrl() {
  const step = useApp((s) => s.step);
  useEffect(() => {
    const slug = STEP_SLUGS[step - 1];
    const cur = new URLSearchParams(location.search).get('step') || 'start';
    if (cur !== slug) history.pushState({ step }, '', step === 1 ? location.pathname : `?step=${slug}`);
  }, [step]);
  useEffect(() => {
    const onPop = () => {
      const slug = new URLSearchParams(location.search).get('step') || 'start';
      const n = (STEP_SLUGS.indexOf(slug as never) + 1 || 1) as Step;
      const { maxStep, set } = useApp.getState();
      set({ step: (n <= maxStep ? n : 1) as Step, sel: null });
    };
    window.addEventListener('popstate', onPop);
    if (new URLSearchParams(location.search).get('step')) history.replaceState({ step: 1 }, '', location.pathname);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}

export function Studio() {
  const step = useApp((s) => s.step);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api.get<{ signedIn: boolean }>('/api/auth/me')
      .then((r) => (r.signedIn ? setReady(true) : (location.href = '/login')))
      .catch(() => setReady(true));
  }, []);
  useAutosave();
  useStepUrl();
  if (!ready) return <div className="root" />;
  return (
    <div className="root">
      <TopLoadingBar />
      <Header />
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        >
          {step === 1 && <StartStep />}
          {step === 2 && <DesignStep />}
          {step === 3 && <RecipientsStep />}
          {step === 4 && <DeliveryStep />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
