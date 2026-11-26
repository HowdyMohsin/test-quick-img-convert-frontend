import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { brand, pageTitle } from '@/lib/brand';
import { getCatalog, resolveAlias, formatBySlug } from '@/lib/catalog';
import { pairDescription, pairFaqs, pairUseCases, pairProblems } from '@/lib/pair-copy';
import { ConverterTool } from '@/components/ConverterTool';
import { AdFrame } from '@/components/AdFrame';
import { Accordion, Card, EmptyState } from '@/components/ui';
import { Check } from 'lucide-react';

export const revalidate = 3600;

export async function generateStaticParams() {
  const { localCatalog } = await import('@/lib/catalog');
  return localCatalog.pairs.map((p) => ({ pair: p.slug }));
}

export async function generateMetadata({ params }: { params: { pair: string } }): Promise<Metadata> {
  const { catalog } = await getCatalog();
  const [fRaw, tRaw] = params.pair.split('-to-');
  const from = formatBySlug(resolveAlias(fRaw || ''));
  const to = formatBySlug(resolveAlias(tRaw || ''));
  if (!from || !to) return { title: 'Converter not found', robots: { index: false, follow: false } };
  const pair = catalog.pairs.find((p) => p.from === from.slug && p.to === to.slug);
  return {
    title: { absolute: pageTitle(from.label, to.label) },
    description: pairDescription(from, to),
    alternates: { canonical: `/convert/${from.slug}-to-${to.slug}` },
    // Owner decision (2026-11-25): noindex on every pair page.
    robots: { index: false, follow: false },
    openGraph: {
      title: pageTitle(from.label, to.label),
      description: pairDescription(from, to),
      images: [{ url: `/og?from=${from.slug}&to=${to.slug}`, width: 1200, height: 630, alt: `${from.label} to ${to.label} converter` }],
    },
  };
}

export default async function ConvertPage({ params }: { params: { pair: string } }) {
  const { catalog, healthy } = await getCatalog();
  const [fRaw, tRaw] = params.pair.split('-to-');
  const from = formatBySlug(resolveAlias(fRaw || ''));
  const to = formatBySlug(resolveAlias(tRaw || ''));
  if (!from || !to) notFound();
  const pair = catalog.pairs.find((p) => p.from === from.slug && p.to === to.slug);
  if (!pair) notFound();
  const isHealthy = healthy.has(pair.slug);
  const faqs = pairFaqs(from, to);
  const useCases = pairUseCases(from, to);
  const problems = pairProblems(from, to);
  const relatedFrom = catalog.pairs.filter((p) => p.from === from.slug && p.to !== to.slug).slice(0, 6);
  const relatedTo = catalog.pairs.filter((p) => p.to === to.slug && p.from !== from.slug).slice(0, 6);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: pageTitle(from.label, to.label), url: `${siteUrl}/convert/${pair.slug}`, description: pairDescription(from, to) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: `${from.label} to ${to.label}`, item: `${siteUrl}/convert/${pair.slug}` },
      ]},
      { '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'SoftwareApplication', name: `${from.label} to ${to.label} Converter`, applicationCategory: 'MultimediaApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-primary">Home</Link> <span aria-hidden>›</span>{' '}
        <Link href="/#formats" className="hover:text-primary">Converters</Link> <span aria-hidden>›</span>{' '}
        <span className="font-semibold text-ink">{from.label} to {to.label}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{from.label} to {to.label} Converter</h1>
      <p className="mt-2 max-w-3xl text-muted">{pairDescription(from, to)}</p>

      <div className="mt-6">
        {isHealthy ? (
          <ConverterTool from={from} to={to} catalog={catalog} />
        ) : (
          <Card className="p-6">
            <EmptyState title="This converter is temporarily unavailable"
              body={`The ${from.label} to ${to.label} converter is paused right now. These working converters may help instead:`}
              action={<div className="flex flex-wrap justify-center gap-2">
                {relatedFrom.slice(0, 3).map((p) => {
                  const t = formatBySlug(p.to)!;
                  return <Link key={p.slug} href={`/convert/${p.slug}`} className="rounded-full border border-line bg-surface px-3 py-2 text-sm font-semibold text-primary">{from.label} to {t.label}</Link>;
                })}
              </div>} />
          </Card>
        )}
      </div>

      <AdFrame slot="pair_top" />

      <div className="mx-auto mt-4 grid max-w-4xl gap-3 text-center sm:grid-cols-3">
        {['Files auto-delete after 24 hours', 'Secure HTTPS upload', 'No account needed for 5 conversions a day'].map((t) => (
          <div key={t} className="flex items-center justify-center gap-2 rounded-card border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink">
            <Check className="h-4 w-4 shrink-0 text-success" aria-hidden /> {t}
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold text-ink">How to convert {from.label} to {to.label}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { n: '1', t: `Upload your ${from.label} file`, b: `Drop it in the tool above or browse your files. ${from.label} files are detected automatically.` },
            { n: '2', t: 'Adjust the settings', b: `Tune quality, compression, or format options for ${to.label} — or leave the recommended defaults.` },
            { n: '3', t: `Download your ${to.label} file`, b: 'Press Convert all, then download each file or everything together as a ZIP.' },
          ].map((s) => (
            <Card key={s.n} className="p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-base font-extrabold text-primary">{s.n}</span>
              <h3 className="mt-3 text-base font-bold text-ink">{s.t}</h3>
              <p className="mt-1 text-sm text-muted">{s.b}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-bold text-ink">What is {from.label}?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{from.description} Common uses: {from.uses}.</p>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-bold text-ink">What is {to.label}?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{to.description} Common uses: {to.uses}.</p>
        </Card>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold text-ink">{from.label} vs {to.label}</h2>
        <div className="mt-4 overflow-x-auto rounded-card-lg border border-line bg-surface">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead><tr className="border-b border-line bg-soft/60">
              <th className="px-4 py-3 font-bold text-ink">Feature</th>
              <th className="px-4 py-3 font-bold text-ink">{from.label}</th>
              <th className="px-4 py-3 font-bold text-ink">{to.label}</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-line"><td className="px-4 py-3 font-semibold text-ink">Category</td><td className="px-4 py-3 text-muted">{from.category}</td><td className="px-4 py-3 text-muted">{to.category}</td></tr>
              <tr className="border-b border-line"><td className="px-4 py-3 font-semibold text-ink">Description</td><td className="px-4 py-3 text-muted">{from.description}</td><td className="px-4 py-3 text-muted">{to.description}</td></tr>
              <tr><td className="px-4 py-3 font-semibold text-ink">Common uses</td><td className="px-4 py-3 text-muted">{from.uses}</td><td className="px-4 py-3 text-muted">{to.uses}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold text-ink">{to.label} settings explained</h2>
        <div className="mt-4 space-y-3">
          {from.category === 'Images' && <>
            <Card className="p-5"><h3 className="font-bold text-ink">Quality (recommended: 85%)</h3><p className="mt-1 text-sm text-muted">Quality and compression are separate controls. Quality applies to JPG, WebP, and AVIF targets: higher quality means larger files. 85% is a good balance for photos; use 95% or higher for print.</p></Card>
            <Card className="p-5"><h3 className="font-bold text-ink">Compression (PNG)</h3><p className="mt-1 text-sm text-muted">For PNG targets, compression is a separate 0–9 slider. PNG compression is lossless, so a higher value makes a smaller file with no loss of image quality. The default is 6; use 9 for the smallest file.</p></Card>
            <Card className="p-5"><h3 className="font-bold text-ink">Strip metadata</h3><p className="mt-1 text-sm text-muted">Removes EXIF data including GPS location. On by default for privacy.</p></Card>
          </>}
          {from.category === 'Audio' && <>
            <Card className="p-5"><h3 className="font-bold text-ink">Bitrate (recommended: 192 kbps)</h3><p className="mt-1 text-sm text-muted">Higher bitrates sound better but make larger files. 192 kbps is recommended for music.</p></Card>
            <Card className="p-5"><h3 className="font-bold text-ink">Channels</h3><p className="mt-1 text-sm text-muted">Stereo keeps two channels; Mono halves the file size and suits voice recordings.</p></Card>
            <Card className="p-5"><h3 className="font-bold text-ink">Sample rate</h3><p className="mt-1 text-sm text-muted">44,100 Hz is CD quality and the recommended default; 48,000 Hz is used for video work.</p></Card>
          </>}
          {from.category === 'Video' && <>
            <Card className="p-5"><h3 className="font-bold text-ink">Codec (recommended: H.264)</h3><p className="mt-1 text-sm text-muted">H.264 plays on every device. VP9 gives smaller files for the web.</p></Card>
            <Card className="p-5"><h3 className="font-bold text-ink">CRF (recommended: 23)</h3><p className="mt-1 text-sm text-muted">Lower CRF means better quality and larger files. 18 is near-lossless, 28 is compact.</p></Card>
            <Card className="p-5"><h3 className="font-bold text-ink">Resolution preset</h3><p className="mt-1 text-sm text-muted">Downscale to 1080p or 720p for faster uploads and smaller files, or keep Original.</p></Card>
          </>}
          {from.category !== 'Images' && from.category !== 'Audio' && from.category !== 'Video' && <>
            <Card className="p-5"><h3 className="font-bold text-ink">Defaults</h3><p className="mt-1 text-sm text-muted">This conversion uses sensible defaults for {to.label} output. Page range and DPI options are available for PDF conversions.</p></Card>
          </>}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold text-ink">Ways to use this converter</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {useCases.map((u) => (
            <Card key={u.title} className="p-5"><h3 className="font-bold text-ink">{u.title}</h3><p className="mt-1 text-sm text-muted">{u.body}</p></Card>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold text-ink">Common problems and fixes</h2>
        <div className="mt-6"><Accordion items={problems} /></div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold text-ink">Related converters</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{from.label} to …</h3>
            <ul className="space-y-2">
              {relatedFrom.map((p) => { const t = formatBySlug(p.to)!; return <li key={p.slug}><Link href={`/convert/${p.slug}`} className="text-sm font-semibold text-primary hover:underline">{from.label} to {t.label}</Link></li>; })}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">… to {to.label}</h3>
            <ul className="space-y-2">
              {relatedTo.map((p) => { const s = formatBySlug(p.from)!; return <li key={p.slug}><Link href={`/convert/${p.slug}`} className="text-sm font-semibold text-primary hover:underline">{s.label} to {to.label}</Link></li>; })}
            </ul>
          </div>
        </div>
      </section>

      <AdFrame slot="pair_mid" />

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold text-ink">{from.label} to {to.label} — FAQ</h2>
        <div className="mt-6"><Accordion items={faqs} /></div>
      </section>

      <AdFrame slot="pair_bottom" />

      <section className="mt-12 mb-6">
        <div className="rounded-card-xl bg-primary px-6 py-10 text-center text-white">
          <h2 className="text-2xl font-extrabold">Need more than 5 conversions a day?</h2>
          <p className="mx-auto mt-2 max-w-xl text-indigo-100">A free account gives you 25 conversions a day and keeps your conversion history.</p>
          <Link href="/login?mode=register" className="mt-6 inline-flex min-h-[48px] items-center rounded-card bg-white px-6 text-sm font-bold text-primary hover:bg-indigo-50">Create a free account</Link>
        </div>
      </section>
    </div>
  </>;
}
