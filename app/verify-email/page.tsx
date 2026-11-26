'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Button, Card } from '@/components/ui';

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'expired' | 'error'>('loading');
  useEffect(() => {
    if (!token) { setState('expired'); return; }
    apiFetch('/v1/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => setState('ok'))
      .catch((e: any) => setState(e?.code === 'token_expired' || e?.code === 'token_invalid' ? 'expired' : 'error'));
  }, [token]);
  return <div className="mx-auto max-w-md px-4 py-12">
    <Card className="p-6 text-center sm:p-8">
      {state === 'loading' && <><h1 className="text-2xl font-extrabold text-ink">Verifying your email…</h1><p className="mt-2 text-sm text-muted">Please wait a moment.</p></>}
      {state === 'ok' && <><h1 className="text-2xl font-extrabold text-ink">Email verified</h1><p className="mt-2 text-sm text-muted">Your email address is now verified. You can use all account features, including payments.</p><Button className="mt-5 w-full" onClick={() => router.push('/account')}>Go to my account</Button></>}
      {state === 'expired' && <><h1 className="text-2xl font-extrabold text-ink">This link has expired</h1><p className="mt-2 text-sm text-muted">Verification links are valid for 24 hours and work once. Sign in and request a new one from your account page.</p><Link href="/login" className="mt-5 inline-flex min-h-[44px] items-center rounded-card bg-primary px-5 text-sm font-semibold text-white">Sign in</Link></>}
      {state === 'error' && <><h1 className="text-2xl font-extrabold text-ink">Something went wrong</h1><p className="mt-2 text-sm text-muted">We could not verify your email. Please try again or contact support.</p><Link href="/contact" className="mt-5 inline-flex min-h-[44px] items-center rounded-card bg-primary px-5 text-sm font-semibold text-white">Contact support</Link></>}
    </Card>
  </div>;
}
export default function VerifyEmailPage() {
  return <Suspense fallback={<div className="mx-auto max-w-md px-4 py-12 text-muted">Loading…</div>}><VerifyInner /></Suspense>;
}
