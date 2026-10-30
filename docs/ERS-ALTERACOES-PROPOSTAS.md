# Proposta de revisão do ERS — v1.0 → v1.1 → v1.2

> Para os autores atualizarem o documento oficial (`docs/ERS/ERS-NOMADE-RUN.md`, que gera o PDF e o DOCX). Resolve a pendência P-02.
> **Parte 1 (v1.1):** diferenças entre o ERS v1.0 e o MVP. **Parte 2 (v1.2, no fim):** mudanças de requisito trazidas pela segunda versão do jogo. Quem for aplicar as duas de uma vez pode pular direto para a v1.2: onde as duas tratam do mesmo item, vale a v1.2.
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

---

# Parte 2 — ERS v1.1 → v1.2 (segunda versão do jogo)

> A segunda versão mudou regras do jogo, não só a tela. Cada item diz o que o ERS diz hoje, o que passa a valer e por quê, com a decisão técnica (D-xx) que tem o detalhe. Status de cada requisito: `docs/REQUISITOS.md`.
> No servidor, as partes novas ligam por configuração, uma por vez, e começam desligadas. O ERS pode descrever a regra nova como a regra do sistema; a virada é um detalhe de implantação.

## 7. Território por pintura (RN-002, RN-004, RN-005, RF-007, RF-008, Glossário)

| Item | ERS hoje | v1.2 | Justificativa |
|---|---|---|---|
| **RN-002** Conquista | Zona neutra com influência ≥ 30; zona com dono muda com 110% da influência do dono | **"Corra pelas ruas para pintá-las com a cor do seu time; a zona fica com o time que pintou mais ruas nela."** Cada trecho de rua (~40 m) guarda até 3 camadas de tinta de um time; passar no trecho pinta ou reforça uma camada do seu time; cada passada de um rival tira 1 camada. A zona fica com o time que tem mais trechos pintados nela, com mínimo de 3 trechos; empate mantém o dono. Zonas bloqueadas nunca têm dono (D-62) | Na simulação com 271 zonas e 115 corredores por 8 semanas, o iniciante que conquista na 1ª corrida passa de 13% para 62%, o que nunca conquista cai de 32% para 0%, e as zonas com o mesmo dono o tempo todo caem de 38% para 11% |
| **RN-004** Escudo | Escudo por dias seguidos de 500 m | Sai da regra. A defesa é repintar os trechos da zona | A pintura já premia quem volta à zona; o escudo deixava a zona "eterna" |
| **RN-005** Redução diária | Influência × 0,90 todo dia às 03:00 | **Desbotamento:** às 03:00, cada trecho sem passada do time dono há 7 dias perde 1 camada; o dono da zona é reavaliado | Mesma função (território abandonado volta a ser disputado), sem apagar a corrida de ontem |
| **RN-006** Temporadas | Influência × 0,30 no encerramento | A troca de regra e a herança acontecem na virada da temporada: cada zona com dono começa com 3 trechos virtuais do dono por 7 dias | Ninguém perde a zona no dia da troca |
| **RF-007** Mapa | Zonas com a cor do dono | Igual, e o mapa público mostra **só as zonas**. A rua pintada aparece só na corrida da própria pessoa, como o rastro na cor do time | Mostrar as ruas de todos revelaria rotinas e endereços |
| **Glossário** | Run Points (RP), Neblina, influência | "Pontos" (antigo RP), "Atlas" (antiga Neblina), "domínio" (antiga influência), "% da cidade" (antigas células); "missão" é tarefa, "modo" é jogo (D-74) | Termos que a pessoa entende sem explicação |

## 8. Pontos, sequência e progressão (RN-001, RN-014, RF-016)

| Item | ERS hoje | v1.2 | Justificativa |
|---|---|---|---|
| **RN-001** Pontos | Multiplicador M_sequência (até 1,50) | Sai o **M_sequência**. Os pontos continuam por esforço relativo e servem a rankings, Liga e Cidade × Cidade (D-63) | A sequência virava uma vantagem permanente de +50% sobre quem está começando |
| **RN-014** Sequência semanal | 2 corridas válidas; 1 congelamento por mês | **2 atividades por semana, e caminhada vale.** O congelamento (1 por mês) é usado sozinho na semana em que faltar. Nova **pausa de saúde:** de 1 a 4 semanas, 1 vez por temporada, sem perder a sequência (D-63) | Não punir descanso, lesão nem doença |
| **RF-016** Missões | Missões diárias e semanais (sem detalhe) | **3 missões diárias e 3 semanais**, sempre uma leve, com troca de 1 por dia; **primeira semana** com 7 passos sem prazo; recompensa paga uma única vez, conferida no servidor (D-65) | Dá um próximo passo claro sem prazo que pressione o iniciante |
| **RF-016** Níveis e medalhas | Medalhas por conquistas | **Níveis** com curva de XP e 8 títulos; XP nunca diminui; faixas de corredor por distância acumulada (Asfalto a Nômade), nunca por cor; 12 medalhas; trilha mensal da temporada (D-64) | Progresso visível para quem corre pouco e para quem corre muito |
| **RF-016** Baú do dia (novo) | — | Um crédito por dia, que acumula até 3, aberto por qualquer atividade de 1 km ou mais; **as chances aparecem na tela**; o baú garante um lendário depois de uma sequência sem nenhum; dá só XP e itens visuais e **nunca é vendido** (D-66) | Recompensa com transparência, sem compra e sem aposta, em linha com o ECA Digital |

## 9. Raid e Liga (RF-026, RN-018, RF-027, RN-015)

| Item | ERS hoje | v1.2 | Justificativa |
|---|---|---|---|
| **RN-018 / RF-026** Raid | 48 h; vida = 1 km × 30% dos ativos; 1 km = 1 de dano | **Semanal**, de segunda 06:00 a domingo 21:00. Vida proporcional ao volume de corrida da cidade nas últimas semanas; 3 fases (100%, 67%, 33%), com pontos fracos no mapa a partir da 2ª; **10 de dano por km**, crítico de 10% com a chance na tela; teto de 21 km por corrida e 30 km por dia; recompensa só visual para quem participou; a tela mostra a "Sua parte" e o dano da cidade desde a última visita (D-67). O chefão de fumaça não aparece em agosto e setembro (D-84) | 48 h deixava de fora quem corre 2 ou 3 vezes por semana. O teto evita que uma pessoa sozinha derrote o chefão. A regra da fumaça evita incentivar correr na época das queimadas |
| **RN-015 / RF-027** Liga | Grupos de 30; 5 sobem, 5 descem | Grupos de **até 30** da mesma divisão, com volume parecido; até 5 sobem e 5 descem num grupo de 30 (1 a cada 6); **grupo pequeno** (menos de 6): só o 1º sobe, se pontuou, e ninguém desce. A semana fecha na segunda às 03:20 (D-68) | A regra antiga não funcionava com poucos corredores |

## 10. Social e compartilhamento (RF-014, RF-017, RF-011, RN-010)

| Item | ERS hoje | v1.2 | Justificativa |
|---|---|---|---|
| **RF-014** Feed | Seguir corredores, ver corridas de quem segue e da Crew, curtir e comentar | **Feed só da Crew**, com reações prontas (Bora!, fogo, raio), **sem comentários**, até 200 reações por dia. A pessoa escolhe não publicar as corridas ou esconder o mapa. A rota no feed já sai cortada (item RN-010). **[escopo]** seguir pessoas fora da Crew (D-79) | Comentário livre exige moderação de texto, que o projeto não tem |
| **RF-017** Compartilhar | Imagem com o mapa do percurso e as zonas | Igual, com 5 modelos, versão sem rota e adesivo de fundo transparente, para Stories e feed; e um card **"Minha semana"**, com os km por dia e até 3 rotas (D-78) | Divulgação do app pelos próprios corredores |
| **RF-011** Crews | Convite por link ou código | O convite por link existe. **[escopo]** meta de km da crew, membros correndo agora e aprovação de entrada pelo líder | Registro do que ficou para depois |
| **RN-010** Zona de privacidade | Pontos dentro do raio nunca aparecem no feed, perfil, compartilhamento ou painel | Igual, e com dois reforços: (1) **card, feed e "Minha semana"** cortam 150 a 250 m do começo e do fim da rota e uma folga sorteada em volta de cada zona, sem horário; se mais de 60% da rota for cortada, o card sai sem rota (D-78); (2) **no mapa da pintura e no painel de moderação**, cada zona é escondida por uma **máscara** maior e deslocada, sorteada uma vez por zona, para que o centro (a casa) não possa ser achado pelo formato do buraco (D-87). Criar ou mover uma zona tira na hora as rotas já publicadas | Um círculo exato em volta da casa entrega o endereço com poucos metros de erro (ataque descrito por Hassan et al., USENIX Security 2018) |

## 11. Notificações, privacidade e primeira abertura (RF-019, RNF-013, RF-003, RNF-010, RNF-011, novos)

| Item | ERS hoje | v1.2 | Justificativa |
|---|---|---|---|
| **RF-019** Notificações (limites, novo critério) | — | Lembretes **só locais**, no máximo **1 por dia e 4 por semana**, das 8h às 21h, nunca no dia em que a pessoa já correu; volta em 7, 14, 21 e 30 dias sem atividade e depois silêncio; nenhum texto de culpa; avisos de invasão e conquista entre 22h e 7h ficam só na central; reações agrupadas em 1 aviso por dia (D-69) | Engajamento sem abuso de atenção |
| **RNF-013** Telemetria (novo critério) | — | **Telemetria opcional**, desligada por padrão e ligada só pela pessoa em Ajustes: 5 eventos fechados (abrir o app, correr, conquistar, compartilhar, concluir missão) com o dia, sem horário, sem localização e sem texto livre; até 200 por dia; apagados em 30 dias; desligar apaga tudo na hora; entra na exportação e na exclusão da conta (D-82) | Medir retenção (1, 7 e 30 dias) respeitando a LGPD |
| **RF-003** Escolha de facção | Escolha no primeiro acesso | Primeira abertura: "a cidade está dividida" → escolha entre os 4 times, cada um com **mascote e líder** (Lume, Faísca, Breu e Faro; Íris Valente, Téo Faria, Nara Lis e Bento Rocha — nomes provisórios), e um quiz para quem não sabe escolher → confirmação. A permissão de notificação é pedida depois da 1ª conquista (D-70, D-72) | Escolher time vira um momento, não um formulário |
| **RNF-010** Navegação | Iniciar corrida em 2 toques | Cinco abas: Mapa, Arena, Correr, Clube e Você; **Correr no centro, a 1 toque de qualquer aba** (D-73) | — |
| **§6.2** Identidade visual | "Asfalto & Giz" (v1.1 propõe "Pista") | **"Pit Lane Neon"**, sempre escuro: fundo `#070708`, superfícies `#111215`, texto `#F3F1ED`, ação laranja `#FF6A13` com **texto escuro sobre o laranja** (7:1); cores dos times seguras para daltônicos, com formas; violeta só para os chefões (D-59, D-61, D-67, D-75). Substitui o item 1 da Parte 1 | Visual aprovado pelos autores |
| **RNF-011** Texto e acessibilidade (novo critério) | — | Títulos até 30 caracteres; média de até 40 palavras por tela de jogo; contraste AA medido no texto renderizado; "Reduzir movimento" troca animações por esmaecimento de 150 ms (D-71, D-74, D-75) | Menos texto e mais imagem, sem perder acessibilidade |
| **Modo demonstração** (novo RNF sugerido) | — | O aplicativo deve ter um modo demonstração que funciona sem servidor e sem rede, com dados de exemplo identificados em toda tela e em toda imagem exportada; a simulação de corrida existe só nesse modo, e a conta real usa o GPS (D-76, D-77) | Apresentar sem depender de rede e nunca mostrar dado falso numa conta real |
| **RNF-008** Análise estática | Análise automática a cada alteração | Atendido por integração contínua no GitHub: tipos, lint, testes, cobertura das regras, contraste e tamanho do app web a cada envio (D-81) | — |

## 12. Escopo da v1.2 (substitui o item 5 da Parte 1)

- **Não entregues:** RF-013 Mapa de calor (e o UC-03 na forma descrita), RN-012 Prefeito.
- **Parciais:** RF-004 (tela bloqueada só em development build), RF-006 (sem parciais por km e gráfico de ritmo na tela; os recordes pessoais existem), RF-011 (sem meta de km, presença e aprovação pelo líder), RF-012 e RN-019 (fantasma só com ritmo escolhido), RF-014 (só a Crew, sem comentários), RF-015 (sem estado e país), RF-020 (sem cidades no perfil e medalha "Nômade"), RF-024 (Escolta sem acompanhamento contínuo), RN-006 (sem arquivar rankings e medalhas de pódio), RN-008 (sem acelerômetro).
- **Não medidos:** RNF-001 (carga), RNF-002 (mapa em aparelho), RNF-004 (bateria), partes do RNF-005 (3 h em aparelho, disponibilidade, erro de distância).

## 13. Controle de revisões (§7)

Sugestão de linha: "**1.2** — 2026-10 — Território por pintura de ruas (RN-002, RN-004, RN-005), pontos sem multiplicador de sequência (RN-001), sequência semanal com pausa de saúde (RN-014), missões, níveis e baú do dia (RF-016), Raid semanal (RF-026, RN-018), Liga com regra para grupo pequeno (RF-027, RN-015), feed da Crew e compartilhamento com corte de privacidade (RF-014, RF-017, RN-010), limites de notificação (RF-019), telemetria opcional (RNF-013), primeira abertura com mascotes e líderes (RF-003), identidade Pit Lane Neon (§6.2) e modo demonstração. Autores: Gabryel Gomes Bahmad Camapum e Mateus Augusto De Faria Brito."

Os nomes dos mascotes e líderes ainda dependem da aprovação dos autores; trocar o nome não muda a arte.
