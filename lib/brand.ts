// Brand config — the ONLY place brand strings live in the web app.
// Values may be overridden at runtime by GET /v1/site (site settings).
export const brand = {
  name: 'Quick IMG Convert',
  tagline: 'Convert images, RAW, audio, video and PDF — fast, free and private.',
  homeH1: 'Free online file converter',
  supportEmail: 'support@quickimgconvert.com',
  colors: {
    primary: '#4F46E5',
    ink: '#0F172A',
    muted: '#64748B',
    surface: '#FFFFFF',
    soft: '#F1F5F9',
    line: '#E2E8F0',
    success: '#16A34A',
    warn: '#D97706',
    danger: '#DC2626',
  },
  logo: '/logo.svg',
  logoMark: '/logo-mark.svg',
  ogImage: '/og.png',
} as const;

export function pageTitle(fromLabel: string, toLabel: string): string {
  const full = `${fromLabel} to ${toLabel} Converter — Free Online | ${brand.name}`;
  if (full.length <= 60) return full;
  const short = `${fromLabel} to ${toLabel} Converter — Free Online`;
  return short.length <= 60 ? short : `${fromLabel} to ${toLabel} Converter`;
}
