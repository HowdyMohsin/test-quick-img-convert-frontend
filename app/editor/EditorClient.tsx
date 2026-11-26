'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Card, Container, EmptyState } from '@/components/ui';
import { Crop, Download, FlipHorizontal2, FlipVertical2, Image as ImageIcon, Lock, Pencil, Redo2, RotateCcw, RotateCw, Undo2 } from 'lucide-react';

type Status = 'checking' | 'loading' | 'ready' | 'locked' | 'error' | 'empty';
type Tool = 'draw' | 'crop';

interface Adjust {
  brightness: number; // 0-200, 100 = unchanged
  contrast: number; // 0-200
  saturate: number; // 0-200
  grayscale: number; // 0-100
  sepia: number; // 0-100
  blur: number; // 0-10 px
}

const DEFAULT_ADJUST: Adjust = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0 };
const HISTORY_LIMIT = 20;

function filterString(a: Adjust): string {
  return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) grayscale(${a.grayscale}%) sepia(${a.sepia}%) blur(${a.blur}px)`;
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image file.')); };
    img.src = url;
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not restore image.'));
    img.src = dataUrl;
  });
}

export default function EditorClient() {
  const searchParams = useSearchParams();
  const uploadId = searchParams.get('upload');

  const baseRef = useRef<HTMLCanvasElement | null>(null); // committed image (no filters)
  const viewRef = useRef<HTMLCanvasElement | null>(null); // visible canvas (filters applied)
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState<Status>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [plan, setPlan] = useState('');
  const [fileName, setFileName] = useState('');
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const [tool, setTool] = useState<Tool>('draw');
  const [brushColor, setBrushColor] = useState('#4F46E5');
  const [brushSize, setBrushSize] = useState(6);
  const [adjust, setAdjust] = useState<Adjust>(DEFAULT_ADJUST);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [resizeW, setResizeW] = useState('');
  const [resizeH, setResizeH] = useState('');
  const [lockAspect, setLockAspect] = useState(true);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg'>('png');
  const [dragOver, setDragOver] = useState(false);

  // History: snapshots of the base canvas as data URLs, with an index pointer.
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);

  const getBase = useCallback((): HTMLCanvasElement | null => {
    if (!baseRef.current) {
      baseRef.current = document.createElement('canvas');
    }
    return baseRef.current;
  }, []);

  const renderView = useCallback(() => {
    const base = baseRef.current;
    const view = viewRef.current;
    if (!base || !view || base.width === 0) return;
    view.width = base.width;
    view.height = base.height;
    const ctx = view.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.filter = filterString(adjust);
    ctx.drawImage(base, 0, 0);
    ctx.filter = 'none';
    // Crop selection overlay (drawn in display space = base pixels here).
    if (cropRect && cropRect.w > 0 && cropRect.h > 0) {
      ctx.save();
      ctx.strokeStyle = '#4F46E5';
      ctx.lineWidth = Math.max(2, base.width / 500);
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
      ctx.fillStyle = 'rgba(79,70,229,0.12)';
      ctx.fillRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
      ctx.restore();
    }
  }, [adjust, cropRect]);

  // Re-render whenever adjustments or the crop overlay change.
  useEffect(() => { renderView(); }, [renderView]);

  const syncHistoryButtons = useCallback(() => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, []);

  const commit = useCallback(() => {
    const base = baseRef.current;
    if (!base || base.width === 0) return;
    // Drop any redo tail, then push the current state.
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(base.toDataURL('image/png'));
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  const restoreSnapshot = useCallback(async (dataUrl: string) => {
    const base = getBase();
    if (!base) return;
    const img = await loadImageFromDataUrl(dataUrl);
    base.width = img.naturalWidth;
    base.height = img.naturalHeight;
    const ctx = base.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    setDims({ w: base.width, h: base.height });
    setResizeW(String(base.width));
    setResizeH(String(base.height));
    setCropRect(null);
    renderView();
  }, [getBase, renderView]);

  const undo = useCallback(async () => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    await restoreSnapshot(historyRef.current[historyIdxRef.current]);
    syncHistoryButtons();
  }, [restoreSnapshot, syncHistoryButtons]);

  const redo = useCallback(async () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    await restoreSnapshot(historyRef.current[historyIdxRef.current]);
    syncHistoryButtons();
  }, [restoreSnapshot, syncHistoryButtons]);

  const placeImage = useCallback(async (img: HTMLImageElement, name: string) => {
    const base = getBase();
    if (!base) return;
    base.width = img.naturalWidth;
    base.height = img.naturalHeight;
    const ctx = base.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    setFileName(name);
    setDims({ w: base.width, h: base.height });
    setResizeW(String(base.width));
    setResizeH(String(base.height));
    setAdjust(DEFAULT_ADJUST);
    setCropRect(null);
    historyRef.current = [];
    historyIdxRef.current = -1;
    commit();
    setStatus('ready');
    // renderView runs via the adjust effect; force one too.
    requestAnimationFrame(() => renderView());
  }, [commit, getBase, renderView]);

  const loadLocalFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please choose an image file (PNG, JPG, WEBP, GIF, AVIF or similar).');
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      const img = await loadImageFromBlob(file);
      await placeImage(img, file.name);
    } catch {
      setErrorMsg('Could not read this image file. Please try another image.');
      setStatus('error');
    }
  }, [placeImage]);

  // ---- Access check + initial load ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Gate: only an explicit editor_allowed === false locks the editor.
      // Any other outcome (endpoint not yet deployed, network error) falls
      // through so the server-side /editor/file gate still decides.
      try {
        const res = await fetch('/api/v1/editor/access', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setPlan(typeof data.plan === 'string' ? data.plan : '');
          if (data.editor_allowed === false) {
            if (!cancelled) setStatus('locked');
            return;
          }
        }
      } catch { /* fall through to the file/local flow */ }

      if (cancelled) return;
      if (!uploadId) { setStatus('empty'); return; }

      setStatus('loading');
      try {
        const res = await fetch(`/api/v1/editor/file/${encodeURIComponent(uploadId)}`, { credentials: 'include' });
        if (cancelled) return;
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data?.error?.code === 'editor_locked' || data?.code === 'editor_locked') {
            setStatus('locked');
            return;
          }
          setErrorMsg('You do not have access to this file.');
          setStatus('error');
          return;
        }
        if (res.status === 404) {
          setErrorMsg('This upload could not be found. It may have expired or belong to a different account.');
          setStatus('error');
          return;
        }
        if (res.status === 415) {
          setErrorMsg('This upload is not an image, so it cannot be opened in the editor.');
          setStatus('error');
          return;
        }
        if (!res.ok) {
          setErrorMsg(`Could not load this image (server returned ${res.status}). Please try again from the converter.`);
          setStatus('error');
          return;
        }
        const blob = await res.blob();
        const img = await loadImageFromBlob(blob);
        if (cancelled) return;
        await placeImage(img, `image-${uploadId}.png`);
      } catch {
        if (cancelled) return;
        setErrorMsg('Could not load this image. Please check your connection and try again from the converter.');
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
    // Only run once on mount / when the upload id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId]);

  // ---- Pointer handling (draw + crop), with display-to-base scaling ----
  const toBaseCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const view = viewRef.current;
    const base = baseRef.current;
    if (!view || !base) return null;
    const rect = view.getBoundingClientRect();
    const scaleX = base.width / rect.width;
    const scaleY = base.height / rect.height;
    return {
      x: Math.max(0, Math.min(base.width, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(base.height, (e.clientY - rect.top) * scaleY)),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== 'ready') return;
    const p = toBaseCoords(e);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (tool === 'draw') {
      const base = getBase();
      const ctx = base?.getContext('2d');
      if (!base || !ctx) return;
      drawingRef.current = true;
      lastPointRef.current = p;
      ctx.strokeStyle = brushColor;
      ctx.fillStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Dot for a click without movement.
      ctx.beginPath();
      ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      renderView();
    } else {
      cropStartRef.current = p;
      setCropRect({ x: p.x, y: p.y, w: 0, h: 0 });
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toBaseCoords(e);
    if (!p) return;
    if (tool === 'draw' && drawingRef.current && lastPointRef.current) {
      const base = getBase();
      const ctx = base?.getContext('2d');
      if (!base || !ctx) return;
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPointRef.current = p;
      renderView();
    } else if (tool === 'crop' && cropStartRef.current) {
      const s = cropStartRef.current;
      setCropRect({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      });
    }
  };

  const onPointerUp = () => {
    if (tool === 'draw' && drawingRef.current) {
      drawingRef.current = false;
      lastPointRef.current = null;
      commit();
    }
    cropStartRef.current = null;
  };

  // ---- Mutating operations (each commits one history step) ----
  const applyCrop = () => {
    const base = baseRef.current;
    if (!base || !cropRect || cropRect.w < 2 || cropRect.h < 2) return;
    const next = document.createElement('canvas');
    next.width = Math.round(cropRect.w);
    next.height = Math.round(cropRect.h);
    const ctx = next.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(base, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, next.width, next.height);
    base.width = next.width;
    base.height = next.height;
    base.getContext('2d')?.drawImage(next, 0, 0);
    setDims({ w: base.width, h: base.height });
    setResizeW(String(base.width));
    setResizeH(String(base.height));
    setCropRect(null);
    commit();
    renderView();
  };

  const applyResize = () => {
    const base = baseRef.current;
    if (!base) return;
    const w = Math.floor(Number(resizeW));
    const h = Math.floor(Number(resizeH));
    if (!w || !h || w < 1 || h < 1 || w > 12000 || h > 12000) return;
    if (w === base.width && h === base.height) return;
    const next = document.createElement('canvas');
    next.width = w;
    next.height = h;
    const ctx = next.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(base, 0, 0, w, h);
    base.width = w;
    base.height = h;
    base.getContext('2d')?.drawImage(next, 0, 0);
    setDims({ w, h });
    commit();
    renderView();
  };

  const onResizeWidth = (value: string) => {
    setResizeW(value);
    if (lockAspect) {
      const w = Number(value);
      const base = baseRef.current;
      if (w > 0 && base && base.width > 0) {
        setResizeH(String(Math.max(1, Math.round((w * base.height) / base.width))));
      }
    }
  };

  const onResizeHeight = (value: string) => {
    setResizeH(value);
    if (lockAspect) {
      const h = Number(value);
      const base = baseRef.current;
      if (h > 0 && base && base.height > 0) {
        setResizeW(String(Math.max(1, Math.round((h * base.width) / base.height))));
      }
    }
  };

  const rotate = (dir: 1 | -1) => {
    const base = baseRef.current;
    if (!base) return;
    const next = document.createElement('canvas');
    next.width = base.height;
    next.height = base.width;
    const ctx = next.getContext('2d');
    if (!ctx) return;
    ctx.translate(next.width / 2, next.height / 2);
    ctx.rotate((dir * Math.PI) / 2);
    ctx.drawImage(base, -base.width / 2, -base.height / 2);
    base.width = next.width;
    base.height = next.height;
    base.getContext('2d')?.drawImage(next, 0, 0);
    setDims({ w: base.width, h: base.height });
    setResizeW(String(base.width));
    setResizeH(String(base.height));
    commit();
    renderView();
  };

  const flip = (horizontal: boolean) => {
    const base = baseRef.current;
    if (!base) return;
    const next = document.createElement('canvas');
    next.width = base.width;
    next.height = base.height;
    const ctx = next.getContext('2d');
    if (!ctx) return;
    ctx.translate(horizontal ? base.width : 0, horizontal ? 0 : base.height);
    ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
    ctx.drawImage(base, 0, 0);
    base.getContext('2d')?.drawImage(next, 0, 0);
    commit();
    renderView();
  };

  const download = () => {
    const base = baseRef.current;
    if (!base || base.width === 0) return;
    const out = document.createElement('canvas');
    out.width = base.width;
    out.height = base.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    if (exportFormat === 'jpg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.filter = filterString(adjust);
    ctx.drawImage(base, 0, 0);
    ctx.filter = 'none';
    const mime = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stem = fileName.replace(/\.[^.]+$/, '') || 'edited-image';
      a.href = url;
      a.download = `${stem}-edited.${exportFormat === 'jpg' ? 'jpg' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, mime, 0.92);
  };

  const resetAdjustments = () => setAdjust(DEFAULT_ADJUST);

  const toolBtn = (active: boolean) =>
    `inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      active ? 'bg-primary text-white' : 'bg-soft text-ink hover:bg-line'
    }`;

  // ---- States ----
  if (status === 'checking' || status === 'loading') {
    return (
      <Container className="py-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Image editor</h1>
        <div className="mt-6 flex flex-col items-center justify-center rounded-card-lg border border-line bg-surface p-12 text-center shadow-card">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-primary" aria-hidden />
          <p className="mt-4 text-sm text-muted">{status === 'checking' ? 'Checking editor access…' : 'Loading your image…'}</p>
        </div>
      </Container>
    );
  }

  if (status === 'locked') {
    return (
      <Container className="py-8">
        <div className="w-full">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Image editor</h1>
        <Card className="mt-6 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50" aria-hidden><Lock className="h-7 w-7 text-primary" /></div>
          <h2 className="text-xl font-bold text-ink">The image editor is a Basic &amp; Pro feature</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {plan ? `Your current plan is ${plan}. ` : ''}Upgrade to Basic or Pro to draw, crop, resize, rotate and adjust your images right in the browser.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/pricing"><Button>See plans &amp; upgrade</Button></Link>
            <Link href="/"><Button variant="secondary">Back to home</Button></Link>
          </div>
        </Card>
        </div>
      </Container>
    );
  }

  if (status === 'error') {
    return (
      <Container className="py-8">
        <div className="w-full">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Image editor</h1>
        <div className="mt-6">
          <EmptyState
            title="Could not open this image"
            body={errorMsg || 'Something went wrong while loading the image.'}
            action={<Link href="/"><Button>Back to home</Button></Link>}
          />
        </div>
        </div>
      </Container>
    );
  }

  if (status === 'empty') {
    return (
      <Container className="py-8">
        <div className="w-full">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Image editor</h1>
        <p className="mt-2 text-sm text-muted">Draw, crop, resize, rotate and adjust an image — everything runs in your browser.</p>
        <div
          className={`mt-6 rounded-card-lg border-2 border-dashed p-10 text-center transition-colors ${dragOver ? 'border-primary bg-indigo-50' : 'border-line bg-surface'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void loadLocalFile(f);
          }}
        >
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50" aria-hidden><ImageIcon className="h-7 w-7 text-primary" /></div>
          <p className="font-bold text-ink">Drop an image here, or choose one</p>
          <p className="mt-1 text-sm text-muted">PNG, JPG, WEBP, GIF, AVIF and more. Your image never leaves your browser.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadLocalFile(f); e.target.value = ''; }}
          />
          <Button className="mt-5" onClick={() => fileInputRef.current?.click()}>Choose an image</Button>
          <p className="mt-4 text-sm"><Link href="/" className="font-semibold text-primary hover:underline">Back to home</Link></p>
        </div>
        </div>
      </Container>
    );
  }

  // ---- Ready: the editor ----
  const adjustmentsChanged = JSON.stringify(adjust) !== JSON.stringify(DEFAULT_ADJUST);
  return (
    <Container className="py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Image editor</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="font-semibold text-ink">{fileName || 'Untitled image'}</span>
            {dims.w > 0 && <span> · {dims.w} × {dims.h} px</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="export-format" className="text-sm font-semibold text-ink">Download as</label>
          <select
            id="export-format"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpg')}
            className="min-h-[44px] rounded-card border border-line bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
          <Button onClick={download}><Download className="h-4 w-4" /> Download</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* ---- Toolbar ---- */}
        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Tools</h2>
            <div className="mt-3 flex gap-2">
              <button type="button" className={toolBtn(tool === 'draw')} aria-pressed={tool === 'draw'} onClick={() => { setTool('draw'); setCropRect(null); }}><Pencil className="h-4 w-4" /> Draw</button>
              <button type="button" className={toolBtn(tool === 'crop')} aria-pressed={tool === 'crop'} onClick={() => setTool('crop')}><Crop className="h-4 w-4" /> Crop</button>
            </div>
            {tool === 'draw' && (
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="brush-color" className="mb-1.5 block text-sm font-semibold text-ink">Brush colour</label>
                  <div className="flex items-center gap-2">
                    <input id="brush-color" type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="h-11 w-14 cursor-pointer rounded-card border border-line bg-surface" />
                    <span className="text-sm text-muted">{brushColor}</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="brush-size" className="mb-1.5 block text-sm font-semibold text-ink">Brush size: {brushSize}px</label>
                  <input id="brush-size" type="range" min={1} max={60} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full accent-[#4F46E5]" />
                </div>
                <p className="text-xs text-muted">Draw directly on the image. Use Undo if you make a mistake.</p>
              </div>
            )}
            {tool === 'crop' && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted">Drag a rectangle on the image, then apply the crop.</p>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={!cropRect || cropRect.w < 2 || cropRect.h < 2} onClick={applyCrop}>Apply crop</Button>
                  <Button variant="ghost" disabled={!cropRect} onClick={() => setCropRect(null)}>Cancel</Button>
                </div>
                {cropRect && cropRect.w >= 2 && cropRect.h >= 2 && (
                  <p className="text-xs text-muted">Selected: {Math.round(cropRect.w)} × {Math.round(cropRect.h)} px</p>
                )}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Resize</h2>
            <div className="mt-3 flex items-end gap-2">
              <div className="w-full">
                <label htmlFor="resize-w" className="mb-1 block text-xs font-semibold text-ink">Width (px)</label>
                <input id="resize-w" type="number" min={1} max={12000} value={resizeW} onChange={(e) => onResizeWidth(e.target.value)} className="min-h-[44px] w-full rounded-card border border-line bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <span className="pb-3 text-muted" aria-hidden>×</span>
              <div className="w-full">
                <label htmlFor="resize-h" className="mb-1 block text-xs font-semibold text-ink">Height (px)</label>
                <input id="resize-h" type="number" min={1} max={12000} value={resizeH} onChange={(e) => onResizeHeight(e.target.value)} className="min-h-[44px] w-full rounded-card border border-line bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} className="h-4 w-4 accent-[#4F46E5]" />
              Lock aspect ratio
            </label>
            <Button variant="secondary" className="mt-3 w-full" onClick={applyResize}>Apply resize</Button>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Rotate &amp; flip</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className={toolBtn(false)} onClick={() => rotate(-1)}><RotateCcw className="h-4 w-4" /> Rotate left</button>
              <button type="button" className={toolBtn(false)} onClick={() => rotate(1)}><RotateCw className="h-4 w-4" /> Rotate right</button>
              <button type="button" className={toolBtn(false)} onClick={() => flip(true)}><FlipHorizontal2 className="h-4 w-4" /> Flip horizontal</button>
              <button type="button" className={toolBtn(false)} onClick={() => flip(false)}><FlipVertical2 className="h-4 w-4" /> Flip vertical</button>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Adjust</h2>
              <button type="button" disabled={!adjustmentsChanged} onClick={resetAdjustments} className="text-sm font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50">Reset</button>
            </div>
            <div className="mt-3 space-y-3">
              {([
                ['brightness', 'Brightness', 0, 200, '%'],
                ['contrast', 'Contrast', 0, 200, '%'],
                ['saturate', 'Saturation', 0, 200, '%'],
                ['grayscale', 'Grayscale', 0, 100, '%'],
                ['sepia', 'Sepia', 0, 100, '%'],
                ['blur', 'Blur', 0, 10, 'px'],
              ] as const).map(([key, label, min, max, unit]) => (
                <div key={key}>
                  <label htmlFor={`adj-${key}`} className="mb-1 flex justify-between text-sm font-semibold text-ink">
                    <span>{label}</span>
                    <span className="font-normal text-muted">{adjust[key]}{unit}</span>
                  </label>
                  <input
                    id={`adj-${key}`}
                    type="range"
                    min={min}
                    max={max}
                    value={adjust[key]}
                    onChange={(e) => setAdjust((a) => ({ ...a, [key]: Number(e.target.value) }))}
                    className="w-full accent-[#4F46E5]"
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">History</h2>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={!canUndo} onClick={() => void undo()}><Undo2 className="h-4 w-4" /> Undo</Button>
              <Button variant="secondary" className="flex-1" disabled={!canRedo} onClick={() => void redo()}><Redo2 className="h-4 w-4" /> Redo</Button>
            </div>
          </Card>
        </aside>

        {/* ---- Canvas ---- */}
        <div className="rounded-card-lg border border-line bg-soft p-4 shadow-card">
          <div className="flex min-h-[320px] items-center justify-center overflow-auto">
            <canvas
              ref={viewRef}
              className="max-h-[75vh] max-w-full rounded bg-white shadow-card"
              style={{ touchAction: 'none', cursor: tool === 'crop' ? 'crosshair' : 'crosshair' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              aria-label="Image canvas. Draw with the pencil tool or drag to select a crop area."
            />
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            {tool === 'draw'
              ? 'Draw tool active — drag on the image to draw.'
              : 'Crop tool active — drag a rectangle on the image, then press “Apply crop”.'}
          </p>
        </div>
      </div>
    </Container>
  );
}
