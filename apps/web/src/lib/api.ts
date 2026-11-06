// Thin client for the Express API (proxied by Next at /api or direct via NEXT_PUBLIC_API_URL).
import type { Design, DetectedName } from '@siescoms/certificate';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const PUBLIC_API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

export function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!PUBLIC_API) return path;
  if (PUBLIC_API.endsWith('/api') && path.startsWith('/api/')) {
    return `${PUBLIC_API}${path.slice(4)}`;
  }
  return `${PUBLIC_API}${path.startsWith('/') ? '' : '/'}${path}`;
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('cc_auth_token');
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.setItem('cc_auth_token', token);
    else localStorage.removeItem('cc_auth_token');
  } catch {}
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) {
    setStoredToken(null);
    location.href = '/login';
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    let errorMsg = body.error;
    if (!errorMsg) {
      if (res.status === 401) {
        errorMsg = "That password isn't right.";
      } else if (res.status === 500) {
        errorMsg = 'Server encountered an internal error. Please check server logs.';
      } else if (res.status === 502 || res.status === 503 || res.status === 504) {
        errorMsg = 'API unreachable. The backend service may be starting up or down.';
      } else {
        errorMsg = `Server error (${res.status}).`;
      }
    } else if (errorMsg === 'server_boot_failed') {
      errorMsg = 'Server boot failed. Please check Vercel function runtime logs.';
    }
    throw new ApiError(errorMsg, res.status);
  }
  return body as T;
}

function defaultHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return { ...headers, ...(extra as Record<string, string>) };
}

export const api = {
  get: <T>(url: string) =>
    fetch(resolveApiUrl(url), {
      credentials: 'include',
      headers: defaultHeaders(),
    })
      .catch(() => {
        throw new ApiError('API unreachable. Could not connect to server.', 0);
      })
      .then((r) => handle<T>(r)),

  send: <T>(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) =>
    fetch(resolveApiUrl(url), {
      method,
      credentials: 'include',
      headers: defaultHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
      .catch(() => {
        throw new ApiError('API unreachable. Could not connect to server.', 0);
      })
      .then((r) => handle<T>(r)),
};

/** Upload with progress (fetch can't report upload progress). */
export function uploadFile<T>(url: string, file: File, onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', resolveApiUrl(url));
    xhr.withCredentials = true;
    const token = getStoredToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let body: { error?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status === 401) {
        setStoredToken(null);
        location.href = '/login';
        return;
      }
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
