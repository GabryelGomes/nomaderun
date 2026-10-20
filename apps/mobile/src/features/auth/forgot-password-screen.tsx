import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import * as authRepo from '@/services/api/auth-repo';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { ErrorNotice, FormScaffold, InfoNotice, TextField, TextLink } from './form-ui';
import { validateEmail } from './validation';

/** Recuperar senha por e-mail (RF-001). O link volta para `nomaderun://nova-senha`. */
export function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const e = validateEmail(email);
    setFieldError(e);
    if (e) return;
    setBusy(true);
    setError(null);
    const res = await authRepo.sendPasswordReset(email, Linking.createURL('/nova-senha'));
    setBusy(false);
    if (!res.ok) setError(res.error.message);
    else setSent(true);
  };

  return (
    <FormScaffold testID="tela-recuperar-senha">
      <View style={{ gap: space[4] }}>
        <Icon name="mail" size={40} color={colors.text} />
        <Text variant="headline" accessibilityRole="header">
          Recuperar senha
        </Text>
        <Text muted>Digite o e-mail da sua conta. Enviamos um link para você criar uma senha nova.</Text>
      </View>

      {sent ? (
        <InfoNotice
          testID="recuperar-enviado"
          title="Pronto"
          body={`Se existir uma conta com ${email.trim()}, o link chega em instantes. Abra-o neste celular. Não chegou? Confira o spam.`}
        />
      ) : (
        <View style={{ gap: space[4] }}>
          <ErrorNotice message={error} testID="recuperar-erro" />
          <TextField
            testID="recuperar-email"
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="voce@email.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={submit}
            error={fieldError}
          />
          <Button testID="recuperar-botao" label={busy ? 'Enviando…' : 'Enviar link'} size="lg" wide disabled={busy} onPress={submit} />
        </View>
      )}

      <TextLink testID="recuperar-voltar" label="Voltar para Entrar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/entrar'))} />
    </FormScaffold>
  );
}
