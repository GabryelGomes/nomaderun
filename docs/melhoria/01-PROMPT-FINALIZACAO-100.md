# NOMADE RUN — Prompt da Fase 8: finalização 100%

> Prompt mestre da fase final. Escrito pelo coordenador a partir de 4 pesquisas feitas para esta fase (`docs/melhoria/F8/01` a `04`), do pedido do dono e do estado real do código. Toda equipe lê este arquivo inteiro antes de começar. O prompt da Fase 7 (`00-PROMPT-MELHORIA-COLOSSAL.md`) continua valendo no que não for contrariado aqui.

## 0. O pedido do dono, nas palavras dele

- "Não há necessidade de dois botões que fazem a mesma coisa: o Correr no meio e o Correr grande na tela."
- "Os símbolos das equipes ainda em alguns lugares estão os antigos. Você criou os animais: deixe eles nos ícones das equipes. Se já estiverem bons, deixe; se não, desenhe outros. Não tenha preguiça."
- "Assim que criar uma conta, ter uma experiência incrível para escolher a equipe, com artes bem desenhadas."
- "As equipes por animais, como você fez; o mascote como a capa da equipe."
- "Deixar o app funcionando 100%, que tudo faça sentido, que usar seja uma experiência, que a pessoa tenha prazer ao usar. Estude como o cérebro funciona e use técnicas de motivação, com ética."
- "Artes únicas, bonitas, que deem vontade de jogar. Efeitos visuais. Seguro. Uma equipe profissional para tudo: planejamento, implementação, segurança, design, imagens."

## 1. Diagnóstico (o que as 4 pesquisas acharam)

### 1.1 Produto e comportamento (`F8/01`)
1. Hoje a pessoa digita e-mail e senha antes de ver qualquer valor: 9 a 10 toques e 2 a 3 campos até a primeira recompensa emocional (a cerimônia do time). O Duolingo dá valor antes da conta; é o padrão mais forte que o app ainda não usa.
2. Escolher o time cedo só funciona com contexto curto, escolha identitária (sem vantagem numérica) e um marcador visível na hora (a "camiseta" do Splatfest).
3. Dopamina, na literatura séria, é antecipação e surpresa, não prazer. A surpresa tem de ser honesta e vir do resultado real.
4. O gatilho de retorno mais barato e mais forte é um plano: "quando você corre de novo?" (intenção de implementação, d = 0,65 em 94 estudos).
5. Sequência quebrada derruba o uso, sobretudo quando a pessoa se culpa; precisa ser consertável e sem culpa.
6. O ECA Digital (art. 20, em vigor desde 03/2026) proíbe caixa de recompensa em jogo acessível a menores. O baú do app é grátis, ganho correndo e com chances públicas; continua assim e nunca vira compra.
7. Lista de 15 "nunca" (§3.2 do relatório), obrigatória para toda equipe.

### 1.2 Direção de arte (`F8/02`)
1. O selo antigo dos times (`components/team-badge.tsx`, disco sólido com forma geométrica) aparece em 27 lugares de 18 arquivos, em cor sólida, ao lado de mascotes em neon. É a origem dos "símbolos antigos".
2. Sistema novo aprovado em protótipo (`F8/arte/proposta/antes-depois.png`): a cabeça do mascote dentro da forma do time, em `mini` (18–36 pt), `medio` (40–72), `grande` (96+), mais `mono` e `neutro`. A forma continua como pista para daltônicos (testado em cinza).
3. O corredor (`MascotRunner`) é a peça mais forte e vira a "capa" do time (`F8/arte/proposta/capas.png`): mascote correndo, cidade neon mínima, pista, nome, lema de 3 palavras e 1ª linha da bio.
4. Manter: chefões, baús, vazios, logo, sequência, aba Correr, tutorial, fundos. Retocar: medalhas (ícone interno 35% → 55–60%, níveis reordenados), ícone do Raid (lê como gato). Líderes: retocar expressão, prioridade 3.
5. Ferramentas: SVG + Reanimated continuam (D-71). Lottie, Skia e Rive não entram. HyperFrames só serve para vídeo da apresentação.

### 1.3 Auditoria de UX (`F8/03`, 33 telas, nota média 3,5/5)
- **Correr está triplicado:** aba Correr + CORRER do Mapa + uma tela-fantasma "Bora pintar a cidade?" com um 3º CORRER.
- **Dois níveis diferentes** para a mesma pessoa: `domain/games.ts:184` (Você e Resumo) × `domain/progression.ts:141` (Recompensas). Depois da 1ª corrida, o Resumo diz "Nível 3" e o Você diz "nível 2".
- **A missão de boas-vindas não some** depois de cumprida e esconde o alerta de ataque.
- **Erro 503 trava o app inteiro** mesmo com o perfil em cache; offline e carregando mostram **zeros como se fossem dados**; 5 padrões visuais diferentes de "sem conexão".
- **404 em inglês** ("Unmatched Route").
- Resumo repete XP 3×; Arena sem ação (chefão não responde ao toque, Liga sem destino); prazo de defesa em 3 formatos; "Missão" como título dos modos; 3 nomes para a Corrida Segura; Ajustes com 5 telas de rolagem, "Sair" 2× sem confirmar; missões e recap escondidos; 11 conceitos de progressão sem explicação.
- Lista completa UX-01 a UX-39 em `F8/03` §6, com dono, esforço e severidade.
- O que já está bom e não se mexe: escolha do time (5/5), permissão de GPS, corrida ativa, folha da zona, notificações.

### 1.4 Skills e tecnologias (`F8/04`)
1. 10 skills instaladas em `.claude/skills/` (entre elas `eas-update`, `eas-app-stores`, `character-design`, `icon-design`, `player-onboarding`, `mobile-audit`, `maestro-e2e`, `lgpd-privacy-policy`, `lgpd-eca-digital-minors`, `localize-pt`). Use a que couber na sua frente.
2. Testado de verdade no SDK 57: Lottie e Skia instalam, mas quebram na web como estão (WASM externo; Skia exige 2,9 MB); Rive não roda no Expo Go. **Regra desta fase: personagens com SVG + Reanimated; nenhuma biblioteca nova que não rode no Expo Go.** HyperFrames renderiza MP4 a partir de HTML (testado: card de time 1080×1920 em 9 s); só na apresentação.
3. **O OTA está quebrado:** falta `expo-updates`, e não há `projectId`, `updates.url` nem `runtimeVersion` no `app.json`; o `publicar.sh` não passa `--environment`. O APK interno nunca recebe o que `npm run publicar` publica. Também faltam `android.package` e `ios.bundleIdentifier`.
4. **Pacote legal mínimo que falta:** página web de exclusão de conta (o Google Play exige), controlador e encarregado nomeados na política de privacidade (dado dos autores), decisão 16+ × 18+ com o orientador.
5. **Riscos de publicação abertos:** nenhum limite de chamadas por pessoa nas Edge Functions; SMTP padrão do Supabase com confirmação de e-mail desligada; senhas das contas demo (A-1).
6. MCPs: Figma e Mobbin estão em plano gratuito/limitado; Vercel funciona, mas ainda não há projeto do NOMADE.

## 2. Decisões do coordenador (registrar em `docs/DECISOES_TECNICAS.md`)

| D | Decisão |
|---|---|
| **D-89** | **4 abas: Mapa · Arena · Clube · Você.** A aba Correr sai; o CORRER de 72 pt do Mapa é o único "começar corrida" genérico. `/correr` redireciona para `/corrida`. `RunTabScreen` e `app-tabs-correr` são apagados. Substitui a D-73. Os pontos de partida com contexto continuam (Defender, Fuga, Caça, "Ir" das missões, vazios). |
| **D-90** | **`TeamEmblem` substitui o selo antigo em todo lugar.** Cabeça do mascote na forma do time, variantes `mini`/`medio`/`grande`/`mono`/`neutro`, cor **neon** (`neonTeam`); a cor sólida dos tokens fica só para regiões do mapa e texto em fundo claro. `TeamBadge` vira alias fino de `<TeamEmblem variant="auto" />` (troca os 27 usos de uma vez), depois os usos são revistos um a um para o tamanho certo. Piso de 18 pt. Cabeça line-art só ≥ 96 pt; busto só ≥ 120 pt. |
| **D-91** | **Valor antes da conta.** Ordem da primeira abertura: Boas-vindas (herói com os 4 mascotes correndo) → "A cidade está dividida" (≤ 6 s, pular a partir de 2 s) → Escolha do time com as 4 capas (quiz "Não sei escolher" sugere, a pessoa decide, os 4 cards continuam à vista) → Cerimônia (≤ 3 s, pulável; termina com "Seu rastro agora é desta cor" + moldura "Recruta") → **Cadastro** ("Garanta seu lugar nos Volt Runners") → Localização (com o porquê) → Mapa com a missão inicial. O time escolhido fica no aparelho e `choose_faction` roda logo depois do cadastro; se falhar, a pessoa escolhe de novo no Mapa. Meta: ≤ 5 toques e zero digitação até a cerimônia. Quem já tem conta ("Entrar") não passa por nada disso. Substitui a ordem da D-72 no que conflitar. |
| **D-92** | **Uma curva de XP e nível só**, a mesma que o servidor credita (`xp_ledger`). `levelFromXp` (`games.ts`) e `levelProgress` (`progression.ts`) viram uma função só em `src/domain`, usada por Resumo, Você, Recompensas e card. Teste de paridade com o SQL. |
| **D-93** | **Uma fonte de texto por time** (`src/domain/team-bio.ts`: nome, mascote, lema de 3 palavras, bio de 3 linhas, líder, valor, estilo), usada na escolha, em "Meu time", na capa e no card. Os lemas novos (§1.2) substituem `factions[].motto`. Nomes dos mascotes continuam Lume, Faísca, Breu e Faro até o dono decidir (D-70). |
| **D-94** | **Aviso "plano da próxima corrida"**: no 1º resumo (e depois a cada semana sem plano), a pergunta "Quando você corre de novo?" com 3 opções de dia/hora; vira 1 aviso local no horário escolhido. Conta dentro do limite de 1 por dia e 4 por semana (D-69). |
| **D-95** | **Estados de dado honestos.** Carregando mostra esqueleto; offline e erro mostram o último dado com a hora ("há 2 h") ou um traço, nunca "0". Um componente só de "sem conexão" (`OfflineNotice`) para todas as telas. Erro 5xx no perfil com cache: o app abre com o cache e um aviso; sem cache: tela de erro com "Tentar de novo", e "Sair" só em Ajustes. |
| **D-96** | **Selo "Precisa de reforço"** no card do time com menos ativos nos últimos 7 dias (RPC `faction_activity()` que devolve só contagens). Só cosmético. Nunca com número inventado em conta real; na demo, com selo. |
| **D-97** | **Push remoto fica como limitação declarada**: os avisos de invasão e chefão só chegam com o app aberto (D-69). Se os autores gerarem um build de desenvolvimento com push (EAS) antes da banca, a E7 liga o canal sem mudar o resto. |

Perguntas que continuam com o dono: nomes dos mascotes (D-70); build com push (D-97); conferência do baú com o orientador sob o ECA Digital.

## 3. As regras desta fase (valem para todas as equipes)

1. **Nada de "em breve", "provisório" ou botão que não leva a lugar nenhum** em conta real nem na demonstração. O que não dá para fazer sai da tela ou vira estado `unavailable` honesto, só quando o servidor antigo/flag desligada exigir.
2. **Um dado, uma forma.** Mesmo número, mesmo formato e mesma unidade em todas as telas: distância "12,2 km"; XP "+1.130 XP"; prazo de defesa "Faltam 17 h 30 min" (contagem) e "até 02h30" (horário) só nos avisos; nível "Nível 5"; zona "Jardim Goiás · perto do Estádio" (sem número).
3. **Uma ação, um lugar** (e no máximo um atalho contextual). Correr: Mapa. Sair: Ajustes → Conta, com confirmação. Convidar: Clube. Notificações: Ajustes → Lembretes.
4. **Os 15 "nunca"** de `F8/01` §3.2. Em especial: nunca vender sorteio; chances do baú visíveis antes de abrir; nunca culpa; recusa neutra ("Agora não"); urgência só com contagem real do servidor; prova social só com número real; 1 aviso por dia e 4 por semana; nunca comparar por padrão; nunca "libera dopamina" em texto nenhum.
5. **Arte:** só dentro do Pit Lane Neon (D-61); mapa sem hexágonos; SVG + Reanimated (D-71); "Reduzir movimento" vira fade de 150 ms; no máximo 1 capa animada por tela, 2 emblemas grandes por tela; meta 55 fps em Android médio. Toda arte nova é renderizada em PNG e olhada antes de entrar.
6. **Acessibilidade:** `testID` + `accessibilityLabel` em todo interativo; texto completo no rótulo quando a tela encurta; contraste ≥ 4,5:1; alvos ≥ 44 pt; a forma do time sempre junto da cor.
7. **Texto:** pt-BR, curto, de torcida, sem jargão; nenhuma tela de jogo acima da meta da régua (`docs/melhoria/F1/ux/medir-texto.mjs`); o leitor de tela recebe a frase inteira.
8. **Segurança:** nada muda nas regras de RLS, `service_role` só nas functions, rotas cortadas pelo domain (D-78), máscara das zonas (D-87). RPC nova = pgTAP + par na demo (`demo-contract.test.ts`).
9. **Compatibilidade:** o app continua funcionando com o servidor v1 na nuvem e com as flags desligadas (estados `unavailable`), e no Expo Go SDK 57, sem pacote nativo novo.
10. **Economia:** CodeGraph primeiro, trechos em vez de arquivos inteiros, saída filtrada pelo rtk, testes só da pasta durante o trabalho e o Jest completo 1× no fim com `--silent --maxWorkers=2`.
11. **Cada equipe faz commit só na própria worktree**; o coordenador integra (merge `--no-ff`), valida (typecheck, eslint, Jest, pgTAP, Deno, régua) e faz push. Relatório curto em `docs/melhoria/relatorios/F8-<equipe>-<onda>.md` e entrada no topo do `docs/PROGRESSO.md`.
12. **Donos de pastas** continuam os da seção 18 do prompt da Fase 7. Precisou mexer em pasta de outra equipe: pode, desde que seja o mínimo e esteja no relatório.

## 4. As ondas

### Onda A — Fundação (3 frentes em paralelo)

**A1 · E4 (arte) — Sistema de emblemas e retoques.** Plano de produção `F8/02` §5, itens 1, 2, 3, 7, 8 e 9:
- `components/art/team/emblem-art.ts` (geometria portada de `F8/arte/fonte/emblema.cjs`: `SHAPES`, `HEADS`, nós mini/médio/grande/mono/neutro) e `emblem.tsx` novo com a API de `F8/02` §2.3 (`team`, `size`, `variant`, `color`, `on`, `mono`, `attack`, `quality`, a11y).
- `components/team-badge.tsx` vira alias de `TeamEmblem variant="auto"` (mesma assinatura). `TeamShapeGlyph` fica (é a legenda do gráfico da cidade dividida).
- `TeamEmblemInSvg` (`components/art/neon/in-svg.tsx`) para o card do Stories e `TeamPill` com cabeça mini (`features/social/card/card-parts.tsx`); conferir o PNG exportado.
- Medalhas (ícone interno 55–60%, níveis reordenados) e ícone do Raid (silhueta do vilão).
- Galeria `/dev/arte`: seção "Emblemas v2" (3 tamanhos × 4 + mono + neutro + capa) e um teste visual em cinza (deuteranopia).
- Aceite: checklist de 10 itens de `F8/02` §5.1, com capturas antes/depois em 1×, 2× e 3×.

**A2 · E9 + E3 (servidor e domínio) — Uma verdade só.**
- D-92: uma curva de XP/nível em `src/domain` (a mesma do `xp_ledger` e do nível que o servidor devolve), teste de paridade com o SQL (gerar 50 valores e comparar), e os 4 consumidores apontados para ela.
- D-96: RPC `faction_activity()` (contagem de ativos por time nos últimos 7 dias, só números) + pgTAP + par na demo.
- Evento "primeiro trecho pintado" (1 vez na vida) e "recorde de trechos numa corrida" no resultado da corrida (`v2_extras`), com teste; o app usa na onda B.
- `crew_feed`/avisos: dado para o "eco da crew" ("Rafa reforçou 3 trechos que você pintou", agregado 1× por dia, nunca entre 22h e 7h), só se couber em 1 dia; senão, registrar como pendência.
- Atualizar `docs/API_CONTRATO.md`.

**A3 · E6 (telas) — Navegação e estados.**
- D-89: 4 abas, CORRER único, `/correr` → `/corrida`, apagar a tela-fantasma, revisar `tabBarClearance`, atualizar testes de abas, `demo-mode-flow` e Maestro.
- `src/app/+not-found.tsx` com arte de vazio, "Essa página não existe" e "Voltar ao mapa" (UX-06); `+html.tsx` com fundo `#070708` e marca centralizada (UX-37).
- D-95: `OfflineNotice` único; esqueleto no carregando; último dado com hora no offline; nunca zero falso (UX-38); erro 5xx com cache abre o app (UX-05); "Sair" só em Ajustes → Conta, com confirmação (UX-36).
- Resumo sem repetição (UX-10): 1 herói, 4 números, 1 bloco de recompensas; formatos da regra 2.
- Prazo de defesa num formato só (UX-09); "Modo" no lugar de "Missão" e `ModeIcon` da E4 nos cards (UX-08); "Corrida Segura" como nome único com 2 opções (UX-12); banner da corrida "Zona dos Neon Striders · corra aqui para ajudar" com o emblema (UX-13).

### Onda B — A experiência (3 frentes em paralelo; depende da A)

**B1 · E6 + E4 — Primeira abertura e a capa do time (D-91, D-93).**
- `src/domain/team-bio.ts` (texto por time, `F8/02` §3.2) e troca de `factions[].motto`.
- `components/art/team/cover.tsx` + `cover-art.ts`: a capa (`F8/02` §3.1), com `animated` e respeito a "Reduzir movimento"; só o card em foco anima.
- Boas-vindas com herói (4 corredores ou mapa dividido + `Logo`) (UX-20).
- Nova ordem: Cidade → Times (capas) → Cerimônia → Cadastro → Localização; time guardado no aparelho (`local-store`), `choose_faction` depois do cadastro, com fallback. Guarda de rotas (`features/auth/route-guard.ts`, `app/_layout.tsx`, `app/(auth)/*`). O cadastro diz "Garanta seu lugar nos <time>" e mostra o emblema médio.
- Quiz sugere, a pessoa decide (4 cards à vista, o sugerido marcado) (regra 4 de `F8/01`); regra de troca em 1 linha antes de confirmar (regra 5).
- Cerimônia: último quadro "Seu rastro agora é <cor>" com a linha da rota se desenhando e a moldura "Recruta" entrando; botão "Continuar" (UX-18); ≤ 3 s, pulável.
- "Meu time" com a capa, os outros 3 times com emblema médio (nunca bolinha), lema e bio da fonte única (UX-30).
- Testes: fluxo completo na demo (Playwright) com contagem de toques (meta ≤ 5 até a cerimônia) e `auth-flow` ajustado.

**B2 · E7 — Engajamento que faz sentido.**
- Missão de boas-vindas ligada ao estado real; some sozinha ao concluir, com celebração; com 0 corridas, ela vence o alerta de ataque na prioridade (UX-02, UX-32).
- D-94: "Quando você corre de novo?" no 1º resumo, aviso `plano` (`features/notifications/reminders.ts`, `domain/reminders.ts`), com teste de limite.
- "Primeiro trecho!" (1 vez na vida), "Recorde: 47 trechos" (comparação só consigo), "Carimbo de bairro novo" no Atlas, "A semana do time" na segunda (ideias 5.1, 5.4, 5.8, 5.10 de `F8/01` §5); o líder comenta o feito real no resumo e no recap (catálogo de ~30 falas por líder, máx. 1 por tela, ≤ 90 caracteres, filtro de culpa) (5.3).
- Missões com botão "Ir" (abre a Nova corrida no modo certo), "Fácil" no lugar de "Leve", sem "33,3%" (UX-27); chip fixo "Missões 1/3" no Mapa (UX-17); medalhas tocáveis com nome, critério e progresso (UX-34); cosméticos com miniatura do rastro (UX-39).
- Glossário visual de progressão: "Como jogar" com 6 cartões (Corra, Pinte, Defenda, Chefão, Missões e baú, Liga) com a arte da E4, abrindo sozinho 1× (UX-07, UX-19).
- Sequência quebrada: texto consertável, sem culpa, com o recorde ao lado ("Sua melhor: 6 semanas").

**B3 · E6 + E8 — Telas que fecham.**
- Arena com ação: "Correr contra o Soneca" no card do chefão; folha da Liga (grupo, quem sobe, prazo); missões sem corte (UX-11).
- Ajustes em 4 telas (Conta · Segurança na corrida · Privacidade · Lembretes), notificações num lugar só, "Convidar" só no Clube, "Pausa de saúde" com um nome (UX-16).
- Clube: seletor "Corridas · Ranking" no topo, feed limitado a 3 com "Ver tudo", "Raio" com o ícone certo, rótulos que não somem (UX-21); Crew: só o código, "Copiar", link no compartilhamento (UX-35); feed da crew sem título duplo (UX-22).
- Atividades: vazio "Sua 1ª corrida aparece aqui" + Correr; recap escondido com 0 km (UX-14); "Atividades" como nome único (UX-15); "Compartilhar" no menu de cada corrida e no card do feed (`F8/03` §4.3); alerta de recap no Mapa a partir de sexta.
- Compartilhar: 1 casa decimal abaixo de 10 km; modelo padrão = momento mais forte da corrida (UX-33); "Minha semana" vazia com arte e "Correr" (UX-28).
- Zonas: nome + referência sem número (UX-29); zonas de privacidade com nome do endereço (UX-23); Conta sem "índice 100" e sem "JSON" (UX-24); moderação sem "(RN-009)" (UX-25); contatos com ação primária laranja (UX-26); "48 zonas em Goiânia" → "Seu time: 48 zonas" e o % da cidade com selo de demonstração (UX-31).

### Onda C — Movimento e brilho (2 frentes; depende da B)

**C1 · E5 — As animações da fase.** Capa (idle 1,6 s, tap com mola e flash do lema, confirmar vira busto em vitória), cerimônia "seu rastro", "Primeiro trecho!" (brilho que corre pela linha), "Antes e depois do bairro" no resumo (zonas acendendo uma a uma, máx. 5), "Golpe que abre fase" no chefão, "A semana do time" (mascote em pose), carimbo de bairro (mola com leve rotação). Tudo com `useReducedMotion`, medido na galeria `/dev/motion` a 1×, 4× e 6× de CPU; teto de confete mantido.

**C2 · E8 + E9 — Social que volta.** "Eco da crew" (se a A2 entregou o dado), kudos ao vivo conferido, card do Stories com o emblema novo e o lema, recap com o líder comentando, telemetria dos eventos novos (`share`, `mission_complete`) conferida.

**C3 · E10 + E9 — Pronto para gente de verdade (publicação e segurança).**
- OTA de verdade: `npx expo install expo-updates`, `runtimeVersion` com política `appVersion`, `updates.url`, `--environment` no `publicar.sh`, `android.package` e `ios.bundleIdentifier` (proposta `br.com.nomaderun.app`; o dono confirma). O `projectId` do EAS só nasce com `eas init` logado na conta dos autores: deixar o passo documentado em `supabase/DEPLOY.md` e o `app.json` pronto para recebê-lo.
- Limite de chamadas por pessoa nas Edge Functions (helper compartilhado em `_shared`, p.ex. 60/min por usuário e 10/min no `finish-activity`), com teste Deno e resposta `RATE_LIMITED` tratada no app.
- Página web `/excluir-conta` (rota do app, estática) explicando como excluir pelo app e por e-mail; política de privacidade com os campos de controlador e encarregado prontos para os autores preencherem.
- Checklist de publicação (`F8/04` §6) conferido item a item, com o que fica para o dono listado no `PROGRESSO`.

### Onda D — QA adversarial até zerar (E10 + revisor)
- Capturas de todas as telas (3 larguras), régua de texto, teste de 5 segundos, contraste, alvos, rótulos, "Reduzir movimento", fluxo completo na demo com contagem de toques, checklist ético (os 15 "nunca"), bundle contra o orçamento, Maestro coerente.
- Revisor de lógica e segurança sobre tudo que a fase mudou (guarda de rotas da D-91 é o ponto mais sensível: ninguém entra no app sem conta; `choose_faction` idempotente; RPC `faction_activity` sem dado pessoal).
- Ciclo: achados Alto/Médio voltam para a equipe dona; repete até zerar. Só então o fechamento.

### Fechamento
- `docs/DECISOES_TECNICAS.md` (D-89 a D-97), `PROGRESSO.md`, `REQUISITOS.md`, `API_CONTRATO.md`, `COMO_APRESENTAR.md` (fluxo novo), README; slides com os emblemas e as capas novas (sem "TCC", rodapé só com número); guia de teste.
- typecheck, eslint, Jest completo, pgTAP, Deno, régua, export web; push; pull request para a `main`.
- Opcional, só se sobrar tempo: vídeo da apresentação com HyperFrames a partir das capas (fora do app).

## 5. Critérios de "100%" (o coordenador só fecha a fase com todos verdes)

1. Nenhum selo geométrico antigo em tela nenhuma (busca por `#0072B2|#009E73|#D7263D|#D9B200` em componentes de time = 0 fora do mapa).
2. Correr em um lugar só; 4 abas; nenhum 404 em inglês.
3. Um nível só em todas as telas (teste de paridade verde).
4. Primeira abertura: ≤ 5 toques e zero digitação até a cerimônia; o fluxo completo na demo passa; "Entrar" não passa pelo onboarding.
5. Nenhum zero falso em offline/carregando; 503 com cache abre o app.
6. Nenhuma tela de jogo acima da meta de texto; teste de 5 s ≥ 85%.
7. Contraste, alvos, rótulos e "Reduzir movimento" sem falha; 55 fps na capa e na cerimônia a 4× de CPU.
8. Os 15 "nunca" conferidos no checklist ético, com a demo marcada como demonstração.
9. Jest, pgTAP, Deno e CI verdes; bundle dentro do orçamento.
10. Zero achados Alto/Médio abertos na QA e na revisão de segurança.
