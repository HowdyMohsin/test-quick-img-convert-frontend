'use client';
import React from 'react';

// Root-level error boundary (Next.js App Router): catches errors in the
// root layout itself. Must render its own <html> and <body>. Same friendly
// message as app/error.tsx — never the raw error text or a stack trace.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div style={{ margin: '0 auto', maxWidth: '80rem', padding: '4rem 1rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>Something went wrong</h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748B' }}>
            Please reload the page and try again. If it keeps happening, try again in a few minutes.
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{ minHeight: 44, borderRadius: 12, background: '#4F46E5', color: '#fff', padding: '0.625rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ minHeight: 44, borderRadius: 12, background: '#F1F5F9', color: '#0F172A', padding: '0.625rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, border: '1px solid #E2E8F0', cursor: 'pointer' }}
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
