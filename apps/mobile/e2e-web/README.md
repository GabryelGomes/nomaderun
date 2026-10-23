# Testes no navegador (Playwright) — T4.4 / RNF-012

Rodam sobre o **export web** do app contra o **Supabase local** (seed de demonstração). Usam o Playwright instalado globalmente (`npm i -g playwright`; aqui ele já está em `$(npm root -g)/playwright`, com o Chromium em `/opt/pw-browsers`). Nenhuma dependência nova no `package.json`.

## Preparar

```bash
# na raiz
npm run db:reset            # seed limpo (contas de demonstração, corrida em revisão, zona sob ataque); espere ~15 s
npm run functions:serve     # em outro terminal
# em apps/mobile (.env apontando para http://127.0.0.1:54321)
npx expo export -p web --output-dir /tmp/nomade-web
```

## Fluxo completo da demonstração

```bash
node e2e-web/demo-flow.cjs /tmp/nomade-web
```

Cadastro (conta nova) → Neon Striders → Correr → Simulação → "Conquista garantida ao terminar" (~1 min) → segurar "Segure para encerrar" → **resumo oficial com "Zona conquistada"** → confere no servidor que a zona mudou de dono → abre a folha da zona → notificação "Zona conquistada" → **moderador de demonstração aprova a corrida em revisão** → apaga a conta de teste. Capturas em `OUT_DIR` (padrão: pasta temporária). Variáveis: `PW_CHROMIUM`, `PW_MODULE`, `API_URL`, `ANON_KEY`, `PORT`, `SIM_TIMEOUT_MS`.

## Autenticação, exclusão e acessibilidade (A3, QA-03/06/12, P-39)

```bash
npm run mail                # na raiz, se a caixa local não estiver no ar (http://127.0.0.1:54324)
node e2e-web/auth-flow.cjs /tmp/nomade-web
```

Porta **8081** (está nos redirecionamentos do Auth local). Cadastro com cidade natal → "Reduzir movimento" (botão sem escala) → link de acesso com sessão ativa pede "Trocar de conta?" (cancelar, code inválido, tokens ignorados) → recuperação de senha pelo PKCE com o e-mail da caixa local → conta inativada pelo admin mostra "Conta inativada" na tela Entrar → excluir conta com senha errada e certa. Usa no máximo 1 e-mail de recuperação (o Auth local limita os envios por hora).

## Comparação de imagem (tolerância 0,2%)

```bash
NODE_PATH="$(npm root -g)" WEB_DIST=/tmp/nomade-web node "$(npm root -g)/playwright/cli.js" test -c e2e-web/playwright.config.cjs
```

Estados: mapa com zonas dominadas e zona sob ataque; folha da zona neutra, dominada e sob ataque (eventos e prazo mascarados); mapa de calor = `fixme` (RF-013 fora do MVP). O mapa-base externo é bloqueado no teste. As imagens de referência ficam em `__screenshots__/` e foram geradas com o seed limpo: depois de uma mudança visual aprovada (D-15), rode `npm run db:reset` e acrescente `--update-snapshots`.

## Capturas do modo demonstração (T7.1.19, sem servidor)

Não precisa de Supabase: o export roda com o servidor de demonstração em memória (D-77).

```bash
# em apps/mobile; o --clear é obrigatório (o cache do Metro ignora mudança de EXPO_PUBLIC_*)
EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir /tmp/nomade-demo
NODE_PATH="$(npm root -g)" node e2e-web/capturas.cjs /tmp/nomade-demo <pasta>
# filtros: --rotas=inicio,arena  --estados=cheio,vazio  --larguras=390  --sem-pngquant
# ou --build para o script fazer o export (sempre com --clear)
```

Rota × estado (`?cenario=` do servidor de demonstração: cheio, vazio, carregando/lento, erro, offline, sob-ataque, sem-time, primeira-abertura, moderador) × 360/390/430. Relógio fixo, "Reduzir movimento", mapa-base trocado por um estilo vazio (as regiões aparecem sem internet) e selo "Demonstração" em toda captura. Saída em `docs/melhoria/capturas/<pasta>/`, comprimida com `pngquant --quality=85-98`, e `relatorio.json` (FCP, palavras visíveis, alvos < 44 px, interativos sem nome, erros da página; `pedidosAoServidor` tem de ser 0).
