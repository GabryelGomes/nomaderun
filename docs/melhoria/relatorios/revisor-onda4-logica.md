# Revisão adversarial — lógica, dados e segurança da v2 (onda 4, F5)

> **Revisor independente**, 28/10/2026. Base: `092497c` e, a pedido do coordenador, mais o merge de
> `claude/affectionate-gauss-e8gm77` (onda 3: E9, E6a, E6b, E6c, E7 e E4; **E8 e E5 da onda 3 ainda não entraram**).
> Só revisão: nenhum código de produção foi alterado. As provas ficaram em scripts de rascunho, fora do repositório,
> e estão transcritas abaixo.
> Os achados da onda 3 também estão resumidos em `revisao-onda3.md`.

## 1. O que foi verificado e como

| Verificação | Comando | Resultado |
|---|---|---|
| pgTAP em `092497c` | `NR_PORT=54339 NR_KEEP=1 npm run db:test:local` | **716/716** (24 arquivos, 21 migrations) |
| pgTAP depois do merge da onda 3 | idem | **805/805** (28 arquivos) |
| Deno das functions em `092497c` | `npx -y deno test --allow-read --config supabase/functions/deno.json supabase/functions/tests` | **82 ok**, 1 ignorado |
| Deno depois do merge | idem | **87 ok**, 1 ignorado |
| Auditoria do catálogo (banco local) | `pg_class`, `pg_proc`, `pg_policies`, `role_table_grants`, `pg_publication_tables` | ver abaixo |
| Provas dos achados | SQL em transação com `rollback`; Deno com o `domain` real | ver cada achado |

**Auditoria do catálogo (sem achado):**
- todas as tabelas do `public` têm RLS;
- nenhuma função `security definer` está sem `set search_path`;
- `anon` só executa `br_*`, `check_request`, `current_season_id`, `season_start` e `username_available`;
- as tabelas v2 têm `revoke` padrão. O cliente só tem `SELECT`, e só nas próprias linhas;
- `zone_cells`, `paint_marks`, `feed_items`, `league_groups` e `league_reservations` não têm grant nem policy, então só as RPCs as leem;
- as views têm `security_invoker=true`;
- os `svc_*` só são executados pelo `service_role`;
- a ponte do domain está completa (os 20 módulos aparecem em `_shared/domain.ts` e nos dois `deno.json`).

**Lido e sem achado:**
- domain:
  - `paint.ts`: camadas, desbotar idempotente, dono por maioria com mínimo 3, herança e ataque;
  - `raid.ts`: tetos, crítico por semente com paridade FNV no SQL, D-84;
  - `league.ts` e `job_close_league`;
  - `progression.ts`, `reminders.ts` (janela 8h–21h, 1/dia, 4 em 7 dias, escada 7/14/21/30), `share-privacy.ts`, `gpx`/`useExportGpx`;
- servidor:
  - `svc_apply_v2`: idempotente por `v2_extras`, trava as zonas em ordem e confere a versão;
  - `apply_raid_hit`: refaz o crítico e os tetos no banco;
  - `add_league_points`;
  - LGPD: `export_v2_tables` cobre `telemetry_*`, e o delete cai em cascata;
  - `notify_pref` agora só lê booleano;
  - telemetria: lista fechada, `props` validado, retenção de 30 dias;
- `weekly-recap`: corte com `clipRouteForSharing` e resposta por lista branca;
- app:
  - pares de demonstração com o mesmo formato do servidor real (`raid_current`, `league_current`, `my_engagement`, `my_missions`, `my_daily_chest`, `open_daily_chests`, `my_track`, pausa, `crew_feed`, `record_share`). O formato foi conferido com a saída real das RPCs no banco local;
  - `haptics.ts` (portão de 150 ms);
  - sem `runOnJS` nem `.value` no render.

---

## 2. Achados

### ALTA

#### A1. O "buraco" da pintura entrega o centro das zonas de privacidade (a casa)
- **Onde:**
  - `supabase/migrations/20261024120000_paint_today_pause_prefs.sql:37-46` (`private.cell_in_privacy_zone`) e `:79`, `:99`, usados em `zone_paint_near`;
  - a mesma regra estava em `20261023120700_paint.sql:298-304`.
- **Por que importa:**
  - `zone_paint_near` tira do retrato todo trecho cujo centro fica **exatamente** dentro do raio de **qualquer** zona de privacidade, sem folga e sem deslocamento;
  - qualquer conta logada pode pedir o retrato de qualquer ponto (raio de até 3 km). Numa área pintada, o vazio forma um círculo, e o centro dele é a casa de alguém;
  - é o ataque que o próprio `share-privacy.ts` descreve (Hassan et al., USENIX 2018) e que a D-78 evita no card. Aqui o servidor faz o contrário. Viola a RN-010 e a LGPD.
- **Como reproduzir** (banco local, porta 54339, transação com `rollback`):
  1. pintar 1.519 trechos (H3 res 11) num disco em volta de (-23,5505; -46,6333);
  2. a vítima A cria uma zona de privacidade de 200 m em (-23,5521; -46,6312);
  3. o atacante B chama `zone_paint_near(-23.5505, -46.6333, 1500)` e tira a média das posições dos trechos que faltam.
  ```
  trechos_pintados | trechos_omitidos | lat_centro_buraco | lng_centro_buraco | erro_m
  1519             | 58               | -23.55213         | -46.63119         | 3.5
  ```
  O centro da zona de privacidade sai com **3,5 m de erro**. O resultado se repete depois do merge da onda 3.
- **Correção sugerida:** não recortar por círculo exato.
  - Usar uma "mancha" estável por zona de privacidade:
    - deslocamento do centro de até r/2;
    - folga de 25 a 85 m;
    - os dois sorteados **uma vez** por zona (por exemplo, HMAC de `privacy_zones.id` com um segredo do servidor) e guardados;
    - recorte arredondado para os pais res 10 (~65 m) que tocam a mancha.
  - Outra opção: não recortar `cells` nenhum. `zone_cells` não tem autor, e o risco de "pintura fresca saindo de casa" se trata mostrando só a camada, sem a mudança do dia.
  - Acrescentar um pgTAP que meça o erro do centro do buraco, que precisa ficar acima de 0,5 × raio.
- **Dona:** E9, com a E3 para a regra. **Esforço:** M.

### MÉDIA

#### M1. O teto de 200 reações por dia é burlável; alternar a reação reabre a notificação do autor
- **Onde:** `supabase/migrations/20261023120800_records_social.sql:300-326` (`react_feed_item`).
- **Por que importa:**
  - o teto conta só as reações que **existem agora** (`count(*) where day = hoje`). Tirar a reação (`p_reaction = null`) apaga a linha, e a pessoa pode reagir de novo sem limite;
  - cada nova reação faz `update notifications set read_at = null`: o aviso do autor volta a ficar como não lido a cada ciclo. É um vetor de assédio dentro da crew, e o antiabuso é exigido pela D-79;
  - o texto sai errado: "Sua corrida ganhou **1 reações** da crew."
- **Como reproduzir** (B na crew de A, flag `feed` ligada): 300 ciclos `react_feed_item(item,'bora')` + `react_feed_item(item,null)`.
  ```
  reações feitas sem bater no teto (300 ciclos) | 1 notificação | "Sua corrida ganhou 1 reações da crew." | não lida = t
  ```
  Foram 600 chamadas sem nenhum `KUDOS_LIMIT`.
- **Correção sugerida:**
  - contar **ações** num contador diário: `engagement_marks` ou uma tabela `kudos_actions(user_id, day, n)` com `on conflict ... n+1`;
  - só notificar quando o par (pessoa, item) for novo no dia;
  - não zerar `read_at` quando a mesma pessoa reage de novo;
  - singular/plural no `format`.
- **Dona:** E9. **Esforço:** P.

#### M2. Telemetria: desligar o consentimento durante um envio deixa eventos gravados (corrida de dados)
- **Onde:** `supabase/migrations/20261024120200_telemetry.sql`, em duas funções:
  - `track_events` confere `telemetry_consent.opted_in` **antes** do `pg_advisory_xact_lock` e sem trava na linha;
  - `set_telemetry_consent(false)` não pega a mesma trava. O `delete` não enxerga as linhas ainda não confirmadas do envio.
- **Por que importa:** a pessoa desliga a telemetria (D-82, LGPD) e ainda assim ficam eventos dela, até a retenção de 30 dias. O app dispara esse caso sozinho: `flushTelemetry` pode estar no meio de um lote quando `setTelemetryOptIn(false)` roda (`features/engagement/telemetry.ts`).
- **Como reproduzir** (duas conexões):
  1. A faz `begin; track_events([run_finish, share]); pg_sleep(3); commit`;
  2. 1 s depois, B faz `set_telemetry_consent(false)`.
  ```
  B: {"optedIn": false, "deletedEvents": 0}
  A: {"accepted": 2, "dropped": 0}
  depois: consentimento=false eventos_que_sobraram=2
  ```
- **Correção sugerida:**
  - as duas funções pegam `pg_advisory_xact_lock(hashtextextended('telemetry:'||uid,0))` antes de tudo;
  - `track_events` relê o consentimento **depois** da trava (ou `select ... for share` na linha de consentimento, com `for update` em `set_telemetry_consent`);
  - acrescentar um pgTAP com duas sessões (ou `dblink`).
- **Dona:** E9 (o app da E7 não precisa mudar). **Esforço:** P.

#### M3. A rota do feed não é recortada de novo quando a pessoa cria uma zona de privacidade depois
- **Onde:**
  - `feed_items.route` é gravada uma vez em `svc_apply_v2` (`20261023120900_v2_recording.sql:528-531`);
  - `privacy_zones` só tem o gatilho `privacy_zones_limit`. Consulta em `pg_trigger`: não há gatilho que mexa em `feed_items`.
- **Por que importa:** o caso típico é a pessoa ver a própria rota no feed, perceber que ela passa na porta de casa e criar a zona. A rota antiga continua visível para a crew. O "corte no servidor antes do feed" vale só no instante da gravação.
- **Como reproduzir:** `select tgname from pg_trigger where tgrelid='public.privacy_zones'::regclass and not tgisinternal` → só `privacy_zones_limit`.
- **Correção sugerida:** criar um gatilho `after insert or update` em `privacy_zones` que faça `update feed_items set route = null, route_hidden = true where user_id = new.user_id and route is not null`. Também vale o mesmo para os cards de recap gerados no servidor, se forem guardados no futuro.
- **Dona:** E9. **Esforço:** P.

#### M4. Realtime de `kudos`: os eventos DELETE vão para todos os assinantes, sem RLS
- **Onde:** `supabase/migrations/20261023120800_records_social.sql:189` (`alter publication supabase_realtime add table public.kudos`). A chave primária é `(feed_item_id, user_id)` e a identidade de réplica é a padrão (`relreplident = d`).
- **Por que importa:**
  - a Supabase documenta que, no Postgres Changes, a RLS **não** se aplica a DELETE, e o registro antigo leva a chave primária;
  - qualquer conta logada que assine `kudos` recebe `feed_item_id` + `user_id` de **toda** reação desfeita e de todas as reações apagadas em cascata (item tirado do feed, conta apagada), de todas as crews;
  - `user_id` vira nome pela `public_profiles` (que expõe `id` e `username`).
- **Como reproduzir:** não dá para reproduzir aqui (o banco local não tem o servidor Realtime). A prova é a publicação (`pg_publication_tables`), a chave primária e a regra documentada da Supabase.
- **Correção sugerida:** tirar `kudos` da publicação e avisar por *Broadcast* privado por crew, ou publicar um contador por item sem `user_id`. **Pode ser resolvido pela onda 3** (E8, "Realtime dos aplausos"), mas a publicação já está na migration da E9.
- **Dona:** E9 + E8. **Esforço:** P.

#### M5. "Minha semana" conta como conquista sua uma zona que ficou com um terceiro time
- **Onde:**
  - `supabase/migrations/20261024120100_weekly_recap.sql:31-32` conta `zone_events` `captured` por `user_id`, sem conferir `faction`;
  - `private.v2_zone_event` (`20261023120900_v2_recording.sql:208-213`) grava `user_id = quem correu` também quando o evento `captured` é de **outro** time.
- **Por que importa:** na v2, enfraquecer o dono pode passar a zona para um terceiro time. O card compartilhável diz "N zonas conquistadas" sem que a pessoa tenha conquistado (honestidade, D-76).
- **Como reproduzir** (Deno com o `domain` real):
  - zona dos owls com 4 trechos, volt com 3;
  - um corredor striders passa em 2 trechos dos owls.
  ```
  {"events":[{"type":"captured","faction":"volt","from":"owls"}],"outcome":"pintada",
   "countsAfter":{"striders":2,"owls":2,"volt":3}}
  ```
  `svc_apply_v2` grava esse evento com o `user_id` do corredor striders, e `weekly_recap` conta 1 zona.
- **Correção sugerida:** em `weekly_recap`, contar só `e.faction` igual ao time de quem correu naquela corrida (`join activity_zones az on az.activity_id = e.activity_id and az.outcome = 'conquered'`). Outra opção: `v2_zone_event` gravar `user_id = null` quando `faction <> p_faction`.
- **Dona:** E9. **Esforço:** P.

### BAIXA

| # | Achado | Onde | Prova | Correção | Dona | Esforço |
|---|---|---|---|---|---|---|
| B1 | Duas corridas da mesma pessoa finalizadas ao mesmo tempo: o `+30 run_complete` e os tetos de XP do dia são pagos duas vezes, e o progresso das missões volta (`greatest` com a evidência sem a outra corrida) | `svc_v2_context` (`20261023120900:66-68,128-165`) monta o plano sem trava; `svc_apply_v2:417-447` confia nas `xpLines` | Leitura do código. **Não reproduzido.** A fila do app finaliza uma corrida por vez, e o caso exige 2 aparelhos | Em `svc_apply_v2`, travar o perfil (já trava) e **recalcular** `xpDay` dentro da transação: rejeitar com `ZONE_CONFLICT` se o dia mudou desde o contexto (a function já repete) | E9 | M |
| B2 | `paintedToday` tira os trechos **da própria pessoa** dentro das zonas de privacidade: o HUD ao vivo prevê uma 2ª camada perto de casa | `20261024120000:99` | Leitura (é dado da própria pessoa, não há vazamento) | Não aplicar `cell_in_privacy_zone` em `paintedToday` | E9 | P |
| B3 | Par de demonstração das reações com regra diferente do servidor: conta ações (inclusive a troca de reação); `set_feed_settings(false)` não apaga os itens | `services/api/demo/social.ts:262-275, 300-310` × SQL `react_feed_item`/`set_feed_settings` | Leitura lado a lado | Alinhar depois de M1 (o servidor deve contar ações) | E8/E10 | P |
| B4 | `league_current` mostra a semana nova entre segunda 00:00 e 03:20, quando a anterior ainda está aberta | `20261023120400:226` (`week_start_br(now())`) e `league.ts:53` | Leitura | Usar a semana cuja `closesAt` ainda não passou | E9/E3 | P |

---

## 3. Melhorias sugeridas
- Um teste de propriedade "nenhuma saída pública permite estimar o centro de uma zona de privacidade com erro < raio/2", rodado no `zone_paint_near`, no feed e no recap (fecha A1 e evita a volta do problema).
- Antiabuso com contador de ações por dia, num lugar só, para aplausos, `record_share` e `record_ranking_opened`. Hoje, missão de "compartilhar" se conclui chamando a RPC, sem compartilhar.
- Documentar no `docs/QA.md` a regra "tabela no Realtime não pode ter chave primária com `user_id` se o DELETE for possível".

## 4. O que não deu para verificar
- Realtime de verdade (M4): o banco local não tem o servidor Realtime.
- Jest do app: não rodei, por orientação de CPU (8 equipes na máquina). As regras de React Compiler e Reanimated foram conferidas por busca no código.
- As partes da onda 3 da **E8** (arte no card, `BoraReaction`, Realtime dos aplausos, card de recap) e da **E5** ainda não estavam integradas.
- As telas (`src/app/**`, `features/screens/**`) ficaram fora do escopo. Em `club-ranking.ts`, `crewWeek` depende de quantas linhas a tela carrega do `ranking_runners`, e não conferi a paginação.
