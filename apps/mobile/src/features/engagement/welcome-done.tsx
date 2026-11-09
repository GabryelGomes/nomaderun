/**
 * "Missão 1 feita!" (F8 · B2, UX-02): a missão de boas-vindas some sozinha quando a pessoa corre e conquista a 1ª
 * zona, e o Mapa comemora 1 vez. Honesto: só comemora quem viu a missão aberta neste aparelho (conta antiga que
 * atualiza o app nunca recebe uma celebração do nada). Memória no `local-store` (chaves separadas na demonstração).
 */
import { useEffect, useState } from 'react';

import { Mascot } from '@/components/art';
import { RewardToast } from '@/components/celebration';
import type { FactionId } from '@/domain/types';
import { neonTeam } from '@/theme/neon';

import { readLocal, writeLocal } from './local-store';

const SEEN = 'welcome-mission-seen';
const DONE = 'welcome-mission-celebrated';

/** Mostra a celebração agora? Só quando a missão foi vista aberta, foi concluída e ainda não foi comemorada. */
export function welcomeDoneDue(input: { seen: boolean; celebrated: boolean; complete: boolean }): boolean {
  return input.seen && input.complete && !input.celebrated;
}

/**
 * `open`: a missão de boas-vindas está na tela agora. `complete`: o estado real diz que ela foi cumprida (corridas
 * ≥ 1 e zona conquistada). Devolve `true` uma vez, quando é hora de comemorar.
 */
export function useWelcomeDone(open: boolean, complete: boolean): { show: boolean; dismiss: () => void } {
  const [memory, setMemory] = useState<{ seen: boolean; celebrated: boolean } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // A missão apareceu aberta neste aparelho: grava (é o que autoriza a celebração depois).
  useEffect(() => {
    if (open) void writeLocal(SEEN, true);
  }, [open]);
  // Relê a memória ao montar e quando a missão vira concluída (a gravação acima já aconteceu antes).
  useEffect(() => {
    let alive = true;
    void Promise.all([readLocal<boolean>(SEEN), readLocal<boolean>(DONE)]).then(([seen, celebrated]) => alive && setMemory({ seen: seen === true, celebrated: celebrated === true }));
    return () => {
      alive = false;
    };
  }, [complete]);
  const show = !!memory && !dismissed && welcomeDoneDue({ ...memory, complete });
  useEffect(() => {
    if (show) void writeLocal(DONE, true);
  }, [show]);
  return { show, dismiss: () => setDismissed(true) };
}

/** O aviso da conclusão (médio, desce do topo e sai sozinho). A E5 pode trocar a coreografia na onda C. */
export function WelcomeDoneToast({ team, onDone }: { team: FactionId; onDone: () => void }) {
  return (
    <RewardToast
      testID="mapa-missao-feita"
      size="medium"
      color={neonTeam[team]}
      icon={<Mascot team={team} pose="vitoria" size={44} />}
      title="Missão 1 feita!"
      subtitle="Sua 1ª zona já é do time"
      onDone={onDone}
    />
  );
}
