#!/usr/bin/env bash
# Regera imagens, PDF e DOCX do ERS. Requer: pandoc, node + playwright (Chromium).
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
D="$PWD"
node build-src/shot.js "$D/assets-src/casos-de-uso.html" "$D/assets/casos-de-uso.png" 1400 940 '#d'
node build-src/shot.js "$D/assets-src/prototipos.html" "$D/assets/prototipos.png" 1260 840
pandoc ERS-NOMADE-RUN.md -f markdown -t html5 --template build-src/template.html --toc --toc-depth=2 \
  --metadata pagetitle="ERS NOMADE RUN" -o build-src/ERS.html
python3 - <<'PY'
import re
p='build-src/ERS.html'; s=open(p).read()
nav=re.search(r'<nav id="TOC">.*?</nav>',s,re.S).group(0)
s=s.replace(nav,'')
m=re.search(r'<h1 id="[^"]*introdução"',s)
s=s[:m.start()]+nav+'\n'+s[m.start():]
s=re.sub(r'<colgroup>.*?</colgroup>','',s,flags=re.S)
s=s.replace('src="assets/','src="../assets/')
s=re.sub(r'\b(RNF|RF|RN|UC|CT)-(\d{2,3})', lambda m: m.group(1)+'\u2011'+m.group(2), s)
open(p,'w').write(s)
PY
node build-src/pdf.js "$D/build-src/ERS.html" "$D/NOMADE RUN - Um Projeto de Gestão e Gamificação de Corridas Urbanas.pdf" "NOMADE RUN — Especificação de Requisitos de Software · v1.0"
pandoc ERS-NOMADE-RUN.md -f markdown -t docx --toc --toc-depth=2 \
  --metadata title="NOMADE RUN: Um Projeto de Gestão e Gamificação de Corridas Urbanas" -o "NOMADE RUN - ERS (editável).docx"
echo "OK"
