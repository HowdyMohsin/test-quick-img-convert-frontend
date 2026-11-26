'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { brand } from '@/lib/brand';
import { apiFetch, fetchMe, toArray, type MeResponse } from '@/lib/api';
import { Badge, Drawer, Button } from './ui';
import { Bell, LogOut, X } from 'lucide-react';

export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    fetchMe().then((m) => { if (live) { setMe(m); setLoaded(true); } });
    return () => { live = false; };
  }, []);
  return { me, loaded, refresh: () => fetchMe().then(setMe) };
}

export function Header({ me, onSignOut }: { me: MeResponse | null; onSignOut?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const user = me?.user;

  useEffect(() => {
    if (!user) return;
    setUnread(me?.unread_notifications || 0);
    fetch('/api/v1/notifications', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setNotifications(toArray(Array.isArray(d) ? d : d.notifications).slice(0, 5)); })
      .catch(() => {});
  }, [user, me?.unread_notifications]);

  const signOut = async () => {
    try { await apiFetch('/v1/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    onSignOut?.();
    router.push('/');
    router.refresh();
  };

  const markAllRead = async () => {
    try { await apiFetch('/v1/notifications/read-all', { method: 'POST' }); setUnread(0); setNotifications((n) => n.map((x) => ({ ...x, read: true }))); } catch { /* ignore */ }
  };

  return <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
      <Link href="/" className="flex shrink-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
        <img src={brand.logo} alt={`${brand.name} logo`} className="h-8 w-auto" />
      </Link>
      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
        <Link href="/#formats" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Converters</Link>
        <Link href="/pricing" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Pricing</Link>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {user && me?.usage && (
          <Link href="/account?tab=overview" aria-label={`Usage: ${me.usage.used} of ${me.usage.limit} conversions today`}
            className="hidden rounded-full bg-soft px-3 py-1.5 text-xs font-semibold text-ink hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex">
            {me.usage.used}/{me.usage.limit} today
          </Link>
        )}
        {!user ? (
          <>
            <Link href="/login" className="rounded-card px-3 py-2 text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Log in</Link>
            <Link href="/login?mode=register" className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Sign up</Link>
          </>
        ) : (
          <>
            <button onClick={() => setBellOpen(true)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Bell className="h-5 w-5" aria-hidden />
              {unread > 0 && <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{unread}</span>}
            </button>
            <button onClick={signOut} className="hidden items-center gap-1.5 rounded-card px-3 py-2 text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:inline-flex">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-haspopup="menu" aria-label="Account menu"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                {(user.display_name || user.email || '?')[0].toUpperCase()}
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-56 rounded-card-lg border border-line bg-surface py-1 shadow-card">
                  <div className="border-b border-line px-4 py-2.5">
                    <p className="truncate text-sm font-bold text-ink">{user.display_name || user.email}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  {[
                    { href: '/account?tab=overview', label: 'Account' },
                    { href: '/account?tab=conversions', label: 'Conversions' },
                    { href: '/account?tab=plan', label: 'Plan and billing' },
                  ].map((l) => (
                    <Link key={l.href} role="menuitem" href={l.href} onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">{l.label}</Link>
                  ))}
                  <button role="menuitem" onClick={signOut} className="block w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-soft">Sign out</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    <Drawer open={bellOpen} onClose={() => setBellOpen(false)} title="Notifications">
      {notifications.length === 0 ? (
        <p className="text-sm text-muted">You have no notifications yet.</p>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n: any, i: number) => (
            <li key={n.id || i} className={`rounded-card border p-3 text-sm ${n.read ? 'border-line' : 'border-primary/40 bg-indigo-50/50'}`}>
              <p className="font-semibold text-ink">{n.title}</p>
              {n.body && <p className="mt-0.5 text-muted">{n.body}</p>}
              {n.href && <Link href={n.href} className="mt-1 inline-block font-semibold text-primary" onClick={() => setBellOpen(false)}>View</Link>}
            </li>
          ))}
        </ul>
      )}
      {unread > 0 && <div className="mt-4"><Button variant="secondary" onClick={markAllRead}>Mark all read</Button></div>}
    </Drawer>
  </header>;
}

export function AnnouncementBar({ text }: { text?: string | null }) {
  const [dismissed, setDismissed] = useState(false);
  if (!text || dismissed) return null;
  return <div className="bg-primary px-4 py-2 text-center text-sm font-medium text-white">
    <span>{text}</span>
    <button onClick={() => setDismissed(true)} aria-label="Dismiss announcement" className="ml-3 inline-flex items-center justify-center rounded px-2 py-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="h-4 w-4" /></button>
  </div>;
}
