/**
 * T7.1.9 — quais cards oferecer e em que ordem (carrossel da tela de compartilhar). Puro.
 *
 *  - o momento mais forte vem primeiro (UX-33): chefão derrotado > conquista de zona > nível novo > corrida
 *    (antes, o nível vinha antes da zona: a corrida que tomou o bairro abria no card de nível);
 *  - o card "Corrida" aparece sempre (exceto corrida rejeitada, que não tem card);
 *  - corrida provisória ou em revisão: só o card "Corrida", sem pontos e com o selo do status;
 *  - rota com mais de 60% escondida (ou sem rota): o carrossel abre na versão sem rota, com aviso;
 *  - recap semanal: só quando houve corrida na semana.
 */
import type { SharedRoute } from '@/domain/share-privacy';

import { buildCardModel, buildWeekCard, DEFAULT_CARD_CHOICES, featuredZone, type CardChoices, type CardKind, type CardModel, type ShareRunInput, type ShareWeekInput } from './card-model';

/** Do momento mais forte para o mais comum; o 1º é o modelo padrão do carrossel (UX-33). */
export const CARD_RARITY_ORDER: readonly Exclude<CardKind, 'week'>[] = ['boss', 'zone', 'level', 'run'];

export const CARD_KIND_LABEL: Record<CardKind, string> = {
  run: 'Corrida',
  zone: 'Conquista de zona',
  level: 'Nível novo',
  boss: 'Chefão derrotado',
  week: 'Minha semana',
};

export const PRIVACY_NOTICE_MOSTLY_HIDDEN = 'Escondemos a maior parte da rota para proteger sua casa.';
export const PRIVACY_NOTICE_CLIPPED = 'Escondemos o começo, o fim e suas zonas de privacidade.';
export const PRIVACY_NOTICE_ZONES = 'Escondemos suas zonas de privacidade.';

export type CardPick = {
  kinds: readonly CardKind[];
  /** O carrossel abre com "Mostrar rota" desligado (e a pessoa não consegue ligar). */
  startWithoutRoute: boolean;
  /** Aviso de 1 linha sobre o corte, quando houve corte. */
  privacyNotice: string | null;
};

/** Aviso que acompanha a rota cortada. */
export function privacyNoticeFor(route: SharedRoute): string | null {
  if (route.mode === 'noRoute') return route.noRouteReason === 'mostlyHidden' ? PRIVACY_NOTICE_MOSTLY_HIDDEN : null;
  if (route.endsHidden) return PRIVACY_NOTICE_CLIPPED;
  return route.hiddenMeters > 0 ? PRIVACY_NOTICE_ZONES : null;
}

export function pickCardModels(input: ShareRunInput): CardPick {
  const startWithoutRoute = input.route.mode === 'noRoute';
  const privacyNotice = privacyNoticeFor(input.route);
  if (input.status === 'rejected') return { kinds: [], startWithoutRoute, privacyNotice };
  if (input.status === 'provisional' || input.status === 'review') return { kinds: ['run'], startWithoutRoute, privacyNotice };
  const available: Record<Exclude<CardKind, 'week'>, boolean> = {
    boss: !!input.boss && input.boss.defeated && input.boss.myDamageMeters > 0,
    level: !!input.level && input.level.reached >= 1,
    zone: featuredZone(input.zones) !== null,
    run: true,
  };
  return { kinds: CARD_RARITY_ORDER.filter((k) => available[k]), startWithoutRoute, privacyNotice };
}

export function pickWeekModels(input: ShareWeekInput): CardPick {
  return {
    kinds: input.runs > 0 ? ['week'] : [],
    startWithoutRoute: !input.routes.some((r) => r.mode === 'route'),
    privacyNotice: input.routes.length ? PRIVACY_NOTICE_CLIPPED : null,
  };
}

/** Atalho: os modelos prontos, na ordem do carrossel. */
export function buildCarousel(input: ShareRunInput, choices: CardChoices = DEFAULT_CARD_CHOICES): CardModel[] {
  const pick = pickCardModels(input);
  const effective = pick.startWithoutRoute ? { ...choices, withRoute: false } : choices;
  return pick.kinds.flatMap((k) => {
    const model = k === 'week' ? null : buildCardModel(k, input, effective);
    return model ? [model] : [];
  });
}

export function buildWeekCarousel(input: ShareWeekInput, choices: CardChoices = DEFAULT_CARD_CHOICES): CardModel[] {
  return pickWeekModels(input).kinds.length ? [buildWeekCard(input, choices)] : [];
}
