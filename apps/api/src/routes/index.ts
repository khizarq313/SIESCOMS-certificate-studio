import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { PDFDocument } from 'pdf-lib';
import { GridFSBucket } from 'mongodb';
import { DesignSchema } from '@siescoms/certificate';
import { uploadBackground, uploadImage, uploadSpreadsheet } from '../middleware/uploadMiddleware';
import {
  FILES_DIR,
  contentDisposition,
  detectMagicBytes,
  ensureFileExists,
  mimeFor,
  persistUploadedFile,
  safePath,
} from '../utils/fileStorage';
import { extractDocumentInfo } from '../utils/pdfDimensions';
import { detectName } from '../services/nameDetector';
import { parseSpreadsheet } from '../services/excelParser';
import { systemMailConfigured, verifySmtp } from '../services/emailService';
import { deleteDesign, getDesign, listDesigns, saveDesign } from '../designStore';
import { JobRequestSchema, getJob, jobView, reportCsv, startJob } from '../jobs/jobs';
import { env } from '../config/env';
import { getDb } from '../storage/db';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
/** Passes async errors to the error handler. */
const h = (fn: Handler): Handler => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res: Response, error: string, status = 400) => res.status(status).json({ error });

const requireMongoOnVercel = (res: Response): boolean => {
  if (process.env.VERCEL && !env.mongoUri) {
    res.status(500).json({
      error: 'MONGODB_URI is required in production on Vercel. Please configure MONGODB_URI in Vercel project environment variables.'
    });
    return false;
  }
  return true;
};

/** Streams a stored file. If it vanished after the existence check, answers 404 instead of crashing. */
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
  if (!requireMongoOnVercel(res)) return;
  const f = req.file;
  if (!f) return bad(res, 'No file was received.');
  const type = detectMagicBytes(f.buffer);
  if (!type) return bad(res, "That file doesn't look like a real PDF, PNG or JPG.");
  let info;
  try { info = await extractDocumentInfo(f.buffer, type); } catch {
    return bad(res, type === 'pdf' ? "That PDF couldn't be opened. It may be password-protected or damaged." : "That image couldn't be read.");
  }
  const key = `${crypto.randomUUID()}.${type}`;
  await persistUploadedFile(key, f.buffer);
  const detected = type === 'pdf' ? await detectName(f.buffer, 0) : null;
  res.json({ fileKey: key, fileType: type, fileName: f.originalname, page: info.page, pages: info.pages, detected });
}));

/** Page size and detected name for another page of an uploaded PDF. */
api.get('/uploads/background/:key/page/:index', h(async (req, res) => {
  const key = String(req.params.key);
  if (!key.endsWith('.pdf')) return bad(res, 'File not found.', 404);
  const file = await ensureFileExists(key);
  if (!file || !fs.existsSync(file)) return bad(res, 'File not found.', 404);
  const bytes = fs.readFileSync(file);
  const index = Math.max(0, Number(req.params.index) || 0);
  const info = await extractDocumentInfo(bytes, 'pdf', index);
  res.json({ page: info.page, pages: info.pages, detected: await detectName(bytes, index) });
}));

api.post('/uploads/image', uploadImage.single('file'), h(async (req, res) => {
  if (!requireMongoOnVercel(res)) return;
  const f = req.file;
  if (!f) return bad(res, 'No file was received.');
  const type = detectMagicBytes(f.buffer);
  if (type !== 'png' && type !== 'jpg') return bad(res, 'Images must be PNG or JPG.');
  const key = `${crypto.randomUUID()}.${type}`;
  await persistUploadedFile(key, f.buffer);
  let width: number | undefined;
  let height: number | undefined;
  try {
    const doc = await PDFDocument.create();
    const img = type === 'png' ? await doc.embedPng(f.buffer) : await doc.embedJpg(f.buffer);
    width = img.width;
    height = img.height;
  } catch {}
  res.json({ key, fileKey: key, fileName: f.originalname, width, height });
}));

const handleSpreadsheet = (req: Request, res: Response) => {
  if (!requireMongoOnVercel(res)) return;
  const f = req.file;
  if (!f) return bad(res, 'No file was received.');
  try {
    const parsed = parseSpreadsheet(f.buffer, f.originalname);
    res.json({ fileName: f.originalname, ...parsed });
  } catch (err) {
    bad(res, (err as Error).message || "That spreadsheet couldn't be read.");
  }
};

api.post('/spreadsheets/parse', uploadSpreadsheet.single('file'), handleSpreadsheet);
api.post('/uploads/spreadsheet', uploadSpreadsheet.single('file'), handleSpreadsheet);

api.get('/files/:key', h(async (req, res) => {
  const key = String(req.params.key);
  const file = await ensureFileExists(key);
  if (!file || !fs.existsSync(file)) return bad(res, 'File not found.', 404);
  res.setHeader('Content-Type', mimeFor(file));
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  streamFile(res, file);
}));

// ---------- designs
api.get('/designs', h(async (_req, res) => {
  res.json(await listDesigns());
}));

api.get('/designs/:id', h(async (req, res) => {
  const d = await getDesign(String(req.params.id));
  if (!d) return bad(res, 'Design not found.', 404);
  res.json(d);
}));

api.post('/designs', h(async (req, res) => {
  const raw = req.body?.design ?? req.body;
  const parsed = DesignSchema.safeParse(raw);
  if (!parsed.success) return bad(res, 'That design has invalid parts.');
  res.json(await saveDesign(parsed.data));
}));

api.put('/designs/:id', h(async (req, res) => {
  const raw = req.body?.design ?? req.body;
  const parsed = DesignSchema.safeParse(raw);
  if (!parsed.success) return bad(res, 'That design has invalid parts.');
  const id = String(req.params.id);
  if (!/^[\w-]{1,64}$/.test(id)) return bad(res, 'Invalid id.');
  res.json(await saveDesign(parsed.data, id));
}));

api.delete('/designs/:id', h(async (req, res) => {
  res.json({ ok: await deleteDesign(String(req.params.id)) });
}));

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
api.post('/jobs', h(async (req, res) => {
  if (!requireMongoOnVercel(res)) return;
  const parsed = JobRequestSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, `The request was incomplete: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`);
  const r = parsed.data;
  if (r.delivery === 'email') {
    if (!r.email) return bad(res, 'Add a subject and message first.');
    if (r.email.sender === 'smtp' && !r.email.smtp) return bad(res, 'Fill in your mail server details first.');
    if (!r.emailColumn) return bad(res, 'Choose which column has the email addresses.');
  }
  for (const it of r.design.items) {
    if (it.kind === 'image' && it.src.startsWith('upload:')) {
      const file = await ensureFileExists(it.src.slice(7));
      if (!file || !fs.existsSync(file)) return bad(res, `The image for "${it.label}" is missing. Upload it again.`);
    }
  }
  if (r.design.background) {
    const file = await ensureFileExists(r.design.background.fileKey);
    if (!file || !fs.existsSync(file)) return bad(res, 'The uploaded certificate is missing. Upload it again.');
  }
  res.status(202).json({ jobId: startJob(r).id });
}));

api.get('/jobs/:id', h(async (req, res) => {
  const job = await getJob(String(req.params.id));
  if (!job) return bad(res, 'That batch has expired.', 404);
  res.json(jobView(job, Math.max(0, Number(req.query.since) || 0)));
}));

api.post('/jobs/:id/cancel', h(async (req, res) => {
  const job = await getJob(String(req.params.id));
  if (!job) return bad(res, 'That batch has expired.', 404);
  job.cancel = true;
  res.json({ ok: true });
}));

api.get('/jobs/:id/file', h(async (req, res) => {
  const job = await getJob(String(req.params.id));
  if (!job?.file) return bad(res, 'That file has expired. Make the certificates again.', 404);
  let filePath = job.file.path;
  if (!fs.existsSync(filePath)) {
    const db = await getDb();
    if (db) {
      try {
        const bucket = new GridFSBucket(db, { bucketName: 'generated' });
        const files = await bucket.find({ filename: job.id }).limit(1).toArray();
        if (files.length > 0) {
          const dir = path.dirname(filePath);
          fs.mkdirSync(dir, { recursive: true });
          const downloadStream = bucket.openDownloadStreamByName(job.id);
          const writeStream = fs.createWriteStream(filePath);
          await new Promise<void>((resolve, reject) => {
            downloadStream.pipe(writeStream).on('finish', resolve).on('error', reject);
          });
        }
      } catch (err) {
        console.warn(`GridFS retrieval failed for job ${job.id}:`, err);
      }
    }
  }
  if (!fs.existsSync(filePath)) return bad(res, 'That file has expired. Make the certificates again.', 404);
  res.setHeader('Content-Type', mimeFor(filePath));
  res.setHeader('Content-Disposition', contentDisposition(job.file.name));
  streamFile(res, filePath);
}));

api.get('/jobs/:id/report.csv', h(async (req, res) => {
  const job = await getJob(String(req.params.id));
  if (!job) return bad(res, 'That batch has expired.', 404);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', contentDisposition(job.kind === 'email' ? 'delivery_report.csv' : 'certificates_report.csv'));
  res.send('\uFEFF' + reportCsv(job));
}));
