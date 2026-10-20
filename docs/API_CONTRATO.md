# Contrato da API (app ↔ Supabase)

> Dono: **Backend**. O app (frontend e GPS) programa contra este contrato. Qualquer mudança aqui precisa de registro em `DECISOES_TECNICAS.md` e aviso no `PROGRESSO.md`.

Base: `${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/<nome>`. Todas exigem `Authorization: Bearer <JWT do usuário>`.
Erros: HTTP 4xx/5xx com corpo `{ "error": { "code": "<CODIGO>", "message": "<texto em pt-BR>" } }`.

## Edge Functions

### `POST /register-device`
Registra a chave HMAC do aparelho (D-04). Idempotente por `deviceId`.
```json
// req
{ "deviceId": "uuid", "secret": "base64 (32 bytes)", "platform": "ios|android|web", "model": "string?" }
// 200
{ "deviceId": "uuid" }
```

### `POST /ingest-points`
Recebe um lote de pontos de uma corrida (RF-004, RF-005, RNF-006, RNF-009). Cria a atividade na primeira chamada.
```json
// req
{
  "activityId": "uuid", "deviceId": "uuid",
  "startedAt": 1729430000000,            // epoch ms, só usado na criação
  "mission": "livre|fuga|caca", "ghostPace": 330,  // opcionais, criação
  "fromSeq": 0, "toSeq": 49,
  "points": [ { "seq": 0, "lat": -16.7, "lng": -49.2, "t": 1729430000000,
                "accuracy": 5, "speed": 3.1, "altitude": 750, "mocked": false, "steps": 3 } ],
  "signature": "hex HMAC-SHA256(secret, canonical(body sem signature))"
}
// 202
{ "accepted": 50, "duplicates": 0, "lastSeq": 49 }
```
Canonical = `JSON.stringify` com as chaves na ordem: `activityId, deviceId, fromSeq, toSeq, points` e, em cada ponto, `seq, lat, lng, t, accuracy, speed, altitude, mocked, steps` (campos ausentes como `null`).
Códigos: `INVALID_SIGNATURE` (401), `UNKNOWN_DEVICE` (401), `OUT_OF_ORDER` (409: `fromSeq` > último+1), `REPLAY_MISMATCH` (409: mesmo `seq` com conteúdo diferente), `ACTIVITY_CLOSED` (409), `VALIDATION` (400).

### `POST /finish-activity`
Fecha a corrida e calcula o resultado oficial (RF-006, RF-008, RF-010, RN-001..004, RN-007..009).
```json
// req
{ "activityId": "uuid", "endedAt": 1729433600000, "lastSeq": 1799 }
// 200
{
  "activityId": "uuid",
  "status": "valid|partial|rejected|review",
  "meters": 5012, "movingSeconds": 1620, "avgPace": 323,
  "rpTotal": 412, "xp": 180,
  "flags": ["VEHICLE_SPEED"], "invalidSegments": [ { "fromSeq": 120, "toSeq": 160, "reason": "texto pt-BR" } ],
  "zones": [ { "zoneId": "89a8...", "name": "Setor Bueno 3", "meters": 800, "rp": 115,
               "outcome": "conquered|defended|influence|none", "ownerBefore": null, "ownerAfter": "striders" } ],
  "newFogCells": 12, "beatGhost": null, "trust": 100
}
```
Códigos: `MISSING_POINTS` (409: `lastSeq` maior que o recebido — o app deve reenviar a fila), `NOT_OWNER` (403).

### `GET /zones?bbox=minLng,minLat,maxLng,maxLat`
Zonas visíveis (RF-007, RNF-009). Máx. 2.000.
```json
{ "zones": [ { "id": "89a8...", "name": "Setor Bueno 3", "owner": "striders|null", "influence": { "striders": 120, "coyotes": 0, "owls": 40, "volt": 0 },
               "shield": 1, "attacker": "owls|null", "attackStartedAt": 1729430000000, "blocked": false } ] }
```

### `GET /zone?id=<h3>`
Detalhe para a folha da zona: o objeto acima + `topRunners: [{ username, faction, rp }]` (3) + `events: [{ type, faction, at }]` (10).

### `POST /moderate-activity` (só `moderator`/`admin`)
```json
{ "activityId": "uuid", "decision": "approve|reject", "justification": "texto obrigatório (≥ 10 caracteres)" }
```
Recalcula a pontuação e cria notificação para o corredor (RF-018).

### `GET /account-export` · `POST /account-delete`
LGPD (RF-002, RNF-013). Export devolve JSON com perfil, corridas, pontos, contatos e notificações. Delete apaga os dados pessoais e o usuário do Auth (exige `{ "confirm": "EXCLUIR" }`).

## Acesso direto às tabelas (supabase-js + RLS)

| Tabela / view | Cliente pode | Observação |
|---|---|---|
| `profiles` | ler o próprio; ler `public_profiles` (view: username, faction, city, xp); atualizar campos editáveis do próprio | `role`, `trust`, `status` só pelo servidor |
| `activities` | ler as próprias | escrita só pelas functions |
| `safety_contacts` | CRUD dos próprios (máx. 5, trigger) | |
| `notifications` | ler e marcar `read_at` nas próprias | |
| `fog_cells` | ler as próprias | |
| `zones`, `zone_events` | ler tudo | Realtime ligado em `zones` |
| `crews`, `crew_members` | ler; criar crew; entrar por código | RN-011 em trigger |
| `leaderboard_*` (views) | ler | RF-015 |

RPCs (SQL, `security definer` quando preciso): `choose_faction(faction)`, `join_crew(code)`, `leave_crew()`, `mark_notifications_read(ids uuid[])`, `admin_set_user_status(user_id, status)` (admin).
