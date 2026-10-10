# NOMADE RUN

**Um Projeto de Gestão e Gamificação de Corridas Urbanas**

App de corrida de rua de verdade (GPS) com as funções essenciais de um app de corrida e uma **Arena de minigames sobre o mapa real da cidade**. Entre eles está o Domínio, em que quem corre numa área conquista território para o seu time. Funciona em qualquer cidade e tem competição **Cidade × Cidade**.

**Integrantes:** Gabryel Gomes Bahmad Camapum · Mateus Augusto De Faria Brito

## Para entregar (TCC)

| Arquivo | O que é |
|---|---|
| `docs/ERS/NOMADE RUN - Um Projeto de Gestão e Gamificação de Corridas Urbanas.pdf` | **ERS em PDF**, no modelo da disciplina |
| `docs/ERS/NOMADE RUN - ERS (editável).docx` | Mesmo ERS em Word |

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
npm test            # 53 testes das regras de negócio
```

## Regerar os PDFs

```bash
./docs/ERS/build-src/build.sh
./docs/produto/build/build.sh
```
