import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import type { FactionId } from '@/domain/types';
import { getPendingTeam, savePendingTeam } from '@/features/auth/pending-team';

import { TeamChoiceScreen } from './team-choice';

/**
 * Escolha do time **antes da conta** (D-91). O time vai para o aparelho no toque de "Entrar para os …"; o
 * "Continuar" da cerimônia leva ao cadastro ("Garanta seu lugar nos …"). `choose_faction` só roda depois do cadastro
 * (`onboarding-screen.tsx`). Zero digitação até aqui.
 */
export function TeamChoiceAuthScreen() {
  const [initial, setInitial] = useState<FactionId | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void getPendingTeam().then((t) => {
      if (alive) setInitial(t);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (initial === undefined) return null;
  return (
    <TeamChoiceScreen
      initial={initial}
      onJoin={(f) => void savePendingTeam(f)}
      onContinue={async (f) => {
        await savePendingTeam(f);
        router.push('/cadastro');
        return null;
      }}
    />
  );
}
