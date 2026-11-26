'use client';
import React from 'react';
import { CATEGORIES } from '@/lib/catalog';
import { iconForCategory } from '@/lib/formatIcons';

// The category pill bar (All / Images / Camera RAW / Audio / Video /
// Documents and vector) — the soft pill container with the active tab
// highlighted. Shared by the home format-cards section and the home
// converter tool, so both bars always look and behave the same. The
// categories and icons come from the catalog, never hard-coded here.
export function CategoryBar({ value, onChange, disabled = false }: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-card bg-soft p-1" role="tablist" aria-label="Format categories">
      {['All', ...CATEGORIES].map((c) => {
        const CatIcon = iconForCategory(c);
        return (
          <button key={c} type="button" role="tab" aria-selected={value === c} disabled={disabled} onClick={() => onChange(c)}
            title={disabled ? 'Remove uploaded files to change category' : undefined}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${value === c ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
            <CatIcon className="h-4 w-4 shrink-0" aria-hidden />{c}
          </button>
        );
      })}
    </div>
  );
}
