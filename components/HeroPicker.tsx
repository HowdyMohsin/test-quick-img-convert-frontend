'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Lock, Upload, X } from 'lucide-react';
import { Combobox, formatOptions } from './Combobox';
import { CategoryBar } from './CategoryBar';
import { FileThumb } from './ui';
import { useMe } from './Header';
import type { Catalog } from '@/lib/catalog';
import { apiFetch, formatBytes, friendlyErrorMessage } from '@/lib/api';

// The tool converts images (and the other catalog formats) — a .md, .txt
// or any other unsupported file is rejected with this friendly line, never
// a raw error code.
export const UNSUPPORTED_FILE_MESSAGE = 'Ye file type support nahi hai — sirf images, audio, video aur documents convert hote hain.';

function fileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

// Files dropped on the home page are uploaded straight away (the backend
// detects each file's format) and handed to the pair page through
// localStorage, so the converter shows every file as its own row without
// the user having to upload again. localStorage (not sessionStorage) is
// used on purpose: "Start converting" opens the pair page in a new tab,
// and sessionStorage does not cross tabs, so the handoff was lost.
export const HOME_UPLOAD_HANDOFF_KEY = 'qic-home-uploads';
export interface HomeUploadHandoff { uploadId: string; name: string; size: number; detected: string }
export interface HomeUploadHandoffPayload { ts: number; items: HomeUploadHandoff[] }

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

export function HeroPicker({ catalog, showUploadBox = false, layout = 'default', initialFrom = null, initialTo = null, lockedFrom = false, lockedTo = false }: { catalog: Catalog; showUploadBox?: boolean; layout?: 'default' | 'bar'; initialFrom?: string | null; initialTo?: string | null; lockedFrom?: boolean; lockedTo?: boolean }) {
  const router = useRouter();
  const { me, loaded } = useMe();
  const [from, setFrom] = useState<string | null>(initialFrom);
  const [to, setTo] = useState<string | null>(initialTo);
  // Category pill bar (home layout only): filters both dropdowns to one
  // category. 'All' shows every format. The pair-page bar never
  // shows it — its pair is fixed.
  const [catFilter, setCatFilter] = useState<string>('All');
  const [detectNote, setDetectNote] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const detectInputRef = useRef<HTMLInputElement>(null);

  // Extensions the catalog can actually convert. A format counts only if
  // it has at least one target — built from the catalog, never hard-coded.
  const supportedExts = useMemo(() => {
    const set = new Set<string>();
    for (const f of catalog.formats) {
      if (!(catalog.targetsByInput[f.slug]?.length)) continue;
      set.add(f.slug.toLowerCase());
      for (const e of [...(f.extensions || []), ...(f.aliases || [])]) set.add(e.toLowerCase());
    }
    return set;
  }, [catalog]);

  // Home layout only: restore the last-used pair. The bar always shows
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

  // Convert-from rows show the popular targets (JPG → WEBP PNG AVIF);
  // Convert-to rows keep the plain badge (no targets map passed).
  // Both lists are filtered to the chosen category ('All' = everything).
  const fromOptions = useMemo(() => formatOptions(
    catalog.formats.filter((f) => catalog.targetsByInput[f.slug]?.length && (catFilter === 'All' || f.category === catFilter)),
    catalog.targetsByInput), [catalog, catFilter]);
  const toOptions = useMemo(() => {
    if (!from) return [];
    const targets = catalog.targetsByInput[from] || [];
    return formatOptions(catalog.formats.filter((f) => targets.includes(f.slug) && (catFilter === 'All' || f.category === catFilter)), undefined, catalog.inputsByTarget);
  }, [catalog, from, catFilter]);

  const onFrom = (v: string | null) => {
    setFrom(v);
    if (v && to && !(catalog.targetsByInput[v] || []).includes(to)) setTo(null);
    if (!v) setTo(null);
  };
  // Switching category clears any selected format that does not belong
  // to it, so the dropdowns can never show a value outside the filter.
  const onCategory = (c: string) => {
    setCatFilter(c);
    if (c === 'All') return;
    const fromCat = from ? catalog.formats.find((f) => f.slug === from)?.category : null;
    if (from && fromCat !== c) { setFrom(null); setTo(null); return; }
    const toCat = to ? catalog.formats.find((f) => f.slug === to)?.category : null;
    if (to && toCat !== c) setTo(null);
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
        // Timestamped so the pair page can drop a stale handoff (uploads
        // auto-delete after 24 hours on the server).
        const payload: HomeUploadHandoffPayload = { ts: Date.now(), items: ready.map((f) => ({ uploadId: f.uploadId as string, name: f.name, size: f.size, detected: f.detected })) };
        localStorage.setItem(HOME_UPLOAD_HANDOFF_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(HOME_UPLOAD_HANDOFF_KEY);
      }
    } catch { /* ignore */ }
  };

  // Upload every dropped/selected file (not just the first one). Each file
  // gets its own row below, with its detected format; the first file that
  // detects a supported format pre-fills the "from" dropdown.
  //
  // Unsupported files (e.g. .md) are rejected BEFORE any network call —
  // their row immediately shows the friendly note and keeps its remove
  // button, while the other files upload normally. A file that the server
  // still rejects gets its row message from friendlyErrorMessage, so a raw
  // "Request failed (403)" can never appear.
  const uploadFiles = async (incoming: File[]) => {
    if (!incoming.length) return;
    setDetectNote(null);
    const now = Date.now();
    const stagedItems: StagedFile[] = [];
    const toUpload: { item: StagedFile; file: File }[] = [];
    incoming.forEach((f, i) => {
      const id = `${now}-${i}-${f.name}`;
      if (!supportedExts.has(fileExt(f.name))) {
        stagedItems.push({ id, name: f.name, size: f.size, detected: '', status: 'error', error: UNSUPPORTED_FILE_MESSAGE });
      } else {
        const item: StagedFile = { id, name: f.name, size: f.size, detected: '', status: 'uploading' };
        stagedItems.push(item);
        toUpload.push({ item, file: f });
      }
    });
    setStaged((prev) => [...prev, ...stagedItems]);
    if (!toUpload.length) return;
    const results = await Promise.all(toUpload.map(async ({ item, file }) => {
      try {
        const form = new FormData();
        form.append('file', file);
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
        setStaged((prev) => prev.map((f) => (f.id === item.id ? { ...f, status: 'error' as const, error: friendlyErrorMessage(e) } : f)));
        return { detected: '', name: item.name };
      }
    }));
    // Prefill "from" from the first file in this batch that detected a
    // supported format (files may be mixed, so not necessarily the first).
    // There is no "couldn't detect" banner any more: a file that fails is
    // already explained by its own row message, and Convert-from is locked
    // while files are staged, so "pick the format manually" would be
    // impossible advice.
    const firstGood = results.find((r) => {
      const m = catalog.formats.find((f) => f.slug === r.detected);
      return r.detected && m && (catalog.targetsByInput[r.detected]?.length || 0) > 0;
    });
    if (firstGood) {
      const match = catalog.formats.find((f) => f.slug === firstGood.detected)!;
      onFrom(firstGood.detected);
      // The bar follows the detected file: a dropped MP3 switches the
      // category to Audio, so the bar and the locked "from" never disagree.
      setCatFilter(match.category);
      setDetectNote(`Detected: ${match.label} — now choose the format to convert to`);
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
  // The source format is locked while files are uploaded — it is detected
  // from the files, so the user cannot change it. Removing every file
  // unlocks it again. The pair-page converter passes lockedFrom when its
  // own file list is non-empty; the home box locks on its staged files.
  // Only uploading/ready files lock it: a batch of purely rejected files
  // (e.g. all .md) leaves it unlocked, so the user can still pick a format
  // manually for a file that does convert.
  const fromLocked = lockedFrom || staged.some((f) => f.status !== 'error');

  // Suspense lock (user order 2026-11-26): once >=1 file is uploaded
  // (ready), an anonymous visitor cannot pick a target or start the
  // conversion — "Convert to" locks (lock icon) and the Start button
  // becomes "Sign in free to convert". Signing in (free, no email
  // verification) unlocks both at once. The pair-page bar passes its
  // own files through lockedTo, because its staged list lives in
  // ConverterTool, not in this component. The swap button locks too —
  // swapping would otherwise change the target behind the lock. The
  // backend refuses anonymous converts as well, so the rule cannot be
  // bypassed from the browser console.
  const suspenseLocked = !!lockedTo || (loaded && !me && readyCount > 0);

  return <div className="rounded-card-xl border border-line bg-surface p-5 shadow-card sm:p-6">
    {layout === 'default' && (
      <div className="mb-5">
        <CategoryBar value={catFilter} onChange={onCategory} disabled={fromLocked} />
        {catFilter !== 'All' && <p className="mt-2 text-xs text-muted">Showing {catFilter} formats — pick “All” to see every format.</p>}
      </div>
    )}
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
          <p className="text-sm font-bold text-ink">{catFilter === 'All' ? 'Drop files here to detect their format' : `Drop ${catFilter} files here to detect their format`}</p>
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
        {readyCount > 0 && <p className="mt-2 text-center text-sm font-semibold text-success" role="status">{readyCount} file{readyCount === 1 ? '' : 's'} ready — {suspenseLocked ? 'sign in free to convert them.' : 'choose the target format and start converting.'}</p>}
        {detectNote && <p className="mt-2 text-center text-sm font-semibold text-success" role="status">{detectNote}</p>}
      </div>
    )}
    {layout === 'bar' ? (
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
        <Combobox id="hero-from" label="Convert from" placeholder="Choose a format…" options={fromOptions} value={from} onChange={onFrom} locked={fromLocked} />
        <div className="flex justify-center pb-1">
          <button type="button" onClick={swap} disabled={!reverseExists || suspenseLocked} aria-label="Swap formats" title={reverseExists ? 'Swap formats' : 'Reverse conversion is not available'}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40">
            <ArrowLeftRight className="h-5 w-5" />
          </button>
        </div>
        <Combobox id="hero-to" label="Convert to" placeholder={from ? 'Choose a format…' : 'Choose “from” first'} options={toOptions} value={to} onChange={setTo} disabled={!from} locked={suspenseLocked} lockTitle="Locked — sign in free to choose the target format and convert" />
        <button type="button" onClick={() => router.push(pairUrl)} disabled={!from || !to}
          className="flex min-h-[48px] items-center justify-center whitespace-nowrap rounded-card bg-primary px-5 text-sm font-bold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
          Go to converter
        </button>
      </div>
    ) : (
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <Combobox id="hero-from" label="Convert from" placeholder="Choose a format…" options={fromOptions} value={from} onChange={onFrom} locked={fromLocked} />
        <div className="flex justify-center pb-1">
          <button type="button" onClick={swap} disabled={!reverseExists || suspenseLocked} aria-label="Swap formats" title={reverseExists ? 'Swap formats' : 'Reverse conversion is not available'}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40">
            <ArrowLeftRight className="h-5 w-5" />
          </button>
        </div>
        <Combobox id="hero-to" label="Convert to" placeholder={from ? 'Choose a format…' : 'Choose “from” first'} options={toOptions} value={to} onChange={setTo} disabled={!from} locked={suspenseLocked} lockTitle="Locked — sign in free to choose the target format and convert" />
      </div>
    )}
    {from && to && (
      <p className="mt-4 text-center text-sm text-muted" aria-live="polite">
        {fromLabel} → {toLabel} · {category} converter
      </p>
    )}
    {/* The bar layout carries its own "Go to converter" button in the
        row above, so no bottom button is rendered for it. */}
    {layout !== 'bar' && (
    <div className="mt-4">
      {from && to ? (suspenseLocked ? (
        <a href="/login" aria-label="Sign in free to convert"
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-card bg-primary px-5 py-3 text-base font-bold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          <Lock className="h-5 w-5" aria-hidden /> Sign in free to convert
        </a>
      ) : (
        <a href={pairUrl} target="_blank" rel="noopener" aria-label="Start converting — opens in a new tab"
          className="flex min-h-[48px] w-full items-center justify-center rounded-card bg-primary px-5 py-3 text-base font-bold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          Start converting <span className="ml-2 text-xs font-medium opacity-80">(opens in a new tab)</span>
        </a>
      )) : (
        <button disabled aria-disabled="true" className="min-h-[48px] w-full cursor-not-allowed rounded-card bg-primary/50 px-5 py-3 text-base font-bold text-white">
          Start converting
        </button>
      )}
    </div>
    )}
    {layout === 'default' && <p className="mt-3 text-center text-xs text-muted">Sign in free to convert · Files auto-delete after 24 hours</p>}
  </div>;
}
