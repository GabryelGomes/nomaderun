# CI no GitHub (X5): proposta da E10

O arquivo `ci.yml` desta pasta **não está ativo**. Ele vira `.github/workflows/ci.yml` quando o coordenador decidir (sugestão: no fechamento da F3).

## O que roda a cada push e pull request

| Job | Passos | Tempo na linha de base local |
|---|---|---|
| `app` | `npm ci` → `npm run typecheck` → `eslint src --max-warnings 0` → `jest --ci` → cobertura do domain ≥ 90% (por pasta) | tsc 10 s, eslint 33 s, jest 10 s, cobertura 17 s |
| `web` (depois de `app`) | `expo export -p web --clear` → orçamento do bundle (`entry` ≤ 980.000 B gzip) | 28 s |
| `functions` | `deno test` → `deno check` das 8 functions → `domain-copy.mjs --check` | 3 s + check |

O comando de cobertura foi testado aqui nos dois sentidos:
- com 90% passa (código 0);
- com `functions: 99` falha com a mensagem `Jest: "./src/domain/" coverage threshold for functions (99%) not met: 97.67%` (código 1).

## Por que `--clear` no export

O cache do Metro **não percebe** mudança de `EXPO_PUBLIC_*`. Na linha de base, um export com `EXPO_PUBLIC_SUPABASE_URL` definido saiu com o mesmo hash (`entry-3690ad08…`) do export sem `.env` e sem a URL dentro do bundle (`grep -c 54399` = 0). Com `--clear`, a URL entrou (`grep -c` = 1). O modo demonstração (`EXPO_PUBLIC_DEMO=1`) depende disso.

## Risco: permissão `workflow`

O GitHub recusa o push de arquivos em `.github/workflows/` quando o token não tem o escopo `workflow`. O erro é `refusing to allow ... to create or update workflow ... without workflow scope`. Esse push recusado derruba o push **inteiro** da branch, não só o arquivo.

- **Plano A:** antes de copiar, o coordenador testa o push num commit que só contém o `ci.yml`. Se passar, segue.
- **Plano B:** o arquivo fica aqui e o dono cria `.github/workflows/ci.yml` pelo site do GitHub (Add file → Create new file, colando o conteúdo). Leva 1 minuto e não depende do token da sessão.
- **Nunca** juntar o `ci.yml` com outras mudanças no mesmo commit: se o push for recusado, o resto da onda fica parado.

## Depois de ativar

- Proteger a branch principal exigindo os três jobs verdes (Settings → Branches), se o dono quiser.
- Quando existir `apps/mobile/e2e-web/capturas.cjs` (T7.E10.3), acrescentar um job opcional (`workflow_dispatch`) que gera as capturas do modo demonstração e as publica como artefato.
