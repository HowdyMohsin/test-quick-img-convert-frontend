'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Combobox, formatOptions } from './Combobox';
import type { Catalog } from '@/lib/catalog';
import { apiFetch } from '@/lib/api';

export function HeroPicker({ catalog, showUploadBox = false }: { catalog: Catalog; showUploadBox?: boolean }) {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [detectNote, setDetectNote] = useState<string | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const detectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('qic-last-pair');
      if (saved) {
        const { from: f, to: t } = JSON.parse(saved);
        if (catalog.targetsByInput[f]?.includes(t)) { setFrom(f); setTo(t); }
      }
    } catch { /* ignore */ }
  }, [catalog]);

  const fromOptions = useMemo(() => formatOptions(catalog.formats.filter((f) => catalog.targetsByInput[f.slug]?.length)), [catalog]);
  const toOptions = useMemo(() => {
    if (!from) return [];
    const targets = catalog.targetsByInput[from] || [];
    return formatOptions(catalog.formats.filter((f) => targets.includes(f.slug)));
  }, [catalog, from]);

  const onFrom = (v: string | null) => {
    setFrom(v);
    if (v && to && !(catalog.targetsByInput[v] || []).includes(to)) setTo(null);
    if (!v) setTo(null);
  };
  const reverseExists = from && to ? (catalog.targetsByInput[to] || []).includes(from) : false;
  const swap = () => { if (reverseExists && from && to) { setFrom(to); setTo(from); } };

  const fromLabel = catalog.formats.find((f) => f.slug === from)?.label;
  const toLabel = catalog.formats.find((f) => f.slug === to)?.label;
  const pairUrl = from && to ? `/convert/${from}-to-${to}` : '#';
  const category = from ? catalog.formats.find((f) => f.slug === from)?.category : null;

  useEffect(() => {
    if (from && to) {
      try { localStorage.setItem('qic-last-pair', JSON.stringify({ from, to })); } catch { /* ignore */ }
    }
  }, [from, to]);

  // Home-only format detection: upload a file, read its detected format,
  // and pre-fill the "from" dropdown. The file itself is NOT carried to the
  // pair page — the pair page has its own upload box.
  const detectFile = async (file: File) => {
    setDetectNote(null);
    setDetectError(null);
    setDetecting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const up = await apiFetch<{ id?: string; detected_format?: string; format?: string; category?: string }>('/v1/uploads', { method: 'POST', body: form });
      const detected = String(up.detected_format || up.format || '').toLowerCase();
      const match = catalog.formats.find((f) => f.slug === detected);
      if (detected && match && (catalog.targetsByInput[detected]?.length || 0) > 0) {
        onFrom(detected);
        setDetectNote(`Detected: ${match.label} — now choose the format to convert to`);
      } else {
        setDetectError(`We couldn't detect a supported format for “${file.name}” — please pick the format manually.`);
      }
    } catch (e: any) {
      setDetectError(e?.message || 'Could not detect this file’s format — please pick the format manually.');
    } finally {
      setDetecting(false);
    }
  };

  return <div className="rounded-card-xl border border-line bg-surface p-5 shadow-card sm:p-6">
    {showUploadBox && (
      <div className="mb-5">
        <div
          role="button" tabIndex={0} aria-label="Drop a file here to detect its format, or press Enter to browse"
          onClick={() => detectInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter') detectInputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) detectFile(f); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed px-4 py-5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${dragOver ? 'border-primary bg-indigo-50' : 'border-line bg-soft/40 hover:border-primary/50'}`}>
          <span aria-hidden className="text-2xl">⇪</span>
          <p className="text-sm font-bold text-ink">{detecting ? 'Detecting format…' : 'Drop a file to detect its format'}</p>
          <p className="text-xs text-muted">or <span className="font-semibold text-primary underline">browse your files</span></p>
          <input ref={detectInputRef} type="file" className="hidden" aria-hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) detectFile(f); e.target.value = ''; }} />
        </div>
        {detectNote && <p className="mt-2 text-center text-sm font-semibold text-success" role="status">{detectNote}</p>}
        {detectError && <p className="mt-2 text-center text-sm font-semibold text-danger" role="alert">{detectError}</p>}
      </div>
    )}
    <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
      <Combobox id="hero-from" label="Convert from" placeholder="Choose a format…" options={fromOptions} value={from} onChange={onFrom} />
      <div className="flex justify-center pb-1">
        <button type="button" onClick={swap} disabled={!reverseExists} aria-label="Swap formats" title={reverseExists ? 'Swap formats' : 'Reverse conversion is not available'}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-lg text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40">
          ⇄
        </button>
      </div>
      <Combobox id="hero-to" label="Convert to" placeholder={from ? 'Choose a format…' : 'Choose “from” first'} options={toOptions} value={to} onChange={setTo} disabled={!from} />
    </div>
    {from && to && (
      <p className="mt-4 text-center text-sm text-muted" aria-live="polite">
        {fromLabel} → {toLabel} · {category} converter
      </p>
    )}
    <div className="mt-4">
      {from && to ? (
        <a href={pairUrl} target="_blank" rel="noopener" aria-label="Start converting — opens in a new tab"
          className="flex min-h-[48px] w-full items-center justify-center rounded-card bg-primary px-5 py-3 text-base font-bold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          Start converting <span className="ml-2 text-xs font-medium opacity-80">(opens in a new tab)</span>
        </a>
      ) : (
        <button disabled aria-disabled="true" className="min-h-[48px] w-full cursor-not-allowed rounded-card bg-primary/50 px-5 py-3 text-base font-bold text-white">
          Start converting
        </button>
      )}
    </div>
    <p className="mt-3 text-center text-xs text-muted">No account needed for 5 conversions a day · Files auto-delete after 24 hours</p>
  </div>;
}
