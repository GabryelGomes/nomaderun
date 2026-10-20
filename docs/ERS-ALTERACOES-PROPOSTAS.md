# Proposta de revisão do ERS — v1.0 → v1.1

> Para os autores atualizarem o documento oficial (`docs/ERS/ERS-NOMADE-RUN.md`, que gera o PDF e o DOCX). Resolve a pendência P-02.
> Cada item diz o que o ERS v1.0 diz, o que foi implementado ou decidido no MVP e por quê. A decisão técnica correspondente está em `docs/DECISOES_TECNICAS.md`.
> Itens marcados **[texto]** só pedem trocar a redação. Itens marcados **[escopo]** registram que o MVP entrega menos que o ERS; a sugestão é manter o requisito e anotar "fora da primeira versão" na seção 1.2 (Escopo) ou no controle de revisões (§7), em vez de apagar.

## 1. Identidade visual (§6.2) — principal mudança

| Tema | ERS v1.0 | Implementado (D-15) | Justificativa |
|---|---|---|---|
| Nome | "Asfalto & Giz" | **"Pista"** | Visual aprovado pelos autores no protótipo; segue a linguagem dos apps de corrida (Strava, Nike Run Club) que o público já conhece |
| Cores da interface | Asfalto `#252A31`, Concreto `#E8EBEE`, Giz `#FFFFFF`, Sinalização `#FFD23F` (ação), Meio-fio `#6B7380`, Alerta `#C62828` | Tinta `#242428`, fundo `#F7F6F3`, superfície `#FFFFFF`, **laranja `#FF5A1F`** (ação e percurso; `#C93F00` como texto), secundário `#5E5E66`, perigo `#D92D20`, aviso `#E8A317`; tema escuro com fundo `#121214` | Um único acento quente para ação; o laranja de texto passa 4,5:1 sobre branco (RNF-011) |
| Cores dos times | Striders `#0072B2`, Coyotes `#D55E00`, Owls `#CC79A7`, Volt `#009E73` | Striders `#0072B2`, Coyotes **`#D9B200`**, Owls **`#C0559A`**, Volt `#009E73` | Coyotes em amarelo para não competir com o laranja de ação; Owls um pouco mais escuro para contraste. Continua uma paleta segura para daltônicos (base Okabe-Ito) |
| Diferença por time além da cor | Hachura por facção (listras, pontos, ondas, xadrez) | **Forma por time** no selo e nos marcadores (círculo, triângulo, losango, quadrado) | Hachura em polígonos não é suportada de forma igual no `react-native-maps` e no MapLibre; a forma cumpre o mesmo papel para pessoas com daltonismo |
| Tipografia | Big Shoulders Display + Figtree | **Inter Tight** (números e títulos) + **Inter** (texto), algarismos de largura fixa | Fontes do visual aprovado; legíveis em tamanhos grandes na tela de corrida |
| Posição e percurso | Ponto amarelo com borda asfalto; percurso asfalto com contorno branco | Percurso **laranja com contorno branco**; trechos invalidados em cinza | Coerente com a cor de ação |
| Zona sob ataque | Contorno em faixa de sinalização (amarelo e asfalto) | Contorno **tracejado na cor do time atacante** | Mostra quem está atacando; mesmo recurso nos dois mapas |
| Faixa "Defendendo seu território" | Amarela | Amarela (`#E8A317`) com texto escuro (D-52) | Igual ao ERS — sem mudança, só registrar a cor |
| Botão pressionado | Escala 0,97 em 120 ms | Igual; com "Reduzir movimento", só opacidade 0,7 (D-52) | Igual ao ERS |
| "Zona conquistada" | Hexágono pintado por seis traços de giz | Mensagem "Zona conquistada, +RP em {zona}" com vibração; animação do visual aprovado | O mapa não mostra hexágonos (ver item 2) |

**Sugestão de texto para §6.2:** trocar o parágrafo "A identidade visual, chamada Asfalto & Giz…" por: "A identidade visual, chamada **Pista**, segue os aplicativos de corrida: fundo claro com neutros quentes, um único laranja (`#FF5A1F`) para ação e percurso, e números grandes em Inter Tight. A cor forte do jogo fica nos territórios, nas cores dos times, e cada time também tem uma forma (círculo, triângulo, losango, quadrado) para pessoas com daltonismo." E atualizar a linha **Cores** e a linha **Tipografia** da tabela com os valores acima.

## 2. Mapa e território (RF-007, §6.2, §6.3)

| Tema | ERS v1.0 | Implementado | Justificativa |
|---|---|---|---|
| **[texto]** Desenho das zonas | Hexágonos semitransparentes | **Regiões suavizadas** (zonas vizinhas do mesmo time viram uma região com cara de bairro); a grade H3 fica só nas regras | Hexágonos visíveis poluem o mapa e parecem um jogo de tabuleiro; as regiões preservam a leitura das ruas. A regra continua a mesma (H3) |
| **[texto]** SDK de mapas | Mapbox Maps SDK e Mapbox GL JS | **react-native-maps** (Apple Maps no iPhone, Google Maps no Android) e **MapLibre GL** com OpenFreeMap na web (D-09) | Roda no Expo Go sem token nem conta; o ERS já previa alternativa (§2.5). Mapbox fica como opção futura |
| **[texto]** H3 no banco | Extensão `h3-pg` | `h3-js` nas Edge Functions; o banco guarda o polígono em PostGIS (D-11) | Evita uma extensão que o Supabase não oferece em todos os planos |
| **[texto]** Cidade de cada zona | Malha municipal do IBGE / limites do OSM | Cidade e nome herdados da zona vizinha mais próxima; sem vizinha, a cidade natal de quem correu (D-43) | Sem importar bases geográficas no MVP |
| **[escopo]** Zonas bloqueadas | Rodovias, rios, lagos e aeroportos do OpenStreetMap | Campo `blocked` respeitado pelas regras e desenhado tracejado; sem importação automática do OSM | Importação fica para depois |

## 3. Arquitetura (§2.1, §6.3)

| Tema | ERS v1.0 | Implementado | Justificativa |
|---|---|---|---|
| **[texto]** Painel web administrativo | Terceiro componente | **O próprio app Expo rodando no navegador**, rota `/moderacao`, só para moderador e administrador (D-08, D-30) | Uma base de código a menos; reaproveita telas, mapa web e testes |
| **[texto]** API | `POST /ingest-points`, `POST /finish-activity`, `GET /zones?bbox=`, `GET /zone/{id}`, `POST /ghost/{id}/start` | Edge Functions `register-device`, `ingest-points`, `finish-activity`, `zones`, `zone?id=`, `moderate-activity`, `account-export`, `account-delete`; o fantasma vai junto da criação da corrida (`ghostPace`) | Contrato em `docs/API_CONTRATO.md` |
| **[texto]** Notificações | Push por FCM/APNs pela Expo Push API | Central de notificações no app com Supabase Realtime e notificação local com o app aberto; push remoto pronto para development build (D-13) | O Expo Go no Android não recebe push remoto desde o SDK 53 |
| **[texto]** Acelerômetro | Listado em §6.3 para RN-008 | Não usado no MVP (só o pedômetro) | Ver RN-008 abaixo |

## 4. Regras e requisitos com interpretação ou ajuste

| Item | ERS v1.0 | Implementado | Justificativa |
|---|---|---|---|
| **[texto]** RNF-007 — limite de login | 10 tentativas a cada 15 min por IP | **3 a cada 5 min por IP** (≈ 9 por 15 min), configurável no Supabase Auth (D-21) | O Supabase Auth só aceita janela de 5 min; é o valor mais próximo sem passar de 10/15. Sugestão de texto: "limite de tentativas de login por endereço IP (referência: 10 a cada 15 minutos)" |
| **[texto]** RNF-012 — painel web | Comparação de imagem do painel web | Comparação de imagem do export web do app (que é o painel) em zona neutra, dominada e sob ataque | Consequência do item 3; mapa de calor não foi feito |
| **[texto]** RF-024 — Escolta | Contatos acompanham a localização ao vivo | Ao ligar, a Escolta compartilha a localização atual uma vez (link do mapa); SOS e alerta de parada abrem o app de mensagens com a localização (D-36) | Envio silencioso exige provedor de SMS pago; rastreamento contínuo exige página pública com token (P-18). **[escopo]** |
| **[texto]** RF-004 — tela bloqueada | GPS inclusive com a tela bloqueada | Só em development build, com a flag `NOMADE_BACKGROUND_LOCATION=1`; no Expo Go a tela fica acesa durante a corrida (D-10, D-20) | Limitação do Expo Go |
| **[texto]** RF-001 — confirmação de e-mail | Não especificada | Desligada no MVP para a demonstração; recomendada em produção com SMTP próprio (D-21) | Demo sem depender de caixa de e-mail |
| **[texto]** RF-012 / RN-019 — ritmo do fantasma | Qualquer ritmo, ou de um amigo, ou do dono da zona | Ritmo escolhido entre 2:30 e 15:00 min/km, só na missão Fuga (D-50). Amigo e dono da zona: **[escopo]** | Fecha o achado de segurança QA-02 |
| **[texto]** RN-017 — local dos baús | Sempre em ruas e parques | Sorteados num raio de 3 km, fora de zonas bloqueadas (D-39) | Não há base de ruas no MVP |
| **[texto]** RN-009 — revisão | Índice abaixo de 40 → revisão | A corrida vai para revisão se o índice estiver abaixo de 40 antes **ou** depois dela; abaixo de 10 depois dela → suspensão (D-26) | Deixa explícito o caso de borda |
| **[texto]** Limites de uso (novo) | — | Até 14.400 pontos por corrida (4 h) e 3 corridas abertas por usuário em 24 h (D-50) | Proteção contra abuso (achado QA-08); sugerir como critério de RNF-006 ou RNF-009 |
| **[texto]** RNF-007 — conta inativada (novo) | "Administrador pode inativar contas" | A conta inativada perde o acesso na hora, inclusive com um token já emitido (D-50) | Achado QA-07 |
| **[texto]** RNF-007 — links de e-mail (novo) | — | Recuperação de senha por PKCE; o link só funciona no aparelho que pediu (D-51) | Achado QA-03 |
| **[texto]** RF-002 — exclusão | "Solicitar a exclusão da conta" | Exclusão imediata pelo app, pedindo a senha atual (D-50) | Reautenticação antes de ação destrutiva |

## 5. Escopo da primeira versão (sugestão para §1.2 ou §7)

Requisitos mantidos no ERS e entregues parcialmente ou não entregues no MVP (detalhes em `docs/REQUISITOS.md`):

- **Não entregues:** RF-013 Mapa de calor (e o UC-03 na forma descrita), RF-014 Feed social, RN-012 Prefeito, RN-018 Raid.
- **Parciais:** RF-003 (sem tela para trocar de facção depois do cadastro), RF-006 (sem parciais por km, gráfico de ritmo e recordes), RF-011 (sem convite por link, metas e presença), RF-015 (sem estado e país), RF-016 (só o ciclo de temporada), RF-017 (compartilha texto, não imagem), RF-020 (sem cidades no perfil e medalha "Nômade"), RF-026 e RF-027 (dados de demonstração), RN-006 (sem arquivar rankings e medalhas), RN-008 (sem acelerômetro), RN-015.
- **Não medidos:** RNF-001 (carga), RNF-002 (mapa em aparelho), RNF-004 (bateria), partes do RNF-005 (3 h em aparelho, disponibilidade, erro de distância).

## 6. Controle de revisões (§7)

Sugestão de linha: "**1.1** — 2026-10 — Atualização da identidade visual (Pista), mapas (react-native-maps/MapLibre), painel web no próprio aplicativo, limite de login aproximado e registro do escopo entregue na primeira versão. Autores: Gabryel Gomes Bahmad Camapum e Mateus Augusto De Faria Brito."

Depois de editar `docs/ERS/ERS-NOMADE-RUN.md`, troque também o rodapé "v1.0" na chamada do `pdf.js` dentro de `docs/ERS/build-src/build.sh` e regere o PDF e o DOCX com `./docs/ERS/build-src/build.sh` (precisa de pandoc e Playwright com Chromium). Confira também se as Figuras 2 e 3 (`assets-src/prototipos.html` e `assets/telas-reais.png`) ainda correspondem às telas atuais.
