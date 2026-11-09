# F8 · onda D · correções da E6 (M1, B4, B3)

Base: `claude/affectionate-gauss-e8gm77` (merge fast-forward). Achados em `F8-D-revisao.md`.

## O que mudou

| Achado | Correção | Arquivos |
|---|---|---|
| **M1** · gravou e a releitura falhou | Se a RPC `choose_faction` responde ok, o servidor ficou com **este** time (1ª escolha, repetição ou troca; o SQL garante). Por isso `chooseFaction` aplica o time no perfil local na hora quando a releitura falha ou volta da cópia salva sem time. O aviso de "sem conexão" e a hora da cópia ficam, a cópia é regravada com o time e o time pendente é apagado. Uma resposta nova do servidor continua sendo a verdade. Na reserva `times`, o `chooseFactionOnce` relê o perfil antes de gravar: se o servidor **respondeu** e já tem time, segue com ele, sem chamar a RPC, que contaria como troca. O passo `pendente` pula a gravação quando o perfil já tem time. | `features/auth/session-controller.ts`, `features/screens/onboarding/onboarding-screen.tsx` |
| **B4** · 2 toques rápidos | A tela de times ganhou o estado `reserving` e uma trava em ref, ligados no começo de `join`, antes do `onJoin` e da medida de 250 ms. Enquanto ficam ligados, nada responde: cards (`accessibilityState.disabled`), botão de baixo, "Entrar" da folha do líder, "Não sei escolher" e troca de card. Eles destravam se o "Continuar" da cerimônia devolver erro. No onboarding, há uma 2ª barreira: uma só gravação em voo (`save.current`), zerada no erro. | `features/screens/onboarding/team-choice.tsx`, `components/team-cover-carousel.tsx` (prop `locked`), `onboarding-screen.tsx` |
| **B3** · time pendente sem dono nem validade | O registro passou a ser `{ team, at, origin }` e vale 24 h. Hora no futuro e o formato antigo (só o id) não valem e são apagados. Ele é apagado: (1) ao abrir **Entrar**, menos se `origin = 'cadastro'`, que é a mesma pessoa voltando do e-mail de confirmação; (2) ao abrir o **cadastro sem `?origem=times`** (ex.: Entrar → "Criar conta"); (3) em `signOut`, na conta inativada e na exclusão; (4) em `resetStoresForDemoSwitch`, que agora é `async` e zera a memória e o aparelho do modo que entra. A escolha de times leva ao cadastro com `?origem=times`. O envio do cadastro marca `origin: 'cadastro'`. | `features/auth/pending-team.ts`, `sign-in-screen.tsx`, `sign-up-screen.tsx`, `team-choice-auth-screen.tsx`, `session-controller.ts` |

## Testes (cada caso falha no código anterior e passa agora)

- `features/auth/__tests__/choose-faction.test.ts` (novo, 8 testes):
  - M1(a): com cópia, o perfil fica com o time, mantém o aviso offline, grava a cópia e apaga o pendente;
  - M1(b): sem cópia, devolve ok com o time;
  - `chooseFactionOnce`: não chama a RPC se o servidor já tem time e não confia na cópia;
  - `signOut` apaga o pendente.
- `features/auth/__tests__/pending-team.test.ts`: novo formato, validade de 24 h (memória e aparelho), formato antigo descartado, Entrar e cadastro fora da escolha, reset.
- `features/auth/__tests__/first-open.test.tsx`:
  - o cadastro sem origem apaga;
  - o cadastro com origem enviado marca `cadastro`;
  - abrir Entrar apaga `escolha` e mantém `cadastro`;
  - a troca de modo apaga o pendente.
- `features/screens/onboarding/__tests__/first-open-order.test.tsx`:
  - B4: 2 toques rápidos em times diferentes reservam só o 1º, com cards e botões desabilitados;
  - B4: depois de um erro, a escolha destrava;
  - B4: na reserva, um 2º "Entrar" com a gravação em voo não grava outro time;
  - M1: com o perfil já com time, o passo pendente não chama `choose_faction`.
- **Testes atualizados de propósito:** formato do aparelho (`{team, at, origin}` em vez da string); `router.push` do cadastro com `params: { origem: 'times' }`; o mock do `session-controller` ganhou `chooseFactionOnce`; o mock do `expo-router` ganhou `useLocalSearchParams`.
- **Reprodução:** com as fontes antigas e os testes novos, 25 testes falham; com as fontes novas, todos passam.

## Verificações

- `npm run typecheck`: ok.
- `./node_modules/.bin/eslint src`: ok.
- `npx jest --silent --maxWorkers=2`: 152 suítes, **1650 testes passam**, 26 pulados.
- `e2e-web/demo-mode-flow.cjs` contra um export novo (`EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear`): **35/35 verificações ok**, com **4 toques até a cerimônia** (meta ≤ 5) e zero digitação.

## Pendências e decisões

- **Pendência de M1 sem cobertura:** a resposta da RPC se perde **e** a releitura também falha (sem rede). Nesse caso, a reserva ainda pode chamar a RPC de novo com outro time se a rede voltar entre as duas chamadas. A janela é pequena. Fechar de vez fica com o **opcional da E9** no servidor: não contar como troca a mudança feita nos primeiros minutos depois da 1ª escolha, sem corrida pontuada no meio.
- **Entrar depois do próprio cadastro:** `origin = 'cadastro'` sobrevive a abrir Entrar por até 24 h. Isso é preciso para quem confirma o e-mail. Se outra pessoa entrar no mesmo aparelho nesse intervalo, numa conta **sem time**, herda a escolha. Isso pede o mesmo aparelho, menos de 24 h e uma conta sem time. Aceito.
- **Fora do escopo:** o link "Trocar time" no cadastro (sugestão da revisão) não entrou.
- **`services/api`:** não mudou. `profileRepo.chooseFaction` continua `Result<void>`, e o time aplicado é o pedido, que o SQL garante ser o gravado.
- **Docs:** `PROGRESSO.md` e `DECISOES_TECNICAS.md` ficam para a coordenação. Sugestão: registrar em D-91 a validade de 24 h e a origem do time pendente.
