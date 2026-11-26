'use client';
import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button, Card, Container, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    try { await apiFetch('/v1/auth/forgot-password', { method: 'POST', body: { email } }); setSent(true); }
    catch (err: any) { setError(err?.message || 'Something went wrong.'); }
    finally { setLoading(false); }
  };
  return <Container className="py-12"><div className="mx-auto max-w-md">
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold text-ink">Forgot your password?</h1>
      {sent ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">If that email exists, we sent a reset link. The link is valid for 60 minutes. Check your inbox — and your spam folder.</p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <p className="text-sm text-muted">Enter the email you signed up with and we will send you a reset link.</p>
          <Input label="Email" name="email" type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
        </form>
      )}
    </Card>
  </div>
  </Container>;
}
