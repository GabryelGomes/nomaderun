# F8 · D — correções da revisão (E9: M2, B5, B1)

Origem: `docs/melhoria/relatorios/F8-D-revisao.md` (achados M2, B5 e B1). Tudo aditivo; nenhuma migration antiga editada.

## O que mudou

| Achado | Correção | Onde |
|---|---|---|
| **M2** · eco ignorava o mapa oculto | `private.crew_echo_at` filtra também `user_settings.feed_show_map` do colega (mapa escondido = sem eco). Mesmo filtro na demonstração (`share_runs_to_feed` e `feed_show_map`, via `demoFeedSettings`) | `supabase/migrations/20261104120300_f8_revisao.sql`, `apps/mobile/src/services/api/demo/{f8,social}.ts` |
| **B5** · eco e demonstração | Eco só conta colega com o mesmo `profiles.is_demo` de quem pede e devolve `isDemo`. `join_crew` recusa crew com líder ou membro de outro tipo de conta, com `CREW_NOT_FOUND` (igual a código inválido; os códigos do seed estão no repositório). Saiu barato: uma consulta a mais no `join_crew` | mesma migration; demonstração em `demo/f8.ts` |
| **B1** · `faction_activity` para `anon` | Sem sessão: só `{ needsBoost, isDemo }`, lido de `private.faction_activity_cache` (RLS ligada, sem política nem grant). O cache é refeito sob demanda quando tem 5 min ou mais, por um pedido de cada vez (`pg_try_advisory_xact_lock`), e os outros pedidos leem o que já está lá. Com sessão: contagens ao vivo, como antes, e mais `needsBoost`. A regra SQL `private.faction_needing_boost` é igual a `factionNeedingBoost`. App: `counts`/`total` passam a `null` sem contagens, e o selo vem das contagens (domain) ou do `needsBoost` do servidor validado por `asBoostFaction` (domain, novo). Demonstração: o mesmo formato | migration; `apps/mobile/src/domain/faction-activity.ts`, `services/api/faction-activity-repo.ts`, `demo/f8.ts` |

Os consumidores (`features/engagement/team-boost.tsx`, a escolha do time e a tela de facção) já usavam só `needsBoost` e `isDemo`, então nenhuma tela mudou.

## Testes

- **pgTAP:** `NR_PORT=54353 npm run db:test:local`: **964 ok em 34 arquivos**, 30 migrations. O arquivo novo, `34_f8_revisao.test.sql`, tem 23 casos. Conferi que falha sem a migration: 10 `not ok` e depois erro de função ausente. Os casos de controle estão marcados como tal. Também ajustei o 31 e o 33, que agora checam o formato novo (anon `{isDemo, needsBoost}`, `needsBoost` com sessão, `isDemo` no eco) e a contagem por trás do cache (`private.faction_counts`).
- **Deno:** `deno test -A` em `supabase/functions`: **108 ok, 1 ignorado**. O arquivo novo, `f8_revisao.test.ts`, lê a tabela `BOOST_PARITY` do pgTAP 34 e confere com `factionNeedingBoost` e `asBoostFaction`. `deno check` das functions passou.
- **App:** typecheck ok; `eslint src` sem erros; Jest completo `--silent --maxWorkers=2` com **152 suítes, 1635 ok e 26 pulados**, inclusive o `demo-contract`. O arquivo novo, `demo/__tests__/f8-revisao.test.ts`, cobre M2 e B5 na demonstração (falham sem o filtro) e o parser nos dois formatos.

## Compatibilidade

- **App antigo com servidor novo.** Com sessão, o app ignora os campos `needsBoost` e `isDemo` a mais. Sem sessão, não recebe contagens, lê tudo como 0 e não mostra o selo; nada quebra. Um `join_crew` entre tipos de conta aparece como "código inválido", erro que o app já trata.
- **App novo com servidor antigo.** Recebe as contagens e calcula o selo pelo domain, com o mesmo resultado. Eco sem `isDemo` vira `false`.

## Deploy

1. Migration (`npx supabase db push`).
2. EAS Update.

Nenhuma function muda. O caminho de volta está em `supabase/DEPLOY.md`, seção "Fase 8 · D".

## Pendências e riscos

- **Com sessão, sem cache.** A contagem com sessão continua ao vivo: os pgTAP 31 e 33 dependem disso, e quem chama tem conta ativa e identificável. Se o abuso por conta logada virar problema, dá para servir o mesmo cache por `is_demo`.
- **Contagens menores que 3.** Não viraram 0 no JSON com sessão (sugestão opcional da revisão). Isso mudaria o `needsBoost` calculado no app. Fica para decisão da E3/E6.
- **`faction_activity` agora é `volatile`.** Por GET (`rpc(..., { get: true })`, transação só de leitura), o caminho sem sessão falharia ao gravar o cache. O app usa POST.
- **Membros já misturados.** Quem entrou numa crew de outro tipo antes desta migration continua nela, mas deixa de aparecer no eco. Limpeza opcional: `delete from crew_members` dos casos misturados.
- **Máquina com Docker:** rodar `npm run db:reset`, `npm run db:test:psql`, `npm run e2e` e `npm run functions:bundle-check`.
