import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import {
  LONG_NAME, designFromTemplate, displaySize, estimateWidth, makeField, makePatch, templateById,
  type Design, type FieldItem,
} from '@siescoms/certificate';
import { createApp } from '../src/app';
import { renderer } from '../src/render/renderer';
import { buildMessage } from '../src/services/emailService';

const app = createApp();
const SAMPLE_PDF = path.join(__dirname, '../sample-assets/sample_certificate.pdf');
let cookie = '';

async function pdfText(bytes: Buffer | Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent();
    text += (c.items as { str?: string }[]).map((i) => i.str || '').join(' ') + '\n';
  }
  await task.destroy();
  return text.replace(/\s+/g, ' ');
}

/** A built-in design with the sample name swapped for a recipient-name field. */
function designWithName(id = 'classic'): Design {
  const d = designFromTemplate(id, false, 'Test');
  const smp = d.items.find((i) => i.kind === 'field' && i.sample) as FieldItem;
  const rec = makeField('recipient_name', smp.x + smp.w / 2 - 210, smp.y - 4, templateById(id)) as FieldItem;
  d.items = d.items.map((i) => (i.id === smp.id ? rec : i));
  d.items.push(makeField('event_name', 231, 334, templateById(id)));
  return d;
}

async function waitForJob(id: string) {
  for (let i = 0; i < 300; i++) {
    const r = await request(app).get(`/api/jobs/${id}`).set('Cookie', cookie);
    if (r.body.status !== 'running') return r.body;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error('job timed out');
}

beforeAll(async () => {
  const r = await request(app).post('/api/auth/login').send({ password: 'test-pass' });
  cookie = String(r.headers['set-cookie']).split(';')[0];
});
afterAll(async () => {
  await renderer.close();
  fs.rmSync(process.env.UPLOADS_DIR!, { recursive: true, force: true });
});

describe('sign-in', () => {
  it('blocks the API without a session', async () => {
    expect((await request(app).get('/api/designs')).status).toBe(401);
  });
  it('rejects a wrong password', async () => {
    expect((await request(app).post('/api/auth/login').send({ password: 'nope' })).status).toBe(401);
  });
  it('lets a signed-in user through', async () => {
    expect((await request(app).get('/api/designs').set('Cookie', cookie)).status).toBe(200);
  });
  it('serves built-in art without signing in', async () => {
    expect((await request(app).get('/api/static/assets/sun.svg')).status).toBe(200);
  });
  it('refuses path tricks', async () => {
    const r = await request(app).get('/api/files/..%2F..%2Fpackage.json').set('Cookie', cookie);
    expect([400, 404]).toContain(r.status);
  });
});

describe('text fitting', () => {
  it('shrinks a long name to fit its box', () => {
    const f = makeField('recipient_name', 0, 0, templateById('classic')) as FieldItem;
    const size = displaySize(f, LONG_NAME);
    expect(size).toBeLessThan(f.style.fontSize);
    expect(estimateWidth(LONG_NAME, f.style.fontFamily, size)).toBeLessThanOrEqual(f.w * 0.96 + 0.5);
    expect(displaySize(f, 'Diya')).toBe(f.style.fontSize);
  });
});

describe('rendering', () => {
  it('prints an A4 landscape vector PDF with the name as real text', async () => {
    const d = designWithName();
    const pdf = await renderer.renderPdf(d, { recipient_name: 'Aarav Sharma', event_name: 'Tech Fest' });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
    const text = await pdfText(pdf);
    expect(text).toContain('Aarav Sharma');
    expect(text).toContain('Tech Fest');
  });

  it('stamps names onto an uploaded PDF and keeps its original text', async () => {
    const up = await request(app).post('/api/uploads/background').set('Cookie', cookie).attach('file', SAMPLE_PDF);
    expect(up.status).toBe(200);
    expect(up.body.fileType).toBe('pdf');
    const original = await pdfText(fs.readFileSync(SAMPLE_PDF));
    const d: Design = {
      name: 'Upload', templateId: 'upload', page: up.body.page, bg: '#FFFFFF', pattern: '', dark: false,
      background: { fileKey: up.body.fileKey, fileType: 'pdf', pageIndex: 0, pages: up.body.pages, fileName: 'sample.pdf' },
      detected: null, items: [makePatch(100, 100, 100, 20, '#FFFFFF'), makeField('recipient_name', 211, 300, templateById('classic'))],
    };
    const out = await renderer.renderPdf(d, { recipient_name: 'Ishita Rao' });
    const text = await pdfText(out);
    expect(text).toContain('Ishita Rao');
    const firstWords = original.trim().split(' ').slice(0, 3).join(' ');
    expect(text).toContain(firstWords);
  });
});

describe('uploads', () => {
  it('rejects a renamed file that is not really a PDF', async () => {
    const r = await request(app).post('/api/uploads/background').set('Cookie', cookie).attach('file', Buffer.from('hello world, not a pdf'), 'fake.pdf');
    expect(r.status).toBe(400);
  });
  it('finds the sample name on a PDF', async () => {
    const r = await request(app).post('/api/uploads/background').set('Cookie', cookie).attach('file', SAMPLE_PDF);
    expect(r.body.detected?.text).toBeTruthy();
  });
});

describe('spreadsheets', () => {
  it('reads Excel files', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['Full Name', 'Email', 'Roll No'], ['Aarav Sharma', 'aarav@example.com', 'MCA-1'], ['', '', ''], ['Diya Menon', 'diya@example.com', 'MCA-2']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'People');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const r = await request(app).post('/api/spreadsheets/parse').set('Cookie', cookie).attach('file', buf, 'people.xlsx');
    expect(r.status).toBe(200);
    expect(r.body.headers).toEqual(['Full Name', 'Email', 'Roll No']);
    expect(r.body.rows).toHaveLength(2);
    expect(r.body.rows[1]['Full Name']).toBe('Diya Menon');
  });
  it('reads CSV with quotes and a BOM', async () => {
    const csv = '﻿Name,Email\n"Iyer, Venkat",v@example.com\nअनन्या राव,a@example.com\n';
    const r = await request(app).post('/api/spreadsheets/parse').set('Cookie', cookie).attach('file', Buffer.from(csv), 'list.csv');
    expect(r.body.headers).toEqual(['Name', 'Email']);
    expect(r.body.rows[0].Name).toBe('Iyer, Venkat');
    expect(r.body.rows[1].Name).toBe('अनन्या राव');
  });
});

describe('batches', () => {
  const rows = [
    { Name: 'Aarav Sharma', Email: 'aarav@example.com' },
    { Name: 'Aarav Sharma', Email: 'aarav2@example.com' },
    { Name: 'अनन्या राव', Email: 'not-an-email' },
  ];
  const map = { recipient_name: 'Name', event_name: '' };

  it('makes a ZIP with unique, readable file names', async () => {
    const r = await request(app).post('/api/jobs').set('Cookie', cookie).send({ design: designWithName(), rows, map, delivery: 'download', format: 'zip', baseName: 'fest' });
    expect(r.status).toBe(202);
    const job = await waitForJob(r.body.jobId);
    expect(job.status).toBe('done');
    expect(job.done).toBe(3);
    const file = await request(app).get(`/api/jobs/${r.body.jobId}/file`).set('Cookie', cookie).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(file.headers['content-disposition']).toContain('fest.zip');
    const zip = file.body as Buffer;
    expect(zip.includes(Buffer.from('Certificate_Aarav_Sharma.pdf'))).toBe(true);
    expect(zip.includes(Buffer.from('Certificate_Aarav_Sharma_2.pdf'))).toBe(true);
    expect(zip.includes(Buffer.from('Certificate_अनन्या_राव.pdf'))).toBe(true);
  });

  it('makes one combined PDF', async () => {
    const r = await request(app).post('/api/jobs').set('Cookie', cookie).send({ design: designWithName('midnight'), rows, map, delivery: 'download', format: 'pdf', baseName: 'all' });
    const job = await waitForJob(r.body.jobId);
    expect(job.status).toBe('done');
    const file = await request(app).get(`/api/jobs/${r.body.jobId}/file`).set('Cookie', cookie).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect((await PDFDocument.load(file.body)).getPageCount()).toBe(3);
  });

  it('emails each person and reports bad addresses', async () => {
    const r = await request(app).post('/api/jobs').set('Cookie', cookie).send({
      design: designWithName(), rows, map, emailColumn: 'Email', delivery: 'email',
      email: { subject: 'Your certificate, {{recipient_name}}', body: 'Dear {{recipient_name}},\nWell done.', sender: 'system' },
    });
    expect(r.status).toBe(202);
    const job = await waitForJob(r.body.jobId);
    expect(job.status).toBe('done');
    expect(job.results.filter((x: { ok: boolean }) => x.ok)).toHaveLength(2);
    expect(job.results.find((x: { ok: boolean }) => !x.ok).detail).toContain('invalid');
    const csv = await request(app).get(`/api/jobs/${r.body.jobId}/report.csv`).set('Cookie', cookie);
    expect(csv.text).toContain('Sent');
  });
});

describe('email content', () => {
  it('escapes values in the HTML body and strips line breaks from the subject', () => {
    const m = buildMessage('Hi {{recipient_name}}', 'Dear {{recipient_name}},\n\nBye', { recipient_name: '<script>x</script>\r\nBcc: a@b.c' });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
});
