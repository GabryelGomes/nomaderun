/**
 * Selo "Precisa de reforço" (D-96): no card do time da escolha e em "Meu time", o time com menos corredores ativos
 * nos últimos 7 dias (`faction_activity()`, só contagens; regra pura `factionNeedingBoost`: sem empate e com pelo
 * menos 4 ativos no total). **Só cosmético**: nunca dá ponto, XP ou vantagem. Sem o dado (servidor antigo, erro),
 * o selo não aparece; na demonstração, vem marcado como tal.
 *
 * Encaixe (B1/coordenador): `<TeamBoostBadge team={f} />` dentro do card de cada time; `useFactionBoost()` lê 1 vez
 * e guarda por 10 min (todos os cards da tela compartilham a mesma leitura).
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import type { FactionId } from '@/domain/types';
import { isDemoMode } from '@/services/api/env';
import { getFactionActivity } from '@/services/api/faction-activity-repo';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';

export const BOOST_STALE_MS = 10 * 60_000;

export type FactionBoost = { needsBoost: FactionId | null; isDemo: boolean };

/** O cache vale só para o modo em que foi lido (demonstração e conta real nunca se misturam, D-77). */
let cache: { at: number; demo: boolean; value: FactionBoost | null } | null = null;
let inflight: Promise<FactionBoost | null> | null = null;

/** Lê `faction_activity()` (com cache curto). Indisponível ou erro → `null` (sem selo). */
export function loadFactionBoost(now: number): Promise<FactionBoost | null> {
  const demo = isDemoMode();
  if (cache && cache.demo === demo && now - cache.at < BOOST_STALE_MS) return Promise.resolve(cache.value);
  if (inflight) return inflight;
  inflight = getFactionActivity()
    .then((res) => {
      const value = res.ok && res.data.available ? { needsBoost: res.data.needsBoost, isDemo: res.data.isDemo } : null;
      cache = { at: now, demo, value };
      return value;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function resetFactionBoostCache(): void {
  cache = null;
  inflight = null;
}

export function useFactionBoost(): FactionBoost | null {
  const [value, setValue] = useState<FactionBoost | null>(() => (cache && cache.demo === isDemoMode() ? cache.value : null));
  useEffect(() => {
    let alive = true;
    void loadFactionBoost(Date.now()).then((v) => alive && setValue(v));
    return () => {
      alive = false;
    };
  }, []);
  return value;
}

/** Texto do selo (o leitor de tela recebe a frase inteira, com o "só cosmético" explicado). */
export function boostLabel(isDemo: boolean): { text: string; a11y: string } {
  return {
    text: isDemo ? 'Precisa de reforço · demonstração' : 'Precisa de reforço',
    a11y: `Precisa de reforço: o time com menos corredores ativos nos últimos 7 dias. É só um selo, sem vantagem.${isDemo ? ' Dado de demonstração.' : ''}`,
  };
}

/** O selo pequeno. Só aparece no time que precisa de reforço; nos outros, nada. */
export function TeamBoostBadge({ team, boost, testID }: { team: FactionId; boost?: FactionBoost | null; testID?: string }) {
  const read = useFactionBoost();
  const b = boost === undefined ? read : boost;
  if (!b || b.needsBoost !== team) return null;
  const label = boostLabel(b.isDemo);
  return (
    <View
      testID={testID ?? `selo-reforco-${team}`}
      accessible
      accessibilityLabel={label.a11y}
      style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 24, paddingHorizontal: space[2], borderRadius: radius.pill, borderWidth: 1, borderColor: neon.orange, backgroundColor: neon.activeFill }}>
      <Icon name="sparkles" size={12} color={neon.orangeText} />
      <Text variant="caption" color={neon.orangeText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label.text}
      </Text>
    </View>
  );
}
