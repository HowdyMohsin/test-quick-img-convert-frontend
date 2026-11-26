import type { Metadata } from 'next';
import { brand } from '@/lib/brand';
import { StatusClient } from '@/components/StatusClient';

export const metadata: Metadata = {
  title: `API Status | ${brand.name}`,
  description: 'Live status of the Quick IMG Convert APIs — check whether the converter, plans, catalog and ads services are online.',
  alternates: { canonical: '/status' },
};

// Noindex is inherited from the root layout (robots: index false,
// follow false) — this page is never indexed, like every other page.
export default function StatusPage() {
  return <StatusClient />;
}
