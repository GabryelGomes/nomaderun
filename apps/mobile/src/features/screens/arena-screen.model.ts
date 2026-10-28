/**
 * Regras de apresentação da Arena (T7.3.3, E6c): o que a tela mostra a partir dos dados reais da Raid, das
 * missões e do jogo. Sem regra de jogo aqui (ela vem do `src/domain` e do servidor); só a "cara" dos dados.
 * Os textos ficam na tela (`arena-screen.tsx`), para a régua `medir-texto.mjs` contar tudo o que aparece.
 */
import { districtsExploration } from '@/domain/games';
import type { EngagementMission, EngagementMissions } from '@/services/api/engagement-repo';
import type { RaidBoss } from '@/services/api/raid-repo';

/** Estado e rachaduras do chefão (arte da E4) pela vida real: as fases 1/2/3 viram dano 0/1/2. */
export type BossLook = { state: 'parado' | 'furioso' | 'derrotado'; dano: 0 | 1 | 2 };

export function bossLook(raid: Pick<RaidBoss, 'status' | 'phase'>): BossLook {
  if (raid.status === 'defeated') return { state: 'derrotado', dano: 2 };
  const dano = (raid.phase - 1) as 0 | 1 | 2;
  // Fugiu: fica como estava na última fase, sem a fúria (a semana acabou).
  if (raid.status === 'escaped') return { state: 'parado', dano };
  return { state: raid.phase === 3 ? 'furioso' : 'parado', dano };
}

/** Vida restante de 0 a 1. */
export const hpRatio = (raid: Pick<RaidBoss, 'hp' | 'hpMax'>): number => (raid.hpMax > 0 ? Math.min(1, Math.max(0, raid.hp / raid.hpMax)) : 0);

/** Porcentagem inteira para a tela; um pedaço pequeno que não é zero vira "<1%" (nunca some quem ajudou). */
export function percentLabel(ratio: number): string {
  if (!(ratio > 0)) return '0%';
  if (ratio < 0.01) return '<1%';
  return `${Math.round(Math.min(1, ratio) * 100)}%`;
}

/** Tempo até o fim da janela da Raid: "2 d", "19 h" ou "45 min". */
export function timeLeft(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60_000));
  if (min >= 48 * 60) return `${Math.floor(min / (24 * 60))} d`;
  if (min >= 60) return `${Math.floor(min / 60)} h`;
  return `${min} min`;
}

/** As 3 missões do dia, na ordem do servidor (slot), para os anéis da Arena. */
export function missionRings(missions: EngagementMissions | null): EngagementMission[] {
  if (!missions) return [];
  return [...missions.daily].sort((a, b) => a.slot - b.slot).slice(0, 3);
}

/** % do bairro mais explorado (Atlas por distrito, `districtsExploration` do domain); 0 sem corrida. */
export function atlasPercent(revealed: readonly string[]): number {
  if (revealed.length === 0) return 0;
  return districtsExploration(revealed)[0]?.pct ?? 0;
}
