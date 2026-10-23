import { create } from 'zustand';

import { readMotionPrefsRaw, writeMotionPrefsRaw } from '@/components/motion/prefs-storage';

/**
 * Preferências de motion da pessoa (T7.2.9, E5): "Vibração" e "Pular celebrações". Ficam no aparelho (não
 * na conta): `expo-sqlite/kv-store` no celular e `localStorage` na web, os mesmos meios que o app já usa
 * para o cache do perfil. Se o armazenamento falhar, valem em memória até o app fechar.
 *
 *  - `haptics` desligado: `haptic()` não vibra (exceto alertas de segurança com `force`);
 *  - `skipCelebrations` ligado: o `CelebrationSequence` e os momentos avulsos mostram direto o estado final
 *    (como se a pessoa tivesse tocado em "Pular" no começo), com o anúncio ao leitor de tela mantido.
 *
 * Quem faz os interruptores na tela de ajustes é a E6: leia com `useMotionPrefs((s) => s.haptics)` e grave
 * com `setHaptics` / `setSkipCelebrations`.
 */
export type MotionPrefs = {
  /** "Vibração" (padrão ligada). */
  haptics: boolean;
  /** "Pular celebrações" (padrão desligado). */
  skipCelebrations: boolean;
};

export const MOTION_PREFS_DEFAULTS: Readonly<MotionPrefs> = Object.freeze({ haptics: true, skipCelebrations: false });

/** Chave no armazenamento do aparelho (versão no fim, para migrar se o formato mudar). */
export const MOTION_PREFS_KEY = 'nomade.motion-prefs.v1';

/** Lê o JSON salvo, aceitando só booleanos conhecidos (o resto é ignorado). Puro. */
export function parseMotionPrefs(raw: string | null | undefined): Partial<MotionPrefs> {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return {};
    const o = v as Record<string, unknown>;
    const out: Partial<MotionPrefs> = {};
    if (typeof o.haptics === 'boolean') out.haptics = o.haptics;
    if (typeof o.skipCelebrations === 'boolean') out.skipCelebrations = o.skipCelebrations;
    return out;
  } catch {
    return {};
  }
}

export function serializeMotionPrefs(p: MotionPrefs): string {
  return JSON.stringify({ haptics: p.haptics, skipCelebrations: p.skipCelebrations });
}

type MotionPrefsState = MotionPrefs & {
  /** Já leu o valor salvo (ou desistiu). */
  hydrated: boolean;
  setHaptics: (on: boolean) => void;
  setSkipCelebrations: (on: boolean) => void;
  /** Volta ao padrão (e grava). */
  reset: () => void;
  /** Lê o valor salvo. Roda sozinho ao carregar o módulo; uma escolha feita antes de terminar vence. */
  hydrate: () => Promise<void>;
};

/** A pessoa mexeu antes da leitura terminar: o valor salvo (mais velho) não sobrescreve. */
let touched = false;

function save(p: MotionPrefs) {
  touched = true;
  void writeMotionPrefsRaw(MOTION_PREFS_KEY, serializeMotionPrefs(p));
}

export const useMotionPrefs = create<MotionPrefsState>((set, get) => ({
  ...MOTION_PREFS_DEFAULTS,
  hydrated: false,
  setHaptics: (haptics) => {
    set({ haptics });
    save({ haptics, skipCelebrations: get().skipCelebrations });
  },
  setSkipCelebrations: (skipCelebrations) => {
    set({ skipCelebrations });
    save({ haptics: get().haptics, skipCelebrations });
  },
  reset: () => {
    set({ ...MOTION_PREFS_DEFAULTS });
    save({ ...MOTION_PREFS_DEFAULTS });
  },
  hydrate: async () => {
    const saved = parseMotionPrefs(await readMotionPrefsRaw(MOTION_PREFS_KEY));
    if (touched) {
      set({ hydrated: true });
      return;
    }
    set({ ...saved, hydrated: true });
  },
}));

/** Leitura fora do React (ex.: dentro do `haptic()`). */
export function getMotionPrefs(): MotionPrefs {
  const s = useMotionPrefs.getState();
  return { haptics: s.haptics, skipCelebrations: s.skipCelebrations };
}

void useMotionPrefs.getState().hydrate();
