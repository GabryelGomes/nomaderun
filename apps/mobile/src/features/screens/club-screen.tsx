import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SectionHeader, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { ProgressBar } from '@/components/territory-bar';
import { CITY_MIN_ACTIVE_RUNNERS } from '@/domain/games';
import { DEMO_CREW, demoCityWar } from '@/demo/demo-data';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export function ClubScreen() {
  const { colors } = useTheme();
  const [going, setGoing] = useState(false);
  const war = demoCityWar();

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[12] }}>
      <Surface>
        <Text variant="caption" muted>
          Sua Crew
        </Text>
        <Text variant="headline">{DEMO_CREW.name}</Text>
        <Text muted>
          {DEMO_CREW.members} corredores. Meta da semana: {DEMO_CREW.weeklyKm} de {DEMO_CREW.weeklyGoalKm} km.
        </Text>
        <ProgressBar value={DEMO_CREW.weeklyKm / DEMO_CREW.weeklyGoalKm} color={colors.text} height={10} />
      </Surface>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Próximo encontro" />
        <Surface>
          <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
            <Icon name="club" size={26} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold">{DEMO_CREW.nextMeetup.when}</Text>
              <Text variant="small" muted>
                {DEMO_CREW.nextMeetup.where}
              </Text>
            </View>
          </View>
          <Text variant="small" muted>
            {DEMO_CREW.nextMeetup.going + (going ? 1 : 0)} confirmados. Correr junto vale pontos ×1,25 para todos.
          </Text>
          <Button label={going ? 'Presença confirmada' : 'Confirmar presença'} icon={going ? 'check' : undefined} kind={going ? 'secondary' : 'primary'} onPress={() => setGoing((g) => !g)} />
        </Surface>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionHeader title="Guerra de Cidades" />
        <Text muted>
          Pontos da temporada divididos pela raiz do número de corredores ativos, para cidades pequenas competirem com capitais.
        </Text>
        <Surface>
          {war.map((c, i) => (
            <View key={c.city} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 4 }}>
              <Text variant="bodyBold" tabular style={{ width: 24 }}>
                {c.score === null ? '-' : i + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant={c.city === 'Goiânia' ? 'bodyBold' : 'body'}>{c.city}</Text>
                <Text variant="caption" muted>
                  {c.score === null ? `Precisa de ${CITY_MIN_ACTIVE_RUNNERS} corredores ativos` : `${c.runners.toLocaleString('pt-BR')} corredores`}
                </Text>
              </View>
              <Text variant="bodyBold" tabular>
                {c.score === null ? '' : Math.round(c.score).toLocaleString('pt-BR')}
              </Text>
            </View>
          ))}
        </Surface>
        <Text variant="caption" muted>
          Placar de demonstração.
        </Text>
      </View>
    </ScrollView>
  );
}
