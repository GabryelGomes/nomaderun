/** Card de compartilhamento (E8): modelo puro, escolha dos modelos, medida de texto e componentes SVG. */
export * from './card-model';
export * from './pick-models';
export { cardFonts, fitFontSize, measureText, truncateToWidth, type CardFont } from './font-metrics';
export { frameRoutes, visibleRoutes, type Box, type CardRegion, type RouteFrame } from './route-geometry';
export type { ArtBox, CardArtSlot, ShareCardArt } from './card-art';
export { CARD_FORMATS, type CardSurfaceProps } from './card-frame';
export { DEMO_STAMP } from './card-parts';
export { ShareCard, type ShareCardProps } from './share-card';
export { ShareSticker, STICKER_SIZE } from './sticker-card';
export { RunCard, ZoneCard } from './run-cards';
export { LevelCard, BossCard } from './moment-cards';
export { WeekCard } from './week-card';
