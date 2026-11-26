import { NextResponse } from 'next/server';
export async function GET() {
  const base = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  try {
    const res = await fetch(`${base}/v1/ads.txt`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const text = await res.text();
      if (text.trim()) return new NextResponse(text, { headers: { 'Content-Type': 'text/plain' } });
    }
  } catch { /* fall through to 404 */ }
  return new NextResponse('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
}
