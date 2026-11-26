'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card } from '@/components/ui';
import { Activity, RefreshCw } from 'lucide-react';

// Public endpoints only — every one of these answers without a login
// (verified in the backend code). All requests go through the site's own
// /api rewrite, so the backend URL is never exposed to the browser.
const CHECKS = [
  { key: 'healthz', name: 'API health', path: '/api/healthz', blurb: 'The API answers at all.' },
  { key: 'site', name: 'Plans & site settings', path: '/api/v1/site', blurb: 'Plans, limits and site settings for the pricing page.' },
  { key: 'formats', name: 'Converter catalog', path: '/api/v1/formats', blurb: 'All 238 conversion pairs and their availability.' },
  { key: 'marketing', name: 'Announcements & popups', path: '/api/v1/marketing', blurb: 'Announcement bar and popup content.' },
  { key: 'ads', name: 'Ad slots', path: '/api/v1/ads', blurb: 'Advertisement slots shown to free visitors.' },
] as const;

type CheckStatus = 'checking' | 'waking' | 'online' | 'offline';

interface CheckState {
  status: CheckStatus;
  ms: number | null;
  checkedAt: Date | null;
}

// The free test server can take 50 seconds or more to wake up, so a check
// gets a generous window — and a slow check is "waking up", never "offline".
const CHECK_TIMEOUT_MS = 75_000;
const WAKING_AFTER_MS = 8_000;
const REFRESH_EVERY_MS = 30_000;

const initialState = (): Record<string, CheckState> =>
  Object.fromEntries(CHECKS.map((c) => [c.key, { status: 'checking' as CheckStatus, ms: null, checkedAt: null }]));

const STATUS_BADGE: Record<CheckStatus, { tone: 'soft' | 'success' | 'warn' | 'danger'; label: string }> = {
  checking: { tone: 'soft', label: 'Checking…' },
  waking: { tone: 'warn', label: 'Waking up…' },
  online: { tone: 'success', label: 'Online' },
  offline: { tone: 'danger', label: 'Offline' },
};

export function StatusClient() {
  const [checks, setChecks] = useState<Record<string, CheckState>>(initialState);
  const [refreshing, setRefreshing] = useState(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const runChecks = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    if (mountedRef.current) setRefreshing(true);
    const setOne = (key: string, patch: Partial<CheckState>) =>
      setChecks((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

    await Promise.all(CHECKS.map(async (c) => {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
      const wakingId = setTimeout(() => {
        if (mountedRef.current) setOne(c.key, { status: 'waking' });
      }, WAKING_AFTER_MS);
      try {
        const res = await fetch(c.path, { credentials: 'include', signal: controller.signal });
        if (!mountedRef.current) return;
        if (res.ok) {
          setOne(c.key, { status: 'online', ms: Date.now() - startedAt, checkedAt: new Date() });
        } else {
          setOne(c.key, { status: 'offline', ms: null, checkedAt: new Date() });
        }
      } catch {
        if (mountedRef.current) setOne(c.key, { status: 'offline', ms: null, checkedAt: new Date() });
      } finally {
        clearTimeout(timeoutId);
        clearTimeout(wakingId);
      }
    }));
    runningRef.current = false;
    if (mountedRef.current) setRefreshing(false);
  }, []);

  useEffect(() => {
    runChecks();
    const id = setInterval(runChecks, REFRESH_EVERY_MS);
    return () => clearInterval(id);
  }, [runChecks]);

  const states = CHECKS.map((c) => checks[c.key].status);
  const offlineCount = states.filter((s) => s === 'offline').length;
  const wakingCount = states.filter((s) => s === 'waking' || s === 'checking').length;
  const overall = offlineCount > 0
    ? { tone: 'danger' as const, text: 'Some services are offline' }
    : wakingCount > 0
    ? { tone: 'warn' as const, text: 'Some services are waking up — please wait a moment' }
    : { tone: 'success' as const, text: 'All systems online' };
  const lastChecked = CHECKS.map((c) => checks[c.key].checkedAt).filter(Boolean).sort((a, b) => +b! - +a!)[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-primary"><Activity className="h-5 w-5" /></span>
        <div>
          <h1 className="text-3xl font-extrabold text-ink">API status</h1>
          <p className="mt-1 text-muted">Live status of the services behind the converter.</p>
        </div>
      </div>

      <Card className="mt-6 border-warn/40 bg-amber-50 p-5">
        <p className="font-bold text-ink">Please wait if the server is waking up</p>
        <p className="mt-1 text-sm text-muted">
          This test server runs on a free plan. It sleeps after about 15 minutes without any use, so the
          first request can take 50 seconds or more while it wakes up. Your request is not lost — the
          server is just waking up. Please wait a moment and try again.
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3" role="status">
          <div className="flex items-center gap-3">
            <Badge tone={overall.tone}>{overall.text}</Badge>
            <span className="text-sm text-muted">
              {offlineCount > 0
                ? `${offlineCount} of ${CHECKS.length} services could not be reached.`
                : wakingCount > 0
                ? 'Checking services — slow answers usually mean the free server is waking up.'
                : `All ${CHECKS.length} services answered.`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : 'Checking…'} · refreshes every 30 seconds
            </span>
            <Button variant="secondary" onClick={runChecks} disabled={refreshing}>
              <RefreshCw className="mr-2 h-4 w-4" />{refreshing ? 'Checking…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        {CHECKS.map((c) => {
          const s = checks[c.key];
          const badge = STATUS_BADGE[s.status];
          return (
            <Card key={c.key} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{c.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{c.blurb}</p>
                  <p className="mt-1 font-mono text-xs text-muted">{c.path}</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-sm text-muted">Response time</p>
                    <p className="text-sm font-semibold text-ink">{s.ms == null ? '—' : `${s.ms.toLocaleString()} ms`}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted">Last checked</p>
                    <p className="text-sm font-semibold text-ink">{s.checkedAt ? s.checkedAt.toLocaleTimeString() : '—'}</p>
                  </div>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
              </div>
              {s.status === 'offline' && (
                <p className="mt-3 text-sm text-muted">Could not reach the server right now. Please wait a moment and try again.</p>
              )}
              {s.status === 'waking' && (
                <p className="mt-3 text-sm text-muted">Taking longer than usual — the free server is probably waking up from sleep.</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
