'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TEMPLATES, designFromTemplate, sampleValues, type Design } from '@siescoms/certificate';
import { api, uploadFile, type SavedDesign, type UploadInfo } from '@/lib/api';
import { useApp } from '@/lib/store';
import { CertView, Switch } from '../common';
import { LAST_DESIGN_KEY } from '../Studio';

const mm = (pt: number) => Math.round((pt / 72) * 25.4);
export function pageLabel(p: { w: number; h: number }) {
  const near = (a: number, b: number) => Math.abs(a - b) < 4;
  if (near(p.w, 842) && near(p.h, 595)) return 'A4 landscape';
  if (near(p.w, 595) && near(p.h, 842)) return 'A4 portrait';
  if (near(p.w, 792) && near(p.h, 612)) return 'US Letter landscape';
  return `${mm(p.w)} × ${mm(p.h)} mm`;
}

function Gallery() {
  const tplPick = useApp((s) => s.tplPick);
  const campus = useApp((s) => s.campus);
  const set = useApp((s) => s.set);
  const useTemplate = useApp((s) => s.useTemplate);
  const go = useApp((s) => s.go);
  const thumbs = useMemo(() => TEMPLATES.map((t) => ({ t, d0: designFromTemplate(t.id, false), d1: designFromTemplate(t.id, true) })), []);
  return (
    <motion.div
      className="gallery"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {thumbs.map(({ t, d0, d1 }, index) => {
        const d = campus ? d1 : d0;
        return (
          <motion.button
            key={t.id}
            type="button"
            className={`tpl-card${t.id === tplPick ? ' on' : ''}`}
            aria-pressed={t.id === tplPick}
            onClick={() => set({ tplPick: t.id })}
            onDoubleClick={() => { set({ tplPick: t.id }); useTemplate(t.id, campus); go(2); }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
          >
            <CertView design={d} values={sampleValues(d)} className="thumb" />
            <div className="tpl-meta">
              <b>{t.name}</b>
              <span>{t.tag}</span>
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

function Resume() {
  const [saved, setSaved] = useState<SavedDesign | null>(null);
  const loadSaved = useApp((s) => s.loadSaved);
  const go = useApp((s) => s.go);
  const set = useApp((s) => s.set);

  useEffect(() => {
    const id = localStorage.getItem(LAST_DESIGN_KEY);
    if (id) api.get<SavedDesign>(`/api/designs/${id}`).then(setSaved, () => localStorage.removeItem(LAST_DESIGN_KEY));
  }, []);

  if (!saved) return null;

  const discard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = saved.id;
    localStorage.removeItem(LAST_DESIGN_KEY);
    setSaved(null);
    set({
      designId: null,
      saveState: 'idle',
      rows: [],
      headers: [],
      dataName: '',
      map: {},
      emailCol: '',
      single: {},
      singleEmail: '',
      manualPeople: [{ id: 'p-1', values: {}, email: '' }],
      run: null,
    });
    if (id) {
      await api.send(`/api/designs/${id}`, 'DELETE').catch(() => {});
    }
  };

  return (
    <div className="resume">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <span>Pick up where you left off: <b>{saved.design.name || 'Untitled certificate'}</b></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { loadSaved(saved.id, saved.design); go(2); }}>
          Continue editing →
        </button>
        <button
          type="button"
          className="resume-clear-btn"
          onClick={discard}
          title="Clear progress and start fresh (✕)"
          aria-label="Clear progress and start fresh"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function UploadArea() {
  const upload = useApp((s) => s.upload);
  const set = useApp((s) => s.set);
  const [drag, setDrag] = useState(false);
  const setUp = (p: Partial<typeof upload>) => set((s) => ({ upload: { ...s.upload, ...p } }));

  const start = async (file: File) => {
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) { setUp({ error: 'Choose a PDF, PNG or JPG file.' }); return; }
    if (file.size > 20 * 1024 * 1024) { setUp({ error: 'That file is over 20 MB.' }); return; }
    setUp({ status: 'busy', pct: 0, phase: 'upload', fileName: file.name, error: '', info: null, pageIndex: 0 });
    try {
      const info = await uploadFile<UploadInfo>('/api/uploads/background', file, (p) => {
        setUp({ pct: Math.round(p * 80), phase: p >= 1 ? 'read' : 'upload' });
      });
      setUp({ status: 'done', pct: 100, info });
      set((s) => ({ design: { ...s.design, name: file.name.replace(/\.[^.]+$/, '') } }));
    } catch (err) {
      setUp({ status: 'idle', error: (err as Error).message });
    }
  };

  useEffect(() => {
    if (upload.status !== 'busy' || upload.phase !== 'read') return;
    const t = setInterval(() => set((s) => ({ upload: { ...s.upload, pct: Math.min(97, s.upload.pct + 2) } })), 120);
    return () => clearInterval(t);
  }, [upload.status, upload.phase, set]);

  if (upload.status === 'busy') {
    const msg = upload.phase === 'upload' ? 'Uploading…' : upload.pct < 88 ? 'Measuring the page…' : 'Looking for a sample name…';
    return (
      <div className="card" style={{ padding: 28, gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}><span style={{ fontWeight: 600, wordBreak: 'break-all' }}>{upload.fileName}</span><span style={{ color: 'var(--muted)' }}>{upload.pct}%</span></div>
        <div className="progress"><div style={{ width: `${upload.pct}%` }} /></div>
        <span className="text-sm" style={{ fontSize: 14 }}>{msg}</span>
      </div>
    );
  }
  if (upload.status === 'done' && upload.info) return <UploadDone />;
  return (
    <>
      <label className={`dropzone${drag ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) start(f); }}>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) start(f); }} />
        <span className="arrow">↑</span>
        <span className="big">Drop your certificate here</span>
        <span className="text-sm" style={{ fontSize: 14 }}>PDF, PNG or JPG · up to 20 MB</span>
        <span className="fake-btn">Choose a file</span>
      </label>
      {upload.error ? <div className="alert">{upload.error}</div> : null}
      <p className="text-sm" style={{ textAlign: 'center' }}>An uploaded design stays as it is. You add names and details on top, and cover any sample text.</p>
    </>
  );
}

function UploadDone() {
  const upload = useApp((s) => s.upload);
  const name = useApp((s) => s.design.name);
  const set = useApp((s) => s.set);
  const useUpload = useApp((s) => s.useUpload);
  const go = useApp((s) => s.go);
  const [busyPage, setBusyPage] = useState(false);
  const info = upload.info!;
  const preview: Design = {
    name, templateId: 'upload', page: info.page, bg: '#FFFFFF', pattern: '', dark: false, detected: info.detected, items: [],
    background: { fileKey: info.fileKey, fileType: info.fileType, pageIndex: upload.pageIndex, pages: info.pages, fileName: info.fileName },
  };
  const pickPage = async (i: number) => {
    setBusyPage(true);
    try {
      const r = await api.get<Pick<UploadInfo, 'page' | 'pages' | 'detected'>>(`/api/uploads/background/${info.fileKey}/page/${i}`);
      set((s) => ({ upload: { ...s.upload, pageIndex: i, info: { ...info, ...r } } }));
    } finally { setBusyPage(false); }
  };
  return (
    <div className="card" style={{ padding: 20, gap: 20 }}>
      <div className="up-grid">
        <CertView design={preview} values={{}} className="cert-frame w320" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, wordBreak: 'break-all' }}>{info.fileName}</span>
          <dl className="facts" style={{ margin: 0 }}>
            <dt>Size</dt><dd>{pageLabel(info.page)}</dd>
            <dt>Pages</dt><dd>{info.pages}</dd>
          </dl>
          {info.pages > 1 ? (
            <label className="field">Use page
              <select className="select" value={upload.pageIndex} disabled={busyPage} onChange={(e) => pickPage(Number(e.target.value))}>
                {Array.from({ length: Math.min(info.pages, 50) }, (_, i) => <option key={i} value={i}>Page {i + 1}</option>)}
              </select>
            </label>
          ) : null}
          {info.detected ? (
            <div className="success"><span>✓</span><span>We spotted a sample name, <b>{info.detected.text}</b>. Next, we&apos;ll help you swap it for each person&apos;s name.</span></div>
          ) : (
            <p className="text">You&apos;ll choose where each person&apos;s name goes in the next step.</p>
          )}
        </div>
      </div>
      <label className="field">Template name<input className="input" value={name} onChange={(e) => set((s) => ({ design: { ...s.design, name: e.target.value } }))} /></label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={() => set((s) => ({ upload: { ...s.upload, status: 'idle', info: null, fileName: '' } }))}>Choose a different file</button>
        <button type="button" className="btn btn-primary" onClick={() => { useUpload(info, upload.pageIndex, name || info.fileName); go(2); }}>Continue to design →</button>
      </div>
    </div>
  );
}

export function StartStep() {
  const srcMode = useApp((s) => s.srcMode);
  const upload = useApp((s) => s.upload);
  const campus = useApp((s) => s.campus);
  const tplPick = useApp((s) => s.tplPick);
  const set = useApp((s) => s.set);
  const useTemplate = useApp((s) => s.useTemplate);
  const go = useApp((s) => s.go);
  const isTpl = srcMode === 'tpl';
  const idle = upload.status === 'idle';
  const pickName = TEMPLATES.find((t) => t.id === tplPick)?.name;
  return (
    <main className="start">
      <div className={`start-wrap${isTpl && idle ? ' wide' : ''}`}>
        <div className="start-top">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1>Start with your certificate</h1>
            <p className="lead">Pick one of our designs, or upload the one you already use. You can change every part of a design in the next step.</p>
          </div>
          {idle ? <Resume /> : null}
          {idle ? (
            <div className="start-bar">
              <div className="tabs fit" role="tablist">
                <button type="button" role="tab" aria-selected={isTpl} className={`tab${isTpl ? ' on' : ''}`} onClick={() => set({ srcMode: 'tpl' })}>Choose a design</button>
                <button type="button" role="tab" aria-selected={!isTpl} className={`tab${!isTpl ? ' on' : ''}`} onClick={() => set({ srcMode: 'upload' })}>Upload your own</button>
              </div>
              {isTpl ? (
                <div className="start-actions">
                  <div style={{ width: 250 }}><Switch on={campus} onClick={() => set({ campus: !campus })} title="Campus illustration" sub="Show the SIES campus sketch" /></div>
                  <button type="button" className="btn btn-primary" style={{ height: 44, fontSize: 14 }} onClick={() => { useTemplate(tplPick, campus); go(2); }}>Continue with {pickName} →</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="gallery-box">
          {isTpl && idle ? <Gallery /> : null}
          {!isTpl || !idle ? <UploadArea /> : null}
        </div>
      </div>
      {isTpl && idle ? (
        <div className="start-sticky">
          <button type="button" className="btn btn-primary" onClick={() => { useTemplate(tplPick, campus); go(2); }}>Continue with {pickName} →</button>
        </div>
      ) : null}
    </main>
  );
}
