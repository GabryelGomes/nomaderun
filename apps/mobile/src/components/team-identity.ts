import type { FactionId } from '@/domain/types';

/**
 * Identidade dos times (D-70; bíblia em `docs/melhoria/F1/04-direcao-de-arte.md` §3).
 * Nomes de mascotes e líderes são proposta trocável pelos autores: trocar aqui não muda a arte.
 * Regra de ouro: cada time = 1 valor + 1 estilo, nunca vantagem de pontos. Cor, forma e lema ficam em
 * `theme/tokens.ts` (`factions`).
 */
export type TeamStory = {
  mascot: string;
  /** O bicho, para o leitor de tela e a legenda ("Lume, o guepardo"). */
  mascotKind: string;
  leader: string;
  /** Estilo de corrida em até 4 palavras (card do carrossel). */
  style: string;
  /** Bio curta do card (≤ 80 caracteres, 1 frase). */
  bio: string;
  /** Fala do líder na escolha (convite curto). */
  leaderLine: string;
  cheer: string;
};

export const TEAM_STORY: Record<FactionId, TeamStory> = {
  striders: {
    mascot: 'Lume',
    mascotKind: 'o guepardo',
    leader: 'Íris Valente',
    style: 'Ritmo e precisão',
    bio: 'Ritmo exato, passo no lugar: cada quilômetro no tempo certo.',
    leaderLine: 'Ritmo não é velocidade, é saber quanto você ainda tem. Encontra o seu passo com a gente?',
    cheer: 'Passo certo, cidade azul!',
  },
  volt: {
    mascot: 'Faísca',
    mascotKind: 'a lebre elétrica',
    leader: 'Téo Faria',
    style: 'Resistência e distância',
    bio: 'Na fábula a lebre dormiu; a nossa não para e cada quilômetro recarrega.',
    leaderLine: 'Cansou? Ótimo, agora começa a parte boa. Vem carregar com a gente?',
    cheer: 'Liga, carrega, não para!',
  },
  owls: {
    mascot: 'Breu',
    mascotKind: 'a coruja',
    leader: 'Nara Lis',
    style: 'Fim do dia, rua iluminada',
    bio: 'Correm quando a cidade acende as luzes e pintam o fim do dia de vermelho.',
    leaderLine: 'A cidade muda quando as luzes acendem. Corre com a gente nesse brilho?',
    cheer: 'Acende a cidade!',
  },
  coyotes: {
    mascot: 'Faro',
    mascotKind: 'o coiote',
    leader: 'Bento Rocha',
    style: 'Corrida em grupo',
    bio: 'Correm em matilha pela cidade: ninguém fica para trás.',
    leaderLine: 'Aqui ninguém fica para trás. Nem você. Chega mais?',
    cheer: 'Ninguém fica pra trás!',
  },
};

/** Linha de equilíbrio da folha do líder (nenhum time pontua mais que outro). */
export const TEAM_BALANCE_LINE = 'Nenhum time pontua mais que outro: a escolha é de estilo.';
