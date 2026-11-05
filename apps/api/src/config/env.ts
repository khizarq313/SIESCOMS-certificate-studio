import path from 'node:path';
import fs from 'node:fs';

const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// Load .env at the project root (or apps/api/.env or current working directory) without a dependency.
for (const file of [
  path.resolve(baseDir, '../../../.env'),
  path.resolve(baseDir, '../../../../.env'),
  path.resolve(baseDir, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env')
]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

export const env = {
  port: Number(process.env.API_PORT || process.env.PORT || 4000),
  isTest: process.env.NODE_ENV === 'test',
  isProd: process.env.NODE_ENV === 'production',
  appPassword: process.env.APP_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  mongoUri: process.env.MONGODB_URI || '',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
  },
};
