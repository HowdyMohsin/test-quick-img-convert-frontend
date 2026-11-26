// Client-side API helper. Browser calls go same-origin to /api/*
// (rewritten to the backend); auth cookies are HttpOnly and never read in JS.
export interface ApiError { code: string; message: string; hint?: string }

// API list shapes are never trusted blindly: an error envelope, a wrapped
// object, or a future backend change must never turn a list into a
// non-array that crashes a .map/.filter during render. Anything that is
// not a real array becomes an empty list (the page then shows its friendly
// empty state instead of crashing).
export function toArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// The user must NEVER see a raw technical error. Every message the UI shows
// comes through friendlyErrorMessage: the backend's friendly message when it
// has one, a mapped line for known error codes, and a generic line
// otherwise. "Request failed (403)" and friends can never leak through.
const GENERIC_MESSAGE = 'Upload nahi ho saka — dobara try karein.';
const RAW_ERROR_PATTERN = /request failed\s*\(\s*\d{3}\s*\)/i;

function isRawTechnicalMessage(msg: string): boolean {
  const t = msg.trim();
  return RAW_ERROR_PATTERN.test(t)
    || /^failed to fetch$/i.test(t)
    || /^networkerror/i.test(t)
    || /^network request failed$/i.test(t)
    || /^load failed$/i.test(t);
}

// Friendly lines for error codes whose backend message is technical jargon
// (e.g. anything mentioning CSRF) or missing. Codes not listed here pass
// the backend's own message through — it is already written for users.
const CODE_MESSAGES: Record<string, string> = {
  unsupported_format: 'This file type is not supported.',
  file_too_large: 'This file is too large for your plan.',
  quota_exceeded: 'You have used all your free conversions for today.',
  csrf_required: 'Something went wrong — please refresh the page and try again.',
  csrf_invalid: 'Something went wrong — please refresh the page and try again.',
  account_banned: 'This account is banned. Contact support for help.',
  feature_locked: 'This feature needs Basic or Pro — see the pricing page to upgrade.',
  signin_required: 'Sign in — it’s free — to convert your files.',
  not_found: 'That file could not be found — please upload it again.',
  rate_limited: 'Too many requests — please wait a moment and try again.',
};

export function friendlyErrorMessage(err: unknown, fallback: string = GENERIC_MESSAGE): string {
  if (!err) return fallback;
  const anyErr = err as any;
  const code = typeof anyErr?.code === 'string' ? anyErr.code : '';
  const raw = typeof anyErr?.message === 'string' ? anyErr.message : '';
  // A failed fetch never reaches the server, so there is no backend
  // message to show.
  if (anyErr instanceof TypeError || code === 'network_error') {
    return 'Could not reach the server — check your connection and try again.';
  }
  if (code === 'request_failed') return fallback;
  if (code && CODE_MESSAGES[code]) {
    // Prefer the backend's own wording when it is already friendly; the
    // CSRF codes are the exception — their message names the mechanism.
    if (raw && !isRawTechnicalMessage(raw) && code !== 'csrf_required' && code !== 'csrf_invalid') return raw;
    return CODE_MESSAGES[code];
  }
  if (raw && !isRawTechnicalMessage(raw)) return raw;
  return fallback;
}

// One in-flight CSRF fetch is shared by every concurrent caller. The
// anonymous CSRF secret is minted by the backend when the browser has no
// qic_csrf_secret cookie yet — two parallel fetches used to mint two
// different secrets, and only the last Set-Cookie won, so a token from the
// losing call could mismatch the stored cookie (403 csrf_invalid on the
// next CSRF-checked mutation). Fetching once per batch removes the race.
let csrfPromise: Promise<string> | null = null;
export async function getCsrf(): Promise<string> {
  if (!csrfPromise) {
    const p = (async () => {
      try {
        const res = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
        if (!res.ok) return '';
        const data = await res.json();
        return data.csrf_token || '';
      } catch { return ''; }
    })();
    csrfPromise = p;
    // Clear after settling so the next batch fetches a fresh token.
    void p.finally(() => { if (csrfPromise === p) csrfPromise = null; });
  }
  return csrfPromise;
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
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, body, headers, credentials: 'include' });
  } catch {
    throw Object.assign(new Error('Could not reach the server — check your connection and try again.'), {
      code: 'network_error', status: 0,
    });
  }
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!res.ok) {
    const err = data?.error || {};
    const message = friendlyErrorMessage({ code: err.code || 'request_failed', message: err.message || '' });
    throw Object.assign(new Error(message), {
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

// The header usage pill and the account page both read the session from
// /v1/me. A conversion changes usage, so the converter tells the header
// to re-fetch instead of the header showing yesterday's numbers.
export const ME_REFRESH_EVENT = 'qic:me-refresh';
export function notifyMeChanged() {
  try { window.dispatchEvent(new Event(ME_REFRESH_EVENT)); } catch { /* ignore */ }
}

// GET /v1/notifications returns {notifications: [...], unread: N}. The
// unread count in /v1/me and this list come from the same table, so they
// can only disagree if one of the two fetches failed or went stale —
// callers must take both values from this one response, never mix a
// count from /v1/me with a list from a failed fetch.
export async function fetchNotifications(): Promise<{ list: any[]; unread: number } | null> {
  try {
    const res = await fetch('/api/v1/notifications', { credentials: 'include' });
    if (!res.ok) return null;
    const d = await res.json();
    const list = toArray(Array.isArray(d) ? d : d.notifications);
    const unread = typeof d?.unread === 'number'
      ? d.unread
      : list.filter((n: any) => n && !n.read).length;
    return { list, unread };
  } catch { return null; }
}

export async function fetchSite(): Promise<any> {
  try {
    const res = await fetch('/api/v1/site', { credentials: 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// GET /v1/features — which converter features this plan may use. The
// backend enforces the same flags (403 feature_locked), so a failed or
// stale fetch must never unlock a paid feature: null means "unknown",
// and callers treat unknown as locked.
export interface PlanFeatures { gps_remover: boolean; compare: boolean; batch_rename: boolean; target_size: boolean }
export async function fetchFeatures(): Promise<PlanFeatures | null> {
  try {
    const res = await fetch('/api/v1/features', { credentials: 'include' });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      gps_remover: !!d?.gps_remover,
      compare: !!d?.compare,
      batch_rename: !!d?.batch_rename,
      target_size: !!d?.target_size,
    };
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
