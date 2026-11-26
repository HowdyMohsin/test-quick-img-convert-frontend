'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AuthLayout, AuthTitle, AuthSub, AuthMsg, AuthField, AuthPasswordField, AuthPill, AuthCodeBox } from '@/components/AuthDesign';

// TEMPORARY forgot-password flow (user order 2026-11-27): no e-mail is
// sent — the backend returns the 8-digit reset code and it is DISPLAYED
// at the top of the OTP step. Real e-mail OTP replaces this at the end.
// Steps: 1) e-mail → 2) code (shown on screen) → 3) new + confirm password.
type Step = 'email' | 'otp' | 'new';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [displayCode, setDisplayCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const sendCode = async () => {
    if (!emailOk) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ ok?: boolean; code?: string; message?: string }>('/v1/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
      // The code comes from the backend response — it is never generated
      // on the frontend.
      if (!res?.code) throw new Error('We could not create a reset code. Please try again.');
      setDisplayCode(res.code);
      setCode('');
      setStep('otp');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{8}$/.test(code.trim())) { setError('Enter the 8-digit code.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ ok?: boolean; reset_token?: string }>('/v1/auth/verify-reset-otp', { method: 'POST', body: { email: email.trim(), code: code.trim() } });
      if (!res?.reset_token) throw new Error('That code did not work. Check it and try again.');
      setResetToken(res.reset_token);
      setStep('new');
    } catch (err: any) {
      setError(err?.message || 'That code did not work. Check it and try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword.length > 128) { setError('Password must be at most 128 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch('/v1/auth/reset-password', { method: 'POST', body: { token: resetToken, password: newPassword } });
      router.push('/login?reset=done');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return <AuthLayout>
    {step === 'email' && <>
      <Link href="/login" className="mb-[18px] inline-block text-[13.5px] font-semibold text-[#0b52c4] hover:underline">← Back to sign in</Link>
      <AuthTitle>Forgot your password?</AuthTitle>
      <AuthSub>Enter the e-mail you signed up with.</AuthSub>
      <form onSubmit={(e) => { e.preventDefault(); void sendCode(); }} className="mt-6 grid gap-[18px]" noValidate>
        {error && <AuthMsg kind="error">{error}</AuthMsg>}
        <AuthField label="E-mail address" name="email" type="email" autoComplete="email" placeholder="Enter your e-mail"
          value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} valid={emailOk} />
        <div className="mt-1.5 flex flex-wrap justify-center gap-3.5">
          <AuthPill type="submit" loading={loading}>Send OTP</AuthPill>
          <AuthPill variant="alt" onClick={() => router.push('/login')}>Cancel</AuthPill>
        </div>
      </form>
    </>}
    {step === 'otp' && <>
      <Link href="/login" className="mb-[18px] inline-block text-[13.5px] font-semibold text-[#0b52c4] hover:underline">← Back to sign in</Link>
      <AuthTitle>Enter your reset code</AuthTitle>
      <AuthSub>Enter the 8-digit code below to continue.</AuthSub>
      <div className="mt-6">
        <AuthCodeBox code={displayCode} />
      </div>
      <form onSubmit={verifyCode} className="mt-6 grid gap-[18px]" noValidate>
        {error && <AuthMsg kind="error">{error}</AuthMsg>}
        {info && <AuthMsg kind="info">{info}</AuthMsg>}
        <AuthField label="Reset code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="12345678" maxLength={8}
          value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }} valid={/^\d{8}$/.test(code)} />
        <div className="mt-1.5 flex flex-wrap justify-center gap-3.5">
          <AuthPill type="submit" loading={loading}>Verify code</AuthPill>
        </div>
      </form>
      <div className="mt-5 flex items-center justify-between gap-3 text-[13px]">
        <button type="button" onClick={() => { setStep('email'); setError(''); setInfo(''); }} className="font-semibold text-[#0b52c4] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b52c4]">Use a different e-mail</button>
        <button type="button" disabled={loading} onClick={async () => {
          setLoading(true); setError(''); setInfo('');
          try {
            const res = await apiFetch<{ ok?: boolean; code?: string }>('/v1/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
            if (!res?.code) throw new Error('We could not create a new code. Please try again.');
            setDisplayCode(res.code); setCode(''); setInfo('A new code was created — it is shown above.');
          } catch (err: any) { setError(err?.message || 'We could not create a new code. Please try again.'); }
          finally { setLoading(false); }
        }} className="font-semibold text-[#0b52c4] hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b52c4]">Send a new code</button>
      </div>
    </>}
    {step === 'new' && <>
      <AuthTitle>Set a new password</AuthTitle>
      <AuthSub>Choose a new password for <strong className="text-ink">{email.trim()}</strong>.</AuthSub>
      <form onSubmit={resetPassword} className="mt-6 grid gap-[18px]" noValidate>
        {error && <AuthMsg kind="error">{error}</AuthMsg>}
        <AuthPasswordField label="New password" id="new-password" name="new-password" autoComplete="new-password" placeholder="At least 8 characters"
          value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(''); }} showStrength />
        <AuthPasswordField label="Confirm password" id="confirm-password" name="confirm-password" autoComplete="new-password" placeholder="Re-enter your password"
          value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} />
        <div className="mt-1.5 flex flex-wrap justify-center gap-3.5">
          <AuthPill type="submit" loading={loading}>Reset password</AuthPill>
        </div>
      </form>
    </>}
  </AuthLayout>;
}
