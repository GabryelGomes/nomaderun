# F8-D · última rodada E7 + E6 (telas): baús, neon, zona sem rede e fonte ×1,3

2026-11-04 · worktree `agent-a2b436369277ca410` (depois do merge de `claude/affectionate-gauss-e8gm77`) · 5 commits, sem push.

## 1. M-2: o Resumo e Recompensas mostram o mesmo total de baús

**Causa:** o bloco da corrida (`extras.engagement.dailyChests`) só trazia `stored` (os baús do dia). Recompensas soma `stored + bonus` (`storedLabel`). Depois da 1ª corrida o Resumo dizia "1 baú guardado" e Recompensas "2 baús guardados".

**Decisão (regra 2, um dado, uma forma):** as 2 telas mostram o **total** (do dia + bônus fechados), com a **mesma função** (`storedLabel`). "2 guardados" é o que a pessoa vai abrir com 1 km, e é isso que Recompensas já dizia.
- `runChestsStored(block, fresh)` (`features/engagement/run-rewards-model.ts`): quando o baú do store foi lido **depois** da corrida (`loadedAt ≥ lastRun.at`), o Resumo usa esse dado, o mesmo que Recompensas lê. Antes disso, usa a soma do próprio bloco (`stored + bonusStored`). Nunca usa o número de antes da corrida.
- O bloco ganhou `bonusStored` (lido como 0 quando o servidor não manda). O servidor de demonstração já manda. `lastRun` guarda `at`.
- **Testes:** paridade 4 × 4 (`runChestsStored` começa com `storedLabel` para 0 a 3 baús do dia × 0 a 3 bônus) · caso da QA (1 + 1 = "2 baús guardados. Abrem com 1 km.") · UI: `RunRewardsBlock` e `RewardsScreen` com o mesmo store mostram a mesma frase · store ainda de antes da corrida usa a soma do bloco · `demo-mode-flow` ganhou a verificação 35: **"2 baús guardados × 2 baús guardados"**.

**Contrato para a E9 (aditivo, opcional):** no `finish-activity`, `extras.engagement.dailyChests.bonusStored: number` = baús bônus ainda fechados depois da corrida (`count(*) from public.bonus_chests where user_id = p_user and opened_at is null`, em `private.daily_chests_stored`/`v2_extras`, `final_fixes.sql:164`). Sem o campo, o app espera a releitura do baú (`fetchDailyChest`) e não mostra um número antigo.

## 2. Preenchimentos sólidos ao lado do emblema → `neonTeam` (D-90)

O `rg` pedido só acha o mapa (`territory-map.layers.ts`), a galeria e o `neighborhood-flip`. A busca ampla (`f.color`, `team.color`) achou os 2 da QA:

| Onde | Antes | Depois |
|---|---|---|
| `features/screens/profile-screen.tsx` (avatar sem foto, ao lado do emblema) | `#0072B2` + branco | `#2FA8FF` + `neon.bg` (#070708) |
| `components/celebration/team-week-card.tsx` (faixa "Semana nova!" com o mascote) | `#D7263D` + branco | `#FF2D55` + `neon.bg` (tinta ≥ 4,5:1 nos 4 neons, testado) |
| `features/screens/edit-profile-screen.tsx` (mesmo avatar) | neon + `palette.ink` | neon + `neon.bg` (igual ao Você) |

**Ficaram como estão, com motivo:** `neighborhood-flip` (D-98 manda a "cor sólida do time" no mapa simplificado) e `team-confirm`/`trail-reveal` (inundação de tela inteira da cerimônia da E5, com vinheta, e não um preenchimento ao lado do emblema).

Capturas (390 px, píxel medido): `F8-D-fix-e7/{antes,depois}/voce__cheio.png` (avatar `0,114,178` → `47,168,255`) e `semana-do-time__owls.png` (`215,38,61` → `255,45,85`). **Testes:** cor do avatar ∈ `neonTeam` e ∉ sólidos, tinta `neon.bg`; faixa nos 4 times sem o sólido, com contraste ≥ 4,5:1.

## 3. Folha da zona aberta por link sem rede

`zone-sheet.tsx`: ao montar, lê a cópia do mapa (`useZones.hydrate()`, a mesma do D-95) antes de decidir. Mostra a zona salva com o `OfflineNotice` no topo ("Sem internet · Mostrando o último salvo, há 2 h", com "Tentar de novo"; com 5xx, "Servidor fora do ar"). Sem cópia, mostra só o nome e o `OfflineNotice` sem dado ("Os números aparecem quando a conexão voltar."), com "Tentar de novo". Saíram o "Offline · dados salvos" e o `EmptyState` "Sem internet".
- **Testes** (`zone-sheet-offline.test.tsx`, 3 casos): com cópia e 2 h; sem cópia; 503 com cópia ("Servidor fora do ar", sem "Erro 503").
- Captura `zona__offline-quente`: antes "Sem internet · Confira a conexão", depois a zona inteira com o aviso. O caso frio na web não chega à folha (sem perfil salvo, o guarda mostra "Não deu para abrir seu perfil"). Ele é coberto pelo Jest.

## 4. Fonte ×1,3 (mesma simulação do `adversarial.cjs`, 360 px)

| Tela | Cortados antes → depois | O que mudou |
|---|---|---|
| cidade | 3 → 0 | nome do time em até 2 linhas |
| times | 5 → 0 | estilo e "valor · líder" em até 3 linhas |
| mapa | 2 → 0 | alerta: título e prazo em até 2 linhas (o rótulo do botão tem o texto inteiro) |
| arena | 1 → 0 | "Chefão da semana": `adjustsFontSizeToFit` (0,85) e 2 linhas |
| clube | 1 → 0 | a linha do autor quebra (o selo desce); o nome não tem espaço para quebrar |
| você | 3 → 1 | nome: encolhe (0,75) e depois quebra em 2; "time · nível" em 3. Sobra **"32,4"** (número no `StatTile`). No aparelho, `adjustsFontSizeToFit` 0,6 encolhe o número; a web não simula isso. Quebrar um número seria pior. |
| resumo | 2 → 0 | chip em até 2 linhas |
| missões | 2 → 0 | título da missão em até 4 linhas, passo da 1ª semana em 3 |

"Fora da tela" que sobra: os carrosséis horizontais (times, faixa do mapa), que rolam de propósito. Capturas em `F8-D-fix-e7/{antes,depois}/fonte-130__*__360.png`. Os números estão em `relatorio.json`, e o script é `F8-D-fix-e7/capturar.cjs`. **Testes:** `numberOfLines` e rótulo completo no `AlertSlot`, no `PlayerCard`, no `TeamCoverCard` e nas Missões.

## Verificações

- `npm run typecheck` ok · `./node_modules/.bin/eslint src` 0.
- Jest completo 1× (`--silent --maxWorkers=2`, com o export rodando ao lado): **153 suítes ok, 1 falhou** (`first-open-order.test.tsx`, 12 testes de cerimônia com tempo: "unmounted renderer"). Sozinha, a suíte passa **12/12**. A falha veio da carga da máquina e não das mudanças (o arquivo não importa nada que eu mexi). 1.655 ok, 26 pulados.
- Régua (`medir-texto.mjs --comparar antes`): 30 telas de jogo, média 30, **0 acima da meta**, 0 blocos longos.
- `demo-mode-flow.cjs` contra export novo (`--clear`): **62/62** (com a verificação nova do M-2).

## Commits

1. `fix(E7)`: Resumo e Recompensas com o mesmo total de baús (M-2).
2. `fix(E6)`: folha da zona por link sem rede (cópia do mapa + `OfflineNotice`).
3. `fix(E6)`: avatar do Você e faixa da semana do time no neon (D-90).
4. `fix(E6/E7)`: fonte ×1,3 sem reticências nos títulos.
5. `docs`: este relatório, as capturas, o `capturar.cjs`, a verificação do M-2 no `demo-mode-flow` e o PROGRESSO.

## Pendências

- **E9 (opcional):** `bonusStored` no `finish-activity` (contrato acima). Sem ele, o Resumo espera a releitura e mostra o total certo.
- Conferir no aparelho com `fontScale` 1,3 o "32,4" (o `adjustsFontSizeToFit` só age no nativo) e o "Chefão da semana" encolhido.
