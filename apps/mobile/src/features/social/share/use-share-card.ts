/**
 * T7.2.5 — `useShareCard`: gera o PNG do card (cópia escondida no tamanho exato) e abre o menu do sistema.
 *
 *  - estados: "Gerando imagem…" → pronto ("Pronto. Bora!") ou erro ("Tentar de novo" e "Compartilhar só o
 *    texto"); gerar tem prazo de 6 s (`withDeadline`); toque duplo é ignorado enquanto gera;
 *  - nativo: `Svg.toDataURL` → `File(Paths.cache)` → `Sharing.shareAsync` (`share-image.ts`);
 *  - web: fonte embutida → canvas → Web Share com arquivo ou download (`share-image.web.ts`);
 *  - "Compartilhar só o texto": `Share.share` do React Native (funciona em todo lugar).
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Share } from 'react-native';
import type Svg from 'react-native-svg';

import { failureOf, shareFileName, shareReducer, shareSize, withDeadline, type ShareFormat, type ShareOutcome, type ShareStatus } from './share-flow';
import { canShareFiles, deliverImage, prepareImage } from './share-image';

export type ShareCardOptions = {
  /** Título do menu do sistema (Android) e do Web Share. */
  title?: string;
  /** Chamado depois que o menu fecha com sucesso (ex.: `record_share`, telemetria). */
  onShared?: (outcome: ShareOutcome, format: ShareFormat) => void;
  /** Prazo para gerar a imagem (padrão 6 s; os testes encurtam). */
  deadlineMs?: number;
};

export type UseShareCard = {
  state: ShareStatus;
  /** Falso na web sem Web Share de arquivo: o botão vira "Baixar imagem". */
  canShareFiles: boolean;
  /** Gera e compartilha a imagem desenhada no `<Svg>` de exportação. */
  shareImage: (svg: Svg | null, format: ShareFormat) => Promise<void>;
  /** Alternativa sem imagem (erro, aparelho sem menu de arquivo). */
  shareText: (message: string) => Promise<void>;
  reset: () => void;
};

export function useShareCard(options: ShareCardOptions = {}): UseShareCard {
  const [state, dispatch] = useReducer(shareReducer, { kind: 'idle' } as ShareStatus);
  const busy = useRef(false);
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });

  const shareImage = useCallback(async (svg: Svg | null, format: ShareFormat) => {
    if (busy.current) return; // trava contra toque duplo
    busy.current = true;
    dispatch({ type: 'start' });
    const title = opts.current.title ?? 'Compartilhar corrida';
    try {
      const image = await withDeadline(prepareImage(svg, shareSize(format), shareFileName(format)), opts.current.deadlineMs);
      const outcome = await deliverImage(image, title);
      dispatch({ type: 'finish', outcome });
      if (outcome !== 'cancelled') opts.current.onShared?.(outcome, format);
    } catch (e) {
      dispatch({ type: 'fail', reason: failureOf(e) });
    } finally {
      busy.current = false;
    }
  }, []);

  const shareText = useCallback(async (message: string) => {
    try {
      const r = await Share.share({ message });
      dispatch(r.action === Share.sharedAction ? { type: 'textShared' } : { type: 'reset' });
    } catch {
      // A pessoa fechou ou o aparelho recusou: nada a fazer.
    }
  }, []);

  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return { state, canShareFiles: canShareFiles(), shareImage, shareText, reset };
}
