import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { type TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { FadeUp } from '@/components/motion';
import { Text } from '@/components/text';
import * as authRepo from '@/services/api/auth-repo';
import { env } from '@/services/api/env';
import { useSession } from '@/store/session-store';
import { neon } from '@/theme/neon';
import { space } from '@/theme/tokens';
import { ForceScheme } from '@/theme/use-theme';

import { ErrorNotice, FormScaffold, TextField, TextLink } from './form-ui';
import { HeroWordmark } from './hero-wordmark';
import { NeonBackdrop } from './neon-backdrop';
import { NeonBadges } from './neon-badges';
import { providerLabel, signInWithProvider } from './oauth';
import { validateEmail } from './validation';

/**
 * Entrar (RF-001). Erros: credenciais inválidas, sem internet, muitas tentativas (RNF-007).
 * Visual neon (D-58): sempre escuro, com o fundo "Pit Lane Neon" da apresentação.
 */
export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({});
  const notice = useSession((s) => s.signedOutNotice);
  const passwordRef = useRef<TextInput>(null);

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
    <ForceScheme scheme="dark">
      <StatusBar style="light" />
      <FormScaffold testID="tela-entrar" background={<NeonBackdrop />}>
        <View style={{ gap: space[4] }}>
          <NeonBadges />
          <HeroWordmark testID="entrar-titulo" delay={120} neon />
          <FadeUp delay={500}>
            <Text variant="lead" color={neon.ink2}>
              Entre para continuar correndo a sua cidade.
            </Text>
          </FadeUp>
        </View>

        <View style={{ gap: space[4] }}>
          <ErrorNotice message={error} testID="entrar-erro" />
          {error ? null : <ErrorNotice message={notice} testID="entrar-aviso-sessao" />}
          <FadeUp delay={600} style={{ gap: space[4] }}>
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
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={fieldError.email}
            />
            <TextField
              testID="entrar-senha"
              inputRef={passwordRef}
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
          </FadeUp>
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
    </ForceScheme>
  );
}
