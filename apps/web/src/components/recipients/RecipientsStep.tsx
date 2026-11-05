'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { uploadFile, type SheetInfo } from '@/lib/api';
import { useApp } from '@/lib/store';
import { loadList, loadSampleList, useRecipients } from '@/lib/recipients';
import { Badge, CertView, download } from '../common';

export function PreviewNav() {
  const R = useRecipients();
  const set = useApp((s) => s.set);
  const n = R.rows.length;
  if (n <= 1) return null;
  const displayName = R.prevName || `Person ${R.idx + 1}`;
  return (
    <div className="preview-nav">
      <div className="who"><small>Previewing</small><b>{displayName}</b></div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="round-btn" aria-label="Previous person" onClick={() => set({ prevIdx: (R.idx - 1 + n) % n })}>←</button>
        <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 64, textAlign: 'center' }}>{R.idx + 1} of {n}</span>
        <button type="button" className="round-btn" aria-label="Next person" onClick={() => set({ prevIdx: (R.idx + 1) % n })}>→</button>
      </div>
    </div>
  );
}

function ListCard() {
  const s = useApp();
  const R = useRecipients();
  const [drag, setDrag] = useState(false);
  const pick = async (f: File) => {
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) { s.set({ listError: 'Choose an Excel (.xlsx, .xls) or CSV file.' }); return; }
    s.set({ listBusy: true, listError: '' });
    try {
      const r = await uploadFile<SheetInfo>('/api/spreadsheets/parse', f);
      loadList(r.fileName, r.headers, r.rows);
    } catch (err) {
      s.set({ listError: (err as Error).message });
    } finally {
      s.set({ listBusy: false });
    }
  };
  const blankTemplate = () => {
    const hd = [...R.dyn.map((f) => f.label), 'Email'], ex = [...R.dyn.map((f) => f.sampleValue || ''), 'aarav.sharma@siescoms.edu'];
    download('recipients_template.csv', '﻿' + [hd, ex].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  };
  const hasFile = !!s.rows.length;
  return (
    <div className="card">
      <div className="card-title"><Badge done={hasFile} n="1" />Your list</div>
      {!hasFile ? (
        <>
          <label className={`mini-drop${drag ? ' over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}>
            <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f); }} />
            <span style={{ fontWeight: 500, fontSize: 14 }}>{s.listBusy ? 'Reading your list…' : 'Drop a spreadsheet or click to choose'}</span>
            <span className="text-sm">Excel or CSV, with one person per row</span>
          </label>
          {s.listError ? <span className="note" style={{ color: 'var(--bad)' }}>{s.listError}</span> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
            <button type="button" className="link-btn" onClick={loadSampleList}>Use a sample list</button>
            <button type="button" className="link-btn" onClick={blankTemplate}>Download a blank template (CSV)</button>
          </div>
        </>
      ) : (
        <>
          <div className="file-row">
            <span className="file-ext">{/\.csv$/i.test(s.dataName) ? 'CSV' : 'XLS'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.dataName}</span>
              <span className="text-sm">{s.rows.length} people · {s.headers.length} columns</span>
            </div>
            <button type="button" className="pop-act" onClick={() => s.set({ rows: [], headers: [], dataName: '', map: {}, emailCol: '', run: null })}>Replace</button>
          </div>
          {s.dataNote ? <span className="note">{s.dataNote}</span> : null}
        </>
      )}
    </div>
  );
}

function MatchCard() {
  const s = useApp();
  const R = useRecipients();
  const tag = (ok: boolean) => ({ fontSize: 12, fontWeight: 500, color: ok ? 'var(--ok)' : 'var(--warn)' });
  return (
    <div className="card">
      <div className="card-title"><Badge done={R.mapsOk} n="2" />Match your columns</div>
      <p className="text">We matched what we could. Check each one.</p>
      {R.dyn.map((f) => (
        <label key={f.key} className="field">
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{f.label}</span><span style={tag(!!s.map[f.key])}>{s.map[f.key] ? '✓ matched' : 'same for everyone'}</span></span>
          <select className="select" value={s.map[f.key] || ''} onChange={(e) => s.set({ map: { ...s.map, [f.key]: e.target.value } })}>
            <option value="">Same for everyone: {f.sampleValue || '(blank)'}</option>
            {s.headers.map((h) => <option key={h} value={h}>Column: {h}</option>)}
          </select>
        </label>
      ))}
      <label className="field">
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>Email address</span><span style={tag(!!s.emailCol)}>{s.emailCol ? '✓ matched' : 'not used'}</span></span>
        <select className="select" value={s.emailCol} onChange={(e) => s.set({ emailCol: e.target.value })}>
          <option value="">No emails (download only)</option>
          {s.headers.map((h) => <option key={h} value={h}>Column: {h}</option>)}
        </select>
      </label>
    </div>
  );
}

function IssuesCard() {
  const set = useApp((s) => s.set);
  const R = useRecipients();
  const n = R.bad.length;
  return (
    <div className="card">
      <div className="card-title"><span className={`badge${n ? '' : ' done'}`}>{n ? '!' : '✓'}</span>{n ? `${n} ${n === 1 ? 'row needs' : 'rows need'} a look` : 'Ready to go'}</div>
      {!n ? <p className="text">Every row has what it needs.</p> : null}
      {R.bad.slice(0, 6).map((x) => (
        <button key={x.i} type="button" className="issue" onClick={() => set({ prevIdx: x.i })}><span style={{ fontWeight: 500 }}>{R.nameOf(x.r, x.i)}</span><span>{x.list[0]}</span></button>
      ))}
      {n ? <p className="text-sm">Fix these in your spreadsheet and upload it again, or carry on. Rows without an email are skipped when sending.</p> : null}
    </div>
  );
}

function RowsTable() {
  const set = useApp((s) => s.set);
  const R = useRecipients();
  const grid = `44px ${R.cols.map(() => 'minmax(130px,1fr)').join(' ')} minmax(120px,auto)`;
  const n = R.bad.length;
  const warnings = new Map(R.bad.map((x) => [x.i, x.list[0]]));
  return (
    <div className="table">
      <div className="table-head"><span style={{ fontWeight: 600 }}>{R.rows.length} people · {R.headers.length} columns</span><span style={{ fontSize: 13, fontWeight: 500, color: n ? 'var(--bad)' : 'var(--ok)' }}>{n ? `${n} to check` : 'All rows OK'}</span></div>
      <div className="table-scroll">
        <div className="trow head" style={{ gridTemplateColumns: grid }}>{['#', ...R.cols, ''].map((h, i) => <span key={i}>{h}</span>)}</div>
        {R.rows.map((r, i) => {
          const w = warnings.get(i);
          return (
            <div key={i} className={`trow${i === R.idx ? ' on' : w ? ' warn' : ''}`} style={{ gridTemplateColumns: grid }} onClick={() => set({ prevIdx: i })}>
              <span>{i + 1}</span>{R.cols.map((c) => <span key={c}>{r[c] || '—'}</span>)}<span className="w">{w || ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ManualRecipientsList() {
  const s = useApp();
  const R = useRecipients();
  const manualPeople = s.manualPeople;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <AnimatePresence initial={false}>
        {manualPeople.map((person, index) => {
          const isCurrent = s.prevIdx === index;
          const personName = (person.values['recipient_name'] || '').trim();
          const title = manualPeople.length === 1
            ? 'Their details'
            : (personName ? `Person ${index + 1} · ${personName}` : `Person ${index + 1}`);

          return (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden', marginBottom: -14 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`card${isCurrent ? ' on' : ''}`}
              style={{
                borderColor: isCurrent ? 'var(--accent)' : undefined,
                boxShadow: isCurrent ? '0 0 0 1.5px var(--accent)' : undefined,
                transition: 'border-color .15s, box-shadow .15s',
              }}
              onClick={() => s.set({ prevIdx: index })}
            >
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span className={`badge${isCurrent ? ' done' : ''}`}>{index + 1}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                </span>
                {manualPeople.length > 1 ? (
                  <button
                    type="button"
                    className="pop-act bad"
                    style={{ fontSize: 13, flex: 'none', padding: '2px 6px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      s.removeManualPerson(person.id);
                    }}
                    title="Remove this person"
                  >
                    ✕ Remove
                  </button>
                ) : null}
              </div>

              {R.dyn.map((f) => (
                <label key={f.key} className="field">
                  {f.label}
                  <input
                    className="input"
                    placeholder={f.sampleValue || f.label}
                    value={person.values[f.key] ?? (person.values[f.key] !== undefined ? '' : f.sampleValue)}
                    onChange={(e) => {
                      s.updateManualPerson(person.id, { values: { [f.key]: e.target.value } });
                      s.set({ prevIdx: index });
                    }}
                  />
                </label>
              ))}

              <label className="field">
                <span>
                  Email <span style={{ fontWeight: 400, color: 'var(--muted-2)' }}>(only needed to email it)</span>
                </span>
                <input
                  className="input"
                  type="email"
                  placeholder={index === 0 ? 'name@siescoms.edu' : `person${index + 1}@siescoms.edu`}
                  value={person.email || ''}
                  onChange={(e) => {
                    s.updateManualPerson(person.id, { email: e.target.value });
                    s.set({ prevIdx: index });
                  }}
                />
              </label>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <motion.button
        type="button"
        className="btn btn-ghost"
        style={{
          width: '100%',
          borderStyle: 'dashed',
          borderColor: 'var(--accent)',
          color: 'var(--accent)',
          background: 'var(--accent-tint)',
          fontWeight: 600,
          gap: 6,
        }}
        whileHover={{ scale: 1.01, background: 'var(--accent-soft)' }}
        whileTap={{ scale: 0.99 }}
        onClick={() => s.addManualPerson()}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
        <span>Add another person {manualPeople.length >= 1 ? `(#${manualPeople.length + 1})` : ''}</span>
      </motion.button>
    </div>
  );
}

export function RecipientsStep() {
  const s = useApp();
  const R = useRecipients();
  const isManual = s.recipMode === 'single';
  const multi = R.rows.length > 1;

  return (
    <div className="body">
      <aside className="side">
        <div className="side-head">
          <h2>Who&apos;s getting one?</h2>
          <p>Enter details for one or multiple people below, or upload a spreadsheet for large batches.</p>
        </div>
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={isManual}
            className={`tab${isManual ? ' on' : ''}`}
            onClick={() => s.set({ recipMode: 'single', run: null })}
          >
            Direct entry {s.manualPeople.length > 1 ? `(${s.manualPeople.length})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isManual}
            className={`tab${!isManual ? ' on' : ''}`}
            onClick={() => s.set({ recipMode: 'list', run: null })}
          >
            Upload spreadsheet
          </button>
        </div>
        {isManual ? (
          <ManualRecipientsList />
        ) : (
          <>
            <ListCard />
            {s.rows.length ? <><MatchCard /><IssuesCard /></> : null}
          </>
        )}
        <div className="spacer" />
        <div className="side-foot">
          <button type="button" className="btn btn-ghost" onClick={() => s.go(2)}>← Back</button>
          <button type="button" className="btn btn-primary btn-grow" disabled={!R.ready} onClick={() => s.go(4)}>Continue →</button>
        </div>
      </aside>
      <section className="stage">
        <div className="stage-bar end" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-ghost btn-top" onClick={() => s.go(2)}>
            ← Back to design
          </button>
          <button type="button" className="btn btn-primary btn-top" disabled={!R.ready} onClick={() => s.go(4)}>
            Continue to delivery →
          </button>
        </div>
        {multi ? <PreviewNav /> : null}
        <CertView design={R.design} values={R.prevVals} className="cert-frame w700" />
        {!isManual && !R.rows.length ? (
          <span className="text-sm" style={{ color: 'var(--muted-2)' }}>
            Showing sample text. Add your list to preview real names.
          </span>
        ) : null}
        {multi ? <RowsTable /> : null}
      </section>
    </div>
  );
}
