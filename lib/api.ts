// Client-side API helper. Browser calls go same-origin to /api/*
// (rewritten to the backend); auth cookies are HttpOnly and never read in JS.
export interface ApiError { code: string; message: string; hint?: string }

export async function getCsrf(): Promise<string> {
  const res = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
  if (!res.ok) return '';
  const data = await res.json();
  return data.csrf_token || '';
}

export async function apiFetch<T>(path: string, init: Omit<RequestInit, 'body'> & { body?: any } = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) };
  let body = init.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF-Token'] = await getCsrf();
  }
  const res = await fetch(`/api${path}`, { ...init, body, headers, credentials: 'include' });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!res.ok) {
    const err = data?.error || {};
    throw Object.assign(new Error(err.message || `Request failed (${res.status})`), {
      code: err.code || 'request_failed', hint: err.hint, status: res.status,
    });
  }
  return data as T;
}

export interface MeResponse {
  user?: { id: string; email: string; display_name: string; email_verified_at?: string | null; plan: string; created_at: string; banned?: boolean; ban_reason?: string | null };
  plan?: any; usage?: { used: number; limit: number; resets_at?: string };
  limits?: any; subscription?: any; unread_notifications?: number; grace_banner?: string | null;
}

export async function fetchMe(): Promise<MeResponse | null> {
  try {
    const res = await fetch('/api/v1/me', { credentials: 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchSite(): Promise<any> {
  try {
    const res = await fetch('/api/v1/site', { credentials: 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function truncateMiddle(name: string, max = 34): string {
  if (name.length <= max) return name;
  const head = Math.ceil((max - 3) / 2), tail = Math.floor((max - 3) / 2);
  return `${name.slice(0, head)}…${name.slice(-tail)}`;
}
