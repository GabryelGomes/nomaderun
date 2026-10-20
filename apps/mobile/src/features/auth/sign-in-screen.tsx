import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { TeamBadge } from '@/components/team-badge';
import { Text } from '@/components/text';
import { FACTION_IDS } from '@/domain/types';
import * as authRepo from '@/services/api/auth-repo';
import { env } from '@/services/api/env';
import { useSession } from '@/store/session-store';
import { space } from '@/theme/tokens';

import { ErrorNotice, FormScaffold, TextField, TextLink } from './form-ui';
import { providerLabel, signInWithProvider } from './oauth';
import { validateEmail } from './validation';

/** Entrar (RF-001). Erros: credenciais inválidas, sem internet, muitas tentativas (RNF-007). */
export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({});
  const notice = useSession((s) => s.signedOutNotice);

  const submit = async () => {
    const emailErr = validateEmail(email);
    const passErr = password ? undefined : 'Informe sua senha.';
    setFieldError({ email: emailErr ?? undefined, password: passErr });
    if (emailErr || passErr) return;
    setBusy(true);
    setError(null);
    useSession.getState().setSignedOutNotice(null);
    const res = await authRepo.signIn(email, password);
    setBusy(false);
    // Em sucesso o guarda de rotas do layout raiz leva ao onboarding ou às abas.
    if (!res.ok) setError(res.error.message);
  };

  const social = async (p: (typeof env.oauthProviders)[number]) => {
    setError(null);
    const e = await signInWithProvider(p);
    if (e) setError(e.message);
  };

  return (
    <FormScaffold testID="tela-entrar">
      <View style={{ gap: space[4] }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {FACTION_IDS.map((f) => (
            <TeamBadge key={f} faction={f} size={44} />
          ))}
        </View>
        <Text variant="hero" accessibilityRole="header" style={{ fontSize: 76, lineHeight: 76 }}>
          {'NOMADE\nRUN'}
        </Text>
        <Text variant="lead">Entre para continuar correndo a sua cidade.</Text>
      </View>

      <View style={{ gap: space[4] }}>
        <ErrorNotice message={error} testID="entrar-erro" />
        {error ? null : <ErrorNotice message={notice} testID="entrar-aviso-sessao" />}
        <TextField
          testID="entrar-email"
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="voce@email.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          error={fieldError.email}
        />
        <TextField
          testID="entrar-senha"
          label="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder="Sua senha"
          secret
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={fieldError.password}
        />
        <Button testID="entrar-botao" label={busy ? 'Entrando…' : 'Entrar'} size="lg" wide disabled={busy} onPress={submit} />
        <TextLink testID="entrar-esqueci" label="Esqueci minha senha" href="/recuperar-senha" />
      </View>

      <View style={{ gap: space[3], marginTop: 'auto' }}>
        {env.oauthProviders.map((p) => (
          <Button key={p} testID={`entrar-${p}`} label={providerLabel[p]} kind="secondary" size="lg" wide onPress={() => social(p)} />
        ))}
        <Text variant="caption" muted style={{ textAlign: 'center' }}>
          Ainda não corre com a gente?
        </Text>
        <Button testID="entrar-criar-conta" label="Criar conta" kind="secondary" size="lg" wide onPress={() => router.push('/cadastro')} />
      </View>
    </FormScaffold>
  );
}
