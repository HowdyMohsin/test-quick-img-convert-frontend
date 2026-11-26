'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, formatBytes, friendlyErrorMessage, getCsrf, notifyMeChanged, toArray, truncateMiddle } from '@/lib/api';
import type { FormatInfo, Catalog } from '@/lib/catalog';
import { Button, Card, CompareSlider, EmptyState, FileThumb, Modal, Progress, Switch, Toast, Tooltip } from './ui';
import { Check, Eye, Lock, Pencil, Upload, X } from 'lucide-react';
import { AdFrame, MobileAnchorAd } from './AdFrame';
import { HeroPicker, HOME_UPLOAD_HANDOFF_KEY, type HomeUploadHandoff, type HomeUploadHandoffPayload } from './HeroPicker';

type FileStatus = 'ready' | 'uploading' | 'converting' | 'waiting' | 'done' | 'error';
interface ToolFile {
  id: string; file?: File; name: string; size: number; detected: string;
  status: FileStatus; progress: number; error?: string; hint?: string;
  downloadUrl?: string; outSize?: number; savings?: number; jobId?: string; uploadId?: string;
  quality: number; compress: number; stripMeta: boolean; bitrate: string; channels: string; sampleRate: string;
  codec: string; crf: number; resolution: string;
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
  const [showCompare, setShowCompare] = useState(false);
  const [editorAllowed, setEditorAllowed] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<Record<string, boolean>>({});
  // The poll loop stops touching state once the tool unmounts (user
  // navigates away while a job is still waiting) — the job itself keeps
  // waiting on the server and shows up in the account history.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
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
  const removeFile = (id: string) => {
    const next = files.filter((f) => f.id !== id);
    setFiles(next);
    // The batch is gone — drop the handoff so the files do not come back
    // when the user returns to this pair page.
    if (next.length === 0) clearHandoff();
  };

  const openPreview = (tf: ToolFile) => {
    if (!isImagePair || !tf.file) return;
    const url = URL.createObjectURL(tf.file);
    setPreviewFile({ url, name: tf.name });
  };
  const closePreview = () => {
    if (previewFile) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
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

  const convertOne = async (tf: ToolFile, batchId: string): Promise<boolean> => {
    if (abortRef.current[tf.id]) return false;
    try {
      // Files handed over from the home page already have an upload id —
      // skip the upload and convert straight away.
      let uploadId = tf.uploadId || '';
      if (uploadId) {
        updateFile(tf.id, { status: 'uploading', progress: 30 });
      } else {
        updateFile(tf.id, { status: 'uploading', progress: 5 });
        if (!tf.file) throw new Error('This file was not uploaded — please add it again.');
        const form = new FormData();
        form.append('file', tf.file);
        const up = await apiFetch<{ id: string; upload_id?: string }>('/v1/uploads', { method: 'POST', body: form });
        uploadId = up.id || up.upload_id || '';
        updateFile(tf.id, { uploadId, progress: 30 });
      }
      if (abortRef.current[tf.id]) return false;
      updateFile(tf.id, { status: 'converting', progress: 45 });
      // Quality and compression are separate controls:
      // - Quality -> settings.quality, for lossy targets only (jpg, webp, avif).
      // - Compress -> settings.compression, for the png target only
      //   (PNG compress_level 0-9, lossless — higher means a smaller file,
      //   never lower image quality).
      // Other image targets get no quality/compression setting.
      const imageSettings: Record<string, unknown> = { strip_metadata: tf.stripMeta };
      if (isLossyTarget) imageSettings.quality = tf.quality;
      if (isPngTarget) imageSettings.compression = tf.compress;
      const settings: Record<string, unknown> = from.category === 'Images'
        ? imageSettings
        : from.category === 'Audio'
        ? { bitrate: Number(tf.bitrate), channels: tf.channels, sample_rate: Number(tf.sampleRate) }
        : from.category === 'Video'
        ? { codec: tf.codec, crf: tf.crf, resolution: tf.resolution }
        : {};
      const job = await apiFetch<{ id: string; job_id?: string }>('/v1/convert', { method: 'POST', body: { upload_id: uploadId, to: to.slug, settings, batch_id: batchId } });
      const jobId = job.id || job.job_id || '';
      updateFile(tf.id, { jobId });
      // Poll job status. A job that is still queued or converting is NEVER
      // a failure: on a backend with no worker (or a busy one) a job can
      // sit queued indefinitely, so there is no fixed timeout that turns
      // it into an error, and "try a smaller file" must never appear for
      // a file that was never even attempted. After ~60s the row switches
      // to an honest "waiting for the server" state and polling slows to
      // every 5s; the user can cancel at any time. Only a terminal
      // backend status, a lost job, or sustained loss of contact with the
      // server ends the wait as an error.
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
          updateFile(tf.id, { status: 'done', progress: 100, outSize, savings: tf.size ? Math.round((1 - outSize / tf.size) * 100) : 0, downloadUrl: `/api/v1/jobs/${jobId}/download` });
          setDoneCount((c) => c + 1);
          notifyMeChanged();
          return true;
        }
        if (j.status === 'failed' || j.status === 'error') {
          updateFile(tf.id, { status: 'error', error: j.error_message || 'Conversion failed.', hint: 'Try the file again, or re-export it from the app that created it.' });
          return false;
        }
        if (j.status === 'cancelled') {
          updateFile(tf.id, { status: 'error', error: 'This conversion was cancelled.', hint: 'Try again if you still need it.' });
          return false;
        }
        // Still queued / running: keep waiting.
        const slow = waitedMs >= 60_000;
        if (slow) {
          if (!waitingShown) {
            waitingShown = true;
            updateFile(tf.id, { status: 'waiting', progress: 45 });
          }
        } else {
          updateFile(tf.id, { progress: 45 + Math.min(50, (j.progress || 0) / 2) });
        }
        await new Promise((r) => setTimeout(r, slow ? 5000 : 1500));
        waitedMs += slow ? 5000 : 1500;
      }
    } catch (e: any) {
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
    if (ready.length > remaining) { setLimitHit(true); return; }
    setRunning(true);
    setDoneCount(0);
    const batchId = `batch-${Date.now().toString(36)}`;
    // Pipelined: start each file's upload while earlier files convert.
    // convertOne reports its own outcome, so count the resolved values:
    // `files` here is the render-time closure (every file is 'ready' at
    // click time), so filtering it for 'done' can never see a finished
    // file and the toast below could never fire.
    const results = await Promise.all(ready.map((f) => convertOne(f, batchId)));
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
    files.forEach((f) => { abortRef.current[f.id] = true; });
    setRunning(false);
    setFiles((fs) => fs.map((f) => ((f.status === 'uploading' || f.status === 'converting' || f.status === 'waiting') ? { ...f, status: 'ready', progress: 0 } : f)));
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
  const thumbKind = from.category === 'Images' ? 'image' : from.category === 'Audio' ? 'audio' : from.category === 'Video' ? 'video' : from.slug === 'pdf' ? 'pdf' : 'file';

  if (disabledPair) {
    return <EmptyState title="This converter is temporarily unavailable" body={`The ${from.label} to ${to.label} converter is paused right now. Try one of the working alternatives below — your files are never affected.`} />;
  }

  return <div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
    <Card className="overflow-hidden">
      {files.length === 0 && (
        <div className="px-5 pb-5">
          <EmptyState title="No files yet" body={`Add ${from.label} files to convert them to ${to.label}.`} action={<Button variant="secondary" onClick={trySample}>Try with a sample file</Button>} />
        </div>
      )}

      {files.length > 0 && (
        <div className="px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Batch presets">
            <span className="text-xs font-semibold text-muted">Presets:</span>
            {(PRESETS[from.category] || []).map((p) => (
              <button key={p.label} onClick={() => applyPreset(p.label)}
                className="min-h-[36px] rounded-full border border-line px-3 text-xs font-semibold text-ink hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{p.label}</button>
            ))}
            <Tooltip label="Presets apply the recommended settings to every file. You can still change each file's settings individually."><span className="flex h-6 w-6 cursor-help items-center justify-center rounded-full bg-soft text-xs font-bold text-muted" tabIndex={0}>?</span></Tooltip>
          </div>
          <ul className="space-y-3">
            {files.map((f) => (
              <li key={f.id} className="rounded-card border border-line bg-surface p-3">
                <div className="flex items-center gap-3">
                  <FileThumb kind={thumbKind} label={from.label} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink" title={f.name}>{truncateMiddle(f.name)}</p>
                    <p className="text-xs text-muted">{formatBytes(f.size)} · <span className="rounded bg-soft px-1.5 py-0.5 font-semibold">{f.detected}</span> → {to.label}</p>
                    {(f.status === 'uploading' || f.status === 'converting' || f.status === 'waiting') && <div className="mt-2"><Progress value={f.progress} label={f.status === 'uploading' ? 'Uploading' : f.status === 'waiting' ? 'Waiting for the server' : 'Converting'} /></div>}
                    {f.status === 'waiting' && <p className="mt-1 text-xs text-muted">Your file is queued — it will convert when a worker is free.</p>}
                    {f.status === 'done' && <p className="mt-1 flex items-center text-xs font-semibold text-success"><Check className="mr-1 h-3.5 w-3.5" />Done · {formatBytes(f.outSize || 0)}{f.savings ? ` · ${f.savings > 0 ? `-${f.savings}%` : `+${-f.savings}%`}` : ''}</p>}
                    {f.status === 'error' && <p className="mt-1 text-xs text-danger">{f.error} {f.hint}</p>}
                  </div>
                  {isImagePair && f.file && (
                    <>
                      <button onClick={() => openPreview(f)} aria-label={`Preview ${f.name}`} title="Preview"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Eye className="h-5 w-5" /></button>
                      <button onClick={() => openInEditor(f)} aria-label="Edit in image editor" title={editorAllowed ? 'Edit in image editor' : 'Image editor — Basic and Pro only'}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{editorAllowed ? <Pencil className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</button>
                    </>
                  )}
                  {f.status === 'uploading' || f.status === 'converting' || f.status === 'waiting' ? (
                    <button onClick={() => { abortRef.current[f.id] = true; updateFile(f.id, { status: 'ready', progress: 0 }); }} aria-label={`Cancel ${f.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-5 w-5" /></button>
                  ) : (
                    <button onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-5 w-5" /></button>
                  )}
                </div>
                {f.status === 'done' && f.downloadUrl && (
                  <div className="mt-3 flex gap-2">
                    <a href={f.downloadUrl} className="inline-flex min-h-[40px] items-center rounded-card bg-success px-4 text-sm font-semibold text-white hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success">Download {to.label}</a>
                    <button onClick={() => setShowCompare(!showCompare)} className="min-h-[40px] rounded-card border border-line px-4 text-sm font-semibold text-ink hover:bg-soft">Compare</button>
                  </div>
                )}
                {f.status === 'error' && (
                  <div className="mt-3"><Button variant="secondary" onClick={() => { updateFile(f.id, { status: 'ready', progress: 0, error: undefined }); convertOne({ ...f, status: 'ready' }, `batch-${Date.now().toString(36)}`); }}>Retry (keeps settings)</Button></div>
                )}
                {/* Per-file settings */}
                <details className="mt-3 rounded-card bg-soft/60 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Settings for this file</summary>
                  <div className="mt-3 space-y-3 text-sm">
                    {from.category === 'Images' && (<>
                      {isLossyTarget && (
                        <label className="block">Quality: <strong>{f.quality}%</strong>
                          <input type="range" min={10} max={100} value={f.quality} onChange={(e) => updateFile(f.id, { quality: Number(e.target.value) })} className="mt-1 w-full" aria-label="Output quality" />
                        </label>
                      )}
                      {isPngTarget && (
                        <label className="block">Compress: <strong>{f.compress}</strong>
                          <input type="range" min={0} max={9} value={f.compress} onChange={(e) => updateFile(f.id, { compress: Number(e.target.value) })} className="mt-1 w-full" aria-label="PNG compression" />
                          <span className="mt-1 block text-xs text-muted">Lossless PNG compression, 0–9. Higher means a smaller file with no loss of image quality.</span>
                        </label>
                      )}
                      {!isLossyTarget && !isPngTarget && (
                        <p className="text-muted">Default settings are used for this conversion. Quality and compression controls appear for JPG, WebP, AVIF and PNG targets.</p>
                      )}
                      <div className="flex items-center gap-3"><Switch checked={f.stripMeta} onChange={(v) => updateFile(f.id, { stripMeta: v })} label="Strip metadata (including GPS location)" /><span>Strip metadata (GPS location removed by default)</span></div>
                    </>)}
                    {from.category === 'Audio' && (<>
                      <label className="block">Bitrate
                        <select value={f.bitrate} onChange={(e) => updateFile(f.id, { bitrate: e.target.value })} className="ml-2 min-h-[40px] rounded-card border border-line px-2">
                          {['96', '128', '192', '256', '320'].map((b) => <option key={b}>{b} kbps</option>)}
                        </select>
                      </label>
                      <label className="block">Channels
                        <select value={f.channels} onChange={(e) => updateFile(f.id, { channels: e.target.value })} className="ml-2 min-h-[40px] rounded-card border border-line px-2">
                          <option>Stereo</option><option>Mono</option>
                        </select>
                      </label>
                      <label className="block">Sample rate
                        <select value={f.sampleRate} onChange={(e) => updateFile(f.id, { sampleRate: e.target.value })} className="ml-2 min-h-[40px] rounded-card border border-line px-2">
                          {['22050', '44100', '48000'].map((s) => <option key={s}>{s} Hz</option>)}
                        </select>
                      </label>
                    </>)}
                    {from.category === 'Video' && (<>
                      <label className="block">Codec
                        <select value={f.codec} onChange={(e) => updateFile(f.id, { codec: e.target.value })} className="ml-2 min-h-[40px] rounded-card border border-line px-2">
                          <option>H.264</option><option>VP9</option>
                        </select>
                      </label>
                      <label className="block">CRF (quality): <strong>{f.crf}</strong>
                        <input type="range" min={18} max={32} value={f.crf} onChange={(e) => updateFile(f.id, { crf: Number(e.target.value) })} className="mt-1 w-full" aria-label="CRF quality" />
                      </label>
                      <label className="block">Resolution
                        <select value={f.resolution} onChange={(e) => updateFile(f.id, { resolution: e.target.value })} className="ml-2 min-h-[40px] rounded-card border border-line px-2">
                          {['Original', '1080p', '720p', '480p'].map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </label>
                    </>)}
                    {from.category !== 'Images' && from.category !== 'Audio' && from.category !== 'Video' && (
                      <p className="text-muted">Default settings are used for this conversion. Quality options appear for image, audio, and video files.</p>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>

          {running && (
            <div className="mt-4"><Progress value={files.length ? (doneCount / files.length) * 100 : 0} label={`${doneCount}/${files.length} done`} /></div>
          )}

          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 rounded-card bg-surface py-3 sm:static">
            <Button onClick={convertAll} loading={running} disabled={running || files.every((f) => f.status === 'done') || files.length === 0}>
              Convert all ({files.filter((f) => f.status !== 'done').length}){totalOut ? ` · about ${formatBytes(totalOut)}` : ''}
            </Button>
            {running && <Button variant="secondary" onClick={cancelAll}>Cancel all</Button>}
            {doneFiles > 0 && <Button variant="secondary" onClick={downloadAll}>Download all (.zip)</Button>}
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

      {showCompare && doneFiles > 0 && from.category === 'Images' && (
        <div className="px-5 pb-5"><CompareSlider beforeLabel={`${from.label} original`} afterLabel={`${to.label} result`} /></div>
      )}

      {history.length > 0 && (
        <div className="border-t border-line px-5 py-4">
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
      )}
    </Card>
    <aside className="space-y-4" aria-label="Change converter, upload and advertisement">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Change converter</p>
        <HeroPicker catalog={catalog} layout="side" initialFrom={from.slug} initialTo={to.slug} lockedFrom={files.length > 0} />
      </div>
      <Card className="overflow-hidden">
        <div
          role="button" tabIndex={0} aria-label={`Drop ${from.label} files here, or press Enter to browse`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed px-4 py-6 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${dragOver ? 'border-primary bg-indigo-50 shadow-[0_0_0_4px_rgba(79,70,229,.15)]' : 'border-line bg-soft/40 hover:border-primary/50'}`}>
          <Upload className="h-7 w-7 text-muted" aria-hidden />
          <p className="text-sm font-bold text-ink">Drop files here or browse</p>
          <p className="text-xs text-muted">Accepted: {acceptExts}</p>
          <input ref={inputRef} type="file" accept={acceptExts} multiple className="hidden" aria-hidden
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        </div>
        <div className="border-t border-line px-4 py-3 text-center text-xs text-muted">
          Up to {batchLimit} files · {from.category === 'Video' ? '500 MB' : from.category === 'Audio' ? '100 MB' : '200 MB'} each · {remaining} left today
        </div>
      </Card>
      <AdFrame slot="pair_sidebar" />
    </aside>
    </div>
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
  </div>;
}
