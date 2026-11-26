'use client';
import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { brand } from '@/lib/brand';

// Ad slot. Renders only for ad-eligible plans (server decides via GET /v1/ads).
// Lazy-loads below the fold, reserves height (CLS 0), labels every slot,
// falls back to a house ad when an ad blocker is detected. Never a hard wall.
export function AdFrame({ slot, className = '', minHeight = 90 }: { slot: string; className?: string; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [adHtml, setAdHtml] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Ad-block detection: bait element + failed script probe.
    const bait = document.createElement('div');
    bait.className = 'adsbox ad-banner';
    bait.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(bait);
    const isBlocked = bait.offsetHeight === 0 || getComputedStyle(bait).display === 'none';
    bait.remove();
    setBlocked(isBlocked);
    let cancelled = false;
    fetch(`/api/v1/ads?slots=${encodeURIComponent(slot)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) { setEligible(false); return; }
        const slots = data.ads || data.slots || data;
        const payload = Array.isArray(slots) ? slots.find((s: any) => s.key === slot || s.placement === slot) : slots?.[slot];
        if (!payload || payload.enabled === false) { setEligible(false); return; }
        setEligible(true);
        if (payload.code) setAdHtml(payload.code);
      })
      .catch(() => { if (!cancelled) setEligible(false); });
    return () => { cancelled = true; };
  }, [visible, slot]);

  useEffect(() => {
    if (!visible || !eligible || blocked) return;
    // Impression logged on viewport impression, deduplicated per slot per page view.
    const key = `qic-imp-${slot}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const payload = JSON.stringify({ events: [{ slot, page: location.pathname }] });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/v1/ads/impressions', new Blob([payload], { type: 'application/json' }));
  }, [visible, eligible, blocked, slot]);

  // Consent-gated: if the site config requires consent and it was not given,
  // only non-personalized/house content is shown (handled by eligibility above).
  return (
    <div ref={ref} className={`my-6 ${className}`} aria-label="Advertisement" style={{ minHeight }}>
      <p className="mb-1 text-center text-[11px] text-muted">Advertisement</p>
      <div className="mx-auto flex max-w-[728px] items-center justify-center rounded-card border border-line bg-soft" style={{ minHeight: minHeight - 18 }}>
        {!visible && <span className="text-xs text-muted">Loading ad…</span>}
        {visible && eligible === false && (
          <a href="/pricing" className="px-4 py-3 text-center text-sm font-semibold text-primary hover:underline">
            Enjoying {brand.name}? Go ad-free with Pro
          </a>
        )}
        {visible && eligible && blocked && (
          <a href="/pricing" className="px-4 py-3 text-center text-sm font-semibold text-primary hover:underline">
            Enjoying {brand.name}? Go ad-free with Pro
          </a>
        )}
        {visible && eligible && !blocked && adHtml && (
          <div className="w-full overflow-hidden" dangerouslySetInnerHTML={{ __html: adHtml }} />
        )}
        {visible && eligible && !blocked && !adHtml && (
          <span className="px-4 py-3 text-center text-xs text-muted">Advertisement</span>
        )}
      </div>
    </div>
  );
}

// Mobile anchor ad: converter pages only, after results, once per session, dismissible.
export function MobileAnchorAd({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (sessionStorage.getItem('qic-anchor-shown')) setDismissed(true); }, []);
  useEffect(() => { if (show && !dismissed) sessionStorage.setItem('qic-anchor-shown', '1'); }, [show, dismissed]);
  if (!show || dismissed) return null;
  return <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[50px] max-w-[320px] items-center justify-between border border-line bg-surface px-3 shadow-card sm:hidden" aria-label="Advertisement">
    <a href="/pricing" className="text-xs font-semibold text-primary">Go ad-free with Pro</a>
    <button onClick={() => setDismissed(true)} aria-label="Dismiss ad" className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-soft"><X className="h-5 w-5" /></button>
  </div>;
}
