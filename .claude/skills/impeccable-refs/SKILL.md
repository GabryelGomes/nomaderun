---
name: impeccable-refs
description: Referências de design de produto (deleite, onboarding/primeira abertura e auditoria técnica de app nativo) extraídas do projeto Impeccable, sem o lançador binário. Use ao desenhar momentos de celebração, a primeira abertura (FTUE), estados vazios, ou ao auditar uma tela React Native/Expo em acessibilidade, desempenho, tema e conformidade com a plataforma.
license: Apache-2.0
---

# Impeccable (só referências)

Esta pasta traz **três referências** do projeto [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0, versão 4.7.0 da skill, commit `5cb95ee`, 2026-10-23), copiadas sem alteração para `reference/`.

**Por que não a skill inteira:** a skill original começa rodando `scripts/impeccable context`, um lançador que baixa um binário da internet na primeira execução (`curl`/`wget` em `scripts/impeccable`). Pela regra da E2, skills que mandam rodar comandos remotos não são instaladas. Por isso **não existe lançador aqui** e os comandos `/impeccable ...` citados nos textos são só nomes de etapas: não tente rodá-los.

## Quando ler cada arquivo

| Arquivo | Leia quando |
|---|---|
| `reference/delight.md` | For desenhar um momento de recompensa (conquista de zona, baú, chefão derrotado, sequência). Regra central: o tamanho da celebração acompanha o esforço e a frequência; nunca atrasa nem bloqueia a tarefa; som só com consentimento. |
| `reference/onboard.md` | For desenhar a primeira abertura, a escolha de time, a permissão de localização ou um estado vazio. Regra central: levar ao "momento aha" (primeira zona pintada) o quanto antes; mostrar em vez de explicar; estado vazio = o que vai aparecer + por que importa + 1 ação. |
| `reference/audit.native.md` | For auditar uma tela do app (React Native/Expo). Pontua de 0 a 4 em acessibilidade, desempenho, tema, conformidade com a plataforma e adaptação. Não corrige: documenta. |

## Como aplicar no NOMADE RUN

- O "mundo visual" já está escolhido: **Pit Lane Neon** (D-61). Refinar, não redesenhar: use `src/theme/tokens.ts`, `neon.ts` e os componentes `Text`, `Button`, `Surface`, `TeamBadge`, `Icon`.
- O texto de `onboard.md` cita bibliotecas web (Intro.js, Shepherd, `localStorage`). No app, guarde o "já visto" no estado persistido do app (Zustand/AsyncStorage) e faça tours com componentes próprios.
- Celebrações seguem o catálogo da seção 11 do prompt mestre (pequena, média, épica) e respeitam "Reduzir movimento".
- A auditoria nativa complementa `mobile-accessibility` e `react-native-best-practices`; use a mesma escala 0–4 para comparar antes/depois.

## Licença

Apache-2.0 (arquivo `LICENSE` nesta pasta). Modificação feita pela E2: só a seleção de 3 arquivos e este `SKILL.md`, escrito do zero; os arquivos de `reference/` estão iguais ao original.
