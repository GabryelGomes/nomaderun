# Apresentação NOMADE RUN

Visual **preto + laranja neon** sobre o **mapa real** de Goiânia, com as **telas reais da v2** (capturas do app no modo demonstração).

- Layout salvo: [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) e [`design-tokens.json`](design-tokens.json).
- Referências, skills usadas e como cada parte foi feita: [`REFERENCIAS-E-SKILLS.md`](REFERENCIAS-E-SKILLS.md).
- Prompt para gerar de novo em outra ferramenta: [`../07-PROMPT-COPIA-E-COLA.md`](../07-PROMPT-COPIA-E-COLA.md).

## O que tem aqui

| Caminho | O que é |
|---|---|
| `web/NOMADE RUN Apresentação.html` | **Apresentação para apresentar**: os 12 slides, com animações. Abra no Chrome. Setas, espaço ou clique avançam; **F** tela cheia; **N** notas. Precisa das pastas `web/img` e `web/fonts` ao lado |
| `NOMADE RUN - Apresentação.pdf` | Os 12 slides em PDF |
| `telas-v2/` | Capturas reais da v2 usadas nos slides (390 px, modo demonstração, comprimidas com `pngquant`). Origem: `docs/melhoria/capturas/depois/*__390.png`, `docs/melhoria/capturas/e7-missoes-depois/` e `docs/melhoria/relatorios/E6b-onda3/` |
| `mockup/NOMADE RUN Mockup.html` | Mockup interativo da v1, sozinho (hover, celulares em 3D, rota se desenhando). Não entra mais na página web |
| `mockup/imagens/` | Capa com o mapa e os 3 celulares em PNG transparente |
| `slides/` | **Fonte dos slides**: `deck.json` (ordem) e um HTML por slide em `slides/slides/` |
| `mockup/build/` | Gerador do mapa real e do mockup |
| `pdf/` | Gerador do PDF e a fonte Unbounded Line |
| `web/montar_web.py` | Gerador da página web |
| `telas/`, `build/` | Capturas e scripts da primeira versão (app claro), mantidos como histórico |

## Roteiro (12 slides, ~3 min antes da demonstração)

| # | Slide | Imagem | O que dizer |
|---|---|---|---|
| 1 | Capa | Mapa real do Parque Flamboyant | Nome, autores, "Corra a sua cidade. Cada rua conta." |
| 2 | 15 milhões correm na rua | — | O hábito cresce; três problemas: falta motivo para voltar, jogo de território favorece quem corre muito, medo de correr sozinha |
| 3 | Objetivo: Correr · Explorar · Conquistar | — | O objetivo geral e as três ideias |
| 4 | Primeira abertura | Escolha do time e Meu time | Quatro times com cor, forma e mascote; quiz "Não sei escolher"; localização explicada antes do pedido |
| 5 | 01 · Correr | Corrida ao vivo, Resumo e Recompensas | GPS, SOS sempre visível, conquista provável ao vivo; resumo com XP, missão, baú e sequência (nada pago) |
| 6 | 02 · Conquistar | Mapa e zona sob ataque | Corra pelas ruas para pintá-las; a zona fica com o time que pintou mais ruas; a tinta desbota em 7 dias; novato que conquista na 1ª corrida: 13% → 62% (simulação). O mapa mostra regiões suavizadas, nunca a grade |
| 7 | 03 · Explorar e competir | Arena (chefão Soneca) e Missões | Raid semanal (cada km tira 10 de vida), Liga semanal, missões e baú do dia com as chances à vista |
| 8 | 04 · Juntos | Card Stories, feed da crew, recap semanal | Card sem começo e fim da rota; feed só da crew, com "Bora!" e sem comentários; recap da semana |
| 9 | Como construímos | — | ERS (27 + 15 + 19), app + servidor, as regras do jogo com o mesmo código nos dois lados, RLS e HMAC |
| 10 | Demonstração | Mapa real | Modo demonstração (dados de exemplo): primeira abertura → corrida simulada → resumo e card → Arena e crew. Roteiro completo em `docs/COMO_APRESENTAR.md` §3 |
| 11 | O que entregamos e o que falta | — | 1.419 testes do app, 832 do banco (29 arquivos), 87 das funções, fluxo demo 21/21, 39/61 requisitos (17 parciais), 87 decisões; limitações e próximos passos |
| 12 | A cidade é o tabuleiro | Mapa real | Três ideias e perguntas (respostas curtas em `docs/COMO_APRESENTAR.md` §6) |

Regras fixas: rodapé só com o número do slide; dados e telas de demonstração sempre marcados como demonstração; o mapa nunca mostra a grade de hexágonos.

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
| Trocar uma tela do app | Copio a captura para `telas-v2/` com o mesmo nome, comprimo (`pngquant --force --ext .png --quality 70-90 --strip telas-v2/<nome>.png`) e rodo `npm run pdf` e `npm run web`. Nos slides, a imagem entra como `src="telas-v2/<nome>.png"` |
| Mudar a ordem ou somar um slide | Edito `slides/deck.json` (`order`) e os números `NN/TT` do rodapé |
| Mudar as telas do mockup (cores, textos, efeitos) | Edito `mockup/build/gen.py`, `mockup.css` ou `mockup.js` e rodo `npm run tudo` |
| Só regerar o PDF | `npm run pdf` |
| Só regerar a página web | `npm run web` |

Depois de regerar, renderize cada slide em PNG para revisar (texto cortado, sobreposição, contraste): `python3 pdf/montar_pdf.py "$PWD/slides" "$PWD/mockup/imagens" "$PWD/node_modules" .print.html && node pdf/gerar_pdf.js "$PWD/.print.html" /tmp/rev.pdf /tmp/rev && rm .print.html` (a pasta `/tmp/rev` precisa existir). Faça commit da fonte e dos arquivos gerados (PDF, `web/`, `telas-v2/`).

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

Existem cópias publicadas no claude.ai **da primeira versão** (antes da v2); elas não foram atualizadas. São privadas; compartilhe pelo menu **Share** para outra pessoa abrir.

| Versão | Link |
|---|---|
| Deck editável (exporta PDF/PPTX) | https://claude.ai/artifact/TRNnTjqt3y4hLuAgKq7K6q |
| Página web completa | https://claude.ai/artifact/L4C7WjkyGowqxuvtTmoQkY |
| Mockup interativo | https://claude.ai/artifact/XBrVQPQBn3mmLkr3YtHqrp |

**A fonte de verdade é este repositório.** Se mudar algo no deck online, copie a mudança para `slides/` aqui.

## Créditos

Mapa: © OpenStreetMap contributors, via Overture Maps Foundation (ODbL). Fontes: Unbounded, Inter, JetBrains Mono e Archivo (SIL OFL 1.1).
