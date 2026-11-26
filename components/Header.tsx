'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { brand } from '@/lib/brand';
import { apiFetch, fetchMe, fetchNotifications, ME_REFRESH_EVENT, type MeResponse } from '@/lib/api';
import { Badge, Container, Drawer, Button } from './ui';
import { Bell, X } from 'lucide-react';

export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    const m = await fetchMe();
    setMe(m);
    setLoaded(true);
  }, []);
  useEffect(() => {
    let live = true;
    fetchMe().then((m) => { if (live) { setMe(m); setLoaded(true); } });
    // The session is known once — but usage changes when the user
    // converts (possibly in another tab), and the header must not keep
    // showing the old numbers. Re-fetch when the window regains focus
    // and whenever a conversion tells us the session data changed.
    const onRefresh = () => { void refresh(); };
    window.addEventListener(ME_REFRESH_EVENT, onRefresh);
    window.addEventListener('focus', onRefresh);
    return () => {
      live = false;
      window.removeEventListener(ME_REFRESH_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, [refresh]);
  return { me, loaded, refresh };
}

export function Header({ me, loaded, onSignOut }: { me: MeResponse | null; loaded: boolean; onSignOut?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(false);
  const [unread, setUnread] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const user = me?.user;

  // One fetch gives both the list and the count (GET /v1/notifications
  // returns {notifications, unread} from the same query), so the badge
  // and the drawer can never disagree the way a /v1/me count mixed with
  // a failed list fetch could. A failed fetch leaves the old state
  // alone and is reported as a load error, never as "no notifications".
  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    const res = await fetchNotifications();
    setNotificationsLoading(false);
    if (!res) { setNotificationsError(true); return false; }
    setNotifications(res.list.slice(0, 5));
    setUnread(res.unread);
    setNotificationsLoaded(true);
    setNotificationsError(false);
    return true;
  }, []);

  useEffect(() => {
    if (!user) return;
    setUnread(me?.unread_notifications || 0);
    void loadNotifications();
  }, [user, me?.unread_notifications, loadNotifications]);

  useEffect(() => { if (!user) setSigningOut(false); }, [user]);

  const openBell = () => {
    setBellOpen(true);
    // Re-fetch at the moment the user looks: a mount-time fetch that
    // failed while the backend was asleep must not leave the drawer
    // empty forever while the badge still shows an unread count.
    void loadNotifications();
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setMenuOpen(false);
    // The free backend sleeps when idle: awaiting the logout call can
    // take up to a minute, during which the first click looked dead.
    // Fire it, but never make the user wait more than 5s — the local
    // sign-out (clearing the header state and leaving the page) happens
    // regardless.
    const logout = apiFetch('/v1/auth/logout', { method: 'POST' }).catch(() => {});
    await Promise.race([logout, new Promise((r) => setTimeout(r, 5000))]);
    onSignOut?.();
    router.push('/');
    router.refresh();
  };

  const markAllRead = async () => {
    try { await apiFetch('/v1/notifications/read-all', { method: 'POST' }); setUnread(0); setNotifications((n) => n.map((x) => ({ ...x, read: true }))); } catch { /* ignore */ }
  };

  return <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
    <Container className="flex h-16 items-center gap-4">
      <Link href="/" className="flex shrink-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
        <img src={brand.logo} alt={`${brand.name} logo`} className="h-8 w-auto shrink-0" />
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
        {!loaded ? (
          // The session is not known yet (fresh tab, backend waking).
          // Show a neutral placeholder, never "Log in / Sign up" for a
          // user who is actually signed in.
          <span className="hidden h-10 w-36 animate-pulse rounded-card bg-soft sm:block" aria-hidden="true" />
        ) : !user ? (
          <>
            <Link href="/login" className="rounded-card px-3 py-2 text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Log in</Link>
            <Link href="/login?mode=register" className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Sign up</Link>
          </>
        ) : (
          <>
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-haspopup="menu"
                aria-label={unread > 0 ? `Account menu, ${unread} unread notification${unread === 1 ? '' : 's'}` : 'Account menu'}
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                {(user.display_name || user.email || '?')[0].toUpperCase()}
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow" aria-hidden>
                    <Bell className="h-3 w-3 animate-bell-ring" aria-hidden />
                    {unread}
                  </span>
                )}
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
                  {/* Notifications live here now, not as a separate header
                      bell: opening this item shows the same drawer. */}
                  <button role="menuitem" onClick={() => { setMenuOpen(false); openBell(); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                    <Bell className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    Notifications
                    {unread > 0 && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{unread}</span>}
                  </button>
                  <button role="menuitem" onClick={signOut} disabled={signingOut} className="block w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-soft disabled:opacity-50">{signingOut ? 'Signing out…' : 'Sign out'}</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Container>
    <Drawer open={bellOpen} onClose={() => setBellOpen(false)} title="Notifications">
      {notificationsLoading && notifications.length === 0 ? (
        <p className="text-sm text-muted">Loading notifications…</p>
      ) : notificationsError && notifications.length === 0 ? (
        <div>
          <p className="text-sm text-muted">Could not load your notifications — check your connection and try again.</p>
          <Button variant="secondary" className="mt-3" onClick={() => void loadNotifications()}>Retry</Button>
        </div>
      ) : notifications.length === 0 ? (
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
