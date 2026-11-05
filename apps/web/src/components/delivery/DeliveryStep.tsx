'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FIELD_PRESETS, certificateFileName, fillPlaceholders, placeholderValues, safeFileStem, textFields } from '@siescoms/certificate';
import { api, type JobView, type MailConfig } from '@/lib/api';
import { useApp, type RunState } from '@/lib/store';
import { useRecipients } from '@/lib/recipients';
import { CertView } from '../common';
import { PreviewNav } from '../recipients/RecipientsStep';

function saveFile(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Polls a running job and mirrors it into the store. */
function useJobPolling(jobId: string | null) {
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      const run = useApp.getState().run;
      // A finished run (e.g. after going back a step and returning) must not poll or download again.
      if (stop || !run || run.jobId !== jobId || run.finished) return;
      try {
        const v = await api.get<JobView>(`/api/jobs/${jobId}?since=${run.results.length}`);
        const cur = useApp.getState().run;
        if (stop || !cur || cur.jobId !== jobId) return;
        const finished = v.status !== 'running';
        const next: RunState = {
          ...cur, done: v.done, total: v.total, testOnly: v.testOnly, fileName: v.fileName,
          results: [...v.results.slice().reverse(), ...cur.results], finished, cancelled: v.status === 'cancelled',
          err: v.status === 'failed' ? v.error || 'Something went wrong.' : '',
        };
        useApp.getState().set({ run: next });
        if (finished) {
          if (v.status === 'done' && v.kind === 'download' && v.fileName) saveFile(`/api/jobs/${jobId}/file`);
          return;
        }
      } catch (err) {
        const cur = useApp.getState().run;
        if (cur) useApp.getState().set({ run: { ...cur, finished: true, err: (err as Error).message } });
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
    return () => { stop = true; };
  }, [jobId]);
}

export function DeliveryStep() {
  const s = useApp();
  const R = useRecipients();
  const [mail, setMail] = useState<MailConfig | null>(null);
  const [startErr, setStartErr] = useState('');
  useEffect(() => { api.get<MailConfig>('/api/email/config').then(setMail, () => {}); }, []);
  useJobPolling(s.run?.jobId ?? null);

  const isEmail = s.delivery === 'email';
  const run = s.run;
  const multi = R.rows.length > 1;
  const zip = s.fmt === 'zip' && multi;
  const firstName = R.rows[0] ? R.nameOf(R.rows[0], 0) : 'Recipient';
  const outName = multi ? `${safeFileStem(s.baseName, 'certificates')}${zip ? '.zip' : '.pdf'}` : certificateFileName(R.single ? R.prevVals.recipient_name || 'Recipient' : firstName);
  const working = !!(run && !run.finished);
  const smtpReady = s.sender !== 'smtp' || (!!s.smtp.host && !!s.smtp.user && !!s.smtp.pass && !!Number(s.smtp.port));
  // R.ready too: the header can jump here after the name column was unmatched.
  const canStart = R.ready && !!R.rows.length && !working && (!isEmail || (R.valid.length > 0 && smtpReady && !!s.subject.trim()));

  // Same values the server fills in, so the preview shows exactly what gets sent.
  const mailVals = placeholderValues(R.prev, R.prevVals);
  const fill = (t: string) => fillPlaceholders(t, mailVals);

  const start = async () => {
    if (!canStart) return;
    setStartErr('');
    const body = {
      design: R.design, rows: R.rows, map: R.map, emailColumn: R.ecol, delivery: s.delivery, format: zip ? 'zip' : 'pdf', baseName: s.baseName,
      email: isEmail ? { subject: s.subject, body: s.body, sender: s.sender, smtp: s.sender === 'smtp' ? { ...s.smtp, port: Number(s.smtp.port) } : undefined } : undefined,
    };
    try {
      const { jobId } = await api.send<{ jobId: string }>('/api/jobs', 'POST', body);
      s.set({ run: { jobId, kind: s.delivery, total: R.rows.length, done: 0, results: [], finished: false, cancelled: false, err: '', testOnly: false, fileName: null } });
    } catch (err) {
      setStartErr((err as Error).message);
    }
  };
  const cancel = () => { if (run?.jobId) api.send(`/api/jobs/${run.jobId}/cancel`, 'POST').catch(() => {}); };
  const test = async () => {
    if (s.smtpTest === 'testing') return;
    s.set({ smtpTest: 'testing', smtpMsg: '' });
    try {
      const r = await api.send<{ ok: boolean; error?: string; testOnly?: boolean }>('/api/email/test', 'POST', { sender: s.sender, smtp: s.sender === 'smtp' ? s.smtp : undefined });
      s.set({ smtpTest: r.ok ? 'ok' : 'fail', smtpMsg: r.ok ? (r.testOnly ? 'Test mode: emails go to a test inbox, not to real people.' : '') : r.error || '' });
    } catch (err) {
      s.set({ smtpTest: 'fail', smtpMsg: (err as Error).message });
    }
  };
  const setSmtp = (p: Partial<typeof s.smtp>) => s.set({ smtp: { ...s.smtp, ...p }, smtpTest: null, smtpMsg: '' });

  const okN = run ? run.results.filter((x) => x.ok).length : 0;
  const failN = run ? run.results.length - okN : 0;
  const systemFrom = mail?.systemConfigured ? mail.systemFrom : mail?.testMode ? 'Not set up yet · test mode' : 'Not set up yet';
  const mailFrom = s.sender === 'smtp' ? s.smtp.user || 'you@siescoms.edu' : `SIES College of Management Studies${mail?.systemFrom ? ` <${mail.systemFrom.replace(/^.*<|>.*$/g, '')}>` : ''}`;
  const chips = textFields(R.design).filter((i) => i.type !== 'custom_text');
  const primaryLabel = working ? 'Working…' : isEmail ? (multi ? `Email ${R.valid.length} people` : 'Email certificate') : multi ? `Create ${R.rows.length} certificates` : 'Download certificate';
  const runTitle = !run ? '' : run.err ? 'Couldn’t finish' : run.cancelled ? 'Stopped' : run.finished ? (run.kind === 'email' ? (run.testOnly ? 'Test emails sent' : 'Emails sent') : 'Your file is ready') : run.kind === 'email' ? 'Sending certificates…' : 'Creating certificates…';
  const noEmailMsg = R.single ? 'Add their email address in Recipients to send it.' : R.ecol ? 'No row has a valid email address.' : "Your list doesn't have an email column matched yet.";

  return (
    <div className="body">
      <aside className="side">
        <div className="side-head"><h2>How should they get it?</h2><p>Download the certificates to share or print, or email each person their own copy.</p></div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          <button type="button" className={`opt-card${!isEmail ? ' on' : ''}`} aria-pressed={!isEmail} onClick={() => s.set({ delivery: 'download', run: null })}><span style={{ fontWeight: 600, fontSize: 14 }}>Download</span><span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{multi ? 'A ZIP or one combined PDF' : 'A print-ready PDF'}</span></button>
          <button type="button" className={`opt-card${isEmail ? ' on' : ''}`} aria-pressed={isEmail} onClick={() => s.set({ delivery: 'email', run: null })}><span style={{ fontWeight: 600, fontSize: 14 }}>Email</span><span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>Sent as a PDF attachment</span></button>
        </div>
        {isEmail ? (
          <>
            {!R.valid.length ? <div className="alert">{noEmailMsg}<button type="button" className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => s.go(3)}>Go to Recipients</button></div> : null}
            <div className="card">
              <label className="field">Subject<input className="input" value={s.subject} onChange={(e) => s.set({ subject: e.target.value })} /></label>
              <label className="field">Message<textarea className="textarea" rows={7} value={s.body} onChange={(e) => s.set({ body: e.target.value })} /></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="hint">Insert a detail</span>
                <div className="chips">{chips.map((c) => <button key={c.id} type="button" className="chip small" onClick={() => s.set({ body: `${s.body}{{${c.key}}}` })}>+ {c.label}</button>)}</div>
              </div>
            </div>
            <div className="card">
              <span className="card-title">Send from</span>
              <button type="button" className={`radio-row${s.sender === 'system' ? ' on' : ''}`} onClick={() => s.set({ sender: 'system', smtpTest: null, smtpMsg: '' })}>
                <span className="radio" /><span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><span className="t">College mail account</span><span className="s">{systemFrom}</span></span>
              </button>
              <button type="button" className={`radio-row${s.sender === 'smtp' ? ' on' : ''}`} onClick={() => s.set({ sender: 'smtp', smtpTest: null, smtpMsg: '' })}>
                <span className="radio" /><span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><span className="t">My own email account</span><span className="s">Gmail, Outlook, M365 or any SMTP server</span></span>
              </button>
              {s.sender === 'smtp' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>Presets:</span>
                    <button type="button" className="chip small" onClick={() => setSmtp({ host: 'smtp.office365.com', port: '587' })}>Outlook / M365</button>
                    <button type="button" className="chip small" onClick={() => setSmtp({ host: 'smtp.gmail.com', port: '587' })}>Gmail</button>
                  </div>
                  <div className="smtp-grid">
                    <label className="field">Server<input className="input" value={s.smtp.host} placeholder="smtp.office365.com" onChange={(e) => setSmtp({ host: e.target.value })} /></label>
                    <label className="field">Port<input className="input" inputMode="numeric" value={s.smtp.port} onChange={(e) => setSmtp({ port: e.target.value.replace(/\D/g, '') })} /></label>
                  </div>
                  <label className="field">Email<input className="input" type="email" value={s.smtp.user} placeholder="you@siescoms.edu" onChange={(e) => setSmtp({ user: e.target.value })} /></label>
                  <label className="field">App password<input className="input" type="password" autoComplete="off" value={s.smtp.pass} placeholder="••••••••••••••••" onChange={(e) => setSmtp({ pass: e.target.value })} /><span className="hint">Used only for this batch. Never saved on the server.</span></label>
                  <div style={{ fontSize: 12, color: 'var(--muted)', background: '#F8F5EE', border: '1px solid var(--line-2)', padding: '8px 10px', borderRadius: 8, lineHeight: 1.45 }}>
                    <b>Important:</b> Outlook/Office 365 and Gmail require a 16-character <b>App Password</b>, not your normal account password.
                  </div>
                </div>
              ) : null}
              <button type="button" className={`test-btn${s.smtpTest === 'ok' ? ' ok' : s.smtpTest === 'fail' ? ' fail' : ''}`} onClick={test}>
                {s.smtpTest === 'testing' ? 'Checking connection…' : s.smtpTest === 'ok' ? '✓ Connected. Ready to send' : s.smtpTest === 'fail' ? 'Couldn’t connect · Check details' : 'Test connection'}
              </button>
              {s.smtpMsg ? (
                <div style={{ fontSize: 12, lineHeight: 1.45, color: s.smtpTest === 'fail' ? 'var(--bad)' : 'var(--ok)', background: s.smtpTest === 'fail' ? 'var(--bad-bg)' : 'var(--ok-bg)', border: `1px solid ${s.smtpTest === 'fail' ? 'var(--bad-line)' : 'var(--ok-line)'}`, padding: '8px 10px', borderRadius: 8 }}>
                  {s.smtpMsg}
                </div>
              ) : null}
            </div>
            {multi && R.ecol && R.rows.length > R.valid.length && R.valid.length > 0 ? <span className="note" style={{ fontSize: 13 }}>{R.rows.length - R.valid.length} of {R.rows.length} people have no valid email and will be skipped.</span> : null}
          </>
        ) : (
          <div className="card">
            {multi ? (
              <>
                <span className="card-title">File type</span>
                <button type="button" className={`radio-row${zip ? ' on' : ''}`} onClick={() => s.set({ fmt: 'zip' })}><span className="radio" /><span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="t">ZIP of separate PDFs</span><span className="s">One file per person, named after them</span></span></button>
                <button type="button" className={`radio-row${!zip ? ' on' : ''}`} onClick={() => s.set({ fmt: 'pdf' })}><span className="radio" /><span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="t">One combined PDF</span><span className="s">Every certificate in one file, ready to print</span></span></button>
                <label className="field">File name<input className="input" value={s.baseName} onChange={(e) => s.set({ baseName: e.target.value.replace(/[\\/:*?"<>|]+/g, '_') })} /></label>
              </>
            ) : (
              <label className="field">File name<input className="input" value={outName.replace(/\.pdf$/, '')} disabled /></label>
            )}
          </div>
        )}
        {startErr ? <div className="alert">{startErr}</div> : null}
        <div className="spacer" />
        <div className="side-foot">
          <button type="button" className="btn btn-ghost" onClick={() => s.go(3)}>← Back</button>
          <button type="button" className="btn btn-primary btn-grow" disabled={!canStart} onClick={start}>{primaryLabel}</button>
        </div>
      </aside>
      <section className="stage">
        {!run ? (
          <>
            <div className="stage-bar end" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="btn btn-ghost btn-top" onClick={() => s.go(3)}>
                ← Back to recipients
              </button>
              <button type="button" className="btn btn-primary btn-top" disabled={!canStart} onClick={start}>
                {primaryLabel}
              </button>
            </div>
            {multi ? <PreviewNav /> : null}
            {isEmail ? (
              <div className="mail">
                <div className="mail-head">
                  <span>From</span><span>{mailFrom}</span>
                  <span>To</span><span>{(R.prev && R.ecol && R.prev[R.ecol]) || '(no email)'}</span>
                  <span>Subject</span><span style={{ fontWeight: 600 }}>{fill(s.subject)}</span>
                </div>
                <div className="mail-body">{fill(s.body)}</div>
                <span className="attach"><b>PDF</b>{certificateFileName(R.single ? R.prevVals.recipient_name : R.prev ? R.nameOf(R.prev, R.idx) : FIELD_PRESETS.recipient_name.sample)}</span>
              </div>
            ) : null}
            <CertView design={R.design} values={R.prevVals} className={`cert-frame ${isEmail ? 'w640' : 'w700'}`} />
            {!isEmail ? (
              <div className="card out-file">
                <span className="file-ext blue">{zip ? 'ZIP' : 'PDF'}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 15, wordBreak: 'break-all' }}>{outName}</span>
                  <span className="text-sm">{!multi ? 'One print-ready PDF' : zip ? `${R.rows.length} PDFs, named like ${certificateFileName(R.prev ? R.nameOf(R.prev, R.idx) : 'Aarav Sharma')}` : `One ${R.rows.length}-page PDF, ready to print`}</span>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="run">
            <div className="run-top">
              <div className="run-title"><h3>{runTitle}</h3><span>{run.done} of {run.total}</span></div>
              <div className={`progress${run.finished && !run.err && !run.cancelled ? ' ok' : ''}`} style={{ height: 8 }}><div style={{ width: `${run.total ? (run.done / run.total) * 100 : 0}%` }} /></div>
              {run.err ? <div className="alert">{run.err}</div> : null}
              {working ? <button type="button" className="btn btn-ghost btn-xs" style={{ alignSelf: 'flex-start' }} onClick={cancel}>Stop</button> : null}
              {run.finished ? (
                <>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
                    <span style={{ color: 'var(--ok)', fontWeight: 500 }}>{okN} {run.kind === 'email' ? (run.testOnly ? 'sent to the test inbox' : 'delivered') : okN === 1 ? 'certificate created' : 'certificates created'}</span>
                    {failN > 0 ? <span style={{ color: 'var(--bad)', fontWeight: 500 }}>{failN} failed</span> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {run.kind === 'download' && run.fileName && !run.err && !run.cancelled ? <a className="btn btn-primary" style={{ height: 44, fontSize: 14 }} href={`/api/jobs/${run.jobId}/file`} download>Download {run.fileName}</a> : null}
                    {run.kind === 'email' ? <a className="btn btn-ghost" style={{ height: 44 }} href={`/api/jobs/${run.jobId}/report.csv`} download>Download delivery report</a> : null}
                    <button type="button" className="btn btn-ghost" style={{ height: 44 }} onClick={() => s.set({ run: null })}>Back to settings</button>
                    <button type="button" className="link-btn plain" style={{ fontSize: 14, padding: '0 16px' }} onClick={() => s.set({ run: null, rows: [], headers: [], dataName: '', map: {}, emailCol: '', single: {}, singleEmail: '', step: 3 })}>Start a new batch</button>
                  </div>
                  {run.kind === 'email' && run.testOnly ? <span className="hint">Test mode: no mail server is set up, so these went to a test inbox. Open a “Preview” link to see one. Add SMTP settings to .env to send for real.</span> : null}
                </>
              ) : null}
            </div>
            <div className="run-list">
              {run.results.map((r, i) => (
                <motion.div
                  key={r.i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.25) }}
                  className="run-item"
                >
                  <b>{r.name}</b>
                  <span title={r.detail}>{r.previewUrl ? <a href={r.previewUrl} target="_blank" rel="noreferrer">Preview · {r.detail}</a> : r.detail}</span>
                  <span className={`pill${r.ok ? '' : ' bad'}`}>{run.kind === 'email' ? (r.ok ? 'Sent' : 'Failed') : r.ok ? 'Done' : 'Failed'}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
