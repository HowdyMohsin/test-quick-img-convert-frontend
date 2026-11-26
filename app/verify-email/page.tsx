'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Button, Card, Container } from '@/components/ui';

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  // Email verification is OFF in the code (user order 2026-11-26):
  // this page never verifies and never errors — it just points back
  // to the account. The verification flow comes back when the flag is
  // turned back on.
  const [state, setState] = useState<'loading' | 'off' | 'ok' | 'expired' | 'error'>('loading');
  useEffect(() => {
    apiFetch('/v1/site').then((d: any) => {
      if (d?.require_email_verification === false) { setState('off'); return; }
      if (!token) { setState('expired'); return; }
      apiFetch('/v1/auth/verify-email', { method: 'POST', body: { token } })
        .then(() => setState('ok'))
        .catch((e: any) => setState(e?.code === 'token_expired' || e?.code === 'token_invalid' ? 'expired' : 'error'));
    }).catch(() => {
      if (!token) { setState('expired'); return; }
      apiFetch('/v1/auth/verify-email', { method: 'POST', body: { token } })
        .then(() => setState('ok'))
        .catch((e: any) => setState(e?.code === 'token_expired' || e?.code === 'token_invalid' ? 'expired' : 'error'));
    });
  }, [token]);
  return <Container className="py-12"><div className="mx-auto max-w-md">
    <Card className="p-6 text-center sm:p-8">
      {state === 'loading' && <><h1 className="text-2xl font-extrabold text-ink">Verifying your email…</h1><p className="mt-2 text-sm text-muted">Please wait a moment.</p></>}
      {state === 'off' && <><h1 className="text-2xl font-extrabold text-ink">Email verification is off for now</h1><p className="mt-2 text-sm text-muted">Your account works without email verification while testing is in progress. You can continue to your account.</p><Button className="mt-5 w-full" onClick={() => router.push('/account')}>Go to my account</Button></>}
      {state === 'ok' && <><h1 className="text-2xl font-extrabold text-ink">Email verified</h1><p className="mt-2 text-sm text-muted">Your email address is now verified. You can use all account features, including payments.</p><Button className="mt-5 w-full" onClick={() => router.push('/account')}>Go to my account</Button></>}
      {state === 'expired' && <><h1 className="text-2xl font-extrabold text-ink">This link has expired</h1><p className="mt-2 text-sm text-muted">Verification links are valid for 24 hours and work once. Sign in and request a new one from your account page.</p><Link href="/login" className="mt-5 inline-flex min-h-[44px] items-center rounded-card bg-primary px-5 text-sm font-semibold text-white">Sign in</Link></>}
      {state === 'error' && <><h1 className="text-2xl font-extrabold text-ink">Something went wrong</h1><p className="mt-2 text-sm text-muted">We could not verify your email. Please try again or contact support.</p><Link href="/contact" className="mt-5 inline-flex min-h-[44px] items-center rounded-card bg-primary px-5 text-sm font-semibold text-white">Contact support</Link></>}
    </Card>
  </div>
  </Container>;
}
export default function VerifyEmailPage() {
  return <Suspense fallback={<Container className="py-12"><div className="mx-auto max-w-md text-muted">Loading…</div></Container>}><VerifyInner /></Suspense>;
}
