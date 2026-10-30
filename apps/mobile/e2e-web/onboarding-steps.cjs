/**
 * E10 (onda 4) — passos comuns de primeira abertura, usados por `demo-flow.cjs`, `auth-flow.cjs` e
 * `demo-mode-flow.cjs`. Seguem o cadastro e o onboarding da v2 (ondas 2 e 3):
 *  - a primeira abertura cai em "Boas-vindas" (ou em "Entrar", se o aparelho já abriu o app antes);
 *  - o cadastro não pede mais a cidade natal (ela mora em Você → Editar perfil) e tem um aceite só (termos + privacidade);
 *  - o onboarding é: cidade dividida → escolher o time (carrossel) → confirmação → localização → Mapa.
 */

const sel = (t) => `[data-testid="${t}"]`;

/** Da primeira tela até o cadastro enviado. `user` = { email, password, username, birth? }. */
async function signUp(page, user) {
  const id = (t) => page.locator(sel(t)).first();
  await page.locator(`${sel('tela-boas-vindas')}, ${sel('tela-entrar')}`).first().waitFor({ timeout: 30_000 });
  if (await page.locator(sel('tela-boas-vindas')).count()) await id('boas-vindas-comecar').click();
  else await id('entrar-criar-conta').click();
  await id('tela-cadastro').waitFor();
  await id('cadastro-email').fill(user.email);
  await id('cadastro-senha').fill(user.password);
  await id('cadastro-usuario').fill(user.username);
  await id('cadastro-nascimento').fill(user.birth ?? '15/05/2000');
  await id('cadastro-aceite').click();
  await id('cadastro-botao').click();
}

/** Do onboarding (cidade dividida) até o Mapa, entrando no time `team` (striders | coyotes | volt | owls). */
async function chooseTeam(page, team) {
  const id = (t) => page.locator(sel(t)).first();
  await id('onboarding-cidade').waitFor({ timeout: 30_000 });
  await id('onboarding-cidade-continuar').click();
  await id(`onboarding-times-${team}`).waitFor({ timeout: 15_000 });
  await id(`onboarding-times-${team}`).click();
  await id('onboarding-entrar-time').click();
  await id('onboarding-confirmacao-continuar').waitFor({ timeout: 15_000 });
  await id('onboarding-confirmacao-continuar').click();
  await id('onboarding-localizacao-permitir').waitFor({ timeout: 15_000 });
  await id('onboarding-localizacao-permitir').click();
  await id('mapa-status').waitFor({ timeout: 30_000 });
}

module.exports = { signUp, chooseTeam };
