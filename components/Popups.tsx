'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Modal, Button } from './ui';

// Marketing popups. Config comes from GET /v1/marketing; only one overlay
// at a time; priority limit > batch > success > exit. Never on login,
// account, checkout, or legal pages (enforced by the callers' pages).
export function usePopups() {
  const [config, setConfig] = useState<any>(null);
  useEffect(() => {
    fetch('/api/v1/marketing', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setConfig)
      .catch(() => {});
  }, []);
  return config;
}

export function LimitPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Modal open={open} onClose={onClose} title="You have used today's free conversions">
    <p className="text-sm text-muted">You have reached your daily limit. Upgrade to keep converting — paid plans convert up to 2,000 files a day with no ads.</p>
    <div className="mt-5 flex gap-2">
      <Link href="/pricing" className="inline-flex min-h-[44px] items-center rounded-card bg-primary px-5 text-sm font-semibold text-white" onClick={onClose}>See plans</Link>
      <Button variant="secondary" onClick={onClose}>Not now</Button>
    </div>
  </Modal>;
}

export function ExitPopup() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.innerWidth < 1024) return;
    try { if (localStorage.getItem('qic-exit-7d')) return; } catch { return; }
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !sessionStorage.getItem('qic-exit-session')) {
        sessionStorage.setItem('qic-exit-session', '1');
        try { localStorage.setItem('qic-exit-7d', String(Date.now() + 7 * 24 * 60 * 60 * 1000)); } catch { /* ignore */ }
        setOpen(true);
      }
    };
    document.addEventListener('mouseout', onLeave);
    return () => document.removeEventListener('mouseout', onLeave);
  }, []);
  return <Modal open={open} onClose={() => setOpen(false)} title="Before you go — convert more, free">
    <p className="text-sm text-muted">Create a free account to convert — 25 conversions a day, plus your conversion history.</p>
    <div className="mt-5 flex gap-2">
      <Link href="/login?mode=register" className="inline-flex min-h-[44px] items-center rounded-card bg-primary px-5 text-sm font-semibold text-white" onClick={() => setOpen(false)}>Create a free account</Link>
      <Button variant="secondary" onClick={() => setOpen(false)}>Not now</Button>
    </div>
  </Modal>;
}
