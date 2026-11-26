'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, fetchFeatures, formatBytes, friendlyErrorMessage, getCsrf, notifyMeChanged, toArray, truncateMiddle, type PlanFeatures } from '@/lib/api';
import type { FormatInfo, Catalog } from '@/lib/catalog';
import { pairDescription } from '@/lib/pair-copy';
import { Button, Card, CompareSlider, EmptyState, FileThumb, Modal, Progress, Switch, Toast, Tooltip } from './ui';
import { Check, Download, Eye, LayoutGrid, List, Lock, PenLine, Pencil, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react';
import { AdFrame, MobileAnchorAd } from './AdFrame';
import { HeroPicker, HOME_UPLOAD_HANDOFF_KEY, type HomeUploadHandoff, type HomeUploadHandoffPayload } from './HeroPicker';

type FileStatus = 'ready' | 'uploading' | 'converting' | 'waiting' | 'done' | 'error';
interface ToolFile {
  id: string; file?: File; name: string; size: number; detected: string;
  // progress is null while no honest percentage exists (queued/waiting,
  // or the convert request still in flight) — the bar renders
  // indeterminate instead of a made-up number.
  status: FileStatus; progress: number | null; error?: string; hint?: string;
  downloadUrl?: string; outSize?: number; jobId?: string; uploadId?: string;
  quality: number; compress: number; stripMeta: boolean; bitrate: string; channels: string; sampleRate: string;
  codec: string; crf: number; resolution: string;
  // Plan-gated features (GET /v1/features): stripGps removes ONLY
  // the GPS EXIF tags (keeps the rest of the metadata); targetSizeKb is
  // the target output size in KB as typed ('' = off, parsed at convert
  // time); renamePattern is the batch rename pattern ('' = unchanged);
  // compressEnabled (default true) turns PNG compression on/off —
  // off sends settings.compress_enabled: false; stripAiData sends
  // settings.strip_ai_data to remove the AI credit/metadata.
  // outQuality is the REAL quality the backend used (out_info.quality),
  // which can be lower than the requested quality when a target size
  // made the backend lower it — never guessed.
  stripGps: boolean; targetSizeKb: string; renamePattern: string; outQuality?: number;
  compressEnabled: boolean; stripAiData: boolean;
  // waking: the request is slow because the free backend is waking up.
  // doneAt orders the converted list newest first. outName/outWidth/
  // outHeight are the REAL backend results for a finished job.
  // customName is a user rename (base name only, extension fixed).
  waking?: boolean; doneAt?: number; outName?: string; outWidth?: number; outHeight?: number; customName?: string;
}

const PRESETS: Record<string, { label: string; apply: (f: ToolFile) => Partial<ToolFile> }[]> = {
  Images: [
    { label: 'Web', apply: () => ({ quality: 80, compress: 6 }) },
    { label: 'Print', apply: () => ({ quality: 95, compress: 9 }) },
    { label: 'Social', apply: () => ({ quality: 85, compress: 6 }) },
    { label: 'Archival', apply: () => ({ quality: 100, compress: 9 }) },
  ],
  Audio: [
    { label: 'Web', apply: () => ({ bitrate: '128', sampleRate: '44100' }) },
    { label: 'Archival', apply: () => ({ bitrate: '320', sampleRate: '48000' }) },
  ],
  Video: [
    { label: 'Web', apply: () => ({ crf: 23, resolution: '1080p' }) },
    { label: 'Social', apply: () => ({ crf: 26, resolution: '720p' }) },
    { label: 'Archival', apply: () => ({ crf: 18, resolution: 'Original' }) },
  ],
};

export function ConverterTool({ from, to, catalog, usage, disabledPair }: { from: FormatInfo; to: FormatInfo; catalog: Catalog; usage?: { used: number; limit: number } | null; disabledPair?: boolean }) {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [editorAllowed, setEditorAllowed] = useState(false);
  // Plan-gated converter features (GET /v1/features): null while loading
  // — unknown is treated as LOCKED, never as unlocked, and the backend
  // enforces the same flags (403 feature_locked) as the backstop.
  const [features, setFeatures] = useState<PlanFeatures | null>(null);
  // Paywall modal: the locked feature the user just tried (null = closed).
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);
  // Per-row before/after compare: the converted file being compared plus
  // the original's URL (an object URL for a local file, the server's
  // editor-file URL for a home-handoff file — created on open, revoked
  // on close when it is a blob: URL).
  const [compareFile, setCompareFile] = useState<ToolFile | null>(null);
  const [compareBeforeUrl, setCompareBeforeUrl] = useState<string | null>(null);
  // Converted-files section: list/grid view, ZIP menu, delete-all
  // confirm, and the rename popup (base name editable, extension fixed).
  const [convertedView, setConvertedView] = useState<'list' | 'grid'>('list');
  const [zipMenuOpen, setZipMenuOpen] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ToolFile | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameExt, setRenameExt] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<Record<string, boolean>>({});
  // In-flight uploads (XHR, so the bar can show real bytes sent) and
  // "waking up" timers, both keyed by file id.
  const xhrRef = useRef<Record<string, XMLHttpRequest>>({});
  const wakeTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // The poll loop stops touching state once the tool unmounts (user
  // navigates away while a job is still waiting) — the job itself keeps
  // waiting on the server and shows up in the account history.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      Object.values(xhrRef.current).forEach((x) => { try { x.abort(); } catch { /* ignore */ } });
      Object.values(wakeTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  const batchLimit = 10;
  const remaining = usage ? Math.max(0, usage.limit - usage.used) : 5;
  const acceptExts = [...from.extensions, ...from.aliases].map((e) => `.${e}`).join(',');
  // Quality and compression are separate controls. Quality applies to lossy
  // targets only; compression applies to PNG only (see the settings below).
  const isLossyTarget = ['jpg', 'jpeg', 'webp', 'avif'].includes(to.slug);
  const isPngTarget = to.slug === 'png';
  const isImagePair = from.category === 'Images';

  useEffect(() => {
    apiFetch<{ plan?: string; editor_allowed?: boolean }>('/v1/editor/access')
      .then((d) => setEditorAllowed(!!d.editor_allowed))
      .catch(() => setEditorAllowed(false));
  }, []);

  useEffect(() => {
    fetchFeatures().then((d) => setFeatures(d)).catch(() => setFeatures(null));
  }, []);

  useEffect(() => {
    fetch('/api/v1/history?limit=5', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setHistory(toArray(Array.isArray(d) ? d : (d.jobs ?? d.history))); })
      .catch(() => {});
  }, []);

  // Files staged on the home page were already uploaded there and handed
  // over through localStorage — show each as its own row here, with no
  // re-upload needed. Only files matching this converter are kept. The
  // handoff is deliberately NOT consumed destructively: going back from
  // one pair page to another (or hitting the browser Back button)
  // remounts this tool, and deleting the key on first read made the
  // files vanish ("No files yet"). The key stays until the user clears
  // the batch (or the home page writes a new one), so returning to a
  // pair page restores the files; a handoff older than 24 hours is
  // dropped (uploads auto-delete after 24 hours on the server). A plain
  // array (the old sessionStorage shape) is still accepted.
  const clearHandoff = () => {
    try { localStorage.removeItem(HOME_UPLOAD_HANDOFF_KEY); } catch { /* ignore */ }
  };
  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(HOME_UPLOAD_HANDOFF_KEY); } catch { /* ignore */ }
    if (!raw) return;
    let items: HomeUploadHandoff[] = [];
    try {
      const parsed = JSON.parse(raw) as HomeUploadHandoffPayload | HomeUploadHandoff[];
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && Array.isArray(parsed.items)) {
        if (typeof parsed.ts === 'number' && Date.now() - parsed.ts > 24 * 60 * 60 * 1000) return;
        items = parsed.items;
      } else return;
    } catch { return; }
    const matching = (Array.isArray(items) ? items : []).filter((it) => {
      if (!it || !it.uploadId || !it.name) return false;
      const ext = it.name.split('.').pop()?.toLowerCase() || '';
      return it.detected === from.slug || from.extensions.includes(ext) || from.aliases.includes(ext);
    });
    if (!matching.length) return;
    const mapped: ToolFile[] = matching.map((it, i) => ({
      id: `home-${Date.now()}-${i}-${it.name}`, name: it.name, size: it.size,
      detected: (it.detected || it.name.split('.').pop() || '').toUpperCase(),
      status: 'ready', progress: 0, uploadId: it.uploadId,
      quality: 85, compress: 6, stripMeta: true, bitrate: '192', channels: 'Stereo', sampleRate: '44100', codec: 'H.264', crf: 23, resolution: 'Original',
      stripGps: false, targetSizeKb: '', renamePattern: '', compressEnabled: true, stripAiData: false,
    }));
    // Dedup by upload id: the effect runs again when the user returns to
    // this pair page, and the same files must never appear twice.
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.uploadId).filter(Boolean));
      const fresh = mapped.filter((f) => f.uploadId && !seen.has(f.uploadId));
      if (!fresh.length) return prev;
      return [...prev, ...fresh];
    });
    setToast(`${matching.length} file${matching.length === 1 ? '' : 's'} added from the home page.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list);
    setFiles((prev) => {
      const room = batchLimit - prev.length;
      if (incoming.length > room) {
        setToast(`Your plan allows ${batchLimit} files per batch. Upgrade for larger batches.`);
      }
      const accepted = incoming.slice(0, Math.max(0, room)).filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        return from.extensions.includes(ext) || from.aliases.includes(ext);
      });
      if (accepted.length < incoming.length) {
        setToast(`Only ${from.label} files can be added here.`);
      }
      const mapped: ToolFile[] = accepted.map((f, i) => ({
        id: `${Date.now()}-${i}-${f.name}`, file: f, name: f.name, size: f.size,
        detected: (f.name.split('.').pop() || '').toUpperCase(),
        status: 'ready', progress: 0, quality: 85, compress: 6, stripMeta: true,
        bitrate: '192', channels: 'Stereo', sampleRate: '44100', codec: 'H.264', crf: 23, resolution: 'Original',
        stripGps: false, targetSizeKb: '', renamePattern: '', compressEnabled: true, stripAiData: false,
      }));
      return [...prev, ...mapped];
    });
  }, [from]);

  // Clipboard paste on image pairs.
  useEffect(() => {
    if (from.category !== 'Images') return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (items && items.length) addFiles(items);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [from, addFiles]);

  const updateFile = (id: string, patch: Partial<ToolFile>) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  // One controls row for the whole batch: writes the same patch to every
  // pending file, exactly like a preset does. Finished files keep the
  // settings they converted with, so their displayed numbers never move.
  const setAll = (patch: Partial<ToolFile>) => setFiles((fs) => fs.map((f) => (f.status === 'done' ? f : { ...f, ...patch })));
  const removeFile = (id: string) => {
    // Dropping the file being compared closes its slider too (and frees
    // the object URL when the original was a local blob).
    if (compareFile?.id === id) {
      if (compareBeforeUrl && compareBeforeUrl.startsWith('blob:')) URL.revokeObjectURL(compareBeforeUrl);
      setCompareBeforeUrl(null);
      setCompareFile(null);
    }
    const next = files.filter((f) => f.id !== id);
    setFiles(next);
    // The batch is gone — drop the handoff so the files do not come back
    // when the user returns to this pair page.
    if (next.length === 0) clearHandoff();
  };

  // --- file names ---------------------------------------------------------
  const ILLEGAL_NAME = /[/\\:*?"<>|]/;
  const splitBaseExt = (name: string) => {
    const i = name.lastIndexOf('.');
    return i > 0 ? { base: name.slice(0, i), ext: name.slice(i + 1) } : { base: name, ext: '' };
  };
  // Name shown in the staged list: the user's rename, if any.
  const displayName = (f: ToolFile) => f.customName || f.name;
  // Name of the converted file: a rename applies to the output name
  // (base + target extension); otherwise the REAL backend out_name.
  const outputName = (f: ToolFile) => {
    if (f.customName) return `${splitBaseExt(f.customName).base}.${to.slug}`;
    return f.outName || `${splitBaseExt(f.name).base}.${to.slug}`;
  };

  // --- batch rename pattern ----------------------------------------------
  // The backend's name_pattern only expands {name} and {ext} — {n} (zero
  // padded sequence) and {date} (YYYYMMDD) are expanded HERE, client-side,
  // and the finished literal is sent as name_pattern. The sent pattern
  // always ends with the target extension (appended as {ext} when the
  // user typed none) so the backend's {ext} substitution gives the output
  // file its real extension — without it the file would have no
  // extension at all.
  const expandPattern = (pattern: string, index: number, total: number): string => {
    const width = Math.max(3, String(Math.max(1, total)).length);
    const n = String(index + 1).padStart(width, '0');
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    let out = pattern.replaceAll('{n}', n).replaceAll('{date}', date);
    if (!out.includes('{ext}') && !/\.[A-Za-z0-9]{1,5}$/.test(out)) out += '.{ext}';
    return out;
  };
  // Preview name for a staged file: the same expansion, with {name} and
  // {ext} resolved to the real values so the user sees the finished name.
  const previewPatternName = (pattern: string, index: number, total: number, f: ToolFile): string => {
    const stem = splitBaseExt(f.customName || f.name).base;
    return expandPattern(pattern, index, total).replaceAll('{name}', stem).replaceAll('{ext}', to.slug);
  };
  const validatePattern = (pattern: string, batchSize: number): string | null => {
    const p = pattern.trim();
    if (!p) return null;
    if (ILLEGAL_NAME.test(p)) return 'The pattern cannot contain / \\ : * ? " < > or |.';
    if (batchSize > 1 && !p.includes('{n}') && !p.includes('{name}')) return 'Add {n} so each file gets its own number — otherwise every file would get the same name.';
    return null;
  };
  // Target size (KB) as typed: '' = off; a whole number 1–102400 = on.
  // Anything else is invalid (never sent — the backend drops it too).
  const parseTargetSizeKb = (raw: string): number | null => {
    const t = raw.trim();
    if (!t || !/^\d+$/.test(t)) return null;
    const n = Number(t);
    return n >= 1 && n <= 102400 ? n : null;
  };
  const targetSizeError = (raw: string | undefined): string | null => {
    if (!raw || !raw.trim()) return null;
    if (!/^\d+$/.test(raw.trim())) return 'Enter a whole number of kilobytes.';
    const n = Number(raw.trim());
    if (n < 1 || n > 102400) return 'Enter a target between 1 and 102400 KB.';
    return null;
  };

  // --- "waking up" note ---------------------------------------------------
  // The free backend sleeps when idle, so the first request can take
  // ~50s while it wakes. After 8s in flight, say so plainly (same
  // wording as the login page) instead of leaving a frozen bar.
  const armWakingTimer = (id: string) => {
    clearWakingTimer(id);
    wakeTimersRef.current[id] = setTimeout(() => {
      setFiles((fs) => fs.map((f) => ((f.id === id && (f.status === 'uploading' || f.status === 'converting') && !f.jobId) ? { ...f, waking: true } : f)));
    }, 8000);
  };
  const clearWakingTimer = (id: string) => {
    const t = wakeTimersRef.current[id];
    if (t) { clearTimeout(t); delete wakeTimersRef.current[id]; }
  };

  // --- upload with real progress ------------------------------------------
  // fetch has no upload progress events, so the upload goes through XHR:
  // the bar shows the bytes actually sent. Error mapping mirrors
  // apiFetch (same friendly messages, same code/status shape) so the
  // existing catch block — including the quota handling — works unchanged.
  const uploadFileWithProgress = (form: FormData, id: string, onProgress: (fraction: number) => void) => {
    return new Promise<{ id: string; upload_id?: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current[id] = xhr;
      xhr.open('POST', '/api/v1/uploads', true);
      xhr.withCredentials = true;
      xhr.responseType = 'text';
      void getCsrf().then((token) => {
        if (abortRef.current[id]) { delete xhrRef.current[id]; reject(Object.assign(new Error('Upload cancelled.'), { code: 'aborted', status: 0 })); return; }
        if (token) xhr.setRequestHeader('X-CSRF-Token', token);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total); };
        xhr.onload = () => {
          delete xhrRef.current[id];
          let data: any = {};
          try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch { data = {}; }
          if (xhr.status >= 200 && xhr.status < 300) { resolve(data); return; }
          const err = data?.error || {};
          const message = friendlyErrorMessage({ code: err.code || 'request_failed', message: err.message || '' });
          reject(Object.assign(new Error(message), { code: err.code || 'request_failed', hint: err.hint, status: xhr.status }));
        };
        xhr.onerror = () => { delete xhrRef.current[id]; reject(Object.assign(new Error('Could not reach the server — check your connection and try again.'), { code: 'network_error', status: 0 })); };
        xhr.onabort = () => { delete xhrRef.current[id]; reject(Object.assign(new Error('Upload cancelled.'), { code: 'aborted', status: 0 })); };
        xhr.send(form);
      });
    });
  };

  // A rename of a staged home-handoff file must survive a reload: the
  // handoff in localStorage is the list's persistence, so update the
  // stored name too. (Renaming a finished file only renames its output
  // name, so the stored input name is left alone.)
  const updateHandoffName = (uploadId: string, newName: string) => {
    try {
      const raw = localStorage.getItem(HOME_UPLOAD_HANDOFF_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as HomeUploadHandoffPayload | HomeUploadHandoff[];
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(items)) return;
      let changed = false;
      items.forEach((it) => { if (it && it.uploadId === uploadId) { it.name = newName; changed = true; } });
      if (changed) localStorage.setItem(HOME_UPLOAD_HANDOFF_KEY, JSON.stringify(parsed));
    } catch { /* ignore — rename still applies to this session */ }
  };

  // --- rename popup ---------------------------------------------------------
  // Base name only — the extension stays fixed and visible, so the user
  // cannot break the file type. There is no backend rename endpoint, so
  // the rename is applied client-side: the displayed name, the file sent
  // on upload (fresh files), and the downloaded file's name (anchor
  // `download` attribute overrides the server's Content-Disposition).
  const openRename = (f: ToolFile) => {
    const current = f.status === 'done' ? outputName(f) : displayName(f);
    const { base, ext } = splitBaseExt(current);
    setRenameTarget(f);
    setRenameValue(base);
    setRenameExt(f.status === 'done' ? to.slug : ext);
    setRenameError(null);
  };
  const closeRename = () => { setRenameTarget(null); setRenameValue(''); setRenameError(null); };
  const saveRename = () => {
    if (!renameTarget) return;
    const base = renameValue.trim();
    if (!base) { setRenameError('Enter a file name.'); return; }
    if (base === '.' || base === '..') { setRenameError('That name is not allowed.'); return; }
    if (ILLEGAL_NAME.test(base)) { setRenameError('The name cannot contain / \\ : * ? " < > or |.'); return; }
    const full = renameExt ? `${base}.${renameExt}` : base;
    const target = renameTarget;
    updateFile(target.id, { customName: full });
    if (target.status !== 'done' && target.uploadId) updateHandoffName(target.uploadId, full);
    closeRename();
  };

  // --- converted-files actions ----------------------------------------------
  const downloadEach = () => {
    files.filter((f) => f.status === 'done' && f.downloadUrl).forEach((f) => {
      const a = document.createElement('a');
      a.href = f.downloadUrl!;
      a.download = outputName(f);
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  };
  const deleteAllConverted = async () => {
    setShowDeleteAll(false);
    const done = files.filter((f) => f.status === 'done');
    // Best effort: delete each uploaded original from the server. The
    // finished outputs stay in the account history (there is no
    // job-delete endpoint, and the history re-download still works).
    await Promise.all(done.filter((f) => f.uploadId).map((f) => apiFetch(`/v1/uploads/${f.uploadId}`, { method: 'DELETE' }).catch(() => null)));
    setFiles((fs) => fs.filter((f) => f.status !== 'done'));
    setDoneCount(0);
    if (files.length === done.length) clearHandoff();
    setToast('Converted files deleted.');
  };

  const openPreview = (tf: ToolFile) => {
    if (!isImagePair) return;
    // A file uploaded fresh in this tab has a local blob; a file carried
    // over from the home page has none — its original comes from the
    // server's plain upload-file endpoint (no editor plan-gate, unlike
    // /editor/file, so a free user can preview it too). Without this
    // fallback the carried file had no Preview button at all.
    if (tf.file) {
      const url = URL.createObjectURL(tf.file);
      setPreviewFile({ url, name: tf.name });
    } else if (tf.uploadId) {
      setPreviewFile({ url: `/api/v1/uploads/${tf.uploadId}/file`, name: tf.name });
    }
  };
  const closePreview = () => {
    // Only blob: URLs were created here — a server URL must never be
    // passed to revokeObjectURL.
    if (previewFile && previewFile.url.startsWith('blob:')) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  // --- before/after compare ----------------------------------------------
  // Original = the local file blob when this session uploaded it; for a
  // home-handoff file there is no local blob, so the original comes from
  // the server's editor-file endpoint (editor-gated, and compare is a
  // Basic/Pro feature, so the users who can compare can fetch it). The
  // converted side is the job's real download URL. A row with neither
  // source gets no Compare button at all — never a broken slider.
  const canCompare = (f: ToolFile) => !!(f.downloadUrl && (f.file || f.uploadId));
  const openCompare = (f: ToolFile) => {
    closeCompare();
    if (f.file) {
      setCompareBeforeUrl(URL.createObjectURL(f.file));
      setCompareFile(f);
    } else if (f.uploadId) {
      setCompareBeforeUrl(`/api/v1/editor/file/${f.uploadId}`);
      setCompareFile(f);
    }
  };
  const closeCompare = () => {
    if (compareBeforeUrl && compareBeforeUrl.startsWith('blob:')) URL.revokeObjectURL(compareBeforeUrl);
    setCompareBeforeUrl(null);
    setCompareFile(null);
  };

  const openInEditor = async (tf: ToolFile) => {
    if (!editorAllowed) { setShowEditorModal(true); return; }
    try {
      let uploadId = tf.uploadId;
      if (!uploadId) {
        const form = new FormData();
        if (!tf.file) throw new Error('This file was not uploaded — please add it again.');
        form.append('file', tf.file);
        const up = await apiFetch<{ id: string; upload_id?: string }>('/v1/uploads', { method: 'POST', body: form });
        uploadId = up.id || up.upload_id || '';
        if (!uploadId) throw new Error('Upload did not return an id.');
        updateFile(tf.id, { uploadId });
      }
      window.open(`/editor?upload=${encodeURIComponent(uploadId)}`, '_blank');
    } catch (e: any) {
      setToast(friendlyErrorMessage(e, 'Could not open the image editor — please try again.'));
    }
  };

  const applyPreset = (label: string) => {
    const preset = (PRESETS[from.category] || PRESETS['Images'] || []).find((p) => p.label === label);
    if (!preset) return;
    setFiles((fs) => fs.map((f) => ({ ...f, ...preset.apply(f) })));
    setToast(`Preset “${label}” applied to all files.`);
  };

  const convertOne = async (tf: ToolFile, batchId: string, batchIndex = 0, batchTotal = 1): Promise<boolean> => {
    if (abortRef.current[tf.id]) return false;
    try {
      // Files handed over from the home page already have an upload id —
      // skip the upload and convert straight away. There is no
      // "Uploading" phase to show for them, so go straight to converting.
      let uploadId = tf.uploadId || '';
      if (!uploadId) {
        updateFile(tf.id, { status: 'uploading', progress: 0, waking: false });
        if (!tf.file) throw new Error('This file was not uploaded — please add it again.');
        // Real upload progress via XHR, mapped onto the 0–30 leg of the
        // pipeline (upload done = 30, converting = 45–95, done = 100).
        // A rename made before upload travels with the file, so the
        // server-side name matches what the user sees.
        const form = new FormData();
        const upFile = tf.customName && tf.file.name !== tf.customName
          ? new File([tf.file], tf.customName, { type: tf.file.type }) : tf.file;
        form.append('file', upFile);
        armWakingTimer(tf.id);
        let up: { id: string; upload_id?: string };
        try {
          up = await uploadFileWithProgress(form, tf.id, (p) => updateFile(tf.id, { progress: Math.round(p * 30) }));
        } finally {
          clearWakingTimer(tf.id);
          updateFile(tf.id, { waking: false });
        }
        uploadId = up.id || up.upload_id || '';
        if (!uploadId) throw new Error('Upload did not return an id.');
        updateFile(tf.id, { uploadId, progress: 30 });
      }
      if (abortRef.current[tf.id]) return false;
      // No percentage exists yet: the convert request is in flight and
      // the job has no status until the first poll. Indeterminate bar,
      // never a made-up number.
      updateFile(tf.id, { status: 'converting', progress: null, waking: false });
      // Quality and compression are separate controls:
      // - Quality -> settings.quality, for lossy targets only (jpg, webp, avif).
      // - Compress -> settings.compression, for the png target only
      //   (PNG compress_level 0-9, lossless — higher means a smaller file,
      //   never lower image quality).
      // Other image targets get no quality/compression setting.
      const imageSettings: Record<string, unknown> = { strip_metadata: tf.stripMeta };
      if (isLossyTarget) imageSettings.quality = tf.quality;
      if (isPngTarget) {
        // compress_enabled: false means "no compression at all". It is
        // only sent when the plan allows the toggle (the backend 403s
        // feature_locked otherwise); when the toggle is on (the default)
        // the level is sent exactly as before.
        if (tf.compressEnabled === false) {
          if (features?.compress_toggle) imageSettings.compress_enabled = false;
        } else {
          imageSettings.compression = tf.compress;
        }
      }
      // Plan-gated settings — only sent when the plan allows them, so a
      // locked user can never smuggle them through the API (the backend
      // 403s feature_locked as the backstop). strip_gps removes ONLY the
      // GPS EXIF tags; strip_ai_data removes the AI credit/metadata
      // (C2PA, XMP AI fields, PNG text chunks) while keeping the rest of
      // the metadata; target_size_kb makes the backend lower quality
      // until the file fits (never below quality 10).
      if (features?.gps_remover && tf.stripGps) imageSettings.strip_gps = true;
      if (features?.ai_data_remover && tf.stripAiData) imageSettings.strip_ai_data = true;
      const targetKb = parseTargetSizeKb(tf.targetSizeKb);
      if (features?.target_size && targetKb) imageSettings.target_size_kb = targetKb;
      const settings: Record<string, unknown> = from.category === 'Images'
        ? imageSettings
        : from.category === 'Audio'
        ? { bitrate: Number(tf.bitrate), channels: tf.channels, sample_rate: Number(tf.sampleRate) }
        : from.category === 'Video'
        ? { codec: tf.codec, crf: tf.crf, resolution: tf.resolution }
        : {};
      // Batch rename pattern — {n}/{date} expanded client-side (the
      // backend only expands {name}/{ext}); a per-file rename wins over
      // the pattern for that file.
      let namePattern: string | undefined;
      if (features?.batch_rename && tf.renamePattern.trim() && !tf.customName) {
        namePattern = expandPattern(tf.renamePattern.trim(), batchIndex, batchTotal);
      }
      armWakingTimer(tf.id);
      let job: { id: string; job_id?: string };
      try {
        job = await apiFetch<{ id: string; job_id?: string }>('/v1/convert', { method: 'POST', body: { upload_id: uploadId, to: to.slug, settings, batch_id: batchId, ...(namePattern ? { name_pattern: namePattern } : {}) } });
      } finally {
        clearWakingTimer(tf.id);
        updateFile(tf.id, { waking: false });
      }
      const jobId = job.id || job.job_id || '';
      updateFile(tf.id, { jobId });
      // The convert call consumed one quota unit, so the header count
      // is already stale — tell it to re-fetch now, not only when the
      // job finishes (on a backend with no worker it never finishes).
      notifyMeChanged();
      // Poll job status. A job that is still queued or converting is NEVER
      // a failure: on a backend with no worker (or a busy one) a job can
      // sit queued indefinitely, so there is no fixed timeout that turns
      // it into an error, and "try a smaller file" must never appear for
      // a file that was never even attempted. The job's own status decides
      // what the row shows: 'running' means real conversion with the
      // worker's progress; 'queued' means the honest waiting state after
      // a short grace (~3s, so a healthy worker's pickup never flashes
      // "waiting"), polling slowed to every 5s. The user can cancel at
      // any time. Only a terminal backend status, a lost job, or
      // sustained loss of contact with the server ends the wait as an
      // error.
      let waitedMs = 0;
      let pollFailures = 0;
      let waitingShown = false;
      for (;;) {
        if (abortRef.current[tf.id] || !mountedRef.current) return false;
        let j: any = null;
        try {
          const res = await apiFetch<{ jobs?: any[] }>(`/v1/jobs?ids=${jobId}`);
          j = (res.jobs || [])[0];
          pollFailures = 0;
        } catch {
          // One failed poll (backend waking, deploy restart) must not
          // fail the conversion — keep waiting; only sustained loss of
          // contact becomes an error.
          pollFailures += 1;
          if (pollFailures >= 5) {
            updateFile(tf.id, { status: 'error', error: 'Could not reach the server.', hint: 'Check your connection and try again.' });
            return false;
          }
          await new Promise((r) => setTimeout(r, 1500));
          waitedMs += 1500;
          continue;
        }
        if (!j) {
          updateFile(tf.id, { status: 'error', error: 'We lost track of this conversion.', hint: 'Please try again.' });
          return false;
        }
        if (j.status === 'done' || j.status === 'completed') {
          const outSize = j.out_size || 0;
          // out_name and out_info.width/height are the REAL backend
          // results — the converted list shows them, never guesses.
          // out_info.quality is the REAL quality used: with a target
          // size set, the backend may have lowered it below the
          // requested quality, and the row must show what was used.
          updateFile(tf.id, { status: 'done', progress: 100, outSize, downloadUrl: `/api/v1/jobs/${jobId}/download`, doneAt: Date.now(), outName: j.out_name || undefined, outWidth: typeof j.out_info?.width === 'number' ? j.out_info.width : undefined, outHeight: typeof j.out_info?.height === 'number' ? j.out_info.height : undefined, outQuality: typeof j.out_info?.quality === 'number' ? j.out_info.quality : undefined, waking: false });
          setDoneCount((c) => c + 1);
          notifyMeChanged();
          return true;
        }
        if (j.status === 'failed' || j.status === 'error') {
          updateFile(tf.id, { status: 'error', error: j.error_message || 'Conversion failed.', hint: 'Try the file again, or re-export it from the app that created it.' });
          // The worker refunds the quota when a job fails, so the header
          // count drops — tell it to re-fetch instead of showing the
          // pre-failure number while /account shows the refunded one.
          notifyMeChanged();
          return false;
        }
        if (j.status === 'cancelled') {
          updateFile(tf.id, { status: 'error', error: 'This conversion was cancelled.', hint: 'Try again if you still need it.' });
          // A cancelled job is refunded too (see cancel_job) — same refresh.
          notifyMeChanged();
          return false;
        }
        // Still queued / running: keep waiting. The backend returns
        // progress as a 0–1 fraction, so it maps to 45–95 while the
        // worker is actually converting (the old code divided it by 2,
        // which capped the bar at 45.5% for a whole real conversion).
        // A queued job shows the honest waiting state — never a fake
        // "Converting 45%". If the worker picks the job up late, the
        // row switches back to converting with real progress.
        if (j.status === 'running') {
          if (waitingShown) waitingShown = false;
          updateFile(tf.id, { status: 'converting', progress: 45 + Math.min(50, (j.progress || 0) * 50) });
        } else if (!waitingShown && waitedMs >= 3000) {
          waitingShown = true;
          updateFile(tf.id, { status: 'waiting', progress: null });
        }
        await new Promise((r) => setTimeout(r, waitingShown ? 5000 : 1500));
        waitedMs += waitingShown ? 5000 : 1500;
      }
    } catch (e: any) {
      // A cancel during the upload or convert request must stay a quiet
      // reset to "ready", never an error row.
      if (abortRef.current[tf.id]) return false;
      if (e?.code === 'quota_exceeded' || e?.status === 429) {
        setLimitHit(true);
        updateFile(tf.id, { status: 'error', error: 'Daily conversion limit reached.', hint: 'Upgrade your plan or come back tomorrow.' });
        notifyMeChanged();
      } else {
        updateFile(tf.id, { status: 'error', error: friendlyErrorMessage(e, 'Something went wrong.'), hint: e?.hint || 'Check your connection and try again.' });
      }
      return false;
    }
  };

  const convertAll = async () => {
    const ready = files.filter((f) => f.status === 'ready' || f.status === 'error');
    if (!ready.length) return;
    // An invalid rename pattern would give every file the same output
    // name — stop with a friendly line instead of converting wrongly.
    const patternErr = validatePattern(ready[0]?.renamePattern ?? '', ready.length);
    if (patternErr) { setToast(patternErr); return; }
    if (ready.length > remaining) { setLimitHit(true); return; }
    setRunning(true);
    setDoneCount(0);
    const batchId = `batch-${Date.now().toString(36)}`;
    // Pipelined: start each file's upload while earlier files convert.
    // convertOne reports its own outcome, so count the resolved values:
    // `files` here is the render-time closure (every file is 'ready' at
    // click time), so filtering it for 'done' can never see a finished
    // file and the toast below could never fire. The batch index/total
    // travel with each file so the rename pattern numbers them in order.
    const results = await Promise.all(ready.map((f, i) => convertOne(f, batchId, i, ready.length)));
    setRunning(false);
    const done = results.filter(Boolean).length;
    if (done > 0) {
      setToast(`Conversion complete — ${done} file${done === 1 ? '' : 's'} ready to download.`);
      if (!sessionStorage.getItem('qic-success-toast')) {
        sessionStorage.setItem('qic-success-toast', '1');
      }
    }
  };

  const cancelAll = () => {
    files.forEach((f) => { abortRef.current[f.id] = true; try { xhrRef.current[f.id]?.abort(); } catch { /* ignore */ } clearWakingTimer(f.id); });
    setRunning(false);
    setFiles((fs) => fs.map((f) => ((f.status === 'uploading' || f.status === 'converting' || f.status === 'waiting') ? { ...f, status: 'ready', progress: 0, waking: false } : f)));
  };

  const downloadAll = async () => {
    const ids = files.filter((f) => f.status === 'done' && f.jobId).map((f) => f.jobId!);
    if (!ids.length) return;
    try {
      // The API returns the ZIP file itself (not a JSON download URL), so
      // fetch it as a blob and trigger the browser download directly.
      const res = await fetch('/api/v1/jobs/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrf() },
        body: JSON.stringify({ job_ids: ids }),
        credentials: 'include',
      });
      if (!res.ok) {
        let msg = 'Could not create the ZIP. Download files one by one.';
        try { const d = await res.json(); if (d?.error?.message) msg = d.error.message; } catch { /* keep default */ }
        setToast(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'conversions.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) { setToast(friendlyErrorMessage(e, 'Could not create the ZIP. Download files one by one.')); }
  };

  const trySample = async () => {
    try {
      const res = await fetch(`/api/v1/samples/${from.slug}`, { credentials: 'include' });
      if (!res.ok) { setToast('No sample file is available for this format yet.'); return; }
      const blob = await res.blob();
      const file = new File([blob], `sample.${from.extensions[0]}`, { type: blob.type });
      addFiles([file]);
    } catch { setToast('Could not load the sample file.'); }
  };

  const totalOut = files.filter((f) => f.status === 'done').reduce((a, f) => a + (f.outSize || 0), 0);
  const doneFiles = files.filter((f) => f.status === 'done').length;
  const failedFiles = files.filter((f) => f.status === 'error').length;
  const waitingFiles = files.filter((f) => f.status === 'waiting').length;
  // The staged list shows everything not finished yet; finished files
  // move to their own "Converted Files" section, newest first.
  const pendingFiles = files.filter((f) => f.status !== 'done');
  const convertedFiles = files.filter((f) => f.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  // First pending file — the global Settings row reads its values, and
  // every change writes back to all pending files through setAll.
  const firstPending = pendingFiles[0];
  // Files that Convert all will convert, in order — the rename pattern
  // preview and the batch numbering both use this list.
  const readyFiles = files.filter((f) => f.status === 'ready' || f.status === 'error');
  // Batch rename pattern validation + preview, from the same list the
  // conversion will number (so the preview and the real names agree).
  const patternErr = validatePattern(firstPending?.renamePattern ?? '', readyFiles.length);
  const thumbKind = from.category === 'Images' ? 'image' : from.category === 'Audio' ? 'audio' : from.category === 'Video' ? 'video' : from.slug === 'pdf' ? 'pdf' : 'file';

  // Locked-feature row: a locked control that opens the paywall modal
  // instead of doing anything — the feature is never half-enabled.
  const lockedFeatureRow = (label: string, feature: string) => (
    <button type="button" onClick={() => setPaywallFeature(feature)} aria-label={`${label} — Basic and Pro only`}
      className="flex w-full items-center gap-3 rounded-card border border-line px-3 py-2.5 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Lock className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      <span className="flex-1 text-sm text-ink">{label}</span>
      <span className="rounded-full bg-soft px-2 py-0.5 text-xs font-semibold text-muted">Basic &amp; Pro</span>
    </button>
  );

  // --- converted-files section ----------------------------------------------
  // Every number shown comes from the REAL job/file: output name + size
  // from the backend job, dimensions and the quality actually used from
  // the backend out_info, compression as the MEASURED size reduction
  // (1 − out/in). Nothing is guessed or hard-coded; a field that does
  // not exist for this pair is omitted, never faked.
  const convertedMeta = (f: ToolFile) => {
    const parts: string[] = [];
    if (f.outWidth && f.outHeight) parts.push(`${f.outWidth} × ${f.outHeight}px`);
    // Quality shown is the REAL one the backend used (outQuality). With a
    // target size set, the backend may have lowered it below the quality
    // the user chose — the row shows what was used. When the backend did
    // not report one, fall back to the chosen quality (also real).
    const q = typeof f.outQuality === 'number' ? f.outQuality : (isLossyTarget ? f.quality : undefined);
    if (typeof q === 'number') parts.push(`Quality: ${q}%`);
    // Target size: the real resulting size decides the wording — reached,
    // or not reached ("smallest possible" only at the quality floor of
    // 10, where the backend guarantees it cannot go lower).
    const tk = parseTargetSizeKb(f.targetSizeKb);
    if (tk && typeof f.outSize === 'number') {
      if (f.outSize <= tk * 1024) parts.push(`Target ${tk} KB reached`);
      else if (f.outQuality === 10) parts.push(`Target ${tk} KB not reached — smallest possible at quality 10`);
      else parts.push(`Target ${tk} KB · got ${formatBytes(f.outSize)}`);
    }
    // Compression: the user's own compress setting as a percentage — the
    // compress bar is 0–9, so level × 10 (level 7 → 70%, default 6 →
    // 60%). The backend reports no compression ratio in out_info (only
    // format, width, height, quality), so the setting is the honest
    // source: it is the level the encoder was asked to use, never a
    // measured or faked number. With the compress toggle off the row
    // says so instead of a made-up percentage.
    parts.push(f.compressEnabled === false ? 'Compression: off' : `Compression: ${f.compress * 10}%`);
    return parts.join(' · ');
  };
  const convertedActions = (f: ToolFile) => (<>
    <button onClick={() => openRename(f)} aria-label={`Rename ${outputName(f)}`} title="Rename"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><PenLine className="h-5 w-5" /></button>
    {isImagePair && (f.file || f.uploadId) && (
      <button onClick={() => openInEditor(f)} aria-label="Edit in image editor" title={editorAllowed ? 'Edit in image editor' : 'Image editor — Basic and Pro only'}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{editorAllowed ? <Pencil className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</button>
    )}
    {isImagePair && (f.file || f.uploadId) && (
      <button onClick={() => openPreview(f)} aria-label={`Preview ${displayName(f)}`} title="Preview"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Eye className="h-5 w-5" /></button>
    )}
    {isImagePair && features?.compare && canCompare(f) && (
      <button onClick={() => (compareFile?.id === f.id ? closeCompare() : openCompare(f))} aria-label={`Compare original and converted ${outputName(f)}`} aria-pressed={compareFile?.id === f.id} title="Compare original and converted"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><SlidersHorizontal className="h-5 w-5" /></button>
    )}
    {isImagePair && !features?.compare && (
      <button onClick={() => setPaywallFeature('Before/After compare')} aria-label="Compare original and converted — Basic and Pro only" title="Compare — Basic and Pro only"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Lock className="h-5 w-5" /></button>
    )}
    {f.downloadUrl && (
      <a href={f.downloadUrl} download={outputName(f)} aria-label={`Download ${outputName(f)}`} title="Download"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Download className="h-5 w-5" /></a>
    )}
    <button onClick={() => removeFile(f.id)} aria-label={`Delete ${outputName(f)}`} title="Delete"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Trash2 className="h-5 w-5" /></button>
  </>);

  // The expanded compare slider under a converted row — list and grid
  // views share it: original on the left, converted on the right.
  const comparePanel = (f: ToolFile) => {
    if (compareFile?.id !== f.id || !compareBeforeUrl || !f.downloadUrl) return null;
    return <div className="mt-3"><CompareSlider beforeLabel={`${from.label} original`} afterLabel={`${to.label} result`} beforeSrc={compareBeforeUrl} afterSrc={f.downloadUrl} /></div>;
  };

  if (disabledPair) {
    return (
      <div className="w-full">
        <Card className="overflow-hidden">
          <div className="px-5 pb-5 pt-6 sm:px-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{from.label} to {to.label} Converter</h1>
            <p className="mt-2 text-sm text-muted">{pairDescription(from, to)}</p>
          </div>
        </Card>
        <div className="mt-4"><EmptyState title="This converter is temporarily unavailable" body={`The ${from.label} to ${to.label} converter is paused right now. Try one of the working alternatives below — your files are never affected.`} /></div>
      </div>
    );
  }

  return <div className="w-full">
    {/* Single centered column: one big tool card (title + converter bar
        + drop zone + files + controls + actions). No right sidebar —
        the converter switcher is a horizontal bar at the top of the
        card, and the ad and the small upload box live below the tool. */}
    <Card className="overflow-hidden">
      {/* The title/description keep the card padding; the "Change
          converter" card below spans the tool card's full inner width
          (1246px = the 1248px content width minus this card's own 1px
          borders) so the pair tool matches the home tool's 1248px card
          instead of sitting 25px inset on each side. */}
      <div className="pb-5 pt-6">
        <h1 className="px-5 text-2xl font-extrabold tracking-tight text-ink sm:px-6 sm:text-3xl">{from.label} to {to.label} Converter</h1>
        <p className="mt-2 px-5 text-sm text-muted sm:px-6">{pairDescription(from, to)}</p>
        <div className="mt-5">
          <p className="mb-2 px-5 text-xs font-bold uppercase tracking-wide text-muted sm:px-6">Change converter</p>
          <HeroPicker catalog={catalog} layout="bar" initialFrom={from.slug} initialTo={to.slug} lockedFrom={files.length > 0} />
        </div>
      </div>
      <div className="border-t border-line">
        <div
          role="button" tabIndex={0} aria-label={`Drop ${from.label} files here, or press Enter to browse`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 border-b-2 border-dashed px-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${files.length === 0 ? 'py-10 sm:py-14' : 'py-5'} ${dragOver ? 'border-primary bg-indigo-50' : 'border-line bg-gradient-to-b from-indigo-50/60 to-surface hover:border-primary/50'}`}>
          <span className={`flex items-center justify-center rounded-full bg-primary text-white ${files.length === 0 ? 'h-14 w-14' : 'h-10 w-10'}`}><Upload className={files.length === 0 ? 'h-7 w-7' : 'h-5 w-5'} aria-hidden /></span>
          <p className="text-base font-extrabold text-ink sm:text-lg">Drop your {from.label} files here</p>
          <p className="text-sm text-muted">or <span className="font-semibold text-primary underline">browse your files</span> — {from.label} to {to.label} in seconds</p>
          <p className="text-xs text-muted">Accepted: {acceptExts}</p>
          <input ref={inputRef} type="file" accept={acceptExts} multiple className="hidden" aria-hidden
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-muted">
          <span>Up to {batchLimit} files · {from.category === 'Video' ? '500 MB' : from.category === 'Audio' ? '100 MB' : '200 MB'} each · {remaining} left today</span>
          {files.length === 0 && <Button variant="secondary" onClick={trySample}>Try with a sample file</Button>}
        </div>
      </div>

      {files.length > 0 && (
        <div className="border-t border-line px-5 py-4 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Batch presets">
            <span className="text-xs font-semibold text-muted">Presets:</span>
            {(PRESETS[from.category] || []).map((p) => (
              <button key={p.label} onClick={() => applyPreset(p.label)}
                className="min-h-[36px] rounded-full border border-line px-3 text-xs font-semibold text-ink hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{p.label}</button>
            ))}
            <Tooltip label="Presets apply the recommended settings to every file. Use the Settings row below to fine-tune them."><span className="flex h-6 w-6 cursor-help items-center justify-center rounded-full bg-soft text-xs font-bold text-muted" tabIndex={0}>?</span></Tooltip>
          </div>
          {pendingFiles.length > 0 && (
            <div className="mb-4 rounded-card border border-line bg-soft/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Settings — applies to all files</p>
              <div className="mt-3 space-y-3 text-sm">
                {from.category === 'Images' && (<>
                  {isLossyTarget && (
                    <label className="block">Quality: <strong>{firstPending?.quality ?? 85}%</strong>
                      <input type="range" min={10} max={100} value={firstPending?.quality ?? 85} onChange={(e) => setAll({ quality: Number(e.target.value) })} className="mt-1 w-full" aria-label="Output quality" />
                    </label>
                  )}
                  {isPngTarget && (<>
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p>Compress: <strong>{(firstPending?.compressEnabled ?? true) ? (firstPending?.compress ?? 6) : 'off'}</strong></p>
                          <input type="range" min={0} max={9} value={firstPending?.compress ?? 6} disabled={!(firstPending?.compressEnabled ?? true)} onChange={(e) => setAll({ compress: Number(e.target.value) })} className="mt-1 w-full disabled:opacity-40" aria-label="PNG compression" />
                        </div>
                        {features?.compress_toggle && (
                          <span className="pt-1"><Switch checked={firstPending?.compressEnabled ?? true} onChange={(v) => setAll({ compressEnabled: v })} label="Compression on or off" /></span>
                        )}
                      </div>
                      <span className="mt-1 block text-xs text-muted">{(firstPending?.compressEnabled ?? true) ? 'Lossless PNG compression, 0–9. Higher means a smaller file with no loss of image quality.' : 'Compression is off — the file is saved with no compression.'}</span>
                    </div>
                    {!features?.compress_toggle && lockedFeatureRow('Compression on/off', 'Compress toggle')}
                  </>)}
                  {!isLossyTarget && !isPngTarget && (
                    <p className="text-muted">Default settings are used for this conversion. Quality and compression controls appear for JPG, WebP, AVIF and PNG targets.</p>
                  )}
                  <div className="flex items-center gap-3"><Switch checked={firstPending?.stripMeta ?? true} onChange={(v) => setAll({ stripMeta: v })} label="Strip metadata (including GPS location)" /><span>Strip metadata (GPS location removed by default)</span></div>
                  {features?.gps_remover ? (
                    (firstPending?.stripMeta ?? true)
                      ? <p className="text-xs text-muted">Remove GPS location — already removed, because “Strip metadata” above is on. Turn that off to remove GPS only and keep the rest of the metadata.</p>
                      : <div className="flex items-center gap-3"><Switch checked={firstPending?.stripGps ?? false} onChange={(v) => setAll({ stripGps: v })} label="Remove GPS location" /><span>Remove GPS location only — other metadata (camera, date) is kept.</span></div>
                  ) : lockedFeatureRow('Remove GPS location only', 'Remove GPS location')}
                  {features?.ai_data_remover ? (
                    (firstPending?.stripMeta ?? true)
                      ? <p className="text-xs text-muted">Remove AI data — already removed, because “Strip metadata” above is on. Turn that off to remove AI data only and keep the rest of the metadata.</p>
                      : <div>
                        <div className="flex items-center gap-3"><Switch checked={firstPending?.stripAiData ?? false} onChange={(v) => setAll({ stripAiData: v })} label="Remove AI data" /><span>Remove AI data</span></div>
                        <p className="mt-1 text-xs text-muted">Removes the AI credit and metadata from the file. Invisible pixel watermarks (like Google SynthID) cannot be removed.</p>
                      </div>
                  ) : lockedFeatureRow('Remove AI data', 'AI data remover')}
                  {isLossyTarget && (features?.target_size ? (
                    <label className="block">Target size (KB)
                      <input type="text" inputMode="numeric" value={firstPending?.targetSizeKb ?? ''} placeholder="e.g. 100" onChange={(e) => setAll({ targetSizeKb: e.target.value })} className="mt-1 min-h-[44px] w-full max-w-xs rounded-card border border-line px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Target file size in kilobytes" />
                      <span className="mt-1 block text-xs text-muted">The converter lowers quality automatically until the file fits — never below quality 10. The real resulting size is always shown.</span>
                      {targetSizeError(firstPending?.targetSizeKb) && <span role="alert" className="mt-1 block text-xs font-semibold text-danger">{targetSizeError(firstPending?.targetSizeKb)}</span>}
                    </label>
                  ) : lockedFeatureRow('Target file size', 'Target file size'))}
                </>)}
                {from.category === 'Audio' && (<>
                  <label className="block">Bitrate
                    <select value={firstPending?.bitrate ?? '192'} onChange={(e) => setAll({ bitrate: e.target.value })} className="ml-2 min-h-[40px] rounded-card border border-line px-2">
                      {['96', '128', '192', '256', '320'].map((b) => <option key={b}>{b} kbps</option>)}
                    </select>
                  </label>
                  <label className="block">Channels
                    <select value={firstPending?.channels ?? 'Stereo'} onChange={(e) => setAll({ channels: e.target.value })} className="ml-2 min-h-[40px] rounded-card border border-line px-2">
                      <option>Stereo</option><option>Mono</option>
                    </select>
                  </label>
                  <label className="block">Sample rate
                    <select value={firstPending?.sampleRate ?? '44100'} onChange={(e) => setAll({ sampleRate: e.target.value })} className="ml-2 min-h-[40px] rounded-card border border-line px-2">
                      {['22050', '44100', '48000'].map((s) => <option key={s}>{s} Hz</option>)}
                    </select>
                  </label>
                </>)}
                {from.category === 'Video' && (<>
                  <label className="block">Codec
                    <select value={firstPending?.codec ?? 'H.264'} onChange={(e) => setAll({ codec: e.target.value })} className="ml-2 min-h-[40px] rounded-card border border-line px-2">
                      <option>H.264</option><option>VP9</option>
                    </select>
                  </label>
                  <label className="block">CRF (quality): <strong>{firstPending?.crf ?? 23}</strong>
                    <input type="range" min={18} max={32} value={firstPending?.crf ?? 23} onChange={(e) => setAll({ crf: Number(e.target.value) })} className="mt-1 w-full" aria-label="CRF quality" />
                  </label>
                  <label className="block">Resolution
                    <select value={firstPending?.resolution ?? 'Original'} onChange={(e) => setAll({ resolution: e.target.value })} className="ml-2 min-h-[40px] rounded-card border border-line px-2">
                      {['Original', '1080p', '720p', '480p'].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </label>
                </>)}
                {from.category !== 'Images' && from.category !== 'Audio' && from.category !== 'Video' && (
                  <p className="text-muted">Default settings are used for this conversion. Quality options appear for image, audio, and video files.</p>
                )}
                {features?.batch_rename ? (
                  <label className="block">Batch rename pattern
                    <input type="text" value={firstPending?.renamePattern ?? ''} placeholder="e.g. photo-{n}" onChange={(e) => setAll({ renamePattern: e.target.value })} className="mt-1 min-h-[44px] w-full max-w-md rounded-card border border-line px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Batch rename pattern" />
                    <span className="mt-1 block text-xs text-muted">Use {'{n}'} for the file number (photo-001, photo-002), {'{date}'} for today’s date (YYYYMMDD) and {'{name}'} for the original name. Empty = names unchanged.</span>
                    {patternErr && <span role="alert" className="mt-1 block text-xs font-semibold text-danger">{patternErr}</span>}
                    {!patternErr && (firstPending?.renamePattern ?? '').trim() && readyFiles.length > 0 && (
                      <span className="mt-1 block text-xs text-muted">Output names: {readyFiles.slice(0, 2).map((rf, i) => previewPatternName(firstPending?.renamePattern ?? '', i, readyFiles.length, rf)).join(', ')}{readyFiles.length > 2 ? ', …' : ''}</span>
                    )}
                  </label>
                ) : lockedFeatureRow('Batch rename pattern', 'Batch rename')}
              </div>
            </div>
          )}
          <ul className="space-y-3">
            {pendingFiles.map((f) => (
              <li key={f.id} className="rounded-card border border-line bg-surface p-3">
                <div className="flex items-center gap-3">
                  <FileThumb kind={thumbKind} label={from.label} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink" title={displayName(f)}>{truncateMiddle(displayName(f))}</p>
                    <p className="text-xs text-muted">{formatBytes(f.size)} · <span className="rounded bg-soft px-1.5 py-0.5 font-semibold">{f.detected}</span> → {to.label}</p>
                    {(f.status === 'uploading' || f.status === 'converting' || f.status === 'waiting') && <div className="mt-2"><Progress value={f.progress} label={f.status === 'uploading' ? 'Uploading' : f.status === 'waiting' ? 'Waiting for the server' : 'Converting'} /></div>}
                    {f.waking && (f.status === 'uploading' || f.status === 'converting') && <p className="mt-1 text-xs text-muted">Waking up the server — please wait…</p>}
                    {f.status === 'waiting' && <p className="mt-1 text-xs text-muted">Your file is queued — it will convert when a worker is free.</p>}
                    {f.status === 'error' && <p className="mt-1 text-xs text-danger">{f.error} {f.hint}</p>}
                  </div>
                  {isImagePair && (f.file || f.uploadId) && (
                    <>
                      <button onClick={() => openPreview(f)} aria-label={`Preview ${displayName(f)}`} title="Preview"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Eye className="h-5 w-5" /></button>
                      <button onClick={() => openInEditor(f)} aria-label="Edit in image editor" title={editorAllowed ? 'Edit in image editor' : 'Image editor — Basic and Pro only'}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{editorAllowed ? <Pencil className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</button>
                    </>
                  )}
                  <button onClick={() => openRename(f)} aria-label={`Rename ${displayName(f)}`} title="Rename"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><PenLine className="h-5 w-5" /></button>
                  {f.status === 'uploading' || f.status === 'converting' || f.status === 'waiting' ? (
                    <button onClick={() => { abortRef.current[f.id] = true; try { xhrRef.current[f.id]?.abort(); } catch { /* ignore */ } clearWakingTimer(f.id); updateFile(f.id, { status: 'ready', progress: 0, waking: false }); }} aria-label={`Cancel ${displayName(f)}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-5 w-5" /></button>
                  ) : (
                    <button onClick={() => removeFile(f.id)} aria-label={`Remove ${displayName(f)}`} title="Remove"
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-danger hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Trash2 className="h-5 w-5" /></button>
                  )}
                </div>
                {f.status === 'error' && (
                  <div className="mt-3"><Button variant="secondary" onClick={() => { updateFile(f.id, { status: 'ready', progress: 0, error: undefined }); convertOne({ ...f, status: 'ready' }, `batch-${Date.now().toString(36)}`); }}>Retry (keeps settings)</Button></div>
                )}
              </li>
            ))}
          </ul>

          {running && (
            <div className="mt-4"><Progress value={files.length ? (doneCount / files.length) * 100 : 0} label={`${doneCount}/${files.length} done`} /></div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button onClick={convertAll} loading={running} disabled={running || files.every((f) => f.status === 'done') || files.length === 0}>
              Convert all ({files.filter((f) => f.status !== 'done').length}){totalOut ? ` · about ${formatBytes(totalOut)}` : ''}
            </Button>
            {running && <Button variant="secondary" onClick={cancelAll}>Cancel all</Button>}
            {doneFiles > 0 && failedFiles === 0 && (
              <Button variant="ghost" onClick={() => { setFiles([]); setDoneCount(0); clearHandoff(); }}>Convert another batch</Button>
            )}
          </div>
          {waitingFiles > 0 && (
            <p className="mt-3 text-sm text-muted">Waiting for the server — your files are queued and will convert when a worker is free. You can keep this page open or come back later; finished conversions appear in your account history.</p>
          )}
          {failedFiles > 0 && doneFiles === 0 && waitingFiles === 0 && !running && failedFiles === files.length && (
            <div className="mt-3"><EmptyState title="All conversions failed" body="Check the error message on each file for a fix, then retry. Your settings are kept." /></div>
          )}
          {doneFiles > 0 && failedFiles > 0 && (
            <p className="mt-3 text-sm text-warn">Partial success: {doneFiles} converted, {failedFiles} failed. You can retry the failed files.</p>
          )}
          {limitHit && (
            <div className="mt-4 rounded-card border border-warn/40 bg-amber-50 p-4">
              <p className="text-sm font-bold text-ink">You have reached your daily limit</p>
              <p className="mt-1 text-sm text-muted">Upgrade to convert more today, or come back tomorrow when your limit resets.</p>
              <a href="/pricing" className="mt-2 inline-block rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white">See plans</a>
            </div>
          )}
        </div>
      )}
      </Card>

      {convertedFiles.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">Converted Files ({convertedFiles.length})</h3>
                <p className="text-xs text-muted">New images appear at the top of the list.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-card bg-soft p-1" role="group" aria-label="Converted files view">
                  <button onClick={() => setConvertedView('list')} aria-pressed={convertedView === 'list'} aria-label="List view" title="List view"
                    className={`flex h-9 w-9 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${convertedView === 'list' ? 'bg-surface text-ink shadow' : 'text-muted hover:text-ink'}`}><List className="h-4 w-4" /></button>
                  <button onClick={() => setConvertedView('grid')} aria-pressed={convertedView === 'grid'} aria-label="Grid view" title="Grid view"
                    className={`flex h-9 w-9 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${convertedView === 'grid' ? 'bg-surface text-ink shadow' : 'text-muted hover:text-ink'}`}><LayoutGrid className="h-4 w-4" /></button>
                </div>
                <div className="relative">
                  <Button variant="secondary" onClick={() => setZipMenuOpen((v) => !v)} aria-haspopup="true" aria-expanded={zipMenuOpen}>ZIP Options</Button>
                  {zipMenuOpen && (
                    <>
                      <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setZipMenuOpen(false)} />
                      <div className="absolute right-0 z-20 mt-1 w-64 rounded-card border border-line bg-surface p-1 shadow-card">
                        <button onClick={() => { setZipMenuOpen(false); downloadAll(); }} className="block w-full rounded px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Download all as .zip</button>
                        <button onClick={() => { setZipMenuOpen(false); downloadEach(); }} className="block w-full rounded px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Download each file separately</button>
                      </div>
                    </>
                  )}
                </div>
                <Button variant="secondary" onClick={() => setShowDeleteAll(true)}>Delete All</Button>
              </div>
            </div>
            {convertedView === 'list' ? (
              <ul className="mt-4 space-y-3">
                {convertedFiles.map((f) => (
                  <li key={f.id} className="rounded-card border border-line bg-surface p-3">
                    <div className="flex items-center gap-3">
                      <FileThumb kind={thumbKind} label={to.label} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink" title={outputName(f)}>{truncateMiddle(outputName(f))}</p>
                        <p className="mt-0.5 flex items-center text-xs font-semibold text-success"><Check className="mr-1 h-3.5 w-3.5" />Done · {formatBytes(f.outSize || 0)}</p>
                        <p className="text-xs text-muted">{from.label} → {to.label} · {formatBytes(f.size)} → {formatBytes(f.outSize || 0)}</p>
                        {convertedMeta(f) && <p className="text-xs text-muted">{convertedMeta(f)}</p>}
                      </div>
                      {convertedActions(f)}
                    </div>
                    {comparePanel(f)}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {convertedFiles.map((f) => (
                  <div key={f.id} className="rounded-card border border-line bg-surface p-3">
                    <div className="flex items-start gap-3">
                      <FileThumb kind={thumbKind} label={to.label} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink" title={outputName(f)}>{truncateMiddle(outputName(f))}</p>
                        <p className="mt-0.5 flex items-center text-xs font-semibold text-success"><Check className="mr-1 h-3.5 w-3.5" />Done · {formatBytes(f.outSize || 0)}</p>
                        <p className="text-xs text-muted">{from.label} → {to.label} · {formatBytes(f.size)} → {formatBytes(f.outSize || 0)}</p>
                        {convertedMeta(f) && <p className="text-xs text-muted">{convertedMeta(f)}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-1 border-t border-line pt-2">{convertedActions(f)}</div>
                    {comparePanel(f)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {history.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="text-sm font-bold text-ink">Your recent conversions</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {history.map((h: any, i: number) => (
                <li key={h.id || i} className="flex items-center justify-between gap-2">
                  <span className="text-muted">{h.pair_slug || h.pair || ''} · {h.status || ''}</span>
                  {h.id && (h.status === 'done' || h.status === 'completed') && <a href={`/api/v1/jobs/${h.id}/download`} className="font-semibold text-primary">Re-download</a>}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    {/* The pair_sidebar ad below the tool. The second upload box that
        used to sit here is gone (user order 2026-11-26 — it looked like
        a duplicate): the pair page has exactly one upload area, the main
        drop zone at the top of the tool card. */}
    <div className="mt-4"><AdFrame slot="pair_sidebar" /></div>
    <MobileAnchorAd show={doneFiles > 0} />
    {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    {previewFile && (
      <Modal open={!!previewFile} onClose={closePreview} title={previewFile.name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewFile.url} alt={`Preview of ${previewFile.name}`} className="max-h-[70vh] w-full rounded-card object-contain" />
      </Modal>
    )}
    <Modal open={showEditorModal} onClose={() => setShowEditorModal(false)} title="Image editor is a paid feature">
      <p className="text-sm leading-relaxed text-muted">The image editor is available on Basic and Pro. Upgrade to edit your images before converting them.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/pricing" className="inline-flex min-h-[44px] items-center rounded-card bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">See pricing</a>
        <Button variant="secondary" onClick={() => setShowEditorModal(false)}>Not now</Button>
      </div>
    </Modal>
    <Modal open={!!paywallFeature} onClose={() => setPaywallFeature(null)} title={`${paywallFeature || 'This feature'} is a paid feature`}>
      <p className="text-sm leading-relaxed text-muted">This feature is available on Basic and Pro. Upgrade to use it on your conversions.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/pricing" className="inline-flex min-h-[44px] items-center rounded-card bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">See pricing</a>
        <Button variant="secondary" onClick={() => setPaywallFeature(null)}>Not now</Button>
      </div>
    </Modal>
    <Modal open={!!renameTarget} onClose={closeRename} title="Rename file">
      <label className="block text-sm font-semibold text-ink" htmlFor="rename-input">File name
        <span className="mt-2 flex items-center">
          <input id="rename-input" value={renameValue} onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); }}
            className="min-w-0 flex-1 rounded-l-card border border-line px-3 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="File name without extension" />
          {renameExt && <span className="shrink-0 rounded-r-card border border-l-0 border-line bg-soft px-3 py-2.5 text-sm text-muted">.{renameExt}</span>}
        </span>
      </label>
      <p className="mt-2 text-xs text-muted">Only the name changes — the{renameExt ? ` .${renameExt}` : ''} extension stays fixed so the file type cannot break. The new name applies to the file here and to the downloaded file.</p>
      {renameError && <p className="mt-2 text-sm font-semibold text-danger" role="alert">{renameError}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={saveRename}>Save</Button>
        <Button variant="secondary" onClick={closeRename}>Cancel</Button>
      </div>
    </Modal>
    <Modal open={showDeleteAll} onClose={() => setShowDeleteAll(false)} title="Delete all converted files?">
      <p className="text-sm leading-relaxed text-muted">This removes the {convertedFiles.length} converted file{convertedFiles.length === 1 ? '' : 's'} from this list and deletes {convertedFiles.length === 1 ? 'its' : 'their'} uploaded original{convertedFiles.length === 1 ? '' : 's'} from the server. Completed conversions stay in your account history.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={deleteAllConverted}>Delete all</Button>
        <Button variant="secondary" onClick={() => setShowDeleteAll(false)}>Cancel</Button>
      </div>
    </Modal>
  </div>;
}
