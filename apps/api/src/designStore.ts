// Saved designs, one JSON file each. Simple and durable for a single-machine setup.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DesignSchema, type Design } from '@siescoms/certificate';
import { UPLOADS_ROOT, safePath } from './utils/fileStorage';

const DIR = path.join(UPLOADS_ROOT, 'designs');
try {
  fs.mkdirSync(DIR, { recursive: true });
} catch (err) {
  console.warn(`Could not create designs directory ${DIR}:`, err);
}

export interface StoredDesign { id: string; updatedAt: string; design: Design }

const fileFor = (id: string) => safePath(DIR, `${id}.json`);

export function saveDesign(design: Design, id?: string): StoredDesign {
  const rec: StoredDesign = { id: id || crypto.randomUUID(), updatedAt: new Date().toISOString(), design };
  const file = fileFor(rec.id);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(rec));
  fs.renameSync(`${file}.tmp`, file);
  return rec;
}

export function getDesign(id: string): StoredDesign | null {
  if (!/^[\w-]+$/.test(id)) return null;
  const file = fileFor(id);
  if (!fs.existsSync(file)) return null;
  const rec = JSON.parse(fs.readFileSync(file, 'utf8')) as StoredDesign;
  const parsed = DesignSchema.safeParse(rec.design);
  return parsed.success ? { ...rec, design: parsed.data } : null;
}

export function listDesigns() {
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
    .map((f) => { try { const r = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as StoredDesign; return { id: r.id, name: r.design.name, templateId: r.design.templateId, updatedAt: r.updatedAt }; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => (a!.updatedAt < b!.updatedAt ? 1 : -1));
}

export function deleteDesign(id: string): boolean {
  if (!/^[\w-]+$/.test(id)) return false;
  const file = fileFor(id);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file);
  return true;
}
