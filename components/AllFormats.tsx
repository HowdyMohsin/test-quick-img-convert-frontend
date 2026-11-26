'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Catalog } from '@/lib/catalog';
import { CATEGORIES } from '@/lib/catalog';
import { iconForCategory, iconForFormat } from '@/lib/formatIcons';
import { Badge, EmptyState, Skeleton } from './ui';

export function AllFormats({ catalog, loading }: { catalog: Catalog; loading?: boolean }) {
  const [tab, setTab] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showFrom, setShowFrom] = useState<Record<string, boolean>>({});

  const formats = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.formats.filter((f) => {
      if (tab !== 'All' && f.category !== tab) return false;
      if (!q) return true;
      const targets = (catalog.targetsByInput[f.slug] || []).map((t) => catalog.formats.find((x) => x.slug === t)?.label || t).join(' ');
      return f.label.toLowerCase().includes(q) || f.slug.includes(q) || f.aliases.join(' ').includes(q)
        || f.description.toLowerCase().includes(q) || targets.toLowerCase().includes(q);
    });
  }, [catalog, tab, query]);

  const pairCount = catalog.pairs.length;
  const letters = useMemo(() => {
    const set = new Set(formats.map((f) => f.label[0].toUpperCase()));
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => ({ letter: l, active: set.has(l) }));
  }, [formats]);

  const scrollToLetter = (letter: string) => {
    const el = document.querySelector(`[data-format-letter="${letter}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading formats">
      {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
    </div>;
  }

  return <div>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-card bg-soft p-1" role="tablist" aria-label="Format categories">
        {['All', ...CATEGORIES].map((c) => {
          const CatIcon = iconForCategory(c);
          return (
            <button key={c} role="tab" aria-selected={tab === c} onClick={() => setTab(c)}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === c ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
              <CatIcon className="h-4 w-4 shrink-0" aria-hidden />{c}
            </button>
          );
        })}
      </div>
      <div className="relative ml-auto w-full sm:w-72">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search formats…" aria-label="Search formats"
          className="min-h-[44px] w-full rounded-card border border-line bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
    </div>
    <div className="mb-6 flex flex-wrap gap-1" aria-label="Jump to letter">
      {letters.map(({ letter, active }) => (
        <button key={letter} disabled={!active} onClick={() => scrollToLetter(letter)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-primary hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:text-line">{letter}</button>
      ))}
    </div>
    <p className="mb-4 text-sm text-muted" aria-live="polite">
      <span className="font-bold text-ink">{pairCount} converters</span> · {formats.length} format{formats.length === 1 ? '' : 's'} shown
    </p>
    {formats.length === 0 ? (
      <EmptyState title="No formats match your search" body="Try a different format name — for example, “jpeg” finds JPG — or clear the search to see everything." />
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {formats.map((f) => {
          const targets = (catalog.targetsByInput[f.slug] || []).map((t) => catalog.formats.find((x) => x.slug === t)!).filter(Boolean);
          const sources = (catalog.inputsByTarget[f.slug] || []).map((s) => catalog.formats.find((x) => x.slug === s)!).filter(Boolean);
          const shown = expanded[f.slug] ? targets : targets.slice(0, 6);
          return <article key={f.slug} data-format-letter={f.label[0].toUpperCase()} className="rounded-card-lg border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-indigo-50 text-primary" aria-hidden>
                {(() => { const FormatIcon = iconForFormat(f.slug, f.category); return <FormatIcon className="h-5 w-5" />; })()}
              </span>
              <h3 className="min-w-0 flex-1 text-base font-bold text-ink">{f.label}</h3>
              <Badge tone="primary">{f.slug.toUpperCase()}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{f.description}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{f.category}</p>
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold text-muted">Converts to</p>
              <div className="flex flex-wrap gap-1.5">
                {shown.map((t) => (
                  <Link key={t.slug} href={`/convert/${f.slug}-to-${t.slug}`}
                    className="rounded-full border border-line bg-soft px-2.5 py-1 text-xs font-semibold text-ink hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    {t.label}
                  </Link>
                ))}
                {targets.length > 6 && !expanded[f.slug] && (
                  <button onClick={() => setExpanded((e) => ({ ...e, [f.slug]: true }))}
                    className="rounded-full border border-dashed border-line px-2.5 py-1 text-xs font-semibold text-primary hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    +{targets.length - 6} more
                  </button>
                )}
              </div>
            </div>
            {sources.length > 0 && (
              <div className="mt-3">
                <button onClick={() => setShowFrom((s) => ({ ...s, [f.slug]: !s[f.slug] }))} aria-expanded={!!showFrom[f.slug]}
                  className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {showFrom[f.slug] ? 'Hide' : 'Show'} convert from ({sources.length})
                </button>
                {showFrom[f.slug] && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sources.map((s) => (
                      <Link key={s.slug} href={`/convert/${s.slug}-to-${f.slug}`}
                        className="rounded-full border border-line bg-soft px-2.5 py-1 text-xs font-semibold text-ink hover:border-primary hover:text-primary">{s.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </article>;
        })}
      </div>
    )}
  </div>;
}
