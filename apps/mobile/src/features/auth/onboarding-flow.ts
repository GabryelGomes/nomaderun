import { create } from 'zustand';

/**
 * Estado da primeira abertura (D-72), só na memória desta sessão do app (nunca persiste).
 *
 *  - `activeFor`: id da pessoa cujo onboarding está aberto. Enquanto vale, o guarda de rotas mantém o grupo
 *    `onboarding` mesmo depois de o time ser gravado no servidor: a confirmação épica e a explicação do GPS
 *    acontecem **depois** de o time existir, sem o layout trocar de grupo no meio.
 *  - `welcomeFor`: id da pessoa que acabou de entrar; o Mapa mostra a missão de boas-vindas até ela fechar o card.
 *
 * Os dois guardam o id (e não um booleano) para nunca vazar de uma conta para outra: se alguém sair no meio do
 * onboarding e outra pessoa entrar, a flag não vale para ela.
 */
type OnboardingFlowState = {
  activeFor: string | null;
  welcomeFor: string | null;
  /** O onboarding montou para esta pessoa (sem time). */
  begin: (userId: string) => void;
  /** Último passo concluído: libera as abas e liga a missão de boas-vindas no Mapa. */
  finish: (userId: string) => void;
  /** A pessoa fechou o card da missão de boas-vindas. */
  dismissWelcome: () => void;
  reset: () => void;
};

export const useOnboardingFlow = create<OnboardingFlowState>((set) => ({
  activeFor: null,
  welcomeFor: null,
  begin: (userId) => set({ activeFor: userId }),
  finish: (userId) => set((s) => ({ activeFor: s.activeFor === userId ? null : s.activeFor, welcomeFor: userId })),
  dismissWelcome: () => set({ welcomeFor: null }),
  reset: () => set({ activeFor: null, welcomeFor: null }),
}));

/** O onboarding desta pessoa ainda está aberto (entrada `onboardingInProgress` do guarda de rotas). */
export function onboardingInProgressFor(activeFor: string | null, userId: string | null | undefined): boolean {
  return activeFor !== null && !!userId && activeFor === userId;
}
