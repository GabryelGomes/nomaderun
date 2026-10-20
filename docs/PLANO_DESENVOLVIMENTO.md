# Plano de desenvolvimento — MVP NOMADE RUN

> Dono: **Coordenação/Documentação**. Atualize o status das tarefas aqui ao concluir cada uma.
> Base: ERS v1.0 (27 RF, 15 RNF, 19 RN). Arquitetura: `ARQUITETURA.md`. Contrato: `API_CONTRATO.md`.

## 1. Objetivo do MVP

Demonstrar na faculdade, de ponta a ponta e com dados reais no banco: **criar conta → escolher facção → correr (GPS real ou simulação) → sincronizar (inclusive após ficar sem internet) → servidor valida e pontua → zona conquistada aparece no mapa de todos → histórico, ranking, alertas, Corrida Segura e moderação no painel web**, sem mudar o visual aprovado.

## 2. Prioridades (MoSCoW)

| Nível | Requisitos | Critério |
|---|---|---|
| **P0 — obrigatório** | RF-001, RF-002, RF-003, RF-004, RF-005, RF-006, RF-007, RF-008, RF-010, RF-021, RF-024; RN-001..004, RN-007..009, RN-011; RNF-006, RNF-007, RNF-008, RNF-013 | Sem isso não há demonstração |
| **P1 — importante** | RF-009, RF-012, RF-015, RF-018, RF-019, RF-022, RF-023, RF-025, RF-011 (básico), RF-020; RN-005, RN-010, RN-012..014, RN-016, RN-017, RN-019; RNF-010..012, RNF-015 | Entra se P0 estiver verde |
| **P2 — desejável** | RF-013, RF-014, RF-016, RF-017, RF-026, RF-027; RN-006, RN-015, RN-018 | Versão simples ou dados de demonstração identificados |
| **Fora do MVP** | Medição de RNF-001 (k6 contra produção), RNF-004 (bateria), RNF-002/003 medidos em aparelho; login Google/Apple com credenciais reais | Documentados como pendência |

## 3. Equipe de agentes e responsabilidades

| Agente | Responsável por | Pastas que pode alterar |
|---|---|---|
| **A1 Arquiteto** | arquitetura, decisões, padrões, revisão de integração, `src/domain` | `docs/ARQUITETURA.md`, `docs/DECISOES_TECNICAS.md`, `apps/mobile/src/domain/**`, configs raiz |
| **A2 Backend** | banco, RLS, Edge Functions, regras no servidor, seed, testes SQL/Deno | `supabase/**`, `docs/API_CONTRATO.md` |
| **A3 Frontend/mobile** | auth, perfil, LGPD, telas novas, integração das telas com a API, painel de moderação | `apps/mobile/src/app/**`, `src/features/screens/**`, `src/features/auth/**`, `src/features/moderation/**`, `src/components/**` (sem mudar o visual), `src/store/**`, `src/services/api/**`, `src/services/auth/**` |
| **A4 GPS e integrações** | sessão de corrida, GPS e permissões, pedômetro, fila offline, sync, HMAC, Corrida Segura, voz, notificações | `src/features/run/**`, `src/features/safety/**`, `src/services/location/**`, `src/services/offline/**`, `src/services/sync/**`, `src/services/signing/**`, `src/services/sensors/**`, `src/services/notifications/**`, `src/services/safety/**` |
| **A5 QA e segurança** | testes, validação de requisitos, revisão de segurança (OWASP/RLS), Maestro | `**/__tests__/**`, `supabase/tests/**`, `apps/mobile/.maestro/**`, `docs/QA.md`; correções só de testes — bugs viram tarefa para o dono |
| **A6 Documentação e coordenação** | progresso, requisitos, README, guia de execução/apresentação | `README.md`, `docs/*.md` (exceto os de dono acima) |

Arquivos compartilhados (`package.json`, `app.json`, `src/app/_layout.tsx`): quem precisar mexer registra no `PROGRESSO.md` o que mudou; nunca dois agentes ao mesmo tempo (a coordenação serializa).

## 4. Fases, tarefas e dependências

Legenda de status: ⬜ a fazer · 🟨 em andamento · ✅ feito · ⛔ bloqueado

### Fase 0 — Análise e base (A1, A6)
| ID | Tarefa | Dono | Depende | Status |
|---|---|---|---|---|
| T0.1 | Analisar ERS e código; medir baseline (60 testes, tipos e lint ok) | A1 | — | ✅ |
| T0.2 | Instalar skills (find-skills + por área) em `.claude/skills` | A1 | — | ✅ |
| T0.3 | Arquitetura, decisões, contrato da API, plano, checklist de requisitos | A1/A6 | T0.1 | ✅ |

### Fase 1 — Infraestrutura (paralelo: A2 ‖ A3)
| ID | Tarefa | Dono | Depende | Status |
|---|---|---|---|---|
| T1.1 | `supabase/` init, config (JWT 1 h, rate limit, e-mail), migrations: esquema completo, RLS, índices GiST, triggers (idade, ≤5 contatos, RN-011), views de ranking | A2 | T0.3 | ✅ |
| T1.2 | Edge Functions do contrato usando `src/domain` (D-02), HMAC (D-04), idempotência (D-03) | A2 | T1.1 | ✅ |
| T1.3 | Seed de demonstração (Goiânia), usuário moderador de demo; testes pgTAP (RLS) e Deno | A2 | T1.2 | ✅ |
| T1.4 | Cliente supabase + storage seguro (D-06), `.env.example`, camada de repositórios e erros tipados | A3 | T0.3 | ✅ |
| T1.5 | Telas de auth (login, cadastro com 16+ e termos, recuperar senha), consentimentos, guarda de rotas, persistência da sessão | A3 | T1.4 | ✅ |
| T1.6 | Onboarding ligado ao servidor (facção via RPC), perfil editável, exportar/excluir conta | A3 | T1.5 | ✅ |

### Fase 2 — Corrida de ponta a ponta (A4, depois integração A3)
| ID | Tarefa | Dono | Depende | Status |
|---|---|---|---|---|
| T2.1 | Serviço de localização: permissões com explicação, GPS fraco (E3), erros, flag de segundo plano, keep-awake | A4 | T1.4 | ✅ |
| T2.2 | Fila offline SQLite + sync assinada (HMAC) + reenvio idempotente + estado "provisório" | A4 | T1.2, T1.4 | ✅ |
| T2.3 | Pedômetro (RN-008) e pontos com velocidade/altitude | A4 | T2.1 | ✅ |
| T2.4 | Finalizar corrida → `finish-activity` → resumo oficial; fallback provisório | A4 | T2.2 | ✅ |
| T2.5 | Corrida Segura: contatos (≤5), SOS (compartilhar localização), alerta de parada 10 min + 60 s | A4 | T1.4 | ✅ |
| T2.6 | Mapa com zonas do servidor (bbox) + Realtime; histórico do servidor com filtro por período | A3 | T1.2 | ✅ (mapa e folha da zona; o histórico ficou com o A4 nesta fase, `activities-screen`) |

### Fase 3 — Funcionalidades P1 (A3 ‖ A4 ‖ A2 conforme pastas)
| ID | Tarefa | Dono | Depende | Status |
|---|---|---|---|---|
| T3.1 | Central de notificações (RF-019) + alerta de invasão no app (RF-009) | A3 + A2 | T2.4 | ✅ (A2 ligou o Realtime da tabela, P-13; A3: Realtime com consulta só de fallback, P-24 ✅) |
| T3.2 | Rankings reais (RF-015) e placar entre cidades (RF-020) | A3 + A2 | T2.4 | ✅ (A2: semana/temporada e geral/facção/cidade/distrito nas RPCs `ranking_*`, P-16; A3: filtros na tela, P-25 ✅) |
| T3.3 | Painel de moderação web (RF-018) | A3 | T1.2 | ✅ |
| T3.4 | Crews básicas (RF-011) | A3 + A2 | T1.6 | ✅ |
| T3.5 | Neblina e baús persistidos (RF-022, RF-023) | A4 + A2 | T2.4 | ✅ (A2: sorteio diário `daily_chests` e abertura validada no `finish-activity`; Caça no app usa os baús do servidor com fallback local, P-12/P-19) |
| T3.6 | Jobs diários (RN-005 decaimento, RN-004 escudo) com pg_cron | A2 | T1.1 | ✅ |
| T3.7 | Pendências do backend: M_grupo (RN-001), zona de privacidade (RN-010), nomes de zonas novas, limites RN-003 conferidos, deploy (P-08: `supabase/DEPLOY.md`, bundle verificado, plano B pronto) | A2 | T3.6 | ✅ (deploy real no Cloud depende de conta: P-08) |
| T3.8 | Pendências do app da Fase 3: notificações pelo Realtime (P-24), filtros semana/distrito no Clube (P-25), tela de zonas de privacidade (P-27), trechos inválidos em cinza no resumo (P-20, exceção autorizada) | A3 | T3.7 | ✅ |

### Fase 4 — Qualidade e segurança (A5)
| ID | Tarefa | Dono | Depende | Status |
|---|---|---|---|---|
| T4.1 | Cobertura do domain ≥ 90% (linhas e ramos), testes dos services | A5 | Fase 2 | ✅ (100% linhas, 99,6% ramos; limite no Jest; testes de propriedade) |
| T4.2 | Revisão de segurança (OWASP Top 10, RLS por tabela, segredos, HMAC) com relatório em `docs/QA.md` | A5 | Fase 2 | ✅ (0 Alto, 4 Médios QA-01..04 → P-29..P-32) |
| T4.3 | Matriz de rastreabilidade RF/RN → teste; fluxos Maestro UC-01..03; testIDs | A5 | Fase 3 | ✅ (Maestro falta rodar em aparelho, P-07) |
| T4.4 | Teste de integração ponta a ponta contra o Supabase local (cadastro → corrida → zona) | A5 | Fase 2 | ✅ (todas as suítes verdes; Playwright 12/12 + comparação de imagem) |

### Fase 5 — Entrega (A6, A1)
| ID | Tarefa | Dono | Depende | Status |
|---|---|---|---|---|
| T5.1 | README e `docs/COMO_APRESENTAR.md` (subir backend, rodar app, roteiro da demo, contas de teste) | A6 | Fase 4 | ⬜ |
| T5.2 | Validação final do fluxo completo e atualização de REQUISITOS/PROGRESSO | A1/A6 | T5.1 | ⬜ |

## 5. Critérios de conclusão (Definition of Done) de toda tarefa

1. Código segue as camadas de `ARQUITETURA.md`; sem segredo no código.
2. `npm run typecheck`, `./node_modules/.bin/eslint src` e `npm test` verdes em `apps/mobile`; backend: migrations aplicam do zero e os testes SQL/Deno passam.
3. Elementos interativos novos têm `testID` e `accessibilityLabel` em português.
4. Nenhuma mudança visual em tela existente além do necessário (D-15).
5. `PROGRESSO.md` atualizado (o que foi feito, arquivos, testes, problemas, pendências, instruções para o próximo) e `REQUISITOS.md` com o novo status.
