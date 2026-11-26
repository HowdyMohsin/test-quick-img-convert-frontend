import type { Metadata } from 'next';
import { Inter, Raleway } from 'next/font/google';
import './globals.css';
import { brand } from '@/lib/brand';
import { SiteChrome } from '@/components/SiteChrome';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Raleway is used by the auth card design only (login / forgot / reset).
const raleway = Raleway({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-raleway', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: `${brand.name} — ${brand.homeH1}`,
  description: brand.tagline,
  // Owner decision (2026-11-25): noindex on everything — Google must
  // not crawl or index any page of the tool.
  robots: { index: false, follow: false },
  openGraph: { type: 'website', title: brand.name, description: brand.tagline, images: [brand.ogImage] },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${raleway.variable}`}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/logo-mark.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
