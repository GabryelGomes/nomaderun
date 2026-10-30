/**
 * T7.3.7 — `<RecapButton>`: abre o card "Minha semana" (`/compartilhar/semana`). A E6a encaixa na tela
 * Atividades; a notificação do recap (E7) usa `recapHref(semana)`.
 */
import { router, type Href } from 'expo-router';

import { Button, type ButtonProps } from '@/components/button';

import { recapHref } from './recap-model';

export type RecapButtonProps = {
  /** Segunda-feira da semana (`AAAA-MM-DD`); sem ela, a semana atual (ou a anterior, se a atual está vazia). */
  weekStart?: string | null;
  label?: string;
  kind?: ButtonProps['kind'];
  size?: ButtonProps['size'];
  wide?: boolean;
  testID?: string;
};

export function RecapButton({ weekStart, label = 'Compartilhar minha semana', kind = 'secondary', size, wide, testID = 'atividades-semana' }: RecapButtonProps) {
  return (
    <Button
      testID={testID}
      accessibilityHint="Abre o card da semana para Stories e feed"
      label={label}
      icon="share"
      kind={kind}
      size={size}
      wide={wide}
      onPress={() => router.push(recapHref(weekStart) as Href)}
    />
  );
}
