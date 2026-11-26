// Lucide icons for format cards and category tabs. One sensible icon per
// format (falling back to its category icon) and one per category tab.
import type { LucideIcon } from 'lucide-react';
import {
  Aperture, AudioLines, Camera, Clapperboard, File, FileAudio, FileImage,
  FileText, FileVideo, Film, Image, ImagePlay, Layers, Music, PenTool,
  Shapes, Video,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  All: Shapes,
  Images: Image,
  'Camera RAW': Camera,
  Audio: Music,
  Video: Film,
  'Documents and vector': FileText,
};

export const FORMAT_ICONS: Record<string, LucideIcon> = {
  // Images
  jpg: FileImage, png: Image, webp: FileImage, avif: Aperture, gif: ImagePlay,
  tiff: FileImage, bmp: Image, heic: Camera, ico: FileImage, tga: FileImage,
  // Camera RAW
  cr2: Camera, cr3: Camera, nef: Camera, arw: Camera, orf: Camera,
  raf: Camera, rw2: Camera, dng: Camera, pef: Camera,
  // Audio
  mp3: Music, wav: AudioLines, flac: Music, ogg: AudioLines, m4a: FileAudio,
  aac: Music, opus: AudioLines, aiff: FileAudio, wma: Music,
  // Video
  mp4: Film, mkv: Clapperboard, mov: Video, avi: Film, webm: FileVideo,
  wmv: Video, m4v: FileVideo, '3gp': Video,
  // Documents and vector
  psd: Layers, svg: PenTool, pdf: FileText,
};

export function iconForFormat(slug: string, category: string): LucideIcon {
  return FORMAT_ICONS[slug] || CATEGORY_ICONS[category] || File;
}

export function iconForCategory(category: string): LucideIcon {
  return CATEGORY_ICONS[category] || File;
}
