'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Lock } from 'lucide-react';
import type { FormatInfo } from '@/lib/catalog';
import { CATEGORIES, popularSources, popularTargets } from '@/lib/catalog';

export interface ComboOption { value: string; label: string; category: string; badge: string; targets?: string[]; sources?: string[] }

export function Combobox({ label, placeholder, options, value, onChange, disabled, locked, lockTitle, id, hint }:
  { label: string; placeholder: string; options: ComboOption[]; value: string | null; onChange: (v: string | null) => void; disabled?: boolean; locked?: boolean; lockTitle?: string; id: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || o.badge.toLowerCase().includes(q) || (o.targets || []).some((t) => t.toLowerCase().includes(q)) || (o.sources || []).some((t) => t.toLowerCase().includes(q)));
  }, [options, query]);

  const grouped = useMemo(() => {
    const out: { category: string; items: ComboOption[] }[] = [];
    for (const c of CATEGORIES) {
      const items = filtered.filter((o) => o.category === c);
      if (items.length) out.push({ category: c, items });
    }
    // Any option whose category is not in the known list still shows.
    const rest = filtered.filter((o) => !CATEGORIES.includes(o.category as any));
    if (rest.length) out.push({ category: 'Other', items: rest });
    return out;
  }, [filtered]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => { if (active >= flat.length) setActive(0); }, [flat.length, active]);

  const choose = (v: string) => { onChange(v); setOpen(false); setQuery(''); inputRef.current?.blur(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && flat[active]) choose(flat[active].value); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  // A locked dropdown cannot be opened or changed (e.g. the source format
  // is fixed by the files already uploaded). It behaves like disabled, but
  // shows a lock instead of the chevron so the reason is visible.
  const isLocked = !!locked;
  const isDisabled = !!disabled || isLocked;
  const lockTitleText = lockTitle || 'Locked — remove the uploaded files to change the source format';

  return <div className="relative w-full">
    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">{label}{isLocked && <span className="ml-2 text-xs font-semibold text-muted">(locked)</span>}</label>
    <div className="relative">
      <input ref={inputRef} id={id} role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && flat[active] ? `${id}-opt-${flat[active].value}` : undefined}
        autoComplete="off" disabled={isDisabled} placeholder={placeholder} title={isLocked ? lockTitleText : undefined}
        value={open ? query : (selected ? selected.label : '')}
        // Opening the dropdown must show the FULL list. The query is the
        // search filter, so it is cleared here — putting the selected label
        // in it (as before) filtered the list down to just that one format
        // (e.g. reopening after picking GIF showed only GIF). The input
        // shows the selected label only while closed (see `value` above).
        onFocus={() => { if (!isDisabled) { setOpen(true); setQuery(''); } }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="min-h-[48px] w-full rounded-card border border-line bg-surface px-3.5 pr-10 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-soft disabled:text-muted" />
      {isLocked ? (
        <span title={lockTitleText} aria-label={lockTitleText} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"><Lock className="h-5 w-5" aria-hidden /></span>
      ) : (
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
      )}
    </div>
    {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    {open && !isDisabled && (
      <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={label}
        className="absolute z-30 mt-1 max-h-96 w-full overflow-y-auto rounded-card-lg border border-line bg-surface py-1 shadow-card">
        {flat.length === 0 && <li className="px-4 py-3 text-sm text-muted">No formats match “{query}”.</li>}
        {grouped.map((g) => (
          <React.Fragment key={g.category}>
            <li aria-hidden className="sticky top-0 bg-soft px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">{g.category}</li>
            {g.items.map((o) => {
              const idx = flat.indexOf(o);
              return <li key={o.value} id={`${id}-opt-${o.value}`} role="option" aria-selected={value === o.value}
                onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}
                className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm ${idx === active ? 'bg-indigo-50 text-ink' : 'text-ink'} ${value === o.value ? 'font-bold' : ''}`}>
                <span className="min-w-0 truncate">{o.label}</span>
                {o.targets?.length ? (
                  <span className="flex shrink-0 items-center gap-1" title={`Converts to ${o.targets.map((t) => t.toUpperCase()).join(', ')}`}>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                    {o.targets.map((t) => (
                      <span key={t} className="rounded bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-muted">{t.toUpperCase()}</span>
                    ))}
                  </span>
                ) : o.sources?.length ? (
                  <span className="flex shrink-0 items-center gap-1" title={`Convertible from ${o.sources.map((t) => t.toUpperCase()).join(', ')}`}>
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                    {o.sources.map((t) => (
                      <span key={t} className="rounded bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-muted">{t.toUpperCase()}</span>
                    ))}
                  </span>
                ) : (
                  <span className="shrink-0 rounded bg-soft px-2 py-0.5 text-xs font-semibold text-muted">{o.badge}</span>
                )}
              </li>;
            })}
          </React.Fragment>
        ))}
      </ul>
    )}
  </div>;
}

export function formatOptions(formats: FormatInfo[], targetsByInput?: Record<string, string[]>, inputsByTarget?: Record<string, string[]>): ComboOption[] {
  return formats.map((f) => ({
    value: f.slug, label: f.label, category: f.category, badge: f.slug.toUpperCase(),
    // Convert-from rows show the popular targets (JPG → WEBP PNG AVIF);
    // Convert-to rows show the popular sources (AVIF ← WEBP PNG JPG).
    // Rows with neither map keep the plain badge.
    ...(targetsByInput ? { targets: popularTargets(f.slug, targetsByInput) } : {}),
    ...(inputsByTarget ? { sources: popularSources(f.slug, inputsByTarget) } : {}),
  }));
}
