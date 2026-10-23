import { describe, expect, it } from '@jest/globals';

import { appInviteText, crewInviteLink, crewInvitePath, crewInviteText, inviteBaseUrl, normalizeInviteCode } from '../invite';

const BASE = 'https://nomade-run.vercel.app';

describe('convites: código e link', () => {
  it('código normalizado (maiúsculas, sem espaço ou símbolo)', () => {
    expect(normalizeInviteCode(' demo-flr1 ')).toBe('DEMOFLR1');
  });

  it('domínio configurável; sem domínio no aparelho, não há link', () => {
    expect(inviteBaseUrl(`${BASE}/`, null)).toBe(BASE);
    expect(inviteBaseUrl(undefined, 'http://127.0.0.1:8098')).toBe('http://127.0.0.1:8098');
    expect(inviteBaseUrl('', null)).toBeNull();
    expect(inviteBaseUrl('javascript:alert(1)', null)).toBeNull();
    expect(inviteBaseUrl('nomaderun://c', null)).toBeNull();
  });

  it('link da crew aponta para a página de reserva da prévia web', () => {
    expect(crewInvitePath('demoflr1')).toBe('/compartilhar/convite/DEMOFLR1');
    expect(crewInviteLink('demoflr1', BASE)).toBe(`${BASE}/compartilhar/convite/DEMOFLR1`);
    expect(crewInviteLink('x', BASE)).toBeNull(); // código inválido
    expect(crewInviteLink('DEMOFLR1', null)).toBeNull();
  });
});

describe('convites: texto pronto', () => {
  it('crew com link, cidade e a cor do time', () => {
    expect(crewInviteText({ crewName: 'Flamboyant Runners', faction: 'striders', code: 'demoflr1', city: 'Goiânia', link: `${BASE}/compartilhar/convite/DEMOFLR1` })).toBe(
      `Bora correr com a Flamboyant Runners no NOMADE RUN? A gente pinta Goiânia de azul (Neon Striders). Entra com o código DEMOFLR1: ${BASE}/compartilhar/convite/DEMOFLR1`,
    );
  });

  it('sem link: o código e onde colar; demonstração marcada', () => {
    expect(crewInviteText({ crewName: 'Pace Goiás', faction: null, code: 'DEMOPCG1', link: null, isDemo: true })).toBe(
      'Bora correr com a Pace Goiás no NOMADE RUN? Entra com o código DEMOPCG1 em Clube → Crew → Entrar com código. (demonstração)',
    );
  });

  it('convite do app', () => {
    expect(appInviteText({ place: 'Jardim Goiás', faction: 'owls', link: `${BASE}/` })).toBe(`Tô dominando Jardim Goiás no NOMADE RUN com os Night Owls. Escolhe seu time e vem: ${BASE}/`);
    expect(appInviteText({ link: null })).toBe('Tô correndo e pintando a cidade no NOMADE RUN. Escolhe seu time e vem!');
  });
});
