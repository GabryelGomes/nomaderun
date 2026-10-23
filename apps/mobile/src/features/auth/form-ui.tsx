import { Link, type Href } from 'expo-router';
import { useState, type ReactNode, type Ref } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Pressable as PressableScale } from '@/components/motion';
import { ScreenScroll, type Edge, type ScreenScrollProps } from '@/components/screen';
import { Text } from '@/components/text';
import { fonts, palette, radius, space } from '@/theme/tokens';
import { neon } from '@/theme/neon';
import { useTheme } from '@/theme/use-theme';

/**
 * Peças das telas de conta, copiadas do padrão do onboarding (D-15): mesmo campo de texto
 * (52 pt, raio md, fundo surface, Inter 17), mesmos espaçamentos e tipografia.
 */

/**
 * Contêiner das telas de conta (T6.2, D-54): `ScreenScroll` com área segura, teclado tratado (toques
 * passam com o teclado aberto; no iOS o conteúdo sobe junto), margens de 24 pt do visual aprovado e CTA
 * fixo opcional (`footer`), cujo espaço fica reservado no fim do conteúdo.
 * - `modal`: tela apresentada como modal (termos, privacidade). No iOS é folha, sem área segura em cima;
 *   no Android/web é tela cheia e precisa dela.
 * - `nativeHeader`: tela com cabeçalho nativo (contatos, zonas de privacidade): só a área segura de baixo.
 */
export function FormScaffold({
  children,
  testID,
  modal,
  nativeHeader,
  footer,
  footerProps,
  background,
}: {
  children: ReactNode;
  testID?: string;
  modal?: boolean;
  nativeHeader?: boolean;
  footer?: ReactNode;
  footerProps?: ScreenScrollProps['footerProps'];
  /** Fundo próprio atrás do conteúdo (ex.: `NeonBackdrop`). */
  background?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const sheet = nativeHeader || (modal && process.env.EXPO_OS === 'ios');
  const edges: Edge[] = sheet ? ['bottom'] : ['top', 'bottom'];
  return (
    <ScreenScroll
      testID={testID}
      edges={edges}
      footer={footer}
      footerProps={footerProps}
      background={background}
      gap={space[6]}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space[6], paddingTop: (sheet ? 0 : insets.top) + (nativeHeader ? space[4] : space[6]) }}>
      {children}
    </ScreenScroll>
  );
}

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | null;
  help?: ReactNode;
  testID: string;
  /** Campo de senha com botão "mostrar". */
  secret?: boolean;
  /** Referência do campo, para encadear o "próximo" do teclado. */
  inputRef?: Ref<TextInput>;
  /** Campo dentro de um card (fundo `surface`): usa o fundo da tela para continuar visível. */
  onSurface?: boolean;
};

export function TextField({ label, error, help, testID, secret, inputRef, onSurface, ...input }: TextFieldProps) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="caption" muted nativeID={`${testID}-label`}>
        {label}
      </Text>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          {...input}
          ref={inputRef}
          testID={testID}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${testID}-label`}
          accessibilityHint={error ?? undefined}
          secureTextEntry={secret ? hidden : input.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          placeholderTextColor={colors.textSecondary}
          style={{
            height: 52,
            borderRadius: radius.md,
            paddingHorizontal: space[4],
            paddingRight: secret ? 56 : space[4],
            backgroundColor: onSurface ? colors.background : colors.surface,
            color: colors.text,
            fontFamily: fonts.text,
            fontSize: 17,
            // Foco com borda e brilho na cor de ação (D-58): indicador de foco visível em todos os formulários.
            borderWidth: error || focused ? 1 : 0,
            borderColor: error ? colors.danger : focused ? colors.action : 'transparent',
            boxShadow: focused && !error ? neon.focusGlow : undefined,
            // Sem o contorno padrão do navegador por cima da borda de foco (web).
            outlineWidth: 0,
          }}
        />
        {secret ? (
          <Pressable
            testID={`${testID}-mostrar`}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Esconder senha'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={4}
            style={{ position: 'absolute', right: 4, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="small" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : help ? (
        typeof help === 'string' ? (
          <Text variant="small" muted>
            {help}
          </Text>
        ) : (
          help
        )
      ) : null}
    </View>
  );
}

/** Mensagem de erro do servidor/rede, anunciada pelo leitor de tela. */
export function ErrorNotice({ message, testID = 'erro-formulario' }: { message: string | null | undefined; testID?: string }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start', padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger }}>
      <Icon name="warning" size={20} color={colors.danger} />
      <Text style={{ flex: 1 }}>{message}</Text>
    </View>
  );
}

/** Mensagem de sucesso/informação no mesmo formato. */
export function InfoNotice({ title, body, testID }: { title: string; body: string; testID: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} accessible accessibilityLiveRegion="polite" style={{ gap: space[2], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
        <Icon name="check" size={20} color={colors.action} />
        <Text variant="bodyBold">{title}</Text>
      </View>
      <Text muted>{body}</Text>
    </View>
  );
}

/** Caixa de aceite com área de toque ≥ 44 pt; o texto pode ter links. */
export function CheckRow({
  checked,
  onChange,
  label,
  children,
  error,
  testID,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  children: ReactNode;
  error?: string | null;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space[1] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <PressableScale
          testID={testID}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={label}
          onPress={() => onChange(!checked)}
          hitSlop={0}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: radius.sm,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: checked ? colors.action : colors.surface,
              borderWidth: checked ? 0 : 2,
              borderColor: error ? colors.danger : colors.line,
            }}>
            {checked ? <Icon name="check" size={16} color={colors.onAction} /> : null}
          </View>
        </PressableScale>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
      {error ? (
        <Text variant="small" color={colors.danger} style={{ paddingLeft: 44 + space[3] }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Link de texto na cor de destaque (contraste AA), alvo de toque ≥ 44 pt. */
export function TextLink({ href, label, testID, onPress }: { href?: Href; label: string; testID: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const content = (
    <PressableScale
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      containerStyle={{ alignSelf: 'center' }}
      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[2] }}>
      <Text variant="bodyBold" color={colors.accentText}>
        {label}
      </Text>
    </PressableScale>
  );
  return href ? (
    <Link href={href} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}

/** Barra de força da senha: três segmentos, rotulada para o leitor de tela. */
export function StrengthMeter({ level, label, hint }: { level: 0 | 1 | 2 | 3; label: string; hint: string }) {
  const { colors } = useTheme();
  const color = level >= 3 ? palette.success : level === 2 ? colors.action : colors.danger;
  return (
    <View accessible accessibilityLabel={`Força da senha: ${label || 'vazia'}. ${hint}`} style={{ gap: space[1] }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: level >= i ? color : colors.surfaceSunken }} />
        ))}
      </View>
      <Text variant="small" muted>
        {label ? `${label}. ` : ''}
        {hint}
      </Text>
    </View>
  );
}
