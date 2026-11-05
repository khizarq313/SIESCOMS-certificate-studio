// Thin client for the Express API (proxied by Next at /api).
import type { Design, DetectedName } from '@siescoms/certificate';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) {
    location.href = '/login';
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || "Couldn't reach the server. Is the API running?", res.status);
  return body as T;
}

export const api = {
  get: <T>(url: string) => fetch(url, { credentials: 'same-origin' }).then((r) => handle<T>(r)),
  send: <T>(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) =>
    fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => handle<T>(r)),
};

/** Upload with progress (fetch can't report upload progress). */
export function uploadFile<T>(url: string, file: File, onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let body: { error?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status === 401) { location.href = '/login'; return; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else reject(new ApiError(body.error || (xhr.status === 413 ? 'That file is too big.' : 'The upload failed.'), xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Couldn't reach the server. Is the API running?", 0));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

export interface UploadInfo {
  fileKey: string; fileType: 'pdf' | 'png' | 'jpg'; fileName: string;
  page: { w: number; h: number }; pages: number; detected: DetectedName | null;
}
export interface SheetInfo { fileName: string; headers: string[]; rows: Record<string, string>[] }
export interface SavedDesign { id: string; updatedAt: string; design: Design }
export interface JobResult { i: number; name: string; detail: string; ok: boolean; previewUrl?: string }
export interface JobView {
  id: string; kind: 'download' | 'email'; total: number; done: number;
  status: 'running' | 'done' | 'failed' | 'cancelled'; error: string; results: JobResult[]; testOnly: boolean; fileName: string | null;
}
export interface MailConfig { systemConfigured: boolean; systemFrom: string; testMode: boolean }
