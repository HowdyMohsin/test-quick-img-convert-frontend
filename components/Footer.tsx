import Link from 'next/link';
import { brand } from '@/lib/brand';
import { localCatalog } from '@/lib/catalog';

const popular = ['png-to-jpg', 'jpg-to-png', 'heic-to-jpg', 'pdf-to-png', 'mp4-to-mp3', 'webp-to-jpg', 'svg-to-png', 'mp3-to-wav'];

export function Footer() {
  return <footer className="border-t border-line bg-soft/60">
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <img src={brand.logo} alt={brand.name} className="h-8 w-auto" />
        <p className="mt-3 max-w-xs text-sm text-muted">{brand.tagline}</p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-ink">Popular converters</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {popular.map((slug) => {
            const [f, t] = slug.split('-to-');
            const from = localCatalog.formats.find((x) => x.slug === f);
            const to = localCatalog.formats.find((x) => x.slug === t);
            return <li key={slug}><Link className="text-muted hover:text-primary" href={`/convert/${slug}`}>{from?.label} to {to?.label}</Link></li>;
          })}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-bold text-ink">Product</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><Link className="text-muted hover:text-primary" href="/#formats">All converters</Link></li>
          <li><Link className="text-muted hover:text-primary" href="/pricing">Pricing</Link></li>
          <li><Link className="text-muted hover:text-primary" href="/account">Account</Link></li>
          <li><Link className="text-muted hover:text-primary" href="/contact">Contact</Link></li>
          <li><Link className="text-muted hover:text-primary" href="/status">API Status</Link></li>
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-bold text-ink">Legal</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><Link className="text-muted hover:text-primary" href="/privacy-policy">Privacy Policy</Link></li>
          <li><Link className="text-muted hover:text-primary" href="/terms">Terms of Service</Link></li>
          <li><Link className="text-muted hover:text-primary" href="/ads.txt">ads.txt</Link></li>
        </ul>
        <p className="mt-4 text-sm text-muted">Support: <a className="font-semibold text-primary" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a></p>
      </div>
    </div>
    <div className="border-t border-line py-4 text-center text-xs text-muted">© {new Date().getFullYear()} {brand.name}. Files are deleted automatically after 24 hours.</div>
  </footer>;
}
