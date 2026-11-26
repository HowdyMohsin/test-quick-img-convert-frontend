import type { Metadata } from 'next';
import { brand } from '@/lib/brand';
import { Container } from '@/components/ui';
export const metadata: Metadata = { title: 'Privacy Policy', description: `Privacy Policy for ${brand.name}.` };
export default function PrivacyPolicyPage() {
  return <Container as="article" className="py-10 prose prose-slate"><div className="mx-auto max-w-3xl">
    <h1 className="text-3xl font-extrabold text-ink">Privacy Policy</h1>
    <p className="mt-2 text-sm text-muted">Last updated: 24 November 2026. This policy explains what we collect, why, and what you can do about it. It should be reviewed by a qualified lawyer before launch.</p>
    <section className="mt-8 space-y-4 text-sm leading-relaxed text-muted">
      <h2 className="text-lg font-bold text-ink">1. Files you convert</h2>
      <p>Files you upload are processed only to perform the conversion you asked for. Uploads and outputs are stored on our servers for at most 24 hours and then deleted automatically. We do not share your files with anyone, and we do not use them to train models or for advertising.</p>
      <h2 className="text-lg font-bold text-ink">2. What we log</h2>
      <p>We log the minimum needed to run the service: conversion events (format pair, file sizes, success or failure, duration), quota usage, and security events such as failed sign-ins. We do not log passwords, tokens, or full email addresses in logs. IP addresses are used for abuse prevention and quota enforcement for anonymous visitors and are not sold.</p>
      <h2 className="text-lg font-bold text-ink">3. Accounts</h2>
      <p>If you create an account, we store your name, email address, password hash (Argon2id), plan, and conversion history for 90 days. You can export your data or delete your account at any time from your account page; deletion anonymizes your personal data and removes your files immediately.</p>
      <h2 className="text-lg font-bold text-ink">4. Cookies</h2>
      <p>We use a session cookie to keep you signed in, a signed device cookie to enforce the anonymous daily quota, and a consent cookie to remember your advertising choice. No third-party tracking cookies are set by us directly.</p>
      <h2 className="text-lg font-bold text-ink">5. Advertising partners and consent</h2>
      <p>We show ads from Google AdSense and Adsterra to anonymous and free-plan users. These partners may use cookies and device information to serve ads. In the EEA, UK, and Switzerland, ads load only after you give consent through our consent message; otherwise non-personalized ads are served. You can change your choice at any time by clearing the consent cookie. See our ads.txt file for the list of authorized sellers.</p>
      <h2 className="text-lg font-bold text-ink">6. Payment processors</h2>
      <p>Payments are processed by the provider you choose (for example Paddle, Lemon Squeezy, or your bank / mobile wallet for manual payments). We store payment references, amounts, and receipts for accounting, but we never see or store your card details. Manual payment proofs are stored outside the public web path.</p>
      <h2 className="text-lg font-bold text-ink">7. Data export and deletion</h2>
      <p>You can export your profile, conversion history, and payments as JSON from your account settings, and you can delete your account there too. Payment records are kept in anonymized form for accounting after deletion.</p>
      <h2 className="text-lg font-bold text-ink">8. Children</h2>
      <p>This service is not directed at children under 16, and we do not knowingly collect personal data from them. If you believe a child has provided personal data, contact us and we will remove it.</p>
      <h2 className="text-lg font-bold text-ink">9. Contact</h2>
      <p>For privacy questions, email <a className="font-semibold text-primary" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.</p>
    </section>
  </div>
  </Container>;
}
