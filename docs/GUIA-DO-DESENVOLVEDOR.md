# Guia do desenvolvedor — NOMADE RUN

Para quem vai continuar o projeto. Este guia diz como baixar e manter o repositório atualizado, onde está cada coisa e como cada parte foi feita.

**Integrantes:** Gabryel Gomes Bahmad Camapum · Mateus Augusto De Faria Brito
**Repositório:** https://github.com/GabryelGomes/nomaderun
**Branch de trabalho:** `claude/dreamy-ptolemy-xnm4r7`. Todo o trabalho recente está nela; a `main` ainda não recebeu essas mudanças.

---

## 1. Baixar e manter atualizado

### Primeira vez

```bash
git clone https://github.com/GabryelGomes/nomaderun.git
cd nomaderun
git checkout claude/dreamy-ptolemy-xnm4r7
```

Sem git: no GitHub, troque a branch para `claude/dreamy-ptolemy-xnm4r7` e use **Code › Download ZIP**.

### Pegar as atualizações

```bash
git checkout claude/dreamy-ptolemy-xnm4r7
git pull origin claude/dreamy-ptolemy-xnm4r7
```

### Enviar o seu trabalho

```bash
git config user.name "Seu Nome"          # uma vez
git config user.email "seu@email.com"     # uma vez
git pull origin claude/dreamy-ptolemy-xnm4r7   # sempre antes de começar
# ... edite ...
git add <arquivos>
git commit -m "O que mudou, em uma frase"
git push origin claude/dreamy-ptolemy-xnm4r7
```

Combinem quem mexe em qual pasta para evitar conflitos. Se der conflito no `git pull`, o git marca os trechos com `<<<<<<<` / `>>>>>>>`. Resolvam juntos, rodem `git add` e depois `git commit`.

Quando quiserem consolidar: abram um Pull Request da branch para a `main` no GitHub.

---

## 2. Onde está cada coisa

| Caminho | O que é |
|---|---|
| `docs/ERS/` | **ERS** (PDF e DOCX) no modelo da disciplina, e o script que gera |
| `docs/produto/` | Product Book (PDF) |
| `docs/pesquisa/01–06` | Pesquisas com fontes: mercado, UI, stack, skills, apresentação, visual Strava e território |
| `docs/05-PROMPT-MESTRE.md` | Prompt que gerou o protótipo e o Product Book |
| `docs/06-PROMPT-APRESENTACAO.md` | Roteiro, demo e perguntas prováveis da banca |
| `docs/07-PROMPT-COPIA-E-COLA.md` | **Prompt pronto** para gerar a apresentação preta e laranja |
| `docs/apresentacao/` | **Apresentação**: PDF, página web, mockup, fonte dos slides e scripts ([README](apresentacao/README.md)) |
| `docs/apresentacao/DESIGN-SYSTEM.md` | **Layout salvo**: cores, fontes, escala, efeitos e regras dos slides |
| `docs/apresentacao/design-tokens.json` | Os mesmos tokens em JSON, para código |
| `docs/apresentacao/REFERENCIAS-E-SKILLS.md` | Referências visuais, de apresentação e as skills usadas |
| `apps/mobile/` | **App** (Expo + React Native + TypeScript), celular e painel web |
| `supabase/` | **Backend** (Postgres + PostGIS, Auth, Edge Functions, testes) |
| `docs/COMO_APRESENTAR.md` | Checklist e roteiro da demonstração |
| `.agents/skills/` | Skills baixadas do skills.sh (`SOURCES.md` tem a origem de cada uma) |

---

## 3. O app e o backend

Instalação, execução e testes: [`README.md`](../README.md) da raiz e [`apps/mobile/README.md`](../apps/mobile/README.md). Arquitetura: [`ARQUITETURA.md`](ARQUITETURA.md). Situação de cada requisito: [`REQUISITOS.md`](REQUISITOS.md).

- `apps/mobile/src/domain/`: regras puras e testadas (pontuação, território, antifraude, minigames, regiões do mapa), usadas pelo app e pelas Edge Functions.
- `apps/mobile/src/features/` e `src/services/`: telas, corrida, fila offline, sincronização assinada, Corrida Segura.
- `apps/mobile/src/theme/tokens.ts`: cores e fontes do visual aprovado "Pista" (D-15). Não troque pelos tokens da apresentação: o app mantém o visual claro.
- `supabase/`: banco (migrations), Edge Functions, testes e `seed.sql` com dados de demonstração.

## 4. A apresentação

Visão completa e comandos em [`docs/apresentacao/README.md`](apresentacao/README.md). Resumo:

| Formato | Arquivo | Para quê |
|---|---|---|
| Página web (12 slides) | `docs/apresentacao/web/NOMADE RUN Apresentação.html` | Apresentar com animações: 10 slides + 2 do mockup interativo |
| PDF (10 slides) | `docs/apresentacao/NOMADE RUN - Apresentação.pdf` | Entregar e imprimir |
| Mockup interativo | `docs/apresentacao/mockup/NOMADE RUN Mockup.html` | Página só do mockup (hover, cursor, 3D) |
| Fonte dos slides | `docs/apresentacao/slides/` | Um HTML por slide; edite aqui |

**Para editar um slide:**
1. Altere `docs/apresentacao/slides/slides/<id>.html`.
2. Regere o PDF e a página web (comandos no README da apresentação).
3. Faça commit dos três: fonte, PDF e web.

---

## 5. Convenções

- **Commits:** autor com nome real; mensagem curta dizendo o que mudou.
- **Textos dos slides:** sem citar "TCC" e sem citar ferramentas de geração de texto ou código.
- **Mapa:** nunca mostrar hexágonos. A grade H3 fica só nas regras.
- **Crédito do mapa:** "© OpenStreetMap" sempre que o mapa real aparecer (licença ODbL).
- **Dados de demonstração:** sempre marcados como demonstração.
