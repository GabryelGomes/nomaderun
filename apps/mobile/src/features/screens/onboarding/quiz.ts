import type { FactionId } from '@/domain/types';

/**
 * Quiz "Não sei escolher" (D-72; bíblia dos times, `docs/melhoria/F1/04-direcao-de-arte.md` §3.5): 3 perguntas,
 * 4 respostas, cada resposta aponta 1 time. A escolha continua livre: o resultado só **sugere** e pré-seleciona o
 * card. Nenhum time ganha vantagem de pontos (regra de ouro da E1).
 */
export type QuizOption = { team: FactionId; label: string };
export type QuizQuestion = { id: string; title: string; options: readonly QuizOption[] };

export const TEAM_QUIZ: readonly QuizQuestion[] = [
  {
    id: 'corrida',
    title: 'Sua corrida ideal é…',
    options: [
      { team: 'striders', label: 'Bater o ritmo certinho' },
      { team: 'volt', label: 'Ir mais longe que na semana passada' },
      { team: 'owls', label: 'Ver a cidade acesa no fim do dia' },
      { team: 'coyotes', label: 'Correr com a galera' },
    ],
  },
  {
    // A ordem gira a cada pergunta: a mesma posição não aponta sempre o mesmo time.
    id: 'fim',
    title: 'No fim da corrida você…',
    options: [
      { team: 'volt', label: 'Já planeja o próximo longão' },
      { team: 'owls', label: 'Tira foto da cidade' },
      { team: 'coyotes', label: 'Espera o grupo e vai tomar café' },
      { team: 'striders', label: 'Confere as parciais' },
    ],
  },
  {
    id: 'superpoder',
    title: 'Seu superpoder é…',
    options: [
      { team: 'owls', label: 'Olhar' },
      { team: 'coyotes', label: 'Parceria' },
      { team: 'striders', label: 'Foco' },
      { team: 'volt', label: 'Fôlego' },
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
