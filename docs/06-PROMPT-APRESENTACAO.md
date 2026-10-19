# Prompt — Apresentação do NOMADE RUN (TCC)

> Prompt de produção da apresentação de defesa/acompanhamento do TCC. Foi escrito para ser executado do começo ao fim por uma pessoa ou por uma equipe, e o resultado está em `docs/apresentacao/`.
> Base: pesquisas `docs/pesquisa/05-apresentacao.md` (o que funciona em apresentações famosas e o que a banca espera) e `docs/pesquisa/06-visual-strava-e-territorio.md` (identidade visual).

---

## 0. Papel

Você é uma equipe de quatro pessoas trabalhando juntas:

1. **Roteirista de apresentações.** Já montou pitches no formato Sequoia/YC e defesas de TCC. Pensa em história antes de pensar em slide.
2. **Designer de slides.** Vem de produto digital. Trabalha com uma ideia por slide, números grandes e imagem grande.
3. **Pesquisador.** Confere cada número e coloca a fonte no rodapé.
4. **Orientador de TCC.** Garante que a banca encontre tudo o que avalia: problema, objetivos, metodologia, requisitos, arquitetura, protótipo, testes, resultados e limitações.

## 1. Contexto do projeto

- **Título:** NOMADE RUN: Um Projeto de Gestão e Gamificação de Corridas Urbanas.
- **Integrantes:** Gabryel Gomes Bahmad Camapum e Mateus Augusto De Faria Brito.
- **Uma frase:** app de corrida de rua de verdade, com GPS, que tem o essencial de um app de corrida (registro, ritmo, mapa, histórico, clube) e uma **Arena de minigames sobre o mapa real da cidade**.
- **Minigames:** território por times (Domínio), "Onde já corri" (Neblina), Fuga do fantasma, Caça aos baús, Raid da cidade, Liga semanal e **Cidade × Cidade**.
- **O que já existe:**
  - ERS com 27 RF, 15 RNF e 19 regras de negócio.
  - Protótipo funcional em Expo/React Native/TypeScript, com 60 testes automatizados das regras.
  - Product Book.
  - Pesquisa de mercado com fontes.
- **Visual do app:** estilo de app de corrida.
  - Fundo claro e neutros quentes.
  - **Um único laranja (#FF5A1F)** para ação e percurso.
  - Números grandes em Inter Tight.
  - Território desenhado como **regiões de bairro** suavizadas, sem grade hexagonal visível.

## 2. Objetivo da apresentação

**Resultado desejado na banca:** entender o que o app faz em 1 minuto, acreditar que ele é viável e justo, e ver que ele já funciona.

As **3 coisas que a banca deve lembrar** (regra de três, repetida na abertura e no fechamento):
1. É um **app de corrida completo**: registra a corrida como os apps que todo corredor já usa.
2. O diferencial é a **Arena**: a cidade vira tabuleiro, e cada rua pinta o bairro com a cor do seu time.
3. É **justo e seguro**: pontuação pelo esforço relativo (o iniciante também conquista), antifraude e Corrida Segura.

**Tamanho:** **no máximo 10 slides**, com cerca de 10 minutos de fala mais perguntas. Apresentação curta para a faculdade: cada slide precisa merecer o lugar. Confirme o tempo no regulamento do curso.

## 3. Público

- Banca de TCC: coordenador, orientador e convidados. Conhecem engenharia de software, não necessariamente corrida.
- Avaliam:
  - clareza do problema;
  - coerência objetivo → requisito → solução → teste;
  - qualidade técnica;
  - honestidade sobre limitações.
- Não precisam de jargão de startup ("TAM/SAM/SOM", "rodada"). Precisam de evidência.

## 4. Regras de conteúdo (das referências)

| Regra | Origem |
|---|---|
| O título de cada slide é **a conclusão**, numa frase ("Cada rua pinta o bairro do seu time"), nunca a categoria ("Território") | vc-pitch-deck, creating-presentations |
| **Uma ideia por slide**: no máximo ~30 palavras de corpo e um visual | YC, vc-pitch-deck |
| O slide 1 já diz o que o app faz | YC, Airbnb |
| No máximo 1/10 do tempo no problema | YC |
| Números grandes com **fonte no rodapé**; nada sem fonte | Pesquisa 05 |
| Mostrar o produto com **tela real** (mockup de celular), não diagrama | pitch-deck, Airbnb |
| Demo na ordem do problema, **ao vivo e com vídeo de reserva** | YC, iPhone 2007 |
| Concorrência num **gráfico 2×2**; nunca dizer "não temos concorrentes" | Airbnb, vc-pitch-deck |
| Mostrar **limitações** e próximos passos | Banca de TCC |
| Texto sem vícios de escrita de IA: nada de "não é X, é Y", "O resultado? 3x", "Desbloqueie o poder…" | copywriting |
| Se leva mais de 5 segundos para ler, corte texto | creating-presentations |
| Notas do apresentador em tópicos curtos (deixas), não em roteiro para ler | creating-presentations, pitch-deck |

**Proibido nos slides:**
- mencionar ferramentas de geração de texto ou código;
- usar logo, nome ou selo de marcas de terceiros como se fossem do projeto (o Strava pode ser citado como referência de mercado, com fonte);
- usar números sem fonte.

## 5. Identidade visual dos slides

Os slides usam o mesmo visual do app, para que a apresentação e o produto pareçam uma coisa só.

- **Formato:** 16:9.
- **Fundos:** claro `#F7F6F3` nos slides de conteúdo; laranja `#FF5A1F` apenas na capa, na abertura de seção (a Arena) e no fechamento ("sanduíche").
- **Cores de texto:** `#242428` para texto e `#5E5E66` para texto secundário.
- **Acento:** só o laranja. As cores dos times (azul `#0072B2`, verde `#009E73`, magenta `#C0559A`, amarelo `#D9B200`) aparecem apenas quando o assunto é time ou território.
- **Tipografia:**
  - títulos e números em **Inter Tight** (800);
  - texto em **Inter** (400/500);
  - título com 40 pt ou mais;
  - texto com 20 pt ou mais;
  - número de destaque com 96 pt ou mais.
- **Motivo visual repetido:** celular com tela real à direita e texto à esquerda nos slides de funcionalidade.
- **Evitar:**
  - linha decorativa embaixo do título;
  - faixas coloridas;
  - gradiente roxo;
  - ícones genéricos em excesso;
  - texto estourando a caixa.
- **Mapa:** sempre com cara de mapa de verdade (ruas, quarteirões, parques).
  - Território em regiões translúcidas com borda na cor do time.
  - Percurso laranja com borda branca.
  - **Nunca** usar hexágonos visíveis.
- **Legenda obrigatória nas capturas de mapa:** "Mapa base ilustrativo nas capturas; no celular o app usa Apple Maps / Google Maps".

## 6. Roteiro (10 slides, ~10 min)

| # | Título (a conclusão) | Visual | Fala (deixas) | Tempo |
|---|---|---|---|---|
| 1 | **NOMADE RUN.** Corra a sua cidade. Cada rua conta. | Fundo laranja, celular com o mapa de território, nomes dos integrantes | Em uma frase: app de corrida de rua com uma Arena de jogos sobre o mapa real da cidade | 0:40 |
| 2 | **15 milhões de brasileiros correm na rua, mas correr sozinho vira rotina** | Número gigante (fonte no rodapé) + 3 dores curtas | (1) Os apps registram, mas não dão motivo para voltar nem para explorar. (2) Os jogos de território que existem favorecem quem corre muito. (3) Segurança: 32% das mulheres citam medo como barreira | 1:00 |
| 3 | **Objetivo: transformar a corrida de rua num jogo justo sobre a cidade real** | Objetivo geral + regra de três: Correr · Explorar · Conquistar | Ler o objetivo geral; apresentar as 3 ideias que guiam o resto | 0:50 |
| 4 | **Primeiro, é um app de corrida de verdade** | Celular com a corrida ao vivo + celular com o resumo | GPS, ritmo, distância, pausa automática, resumo, histórico, sequência semanal. Corrida Segura com SOS | 1:00 |
| 5 | **Cada rua pinta o bairro com a cor do seu time** | Celular com o mapa de território + 3 regras curtas | 4 times com cor e forma. 30 pontos conquistam uma zona. Pontos pelo esforço **relativo** ao próprio ritmo: o iniciante também conquista. Zonas são atacadas e defendidas | 1:10 |
| 6 | **Uma Arena de minigames, e cidade contra cidade** | Grade de 6 modos + mini-ranking Cidade × Cidade | Domínio, Onde já corri, Fuga, Caça, Raid, Liga semanal. Cidade × Cidade dividida pelo número de corredores, para cidades pequenas competirem com capitais | 1:00 |
| 7 | **Como construímos: requisitos, regras isoladas e testes** | Linha do tempo (pesquisa → ERS → protótipo → testes) + 3 números (27 RF, 15 RNF, 19 RN) + camadas da arquitetura | React Native + Expo + TypeScript: iOS e Android com um código. Regras do jogo num domínio puro, testado. Grade H3 nas regras, regiões de bairro na tela | 1:10 |
| 8 | **Demonstração** | Roteiro da demo em 4 passos + aviso de vídeo de reserva | Ao vivo: mapa → corrida simulada → zona conquistada → resumo | 2:00 |
| 9 | **O que entregamos e o que falta** | 3 números (60 testes, 10 telas, ERS completa) + limitações e próximos passos | Limitações: protótipo sem servidor, sem teste com usuários em escala. Próximos passos: backend, piloto em Goiânia, parceiros locais | 0:50 |
| 10 | **A cidade é o tabuleiro.** | Fundo laranja + as 3 ideias + "Obrigado" | Repetir: app de corrida completo, Arena sobre o mapa real, justo e seguro. Abrir para perguntas | 0:30 |

**Total:** cerca de 10 min 10 s.

## 7. Roteiro da demonstração ao vivo

- **Preparação:**
  - celular com o app aberto no mapa, modo avião desligado e brilho no máximo;
  - espelhamento testado antes da sessão;
  - vídeo de reserva (2 min) gravado na véspera, no próprio notebook (não depender de internet).
- **Passos:**
  1. **Mapa:** mostrar os 4 times e tocar em "Só meu time".
  2. **Alerta:** tocar em "Parque Flamboyant está sob ataque" e mostrar a zona sendo disputada.
  3. **Correr:** escolher "Caça", sinal "Simulação 10×", e começar. Mostrar o 3-2-1, o percurso laranja e o aviso "Território dos Urban Coyotes".
  4. **Encerrar:** segurar o botão, ver "Zona conquistada" e o resumo com pontos e zonas.
- **Frase de transição para a demo:** "Agora vou mostrar uma corrida de 2 km em 30 segundos."
- **Se travar:** "Vou mostrar a gravação do mesmo fluxo." Não depurar na frente da banca.

## 8. Perguntas prováveis da banca e respostas curtas

| Pergunta | Resposta |
|---|---|
| Como evita trapaça (carro, bicicleta)? | Limite de velocidade e de teleporte, teto diário, pontuação de confiança (RN-007 a RN-009). Em produção: localização simulada bloqueada e verificação do aparelho |
| Quem corre muito não domina tudo? | O esforço é relativo ao próprio ritmo, há teto diário de pontos por zona, decaimento semanal e reset de temporada |
| Por que não usar a API do Strava? | A API restringe o uso de dados por terceiros; o app tem GPS próprio e exporta para outros apps |
| E a privacidade? | A posição ao vivo nunca aparece para desconhecidos, só para os contatos da Corrida Segura. Há zona de privacidade em casa |
| Por que hexágonos (H3) se o mapa não mostra hexágonos? | A grade torna a regra justa e testável. Para a pessoa, o mapa mostra regiões de bairro |
| Como ganha dinheiro? | Freemium: registro, território e segurança grátis; assinatura com cosméticos e estatísticas; parceiros locais. Nunca "pagar para ganhar" |

## 9. Entregáveis

1. Deck de **até 10 slides** (16:9) com notas do apresentador, exportável em PowerPoint (.pptx) e PDF.
2. Capturas reais do protótipo em `docs/apresentacao/telas/`.
   - Geradas por `docs/apresentacao/build/capturas.js`.
   - O mapa base é ilustrativo nas capturas, porque o servidor de mapas não carrega no ambiente de captura.
3. Este prompt, versionado no repositório.

## 10. Critérios de aceite

- [ ] Slide 1 diz o que o app faz, numa frase.
- [ ] Todo título é uma conclusão.
- [ ] No máximo 10 slides.
- [ ] Nenhum slide tem mais de ~30 palavras de corpo.
- [ ] Todo número tem fonte no rodapé.
- [ ] Toda tela de mapa tem cara de mapa (ruas) e nenhuma mostra hexágonos.
- [ ] Laranja é o único acento; as cores dos times só aparecem quando o assunto é time.
- [ ] Os nomes dos dois integrantes estão na capa.
- [ ] Metodologia, requisitos, arquitetura, testes, resultados e limitações aparecem (slides 7 e 9).
- [ ] A demo tem vídeo de reserva.
- [ ] O tempo total ensaiado fica entre 9 e 11 min.
- [ ] Nenhuma menção a ferramentas de geração de texto ou código.

## Referências

Airbnb pitch deck (2009) · Uber (2008) · Modelo Sequoia · Guy Kawasaki 10/20/30 · Y Combinator (como fazer um pitch deck; Demo Day) · Steve Jobs, iPhone (2007) · Duocon 2024 · Strava (identidade visual e mapas) · Skills de referência em `.agents/skills/`: creating-presentations, vc-pitch-deck, pitch-deck, pitch-deck-builder, slides, frontend-slides, storytelling, brand-storytelling, copywriting.
