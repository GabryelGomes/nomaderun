import type { FactionId } from './types';

/**
 * Uma fonte de texto por time (D-93, `docs/melhoria/F8/02-direcao-de-arte.md` §3.2): nome, mascote, lema de 3
 * palavras, bio de 3 linhas, líder, 1 valor e 1 estilo. É usada na escolha do time, na capa, em "Meu time", no card
 * e nas falas da cerimônia. Tom: curto, de torcida, sem promessa de vantagem (nenhum time pontua mais que outro).
 *
 * Puro (sem React, sem tokens): cor e forma continuam em `theme/tokens.ts`; a arte, em `components/art`.
 * Nomes de mascotes e líderes são proposta trocável pelos autores (D-70): trocar aqui não muda a arte.
 */
export type TeamBio = {
  name: string;
  /** Nome do mascote ("Lume"). */
  mascot: string;
  /** O bicho, com artigo, para legenda e leitor de tela ("a onça"). */
  mascotKind: string;
  /** Lema de 3 palavras, a frase da capa. */
  motto: string;
  /** Biografia em 3 linhas curtas; a 1ª linha sozinha já apresenta o time. */
  bio: readonly [string, string, string];
  leader: string;
  /** 1 valor, em 1 palavra. */
  value: string;
  /** 1 estilo de corrida, em até 4 palavras. */
  style: string;
  /** Nome da cor do time, para "Seu rastro agora é azul". */
  colorName: string;
};

export const TEAM_BIO: Record<FactionId, TeamBio> = {
  striders: {
    name: 'Neon Striders',
    mascot: 'Lume',
    mascotKind: 'a onça',
    motto: 'Ritmo vira luz',
    bio: ['A onça que corre no compasso.', 'Cada passada no tempo certo,', 'cada rua acesa de azul.'],
    leader: 'Íris Valente',
    value: 'Precisão',
    style: 'Ritmo e precisão',
    colorName: 'azul',
  },
  volt: {
    name: 'Volt Runners',
    mascot: 'Faísca',
    mascotKind: 'a lebre',
    motto: 'Energia não acaba',
    bio: ['A lebre que não desliga.', 'Tiro curto ou longo, tanto faz:', 'sempre sobra faísca.'],
    leader: 'Téo Faria',
    value: 'Energia',
    style: 'Resistência e distância',
    colorName: 'verde',
  },
  owls: {
    name: 'Night Owls',
    mascot: 'Breu',
    mascotKind: 'a coruja',
    motto: 'A noite é nossa',
    bio: ['A coruja que enxerga tudo.', 'Quando a cidade apaga,', 'os Owls acendem.'],
    leader: 'Nara Lis',
    value: 'Visão',
    style: 'Fim do dia, rua iluminada',
    colorName: 'vermelho',
  },
  coyotes: {
    name: 'Urban Coyotes',
    mascot: 'Faro',
    mascotKind: 'o coiote',
    motto: 'A matilha avança',
    bio: ['O coiote que fareja a rota.', 'Um corre, todos correm:', 'a matilha pinta a cidade.'],
    leader: 'Bento Rocha',
    value: 'União',
    style: 'Corrida em grupo',
    colorName: 'amarelo',
  },
};

/** Lema do time (3 palavras). */
export function teamMotto(f: FactionId): string {
  return TEAM_BIO[f].motto;
}

/** 1ª linha da bio, a apresentação de 1 frase ("A onça que corre no compasso."). */
export function teamIntro(f: FactionId): string {
  return TEAM_BIO[f].bio[0];
}

/** Bio inteira em 1 parágrafo (leitor de tela e "Meu time"). */
export function teamBioText(f: FactionId): string {
  return TEAM_BIO[f].bio.join(' ');
}

/** Legenda do mascote ("Lume, a onça"). */
export function mascotCaption(f: FactionId): string {
  const b = TEAM_BIO[f];
  return `${b.mascot}, ${b.mascotKind}`;
}

/** Frase do marcador de identidade na cerimônia (regra 6 de `F8/01` §1.3). */
export function trailLine(f: FactionId): string {
  return `Seu rastro agora é ${TEAM_BIO[f].colorName}`;
}

/** Título do cadastro depois da cerimônia (D-91). */
export function signUpTitle(f: FactionId): string {
  return `Garanta seu lugar nos ${TEAM_BIO[f].name}`;
}
