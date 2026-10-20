#!/bin/sh
# Reescreve comandos Bash para o equivalente `rtk ...` (saída filtrada = menos tokens).
# Se o rtk não estiver instalado, não faz nada e o comando roda normalmente.
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
if command -v rtk >/dev/null 2>&1; then
  exec rtk hook claude
fi
exit 0
