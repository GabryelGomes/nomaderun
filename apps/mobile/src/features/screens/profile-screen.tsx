import { router, type Href } from 'expo-router';
import { Switch, View } from 'react-native';

import { TeamBadge } from '@/components/team-badge';
import { Icon } from '@/components/icon';
import { CountUp, FadeUp, Pressable, RevealText, Stagger } from '@/components/motion';
import { ScreenScroll } from '@/components/screen';
import { SectionHeader, Surface } from '@/components/surface';
import { Text } from '@/components/text';
import { ProgressBar } from '@/components/territory-bar';
import { levelFromXp } from '@/domain/games';
import { trustLevel } from '@/domain/trust';
import { signOut } from '@/features/auth/session-controller';
import { canModerate } from '@/features/moderation/guard';
import { useGame } from '@/store/game-store';
import { selectUnreadCount, useNotifications } from '@/store/notifications-store';
import { useSession } from '@/store/session-store';
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
  // Histórico oficial do servidor (A4 mantém `serverRuns` no game-store).
  const runs = s.serverRuns.length;
  const conquered = s.serverRuns.reduce((n, r) => n + (r.result?.zones ?? []).filter((z) => z.outcome === 'conquered').length, 0);
  const trust = trustLevel(s.trust);
  const unread = useNotifications(selectUnreadCount);
  const staff = useSession((x) => canModerate(x.profile?.role));

  return (
    <ScreenScroll testID="tela-perfil" edges={[]} contentInsetAdjustmentBehavior="automatic" gap={space[6]}>
      <Surface>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
          <TeamBadge faction={faction} size={64} />
          <View style={{ flex: 1 }}>
            {/* Momento herói do perfil: o nome sobe de dentro da máscara (D-54). */}
            <RevealText testID="perfil-nome">{s.name || 'Corredor'}</RevealText>
            <FadeUp delay={150}>
              <Text muted>
                {factions[faction].name}, nível {lvl.level}
              </Text>
            </FadeUp>
          </View>
        </View>
        <ProgressBar value={lvl.intoLevel / lvl.needed} color={factions[faction].color} />
        <View>
          <CountUp
            testID="perfil-xp"
            value={lvl.intoLevel}
            delay={250}
            variant="small"
            muted
            format={(n) => `${Math.round(n).toLocaleString('pt-BR')} de ${lvl.needed.toLocaleString('pt-BR')} XP para o nível ${lvl.level + 1}.`}
            accessibilityLabel={`${lvl.intoLevel} de ${lvl.needed} XP para o nível ${lvl.level + 1}.`}
          />
          <Text variant="small" muted>
            Cada nível libera uma cor de rastro ou moldura.
          </Text>
        </View>
      </Surface>

      <Stagger delay={150} style={{ flexDirection: 'row', gap: space[3] }} itemStyle={{ flex: 1 }}>
        <Surface style={{ flex: 1 }}>
          <Icon name="fog" size={22} color={colors.text} />
          <CountUp testID="perfil-celulas" value={s.fog.length} delay={250} variant="headline" accessibilityLabel={`${s.fog.length} células reveladas`} />
          <Text variant="small" muted>
            células reveladas
          </Text>
        </Surface>
        <Surface style={{ flex: 1 }}>
          <Icon name="territory" size={22} color={colors.text} />
          <CountUp testID="perfil-zonas" value={conquered} delay={300} variant="headline" accessibilityLabel={`${conquered} zonas conquistadas`} />
          <Text variant="small" muted>
            zonas conquistadas
          </Text>
        </Surface>
      </Stagger>
      <Stagger delay={250} gap={space[6]}>

        <View style={{ gap: space[3] }}>
          <SectionHeader title="Conquistas" />
          <Surface>
            {ACHIEVEMENTS.map((a) => {
              const done = a.done(runs, conquered, s.fog.length);
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
            <Row testID="perfil-escolta" title="Escolta ao vivo" body={s.contacts.length > 0 ? `${s.contacts.join(' e ')} veem sua localização durante a corrida.` : 'Cadastre contatos de segurança para eles verem sua localização durante a corrida.'} value={s.escortOn} onChange={s.toggleEscort} />
            <Row testID="perfil-alerta-parada" title="Alerta de parada" body="Se você ficar parado por 10 minutos, perguntamos se está tudo bem e avisamos seus contatos." value={s.stopAlertOn} onChange={s.toggleStopAlert} />
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

        <View style={{ gap: space[3] }}>
          <SectionHeader title="Conta" />
          <Surface>
            <LinkRow testID="perfil-editar" title="Editar perfil" body="Nome de usuário, foto, cidade, unidade e notificações." onPress={() => router.push('/perfil/editar')} />
            <LinkRow
              testID="perfil-notificacoes"
              title="Notificações"
              body={unread > 0 ? `${unread === 1 ? '1 não lida' : `${unread} não lidas`}. Invasões, conquistas e moderação.` : 'Invasões, conquistas e resultados da moderação.'}
              onPress={() => router.push('/notificacoes')}
            />
            <LinkRow testID="perfil-contatos-seguranca" title="Contatos de segurança" body="Até 5 pessoas avisadas pela Corrida Segura." onPress={() => router.push('/contatos-seguranca' as Href)} />
            <LinkRow
              testID="perfil-zonas-privacidade"
              title="Zonas de privacidade"
              body="Até 3 endereços que não aparecem no seu percurso para outras pessoas."
              onPress={() => router.push('/zonas-privacidade' as Href)}
            />
            {staff ? <LinkRow testID="perfil-moderacao" title="Painel de moderação" body="Corridas em revisão e contas." onPress={() => router.push('/moderacao')} /> : null}
            <LinkRow testID="perfil-conta" title="Conta e privacidade" body="Exportar seus dados, excluir a conta, termos." onPress={() => router.push('/perfil/conta')} />
            <LinkRow testID="perfil-sair" title="Sair" body="Desconectar deste aparelho." onPress={() => signOut()} />
          </Surface>
        </View>
      </Stagger>
    </ScreenScroll>
  );
}

function LinkRow({ title, body, onPress, testID }: { title: string; body: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} accessibilityLabel={title} hitSlop={0} onPress={onPress} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold">{title}</Text>
        <Text variant="small" muted>
          {body}
        </Text>
      </View>
      <Icon name="chevron" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function Row({ title, body, value, onChange, testID }: { title: string; body: string; value: boolean; onChange: () => void; testID: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyBold">{title}</Text>
        <Text variant="small" muted>
          {body}
        </Text>
      </View>
      <Switch testID={testID} value={value} onValueChange={onChange} accessibilityLabel={title} />
    </View>
  );
}
