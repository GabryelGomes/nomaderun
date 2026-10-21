# Checklist de requisitos (ERS v1.0)

> Status final do MVP, revisado linha a linha contra o código e os testes em 2026-10-22 (A6, T5.2).
> Status: ✅ feito · 🟡 parcial (o núcleo funciona; falta o que está escrito na linha) · ⬜ não feito · ➖ fora do MVP (justificado)
> Prioridade do MVP: P0 / P1 / P2 (ver `PLANO_DESENVOLVIMENTO.md` §2). Matriz completa requisito → teste: `docs/QA.md` §10.
> Legenda dos testes: `app:` Jest em `apps/mobile/src/**/__tests__/` · `pg:` pgTAP em `supabase/tests/database/` · `deno:` `supabase/functions/tests/` · `e2e` `supabase/scripts/e2e.ts` · `sec` teste adversarial `supabase/tests/security/edge-security.ts` · `web` Playwright `apps/mobile/e2e-web/` · `mae:` fluxos Maestro `apps/mobile/.maestro/` (escritos, não executados em aparelho).

## Resumo

| Tipo | ✅ | 🟡 | ⬜ | ➖ | Total |
|---|---|---|---|---|---|
| Requisitos funcionais (RF) | 13 | 12 | 2 | 0 | 27 |
| Requisitos não funcionais (RNF) | 6 | 6 | 1 | 2 | 15 |
| Regras de negócio (RN) | 13 | 4 | 2 | 0 | 19 |
| **Total** | **32** | **22** | **5** | **2** | **61** |

| Prioridade | ✅ | 🟡 | ⬜ | Total |
|---|---|---|---|---|
| **P0** (sem isso não há demonstração) | 16 | 9 | 0 | 25 |
| **P1** (importante) | 16 | 7 | 1 | 24 |
| **P2** (desejável) | 0 | 6 | 4 | 10 |
| Fora do MVP (➖) | — | — | — | 2 |

Nenhum requisito P0 ficou sem fazer. Os P0 parciais funcionam na demonstração; o que falta neles depende de aparelho (tela bloqueada, RNF-014), de conta no Supabase Cloud (HTTPS e limite de login, RNF-007) ou é complemento de tela (troca de facção, parciais por km, Escolta ao vivo).

## Requisitos funcionais

| ID | Requisito | MVP | Status | Onde está / como foi testado |
|---|---|---|---|---|
| RF-001 | Autenticação | P0 | ✅ | Telas `/entrar`, `/cadastro` (16+, termos e privacidade separados, nome único, cidade natal opcional), `/recuperar-senha` → link `nomaderun://nova-senha` por PKCE; sessão no SecureStore com renovação automática; JWT de 1 h. Banco recusa menor de 16, falta de aceite e nome repetido (trigger `handle_new_user`). Google/Apple: código pronto, aparece só com `EXPO_PUBLIC_AUTH_PROVIDERS` e credenciais reais (P-06). Testes: app `validation`, `auth-repo`, `route-guard`, `session-link`, `integration.local` (recuperação real pela caixa local); pg `02`, `13`; e2e; sec; web `demo-flow`, `auth-flow`; mae `01`, `02` |
| RF-002 | Gestão de usuários | P0 | ✅ | `/perfil/editar` (nome, foto no bucket `avatars`, cidade, km/milhas, preferências de notificação); `/perfil/conta` (exportar JSON, excluir com senha + EXCLUIR); admin inativa/reativa em `/moderacao/contas` e a conta perde o acesso na hora. Testes: app `avatar-repo`, `integration.local`, `integration.phase2`; pg `04`, `06`, `13`; e2e; sec; web `auth-flow`. Seletor de foto e compartilhamento do JSON no aparelho: P-05 |
| RF-003 | Escolha de facção | P0 | 🟡 | Onboarding grava pelo RPC `choose_faction`; o servidor permite trocar 1×/temporada, zera a contribuição e tira da crew. **Falta:** tela para trocar de facção depois do onboarding. Testes: app `auth-repo`, `route-guard`; pg `05`, `07`; web; mae `01` |
| RF-004 | Registro de corrida | P0 | 🟡 | `features/run/use-run-session.ts`, `services/location/tracker.ts`: GPS a cada 1 s com precisão, velocidade, altitude e localização simulada; pedômetro; pausa, retomada, auto-pausa (< 1 km/h por 10 s); tela acesa; métricas e zona atual. **Falta:** tela bloqueada só em development build com `NOMADE_BACKGROUND_LOCATION=1`, sem validação em aparelho (P-17, P-21). Testes: app `run-engine`, `branches`, `location`, `step-counter`; mae `05` |
| RF-005 | Gravação sem internet | P0 | ✅ | Fila SQLite (`services/offline`), sync assinada em lotes de 200 a cada 5 s e ao voltar a conexão (`services/sync`); servidor idempotente por `(activity_id, seq)`. Testes: app `sqlite-store`, `queue-properties`, `sync-engine` (queda de rede e resposta perdida: cada ponto uma única vez), `sync/integration.local`; pg `06`; e2e; web com rede desligada no meio da corrida |
| RF-006 | Resumo e histórico | P0 | 🟡 | Resumo oficial (`summary-screen.tsx`): percurso, distância, tempo, ritmo médio, zonas com RP e resultado, "Zona conquistada", trechos inválidos em cinza com explicação; provisório sem internet. Histórico em `activities-screen.tsx` com filtro (7 dias, 30 dias, ano, tudo). **Falta:** parciais por km, gráfico de ritmo e recordes pessoais. Testes: app `provisional-vs-official`, `voice-history`, `rankings-privacy-track`; web; mae `05` |
| RF-007 | Mapa de território | P0 | ✅ | `map-screen.tsx` + `zones-store`: zonas da área visível (`GET /zones`, até 2.000), tempo real, último mapa salvo para abrir sem internet, contorno de zona sob ataque, zonas bloqueadas tracejadas; folha da zona (`GET /zone`: dono, influência, escudo, 3 maiores corredores, eventos). Visual diferente do ERS por decisão (regiões suavizadas e formas por time em vez de hexágonos com hachura, D-15; proposta em `ERS-ALTERACOES-PROPOSTAS.md`). Testes: app `zones-repo`, `zones-store`, `territory-map-layers`, `regions`; e2e; web; comparação de imagem; mae `03` |
| RF-008 | Conquista de zona | P0 | ✅ | `finish-activity` roda `finishRun` do domain e aplica RN-001/002 numa transação com trava; o app mostra "Zona conquistada, +RP em {zona}" com vibração só depois da confirmação. Testes: deno `scoring`, `domain_bridge`; app `provisional-vs-official`, `sync/integration.local`; e2e; web |
| RF-009 | Alerta de invasão | P1 | ✅ | Servidor cria a notificação com o texto do ERS para quem é do time dono e correu na zona em 30 dias; chega pelo tempo real, vira notificação local com o app aberto e abre o mapa na zona. Push remoto só em development build (D-13). Testes: pg `06`, `11`; app `notifications`, `realtime-fallback`; mae `04` |
| RF-010 | Defesa e fortificação | P0 | ✅ | Pontos em dobro na zona própria sob ataque (domain no `finish-activity`), faixa amarela "Defendendo…" na corrida, escudo pelo job diário `job_fortify_zones`. Testes: app `territory`, `run-engine`, `branches`; pg `07` |
| RF-011 | Crews | P1 | 🟡 | `/clube/crew`: criar (nome, sigla 3–5), entrar por código, sair, ranking interno da temporada, líder remove membro; limite de 30 e mesma facção no banco. **Falta:** convite por link, metas semanais, membros correndo agora e aprovação de entrada pelo líder. Testes: app `crews-leaderboard`, `integration.phase2`; pg `05`, `12`, `13`; sec; web |
| RF-012 | Fuga (fantasma) | P1 | 🟡 | Missão Fuga com ritmo escolhido, distância ao fantasma na tela e voz a cada 100 m; bônus calculado pelo servidor (ritmo 150–900 s/km, só na Fuga). **Falta:** fantasma com o tempo de um amigo ou do dono da zona. Testes: app `games`, `run-engine`, `voice-history`; deno `qa_fixes`; sec |
| RF-013 | Mapa de calor | P2 | ⬜ | Não implementado (a camada "Onde já corri" mostra só a neblina pessoal). Estado `fixme` na comparação de imagem |
| RF-014 | Feed social | P2 | ⬜ | Não implementado |
| RF-015 | Rankings | P1 | 🟡 | Clube: corredores, crews e times por temporada ou semana; escopo geral, cidade, time e distrito (RPCs `ranking_*`), em tempo real. **Falta:** filtros por estado e país (o perfil não tem esses campos). Testes: pg `07`, `10`; app `crews-leaderboard`, `rankings-privacy-track`, `integration.phase2/3`; e2e |
| RF-016 | Missões, medalhas, temporadas | P2 | 🟡 | Só o ciclo mensal de temporada (job `job_season_rollover`) e três conquistas simples no perfil. **Falta:** missões diárias/semanais e medalhas da temporada. Testes: pg `07` |
| RF-017 | Compartilhar corrida | P2 | 🟡 | Botão "Compartilhar corrida" no resumo abre o menu nativo com um texto (distância, ritmo, zonas). **Falta:** imagem com o mapa do percurso. Sem teste automatizado |
| RF-018 | Moderação (painel web) | P1 | ✅ | `/moderacao` (navegador e celular), só moderador/admin com guarda na tela e no banco: fila, percurso, gráficos de velocidade e passos, alertas de fraude, aprovar/rejeitar com justificativa (10–1000) via `moderate-activity`, que recalcula e notifica. Testes: app `moderation`, `integration.phase2`; e2e; sec; web (moderador aprova) |
| RF-019 | Central de notificações | P1 | ✅ | `/notificacoes`: lidas/não lidas, marcar uma ou todas, contador no sino; tempo real com consulta só de reserva; preferências no editar perfil. Testes: app `notifications`, `realtime-fallback`, `integration.phase3`; pg `08`; e2e; web; mae `04` |
| RF-020 | Competição entre cidades | P1 | 🟡 | Zonas nascem na primeira corrida em qualquer lugar, com nome e cidade; placar `leaderboard_cities` (RN-013) no Clube, com dados de demonstração rotulados quando não há cidades com 20+ ativos. **Falta:** cidades conquistadas no perfil e medalha "Nômade". Testes: app `games`; pg `07`, `10`; e2e |
| RF-021 | Arena de modos de jogo | P0 | ✅ | Tela Arena com os modos e regras; escolha da missão (livre, Fuga, Caça) na nova corrida. Tela sem teste automatizado; modos cobertos pelos testes de regras (app `games`) |
| RF-022 | Neblina | P1 | ✅ | Células reveladas gravadas pelo servidor em `fog_cells`, camada "Onde já corri" no mapa e total no perfil. Testes: app `games`, `run-engine`; pg `06`; e2e |
| RF-023 | Caça | P1 | ✅ | Baús sorteados pelo servidor (`daily_chests`), abertos no cálculo oficial (≤ 25 m, uma vez); na simulação ou sem internet, baús locais. Testes: app `games`, `hunt-chests`, `chests-repo`; deno `chests`; pg `09`; e2e. GPS real: P-28 |
| RF-024 | Corrida Segura | P0 | 🟡 | Até 5 contatos (`/contatos-seguranca`), SOS sempre visível (SMS com localização), alerta de parada (10 min + 60 s). **Falta:** Escolta ao vivo — no MVP ela compartilha a localização uma vez ao ligar (D-36, P-18). Testes: app `safety`, `sync/integration.local`; pg `05`; sec. SMS no aparelho: P-17 |
| RF-025 | Guia por voz | P1 | ✅ | `features/run/voice-guide.ts`: km com ritmo, território rival, fantasma, baú; botão de silenciar. Testes: app `voice-history` |
| RF-026 | Raid da cidade | P2 | 🟡 | Tela com dados de demonstração rotulados. **Falta:** chefão real e soma do dano no servidor |
| RF-027 | Liga do Bairro | P2 | 🟡 | Regra no domain e tela com dados de demonstração. **Falta:** grupos semanais no servidor. Testes: app `games` |

## Requisitos não funcionais

| ID | Categoria | MVP | Status | Onde está / como foi testado |
|---|---|---|---|---|
| RNF-001 | Desempenho (5.000 usuários) | ➖ | ➖ | Ingestão assíncrona e índices geográficos projetados para isso; teste de carga com k6 não feito (precisa do ambiente na nuvem) |
| RNF-002 | Mapa < 2,5 s, 55 fps | P1 | ⬜ | Não medido (precisa de aparelho Android intermediário) |
| RNF-003 | Troca de dono ≤ 3 s; alerta ≤ 60 s | P1 | ✅ | Tempo real em `zones` e `notifications`; aprovação que mudou 10 zonas chegou a outro usuário em 0,2–0,7 s (app `integration.phase2`, local). O alerta é gravado no mesmo processamento da corrida |
| RNF-004 | Bateria ≤ 8%/h | ➖ | ➖ | Medição física em aparelho fora do MVP |
| RNF-005 | Nenhum ponto perdido; 99,5%; erro ≤ 3% | P0 | 🟡 | Nenhum ponto perdido: fila SQLite + sync idempotente, testado com queda de rede e arquivo reaberto (app `sqlite-store`, `queue-properties`, `sync-engine`, `sync/integration.local`). **Falta medir:** 3 h offline em aparelho, disponibilidade do servidor e erro de distância num percurso aferido |
| RNF-006 | HMAC por aparelho; servidor recalcula | P0 | ✅ | Chave de 32 bytes por aparelho no SecureStore, lotes assinados com HMAC-SHA256; servidor confere em tempo constante, recusa fora de ordem e reenvio alterado, e recalcula tudo com o domain. Limite aceito: a chave é registrada pelo próprio cliente (P-38). Testes: app `hmac`, `device-key`, `sync-engine`; deno `hmac`, `security_inputs`, `scoring`; pg `06`; e2e; sec #15–#20 |
| RNF-007 | bcrypt, HTTPS, RLS, limite de login, sem segredos, OWASP | P0 | 🟡 | bcrypt custo 10, RLS nas 17 tabelas, colunas sensíveis sem grant, `service_role` só nas functions, nenhuma chave no código, conta inativada sem acesso, PKCE nos links, revisão OWASP sem achado aberto. **Falta:** HTTPS e limite de login só valem no Supabase Cloud (P-08, P-09); o limite é 3 por 5 min por IP, aproximação de 10 por 15 min (D-21). Testes: pg `01`, `03`, `04`, `08`, `12`, `13`; sec (89 verificações, `STRICT=1` sem achados); varredura do bundle web |
| RNF-008 | Regras isoladas, ≥ 90% de cobertura, análise estática | P0 | 🟡 | `src/domain` puro, usado pelo app e pelas functions; 100% de linhas e 99,6% de ramos com limite de 90% no Jest; ESLint e `tsc` sem erros. **Falta:** análise estática automática a cada alteração (não há CI) |
| RNF-009 | Ingestão assíncrona; zonas < 150 ms | P1 | ✅ | Ingestão só grava (cálculo no fim); `/zones` com 2.000 zonas: p95 de 35 ms (local) e resposta completa até 2.000. Testes: medição P-11; pg `13`; sec |
| RNF-010 | 2 toques; tema claro/escuro; pt-BR | P1 | ✅ | Correr → Começar = 2 toques; tema e mapa seguem o modo do sistema (`userInterfaceStyle: automatic`); textos em pt-BR. Testes: mae `05`. Tema sem teste automatizado |
| RNF-011 | Acessibilidade | P1 | 🟡 | Alvos ≥ 44 pt, descrição para leitor de tela em todo interativo, "Reduzir movimento" só com opacidade nos botões. **Falta:** medir o contraste 4,5:1 com ferramenta e testar TalkBack/VoiceOver em aparelho; a conquista agora é pintada em 6 traços com 60 ms de intervalo (ERS §6.2, T6.4; teste `run-motion`), e com "Reduzir movimento" aparece fechada só com opacidade. Fase 6 (T6.1): primitivas de motion e chips também só com opacidade e alvo ≥ 44 pt. Testes: app `testids`, `reduced-motion`, `press-feedback`, `motion`; web `auth-flow` |
| RNF-012 | testIDs, Maestro, Playwright com imagem | P1 | 🟡 | Todo interativo com `testID` (análise do código derruba o `npm test` se faltar); Playwright: fluxo da demo, autenticação e comparação de imagem (0,2%) de zona neutra, dominada e sob ataque. **Falta:** rodar os fluxos Maestro em aparelho (P-07) e o estado "mapa de calor" (RF-013 não feito) |
| RNF-013 | Consentimentos, LGPD, privacidade de percurso | P0 | ✅ | Explicação antes de cada permissão, aceites separados, exportar e excluir pelo app, zonas de privacidade escondem pontos de terceiros (RLS). Testes: app `location`, `integration.local`; pg `08`; e2e; mae `01` |
| RNF-014 | Android 8+, iOS 15+ | P0 | 🟡 | Expo SDK 57 atende às versões mínimas; painel web testado no Chromium. **Falta:** testar em aparelhos reais e nos outros navegadores |
| RNF-015 | Tela de corrida | P1 | ✅ | 3 métricas (tempo + distância + ritmo; a média saiu da corrida e fica no resumo): tempo em 88 pt (72 pt com horas), métricas em 48 pt, algarismos tabulares e sem reticências em 360×640 (T6.4); controles de 56/64/76 pt na zona do polegar acima da área segura; SOS de 56 pt sempre visível; encerrar segurando 600 ms com anel. Testes: `run-motion` (tamanho do tempo ≥ 72 pt), Playwright nas 4 resoluções (largura dos números = largura da caixa) |

## Regras de negócio

| ID | Regra | MVP | Status | Onde está / como foi testado |
|---|---|---|---|---|
| RN-001 | Cálculo de pontos | P0 | ✅ | `domain/scoring.ts` no servidor: ritmo-base pela mediana das 10 últimas, sequência, fantasma, grupo (3+ da crew a 50 m, D-40), defesa, teto de 300 RP/zona/dia. Testes: app `scoring`, `run-engine`, `properties`; deno `scoring`, `group`; e2e |
| RN-002 | Conquista | P0 | ✅ | `domain/territory.ts` (30 para neutra, 110% para tomar). Testes: app `territory`, `properties`; e2e |
| RN-003 | Sob ataque e limites de alerta | P0 | ✅ | 50%/40% no domain; 1 alerta por zona a cada 6 h e 5 por dia no banco. Testes: app `territory`; pg `06`, `11` |
| RN-004 | Escudo | P0 | ✅ | Redução no domain; job `job_fortify_zones` (00:05). Testes: app `territory`, `properties`; pg `07` |
| RN-005 | Redução diária | P1 | ✅ | Job `job_decay_zones` às 03:00 de Brasília. Testes: app `territory`, `properties`; pg `07` |
| RN-006 | Temporadas | P2 | 🟡 | Job `job_season_rollover` (dia 1: influência × 0,30, troca de facção liberada). **Falta:** arquivar rankings e entregar medalhas. Testes: app `territory`; pg `07` |
| RN-007 | Antifraude GPS | P0 | ✅ | `domain/anti-cheat.ts` no servidor (precisão, 40 km/h, veículo, salto, localização simulada). Testes: app `anti-cheat`, `branches`, `properties`; deno `scoring` |
| RN-008 | Passos × velocidade | P0 | 🟡 | Cadência por pedômetro no servidor (`NO_STEPS`); sem pedômetro e mais de 10 km → revisão. **Falta:** checagem de vibração da passada pelo acelerômetro. Testes: app `anti-cheat`, `step-counter`, `provisional-vs-official` |
| RN-009 | Índice de confiança | P0 | ✅ | `profiles.trust`; < 40 → revisão; < 10 → suspenso 30 dias (D-26). Testes: app `branches`, `properties`; deno `scoring`; sec |
| RN-010 | Zona de privacidade | P1 | ✅ | `privacy_zones` (até 3, 200 m padrão) e tela `/zonas-privacidade`; a RLS esconde de terceiros os pontos dentro do raio; a pontuação usa todos. Testes: pg `08`; app `rankings-privacy-track`, `integration.phase3`; e2e |
| RN-011 | Facção e crew | P0 | ✅ | Triggers: mesma facção, 1 crew por pessoa, máx. 30; trocar de facção tira da crew. Testes: pg `05`, `12`; app `integration.phase2`; sec |
| RN-012 | Prefeito | P2 | ⬜ | Não implementado |
| RN-013 | Placar entre cidades | P1 | ✅ | `leaderboard_cities` (soma ÷ √ativos, só com 20+); cidade natal trocada 1×/temporada. Testes: app `games`; pg `04`, `07` |
| RN-014 | Sequência semanal | P1 | ✅ | Job `job_close_week` (2+ corridas, congelamento mensal). Testes: app `games`; pg `07` |
| RN-015 | Liga do Bairro | P2 | 🟡 | Regra no domain; sem agrupamento semanal no servidor. Testes: app `games` |
| RN-016 | Neblina | P1 | ✅ | Domain + `fog_cells` gravado pelo servidor. Testes: app `games`, `run-engine`; pg `06` |
| RN-017 | Caça | P1 | ✅ | Sorteio diário em SQL (5–8 baús, 3 km, fora de zona bloqueada, 70/25/5%) e abertura validada no servidor. "Ruas e parques" não é garantido (sem base de ruas, D-39). Testes: app `games`, `hunt-chests`; deno `chests`; pg `09`; e2e |
| RN-018 | Raid | P2 | ⬜ | Só dados de demonstração na tela; regra não implementada no servidor |
| RN-019 | Fuga | P1 | 🟡 | Diferença e bônus no domain e no servidor (ritmo 150–900 s/km, só na Fuga). **Falta:** fantasma de amigo ou do dono da zona. Testes: app `games`, `run-engine`, `voice-history` |
