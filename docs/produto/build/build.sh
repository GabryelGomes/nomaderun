#!/usr/bin/env bash
# Gera o PDF do Product Book. Requer pandoc, node e playwright (Chromium).
set -euo pipefail
cd "$(dirname "$0")/.."
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
pandoc PRODUCT-BOOK.md -f markdown -t html5 --template build/template.html --toc --toc-depth=2 --metadata pagetitle="NOMADE RUN Product Book" -o build/product-book.html
python3 - <<'PY'
import re
p='build/product-book.html'; s=open(p).read()
nav=re.search(r'<nav id="TOC">.*?</nav>',s,re.S).group(0)
s=s.replace(nav,'')
m=re.search(r'<h2 id="sumário-executivo"',s)
s=s[:m.start()]+nav+'\n'+s[m.start():]
s=re.sub(r'<colgroup>.*?</colgroup>','',s,flags=re.S)
s=s.replace('src="assets/','src="../assets/')
open(p,'w').write(s)
PY
node ../ERS/build-src/pdf.js "$PWD/build/product-book.html" "$PWD/NOMADE RUN - Product Book.pdf" "NOMADE RUN — Product Book v1.0"
echo OK
