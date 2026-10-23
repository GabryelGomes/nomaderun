/** Compartilhar (E8, T7.2.5): botão do resumo, tela, hook do card e GPX. */
export { ShareButton, shareHref, type ShareButtonProps } from './share-button';
export { ShareScreen } from './share-screen';
export { useShareCard, type ShareCardOptions, type UseShareCard } from './use-share-card';
export { useExportGpx, type ExportGpxState, type UseExportGpx } from './use-export-gpx';
export { setShareExtras, getShareExtras, type ShareExtras } from './share-extras';
export { buildShareRunInput, shareCaption, cardDateOf, PRIVACY_NOTICE_NO_ZONES } from './share-input';
export * from './share-flow';
export { cardArtFor, bossIdOf } from './card-art-e4';
