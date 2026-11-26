'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, File, FileText, Image as ImageIcon, Music, Upload, Video, X } from 'lucide-react';

// Shared body scroll lock with a counter: a Drawer and a Modal open at the
// same time cannot unlock the page early when one of them closes. The
// previous overflow value is restored instead of blindly clearing it.
let bodyLockCount = 0;
let bodyPrevOverflow = '';
function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (bodyLockCount === 0) {
    bodyPrevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyLockCount += 1;
}
function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0) document.body.style.overflow = bodyPrevOverflow;
}
function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [active]);
}

// ---- Button ----
export function Button({ children, variant = 'primary', loading, disabled, className = '', ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  const base = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-card px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
  const styles = {
    primary: 'bg-primary text-white hover:bg-primaryDark',
    secondary: 'bg-soft text-ink hover:bg-line border border-line',
    ghost: 'text-primary hover:bg-soft',
    danger: 'bg-danger text-white hover:bg-red-700',
  }[variant];
  return <button className={`${base} ${styles} ${className}`} disabled={disabled || loading} {...rest}>
    {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
    {children}
  </button>;
}

// ---- Input / Select / Textarea ----
export function Input({ label, error, hint, id, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }) {
  const inputId = id || rest.name;
  return <div className="w-full">
    {label && <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>}
    <input id={inputId} aria-invalid={!!error} aria-describedby={error ? `${inputId}-err` : undefined}
      className="min-h-[44px] w-full rounded-card border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-soft" {...rest} />
    {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
    {error && <p id={`${inputId}-err`} role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
  </div>;
}

export function Textarea({ label, error, id, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  const inputId = id || rest.name;
  return <div className="w-full">
    {label && <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>}
    <textarea id={inputId} aria-invalid={!!error}
      className="w-full rounded-card border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" {...rest} />
    {error && <p role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
  </div>;
}

export function Select({ label, error, children, id, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  const inputId = id || rest.name;
  return <div className="w-full">
    {label && <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>}
    <select id={inputId} className="min-h-[44px] w-full rounded-card border border-line bg-surface px-3.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" {...rest}>{children}</select>
    {error && <p role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
  </div>;
}

// ---- Badge / Card / Skeleton / EmptyState ----
export function Badge({ children, tone = 'soft', className = '' }: { children: React.ReactNode; tone?: 'soft' | 'success' | 'warn' | 'danger' | 'primary'; className?: string }) {
  const tones = { soft: 'bg-soft text-ink', success: 'bg-green-50 text-success', warn: 'bg-amber-50 text-warn', danger: 'bg-red-50 text-danger', primary: 'bg-indigo-50 text-primary' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-card-lg border border-line bg-surface shadow-card ${className}`}>{children}</div>;
}

// One shared content width for the whole site: every page's outer shell
// measures max-w-7xl (1280px) at desktop width, so the header, footer and
// every page line up. Narrow content (auth forms, articles, hero text)
// stays centered inside it with its own inner max-width — only the shell
// is unified, never the inner reading width.
export function Container({ children, className = '', as, id }: { children: React.ReactNode; className?: string; as?: 'div' | 'section' | 'article'; id?: string }) {
  const Tag = as || 'div';
  return <Tag id={id} className={`mx-auto w-full max-w-7xl px-4 ${className}`}>{children}</Tag>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-card bg-soft ${className}`} />;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-card-lg border border-dashed border-line bg-soft/50 px-6 py-12 text-center">
    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50" aria-hidden><Upload className="h-7 w-7 text-primary" /></div>
    <h3 className="text-base font-bold text-ink">{title}</h3>
    {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

// ---- Tabs ----
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return <div role="tablist" aria-label="Sections" className="flex gap-1 overflow-x-auto rounded-card bg-soft p-1">
    {tabs.map((t) => (
      <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
        className={`min-h-[40px] whitespace-nowrap rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${value === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>{t.label}</button>
    ))}
  </div>;
}

// ---- Modal (focus trap) ----
export function Modal({ open, onClose, title, children, labelledBy }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const el = ref.current; const prev = document.activeElement as HTMLElement;
    const focusables = () => el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusables()?.[0]; first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = Array.from(focusables() || []);
        if (!items.length) return;
        const firstEl = items[0], lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
    <div ref={ref} className="w-full max-w-lg rounded-card-xl bg-surface p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 id={labelledBy} className="text-lg font-bold text-ink">{title}</h2>
        <button onClick={onClose} aria-label="Close dialog" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-5 w-5" /></button>
      </div>
      {children}
    </div>
  </div>;
}

// ---- Drawer ----
// Rendered through a portal to document.body: the bell lives inside the
// sticky header, whose backdrop-blur makes it a containing block for
// fixed-position descendants in Chrome — a drawer rendered inside it
// would be positioned against the header instead of the viewport. The
// portal keeps it a true viewport overlay on every screen size. Body
// scroll is locked while open, so the page behind cannot scroll (or
// shift sideways) under the drawer.
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close panel" className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ---- Toast ----
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t); }, [onClose]);
  return <div role="status" className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-card-lg bg-ink px-4 py-3 text-sm text-white shadow-card">
    <span>{message}</span>
    <button onClick={onClose} aria-label="Dismiss" className="rounded p-1 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="h-4 w-4" /></button>
  </div>;
}

// ---- Tooltip ----
export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
    {children}
    {show && <span role="tooltip" className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-card bg-ink px-3 py-2 text-xs text-white shadow-card">{label}</span>}
  </span>;
}

// ---- Progress / Switch / Segmented / CopyField / Accordion / PasswordField ----
// A null value renders an indeterminate bar (an animated segment, no
// percentage): used while a job is queued/waiting, where no honest
// percentage exists yet. Never show a made-up number.
export function Progress({ value, max = 100, label }: { value: number | null; max?: number; label?: string }) {
  if (value == null) {
    return <div>
      {label && <div className="mb-1 text-xs text-muted"><span>{label}</span></div>}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-soft" role="progressbar" aria-label={label}>
        <div className="absolute top-0 h-full w-2/5 animate-progress-slide rounded-full bg-primary" />
      </div>
    </div>;
  }
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return <div>
    {label && <div className="mb-1 flex justify-between text-xs text-muted"><span>{label}</span><span>{Math.round(pct)}%</span></div>}
    <div className="h-2 w-full overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  </div>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${checked ? 'bg-primary' : 'bg-line'}`}>
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
  </button>;
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel: string }) {
  return <div role="group" aria-label={ariaLabel} className="inline-flex rounded-card bg-soft p-1">
    {options.map((o) => (
      <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}
        className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>{o.label}</button>
    ))}
  </div>;
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <div>
    <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
    <div className="flex items-stretch gap-2">
      <code className="min-h-[44px] flex-1 break-all rounded-card border border-line bg-soft px-3 py-2.5 text-sm text-ink">{value}</code>
      <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? 'Copied' : 'Copy'}</Button>
    </div>
  </div>;
}

export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return <div className="divide-y divide-line rounded-card-lg border border-line bg-surface">
    {items.map((it, i) => (
      <div key={i}>
        <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}
          className="flex min-h-[52px] w-full items-center justify-between gap-4 px-5 py-3 text-left text-sm font-semibold text-ink hover:bg-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
          <span>{it.q}</span><ChevronDown aria-hidden className={`h-5 w-5 shrink-0 text-muted transition-transform ${open === i ? 'rotate-180' : ''}`} />
        </button>
        {open === i && <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{it.a}</p>}
      </div>
    ))}
  </div>;
}

export function passwordStrength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  return { score: s, label: labels[Math.min(s, 5)] };
}

export function PasswordField({ label, error, id, showStrength, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; showStrength?: boolean }) {
  const [show, setShow] = useState(false);
  const strength = showStrength ? passwordStrength(String(rest.value || '')) : null;
  return <div className="w-full">
    {label && <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>}
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} aria-invalid={!!error}
        className="min-h-[44px] w-full rounded-card border border-line bg-surface px-3.5 pr-16 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" {...rest} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 min-h-[36px] -translate-y-1/2 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{show ? 'Hide' : 'Show'}</button>
    </div>
    {strength && rest.value ? (
      <div className="mt-2">
        <div className="flex gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength.score ? (strength.score >= 4 ? 'bg-success' : strength.score >= 2 ? 'bg-warn' : 'bg-danger') : 'bg-soft'}`} />)}
        </div>
        <p className="mt-1 text-xs text-muted">Password strength: {strength.label}</p>
      </div>
    ) : null}
    {error && <p role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
  </div>;
}

// ---- CompareSlider ----
export function CompareSlider({ beforeLabel, afterLabel }: { beforeLabel: string; afterLabel: string }) {
  const [pos, setPos] = useState(50);
  return <div className="relative overflow-hidden rounded-card-lg border border-line" role="group" aria-label="Before and after comparison">
    <div className="flex h-48 items-center justify-center bg-soft text-sm text-muted">{beforeLabel}</div>
    <div className="absolute inset-y-0 left-0 overflow-hidden bg-indigo-50" style={{ width: `${pos}%` }}>
      <div className="flex h-48 w-full items-center justify-center text-sm text-ink">{afterLabel}</div>
    </div>
    <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Compare before and after"
      className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
    <div className="pointer-events-none absolute inset-y-0 flex items-center" style={{ left: `calc(${pos}% - 2px)` }}>
      <div className="h-full w-1 bg-primary" />
    </div>
    <span className="absolute left-2 top-2 rounded bg-ink/70 px-2 py-0.5 text-xs text-white">Before</span>
    <span className="absolute right-2 top-2 rounded bg-ink/70 px-2 py-0.5 text-xs text-white">After</span>
  </div>;
}

export function FileThumb({ kind, label }: { kind: 'image' | 'audio' | 'video' | 'pdf' | 'file'; label: string }) {
  const Icon = { image: ImageIcon, audio: Music, video: Video, pdf: FileText, file: File }[kind];
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-soft text-primary" aria-hidden title={label}><Icon className="h-6 w-6" /></div>;
}
