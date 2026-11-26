'use client';
import React from 'react';

// App-wide error boundary (Next.js App Router): any client-side exception
// in a route shows this friendly screen instead of the raw "Application
// error" text. The error itself is never rendered — no message, no stack.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-ink">Something went wrong</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Please reload the page and try again. If it keeps happening, try again in a few minutes.
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
      </div>
    </div>
  );
}
