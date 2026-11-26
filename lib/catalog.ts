// Catalog: pair/format data. Source of truth at runtime is GET /v1/formats
// (fetched at request time by server components). This bundled catalog
// (lib/catalog.json, generated from the spec §3 matrix rules) is the
// fallback when the API is unreachable and drives generateStaticParams.
import rawCatalog from './catalog.json';

export type FormatCategory = 'Images' | 'Camera RAW' | 'Audio' | 'Video' | 'Documents and vector';
export interface FormatInfo {
  slug: string; label: string; category: FormatCategory;
  extensions: string[]; aliases: string[]; description: string; uses: string;
}
export interface Pair { from: string; to: string; slug: string }
export interface Catalog {
  categories: string[];
  formats: FormatInfo[];
  pairs: Pair[];
  targetsByInput: Record<string, string[]>;
  inputsByTarget: Record<string, string[]>;
}

function normalizeFormat(f: any): FormatInfo {
  const aliases = Array.isArray(f.aliases) ? f.aliases : Object.keys(f.aliases || {});
  const uses = Array.isArray(f.uses) ? f.uses.join(', ') : (f.uses || '');
  return {
    slug: f.slug, label: f.label || f.slug.toUpperCase(), category: f.category,
    extensions: f.extensions || [f.slug], aliases, description: f.description || '', uses,
  };
}

function buildCatalog(): Catalog {
  const raw: any = rawCatalog;
  const formats = (raw.formats as any[]).map(normalizeFormat);
  const pairs: Pair[] = [];
  const targetsByInput: Record<string, string[]> = {};
  const inputsByTarget: Record<string, string[]> = {};
  const addPair = (from: string, to: string) => {
    if (from === to) return;
    const slug = `${from}-to-${to}`;
    if (pairs.some((p) => p.slug === slug)) return;
    pairs.push({ from, to, slug });
    (targetsByInput[from] ??= []).push(to);
    (inputsByTarget[to] ??= []).push(from);
  };
  if (raw.targets_by_input) {
    for (const [from, tos] of Object.entries(raw.targets_by_input as Record<string, string[]>)) {
      for (const to of tos) addPair(from, to);
    }
  } else {
    for (const rule of raw.pairRules as { inputs: string[]; targets: string[] }[]) {
      for (const from of rule.inputs) for (const to of rule.targets) addPair(from, to);
    }
  }
  return { categories: raw.categories, formats, pairs, targetsByInput, inputsByTarget };
}

export const localCatalog: Catalog = buildCatalog();
export const pairCount = localCatalog.pairs.length; // computed, never hard-coded
export const formatBySlug = (slug: string) => localCatalog.formats.find((f) => f.slug === slug);
// Popular conversion targets, most common first. The Convert-from
// dropdown shows these as tags (e.g. JPG → WEBP PNG AVIF) — only targets
// that really exist for that source in the pair matrix, at most 4.
const POPULAR_TARGETS = [
  'webp', 'png', 'jpg', 'avif', 'gif', 'pdf', 'mp4', 'mp3', 'svg',
  'tiff', 'bmp', 'ico', 'wav', 'mov', 'mkv', 'jpeg', 'doc', 'docx',
];
export function popularTargets(
  from: string,
  targetsByInput: Record<string, string[]> = localCatalog.targetsByInput,
  max = 4,
): string[] {
  const real = targetsByInput[from] || [];
  const ranked = [...POPULAR_TARGETS.filter((t) => real.includes(t)),
    ...real.filter((t) => !POPULAR_TARGETS.includes(t))];
  return ranked.slice(0, max);
}

// Mirror of popularTargets for the other direction: the popular SOURCE
// formats that can convert TO this target (AVIF ← WEBP PNG JPG GIF).
export function popularSources(
  to: string,
  inputsByTarget: Record<string, string[]> = localCatalog.inputsByTarget,
  max = 4,
): string[] {
  const real = inputsByTarget[to] || [];
  const ranked = [...POPULAR_TARGETS.filter((t) => real.includes(t)),
    ...real.filter((t) => !POPULAR_TARGETS.includes(t))];
  return ranked.slice(0, max);
}
export const resolveAlias = (s: string) => {
  const lower = s.toLowerCase();
  const direct = localCatalog.formats.find((f) => f.slug === lower);
  if (direct) return direct.slug;
  const aliased = localCatalog.formats.find((f) => f.aliases.includes(lower) || f.extensions.includes(lower));
  return aliased ? aliased.slug : lower;
};
export const pairFor = (from: string, to: string) =>
  localCatalog.pairs.find((p) => p.from === resolveAlias(from) && p.to === resolveAlias(to));

export const CATEGORIES: FormatCategory[] = ['Images', 'Camera RAW', 'Audio', 'Video', 'Documents and vector'];

// Server-side: try the live API first, fall back to the bundled catalog.
export async function getCatalog(): Promise<{ catalog: Catalog; healthy: Set<string>; fromApi: boolean }> {
  const base = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  try {
    const res = await fetch(`${base}/v1/formats`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const formats: FormatInfo[] = (data.formats || []).map((f: any) => ({
        slug: f.slug, label: f.label || f.slug.toUpperCase(), category: f.category,
        extensions: f.extensions || [f.slug], aliases: Object.keys(f.aliases || {}),
        description: f.description || '', uses: (f.uses || []).join(', '),
      }));
      const targetsByInput: Record<string, string[]> = data.targets_by_input || {};
      const pairs: Pair[] = [];
      const inputsByTarget: Record<string, string[]> = {};
      for (const [from, tos] of Object.entries(targetsByInput)) {
        for (const to of tos as string[]) {
          pairs.push({ from, to, slug: `${from}-to-${to}` });
          (inputsByTarget[to] ??= []).push(from);
        }
      }
      const healthy = new Set<string>();
      for (const p of data.pairs || []) if (p.status !== 'disabled') healthy.add(p.slug || `${p.from}-to-${p.to}`);
      if (formats.length && pairs.length) {
        return { catalog: { categories: data.categories || CATEGORIES, formats, pairs, targetsByInput, inputsByTarget }, healthy, fromApi: true };
      }
    }
  } catch { /* API unreachable — use bundled catalog */ }
  return { catalog: localCatalog, healthy: new Set(localCatalog.pairs.map((p) => p.slug)), fromApi: false };
}
