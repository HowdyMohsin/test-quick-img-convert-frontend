'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { brand } from '@/lib/brand';

// Shared split-screen auth design (reference: deepseek_html_20261126_93c95f.html).
// Raleway, blue gradient #0a4aa6 → #1b78e6 → #2b9bff, 42% blue visual panel
// with wave decorations / 58% white form panel, 1000px card, 22px radius.
// Mobile: single column, visual on top with the horizontal wave, form below.
// This file is PRESENTATION ONLY — every page keeps its own real auth logic
// (apiFetch endpoints, captcha, OTP screens) and only renders through it.

// ---- Wave decorations (copied from the reference design) ----
function WaveVertical() {
  return <svg className="pointer-events-none absolute -left-[44px] top-0 hidden h-full w-[112px] lg:block" viewBox="0 0 112 600" preserveAspectRatio="none" aria-hidden="true">
    <path d="M112 0H30C8 45 44 70 26 118S42 205 24 255 40 340 22 392 40 478 22 530 34 580 30 600H112Z" fill="rgba(255,255,255,.28)" />
    <path transform="translate(16 0)" d="M112 0H30C8 45 44 70 26 118S42 205 24 255 40 340 22 392 40 478 22 530 34 580 30 600H112Z" fill="rgba(255,255,255,.5)" />
    <path transform="translate(34 0)" d="M112 0H30C8 45 44 70 26 118S42 205 24 255 40 340 22 392 40 478 22 530 34 580 30 600H112Z" fill="#fff" />
  </svg>;
}

function WaveHorizontal() {
  return <svg className="absolute bottom-[-1px] left-0 block h-[60px] w-full lg:hidden" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 30C60 5 120 40 190 22S320 38 400 14V60H0Z" fill="rgba(255,255,255,.28)" />
    <path d="M0 40C70 20 130 48 200 34S330 46 400 30V60H0Z" fill="rgba(255,255,255,.5)" />
    <path d="M0 50C80 36 140 56 210 46S340 54 400 44V60H0Z" fill="#fff" />
  </svg>;
}

// ---- Layout ----
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="font-raleway grid min-h-[calc(100vh-4rem)] place-items-center bg-[#e6e9ef] px-3.5 py-8 sm:p-8">
    <div className="w-full max-w-[1000px] overflow-hidden rounded-[22px] bg-white shadow-[0_24px_60px_rgba(20,40,90,.22)] lg:grid lg:min-h-[660px] lg:grid-cols-[42%_58%]">
      <aside className="relative flex flex-col items-center justify-between bg-[linear-gradient(180deg,#0a4aa6_0%,#1b78e6_58%,#2b9bff_100%)] px-6 pb-[78px] pt-[30px] text-center text-white lg:px-[34px] lg:pb-7 lg:pt-12">
        <div>
          <div className="text-[21px] font-semibold tracking-[0.01em]">Welcome to</div>
          <div className="mx-auto my-4 grid h-16 w-16 place-items-center rounded-full bg-white shadow-[0_8px_20px_rgba(5,30,90,.25)] lg:my-[22px] lg:h-[78px] lg:w-[78px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="Quick IMG Convert logo" className="h-8 w-8 lg:h-10 lg:w-10" />
          </div>
          <div className="text-[22px] font-bold">{brand.name}</div>
          <p className="mx-auto mt-[26px] hidden max-w-[30ch] text-[13px] leading-[1.7] text-[#d4e4ff] lg:block">Convert PNG, JPG and WEBP images in seconds. Smaller files, same quality, nothing to install.</p>
        </div>
        <div className="hidden items-center gap-3.5 text-xs text-[#cfe0ff] lg:flex">
          <Link href="/terms" className="font-semibold text-white hover:underline">Terms</Link>
          <i aria-hidden className="h-3.5 w-px bg-white/50" />
          <Link href="/privacy-policy" className="font-semibold text-white hover:underline">Privacy</Link>
        </div>
        <WaveHorizontal />
      </aside>
      <div className="relative flex flex-col justify-center px-6 pb-8 pt-2 sm:px-[60px] sm:pb-9 sm:pt-11 lg:py-9 lg:pl-[82px] lg:pr-[60px]">
        <WaveVertical />
        <div className="relative mx-auto w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  </div>;
}

// ---- Headings ----
export function AuthTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-center text-2xl font-bold tracking-[-0.01em] text-ink">{children}</h1>;
}

export function AuthSub({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-center text-sm leading-relaxed text-muted">{children}</p>;
}

// ---- Message box (error / info / ok) ----
export function AuthMsg({ kind, children }: { kind: 'error' | 'info' | 'ok'; children: React.ReactNode }) {
  const styles = {
    error: 'border-[#f6cbc8] bg-[#fdf0ef] text-[#c0322b]',
    info: 'border-[#c5dcfb] bg-[#eaf3ff] text-[#0a4aa6]',
    ok: 'border-[#b4e5cd] bg-[#e9f8f1] text-[#0c7a4d]',
  }[kind];
  return <div role="alert" aria-live="polite" className={`rounded-[10px] border px-3.5 py-[11px] text-[13px] leading-relaxed ${styles}`}>{children}</div>;
}

// ---- Underline field (label above, bottom border only, tick when valid) ----
export function AuthField({ label, error, valid, id, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; valid?: boolean }) {
  const inputId = id || rest.name;
  return <div className="w-full">
    <label htmlFor={inputId} className="block text-[15px] font-semibold text-ink">{label}</label>
    <div className="relative">
      <input id={inputId} aria-invalid={!!error} aria-describedby={error ? `${inputId}-err` : undefined}
        className="w-full border-0 border-b-2 border-[#9bd3f2] bg-transparent py-2 pl-0 pr-12 text-sm text-ink placeholder:text-[#8fb7cf] hover:border-[#6fbfe8] focus:border-[#0b52c4] focus:outline-none"
        {...rest} />
      {valid && <svg className="absolute bottom-[11px] right-[2px] h-4 w-4 fill-none stroke-[#0b52c4] stroke-[2.6] transition-opacity" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </div>
    {error && <p id={`${inputId}-err`} role="alert" className="mt-1.5 text-[12.5px] text-[#c0322b]">{error}</p>}
  </div>;
}

// Password strength, same scale as the reference design (4 levels).
function strengthOf(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  return p ? Math.max(s, 1) : 0;
}

export function AuthPasswordField({ label, error, id, showStrength, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; showStrength?: boolean }) {
  const [show, setShow] = useState(false);
  const value = String(rest.value || '');
  const s = showStrength ? strengthOf(value) : 0;
  const barColor = ['', '#e5484d', '#f5a524', '#2b9bff', '#12a46b'][s];
  return <div className="w-full">
    <label htmlFor={id} className="block text-[15px] font-semibold text-ink">{label}</label>
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} aria-invalid={!!error}
        className="w-full border-0 border-b-2 border-[#9bd3f2] bg-transparent py-2 pl-0 pr-12 text-sm text-ink placeholder:text-[#8fb7cf] hover:border-[#6fbfe8] focus:border-[#0b52c4] focus:outline-none"
        {...rest} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute bottom-1 right-0 h-7 rounded px-1 text-[12.5px] font-bold text-[#0b52c4] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b52c4]">{show ? 'Hide' : 'Show'}</button>
    </div>
    {showStrength && value ? (
      <div>
        <div className="mt-[9px] grid grid-cols-4 gap-[5px]" aria-hidden>
          {[0, 1, 2, 3].map((i) => <i key={i} className="h-1 rounded" style={{ background: i < s ? barColor : '#dbe6f2' }} />)}
        </div>
        <p className="mt-1 min-h-[15px] text-xs text-muted">{['', 'Weak', 'Fair', 'Good', 'Strong'][s]}</p>
      </div>
    ) : null}
    {error && <p role="alert" className="mt-1.5 text-[12.5px] text-[#c0322b]">{error}</p>}
  </div>;
}

// ---- Pill buttons ----
export function AuthPill({ variant = 'main', loading, disabled, children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'main' | 'alt'; loading?: boolean }) {
  const base = 'inline-flex h-[42px] min-w-[132px] items-center justify-center gap-2 rounded-[30px] px-[26px] text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b52c4] focus-visible:ring-offset-2 disabled:cursor-not-allowed';
  const styles = variant === 'main'
    ? 'border-0 bg-[linear-gradient(180deg,#2d8cff,#0b52c4)] text-white shadow-[0_8px_18px_rgba(11,82,196,.32)] hover:brightness-110 disabled:opacity-70'
    : 'border-2 border-[#c9cfda] bg-white text-[#7b8496] hover:border-[#0b52c4] hover:text-[#0b52c4]';
  return <button type="button" className={`${base} ${styles} ${className}`} disabled={disabled || loading} {...rest}>
    {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-[2.5px] border-white/40 border-t-white" aria-hidden />}
    {children}
  </button>;
}

// ---- Reset-code display box (TEMPORARY: the code is shown on screen until
// real e-mail OTP lands at the end — see the forgot-password page) ----
export function AuthCodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return <div className="rounded-[12px] border border-[#c5dcfb] bg-[#eaf3ff] px-4 py-4 text-center">
    <p className="text-xs font-semibold uppercase tracking-wide text-[#0a4aa6]">Your reset code</p>
    <p className="mt-1 text-[28px] font-extrabold leading-none tracking-[0.3em] text-[#0a4aa6]" aria-label={`Reset code ${code.split('').join(' ')}`}>{code}</p>
    <button type="button" onClick={copy} className="mt-3 text-xs font-bold text-[#0b52c4] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b52c4]">{copied ? 'Copied' : 'Copy code'}</button>
    <p className="mt-2 text-xs leading-relaxed text-muted">Temporary: this code is shown here for now. Later it will arrive by e-mail instead.</p>
  </div>;
}
