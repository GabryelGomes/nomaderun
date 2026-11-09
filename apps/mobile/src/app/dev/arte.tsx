import { lazy, Suspense } from 'react';

/**
 * Galeria do sistema de arte (E4), só para revisão e capturas. F8 onda D (E10): a galeria carrega sob demanda
 * (`import()`), num pedaço separado do bundle web, para não pesar no `entry` de quem só usa o app.
 */
const ArtGallery = lazy(() => import('@/features/dev/arte-gallery'));

export default function ArtGalleryRoute() {
  return (
    <Suspense fallback={null}>
      <ArtGallery />
    </Suspense>
  );
}
