# SIESCOMS Certificate Studio

A full-stack, enterprise-grade Certificate Template Designer, Batch Generation Engine, and Automated Email Dispatch System designed specifically for **SIES College of Management Studies (SIESCOMS)**. Import existing certificate templates (PDF/PNG/JPG) or choose from 20 built-in institution designs, customize dynamic typography and layout visually with precision coordinate alignment, generate personalized high-resolution vector PDF certificates, and deliver them directly via bulk email using Office 365, Outlook, or Gmail.

---

## 1. System Architecture

The project is structured as a high-performance **npm workspace monorepo**:

- **Frontend (`apps/web`)**: Next.js 15 (App Router, Turbopack) with TypeScript, Framer Motion animations, Zustand state management, PDF.js rendering, and customized design system.
- **Backend (`apps/api`)**: Node.js & Express.js REST API with TypeScript, Multer, `pdf-lib`, `xlsx` (SheetJS), `archiver` (ZIP stream packaging), Playwright chromium vector renderer, and `nodemailer`.
- **Core Package (`packages/certificate`)**: Shared TypeScript models, Zod validation schemas, 20 official template definitions, SVG vector assets (SIES Sun logo, Silver Jubilee badge, campus illustration), text metrics, and coordinate calculation utilities.

```
SIESCOMS-certificate-studio/
├── apps/
│   ├── web/                     # Next.js 15 App Router Frontend
│   │   ├── src/
│   │   │   ├── app/             # App Router pages (/login, studio, globals.css)
│   │   │   ├── components/      # UI Steps, Editor Stage, Canvas, Popovers, Nav
│   │   │   │   ├── start/       # Step 1: Template Gallery & Upload Dropzone
│   │   │   │   ├── design/      # Step 2: Visual Canvas, Field Inspector, Layers
│   │   │   │   ├── recipients/  # Step 3: Direct Entry & Spreadsheet Mapper
│   │   │   │   ├── delivery/    # Step 4: SMTP Config, PDF/ZIP Export & Email
│   │   │   │   └── common/      # CertView, Buttons, Switches, Modals
│   │   │   └── lib/             # API client, Zustand store, recipient parser
│   │   └── next.config.ts       # Reverse proxy to backend & package transpiler
│   └── api/                     # Express.js REST API Backend
│       ├── src/
│       │   ├── jobs/            # PDF generation & background batch pipeline
│       │   ├── routes/          # REST endpoints (auth, designs, uploads, jobs)
│       │   ├── services/        # Email service (TLS, M365/Gmail SMTP, friendly errors)
│       │   ├── designStore.ts   # Autosave persistent design storage
│       │   ├── jobStore.ts      # Live job tracking & polling store
│       │   ├── renderPdf.ts     # Playwright / pdf-lib vector PDF compilation
│       │   └── index.ts         # Express entrypoint & middleware
│       └── uploads/             # Ephemeral upload storage (outside web root)
├── packages/
│   └── certificate/             # Shared Design & Typography Engine
│       └── src/
│           ├── Certificate.tsx  # Universal React vector certificate renderer
│           ├── templates.ts     # 20 official template definitions on clean canvas
│           ├── model.ts         # Zod schemas & TypeScript types for items & page
│           ├── fonts.ts         # Multi-font typography definitions & fontkit
│           ├── metrics.ts       # Font width estimation & auto-shrink math
│           └── assets.ts        # Embedded SIES Sun, 25th badge, campus artwork
├── design/                      # Original design assets & branding references
├── .env.example                 # Environment configuration template
├── package.json                 # Monorepo workspaces & concurrent script runner
└── vercel.json                  # Vercel deployment specification
```

---

## 2. Quickstart & Setup

### Prerequisites
- **Node.js**: `v18+` or `v20+` (Tested on `v22.x`)
- **npm**: `v9+` or `v10+`

### Installation
Clone the repository and install all workspace dependencies from the root directory:
```bash
git clone https://github.com/khizarq313/SIESCOMS-certificate-studio.git
cd SIESCOMS-certificate-studio
npm install
```

### Environment Configuration
Copy `.env.example` to `.env` in the root folder:
```bash
cp .env.example .env
```
Open `.env` and fill in:
- `APP_PASSWORD`: Staff login password (e.g. `sies2026`).
- `SESSION_SECRET`: A long random string to sign auth session cookies. Generate one via:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `SMTP_HOST`: `smtp.office365.com` (port 587) or `smtp.gmail.com` (port 587).
- `SMTP_USER` & `SMTP_PASS`: Your email and 16-character **App Password**.
- `SMTP_FROM`: Must match your sender address to prevent relay rejection (e.g., `"SIES College of Management Studies <your-email@siescoms.edu>"`).

### Run (Development Mode)
Run both the Express backend (Port 4000) and Next.js frontend (Port 3000) concurrently:
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser and log in with your configured `APP_PASSWORD`.

### Typecheck & Build
Verify type integrity across all packages:
```bash
npm run typecheck
```
Build for production:
```bash
npm run build
```

---

## 3. Environment Variables

All settings load from the root **`.env`** file:

| Variable | Default / Example | Purpose |
|---|---|---|
| `API_PORT` | `4000` | Port for the Express backend API |
| `APP_PASSWORD` | `staff2026` | Password required to access the Studio interface |
| `SESSION_SECRET` | `d8a3...` (64 hex characters) | Key used to sign secure authentication cookies |
| `SMTP_HOST` | `smtp.office365.com` | Mail server hostname (M365, Outlook, Gmail) |
| `SMTP_PORT` | `587` | Mail server port (587 with STARTTLS) |
| `SMTP_USER` | `you@siescoms.edu` | Email account username |
| `SMTP_PASS` | `••••••••••••••••` | 16-character Microsoft or Google App Password |
| `SMTP_FROM` | `"SIESCOMS <you@siescoms.edu>"` | Sender name and address for certificate emails |
| `API_URL` | `http://127.0.0.1:4000` | Target URL used by Next.js rewrites in production |

---

## 4. REST API Documentation

### Authentication & Config
- `POST /api/auth/login` — Authenticates staff with `APP_PASSWORD` and sets `HttpOnly` cookie.
- `POST /api/auth/logout` — Clears session cookie.
- `GET /api/auth/me` — Checks active login status.
- `GET /api/email/config` — Retrieves system email configuration and sender status.

### Templates & Uploads
- `POST /api/uploads/background` — Uploads PDF or image certificate background (supports up to 30MB). Extracts dimensions, DPI, page count, and auto-detects legacy sample name positions.
- `GET /api/uploads/background/:fileKey/page/:index` — Fetches metadata for multi-page documents.
- `POST /api/uploads/image` — Uploads transparent signatures or custom logo assets.
- `GET /api/static/assets/:name` — Serves official SVGs and images (sun, campus, badge).

### Autosaved Designs
- `GET /api/designs` — Lists all saved certificates.
- `GET /api/designs/:id` — Loads a saved design by ID.
- `POST /api/designs` — Creates a new autosaved certificate design.
- `PUT /api/designs/:id` — Updates an existing certificate design.
- `DELETE /api/designs/:id` — Permanently removes saved design.

### Spreadsheets & Batch Generation
- `POST /api/spreadsheets/parse` — Uploads an Excel (`.xlsx`, `.xls`) or `.csv` recipient roster, parses headers, detects email and recipient name columns, and extracts rows.
- `POST /api/email/test` — Verifies live SMTP handshake credentials with Microsoft 365 or Gmail.
- `POST /api/jobs` — Enqueues a certificate generation or email dispatch batch.
- `GET /api/jobs/:id` — Polls live progress of the batch job (completed counts, failure diagnostics).
- `POST /api/jobs/:id/cancel` — Cancels a running batch safely.
- `GET /api/jobs/:id/file` — Downloads generated Combined Master PDF or ZIP archive.
- `GET /api/jobs/:id/report.csv` — Downloads complete delivery audit report with per-recipient timestamp and delivery status.

---

## 5. Core Features & Capabilities

### 1. 20 Official SIES Certificate Templates on Unified Clean Canvas
- Every template is engineered on a unified, clean `#FFFFFF` canvas with crisp, contrasting typography and official college framing:
  - **Classic Gold**: Formal gold double frame, Cinzel lettering, MCA Silver Jubilee emblem.
  - **Midnight Navy**: Prestigious navy outer frame with gold inner border and deep navy Cinzel typography.
  - **Saffron Sunrise**: Vibrant saffron and navy header/footer bars with watermark SIES Sun.
  - **Blue Band**: Modern corporate band featuring the official SIES logo lockup.
  - **Art Deco**: Elegant gold corner brackets, diamond ornaments, and formal typography.
  - **Sage Workshop**: Organic sage-green border accents for workshops and certifications.
  - **SIES Heritage, MCA 25, Rose, Bold Stripes, Minimal White, Ivory Merit, Teal Header, Graphite, Lavender, Crimson Scholar**.
  - **Royal Blue Clean**: Formal royal blue dual frame with Allura script, hairline accents, and clean white layout.
  - **Emerald & Gold**: Prestigious emerald frame with gold corner diamonds, Cinzel Decorative title, and Pinyon Script lettering.
  - **Charcoal & Copper**: Modern corporate aesthetic featuring charcoal framing, copper corner brackets, and Cormorant Garamond typography.
  - **Slate & Sky**: Airy layout with slate navy and sky blue accent rules, geometric ornaments, and flowing Italianno script.

### 2. Multi-Person Direct Entry (No Excel Required) & Spreadsheet Upload
- **Direct Entry**: Generate certificates for 1 or multiple people directly inside the app without needing a spreadsheet. Click `+ Add another person` to dynamically add input fields for each recipient.
- **Spreadsheet Upload**: Upload any `.xlsx`, `.xls`, or `.csv` roster. Smart auto-mapping detects `Recipient Name`, `Event Name`, `Issue Date`, and `Email` columns automatically.

### 3. Precision Visual Editor & Canvas
- Signature and logo studio: crop, remove background, recolour ink.
- Drag-and-drop repositioning with 1px arrow-key micro-nudges (10px with Shift).
- Interactive corner handles for resizing text boxes and logos.
- Smart center-alignment snap guides.
- **Background Cover Patches**: Place opaque, color-matched rectangle patches to obscure legacy names, dates, or signatures on uploaded files.
- Full Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`) history with live autosave.
- Responsive popover inspector that automatically docks inside certificate boundaries on all screen widths.

### 4. Enterprise SMTP Email Delivery (M365, Outlook, Gmail)
- Built-in connection presets for **Microsoft 365 / Outlook** (`smtp.office365.com`) and **Gmail** (`smtp.gmail.com`).
- TLS `rejectUnauthorized: false` configuration to smoothly support institutional firewalls and self-signed certificates.
- Detailed diagnostic messaging explaining common authentication causes (App Passwords vs. login passwords, `SendAsDenied` mismatches).
- Real-time connection testing button before launching live campaigns.

### 5. Dual Export Modes
- **Single Combined PDF**: Merges all generated certificates into a single, print-ready multi-page master document.
- **ZIP Archive**: Packages individual, personalized PDFs named automatically after each recipient (e.g. `Certificate_Aarav_Sharma.pdf`).

---

## 6. Vercel Deployment Guide (Deploying API & Web Separately)

You can deploy `apps/api` and `apps/web` as two separate projects in Vercel.

### Step 1: Deploy the Backend API (`apps/api`)
1. In the [Vercel Dashboard](https://vercel.com/), click **Add New Project** and import the repository: `https://github.com/khizarq313/SIESCOMS-certificate-studio.git`.
2. Under **Root Directory**, click **Edit** and choose `apps/api`.
3. In **Environment Variables**, provide the following:
   | Variable | Description | Example / Recommended Value |
   | :--- | :--- | :--- |
   | `APP_PASSWORD` | Master password used by college staff to sign in | `YourSecurePassword123` |
   | `SESSION_SECRET` | 32-byte secret for session signing | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `SMTP_HOST` | Mail server host | `smtp.office365.com` (or `smtp.gmail.com`) |
   | `SMTP_PORT` | Mail server port | `587` |
   | `SMTP_USER` | Mail account username | `certificates@siescoms.edu` |
   | `SMTP_PASS` | Mail account App Password | *Your generated 16-character App Password* |
   | `SMTP_FROM` | Default outgoing sender name & address | `"SIES College of Management Studies <certificates@siescoms.edu>"` |
   | `COOKIE_SAMESITE` | Cookie SameSite policy | `none` (for cross-domain HTTPS) or `lax` |
4. Click **Deploy**. Vercel will run `npm run build` and launch the API serverless endpoints.
5. Note your assigned deployment URL (e.g. `https://siescoms-certificate-studio-api.vercel.app`).

### Step 2: Deploy the Frontend Web App (`apps/web`)
1. In the Vercel Dashboard, click **Add New Project** and import the same repository again.
2. Under **Root Directory**, click **Edit** and choose `apps/web`.
3. Framework Preset will be automatically detected as **Next.js**.
4. In **Environment Variables**, provide:
   | Variable | Description | Example Value |
   | :--- | :--- | :--- |
   | `API_URL` | Deployed API backend URL (for Next.js rewrites proxy) | `https://siescoms-certificate-studio-api.vercel.app` |
   | `NEXT_PUBLIC_API_URL` | Optional fallback direct API URL | `https://siescoms-certificate-studio-api.vercel.app` |
5. Click **Deploy**.

---

## 7. License

Developed for **SIES College of Management Studies (SIESCOMS)**. All rights reserved.
