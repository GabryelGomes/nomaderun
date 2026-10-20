# Checklist de requisitos (ERS v1.0)

> Atualize a linha ao concluir uma tarefa: status, onde está e como foi testado.
> Status: ✅ feito · 🟡 parcial · ⬜ não iniciado · ➖ fora do MVP (justificado)
> Prioridade MVP: P0 / P1 / P2 (ver `PLANO_DESENVOLVIMENTO.md`).

**Baseline (2026-10-20):** o protótipo tinha as telas e as regras no `src/domain` (60 testes), mas sem login, sem banco e sem servidor; o estado era só em memória e se perdia ao fechar o app.

## Requisitos funcionais

| ID | Requisito | MVP | Status | Onde / como foi testado |
|---|---|---|---|---|
| RF-001 | Autenticação (e-mail/senha, JWT 1 h, recuperação, 16+, termos) | P0 | ✅ | App: `/entrar`, `/cadastro` (16+, termos e privacidade separados, nome único via `username_available`), `/recuperar-senha` → `nomaderun://nova-senha`; sessão no SecureStore com refresh automático (JWT 1 h do backend). Testes: `validation.test.ts`, `auth-repo.test.ts`, `integration.local.test.ts` (cadastro real, menor de 16 recusado), fluxo web com Playwright. Google/Apple: código pronto atrás de `EXPO_PUBLIC_AUTH_PROVIDERS`, sem credenciais reais (P-06) Servidor (A2): trigger `handle_new_user` recusa menos de 16 anos, falta de aceite e nome inválido/repetido (pgTAP `02_signup_trigger`, e2e); JWT 3600 s com rotação de refresh; senha ≥ 8; e-mail de recuperação em pt-BR (D-21). |
| RF-002 | Gestão de usuários (perfil, exportar, excluir, admin inativa) | P0 | 🟡 | App: `/perfil/editar` (nome 3–20 único, cidade, km/milhas, preferências de notificação) e `/perfil/conta` (exportar JSON via `account-export`, excluir com EXCLUIR via `account-delete`, sair). Testado em `integration.local.test.ts` e no fluxo web. Falta: foto (iniciais por enquanto, P-03) e tela de admin para inativar contas (painel de moderação, T3.3) Servidor (A2): `admin_set_user_status` (inativa e bloqueia o login; pgTAP `06`), `account-export`/`account-delete` (e2e; a exclusão apaga também a foto), bucket `avatars` com RLS por pasta (e2e) — falta só a tela de upload (P-03). |
| RF-003 | Escolha de facção (troca 1×/temporada) | P0 | 🟡 | Onboarding grava a facção pelo RPC `choose_faction` (troca 1×/temporada validada no servidor); guarda de rotas manda para o onboarding quem não tem facção. Testado em `auth-repo.test.ts`, `route-guard.test.ts`, `integration.local.test.ts`. Falta: tela para trocar de facção depois do onboarding Servidor: troca 1×/temporada, zera a contribuição pessoal e tira da crew (pgTAP `05`). |
| RF-004 | Registro de corrida (GPS 1 s, pausa, auto-pausa) | P0 | 🟡 | `use-run-session.ts` + `run-engine.ts` (GPS em primeiro plano e simulação); falta pedômetro, velocidade/altitude e segundo plano |
| RF-005 | Gravação sem internet | P0 | 🟡 | Servidor pronto (A2): ingestão idempotente `(activity_id, seq)`, reenvio idêntico aceito como duplicado, `REPLAY_MISMATCH`, `OUT_OF_ORDER` com `lastSeq` (pgTAP `06`, e2e). Falta a fila SQLite e a sync no app (T2.2) |
| RF-006 | Resumo e histórico | P0 | 🟡 | Telas existem com dados locais; falta servidor e filtro por período Servidor: `finish-activity` devolve o resumo oficial com `invalidSegments` explicados em pt-BR e guarda em `activities.result`; histórico em `activities` (RLS). Falta ligar as telas (T2.4/T2.6). |
| RF-007 | Mapa de território | P0 | 🟡 | Mapa nativo/web com regiões; zonas vêm do seed local Servidor: `GET /zones` (bbox, GiST, até 2.000), `GET /zone` (3 maiores corredores + 10 eventos), Realtime em `zones`, seed com 271 zonas de Goiânia (e2e). Falta ligar o mapa (T2.6). |
| RF-008 | Conquista de zona no servidor | P0 | 🟡 | Servidor pronto (A2): `finish-activity` roda `finishRun` do domain e aplica RN-001/002 nas zonas numa transação com trava e versão (D-23); evento `captured` e notificação "Zona conquistada" (e2e, pgTAP `06`). Falta o aviso na tela (T2.4) |
| RF-009 | Alerta de invasão | P1 | 🟡 | Servidor pronto (A2): notificação "Alerta de Invasão!" com o texto do ERS para quem é da facção dona e correu na zona em 30 dias, com `zoneId`/`lat`/`lng` para abrir o mapa; limites da RN-003 (pgTAP `06`). Falta a central/abertura no app (T3.1) |
| RF-010 | Defesa e fortificação | P0 | 🟡 | Regra testada (`scoring.ts`, `territory.ts`); falta servidor Servidor: pontuação em dobro na janela de defesa (domain no `finish-activity`) e escudo diário (`job_fortify_zones`, pgTAP `07`). |
| RF-011 | Crews | P1 | 🟡 | Tela com dados de demonstração Servidor pronto: `crews`/`crew_members` com RN-011 em trigger, `join_crew`, `leave_crew`, líder remove membro, sucessão do líder (pgTAP `05`). Falta a tela (T3.4). |
| RF-012 | Fuga (fantasma) | P1 | 🟡 | Funciona na corrida (regra testada); falta persistir o bônus no servidor Servidor: `ghostPace` na criação da corrida, `beatGhost` e bônus calculados no `finish-activity`. |
| RF-013 | Mapa de calor | P2 | ⬜ | — |
| RF-014 | Feed social | P2 | ⬜ | — |
| RF-015 | Rankings | P1 | 🟡 | Tela com dados de demonstração Servidor: views `leaderboard_individual`, `leaderboard_crews`, `leaderboard_factions` (temporada, tempo real; pgTAP `07`). Sem filtros de distrito/estado/país no MVP. |
| RF-016 | Missões, medalhas, temporadas | P2 | ⬜ | — |
| RF-017 | Compartilhar corrida | P2 | ⬜ | — |
| RF-018 | Moderação (painel web) | P1 | 🟡 | Servidor pronto (A2): `moderate-activity` (aprovar recalcula e pontua, rejeitar zera; justificativa ≥ 10; notifica o corredor), staff lê corridas e pontos, corrida de demonstração em revisão no seed. Falta o painel (T3.3) |
| RF-019 | Central de notificações | P1 | 🟡 | Servidor pronto (A2): tabela `notifications` (invasão, território perdido, conquista, moderação), `mark_notifications_read`, preferências em `notification_prefs`. Falta a tela (T3.1) |
| RF-020 | Competição entre cidades | P1 | 🟡 | Regra `cityScore` testada; tela com dados de demonstração Servidor: zona criada na primeira corrida em qualquer lugar com o polígono do H3 (e2e em área rural sorteada); `leaderboard_cities` (RN-013). |
| RF-021 | Arena de modos de jogo | P0 | ✅ | Tela Arena + escolha de missão na nova corrida |
| RF-022 | Neblina | P1 | 🟡 | Regra testada; guardada só em memória Servidor: células reveladas gravadas em `fog_cells` no `finish-activity` (RN-016). |
| RF-023 | Caça (baús) | P1 | 🟡 | Funciona na corrida; guardada só em memória Servidor: tabela `chest_opens` (leitura com RLS); a gravação fica para T3.5. |
| RF-024 | Corrida Segura (contatos, SOS, parada) | P0 | 🟡 | Botões na tela, simulados Servidor: `safety_contacts` com RLS e limite de 5 em trigger (pgTAP `05`). |
| RF-025 | Guia por voz | P1 | 🟡 | Anuncia km e baús; falta território rival e fantasma |
| RF-026 | Raid da cidade | P2 | 🟡 | Dados de demonstração |
| RF-027 | Liga do Bairro | P2 | 🟡 | Regra testada; dados de demonstração |

## Requisitos não funcionais

| ID | Categoria | MVP | Status | Observação |
|---|---|---|---|---|
| RNF-001 | Desempenho (5.000 usuários) | ➖ | ⬜ | Ingestão assíncrona e índices projetados; teste k6 fica como pendência |
| RNF-002 | Mapa < 2,5 s, 55 fps | P1 | ⬜ | Medir em aparelho |
| RNF-003 | Troca de dono em ≤ 3 s | P1 | 🟡 | Realtime ligado em `zones` (publication `supabase_realtime`, pgTAP `01`); medir os 3 s com o app (T2.6) |
| RNF-004 | Bateria ≤ 8%/h | ➖ | ⬜ | Medição física fora do MVP |
| RNF-005 | Nenhum ponto perdido offline | P0 | 🟡 | Servidor: idempotência por `(activity_id, seq)` e `MISSING_POINTS` no finish (e2e). Falta a fila no app (T2.2) |
| RNF-006 | HMAC por aparelho, servidor recalcula | P0 | 🟡 | Servidor pronto (A2): chave HMAC por aparelho (`register-device`, segredo nunca volta ao cliente), assinatura conferida em tempo constante, lote fora de ordem/reenviado com outro conteúdo recusado, toda a pontuação recalculada pelo servidor com o domain; vetor de teste no contrato (Deno `hmac.test.ts`, e2e). Falta a assinatura no app (A4, T2.2) |
| RNF-007 | bcrypt, HTTPS, RLS, rate limit, sem segredos | P0 | 🟡 | App: sessão no SecureStore (em partes, D-16), nenhuma chave no código (`.env` fora do git, `.env.example`), erros de credencial/limite de tentativas com mensagem amigável (`errors.test.ts`). Parte do servidor (bcrypt, RLS, rate limit) é do A2 Servidor (A2): senhas com bcrypt custo 10 (Auth), RLS em todas as 15 tabelas e colunas sensíveis sem grant (pgTAP `01`, `03`, `04`), `supabase db advisors` sem alertas, `service_role` só nas functions, rate limit 3/5 min por IP (aproximação de 10/15 min, vale no Cloud; D-21). |
| RNF-008 | Regras isoladas, ≥ 90% cobertura, análise estática | P0 | 🟡 | Domain isolado; 94% linhas, 85% ramos; ESLint ok |
| RNF-009 | Ingestão assíncrona, zonas < 150 ms | P1 | 🟡 | Ingestão só grava (cálculo no finish); `zones_in_bbox` com GiST: 22–28 ms por chamada local com 271 zonas (`/zones`); p95 com 2.000 zonas não medido |
| RNF-010 | Iniciar corrida em ≤ 2 toques; tema claro/escuro; pt-BR | P1 | 🟡 | Tema automático e pt-BR ok; conferir toques |
| RNF-011 | Acessibilidade (contraste, 44 pt, leitor de tela, reduzir movimento) | P1 | 🟡 | Tokens com contraste AA; telas novas com alvos ≥ 44 pt, `accessibilityLabel`/papéis (checkbox, radio, alert) e erros anunciados (`accessibilityLiveRegion`); conferir leitor de tela em aparelho |
| RNF-012 | testIDs, Maestro UC-01..03, Playwright | P1 | 🟡 | testIDs fixos em todos os elementos interativos novos (lista no PROGRESSO, entrada T1.4–T1.6); faltam fluxos Maestro e Playwright (A5) |
| RNF-013 | Consentimentos separados, LGPD | P0 | 🟡 | Explicação antes de cada pedido e consentimentos separados: localização e notificações em etapas distintas do onboarding; termos e privacidade aceitos separadamente; exportar/excluir pelo app (prazo de 30 dias na política). Falta: zona de privacidade nos percursos públicos (RN-010) Servidor: exportação completa e exclusão em cascata (e2e). |
| RNF-014 | Android 8+, iOS 15+ | P0 | 🟡 | Garantido pelo Expo SDK 57 |
| RNF-015 | Tela de corrida (3 métricas, 72 pt, segurar 600 ms) | P1 | 🟡 | `hold-button.tsx` existe; conferir tamanhos |

## Regras de negócio

| ID | Regra | MVP | Status | Onde |
|---|---|---|---|---|
| RN-001 | Cálculo de pontos | P0 | 🟡 | Aplicado no servidor com o domain (ritmo-base = mediana das últimas 10 corridas pontuadas, sequência semanal, limite de 300 RP/zona/dia). `M_grupo` não implementado (D-26) |
| RN-002 | Conquista | P0 | ✅ | `domain/territory.ts` testado e aplicado no servidor (e2e: zona neutra conquistada) |
| RN-003 | Sob ataque e limites de alerta | P0 | ✅ | Sob ataque pelo domain; alertas com 1 por zona a cada 6 h e 5 por dia (pgTAP `06`) |
| RN-004 | Escudo | P0 | ✅ | Redução de pontos do rival pelo domain; escudo sobe/desce no `job_fortify_zones` (pg_cron 00:05; pgTAP `07`) |
| RN-005 | Redução diária | P1 | ✅ | `job_decay_zones` às 03:00 de Brasília (pg_cron; pgTAP `07`) |
| RN-006 | Temporadas | P2 | 🟡 | Função de reset testada; `job_season_rollover` (dia 1: influência × 0,30, troca de facção liberada). Falta arquivar rankings e medalhas |
| RN-007 | Antifraude GPS | P0 | ✅ | `anti-cheat.ts` testado e executado no servidor (`finish-activity`; Deno `scoring.test.ts`) |
| RN-008 | Passos × velocidade | P0 | 🟡 | Regra executada no servidor (NO_STEPS; sem pedômetro e > 10 km → revisão). Falta o pedômetro real no app (T2.3) |
| RN-009 | Índice de Confiança | P0 | ✅ | Índice persistido em `profiles.trust`; < 40 → revisão sem pontuar; < 10 → suspenso 30 dias (Deno `scoring.test.ts`, D-26) |
| RN-010 | Zona de privacidade | P1 | ⬜ | — |
| RN-011 | Facção e Crew | P0 | ✅ | Triggers: crew da mesma facção, 1 crew por usuário, máx. 30; trocar de facção tira da crew (pgTAP `05`) |
| RN-012 | Prefeito | P2 | ⬜ | — |
| RN-013 | Placar entre cidades | P1 | ✅ | `leaderboard_cities` (soma ÷ √ativos, só com 20+ ativos) e troca de cidade 1×/temporada (pgTAP `04`, `07`) |
| RN-014 | Sequência semanal | P1 | ✅ | `job_close_week` toda segunda (2+ corridas; congelamento; zera) e congelamento mensal na virada (pgTAP `07`) |
| RN-015 | Liga do Bairro | P2 | 🟡 | Regra testada |
| RN-016 | Neblina | P1 | ✅ | Testado no domain e persistido em `fog_cells` no servidor |
| RN-017 | Caça | P1 | 🟡 | Testado |
| RN-018 | Raid | P2 | ⬜ | — |
| RN-019 | Fuga | P1 | 🟡 | Testado |
