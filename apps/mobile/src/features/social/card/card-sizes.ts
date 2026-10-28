/**
 * Tamanhos dos formatos do card (puro, sem React): quem só precisa das medidas (fluxo de compartilhar, testes)
 * importa daqui e não carrega a arte (que passa pelo Reanimated).
 */
import type { ShareCardFormat } from './card-model';

export const CARD_FORMATS: Record<ShareCardFormat, { W: number; H: number; top: number }> = {
  stories: { W: 1080, H: 1920, top: 300 },
  feed: { W: 1080, H: 1350, top: 116 },
};

/** Lado do adesivo transparente (1080 × 1080). */
export const STICKER_SIZE = 1080;
