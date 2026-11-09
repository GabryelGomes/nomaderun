import { ActivityIndicator, Pressable, View } from 'react-native';

import { formatAgo } from '@/features/format';
import { useNow } from '@/features/use-now';
import { neon } from '@/theme/neon';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { Text } from './text';

export type OfflineNoticeProps = {
  testID: string;
  /**
   * Código do erro da carga (`AppError['code']`). `NETWORK` = sem internet; qualquer outro = servidor fora do ar.
   * Sem código, "Sem conexão".
   */
  code?: string | null;
  /** A tela continua mostrando dado salvo (perfil em cache, a última lista que chegou)? */
  hasData: boolean;
  /** Quando esse dado foi salvo (ms). `null`/ausente = sem hora conhecida ("Mostrando o último salvo"). */
  savedAt?: number | null;
  /** "Tentar de novo" (opcional): recarrega o que falhou. */
  onRetry?: () => void;
  busy?: boolean;
};

/** Título e frase do aviso (puro, testado): nunca culpa, sempre o que a tela está mostrando. */
export function offlineNoticeText({ code, hasData, savedAt }: Pick<OfflineNoticeProps, 'code' | 'hasData' | 'savedAt'>, now: number): { title: string; body: string } {
  const title = code === 'NETWORK' ? 'Sem internet' : code ? 'Servidor fora do ar' : 'Sem conexão';
  if (!hasData) return { title, body: 'Os números aparecem quando a conexão voltar.' };
  const ago = formatAgo(savedAt, now);
  return { title, body: ago ? `Mostrando o último salvo, ${ago}.` : 'Mostrando o último salvo.' };
}

/**
 * D-95: o único aviso de "sem conexão" do app (antes eram 5 padrões). Uma faixa baixa no topo do conteúdo: ícone,
 * o que houve, o que a tela está mostrando (com a hora do dado salvo) e, se der, "Tentar de novo". Os números da
 * tela sem dado viram "—" (nunca "0"); o esqueleto só aparece enquanto carrega, e some quando a carga falha.
 */
export function OfflineNotice({ testID, code, hasData, savedAt, onRetry, busy }: OfflineNoticeProps) {
  const { colors } = useTheme();
  const now = useNow(60_000);
  const { title, body } = offlineNoticeText({ code, hasData, savedAt }, now);
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingVertical: space[2],
        paddingLeft: space[3],
        paddingRight: onRetry ? space[1] : space[3],
        minHeight: 56,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.lineControl,
        backgroundColor: colors.surface,
      }}>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: neon.activeFill }}>
        <Icon name="offline" size={18} color={colors.accentText} />
      </View>
      <View accessible accessibilityLabel={`${title}. ${body}`} style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyBold" numberOfLines={1}>
          {title}
        </Text>
        <Text testID={`${testID}-detalhe`} variant="caption" muted>
          {body}
        </Text>
      </View>
      {onRetry ? (
        <Pressable
          testID={`${testID}-tentar`}
          accessibilityRole="button"
          accessibilityLabel="Tentar carregar de novo"
          accessibilityState={{ busy: !!busy, disabled: !!busy }}
          disabled={busy}
          onPress={onRetry}
          style={{ minHeight: 44, minWidth: 44, paddingHorizontal: space[3], alignItems: 'center', justifyContent: 'center' }}>
          {busy ? (
            <ActivityIndicator color={colors.action} />
          ) : (
            <Text variant="caption" color={colors.action}>
              Tentar de novo
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
