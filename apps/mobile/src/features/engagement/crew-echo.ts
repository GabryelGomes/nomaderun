/**
 * Eco da crew (F8 · ideia 5.7, dado da A2): "{colega} reforçou {n} trechos que você pintou". 1 por dia, só entre
 * 07h e 22h de Brasília (`isEchoHour`), e o aviso local entra no limite de 1 por dia e 4 por semana (D-69).
 *
 * O servidor (`crew_echo()`) já agrega o dia e corta privacidade (máscara do colega, quem não compartilha). Aqui
 * só a leitura com cache curto (a central e o planejador de avisos leem o mesmo valor) e o texto.
 */
import { useEffect, useState } from 'react';

import { isEchoHour } from '@/domain/faction-activity';
import { getCrewEcho, type CrewEcho } from '@/services/api/crews-repo';
import { useSession } from '@/store/session-store';

/** Relê o eco no máximo a cada 10 min (o dado muda 1 vez por dia). */
export const ECHO_STALE_MS = 10 * 60_000;

let cache: { at: number; user: string | null; echo: CrewEcho | null } | null = null;

const currentUser = () => useSession.getState().session?.userId ?? null;
/** O cache vale só para a conta que o leu (troca de conta nunca mostra o eco de outra pessoa). */
const fresh = (now: number) => (cache && cache.user === currentUser() && now - cache.at < ECHO_STALE_MS ? cache : null);
let inflight: Promise<CrewEcho | null> | null = null;

/** Só o eco que vale agora: existe, tem trecho e está dentro da janela do dia (07h–22h, Brasília). */
export function echoNow(echo: CrewEcho | null, now: number): CrewEcho | null {
  if (!echo || echo.cells <= 0 || !isEchoHour(now)) return null;
  if (echo.notifyUntil > 0 && now >= echo.notifyUntil) return null;
  if (echo.notifyFrom > 0 && now < echo.notifyFrom) return null;
  return echo;
}

/** "Rafa reforçou 3 trechos que você pintou" (+ "e mais 2 da crew" quando houver). Até ~70 caracteres. */
export function echoText(echo: Pick<CrewEcho, 'mateUsername' | 'cells' | 'othersCount'>): string {
  const mate = echo.mateUsername.length > 16 ? `${echo.mateUsername.slice(0, 15)}…` : echo.mateUsername;
  const base = `${mate} reforçou ${echo.cells === 1 ? '1 trecho' : `${echo.cells} trechos`} que você pintou`;
  return echo.othersCount > 0 ? `${base}, e mais ${echo.othersCount} da crew` : base;
}

/** Lê o eco do servidor (servidor antigo, flag desligada ou erro → `null`: não há eco). */
export function loadCrewEcho(now: number): Promise<CrewEcho | null> {
  const hit = fresh(now);
  if (hit) return Promise.resolve(hit.echo);
  const user = currentUser();
  if (inflight) return inflight;
  // Um erro síncrono (cliente sem configuração) também vira "sem eco", nunca derruba a tela que mostra o card.
  inflight = Promise.resolve()
    .then(() => getCrewEcho())
    .then((res) => {
      const echo = res.ok && res.data && res.data.available ? res.data : null;
      cache = { at: now, user, echo };
      return echo;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** O que o planejador de avisos usa (sem rede: o último eco lido, se ainda vale). */
export function cachedCrewEcho(now: number): CrewEcho | null {
  return cache && cache.user === currentUser() ? echoNow(cache.echo, now) : null;
}

/** Para os testes e para a troca de conta. */
export function resetCrewEchoCache(): void {
  cache = null;
  inflight = null;
}

/** Eco de hoje para a tela (central de avisos). `null` = nada a mostrar. */
export function useCrewEcho(now: number): CrewEcho | null {
  const [echo, setEcho] = useState<CrewEcho | null>(() => cachedCrewEcho(now));
  useEffect(() => {
    let alive = true;
    void loadCrewEcho(Date.now()).then((e) => alive && setEcho(e));
    return () => {
      alive = false;
    };
  }, []);
  return echoNow(echo, now);
}
