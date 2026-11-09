# F8 · Onda D: correções de publicação (E10)

2026-11-04. Esta rodada trata os achados M3, M4 e B2 de `F8-D-revisao.md`, o M-1 de `F8-D-qa.md` e dois Baixos da QA que ficaram com a E10. Tudo foi feito na worktree da E10, com a branch `claude/affectionate-gauss-e8gm77` já integrada e sem push.

## Resultado

| Achado | O que mudou | Prova |
|---|---|---|
| **M3 / M-1:** marcadores na Política e em `/excluir-conta` | `legal-contacts.ts` preenchido com o padrão da coordenação (**o dono confirma**). Controladores: Gabryel Gomes Bahmad Camapum e Mateus Augusto de Faria Brito (pessoas físicas, autores). Encarregado: Gabryel Gomes Bahmad Camapum. E-mail: `byelgomys@gmail.com`. Região: "América do Sul (São Paulo, Brasil)", conforme o `supabase/DEPLOY.md` §1 ("South America (São Paulo)"). A `PRIVACY_VERSION` foi para `2026-11` e a tela mostra "atualizada em 4 de novembro de 2026". A trava `check-publicacao.js` **recusa por padrão** quando há marcador e só aceita com `NOMADE_DEMO_OK=1`, para um teste interno. Ela também mostra as duas pendências de uma vez. | No DOM do export demo, `/privacidade` e `/excluir-conta` têm **0** colchetes e trazem o e-mail. Capturas em `capturas/F8-D-fix-e10/`. Jest: `publicacao.test.ts` (falha com marcador; trava recusa ou aceita só com `NOMADE_DEMO_OK`) e `delete-account-info.test.tsx` (nenhum `[NOME…]` na tela). |
| **M4:** OTA para o Expo Go | `runtimeVersion: { policy: 'sdkVersion' }` (`exposdk:57.0.0`). O DEPLOY §12 ganhou a seção "Expo Go e runtime": link `exp://u.expo.dev/<projectId>?channel-name=demo&runtime-version=exposdk:57.0.0`, branch `demo`, ambiente `preview`, canal `demo` do APK e as consequências. Pacote nativo novo exige build novo; só entram pacotes que o Expo Go 57 traz; ao trocar de SDK, é preciso publicar de novo. A D-99 ganhou o "ajuste pós-revisão". | `expo config` resolve `sdkVersion`. O `expo-doctor` passa em 19/21: as 2 falhas são só de rede (`ENOTFOUND exp.host`). O export web está ok. |
| **B2:** limite de chamadas no mapa | Balde `mapa` de 180/min só para `/zones` e `/zone`. O `geral` continua em 60/min para register-device, moderate-activity e weekly-recap. O CORS ganhou `Access-Control-Expose-Headers: Retry-After`. O app passou a ler o tempo de espera (`AppError.retryAfter`, que vem de `details.retryAfter` ou, sem ele, do cabeçalho). Antes, o app **não** lia nenhum dos dois, ao contrário do que a revisão supunha. Depois de um 429, o `zones-store` para de pedir e tenta 1 vez com a última caixa. | Deno `rate_limit.test.ts` (balde `mapa` de 180 cabe em 1 min de arrasto; nomes passam no `CHECK` do SQL; `Expose-Headers` no 429 e no `OPTIONS`; `zones` e `zone` → `mapa`). Jest `rate-limit.test.ts` (corpo, cabeçalho e `parseRetryAfter`) e `zones-store.test.ts` (espera 7 s e 1 tentativa com a última caixa). |
| **Baixo:** "Toque no seu time" a 2,56:1 | Botão desativado com tokens próprios: `disabledSurface` `#1A1B20`, `onDisabled` `#A8A6A1` e borda `lineControl`. No tema claro, `surface2` e `ink2`. Saiu a opacidade de 0,45. O ghost desativado continua sem fundo. | **7,07:1** medido no DOM a 360, 390 e 430. `contraste.cjs --strict` com 3 pares novos (7,07, 8,28 e 3,09), todos passando. Jest `components-base`. |
| **Baixo:** cerimônia com quadro longo no início | Diagnóstico por trace do CDP a 4×: o clique levava **162 ms de JS** (montagem fria: mascote neon, ondas, confete e rota), e 81 ms com o código já aquecido. `useMountStage` (novo, `components/motion`) monta o mascote (caixa fixa de 160 × 160, nada pula na tela), as ondas e o confete 1 quadro pintado depois. Os atrasos descontam o tempo até a montagem, e a coreografia fica no mesmo relógio. | Trace: 162 ms passou a 37 ms no quadro do toque, mais 27 ms na etapa 1. fps (5 repetições, mediana) na tabela abaixo. Jest `art-moments` (sem mascote no 1º quadro; depois aparece com o aceno compensado). |

**Medições da cerimônia** (`F8-D/medicoes-fps-fix-e10.json`, mesmo script `F8-C1/medir-fps.cjs`):

| Cena a 4× | Antes (esta sessão) | Antes (QA) | Depois |
|---|---|---|---|
| Movimento reduzido | 53,3 fps, máx. 150 ms | 50 fps, máx. 233 ms | **56 fps, máx. 83 ms** |
| Completa | 52 fps, máx. 317 ms | 55 fps, máx. 200 ms | **55 fps, máx. 150 ms** |

A 1×, ficou em 60 e 59,7 fps.

## Verificações

- Tipos e lint: `npm run typecheck` ok e `eslint src` sem nenhum problema.
- Jest completo (1×, `--silent --maxWorkers=2`): **1.659 passaram**, 26 pulados, 153 suítes.
- Deno: **108 passaram** (1 ignorado). O `deno check` das functions alteradas está ok.
- Export demo com `--clear` + `demo-mode-flow.cjs`: **61/61**, sem nenhum pedido ao Supabase.
- `node scripts/check-publicacao.js`: a parte da Política **passa** ("controladores, encarregado e região preenchidos"). O comando ainda sai com 1 **só por causa do projectId do EAS**, que segue como marcador até o `eas init` dos autores e não pode ser inventado. Com um UUID no `app.json`, sai com 0.

## Riscos e pendências

- **Dono:** confirmar os nomes, o e-mail e a região (Supabase → Settings → General). Se mudar algum deles, subir `PRIVACY_VERSION` e `PRIVACY_UPDATED_AT`. Rodar o `eas init`. Abrir o link do Expo Go depois do 1º `publicar` (não deu para conferir aqui: `docs.expo.dev` e `api.expo.dev` estão bloqueados).
- **`sdkVersion`:** um update que dependa de um módulo nativo novo chegaria ao APK antigo e quebraria. A regra está no DEPLOY §12.
- **Fora do limite:** as RPCs do PostgREST (`faction_activity`, `choose_faction` etc.) continuam sem esse limite, como já registrado no B1 e no B2 da revisão.
- **Avisos aos donos:** E5 (`team-confirm.tsx` e teste `art-moments`); E6 (`button.tsx` e tokens do desativado: todo botão desativado agora fica grafite, com texto legível); E9 (`errors.ts`, `functions.ts`, `zones-store.ts` e `_shared/http.ts`).
