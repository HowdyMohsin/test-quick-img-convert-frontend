'use client';
import React from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui';

// Account-segment error boundary (Next.js App Router): a render exception
// anywhere under /account shows this friendly screen instead of the raw
// "Application error" text. The error itself is never rendered.
export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="py-10 text-center">
      <h1 className="text-2xl font-extrabold text-ink">Something went wrong</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Your account could not be shown. Please reload the page and try again.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-card bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-card border border-line bg-soft px-5 py-2.5 text-sm font-semibold text-ink hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Reload page
        </button>
        <Link
          href="/account?tab=overview"
          className="inline-flex min-h-[44px] items-center justify-center rounded-card px-5 py-2.5 text-sm font-semibold text-primary hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Back to account
        </Link>
      </div>
    </Container>
  );
}
