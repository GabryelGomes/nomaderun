# PROMPT MESTRE — Reformulação Colossal do NOMADE RUN (v2 "Dopamina")

> **Quem executa:** o **Coordenador** (Claude Opus 5.5, esforço **máximo**) planeja, distribui, integra e decide. As **equipes** (Claude Opus 5.5, esforço **alto**) executam cada frente. Cada equipe tem uma definição completa em `.claude/agents/` (lista na seção 18).
> **Onde fica o trabalho:** `docs/melhoria/` (este prompt, relatórios por fase, plano mestre) e o código do monorepo (`apps/mobile`, `supabase/`).
> **Regra de ouro 1:** se a pessoa não entende a tela em **3 segundos**, a tela está errada.
> **Regra de ouro 2:** se a pessoa não tem um **motivo concreto para voltar amanhã**, a feature não terminou.
> **Regra de ouro 3:** tudo bonito, tudo funcionando, tudo testado. Nada de tela "quase pronta".

---

## Sumário

0. Como este prompt funciona (fases e entregáveis)
1. O pedido do dono, requisito por requisito
2. Estado atual do app (de onde partimos)
3. Norte do produto: a experiência que queremos
4. Princípios de design (regras que valem para toda tela)
5. Ciência da motivação: o "playbook de dopamina" (com ética)
6. Referências obrigatórias para pesquisar
7. Reformulação do território: como se ganham as áreas
8. Modos de jogo: análise e aperfeiçoamento de cada um
9. Os quatro times: identidade completa e escolha na primeira abertura
10. Arte e ilustração: mascotes, líderes, chefões, baús, medalhas
11. Motion e feedback: o catálogo de momentos de recompensa
12. UX tela por tela (inventário e metas)
13. Engajamento e retenção: os loops que trazem a pessoa de volta
14. Social e compartilhamento (Instagram, Strava, crews)
15. Backend (Supabase): o que o servidor precisa ganhar
16. Restrições técnicas (não negociáveis)
17. Skills e MCPs: o que usar e como procurar mais
18. Equipes, donos de pastas e responsabilidades
19. Protocolo de trabalho (worktrees, commits, relatórios, integração)
20. Critérios de aceite globais e métricas
21. Entregáveis finais
22. Riscos e como evitar
Apêndice A — Pedido original do dono (íntegra)

---

## 0. Como este prompt funciona

| Fase | Quem | O que acontece | Saída |
|---|---|---|---|
| **F0 — Preparação** | Coordenador | Este prompt, os agentes de cada frente e a base limpa no GitHub | `docs/melhoria/00-…`, `.claude/agents/*.md` |
| **F1 — Descoberta e design** | 10 equipes em paralelo (só leitura do código; cada uma escreve no próprio relatório) | Pesquisa, auditorias, propostas, protótipos de arte, wireframes | `docs/melhoria/F1/*.md` (+ protótipos em `docs/melhoria/F1/<frente>/`) |
| **F2 — Plano mestre** | Coordenador | Lê tudo, decide (registra D-61 em diante), monta as ondas de implementação com donos de pastas e critérios | `docs/melhoria/PLANO-MESTRE.md`, `docs/DECISOES_TECNICAS.md`, `docs/PLANO_DESENVOLVIMENTO.md` (Fase 7) |
| **F3 — Fundação** | Equipes em worktrees isoladas | Regras novas no domain e no servidor, sistema de arte, sistema de motion, modo demonstração, CI | Commits por equipe; relatórios em `docs/melhoria/relatorios/` |
| **F4 — Telas e features** | Equipes em worktrees isoladas, donos de telas diferentes | Onboarding com escolha de time, mapa e corrida, Arena e chefões, perfil/atividades/clube, missões, compartilhamento | Commits por equipe; relatórios |
| **F5 — QA e polimento** | QA + donos | Revisão adversarial (usabilidade, acessibilidade, desempenho, regras), correções até não sobrar achado importante | `docs/QA.md` (seção Fase 7), correções |
| **F6 — Fechamento** | Coordenador | Integração final, documentação, apresentação atualizada, push, (opcional) prévia web na Vercel | Branch atualizada no GitHub, resumo para o dono |

Cada fase só começa quando a anterior está **integrada e verde** (tipos, lint, testes).

---

## 1. O pedido do dono, requisito por requisito

O texto original está no Apêndice A. Estes são os requisitos que saem dele. **Todos são obrigatórios.**

| # | Requisito | Como saber que está feito |
|---|---|---|
| R1 | **Menos texto, mais imagem.** Hoje, tirando o Mapa, as abas são só texto | Toda aba tem um "herói visual" (ilustração, mapa, gráfico, mascote ou número grande). Nenhum parágrafo em telas de jogo. Medição de palavras por tela antes/depois |
| R2 | **Chefões (Raid) com desenho e animação** | Cada chefão tem ilustração própria, animação parado, levando golpe, furioso e derrotado; barra de vida animada; número de dano flutuando |
| R3 | **Reformular como se ganham as áreas** | Regra nova explicável em 1 frase, visível em tempo real durante a corrida, simulada e balanceada, implementada no domain e no servidor, com testes |
| R4 | **Todos os modos analisados: funcionam? São bonitos? Dão vontade?** | Relatório por modo (bugs, diversão, visual) e cada modo corrigido e redesenhado |
| R5 | **Dopamina: táticas que fazem o cérebro querer jogar** | Catálogo de momentos de recompensa implementado (seção 11) e loops de retorno (seção 13), dentro das regras éticas (seção 5.4) |
| R6 | **Layout que dá vontade de ficar olhando** | Telas com hierarquia clara, ilustração, movimento sutil, neon consistente; aprovação em revisão visual com capturas |
| R7 | **Fácil de usar e de entender** | Teste de 5 segundos por tela (seção 20); primeira corrida em até 2 toques a partir do Mapa; nenhuma regra sem explicação visual |
| R8 | **Times com vontade: biografia, desenho/animação; escolha do time logo na primeira abertura, como no Pokémon GO** | Tela de escolha de time na primeira abertura com 4 mascotes animados, líder, biografia, estilo de corrida e confirmação épica; página do time |
| R9 | **Tela por tela: analisar, planejar e melhorar** | Inventário completo (seção 12) com antes/depois de cada rota |
| R10 | **Como a pessoa abre o app e como volta a usar** | Jornada da primeira abertura (FTUE) e da volta (re-engajamento) desenhadas e implementadas |
| R11 | **Pesquisar o Strava, comunidades e compartilhar a corrida no Instagram** | Relatório de paridade com o Strava; card de compartilhamento (Stories e feed) funcionando |
| R12 | **Usar skills (find-skills, skills.sh), motion.dev e MCPs** | Skills pesquisadas e instaladas por frente; MCPs recomendados/usados; registro em `docs/melhoria/F1/02-skills-e-mcps.md` |
| R13 | **Equipes por frente; coordenador Opus 5.5 máximo; equipes Opus 5.5 alto** | Agentes em `.claude/agents/` e execução orquestrada |
| R14 | **Deixar o app "extremamente pronto"** | Critérios globais da seção 20 todos verdes |

**Além do pedido (o coordenador acrescenta):**
- X1. **Ética e saúde:** nada de padrão manipulador; descanso nunca é punido; segurança da Corrida Segura reforçada.
- X2. **Acessibilidade e desempenho** como requisito, não como "depois".
- X3. **Modo demonstração** (sem servidor) para apresentar, testar e gerar capturas de todas as telas.
- X4. **Prévia web** (Vercel) para o dono testar no celular sem instalar nada (opcional, no fechamento).
- X5. **CI no GitHub** (tipos, lint, testes do app e das functions) a cada push.
- X6. **Documentação e apresentação atualizadas** (números reais, telas novas, proposta de ERS v1.2).
- X7. **Compatibilidade:** o app novo não pode quebrar com o servidor que já está na nuvem; a ordem de deploy fica documentada.

---

## 2. Estado atual do app (de onde partimos)

Leia antes de qualquer proposta: `CLAUDE.md`, `docs/PROGRESSO.md`, `docs/ARQUITETURA.md`, `docs/REQUISITOS.md`, `docs/DECISOES_TECNICAS.md` (D-54 a D-60), `docs/REVISAO.md`, `docs/apresentacao/DESIGN-SYSTEM.md`.

- **Produto:** app de corrida de rua com GPS e uma Arena de jogos sobre o mapa real. Quatro times (facções) disputam zonas da cidade. Competição entre cidades.
- **MVP pronto (Fase 5) e visual neon (Fase 6):** conta e onboarding no servidor, corrida com GPS real e simulação, fila offline com sync assinada (HMAC), validação e pontuação no servidor, mapa em tempo real, rankings, crews, notificações, Corrida Segura (contatos, SOS, alerta de parada), moderação web, LGPD. Tema sempre escuro "Pit Lane Neon".
- **Stack:** Expo SDK 57, React Native 0.86, React 19.2 com React Compiler, Expo Router 57, Reanimated 4.5 (API de animações e transições CSS + worklets), react-native-svg 15, expo-haptics, react-native-maps (nativo) / MapLibre (web), Zustand, Supabase (Postgres + PostGIS, Auth, Edge Functions Deno, Realtime, pg_cron).
- **Distribuição:** app publicado pelo **EAS Update** (branch `demo`) e aberto no **Expo Go**. Backend no **Supabase Cloud**. Consequência: **só bibliotecas nativas que já vêm no Expo Go SDK 57** (seção 16).
- **Arquitetura:** `src/domain` é puro e é a fonte única das regras (o app e as Edge Functions usam o mesmo código). Telas não falam com o Supabase direto, só por `src/services/api`. RLS em todas as tabelas.
- **Testes hoje:** app 417 (jest) + 26 de integração; banco 285 (pgTAP); functions 58 (Deno); e2e 56; segurança 89. Domain com cobertura ≥ 99%.
- **Regras atuais do território (domain):** zonas H3 (resolução 9) desenhadas como regiões suavizadas; pontos de território (RP) pelo **esforço relativo** ao ritmo habitual (0,8× a 1,3×); zona neutra conquistada com 30 RP; tomar zona rival exige 1,1× a influência do dono; ataque quando o rival chega a 50%; escudo até 3; fortificar correndo 500 m; decaimento semanal (×0,9, piso 5); teto diário de 300 RP por zona; bônus de Fuga ×1,5, de grupo ×1,25, de defesa ×2; reset parcial na temporada (×0,3).
- **Modos (Arena):** Domínio (real), Neblina "Onde já corri" (real), Fuga (real), Caça (baús reais do servidor), **Raid (só dados de demonstração)**, **Liga (só demonstração)**, Cidade × Cidade (parcial), Crews (real); "Rabisco" e "Bandeira" anunciados para versões futuras.
- **O que falta (REQUISITOS):** feed social (RF-014 ⬜), missões e medalhas (RF-016 🟡), compartilhar com imagem (RF-017 🟡), parciais por km e recordes (RF-006 🟡), raid real (RN-018 ⬜), liga real (RN-015 🟡), prefeito (RN-012 ⬜), fantasma de amigo (RF-012 🟡), mapa de calor (RF-013 ⬜).
- **Diagnóstico do dono:** "muito texto, abas sem imagem, chefões sem desenho, times sem vontade, ganhar área precisa ser reformulado".

---

## 3. Norte do produto: a experiência que queremos

**Promessa:** *Corra a sua cidade. Cada rua conta.*

**A jornada-alvo, em 6 momentos:**
1. **Primeira abertura (0–90 s):** splash animado → criar conta rápido → **"Escolha seu time"** (4 mascotes animados, líder, biografia curta, estilo de corrida) → confirmação épica (a cor do time inunda a tela, vibração, frase do líder) → permissão de localização com ilustração → **missão de boas-vindas**: "Corra 500 m para pintar sua primeira zona".
2. **Abrir o app em um dia comum (3 s):** o Mapa mostra **o meu time, a minha área, o que mudou** (zona atacada, baú do dia, chefão com vida baixa) e **um botão gigante: Correr**.
3. **Durante a corrida:** a cidade **pinta em tempo real** com a cor do time; a cada marco (25%, 50%, conquista) há vibração, som opcional e um aviso visual curto; dano no chefão e baús aparecem como "pop-ups" animados que não atrapalham.
4. **Fim da corrida (pico):** resumo cinematográfico: rota desenhando sobre o mapa → números subindo → conquistas uma a uma (zonas, baús, dano no chefão, XP, nível, sequência) → **card pronto para o Instagram**.
5. **Entre corridas:** motivos concretos e honestos para voltar: "sua zona está sob ataque", "faltam 2 km para o chefão cair", "baú do dia disponível", "1 corrida para manter a sequência da semana", "a liga fecha domingo e você está em 6º".
6. **Toda semana/mês:** recap semanal compartilhável, liga com promoção/rebaixamento, nova temporada com trilha de recompensas e chance de trocar de time.

**Métricas que orientam o design** (medidas depois por telemetria; aqui servem de alvo de projeto):
- Tempo até a 1ª conquista: **no primeiro dia**, em até 1 km de corrida.
- Corrida iniciada em **≤ 2 toques** a partir do Mapa.
- Teste de 5 segundos: a pessoa diz **o que a tela mostra e o que fazer** em ≥ 80% das telas.
- D1/D7/D30 e corridas por semana (instrumentar eventos: abrir, correr, conquistar, compartilhar).
- % de corridas compartilhadas.

---

## 4. Princípios de design (valem para toda tela)

| # | Princípio | Regra prática |
|---|---|---|
| P1 | **Imagem antes de texto** | Cada tela tem um herói visual. Título ≤ 30 caracteres. Texto auxiliar: **1 frase por bloco, ≤ 90 caracteres**. Explicações longas vão para um botão "?" (folha com 3 cartões ilustrados) ou para o tutorial |
| P2 | **Um objetivo e uma ação primária por tela** | O botão principal é o mais visível (laranja neon, texto escuro). Secundárias discretas |
| P3 | **Progresso sempre visível** | Barras, anéis, "faltam 400 m", "3/5". Nunca um número solto sem referência |
| P4 | **Feedback imediato e proporcional** | < 100 ms; vibração + animação; celebração pequena, média ou épica conforme o feito (seção 11) |
| P5 | **Números grandes, palavras pequenas** | Métricas em fonte de display; rótulos curtos |
| P6 | **Pertencimento** | Cor e forma do time presentes (sem poluir); avatar e emblema da crew |
| P7 | **Consistência** | Tokens (`src/theme`), componentes compartilhados, ícones de um único estilo, ilustrações do mesmo traço |
| P8 | **Acessível** | Contraste ≥ 4,5:1 (texto escuro sobre o laranja; resolver M-2 da revisão), alvos ≥ 44 pt, `accessibilityLabel` + `testID` em todo interativo, leitor de tela, "Reduzir movimento" troca movimento por opacidade |
| P9 | **Rápido** | 60 fps; animar só transform/opacidade; nada pesado na thread de JS durante a corrida; listas virtualizadas |
| P10 | **Divulgação progressiva** | O básico na tela; o detalhe sob demanda (toque, folha, "ver mais") |
| P11 | **Estados completos** | Carregando (esqueleto com brilho), vazio (ilustração + 1 ação), erro (mensagem humana + tentar de novo), sem internet |
| P12 | **Português claro** | Palavras do corredor ("zona", "time", "baú", "chefão"), nada de jargão técnico ("RP" vira "pontos de território" ou ícone) |

---

## 5. Ciência da motivação: o "playbook de dopamina" (com ética)

### 5.1 O que a ciência diz (base para as decisões)
- **Dopamina é antecipação, não só prazer** (Schultz): o cérebro libera dopamina quando prevê uma recompensa e quando ela vem melhor que o esperado. → Crie **antecipação** (barra quase cheia, baú fechado, contagem regressiva do chefão) e **surpresas positivas** (baú raro, bônus inesperado).
- **Hook Model** (Nir Eyal): gatilho → ação → recompensa variável → investimento. → Notificação útil → correr → resultado variável (zonas, baús, dano) → investimento (zonas que são suas, sequência, crew).
- **Fogg (B = MAP):** comportamento = motivação × habilidade × gatilho. → Facilitar (2 toques para correr), motivar (significado: defender a cidade), gatilho na hora certa.
- **Autodeterminação (Deci & Ryan):** autonomia (escolher modo, rota, time), competência (progresso claro, vitórias pequenas), pertencimento (time, crew, cidade).
- **Octalysis (Yu-kai Chou):** usar mais os motores "do bem" (significado épico, realização, criatividade, posse, influência social) e dosar os "de pressão" (escassez, imprevisibilidade, evitar perda).
- **Efeitos úteis:** gradiente de meta (acelera perto do fim), progresso dotado (começar com a barra não vazia), Zeigarnik (tarefa incompleta puxa a volta), regra pico-fim (o fim da corrida tem que ser o pico), efeito IKEA (personalizar), prova social, reciprocidade (aplausos/kudos).

### 5.2 Táticas mapeadas para o NOMADE RUN
| Tática | Onde no app | Mecanismo |
|---|---|---|
| Pintura da cidade em tempo real | Corrida | Recompensa imediata + criatividade |
| "Faltam 120 m para conquistar" | Corrida, Mapa | Gradiente de meta |
| Baú do dia e baús com raridade | Mapa, Caça | Recompensa variável honesta |
| Chefão com vida global e contagem regressiva | Arena/Raid | Significado épico + pertencimento + escassez |
| Zona sob ataque | Notificação, Mapa | Evitar perda (com defesa possível) |
| Sequência **semanal** com congelamento | Perfil, Mapa | Evitar perda sem punir descanso |
| Liga semanal com promoção | Arena/Clube | Competição justa entre pares |
| Missões diárias/semanais e trilha da temporada | Arena/Missões | Realização + Zeigarnik |
| Coleção (medalhas, bairros explorados, mascotes/variações cosméticas) | Perfil | Posse |
| Resumo cinematográfico + card do Instagram | Resumo | Pico-fim + influência social |
| Aplausos da crew ("Bora!") | Clube/Atividades | Reciprocidade + pertencimento |
| Missão de boas-vindas com conquista garantida | Onboarding | Competência + progresso dotado |
| Recap semanal "Sua semana no NOMADE" | Notificação/Atividades | Pico-fim + compartilhamento |
| Recordes pessoais (PR) e parciais | Resumo/Atividades | Competência |

### 5.3 Ritmo de recompensas
- **Micro (toda ação):** toque responde com animação e vibração leve.
- **Pequena (toda corrida):** zona pintada, XP, baú comum.
- **Média (algumas por semana):** zona conquistada de rival, baú raro, subir na liga, missão semanal.
- **Épica (raro):** nível novo, chefão derrotado, baú lendário, promoção de divisão, recorde pessoal, fim de temporada.
Nunca dar tudo de uma vez: espaçar os pontos altos para manter a antecipação.

### 5.4 Limites éticos (obrigatórios)
- **Proibido:** loot box paga, pagar para ganhar, contadores ou escassez falsos, culpa ("você decepcionou seu time"), punição por descansar, sequência diária obrigatória, notificação depois das 22h ou antes das 7h, mais de **1 notificação de engajamento por dia** (alertas de segurança e de ataque real são exceção, com limite).
- **Saúde:** sequência é **semanal** (2 corridas valem a semana), congelamento mensal, mensagens de descanso e hidratação em dias quentes (opcional), nada que incentive correr lesionado.
- **Segurança:** compartilhamentos respeitam **zonas de privacidade** (nunca mostrar a casa); posição ao vivo só para contatos; Corrida Segura sempre a 1 toque.
- **Transparência:** regras explicadas; chances de raridade dos baús visíveis.
- **LGPD:** dados mínimos, consentimento, exportar/excluir continuam funcionando.

---

## 6. Referências obrigatórias para pesquisar (e o que extrair)

| Referência | O que estudar |
|---|---|
| **Pokémon GO** | Primeira abertura (professor, avatar), **escolha de time com os líderes Candela/Blanche/Spark** (falas, cor inundando a tela), ginásios e raids (chefão com timer, vida, animação de batalha, recompensa), Adventure Sync semanal, medalhas, amizade e presentes |
| **Ingress** (Niantic) | Duas facções disputando portais, **links e campos de controle** (triângulos) → inspiração para "fechar áreas" |
| **Strava** | Feed com mapa de cada corrida, **kudos e comentários**, clubes, **desafios mensais com medalha**, segmentos e KOM/QOM/Local Legend, recordes pessoais e parciais, gráficos de ritmo, Year in Sport, **compartilhar nos Stories com sticker de rota**, Beacon (segurança), heatmaps |
| **Duolingo** | Sequência e congelamento, ligas semanais, mascote expressivo (Duo), celebrações, notificações personalizadas, "XP em dobro" |
| **Nike Run Club** | Níveis por cor de corredor (distância total), troféus visuais, corridas guiadas por áudio, recap |
| **Zwift / Clash Royale / Brawl Stars** | Baús e trilha de recompensas com animação de abertura; níveis e desbloqueios |
| **Apple Fitness / Garmin** | Anéis de meta, medalhas, recordes |
| **INTVL, KYRO, Zonner, Run An Empire, Turf** | Jogos de território por corrida: o que funciona, o que frustra (loops gigantes, iniciante sem chance) |
| **Zombies, Run!** | Narrativa em áudio durante a corrida |
| **Mobbin** (se o conector estiver ligado) | Telas reais de onboarding, escolha de time, feed, resumo de atividade e compartilhamento |

Sempre registrar **fonte (URL)** e **padrão extraído**; nada de copiar marcas, nomes ou arte de terceiros.

---

## 7. Reformulação do território: como se ganham as áreas

### 7.1 Problemas a verificar no código e com simulação
- A regra cabe em 1 frase? Hoje há RP, influência, limiar 30, 1,1×, 50% de ataque, escudo, fortificação, decaimento, teto diário: **difícil de explicar**.
- Durante a corrida, a pessoa **vê** que está ganhando? Ou só descobre no resumo?
- O iniciante conquista algo no primeiro dia?
- Quem corre muito domina tudo para sempre?
- Explorar ruas novas vale mais que repetir a mesma volta?
- Defender é possível e recompensador?

### 7.2 Objetivos da regra nova
G1 explicável em **uma frase** · G2 **visível em tempo real** (a rota pinta) · G3 justa para iniciante (esforço relativo continua) · G4 explorar compensa · G5 defesa importa · G6 sem domínio eterno (decaimento e temporada) · G7 **autoridade do servidor** (antifraude, HMAC, validação) · G8 **migração aditiva** e compatível com o banco e as Edge Functions atuais.

### 7.3 Mecânicas candidatas (a equipe de game design avalia com simulação e recomenda)
- **M1 — Pintar ruas:** cada trecho percorrido fica com a cor do time; a zona é do time que mais "pintou" nela. Muito visual.
- **M2 — Fechar o circuito:** completar uma volta fechada conquista a área de dentro (com teto de área por corrida e ajuste por esforço, para não favorecer só voltas gigantes).
- **M3 — Pontos de controle (estilo Ingress):** praças e parques como "bandeiras" que dão bônus; ligar 3 bandeiras do time forma um campo.
- **M4 — Regra atual simplificada:** mesma base H3, mas com **barra de domínio de duas cores** por zona, números simples ("faltam 400 m"), pintura ao vivo e marcos de 25%.
- A expectativa é um **híbrido** (por exemplo, M4 como base + pintura de M1 + bônus de M2), mas a decisão sai da **simulação**.

### 7.4 Entregáveis
- Especificação: a regra em 1 frase, tabela de números, exemplos ilustrados, casos de borda.
- Funções puras no `src/domain` com testes de exemplo e **testes de propriedade** (skill `property-based-testing`).
- **Simulação** com corredores sintéticos (iniciante: 3 km, 2×/semana; regular: 5 km, 4×/semana; avançado: 15 km, 6×/semana; times desequilibrados) para medir justiça, rotatividade das zonas e "tempo até a 1ª conquista".
- Plano de migração no servidor (tabelas novas/colunas aditivas, functions), compatibilidade com o app antigo, ordem de deploy.
- Especificação de UI para o feedback em tempo real (para as equipes de UX e motion).

---

## 8. Modos de jogo: análise e aperfeiçoamento

Para **cada** modo, a equipe responsável entrega: estado atual (o que funciona, bugs encontrados com arquivo:linha), objetivo de diversão, regra revisada, recompensa, visual (arte e animação), texto (curto), critérios de aceite e testes.

| Modo | Direção |
|---|---|
| **Domínio** | Regra nova (seção 7); pintura ao vivo; zona com barra de duas cores; folha da zona com ilustração do "dono", histórico e "como tomar" em 1 frase |
| **Onde já corri (Neblina)** | Vira **Atlas da cidade**: % explorado por bairro, medalhas de explorador por bairro, revelação animada da névoa |
| **Fuga** | Fantasma com avatar animado (sua sombra, um amigo ou o dono da zona), distância ao vivo como "corda" entre os dois, voz, vitória épica |
| **Caça** | Baús ilustrados com 3 raridades, **radar** durante a corrida, animação de abertura (treme → raios → explode → recompensa), chances visíveis |
| **Raid (chefão)** | **Chefões ilustrados e animados**, vida global **real no servidor**, fases (100/66/33%), contagem regressiva, dano por km, ranking de dano, recompensa coletiva e individual, animação "seu golpe" ao sincronizar a corrida |
| **Liga semanal** | Grupos reais de 30 no servidor, divisões com ícones (Calçada → Maratona), promoção/rebaixamento animados no domingo |
| **Cidade × Cidade** | Torre de classificação estilo F1, "sua cidade precisa de você", placar por corredores ativos (RN-013) |
| **Crews** | Emblema da crew, meta semanal coletiva com barra, membros correndo agora, aplausos, convite por link |
| **Missões (novo)** | 3 diárias + 3 semanais + trilha da temporada (níveis com recompensas cosméticas), medalhas (RF-016) |
| **Desafios mensais** | Estilo Strava: "Corra 50 km em novembro" com medalha animada |
| **Recordes e parciais** | Parciais por km, gráfico de ritmo, recordes pessoais (1 km, 5 km, 10 km, maior corrida) no resumo e no perfil (RF-006) |
| **Rabisco / Bandeira** | Avaliar se entram agora (só se ficarem prontos e bonitos); senão, tirar da tela ou mostrar como "em breve" com arte |

---

## 9. Os quatro times: identidade completa e escolha na primeira abertura

Hoje os times são só um nome, uma cor e uma frase. Eles precisam **ter alma**.

Para **cada time** criar:
- **Mascote** (animal ou criatura, coerente com o nome) com 3 poses: parado (respira/pisca), vitória, derrota.
- **Líder** (personagem com nome, personalidade e frase de efeito), como os líderes do Pokémon GO.
- **Biografia:** versão curta (1 frase, para o card) e versão longa (3–5 frases, para a página do time): origem, valores, estilo de corrida.
- **Estilo de corrida:** por exemplo, Striders = ritmo e precisão; Volt = resistência e distância; Owls = corridas noturnas; Coyotes = corrida em grupo. **Só cosmético e de identidade: nenhum time ganha vantagem de pontuação.**
- **Grito de guerra**, padrão de vibração próprio, emblema animado.
- **Página do time:** mascote, líder, zonas do time na cidade, ranking do time, membros que correram hoje, meta da semana do time.

**Cores e formas atuais (manter, salvo decisão registrada):** Neon Striders azul `#2FA8FF` (círculo), Volt Runners verde `#19E6A8` (triângulo), Night Owls vermelho `#FF2D55` (losango), Urban Coyotes amarelo `#FFD60A` (quadrado).

**Escolha de time na primeira abertura (como o Pokémon GO):**
1. Logo depois de criar a conta.
2. Carrossel ou grade de 4 cards grandes: mascote animado, nome, 1 frase, estilo de corrida.
3. Tocar abre o líder falando (2 frases, com animação de entrada).
4. Opcional: **"Não sei escolher"** abre um quiz de 3 perguntas que recomenda um time (a escolha continua livre).
5. Confirmar: **a cor do time inunda a tela**, o mascote comemora, vibração forte, frase do líder.
6. Avisar com leveza: "Você pode trocar 1 vez por temporada" (a tela Perfil › Meu time já existe).

---

## 10. Arte e ilustração

**Estilo:** "neon line-art geométrico", coerente com o Pit Lane Neon: traços luminosos sobre fundo escuro, formas geométricas simples, poucas cores (a cor do time + laranja + branco quente), expressivo (olhos, poses) e **nada infantil**.

**Formato:** componentes SVG (`react-native-svg`) parametrizados por cor, pose e estado, animáveis com Reanimated. Partículas e brilhos pesados só com Skia **se** vier no Expo Go SDK 57 (confirmar). Nada de imagem raster pesada.

**Lista mínima:**
- Mascotes ×4 (3 poses cada) e líderes ×4 (busto).
- **Chefões ×5** (exemplos de conceito, a equipe de arte cria os seus: "O Sedentário", "Rei do Trânsito", "Nuvem de Fumaça", "Lorde do Calor", "Muralha de Concreto"), cada um com: parado, levando golpe, furioso (vida < 33%) e derrotado.
- Baús ×3 raridades (fechado, abrindo, aberto).
- Medalhas ×12 (explorador, conquistador, defensor, sequência, chefão, liga, temporada…).
- Ícones dos modos ×8 (mesmo traço).
- Ilustrações de estado vazio ×8 (sem corridas, sem crew, sem notificações, sem conexão…).
- Cards ilustrados do tutorial ×3 ("corra", "pinte", "defenda").
- Fundos sutis das abas (padrões neon discretos, sem atrapalhar a leitura).

**Qualidade:** toda arte é **renderizada em PNG** (Playwright) e revisada antes de ir para o app; paths simples (desempenho); não depender só da cor (forma do time sempre junto).

---

## 11. Motion e feedback: o catálogo de momentos

| Momento | Animação | Vibração | Duração |
|---|---|---|---|
| Toque em botão | Escala 0,97 + brilho | Leve | 120 ms |
| Trocar de aba / tela | Transição nativa; conteúdo entra com fade + 8 px | — | 200–250 ms |
| Carregando | Esqueleto com brilho passando | — | contínuo |
| Pintar trecho (corrida) | Rastro com a cor do time, brilho pulsando | — | contínuo |
| Marco 25/50/75% da zona | Anel enche + pulso | Leve | 300 ms |
| **Zona conquistada (corrida)** | Flash da cor do time, toast grande, voz | Forte (sucesso) | 600 ms |
| **Zona conquistada (resumo)** | Anel fecha, confete na cor do time, número sobe | Sucesso | 1,2 s |
| Baú abrindo | Treme 3× → raios → explode → item com cor da raridade | Crescente | 1,5 s |
| Golpe no chefão | Chefão pisca branco e treme, número de dano flutua, barra desce com "barra fantasma" | Média | 800 ms |
| Chefão derrotado | Cai, explode em partículas, tela de vitória coletiva | Sucesso | 2 s |
| Nível novo | Tela cheia, número grande, brilho, recompensa | Sucesso | 2 s |
| Sequência mantida | Chama acende, contador gira | Leve | 600 ms |
| Liga: subir posições | Linha sobe trocando de lugar | Leve | 600 ms |
| Recorde pessoal | Selo "PR" carimba com brilho | Média | 800 ms |

**Regras:** springs e curvas de saída (princípios do motion.dev aplicados com Reanimated 4); só transform/opacidade; "Reduzir movimento" troca tudo por fade; nada de animação pesada durante a corrida (a GPS e a sincronização vêm primeiro); som opcional e desligado por padrão.

---

## 12. UX tela por tela (inventário e metas)

A equipe de UX mede **palavras visíveis** e **elementos visuais** de cada tela antes e depois, usando o código e as capturas de `docs/ui-audit/`.

| Rota | Objetivo da tela | Herói visual novo | Ação primária |
|---|---|---|---|
| `(auth)/entrar`, `cadastro`, `recuperar-senha`, `nova-senha` | Entrar/criar conta rápido | Wordmark neon + mapa animado de fundo (já existe) | Entrar / Criar conta |
| `onboarding` | Escolher time e começar | **Mascotes animados**, líder, confirmação épica | Entrar para o time |
| `(tabs)/index` (Mapa) | Ver minha área e correr | Mapa + card compacto do time (zonas, sequência, baú do dia, chefão) | **Correr** |
| `corrida` | Correr e ver a cidade pintar | HUD grande, pintura ao vivo, toasts animados | Pausar / Encerrar |
| `resumo` | Celebrar e compartilhar | Sequência cinematográfica (rota → números → conquistas) | Compartilhar |
| `zona/[id]` | Entender uma zona | Ilustração do dono, barra de duas cores, histórico | Correr aqui / Defender |
| `(tabs)/arena` | Escolher o que jogar hoje | **Cards ilustrados grandes por modo**, status ao vivo (vida do chefão, baús, posição na liga) | Jogar o modo |
| `(tabs)/atividades` | Ver meu progresso | **Feed estilo Strava** com mini-mapa por corrida, gráfico semanal, recordes, sequência | Abrir corrida |
| `(tabs)/clube` (+ `crew`) | Pertencer e competir | Emblema da crew, pódio animado, torre Cidade × Cidade, aplausos | Aplaudir / Entrar em crew |
| `(tabs)/perfil` (+ `editar`, `conta`, `time`) | Ser alguém no jogo | **Cartão de jogador** (avatar, nível com anel, título, mascote do time), estante de medalhas | Ver medalhas / Meu time |
| `notificacoes` | Saber o que aconteceu | Ícones ilustrados por tipo, agrupamento por dia | Ir até o evento |
| `contatos-seguranca`, `zonas-privacidade` | Segurança e privacidade | Ilustração de escudo; mapa com zonas | Adicionar |
| `privacidade`, `termos`, `indisponivel` | Informar | Texto é aceitável aqui, bem formatado | — |
| `moderacao/*` (web) | Moderar | Funcional, legível (prioridade baixa de visual) | Aprovar / Rejeitar |
| **Novas** (propostas): `missoes`, `time/[id]` (página do time), `compartilhar`, `recompensas`/trilha da temporada, `raid/[id]` | Ver cada uma nas seções 8, 9, 13 e 14 | — | — |

Navegação: avaliar se as 5 abas atuais (Mapa, Arena, Atividades, Clube, Perfil) continuam as melhores; botão de correr sempre a 1 toque.

---

## 13. Engajamento e retenção: os loops

- **Loop da corrida:** correr → pintar → conquistar/abrir baú/golpear chefão → resumo épico → compartilhar.
- **Loop diário:** baú do dia, 3 missões diárias, olhar o mapa ("o que mudou desde ontem?").
- **Loop semanal:** sequência semanal (2 corridas), liga (fecha domingo), chefão da semana, missões semanais, **recap semanal**.
- **Loop da temporada (mensal):** trilha de recompensas cosméticas, medalha da temporada, reset parcial do território, troca de time liberada.
- **Primeira semana (FTUE de 7 dias):** missões guiadas que ensinam um modo por dia (Domínio → Caça → Fuga → Raid → Crew → Liga → Compartilhar).
- **Notificações:** catálogo com gatilho, limite, horário e texto (≤ 60 caracteres), sem culpa; preferências por tipo (já existem).
- **Volta depois de sumir:** mensagem acolhedora + missão fácil + "sua zona X precisa de você" (só se for verdade).
- **Progressão:** níveis (XP), **títulos** por faixa de nível, **cores de corredor** por distância total (inspiração NRC), cosméticos desbloqueáveis (cor do rastro, moldura do avatar, efeito de conquista).

---

## 14. Social e compartilhamento

- **Card da corrida** para **Stories (1080×1920)** e **feed (1080×1350)**: rota neon sobre mapa escuro, distância, tempo, ritmo, zonas conquistadas, time (mascote e cor), logo. Variações: conquista de zona, nível novo, chefão derrotado, recap semanal, "Seu ano no NOMADE".
- **Fluxo:** no resumo, "Compartilhar" → escolher modelo → pré-visualizar → menu de compartilhar do sistema (Instagram, WhatsApp…). Técnica: captura de view (`react-native-view-shot`, **se vier no Expo Go SDK 57**) + `expo-sharing`; na web, Web Share ou download.
- **Privacidade:** o card **corta ou desfoca** o trecho dentro das zonas de privacidade; nunca mostra a casa.
- **Aplausos ("Bora!") e reações** em corridas da crew e de amigos (feed social RF-014, versão simples, sem comentários livres para evitar moderação pesada).
- **Convite** por link (crew e app).
- **Strava:** relatório de paridade (o que temos, o que falta, o que vale copiar). Exportar GPX para quem quiser subir no Strava.

---

## 15. Backend (Supabase): o que o servidor precisa ganhar

- **Migrações aditivas** (nada destrutivo), RLS em toda tabela nova, validação de entrada nas functions, testes pgTAP e Deno, `docs/API_CONTRATO.md` atualizado, seed de demonstração para cada feature nova.
- Prováveis entregas (confirmar na F2): regra nova de território (functions usando o domain), **raids reais** (tabelas, dano somado por corrida aceita, fases, recompensas), **missões e medalhas** (definições, progresso, resgate), **liga semanal real** (grupos, fechamento por job), **aplausos/feed** (tabelas, RLS, Realtime), recordes pessoais (derivados das atividades), dados para o card (estatísticas da corrida, já respeitando privacidade).
- **Compatibilidade:** app novo + servidor antigo degrada sem quebrar; app antigo + servidor novo continua funcionando; ordem de deploy documentada em `supabase/DEPLOY.md`.
- Neste ambiente o daemon do Docker não roda, mas o **Postgres 16** está instalado e o apt do Ubuntu tem PostGIS, pgTAP e pg_cron. A E9 tenta na F1 um **banco local sem Docker** (com um shim do Supabase) para rodar as migrations e os testes pgTAP aqui. Se não der, rode o que der (`npx -y deno test …` para as functions) e deixe os comandos exatos para a equipe rodar na máquina dela.

---

## 16. Restrições técnicas (não negociáveis)

1. **Expo SDK 57**, React Native 0.86, React 19.2 com **React Compiler** (regras: nada de ler/escrever ref na renderização, nada de `Date.now()` na renderização, efeitos sem setState síncrono).
2. **Só módulos nativos que vêm no Expo Go SDK 57.** Antes de instalar qualquer biblioteca nativa (Skia, Lottie, view-shot, áudio), **confirme na documentação da versão 57** que ela está no Expo Go. Instale com `npx expo install` (use `EXPO_OFFLINE=1` se a API do Expo estiver bloqueada).
3. **Reanimated 4.5** para animação (API de animações/transições CSS e worklets; `useReducedMotion`). motion.dev é biblioteca **web**: use os princípios dele no app e a biblioteca só na web, se fizer sentido.
4. **Web continua funcionando** (react-native-web): painel de moderação, modo demonstração e prévia na Vercel.
5. `src/domain` **puro**, compartilhado com as Edge Functions (Deno): nada de import de React/Expo no domain; cobertura ≥ 90% (hoje ~99%, manter).
6. Todo interativo novo com `testID` e `accessibilityLabel` (o teste estático `src/__tests__/testids.test.ts` derruba o `npm test` se faltar).
7. Segurança: nenhum segredo no código; RLS; `service_role` só nas functions; HMAC continua.
8. Textos em **português do Brasil**.
9. Desempenho: 60 fps; filtros de desfoque pesados no Android evitados (pré-desfoque ou Skia); nada de animação na thread de JS durante a corrida.
10. **Não quebrar testes existentes**; quando o comportamento mudar de propósito, atualizar o teste e explicar no relatório.
11. **D-15 (visual congelado) fica substituída pela D-61** "Reformulação v2": mudanças visuais permitidas **dentro** do sistema Pit Lane Neon (tokens, componentes, ilustrações no mesmo traço).

---

## 17. Skills e MCPs

**Pesquisa obrigatória com o método do find-skills** (`.claude/skills/find-skills`): olhar o ranking do skills.sh, buscar por palavra-chave, conferir installs, dono e licença. O skills.sh e o `npx skills find` ficam bloqueados neste ambiente: use **WebSearch** e baixe o `SKILL.md` direto do GitHub (`git clone --depth 1 --filter=blob:none` ou `raw.githubusercontent.com`). Instale em **`.claude/skills/<nome>/`** e registre a origem.

**Skills já disponíveis:**
- **`.claude/skills`:** expo-overview, expo-router, expo-native-ui, expo-data-fetching, expo-dev-client, react-native-best-practices, mobile-app-ui-design, supabase, supabase-postgres-best-practices, property-based-testing, sharp-edges, differential-review, spec-to-code-compliance, webapp-testing, writing-user-docs, find-skills.
- **`.agents/skills`:**
  - motion e efeitos: expo-animation, react-native-reanimated, react-native-skia, expo-motion, emil-design-eng, motion-design, svg-animation, synthwave;
  - design e conteúdo: frontend-design, ui-ux-pro-max, gamification-loops, app-store-screenshots, copywriting, storytelling;
  - mapa: mapbox-cartography, mapbox-data-visualization-patterns.

**Procurar e instalar (sugestões):** gamificação e game design; retenção e onboarding; ilustração e geração de SVG; personagens e mascotes; Lottie e Rive; React Native Skia; compartilhamento social e cards de imagem; acessibilidade mobile; testes visuais; copywriting de UX.

**MCPs:**
- **Já ligados:** **Whimsical** (wireframes e fluxos da reformulação), **Vercel** (prévia web), **GitHub**, **Google Drive**.
- **Recomendados ao dono:** **Mobbin** (telas reais de referência), **Expo** (builds, EAS), **Supabase** (migrações e logs do Cloud), **Figma**.
- **motion.dev:** biblioteca web. O AI Kit oficial é pago (Motion+); os MCPs da comunidade não são oficiais.

---

## 18. Equipes, donos de pastas e responsabilidades

| Equipe (arquivo em `.claude/agents/`) | Missão | Pastas que pode alterar (nas fases de implementação) |
|---|---|---|
| **Coordenador** (`coordenador-melhoria`) | Planejar, decidir, integrar, garantir qualidade e prazo | `docs/melhoria/**`, `docs/*.md` de coordenação, merges |
| **E1 Pesquisa de produto** (`pesquisa-produto`) | Strava, Pokémon GO, Duolingo, Ingress…; ciência da motivação | `docs/melhoria/**` (relatórios) |
| **E2 Skills e MCPs** (`skills-e-mcps`) | Encontrar, verificar e instalar skills; mapear MCPs | `.claude/skills/**`, `.agents/skills/SOURCES.md`, `docs/melhoria/**` |
| **E3 Game design e território** (`game-design-territorio`) | Regra nova de território, modos, balanceamento, simulação | `apps/mobile/src/domain/**`, `docs/melhoria/**` |
| **E4 Direção de arte** (`direcao-de-arte`) | Times, mascotes, líderes, chefões, baús, medalhas, ilustrações | `apps/mobile/src/components/art/**` (novo), `apps/mobile/assets/art/**`, `docs/melhoria/**` |
| **E5 Motion e feedback** (`motion-feedback`) | Sistema de animação, celebrações, vibração, transições | `apps/mobile/src/components/motion/**`, `apps/mobile/src/components/celebration/**` (novo), `apps/mobile/src/theme/motion.ts` |
| **E6 UX/UI das telas** (`ux-telas`) | Tela por tela, onboarding, navegação, texto | `apps/mobile/src/app/**`, `src/features/screens/**`, `src/features/auth/**` (UI), `src/components/**` (exceto `art`, `motion`, `celebration`), `src/theme/tokens.ts`/`neon.ts` |
| **E7 Engajamento e retenção** (`engajamento-retencao`) | Missões, sequência, baú diário, níveis, temporada, notificações, FTUE | `src/features/engagement/**` (novo), `src/features/notifications/**`, rotas novas de missões/recompensas |
| **E8 Social e compartilhamento** (`social-compartilhamento`) | Card do Instagram, aplausos/feed, convites, paridade com o Strava | `src/features/social/**` (novo), rotas novas de compartilhar/feed |
| **E9 Backend do jogo** (`backend-jogo`) | Supabase para tudo o que é novo | `supabase/**`, `docs/API_CONTRATO.md`, `supabase/DEPLOY.md` |
| **E10 Qualidade e plataforma** (`qa-experiencia`) | Testes, acessibilidade, desempenho, capturas, usabilidade, modo demonstração, CI | `apps/mobile/src/__tests__/**` (testes transversais), `apps/mobile/e2e-web/**`, `apps/mobile/src/services/api/demo/**` (novo), `apps/mobile/src/demo/**`, `.github/workflows/**`, `docs/QA.md`; na F5, testes em qualquer pasta (avisando o dono) |
| **Revisor** (`revisor-nomaderun`, já existe) | Revisão independente ao fim de cada onda | `docs/REVISAO.md` |

Arquivos compartilhados (`package.json`, `app.json`, `src/app/_layout.tsx`, `src/theme/tokens.ts`): o coordenador decide quem mexe em cada onda; nunca duas equipes ao mesmo tempo.

---

## 19. Protocolo de trabalho

1. **Base:** branch `claude/affectionate-gauss-e8gm77` (já contém a `main` do GitHub). Autor dos commits: Gabryel Gomes (configurado no repositório).
2. **F1 (descoberta):** cada equipe só **lê** o código e escreve **o próprio relatório** em `docs/melhoria/F1/NN-<frente>.md` (+ protótipos na subpasta da frente). Nada de alterar código de produção na F1. Os relatórios são:
   - `01-pesquisa.md` (E1), `02-skills-e-mcps.md` (E2), `03-jogo-e-territorio.md` (E3), `04-direcao-de-arte.md` (E4), `05-motion-e-feedback.md` (E5);
   - `06-ux.md` (E6), `07-engajamento.md` (E7), `08-social.md` (E8), `09-backend.md` (E9), `10-qualidade.md` (E10).
3. **F3/F4 (implementação):** cada equipe trabalha numa **worktree isolada**, dentro das suas pastas.
   - **Preparar a worktree:** ligar `apps/mobile/node_modules` com `ln -s /home/user/nomaderun/apps/mobile/node_modules apps/mobile/node_modules`.
   - **Antes de cada commit, rodar em `apps/mobile`:** `npm run typecheck`, `./node_modules/.bin/eslint src`, `npx jest`. Nas functions, `npx -y deno test --allow-read --config supabase/functions/deno.json supabase/functions/tests`.
   - **Fazer commits pequenos e claros** e devolver ao coordenador: branch, commits, arquivos, testes e pendências.
4. **Relatório por equipe e fase:** `docs/melhoria/relatorios/<frente>-<fase>.md` com:
   - o que foi feito;
   - antes/depois (capturas PNG quando houver tela);
   - testes com resultado;
   - decisões, pendências e riscos.
5. **Integração (coordenador):**
   - fazer o merge de cada branch, resolver conflitos e rodar tudo;
   - atualizar `docs/PROGRESSO.md`, `docs/DECISOES_TECNICAS.md` e `docs/REQUISITOS.md`;
   - fazer commit e push.
6. **Capturas:** Playwright (Chromium já instalado; `NODE_PATH=/opt/node22/lib/node_modules`) sobre o export web (`npx expo export -p web`) usando o **modo demonstração** (X3) para chegar a todas as telas sem servidor.
7. **Ambiente:**
   - **Sem daemon do Docker:** e2e só na máquina da equipe; pgTAP aqui só se a prova do banco local da E9 der certo.
   - **Deno:** via `npx -y deno`.
   - **Rede:** skills.sh bloqueado; GitHub, npm e PyPI liberados.
   - **Documentação da Expo:** conferir com WebFetch/WebSearch.

---

## 20. Critérios de aceite globais

- [ ] **Texto:** nenhuma tela de aba com parágrafo; título ≤ 30 caracteres; blocos com ≤ 1 frase; redução medida de palavras por tela (antes/depois no relatório de UX).
- [ ] **Imagem:** todas as abas com herói visual; estados vazios ilustrados.
- [ ] **Times:** escolha na primeira abertura com mascotes animados, líder, biografia e confirmação épica; página do time; "Meu time" no perfil.
- [ ] **Chefões:** 5 chefões ilustrados e animados; raid real no servidor (ou atrás de flag com demonstração rotulada, se o servidor não ficar pronto).
- [ ] **Território:** regra nova em 1 frase, pintura ao vivo, simulação documentada, testes de propriedade.
- [ ] **Modos:** todos revisados, sem bug conhecido de prioridade alta.
- [ ] **Motion:** catálogo da seção 11 implementado; "Reduzir movimento" respeitado.
- [ ] **Engajamento:** missões diárias/semanais, baú do dia, sequência semanal com congelamento, recap semanal, níveis com títulos.
- [ ] **Social:** card de Stories e feed funcionando, com respeito às zonas de privacidade; aplausos na crew.
- [ ] **Acessibilidade:** contraste ≥ 4,5:1 em textos (inclusive botões laranja), alvos ≥ 44 pt, leitor de tela, `testID` em tudo.
- [ ] **Desempenho:** sem animação na thread de JS durante a corrida; listas virtualizadas.
- [ ] **Qualidade:** `typecheck` 0, eslint 0, `npm test` verde (com testes novos), testes Deno verdes; cobertura do domain ≥ 90%.
- [ ] **Teste de 5 segundos** documentado para as telas principais.
- [ ] **Docs:** `PROGRESSO`, `REQUISITOS`, `DECISOES_TECNICAS`, `API_CONTRATO`, `COMO_APRESENTAR`, README e a proposta de ERS v1.2 atualizados.

---

## 21. Entregáveis finais

1. App reformulado na branch, enviado ao GitHub, com todos os testes verdes.
2. `docs/melhoria/` completo: prompt, relatórios F1, plano mestre, relatórios por equipe, antes/depois.
3. Board no **Whimsical** com fluxos e wireframes da reformulação (se o conector funcionar).
4. Modo demonstração e (opcional, com ok do dono) prévia web na Vercel.
5. Apresentação atualizada (slides com telas novas e números reais).
6. Resumo para o dono: o que mudou, como testar, o que depende dele (deploy do backend, conectores).

---

## 22. Riscos e como evitar

| Risco | Como evitar |
|---|---|
| Arte gerada ficar amadora | Estilo geométrico/line-art; render em PNG e revisão antes de integrar; iterar |
| Conflitos de merge entre equipes | Worktrees isoladas; donos de pastas; ondas; coordenador serializa arquivos compartilhados |
| Quebrar o app publicado | Compatibilidade app ↔ servidor; deploy do backend antes do app; flags para features que dependem do servidor novo |
| Biblioteca nativa fora do Expo Go | Confirmar na documentação do SDK 57 antes de instalar |
| Desempenho ruim no Android | Só transform/opacidade; Skia ou pré-desfoque para brilhos; medir |
| Mudança de regra virar injustiça | Simulação com perfis de corredor; testes de propriedade; teto e decaimento |
| Gamificação manipuladora | Limites éticos (5.4) revisados pelo QA |
| ERS divergir | Proposta de ERS v1.2 em `docs/ERS-ALTERACOES-PROPOSTAS.md` |

---

## Apêndice A — Pedido original do dono (íntegra, só com ortografia ajustada)

> O aplicativo melhorou muito, porém estou achando que está tendo muito texto, tipo nas abas, tirando o mapa, só tem texto, não tem imagem. Os BOSS de equipe que tem que matar não têm animações, algo do tipo desenhos. O aplicativo tem que passar por uma reformulação em como ganha as áreas. Em todos os modos tem que ser analisados e vistos se estão funcionando bem, de forma correta e de forma bonita, que venha a trazer dopamina para as pessoas e vontade de usar o aplicativo. Preciso que planeje, use todo seu potencial, pesquise skills — você tem total liberdade para pesquisar skills para melhorias — onde melhorem o design para trazer um layout que traga vontade de ficar vendo, gere dopamina nas pessoas; use táticas de dopamina para fazer o cérebro querer jogar. Você tem acesso ao GitHub, Vercel, https://www.skills.sh/, https://www.skills.sh/vercel-labs/skills/find-skills, https://motion.dev/. Pesquise: tem skills de Find Skills; pesquise também MCPs que possam conectar e ajudar a desenvolver isso.
>
> Distribua em equipes que possam ajudar em cada frente. Use todo seu potencial para melhorar e deixar esse aplicativo já extremamente pronto, de forma bonita visualmente, que todas as telas façam sentido e sejam de fácil interpretação, porque se o aplicativo for difícil de ser usado e entendido não adianta nada: a pessoa não vai querer usar de novo. Pesquise táticas que prendem pessoas nas telas. Os modos de jogos precisam ser aperfeiçoados e ficar mais atrativos e bonitos. As equipes do jogo estão meio estranhas, tipo sem vontade. A primeira vez que a pessoa abre o app e escolhe a conta, ela tem que escolher a equipe; cada equipe tem que ter uma biografia, um desenho ou animação, algo que traga um design bonito para o aplicativo. Passar tela por tela para analisar e planejar melhorias e trazer essas melhorias. Existem vários exemplos, como o Pokémon GO: o layout é bonito e, quando abre o jogo, ele traz a equipe para escolher. No nosso aplicativo temos que pensar como o usuário vai abrir o app e como fazer para ele voltar a utilizar. Pesquisar sobre a dopamina que o cérebro gosta, como o estilo dessas pessoas que usam esse tipo de aplicativo gosta. Pesquisar sobre o Strava, trazer também as comunidades de compartilhar a corrida que fez, compartilhar no Instagram. Analisar o Strava também para melhorar nosso aplicativo.
>
> Na equipe pode usar o Coordenador de tudo, que planeje, como Claude Opus 5.5 Max, que ele vai coordenar tudo, mas os funcionários vão ser Opus 5.5 no Alto. Com todas essas informações, criar um prompt extremamente mais detalhado que o meu, com tudo para melhorar, contendo tudo que eu disse e até mais, para iniciarmos uma melhoria colossal no aplicativo. Depois de criar o prompt, autoexecute ele no coordenador e desenhe agentes extremamente completos para cada frente que possa ajudar e melhorar esse aplicativo.
