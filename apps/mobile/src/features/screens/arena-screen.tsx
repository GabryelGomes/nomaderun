import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { type IconName } from '@/components/icon';
import { ModeCard } from '@/components/mode-card';
import { Stagger, useParallax } from '@/components/motion';
import { Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { useGame, type MissionId } from '@/store/game-store';
import { space } from '@/theme/tokens';

import { SectionTitle } from './game-motion';

type Mode = { id: string; title: string; body: string; icon: IconName; kind: 'sempre' | MissionId | 'em-breve'; status?: string };

// E-18 e E-21 (honestidade): nada de "os lendários ficam longe" (o servidor sorteia a posição sem olhar a
// raridade) nem de Raid "em toda corrida" (nenhuma corrida causa dano ainda): o Raid fica "Em breve".
const MODES: Mode[] = [
  { id: 'dominio', title: 'Domínio', body: 'Cada metro pinta a zona com a cor do seu time.', icon: 'territory', kind: 'sempre' },
  { id: 'neblina', title: 'Neblina', body: 'Cada rua por onde você passa fica revelada no mapa.', icon: 'fog', kind: 'sempre' },
  { id: 'fuga', title: 'Fuga', body: 'Termine à frente do fantasma e ganhe pontos ×1,5.', icon: 'ghost', kind: 'fuga' },
  { id: 'caca', title: 'Caça', body: 'Baús escondidos pela cidade: passe a 25 m para abrir.', icon: 'chest', kind: 'caca' },
  { id: 'raid', title: 'Raid', body: 'Um chefão contra a cidade inteira.', icon: 'raid', kind: 'em-breve' },
  { id: 'rabisco', title: 'Rabisco', body: 'Desenhe a forma da semana com o seu percurso.', icon: 'brush', kind: 'em-breve' },
  { id: 'bandeira', title: 'Bandeira', body: 'Capture a bandeira rival em eventos de clube.', icon: 'flag', kind: 'em-breve' },
];

/**
 * A Arena: modos de jogo, Raid e Liga. D-76: em conta real, Raid e Liga mostram dado real ou estado vazio;
 * como o servidor ainda não tem os dois (E9, onda 1/2), aparecem vazios e marcados "Em breve" — sem número falso.
 * O modo demonstração (E10, onda 2) volta a mostrá-los cheios, com o selo de demonstração.
 */
export function ArenaScreen() {
  const setMission = useGame((s) => s.setMission);
  const [headerH, setHeaderH] = useState(200);
  // Parallax sutil (0,3): o card do raid anda mais devagar que a lista e esmaece; com reduzir movimento só esmaece.
  const parallax = useParallax(headerH, 0.3);

  return (
    <Animated.ScrollView
      testID="tela-arena"
      contentInsetAdjustmentBehavior="automatic"
      onScroll={parallax.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ padding: space[4], gap: space[8], paddingBottom: space[12] }}>
      <Animated.View style={parallax.headerStyle} onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}>
        <Surface>
          <EmptyState testID="arena-raid-vazio" icon="raid" tag="Em breve" title="O chefão ainda não chegou" body="Quando o Raid começar, cada quilômetro seu causa dano." compact />
        </Surface>
      </Animated.View>

      <View style={{ gap: space[3] }}>
        <SectionTitle title="Modos de jogo" />
        <Text muted>Domínio e Neblina contam em toda corrida. Fuga e Caça você escolhe antes de sair.</Text>
        <Stagger delay={150} gap={space[3]}>
          {MODES.map((m) => {
            const playable = m.kind === 'fuga' || m.kind === 'caca';
            return (
              <ModeCard
                key={m.id}
                testID={`arena-modo-${m.id}`}
                title={m.title}
                body={m.body}
                icon={m.icon}
                variant={m.kind === 'em-breve' ? 'soon' : playable ? 'play' : 'info'}
                tag={m.kind === 'sempre' ? 'Em toda corrida' : playable ? 'Escolha antes de sair' : undefined}
                onPress={
                  playable
                    ? () => {
                        setMission(m.kind as MissionId);
                        router.push('/corrida');
                      }
                    : undefined
                }
              />
            );
          })}
        </Stagger>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionTitle title="Liga do Bairro" />
        <Surface>
          <EmptyState testID="arena-liga-vazio" icon="trophy" tag="Em breve" title="A Liga ainda não começou" body="Você vai disputar com até 30 corredores de volume parecido." compact />
        </Surface>
      </View>

      <Button testID="arena-correr" label="Correr agora" icon="play" size="lg" wide onPress={() => router.push('/corrida')} />
    </Animated.ScrollView>
  );
}
