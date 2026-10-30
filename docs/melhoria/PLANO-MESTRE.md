# PLANO MESTRE — Reformulação v2 do NOMADE RUN (Fase 7)

> **Coordenador:** dono deste arquivo.
> **Fontes:**
> - o prompt `docs/melhoria/00-PROMPT-MELHORIA-COLOSSAL.md`;
> - os 10 relatórios da F1 em `docs/melhoria/F1/` (01 a 10).
>
> **Decisões completas:** `docs/DECISOES_TECNICAS.md`, D-62 a D-82. Aqui fica o resumo e o plano de execução.
> **Estado:** F0 ✅ · F1 ✅ · **F2 ✅ (este plano)** · F3/F4 em ondas · F5 QA · F6 fechamento.

---

## 0. O que vamos entregar (em 1 minuto)

1. **Ganhar área ficou simples e justo:** *"Corra pelas ruas para pintá-las com a cor do seu time; a zona fica com o time que pintou mais ruas nela."*
   - Na simulação, o novato que conquista na 1ª corrida passa de **13% para 62%**.
   - O novato que nunca conquista em 8 semanas cai de **32% para 0%**.
   - As zonas "eternas" caem de **38% para 11%**.
2. **Times com alma:**
   - 4 mascotes e 4 líderes, com biografia;
   - escolha de time na primeira abertura, no estilo Pokémon GO;
   - confirmação épica: a cor do time inunda a tela.
3. **Chefões de verdade:**
   - 5 chefões desenhados e animados (parado, golpe, furioso, derrotado);
   - Raid semanal real no servidor, com barra de vida e "Sua parte".
4. **Menos texto, mais imagem:**
   - toda aba com herói visual;
   - média de **82 → ≤ 40 palavras** por tela de jogo;
   - estados vazios ilustrados.
5. **Dopamina com ética:**
   - celebrações proporcionais ao feito (micro → épica);
   - resumo cinematográfico;
   - missões, baú do dia, sequência semanal com congelamento e níveis com títulos;
   - notificações honestas, no máximo 1 por dia.
6. **Social:**
   - card para Stories e feed com rota neon;
   - adesivo transparente;
   - feed da crew com "Bora!";
   - privacidade garantida (nenhum ponto dentro das zonas de privacidade).
7. **Plataforma:**
   - modo demonstração (app inteiro sem servidor);
   - CI no GitHub;
   - banco local sem Docker (285 testes pgTAP rodando aqui);
   - acessibilidade (contraste AA) e desempenho (só transform e opacidade).

---

## 1. Decisões (resumo; texto completo em `DECISOES_TECNICAS.md`)

| ID | Decisão | Origem |
|---|---|---|
| **D-62** | **Território v2 "Pintura de ruas"** (regra completa na seção 1.1) | E3 |
| **D-63** | **Sequência:**<br>• a sequência **não multiplica pontos** (corrige o +50% permanente);<br>• sequência **semanal** (2 atividades, caminhar vale);<br>• **congelamento automático** 1×/mês;<br>• **pausa de saúde** de 1 a 4 semanas, 1×/temporada | E3, E7, E1 |
| **D-64** | **Progressão:**<br>• curva de XP `arred10(50·n^1,3) + 50`;<br>• fontes de XP: 10/km até 5 km/dia, 5/km de 5 a 15 km, 0 depois; +30 por atividade (1×/dia); Atlas 2 por célula (máx. 60); missões; baú; semana garantida;<br>• **8 títulos**;<br>• **faixas de corredor por material** (Asfalto → Nômade), nunca por cor;<br>• XP nunca diminui | E7 |
| **D-65** | **Missões:**<br>• **3 diárias + 3 semanais** (sempre 1 leve; troca de 1 por dia);<br>• **primeira semana** com 7 passos sem prazo;<br>• resgate idempotente no servidor | E7, E9 |
| **D-66** | **Baú do dia:**<br>• crédito diário que acumula até **3**;<br>• abre com qualquer atividade ≥ 1 km;<br>• **chances visíveis**;<br>• o 20º baú sem lendário vira lendário;<br>• só XP e cosméticos, **nunca vendido** (ECA Digital) | E7, E9, E1 |
| **D-67** | **Raid real semanal:**<br>• janela de segunda 06:00 a domingo 21:00;<br>• vida proporcional ao volume da cidade;<br>• fases 100/67/33%, com pontos fracos a partir da fase 2;<br>• dano 10/km e crítico de 10% com a chance visível;<br>• teto de 21 km por corrida e 30 km por dia;<br>• recompensas cosméticas;<br>• "Sua parte" + "dano da cidade desde a sua última visita";<br>• global por enquanto (coluna `city` pronta);<br>• **violeta `#B15CFF` só para vilões** | E3, E9, E5, E4 |
| **D-68** | **Liga real:**<br>• grupos de até 30 com volume parecido;<br>• pontos = pontos da corrida;<br>• fechamento na segunda às 03:20;<br>• regra para grupo pequeno | E3, E9 |
| **D-69** | **Notificações:**<br>• **só locais** (o Expo Go Android não tem push remoto desde o SDK 53);<br>• engajamento: **1 por dia e 4 por semana**, só das **8h às 21h**, nunca no dia em que a pessoa já correu;<br>• escada de volta: 7, 14, 21 e 30 dias, depois silêncio;<br>• invasão e conquista entre 22h e 7h ficam só na central;<br>• aplausos agrupados em 1 por dia | E7, E2, E8 |
| **D-70** | **Identidade dos times:**<br>• mascotes: **Lume** (guepardo), **Faísca** (lebre elétrica), **Breu** (coruja) e **Faro** (coiote);<br>• líderes: **Íris Valente**, **Téo Faria**, **Nara Lis** e **Bento Rocha** (proposta trocável pelos autores);<br>• lema dos Night Owls: **"Donos das luzes da cidade"**;<br>• cores: base (`tokens.ts`) para preenchimento e texto sobre a cor; neon (`neon.ts`) para traço, brilho e arte | E4, E1 |
| **D-71** | **Arte e motion:**<br>• **sem Skia e sem Lottie na v2**: SVG (react-native-svg) + Reanimated 4.5;<br>• molas nas animações CSS via `linear()`;<br>• sem som;<br>• vibração com intervalo ≥ 150 ms;<br>• "Reduzir movimento" = fade de 150 ms, tratado à mão porque as animações CSS do Reanimated o ignoram;<br>• sem `onCSS*` (só na 4.6) | E5, E2, E4 |
| **D-72** | **Primeira abertura:**<br>• **Boas-vindas** (Começar / Já tenho conta) → cadastro enxuto → **"A cidade está dividida"** (≤ 6 s) → **escolha do time** (carrossel, líder, quiz "Não sei escolher") → **confirmação épica** (cor inunda a tela em ≤ 600 ms) → permissão de localização com explicação → Mapa com a **missão de boas-vindas**;<br>• permissão de notificação **depois da 1ª conquista**;<br>• sem o passo "nome" (só para OAuth sem nome) | E6, E1 |
| **D-73** | **Abas:** **Mapa · Arena · Correr · Clube · Você** (Atividades dentro de "Você"). Correr fica a 1 toque de qualquer aba | E6 |
| **D-74** | **Texto:**<br>• limites: título ≤ 30 caracteres; bloco ≤ 1 frase de até 90; média ≤ 40 palavras por tela de jogo; ≤ 25 na 1ª dobra;<br>• **glossário:** RP → "pontos"; Neblina → "Atlas"; células → "% da cidade"; influência → "domínio"; "missão" (tarefa) × "modo" (jogo) | E6, E3 |
| **D-75** | **Contraste:**<br>• **texto escuro `#070708` sobre o laranja** (7,02:1) e nos botões de perigo;<br>• bordas de campos e botões secundários ≥ 3:1 | E10, E6 |
| **D-76** | **Simulação só no modo demonstração:**<br>• **GPS real é o padrão**;<br>• nenhuma informação falsa em conta real: Raid, Liga e Encontro mostram dado real ou estado vazio ilustrado | E6, E10, E3 |
| **D-77** | **Modo demonstração:**<br>• cliente em memória atrás de `getSupabase()`;<br>• liga por `EXPO_PUBLIC_DEMO=1` (export com `--clear`) ou pelo botão "Ver demonstração";<br>• selo "Demonstração" sempre visível;<br>• caches e fila separados; teste que proíbe `fetch` | E10 |
| **D-78** | **Compartilhar:**<br>• técnica: SVG → `toDataURL` → arquivo → `expo-sharing`; plano B: view-shot **4.0.3 fixado**; na web, fonte embutida + Web Share ou baixar;<br>• **corte de privacidade no domain** (`share-privacy.ts`): folga sorteada, pontas de 150 a 250 m, sem horário, sem rota se mais de 60% for cortado;<br>• 5 modelos + sem rota + adesivo transparente | E8, E2 |
| **D-79** | **Feed social:**<br>• **só a crew**;<br>• reações prontas (Bora!, fogo, raio), **sem comentário**;<br>• teto de 200 por dia;<br>• rota do feed já cortada pelo domain | E8, E9 |
| **D-80** | **Servidor v2:**<br>• `game_config` (flags, tudo desligado por padrão) + `server_info()` (contrato 2);<br>• gravação v2 que **chama a v1 sem mudá-la**;<br>• tudo aditivo; ordem de deploy da E9;<br>• **banco local sem Docker** obrigatório antes de cada commit em `supabase/` | E9 |
| **D-81** | **CI no GitHub:**<br>• jobs app, web e functions, em commit e push isolados;<br>• contraste estrito liga depois da D-75 | E10 |
| **D-82** | **Telemetria:** opt-in, desligada por padrão, lista fechada de eventos, retenção de 30 dias (P2, última onda) | E7, E9 |

### 1.1 Território v2 (D-62), em detalhe

- **Regra em 1 frase:** "Corra pelas ruas para pintá-las com a cor do seu time; a zona fica com o time que pintou mais ruas nela."
- **Trecho:** a unidade de pintura é a célula H3 de resolução 11 (~40 m), com até **3 camadas**.
  - **Pintar:** passar no trecho pinta ou reforça uma camada do seu time.
  - **Rival:** cada passada do rival tira 1 camada.
  - **Desbotar:** uma camada desbota a cada 7 dias sem passada do time.
- **Dono da zona:** a zona (H3 res 9, desenhada como região suavizada) fica com o time que tem **mais trechos pintados**, com mínimo de **3 trechos**.
- **"Pontos" (antigo RP):** continuam, só para ranking, liga e Cidade × Cidade.
- **Mapa:**
  - nunca mostra hexágonos (regra do projeto);
  - o mapa público mostra **só as zonas**;
  - a rua pintada aparece **só na própria corrida**, como o rastro na cor do time;
  - a previsão ao vivo usa um retrato sem autor e sem as zonas de privacidade.
- **Virada:**
  - flag `territory_rule` em `game_config`, ligada pelos autores **na troca de temporada**, depois do EAS Update;
  - **herança:** cada zona com dono começa com 3 trechos virtuais do dono.
- **Reforço na conquista:** parâmetro **desligado** por enquanto (reduz a "evaporação" de 52% para 42%, mas custa ~10 pontos ao novato).
- **Bandeira** sai do anúncio; **Rabisco** fica como "em breve".

---

## 2. Ondas de implementação

### Como cada onda roda
- **Isolamento:** cada equipe trabalha numa **worktree isolada**, só nas suas pastas (tabela da seção 3), e faz commits pequenos na própria branch.
- **Integração:** o coordenador faz o merge de uma branch por vez, roda tudo e envia ao GitHub.
- **Ordem:** uma onda só começa quando a anterior está integrada e verde.
- **Relatório:** `docs/melhoria/relatorios/<frente>-onda<N>.md`. Conteúdo: o que foi feito, antes/depois, testes, pendências e pedidos.

### Onda 1 — Fundação (8 equipes em paralelo)

| ID | Equipe | Entrega | Pastas | Aceite |
|---|---|---|---|---|
| T7.1.1 | E3 | **`paint.ts`**: regra v2 pura (trechos, camadas, desbotamento, dono por maioria com mínimo 3, herança) | `src/domain/**` + ponte | propriedades: 1 dono por zona; camadas 1..3; simetria entre times; idempotência; só passos válidos; cobertura ≥ 90% |
| T7.1.2 | E3 | **`live-events.ts`**: eventos da corrida (pintou trecho, 25/50/75%, conquistou, defendeu, entrou em zona rival, "faltam X m"), com o nível de celebração de cada um | `src/domain/**` | 15 km a 1 Hz processados em < 200 ms; tipos exportados para E5/E6 |
| T7.1.3 | E3 | **`raid.ts`** (D-67) e **`league.ts`** (D-68) | `src/domain/**` | dano ≥ 0, teto diário, fase só avança, crítico determinístico por semente; liga com grupos ≤ 30 e regra para grupo pequeno |
| T7.1.4 | E3 | **Correções do domain atual** (E-03, E-06, E-07, E-08, E-11, desempate a favor dos Striders, zona neutra sem corrida, temporada que não reavalia o dono, O(n²) e cópia de vetor no `run-engine`), Fuga pelo ritmo-base (parte pura), `districtExploration` (Atlas por bairro) | `src/domain/**` | cada bug com teste de regressão; **sem mudar o comportamento que a v1 do servidor usa**: o novo vira função v2 e a antiga fica marcada como deprecated |
| T7.1.5 | E3 | **Contrato para a E9:** assinaturas e payloads `paint`/`raid`/`league`/`live-events` | `docs/melhoria/relatorios/` | diff exato das funções que as functions vão chamar |
| T7.1.6 | E7 | **`progression.ts`** (D-64, D-63, D-66) e **`missions.ts`** (D-65, catálogo de 29 missões) | arquivos novos em `src/domain/` + ponte | XP ≥ 0 e nível que só sobe; curva nova ≤ atual; missão conclui no máximo 1 vez; sempre 1 leve; textos ≤ 40 caracteres |
| T7.1.7 | E7 | **`reminders.ts`** (D-69): planejador puro de notificações locais | arquivo novo em `src/domain/` + ponte | no máximo 1 por dia e 4 por semana; nada fora das 8h–21h; nada no dia em que correu; silêncio depois de 30 dias; preferências respeitadas |
| T7.1.8 | E8 | **`share-privacy.ts`** e **`gpx.ts`** (D-78) | arquivos novos em `src/domain/` + ponte (revisão da E3 no relatório) | propriedade com ≥ 1.000 casos: nenhum ponto dentro de zona, pontas e pedaços ≥ 150 m; GPX 1.1 válido, sem horários quando cortado |
| T7.1.9 | E8 | **Modelo do card** (puro) e **componentes SVG** dos 5 modelos × 2 formatos + sem rota + adesivo, com espaço para a arte por props | `src/features/social/card/**` | regras de escolha testadas; medida de texto com erro < 3%; renderiza sem erro; selo de demonstração quando for o caso |
| T7.1.10 | E4 | **Sistema de arte:**<br>• primitivas neon (níveis completo, leve e plano);<br>• 4 mascotes × 4 poses (respirar e piscar com `useReducedMotion`);<br>• emblemas completo e compacto;<br>• 5 chefões × 4 estados × 3 níveis de dano;<br>• baús (3 × 3 estados, grupo `tampa`);<br>• 12 medalhas (3 níveis + bloqueada);<br>• 8 ícones de modos;<br>• 8 estados vazios;<br>• 3 cartões do tutorial;<br>• fundos das abas | `src/components/art/**` | 1 teste de renderização por família; legível em 28–40 px; decorativo fora do leitor de tela |
| T7.1.11 | E4 | **Galeria `/dev/arte`** (só em `__DEV__` ou na web) | `src/app/dev/arte.tsx` (+ `src/app/dev/_layout.tsx`) | todas as peças visíveis; captura PNG por família no relatório |
| T7.1.12 | E5 | **Tokens de motion v2:** 4 molas, `springCss()` com `linear()`, curvas e escala de celebração | `src/theme/motion.ts` | teste de `springCss` (começa em 0, termina em 1, overshoot só com amortecimento < 1) |
| T7.1.13 | E5 | **Primitivas:**<br>• `haptics.ts` (8 padrões, intervalo de 150 ms, `performAndroidHapticsAsync`, nada na web);<br>• `CountUp` na thread de UI;<br>• `ProgressBar` e `ProgressRing` (com barra fantasma e marcos);<br>• `Confetti`, `Burst`, `Flash`, `FloatingNumber`, `SpinRays`, `Shake`;<br>• `ShimmerSkeleton`;<br>• `PressableScale` com vibração e brilho | `src/components/motion/**` | só transform e opacidade; trajetórias determinísticas por semente; controle de 150 ms testado |
| T7.1.14 | E5 | **Orquestrador de celebrações** (`planCelebrations`, `skipTo`, `a11ySummary`, `<CelebrationSequence>`) e os momentos `RewardToast`, `ZoneCaptured`, `ChestOpening`, `BossHit`, `BossDefeated`, `LevelUp`, `StreakFlame`, `RankShift`, `PRStamp` e `TeamConfirm`, com arte por props | `src/components/celebration/**` | parte pura com ≥ 95% de cobertura; "Pular" ≤ 200 ms; 1 anúncio para o leitor de tela; versão com movimento reduzido |
| T7.1.15 | E5 | **Galeria `/dev/motion`** | `src/app/dev/motion.tsx` | cada momento disparável; quadros PNG no relatório |
| T7.1.16 | E6 | **Correções de honestidade e segurança, já:**<br>• GPS como padrão na Nova corrida (`run-screen.tsx:61`);<br>• textos falsos E-01, E-04, E-18, E-21 a E-24 (conquista "garantida", "dobro", Raid "vale em toda corrida", contador falso, "17 confirmados", barra de crew sem sentido, "Cada nível libera…");<br>• tela "indisponível" sem jargão de desenvolvedor;<br>• "Donos das luzes da cidade" | `src/features/screens/**`, `src/features/auth/**`, `src/theme/tokens.ts` | nenhuma promessa falsa visível; simulação só como chip explícito marcado "demonstração" (até a onda 2 ligar o modo demonstração) |
| T7.1.17 | E6 | **Tokens e componentes base:**<br>• D-75: texto escuro no laranja; bordas ≥ 3:1; token `villain`;<br>• `HeroHeader`, `BigRunButton`, `StatTile`, `ModeCard`, `PlayerCard`, `FeedRunCard` (mini-mapa), `WeekBars`, `DailyStrip`, `AlertSlot`, `MissionCoachCard`, `TeamCarousel`/`TeamPickerCard`, `LeaderSheet`, `PermissionPrimer`, `HelpSheet`, `DemoBadge`, `SettingsRow`, `EmptyState` (com arte) e `SectionHeader`;<br>• o anel de progresso vem da E5 (`ProgressRing`): não duplicar | `src/components/**` (sem `art`, `motion` e `celebration`), `src/theme/tokens.ts`, `neon.ts` | contraste AA conferido pelo `docs/melhoria/F1/qa/contraste.cjs`; `testID` e `accessibilityLabel`; alvos ≥ 44 pt; `maxFontSizeMultiplier` onde o layout quebra |
| T7.1.18 | E10 | **Modo demonstração (D-77):**<br>• servidor em memória que imita as 19 tabelas, 11 RPCs, 8 functions (o `finish-activity` usa o próprio domain), Auth, Realtime e Storage;<br>• costura em `supabase.ts`, `env.ts`, caches, fila e transporte;<br>• sessão de demonstração automática com `EXPO_PUBLIC_DEMO=1` | `src/services/api/demo/**` (novo), `src/demo/**`, `supabase.ts`, `env.ts`, `*-cache*.ts`, `services/offline/queue*.ts`, `services/sync/transport.ts` | fluxo entrar → correr → resumo sem nenhum `fetch` (teste); `src/demo` continua sem React/Expo (o `gen-seed.ts` importa) |
| T7.1.19 | E10 | **Teste de contrato da demonstração**, **vazamento do Jest** e **`e2e-web/capturas.cjs`** (rota × estado × 3 resoluções, com pngquant) | `src/__tests__/**`, `e2e-web/**`, `docs/melhoria/capturas/**` | o contrato falha com uma RPC nova sem par; `--detectOpenHandles` limpo; capturas com selo |
| T7.1.20 | E10 | **CI** (`.github/workflows/ci.yml`) em **commit separado** | `.github/workflows/**` | o coordenador envia sozinho e confere; se o GitHub recusar (permissão `workflow`), vira instrução para o dono |
| T7.1.21 | E9 | **Banco local no repositório:** `supabase/scripts/banco-local.sh` + shim + script npm | `supabase/scripts/**`, `package.json` da raiz (só o script) | 285/285 pgTAP passando aqui |
| T7.1.22 | E9 | **Contrato v2:** `game_config`, `server_info()`, `xp_ledger` + `grant_xp`, tipos novos de notificação; testes `01` e `12` atualizados | `supabase/migrations/**`, `supabase/tests/**` | flags desligadas; app antigo intocado; pgTAP verde |
| T7.1.23 | E9 | **Tabelas e RPCs:** Raid (D-67), Liga (D-68), missões, medalhas e trilha (D-65), baú do dia (D-66), com jobs idempotentes e RLS | `supabase/migrations/**`, `supabase/tests/**` | tetos, fases e prêmios idempotentes; sorteio 3+3 determinístico; resgate idempotente; revoke padrão em `anon`/`authenticated`; pgTAP novo verde |

### Onda 2 — O jogo de verdade e os fluxos (9 frentes em paralelo)

> **Ajuste da onda 1:** onda 1 integrada e verde (986 testes no app, 574 pgTAP, 58 Deno, CI ativa no GitHub). Mudanças:
> - **Telas:** a E6 trabalha em 2 frentes com arquivos separados, E6a (primeira abertura, abas e layout) e E6b (Mapa, Correr e Resumo).
> - **Repositórios:** cada equipe de feature cria os seus repositórios no app e os pares no servidor de demonstração.
> - **Raid:** a Fuligem é pulada em agosto e setembro (D-84).

| ID | Equipe | Entrega | Pastas |
|---|---|---|---|
| T7.2.1 | E9 | **Gravação v2:**<br>• `finish-activity` e moderação chamam a v1 e depois `applyPaint`/`scoreRunV2`/`raidDamage` (contrato da E3) e os extras de engajamento (contrato da E7), atrás das flags;<br>• pintura: `zone_cells`, `paint_marks`, colunas em `zones`, `zone_paint_near` e o job de desbotar;<br>• testes Deno de paridade das constantes | `supabase/**` |
| T7.2.2 | E9 | **Feed e aplausos** (corte com `clipRouteForSharing` na function), **recordes e parciais**, `my_engagement()`, `record_share`, **LGPD v2** (`account_export_v2` + teste estrutural) e **seed v2 de demonstração** idempotente | `supabase/**`, `docs/API_CONTRATO.md`, `supabase/DEPLOY.md` |
| T7.2.3 | E3 | **Rodízio da Raid** sem a Fuligem em agosto e setembro (D-84); **simulação como teste de regressão** usando `applyPaint`; **repositórios do app para Raid, Liga e pintura** e os **pares na demonstração** | `src/domain/**`, `src/services/api/{raid,league,paint}-repo.ts`, `src/services/api/demo/**` (só os pares desses) |
| T7.2.4 | E7 | **Engajamento no app:**<br>• repositório e pares na demonstração;<br>• store;<br>• telas `/missoes` e `/recompensas`;<br>• bloco "Recompensas" para o resumo;<br>• dados da faixa de hoje do Mapa;<br>• notificações locais com `planReminders` (replanejar ao abrir, sincronizar e correr);<br>• preferências novas;<br>• "Bem-vindo de volta";<br>• pausa de saúde | `src/features/engagement/**`, `src/features/notifications/**`, `src/store/engagement-store.ts`, `src/services/api/engagement-repo.ts`, `src/services/api/demo/**` (só os pares), o bloco `NotificationPrefs` em `src/services/api/types.ts`, `src/app/missoes.tsx`, `src/app/recompensas.tsx` |
| T7.2.5 | E8 | **Compartilhar:**<br>• `useShareCard` (nativo com `toDataURL` e web com fonte embutida + Web Share/baixar);<br>• `<ShareButton>`;<br>• tela `/compartilhar/[id]`;<br>• `useExportGpx`;<br>• **feed da crew** com "Bora!" (repositório + pares na demonstração);<br>• convites (código + link);<br>• `expo-clipboard` para "Copiar legenda";<br>• selo de demonstração dentro da área segura dos Stories | `src/features/social/**`, `src/services/api/{feed,share}-repo.ts`, `src/services/api/demo/**` (só os pares), `src/app/compartilhar/**`, `apps/mobile/package.json` (só o `expo-clipboard`, com `npx expo install`) |
| T7.2.6 | E6a | **Primeira abertura (D-72):**<br>• Boas-vindas, cadastro enxuto, "A cidade está dividida", carrossel de times com líder e quiz, `TeamConfirm` (E5) com a arte (E4), explicação da permissão de localização e missão de boas-vindas;<br>• **abas novas (D-73)**: Mapa · Arena · Correr · Clube · Você;<br>• botão "Ver demonstração" + selo no `_layout` (com o interruptor da E10);<br>• montar o planejador de lembretes da E7 no `_layout` | `src/app/(auth)/**`, `src/app/onboarding.tsx`, `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx` e rotas novas de aba, `src/features/auth/**`, `src/features/screens/onboarding*`, `src/components/app-tabs*.tsx`, `.maestro/**` |
| T7.2.7 | E6b | **Mapa:**<br>• faixa de hoje, alerta, "o que mudou" e missão;<br>• rastro pintado (nunca hexágono);<br>• recálculo das regiões só quando o mapa muda;<br>**Correr:**<br>• HUD com `createLiveTracker` ("faltam X m") e toasts;<br>• `appendPoint`, `isUnderAttackAt`;<br>**Resumo:**<br>• cinematográfico com `CelebrationSequence`, bloco da E7 e `ShareButton` da E8;<br>**Em todas:**<br>• trocar `GrowBar`/`InfluenceBar`/`GrowPillar` por `ProgressBar`, `ActivityIndicator` por `ShimmerSkeleton` e `expo-haptics` direto por `haptic()` | `src/app/(tabs)/index.tsx`, `src/app/corrida.tsx`, `src/app/resumo.tsx`, `src/features/screens/{map-screen,map-layer-chips,run-screen,summary-screen,game-motion*}`, `src/features/run/**`, `src/components/territory-map*` |
| T7.2.8 | E4 | **Arte que falta:**<br>• bustos dos 4 líderes;<br>• estados golpe, furioso e derrotado de Soneca, Rei Buzina e Fuligem;<br>• mascote de corpo inteiro em corrida (escolha de time);<br>• logo oficial (SVG + PNG do ícone, sem mexer no `app.json`);<br>• trocar a constante `VILLAIN` pelo token `neon.villain` | `src/components/art/**`, `apps/mobile/assets/art/**` |
| T7.2.9 | E5 | **Integração:**<br>• arte da E4 nos momentos (baú, chefão, mascote no `TeamConfirm`);<br>• **adaptador `LiveEvent` → `CelebrationEvent`**;<br>• momento do "Bora!";<br>• preferências "Vibração" e "Pular celebrações" (store próprio, sem biblioteca nova) | `src/components/motion/**`, `src/components/celebration/**`, `src/store/motion-prefs-store.ts` |
| T7.2.10 | E10 | **Plataforma:**<br>• interruptor do modo demonstração em tempo de execução (`enterDemo`/`exitDemo`, zerando fila, sync, stores e cliente);<br>• CI com `db:test:local` (pgTAP) e contraste `--strict`;<br>• teste estático "só transform e opacidade" nos estilos animados;<br>• teste de contrato atualizado | `src/services/**` (só a costura e `demo/` do núcleo), `src/__tests__/**`, `e2e-web/**`, `.github/workflows/**` |

**Conflitos esperados (o coordenador resolve no merge):**
- os índices de handlers de `src/services/api/demo/` (cada equipe acrescenta só as suas linhas);
- `src/services/api/types.ts` (só o bloco de cada equipe).

### Onda 3 — As outras telas e os encaixes entre as frentes (8 frentes em paralelo)

> **Onda 2 integrada e verde:** 1.287 testes no app, 716 pgTAP, 82 Deno, CI com o job do banco. Cada frente entregou peças prontas para encaixar (hooks, componentes, repositórios). Nesta onda, quem é dono da tela encaixa as peças e termina as telas que faltam.

| ID | Equipe | Entrega | Pastas |
|---|---|---|---|
| T7.3.1 | E6a | **Layout e "Você":**<br>• `useReminderPlanner()` no `_layout`;<br>• rotas `/missoes` e `/recompensas` no guard do app;<br>• `<WelcomeBackGate />` nas abas;<br>• **Você**: cartão de jogador com anel de nível, título e mascote, estante de medalhas, Corridas com mini-mapa e gráfico da semana, ajustes atrás da engrenagem;<br>• **Ajustes**: lembretes da E7, "Vibração" e "Pular celebrações" da E5, pausa de saúde da E7, `<FeedSettings/>` da E8, convite do app;<br>• `LeaderBust` e `MascotRunner` (qualidade leve) no onboarding;<br>• `haptic()` no lugar do `expo-haptics` direto em `button.tsx`, `hold-button.tsx`, `use-run-safety.ts`, onboarding e `faction-screen`;<br>• `NeonBackdrop` com `usePausedWhenHidden`;<br>• notificações agrupadas por dia;<br>• telas secundárias (contatos, zonas de privacidade, Meu time) com estado vazio ilustrado | `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/perfil/**`, `src/features/screens/{profile,activities,account,edit-profile,faction,privacy-zones}-screen*`, `src/features/auth/**`, `src/features/safety/**`, `src/features/notifications/notifications-screen.tsx`, `src/components/**` (sem `art`, `motion`, `celebration`) |
| T7.3.2 | E6b | **Encaixes do Mapa, do Correr e do Resumo:**<br>• Mapa: `today` a partir do `useTodayStrip()` da E7 e do chefão do `fetchRaidCurrent()` da E3;<br>• Resumo: bloco `RunRewardsBlock` (E7) e `<ShareButton>` (E8) por `renderShare`;<br>• Correr: retrato `fetchPaintNear()` (E3) no `createLiveTracker` e `createLiveFeedback()` (E5) no lugar do `toastForEvent`; aviso "Sua 1ª zona!";<br>• **Folha da zona** (`zona/[id]`): barra de duas cores, 1 frase de regra, ilustração do dono, ação visível no detent 0,55 (135 → ≤ 50 palavras);<br>• remover o `CaptureCelebration` sem uso (e a menção no `reduced-motion.test`) | `src/app/(tabs)/index.tsx`, `src/app/resumo.tsx`, `src/app/corrida.tsx`, `src/app/zona/**`, `src/features/screens/{map-screen*,run-screen,summary-screen,zone-sheet,game-motion*}`, `src/features/run/**`, `src/components/{territory-map*,capture-celebration*}`, `src/__tests__/reduced-motion.test.ts` (só a menção) |
| T7.3.3 | E6c (nova frente da E6) | **Arena:**<br>• chefão ilustrado com vida real (`fetchRaidCurrent`), "Sua parte" e fases;<br>• 3 anéis de missões (E7);<br>• grade 2×2 de modos com `ModeIcon`;<br>• faixa da liga (`fetchLeagueCurrent`);<br>• "?" com o tutorial em 3 cartões;<br>• 195 → ≤ 45 palavras<br>**Clube e Crew:**<br>• emblema e meta semanal da crew;<br>• `<CrewFeed>` (E8);<br>• pódio com 1 linha de filtro;<br>• convite da crew (`InviteCard`)<br>Sem dado verdadeiro: estado ilustrado, nunca número inventado | `src/app/(tabs)/arena/**`, `src/app/(tabs)/clube/**`, `src/features/screens/{arena-screen,club-screen,crew-screen,club-ranking}*` |
| T7.3.4 | E4 | **Arte:**<br>• chama e gelo da sequência (`StreakFlame`);<br>• ícone laranja da aba Correr (PNG para o nativo);<br>• splash com o logo;<br>• arte dos estados vazios novos que as telas pedirem;<br>• trocar a cor do baú raro se ainda colidir | `src/components/art/**`, `apps/mobile/assets/art/**` |
| T7.3.5 | E5 | **Motion:**<br>• corrigir na `CelebrationSequence` o leitor de tela "sempre ligado" do react-native-web, removendo o contorno `screenReader={false}`;<br>• chama e gelo da E4 no `StreakFlame`;<br>• clarão do golpe com a silhueta do `Boss`;<br>• item do baú (`Chest layer="item"`);<br>• medir o custo das partículas | `src/components/motion/**`, `src/components/celebration/**` |
| T7.3.6 | E7 | **Engajamento:**<br>• `firstConquestEver` para o HUD;<br>• `/recompensas` com "Ver todos" (≤ 120 palavras visíveis);<br>• telemetria opt-in no app (D-82), desligada por padrão, com a tela de consentimento;<br>• prêmio da primeira semana ligado às missões reais | `src/features/engagement/**`, `src/features/notifications/**` (exceto a tela), `src/app/missoes.tsx`, `src/app/recompensas.tsx`, `src/services/api/engagement-repo.ts` e os seus pares |
| T7.3.7 | E8 | **Social:**<br>• arte real no card (`mascotSlot`, `bossSlot`, `LogoSvgArt`);<br>• `BoraReaction` (E5) no feed;<br>• Realtime dos aplausos;<br>• card de recap semanal (com o `weekly_recap` da E9) | `src/features/social/**`, `src/services/api/{feed,share}-repo.ts` e os seus pares |
| T7.3.8 | E9 | **Servidor:**<br>• `paintedToday` no `zone_paint_near`;<br>• `pauseAvailable` no `my_engagement`;<br>• `weekly_recap`;<br>• telemetria opt-in (D-82: lista fechada, retenção de 30 dias);<br>• casos adversariais da v2 em `supabase/tests/security/`;<br>• o seed v2 na CI | `supabase/**`, `docs/API_CONTRATO.md`, `supabase/DEPLOY.md`, `.github/workflows/ci.yml` (só o passo do seed, em commit separado) |

A medição "depois" (régua de texto, capturas de todas as rotas e teste de 5 segundos) fica para a onda 4, com a E10, sobre as telas finais.

### Onda 4 — QA e polimento (F5)
- **E10 + revisor:** revisão adversarial com fluxos completos no modo demonstração, contraste, toque, leitor de tela, movimento reduzido, medição de texto e checklist de ética.
- **Ciclo:** achados Alto/Médio voltam para os donos, até zerar.

### Fechamento (F6, coordenador)
- **Documentação:** `PROGRESSO`, `REQUISITOS`, `DECISOES_TECNICAS`, `API_CONTRATO`, `DEPLOY`, `COMO_APRESENTAR`, README e a proposta de ERS v1.2 em `ERS-ALTERACOES-PROPOSTAS.md`.
- **Apresentação** com as telas novas e os números reais.
- **Push final** e prévia web na Vercel (só com o ok do dono).

---

## 3. Donos de pastas (implementação)

| Equipe | Pastas |
|---|---|
| E3 | `src/domain/**` (menos os arquivos novos da E7 e da E8) + registro na ponte das functions (`supabase/functions/_shared/domain.ts`, `supabase/functions/deno.json`, `supabase/scripts/deno.json`) |
| E7 | `src/domain/progression.ts`, `missions.ts`, `reminders.ts` (+ testes e ponte); `src/features/engagement/**`; `src/features/notifications/**`; rotas `/missoes` e `/recompensas` (onda 2) |
| E8 | `src/domain/share-privacy.ts`, `gpx.ts` (+ testes e ponte); `src/features/social/**`; rotas `/compartilhar/[id]` e feed (onda 2) |
| E4 | `src/components/art/**`; `src/app/dev/arte.tsx` e `src/app/dev/_layout.tsx` |
| E5 | `src/theme/motion.ts`; `src/components/motion/**`; `src/components/celebration/**`; `src/app/dev/motion.tsx` |
| E6 | `src/app/**` (exceto as rotas acima); `src/features/screens/**`; `src/features/auth/**` (UI); `src/components/**` (sem `art`, `motion`, `celebration`); `src/theme/tokens.ts`, `neon.ts` |
| E9 | `supabase/**` (menos a ponte, que é de quem cria o arquivo no domain); `docs/API_CONTRATO.md`; `supabase/DEPLOY.md`; na onda 2, `src/services/api/**` (repos novos e pares da demonstração) |
| E10 | `src/services/api/demo/**`, `src/demo/**`, a costura (onda 1); `src/__tests__/**`; `e2e-web/**`; `.github/workflows/**`; `docs/QA.md`; `docs/melhoria/capturas/**` |
| Coordenador | merges, `package.json`/`app.json`, `src/app/_layout.tsx` (libera por onda), `src/features/auth/route-guard.ts` (libera por onda), documentos de coordenação |

**Arquivos compartilhados por onda:**
- **Onda 1:**
  - **ponte das functions:** E3, E7 e E8 acrescentam cada um a sua linha; o coordenador resolve o conflito no merge;
  - **`package.json` da raiz:** só a E9, para o script do banco local;
  - **`apps/mobile/package.json`:** ninguém. A v2 não instala biblioteca nativa nova.
- **Onda 2:**
  - **`_layout.tsx` e `route-guard.ts`:** E6;
  - **`apps/mobile/package.json`:** E8, para o `expo-clipboard`, se aprovado no relatório da onda 1.

---

## 4. Regras de execução para as equipes (valem em todas as ondas)

1. **Preparar a worktree:** `ln -s /home/user/nomaderun/apps/mobile/node_modules apps/mobile/node_modules`, se não existir.
2. **Antes de cada commit, em `apps/mobile`:** `npm run typecheck`, `./node_modules/.bin/eslint src` e `npx jest --maxWorkers=2`. Durante o trabalho, rode só a parte que mudou: a máquina tem 4 núcleos e 15 GB, divididos entre as equipes.
3. **Mexeu no domain ou nas functions:** na raiz, `npx -y deno test --allow-read --config supabase/functions/deno.json supabase/functions/tests` e `npx -y deno check --config supabase/functions/deno.json supabase/functions/*/index.ts`.
4. **Mexeu em `supabase/`:** banco local + pgTAP (`docs/melhoria/F1/backend/banco-local.sh`, ou a versão do repositório depois da T7.1.21).
5. **Commits:** pequenos, em português, com as duas linhas de atribuição do projeto no fim. **Nada de push, merge ou rebase em outra branch.**
6. **O que não pode:**
   - desligar, pular ou apagar teste para ficar verde;
   - dado falso em conta real;
   - hexágono no mapa;
   - segredo no código.
7. **Relatório e resposta final:**
   - relatório em `docs/melhoria/relatorios/<frente>-onda<N>.md`;
   - resposta final: branch, commits, arquivos, testes com números, pendências e pedidos para outras equipes.

---

## 5. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Memória e CPU com 8 equipes ao mesmo tempo | `--maxWorkers=2`; testes por pasta durante o trabalho; o export web só quando precisar |
| Conflito na ponte das functions | Cada equipe acrescenta só a própria linha; o coordenador resolve no merge |
| Mudar o domain quebrar o servidor que está na nuvem | Funções v2 novas; as v1 continuam iguais (deprecated) até a gravação v2 ligar pela flag |
| Pintura revelar a rota de alguém | Mapa público só com zonas; rua pintada só na própria corrida (D-62) |
| Card revelar a casa | Corte no domain com folga sorteada; teste de propriedade (D-78) |
| view-shot 5.1.0 sobre o nativo 4.0.3 do Expo Go | Técnica principal é SVG `toDataURL`; o view-shot, se usado, fica fixado em 4.0.3 |
| Push recusado pela CI (permissão `workflow`) | Commit e push isolados; plano B é o dono criar o arquivo pelo site |
| Desempenho no Android (mascotes com ~230 elementos, partículas) | Níveis de qualidade da arte; teto de 60 partículas; nada pesado durante a corrida; a E10 mede |
| Pessoas reais errarem mais que a avaliação heurística | Teste de 5 segundos com 5 ou mais pessoas na F5 |

---

## 6. O que depende dos autores (Gabryel e Mateus)

1. **A-1:** trocar no Supabase Cloud as senhas das contas de demonstração (admin e moderador). Hoje elas são públicas.
2. **Deploy do backend v2 no Cloud**, na ordem do `supabase/DEPLOY.md`: backup → `db push` → functions → seed v2 → EAS Update → ligar as flags uma a uma. O **território v2 liga na virada de temporada**.
3. **Nomes:** aprovar ou trocar os nomes dos mascotes e líderes (D-70). Trocar o nome não muda a arte.
4. **Opcional:**
   - ligar os MCPs da Expo e do Supabase (só leitura);
   - deixar só um conector da Vercel;
   - subir o plano do Whimsical, se quiserem o board completo (os wireframes estão em PNG).
5. **CI:** se o GitHub recusar o arquivo da CI, criá-lo pelo site, com o conteúdo pronto em `docs/melhoria/ci/ci.yml`.
6. **ECA Digital:** confirmar com o orientador a leitura sobre baús grátis (D-66).
