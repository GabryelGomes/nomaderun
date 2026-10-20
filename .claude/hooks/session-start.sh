#!/bin/bash
# Prepara rtk (compressão da saída do Bash) e CodeGraph (grafo do código via MCP).
# Nas sessões na nuvem (Claude Code on the web) instala o que faltar; na máquina
# local só avisa, para não instalar nada sem você pedir.
set -uo pipefail

export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

remote="${CLAUDE_CODE_REMOTE:-false}"

if ! command -v rtk >/dev/null 2>&1; then
  if [ "$remote" = "true" ]; then
    # A API do GitHub costuma dar 403 (rate limit); fixa a última tag via git.
    rtk_version=$(git ls-remote --tags --refs https://github.com/rtk-ai/rtk.git 'v*' 2>/dev/null \
      | sed 's#.*refs/tags/##' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
    curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh \
      | RTK_VERSION="$rtk_version" sh >/dev/null 2>&1 \
      || echo "rtk: falha ao instalar" >&2
  else
    echo "rtk não instalado: veja docs/ECONOMIA-DE-TOKENS.md" >&2
  fi
fi

if ! command -v codegraph >/dev/null 2>&1; then
  if [ "$remote" = "true" ]; then
    npm install -g @colbymchenry/codegraph >/dev/null 2>&1 \
      || echo "codegraph: falha ao instalar" >&2
  else
    echo "codegraph não instalado: veja docs/ECONOMIA-DE-TOKENS.md" >&2
  fi
fi

# Persiste o PATH para os próximos comandos da sessão na nuvem.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$HOME/.local/bin:$HOME/.cargo/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# Primeira vez no projeto: constrói o índice (depois ele se atualiza sozinho).
if command -v codegraph >/dev/null 2>&1 && [ ! -d .codegraph ]; then
  codegraph init --yes >/dev/null 2>&1 || echo "codegraph: falha no init" >&2
fi

exit 0
