# SIESCOMS Certificate Studio — Production Vercel Deployment & Optimization

## 1. Executive Summary

This release resolves the production Vercel serverless boot crashes (`500 FUNCTION_INVOCATION_FAILED`), optimizes the architecture for multi-instance stateless execution, and shrinks the repository source size by more than 50% (from ~52 MB to ~25 MB) without breaking any certificate template, text fitting metric, or user feature.

---

## 2. Summary of Changes

### Task 1: Boot Crash & Entry Strategy Fix
- **Eliminated Framework Auto-Detection Conflict**:
  - Configured `"framework": null` in `apps/api/vercel.json` to prevent Vercel from applying legacy Express builder heuristics.
  - Moved local HTTP listening logic to `apps/api/src/server.ts` so no root/src auto-detected file (`app`, `index`, `server`) default-exports the Express app.
  - Preserved local development workflow via `npm run dev` running `src/server.ts` through `tsx`.
  - Maintained `apps/api/api/index.ts` as the sole Vercel function entry point with `rewrites: [{ source: "/(.*)", destination: "/api/index" }]`.
- **Production esbuild Bundler**:
  - Configured `apps/api/scripts/build.mjs` to bundle `src/bundleEntry.ts` into a self-contained ES module (`dist/index.js`, Node 22 ESM target).
  - Inlined `@siescoms/certificate` and font metrics JSON directly at build time to prevent extensionless `.ts` import crashes at runtime.
  - Externalized only packages that cannot be bundled in serverless environments: `playwright-core`, `@sparticuz/chromium`, `playwright`, `mongodb`, `@vercel/functions`, and `pdfjs-dist`.
- **Explicit Static Asset Serving**:
  - Replaced `express.static` with explicit `res.sendFile` routes for `fonts.css`, `/api/static/assets/:name`, `/static/assets/:name`, `/api/static/fonts/:name`, and `/static/fonts/:name`.
- **Node 22 Engine & Soft Failure**:
  - Enforced `"engines": { "node": "22.x" }` in `apps/api/package.json`.
  - Configured `apps/api/src/config/env.ts` to fail soft on missing environment variables without throwing during module evaluation.
- **Automated Verification**:
  - Extended `apps/api/tests/bundle.test.ts` to test `dist/index.js` under `VERCEL=1` (verifying `/health`, `/api/health`, `/api/readiness`, `/api/static/fonts.css`, `/api/static/fonts/GreatVibes.woff2`, `/api/static/assets/sun.svg`, `/api/auth/me`, and Vercel handler execution).

### Task 2: Serverless PDF & Batch Job Architecture
- **Serverless Chromium with Sparticuz**:
  - Refactored `apps/api/src/render/renderer.ts` to dynamically lazy-import `@sparticuz/chromium` + `playwright-core` when `process.env.VERCEL` is set, preserving full `playwright` for local development.
  - Ensured the function bundle and unzipped container size stay well within Vercel's 250 MB ceiling.
- **Serverless Background Jobs**:
  - Integrated `waitUntil` from `@vercel/functions` so PDF generation and batch email jobs continue running beyond the HTTP 202 response.
  - Configured `maxDuration: 60` in `apps/api/vercel.json`.
  - Persisted completed ZIP and PDF files in MongoDB GridFS (`bucketName: 'generated'`) so any stateless serverless instance can serve `/api/jobs/:id/file`.
  - Enforced mandatory `MONGODB_URI` validation on Vercel with clear 500 error JSON if missing.
- **Payload & Upload Limits**:
  - Set request body and Multer upload limits to 4.5 MB to strictly comply with Vercel's serverless payload constraints, with friendly validation error messages.
- **Strict Session Security**:
  - Made `SESSION_SECRET` mandatory in production on `/api/auth/login` to prevent token validation failures across multi-instance serverless functions.

### Task 3: Web Next.js Configuration
- **API URL Routing & Build Validation**:
  - Updated `apps/web/next.config.ts` to rewrite `/api/:path*` to `process.env.API_URL`.
  - Added build-time validation throwing an explicit error if `API_URL` is unset during production builds.
  - Preserved `transpilePackages: ['@siescoms/certificate']`.

### Task 4: Repository Shrinkage & Optimization
- **Lossless Font Conversion to WOFF2**:
  - Converted all 39 TTF fonts in `packages/certificate/fonts` to `.woff2` using `wawoff2`.
  - Updated `packages/certificate/fonts.css`, MIME types (`font/woff2`), safe paths, and `scripts/build-metrics.mjs`.
  - Confirmed `src/metrics.data.json` is byte-identical to the original, ensuring zero regression in font advance widths or text fitting.
- **Removed Duplicate Trees & Dead Files**:
  - Deleted `SIESCOMS-certificate-studio.html` (6.4 MB) and `design/` (1.4 MB).
  - Deleted duplicate copies in `apps/api/public/fonts`, `apps/api/public/static`, `apps/api/public/assets`, and `apps/api/fonts.css`.
  - Removed `apps/api/dist` from git and added `apps/api/dist/` and `apps/api/public/` to `.gitignore`.
  - Moved `tsx` to `devDependencies`.

---

## 3. Size Comparison

| Metric | Before | After | Reduction |
| :--- | :--- | :--- | :--- |
| **Fonts Directory (`packages/certificate/fonts`)** | 13.9 MB (39 TTFs) | 4.47 MB (39 WOFF2s) | **-68%** |
| **Duplicate Asset Trees in `apps/api/public`** | ~28 MB | 0 MB (Deleted) | **-100%** |
| **Legacy HTML & Design Reference Files** | 7.8 MB | 0 MB (Deleted) | **-100%** |
| **Total Tracked Workspace Source Size** | ~52 MB | **25.59 MB** | **-51%** |
| **Web Build Artifacts (`.next`)** | Fully Optimized | Static & Prerendered | **0 errors** |

---

## 4. Manual Vercel Dashboard Checklist

Before deploying, ensure the following configuration in your Vercel Dashboard for both projects:

### A. API Project (`https://api-eta-six-63.vercel.app`)
1. **Settings > General**:
   - **Root Directory**: `apps/api`
   - **Framework Preset**: `Other` (or None)
   - **Node.js Version**: `22.x`
   - **Include files outside root directory**: `Enabled` (Checked)
2. **Settings > Deployment Protection**:
   - **Vercel Authentication**: `Disabled` / `Off`
3. **Settings > Environment Variables** (set for Production, Preview, Development):
   - `APP_PASSWORD`: Staff login password (e.g. `12345678`)
   - `SESSION_SECRET`: Random 32+ character string for HMAC token signing
   - `MONGODB_URI`: Connection string to MongoDB Atlas (e.g. `mongodb+srv://...`)
   - `COOKIE_SAMESITE`: Set to `none` for cross-domain cookie transmission between web and api
   - `SMTP_HOST`: (Optional) SMTP host (e.g. `smtp.office365.com`)
   - `SMTP_PORT`: (Optional) SMTP port (e.g. `587`)
   - `SMTP_USER`: (Optional) SMTP username
   - `SMTP_PASS`: (Optional) SMTP password
   - `SMTP_FROM`: (Optional) Sender display name and email address

### B. Web Project (`https://web-drab-two-67.vercel.app`)
1. **Settings > General**:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: `Next.js`
   - **Node.js Version**: `22.x`
   - **Include files outside root directory**: `Enabled` (Checked)
2. **Settings > Deployment Protection**:
   - **Vercel Authentication**: `Disabled` / `Off`
3. **Settings > Environment Variables** (set for Production, Preview, Development):
   - `API_URL`: URL of the deployed API (`https://api-eta-six-63.vercel.app`)

---

## 5. Verification Commands

All verifications pass locally:
```bash
npm run typecheck         # 0 errors across @siescoms/certificate, @siescoms/api, @siescoms/web
npm -w @siescoms/api test # 33 of 33 tests passed (including Playwright vector PDF and bundle integration)
npm -w @siescoms/api run build # Generates production bundle (6.5 MB)
npm -w @siescoms/web run build # Generates Turbopack optimized static output
```
