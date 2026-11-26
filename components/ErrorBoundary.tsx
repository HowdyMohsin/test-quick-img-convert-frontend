'use client';
import React from 'react';
import { Button } from './ui';

// Friendly fallback for a client-side render exception: the user sees a
// human message and a Reload button — never Next.js's raw "Application
// error" text and never a stack trace. The error itself is swallowed
// on purpose: nothing about it is shown to the user.
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; title?: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; title?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Intentionally silent.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-7xl px-4 py-10 text-center">
          <h2 className="text-xl font-bold text-ink">{this.props.title || 'Something went wrong'}</h2>
          <p className="mt-2 text-sm text-muted">Please reload the page and try again.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
