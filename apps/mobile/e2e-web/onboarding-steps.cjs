/**
 * E10 (onda 4) / F8 B1 — passos comuns de primeira abertura, usados por `demo-flow.cjs`, `auth-flow.cjs` e
 * `demo-mode-flow.cjs`. Seguem a ordem da D-91 (valor antes da conta):
 *  - Boas-vindas → "A cidade está dividida" (≤ 6 s; "Escolher meu time" a partir de 2 s) → escolha do time com as
 *    4 capas → cerimônia (pulável; termina em "Continuar") → **cadastro** ("Garanta seu lugar nos …") →
 *    localização → Mapa;
 *  - quem já tem conta ("Já tenho conta" / "Entrar") não passa por nada disso;
 *  - o cadastro não pede a cidade natal (ela mora em Você → Editar perfil) e tem um aceite só (termos + privacidade).
 * `chooseTeamBeforeAccount` conta os toques até a cerimônia (meta da D-91: ≤ 5, zero digitação).
 */

const sel = (t) => `[data-testid="${t}"]`;

/** Meta da D-91: toques até a cerimônia. */
const MAX_TAPS_TO_CEREMONY = 5;

/**
 * Da primeira tela (Boas-vindas) até o cadastro, entrando no time `team`. Devolve o número de toques até a cerimônia
 * (Começar · [Escolher meu time] · card · Entrar para os …) e nunca digita nada.
 */
async function chooseTeamBeforeAccount(page, team) {
  const id = (t) => page.locator(sel(t)).first();
  let taps = 0;
  const tap = async (t) => {
    await id(t).click();
    taps += 1;
  };
  await id('tela-boas-vindas').waitFor({ timeout: 30_000 });
  await tap('boas-vindas-comecar');
  // "A cidade está dividida": passa sozinha em até 6 s; o botão (a partir de 2 s) adianta
  await page.locator(`${sel('tela-cidade')}, ${sel('tela-onboarding-times')}`).first().waitFor({ timeout: 30_000 });
  if (await page.locator(sel('tela-cidade')).count()) {
    await id('onboarding-cidade-continuar').waitFor({ timeout: 10_000 });
    await tap('onboarding-cidade-continuar');
  }
  await id(`onboarding-times-${team}`).waitFor({ timeout: 15_000 });
  await tap(`onboarding-times-${team}`);
  await tap('onboarding-entrar-time');
  await id('onboarding-confirmacao-continuar').waitFor({ timeout: 15_000 });
  const toCeremony = taps;
  // o "Continuar" da cerimônia não conta: a meta é até a cerimônia
  await id('onboarding-confirmacao-continuar').click();
  await id('tela-cadastro').waitFor({ timeout: 15_000 });
  return toCeremony;
}

/** Só o formulário de cadastro (já na tela). `user` = { email, password, username, birth? }. */
async function fillSignUp(page, user) {
  const id = (t) => page.locator(sel(t)).first();
  await id('tela-cadastro').waitFor({ timeout: 30_000 });
  await id('cadastro-email').fill(user.email);
  await id('cadastro-senha').fill(user.password);
  await id('cadastro-usuario').fill(user.username);
  await id('cadastro-nascimento').fill(user.birth ?? '15/05/2000');
  await id('cadastro-aceite').click();
  await id('cadastro-botao').click();
}

/**
 * Compatibilidade: da primeira tela até o cadastro enviado, passando pela escolha do time (`team`, padrão `volt`).
 * Se o app abriu em "Entrar" (aparelho que já abriu o app), vai por "Criar conta" e o cadastro acontece sem time
 * pendente: aí o onboarding de reserva pede o time depois (`chooseTeam`).
 */
async function signUp(page, user, team = 'volt') {
  const id = (t) => page.locator(sel(t)).first();
  await page.locator(`${sel('tela-boas-vindas')}, ${sel('tela-entrar')}`).first().waitFor({ timeout: 30_000 });
  if (await page.locator(sel('tela-boas-vindas')).count()) await chooseTeamBeforeAccount(page, team);
  else await id('entrar-criar-conta').click();
  await fillSignUp(page, user);
}

/** Depois do cadastro (time já gravado): explicação do GPS → Mapa. */
async function finishOnboarding(page) {
  const id = (t) => page.locator(sel(t)).first();
  await id('onboarding-localizacao-permitir').waitFor({ timeout: 30_000 });
  await id('onboarding-localizacao-permitir').click();
  await id('mapa-status').waitFor({ timeout: 30_000 });
}

/**
 * Onboarding de reserva (sem time pendente): cidade dividida → escolher o time (carrossel) → cerimônia →
 * localização → Mapa. Com time pendente, o app pula direto para a localização: aí só termina.
 */
async function chooseTeam(page, team) {
  const id = (t) => page.locator(sel(t)).first();
  await page.locator(`${sel('onboarding-cidade')}, ${sel('tela-onboarding-times')}, ${sel('onboarding-localizacao')}, ${sel('onboarding-salvando')}`).first().waitFor({ timeout: 30_000 });
  if (await page.locator(sel('onboarding-cidade')).count()) {
    await id('onboarding-cidade-continuar').click();
  }
  if (await page.locator(sel('tela-onboarding-times')).count()) {
    await id(`onboarding-times-${team}`).waitFor({ timeout: 15_000 });
    await id(`onboarding-times-${team}`).click();
    await id('onboarding-entrar-time').click();
    await id('onboarding-confirmacao-continuar').waitFor({ timeout: 15_000 });
    await id('onboarding-confirmacao-continuar').click();
  }
  await finishOnboarding(page);
}

module.exports = { signUp, fillSignUp, chooseTeam, chooseTeamBeforeAccount, finishOnboarding, MAX_TAPS_TO_CEREMONY };
