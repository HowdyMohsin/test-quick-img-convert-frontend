import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Auth pages are never indexed (v5 section 12.10): the page itself is a
// client component, so the noindex meta lives in this server layout.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
