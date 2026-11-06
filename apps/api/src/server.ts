import { env } from './config/env';
import { createApp } from './app';
import { renderer } from './render/renderer';
import { sweepJobs } from './jobs/jobs';
import { cleanGenerated } from './utils/fileStorage';

if (!env.appPassword) {
  console.warn('⚠  APP_PASSWORD is not set. Nobody will be able to sign in until you add it to .env.');
}

const app = createApp();

const host = process.env.HOST || '0.0.0.0';
const server = app.listen(env.port, host, () => {
  console.log(`SIESCOMS Certificate Studio API on http://${host}:${env.port}`);
});

const sweep = () => {
  sweepJobs();
  cleanGenerated();
};
sweep();
setInterval(sweep, 3600_000).unref();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    server.close();
    await renderer.close();
    process.exit(0);
  });
}

