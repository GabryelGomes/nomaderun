import { ANDROID_TAB_BAR_HEIGHT, WEB_TAB_BAR_HEIGHT } from '@/components/app-tabs-config';
import { tabBarClearance } from '@/components/screen';
import { missionById } from '@/domain/missions';
import { space } from '@/theme/tokens';

/**
 * Missão de boas-vindas (D-72, wireframe `06`): o primeiro objetivo no Mapa logo depois do onboarding. O texto vem
 * do catálogo da E7 (`f1-dominio`, 1º passo da primeira semana). Aqui só a apresentação: sem prêmio prometido
 * (o XP e o baú dependem das flags da E9/E7) e sem progresso inventado: Conta ✓ · Time ✓ · Correr 500 m.
 */
export const WELCOME_MISSION_ID = 'f1-dominio';

export type WelcomeMissionCopy = { eyebrow: string; title: string; steps: readonly string[]; done: number };

export function welcomeMissionCopy(): WelcomeMissionCopy {
  return {
    eyebrow: 'Missão 1',
    title: missionById(WELCOME_MISSION_ID)?.text ?? 'Corra 500 m e pinte sua 1ª zona',
    steps: ['Conta', 'Time', 'Correr 500 m'],
    done: 2,
  };
}

/** Espaço do "Correr" do Mapa: a altura do `BigRunButton` (72 pt), que é a maior das duas versões do botão. */
export const MAP_RUN_BUTTON_SLOT = 72;

/**
 * Altura da barra de abas **abaixo** do conteúdo das telas. O card é desenhado pelo layout das abas, que inclui a
 * barra: no Android e na web o conteúdo termina em cima dela; no iOS a barra flutua sobre o conteúdo (0 aqui, já
 * somada pelo `tabBarClearance`).
 */
export function tabBarBelowContent(insetBottom: number, os: string | undefined = process.env.EXPO_OS): number {
  if (os === 'ios') return 0;
  if (os === 'android') return ANDROID_TAB_BAR_HEIGHT + insetBottom;
  return WEB_TAB_BAR_HEIGHT;
}

/** Espaço do alerta de ataque do Mapa, que fica logo acima do "Correr" (56 pt + 8 de respiro). */
export const MAP_ALERT_SLOT = 56 + space[2];

/**
 * Distância do fundo do layout das abas ao card da missão no Mapa: acima da barra de abas, do "Correr" do Mapa
 * (que fica a `tabBarClearance` do fim do conteúdo) e do espaço do alerta de ataque, para o card nunca cobrir o
 * botão principal nem um alerta.
 */
export function welcomeMissionBottom(insetBottom: number, os: string | undefined = process.env.EXPO_OS): number {
  return tabBarBelowContent(insetBottom, os) + tabBarClearance(insetBottom, os) + MAP_RUN_BUTTON_SLOT + space[2] + MAP_ALERT_SLOT;
}
