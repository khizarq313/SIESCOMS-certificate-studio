import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { PDFDocument } from 'pdf-lib';
import { DesignSchema } from '@siescoms/certificate';
import { uploadBackground, uploadImage, uploadSpreadsheet } from '../middleware/uploadMiddleware';
import { FILES_DIR, contentDisposition, detectMagicBytes, mimeFor, safePath } from '../utils/fileStorage';
import { extractDocumentInfo } from '../utils/pdfDimensions';
import { detectName } from '../services/nameDetector';
import { parseSpreadsheet } from '../services/excelParser';
import { systemMailConfigured, verifySmtp } from '../services/emailService';
import { deleteDesign, getDesign, listDesigns, saveDesign } from '../designStore';
import { JobRequestSchema, getJob, jobView, reportCsv, startJob } from '../jobs/jobs';
import { env } from '../config/env';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
/** Passes async errors to the error handler. */
const h = (fn: Handler): Handler => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res: Response, error: string, status = 400) => res.status(status).json({ error });

/** Streams a stored file. If it vanished after the existence check (e.g. swept by the cleanup), answers 404 instead of crashing. */
function streamFile(res: Response, file: string) {
  fs.createReadStream(file)
    .on('error', () => {
      if (res.headersSent) { res.destroy(); return; }
      res.removeHeader('Cache-Control');
      res.removeHeader('Content-Disposition');
      bad(res, 'File not found.', 404);
    })
    .pipe(res);
}

export const api = Router();

// ---------- uploads
api.post('/uploads/background', uploadBackground.single('file'), h(async (req, res) => {
  const f = req.file;
  if (!f) return bad(res, 'No file was received.');
  const type = detectMagicBytes(f.buffer);
  if (!type) return bad(res, "That file doesn't look like a real PDF, PNG or JPG.");
  let info;
  try { info = await extractDocumentInfo(f.buffer, type); } catch {
    return bad(res, type === 'pdf' ? "That PDF couldn't be opened. It may be password-protected or damaged." : "That image couldn't be read.");
  }
  const key = `${crypto.randomUUID()}.${type}`;
  fs.writeFileSync(path.join(FILES_DIR, key), f.buffer);
  const detected = type === 'pdf' ? await detectName(f.buffer, 0) : null;
  res.json({ fileKey: key, fileType: type, fileName: f.originalname, page: info.page, pages: info.pages, detected });
}));

/** Page size and detected name for another page of an uploaded PDF. */
api.get('/uploads/background/:key/page/:index', h(async (req, res) => {
  const key = String(req.params.key);
  const file = safePath(FILES_DIR, key);
  if (!fs.existsSync(file) || !key.endsWith('.pdf')) return bad(res, 'File not found.', 404);
  const bytes = fs.readFileSync(file);
  const index = Math.max(0, Number(req.params.index) || 0);
  const info = await extractDocumentInfo(bytes, 'pdf', index);
  res.json({ page: info.page, pages: info.pages, detected: await detectName(bytes, index) });
}));

api.post('/uploads/image', uploadImage.single('file'), h(async (req, res) => {
  const f = req.file;
  if (!f) return bad(res, 'No file was received.');
  const type = detectMagicBytes(f.buffer);
  if (type !== 'png' && type !== 'jpg') return bad(res, 'Images must be PNG or JPG.');
  const doc = await PDFDocument.create();
  const img = type === 'png' ? await doc.embedPng(f.buffer) : await doc.embedJpg(f.buffer);
  const key = `${crypto.randomUUID()}.${type}`;
  fs.writeFileSync(path.join(FILES_DIR, key), f.buffer);
  res.json({ key, width: img.width, height: img.height });
}));

api.get('/files/:key', (req, res) => {
  const file = safePath(FILES_DIR, String(req.params.key));
  if (!fs.existsSync(file)) return bad(res, 'File not found.', 404);
  res.setHeader('Content-Type', mimeFor(file));
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  streamFile(res, file);
});

// ---------- recipients
api.post('/spreadsheets/parse', uploadSpreadsheet.single('file'), (req, res) => {
  if (!req.file) return bad(res, 'No file was received.');
  const parsed = parseSpreadsheet(req.file.buffer, req.file.originalname);
  res.json({ fileName: req.file.originalname, ...parsed });
});

// ---------- designs (autosave)
api.get('/designs', (_req, res) => { res.json(listDesigns()); });
api.get('/designs/:id', (req, res) => {
  const rec = getDesign(String(req.params.id));
  if (!rec) return bad(res, 'Design not found.', 404);
  res.json(rec);
});
api.post('/designs', (req, res) => {
  const parsed = DesignSchema.safeParse(req.body?.design);
  if (!parsed.success) return bad(res, 'That design has invalid parts.');
  res.json(saveDesign(parsed.data));
});
api.put('/designs/:id', (req, res) => {
  const parsed = DesignSchema.safeParse(req.body?.design);
  if (!parsed.success) return bad(res, 'That design has invalid parts.');
  const id = String(req.params.id);
  if (!/^[\w-]{1,64}$/.test(id)) return bad(res, 'Invalid id.');
  res.json(saveDesign(parsed.data, id));
});
api.delete('/designs/:id', (req, res) => { res.json({ ok: deleteDesign(String(req.params.id)) }); });

// ---------- email
api.get('/email/config', (_req, res) => {
  res.json({ systemConfigured: systemMailConfigured(), systemFrom: env.smtp.from || env.smtp.user || '', testMode: !systemMailConfigured() && !env.isProd });
});
api.post('/email/test', h(async (req, res) => {
  const b = req.body || {};
  if (b.sender === 'smtp') {
    const port = Number(b.smtp?.port);
    if (!b.smtp?.host || !b.smtp?.user || !b.smtp?.pass || !port) return res.json({ ok: false, error: 'Fill in the server, port, email and app password.' });
    return res.json(await verifySmtp({ host: String(b.smtp.host), port, user: String(b.smtp.user), pass: String(b.smtp.pass) }));
  }
  res.json(await verifySmtp(null));
}));

// ---------- jobs
api.post('/jobs', (req, res) => {
  const parsed = JobRequestSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, `The request was incomplete: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`);
  const r = parsed.data;
  if (r.delivery === 'email') {
    if (!r.email) return bad(res, 'Add a subject and message first.');
    if (r.email.sender === 'smtp' && !r.email.smtp) return bad(res, 'Fill in your mail server details first.');
    if (!r.emailColumn) return bad(res, 'Choose which column has the email addresses.');
  }
  for (const it of r.design.items) if (it.kind === 'image' && it.src.startsWith('upload:') && !fs.existsSync(safePath(FILES_DIR, it.src.slice(7)))) return bad(res, `The image for "${it.label}" is missing. Upload it again.`);
  if (r.design.background && !fs.existsSync(safePath(FILES_DIR, r.design.background.fileKey))) return bad(res, 'The uploaded certificate is missing. Upload it again.');
  res.status(202).json({ jobId: startJob(r).id });
});
api.get('/jobs/:id', (req, res) => {
  const job = getJob(String(req.params.id));
  if (!job) return bad(res, 'That batch has expired.', 404);
  res.json(jobView(job, Math.max(0, Number(req.query.since) || 0)));
});
api.post('/jobs/:id/cancel', (req, res) => {
  const job = getJob(String(req.params.id));
  if (!job) return bad(res, 'That batch has expired.', 404);
  job.cancel = true;
  res.json({ ok: true });
});
api.get('/jobs/:id/file', (req, res) => {
  const job = getJob(String(req.params.id));
  if (!job?.file || !fs.existsSync(job.file.path)) return bad(res, 'That file has expired. Make the certificates again.', 404);
  res.setHeader('Content-Type', mimeFor(job.file.path));
  res.setHeader('Content-Disposition', contentDisposition(job.file.name));
  streamFile(res, job.file.path);
});
api.get('/jobs/:id/report.csv', (req, res) => {
  const job = getJob(String(req.params.id));
  if (!job) return bad(res, 'That batch has expired.', 404);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', contentDisposition(job.kind === 'email' ? 'delivery_report.csv' : 'certificates_report.csv'));
  res.send('﻿' + reportCsv(job));
});
