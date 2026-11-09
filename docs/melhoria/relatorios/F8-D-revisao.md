# F8 · Onda D — Revisão adversarial de lógica e segurança (revisor)

**Data:** 04/11/2026 · **Escopo:** `git diff 4c9a6b9^..HEAD` (da pesquisa `F8/01` até a onda C1 `7a3427f`), com foco nos 10 pontos sensíveis do pedido. Worktree atualizada com `git merge claude/affectionate-gauss-e8gm77` antes da revisão. Nenhum código de produção foi alterado.

## 1. Base conferida

| Suíte | Resultado | Observação |
|---|---|---|
| pgTAP (`NR_PORT=54351 npm run db:test:local`) | **941/941**, 33 arquivos, 29 migrations aplicadas, `pg_prove` PASS | inclui 31 (fundação), 32 (limite de chamadas) e 33 (social) |
| Deno (`deno test … supabase/functions/tests`, Deno 2.5.6) | **105 ok, 0 falhas, 2 ignorados** | os 2 ignorados (`plano B` e `h3-js vendorizado`) dependem de `apps/mobile/node_modules`, que não existe nesta worktree. O PROGRESSO diz 106 ok/1 ignorado: a diferença é do ambiente, não um defeito. |
| Jest, typecheck, eslint | **não rodados** | a worktree não tem `node_modules` e o pedido era rodar só pgTAP e Deno. Vale o último resultado do PROGRESSO (Jest 1.600 verdes). |
| Expo Go / aparelho / EAS | **não verificados** | `docs.expo.dev` e `api.expo.dev` estão bloqueados nesta sessão; o achado M4 precisa ser conferido no aparelho. |

## 2. Achados

Resumo: **0 Alto · 4 Médio · 5 Baixo.** O centro da D-91 está correto: ninguém entra nas abas sem conta, "Entrar" com time vai direto ao app, o time pendente é apagado quando um perfil com time carrega e `choose_faction` repetido com o mesmo time não muda nada. Os riscos estão nos caminhos de falha.

### Médio

**M1 · `chooseFaction` depende de recarregar o perfil: se a gravação deu certo e a releitura falhou, a pessoa fica presa no passo do GPS ou gasta a troca de time da temporada**
- **Onde:** `apps/mobile/src/features/auth/session-controller.ts:86-90` (`chooseFaction` devolve `loadProfile()`); `features/screens/onboarding/onboarding-screen.tsx:162-178` (passo `pendente`) e `:213-222` (reserva `times`); `supabase/migrations/20261104120200_f8_social.sql:104-111` (`choose_faction`: um 2º time diferente conta como troca).
- **Caminho até a falha:** depois do cadastro, `choose_faction(time)` grava no servidor e `loadProfile()` falha com erro passageiro (rede, 5xx, 429).
  - (a) Com o perfil do cadastro no cache, ainda sem time, `loadProfile` devolve `ok: true` com esse perfil (`session-controller.ts:62-70`). O onboarding apaga o time pendente e vai para "localização". `finish()` libera o guarda, mas `hasFaction` continua falso, então o grupo fica em `onboarding`. A pessoa toca "Permitir" e nada acontece até reabrir o app.
  - (b) Sem cache, a releitura dá erro e a pessoa cai na reserva `times` ("escolha de novo"), embora o servidor já tenha o time. Se ela escolher **outro** time, `choose_faction` trata como troca: grava `faction_changed_season`, zera `contribution_reset_at` e tira a pessoa da crew. É a troca única da temporada, gasta no primeiro minuto de conta.
- **Reprodução:** lido, não reproduzido. Para reproduzir com Jest: mock do `profileRepo.chooseFaction` com `ok` e do `getMyProfile` com `NETWORK`, com e sem `readCachedProfile`.
- **Correção:** `chooseFaction` deve usar o JSON da RPC (`faction`, `canChangeThisSeason`) e aplicar o time no perfil local (`setProfile({ ...profile, faction })`) mesmo quando a releitura falhar; a releitura vira melhor esforço. Na reserva `times`, antes de chamar de novo, ler o perfil, e se ele já tiver time, pular para "localização". Opcional no servidor: não contar como troca a mudança feita nos primeiros minutos depois da 1ª escolha, sem corrida pontuada no meio.
- **Esforço:** P · **Dona:** E6 (B1). Opcional no servidor: E9.

**M2 · O eco da crew ignora "mostrar mapa no feed" e revela por onde o colega passou**
- **Onde:** `supabase/migrations/20261031120000_f8_fundacao.sql:159` (`private.crew_echo_at`). O filtro só olha `share_runs_to_feed` e ignora `user_settings.feed_show_map`.
- **Por que importa:** quem desliga o mapa no feed (D-79) não quer mostrar a rota. Mesmo assim, o eco "Rafa reforçou 3 trechos que você pintou" diz que Rafa correu ontem nos trechos que *você* conhece, o que equivale a uma rota aproximada. A máscara das zonas de privacidade (D-87) está certa, mas não cobre esse caso. Esbarra no princípio de minimização da LGPD (art. 6º, III).
- **Reprodução:** lido, não reproduzido. Para reproduzir com pgTAP no 31: colega com `feed_show_map = false` e marca no mesmo trecho; `crew_echo_at` devolve o colega.
- **Correção:** acrescentar `and coalesce((select s.feed_show_map from public.user_settings s where s.user_id = m.user_id), true)` em `hits` (ou tratar mapa oculto como "sem eco"), com um teste no pgTAP 31 e o mesmo filtro na demonstração (`services/api/demo/f8.ts`).
- **Esforço:** P · **Dona:** E9 (+ E8 no par da demonstração).

**M3 · Política de privacidade e "Excluir conta" mostram os marcadores "[NOME DO CONTROLADOR]" e "[E-MAIL DO ENCARREGADO]" a quem usa o app**
- **Onde:** `apps/mobile/src/features/auth/legal-contacts.ts` (marcadores), `legal-screen.tsx:60-61, 90`, `delete-account-info-screen.tsx:63` ("escreva para … [E-MAIL DO ENCARREGADO]"); `apps/mobile/scripts/check-publicacao.js:57-66` (só **avisa**; bloqueia apenas com `NOMADE_RELEASE=1`).
- **Por que importa:** fere a regra 1 da fase ("nada de provisório em conta real nem na demonstração"). O art. 9º da LGPD exige identificar o controlador e o canal de contato. A página `/excluir-conta` é a que o Google Play pede, e hoje ela manda a pessoa escrever para um e-mail que não existe.
- **Reprodução:** abrir `/privacidade` ou `/excluir-conta`: aparecem os colchetes (texto conferido no código).
- **Correção:** os autores preenchem os 5 campos. Até lá, inverter a trava: `publicar`/`apk` recusam por padrão e aceitam marcador só com `NOMADE_DEMO_OK=1`. O app esconde a linha enquanto houver marcador e mostra o e-mail de contato do projeto.
- **Esforço:** P · **Dona:** autores (dados) + E10 (trava).

**M4 · OTA: com `runtimeVersion: appVersion` e o bloqueio do `publicar`, o caminho recomendado do guia de teste (Expo Go por link/QR) pode ter parado de receber atualizações**
- **Onde:** `apps/mobile/app.json` (`runtimeVersion.policy = appVersion`), `scripts/publicar.sh:32` (recusa sem projectId), `docs/guia-teste/guia-teste.html` (opção A "Expo Go (recomendada)": "link/QR do app enviado pelos autores").
- **Por que importa:** pelo que sei do Expo, o Expo Go só abre updates do EAS cuja runtime é a do SDK (`exposdk:57.0.0`). Um update publicado com a política `appVersion` sai com runtime `1.0.0`, que vale para o APK do canal `demo`, mas não abre no Expo Go. Além disso, o `npm run publicar` agora recusa até alguém rodar o `eas init`. A opção A do guia, que serve de teste para os colegas, fica parada no último update antigo ou deixa de funcionar.
- **Reprodução:** lido, não reproduzido (`docs.expo.dev` bloqueado; falta login no EAS). Para conferir: depois do `eas init`, rodar `npm run publicar` e abrir o link no Expo Go 57.
- **Correção:** decidir com o dono: (1) o guia passa a usar o APK (`npm run apk`) ou `npm run celular -- --tunnel` como caminho A; ou (2) `app.config.js` com `EXPO_GO=1` gera `runtimeVersion: 'exposdk:57.0.0'` numa branch própria do EAS (`expo-go`), separada da branch do APK. Atualizar o guia e o DEPLOY §12.
- **Esforço:** P (docs) a M (branch dupla) · **Dona:** E10 + coordenador.

### Baixo

**B1 · `faction_activity()` para `anon` sem cache nem limite de abuso, e com contagens baixas expostas**
- **Onde:** `supabase/migrations/20261104120200_f8_social.sql:22-66`.
- **Conferido:** devolve só `windowDays`, `counts`, `total` e `isDemo: false`. Não tem `since`, nem filtro, nem parâmetro, e não inclui contas de demonstração. `security definer` com `search_path = ''` e `require_active` só para quem tem sessão. Não vaza dado pessoal. ✔
- **Risco que sobra:** a chave anon está no app, então qualquer pessoa pode chamar `rpc/faction_activity` em laço sem passar pelo limite das functions. Cada chamada varre 8 dias de `activities` (o índice parcial ajuda) e faz o join com `profiles`. Com pouca gente, "1 corredor ativo nos Night Owls" é quase uma pessoa. Nota técnica: um `SET statement_timeout` na função **não** limita a consulta da própria função. O que segura hoje é o `statement_timeout` padrão do papel `anon` no Supabase (3 s).
- **Correção:** guardar o resultado em `private.faction_activity_cache` (uma linha por `is_demo`, refeita quando tiver mais de 5 min, ou por `pg_cron` a cada 10 min), com o `anon` lendo só do cache. Para minimizar, o `anon` pode receber só `needsBoost` (a regra de `factionNeedingBoost` já é pura e está na ponte). Com sessão, contagens menores que 3 também podem virar `0` no JSON.
- **Esforço:** P · **Dona:** E9.

**B2 · Limite de chamadas: o balde `geral` (60/min) junta `/zones` do mapa com `/zone`, `register-device` e `weekly-recap`**
- **Onde:** `supabase/functions/_shared/rate-limit.ts:27`, `zones/index.ts`, `zone/index.ts`; mapa com espera de 600 ms (`features/screens/map-screen.tsx:47`).
- **Conferido:** a janela deslizante (duas janelas fixas) está certa no SQL e na memória, e as duas fórmulas de `retryAfter` batem. A chamada recusada não conta. A chave é o `user.id` vindo do Auth, nunca o IP nem o corpo, e é lida depois do `requireUser`. A trava por linha (`for update`) serializa chamadas simultâneas. Se o banco falhar, o contador em memória só afrouxa o limite. A tabela fica em `private`, com RLS e sem permissão para ninguém; a RPC é só do `service_role`. O 429 é repetível na fila offline (`isRetryable`). ✔
- **Risco:** quem arrasta o mapa por um minuto, parando mais de 600 ms entre os gestos, chega perto de 60 `/zones` e recebe 429 no mapa ("Muitas tentativas"). O cabeçalho `Retry-After` não está em `Access-Control-Expose-Headers`, então a web não o lê (o corpo já traz `details.retryAfter`, que é o que o app usa). Limitação conhecida: as RPCs do PostgREST (`choose_faction`, `faction_activity` etc.) não passam por este limite.
- **Correção:** criar o balde `mapa` (120/min) para `/zones` e `/zone`, e acrescentar `Access-Control-Expose-Headers: Retry-After`. Registrar no DEPLOY a limitação das RPCs (o Supabase não tem limite por papel nas RPCs).
- **Esforço:** P · **Dona:** E10 (C3).

**B3 · O time pendente não tem dono nem validade e não é zerado na troca de modo**
- **Onde:** `features/auth/pending-team.ts:13` (chave única do aparelho), `session-controller.ts:98-104` (`resetStoresForDemoSwitch` não zera `usePendingTeam`), `sign-in-screen.tsx:128` ("Criar conta" vai direto a `/cadastro`).
- **Caminho:** num aparelho compartilhado, a pessoa A escolhe um time e desiste. A pessoa B toca Entrar → "Criar conta" e se cadastra sem passar pela escolha. O onboarding grava em silêncio o time de A (o cadastro mostra "Garanta seu lugar nos …", mas não oferece trocar). Na troca demonstração ↔ conta real, a memória fica `hydrated` com o valor do outro modo.
- **Correção:** guardar `{ team, at }`, expirar em 24 h e zerar em `resetStoresForDemoSwitch` e no `signOut`. No cadastro, com time pendente, mostrar o link "Trocar time" (`/times`).
- **Esforço:** P · **Dona:** E6 (B1).

**B4 · Na reserva do onboarding, `choose_faction` roda no toque do card, antes da cerimônia, e há uma janela de até 250 ms para um 2º toque**
- **Onde:** `onboarding-screen.tsx:213-215` (`onJoin` chama `chooseFaction`); `team-choice.tsx:83-92` (`confirming` só é definido depois de `await measureOrigin()`, que leva até 250 ms).
- **Caminho:** dois toques rápidos em times diferentes (card e botão da folha do líder) disparam duas RPCs. Como a segunda conta como troca, a troca da temporada é gasta, como no M1(b).
- **Correção:** fazer como no caminho antes da conta, gravando só no "Continuar" da cerimônia, ou travar `busy` no começo de `join`.
- **Esforço:** P · **Dona:** E6 (B1).

**B5 · O eco da crew não marca dado de demonstração e não separa conta real de conta de demonstração**
- **Onde:** `20261031120000_f8_fundacao.sql:136-189`. `join_crew` (pré-existente) não impede uma conta real de entrar numa crew de demonstração, e os códigos do seed ficam no repositório.
- **Por que importa:** D-76/D-77 dizem que dado de demonstração nunca aparece em conta real sem selo. O feed tem `isDemo`; o eco não tem.
- **Correção:** em `hits`, acrescentar `and p.is_demo = (select is_demo from public.profiles where id = p_uid)` e devolver `isDemo`. Proibir em `join_crew` a mistura real ↔ demonstração.
- **Esforço:** P · **Dona:** E9.

## 3. Pontos conferidos sem achado

- **Guarda de rotas (D-91):** `resolveRouteGroup` é puro. `(tabs)`, `corrida`, `resumo`, `zona`, `compartilhar/*` (menos o convite), `missoes`, `recompensas` e `correr` estão em `Stack.Protected guard={group === 'app'}`. `(auth)` (boas-vindas, cidade, times, entrar, cadastro) só vale para quem saiu da conta. Deep link sem sessão para uma rota protegida volta para o `(auth)`. Logado sem time só chega ao `onboarding`. "Entrar" com time vai direto ao app (`hasFaction && !onboardingInProgress`). `onboarding-flow` guarda o `userId`, não um booleano, e por isso não vaza para outra conta. As rotas fora do guarda (`termos`, `privacidade`, `excluir-conta`, `convite/[codigo]`) são públicas por desenho. `/dev/*` redireciona fora de `__DEV__` no celular e só mostra dado de demonstração (na web fica aberto, mas é pré-existente).
- **`choose_faction`:** repetir o mesmo time não muda nada (`null`). A moldura é idempotente pela PK de `user_cosmetics`. O trigger `profiles_recruit_frame` (`after insert or update of faction … when new.faction is not null`) é `security definer`, não pode ser chamado por ninguém, e o backfill usa `on conflict do nothing`. A coluna `faction` não tem `grant update` para `authenticated`.
- **`notifications_zone_text`:** roda só em `before insert` para os 3 tipos com `data.zoneId`. Aviso sem zona conhecida passa como veio. O texto usa só o nome da zona sem número, o marco público e o nome do time. O horário "até 02h30" é em Brasília e nunca no passado (`greatest(…, now())`).
- **`landmarks` / `zones.near_ref`:** a tabela tem RLS, nenhuma política e `revoke all` de `anon` e `authenticated`. Os dados são marcos públicos, sem nada pessoal, e o `check` do formato vale nas duas colunas. O trigger só dispara em `insert or update of name, geom` (a pintura não passa por ele) e o backfill é idempotente (`is distinct from`). `zones_in_bbox_json` virou `security invoker` e só o `service_role` e `authenticated` podem chamá-la.
- **Feed `activityId`:** o servidor só devolve o id quando `f.user_id = p_viewer`. O app aceita o id só com `you === true` e no formato `^[A-Za-z0-9_-]{1,64}$`. A demonstração faz o mesmo (`demo/social.ts:241`).
- **Marcos (`svc_paint_milestones`):** só o `service_role` chama, com trava por pessoa (`profiles for update`). É idempotente (devolve `v2_extras.milestones` se já existir), compara a pessoa só com ela mesma, e o desempate `(fim, id)` é o mesmo do domain `paintMilestones`. A function segue sem o marco se a RPC falhar.
- **Momentos e líder:** `summaryLeaderFeat` só fala de feito real (`counts`). As falas passam por `LEADER_LINE_MAX = 90` e `hasGuiltWords`. `isEchoHour` vai de 07h a 22h em Brasília, igual ao SQL. "Semana do time" lê o ranking real e marca a demonstração.
- **Telemetria:** `share` vai sem propriedades. `mission_complete` leva `{ kind, missionId }`, que estão na lista fechada do app e do servidor (`20261024120200_telemetry.sql:24`). Nada de localização. Sem consentimento, `trackTelemetry` não guarda nada. Lotes de 20 (o servidor aceita até 50).
- **Domain compartilhado:** `team-bio.ts`, `faction-activity.ts` e `reminders.ts` são puros (sem `Date.now()` e sem `Math.random()`) e estão registrados em `_shared/domain.ts` e nos dois `deno.json`. Nos componentes novos não há `Date.now()` no corpo do render, só em efeitos.
- **OTA:** `node -e` com o `app.config.js` confirma que, com o marcador, `extra.eas` sai vazio e `updates.enabled` fica `false`, sem `url`. Com um UUID válido, `url = https://u.expo.dev/<id>`. Um valor inválido também desliga. O marcador nunca vai para `Constants.expoConfig`. `runtimeVersion: appVersion` está coerente entre o APK e o update.
- **`expo-updates`:** `~57.0.25` (o lock tem 57.0.26), a mesma de `expo/bundledNativeModules.json`, licença MIT. O Expo Go já traz o módulo e o app não o importa.
- **429 no app:** `fromHttp` mapeia para `RATE_LIMITED` com a frase curta. A fila de corridas trata o 429 como repetível. No perfil, o 429 abre com o cache (D-95).

## 4. Próximos passos (ordem)

1. **E6 (B1):** M1 + B4, com teste Jest do caminho "RPC ok + releitura falha" e de dois toques; depois B3.
2. **E9:** M2 + B5 (filtros do eco, pgTAP 31 e par na demo); depois B1 (cache do `faction_activity`).
3. **Autores + E10:** M3 (preencher os contatos e inverter a trava da publicação).
4. **E10 + coordenador:** M4 (decidir o caminho do Expo Go e atualizar o guia e o DEPLOY §12); B2 (balde `mapa` e `Expose-Headers`).
5. Depois das correções: rodar de novo `db:test:local`, Deno e o Jest completo, e mandar o revisor só ao diff das correções.
