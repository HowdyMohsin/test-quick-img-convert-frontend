'use client';
import React, { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AuthLayout, AuthTitle, AuthSub, AuthMsg, AuthPasswordField, AuthPill } from '@/components/AuthDesign';

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(!token);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password.length > 128) { setError('Password must be at most 128 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await apiFetch('/v1/auth/reset-password', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err: any) {
      // Backend raises code "invalid_token" for a missing, used, or expired link.
      if (err?.code === 'invalid_token') setExpired(true);
      else setError(err?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };
  return <AuthLayout>
    <AuthTitle>Reset your password</AuthTitle>
    {done ? (
      <div className="mt-4 text-center">
        <AuthSub>Your password has been changed and all other sessions were signed out. You can now sign in with your new password.</AuthSub>
        <div className="mt-6 flex justify-center"><AuthPill onClick={() => router.push('/login')}>Sign in</AuthPill></div>
      </div>
    ) : expired ? (
      <div className="mt-4 text-center">
        <AuthSub>This reset link has expired or was already used. Reset links are valid for 60 minutes and work once.</AuthSub>
        <div className="mt-6 flex justify-center"><Link href="/forgot-password" className="inline-flex h-[42px] min-h-[42px] items-center justify-center rounded-[30px] bg-[linear-gradient(180deg,#2d8cff,#0b52c4)] px-[26px] text-sm font-bold text-white shadow-[0_8px_18px_rgba(11,82,196,.32)] hover:brightness-110">Request a new code</Link></div>
      </div>
    ) : (
      <form onSubmit={submit} className="mt-6 grid gap-[18px]" noValidate>
        {error && <AuthMsg kind="error">{error}</AuthMsg>}
        <AuthPasswordField label="New password" id="new-password" name="new-password" autoComplete="new-password" placeholder="At least 8 characters"
          value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} showStrength />
        <AuthPasswordField label="Confirm password" id="confirm-password" name="confirm-password" autoComplete="new-password" placeholder="Re-enter your password"
          value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} />
        <div className="mt-1.5 flex flex-wrap justify-center gap-3.5">
          <AuthPill type="submit" loading={loading}>Reset password</AuthPill>
        </div>
      </form>
    )}
  </AuthLayout>;
}
export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="mx-auto max-w-md py-12 text-muted">Loading…</div>}><ResetInner /></Suspense>;
}
