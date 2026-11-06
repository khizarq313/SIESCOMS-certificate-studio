import path from 'node:path';
import fs from 'node:fs';

const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// Load .env in local development (not on Vercel serverless where env vars come from the platform)
if (!process.env.VERCEL) {
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
}

export const env = {
  get port() { return Number(process.env.API_PORT || process.env.PORT || 4000); },
  get isTest() { return process.env.NODE_ENV === 'test'; },
  get isProd() { return process.env.NODE_ENV === 'production'; },
  get appPassword() { return process.env.APP_PASSWORD || ''; },
  get sessionSecret() { return process.env.SESSION_SECRET || ''; },
  get mongoUri() { return process.env.MONGODB_URI || ''; },
  get smtp() {
    return {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || '',
    };
  },
};
