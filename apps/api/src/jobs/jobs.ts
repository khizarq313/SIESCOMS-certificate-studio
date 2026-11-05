// Batch jobs: make every certificate (download) or make and email each one.
// The browser starts a job, then polls for progress.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive, type Archiver } from 'archiver';
import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { DesignSchema, certificateFileName, emailOk, placeholderValues, rowValues, safeFileStem, type Design } from '@siescoms/certificate';
import { renderer } from '../render/renderer';
import { buildMessage, createMailer, friendlyMailError, type Mailer } from '../services/emailService';
import { FILES_DIR, GENERATED_DIR, safePath } from '../utils/fileStorage';
import { MAX_ROWS } from '../services/excelParser';

const cell = z.string().max(2000);
export const JobRequestSchema = z.object({
  design: DesignSchema,
  rows: z.array(z.record(z.string().max(200), cell)).min(1).max(MAX_ROWS),
  map: z.record(z.string().max(80), z.string().max(200)),
  emailColumn: z.string().max(200).default(''),
  delivery: z.enum(['download', 'email']),
  format: z.enum(['zip', 'pdf']).default('zip'),
  baseName: z.string().max(120).default('certificates'),
  email: z.object({
    subject: z.string().max(500),
    body: z.string().max(20_000),
    sender: z.enum(['system', 'smtp']),
    smtp: z.object({ host: z.string().min(1).max(255), port: z.coerce.number().int().min(1).max(65535), user: z.string().min(1).max(255), pass: z.string().max(500) }).optional(),
  }).optional(),
});
export type JobRequest = z.infer<typeof JobRequestSchema>;

export interface JobResult { i: number; name: string; detail: string; ok: boolean; previewUrl?: string }
export interface Job {
  id: string;
  kind: 'download' | 'email';
  total: number;
  done: number;
  status: 'running' | 'done' | 'failed' | 'cancelled';
  error: string;
  results: JobResult[];
  testOnly: boolean;
  file?: { path: string; name: string };
  createdAt: number;
  cancel: boolean;
}

const jobs = new Map<string, Job>();
const CONCURRENCY = Math.max(1, Number(process.env.RENDER_PAGES || 3));

export const getJob = (id: string) => jobs.get(id);

/** Public view of a job; `since` skips results the browser already has. */
export function jobView(job: Job, since = 0) {
  const { cancel: _c, file, ...rest } = job;
  return { ...rest, results: job.results.slice(since), fileName: file?.name ?? null };
}

const nameOf = (vals: Record<string, string>, i: number) => (vals.recipient_name || '').trim() || `Row ${i + 1}`;

/** Runs `fn` over 0..n-1 with limited concurrency, stopping early when the job is cancelled. */
async function eachLimited(job: Job, n: number, fn: (i: number) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (!job.cancel) {
      const i = next++;
      if (i >= n) return;
      await fn(i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, n) }, worker));
}

function backgroundBytes(design: Design): Buffer | undefined {
  return design.background?.fileType === 'pdf' ? fs.readFileSync(safePath(FILES_DIR, design.background.fileKey)) : undefined;
}

function uniqueNames() {
  const used = new Map<string, number>();
  return (name: string) => {
    const key = name.toLowerCase();
    const n = (used.get(key) || 0) + 1;
    used.set(key, n);
    return n === 1 ? name : name.replace(/\.pdf$/i, `_${n}.pdf`);
  };
}

async function runDownload(job: Job, req: JobRequest) {
  const { design, rows, map } = req;
  const bg = backgroundBytes(design);
  const single = rows.length === 1;
  const stem = safeFileStem(req.baseName, 'certificates');
  const zip = !single && req.format === 'zip';
  const outName = single ? certificateFileName(nameOf(rowValues(design, rows[0], map), 0)) : `${stem}.${zip ? 'zip' : 'pdf'}`;
  const outPath = path.join(GENERATED_DIR, `${job.id}${zip ? '.zip' : '.pdf'}`);

  const pages: (Buffer | null)[] = new Array(rows.length).fill(null);
  const unique = uniqueNames();
  let archive: Archiver | null = null;
  let finished: Promise<void> | null = null;
  if (zip) {
    archive = new ZipArchive({ zlib: { level: 6 } });
    const out = fs.createWriteStream(outPath);
    finished = new Promise((res, rej) => { out.on('close', () => res()); archive!.on('error', rej); out.on('error', rej); });
    // Awaited after the batch; until then a write error must not count as an unhandled rejection.
    finished.catch(() => {});
    archive.pipe(out);
  }

  await eachLimited(job, rows.length, async (i) => {
    const vals = rowValues(design, rows[i], map);
    const name = nameOf(vals, i);
    try {
      const pdf = await renderer.renderPdf(design, vals, { backgroundBytes: bg });
      if (archive) {
        const file = unique(certificateFileName(name));
        archive.append(pdf, { name: file });
        job.results.push({ i, name, detail: file, ok: true });
      } else {
        pages[i] = pdf;
        job.results.push({ i, name, detail: single ? outName : `Page ${i + 1}`, ok: true });
      }
    } catch (err) {
      job.results.push({ i, name, detail: (err as Error).message, ok: false });
    }
    job.done++;
  });

  if (job.cancel) { archive?.abort(); fs.rmSync(outPath, { force: true }); return; }
  if (archive) {
    await archive.finalize();
    await finished;
  } else if (single) {
    if (!pages[0]) throw new Error(job.results[0]?.detail || 'The certificate could not be made.');
    fs.writeFileSync(outPath, pages[0]);
  } else {
    const doc = await PDFDocument.create();
    for (const p of pages) {
      if (!p) continue;
      const src = await PDFDocument.load(p);
      const [copied] = await doc.copyPages(src, [0]);
      doc.addPage(copied);
    }
    fs.writeFileSync(outPath, await doc.save());
  }
  job.file = { path: outPath, name: outName };
}

async function runEmail(job: Job, req: JobRequest) {
  const { design, rows, map, emailColumn } = req;
  const opts = req.email!;
  let mailer: Mailer | null = null;
  try {
    mailer = await createMailer(opts.sender === 'smtp' ? opts.smtp : null);
    job.testOnly = mailer.testOnly;
    const bg = backgroundBytes(design);
    await eachLimited(job, rows.length, async (i) => {
      const row = rows[i];
      const vals = rowValues(design, row, map);
      const name = nameOf(vals, i);
      const to = (row[emailColumn] || '').trim();
      if (!to || !emailOk(to)) {
        job.results.push({ i, name, detail: to ? `${to} · invalid address` : 'No email address', ok: false });
        job.done++;
        return;
      }
      try {
        const pdf = await renderer.renderPdf(design, vals, { backgroundBytes: bg });
        const msg = buildMessage(opts.subject, opts.body, placeholderValues(row, vals));
        const info = await mailer!.transporter.sendMail({
          from: mailer!.from, to, subject: msg.subject, text: msg.text, html: msg.html,
          attachments: [{ filename: certificateFileName(name), content: pdf, contentType: 'application/pdf' }],
        });
        const preview = nodemailer.getTestMessageUrl(info as never);
        job.results.push({ i, name, detail: to, ok: true, previewUrl: preview || undefined });
      } catch (err) {
        job.results.push({ i, name, detail: `${to} · ${friendlyMailError(err)}`, ok: false });
      }
      job.done++;
    });
  } finally {
    mailer?.close();
  }
}

export function startJob(req: JobRequest): Job {
  const job: Job = {
    id: crypto.randomUUID(), kind: req.delivery, total: req.rows.length, done: 0, status: 'running', error: '',
    results: [], testOnly: false, createdAt: Date.now(), cancel: false,
  };
  jobs.set(job.id, job);
  const run = req.delivery === 'email' ? runEmail(job, req) : runDownload(job, req);
  run.then(
    () => { job.status = job.cancel ? 'cancelled' : 'done'; },
    (err) => { job.status = 'failed'; job.error = friendlyError(err); console.error('Job failed:', err); },
  );
  return job;
}

function friendlyError(err: unknown): string {
  const msg = (err as Error)?.message || '';
  if (/Executable doesn't exist|browserType\.launch/i.test(msg)) return 'The PDF engine is not installed on the server. Run "npm run setup:browser" in apps/api.';
  if (/college mail account/i.test(msg)) return msg;
  return msg || 'Something went wrong while making the certificates.';
}

export function reportCsv(job: Job): string {
  const q = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [...job.results].sort((a, b) => a.i - b.i).map((r) => [String(r.i + 1), r.name, r.detail, r.ok ? (job.kind === 'email' ? 'Sent' : 'Done') : 'Failed'].map(q).join(','));
  return ['Row,Name,Detail,Status', ...lines].join('\n');
}

/** Forget jobs and delete their files after a day. */
export function sweepJobs(maxAgeMs = 24 * 3600_000) {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt < maxAgeMs || job.status === 'running') continue;
    if (job.file) fs.rmSync(job.file.path, { force: true });
    jobs.delete(id);
  }
}
