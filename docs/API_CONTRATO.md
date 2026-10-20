# Contrato da API (app ↔ Supabase)

> Dono: **Backend (A2)**. O app (frontend e GPS) programa contra este contrato. Qualquer mudança aqui precisa de registro em `DECISOES_TECNICAS.md` e aviso no `PROGRESSO.md`.
> Última revisão: 2026-10-20 (T1.1–T1.3, implementado e testado: pgTAP, Deno e e2e).

Base das functions: `${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/<nome>`. Todas exigem `Authorization: Bearer <JWT do usuário>` (o servidor confere o token no Auth a cada chamada; conta excluída ou banida recebe 401).
Erros: HTTP 4xx/5xx com corpo `{ "error": { "code": "<CODIGO>", "message": "<texto em pt-BR>", "details"?: { ... } } }`. O campo `details` é opcional (hoje só `lastSeq`, ver ingest/finish).
Códigos comuns a todas: `UNAUTHORIZED` (401), `VALIDATION` (400, mensagem diz o campo), `METHOD_NOT_ALLOWED` (405), `INTERNAL` (500). CORS liberado (`*`) para o app web.

Local: `http://127.0.0.1:54321` (ver `PROGRESSO.md` para as chaves). Datas nas functions são **epoch ms**; nas tabelas, `timestamptz` (ISO).

## Cadastro (Supabase Auth) — RF-001

`supabase.auth.signUp({ email, password, options: { data } })`, senha com **mínimo de 8** caracteres. O trigger `handle_new_user` cria o perfil lendo `data`:

```json
{ "username": "ana_corre", "birthdate": "2000-05-31", "accepted_terms": true, "accepted_privacy": true, "city": "Goiânia" }
```
- Aceita também `terms_accepted` / `privacy_accepted`. `city` é opcional; campos extras (versões e instantes dos aceites) são ignorados pelo banco.
- O banco **recusa** (o Auth devolve só `500 "Database error saving new user"`): menos de 16 anos (`AGE_UNDER_16`), sem data (`BIRTHDATE_REQUIRED`/`BIRTHDATE_INVALID`), sem algum dos aceites (`TERMS_REQUIRED`), nome fora de `^[A-Za-z0-9_.]{3,20}$` (`USERNAME_INVALID`) ou já usado sem diferenciar maiúsculas (`USERNAME_TAKEN`). Por isso o app valida antes e chama `rpc('username_available', { p_username })` (liberado também para `anon`).
- Confirmação de e-mail desligada no MVP (D-21): `signUp` já devolve a sessão.
- JWT de 1 h (`expires_in: 3600`) com rotação de refresh token. Recuperação: `resetPasswordForEmail(email, { redirectTo })` com `redirectTo` em `nomaderun://**`, `exp://**` ou `http://localhost:8081/**`; o e-mail sai em português.

## Edge Functions

### `POST /register-device`
Registra (ou renova) a chave HMAC do aparelho (D-04). Idempotente por `deviceId`.
```json
// req
{ "deviceId": "uuid", "secret": "base64 de exatamente 32 bytes", "platform": "ios|android|web", "model": "string? (≤ 100)" }
// 200
{ "deviceId": "uuid" }
```
Códigos: `DEVICE_TAKEN` (409: o `deviceId` já pertence a outra conta — gere outro UUID).

### `POST /ingest-points`
Recebe um lote de pontos de uma corrida (RF-004, RF-005, RNF-006, RNF-009). Cria a atividade na primeira chamada (qualquer lote, não só o `fromSeq = 0`). Responde rápido: o cálculo só acontece no `finish-activity`.
```json
// req
{
  "activityId": "uuid", "deviceId": "uuid",
  "startedAt": 1729430000000,            // epoch ms, opcional, só usado na criação (padrão: t do 1º ponto do lote)
  "mission": "livre|fuga|caca", "ghostPace": 330,  // opcionais, só na criação; ghostPace em s/km (60–3600)
  "fromSeq": 0, "toSeq": 49,
  "points": [ { "seq": 0, "lat": -16.7, "lng": -49.2, "t": 1729430000000,
                "accuracy": 5, "speed": 3.1, "altitude": 750, "mocked": false, "steps": 3 } ],
  "signature": "hex HMAC-SHA256(secret, canonical(body))"
}
// 202
{ "accepted": 50, "duplicates": 0, "lastSeq": 49 }
```
Regras de validação (`VALIDATION`, 400): 1 a **500** pontos por lote; `toSeq - fromSeq + 1 = points.length`; `points[i].seq = fromSeq + i`; `lat` ∈ [-90, 90], `lng` ∈ [-180, 180]; `t` inteiro em ms, a partir de 2020 e no máximo 24 h no futuro, sem voltar no tempo dentro do lote; `accuracy ≥ 0`; `steps` inteiro ≥ 0 (passos desde o ponto anterior; **ausente = aparelho sem pedômetro**); `mocked` booleano. `accuracy`, `speed`, `altitude`, `mocked`, `steps` podem ser omitidos ou `null`.

**Canonical** (o que é assinado) = `JSON.stringify` de um objeto com as chaves nesta ordem: `activityId, deviceId, fromSeq, toSeq, points` e, em cada ponto, `seq, lat, lng, t, accuracy, speed, altitude, mocked, steps` (ausentes como `null`). `startedAt`, `mission`, `ghostPace` e `signature` **não** entram. Os UUIDs são assinados exatamente como enviados. Assinatura em hexadecimal (maiúsculas ou minúsculas); o servidor compara em tempo constante.

**Vetor de teste** (confira a implementação do app com ele; está em `supabase/functions/tests/fixtures.ts` e foi conferido com Python `hmac`/`hashlib`):
```
secret (base64): AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=      (bytes 0x00..0x1f)
corpo:
{ "activityId": "3f2b6c1e-8d4a-4b7e-9c2f-1a5e6d7c8b90", "deviceId": "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
  "fromSeq": 0, "toSeq": 1,
  "points": [ { "seq": 0, "lat": -16.7097, "lng": -49.2388, "t": 1760000000000, "accuracy": 5, "speed": 3.1, "altitude": 750, "mocked": false, "steps": 3 },
              { "seq": 1, "lat": -16.70975, "lng": -49.23885, "t": 1760000001000, "accuracy": 4.5 } ] }
canonical:
{"activityId":"3f2b6c1e-8d4a-4b7e-9c2f-1a5e6d7c8b90","deviceId":"9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a","fromSeq":0,"toSeq":1,"points":[{"seq":0,"lat":-16.7097,"lng":-49.2388,"t":1760000000000,"accuracy":5,"speed":3.1,"altitude":750,"mocked":false,"steps":3},{"seq":1,"lat":-16.70975,"lng":-49.23885,"t":1760000001000,"accuracy":4.5,"speed":null,"altitude":null,"mocked":null,"steps":null}]}
assinatura (hex): 5457a0235e4794a5232a7c72cbbf84c7ef9d2a62aeac1a43996102fbd31dafcc
```

Idempotência (D-03): `(activityId, seq)` é único. Reenviar um lote idêntico (ou com parte já recebida) → 202 com `duplicates` > 0 e só os novos gravados.

| Código | HTTP | Quando | O app deve |
|---|---|---|---|
| `UNKNOWN_DEVICE` | 401 | aparelho não registrado nesta conta | chamar `register-device` e reenviar |
| `INVALID_SIGNATURE` | 401 | HMAC não confere | conferir canonical/chave; não insistir com o mesmo corpo |
| `OUT_OF_ORDER` | 409 | `fromSeq` > último recebido + 1 | reenviar a partir de `details.lastSeq + 1` |
| `REPLAY_MISMATCH` | 409 | mesmo `seq` com conteúdo diferente | tratar como bug/fraude; não sobrescreve |
| `ACTIVITY_CLOSED` | 409 | corrida já finalizada | descartar o lote (`details.lastSeq`) |
| `DEVICE_MISMATCH` | 409 | corrida começou em outro aparelho | — |
| `NOT_OWNER` | 403 | `activityId` é de outra conta | gerar outro UUID |
| `ACCOUNT_INACTIVE` | 403 | conta inativada pelo admin | — |

### `POST /finish-activity`
Fecha a corrida e calcula o resultado oficial com o **mesmo** `src/domain` do app (RF-006, RF-008, RF-010, RN-001..004, RN-007..009, RN-016). Idempotente: chamar de novo devolve o mesmo resultado.
```json
// req
{ "activityId": "uuid", "endedAt": 1729433600000, "lastSeq": 1799 }   // endedAt opcional (padrão: t do último ponto)
// 200
{
  "activityId": "uuid",
  "status": "valid|partial|rejected|review",
  "meters": 5012, "movingSeconds": 1620, "avgPace": 323,          // avgPace em s/km; null se não houve trecho válido
  "rpTotal": 412, "xp": 180,
  "flags": ["VEHICLE_SUSPECTED"],
  "invalidSegments": [ { "fromSeq": 120, "toSeq": 160, "code": "VEHICLE_SUSPECTED",
                         "reason": "Velocidade de veículo por mais de 30 segundos. O trecho não conta." } ],
  "zones": [ { "zoneId": "89a8...", "name": "Setor Bueno 3", "meters": 800, "rp": 115,
               "outcome": "conquered|defended|influence|none", "ownerBefore": null, "ownerAfter": "striders" } ],
  "newFogCells": 12, "beatGhost": null, "trust": 100,
  "review": null      // ou { "reason": "LOW_TRUST|TRUST_SUSPENDED|SUSPENDED|NO_PEDOMETER_LONG_RUN", "message": "texto pt-BR" }
}
```
- `status`: `rejected` = localização simulada (nada pontua); `review` = vai para a moderação e **não pontua** até ser aprovada (`rpTotal = 0`, `xp = 0`, `zones = []`); `partial` = parte dos trechos foi invalidada.
- `review.reason`: `LOW_TRUST` (índice < 40 antes ou depois desta corrida, RN-009), `TRUST_SUSPENDED` (índice ficou < 10: suspenso 30 dias), `SUSPENDED` (conta já suspensa), `NO_PEDOMETER_LONG_RUN` (sem pedômetro e > 10 km, RN-008).
- `trust` é o Índice de Confiança depois da corrida. `flags` usa os códigos do domain (`MOCK_LOCATION`, `TELEPORT`, `POINT_SPEED`, `VEHICLE_SUSPECTED`, `NO_STEPS`, `NO_PEDOMETER`); a explicação pt-BR vem em `invalidSegments[].reason` (`FLAG_EXPLANATION`).
- `name` nunca é nulo: zona sem nome (criada na primeira corrida numa região nova, RF-020) vem como `"Zona XXXX"` (4 caracteres do índice H3).
- Efeitos: zonas criadas/atualizadas (Realtime avisa o mapa), `activity_zones`, `zone_events`, XP, trust, neblina, notificações (invasão, território perdido, zona conquistada).

Códigos: `MISSING_POINTS` (409: `lastSeq` maior que o recebido — reenviar a fila a partir de `details.lastSeq + 1`), `NOT_OWNER` (403), `FACTION_REQUIRED` (409: escolha a facção antes), `ACTIVITY_CLOSED` (409), `BUSY` (503: muitas corridas na mesma área ao mesmo tempo; tente de novo), `ACCOUNT_INACTIVE` (403).

### `GET /zones?bbox=minLng,minLat,maxLng,maxLat`
Zonas visíveis (RF-007, RNF-009; índice GiST). Máx. 2.000. Caixa de no máximo 1 grau por lado (senão `VALIDATION`).
```json
{ "zones": [ { "id": "89a8...", "name": "Setor Bueno 3", "city": "Goiânia", "owner": "striders|null",
               "influence": { "striders": 120, "coyotes": 0, "owls": 40, "volt": 0 },
               "shield": 1, "attacker": "owls|null", "attackStartedAt": 1729430000000, "blocked": false } ] }
```
A mesma consulta existe como RPC: `rpc('zones_in_bbox', { min_lng, min_lat, max_lng, max_lat })` (datas ISO, `name` pode ser nulo).

### `GET /zone?id=<h3>`
Detalhe para a folha da zona: o objeto acima + `updatedAt` + `topRunners: [{ username, faction, rp }]` (3 maiores da temporada) + `events: [{ type, faction, from, at }]` (10 últimos; `type` ∈ `captured | under_attack | defended | neutralized | shield_up | shield_down`). `NOT_FOUND` (404) se ninguém correu ali ainda.

### `POST /moderate-activity` (só `moderator`/`admin`)
```json
// req
{ "activityId": "uuid", "decision": "approve|reject", "justification": "texto obrigatório (10 a 1000 caracteres)" }
// 200 (approve)
{ "activityId": "uuid", "decision": "approve", "status": "valid|partial", "result": { ...mesmo formato do finish-activity } }
// 200 (reject)
{ "activityId": "uuid", "decision": "reject", "status": "rejected" }
```
Aprovar recalcula a pontuação com o estado atual das zonas (ignora o trust) e aplica; rejeitar zera. Os dois gravam `moderation_reviews` e notificam o corredor (RF-018). Códigos: `FORBIDDEN` (403: não é staff ou é a própria corrida), `NOT_FOUND` (404), `NOT_IN_REVIEW` (409), `CANNOT_APPROVE` (409: localização simulada).
Lista para o painel: `from('activities').select('*').eq('status','review')` (staff lê todas) e `from('activity_points')` para o percurso.

### `GET /account-export` · `POST /account-delete`
LGPD (RF-002, RNF-013). Export devolve JSON (com `Content-Disposition` de anexo) com e-mail, perfil, aparelhos (sem segredo), corridas com pontos e zonas, contatos, notificações, neblina, baús, crew e decisões de moderação. Delete exige `{ "confirm": "EXCLUIR" }`, apaga a foto do Storage e o usuário do Auth; o resto cai em cascata (a influência já somada nas zonas fica, por ser agregada). Resposta: `{ "deleted": true }`.

## Acesso direto às tabelas (supabase-js + RLS)

`anon` não lê nenhuma tabela (só `username_available`). Para usuários logados:

| Tabela / view | Cliente pode | Observação |
|---|---|---|
| `profiles` | ler o próprio (staff lê todos); atualizar **só** `username`, `city`, `avatar_url`, `units` (`km`/`mi`), `notification_prefs` | `role`, `trust`, `status`, `xp`, `faction`, `streak_weeks` só pelo servidor (UPDATE nessas colunas = `42501`). Cidade natal: 1 troca por temporada (`CITY_CHANGE_LIMIT`, RN-013). `notification_prefs` = `{ invasion, conquest, moderation, missions }` (booleans) |
| `public_profiles` (view) | ler | `id, username, faction, city, xp, avatar_url, created_at, crew_id, crew_tag`; contas inativas não aparecem |
| `devices` | ler os próprios | sem a coluna `secret` |
| `activities`, `activity_points`, `activity_zones` | ler os próprios (staff lê todos) | escrita só pelas functions. `activities.result` guarda a resposta oficial do `finish-activity` |
| `safety_contacts` | CRUD dos próprios (`name`, `phone`) | máx. 5 (`CONTACTS_LIMIT`); `phone` aceita `+`, dígitos, espaço, `()` e `-` (8–20) |
| `notifications` | ler e marcar `read_at` nas próprias | `type` ∈ `invasion, territory_lost, conquest, moderation, mission, system`; `data` traz `zoneId`, `lat`, `lng` (abrir o mapa na zona, RF-009) ou `activityId` |
| `fog_cells`, `chest_opens` | ler as próprias | escrita pelo servidor (neblina no finish; baús ficam para T3.5) |
| `zones`, `zone_events` | ler tudo | Realtime ligado em `zones`. Em `zone_events` não há `user_id`/`activity_id` para o cliente (privacidade de percurso) |
| `crews` | ler; criar com `insert({ name, tag })` (líder = você, facção = a sua, `invite_code` gerado); líder renomeia/apaga | sigla 3–5 letras (vira maiúscula). RN-011 em trigger: `FACTION_REQUIRED`, `ALREADY_IN_CREW` |
| `crew_members` | ler; sair (`delete` da própria linha) ou o líder remover membro | entrada só por `join_crew`. Se o líder sai, o membro mais antigo assume; crew vazia é apagada |
| `moderation_reviews` | staff lê tudo; o corredor lê as das próprias corridas | |
| `seasons` | ler | temporada atual = mês de Brasília (`AAAA-MM`) |
| `leaderboard_individual` | ler | `position, user_id, username, faction, city, crew_tag, rp, meters, runs` (temporada) |
| `leaderboard_crews` | ler | `position, crew_id, name, tag, faction, rp, members` |
| `leaderboard_factions` | ler | `position, faction, rp, runners, zones` |
| `leaderboard_cities` | ler | `position, city, rp, active_runners, eligible, score` — RN-013: `score = rp / √ativos`, nulo com menos de 20 corredores ativos |

Storage: bucket público **`avatars`** (até 2 MB, JPEG/PNG/WebP). Cada usuário grava só em `avatars/<seu user id>/<arquivo>`; depois salve a URL pública em `profiles.avatar_url`.

## RPCs (`supabase.rpc`)

| RPC | Parâmetros | Retorno | Erros (`CODIGO: texto`) |
|---|---|---|---|
| `username_available` | `p_username` | `boolean` | — (anon também) |
| `choose_faction` | `p_faction` | `{ faction, factionChangedSeason, canChangeThisSeason }` | `INVALID_FACTION`, `FACTION_CHANGE_LIMIT` (1 troca por temporada; a 1ª escolha não conta). Trocar zera a contribuição pessoal da temporada e tira da crew (RF-003, RN-011) |
| `join_crew` | `p_code` | `{ crewId, name, tag, faction }` | `CREW_NOT_FOUND`, `ALREADY_IN_CREW`, `CREW_FACTION_MISMATCH`, `CREW_FULL` (30) |
| `leave_crew` | — | `boolean` | — |
| `mark_notifications_read` | `ids uuid[]` (nulo = todas) | `integer` (quantas) | — |
| `admin_set_user_status` | `p_user_id`, `p_status` (`active|inactive|suspended`) | `{ userId, status }` | `FORBIDDEN` (só admin; não altera o próprio), `INVALID_STATUS`, `NOT_FOUND`. `inactive` bloqueia o login; `suspended` = fora da competição por 30 dias |
| `zones_in_bbox` | `min_lng, min_lat, max_lng, max_lat` | linhas de `zones` (sem geometria) | — |
| `is_staff` / `is_admin` | — | `boolean` | — |

Erros de RPC chegam do PostgREST com `message = "CODIGO: texto em pt-BR"` (separe no primeiro `": "`).

## Jobs no servidor (pg_cron, horário de Brasília)

| Job | Quando | Regra |
|---|---|---|
| `job_fortify_zones` | todo dia 00:05 | RN-004: dono com ≥ 500 m no dia anterior sobe o escudo (máx. 3); dia sem corrida do dono desce 1 |
| `job_decay_zones` | todo dia 03:00 | RN-005: influência × 0,90; < 5 vira 0; dono < 30 perde a zona |
| `job_close_week` | segunda 00:10 | RN-014: 2+ corridas válidas na semana somam 1 à sequência; senão gasta congelamento ou zera |
| `job_season_rollover` | dia 1, 00:15 | RN-006: abre a temporada, influência × 0,30, devolve o congelamento mensal |
