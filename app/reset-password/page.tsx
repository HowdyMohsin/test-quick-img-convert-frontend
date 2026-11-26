'use client';
import React, { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Button, Card, Container, PasswordField } from '@/components/ui';

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(!token);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) { setError('Password must be at least 10 characters.'); return; }
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
  return <Container className="py-12"><div className="mx-auto max-w-md">
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold text-ink">Reset your password</h1>
      {done ? (
        <div className="mt-4">
          <p className="text-sm text-muted">Your password has been changed and all other sessions were signed out. You can now sign in with your new password.</p>
          <Button className="mt-5 w-full" onClick={() => router.push('/login')}>Sign in</Button>
        </div>
      ) : expired ? (
        <div className="mt-4">
          <p className="text-sm text-muted">This reset link has expired or was already used. Reset links are valid for 60 minutes and work once.</p>
          <Link href="/forgot-password" className="mt-5 inline-flex min-h-[44px] items-center rounded-card bg-primary px-5 text-sm font-semibold text-white">Request a new link</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <PasswordField label="New password" id="new-password" name="new-password" autoComplete="new-password" placeholder="At least 10 characters" value={password} onChange={(e) => setPassword(e.target.value)} error={error} showStrength />
          <Button type="submit" loading={loading} className="w-full">Reset password</Button>
        </form>
      )}
    </Card>
  </div>
  </Container>;
}
export default function ResetPasswordPage() {
  return <Suspense fallback={<Container className="py-12"><div className="mx-auto max-w-md text-muted">Loading…</div></Container>}><ResetInner /></Suspense>;
}
