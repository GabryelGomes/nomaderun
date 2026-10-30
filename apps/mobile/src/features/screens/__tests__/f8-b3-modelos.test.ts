/**
 * F8-B3 — regras puras das telas que fecham: nome de zona sem número (UX-29), km do card com 1 casa abaixo de
 * 10 km (UX-33), alerta do recap só de sexta a domingo (§4.3) e o "Compartilhar" do próprio item do feed.
 */
import { describe, expect, it, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports -- fábricas do jest.mock só podem usar require */
jest.mock('react-native-reanimated', () => require('@/components/motion/__tests__/render-mocks').reanimated);
jest.mock('react-native-worklets', () => require('@/components/motion/__tests__/render-mocks').worklets);
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */

import { ALERT_PRIORITY, pickAlert } from '@/components/alert-slot';
import { zoneName } from '@/demo/demo-data';
import { zoneOf } from '@/domain/grid';
import { zoneDisplayName } from '@/features/format';
import { formatKmTotal } from '@/features/social/card/card-model';
import { ownActivityFor } from '@/features/social/feed/feed-model';

import { recapAlert } from '../recap-alert';
/* eslint-enable import/first */

const BRT = (iso: string) => new Date(`${iso}-03:00`).getTime();

describe('nome da zona na tela (UX-29)', () => {
  it('tira o número que o servidor usa como id', () => {
    expect(zoneDisplayName('Jardim Goiás 59')).toBe('Jardim Goiás');
    expect(zoneDisplayName('Setor Pedro Ludovico 35/36')).toBe('Setor Pedro Ludovico');
    expect(zoneDisplayName('Jardim Goiás · perto do Estádio')).toBe('Jardim Goiás · perto do Estádio');
    expect(zoneDisplayName('Rua 10')).toBe('Rua');
    expect(zoneDisplayName('  ')).toBe('Zona');
    expect(zoneDisplayName(null)).toBe('Zona');
  });

  it('na demonstração: bairro + referência, sem número', () => {
    const name = zoneName(zoneOf({ lat: -16.705, lng: -49.236 }));
    expect(name).not.toMatch(/\d/);
    expect(name === 'Estádio Serra Dourada' || / · perto do /.test(name)).toBe(true);
  });
});

describe('km do card (UX-33)', () => {
  it('1 casa abaixo de 10 km; inteiro com milhar acima', () => {
    expect(formatKmTotal(0.7)).toBe('0,7');
    expect(formatKmTotal(0.04)).toBe('0,0');
    expect(formatKmTotal(9.94)).toBe('9,9');
    expect(formatKmTotal(12.2)).toBe('12');
    expect(formatKmTotal(1204.4)).toBe('1.204');
  });
});

describe('alerta do recap no Mapa (§4.3)', () => {
  it('de sexta a domingo, com pelo menos 1 km', () => {
    expect(recapAlert(BRT('2026-10-30T08:00:00'), 12_200)).toEqual({ id: 'recap-semana', kind: 'recap', title: 'Sua semana: 12,2 km', body: 'Compartilhar o card da semana' });
    expect(recapAlert(BRT('2026-11-01T22:00:00'), 3_000)?.kind).toBe('recap');
    expect(recapAlert(BRT('2026-10-29T23:59:00'), 12_200)).toBeNull(); // quinta
    expect(recapAlert(BRT('2026-11-02T00:10:00'), 12_200)).toBeNull(); // segunda
    expect(recapAlert(BRT('2026-10-31T10:00:00'), 900)).toBeNull();
  });

  it('é o último da fila: qualquer outro alerta ganha a vaga', () => {
    expect(ALERT_PRIORITY.at(-1)).toBe('recap');
    const recap = { ...recapAlert(BRT('2026-10-31T10:00:00'), 5_000)!, onPress: () => undefined };
    const streak = { id: 's', kind: 'streak' as const, title: 'x', body: 'y', onPress: () => undefined };
    expect(pickAlert([recap, streak])?.kind).toBe('streak');
    expect(pickAlert([recap])?.kind).toBe('recap');
  });
});

describe('"Compartilhar" o próprio item do feed', () => {
  const runs = [
    { id: 'a', startedAt: new Date(2026, 9, 29, 7, 0).getTime(), meters: 8110 },
    { id: 'b', startedAt: new Date(2026, 9, 29, 18, 0).getTime(), meters: 3000 },
  ];
  it('acha a corrida do mesmo dia e distância; ambíguo ou sem par = nada', () => {
    expect(ownActivityFor({ day: '2026-10-29', meters: 8114 }, runs)).toBe('a');
    expect(ownActivityFor({ day: '2026-10-30', meters: 8110 }, runs)).toBeNull();
    expect(ownActivityFor({ day: '2026-10-29', meters: 5000 }, runs)).toBeNull();
    expect(ownActivityFor({ day: '2026-10-29', meters: 3000 }, [...runs, { id: 'c', startedAt: runs[1].startedAt + 60_000, meters: 3004 }])).toBeNull();
  });
});
