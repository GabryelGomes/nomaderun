/**
 * T7.2.5 — `<ShareButton>`: o 1º dos 3 toques (resumo → "Compartilhar" → menu do sistema). A E6 encaixa no
 * resumo (`summary-screen.tsx`). Abre `/compartilhar/[id]`, levando os extras do card (nível novo, chefão).
 * Corrida rejeitada não tem card: o botão não aparece.
 */
import { router } from 'expo-router';

import { Button, type ButtonProps } from '@/components/button';

import type { CardBoss, CardLevel } from '../card';
import { setShareExtras } from './share-extras';

export type ShareButtonProps = {
  /** Id da corrida (local ou do servidor), o mesmo do `/resumo?id=`. */
  activityId: string;
  /** Status oficial; `rejected` esconde o botão. */
  status?: 'valid' | 'partial' | 'review' | 'rejected' | null;
  /** Nível novo nesta corrida (dados da E7, quando houver). */
  level?: CardLevel | null;
  /** Chefão derrotado com a ajuda desta corrida (dados da E9, quando houver). */
  boss?: CardBoss | null;
  label?: string;
  kind?: ButtonProps['kind'];
  size?: ButtonProps['size'];
  wide?: boolean;
  testID?: string;
};

export const shareHref = (activityId: string) => `/compartilhar/${encodeURIComponent(activityId)}` as const;

export function ShareButton({ activityId, status, level, boss, label = 'Compartilhar', kind = 'primary', size, wide, testID = 'resumo-compartilhar' }: ShareButtonProps) {
  if (status === 'rejected' || !activityId) return null;
  return (
    <Button
      testID={testID}
      accessibilityHint="Abre os modelos de imagem para Stories, feed e adesivo"
      label={label}
      icon="share"
      kind={kind}
      size={size}
      wide={wide}
      onPress={() => {
        setShareExtras(activityId, { level: level ?? null, boss: boss ?? null });
        router.push(shareHref(activityId));
      }}
    />
  );
}
