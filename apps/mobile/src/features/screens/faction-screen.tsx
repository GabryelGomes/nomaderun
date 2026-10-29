import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EmptyArt, Mascot } from '@/components/art';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon, type IconName } from '@/components/icon';
import { FadeUp, haptic, Pressable, Stagger } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader, Surface } from '@/components/surface';
import { TeamBadge } from '@/components/team-badge';
import { TEAM_STORY } from '@/components/team-identity';
import { Text } from '@/components/text';
import { factionChange } from '@/domain/season';
import { FACTION_IDS, type FactionId } from '@/domain/types';
import { ErrorNotice, InfoNotice } from '@/features/auth/form-ui';
import { chooseFaction } from '@/features/auth/session-controller';
import { useNow } from '@/features/use-now';
import { useSession } from '@/store/session-store';
import { neon, neonTeam } from '@/theme/neon';
import { factions, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * RF-003: trocar de facção depois do onboarding. O servidor (`choose_faction`) permite uma troca por
 * temporada, zera a contribuição da temporada e tira o corredor da crew; a tela avisa tudo isso antes.
 */
export function FactionScreen() {
  const { colors } = useTheme();
  const profile = useSession((s) => s.profile);
  const now = useNow(60_000);
  const [choice, setChoice] = useState<FactionId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<FactionId | null>(null);

  const current = profile?.faction ?? null;
  const rule = factionChange({ faction: current, factionChangedSeason: profile?.factionChangedSeason ?? null }, new Date(now));
  const others = FACTION_IDS.filter((f) => f !== current);

  const confirm = async () => {
    if (!choice) return;
    setSaving(true);
    setError(null);
    const res = await chooseFaction(choice);
    setSaving(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    haptic('success');
    setDone(choice);
    setChoice(null);
  };

  return (
    <ScreenScroll testID="tela-faccao" edges={[]} contentInsetAdjustmentBehavior="automatic" gap={space[6]}>
      <Stack.Screen options={{ title: 'Meu time', headerLargeTitleEnabled: false }} />
      <Stagger gap={space[6]}>
        {current ? (
          <Surface>
            {/* Herói: o mascote do time (E4) no lugar do selo; o líder e o lema em 2 linhas curtas. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
              <View aria-hidden importantForAccessibility="no-hide-descendants">
                <Mascot team={current} pose="parado" size={104} animated />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="caption" muted>
                  Seu time
                </Text>
                <Text variant="title" testID="faccao-atual">
                  {factions[current].name}
                </Text>
                <Text variant="small" muted>
                  {TEAM_STORY[current].mascot} · líder {TEAM_STORY[current].leader}
                </Text>
                <Text variant="small" color={neonTeam[current]}>
                  {factions[current].motto}
                </Text>
              </View>
            </View>
          </Surface>
        ) : (
          <EmptyState testID="faccao-sem-time" art={<EmptyArt kind="sem-crew" size={200} />} title="Sem time ainda" body="Escolha um abaixo." />
        )}

        {done ? (
          <FadeUp>
            <InfoNotice testID="faccao-trocada" title={`Agora você corre pelos ${factions[done].name}`} body="A próxima corrida já pinta nessa cor." />
          </FadeUp>
        ) : null}

        {!rule.allowed ? (
          <Surface>
            <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
              <Icon name="lock" size={20} color={colors.textSecondary} />
              <Text variant="bodyBold" style={{ flex: 1 }}>
                Troca usada nesta temporada
              </Text>
            </View>
            <Text variant="small" muted testID="faccao-bloqueada">
              Próxima troca em {rule.nextAt}.
            </Text>
          </Surface>
        ) : (
          <View style={{ gap: space[3] }}>
            <SectionHeader title="Trocar de time" />
            <Text variant="small" muted style={{ paddingHorizontal: space[1] }}>
              1 troca por temporada.
            </Text>
            {others.map((f) => {
              const on = choice === f;
              return (
                <Pressable
                  key={f}
                  testID={`faccao-opcao-${f}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${factions[f].name}, ${factions[f].motto}`}
                  hitSlop={0}
                  onPress={() => {
                    setChoice(on ? null : f);
                    setError(null);
                    haptic('selection');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[4],
                    padding: space[4],
                    minHeight: 44,
                    borderRadius: radius.lg,
                    borderCurve: 'continuous',
                    backgroundColor: on ? neon.activeFill : colors.surface,
                    borderWidth: 1,
                    borderColor: on ? neonTeam[f] : colors.line,
                    boxShadow: on ? `0 0 22px ${neonTeam[f]}55` : undefined,
                  }}>
                  <TeamBadge faction={f} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyBold">{factions[f].name}</Text>
                    <Text variant="small" muted>
                      {factions[f].motto}
                    </Text>
                  </View>
                  {on ? <Icon name="check" size={22} color={neonTeam[f]} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {choice && rule.allowed ? (
          <FadeUp>
            <Surface>
              <Text variant="bodyBold">Ao trocar:</Text>
              {/* As 3 consequências obrigatórias, curtas e com ícone; o leitor de tela ouve a frase completa. */}
              <View style={{ gap: space[2] }}>
                <Consequence icon="territory" text="Pontos da temporada zeram" a11y="Seus pontos de território desta temporada voltam a zero." />
                <Consequence icon="club" text="Você sai da sua crew" a11y="Você sai da sua crew, se estiver em uma." />
                <Consequence icon="lock" text="Nova troca só na próxima temporada" a11y="Só dá para trocar de novo na próxima temporada." />
              </View>
              <Button testID="faccao-confirmar" label={saving ? 'Trocando…' : `Trocar para ${factions[choice].name}`} wide disabled={saving} onPress={confirm} />
              <Button testID="faccao-cancelar" label="Cancelar" kind="ghost" wide disabled={saving} onPress={() => setChoice(null)} />
              <ErrorNotice message={error} testID="faccao-erro" />
            </Surface>
          </FadeUp>
        ) : null}
      </Stagger>
    </ScreenScroll>
  );
}

function Consequence({ icon, text, a11y }: { icon: IconName; text: string; a11y: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={a11y} style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
      <Icon name={icon} size={18} color={colors.textSecondary} />
      <Text variant="small" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
