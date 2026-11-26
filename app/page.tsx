import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/lib/brand';
import { getCatalog } from '@/lib/catalog';
import { HeroPicker } from '@/components/HeroPicker';
import { AllFormats } from '@/components/AllFormats';
import { AdFrame } from '@/components/AdFrame';
import { Accordion, Card } from '@/components/ui';

export const metadata: Metadata = {
  title: { absolute: `${brand.homeH1} | ${brand.name}` },
  description: brand.tagline,
  alternates: { canonical: '/' },
};

export const revalidate = 3600;

const FAQ = [
  { q: 'Is this file converter really free?', a: 'Yes. Anonymous visitors can convert 5 files a day for free, and a free account raises that to 25 a day with conversion history. Paid plans remove ads and raise the limits further.' },
  { q: 'Do I need to create an account?', a: 'No. You can convert files right away without signing up. An account is only needed for higher daily limits, history, and paid plans.' },
  { q: 'Are my files safe?', a: 'Uploads travel over secure HTTPS and every file is deleted automatically after 24 hours. We never share your files with anyone.' },
  { q: 'What formats can I convert?', a: 'Images, camera RAW files, audio, video, PDF, SVG, and PSD — hundreds of conversion pairs in total, listed in the All Formats section below.' },
  { q: 'Can I convert several files at once?', a: 'Yes. Batch conversion is supported on every converter page, and you can download all results together as a ZIP.' },
];

export default async function HomePage() {
  const { catalog } = await getCatalog();
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:pt-14">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">{brand.homeH1}</h1>
        <p className="mt-3 text-lg text-muted">{brand.tagline}</p>
      </div>
      <div className="mx-auto mt-8 max-w-3xl"><HeroPicker catalog={catalog} showUploadBox /></div>
      <div className="mx-auto mt-8 grid max-w-4xl gap-3 text-center sm:grid-cols-3">
        {['Files auto-delete after 24 hours', 'Secure HTTPS upload', 'No account needed for 5 conversions a day'].map((t) => (
          <div key={t} className="flex items-center justify-center gap-2 rounded-card border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink">
            <span aria-hidden className="text-success">✓</span> {t}
          </div>
        ))}
      </div>
    </section>
    <AdFrame slot="home_top" />
    <section id="formats" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-10">
      <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">All formats</h2>
      <p className="mt-2 text-muted">Every converter we offer — pick a format to see where it converts to.</p>
      <div className="mt-6"><AllFormats catalog={catalog} /></div>
    </section>
    <AdFrame slot="home_mid" />
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">How it works</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { n: '1', t: 'Pick your formats', b: 'Choose what you are converting from and to — the picker only shows combinations that work. Or drop a file and we detect its format for you.' },
          { n: '2', t: 'Drop your files', b: 'Upload on the converter page, adjust quality or size if you like, and press Convert all.' },
          { n: '3', t: 'Download the result', b: 'Download each file, or everything at once as a ZIP. Files delete themselves after 24 hours.' },
        ].map((s) => (
          <Card key={s.n} className="p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-base font-extrabold text-primary">{s.n}</span>
            <h3 className="mt-3 text-base font-bold text-ink">{s.t}</h3>
            <p className="mt-1 text-sm text-muted">{s.b}</p>
          </Card>
        ))}
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">Why use {brand.name}?</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { t: 'Fast conversions', b: 'Files convert on fast servers while the next one uploads — no waiting in line.' },
          { t: 'Batch conversion', b: 'Convert up to 100 files in one batch on Pro, and download them all as a ZIP.' },
          { t: 'Private by default', b: 'HTTPS uploads and automatic deletion after 24 hours. No file is ever shared.' },
          { t: 'Works everywhere', b: 'No software to install. Convert from any browser on Windows, Mac, Linux, iOS, or Android.' },
        ].map((f) => (
          <Card key={f.t} className="p-5"><h3 className="text-base font-bold text-ink">{f.t}</h3><p className="mt-1 text-sm text-muted">{f.b}</p></Card>
        ))}
      </div>
    </section>
    <section className="mx-auto max-w-4xl px-4 py-10">
      <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">Frequently asked questions</h2>
      <div className="mt-6"><Accordion items={FAQ} /></div>
    </section>
    <AdFrame slot="home_bottom" />
    <section className="mx-auto max-w-7xl px-4 pb-14">
      <div className="rounded-card-xl bg-primary px-6 py-10 text-center text-white">
        <h2 className="text-2xl font-extrabold sm:text-3xl">Convert more, with no ads</h2>
        <p className="mx-auto mt-2 max-w-xl text-indigo-100">Pro gives you 2,000 conversions a day, 100 files per batch, priority processing, and an ad-free experience.</p>
        <Link href="/pricing" className="mt-6 inline-flex min-h-[48px] items-center rounded-card bg-white px-6 text-sm font-bold text-primary hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">See pricing</Link>
      </div>
    </section>
  </>;
}
