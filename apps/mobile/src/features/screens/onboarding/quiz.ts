import type { IconName } from '@/components/icon';
import type { FactionId } from '@/domain/types';

/**
 * Quiz "Não sei escolher" (D-72; bíblia dos times, `docs/melhoria/F1/04-direcao-de-arte.md` §3.5): 3 perguntas,
 * 4 respostas, cada resposta aponta 1 time. A escolha continua livre: o resultado só **sugere** e pré-seleciona o
 * card. Nenhum time ganha vantagem de pontos (regra de ouro da E1).
 */
export type QuizOption = { team: FactionId; label: string; icon: IconName };
export type QuizQuestion = { id: string; title: string; options: readonly QuizOption[] };

// Ajuste de texto (E6): ícone + 2 ou 3 palavras por resposta (antes, frases de até 8 palavras).
export const TEAM_QUIZ: readonly QuizQuestion[] = [
  {
    id: 'corrida',
    title: 'Sua corrida ideal?',
    options: [
      { team: 'striders', label: 'Ritmo certinho', icon: 'timer' },
      { team: 'volt', label: 'Ir mais longe', icon: 'route' },
      { team: 'owls', label: 'Cidade à noite', icon: 'moon' },
      { team: 'coyotes', label: 'Em grupo', icon: 'club' },
    ],
  },
  {
    // A ordem gira a cada pergunta: a mesma posição não aponta sempre o mesmo time.
    id: 'fim',
    title: 'No fim, você…',
    options: [
      { team: 'volt', label: 'Planeja o próximo', icon: 'flag' },
      { team: 'owls', label: 'Tira foto', icon: 'city' },
      { team: 'coyotes', label: 'Café em grupo', icon: 'heart' },
      { team: 'striders', label: 'Confere parciais', icon: 'activities' },
    ],
  },
  {
    id: 'superpoder',
    title: 'Seu superpoder?',
    options: [
      { team: 'owls', label: 'Olhar', icon: 'eye' },
      { team: 'coyotes', label: 'Parceria', icon: 'invite' },
      { team: 'striders', label: 'Foco', icon: 'trophy' },
      { team: 'volt', label: 'Fôlego', icon: 'fire' },
    ],
  },
];

/**
 * Time sugerido pelas respostas (na ordem das perguntas): o mais votado; em empate, vale a resposta da pergunta 1.
 * Sem respostas, nenhuma sugestão.
 */
export function quizResult(answers: readonly FactionId[]): FactionId | null {
  if (answers.length === 0) return null;
  const votes = new Map<FactionId, number>();
  for (const a of answers) votes.set(a, (votes.get(a) ?? 0) + 1);
  const best = Math.max(...votes.values());
  const leaders = [...votes.entries()].filter(([, n]) => n === best).map(([t]) => t);
  return leaders.length === 1 ? leaders[0] : leaders.includes(answers[0]) ? answers[0] : leaders[0];
}
