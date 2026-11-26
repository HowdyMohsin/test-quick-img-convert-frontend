'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Upload, X } from 'lucide-react';
import { Combobox, formatOptions } from './Combobox';
import { FileThumb } from './ui';
import type { Catalog } from '@/lib/catalog';
import { apiFetch, formatBytes } from '@/lib/api';

// Files dropped on the home page are uploaded straight away (the backend
// detects each file's format) and handed to the pair page through
// sessionStorage, so the converter shows every file as its own row
// without the user having to upload again.
export const HOME_UPLOAD_HANDOFF_KEY = 'qic-home-uploads';
export interface HomeUploadHandoff { uploadId: string; name: string; size: number; detected: string }

interface StagedFile { id: string; name: string; size: number; detected: string; status: 'uploading' | 'ready' | 'error'; error?: string; uploadId?: string }

function thumbKindFor(catalog: Catalog, slug: string): 'image' | 'audio' | 'video' | 'pdf' | 'file' {
  const f = catalog.formats.find((x) => x.slug === slug);
  if (!f) return 'file';
  if (f.category === 'Images') return 'image';
  if (f.category === 'Audio') return 'audio';
  if (f.category === 'Video') return 'video';
  if (f.slug === 'pdf') return 'pdf';
  return 'file';
}

export function HeroPicker({ catalog, showUploadBox = false, layout = 'default', initialFrom = null, initialTo = null }: { catalog: Catalog; showUploadBox?: boolean; layout?: 'default' | 'side'; initialFrom?: string | null; initialTo?: string | null }) {
  const router = useRouter();
  const [from, setFrom] = useState<string | null>(initialFrom);
  const [to, setTo] = useState<string | null>(initialTo);
  const [detectNote, setDetectNote] = useState<string | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const detectInputRef = useRef<HTMLInputElement>(null);

  // Home layout only: restore the last-used pair. The side box always shows
  // the pair of the page it sits on (initialFrom / initialTo).
  useEffect(() => {
    if (layout !== 'default') return;
    try {
      const saved = localStorage.getItem('qic-last-pair');
      if (saved) {
        const { from: f, to: t } = JSON.parse(saved);
        if (catalog.targetsByInput[f]?.includes(t)) { setFrom(f); setTo(t); }
      }
    } catch { /* ignore */ }
  }, [catalog, layout]);

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

  const writeHandoff = (list: StagedFile[]) => {
    try {
      const ready = list.filter((f) => f.status === 'ready' && f.uploadId);
      if (ready.length) {
        sessionStorage.setItem(HOME_UPLOAD_HANDOFF_KEY, JSON.stringify(ready.map((f) => ({ uploadId: f.uploadId as string, name: f.name, size: f.size, detected: f.detected }))));
      } else {
        sessionStorage.removeItem(HOME_UPLOAD_HANDOFF_KEY);
      }
    } catch { /* ignore */ }
  };

  // Upload every dropped/selected file (not just the first one). Each file
  // gets its own row below, with its detected format; the first file that
  // detects a supported format pre-fills the "from" dropdown.
  const uploadFiles = async (incoming: File[]) => {
    if (!incoming.length) return;
    setDetectNote(null);
    setDetectError(null);
    const items: StagedFile[] = incoming.map((f, i) => ({ id: `${Date.now()}-${i}-${f.name}`, name: f.name, size: f.size, detected: '', status: 'uploading' }));
    setStaged((prev) => [...prev, ...items]);
    const results = await Promise.all(items.map(async (item, i) => {
      try {
        const form = new FormData();
        form.append('file', incoming[i]);
        const up = await apiFetch<{ id?: string; upload_id?: string; detected_format?: string; format?: string }>('/v1/uploads', { method: 'POST', body: form });
        const detected = String(up.detected_format || up.format || '').toLowerCase();
        const uploadId = up.id || up.upload_id || '';
        setStaged((prev) => {
          const next = prev.map((f) => (f.id === item.id ? { ...f, status: 'ready' as const, detected, uploadId } : f));
          writeHandoff(next);
          return next;
        });
        return { detected, name: item.name };
      } catch (e: any) {
        setStaged((prev) => prev.map((f) => (f.id === item.id ? { ...f, status: 'error' as const, error: e?.message || 'Upload failed — please try again.' } : f)));
        return { detected: '', name: item.name };
      }
    }));
    // Prefill "from" from the first file in this batch that detected a
    // supported format (files may be mixed, so not necessarily the first).
    const firstGood = results.find((r) => {
      const m = catalog.formats.find((f) => f.slug === r.detected);
      return r.detected && m && (catalog.targetsByInput[r.detected]?.length || 0) > 0;
    });
    if (firstGood) {
      const match = catalog.formats.find((f) => f.slug === firstGood.detected)!;
      onFrom(firstGood.detected);
      setDetectNote(`Detected: ${match.label} — now choose the format to convert to`);
    } else if (results.length === 1) {
      setDetectError(`We couldn't detect a supported format for “${results[0].name}” — please pick the format manually.`);
    } else if (results.length > 1) {
      setDetectError('We couldn’t detect a supported format for these files — please pick the format manually.');
    }
  };

  const removeStaged = (id: string) => {
    setStaged((prev) => {
      const next = prev.filter((f) => f.id !== id);
      writeHandoff(next);
      return next;
    });
  };

  const readyCount = staged.filter((f) => f.status === 'ready').length;

  return <div className="rounded-card-xl border border-line bg-surface p-5 shadow-card sm:p-6">
    {showUploadBox && (
      <div className="mb-5">
        <div
          role="button" tabIndex={0} aria-label="Drop files here to detect their format, or press Enter to browse"
          onClick={() => detectInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter') detectInputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void uploadFiles(Array.from(e.dataTransfer.files || [])); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed px-4 py-5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${dragOver ? 'border-primary bg-indigo-50' : 'border-line bg-soft/40 hover:border-primary/50'}`}>
          <Upload className="h-7 w-7 text-muted" aria-hidden />
          <p className="text-sm font-bold text-ink">Drop files here to detect their format</p>
          <p className="text-xs text-muted">You can drop several files at once — or <span className="font-semibold text-primary underline">browse your files</span></p>
          <input ref={detectInputRef} type="file" multiple className="hidden" aria-hidden
            onChange={(e) => { void uploadFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
        </div>
        {staged.length > 0 && (
          <ul className="mt-3 space-y-2">
            {staged.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-card border border-line bg-surface p-2.5">
                <FileThumb kind={thumbKindFor(catalog, f.detected)} label={f.detected || 'file'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink" title={f.name}>{f.name}</p>
                  <p className="text-xs text-muted">{formatBytes(f.size)}{f.detected ? <> · <span className="rounded bg-soft px-1.5 py-0.5 font-semibold">{f.detected.toUpperCase()}</span></> : ''}{f.status === 'uploading' ? ' · Uploading…' : ''}</p>
                  {f.status === 'error' && <p className="mt-0.5 text-xs text-danger">{f.error}</p>}
                </div>
                {f.status === 'ready' && <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-success">Ready</span>}
                <button onClick={() => removeStaged(f.id)} aria-label={`Remove ${f.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {readyCount > 0 && <p className="mt-2 text-center text-sm font-semibold text-success" role="status">{readyCount} file{readyCount === 1 ? '' : 's'} ready — choose the target format and start converting.</p>}
        {detectNote && <p className="mt-2 text-center text-sm font-semibold text-success" role="status">{detectNote}</p>}
        {detectError && <p className="mt-2 text-center text-sm font-semibold text-danger" role="alert">{detectError}</p>}
      </div>
    )}
    {layout === 'side' ? (
      <div className="flex flex-col gap-3">
        <Combobox id="hero-from" label="Convert from" placeholder="Choose a format…" options={fromOptions} value={from} onChange={onFrom} />
        <button type="button" onClick={swap} disabled={!reverseExists} aria-label="Swap formats" title={reverseExists ? 'Swap formats' : 'Reverse conversion is not available'}
          className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-card border border-line bg-surface text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40">
          <ArrowLeftRight className="h-4 w-4" /> Swap
        </button>
        <Combobox id="hero-to" label="Convert to" placeholder={from ? 'Choose a format…' : 'Choose “from” first'} options={toOptions} value={to} onChange={setTo} disabled={!from} />
      </div>
    ) : (
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <Combobox id="hero-from" label="Convert from" placeholder="Choose a format…" options={fromOptions} value={from} onChange={onFrom} />
        <div className="flex justify-center pb-1">
          <button type="button" onClick={swap} disabled={!reverseExists} aria-label="Swap formats" title={reverseExists ? 'Swap formats' : 'Reverse conversion is not available'}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40">
            <ArrowLeftRight className="h-5 w-5" />
          </button>
        </div>
        <Combobox id="hero-to" label="Convert to" placeholder={from ? 'Choose a format…' : 'Choose “from” first'} options={toOptions} value={to} onChange={setTo} disabled={!from} />
      </div>
    )}
    {from && to && (
      <p className="mt-4 text-center text-sm text-muted" aria-live="polite">
        {fromLabel} → {toLabel} · {category} converter
      </p>
    )}
    <div className="mt-4">
      {from && to ? (
        layout === 'side' ? (
          <button type="button" onClick={() => router.push(pairUrl)}
            className="flex min-h-[48px] w-full items-center justify-center rounded-card bg-primary px-5 py-3 text-base font-bold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            Go to converter
          </button>
        ) : (
          <a href={pairUrl} target="_blank" rel="noopener" aria-label="Start converting — opens in a new tab"
            className="flex min-h-[48px] w-full items-center justify-center rounded-card bg-primary px-5 py-3 text-base font-bold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            Start converting <span className="ml-2 text-xs font-medium opacity-80">(opens in a new tab)</span>
          </a>
        )
      ) : (
        <button disabled aria-disabled="true" className="min-h-[48px] w-full cursor-not-allowed rounded-card bg-primary/50 px-5 py-3 text-base font-bold text-white">
          {layout === 'side' ? 'Go to converter' : 'Start converting'}
        </button>
      )}
    </div>
    {layout === 'default' && <p className="mt-3 text-center text-xs text-muted">No account needed for 5 conversions a day · Files auto-delete after 24 hours</p>}
  </div>;
}
