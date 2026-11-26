'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { CATEGORIES, type FormatInfo } from '@/lib/catalog';
import { iconForCategory } from '@/lib/formatIcons';

// The category pill bar (All / Images / Camera RAW / Audio / Video /
// Documents and vector) — the soft pill container with the active tab
// highlighted. The container is only as wide as its tabs need
// (max-content); the search input stays pinned at the right end of the
// row. Shared by the home format-cards section and the home converter
// tool, so both bars always look and behave the same. The categories and
// icons come from the catalog, never hard-coded here.
// On small screens the pills scroll horizontally in one row instead of
// wrapping, so the row never overflows the page.
//
// Optional `search`: a "Search formats..." input at the right end of the
// same row (home tool only). Typing filters formats and picking a result
// calls onSelect with the format slug — the caller wires that to the
// Convert-from value. Results follow the active category (the same list
// the Convert-from dropdown shows): 'All' searches every format, a
// category searches only its own formats. Selecting a result never
// moves the category tab itself.
export function CategoryBar({ value, onChange, disabled = false, search }: { value: string; onChange: (c: string) => void; disabled?: boolean; search?: { formats: FormatInfo[]; onSelect: (slug: string) => void } }) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchResults = (() => {
    const q = query.trim().toLowerCase();
    if (!q || !search) return [];
    return search.formats
      .filter((f) => value === 'All' || f.category === value)
      .filter((f) => f.label.toLowerCase().includes(q) || f.slug.toLowerCase().includes(q))
      .slice(0, 8);
  })();

  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  const chooseSearch = (slug: string) => {
    search?.onSelect(slug);
    setQuery('');
    setSearchOpen(false);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 w-max max-w-full overflow-x-auto rounded-card bg-soft p-1" role="tablist" aria-label="Format categories">
        <div className="flex flex-nowrap gap-1">
          {['All', ...CATEGORIES].map((c) => {
            const CatIcon = iconForCategory(c);
            return (
              <button key={c} type="button" role="tab" aria-selected={value === c} disabled={disabled} onClick={() => onChange(c)}
                title={disabled ? 'Remove uploaded files to change category' : undefined}
                className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${value === c ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                <CatIcon className="h-4 w-4 shrink-0" aria-hidden />{c}
              </button>
            );
          })}
        </div>
      </div>
      {search && (
        <div ref={searchRef} className="relative w-44 shrink-0 sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="text" value={query} disabled={disabled} placeholder="Search formats…" aria-label="Search formats"
            onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); }
              else if (e.key === 'Enter' && searchResults.length) { e.preventDefault(); chooseSearch(searchResults[0].slug); }
            }}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            className="min-h-[44px] w-full rounded-card border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus-visible:ring-primary/30 disabled:bg-soft disabled:text-muted" />
          {searchOpen && query.trim() && (
            <ul role="listbox" aria-label="Search results" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-card-lg border border-line bg-surface py-1 shadow-card">
              {searchResults.length === 0 && <li className="px-4 py-3 text-sm text-muted">No formats match “{query.trim()}”.</li>}
              {searchResults.map((f) => (
                <li key={f.slug} role="option" aria-selected={false}
                  onMouseDown={(e) => { e.preventDefault(); chooseSearch(f.slug); }}
                  className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm text-ink hover:bg-indigo-50">
                  <span className="min-w-0 truncate">{f.label}</span>
                  <span className="shrink-0 rounded bg-soft px-2 py-0.5 text-xs font-semibold text-muted">{f.category}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
