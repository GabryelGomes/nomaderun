# Economia de tokens no Claude Code: rtk + CodeGraph

Duas ferramentas configuradas no projeto para o Claude gastar menos contexto:

| Ferramenta | O que faz | Onde está configurada |
|---|---|---|
| [rtk](https://github.com/rtk-ai/rtk) | Reescreve comandos do Bash (`git status`, `npm test`, `ls`, `grep`...) para `rtk ...`, que devolve a saída compactada (até ~90% menor). | Hook `PreToolUse` em `.claude/settings.json` → `.claude/hooks/rtk-rewrite.sh` |
| [CodeGraph](https://github.com/colbymchenry/codegraph) | Indexa o código (`apps/mobile`) num grafo de símbolos e chamadas. O Claude pergunta ao grafo (`codegraph_explore`) em vez de abrir e varrer vários arquivos. | Servidor MCP em `.mcp.json`; índice local em `.codegraph/` (fora do git) |

## Instalação (uma vez por máquina)

```bash
# rtk
brew install rtk     # macOS / Linux
# ou: curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh

# CodeGraph
npm install -g @colbymchenry/codegraph
```

Depois, na raiz do projeto:

```bash
codegraph init --yes   # cria o índice; depois ele se atualiza sozinho
```

Abra o Claude Code de novo e aprove o servidor MCP `codegraph` quando ele perguntar.

Nas sessões na nuvem (Claude Code on the web) o hook `.claude/hooks/session-start.sh`
instala as duas ferramentas e roda o `codegraph init` automaticamente.

## Como conferir

```bash
rtk gain            # quantos tokens o rtk já economizou
codegraph status    # estado do índice
```

No Claude Code, `/mcp` deve mostrar `codegraph` conectado.

## Observações

- O hook do rtk só age no Bash. As ferramentas nativas `Read`, `Grep` e `Glob` não passam por ele.
- Sem o rtk instalado, o hook não faz nada e os comandos rodam normalmente.
