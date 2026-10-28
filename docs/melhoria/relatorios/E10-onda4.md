# E10 — Onda 4 (F5): QA visual, fluxos na demonstração, régua, acessibilidade, bundle e ética

> 28/10/2026 · worktree `agent-a2bf11ee3fc2dce5c`, sobre o merge de `claude/affectionate-gauss-e8gm77` (onda 3 inteira).
> Export do modo demonstração com `EXPO_PUBLIC_DEMO=1 … --clear`; capturas em `docs/melhoria/capturas/depois/`.

## 1. Entregas

| Item | Resultado |
|---|---|
| `e2e-web/capturas.cjs` | + 9 rotas (`/correr`, `/perfil/ajustes`, `/perfil/atividades`, `/missoes`, `/recompensas`, `/compartilhar/[id]`, `/compartilhar/semana`, `/compartilhar/feed`, `/compartilhar/convite/[codigo]`), `/boas-vindas` na primeira abertura e o estado vazio de missões, recompensas, semana e feed. Mede também o **contraste do texto renderizado** (`lowContrast`, WCAG AA, com a opacidade dos ancestrais) e o **texto por baixo do selo** (`sealOverlap`). `/moderacao/contas` ficou fora: só admin (o moderador é redirecionado) |
| Capturas "depois" | **165** (55 rota×estado × 360/390/430), pngquant 15,1 MB → **4,5 MB**; 0 erros de página, **0 pedidos ao Supabase** (`depois/relatorio.json`) |
| `e2e-web/demo-mode-flow.cjs` (novo) | fluxo completo sem servidor: primeira abertura → cadastro → cidade dividida → time → confirmação → localização → Mapa → corrida simulada → Resumo → Compartilhar → Arena → Clube → Você → Ajustes → Missões → Recompensas. **21/21 verificações ok** |
| `e2e-web/onboarding-steps.cjs` (novo) | cadastro e onboarding da v2, comuns aos 3 fluxos |
| `demo-flow.cjs` e `auth-flow.cjs` | estavam quebrados pela v2 (5 testIDs do onboarding antigo, `cadastro-cidade` e os 2 aceites sumiram; rótulo da zona conquistada mudou). Atualizados: cadastro sem cidade, onboarding novo, `Zona conquistada: <nome>`, o moderador entra por `/entrar`, a cidade natal é conferida em Editar perfil. **Não rodados** (precisam do Supabase local); os passos de UI foram conferidos no export da demonstração |
| Maestro | `01-cadastro-onboarding.yaml` já segue o onboarding novo; o `testids.test.ts` confere todos os ids dos fluxos (passa) |

## 2. Régua de texto (`medir-texto.mjs --comparar antes`, teto estático)

| Tela (jogo) | Antes | Agora | Meta |
|---|---:|---:|---:|
| onboarding · boas-vindas | 50 | 11 | 45 |
| onboarding · time | 22 | 30 | 45 |
| **onboarding · quiz** (novo) | — | **71** | 45 |
| onboarding · localização | 58 | 14 | 45 |
| Mapa | 36 | 44 | 45 |
| corrida · preparação | 58 | 43 | 45 |
| **corrida · ativa** | 145 | **109** | 90 |
| **resumo** | 113 | **76** | 60 |
| **zona/[id]** | 135 | **76** | 50 |
| Arena | 195 | 30 | 45 |
| Atividades | 66 | 35 | 45 |
| Clube | 108 | 39 | 45 |
| Clube/crew | 109 | 69 | 70 |
| Você | 171 | 13 | 45 |
| **Você/time** | 90 | **72** | 60 |
| Cadastro (conta) | 123 | 63 | 80 |
| Conta e privacidade (conta) | 73 | **84** | 80 |

Jogo: 23 telas, média 37 palavras, **5 acima da meta** (quiz, corrida ativa, resumo, zona, time). Conta acima da meta: editar perfil 102, conta 84, moderação 99/94 (formulários e LGPD, sem mudança).

**Fora da régua estática** (rotas novas sem mapeamento no script da E6): medidas no DOM da captura a 390 (todo o conteúdo rolável, com dados): Missões **198**, Ajustes 204 (conta), Feed 160, Recompensas 118, Compartilhar 113, Semana 103, Convite 43, Correr 11. **Missões está 4× acima da meta de jogo** (dona: E7). No DOM, antes → depois a 390: Arena 227 → 72, Você 177 → 47, Resumo 98 → 48, Zona 82 → 41, Cadastro 92 → 37, onboarding 50 → 25; Clube ficou igual (290 → 284: o feed e o ranking com dados).

## 3. Teste de 5 segundos (agente, captura a 390 e 360)

| Tela | O que se entende em 5 s | Nota |
|---|---|---|
| Boas-vindas | marca, "corra a sua cidade", Começar | 5/5 |
| Onboarding cidade/time | a cidade está dividida em 4 times; escolha o seu | 5/5 |
| Mapa | meu time, zonas, 1 alerta, CORRER | 4/5 (a 360 os chips viram "Sem…", "B…", "Ch…") |
| Correr | um botão: correr | 5/5 |
| Corrida ativa | tempo, km, ritmo, zona atual, segurar para encerrar | 4/5 |
| Resumo | zona conquistada, números, compartilhar | 4/5 (o "Nível +XP" não bate com o total de Recompensas, pendência E6b/E7) |
| Arena | chefão da semana e minha parte; missões | 4/5 (rótulos das missões cortados) |
| Clube | minha crew, km da semana, feed | 4/5 |
| Você | cartão, 3 números, medalhas, atalhos | 5/5 |
| Missões | primeira semana em passos; hoje | 3/5 (muito texto; 2 selos de demonstração) |
| Recompensas | nível, baú do dia com as chances, trilha | 4/5 |
| Compartilhar / Semana | prévia do card e Baixar | 5/5 |

Média 4,3/5 (86%), meta ≥ 80%.

## 4. Auditoria (capturas "depois", 3 larguras)

- **Contraste do texto renderizado:** 0 falhas reais. Corrigi os itens bloqueados de Missões (3,3–3,5:1) e da trilha de Recompensas (3,9:1). Sobra 1 falso positivo (pódio "1" do ranking: o fundo claro é uma camada irmã). Tokens: 62 pares, só `palette.ink3` no tema claro, que não é usado.
- **Selo "Demonstração" por cima de texto:** **0** (antes: nome do time no Mapa, faixa da corrida, "Zona conquistada" do resumo, título "Compartilhar", título de cabeçalho com "voltar").
- **Interativos sem nome:** 0. `testids.test.ts` e `reduced-motion.test.ts` passam.
- **Alvos < 44 na web:** chips de 36–40 (período, ranking, formato, feed). No aparelho, `hitSlop` leva a ≥ 44. O `Switch` web mede 40×20. Fica como Baixo (só web).
- **Mapa sem hexágonos:** ok em todas as capturas (regiões suavizadas).
- **Reduzir movimento:** capturas e fluxo com `reducedMotion: 'reduce'`, sem erro e sem animação presa (opacidade final).

## 5. Bundle

Entry **1.186.919 B gzip** (4.358.821 cru) contra o orçamento da CI de **1.250.000**: 95%, folga de 63 KB. Não apliquei corte. Candidatos seguros para a F6, se a folga acabar:
- apagar `InfluenceBar` e `capture-celebration.math.ts`, que hoje só os testes usam (pendência E6b);
- carregar sob demanda o `dev/arte` e o `dev/motion`, que entram no entry;
- o maplibre (285 KB gzip) já vem em chunk separado.

## 6. Checklist ético

| Pergunta | Resposta | Evidência |
|---|---|---|
| Notificação com culpa? | Não | `domain/__tests__/reminders.test.ts:103` proíbe "Sentimos sua falta", "Última chance!" e outras |
| Silêncio | 22h–7h, só amplia; escada de volta 7/14/21/30 dias, depois silêncio | `domain/reminders.ts:8-10,86` |
| Punição por descanso? | Não | "semana garantida", Pausa de saúde em Ajustes e Pausar em Recompensas |
| Perda forçada / FOMO? | Não | primeira semana "nunca expira" (`missions.ts:88,407`); baú guarda até 3; lendário garantido em 16, com as chances à vista |
| Recompensa paga? | Não | nenhuma loja, preço ou premium em `features/app/components` |
| Telemetria | opt-in, desligada por padrão; só em Ajustes, sem empurrão | `features/engagement/telemetry.ts:5` |
| Demonstração identificada | selo fixo em toda tela e no card exportado ("DADOS DE DEMONSTRAÇÃO") | fluxo, passos 1–19 |

## 7. Achados (revisão adversarial visual)

| Sev. | Achado | Onde / captura | Dona | Estado |
|---|---|---|---|---|
| **Alto** | Selo "Demonstração" cobria o nome do time no Mapa, a faixa "Defendendo seu território" da corrida e o "Zona conquistada" do resumo | `map-screen.tsx`, `run-screen.tsx`, `components/screen.tsx`; `depois/inicio__cheio__*`, `resumo__cheio__*` | E6/E10 | **corrigido** |
| **Médio** | Card de boas-vindas empilhado por cima do card de missão do Mapa (aparecia "Dom… Caça Fuga…" por baixo) | `map-screen.tsx` + `welcome-mission-card.tsx`; fluxo `03-mapa-boas-vindas` | E6a/E6b | **corrigido** (o Mapa cede a vaga enquanto o card de boas-vindas existe) |
| **Médio** | Texto bloqueado com contraste 3,3–3,9:1 | `missions-screen.tsx:105`, `rewards-screen.tsx:221` | E7 | **corrigido** (opacidade 0,8) |
| **Médio** | Nome do jogador cortado a 390 ("voce.de…") | `player-card.tsx:55`; `depois/perfil__cheio__390` | E6a | **corrigido** (nome > 7 letras usa 24 pt; no aparelho, `adjustsFontSizeToFit`) |
| **Médio** | `demo-flow.cjs`/`auth-flow.cjs` quebrados pela v2 | e2e-web | E10 | **corrigido** (não rodados: sem Supabase local) |
| **Médio** | No iOS, o título centralizado do cabeçalho nativo fica sob o selo (na web e no Android o título é à esquerda). Não verificável aqui | `_layout.tsx` (`pushHeader`) + `demo-seal.tsx` | Coordenador/E6 | relatar: `headerTitleAlign: 'left'` na demonstração, ou o selo dentro do cabeçalho |
| **Médio** | Mapa a 360: os chips da faixa de hoje cortam o rótulo ("Sem…", "B…", "Ch…") e o título do alerta corta | `daily-strip.tsx`; `depois/inicio__cheio__360` | E6b | relatar (só o ícone + número abaixo de ~380) |
| **Médio** | Missões: 198 palavras visíveis e 2 selos de demonstração (o fixo e o da tela) | `missions-screen.tsx:183`; `depois/missoes__cheio__390` | E7 | relatar |
| Baixo | Feed: título duplicado ("Feed da crew" no cabeçalho e "Corridas da crew"); a 360 o nome vira "ana.d…" e o "· Hoje" quebra a linha por causa do selo | `crew-feed-screen.tsx`; `depois/compartilhar-feed__cheio__360` | E8 | relatar |
| Baixo | Arena: rótulos das missões de hoje cortados ("Termine à frente do …") | `depois/arena__cheio__390` | E6c | relatar |
| Baixo | Mapa: "48 zonas em Anápolis" conta as zonas da cidade natal do perfil, mas o mapa e a pessoa estão em Goiânia | `map-screen.tsx` (`mapa-status`) | E6b | relatar |
| Baixo | Confirmação do time: blocos escuros atrás de cada palavra do nome (sombra do texto no Chromium sem GPU); conferir no aparelho | `team-confirm.tsx:125` | E5 | relatar |
| Baixo | Erro e offline da demonstração levam a `/indisponivel` em vez do estado de erro de cada tela | `services/api/demo/client.ts:66` | E10 | pendência (roteiro de erro por tela) |
| Baixo | Alvos < 44 só na web (chips 36–40 com `hitSlop`; `Switch` 40×20) | `relatorio.json` → `small` | E6 | relatar |

## 8. Arquivos

- **e2e:** `apps/mobile/e2e-web/capturas.cjs`, `demo-mode-flow.cjs` (novo), `onboarding-steps.cjs` (novo), `demo-flow.cjs`, `auth-flow.cjs`, `README.md`.
- **Correções pequenas em pastas de outras equipes** (avisando):
  - E6: `components/demo-badge.tsx` (`useDemoSealSpace`, `registerDemoSeal`), `components/screen.tsx`, `components/player-card.tsx`, `features/auth/demo-seal.tsx`, `features/screens/map-screen.tsx`, `features/screens/run-screen.tsx`;
  - E7: `features/engagement/missions-screen.tsx`, `rewards-screen.tsx`.
- **Teste novo:** `apps/mobile/src/__tests__/demo-seal-space.test.tsx`.
- **Capturas:** `docs/melhoria/capturas/depois/` (165 PNG + `relatorio.json`).

## 9. Testes

`npm run typecheck` ok; `eslint src` ok; Jest **1412 passaram**, 26 pulados (integração `*.local`), 127/131 suítes (4 puladas); `demo-mode-flow` **21/21**; capturas: 0 erros de página e 0 pedidos ao servidor. Deno e pgTAP não rodados: nada mudou em `supabase/` nem em `src/domain`.

## 10. Pendências

- Rodar `demo-flow` e `auth-flow` com o Supabase local, quando houver Docker.
- Rodar Maestro no aparelho e conferir no Android (pedidos da E4 e da E5):
  - barra que tinge o PNG da Correr;
  - splash do Android 12+;
  - fps dos confetes;
  - `toDataURL` do card (E8);
  - NVDA com a região viva do resumo.
- Pôr o `demo-mode-flow.cjs` na CI (precisa de `npx playwright install chromium` no job `web`).
- A régua estática (`medir-texto.mjs`, da E6) não cobre `/missoes`, `/recompensas` e `/compartilhar/*`.
