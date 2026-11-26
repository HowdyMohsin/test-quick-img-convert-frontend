'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, fetchMe } from '@/lib/api';
import { brand } from '@/lib/brand';
import { Button, Card, Input, PasswordField, Tabs, Toast } from '@/components/ui';

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get('mode') === 'register' ? 'register' : 'signin';
  const next = params.get('next') || '/account';
  const [tab, setTab] = useState(mode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => { setTab(mode); }, [mode]);
  useEffect(() => {
    fetchMe().then((m) => { if (m?.user) router.replace('/account'); });
    fetch('/api/v1/site', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.google_enabled || d?.google_client_id) setGoogleEnabled(true); })
      .catch(() => {});
  }, [router]);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address.';
    if (tab === 'register') {
      if (password.length < 10) e.password = 'Password must be at least 10 characters.';
      if (password.length > 128) e.password = 'Password must be at most 128 characters.';
      if (!name.trim()) e.name = 'Enter your name.';
      if (!terms) e.terms = 'You must accept the Terms and Privacy Policy.';
    } else if (!password) e.password = 'Enter your password.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (tab === 'register') {
        await apiFetch('/v1/auth/register', { method: 'POST', body: { display_name: name.trim(), email: email.trim(), password } });
        setRegistered(true);
        setResendCooldown(60);
      } else {
        await apiFetch('/v1/auth/login', { method: 'POST', body: { email: email.trim(), password, remember } });
        const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/account';
        router.push(safeNext);
        router.refresh();
      }
    } catch (e: any) {
      setErrors({ form: e?.message || 'Something went wrong. Please try again.' });
    } finally { setLoading(false); }
  };

  const resend = async () => {
    try { await apiFetch('/v1/auth/resend-verification', { method: 'POST', body: {} }); setResendCooldown(60); setToast('Verification email sent.'); }
    catch (e: any) { setToast(e?.message || 'Could not resend the email.'); }
  };

  const googleSignIn = () => {
    setToast('Google sign-in opens in a new window once it is configured.');
  };

  if (registered) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Card className="p-8">
        <h1 className="text-2xl font-extrabold text-ink">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted">We sent a verification link to <strong className="text-ink">{email}</strong>. You are already signed in — verify your email to unlock payments and higher limits.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button disabled={resendCooldown > 0} onClick={resend}>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}</Button>
          <Button variant="secondary" onClick={() => router.push('/account')}>Go to my account</Button>
        </div>
      </Card>
    </div>;
  }

  return <div className="mx-auto max-w-md px-4 py-12">
    <Card className="p-6 sm:p-8">
      <h1 className="text-center text-2xl font-extrabold text-ink">{tab === 'register' ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mt-1 text-center text-sm text-muted">{tab === 'register' ? 'Free forever — 25 conversions a day.' : `Sign in to ${brand.name}.`}</p>
      <div className="mt-6"><Tabs tabs={[{ id: 'signin', label: 'Sign in' }, { id: 'register', label: 'Create account' }]} value={tab} onChange={(v) => setTab(v)} /></div>
      {googleEnabled && <>
        <Button variant="secondary" className="mt-5 w-full" onClick={googleSignIn}>Continue with Google</Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      </>}
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {tab === 'register' && <Input label="Your name" autoFocus name="name" autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} onBlur={validate} />}
        <Input label="Email" name="email" type="email" autoFocus={tab === 'signin'} autoComplete="username" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} onBlur={validate} />
        <PasswordField label="Password" id="password" name="password" autoComplete={tab === 'register' ? 'new-password' : 'current-password'} placeholder={tab === 'register' ? 'At least 10 characters' : 'Your password'} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} showStrength={tab === 'register'} onBlur={validate} />
        {tab === 'register' && (
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#4F46E5]" />
            <span>I agree to the <Link href="/terms" className="font-semibold text-primary underline">Terms of Service</Link> and <Link href="/privacy-policy" className="font-semibold text-primary underline">Privacy Policy</Link>.</span>
          </label>
        )}
        {errors.terms && <p role="alert" className="text-xs font-medium text-danger">{errors.terms}</p>}
        {tab === 'signin' && (
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-muted"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-[#4F46E5]" /> Remember me</label>
            <Link href="/forgot-password" className="font-semibold text-primary hover:underline">Forgot password?</Link>
          </div>
        )}
        {errors.form && <p role="alert" aria-live="polite" className="rounded-card bg-red-50 px-3 py-2 text-sm font-medium text-danger">{errors.form}</p>}
        <Button type="submit" loading={loading} className="w-full">{tab === 'register' ? 'Create account' : 'Sign in'}</Button>
      </form>
    </Card>
    {toast && <Toast message={toast} onClose={() => setToast(null)} />}
  </div>;
}

export default function LoginPage() {
  return <Suspense fallback={<div className="mx-auto max-w-md px-4 py-12 text-muted">Loading…</div>}><LoginInner /></Suspense>;
}
