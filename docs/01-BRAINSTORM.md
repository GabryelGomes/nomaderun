# NOMADE RUN — Brainstorm de Funcionalidades e Visual

> **Conceito em uma frase:** um app de corrida de verdade (na rua, com GPS) que faz tudo o que o Strava faz (registrar corrida, pace, distância, histórico, social) **+ um "joguinho" de conquista de território no mapa real**. Quem corre numa área ganha influência sobre ela; quem tem mais influência é o dono — e os outros vão tentar tomar. Funciona **em qualquer cidade** e dá para competir **entre cidades**.

---

## 1. Núcleo "Strava" (o básico tem que ser impecável)

| # | Funcionalidade | Detalhe |
|---|---|---|
| 1 | Gravar atividade | GPS em tempo real, play/pause/stop, auto-pause quando parado, funciona com tela bloqueada (background location). |
| 2 | Métricas ao vivo | Distância, tempo, pace atual, pace médio, splits por km, ritmo cardíaco (opcional via relógio/BLE), elevação. |
| 3 | Resumo pós-corrida | Mapa do trajeto, gráfico de pace por km, splits, recordes pessoais (PR) batidos, **territórios afetados**. |
| 4 | Histórico e estatísticas | Semana/mês/ano, total de km, gráficos, calendário de sequência (streak). |
| 5 | Feed social | Seguir amigos, curtir ("kudos" → aqui **"Respect"**), comentar, ver corridas da Crew. |
| 6 | Segmentos | Trechos famosos da cidade com ranking (ex.: "Subida da T-63"). |
| 7 | Modo offline | Grava sem internet e sincroniza depois. |
| 8 | Zonas de privacidade | Esconde o início/fim da corrida perto de casa (raio configurável). |

---

## 2. O Jogo: Controle de Território (o diferencial)

### 2.1 O mapa dividido em hexágonos
- A cidade é coberta por uma grade de **hexágonos H3** (sistema da Uber, padrão de mercado).
  - **Zona** (H3 resolução 9): ~0,1 km², lado ≈ 200 m — é a unidade que se conquista.
  - **Distrito** (H3 resolução 7): ~5 km², agrupa ~49 zonas — quem domina mais zonas de um distrito vira **"Prefeito"** dele.
- Áreas impossíveis/perigosas (rodovias, lagos, aeroportos) são **zonas bloqueadas** e não pontuam.

### 2.2 Run Points (RP) e Influência
- Cada metro corrido **dentro** de um hexágono gera Run Points para você e para a sua facção naquele hexágono.
- Fórmula base (detalhada nas Regras de Negócio):
  `RP = metros_no_hex × 0,1 × multiplicador_de_pace × bônus_de_streak × multiplicador_fantasma`
- Influência **decai 10% por dia** sem ninguém correr ali → território abandonado volta a ficar neutro. Isso obriga a "patrulhar".
- **Teto diário** por usuário por hexágono (ex.: 300 RP/dia) → impede alguém de ficar dando voltas no quarteirão o dia inteiro.

### 2.3 Conquista, Ataque e Defesa
- **Neutro → Dominado:** a primeira facção a passar de 100 de influência vira dona.
- **Tomada:** o desafiante precisa superar o dono em **+10%** (histerese — evita a zona trocar de dono a cada 5 minutos).
- **Alerta de Invasão:** quando uma facção inimiga atinge 50% da influência do dono, os donos recebem push:
  > ⚠️ **Alerta de Invasão!** Seu território no *Parque Flamboyant* está sendo conquistado pelos *Urban Coyotes*. Você tem 24h para defender.
- **Janela de defesa (24h):** quem defende nesse período ganha **RP em dobro** naquele hex.
- **Fortificação:** correr na mesma zona em dias seguidos sobe o nível de escudo (Nível 1–3), que reduz o RP inimigo recebido ali em 10/20/30%.

### 2.4 Facções e Crews
- **4 Facções globais** (escolha no cadastro; troca permitida 1x por temporada):
  | Facção | Cor neon | Personalidade |
  |---|---|---|
  | **Neon Striders** | Ciano `#00F0FF` | Velocidade, precisão |
  | **Urban Coyotes** | Laranja `#FF6B1A` | Matilha, corridas em grupo |
  | **Night Owls** | Roxo `#B026FF` | Corredores noturnos |
  | **Volt Runners** | Verde-limão `#C6FF00` | Resistência, longas distâncias |
- **Crews** (guildas locais, até 30 pessoas) dentro de uma facção, com chat, metas semanais e ranking de Crew.
- **Corrida em grupo:** 3+ membros da mesma Crew correndo juntos (a até 50 m um do outro) ganham **+25% de RP** ("Formação de Matilha").

### 2.5 Modo Fantasma (Ghost Run)
- Ao entrar numa zona dominada, você pode desafiar o **fantasma** do melhor tempo do dono naquele trecho.
- O fantasma aparece no mapa como um avatar translúcido correndo em tempo real.
- Vencer o fantasma = **multiplicador ×1,5** no RP daquela zona. Perder = RP normal (nunca pune).

### 2.6 Várias cidades e Cidade × Cidade
- A grade de hexágonos cobre **o mundo inteiro**: o jogo funciona em qualquer cidade, sem cadastro prévio. Viajou? Corre e conquista zonas lá também.
- Cada corredor escolhe uma **cidade natal**. Os pontos que ele ganha **em qualquer lugar** somam para ela no placar **Cidade × Cidade** (ex.: "Goiânia × Brasília").
- Para cidades pequenas competirem com capitais, o placar divide os pontos pela **raiz quadrada do número de corredores ativos**.
- Rankings por **bairro/distrito, cidade, estado, país e global**.
- Badge **"Nômade"** (correr em 1, 5 e 10 cidades diferentes) — combina com o nome do app — e mapa-múndi pessoal das cidades conquistadas.
- A cidade campeã da temporada ganha a badge coletiva **"Capital Nômade"**.

### 2.7 Temporadas, missões e progressão
- **Temporada mensal**: o mapa reseta parcialmente (influência cai 70%), com ranking final e recompensas cosméticas.
- **Missões diárias/semanais**: "Conquiste 3 zonas novas", "Defenda um território sob ataque", "Corra 5 km antes das 7h".
- **Níveis de corredor (XP)** e **Badges**: "Prefeito do Setor Bueno", "Explorador (100 zonas visitadas)", "Muralha (defendeu 10 ataques)".
- **Energy Cells (drops no mapa):** pontos aparecem em zonas pouco exploradas; passar por eles dá bônus de RP → incentiva conhecer a cidade.
- **Eventos "Raid"** no fim de semana: uma zona famosa vira "Zona Chefe" com RP ×3 por 48h — todas as facções disputam.

---

## 3. Experiência Visual e UI/UX

### 3.1 Identidade "Cyberpunk Neon"
- **Dark mode por padrão** (fundo `#0A0B10`, superfícies `#12141C`) — economiza bateria em OLED e faz o neon "brilhar".
- Tipografia: **Orbitron / Space Grotesk** em títulos, **Inter** no texto, **JetBrains Mono** nos números (pace, tempo).
- Cores de estado: perigo/ataque `#FF2E63`, sucesso `#00FF9C`, alerta `#FFD600`.

### 3.2 O mapa
- Mapa escuro customizado (estilo Mapbox próprio), ruas em cinza-azulado, rótulos discretos.
- **Hexágonos 3D** (fill-extrusion): a altura do prisma = influência. A cidade vira um "skyline" de território.
- Cor do hex = cor da facção dona, com **glow** (borda brilhante + leve desfoque).
- **Zonas em disputa pulsam** em vermelho/da cor do atacante, com efeito de "fumaça"/partículas.
- **Heatmap de batalha** (camada opcional): mostra onde houve mais corridas nas últimas 24h.
- Seu trajeto ao vivo é uma linha neon com "rastro" que esmaece (efeito cometa).

### 3.3 Feedback e microinterações
- **Conquista de zona:** o hex "acende" em onda, explosão de partículas na cor da facção, vibração (haptic), som curto e um toast: *"ZONA CONQUISTADA · Praça Tamandaré +142 RP"*.
- **Entrar em território inimigo:** borda da tela fica avermelhada + aviso por voz no fone ("Você entrou em território dos Coyotes").
- **Contadores animados** (números "rolando") no resumo da corrida.
- **Recap compartilhável:** animação de 10s do trajeto pintando os hexágonos, pronta para Instagram Stories.
- Respeitar **"Reduzir movimento"** do sistema (acessibilidade): sem pulsos/partículas quando ativo.

### 3.4 Perfil
- Avatar com cosméticos desbloqueáveis (molduras, rastros de cor, efeitos de conquista).
- Vitrine de badges, zonas dominadas, mapa pessoal de "onde já corri".

---

## 4. Restrições e Segurança (o que mais rende nos Testes de Software)

### 4.1 Anti-Cheat
| Fraude | Como detectar |
|---|---|
| Andar de bicicleta/carro/moto | Velocidade média > 25 km/h por mais de 30 s invalida o trecho; picos > 40 km/h invalidam na hora. |
| GPS falso (mock/spoofing) | Flag `isMocked` (Android), saltos > 50 m em 1 s ("teletransporte"), precisão > 30 m descartada. |
| Correr de mentira (celular no carro) | Cruzar **pedômetro/acelerômetro**: correndo a 8–20 km/h, a cadência deve estar entre 120 e 220 passos/min. Sem passos = trecho inválido. |
| Replay/edição de arquivo | Pontos assinados (HMAC) pelo app, carimbo de tempo monotônico, validação 100% refeita no servidor. |
| Farm de pontos | Teto diário de RP por hex, limite de atividades por dia, ranking ignora contas com Trust Score baixo. |

- **Trust Score** (0–100) por usuário: cai a cada atividade suspeita; abaixo de 40 as corridas vão para revisão manual e não pontuam.

### 4.2 Segurança do corredor
- Zonas de privacidade (casa/trabalho escondidas).
- Aviso de segurança em corridas noturnas e botão **"Compartilhar localização ao vivo"** com contato de confiança.
- O jogo **nunca** coloca objetivo em rodovia, área privada ou área de risco.
- Não é app médico: nada de diagnóstico, só métricas esportivas.

---

## 5. Ideias extras (para versões futuras — bom citar como "fora do escopo da v1.0")
- Integração com Apple Watch / Wear OS / Garmin e importação do Strava.
- Modo **Caminhada** e modo **Cadeira de Rodas** com ligas separadas (inclusão + justiça).
- Marketplace de cosméticos e assinatura "Nomade Pro" (estatísticas avançadas, sem anúncios).
- Parcerias com marcas/lojas: zona patrocinada dá cupom a quem domina.
