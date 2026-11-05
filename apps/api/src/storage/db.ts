import { MongoClient, type Db } from 'mongodb';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let connectionAttempted = false;

export async function getDb(): Promise<Db | null> {
  const uri = env.mongoUri || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL;
  if (!uri) return null;

  if (cachedDb) return cachedDb;

  try {
    if (!cachedClient) {
      cachedClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      await cachedClient.connect();
      logger.info('Connected to MongoDB');
    }
    const dbName = uri.split('/').pop()?.split('?')[0] || 'siescoms_certificates';
    cachedDb = cachedClient.db(dbName);
    return cachedDb;
  } catch (err) {
    if (!connectionAttempted) {
      connectionAttempted = true;
      logger.warn('MongoDB connection failed; falling back to local file/memory storage', {
        error: (err as Error)?.message,
      });
    }
    return null;
  }
}

export async function isDbConnected(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

