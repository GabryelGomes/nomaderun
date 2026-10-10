# NOMADE RUN

**Um Projeto de Gestão e Gamificação de Corridas Urbanas**

App de corrida de verdade (na rua, com GPS) com as funções do Strava e um diferencial: um jogo de **conquista de território**. A cidade é dividida em hexágonos, e quem corre neles conquista aquela área para a sua facção. Funciona em qualquer cidade e dá para competir **Cidade × Cidade**.

**Integrantes:** Gabryel Gomes Bahmad Camapum · Mateus Augusto De Faria Brito

## Documentos

| Arquivo | O que é |
|---|---|
| [`docs/ERS/NOMADE RUN - Um Projeto de Gestão e Gamificação de Corridas Urbanas.pdf`](docs/ERS/) | **ERS final em PDF**, pronto para entregar |
| [`docs/ERS/NOMADE RUN - ERS (editável).docx`](docs/ERS/) | Mesmo ERS em Word, para ajustar |
| [`docs/ERS/ERS-NOMADE-RUN.md`](docs/ERS/ERS-NOMADE-RUN.md) | Fonte do ERS (Markdown) |
| [`docs/01-BRAINSTORM.md`](docs/01-BRAINSTORM.md) | Ideias de funcionalidades, jogo e visual |
| [`docs/02-SKILLS-MAP.md`](docs/02-SKILLS-MAP.md) | Skills do skills.sh pesquisadas para cada tarefa (com comandos de instalação) |
| [`docs/03-PROMPT-APP.md`](docs/03-PROMPT-APP.md) | Mega-prompt para uma IA construir o aplicativo |
| [`docs/04-PROMPT-ERS.md`](docs/04-PROMPT-ERS.md) | Prompt corrigido do ERS |

## Regerar o PDF do ERS

Requer `pandoc`, Node.js e Playwright (Chromium):

```bash
./docs/ERS/build-src/build.sh
```
