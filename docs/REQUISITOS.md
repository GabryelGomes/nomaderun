# Checklist de requisitos (ERS v1.0)

> Atualize a linha ao concluir uma tarefa: status, onde está e como foi testado.
> Status: ✅ feito · 🟡 parcial · ⬜ não iniciado · ➖ fora do MVP (justificado)
> Prioridade MVP: P0 / P1 / P2 (ver `PLANO_DESENVOLVIMENTO.md`).

**Baseline (2026-10-20):** o protótipo tinha as telas e as regras no `src/domain` (60 testes), mas sem login, sem banco e sem servidor; o estado era só em memória e se perdia ao fechar o app.

## Requisitos funcionais

| ID | Requisito | MVP | Status | Onde / como foi testado |
|---|---|---|---|---|
| RF-001 | Autenticação (e-mail/senha, JWT 1 h, recuperação, 16+, termos) | P0 | ✅ | App: `/entrar`, `/cadastro` (16+, termos e privacidade separados, nome único via `username_available`), `/recuperar-senha` → `nomaderun://nova-senha`; sessão no SecureStore com refresh automático (JWT 1 h do backend). Testes: `validation.test.ts`, `auth-repo.test.ts`, `integration.local.test.ts` (cadastro real, menor de 16 recusado), fluxo web com Playwright. Google/Apple: código pronto atrás de `EXPO_PUBLIC_AUTH_PROVIDERS`, sem credenciais reais (P-06) |
| RF-002 | Gestão de usuários (perfil, exportar, excluir, admin inativa) | P0 | 🟡 | App: `/perfil/editar` (nome 3–20 único, cidade, km/milhas, preferências de notificação) e `/perfil/conta` (exportar JSON via `account-export`, excluir com EXCLUIR via `account-delete`, sair). Testado em `integration.local.test.ts` e no fluxo web. Falta: foto (iniciais por enquanto, P-03) e tela de admin para inativar contas (painel de moderação, T3.3) |
| RF-003 | Escolha de facção (troca 1×/temporada) | P0 | 🟡 | Onboarding grava a facção pelo RPC `choose_faction` (troca 1×/temporada validada no servidor); guarda de rotas manda para o onboarding quem não tem facção. Testado em `auth-repo.test.ts`, `route-guard.test.ts`, `integration.local.test.ts`. Falta: tela para trocar de facção depois do onboarding |
| RF-004 | Registro de corrida (GPS 1 s, pausa, auto-pausa) | P0 | 🟡 | `use-run-session.ts` + `run-engine.ts` (GPS em primeiro plano e simulação); falta pedômetro, velocidade/altitude e segundo plano |
| RF-005 | Gravação sem internet | P0 | ⬜ | — |
| RF-006 | Resumo e histórico | P0 | 🟡 | Telas existem com dados locais; falta servidor e filtro por período |
| RF-007 | Mapa de território | P0 | 🟡 | Mapa nativo/web com regiões; zonas vêm do seed local |
| RF-008 | Conquista de zona no servidor | P0 | 🟡 | Regra em `territory.ts` (testada); falta rodar no servidor |
| RF-009 | Alerta de invasão | P1 | 🟡 | Regra `under_attack` existe; falta notificação |
| RF-010 | Defesa e fortificação | P0 | 🟡 | Regra testada (`scoring.ts`, `territory.ts`); falta servidor |
| RF-011 | Crews | P1 | 🟡 | Tela com dados de demonstração |
| RF-012 | Fuga (fantasma) | P1 | 🟡 | Funciona na corrida (regra testada); falta persistir o bônus no servidor |
| RF-013 | Mapa de calor | P2 | ⬜ | — |
| RF-014 | Feed social | P2 | ⬜ | — |
| RF-015 | Rankings | P1 | 🟡 | Tela com dados de demonstração |
| RF-016 | Missões, medalhas, temporadas | P2 | ⬜ | — |
| RF-017 | Compartilhar corrida | P2 | ⬜ | — |
| RF-018 | Moderação (painel web) | P1 | ⬜ | — |
| RF-019 | Central de notificações | P1 | ⬜ | — |
| RF-020 | Competição entre cidades | P1 | 🟡 | Regra `cityScore` testada; tela com dados de demonstração |
| RF-021 | Arena de modos de jogo | P0 | ✅ | Tela Arena + escolha de missão na nova corrida |
| RF-022 | Neblina | P1 | 🟡 | Regra testada; guardada só em memória |
| RF-023 | Caça (baús) | P1 | 🟡 | Funciona na corrida; guardada só em memória |
| RF-024 | Corrida Segura (contatos, SOS, parada) | P0 | 🟡 | Botões na tela, simulados |
| RF-025 | Guia por voz | P1 | 🟡 | Anuncia km e baús; falta território rival e fantasma |
| RF-026 | Raid da cidade | P2 | 🟡 | Dados de demonstração |
| RF-027 | Liga do Bairro | P2 | 🟡 | Regra testada; dados de demonstração |

## Requisitos não funcionais

| ID | Categoria | MVP | Status | Observação |
|---|---|---|---|---|
| RNF-001 | Desempenho (5.000 usuários) | ➖ | ⬜ | Ingestão assíncrona e índices projetados; teste k6 fica como pendência |
| RNF-002 | Mapa < 2,5 s, 55 fps | P1 | ⬜ | Medir em aparelho |
| RNF-003 | Troca de dono em ≤ 3 s | P1 | ⬜ | Realtime em `zones` |
| RNF-004 | Bateria ≤ 8%/h | ➖ | ⬜ | Medição física fora do MVP |
| RNF-005 | Nenhum ponto perdido offline | P0 | ⬜ | Fila SQLite + idempotência |
| RNF-006 | HMAC por aparelho, servidor recalcula | P0 | ⬜ | — |
| RNF-007 | bcrypt, HTTPS, RLS, rate limit, sem segredos | P0 | 🟡 | App: sessão no SecureStore (em partes, D-16), nenhuma chave no código (`.env` fora do git, `.env.example`), erros de credencial/limite de tentativas com mensagem amigável (`errors.test.ts`). Parte do servidor (bcrypt, RLS, rate limit) é do A2 |
| RNF-008 | Regras isoladas, ≥ 90% cobertura, análise estática | P0 | 🟡 | Domain isolado; 94% linhas, 85% ramos; ESLint ok |
| RNF-009 | Ingestão assíncrona, zonas < 150 ms | P1 | ⬜ | Índice GiST |
| RNF-010 | Iniciar corrida em ≤ 2 toques; tema claro/escuro; pt-BR | P1 | 🟡 | Tema automático e pt-BR ok; conferir toques |
| RNF-011 | Acessibilidade (contraste, 44 pt, leitor de tela, reduzir movimento) | P1 | 🟡 | Tokens com contraste AA; telas novas com alvos ≥ 44 pt, `accessibilityLabel`/papéis (checkbox, radio, alert) e erros anunciados (`accessibilityLiveRegion`); conferir leitor de tela em aparelho |
| RNF-012 | testIDs, Maestro UC-01..03, Playwright | P1 | 🟡 | testIDs fixos em todos os elementos interativos novos (lista no PROGRESSO, entrada T1.4–T1.6); faltam fluxos Maestro e Playwright (A5) |
| RNF-013 | Consentimentos separados, LGPD | P0 | 🟡 | Explicação antes de cada pedido e consentimentos separados: localização e notificações em etapas distintas do onboarding; termos e privacidade aceitos separadamente; exportar/excluir pelo app (prazo de 30 dias na política). Falta: zona de privacidade nos percursos públicos (RN-010) |
| RNF-014 | Android 8+, iOS 15+ | P0 | 🟡 | Garantido pelo Expo SDK 57 |
| RNF-015 | Tela de corrida (3 métricas, 72 pt, segurar 600 ms) | P1 | 🟡 | `hold-button.tsx` existe; conferir tamanhos |

## Regras de negócio

| ID | Regra | MVP | Status | Onde |
|---|---|---|---|---|
| RN-001 | Cálculo de pontos | P0 | 🟡 | `domain/scoring.ts` testado; falta servidor e M_grupo |
| RN-002 | Conquista | P0 | 🟡 | `domain/territory.ts` testado |
| RN-003 | Sob ataque e limites de alerta | P0 | 🟡 | Regra testada; limites de alerta (1/6 h, 5/dia) pendentes |
| RN-004 | Escudo | P0 | 🟡 | Testado |
| RN-005 | Redução diária | P1 | 🟡 | Função testada; falta job diário |
| RN-006 | Temporadas | P2 | 🟡 | Função de reset testada |
| RN-007 | Antifraude GPS | P0 | 🟡 | `anti-cheat.ts` testado |
| RN-008 | Passos × velocidade | P0 | 🟡 | Regra testada; falta pedômetro real |
| RN-009 | Índice de Confiança | P0 | 🟡 | `trust.ts` testado; falta persistir e revisão < 40 |
| RN-010 | Zona de privacidade | P1 | ⬜ | — |
| RN-011 | Facção e Crew | P0 | ⬜ | — |
| RN-012 | Prefeito | P2 | ⬜ | — |
| RN-013 | Placar entre cidades | P1 | 🟡 | `cityScore` testado |
| RN-014 | Sequência semanal | P1 | 🟡 | Regra testada; valor fixo no estado |
| RN-015 | Liga do Bairro | P2 | 🟡 | Regra testada |
| RN-016 | Neblina | P1 | 🟡 | Testado |
| RN-017 | Caça | P1 | 🟡 | Testado |
| RN-018 | Raid | P2 | ⬜ | — |
| RN-019 | Fuga | P1 | 🟡 | Testado |
