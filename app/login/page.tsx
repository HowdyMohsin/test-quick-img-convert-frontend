'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, fetchMe } from '@/lib/api';
import { brand } from '@/lib/brand';
import { Toast } from '@/components/ui';
import { Captcha } from '@/components/Captcha';
import { AuthLayout, AuthTitle, AuthSub, AuthMsg, AuthField, AuthPasswordField, AuthPill } from '@/components/AuthDesign';

const LOGIN_TIMEOUT_MS = 90_000;
const SLOW_LOGIN_MS = 8_000;

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get('mode') === 'register' ? 'register' : 'signin';
  const next = params.get('next') || '/account';
  const resetDone = params.get('reset') === 'done';
  const [tab, setTab] = useState(mode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [slowLogin, setSlowLogin] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  // Captcha (test mode) + email OTP verification.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  useEffect(() => { setTab(mode); setErrors({}); }, [mode]);
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

  // A field's error clears the moment the user changes that field, so a
  // corrected field never keeps showing its old red message.
  const clearError = (field: string) => setErrors((prev) => {
    if (!(field in prev)) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  });

  // Switching tabs must not carry the other form's error over: a failed
  // "Email or password is incorrect." must never still be sitting on the
  // registration form after the user switches tabs (and vice versa).
  const switchTab = (v: string) => {
    setTab(v);
    setErrors({});
  };

  // Validate one field only. Blur validates just the field that was left —
  // never the whole form, so tabbing through empty fields shows nothing.
  const fieldError = (field: string): string | undefined => {
    if (field === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? undefined : 'Enter a valid email address.';
    if (field === 'password') {
      if (tab === 'register') {
        if (password.length < 8) return 'Password must be at least 8 characters.';
        if (password.length > 128) return 'Password must be at most 128 characters.';
      } else if (!password) return 'Enter your password.';
      return undefined;
    }
    if (field === 'name') return name.trim().length >= 2 ? undefined : 'Enter your name.';
    if (field === 'confirmPassword') return confirmPassword === password ? undefined : 'Passwords do not match.';
    if (field === 'terms') return terms ? undefined : 'You must accept the Terms and Privacy Policy.';
    return undefined;
  };

  const validateField = (field: string) => {
    const err = fieldError(field);
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err; else delete next[field];
      return next;
    });
    return !err;
  };

  // Full validation runs only on submit.
  const validate = () => {
    const fields = tab === 'register'
      ? ['name', 'email', 'password', 'confirmPassword', 'terms']
      : ['email', 'password'];
    const e: Record<string, string> = {};
    for (const f of fields) { const err = fieldError(f); if (err) e[f] = err; }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setSlowLogin(false);
    const slowTimer = setTimeout(() => setSlowLogin(true), SLOW_LOGIN_MS);
    try {
      if (tab === 'register') {
        // Captcha: verify the token server-side first. If the verify
        // endpoint is not deployed yet (or the network fails), test mode
        // allows registration through and only logs a warning.
        if (captchaToken) {
          try {
            const res = await apiFetch<{ ok?: boolean }>('/v1/captcha/verify', { method: 'POST', body: { token: captchaToken } });
            if (res && res.ok === false) {
              setCaptchaResetKey((k) => k + 1);
              setErrors({ form: 'Captcha verification failed. Please tick the checkbox again.' });
              return;
            }
          } catch (err) {
            console.warn('[captcha] verify endpoint unavailable, continuing in test mode:', err);
          }
        }
        const res = await apiFetch<{ require_email_verification?: boolean }>('/v1/auth/register', { method: 'POST', body: { name: name.trim(), email: email.trim(), password, terms_accepted: terms, remember_me: remember } });
        // Email verification is OFF in the code (user order
        // 2026-11-26), so registration lands straight on the account —
        // no OTP screen, no verification prompt. The OTP screen stays
        // for a later re-enable (when the backend reports the flag on).
        if (res?.require_email_verification === false) {
          router.push('/account');
          router.refresh();
          return;
        }
        setRegistered(true);
        setResendCooldown(60);
      } else {
        // The free backend sleeps when idle and can take up to a minute to
        // wake up — show that instead of hanging silently, and surface a
        // proper error if it still has not answered after 90 seconds.
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('LOGIN_TIMEOUT')), LOGIN_TIMEOUT_MS));
        await Promise.race([
          apiFetch('/v1/auth/login', { method: 'POST', body: { email: email.trim(), password, remember_me: remember } }),
          timeout,
        ]);
        const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/account';
        router.push(safeNext);
        router.refresh();
      }
    } catch (e: any) {
      if (e?.message === 'LOGIN_TIMEOUT') {
        setErrors({ form: 'The server is taking too long to respond — it may be waking up from sleep. Please try again.' });
      } else {
        setErrors({ form: e?.message || 'Something went wrong. Please try again.' });
      }
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
    }
  };

  const resend = async () => {
    try { await apiFetch('/v1/auth/resend-verification', { method: 'POST', body: {} }); setResendCooldown(60); setToast('Verification email sent.'); }
    catch (e: any) { setToast(e?.message || 'Could not resend the email.'); }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otpCode.trim())) { setOtpError('Enter the 6-digit code.'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      await apiFetch('/v1/auth/verify-otp', { method: 'POST', body: { email: email.trim(), code: otpCode.trim() } });
      setOtpVerified(true);
    } catch (err: any) {
      setOtpError(err?.message || 'That code did not work. Check it and try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const resendOtp = async () => {
    try { await apiFetch('/v1/auth/resend-otp', { method: 'POST', body: { email: email.trim() } }); setResendCooldown(60); setToast('A new code was sent.'); }
    catch (err: any) { setToast(err?.message || 'Could not resend the code.'); }
  };

  const googleSignIn = () => {
    setToast('Google sign-in opens in a new window once it is configured.');
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (registered) {
    if (otpVerified) {
      return <AuthLayout>
        <div className="text-center">
          <AuthTitle>Email verified</AuthTitle>
          <AuthSub>Your email <strong className="text-ink">{email}</strong> is verified. Payments and higher limits are unlocked.</AuthSub>
          <div className="mt-6 flex flex-col items-center gap-3">
            <AuthPill onClick={() => router.push('/account')}>Go to my account</AuthPill>
          </div>
        </div>
      </AuthLayout>;
    }
    return <AuthLayout>
      <div className="text-center">
        <AuthTitle>Enter the 6-digit code</AuthTitle>
        <AuthSub>We sent a 6-digit verification code to <strong className="text-ink">{email}</strong>. Enter it below to verify your email.</AuthSub>
        <form onSubmit={verifyOtp} className="mt-6 grid gap-[18px] text-left" noValidate>
          <AuthField label="Verification code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6}
            value={otpCode} onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }} error={otpError} />
          <div className="flex flex-wrap justify-center gap-3.5"><AuthPill type="submit" loading={otpLoading}>Verify email</AuthPill></div>
        </form>
        <p className="mt-4 text-xs leading-relaxed text-muted">We also sent a verification link to {email} — you can use either the code or the link. You are already signed in.</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <AuthPill variant="alt" disabled={resendCooldown > 0} onClick={resendOtp}>{resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}</AuthPill>
          <AuthPill variant="alt" disabled={resendCooldown > 0} onClick={resend}>{resendCooldown > 0 ? `Resend link in ${resendCooldown}s` : 'Resend verification email'}</AuthPill>
          <AuthPill variant="alt" onClick={() => router.push('/account')}>Go to my account</AuthPill>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </AuthLayout>;
  }

  return <AuthLayout>
    <AuthTitle>{tab === 'register' ? 'Create your account' : 'Welcome back'}</AuthTitle>
    <AuthSub>{tab === 'register' ? 'Free forever — 25 conversions a day.' : `Sign in to ${brand.name}.`}</AuthSub>
    {googleEnabled && <>
      <div className="mt-6"><AuthPill variant="alt" className="w-full" onClick={googleSignIn}>Continue with Google</AuthPill></div>
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-[#e2e8f0]" />or<span className="h-px flex-1 bg-[#e2e8f0]" /></div>
    </>}
    <form onSubmit={submit} className="mt-6 grid gap-[18px]" noValidate>
      {errors.form && <AuthMsg kind="error">{errors.form}</AuthMsg>}
      {resetDone && tab === 'signin' && <AuthMsg kind="ok">Your password has been reset. Please sign in.</AuthMsg>}
      {tab === 'register' && <AuthField label="Name" name="name" autoFocus autoComplete="name" placeholder="Enter your name"
        value={name} onChange={(e) => { setName(e.target.value); clearError('name'); }} error={errors.name} valid={name.trim().length >= 2} onBlur={() => validateField('name')} />}
      <AuthField label="E-mail address" name="email" type="email" autoFocus={tab === 'signin'} autoComplete="username" placeholder="Enter your e-mail"
        value={email} onChange={(e) => { setEmail(e.target.value); clearError('email'); }} error={errors.email} valid={emailValid} onBlur={() => validateField('email')} />
      <AuthPasswordField label="Password" id="password" name="password" autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
        placeholder={tab === 'register' ? 'At least 8 characters' : 'Enter your password'}
        value={password} onChange={(e) => { setPassword(e.target.value); clearError('password'); }} error={errors.password} showStrength={tab === 'register'} onBlur={() => validateField('password')} />
      {tab === 'register' && <AuthPasswordField label="Confirm password" id="confirm-password" name="confirm-password" autoComplete="new-password" placeholder="Re-enter your password"
        value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); clearError('confirmPassword'); }} error={errors.confirmPassword} onBlur={() => validateField('confirmPassword')} />}
      {tab === 'register' && (
        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed text-muted">
            <input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); clearError('terms'); }} className="mt-px h-4 w-4 shrink-0 accent-[#0b52c4]" />
            <span>By signing up, I agree with the <Link href="/terms" className="font-semibold text-[#0b52c4] hover:underline">Terms &amp; Conditions</Link> and <Link href="/privacy-policy" className="font-semibold text-[#0b52c4] hover:underline">Privacy Policy</Link>.</span>
          </label>
          {errors.terms && <p role="alert" className="mt-1.5 text-[12.5px] text-[#c0322b]">{errors.terms}</p>}
        </div>
      )}
      {tab === 'register' && <Captcha onToken={setCaptchaToken} resetKey={captchaResetKey} />}
      {tab === 'signin' && (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <label className="flex cursor-pointer items-center gap-2 text-muted"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#0b52c4]" /> Keep me signed in</label>
          <Link href="/forgot-password" className="font-semibold text-[#0b52c4] hover:underline">Forgot password?</Link>
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap justify-center gap-3.5">
        <AuthPill type="submit" loading={loading}>{tab === 'register' ? 'Create account' : 'Sign In'}</AuthPill>
        <AuthPill variant="alt" onClick={() => switchTab(tab === 'register' ? 'signin' : 'register')}>{tab === 'register' ? 'Sign In' : 'Create account'}</AuthPill>
      </div>
      {loading && <p role="status" className="text-center text-sm text-muted">{slowLogin ? 'Waking up the server, please wait…' : tab === 'register' ? 'Creating your account…' : 'Signing in…'}</p>}
    </form>
    {toast && <Toast message={toast} onClose={() => setToast(null)} />}
  </AuthLayout>;
}

export default function LoginPage() {
  return <Suspense fallback={<div className="mx-auto max-w-md py-12 text-muted">Loading…</div>}><LoginInner /></Suspense>;
}
