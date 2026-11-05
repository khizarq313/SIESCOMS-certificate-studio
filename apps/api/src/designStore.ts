// Saved designs: MongoDB collection 'designs' with local filesystem fallback.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DesignSchema, type Design } from '@siescoms/certificate';
import { UPLOADS_ROOT, safePath } from './utils/fileStorage';
import { getDb } from './storage/db';

const DIR = path.join(UPLOADS_ROOT, 'designs');
try {
  fs.mkdirSync(DIR, { recursive: true });
} catch (err) {
  console.warn(`Could not create designs directory ${DIR}:`, err);
}

export interface StoredDesign {
  id: string;
  updatedAt: string;
  design: Design;
}

const fileFor = (id: string) => safePath(DIR, `${id}.json`);

export async function saveDesign(design: Design, id?: string): Promise<StoredDesign> {
  const rec: StoredDesign = {
    id: id || crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    design,
  };

  const db = await getDb();
  if (db) {
    try {
      await db.collection<StoredDesign>('designs').updateOne(
        { id: rec.id },
        { $set: rec },
        { upsert: true }
      );
      return rec;
    } catch (err) {
      console.warn('Failed to save design to MongoDB, falling back to disk:', err);
    }
  }

  // Local filesystem fallback
  const file = fileFor(rec.id);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(rec));
  fs.renameSync(`${file}.tmp`, file);
  return rec;
}

export async function getDesign(id: string): Promise<StoredDesign | null> {
  if (!/^[\w-]+$/.test(id)) return null;

  const db = await getDb();
  if (db) {
    try {
      const doc = await db.collection<StoredDesign>('designs').findOne({ id }, { projection: { _id: 0 } });
      if (doc) {
        const parsed = DesignSchema.safeParse(doc.design);
        return parsed.success ? { ...doc, design: parsed.data } : null;
      }
    } catch (err) {
      console.warn('Failed to get design from MongoDB, falling back to disk:', err);
    }
  }

  // Local filesystem fallback
  const file = fileFor(id);
  if (!fs.existsSync(file)) return null;
  try {
    const rec = JSON.parse(fs.readFileSync(file, 'utf8')) as StoredDesign;
    const parsed = DesignSchema.safeParse(rec.design);
    return parsed.success ? { ...rec, design: parsed.data } : null;
  } catch {
    return null;
  }
}

export async function listDesigns(): Promise<Array<{ id: string; name: string; templateId: string; updatedAt: string }>> {
  const db = await getDb();
  if (db) {
    try {
      const docs = await db
        .collection<StoredDesign>('designs')
        .find({}, { projection: { _id: 0, id: 1, 'design.name': 1, 'design.templateId': 1, updatedAt: 1 } })
        .sort({ updatedAt: -1 })
        .toArray();
      return docs.map((r) => ({
        id: r.id,
        name: r.design?.name || 'Untitled',
        templateId: r.design?.templateId || 'classic',
        updatedAt: r.updatedAt,
      }));
    } catch (err) {
      console.warn('Failed to list designs from MongoDB, falling back to disk:', err);
    }
  }

  // Local filesystem fallback
  try {
    return fs
      .readdirSync(DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const r = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as StoredDesign;
          return {
            id: r.id,
            name: r.design?.name || 'Untitled',
            templateId: r.design?.templateId || 'classic',
            updatedAt: r.updatedAt,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a!.updatedAt < b!.updatedAt ? 1 : -1)) as Array<{
      id: string;
      name: string;
      templateId: string;
      updatedAt: string;
    }>;
  } catch {
    return [];
  }
}

export async function deleteDesign(id: string): Promise<boolean> {
  if (!/^[\w-]+$/.test(id)) return false;

  let deleted = false;
  const db = await getDb();
  if (db) {
    try {
      const res = await db.collection('designs').deleteOne({ id });
      if (res.deletedCount > 0) deleted = true;
    } catch (err) {
      console.warn('Failed to delete design from MongoDB:', err);
    }
  }

  // Also clean up local file if exists
  const file = fileFor(id);
  if (fs.existsSync(file)) {
    try {
      fs.rmSync(file);
      deleted = true;
    } catch {}
  }
  return deleted;
}
