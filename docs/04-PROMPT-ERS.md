# PROMPT — Gerar o ERS do NOMADE RUN (versão corrigida)

> O ERS **já está pronto** em `docs/ERS/` (PDF + DOCX editável). Este prompt fica como registro, ou para gerar outra versão em outra IA.
> Diferenças do rascunho original: nomes das skills corrigidos (os originais não existiam no skills.sh), autores preenchidos, competição entre cidades incluída e Maestro adicionado (o Playwright sozinho não testa app nativo).

===== COPIE A PARTIR DAQUI =====

Atue como Engenheiro de Requisitos Sênior, Arquiteto de Software e Game Designer. Redija a **Especificação de Requisitos de Software (ERS)** completa do aplicativo **NOMADE RUN**, no padrão IEEE 830 / ISO/IEC/IEEE 29148, em português do Brasil.

**CONTEXTO:** NOMADE RUN é um app de corrida de verdade (na rua, com GPS) com as funções do Strava (gravar corrida, pace, distância, splits, histórico, feed social) e, como diferencial, um jogo de conquista de território: o mapa é dividido em hexágonos H3 (zonas); quem corre numa zona gera Run Points para si e para a sua facção; a facção com mais influência domina a zona. Há ataque/defesa com push de "Alerta de Invasão", fortificação, Crews, Modo Fantasma, temporadas, badges e um anti-cheat rigoroso (velocidade, GPS falso, pedômetro/acelerômetro). Funciona em qualquer cidade, com rankings por cidade/estado/país/global e placar Cidade × Cidade. Visual dark mode neon.

**REGRA DE OURO (skills.sh):** baseie RNFs, regras de negócio e critérios de teste nestas skills reais do https://skills.sh e cite-as no documento:
1. Arquitetura: `pproenca/dot-skills` → `clean-architecture`.
2. Desempenho/carga: `davila7/claude-code-templates` → `k6-load-testing` e `grafana/skills` → `k6-perf-test-website` (foco na ingestão de GPS em tempo real: smoke, load, stress, spike, soak, com thresholds p95/p99).
3. Segurança/anti-cheat: `trailofbits/skills` → `insecure-defaults`, `sharp-edges`, `differential-review`, `static-analysis`; e `agamm/claude-code-owasp` → `owasp-security`.
4. Critérios visuais/E2E: `bobmatnyc/claude-mpm-skills` → `playwright` (painel web, comparação visual) e `tovimx/maestro-mobile-testing-skill` → `maestro-mobile-testing` (app mobile).
5. UI e mapa: `expo/skills` → `building-native-ui`; `anthropics/skills` → `frontend-design`; `mapbox/mapbox-agent-skills` → `mapbox-data-visualization-patterns`.

**CABEÇALHO:**
ESPECIFICAÇÃO DE REQUISITOS DE SOFTWARE (ERS)
Projeto: NOMADE RUN: Um Projeto de Gestão e Gamificação de Corridas Urbanas
Versão: 1.0 | Data: 10/10/2026
Autores: Gabryel Gomes Bahmad Camapum; Mateus Augusto De Faria Brito

**ESTRUTURA OBRIGATÓRIA:**
1. INTRODUÇÃO — 1.1 Finalidade; 1.2 Escopo (o que faz e o que NÃO faz — deixar claro que não é app médico); 1.3 Definições (GPS, Pace, Hexágono/Zona, Anti-Spoofing etc.); 1.4 Visão Geral.
2. DESCRIÇÃO GERAL — 2.1 Perspectiva; 2.2 Funções (destaque para a disputa de território); 2.3 Perfis de Usuário; 2.4 Restrições (hardware, precisão do GPS, bateria); 2.5 Suposições e Dependências (Mapbox/Google Maps, Supabase, push).
3. REQUISITOS FUNCIONAIS — tabela `ID | Nome | Descrição | Prioridade`, no mínimo 8 (rastreamento, conquista, facções, alerta de invasão, cidades…).
4. REQUISITOS NÃO FUNCIONAIS — tabela `ID | Categoria | Descrição/Critério`, no mínimo 6, todos mensuráveis e ligados às skills.
5. REGRAS DE NEGÓCIO — tabela `ID | Regra | Detalhamento`, no mínimo 5 (fórmula Pace × Distância, conquista com histerese, anti-cheat acelerômetro × GPS, decaimento, Cidade × Cidade).
6. CASOS DE USO E INTERFACES — 6.1 três casos de uso em texto estruturado (Correr e Conquistar, Defender Território, Analisar Heatmap) com atores, pré/pós-condições, fluxo principal, alternativos e de exceção; 6.2 interface (dark/neon, feedback de conquista); 6.3 hardware e software (APIs de mapa, sensores).
7. APROVAÇÃO E CONTROLE DE REVISÕES — tabela `Versão | Data | Autor | Descrição`.

Seja técnico e inequívoco: o documento será base da disciplina de Teste de Software, então todo requisito precisa de critério verificável. Ao final, inclua uma matriz de rastreabilidade (caso de uso × RF × RN × RNF) e exemplos de casos de teste por valor-limite.

===== FIM DO PROMPT =====
