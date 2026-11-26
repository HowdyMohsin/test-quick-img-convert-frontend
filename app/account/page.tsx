'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, fetchMe, fetchNotifications, formatBytes, toArray, type MeResponse } from '@/lib/api';
import { Badge, Button, Card, Container, Input, Modal, PasswordField, Progress, Select, Switch, Tabs, Toast } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'conversions', label: 'Conversions' },
  { id: 'plan', label: 'Plan and billing' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
  { id: 'settings', label: 'Settings' },
];

function AccountInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') || 'overview';
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationsError, setNotificationsError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [pendingReqs, setPendingReqs] = useState<any[]>([]);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteTyped, setDeleteTyped] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  // TEMPORARY (test-only): while the backend has email verification off
  // (REQUIRE_EMAIL_VERIFICATION=false) every verification surface on
  // this page is hidden — badge, resend button, and the verification
  // step of changing email. Defaults true (verification ON).
  const [requireVerification, setRequireVerification] = useState(true);

  const load = async () => {
    const m = await fetchMe();
    if (!m?.user) { router.replace('/login?next=/account'); return; }
    setMe(m);
    setDisplayName(m.user.display_name || '');
    setLoading(false);
    apiFetch('/v1/site').then((d: any) => { if (typeof d?.require_email_verification === 'boolean') setRequireVerification(d.require_email_verification); }).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);
  useEffect(() => {
    if (!me) return;
    // Every list is normalized to a real array first: if the API ever
    // returns an error envelope or a wrapped object instead of a list,
    // the page shows its friendly empty state — a non-array must never
    // reach a .map/.filter during render and crash the whole page.
    fetch('/api/v1/history?limit=50', { credentials: 'include' }).then((r) => r.ok ? r.json() : null).then((d) => { if (d) setHistory(toArray(Array.isArray(d) ? d : (d.jobs ?? d.history))); }).catch(() => {});
    // One fetch gives both the list and the count, so the tab label and
    // the list can never disagree the way a /v1/me count mixed with a
    // failed list fetch could. A failed fetch is reported as a load
    // error, never as "no notifications".
    fetchNotifications().then((res) => {
      if (!res) { setNotificationsError(true); return; }
      setNotifications(res.list);
      setNotificationsLoaded(true);
      setNotificationsError(false);
    });
    fetch('/api/v1/auth/sessions', { credentials: 'include' }).then((r) => r.ok ? r.json() : null).then((d) => { if (d) setSessions(toArray(d.sessions)); }).catch(() => {});
    fetch('/api/v1/payments/history', { credentials: 'include' }).then((r) => r.ok ? r.json() : null).then((d) => { if (d) { setPayments(toArray(Array.isArray(d) ? d : d.payments)); setPendingReqs(toArray(d.requests).filter((x: any) => x && typeof x === 'object' && x.status === 'pending')); } }).catch(() => {});
  }, [me]);

  // The list is fetched once when the account loads; if that fetch
  // failed (backend asleep) the tab would wrongly say "no
  // notifications" while the header still shows an unread count.
  // Re-fetch when the tab opens so the list and the count agree.
  useEffect(() => {
    if (tab !== 'notifications') return;
    fetchNotifications().then((res) => {
      if (!res) { setNotificationsError(true); return; }
      setNotifications(res.list);
      setNotificationsLoaded(true);
      setNotificationsError(false);
    });
  }, [tab]);

  const setTab = (t: string) => router.replace(`/account?tab=${t}`, { scroll: false });
  const user = me?.user;
  // The unread count comes from the notifications list once it has
  // loaded (the list endpoint returns the count from the same query as
  // the list, so the two can never disagree). Until then, fall back to
  // the /v1/me count — but never show a "(1)" next to an empty list.
  const unreadCount = notificationsLoaded
    ? notifications.filter((n: any) => n && !n.read).length
    : (me?.unread_notifications || 0);
  const resetsIn = me?.usage?.resets_at ? Math.max(0, new Date(me.usage.resets_at).getTime() - Date.now()) : null;
  const resetsText = resetsIn == null ? '' : `${Math.floor(resetsIn / 3600000)}h ${Math.floor((resetsIn % 3600000) / 60000)}m`;

  const resendVerification = async () => {
    try { await apiFetch('/v1/auth/resend-verification', { method: 'POST', body: {} }); setResendCooldown(60); setToast('Verification email sent.'); }
    catch (e: any) { setToast(e?.message || 'Could not resend the email.'); }
  };
  const markAllRead = async () => {
    try { await apiFetch('/v1/notifications/read-all', { method: 'POST' }); setNotifications((n) => n.map((x) => ({ ...x, read: true }))); setMe((m) => (m ? { ...m, unread_notifications: 0 } : m)); setToast('All notifications marked as read.'); } catch { setToast('Could not update notifications.'); }
  };
  const changePassword = async () => {
    try { await apiFetch('/v1/auth/change-password', { method: 'POST', body: { current_password: currentPw, new_password: newPw } }); setCurrentPw(''); setNewPw(''); setToast('Password changed. All other sessions were signed out.'); }
    catch (e: any) { setToast(e?.message || 'Could not change the password.'); }
  };
  const changeEmail = async () => {
    try { const res: any = await apiFetch('/v1/auth/change-email', { method: 'POST', body: { new_email: newEmail, password: emailPw } }); setToast(res?.message || 'Your email has been changed.'); setNewEmail(''); setEmailPw(''); load(); }
    catch (e: any) { setToast(e?.message || 'Could not change the email.'); }
  };
  const revokeSession = async (id: string) => {
    try { await apiFetch(`/v1/auth/sessions/${id}`, { method: 'DELETE' }); setSessions((s) => s.filter((x) => x.id !== id)); } catch { setToast('Could not revoke that session.'); }
  };
  const revokeOthers = async () => {
    try { await apiFetch('/v1/auth/sessions/revoke-others', { method: 'POST', body: {} }); setSessions((s) => s.slice(0, 1)); setToast('All other sessions signed out.'); } catch { setToast('Could not sign out other sessions.'); }
  };
  const exportData = async () => {
    try {
      const res = await fetch('/api/v1/me/export', { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'my-data.json'; a.click(); URL.revokeObjectURL(url);
    } catch { setToast('Export is not available right now.'); }
  };
  const saveSettings = async () => {
    try { await apiFetch('/v1/me', { method: 'PATCH', body: { display_name: displayName, marketing_emails: marketing } }); setToast('Settings saved.'); load(); }
    catch (e: any) { setToast(e?.message || 'Could not save settings.'); }
  };
  const deleteAccount = async () => {
    if (deleteTyped !== 'DELETE') { setToast('Type DELETE to confirm.'); return; }
    try {
      await apiFetch('/v1/me/delete', { method: 'POST', body: { password: deletePw, confirmation: 'DELETE' } });
      router.push('/');
    } catch (e: any) { setToast(e?.message || 'Could not delete the account.'); }
  };
  const cancelSubscription = async () => {
    try { await apiFetch('/v1/payments/cancel', { method: 'POST', body: {} }); setCancelConfirm(false); setToast('Subscription will end at the current period end.'); load(); }
    catch (e: any) { setToast(e?.message || 'Could not cancel the subscription.'); }
  };
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // The free backend sleeps when idle: awaiting the logout call can
    // take up to a minute, during which the first click looked dead.
    // Fire it, but never make the user wait more than 5s — the local
    // sign-out happens regardless.
    const logout = apiFetch('/v1/auth/logout', { method: 'POST' }).catch(() => {});
    await Promise.race([logout, new Promise((r) => setTimeout(r, 5000))]);
    router.push('/');
    router.refresh();
  };

  if (loading) return <Container className="py-10"><p className="text-muted">Loading your account…</p></Container>;
  if (!user) return null;

  // History rows are normalized before render: a null item, a field of
  // the wrong type, or a bad date shows a dash — it can never throw while
  // the table renders (rendering a non-string object as a React child, or
  // dividing by a non-number size, used to be able to crash this tab).
  const historyText = (v: unknown): string => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : '—');
  const historyNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const historyDate = (v: unknown): string => {
    if (typeof v !== 'string' && typeof v !== 'number') return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  };
  const filteredHistory = history.filter((h) => h && typeof h === 'object' && (statusFilter === 'all' || (typeof h.status === 'string' ? h.status : '') === statusFilter));
  const pageSize = 10;
  const pageItems = filteredHistory.slice((historyPage - 1) * pageSize, historyPage * pageSize);
  const pageRows = pageItems.map((h: any) => ({
    id: typeof h.id === 'string' ? h.id : '',
    pair: historyText(h.pair_slug ?? h.pair),
    status: typeof h.status === 'string' ? h.status : '',
    inSize: historyNum(h.in_size),
    outSize: historyNum(h.out_size),
    created: historyDate(h.created_at),
    expiresAt: typeof h.expires_at === 'string' ? h.expires_at : null,
  }));
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  // A download is expired only when the job finished AND its download
  // window has passed. A job that is still queued must never say
  // "Expired" — it has not even produced a download yet.
  const downloadExpired = (r: { expiresAt: string | null }) => {
    if (!r.expiresAt) return false;
    const t = new Date(r.expiresAt).getTime();
    return !Number.isNaN(t) && t < Date.now();
  };

  return <Container className="py-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-extrabold text-ink">My account</h1>
      <Button variant="secondary" onClick={signOut} loading={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</Button>
    </div>
    {me?.grace_banner && <div className="mt-4 rounded-card border border-warn/40 bg-amber-50 p-4 text-sm"><p className="font-bold text-ink">Payment past due</p><p className="mt-1 text-muted">{me.grace_banner}</p></div>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex gap-1 overflow-x-auto rounded-card bg-soft p-1 lg:flex-col">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
              className={`min-h-[44px] whitespace-nowrap rounded-lg px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
              {t.label}{t.id === 'notifications' && unreadCount ? ` (${unreadCount})` : ''}
            </button>
          ))}
        </div>
      </div>
      <ErrorBoundary key={tab}>
      <div>
        {tab === 'overview' && (
          <div className="space-y-4">
            <Card className="flex flex-wrap items-center gap-4 p-6">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">{(user.display_name || user.email)[0].toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-ink">{user.display_name || 'Account'}</h2>
                <p className="truncate text-sm text-muted">{user.email} {requireVerification && (user.email_verified_at ? <Badge tone="success">Verified</Badge> : <Badge tone="warn">Not verified</Badge>)}</p>
                <p className="text-xs text-muted">Member since {new Date(user.created_at).toLocaleDateString()}</p>
              </div>
              {requireVerification && !user.email_verified_at && <Button variant="secondary" disabled={resendCooldown > 0} onClick={resendVerification}>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification'}</Button>}
            </Card>
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-ink">Plan: <Badge tone="primary">{user.plan}</Badge></h3>
                <Link href="/pricing" className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white">Upgrade</Link>
              </div>
              {me?.usage && <div className="mt-4"><Progress value={me.usage.used} max={me.usage.limit} label={`${me.usage.used} of ${me.usage.limit} conversions used today${resetsText ? ` · resets in ${resetsText}` : ''}`} /></div>}
            </Card>
            <Card className="p-6">
              <h3 className="font-bold text-ink">Last 5 conversions</h3>
              {history.length === 0 ? <p className="mt-2 text-sm text-muted">No conversions yet. Convert a file and it will show up here.</p> : (
                <ul className="mt-2 space-y-1 text-sm">{history.slice(0, 5).map((h: any, i: number) => (
                  <li key={typeof h.id === 'string' ? h.id : i} className="flex justify-between gap-2"><span className="text-muted">{historyText(h.pair_slug ?? h.pair)} · {historyText(h.status)}</span>{typeof h.id === 'string' && h.id && h.status === 'done' && <a href={`/api/v1/jobs/${h.id}/download`} className="font-semibold text-primary">Re-download</a>}</li>
                ))}</ul>
              )}
              <p className="mt-3 text-sm text-muted">Unread notifications: <strong className="text-ink">{unreadCount}</strong></p>
            </Card>
          </div>
        )}
        {tab === 'conversions' && (
          <Card className="p-6">
            <div className="flex flex-wrap gap-2">
              <Select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setHistoryPage(1); }}>
                <option value="all">All statuses</option><option value="done">Done</option><option value="failed">Failed</option><option value="converting">Converting</option>
              </Select>
            </div>
            <p className="mt-2 text-xs text-muted">Conversions are kept for 90 days. Downloads expire 24 hours after conversion.</p>
            {pageRows.length === 0 ? <p className="mt-4 text-sm text-muted">No conversions match. Try a different filter, or convert your first file.</p> : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead><tr className="border-b border-line text-muted"><th className="py-2">Conversion</th><th>Status</th><th>Size</th><th>Savings</th><th>Time</th><th></th></tr></thead>
                  <tbody>
                    {pageRows.map((r, i) => (
                      <tr key={r.id || i} className="border-b border-line">
                        <td className="py-2.5 font-semibold text-ink">{r.pair}</td>
                        <td><Badge tone={r.status === 'done' ? 'success' : r.status === 'failed' ? 'danger' : 'soft'}>{r.status || '—'}</Badge></td>
                        <td className="text-muted">{r.inSize != null ? formatBytes(r.inSize) : '—'}{r.outSize != null ? ` → ${formatBytes(r.outSize)}` : ''}</td>
                        <td className="text-muted">{r.inSize != null && r.inSize > 0 && r.outSize != null ? `${Math.round((1 - r.outSize / r.inSize) * 100)}%` : '—'}</td>
                        <td className="text-muted">{r.created}</td>
                        <td>
                          {r.status === 'done' && r.id && !downloadExpired(r) ? (
                            <a href={`/api/v1/jobs/${r.id}/download`} className="font-semibold text-primary">Re-download</a>
                          ) : r.status === 'done' ? (
                            <span className="text-muted">Expired</span>
                          ) : r.status === 'queued' || r.status === 'running' || r.status === 'converting' ? (
                            <span className="text-muted">Waiting…</span>
                          ) : r.status === 'failed' ? (
                            <span className="text-muted">Failed</span>
                          ) : r.status === 'cancelled' ? (
                            <span className="text-muted">Cancelled</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex items-center gap-2">
                  <Button variant="secondary" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>Previous</Button>
                  <span className="text-sm text-muted">Page {historyPage} of {totalPages}</span>
                  <Button variant="secondary" disabled={historyPage >= totalPages} onClick={() => setHistoryPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </Card>
        )}
        {tab === 'plan' && (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="font-bold text-ink">Current plan: {user.plan}</h3>
              {me?.subscription ? (
                <div className="mt-3 space-y-1 text-sm text-muted">
                  <p>Provider: <strong className="text-ink">{me.subscription.provider_key || me.subscription.provider || '—'}</strong></p>
                  <p>Status: <Badge tone={me.subscription.status === 'active' ? 'success' : 'warn'}>{me.subscription.status}</Badge></p>
                  <p>Current period ends: {me.subscription.current_period_end ? new Date(me.subscription.current_period_end).toLocaleDateString() : '—'}</p>
                  {me.subscription.cancel_at_period_end && <p className="font-semibold text-warn">Cancels at period end.</p>}
                </div>
              ) : <p className="mt-2 text-sm text-muted">You are on the free plan.</p>}
              <div className="mt-4 flex gap-2">
                <Link href="/pricing" className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white">Change plan</Link>
                {me?.subscription?.status === 'active' && !me.subscription.cancel_at_period_end && <Button variant="secondary" onClick={() => setCancelConfirm(true)}>Cancel subscription</Button>}
              </div>
            </Card>
            {pendingReqs.length > 0 && (
              <Card className="p-6">
                <h3 className="font-bold text-ink">Pending payments</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {pendingReqs.map((r: any) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted">{r.provider_key} · {r.reference} · {r.display_amount || ''}</span>
                      <Button variant="secondary" onClick={async () => { try { await apiFetch('/v1/payments/cancel', { method: 'POST', body: { id: r.id } }); setPendingReqs((x) => x.filter((y) => y.id !== r.id)); } catch { setToast('Could not cancel.'); } }}>Cancel</Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card className="p-6">
              <h3 className="font-bold text-ink">Payment history</h3>
              {payments.length === 0 ? <p className="mt-2 text-sm text-muted">No payments yet.</p> : (
                <ul className="mt-2 space-y-2 text-sm">
                  {payments.map((p: any, i: number) => (
                    <li key={p.id || i} className="flex items-center justify-between gap-2">
                      <span className="text-muted">{p.receipt_no || p.id} · {p.amount_cents ? `$${p.amount_cents / 100}` : ''} · {p.status}</span>
                      {p.receipt_no && <a href={`/api/v1/payments/receipt/${p.receipt_no}`} className="font-semibold text-primary">PDF receipt</a>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
        {tab === 'notifications' && (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-ink">Notifications</h3>
              <Button variant="secondary" onClick={markAllRead}>Mark all read</Button>
            </div>
            {notificationsError && notifications.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Could not load your notifications — check your connection and try again.</p>
            ) : notifications.length === 0 ? <p className="mt-3 text-sm text-muted">No notifications yet.</p> : (
              <ul className="mt-3 space-y-3">
                {notifications.map((n: any, i: number) => (
                  <li key={n.id || i} className={`rounded-card border p-3 text-sm ${n.read ? 'border-line' : 'border-primary/40 bg-indigo-50/50'}`}>
                    <p className="font-semibold text-ink">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-muted">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {tab === 'security' && (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="font-bold text-ink">Change password</h3>
              <div className="mt-3 space-y-3">
                <PasswordField label="Current password" id="current-password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
                <PasswordField label="New password" id="new-password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} showStrength />
                <Button onClick={changePassword} disabled={!currentPw || newPw.length < 10}>Change password</Button>
                <p className="text-xs text-muted">Changing your password signs out all other sessions.</p>
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="font-bold text-ink">Change email</h3>
              <div className="mt-3 space-y-3">
                <Input label="New email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <PasswordField label="Current password" id="email-change-password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} />
                <Button onClick={changeEmail} disabled={!newEmail || !emailPw}>{requireVerification ? 'Send verification to new email' : 'Change email'}</Button>
                <p className="text-xs text-muted">{requireVerification ? 'Your email only changes after you click the link sent to the new address.' : 'Your email changes immediately.'}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-ink">Active sessions</h3>
                <Button variant="secondary" onClick={revokeOthers}>Sign out all other devices</Button>
              </div>
              {sessions.length === 0 ? <p className="mt-2 text-sm text-muted">Only this session is active.</p> : (
                <ul className="mt-3 space-y-2 text-sm">
                  {sessions.map((s: any) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-card border border-line p-3">
                      <span className="text-muted">{s.user_agent || s.device || 'Browser'} · {s.ip_masked || s.ip || ''} · last active {s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : '—'}</span>
                      <Button variant="ghost" onClick={() => revokeSession(s.id)}>Revoke</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
        {tab === 'settings' && (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="font-bold text-ink">Profile</h3>
              <div className="mt-3 space-y-3">
                <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                <div className="flex items-center gap-3">
                  <Switch checked={marketing} onChange={setMarketing} label="Marketing emails" />
                  <span className="text-sm text-muted">Marketing emails (transactional emails are always on)</span>
                </div>
                <Button onClick={saveSettings}>Save settings</Button>
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="font-bold text-ink">Export my data</h3>
              <p className="mt-1 text-sm text-muted">Download a JSON file with your profile, conversion history, and payments.</p>
              <Button variant="secondary" className="mt-3" onClick={exportData}>Export my data</Button>
            </Card>
            <Card className="border-danger/40 p-6">
              <h3 className="font-bold text-danger">Danger zone</h3>
              <p className="mt-1 text-sm text-muted">Deleting your account cancels your subscription, removes your files immediately, and anonymizes your personal data.</p>
              <Button variant="danger" className="mt-3" onClick={() => setDeleteConfirm(true)}>Delete account</Button>
            </Card>
          </div>
        )}
      </div>
      </ErrorBoundary>
    </div>
    <Modal open={cancelConfirm} onClose={() => setCancelConfirm(false)} title="Cancel subscription?">
      <p className="text-sm text-muted">Your plan stays active until the end of the current period, then you move to the free plan.</p>
      <div className="mt-5 flex gap-2"><Button variant="danger" onClick={cancelSubscription}>Cancel at period end</Button><Button variant="secondary" onClick={() => setCancelConfirm(false)}>Keep my plan</Button></div>
    </Modal>
    <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Delete your account?">
      <p className="text-sm text-muted">This cannot be undone. Your subscription is cancelled, your files are removed, and your personal data is anonymized.</p>
      <div className="mt-4 space-y-3">
        <PasswordField label="Password" id="delete-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
        <Input label="Type DELETE to confirm" value={deleteTyped} onChange={(e) => setDeleteTyped(e.target.value)} />
      </div>
      <div className="mt-5 flex gap-2"><Button variant="danger" onClick={deleteAccount} disabled={deleteTyped !== 'DELETE' || !deletePw}>Delete my account</Button><Button variant="secondary" onClick={() => setDeleteConfirm(false)}>Cancel</Button></div>
    </Modal>
    {toast && <Toast message={toast} onClose={() => setToast(null)} />}
  </Container>;
}

export default function AccountPage() {
  return <Suspense fallback={<Container className="py-10 text-muted">Loading…</Container>}><AccountInner /></Suspense>;
}
