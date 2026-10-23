/** T7.1.9 — escolha e ordem dos modelos (momento mais raro primeiro) e avisos de privacidade. */
import { describe, expect, it } from '@jest/globals';

import { offset } from '@/domain/geo';
import { clipRouteForSharing } from '@/domain/share-privacy';

import {
  buildCarousel,
  buildWeekCarousel,
  CARD_KIND_LABEL,
  CARD_RARITY_ORDER,
  pickCardModels,
  pickWeekModels,
  privacyNoticeFor,
  PRIVACY_NOTICE_CLIPPED,
  PRIVACY_NOTICE_MOSTLY_HIDDEN,
  PRIVACY_NOTICE_ZONES,
} from '../pick-models';
import { DEMO_HOME, DEMO_ROUTE, demoRunInput, demoWeekInput } from './fixtures';

const straight = (meters: number) => Array.from({ length: meters / 20 + 1 }, (_, i) => offset(DEMO_ROUTE[0], i * 20, 90));

describe('pickCardModels', () => {
  it('todos os momentos: chefão > nível > zona > corrida', () => {
    const pick = pickCardModels(demoRunInput());
    expect(pick.kinds).toEqual(['boss', 'level', 'zone', 'run']);
    expect(CARD_RARITY_ORDER).toEqual(['boss', 'level', 'zone', 'run']);
    expect(pick.startWithoutRoute).toBe(false);
    expect(pick.privacyNotice).toBe(PRIVACY_NOTICE_CLIPPED);
  });

  it('a corrida aparece sempre; os outros só com o momento', () => {
    const z = demoRunInput().zones;
    expect(pickCardModels(demoRunInput({ boss: null, level: null, zones: [z[1]] })).kinds).toEqual(['run']);
    expect(pickCardModels(demoRunInput({ boss: { ...demoRunInput().boss!, defeated: false } })).kinds).toEqual(['level', 'zone', 'run']);
    expect(pickCardModels(demoRunInput({ level: null })).kinds).toEqual(['boss', 'zone', 'run']);
  });

  it('rejeitada não tem card; provisória e em revisão só têm a corrida', () => {
    expect(pickCardModels(demoRunInput({ status: 'rejected' })).kinds).toEqual([]);
    expect(pickCardModels(demoRunInput({ status: 'provisional' })).kinds).toEqual(['run']);
    expect(pickCardModels(demoRunInput({ status: 'review' })).kinds).toEqual(['run']);
    expect(pickCardModels(demoRunInput({ status: 'partial' })).kinds).toHaveLength(4);
  });

  it('mais de 60% escondido: abre sem rota, com aviso', () => {
    const home = { ...offset(DEMO_ROUTE[0], 400, 90), radiusM: 600 };
    const route = clipRouteForSharing(straight(1500), [home], { seed: 5 });
    expect(route.noRouteReason).toBe('mostlyHidden');
    const pick = pickCardModels(demoRunInput({ route }));
    expect(pick.startWithoutRoute).toBe(true);
    expect(pick.privacyNotice).toBe(PRIVACY_NOTICE_MOSTLY_HIDDEN);
    const models = buildCarousel(demoRunInput({ route }));
    expect(models.map((m) => m.kind)).toEqual(['boss', 'level', 'zone', 'run']);
    for (const m of models) if (m.kind === 'run' || m.kind === 'zone') expect(m.route).toBeNull();
  });

  it('avisos de privacidade conforme o corte', () => {
    expect(privacyNoticeFor(clipRouteForSharing(DEMO_ROUTE, [], { seed: 1 }))).toBe(PRIVACY_NOTICE_CLIPPED);
    const home = clipRouteForSharing(DEMO_ROUTE, [DEMO_HOME], { seed: 1 });
    expect(privacyNoticeFor(home)).toBe(home.mode === 'route' ? PRIVACY_NOTICE_CLIPPED : PRIVACY_NOTICE_MOSTLY_HIDDEN);
    const zone = { ...offset(DEMO_ROUTE[0], 1000, 90), radiusM: 100 };
    expect(privacyNoticeFor(clipRouteForSharing(straight(2000), [zone], { seed: 1, hideEnds: false }))).toBe(PRIVACY_NOTICE_ZONES);
    expect(privacyNoticeFor(clipRouteForSharing(straight(2000), [], { seed: 1, hideEnds: false }))).toBeNull();
    expect(privacyNoticeFor(clipRouteForSharing([], [], { seed: 1 }))).toBeNull();
  });

  it('carrossel pronto, na ordem, respeitando as escolhas', () => {
    const models = buildCarousel(demoRunInput(), { withRoute: false, showCity: false, showUsername: true });
    expect(models.map((m) => m.kind)).toEqual(['boss', 'level', 'zone', 'run']);
    expect(models.every((m) => m.username === '@gabryel' && m.dateLabel === 'SEXTA · 23 OUT')).toBe(true);
    expect(buildCarousel(demoRunInput({ status: 'rejected' }))).toEqual([]);
  });

  it('rótulos dos modelos para o carrossel', () => {
    expect(CARD_KIND_LABEL).toEqual({ run: 'Corrida', zone: 'Conquista de zona', level: 'Nível novo', boss: 'Chefão derrotado', week: 'Minha semana' });
  });
});

describe('pickWeekModels', () => {
  it('recap só com corrida na semana', () => {
    expect(pickWeekModels(demoWeekInput())).toEqual({ kinds: ['week'], startWithoutRoute: false, privacyNotice: PRIVACY_NOTICE_CLIPPED });
    expect(pickWeekModels(demoWeekInput({ runs: 0 })).kinds).toEqual([]);
    expect(pickWeekModels(demoWeekInput({ routes: [] }))).toEqual({ kinds: ['week'], startWithoutRoute: true, privacyNotice: null });
    expect(buildWeekCarousel(demoWeekInput()).map((m) => m.kind)).toEqual(['week']);
    expect(buildWeekCarousel(demoWeekInput({ runs: 0 }))).toEqual([]);
  });
});
