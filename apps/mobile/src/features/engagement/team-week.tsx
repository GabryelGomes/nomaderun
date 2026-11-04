/**
 * "A semana do time" (F8 · ideia 5.10): na 1ª abertura do Mapa na segunda-feira, uma faixa na cor do time com o
 * mascote em pose e o lugar do time na temporada (número real do servidor, `ranking_factions`). Some com 1 toque ou
 * depois de 4 s. Na demonstração, o selo global da tela já marca o dado (e o leitor de tela ouve "Demonstração"). Destino comum: o time todo começa a semana junto. Sem o número, a faixa fica só com o convite.
 *
 * E5 (onda C): a faixa é o `TeamWeekCard` (entra com mola, o mascote salta na pose e fica vivo, sai com fade).
 */
import { useEffect, useState } from 'react';

import { TeamWeekCard } from '@/components/celebration/team-week-card';
import { brtCalendar } from '@/domain/progression';
import type { FactionId } from '@/domain/types';
import { isDemoMode } from '@/services/api/env';
import { rankFactions } from '@/services/api/leaderboard-repo';
import { durations } from '@/theme/motion';
import { factions } from '@/theme/tokens';

import { readLocal, writeLocal } from './local-store';

export const TEAM_WEEK_MS = 4000;
const SEEN = 'team-week-seen';

/** Segunda-feira (Brasília) e ainda não mostrada nesta semana. */
export function teamWeekDue(now: number, seenWeek: string | null): boolean {
  const c = brtCalendar.clock(now);
  return c.weekday === 0 && seenWeek !== c.weekId;
}

/** "2º na temporada · 48 zonas" (só com o lugar real); sem ele, o convite. */
export function teamWeekBody(row: { position: number; zones: number } | null): string {
  if (!row || row.position < 1) return 'Bora pintar a cidade juntos';
  const zones = row.zones === 1 ? '1 zona' : `${row.zones} zonas`;
  return `${row.position}º na temporada · ${zones}`;
}

type Shown = { body: string; first: boolean } | null;

export function TeamWeekBanner({ team, now, testID = 'mapa-semana-time' }: { team: FactionId; now: number; testID?: string }) {
  const [shown, setShown] = useState<Shown>(null);
  const [gone, setGone] = useState(false);
  const week = brtCalendar.clock(now).weekId;
  const monday = brtCalendar.clock(now).weekday === 0;

  useEffect(() => {
    if (!monday) return;
    let alive = true;
    void (async () => {
      const seen = await readLocal<string>(SEEN);
      if (!alive || !teamWeekDue(now, seen ?? null)) return;
      await writeLocal(SEEN, week);
      const res = await rankFactions({ period: 'season', scope: 'general' });
      const row = res.ok ? (res.data.find((r) => r.faction === team) ?? null) : null;
      if (alive) setShown({ body: teamWeekBody(row), first: row?.position === 1 });
    })();
    return () => {
      alive = false;
    };
    // Uma leitura por semana (o `now` muda a cada minuto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, monday, team]);

  // 1 toque ou 4 s: a faixa sai com fade (E5) e então desmonta
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!shown || leaving) return;
    const t = setTimeout(() => setLeaving(true), TEAM_WEEK_MS);
    return () => clearTimeout(t);
  }, [shown, leaving]);
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setGone(true), durations.exit);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!shown || gone) return null;
  const f = factions[team];
  return (
    <TeamWeekCard
      testID={testID}
      team={team}
      body={shown.body}
      first={shown.first}
      leaving={leaving}
      onPress={() => setLeaving(true)}
      accessibilityLabel={`Semana nova dos ${f.name}. ${shown.body}.${isDemoMode() ? ' Demonstração.' : ''} Toque para fechar.`}
    />
  );
}
