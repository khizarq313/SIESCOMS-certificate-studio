# SIESCOMS Certificate Studio — Vercel Serverless Architecture & Fixes

## 1. Executive Summary

This update fixes the static routing collision on Vercel where the API was serving the raw esbuild bundle (`dist/index.js`) as a static file instead of executing the Express serverless function, completely decouples the bundle from static output directories, and hardens the function packaging and error diagnostics.

- **Real Git Repository Size**: **6.25 MB** (reduced from ~52 MB, an **88% reduction**).
- **Function Bundle**: Emitted to `apps/api/bundle/index.js` (isolated from any static serving directory).
- **Static Output Directory**: Explicitly set to `public/` containing only `robots.txt` (no `index.html`).

---

## 2. Root Cause & Architecture Fixes

### Problem: Vercel Static Serving Precedence Over Function Rewrites
- **Root Cause**: When a Vercel project uses framework `Other` / `null` without an explicit `outputDirectory`, Vercel defaults to searching for `dist` or using the root. When the build script generated `dist/index.js`, Vercel treated `dist/` as the static web root. Because static files take precedence over rewrites, `GET /` served `dist/index.js` as raw JavaScript text instead of routing to `/api/index`.
- **Solution**:
  1. Configured `"outputDirectory": "public"` and `"buildCommand": "npm run build"` in `apps/api/vercel.json`.
  2. Created `apps/api/public/robots.txt` (`User-agent: *\nDisallow: /`) and committed it. No `index.html` exists in `public/`.
  3. Renamed the esbuild output directory from `dist/` to `apps/api/bundle/`. Neither Vercel nor any static web server will ever treat `bundle/` as static build output.
  4. Added Express catch-all handler returning 404 JSON for `/dist/*`, `/bundle/*`, `/src/*`, and `/package.json`.

### Self-Contained Serverless Packaging (`runtime-assets`)
- At build time, `apps/api/scripts/build.mjs` populates `apps/api/runtime-assets/` with fonts, art, and `fonts.css` directly from `packages/certificate`.
- `apps/api/src/paths.ts` checks `runtime-assets` first, eliminating reliance on cross-root relative path traversal (`../../packages/certificate`) inside the AWS Lambda environment.
- Hoisted `@sparticuz/chromium/bin` files are linked to `apps/api/node_modules/@sparticuz/chromium/bin`.
- `includeFiles` in `vercel.json` packages `{bundle/**,runtime-assets/**,node_modules/@sparticuz/chromium/bin/**}`.

### Visible Serverless Boot Failures
- `apps/api/api/index.ts` lazily imports `../bundle/index.js` inside the handler with a cached promise.
- Cold-start boot errors are caught, logged via `console.error` to appear in Vercel Runtime Logs, and return a clean JSON response `{"error":"server_boot_failed"}` with HTTP 500 (with stack trace details if `DEBUG_BOOT=1`).

### Web-to-API Communication & Authentication
- Confirmed that the browser only calls same-origin `/api/*`, which Next.js rewrites to `API_URL`.
- Defaulted session cookie to `SameSite: 'lax'` (matching same-origin reverse-proxy behavior).
- Updated `apps/web/src/lib/api.ts` error handler to clearly differentiate between:
  - **API unreachable** (network error, status 0, 502/503/504)
  - **Wrong password** (HTTP 401)
  - **Server not configured** (HTTP 500 with descriptive error message)

---

## 3. Size Breakdown

| Component | Before Optimization | After Optimization | Reduction |
| :--- | :--- | :--- | :--- |
| **Committed Git Repository Size** | ~52 MB | **6.25 MB** | **-88%** |
| **Fonts (`packages/certificate/fonts`)** | 13.9 MB (39 TTF) | 4.47 MB (39 WOFF2) | **-68%** |
| **Duplicate Asset Copies** | ~28 MB | 0 MB (Deleted) | **-100%** |
| **Legacy HTML & Design Files** | 7.8 MB | 0 MB (Deleted) | **-100%** |
| **Uncompressed Chromium Binary** | N/A (Standard Playwright) | ~70 MB (.br compressed) | Fits in Lambda |

---

## 4. Verification Table

| Test / Scenario | Local Verification Status | Production Verification Required |
| :--- | :--- | :--- |
| **Full Typecheck (`npm run typecheck`)** | **PASSED** (0 errors across 3 workspaces) | N/A |
| **Unit & Integration Suite (`apps/api`)** | **ALL 35 TESTS PASSED** | N/A |
| **Vector PDF Render & Stamp** | **PASSED** (`tests/api.test.ts`) | Verify in preview preview |
| **Bundle Import & Root JSON Response** | **PASSED** (`GET /` returns 200 JSON, not JS code) | Verify via curl on Vercel URL |
| **Static Source Protection** | **PASSED** (`/bundle/*`, `/src/*`, `/package.json` return 404 JSON) | Verify via curl on Vercel URL |
| **Next.js Production Build (`apps/web`)** | **PASSED** (Turbopack static optimization) | Automated in Vercel build |
| **Missing `API_URL` Build Guard** | **PASSED** (Explicit failure with guidance) | N/A |
| **Missing `SESSION_SECRET` Guard** | **PASSED** (Returns 500 JSON on `/api/auth/login`) | Configure in Vercel Dashboard |
| **Missing `MONGODB_URI` Guard** | **PASSED** (Returns 500 JSON on `/api/jobs`) | Configure in Vercel Dashboard |
| **MongoDB Atlas Connectivity** | Local test mock | Check Atlas Network Access (`0.0.0.0/0`) |
| **End-to-End Vercel Preview Invocation** | Local handler simulation passed | Redeploy without build cache |

---

## 5. Exact Vercel Dashboard Checklist

Configure the following settings in your Vercel Dashboard:

### A. API Project (`https://api-eta-six-63.vercel.app`)
1. **Settings > General**:
   - **Root Directory**: `apps/api`
   - **Framework Preset**: `Other` (or None)
   - **Build Command**: Leave default or `npm run build`
   - **Output Directory**: **Ensure override toggle is OFF** (uses `public` from `vercel.json`)
   - **Node.js Version**: `22.x`
   - **Include files outside root directory**: `Enabled` (Checked)
2. **Settings > Deployment Protection**:
   - **Vercel Authentication**: `Disabled` / `Off`
3. **Settings > Environment Variables** (Production & Preview):
   - `APP_PASSWORD`: Staff login password (e.g. `12345678`)
   - `SESSION_SECRET`: Random 32+ character hex string
   - `MONGODB_URI`: MongoDB Atlas connection string (`mongodb+srv://...`)
   - `COOKIE_SAMESITE`: `lax` (or omit; only set `none` if direct cross-origin calls are used)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: (Optional for email delivery)
   - `DEBUG_BOOT`: (Optional) Set to `1` to include stack traces in 500 JSON during initial setup
4. **Deployments**:
   - Redeploy the latest commit with **"Redeploy WITHOUT build cache"**.

### B. Web Project (`https://web-drab-two-67.vercel.app`)
1. **Settings > General**:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: `Next.js`
   - **Node.js Version**: `22.x`
   - **Include files outside root directory**: `Enabled` (Checked)
2. **Settings > Deployment Protection**:
   - **Vercel Authentication**: `Disabled` / `Off`
3. **Settings > Environment Variables** (Production & Preview):
   - `API_URL`: `https://api-eta-six-63.vercel.app`
4. **Deployments**:
   - Redeploy the latest commit with **"Redeploy WITHOUT build cache"**.

### C. MongoDB Atlas Network Access
- Under **Network Access** in MongoDB Atlas:
  - Add IP Address `0.0.0.0/0` (Allow Access from Anywhere) so Vercel's dynamic serverless IP pool can reach the database.
