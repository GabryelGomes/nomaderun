import { TEAM_BIO, type TeamBio } from '@/domain/team-bio';
import { FACTION_IDS, type FactionId } from '@/domain/types';

/**
 * Identidade dos times para as telas (D-70, D-93). Nome, mascote, lema, bio, líder, valor e estilo vêm da fonte
 * única `src/domain/team-bio.ts`; aqui ficam só as **falas** do líder (convite da folha e grito da cerimônia).
 * Regra de ouro: cada time = 1 valor + 1 estilo, nunca vantagem de pontos. Cor e forma ficam em
 * `theme/tokens.ts` (`factions`).
 */
export type TeamStory = Pick<TeamBio, 'mascot' | 'mascotKind' | 'leader' | 'style' | 'value' | 'motto'> & {
  /** Bio de 1 frase (a 1ª linha da bio de 3 linhas). */
  bio: string;
  /** Fala do líder na escolha (convite curto). */
  leaderLine: string;
  cheer: string;
};

const LEADER_LINES: Record<FactionId, { leaderLine: string; cheer: string }> = {
  striders: {
    leaderLine: 'Ritmo não é velocidade, é saber quanto você ainda tem. Encontra o seu passo com a gente?',
    cheer: 'Passo certo, cidade azul!',
  },
  volt: {
    leaderLine: 'Cansou? Ótimo, agora começa a parte boa. Vem carregar com a gente?',
    cheer: 'Liga, carrega, não para!',
  },
  owls: {
    leaderLine: 'A cidade muda quando as luzes acendem. Corre com a gente nesse brilho?',
    cheer: 'Acende a cidade!',
  },
  coyotes: {
    leaderLine: 'Aqui ninguém fica para trás. Nem você. Chega mais?',
    cheer: 'Ninguém fica pra trás!',
  },
};

export const TEAM_STORY: Record<FactionId, TeamStory> = Object.fromEntries(
  FACTION_IDS.map((f) => {
    const b = TEAM_BIO[f];
    return [f, { mascot: b.mascot, mascotKind: b.mascotKind, leader: b.leader, style: b.style, value: b.value, motto: b.motto, bio: b.bio[0], ...LEADER_LINES[f] }];
  }),
) as Record<FactionId, TeamStory>;

/** Linha de equilíbrio da folha do líder (nenhum time pontua mais que outro). */
export const TEAM_BALANCE_LINE = 'Nenhum time pontua mais que outro: a escolha é de estilo.';
