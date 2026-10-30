import { describe, expect, it } from '@jest/globals';

import { factionChange, nextSeasonId, seasonIdAt, seasonStartLabel } from '../season';

describe('RN-006 — temporada mensal no horário de Brasília', () => {
  it('usa o mês de Brasília, não o de Greenwich', () => {
    // 1º de novembro às 01:00 UTC ainda é 31 de outubro às 22:00 em Brasília
    expect(seasonIdAt(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10');
    expect(seasonIdAt(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11');
  });

  it('avança o mês e vira o ano em dezembro', () => {
    expect(nextSeasonId('2026-10')).toBe('2026-11');
    expect(nextSeasonId('2026-12')).toBe('2027-01');
  });

  it('escreve o início da temporada por extenso', () => {
    expect(seasonStartLabel('2026-11')).toBe('1º de novembro');
    expect(seasonStartLabel('2027-01')).toBe('1º de janeiro');
  });
});

describe('RF-003 — troca de facção 1× por temporada', () => {
  const now = new Date('2026-10-23T15:00:00Z');

  it('libera quem ainda não tem facção', () => {
    expect(factionChange({ faction: null, factionChangedSeason: '2026-10' }, now)).toEqual({ allowed: true });
  });

  it('libera quem trocou numa temporada anterior ou nunca trocou', () => {
    expect(factionChange({ faction: 'volt', factionChangedSeason: '2026-09' }, now)).toEqual({ allowed: true });
    expect(factionChange({ faction: 'volt', factionChangedSeason: null }, now)).toEqual({ allowed: true });
  });

  it('bloqueia a segunda troca na mesma temporada e diz quando libera', () => {
    expect(factionChange({ faction: 'volt', factionChangedSeason: '2026-10' }, now)).toEqual({ allowed: false, nextAt: '1º de novembro' });
  });
});
