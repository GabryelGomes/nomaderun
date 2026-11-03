/**
 * "Como jogar" (UX-07, UX-19): o glossário visual da progressão em 6 cartões com a arte da E4 — Corra, Pinte,
 * Defenda (os 3 do tutorial), Chefão, Missões e baú, Liga. Abre sozinho 1 vez, na 1ª visita à Arena; depois, só
 * pelo "?" do cabeçalho. Cada frase ≤ 90 caracteres e vale para a regra v1 e a v2 (a virada é por flag).
 */
import { useEffect, useState } from 'react';

import { Boss, Chest, ModeIcon, TutorialArt } from '@/components/art';
import type { HelpCard } from '@/components/help-sheet';
import type { FactionId } from '@/domain/types';

import { readLocal, writeLocal } from './local-store';

export const HOW_TO_PLAY_SEEN = 'how-to-play-seen';

/** Os 6 cartões, na ordem em que a pessoa encontra cada coisa. */
export function howToPlayCards(team: FactionId): HelpCard[] {
  return [
    { key: 'corra', title: 'Corra', body: 'Cada metro que você corre conta para o seu time.', art: <TutorialArt step="corra" team={team} size={64} /> },
    { key: 'pinte', title: 'Pinte', body: 'A zona fica com o time que mais correu nela.', art: <TutorialArt step="pinte" team={team} size={64} /> },
    { key: 'defenda', title: 'Defenda', body: 'Rival na sua zona? Corra lá para segurar a cor.', art: <TutorialArt step="defenda" team={team} size={64} /> },
    { key: 'chefao', title: 'Chefão', body: 'Toda a cidade corre junto contra o chefão da semana. Cada km tira vida dele.', art: <Boss id="soneca" size={60} /> },
    { key: 'missoes-bau', title: 'Missões e baú', body: 'Missões dão XP. Corra 1 km no dia e abra o baú: as chances ficam à vista.', art: <Chest rarity="raro" size={60} /> },
    { key: 'liga', title: 'Liga', body: 'Seus pontos da semana valem na liga. Sobe quem fica no topo do grupo.', art: <ModeIcon kind="liga" size={56} /> },
  ];
}

/**
 * 1ª visita à Arena: abre "Como jogar" sozinho 1 vez (memória no aparelho; demonstração com chave separada).
 * Devolve `true` quando deve abrir agora; a tela marca como visto ao abrir.
 */
export function useHowToPlayFirstVisit(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    void readLocal<boolean>(HOW_TO_PLAY_SEEN).then((seen) => {
      if (!alive || seen === true) return;
      void writeLocal(HOW_TO_PLAY_SEEN, true);
      setOpen(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return open;
}
