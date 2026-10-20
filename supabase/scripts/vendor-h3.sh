#!/usr/bin/env bash
# Copia o h3-js instalado no app (apps/mobile/node_modules) para o vendor das Edge Functions (D-22).
# Rode depois de atualizar o h3-js no app; o teste tests/domain_bridge.test.ts acusa divergência.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/apps/mobile/node_modules/h3-js"
DST="$ROOT/supabase/functions/_shared/vendor/h3-js"
mkdir -p "$DST"
{ echo '// @ts-self-types="./types.d.ts"'; grep -v '^//# sourceMappingURL' "$SRC/dist/h3-js.es.js"; } > "$DST/h3-js.es.js"
cp "$SRC/dist/types.d.ts" "$DST/types.d.ts"
cp "$SRC/LICENSE" "$DST/LICENSE" 2>/dev/null || true
echo "h3-js $(node -p "require('$SRC/package.json').version") copiado para $DST"
