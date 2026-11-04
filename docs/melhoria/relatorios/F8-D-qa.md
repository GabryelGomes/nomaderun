# F8 · Onda D — QA adversarial da fase (E10)

Branch com as ondas A, B e C (merge de `claude/affectionate-gauss-e8gm77`). Tudo medido no export web do modo demonstração (`EXPO_PUBLIC_DEMO=1`, `--clear`), Chromium do Playwright, relógio fixo. Evidências em `docs/melhoria/relatorios/F8-D/` e `docs/melhoria/capturas/depois/` (201 capturas, `relatorio.json`).

## 1. Os 10 critérios de "100%"

| # | Critério | | Prova |
|---|---|---|---|
| 1 | Selo antigo = 0 fora do mapa | ✅ | `rg "#0072B2\|#009E73\|#D7263D\|#D9B200" src` → só `theme/tokens.ts:78-81` (cor das regiões do mapa). Nenhum `TeamBadge` antigo: é alias do `TeamEmblem` (o `NeonBadges` do Entrar também; continua em uso em `sign-in-screen.tsx:73`, por isso **não** foi removido). |
| 2 | Correr num lugar só, 4 abas, 404 em pt | ✅ | `demo-mode-flow` 61/61: abas `["Mapa","Arena","Clube","Você"]`, sem `aba-correr`; `/correr` → Nova corrida; `/rota-que-nao-existe` → "Essa página não existe" (sem "Unmatched"). Adversarial: `/perfil/nao-existe` e `/dev/nao-existe` → `tela-nao-encontrada`. |
| 3 | Um nível só | ✅ | pgTAP `31_f8_fundacao` (50 valores SQL = `levelProgress`) verde; Jest `games`/`progression` verdes. Na tela, depois da 1ª corrida: Resumo "Nível 3!", Você "nível 3 · 2 / 260 XP", Recompensas "3 · 258 XP para o nível 4" (mesma conta). |
| 4 | ≤ 5 toques e 0 digitação até a cerimônia; "Entrar" sem onboarding | ✅ | **4 toques** (Começar · Escolher meu time · card · Entrar para os …), 0 campos. "Entrar" com conta existente: **2 toques + 2 campos** e vai direto ao Mapa (passo 59 do fluxo). Sem conta, 12 rotas do app caem nas Boas-vindas; voltar/avançar e recarregar no meio da escolha não pulam a conta e o time escolhido sobrevive até o cadastro. |
| 5 | Nenhum zero falso; 503 com cache abre o app | ✅ (corrigido) | Offline/erro quente: Você, Clube e Atividades mostram "—" e o aviso único. **Achado corrigido:** com 503 e mapa salvo, o Mapa dizia "Seu time: 48 zonas" como se fosse novo; agora "Servidor fora do ar: último mapa salvo" (`F8-D/mapa__erro-quente__antes.png` × `__depois.png`). Frio sem cache: "Não deu para abrir seu perfil" + "Tentar de novo". |
| 6 | Régua 0 acima da meta; 5 s ≥ 85% | ✅ | `medir-texto.mjs --comparar antes`: 30 telas de jogo, média 30 palavras, **0 acima da meta**, 0 blocos longos. Teste de 5 s: **96%** (§3). |
| 7 | Contraste, alvos, rótulos, movimento, 55 fps a 4× | ✅ (no limite) | Tokens: 61/61 pares passam (`contraste.cjs --strict`). Texto renderizado: 0 falhas reais (ver §4). Interativos sem nome: **0** em 201 capturas. Alvos < 44: só chips web de 36–40 com `hitSlop` (Baixo, como na F7). `reducedMotion: 'reduce'` em todas as capturas e fluxos, sem erro. fps a 4× (5 repetições, mediana, `F8-D/medicoes-fps.json`): capa idle **59,6**, toque **56,7**, confirmar **58,9**; cerimônia **55,0** (exatamente a meta). |
| 8 | 15 "nunca" e demo marcada | ✅ | §5. Selo "Demonstração" em todas as 201 capturas; 0 texto por baixo dele (as 3 sobreposições de `arena-liga-folha` são da Arena *atrás* da folha). 0 pedidos ao Supabase. |
| 9 | Jest, pgTAP, Deno, CI, bundle | ✅ | Jest **151 suítes / 1.631 ok**, 26 pulados, 0 falha (`--silent --maxWorkers=2`). pgTAP **941/941** (33 arquivos, 29 migrations). Deno **106 ok**, 1 ignorado. typecheck e eslint 0. Bundle: chegou a **1.244.876 B gzip** (99,6% do orçamento, folga 5 KB); com as galerias `/dev/*` sob demanda caiu para **1.229.838 B** (98,4%, folga 20 KB). |
| 10 | Zero Alto/Médio | ❌ (2 Médios abertos, nenhum de código meu) | §6: M-1 (dono: dados do encarregado na página pública) e M-2 (E7: contagem de baús). Alto: 0. |

## 2. Fluxos completos (demo, 390 px)

`demo-mode-flow.cjs` (atualizado, **61/61**): primeira abertura → cidade → capas → cerimônia → cadastro → GPS → Mapa (missão de boas-vindas) → Nova corrida → simulação → Resumo (recompensas e plano "Quando você corre de novo?" com 3 horários e "Agora não") → Compartilhar (card marcado) → Mapa (missão sumiu) → Arena ("Como jogar" sozinho na 1ª visita, **"Correr contra" abre a Nova corrida**, **folha da Liga**, "Como jogar" pelo botão) → Clube → Você → Ajustes → Missões (**"Ir" abre a Nova corrida**) → Recompensas → `/correr` → 404 → conta com histórico: **moldura Recruta, medalha tocável (nome, critério, progresso), carimbos do Atlas, Clube com seletor e feed, Ajustes em 4 telas (Conta, Segurança, Privacidade, Lembretes), Sair com confirmação, "Entrar" direto ao Mapa**.

Toques por momento de valor: cerimônia **4**; primeira corrida a partir do Mapa **3** (missão · Simulação · Começar) + segurar; compartilhar a partir do Resumo **1**; "Entrar" **2** + 2 campos. Maestro: ids dos 7 fluxos conferidos contra o código (todos existem; os de template, como `mapa-camada-${key}`, também).

## 3. Teste de 5 segundos (agente, capturas novas a 360 e 390)

| Tela | O que se entende em 5 s | Nota |
|---|---|---|
| Boas-vindas | os 4 mascotes correndo, a marca, Começar | 5 |
| Cidade dividida | 4 times disputam a cidade; escolher o meu | 5 |
| Escolha do time | capas dos times, toque num | 4 (o botão apagado "Toque no seu time" lê como instrução, mas fraco) |
| Cerimônia | meu rastro agora é verde, moldura Recruta, Continuar | 5 |
| Cadastro | "Garanta seu lugar nos …", 4 campos | 5 |
| Entrar | e-mail, senha, Entrar | 5 |
| Mapa | meu time, zonas, alerta de ataque, CORRER | 4 (o título do alerta corta a 360) |
| Nova corrida | modo, sinal, Começar | 5 |
| Resumo | zona conquistada, 4 números, Compartilhar | 5 |
| Arena | chefão, vida, minha parte, "Correr contra" | 5 |
| Liga (folha) | grupo, quem sobe/desce, prazo | 5 |
| Clube | crew, km da semana, eco, feed | 4 (nome do autor corta com o selo de demo a 360) |
| Você | cartão, 3 números, medalhas, carimbos | 5 |
| Missões | 1ª semana, missões de hoje com "Ir" | 4 (títulos cortavam a 360; corrigido) |
| Recompensas | nível, baú do dia com as chances | 5 |
| Zona | dono, placar, prazo, Defender | 5 |
| Notificações | ataque, território perdido, eco | 5 |
| Compartilhar | prévia do card, Baixar | 5 |
| Atividades | km da semana, histórico | 5 |
| Ajustes | 4 entradas e o aparelho | 5 |

Média **4,8/5 = 96%** (meta ≥ 85%; F7 onda 4: 86%).

## 4. Adversarial (`e2e-web/adversarial.cjs`, novo)

- **Parâmetro malformado** (15 rotas): ok depois das correções. Antes: `/zona/xyz` mostrava "Parâmetro id deve ser o índice H3 da zona (15 caracteres hexadecimais)" com um "Tentar de novo" inútil → agora "Essa zona não existe" + "Voltar ao mapa" (`zone-sheet.tsx`); `/compartilhar/%25zz` lançava `URIError` (`share-screen.tsx:56`) → decodificação segura. O `serve.cjs` caía com URL malformada → corrigido.
- **Sem conta**: 12/12 rotas do app levam às Boas-vindas; `/moderacao` sem papel → Mapa.
- **Voltar/avançar e recarregar no meio da primeira abertura**: ok; o time (Night Owls) sobrevive até o cadastro.
- **Girar 360 → 430 → 360**: 0 px de rolagem horizontal em 6 telas.
- **Duas abas**: ok, sem erro.
- **Fonte ×1,3** (simulada por CSS, pessimista: ignora `maxFontSizeMultiplier` e `adjustsFontSizeToFit`): 6 de 14 telas sem corte; o resto corta com reticências (rótulo de leitura completo). Corrigido o que perdia informação: chip do Resumo saía da tela; número do cartão de estatística ("32,4" → "3…", agora encolhe no aparelho); título da missão (3 linhas).
- **Offline no meio da cerimônia / `choose_faction` falhando / 429**: a demo não usa rede (o roteiro vale para a página inteira), então não dá para derrubar só uma chamada no navegador. Coberto por teste: `first-open-order.test.tsx` (falha do `choose_faction` volta à escolha com o erro) e `rate-limit.test.ts`/`errors.test.ts` (429 → "Muitas tentativas. Tente de novo em instantes.", tratado como transitório no `session-controller`).

## 5. Os 15 "nunca" (F8/01 §3.2)

1 vender sorteio: nenhum preço, loja ou compra no código (`rg "comprar|R\$"` = 0) ✅ · 2 chances antes de abrir: no mesmo cartão do baú (Recompensas e Resumo) ✅ · 3 culpa: `GUILT_PATTERN` em avisos e falas do líder; `rg "sentimos sua falta|não desista|abandonou"` = 0 ✅ · 4 recusa neutra: "Agora não" no plano, no consentimento e na volta ✅ · 5 urgência real: **achado corrigido** — na demo o aviso dizia "Defenda até 07h00" e a zona "Faltam 17 h 30 min" (02h30); agora o aviso usa o mesmo início do ataque (`demo/world.ts`) ✅ · 6 prova social: % da cidade e contagens com selo de demonstração ✅ · 7 1 aviso/dia, 4/semana, escada até o silêncio: `reminders*.test.ts` ✅ · 8 sem prêmio para madrugada/excesso: XP de distância decrescente com teto (`progression.ts:217`), teto de 30 km/dia no chefão ✅ · 9 permissão depois do valor: GPS depois da cerimônia, notificações depois da 1ª corrida ✅ · 10 sair fácil: Ajustes → Conta → Sair/Excluir (2 toques) ✅ · 11 não comparar por padrão: Clube abre em "Corridas", ranking é a 2ª aba ✅ · 12 sem FOMO pago ✅ · 13 rota cortada (D-78, testes do domain) ✅ · 14 "dopamina/vicia" = 0 ✅ · 15 piso 16 anos no cadastro e no banco ✅.

## 6. Achados

| Sev. | Achado | Prova / reproduzir | Dona | Estado |
|---|---|---|---|---|
| **Médio** M-1 | `/excluir-conta` (página pública do Google Play) mostra "[NOME DO ENCARREGADO]" e "[E-MAIL DO ENCARREGADO]" | `capturas/depois/excluir-conta__*` | dono (dados), E9 | aberto (pendência do dono já listada na C3) |
| **Médio** M-2 | Depois da 1ª corrida o Resumo diz "1 baú guardado" e Recompensas "2 baús guardados" (o resultado da corrida conta só `stored`; Recompensas soma `stored + bonus`) | primeira abertura → corrida simulada → Resumo → Recompensas | E7 (+E9 se o `v2_extras` precisar mandar o bônus) | aberto |
| Médio | Mapa com 503 e cache parecia dado novo | `F8-D/mapa__erro-quente__*` | E6 | **corrigido** (`map-screen.tsx`) |
| Médio | Prazo da invasão com 2 horários na demo (07h00 × 02h30) | Notificações × Zona | E9/E10 | **corrigido** (`demo/world.ts`) |
| Médio | `/compartilhar/%25zz` em branco (`URIError`) | adversarial | E8 | **corrigido** (`share-screen.tsx`) |
| Médio | `/zona/xyz` com mensagem técnica e "Tentar de novo" | adversarial | E6 | **corrigido** (`zone-sheet.tsx`) |
| Baixo | Resumo com 2 chips iguais ("Jardim Goiás · perto do Shopping" 2×, zonas sem número) | `resumo__cheio__360` | E6 | **corrigido**: 1 chip "· 2 zonas" |
| Baixo | Cortes a 360 px: bio da capa e "· líder …" (escolha do time), nível no cartão do Você, "· Hoje" quebrando no feed, "2 não lidas" em 2 linhas, "Simulação (demonstração\n)" na Nova corrida, sequência espremida em 5 linhas em Recompensas | capturas `*__360` | E4/E6/E7/E8 | **corrigidos** |
| Baixo | Fonte ×1,3: títulos com reticências (alerta do Mapa, nome no cartão, passos das missões) | `F8-D/fonte-130__*` | E6 | aberto (rótulo completo; conferir no aparelho) |
| Baixo | Folha da zona aberta por link sem rede: "Sem internet" sem o último dado (não usa o `OfflineNotice`) | `F8-D/zona__offline-quente.png` | E6 | aberto |
| Baixo | Cerimônia com "Reduzir movimento" a 4×: 50 fps de mediana por 1 quadro longo (233 ms) no início; p95 16,8 ms | `F8-D/medicoes-fps.json` | E5 | aberto (conferir no aparelho) |
| Baixo | Botão desabilitado "Toque no seu time" a 2,56:1 (isento pela WCAG, mas é instrução) | `times__*` | E6 | aberto |
| Baixo | Preenchimentos sólidos dos tokens ao lado do emblema neon (lista da A1 §4.1) | `team-week-card.tsx:52`, `profile-screen.tsx:106` | E4/E6 | aberto |

## 7. O que corrigi (arquivos)

`features/screens/{zone-sheet,map-screen,summary-screen,run-screen}.tsx`, `features/social/{share/share-screen,feed/crew-feed-card}.tsx`, `features/engagement/{missions-screen,rewards-screen}.tsx`, `features/notifications/notifications-screen.tsx`, `components/{stat-tile,player-card,team-cover-carousel}.tsx`, `components/art/team/cover.tsx`, `demo/world.ts`; galerias `/dev/arte` e `/dev/motion` movidas para `features/dev/*-gallery.tsx` e carregadas com `lazy(import())` (rota fina em `app/dev/*`; teste `moments-render` aponta para o módulo novo) — **−15 KB gzip** no entry. `e2e-web/{capturas,demo-mode-flow,serve,adversarial}.cjs` e README; `docs/COMO_APRESENTAR.md` §3 com a ordem nova da primeira abertura.

Nota: o `auditar-telas.cjs` grava em `docs/melhoria/F8/ux/capturas/` (linha de base da auditoria da E6); rodei só os estados "quentes", guardei o que importava em `F8-D/` e restaurei a pasta da E6.
