/**
 * D-93 — uma fonte de texto por time: lema de 3 palavras, bio de 3 linhas curtas, 1 valor e 1 estilo, sem promessa de
 * vantagem e sem culpa; nomes iguais aos dos tokens de cor.
 */
import { describe, expect, it } from '@jest/globals';

import { factions } from '@/theme/tokens';

import { mascotCaption, signUpTitle, TEAM_BIO, teamBioText, teamIntro, teamMotto, trailLine } from '../team-bio';
import { FACTION_IDS } from '../types';

/** O mesmo filtro de culpa e de vantagem numérica da lista de "nunca" (`F8/01` §3.2). */
const FORBIDDEN = /sentimos sua falta|abandon|não desista|perder tudo|\+\d+%|pontos a mais|dopamina|vicia/i;

describe('TEAM_BIO (D-93)', () => {
  it('tem os 4 times, com nome igual ao dos tokens', () => {
    for (const f of FACTION_IDS) expect(TEAM_BIO[f].name).toBe(factions[f].name);
  });

  it('lema de 3 palavras, bio de 3 linhas curtas, valor de 1 palavra e estilo de até 5', () => {
    for (const f of FACTION_IDS) {
      const b = TEAM_BIO[f];
      // 3 palavras (a dos Owls, "A noite é nossa", tem o artigo: 4 no máximo)
      expect(b.motto.split(' ').length).toBeLessThanOrEqual(4);
      expect(b.motto.split(' ').length).toBeGreaterThanOrEqual(3);
      expect(b.bio).toHaveLength(3);
      for (const line of b.bio) expect(line.length).toBeLessThanOrEqual(36);
      expect(b.value.split(' ')).toHaveLength(1);
      expect(b.style.split(' ').length).toBeLessThanOrEqual(5);
      expect(b.mascot.length).toBeGreaterThan(0);
      expect(b.leader.length).toBeGreaterThan(0);
      expect(b.colorName.length).toBeGreaterThan(0);
    }
  });

  it('os lemas da capa (F8/02 §3.2) substituem os antigos', () => {
    expect(teamMotto('striders')).toBe('Ritmo vira luz');
    expect(teamMotto('volt')).toBe('Energia não acaba');
    expect(teamMotto('owls')).toBe('A noite é nossa');
    expect(teamMotto('coyotes')).toBe('A matilha avança');
  });

  it('nenhum texto promete vantagem de pontos, usa culpa nem fala em dopamina', () => {
    for (const f of FACTION_IDS) {
      const b = TEAM_BIO[f];
      const all = [b.motto, ...b.bio, b.value, b.style].join(' ');
      expect(all).not.toMatch(FORBIDDEN);
    }
  });

  it('lemas, mascotes e líderes são diferentes entre os times', () => {
    for (const key of ['motto', 'mascot', 'leader', 'colorName', 'value'] as const) {
      expect(new Set(FACTION_IDS.map((f) => TEAM_BIO[f][key])).size).toBe(FACTION_IDS.length);
    }
  });

  it('frases prontas: apresentação, bio inteira, legenda do mascote, rastro e título do cadastro', () => {
    expect(teamIntro('coyotes')).toBe('O coiote que fareja a rota.');
    expect(teamBioText('owls')).toBe('A coruja que enxerga tudo. Quando a cidade apaga, os Owls acendem.');
    expect(mascotCaption('striders')).toBe('Lume, a onça');
    expect(trailLine('coyotes')).toBe('Seu rastro agora é amarelo');
    expect(signUpTitle('volt')).toBe('Garanta seu lugar nos Volt Runners');
  });
});
