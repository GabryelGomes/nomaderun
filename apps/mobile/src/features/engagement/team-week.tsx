/**
 * "A semana do time" (F8 · ideia 5.10): na 1ª abertura do Mapa na segunda-feira, uma faixa na cor do time com o
 * mascote em pose e o lugar do time na temporada (número real do servidor, `ranking_factions`). Some com 1 toque ou
 * depois de 4 s. Destino comum: o time todo começa a semana junto. Sem o número, a faixa fica só com o convite.
 *
 * Encaixe da E5 (onda C): o mascote em pose animada (`Mascot animated`) e a entrada da faixa.
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Mascot } from '@/components/art';
import { DemoBadge } from '@/components/demo-badge';
import { FadeUp } from '@/components/motion';
import { Text } from '@/components/text';
import { brtCalendar } from '@/domain/progression';
import type { FactionId } from '@/domain/types';
import { isDemoMode } from '@/services/api/env';
import { rankFactions } from '@/services/api/leaderboard-repo';
import { factions, floating, radius, space } from '@/theme/tokens';

import { readLocal, writeLocal } from './local-store';

export const TEAM_WEEK_MS = 4000;
const SEEN = 'team-week-seen';

/** Segunda-feira (Brasília) e ainda não mostrada nesta semana. */
export function teamWeekDue(now: number, seenWeek: string | null): boolean {
  const c = brtCalendar.clock(now);
  return c.weekday === 0 && seenWeek !== c.weekId;
}

/** "2º lugar na temporada · 48 zonas" (só com o lugar real); sem ele, o convite. */
export function teamWeekBody(row: { position: number; zones: number } | null): string {
  if (!row || row.position < 1) return 'Semana nova. Bora pintar a cidade juntos';
  const zones = row.zones === 1 ? '1 zona' : `${row.zones} zonas`;
  return `${row.position}º lugar na temporada · ${zones}`;
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

  useEffect(() => {
    if (!shown || gone) return;
    const t = setTimeout(() => setGone(true), TEAM_WEEK_MS);
    return () => clearTimeout(t);
  }, [shown, gone]);

  if (!shown || gone) return null;
  const f = factions[team];
  return (
    <FadeUp distance={-12} duration={400}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`Semana nova dos ${f.name}. ${shown.body}. Toque para fechar.`}
        accessibilityLiveRegion="polite"
        onPress={() => setGone(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingVertical: space[2], paddingHorizontal: space[3], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: f.color, boxShadow: floating }}>
        <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: 40, height: 44 }}>
          <Mascot team={team} pose={shown.first ? 'vitoria' : 'parado'} size={40} color={f.onColor} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyBold" color={f.onColor} numberOfLines={1}>{`Semana nova dos ${f.name}`}</Text>
          <Text variant="caption" color={f.onColor} numberOfLines={1}>
            {shown.body}
          </Text>
        </View>
        {isDemoMode() ? <DemoBadge /> : null}
      </Pressable>
    </FadeUp>
  );
}
