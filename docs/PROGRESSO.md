# Progresso

> Registro contínuo. **Antes de começar** qualquer tarefa, leia a última entrada e as pendências.
> **Ao terminar**, adicione uma entrada no topo do log seguindo o modelo.

## Estado atual (resumo)

- **Fase:** 1 (infraestrutura)
- **Em andamento:** —
- **Próximos passos:** T1.1–T1.3 (A2 Backend) em paralelo com T1.4–T1.6 (A3 Frontend)
- **Bloqueios:** nenhum

## Pendências abertas

| # | Pendência | Dono | Origem |
|---|---|---|---|
| P-01 | Cobertura de ramos do domain em 85% (meta 90%) | A5 | Baseline |
| P-02 | Seção 6.2 do ERS descreve paleta diferente da aprovada (D-15) | A6 | Baseline |

## Modelo de entrada

```
### AAAA-MM-DD — <ID da tarefa> — <título> (<agente>)
- Feito:
- Arquivos:
- Testes executados (comando → resultado):
- Problemas encontrados:
- Pendências:
- Para o próximo agente:
```

## Log

### 2026-10-20 — T0.1–T0.3 — Análise, skills e base da documentação (A1 Arquiteto)
- **Feito:** leitura completa do ERS (27 RF, 15 RNF, 19 RN, UC-01..03) e do código; baseline medido; Docker e Supabase local validados no ambiente; skills instaladas; arquitetura, decisões D-01..D-15, contrato da API, plano e checklist criados.
- **Arquivos:** `docs/ARQUITETURA.md`, `docs/DECISOES_TECNICAS.md`, `docs/API_CONTRATO.md`, `docs/PLANO_DESENVOLVIMENTO.md`, `docs/REQUISITOS.md`, `docs/PROGRESSO.md`, `CLAUDE.md`, `.claude/skills/*`, `skills-lock.json`.
- **Testes:** `npm test` → 60/60; `npm run typecheck` → ok; `eslint src` → ok; cobertura do domain 94,1% linhas / 84,8% ramos.
- **Problemas:** a busca do `find-skills` (`npx skills find`) não funciona aqui porque o proxy bloqueia a API do skills.sh. Skills instaladas direto dos repositórios oficiais no GitHub (`npx skills add <repo> --skill ...`). O filtro de lint do rtk mostra "JSON parse failed" quando o ESLint não tem saída: rode `./node_modules/.bin/eslint src` direto.
- **Pendências:** P-01, P-02.
- **Para o próximo agente:** comece pela Fase 1. O backend sobe com `npx supabase start` na raiz (o Docker precisa estar rodando: `dockerd &`). O contrato está em `docs/API_CONTRATO.md`.
