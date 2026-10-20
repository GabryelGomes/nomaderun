import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { TeamBadge } from '@/components/team-badge';
import { Icon, type IconName } from '@/components/icon';
import { SectionHeader, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { ProgressBar } from '@/components/territory-bar';
import { LEAGUE_DIVISIONS, leagueOutcome } from '@/domain/games';
import { DEMO_RAID, demoLeague } from '@/demo/demo-data';
import { useGame, type MissionId } from '@/store/game-store';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Mode = { id: string; title: string; body: string; icon: IconName; kind: 'sempre' | MissionId | 'evento'; status?: string };

const MODES: Mode[] = [
  { id: 'dominio', title: 'Domínio', body: 'Cada metro pinta a zona com a cor do seu time. Zonas são atacadas, defendidas e fortificadas.', icon: 'territory', kind: 'sempre' },
  { id: 'neblina', title: 'Neblina', body: 'A cidade começa coberta. Cada rua por onde você passa fica revelada para sempre.', icon: 'fog', kind: 'sempre' },
  { id: 'raid', title: 'Raid', body: 'Um chefão contra a cidade inteira por 48 horas. Todo quilômetro causa dano.', icon: 'raid', kind: 'sempre' },
  { id: 'fuga', title: 'Fuga', body: 'Um fantasma corre no seu encalço. Termine à frente e ganhe pontos ×1,5.', icon: 'ghost', kind: 'fuga' },
  { id: 'caca', title: 'Caça', body: 'Baús escondidos em ruas e parques. Os lendários ficam longe.', icon: 'chest', kind: 'caca' },
  { id: 'rabisco', title: 'Rabisco', body: 'Desenhe a forma da semana com o seu percurso e receba uma nota de 0 a 100.', icon: 'brush', kind: 'evento', status: 'Chega na v1.0' },
  { id: 'bandeira', title: 'Bandeira', body: 'Capture a bandeira do time rival no bairro, ao vivo, em eventos de clube.', icon: 'flag', kind: 'evento', status: 'Eventos de clube na v2' },
];

/** The Arena (Product Book §3): passive layers, missions and events. Every run counts. */
export function ArenaScreen() {
  const { colors } = useTheme();
  const setMission = useGame((s) => s.setMission);
  const name = useGame((s) => s.name);
  const faction = useGame((s) => s.faction) ?? 'striders';
  const xp = useGame((s) => s.xp);
  const league = demoLeague({ name, faction, xp });
  const me = league.find((r) => r.you)!;
  const division = 1;
  const outcome = leagueOutcome(me.rank, league.length, division);
  const window = league.filter((r) => Math.abs(r.rank - me.rank) <= 2 || r.rank <= 3);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12] }}>
      <Surface>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Icon name="raid" size={28} color={colors.text} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" muted>
              Raid da cidade, termina em {DEMO_RAID.endsInHours} h
            </Text>
            <Text variant="title">{DEMO_RAID.boss}</Text>
          </View>
        </View>
        <ProgressBar value={DEMO_RAID.damageKm / DEMO_RAID.hpKm} color={colors.text} height={12} />
        <Text variant="small" muted tabular>
          Goiânia já causou {DEMO_RAID.damageKm.toLocaleString('pt-BR')} de {DEMO_RAID.hpKm.toLocaleString('pt-BR')} km de dano. Sua próxima corrida conta.
        </Text>
        <Text variant="caption" muted>
          Raid de demonstração.
        </Text>
      </Surface>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Modos de jogo" />
        <Text muted>Domínio, Neblina e Raid valem em toda corrida. Fuga e Caça você escolhe antes de sair.</Text>
        {MODES.map((m) => {
          const playable = m.kind === 'fuga' || m.kind === 'caca';
          return (
            <Pressable
              key={m.title}
              testID={`arena-modo-${m.id}`}
              disabled={!playable}
              accessibilityRole={playable ? 'button' : 'summary'}
              accessibilityLabel={`${m.title}. ${m.body}${playable ? ' Toque para correr com este modo.' : ''}`}
              onPress={() => {
                setMission(m.kind as MissionId);
                router.push('/corrida');
              }}
              style={{ flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: colors.surface, opacity: m.kind === 'evento' ? 0.72 : 1 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: playable ? colors.action : colors.surfaceSunken }}>
                <Icon name={m.icon} size={22} color={playable ? colors.onAction : colors.text} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <Text variant="bodyBold">{m.title}</Text>
                  <Text variant="caption" muted>
                    {m.kind === 'sempre' ? 'Em toda corrida' : playable ? 'Missão' : m.status}
                  </Text>
                </View>
                <Text variant="small" muted>
                  {m.body}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Liga do Bairro" />
        <Text muted>
          Divisão {LEAGUE_DIVISIONS[division]}. Grupo de {league.length} corredores com volume parecido com o seu. Os 5 primeiros sobem.
        </Text>
        <Surface>
          {window.map((r) => (
            <View key={r.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 4 }}>
              <Text variant="bodyBold" tabular style={{ width: 28 }}>
                {r.rank}
              </Text>
              <TeamBadge faction={r.faction} size={22} />
              <Text style={{ flex: 1 }} variant={r.you ? 'bodyBold' : 'body'}>
                {r.you ? `${r.name} (você)` : r.name}
              </Text>
              <Text tabular muted={!r.you}>
                {r.points}
              </Text>
            </View>
          ))}
          <Text variant="small" muted>
            {outcome === 'promoted' ? 'Você está na zona de subida.' : outcome === 'relegated' ? 'Você está na zona de queda. Duas corridas esta semana mudam isso.' : 'Você está no meio da tabela. Faltam poucos pontos para a zona de subida.'}
          </Text>
        </Surface>
        <Text variant="caption" muted>
          Ranking de demonstração. Seu time: {factions[faction].name}.
        </Text>
      </View>

      <Button testID="arena-correr" label="Correr agora" icon="play" size="lg" wide onPress={() => router.push('/corrida')} />
    </ScrollView>
  );
}
