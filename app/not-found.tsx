import Link from 'next/link';
import { localCatalog } from '@/lib/catalog';
import { HeroPicker } from '@/components/HeroPicker';

const popular = ['png-to-jpg', 'jpg-to-png', 'heic-to-jpg', 'pdf-to-png', 'mp4-to-mp3', 'webp-to-jpg'];

export default function NotFound() {
  return <div className="mx-auto max-w-3xl px-4 py-16 text-center">
    <h1 className="text-4xl font-extrabold text-ink">Page not found</h1>
    <p className="mt-2 text-muted">That page does not exist — but the converter you need probably does. Pick your formats below.</p>
    <div className="mt-8 text-left"><HeroPicker catalog={localCatalog} /></div>
    <h2 className="mt-10 text-lg font-bold text-ink">Popular converters</h2>
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {popular.map((slug) => {
        const [f, t] = slug.split('-to-');
        const from = localCatalog.formats.find((x) => x.slug === f);
        const to = localCatalog.formats.find((x) => x.slug === t);
        return <Link key={slug} href={`/convert/${slug}`} className="rounded-full border border-line bg-surface px-3 py-2 text-sm font-semibold text-primary">{from?.label} to {to?.label}</Link>;
      })}
    </div>
    <p className="mt-8"><Link href="/" className="font-semibold text-primary underline">Back to home</Link></p>
  </div>;
}
