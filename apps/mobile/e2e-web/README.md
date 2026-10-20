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

## Comparação de imagem (tolerância 0,2%)

```bash
NODE_PATH="$(npm root -g)" WEB_DIST=/tmp/nomade-web node "$(npm root -g)/playwright/cli.js" test -c e2e-web/playwright.config.cjs
```

Estados: mapa com zonas dominadas e zona sob ataque; folha da zona neutra, dominada e sob ataque (eventos e prazo mascarados); mapa de calor = `fixme` (RF-013 fora do MVP). O mapa-base externo é bloqueado no teste. As imagens de referência ficam em `__screenshots__/` e foram geradas com o seed limpo: depois de uma mudança visual aprovada (D-15), rode `npm run db:reset` e acrescente `--update-snapshots`.
