'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch, fetchMe, type MeResponse } from '@/lib/api';
import { brand } from '@/lib/brand';
import { Button, Card, CopyField, Input, Modal, Segmented, Toast, Accordion, Badge } from '@/components/ui';
import { Check } from 'lucide-react';
import { Suspense } from 'react';

interface Plan { id: string; name: string; price_cents: number; price_yearly_cents: number; limits: any; featured?: number }

// Paddle checkout (client-side Paddle.js). Sandbox mode is selected by the
// backend when the stored client token is a sandbox ("test_…") token;
// live tokens open the production checkout. The webhook is the source of
// truth — a completed payment returns here and the plan activates.
function loadPaddleJs(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Checkout is not available.'));
  const w = window as any;
  if (w.Paddle) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the Paddle checkout — check your connection and try again.'));
    document.head.appendChild(s);
  });
}

async function openPaddleCheckout(res: any, email?: string | null): Promise<void> {
  await loadPaddleJs();
  const Paddle = (window as any).Paddle;
  if (!Paddle) throw new Error('Could not load the Paddle checkout.');
  Paddle.Environment.set(res.sandbox ? 'sandbox' : 'production');
  Paddle.Initialize({ token: res.client_token });
  Paddle.Checkout.open({
    items: [{ priceId: res.price_id, quantity: 1 }],
    ...(email ? { customer: { email } } : {}),
    customData: res.custom_data || {},
    settings: { successUrl: `${window.location.origin}/pricing?success=1` },
  });
}

function PricingInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [coupon, setCoupon] = useState('');
  const [couponInfo, setCouponInfo] = useState<any>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [picker, setPicker] = useState<Plan | null>(null);
  const [providerKey, setProviderKey] = useState('');
  const [manual, setManual] = useState<any>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyPrompt, setVerifyPrompt] = useState(false);
  // TEMPORARY (test-only): whether the backend requires email
  // verification before checkout. Defaults true (verification ON);
  // the backend sends false only when REQUIRE_EMAIL_VERIFICATION=false.
  const [requireVerification, setRequireVerification] = useState(true);

  useEffect(() => {
    fetchMe().then(setMe);
    fetch('/api/v1/site', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.plans) setPlans(d.plans.filter((p: any) => p.active !== false && p.name.toLowerCase() !== 'anonymous')); if (typeof d?.require_email_verification === 'boolean') setRequireVerification(d.require_email_verification); setLoading(false); })
      .catch(() => setLoading(false));
    fetch('/api/v1/payments/config', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.providers) setProviders(d.providers); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (params.get('success')) setToast('Payment completed — your plan has been upgraded.');
    if (params.get('cancelled')) setToast('Checkout was cancelled. No payment was taken.');
  }, [params]);

  const price = (p: Plan) => {
    const cents = interval === 'monthly' ? p.price_cents : p.price_yearly_cents;
    let v = cents / 100;
    if (couponInfo?.type === 'percent') v = v * (1 - couponInfo.value / 100);
    if (couponInfo?.type === 'fixed') v = Math.max(0, v - couponInfo.value / 100);
    return v;
  };

  const validateCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const res = await apiFetch<{ valid: boolean; code: string; type: string; value: number; message?: string }>('/v1/payments/coupons/validate', { method: 'POST', body: { code: coupon.trim() } });
      if (res.valid) { setCouponInfo(res); setToast(`Coupon ${res.code} applied.`); }
      else setToast(res.message || 'That coupon is not valid for this plan.');
    } catch (e: any) { setToast(e?.message || 'Coupon could not be validated.'); }
  };

  const startCheckout = (p: Plan) => {
    if (!me?.user) { router.push(`/login?next=/pricing`); return; }
    // TEMPORARY (test-only): the "Verify your email first" gate applies
    // only while the backend requires email verification
    // (REQUIRE_EMAIL_VERIFICATION=true, the default). When the flag is
    // off, unverified users check out like everyone else.
    if (requireVerification && me.user.email_verified_at == null) { setVerifyPrompt(true); return; }
    setPicker(p);
  };

  const confirmProvider = async () => {
    if (!picker || !providerKey) return;
    const provider = providers.find((x) => x.key === providerKey);
    if (!provider) return;
    try {
      if (provider.flow === 'auto') {
        const res = await apiFetch<any>('/v1/payments/checkout', { method: 'POST', body: { plan: picker.id, interval, provider: providerKey, coupon: couponInfo?.code } });
        // Paddle opens its own overlay (sandbox when the stored token is
        // a test token); Stripe / Lemon Squeezy redirect to a hosted URL.
        if (res.mode === 'paddle_js') { await openPaddleCheckout(res, me?.user?.email); return; }
        const url = res.checkout_url || res.url;
        if (url) window.location.href = url; else setToast('Checkout could not be started.');
      } else if (provider.flow === 'link') {
        window.open(provider.payment_url || provider.url, '_blank', 'noopener');
        setManual({ provider, link: true });
      } else {
        const res = await apiFetch<any>('/v1/payments/checkout', { method: 'POST', body: { plan: picker.id, interval, provider: providerKey, coupon: couponInfo?.code } });
        setManual({ provider, instructions: res.instructions || res });
      }
    } catch (e: any) { setToast(e?.message || 'Checkout could not be started.'); }
  };

  const submitManual = async () => {
    if (!reference.trim()) { setToast('A payment reference is required.'); return; }
    try {
      await apiFetch('/v1/payments/manual/submit', { method: 'POST', body: { plan: picker!.id, interval, provider: providerKey, reference: reference.trim(), note, coupon: couponInfo?.code } });
      setPending(true);
      setManual(null);
      setPicker(null);
    } catch (e: any) { setToast(e?.message || 'Could not submit the payment reference.'); }
  };

  const planCards = plans.length ? plans : [
    { id: 'free', name: 'Free', price_cents: 0, price_yearly_cents: 0, limits: { daily: 25, batch: 10, img_mb: 200, ads: true } },
    { id: 'basic', name: 'Basic', price_cents: 400, price_yearly_cents: 4000, limits: { daily: 100, batch: 30, img_mb: 500, ads: false } },
    { id: 'pro', name: 'Pro', price_cents: 900, price_yearly_cents: 9000, limits: { daily: 2000, batch: 100, img_mb: 2048, ads: false } },
  ];

  return <div className="mx-auto max-w-7xl px-4 py-10">
    <div className="text-center">
      <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Pricing</h1>
      <p className="mx-auto mt-2 max-w-xl text-muted">Start free. Upgrade when you need more conversions, bigger files, and no ads.</p>
      <div className="mt-6 flex justify-center">
        <Segmented ariaLabel="Billing interval" value={interval} onChange={setInterval} options={[
          { value: 'monthly', label: 'Monthly' },
          { value: 'yearly', label: 'Yearly · 2 months free' },
        ]} />
      </div>
    </div>

    {verifyPrompt && (
      <div className="mx-auto mt-6 max-w-3xl rounded-card border border-warn/40 bg-amber-50 p-4 text-sm">
        <p className="font-bold text-ink">Verify your email first</p>
        <p className="mt-1 text-muted">Please verify your email address before starting a checkout. Check your inbox for the verification link, or resend it from your account page.</p>
      </div>
    )}
    {pending && (
      <div className="mx-auto mt-6 max-w-3xl rounded-card border border-success/40 bg-green-50 p-4 text-sm">
        <p className="font-bold text-ink">Payment submitted — pending approval</p>
        <p className="mt-1 text-muted">Your payment request is pending. Approval usually takes up to 24 hours. You can track it in your account under Plan and billing.</p>
      </div>
    )}

    <div className="mt-8 grid gap-4 md:grid-cols-3">
      {loading ? <p className="text-muted">Loading plans…</p> : planCards.map((p) => {
        const l = p.limits || {};
        const isCurrent = me?.user?.plan === p.id;
        return <Card key={p.id} className={`flex flex-col p-6 ${p.featured ? 'border-primary ring-2 ring-primary/30' : ''}`}>
          {p.featured ? <Badge tone="primary" className="self-start">Most popular</Badge> : null}
          <h2 className="mt-2 text-xl font-bold text-ink">{p.name}</h2>
          <p className="mt-2">
            {couponInfo && p.price_cents > 0 && <span className="mr-2 text-lg text-muted line-through">${(interval === 'monthly' ? p.price_cents : p.price_yearly_cents) / 100}</span>}
            <span className="text-4xl font-extrabold text-ink">${price(p)}</span>
            <span className="text-muted">/{interval === 'monthly' ? 'month' : 'year'}</span>
          </p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-muted">
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{l.daily ?? '—'} conversions per day</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{l.batch ?? '—'} files per batch</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />Up to {l.img_mb ?? '—'} MB images</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{l.vid_mb ?? '—'} MB video</li>
            {!l.ads && <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />No ads</li>}
            {l.ads && <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />Ads shown</li>}
            {l.priority && <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />Priority processing</li>}
          </ul>
          <Button className="mt-6 w-full" variant={isCurrent ? 'secondary' : 'primary'} disabled={isCurrent || p.price_cents === 0 && p.id === 'free' && !me?.user} onClick={() => startCheckout(p)}>
            {isCurrent ? 'Current plan' : p.price_cents === 0 ? 'Get started free' : 'Upgrade'}
          </Button>
        </Card>;
      })}
    </div>

    <div className="mx-auto mt-8 flex max-w-md gap-2">
      <Input aria-label="Coupon code" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
      <Button variant="secondary" onClick={validateCoupon}>Apply</Button>
    </div>
    {couponInfo && <p className="mt-2 text-center text-sm font-semibold text-success">Coupon {couponInfo.code} applied — {couponInfo.type === 'percent' ? `${couponInfo.value}% off` : `$${couponInfo.value / 100} off`} the first payment.</p>}

    <p className="mt-6 text-center text-sm text-muted">Manual payments (JazzCash, EasyPaisa, bank, USDT) are approved within 24 hours. Automatic providers activate instantly.</p>

    <section className="mx-auto mt-12 max-w-3xl">
      <h2 className="text-2xl font-extrabold text-ink">Pricing FAQ</h2>
      <div className="mt-4"><Accordion items={[
        { q: 'Can I cancel my subscription?', a: 'Yes. Cancel anytime from your account under Plan and billing. You keep the paid plan until the end of the current period, then move to the free plan.' },
        { q: 'How do refunds work?', a: 'If a payment was made in error, contact support with your receipt number. Refunds are reviewed case by case and issued through the original payment method where possible.' },
        { q: 'How long does manual payment approval take?', a: 'Manual payments (JazzCash, EasyPaisa, bank transfer, USDT) are reviewed by the team, usually within 24 hours. You will be notified in the app and by email when your plan is activated.' },
        { q: 'Which wallets and payment methods do you accept?', a: 'JazzCash, EasyPaisa, local bank transfer, USDT (TRC20), and Payoneer, plus automatic card checkout through Paddle and Lemon Squeezy where available.' },
      ]} /></div>
    </section>

    <Modal open={!!picker && !manual} onClose={() => setPicker(null)} title={`Choose how to pay — ${picker?.name}`}>
      <p className="text-sm text-muted">Plan: <strong className="text-ink">{picker?.name}</strong> · {interval} · <strong className="text-ink">${picker ? price(picker) : 0}</strong></p>
      {providers.length === 0 && <p className="mt-4 text-sm text-muted">Payment providers are being configured. Please check back shortly or contact support.</p>}
      <div className="mt-4 space-y-2" role="radiogroup" aria-label="Payment provider">
        {providers.map((p) => (
          <label key={p.key} className={`flex cursor-pointer items-center gap-3 rounded-card border p-3 ${providerKey === p.key ? 'border-primary ring-2 ring-primary/30' : 'border-line'}`}>
            <input type="radio" name="provider" checked={providerKey === p.key} onChange={() => setProviderKey(p.key)} className="h-5 w-5 accent-[#4F46E5]" />
            <span className="flex-1">
              <span className="block text-sm font-bold text-ink">{p.label}</span>
              <span className="block text-xs text-muted">{p.flow === 'auto' ? 'Instant activation' : p.flow === 'link' ? 'Opens payment link in a new tab' : 'Approval within 24 hours'}</span>
            </span>
            <Badge tone={p.flow === 'auto' ? 'success' : 'soft'}>{p.flow === 'auto' ? 'Instant' : 'Manual'}</Badge>
          </label>
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        <Button disabled={!providerKey} onClick={confirmProvider}>Continue</Button>
        <Button variant="secondary" onClick={() => setPicker(null)}>Cancel</Button>
      </div>
    </Modal>

    <Modal open={!!manual} onClose={() => setManual(null)} title="Complete your manual payment">
      {manual?.instructions && (
        <div className="space-y-3 text-sm">
          <p className="text-muted">Pay <strong className="text-ink">{manual.instructions.display_amount || `$${picker ? price(picker) : 0}`}</strong> using the details below, then submit your reference.</p>
          {(manual.instructions.fields || []).map((f: any) => <CopyField key={f.label} label={f.label} value={f.value} />)}
          {manual.instructions.account && <CopyField label="Account" value={manual.instructions.account} />}
          {manual.instructions.address && <CopyField label="Address" value={manual.instructions.address} />}
          {manual.instructions.text && <p className="whitespace-pre-wrap text-muted">{manual.instructions.text}</p>}
        </div>
      )}
      {manual?.link && <p className="text-sm text-muted">The payment page opened in a new tab. After paying, submit your transaction reference below.</p>}
      <div className="mt-4 space-y-3">
        <Input label="Payment reference" placeholder="Transaction ID or reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        <Input label="Note (optional)" placeholder="Anything we should know" value={note} onChange={(e) => setNote(e.target.value)} />
        <label className="block text-sm font-semibold text-ink">Proof of payment (optional, JPG/PNG/PDF, up to 5 MB)
          <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="mt-1 block w-full text-sm" />
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        <Button onClick={submitManual}>Submit payment</Button>
        <Button variant="secondary" onClick={() => setManual(null)}>Cancel</Button>
      </div>
    </Modal>
    {toast && <Toast message={toast} onClose={() => setToast(null)} />}
  </div>;
}

export default function PricingPage() {
  return <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10 text-muted">Loading pricing…</div>}><PricingInner /></Suspense>;
}
