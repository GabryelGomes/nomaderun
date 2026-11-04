import { lazy, Suspense } from 'react';

/**
 * Galeria de movimento (E5), só para revisão e medição de fps. F8 onda D (E10): a galeria carrega sob demanda
 * (`import()`), num pedaço separado do bundle web, para não pesar no `entry` de quem só usa o app.
 */
const MotionGallery = lazy(() => import('@/features/dev/motion-gallery'));

export default function DevMotionRoute() {
  return (
    <Suspense fallback={null}>
      <MotionGallery />
    </Suspense>
  );
}
