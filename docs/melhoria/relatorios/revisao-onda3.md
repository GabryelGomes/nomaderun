# Revisão da onda 3 — lógica e segurança (o que mudou desde `092497c`)

> **Revisor independente**, 28/10/2026. Base: `092497c` + merge de `claude/affectionate-gauss-e8gm77`. Nessa branch
> já estão E9, E6a, E6b, E6c, E7 e E4; **E8 e E5 ainda não**. Só revisão, sem correções.
> Detalhe, provas e achados das ondas 1 e 2: `revisor-onda4-logica.md`.

## Testes

| Suíte | Resultado |
|---|---|
| pgTAP, com `NR_PORT=54339 npm run db:test:local` | **805/805** (28 arquivos) |
| Deno das functions | **87 ok**, 1 ignorado |
| Jest | não rodei, por orientação de CPU |

## Achados da onda 3

| Prioridade | Achado | Onde | Prova | Dona |
|---|---|---|---|---|
| **Alta** | O recorte por círculo exato continua no `zone_paint_near` (agora em `cell_in_privacy_zone`, também no `paintedToday`): o buraco na pintura entrega a casa | `20261024120000_paint_today_pause_prefs.sql:37-46, 79, 99` | 58 de 1.519 trechos omitidos; o centro do buraco fica a **3,5 m** do centro da zona (achado A1) | E9 + E3 |
| **Média** | Telemetria: desligar o consentimento durante um envio deixa eventos gravados. `track_events` confere o consentimento antes da trava, e `set_telemetry_consent` não trava | `20261024120200_telemetry.sql` (`track_events`, `set_telemetry_consent`) | 2 conexões: `consentimento=false eventos_que_sobraram=2` (M2) | E9 |
| **Média** | `weekly_recap` conta como conquista da pessoa a zona que a corrida dela passou para um **terceiro** time | `20261024120100_weekly_recap.sql:31-32` + `v2_zone_event` | Deno: `captured faction=volt` numa corrida striders, gravado com o `user_id` dela (M5) | E9 |
| Baixa | `paintedToday` esconde os trechos **da própria pessoa** dentro das zonas de privacidade: o HUD prevê uma 2ª camada perto de casa | `20261024120000:99` | Leitura | E9 |

**Sem achado:**
- `notification_prefs` com CHECK booleano e `notify_pref` tolerante;
- `pauseAvailable`, que segue as mesmas condições de `start_health_pause`;
- `weekly-recap`:
  - corta com `clipRouteForSharing`;
  - responde por lista branca, sem ids nem zonas;
  - confere o dono da corrida;
  - valida a data;
- telemetria:
  - lista fechada e `props` validado;
  - retenção de 30 dias;
  - LGPD (`export_v2_tables` e cascata);
  - opt-in desligado por padrão;
- app:
  - `telemetry-repo` e o par de demonstração;
  - `live-paint.ts` (`reseed` com deslocamento e `paintedToday` acumulado);
  - `official-cache.ts`;
  - `summary-extras`;
  - `first-conquest.ts`, que só é épico com o dado real.

## Continuam abertos, das ondas 1 e 2
- M1: o teto de 200 aplausos é burlável alternando a reação, e o aviso do autor volta a ficar não lido.
- M3: a rota do feed não é recortada de novo quando a pessoa cria uma zona de privacidade.
- M4: o DELETE de `kudos` no Realtime vaza o `user_id`. Pode ser resolvido junto com o Realtime dos aplausos da E8.
