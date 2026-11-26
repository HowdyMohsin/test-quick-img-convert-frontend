import { NextResponse } from 'next/server';

// Owner decision (2026-11-25): Google must not crawl any page of the
// tool, so every crawler is disallowed. The sitemap route was removed
// with this change.
export function GET() {
  const body = `User-agent: *\nDisallow: /\n`;
  return new NextResponse(body, { headers: { 'Content-Type': 'text/plain' } });
}
