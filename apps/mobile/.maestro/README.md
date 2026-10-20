# Fluxos Maestro (RNF-012)

| Arquivo | Caso | O que confere |
|---|---|---|
| `01-cadastro-onboarding.yaml` | RF-001, RF-003, RNF-013 | cadastro 16+ com aceites → onboarding (nome, time, localização, notificações) → mapa |
| `02-login.yaml` | RF-001 | senha errada mostra "E-mail ou senha incorretos."; senha certa abre o mapa |
| `03-uc03-mapa-camadas-zona.yaml` | UC-03 | zonas do servidor, filtros de camada, folha da zona (dono, corredores, eventos) |
| `04-uc02-alerta-invasao.yaml` | UC-02 | alerta no mapa e na central de notificações abre a zona atacada |
| `05-uc01-corrida-simulada.yaml` | UC-01 | conta nova → Correr → Simulação → conquista garantida → segurar 600 ms → resumo oficial com "Zona conquistada" |

## Como rodar

1. Backend local limpo: na raiz, `npm run db:reset` (seed com as contas de demonstração e a zona sob ataque), espere ~15 s (P-22) e deixe `npm run functions:serve` rodando.
2. App: em `apps/mobile`, `.env` apontando para o IP da máquina (não `127.0.0.1` no aparelho) e `npx expo start`.
3. Aparelho/emulador com o Expo Go (ou development build) e o [Maestro CLI](https://maestro.mobile.dev) instalado.
4. Em `apps/mobile`:

```bash
# Expo Go
maestro test -e APP_ID=host.exp.exponent -e APP_URL=exp://192.168.0.10:8081 .maestro/
# development build
maestro test -e APP_ID=<bundle id> -e APP_URL=nomaderun:// .maestro/
# um fluxo só
maestro test -e APP_ID=host.exp.exponent -e APP_URL=exp://192.168.0.10:8081 .maestro/04-uc02-alerta-invasao.yaml
```

Opcional: `-e DEMO_EMAIL=... -e DEMO_PASSWORD=...` para outra conta nos fluxos UC-02/UC-03.

Os IDs usados aqui são conferidos contra o código por `src/__tests__/testids.test.ts` (roda no `npm test`): se uma tela perder ou renomear um `testID`, o teste aponta o fluxo quebrado antes de chegar ao aparelho.
