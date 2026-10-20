import { Link, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { fonts, palette, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Peças das telas de conta, copiadas do padrão do onboarding (D-15): mesmo campo de texto
 * (52 pt, raio md, fundo surface, Inter 17), mesmos espaçamentos e tipografia.
 */

/** Mesmo contêiner do onboarding: rolagem, margens de 24 pt e espaço para o teclado. */
export function FormScaffold({ children, testID, modal }: { children: ReactNode; testID?: string; modal?: boolean }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        testID={testID}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: (modal ? 0 : insets.top) + space[8],
          paddingBottom: insets.bottom + space[6],
          paddingHorizontal: space[6],
          gap: space[6],
        }}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | null;
  help?: ReactNode;
  testID: string;
  /** Campo de senha com botão "mostrar". */
  secret?: boolean;
};

export function TextField({ label, error, help, testID, secret, ...input }: TextFieldProps) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="caption" muted nativeID={`${testID}-label`}>
        {label}
      </Text>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          {...input}
          testID={testID}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${testID}-label`}
          accessibilityHint={error ?? undefined}
          secureTextEntry={secret ? hidden : input.secureTextEntry}
          placeholderTextColor={colors.textSecondary}
          style={{
            height: 52,
            borderRadius: radius.md,
            paddingHorizontal: space[4],
            paddingRight: secret ? 56 : space[4],
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fonts.text,
            fontSize: 17,
            borderWidth: error ? 1 : 0,
            borderColor: error ? colors.danger : 'transparent',
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
        <Pressable
          testID={testID}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={label}
          onPress={() => onChange(!checked)}
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
        </Pressable>
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
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'center', paddingHorizontal: space[2] }}>
      <Text variant="bodyBold" color={colors.accentText}>
        {label}
      </Text>
    </Pressable>
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
