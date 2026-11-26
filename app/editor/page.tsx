import type { Metadata } from 'next';
import { Suspense } from 'react';
import EditorClient from './EditorClient';

export const metadata: Metadata = {
  title: 'Image editor | Quick IMG Convert',
  description:
    'Edit your image in the browser — draw, crop, resize, rotate, flip and adjust brightness, contrast and saturation, then download it as PNG or JPG.',
  robots: { index: false, follow: false },
};

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="animate-pulse rounded-card-lg border border-line bg-soft p-8 text-center text-sm text-muted">
            Loading editor…
          </div>
        </div>
      }
    >
      <EditorClient />
    </Suspense>
  );
}
