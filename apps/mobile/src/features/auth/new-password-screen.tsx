import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import * as authRepo from '@/services/api/auth-repo';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { ErrorNotice, FormScaffold, StrengthMeter, TextField } from './form-ui';
import { passwordStrength, validatePassword } from './validation';

/**
 * Nova senha, aberta pelo link de recuperação (`nomaderun://nova-senha#...`).
 * O controlador de sessão já leu o link e criou a sessão de recuperação.
 */
export function NewPasswordScreen() {
  const { colors } = useTheme();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const linkError = useSession((s) => s.linkError);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);

  const submit = async () => {
    const p = validatePassword(password);
    const c = confirm === password ? undefined : 'As senhas não são iguais.';
    setErrors({ password: p ?? undefined, confirm: c });
    if (p || c) return;
    setBusy(true);
    setError(null);
    const res = await authRepo.updatePassword(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    // Libera o guarda: segue para o onboarding ou para as abas.
    useSession.getState().setRecovering(false);
  };

  if (!signedIn) {
    return (
      <FormScaffold testID="tela-nova-senha">
        <View style={{ gap: space[4] }}>
          <Icon name="lock" size={40} color={colors.text} />
          <Text variant="headline" accessibilityRole="header">
            Nova senha
          </Text>
          <ErrorNotice message={linkError?.message} testID="nova-senha-erro-link" />
          <Text muted>
            {linkError
              ? 'Peça um novo link de recuperação e abra o e-mail neste celular.'
              : 'Abra o link de recuperação que enviamos por e-mail neste celular para criar a senha nova.'}
          </Text>
        </View>
        <View style={{ gap: space[3] }}>
          <Button testID="nova-senha-pedir-link" label="Pedir novo link" size="lg" wide onPress={() => router.replace('/recuperar-senha')} />
          <Button testID="nova-senha-entrar" label="Voltar para Entrar" kind="secondary" size="lg" wide onPress={() => router.replace('/entrar')} />
        </View>
      </FormScaffold>
    );
  }

  return (
    <FormScaffold testID="tela-nova-senha">
      <View style={{ gap: space[4] }}>
        <Icon name="lock" size={40} color={colors.text} />
        <Text variant="headline" accessibilityRole="header">
          Crie uma senha nova
        </Text>
        <Text muted>Depois de salvar, você continua conectado neste celular.</Text>
      </View>
      <View style={{ gap: space[4] }}>
        <ErrorNotice message={error} testID="nova-senha-erro" />
        <TextField
          testID="nova-senha-senha"
          label="Nova senha"
          value={password}
          onChangeText={setPassword}
          secret
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
          help={<StrengthMeter level={strength.level} label={strength.label} hint={strength.hint} />}
        />
        <TextField
          testID="nova-senha-confirmar"
          label="Repita a nova senha"
          value={confirm}
          onChangeText={setConfirm}
          secret
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
          error={errors.confirm}
        />
        <Button testID="nova-senha-botao" label={busy ? 'Salvando…' : 'Salvar nova senha'} size="lg" wide disabled={busy} onPress={submit} />
      </View>
    </FormScaffold>
  );
}
