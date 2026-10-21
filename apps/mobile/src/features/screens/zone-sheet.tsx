import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { TeamBadge } from '@/components/team-badge';
import { EmptyState } from '@/components/surface';
import { Text } from '@/components/text';
import { CountUp, FadeUp, RevealText, Stagger } from '@/components/motion';
import { DEFENSE_WINDOW_MS, SHIELD_REDUCTION, type Zone } from '@/domain/territory';
import { FACTION_IDS, type FactionId } from '@/domain/types';
import { zoneName } from '@/demo/demo-data';
import { useNow } from '@/features/use-now';
import { fetchZoneDetail, type ZoneDetail, type ZoneEventType } from '@/services/api/zones-repo';
import { useGame } from '@/store/game-store';
import { useZones } from '@/store/zones-store';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { InfluenceBar } from './game-motion';
import { useResource } from './use-resource';

const EVENT_TEXT: Record<ZoneEventType, (f: string, from: string | null) => string> = {
  captured: (f, from) => (from ? `${f} tomaram a zona dos ${from}` : `${f} conquistaram a zona`),
  under_attack: (f) => `${f} começaram um ataque`,
  defended: (f) => `${f} defenderam a zona`,
  neutralized: (_f, from) => `Zona ficou neutra${from ? ` (era dos ${from})` : ''}`,
  shield_up: (f) => `Escudo dos ${f} subiu`,
  shield_down: (f) => `Escudo dos ${f} caiu`,
};

const teamName = (f: FactionId | null) => (f ? factions[f].name : 'Rivais');

export function eventText(e: ZoneDetail['events'][number]): string {
  const fn = EVENT_TEXT[e.type];
  return fn ? fn(teamName(e.faction), e.from ? factions[e.from].name : null) : 'Atualização da zona';
}

function timeAgo(at: number, now: number): string {
  const min = Math.max(0, Math.round((now - at) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

/** Zone detail as a native form sheet (expo-router skill): owner, influence, shield, attack countdown. */
export function ZoneSheet() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cached = useZones((s) => (id ? s.zones[id] : undefined));
  const cachedName = useZones((s) => (id ? s.meta[id]?.name : null));
  const faction = useGame((s) => s.faction) ?? 'striders';
  const now = useNow(30_000);
  const {
    data: detail,
    error,
    loading,
    reload: load,
  } = useResource(async () => {
    const res = await fetchZoneDetail(String(id));
    if (res.ok) useZones.getState().upsertZones({ [res.data.zone.id]: res.data.zone }, { [res.data.zone.id]: res.data.meta });
    return res;
  }, [id]);

  // Realtime: a troca de dono que chega no store aparece aqui sem recarregar a folha.
  const zone: Zone | undefined = cached ?? detail?.zone;
  const name = detail?.meta.name ?? cachedName ?? (id ? zoneName(id) : '');

  if (!zone) {
    if (loading) {
      return (
        <View
          testID="zona-carregando"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[8], backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.surface }}>
          <ActivityIndicator color={colors.action} />
        </View>
      );
    }
    if (error && error.code !== 'NOT_FOUND') {
      return (
        <EmptyState
          title={error.code === 'NETWORK' ? 'Sem internet' : 'Não foi possível abrir a zona'}
          body={error.code === 'NETWORK' ? 'Confira a conexão e tente de novo. O mapa continua mostrando o último estado salvo.' : error.message}
          action={<Button testID="zona-tentar" label="Tentar de novo" kind="secondary" onPress={load} />}
        />
      );
    }
    return (
      <View testID="zona-vazia" style={{ flex: 1, backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.surface }}>
        <EmptyState
          title="Zona sem dados"
          body="Ninguém correu aqui ainda. A primeira corrida pinta esta zona com a cor do seu time."
          action={
            <Button
              testID="zona-vazia-correr"
              label="Correr aqui"
              icon="play"
              onPress={() => {
                router.back();
                router.push('/corrida');
              }}
            />
          }
        />
      </View>
    );
  }

  const attackLeftMs = zone.attackStartedAt ? Math.max(0, zone.attackStartedAt + DEFENSE_WINDOW_MS - now) : 0;
  const hours = Math.floor(attackLeftMs / 3_600_000);
  const minutes = Math.floor((attackLeftMs % 3_600_000) / 60_000);
  const ranked = FACTION_IDS.filter((f) => zone.influence[f] > 0).sort((a, b) => zone.influence[b] - zone.influence[a]);
  const isMine = zone.owner === faction;
  const attackExpired = zone.attackStartedAt !== null && attackLeftMs === 0;

  const cta = (
    <Button
      testID="zona-correr"
      label={isMine ? (zone.attackStartedAt && !attackExpired ? 'Defender esta zona' : 'Reforçar esta zona') : 'Correr aqui'}
      icon="play"
      size="lg"
      wide
      onPress={() => {
        router.back();
        router.push('/corrida');
      }}
    />
  );

  // Folha nos detents 0,55 e 0,9: o essencial (dono, ataque e o botão) cabe na altura menor; os detalhes rolam abaixo.
  return (
    <ScrollView
      testID="tela-zona"
      style={{ flex: 1, backgroundColor: process.env.EXPO_OS === 'ios' ? 'transparent' : colors.surface }}
      contentContainerStyle={{ padding: space[6], paddingBottom: space[12], gap: space[4] }}>
      <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'center' }}>
        <TeamBadge faction={zone.owner} attack={!!zone.attackStartedAt} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <RevealText variant="title" header testID="zona-nome">
            {name}
          </RevealText>
          <FadeUp delay={120}>
            <Text muted>{zone.owner ? `Território dos ${factions[zone.owner].name}` : 'Zona neutra'}</Text>
          </FadeUp>
        </View>
      </View>

      {zone.attackStartedAt && !attackExpired ? (
        <FadeUp delay={160}>
          <View testID="zona-ataque" style={{ padding: space[4], borderRadius: radius.md, backgroundColor: colors.action, gap: 2 }}>
            <Text variant="bodyBold" color={colors.onAction}>
              Sob ataque dos {zone.attacker ? factions[zone.attacker].name : 'rivais'}
            </Text>
            <Text variant="small" color={colors.onAction}>
              Faltam {hours} h {minutes} min para o fim da defesa. Corridas do time dono valem pontos em dobro.
            </Text>
            {zone.owner && zone.attacker ? (
              <Text variant="small" color={colors.onAction} tabular>
                {factions[zone.owner].name} {Math.round(zone.influence[zone.owner]).toLocaleString('pt-BR')} × {Math.round(zone.influence[zone.attacker]).toLocaleString('pt-BR')}{' '}
                {factions[zone.attacker].name}
              </Text>
            ) : null}
          </View>
        </FadeUp>
      ) : null}

      {attackExpired ? (
        <Text variant="small" muted testID="zona-prazo-encerrado">
          O prazo de defesa de 24 h já terminou. Esta é a situação atual da zona.
        </Text>
      ) : null}

      {cta}

      <View style={{ gap: space[2], marginTop: space[2] }}>
        <Text variant="caption" muted>
          Influência por time
        </Text>
        <InfluenceBar influence={zone.influence} height={12} delay={200} />
        <Stagger delay={240} gap={space[2]}>
          {ranked.map((f) => (
            <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 24 }}>
              <TeamBadge faction={f} size={20} />
              <Text style={{ flex: 1 }}>{factions[f].name}</Text>
              <CountUp
                value={Math.round(zone.influence[f])}
                variant="bodyBold"
                delay={300}
                accessibilityLabel={`${factions[f].name}: ${Math.round(zone.influence[f]).toLocaleString('pt-BR')} de influência`}
              />
            </View>
          ))}
        </Stagger>
      </View>

      {zone.owner ? (
        <Text variant="small" muted>
          Escudo nível {zone.shield}: rivais ganham {Math.round(SHIELD_REDUCTION[Math.min(zone.shield, 3)] * 100)}% menos pontos aqui.
        </Text>
      ) : null}

      {detail && detail.topRunners.length > 0 ? (
        <View style={{ gap: space[2] }} testID="zona-corredores">
          <Text variant="caption" muted>
            Maiores corredores da temporada
          </Text>
          <Stagger delay={300} gap={space[2]}>
            {detail.topRunners.map((r, i) => (
              <View key={`${r.username}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 24 }}>
                <Text variant="bodyBold" tabular style={{ width: 20 }}>
                  {i + 1}
                </Text>
                <TeamBadge faction={r.faction} size={20} />
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {r.username}
                </Text>
                <CountUp value={r.rp} variant="bodyBold" unit="RP" delay={360} accessibilityLabel={`${r.username}: ${r.rp.toLocaleString('pt-BR')} RP`} />
              </View>
            ))}
          </Stagger>
        </View>
      ) : null}

      {detail && detail.events.length > 0 ? (
        <View style={{ gap: space[2] }} testID="zona-eventos">
          <Text variant="caption" muted>
            Últimos acontecimentos
          </Text>
          <Stagger delay={340} gap={space[2]}>
            {detail.events.slice(0, 5).map((e, i) => (
              <View key={`${e.at}-${i}`} style={{ flexDirection: 'row', gap: space[2] }}>
                <Text variant="small" style={{ flex: 1 }}>
                  {eventText(e)}
                </Text>
                <Text variant="small" muted>
                  {timeAgo(e.at, now)}
                </Text>
              </View>
            ))}
          </Stagger>
        </View>
      ) : null}

      {error && error.code === 'NETWORK' ? (
        <Text variant="small" muted testID="zona-offline">
          Sem internet: mostrando os últimos dados salvos desta zona.
        </Text>
      ) : null}
    </ScrollView>
  );
}
