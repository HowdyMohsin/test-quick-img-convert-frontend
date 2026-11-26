import type { Metadata } from 'next';
import { brand } from '@/lib/brand';
export const metadata: Metadata = { title: 'Terms of Service', description: `Terms of Service for ${brand.name}.` };
export default function TermsPage() {
  return <article className="mx-auto max-w-3xl px-4 py-10">
    <h1 className="text-3xl font-extrabold text-ink">Terms of Service</h1>
    <p className="mt-2 text-sm text-muted">Last updated: 24 November 2026. These terms should be reviewed by a qualified lawyer before launch.</p>
    <section className="mt-8 space-y-4 text-sm leading-relaxed text-muted">
      <h2 className="text-lg font-bold text-ink">1. The service</h2>
      <p>{brand.name} converts files between supported formats. Anonymous visitors may convert 5 files per day; registered free accounts may convert 25 per day; paid plans raise these limits as shown on the pricing page.</p>
      <h2 className="text-lg font-bold text-ink">2. Your files</h2>
      <p>You are responsible for the files you upload. Do not upload files you do not have the right to convert, or files that are unlawful. Uploads and outputs are deleted automatically after 24 hours.</p>
      <h2 className="text-lg font-bold text-ink">3. Accounts</h2>
      <p>You are responsible for keeping your password secret. We may suspend or ban accounts that abuse the service, attempt to bypass limits, or upload unlawful content, with a reason shown to the account holder.</p>
      <h2 className="text-lg font-bold text-ink">4. Paid plans and refunds</h2>
      <p>Paid plans are billed per the interval you choose. Subscriptions renew until cancelled; cancelling keeps the plan until the end of the current period. Manual payments are approved within 24 hours. Refund requests are reviewed case by case — contact support with your receipt number.</p>
      <h2 className="text-lg font-bold text-ink">5. Fair use and limits</h2>
      <p>File size, batch, and daily limits are enforced per plan. We may rate-limit abusive traffic. Conversions are counted when a job is accepted and refunded automatically if the job fails before starting.</p>
      <h2 className="text-lg font-bold text-ink">6. Availability and liability</h2>
      <p>The service is provided “as is” without warranties. We are not liable for loss of files, conversion errors, or service interruptions. Keep your own copies of important files.</p>
      <h2 className="text-lg font-bold text-ink">7. Changes</h2>
      <p>We may update these terms; the latest version is always published here. Continued use after a change means you accept the new terms.</p>
      <h2 className="text-lg font-bold text-ink">8. Governing law and contact</h2>
      <p>These terms are governed by the laws of Pakistan. Contact: <a className="font-semibold text-primary" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.</p>
    </section>
  </article>;
}
