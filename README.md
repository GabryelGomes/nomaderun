# NOMADE RUN

**Um Projeto de Gestão e Gamificação de Corridas Urbanas**

App de corrida de rua de verdade (GPS) com as funções essenciais de um app de corrida e uma **Arena de minigames sobre o mapa real da cidade**. Entre eles está o Domínio, em que quem corre numa área conquista território para o seu time. Funciona em qualquer cidade e tem competição **Cidade × Cidade**.

**Integrantes:** Gabryel Gomes Bahmad Camapum · Mateus Augusto De Faria Brito

## Para quem vai desenvolver

Comece por **[`docs/GUIA-DO-DESENVOLVEDOR.md`](docs/GUIA-DO-DESENVOLVEDOR.md)**: como baixar e manter atualizado pelo GitHub, onde está cada coisa e como cada parte foi feita.

```bash
git clone https://github.com/GabryelGomes/nomaderun.git
cd nomaderun
git checkout claude/affectionate-gauss-e8gm77
git pull origin claude/affectionate-gauss-e8gm77   # para atualizar depois
```

## Para entregar (TCC)

| Arquivo | O que é |
|---|---|
| `docs/ERS/NOMADE RUN - Um Projeto de Gestão e Gamificação de Corridas Urbanas.pdf` | **ERS em PDF**, no modelo da disciplina |
| `docs/ERS/NOMADE RUN - ERS (editável).docx` | Mesmo ERS em Word |

## Apresentação

| Caminho | O que é |
|---|---|
| `docs/apresentacao/web/NOMADE RUN Apresentação.html` | **Apresentação completa numa página** (10 slides + mockup interativo no final), abre no navegador |
| `docs/apresentacao/NOMADE RUN - Apresentação.pdf` | Os 10 slides em PDF |
| `docs/07-PROMPT-COPIA-E-COLA.md` | Prompt pronto para copiar e colar: apresentação preto + laranja neon com efeitos |
| `docs/apresentacao/mockup/` | Mockup interativo (mapa real de Goiânia, efeitos de hover e glow) e as imagens dos celulares |
| `docs/06-PROMPT-APRESENTACAO.md` | Roteiro, demo e perguntas prováveis da banca |
| `docs/apresentacao/telas/` | Capturas reais do protótipo usadas nos slides |
| `docs/apresentacao/slides/` | Fonte dos slides |
| `docs/apresentacao/DESIGN-SYSTEM.md` | Layout salvo: cores, fontes, efeitos e regras dos slides |
| `docs/apresentacao/REFERENCIAS-E-SKILLS.md` | Referências, skills usadas e como foi feito |

## Produto e protótipo

| Caminho | O que é |
|---|---|
| `apps/mobile/` | **Protótipo funcional** (Expo + React Native + TypeScript). Como rodar: `apps/mobile/README.md` |
| `docs/produto/NOMADE RUN - Product Book.pdf` | Product Book: estratégia, Arena, design system, arquitetura, roadmap e protótipo |
| `docs/pesquisa/` | Pesquisas de mercado, UI, stack técnica e skills, com fontes |
| `docs/05-PROMPT-MESTRE.md` | Prompt mestre que gerou a pesquisa, o Product Book e o protótipo |
| `.agents/skills/` | Skills do skills.sh usadas no projeto (`SOURCES.md` tem a origem de cada uma) |
| `docs/01-BRAINSTORM.md`, `02` a `04` | Rascunhos iniciais (uso interno) |

## Rodar o app em 1 minuto

```bash
cd apps/mobile
npm install
npx expo start      # leia o QR code com o app Expo Go
npm test            # 60 testes das regras de negócio e do mapa
```

## Regerar os PDFs

```bash
./docs/ERS/build-src/build.sh
./docs/produto/build/build.sh
```
