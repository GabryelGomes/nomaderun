# Apresentação NOMADE RUN

Visual **preto + laranja neon** sobre o **mapa real** de Goiânia.

- Layout salvo: [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) e [`design-tokens.json`](design-tokens.json).
- Referências, skills usadas e como cada parte foi feita: [`REFERENCIAS-E-SKILLS.md`](REFERENCIAS-E-SKILLS.md).
- Prompt para gerar de novo em outra ferramenta: [`../07-PROMPT-COPIA-E-COLA.md`](../07-PROMPT-COPIA-E-COLA.md).

## O que tem aqui

| Caminho | O que é |
|---|---|
| `web/NOMADE RUN Apresentação.html` | **Apresentação para apresentar**: 10 slides + 2 do mockup interativo. Abra no Chrome. Setas, espaço ou clique avançam; **F** tela cheia; **N** notas. Precisa das pastas `web/img` e `web/fonts` ao lado |
| `NOMADE RUN - Apresentação.pdf` | Os 10 slides em PDF |
| `mockup/NOMADE RUN Mockup.html` | Mockup interativo sozinho (hover, cursor que brilha, celulares em 3D, rota se desenhando) |
| `mockup/imagens/` | Capa com o mapa e os 3 celulares em PNG transparente |
| `slides/` | **Fonte dos slides**: `deck.json` (ordem) e um HTML por slide em `slides/slides/` |
| `mockup/build/` | Gerador do mapa real e do mockup |
| `pdf/` | Gerador do PDF e a fonte Unbounded Line |
| `web/montar_web.py` | Gerador da página web |
| `telas/`, `build/` | Capturas e scripts da versão anterior (app claro), mantidos como histórico |

## Roteiro (10 slides + mockup)

1. Capa (mapa real)
2. 15 milhões correm na rua
3. Objetivo: Correr · Explorar · Conquistar
4. App de corrida de verdade
5. Território por times
6. Arena + Cidade × Cidade
7. Como construímos
8. Demonstração
9. Entregas e próximos passos
10. A cidade é o tabuleiro

Mais 11 (mapa real) e 12 (telas interativas), só na versão web.

## Editar e regerar

Requisitos: Python 3.10+ e Node 18+.

```bash
cd docs/apresentacao
pip install -r requirements.txt
npm install
npx playwright install chromium     # uma vez
```

| Quero… | Faço |
|---|---|
| Mudar texto ou layout de um slide | Edito `slides/slides/<id>.html` e rodo `npm run pdf` e `npm run web` |
| Mudar as telas do mockup (cores, textos, efeitos) | Edito `mockup/build/gen.py`, `mockup.css` ou `mockup.js` e rodo `npm run tudo` |
| Só regerar o PDF | `npm run pdf` |
| Só regerar a página web | `npm run web` |

Depois de regerar, faça commit da fonte e dos arquivos gerados (PDF, `web/`, `mockup/`).

### Baixar o mapa real de novo (opcional)

O `mockup/build/mapa.json` já está no repositório. Só é preciso refazer se mudar a área ou a rota.

```bash
python3 mockup/build/fetch.py /tmp/nr          # baixa ruas, prédios, parques e água (Overture Maps, S3 público)
cp mockup/build/export-game.ts ../../apps/mobile/export-game.tmp.ts
(cd ../../apps/mobile && npx tsx --tsconfig tsconfig.json export-game.tmp.ts /tmp/nr/game.json && rm export-game.tmp.ts)
python3 mockup/build/mapa.py /tmp/nr           # gera /tmp/nr/mapa.json (mapa escuro + volta pelas ruas)
cp /tmp/nr/mapa.json mockup/build/mapa.json
npm run tudo
```

### Fonte em contorno

`pdf/UnboundedLine-800.woff2` já está pronta. Para refazer:

```bash
python3 pdf/corrigir_fonte.py node_modules/@fontsource/unbounded/files/unbounded-latin-800-normal.woff2 pdf/UnboundedLine-800.woff2
```

## Versões online (claude.ai)

Existem cópias publicadas no claude.ai. Elas são privadas; compartilhe pelo menu **Share** para outra pessoa abrir.

| Versão | Link |
|---|---|
| Deck editável (exporta PDF/PPTX) | https://claude.ai/artifact/TRNnTjqt3y4hLuAgKq7K6q |
| Página web completa | https://claude.ai/artifact/L4C7WjkyGowqxuvtTmoQkY |
| Mockup interativo | https://claude.ai/artifact/XBrVQPQBn3mmLkr3YtHqrp |

**A fonte de verdade é este repositório.** Se mudar algo no deck online, copie a mudança para `slides/` aqui.

## Créditos

Mapa: © OpenStreetMap contributors, via Overture Maps Foundation (ODbL). Fontes: Unbounded, Inter, JetBrains Mono e Archivo (SIL OFL 1.1).
