import { ImageResponse } from 'next/og';
import { formatBySlug } from '@/lib/catalog';

export const runtime = 'edge';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = formatBySlug(searchParams.get('from') || 'png');
  const to = formatBySlug(searchParams.get('to') || 'jpg');
  const title = `${from?.label || 'PNG'} to ${to?.label || 'JPG'} Converter`;
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#4F46E5', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 56, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 28, marginTop: 16, opacity: 0.85 }}>Free online · Quick IMG Convert</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
