'use client';
import { useEffect, useState } from 'react';
import { Certificate, type Design, type Values } from '@siescoms/certificate';
import { resolveSrc } from '@/lib/resolve';
import { renderBackground } from '@/lib/pdfBackground';

export function Switch({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button type="button" className="switch-row" onClick={onClick} aria-pressed={on}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span className="t">{title}</span><span className="s">{sub}</span></span>
      <span className={`switch-track${on ? ' on' : ''}`}><span className="switch-knob" /></span>
    </button>
  );
}

export function Badge({ done, n }: { done: boolean; n: string }) {
  return <span className={`badge${done ? ' done' : ''}`}>{done ? '✓' : n}</span>;
}

/** The image of an uploaded certificate, rendered in the browser. */
export function useBackgroundUrl(design: Pick<Design, 'background'>): { url: string | null; loading: boolean; error: boolean } {
  const bg = design.background;
  const [state, setState] = useState<{ key: string; url: string | null; error: boolean }>({ key: '', url: null, error: false });
  const key = bg ? `${bg.fileKey}#${bg.pageIndex}` : '';
  useEffect(() => {
    if (!bg) return;
    let live = true;
    renderBackground(bg).then((r) => live && setState({ key, url: r.url, error: false }), () => live && setState({ key, url: null, error: true }));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!bg) return { url: null, loading: false, error: false };
  return { url: state.key === key ? state.url : null, loading: state.key !== key, error: state.key === key && state.error };
}

/** A read-only certificate (previews, thumbnails). */
export function CertView({ design, values, className = 'cert-frame', children }: { design: Design; values: Values; className?: string; children?: React.ReactNode }) {
  const bg = useBackgroundUrl(design);
  return (
    <div className={className} style={{ position: 'relative' }}>
      <Certificate design={design} values={values} resolveSrc={resolveSrc} backgroundUrl={bg.url}>{children}</Certificate>
      {bg.loading ? <div className="cert-loading">Loading your certificate…</div> : null}
      {bg.error ? <div className="cert-loading">Couldn’t show the uploaded file.</div> : null}
    </div>
  );
}

export function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
