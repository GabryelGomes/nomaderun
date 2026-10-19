import { ScrollView, Switch, View } from 'react-native';

import { TeamBadge } from '@/components/team-badge';
import { Icon } from '@/components/icon';
import { SectionHeader, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { ProgressBar } from '@/components/territory-bar';
import { levelFromXp } from '@/domain/games';
import { trustLevel } from '@/domain/trust';
import { useGame } from '@/store/game-store';
import { factions, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const ACHIEVEMENTS = [
  { title: 'Primeiros passos', body: 'Termine uma corrida', done: (runs: number) => runs >= 1 },
  { title: 'Primeira zona', body: 'Conquiste uma zona', done: (_: number, zones: number) => zones >= 1 },
  { title: 'Explorador', body: 'Revele 100 células da neblina', done: (_: number, __: number, fog: number) => fog >= 100 },
];

export function ProfileScreen() {
  const { colors } = useTheme();
  const s = useGame();
  const faction = s.faction ?? 'striders';
  const lvl = levelFromXp(s.xp);
  const conquered = s.history.reduce((n, h) => n + h.result.zones.filter((z) => z.outcome === 'conquered').length, 0);
  const trust = trustLevel(s.trust);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12] }}>
      <Surface>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
          <TeamBadge faction={faction} size={64} />
          <View style={{ flex: 1 }}>
            <Text variant="headline">{s.name}</Text>
            <Text muted>
              {factions[faction].name}, nível {lvl.level}
            </Text>
          </View>
        </View>
        <ProgressBar value={lvl.intoLevel / lvl.needed} color={factions[faction].color} />
        <Text variant="small" muted tabular>
          {lvl.intoLevel} de {lvl.needed} XP para o nível {lvl.level + 1}. Cada nível libera uma cor de rastro ou moldura.
        </Text>
      </Surface>

      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Surface style={{ flex: 1 }}>
          <Icon name="fog" size={22} color={colors.text} />
          <Text variant="headline" tabular>
            {s.fog.length}
          </Text>
          <Text variant="small" muted>
            células reveladas
          </Text>
        </Surface>
        <Surface style={{ flex: 1 }}>
          <Icon name="territory" size={22} color={colors.text} />
          <Text variant="headline" tabular>
            {conquered}
          </Text>
          <Text variant="small" muted>
            zonas conquistadas
          </Text>
        </Surface>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Conquistas" />
        <Surface>
          {ACHIEVEMENTS.map((a) => {
            const done = a.done(s.history.length, conquered, s.fog.length);
            return (
              <View key={a.title} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? colors.action : colors.surfaceSunken }}>
                  <Icon name={done ? 'check' : 'lock'} size={16} color={done ? colors.onAction : colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyBold">{a.title}</Text>
                  <Text variant="small" muted>
                    {a.body}
                  </Text>
                </View>
              </View>
            );
          })}
        </Surface>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Corrida Segura" />
        <Surface>
          <Row title="Escolta ao vivo" body={`${s.contacts.join(' e ')} veem sua localização durante a corrida.`} value={s.escortOn} onChange={s.toggleEscort} />
          <Row title="Alerta de parada" body="Se você ficar parado por 10 minutos, perguntamos se está tudo bem e avisamos seus contatos." value={s.stopAlertOn} onChange={s.toggleStopAlert} />
          <Text variant="small" muted>
            Seu início e fim de corrida perto de casa ficam escondidos dos outros corredores.
          </Text>
        </Surface>
      </View>

      <Surface>
        <Text variant="bodyBold">Índice de confiança: {s.trust}</Text>
        <Text variant="small" muted>
          {trust === 'ok'
            ? 'Suas corridas contam normalmente.'
            : trust === 'review'
              ? 'Suas próximas corridas passam por revisão antes de pontuar.'
              : 'Sua participação na competição está suspensa por 30 dias.'}
        </Text>
      </Surface>
    </ScrollView>
  );
}

function Row({ title, body, value, onChange }: { title: string; body: string; value: boolean; onChange: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold">{title}</Text>
        <Text variant="small" muted>
          {body}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={title} />
    </View>
  );
}
