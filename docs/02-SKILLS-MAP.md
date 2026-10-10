# NOMADE RUN — Mapa de Skills do skills.sh por Tarefa

> **Regra do projeto:** toda tarefa de desenvolvimento, design, teste e documentação deve ser guiada por uma skill do [skills.sh](https://skills.sh) (diretório aberto de *Agent Skills* mantido pela Vercel).
> Instalação padrão: `npx skills add <dono/repositorio> --skill <nome-da-skill>`
> Pesquisa feita em **10/10/2026**. Números de instalações mudam todo dia — confira a página da skill antes de instalar.

---

## ⚠️ Correção importante sobre as skills do brainstorm original

O primeiro rascunho citava 4 skills. Ao pesquisar no skills.sh, **3 delas não existem com aquele nome**. Se você colocar nomes inexistentes no ERS, o professor (ou a equipe de teste) não vai conseguir rastrear a fonte. Use os nomes corrigidos:

| Citado no rascunho | Situação | Usar no lugar |
|---|---|---|
| `gustavovalverde/skills/software-design` | ❌ Não encontrada no skills.sh | `pproenca/dot-skills` → `clean-architecture` (a mais instalada de arquitetura; baseada no livro *Clean Architecture*, de Robert C. Martin) |
| `qaskills/k6-performance` | ⚠️ Nome errado. Existe `pramoddutta/qaskills` → `k6-performance-testing`, mas com ~1 instalação | `grafana/skills` → `k6-perf-test-website` (oficial da Grafana, criadora do k6) **+** `davila7/claude-code-templates` → `k6-load-testing` (cenários smoke/load/stress/spike/soak) |
| `trail-of-bits/security` | ❌ Não existe uma skill com esse nome. O repositório certo é `trailofbits/skills` (sem hífen), com várias skills separadas | `trailofbits/skills` → `insecure-defaults`, `sharp-edges`, `differential-review`, `static-analysis` |
| `qaskills/playwright-e2e` | ⚠️ Existe como `pramoddutta/qaskills` → `playwright-e2e-testing`, mas com pouquíssimas instalações. **E o Playwright testa web, não app nativo** | Web: `bobmatnyc/claude-mpm-skills` → `playwright` · App mobile: `tovimx/maestro-mobile-testing-skill` → `maestro-mobile-testing` |

---

## 1. Mapa completo: tarefa → skill

### 🏗️ Arquitetura e Design de Software
| Tarefa | Skill | Instalar |
|---|---|---|
| Camadas, limites entre domínio e infraestrutura, regra de dependência | **clean-architecture** (pproenca/dot-skills) | `npx skills add pproenca/dot-skills --skill clean-architecture` |
| Composição de componentes React (evitar "prop drilling", componentes compostos) | **vercel-composition-patterns** (vercel-labs/agent-skills) | `npx skills add vercel-labs/agent-skills --skill vercel-composition-patterns` |

### 📱 App Mobile (React Native + Expo)
| Tarefa | Skill | Instalar |
|---|---|---|
| Telas, navegação (Expo Router), abas nativas, animações | **building-native-ui** (expo/skills — oficial da Expo) | `npx skills add expo/skills --skill building-native-ui` |
| Busca de dados, cache, offline, React Query | **native-data-fetching** (expo/skills) | `npx skills add expo/skills --skill native-data-fetching` |
| Estilo com Tailwind/NativeWind | **expo-tailwind-setup** (expo/skills) | `npx skills add expo/skills --skill expo-tailwind-setup` |
| Publicar nas lojas (EAS Build/Submit) | **expo-deployment** (expo/skills) | `npx skills add expo/skills --skill expo-deployment` |
| Performance (listas, renderização, scroll, animação) | **react-native-skills** (vercel-labs/agent-skills) | `npx skills add vercel-labs/agent-skills --skill react-native-skills` |

### 🗺️ Mapa, Geolocalização e Hexágonos
| Tarefa | Skill | Instalar |
|---|---|---|
| Integrar Mapbox no Android/iOS | **mapbox-android-patterns** / **mapbox-ios-patterns** (mapbox/mapbox-agent-skills — oficial) | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-android-patterns` |
| Estilo dark/neon do mapa (cor, hierarquia, tipografia) | **mapbox-cartography** + **mapbox-style-patterns** | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-cartography` |
| Hexágonos coloridos, heatmap, extrusão 3D | **mapbox-data-visualization-patterns** | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-data-visualization-patterns` |
| Cálculos geoespaciais (distância, ponto-no-polígono) | **mapbox-geospatial-operations** | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-geospatial-operations` |
| Performance do mapa (memória, renderização) | **mapbox-web-performance-patterns** | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-web-performance-patterns` |
| Proteger o token do Mapbox | **mapbox-token-security** | `npx skills add mapbox/mapbox-agent-skills --skill mapbox-token-security` |

> Não encontrei skill específica de **H3** no skills.sh. A grade hexagonal usa a biblioteca `h3-js` (app) e a extensão `h3-pg` (banco), guiadas pelas skills de visualização/geoespacial acima.

### 🎨 Design Visual e UX
| Tarefa | Skill | Instalar |
|---|---|---|
| Interface marcante, fugir do "visual genérico de IA" | **frontend-design** (anthropics/skills) — a skill de design mais instalada do diretório | `npx skills add anthropics/skills --skill frontend-design` |
| Paletas, pares de fontes, estilos (tem stack React Native) | **ui-ux-pro-max** (nextlevelbuilder/ui-ux-pro-max-skill) | `npx skills add nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max` |
| Auditar acessibilidade e UX (painel web) | **web-design-guidelines** (vercel-labs/agent-skills) | `npx skills add vercel-labs/agent-skills --skill web-design-guidelines` |
| Animações (Reanimated 4, gestos, Skia para glow/partículas) | **expo-motion** (bjornmelin/dev-skills) | `npx skills add bjornmelin/dev-skills --skill expo-motion` |

### ⚙️ Back-end, Banco e Tempo Real
| Tarefa | Skill | Instalar |
|---|---|---|
| Esquema, índices, RLS, performance do Postgres | **supabase-postgres-best-practices** (supabase/agent-skills — oficial) | `npx skills add supabase/agent-skills --skill supabase-postgres-best-practices` |
| Mapa ao vivo (Broadcast, Presence, Postgres Changes) | **supabase-realtime** (adaptationio/skrillz) | `npx skills add adaptationio/skrillz --skill supabase-realtime` |
| Painel web (Next.js) | **vercel-react-best-practices** (vercel-labs/agent-skills) | `npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices` |

### 🔐 Segurança e Anti-Cheat
| Tarefa | Skill | Instalar |
|---|---|---|
| Configurações inseguras, credenciais no código, "fail-open" | **insecure-defaults** (trailofbits/skills) | `npx skills add trailofbits/skills --skill insecure-defaults` |
| APIs/configs perigosas e fáceis de usar errado | **sharp-edges** (trailofbits/skills) | `npx skills add trailofbits/skills --skill sharp-edges` |
| Revisão de segurança de cada mudança (PR) | **differential-review** (trailofbits/skills) | `npx skills add trailofbits/skills --skill differential-review` |
| Análise estática (Semgrep/CodeQL) no CI | **static-analysis** (trailofbits/skills) | `npx skills add trailofbits/skills --skill static-analysis` |
| OWASP Top 10 / API Security | **owasp-security** (agamm/claude-code-owasp) | `npx skills add agamm/claude-code-owasp --skill owasp-security` |

### 🧪 Testes de Software
| Tarefa | Skill | Instalar |
|---|---|---|
| Teste de carga da ingestão de GPS (smoke, load, stress, spike, soak) | **k6-load-testing** (davila7/claude-code-templates) | `npx skills add davila7/claude-code-templates --skill k6-load-testing` |
| Workflow oficial k6 da Grafana | **k6-perf-test-website** (grafana/skills) | `npx skills add grafana/skills --skill k6-perf-test-website` |
| E2E do app mobile (Expo) | **maestro-mobile-testing** (tovimx/maestro-mobile-testing-skill) | `npx skills add tovimx/maestro-mobile-testing-skill --skill maestro-mobile-testing` |
| E2E do painel web / versão web | **playwright** (bobmatnyc/claude-mpm-skills) | `npx skills add bobmatnyc/claude-mpm-skills --skill playwright` |

### 📄 Documentação (para o ERS)
| Tarefa | Skill | Instalar |
|---|---|---|
| Gerar ERS no padrão IEEE 830 / ISO/IEC/IEEE 29148 | **srs-generation** (tercel/spec-forge) | `npx skills add tercel/spec-forge --skill srs-generation` |
| Análise e validação de requisitos | **requirements-analysis** (rsmdt/the-startup) | `npx skills add rsmdt/the-startup --skill requirements-analysis` |

---

## 2. Comando único para instalar o kit essencial

```bash
npx skills add expo/skills --skill building-native-ui
npx skills add expo/skills --skill native-data-fetching
npx skills add vercel-labs/agent-skills --skill react-native-skills
npx skills add mapbox/mapbox-agent-skills --skill mapbox-data-visualization-patterns
npx skills add mapbox/mapbox-agent-skills --skill mapbox-cartography
npx skills add anthropics/skills --skill frontend-design
npx skills add bjornmelin/dev-skills --skill expo-motion
npx skills add supabase/agent-skills --skill supabase-postgres-best-practices
npx skills add pproenca/dot-skills --skill clean-architecture
npx skills add trailofbits/skills --skill insecure-defaults
npx skills add davila7/claude-code-templates --skill k6-load-testing
npx skills add tovimx/maestro-mobile-testing-skill --skill maestro-mobile-testing
```

## 3. Cuidados
- Se um `--skill` der "não encontrada", liste os nomes exatos do repositório com `npx skills add <dono/repositorio> --list` (ex.: a skill de React Native da Vercel aparece como `react-native-skills` em alguns lugares e `vercel-react-native-skills` em outros).
- Skills são **código de terceiros** que a IA vai seguir. Antes de instalar, abra a página no skills.sh e veja o painel de auditoria de segurança.
- Prefira skills **oficiais** (expo, mapbox, supabase, vercel-labs, anthropics, trailofbits, grafana) às cópias da comunidade.
- A página da `vercel-labs` no skills.sh lista algumas entradas de teste (ex.: `hacked_skill`) — **não instale essas**.
