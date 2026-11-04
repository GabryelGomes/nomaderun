/**
 * Moldura "Recruta" (D-91, regra 9 de F8/01) no cartão de jogador do Você: a mesma soma de Recompensas — o que o
 * servidor diz que a pessoa tem (`user_cosmetics`; o servidor novo concede em `choose_faction`, migration
 * 20261104120200) mais o que a cerimônia guardou no aparelho (servidor antigo). Sem nenhum dos dois: sem moldura.
 */
import { useEffect, useState } from 'react';

import { fetchOwnedCosmetics } from '@/services/api/engagement-repo';

import { cosmeticName, readLocalCosmetics } from './cosmetics';

export const RECRUIT_FRAME_ID = 'moldura-recruta';

/** A pessoa tem a moldura? Junta servidor (`null` = não informa) e aparelho. */
export function hasRecruitFrame(server: readonly { id: string }[] | null, local: readonly string[]): boolean {
  return (server ?? []).some((c) => c.id === RECRUIT_FRAME_ID) || local.includes(RECRUIT_FRAME_ID);
}

/** Nome da moldura para o cartão ("Recruta") ou `null`. Lê 1 vez ao montar (e de novo quando `key` muda). */
export function useRecruitFrame(key?: string | null): string | null {
  const [has, setHas] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all([fetchOwnedCosmetics().catch(() => null), readLocalCosmetics().catch(() => [] as string[])]).then(([server, local]) => {
      if (alive) setHas(hasRecruitFrame(server, local));
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return has ? cosmeticName(RECRUIT_FRAME_ID) : null;
}
