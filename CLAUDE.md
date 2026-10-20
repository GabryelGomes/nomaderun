# NOMADE RUN — instruções para agentes

App de corrida com disputa de território (TCC). Monorepo: `apps/mobile` (Expo SDK 57 + RN + TS) e `supabase/` (Postgres + PostGIS, Auth, Edge Functions).

## Antes de qualquer tarefa

1. Leia `docs/PROGRESSO.md` (estado atual e última entrada), `docs/PLANO_DESENVOLVIMENTO.md` (sua tarefa, dono e dependências) e `docs/ARQUITETURA.md`.
2. Confira o código real antes de mudar: use **`codegraph explore "<pergunta>"`** (ou a ferramenta MCP `codegraph_explore`) para localizar símbolos, chamadores e impacto, em vez de abrir arquivos um por um.
3. Só altere as pastas que o plano atribui ao seu papel. Precisa mexer em outra? Registre o pedido no `PROGRESSO.md` em vez de editar.

## Economia de tokens (obrigatório)

- Comandos de terminal passam pelo **rtk** automaticamente (hook em `.claude/settings.json`). Prefira comandos de shell (`rg`, `cat`, `git`, `npm test`) a despejar arquivos grandes. Se a saída filtrada do rtk ficar confusa (ex.: ESLint sem erros mostra "JSON parse failed"), rode o binário direto (`./node_modules/.bin/eslint src`).
- Para entender código, **CodeGraph primeiro**; leia só os trechos necessários.

## Ao terminar uma tarefa

1. Rode as verificações (em `apps/mobile`): `npm run typecheck`, `./node_modules/.bin/eslint src`, `npm test`. Backend: `npx supabase db reset` e `npx supabase test db` na raiz, e os testes Deno das functions.
2. Atualize `docs/PROGRESSO.md` (entrada no topo do log: feito, arquivos, testes com resultado, problemas, pendências, instruções para o próximo), `docs/REQUISITOS.md` (status) e o status da tarefa no plano. Decisão técnica nova → `docs/DECISOES_TECNICAS.md` (D-xx).
3. Não faça commit nem push: a coordenação faz, ao fechar cada fase.

## Regras do projeto

- **Visual aprovado (D-15):** não mude cores, fontes, espaçamentos ou componentes das telas existentes sem necessidade. Telas novas usam `src/theme/tokens.ts` e os componentes `Text`, `Button`, `Surface`, `TeamBadge`, `Icon`.
- Camadas (ver `ARQUITETURA.md`): `src/domain` é puro e é a fonte única das regras (app e Edge Functions); telas não chamam `supabase` direto, só via `src/services/api`.
- Segurança: nenhum segredo no código; RLS em toda tabela; `service_role` só nas Edge Functions.
- Textos da interface em português do Brasil. Todo elemento interativo novo tem `testID` e `accessibilityLabel`.
- Expo muda a cada SDK: confira a documentação da versão 57 (`https://docs.expo.dev/versions/v57.0.0/`) e instale pacotes com `npx expo install`.
- Dados de demonstração sempre identificados como demonstração. Mapa nunca mostra a grade de hexágonos (regiões suavizadas).

## Skills úteis (`.claude/skills`)

supabase, supabase-postgres-best-practices · expo-overview, expo-router, expo-data-fetching, expo-dev-client, expo-native-ui, react-native-best-practices · sharp-edges, differential-review, spec-to-code-compliance, property-based-testing, webapp-testing · writing-user-docs · find-skills.
