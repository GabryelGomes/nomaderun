/**
 * T7.2.5 — extras do card que a tela de compartilhar não consegue buscar sozinha pelo id da corrida:
 * o nível novo (E7) e o chefão derrotado (E9) vêm do resumo. O `<ShareButton>` guarda aqui antes de abrir
 * `/compartilhar/[id]`, e a tela lê. Só memória: nada sai do aparelho.
 */
import { levelProgress } from '@/domain/progression';
import { DEMO_RAID } from '@/demo/demo-data';

import type { CardBoss, CardLevel } from '../card';

export type ShareExtras = { level?: CardLevel | null; boss?: CardBoss | null };

const extras = new Map<string, ShareExtras>();
const MAX_KEPT = 10;

export function setShareExtras(activityId: string, value: ShareExtras) {
  extras.delete(activityId);
  extras.set(activityId, value);
  while (extras.size > MAX_KEPT) extras.delete(extras.keys().next().value as string);
}

export function getShareExtras(activityId: string): ShareExtras {
  return extras.get(activityId) ?? {};
}

/**
 * Só no modo demonstração (com `?momentos=1`): nível e chefão de demonstração, para mostrar os 4 modelos
 * na apresentação e nas capturas. O card sai com o selo "DADOS DE DEMONSTRAÇÃO".
 */
export function demoMoments(input: { xp: number; meters: number; totals: CardLevel['totals'] }): ShareExtras {
  const p = levelProgress(input.xp);
  const crew = DEMO_RAID.topCrews[0];
  return {
    level: {
      reached: p.level,
      xpToNext: Math.max(0, p.needed - p.intoLevel),
      progressToNext: p.needed ? p.intoLevel / p.needed : 1,
      totals: input.totals,
    },
    boss: {
      name: DEMO_RAID.boss,
      defeated: true,
      myDamageMeters: input.meters,
      cityName: DEMO_RAID.city,
      cityMeters: DEMO_RAID.hpKm * 1000,
      days: 6,
      crew: { name: crew.name, rank: 1, meters: crew.km * 1000 },
    },
  };
}
