# SIESCOMS Certificate Studio API

Express + TypeScript. Started from the backend of
[anirudhsuresh21/bulk-certificate-generator](https://github.com/anirudhsuresh21/bulk-certificate-generator).
The upload checks, page measuring, name detection, spreadsheet reading and email sending come from there, reworked.

What changed from the original:

- **PDFs.** pdf-lib text drawing is replaced by headless Chromium printing the shared `<Certificate/>` component (`src/render/`). Uploaded PDFs are kept as vectors, and the overlay is stamped on top.
- **Batches.** Bulk download and email run as jobs (`src/jobs/`). The web app polls their progress, and they can be stopped.
- **Email.**
  - One pooled connection per batch.
  - Normal TLS checks (the old `rejectUnauthorized: false` and SSLv3 ciphers are gone).
  - Values are escaped in the HTML body, and subjects can't carry line breaks.
- **Security and bugs.**
  - Password sign-in.
  - SheetJS 0.20 from the official CDN instead of the vulnerable npm `xlsx@0.18`.
  - Fixed download names (the old `split('_')` bug).
  - Duplicate names in a ZIP get `_2`, `_3`.
  - Non-English names stay readable in file names.
  - Generated files are cleaned up after a day.
- **Storage.** Designs are saved as JSON files instead of MongoDB, which suits a single machine with no setup.
