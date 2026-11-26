'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from './ui';

// Consent bar. CMP configuration comes from GET /v1/site; ads load only
// after consent, otherwise non-personalized ads are served.
export function ConsentBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem('qic-consent')) setShow(true);
    } catch { setShow(true); }
  }, []);
  const choose = (v: string) => {
    try { localStorage.setItem('qic-consent', v); } catch { /* ignore */ }
    document.cookie = `qic_consent=${v}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setShow(false);
  };
  if (!show) return null;
  return <div role="region" aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-4 py-4 shadow-card">
    <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">
        We use cookies for sign-in, remembering your preferences, and showing ads. See our{' '}
        <Link href="/privacy-policy" className="font-semibold text-primary underline">Privacy Policy</Link>.
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" onClick={() => choose('essential')}>Essential only</Button>
        <Button onClick={() => choose('all')}>Accept all</Button>
      </div>
    </div>
  </div>;
}
