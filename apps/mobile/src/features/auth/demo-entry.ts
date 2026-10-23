import { useSyncExternalStore } from 'react';

import * as authRepo from '@/services/api/auth-repo';
import type { AppError } from '@/services/api/errors';
import { enterDemo, exitDemo, isDemoActive, isDemoBuild, onDemoSwitch } from '@/services/demo-mode';

/**
 * Entrada no modo demonstração pela interface (D-77): botão "Ver demonstração" (Entrar e tela indisponível), o
 * selo fixo do layout raiz e o "Sair" do selo. O interruptor é o da E10 (`@/services/demo-mode`); as stores são
 * zeradas pelo ouvinte registrado em `session-controller.ts`.
 *
 *  - **Build de demonstração** (`EXPO_PUBLIC_DEMO=1`): o modo já está ligado; o botão só entra na conta do
 *    corredor de demonstração (o Auth de demonstração aceita qualquer e-mail) e não há "Sair".
 *  - **Build normal**: o botão liga o modo (`enterDemo`); o Auth de demonstração já nasce com sessão e o
 *    `useSessionBootstrap` refaz a sessão. "Sair" (`exitDemo`) volta à conta real e apaga o que a demonstração
 *    deixou no aparelho.
 */

/** E-mail do corredor de demonstração (o mesmo de `src/demo/world.ts`). Só vale com o servidor em memória. */
export const DEMO_RUNNER_EMAIL = 'demonstracao@nomaderun.invalid';

/** Dá para sair da demonstração (não no build de demonstração, que não tem servidor real para onde voltar). */
export function canLeaveDemo(): boolean {
  return isDemoActive() && !isDemoBuild();
}

/** Abre a demonstração. Devolve o erro para a tela mostrar, ou `null`. */
export async function startDemo(): Promise<AppError | null> {
  if (isDemoBuild() || isDemoActive()) {
    const res = await authRepo.signIn(DEMO_RUNNER_EMAIL, 'demonstracao');
    return res.ok ? null : res.error;
  }
  await enterDemo();
  return null;
}

/** "Sair da demonstração": volta à conta real (ou à tela de boas-vindas, se não havia conta). */
export async function leaveDemo(): Promise<void> {
  await exitDemo();
}

/** O selo "Demonstração" do layout acompanha o modo (liga e desliga sem recarregar). */
export function useDemoActive(): boolean {
  return useSyncExternalStore(onDemoSwitch, isDemoActive, isDemoActive);
}

export { isDemoActive };
