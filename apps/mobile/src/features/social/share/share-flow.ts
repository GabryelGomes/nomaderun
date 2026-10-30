/**
 * T7.2.5 — estados e textos do fluxo de compartilhar (puro). Os efeitos (gerar o PNG, abrir o menu) ficam
 * em `use-share-card.ts` e nos módulos de plataforma (`share-image.ts` / `share-image.web.ts`).
 */
import type { ShareCardFormat } from '../card/card-model';
import { CARD_FORMATS, STICKER_SIZE } from '../card/card-sizes';

/** Formatos da tela: os 2 do card e o adesivo transparente. */
export type ShareFormat = ShareCardFormat | 'sticker';

export const SHARE_FORMATS: readonly ShareFormat[] = ['stories', 'feed', 'sticker'];

export const SHARE_FORMAT_LABEL: Record<ShareFormat, string> = { stories: 'Stories', feed: 'Feed', sticker: 'Adesivo' };

/** testID do formato (`compartilhar-formato-adesivo`, como na F1 §5.2). */
export const SHARE_FORMAT_KEY: Record<ShareFormat, string> = { stories: 'stories', feed: 'feed', sticker: 'adesivo' };

/** Tamanho final do PNG em pixels. */
export function shareSize(format: ShareFormat): { width: number; height: number } {
  if (format === 'sticker') return { width: STICKER_SIZE, height: STICKER_SIZE };
  return { width: CARD_FORMATS[format].W, height: CARD_FORMATS[format].H };
}

/** Nome fixo por formato: o cache guarda no máximo 1 PNG por formato (o seguinte substitui). */
export const shareFileName = (format: ShareFormat) => `nomade-${SHARE_FORMAT_KEY[format]}.png`;

/** Prazo máximo para gerar a imagem (D-78; o iOS pode devolver vazio sem avisar). */
export const SHARE_DEADLINE_MS = 6000;

export const SHARE_TEXT = {
  share: 'Compartilhar',
  download: 'Baixar imagem',
  generating: 'Gerando imagem…',
  errorTitle: 'Não deu para gerar a imagem.',
  retry: 'Tentar de novo',
  textOnly: 'Compartilhar só o texto',
  copyCaption: 'Copiar legenda',
  copied: 'Legenda copiada',
  done: 'Pronto. Bora!',
  downloaded: 'Imagem baixada. Bora!',
} as const;

export type ShareFailure = 'empty' | 'timeout' | 'unavailable' | 'unknown';

export const SHARE_FAILURE_TEXT: Record<ShareFailure, string> = {
  empty: 'A imagem saiu vazia.',
  timeout: 'Demorou demais para ficar pronta.',
  unavailable: 'Este aparelho não abriu o menu de compartilhar.',
  unknown: 'Algo deu errado ao montar a imagem.',
};

export class ShareError extends Error {
  constructor(readonly reason: ShareFailure) {
    super(reason);
    this.name = 'ShareError';
  }
}

export const failureOf = (e: unknown): ShareFailure => (e instanceof ShareError ? e.reason : 'unknown');

/** Resultado da entrega: menu do sistema / Web Share, download (web) ou a pessoa fechou o menu. */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export type ShareStatus =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'done'; outcome: ShareOutcome }
  | { kind: 'error'; reason: ShareFailure };

export type ShareEvent =
  | { type: 'start' }
  | { type: 'finish'; outcome: ShareOutcome }
  | { type: 'fail'; reason: ShareFailure }
  /** "Compartilhar só o texto" deu certo (sai do erro direto para o pronto). */
  | { type: 'textShared' }
  | { type: 'reset' };

/** Transições. Gerando ignora um novo "start" (trava contra toque duplo). */
export function shareReducer(state: ShareStatus, event: ShareEvent): ShareStatus {
  switch (event.type) {
    case 'start':
      return state.kind === 'generating' ? state : { kind: 'generating' };
    case 'finish':
      return state.kind === 'generating' ? { kind: 'done', outcome: event.outcome } : state;
    case 'fail':
      return state.kind === 'generating' ? { kind: 'error', reason: event.reason } : state;
    case 'textShared':
      return state.kind === 'generating' ? state : { kind: 'done', outcome: 'shared' };
    case 'reset':
      return { kind: 'idle' };
  }
}

/** Rótulo do botão principal. */
export function primaryLabel(state: ShareStatus, canShareFiles: boolean): string {
  if (state.kind === 'generating') return SHARE_TEXT.generating;
  return canShareFiles ? SHARE_TEXT.share : SHARE_TEXT.download;
}

/** Mensagem curta depois do menu (o toast "Pronto. Bora!"). */
export function doneMessage(state: ShareStatus): string | null {
  if (state.kind !== 'done') return null;
  if (state.outcome === 'downloaded') return SHARE_TEXT.downloaded;
  return state.outcome === 'shared' ? SHARE_TEXT.done : null;
}

/** Corre `task` com prazo: depois de `ms`, rejeita com `ShareError('timeout')`. */
export function withDeadline<T>(task: Promise<T>, ms = SHARE_DEADLINE_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ShareError('timeout')), ms);
    task.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Tira o prefixo `data:image/png;base64,` (a web devolve sem; o nativo, conforme a versão) e confere o tamanho. */
export function cleanBase64(data: string | null | undefined): string {
  const b64 = (data ?? '').replace(/^data:image\/png;base64,/, '').trim();
  // Um PNG de verdade em 1080 px tem centenas de KB; menos de 100 caracteres é a resposta vazia do iOS.
  if (b64.length < 100) throw new ShareError('empty');
  return b64;
}
