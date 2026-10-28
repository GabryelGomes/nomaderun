import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { FadeUp, haptic, Pressable, Stagger } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader, Surface } from '@/components/surface';
import { TeamBadge } from '@/components/team-badge';
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
            <Text variant="caption" muted>
              Seu time agora
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
              <TeamBadge faction={current} size={52} />
              <View style={{ flex: 1 }}>
                <Text variant="title" testID="faccao-atual">
                  {factions[current].name}
                </Text>
                <Text variant="small" muted>
                  {factions[current].motto}
                </Text>
              </View>
            </View>
          </Surface>
        ) : null}

        {done ? (
          <FadeUp>
            <InfoNotice testID="faccao-trocada" title={`Agora você corre pelos ${factions[done].name}`} body="Sua próxima corrida já pinta a cidade com a cor do novo time." />
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
              Você já trocou de time este mês. A próxima troca fica liberada em {rule.nextAt}, quando a nova temporada começa.
            </Text>
          </Surface>
        ) : (
          <View style={{ gap: space[3] }}>
            <SectionHeader title="Trocar de time" />
            <Text variant="small" muted style={{ paddingHorizontal: space[1] }}>
              Você pode trocar uma vez por temporada. Escolha o novo time:
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
              <Text variant="bodyBold">Antes de trocar para {factions[choice].name}</Text>
              <View style={{ gap: space[2] }}>
                <Consequence text="Seus pontos de território desta temporada voltam a zero." />
                <Consequence text="Você sai da sua crew, se estiver em uma." />
                <Consequence text="Só dá para trocar de novo na próxima temporada." />
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

function Consequence({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
      <Icon name="warning" size={16} color={colors.textSecondary} />
      <Text variant="small" muted style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
