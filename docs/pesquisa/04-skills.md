# Pesquisa 4 — Skills do skills.sh aplicadas ao NOMADE RUN

> **Como foram obtidas:** o site skills.sh está bloqueado pela política de rede do ambiente de desenvolvimento, então a busca do `find-skills` (`npx skills find`) retorna vazio. As skills foram encontradas por busca na web e o conteúdo real de cada `SKILL.md` foi baixado do GitHub (raw). Todas estão em `.agents/skills/<nome>/SKILL.md`, com índice e comandos de instalação em `.agents/skills/SOURCES.md`.
> Para instalar no seu computador: `npx skills add <dono/repositorio> --skill <nome>`.

## Skills baixadas (38)
| Área | Skill | Repositório |
|---|---|---|
| Descoberta | find-skills | vercel-labs/skills |
| Design | frontend-design | anthropics/skills |
| Design | ui-ux-pro-max | nextlevelbuilder/ui-ux-pro-max-skill |
| Expo (oficial) | expo-overview, expo-project-structure, expo-router, expo-native-ui, expo-animation, expo-design-system, expo-data-fetching, expo-ui, expo-upgrade, eas-app-stores, eas-update | expo/skills |
| React Native | react-native-skills, composition-patterns, web-design-guidelines | vercel-labs/agent-skills |
| React Native | react-native-best-practices | software-mansion-labs/skills |
| React Native | callstack-react-native-best-practices | callstackincubator/agent-skills |
| Animação | react-native-reanimated | terminalskills/skills |
| Animação | react-native-skia | tristanmanchester/agent-skills |
| Animação | expo-motion | bjornmelin/dev-skills |
| Mapa (oficial) | mapbox-data-visualization-patterns, mapbox-cartography, mapbox-geospatial-operations, mapbox-token-security, mapbox-style-patterns | mapbox/mapbox-agent-skills |
| Backend (oficial) | supabase, supabase-postgres-best-practices | supabase/agent-skills |
| Segurança | sharp-edges | trailofbits/skills |
| Gamificação | gamification-loops | omer-metin/skills-for-antigravity |
| Gamificação | md-skill-tree-architect | frankxai/awesome-gamification-agent-skills |
| Processo | brainstorming, writing-plans | obra/superpowers |
| Produto | prd-writing, app-store-optimization | terminalskills/skills |
| Lojas | aso / aso-audit | coreyhaines31/marketingskills / eronred/aso-skills |

**Não encontradas / renomeadas:** `insecure-defaults` (trailofbits) virou plugin de comando, sem SKILL.md; as skills antigas do Expo `building-native-ui`, `native-data-fetching`, `expo-deployment` e `upgrading-expo` foram renomeadas para `expo-native-ui`, `expo-data-fetching`, `eas-app-stores` e `expo-upgrade`; `expo-tailwind-setup` não existe mais.

## Regras que mudam o projeto (resumo)
- **frontend-design:** fugir dos visuais "padrão de IA" (fundo creme + terracota; preto + verde-ácido; kit de cards SaaS; rótulos em CAIXA ALTA). Montar tokens (4–6 cores, tipos, layout, princípios) e revisar contra o briefing antes de codar. Ousadia concentrada em um elemento; um único momento de motion orquestrado. Textos do ponto de vista do usuário, em voz ativa.
- **expo-overview / expo-upgrade:** ler a versão do SDK no `package.json`; instalar sempre com `npx expo install`; rodar `npx expo-doctor`; React Compiler ligado.
- **expo-project-structure / expo-router:** `src/app` só com rotas; componentes em kebab-case fora de `app`; NativeTabs com uma Stack por aba; modais e `formSheet` nativos; nunca importar `@react-navigation/*` direto no SDK 56+.
- **expo-native-ui:** tentar Expo Go primeiro; `expo-image`, `expo-symbols`, `Color` do expo-router; `tabular-nums` em contadores; toda tela com estados carregando/erro/vazio/conteúdo; `boxShadow` em vez de sombra legada; `borderCurve: 'continuous'`.
- **expo-animation:** ações frequentes (troca de aba) não animam; reservar o "orçamento de encanto" para conquistas e celebrações; só `transform`/`opacity`; spring quando há dedo (`{ duration: 400, dampingRatio: 0.8 }`); curva `Easing.bezier(0.23, 1, 0.32, 1)`; nunca `scale(0)`; reduzir movimento junto com a animação; haptic no mesmo quadro do visual e nunca como único sinal.
- **expo-design-system:** tokens em `src/theme/` (grid de 4 pt, escala tipográfica, motion); valor repetido duas vezes vira token.
- **expo-data-fetching:** React Query + `expo/fetch`; carregando ≠ vazio; segredos nunca em `EXPO_PUBLIC_*`.
- **react-native-skills / callstack:** FlashList em listas longas; medir → otimizar → medir; estado atômico quando houver re-render em cascata.
- **react-native-reanimated / expo-motion / react-native-skia:** `scheduleOnRN` no lugar de `runOnJS`; `.get()`/`.set()`; Skia só para desenho customizado (rastro, preenchimento de território, partículas), com controles acessíveis por cima.
- **mapbox-cartography / data-visualization:** posição do usuário e rota com contraste máximo, base map apagado; territórios como choropleth por dono com feature-state; heatmap para densidade; contraste 4,5:1 e nunca distinguir só por vermelho/verde.
- **mapbox-geospatial-operations:** distância, área e ponto-em-polígono são cálculos locais (Turf/H3), sem API.
- **mapbox-token-security:** só token público `pk.*` no app, com escopo mínimo; `sk.*` só no CI.
- **supabase / postgres:** RLS em todas as tabelas com `(select auth.uid()) = user_id`; UPDATE com `USING` + `WITH CHECK`; nunca `service_role` no app; índices nas colunas das policies; paginação por cursor.
- **sharp-edges:** revisar defaults inseguros e APIs onde o caminho fácil é o inseguro (antifraude, JWT).
- **gamification-loops / md-skill-tree-architect:** ciclo gatilho → ação → recompensa variável → investimento; evitar vício e "farm"; ligas por nível para a competição não desmotivar; toda conquista desbloqueia algo real.
- **brainstorming / writing-plans / prd-writing:** entender o "porquê" antes de construir; planos em tarefas pequenas com teste; PRD com métrica principal, contra-métricas e não-objetivos.
- **aso:** nome e subtítulo com 30 caracteres; as 3 primeiras screenshots carregam a proposta de valor (mapa/território primeiro).
