import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      APP_PASSWORD: 'test-pass',
      SESSION_SECRET: 'test-secret',
      SMTP_HOST: '',
      SMTP_USER: '',
      UPLOADS_DIR: path.join(os.tmpdir(), `siescoms-test-${process.pid}`),
    },
  },
});
