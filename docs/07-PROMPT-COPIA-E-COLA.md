# Prompt copia-e-cola — Apresentação NOMADE RUN (preto + laranja neon)

> Cole o bloco abaixo inteiro numa ferramenta de criação de slides ou páginas (ou entregue a um designer). Ele foi montado com as skills `enhance-prompt` (estrutura), `synthwave` (neon), `emil-design-eng` e `motion-design` (movimento), `svg-animation` (rota desenhando), `app-store-screenshots` (mockups) e `creating-presentations` / `vc-pitch-deck` (roteiro). Referência visual: o site do piloto Lando Norris (base escura, um acento neon, brilho que reage ao cursor, tipografia enorme, sensação de telemetria de F1), trocando o verde-limão pelo laranja.

---

```text
Crie uma apresentação de 10 slides (16:9, 1920×1080) para a defesa de TCC do app NOMADE RUN. Vibe: tecnológica e cinematográfica, como telemetria de Fórmula 1 à noite. Fundo preto, um único acento laranja neon que BRILHA, mapa real da cidade, números enormes. Referência de estética: site do piloto Lando Norris (dark, neon, cursor reativo, tipografia gigante, WebGL), mas em laranja e preto.

CONTEXTO DO PRODUTO
- Título do trabalho: "NOMADE RUN: Um Projeto de Gestão e Gamificação de Corridas Urbanas".
- Integrantes: Gabryel Gomes Bahmad Camapum e Mateus Augusto De Faria Brito.
- O que é: app de corrida de rua de verdade (GPS, ritmo, distância, histórico, segurança) com uma Arena de minigames sobre o mapa real da cidade. Quem corre numa área pinta o bairro com a cor do seu time. Há competição Cidade × Cidade.
- Números reais do projeto: ERS com 27 requisitos funcionais, 15 não funcionais e 19 regras de negócio; protótipo com 10 telas; 60 testes automatizados; 6 minigames; 4 times.
- Dado de mercado: 15 milhões de corredores de rua no Brasil em 2025 (eram 13 mi). Fonte: pesquisa Olympikus/Box1824, nov/2025. Coloque a fonte no rodapé.

DESIGN SYSTEM (OBRIGATÓRIO)
- Fundo Preto Asfalto (#070708) em todos os slides; superfície de cards Grafite (#0F1013) com borda (#24252B).
- Acento único Laranja Neon (#FF6A13) para títulos de destaque, rota, números grandes e o item ativo. Variação para texto pequeno: (#FF7A2A).
- Texto principal Branco Quente (#F3F1ED); secundário (#A8A6A1); rodapé (#8A8883).
- Cores dos times, SÓ quando o assunto é time ou território: Neon Striders azul (#2FA8FF, círculo), Volt Runners verde (#19E6A8, triângulo), Night Owls magenta (#FF4FD8, losango), Urban Coyotes amarelo (#FFD60A, quadrado). A forma sempre acompanha a cor (acessível para daltônicos).
- Tipografia: títulos em Unbounded (700–900, larga, tecnológica); texto em Inter (400–600); rótulos, placar e telemetria em JetBrains Mono (maiúsculas, letter-spacing 4–6px).
- Escala: título 56px; número-herói 112–200px; texto 26–34px; rótulo/rodapé 24px. Nada abaixo de 24px.

EFEITOS (OBRIGATÓRIOS, COM MODERAÇÃO)
1. Glow neon = luz, não sombra: text-shadow/box-shadow na MESMA cor, em camadas (0 0 18px, 0 0 60px, 0 0 120px). Nunca sombra preta.
2. Texto contorno: a primeira palavra do título da capa só com contorno branco (-webkit-text-stroke 3px, preenchimento transparente) e a segunda palavra cheia em laranja com glow.
3. Rota desenhando: a linha laranja do percurso aparece com stroke-dashoffset de 1 → 0 (pathLength=1) em 2,8s, easing cubic-bezier(0.23,1,0.32,1).
4. Ponto do corredor pulsando: dois anéis laranja que crescem de scale(0.12) a scale(1) e somem, 2,2s, defasados em 1,1s.
5. Hover (na versão web): cards sobem 6px e acendem a borda na cor do time; botão principal tem brilho que varre da esquerda para a direita e efeito magnético leve; celulares inclinam em 3D seguindo o cursor (±14° no eixo Y).
6. Brilho laranja grande (560px, radial, mix-blend screen) que segue o cursor com atraso suave (lerp 0,12), como o hero do site do Lando Norris.
7. Textura: grão de filme sutil (5–7% de opacidade) e scanlines finas no mapa da capa.
8. Transição entre slides: fade. Elementos fixados entram com fade ou rise. Hover e press entre 100 e 160ms; entradas até 1200ms; nunca ease-in, nunca "linear" em movimento.
9. Respeitar prefers-reduced-motion: manter só os fades.

MAPA (OBRIGATÓRIO PARECER MAPA DE VERDADE)
- Use dados reais do OpenStreetMap (ruas, quarteirões, prédios, parques, água) do entorno do Parque Flamboyant, Goiânia (-16.7035, -49.2380). Atribuição no rodapé: "© OpenStreetMap contributors".
- Estilo escuro: terra (#0A0B0D), prédios (#121317), ruas em cinzas de (#1B1C22) a (#3B3D47) conforme a hierarquia, parque (#0B1610), água (#08141F). Rótulos de avenidas em JetBrains Mono cinza (#5E606B).
- Cor fica reservada aos dados: regiões dos times translúcidas (13% de opacidade) com borda neon brilhando; zona disputada com contorno tracejado animado (marching ants) na cor do atacante; percurso laranja neon com núcleo claro.
- NUNCA hexágonos visíveis. NUNCA um mapa que pareça jogo (agar.io, cobrinha). Precisa parecer Google Maps em modo noturno com dados neon por cima.

MOCKUPS DE CELULAR
- Moldura de celular escura com cantos de 60px, borda metálica sutil e glow laranja embaixo. Densidade dentro da tela, espaço vazio fora.
- Tela 1 "Mapa": mapa real escuro com regiões dos times, a volta de 2,02 km em laranja, chips "Todos / Só meu time / Onde já corri" (ativo em laranja com glow), card "Parque Flamboyant sob ataque" e botão "CORRER" laranja.
- Tela 2 "Corrida ao vivo": mapa em cima seguindo o corredor; embaixo, cronômetro gigante em JetBrains Mono, km / ritmo / BPM, barra de progresso da zona com glow e botões (pausar laranja, segurar para encerrar com anel de progresso).
- Tela 3 "Zona conquistada": anel azul do time fechando, "ZONA CONQUISTADA", "Jardim Goiás", "+46 RP" em laranja, mini mapa e métricas.

ROTEIRO (10 SLIDES, ~10 MIN). O título de cada slide é a conclusão.
Slide 1 — Capa: mapa real em tela cheia, ponto pulsando; "NOMADE" em contorno + "RUN" laranja neon; "Corra a sua cidade. Cada rua conta."; nomes dos integrantes; chip "2,02 km · volta real · Parque Flamboyant".
Slide 2 — "15 milhões de brasileiros correm na rua. Correr sozinho vira rotina.": número "15mi" gigante com glow + 3 cards (apps só registram; jogos de território favorecem quem corre muito; segurança: 32% das mulheres citam medo).
Slide 3 — "Transformar a corrida de rua num jogo justo sobre a cidade real": 3 cards Correr / Explorar / Conquistar com números 01-02-03 em contorno; o do meio aceso.
Slide 4 — "Primeiro, é um app de corrida de verdade": 4 itens com ícones laranja + mockup da Corrida ao vivo na frente e Zona conquistada atrás.
Slide 5 — "Cada rua pinta o bairro com a cor do seu time": legenda dos 4 times (forma + cor neon), 3 regras (30 pontos conquistam; esforço relativo ao seu ritmo; ataque e defesa) + mockup do Mapa.
Slide 6 — "Uma Arena de minigames, e cidade contra cidade": 6 cards (Domínio, Onde já corri, Fuga, Caça, Raid, Liga) + torre de classificação estilo F1: P1 Goiânia 12.578 (linha laranja acesa), P2 Brasília 11.742, P3 São Paulo 10.883, P4 Anápolis 8.967, P5 Uberlândia 6.559. Rodapé: placar = pontos ÷ corredores ativos (dados de demonstração).
Slide 7 — "Requisitos claros, regras isoladas e testes": linha do tempo Pesquisa → ERS → Protótipo → Testes; números 27 / 15 / 19; arquitetura em camadas com "Domínio: regras do jogo, isoladas e testadas" acesa em laranja.
Slide 8 — "Demonstração": mapa ao fundo, selo "● AO VIVO" piscando, 4 passos (Mapa → Zona sob ataque → Corrida simulada 10× → Zona conquistada). Rodapé: plano B em vídeo.
Slide 9 — "O que entregamos e o que falta": 60 testes, 10 telas, 6 minigames (números com glow); Limitações x Próximos passos.
Slide 10 — "A cidade é o tabuleiro.": mapa ao fundo com ponto pulsando, 3 checks (app de corrida completo; Arena sobre o mapa real; justo e seguro), "Obrigado! Perguntas?" e nomes.

REGRAS
- Uma ideia por slide, no máximo ~30 palavras de corpo. Títulos são conclusões, não categorias.
- Notas do apresentador em tópicos curtos em todos os slides.
- Contraste mínimo 4,5:1 para texto; laranja sobre preto só em texto de 24px+ ou com glow.
- Não mencionar ferramentas de geração de texto ou código nos slides.
- Exportar em PDF e PPTX (os efeitos animados viram imagem estática no PPTX/PDF; manter versão web para apresentar com animação).

CRITÉRIOS DE ACEITE
[ ] 10 slides, fundo preto, um único acento laranja neon.
[ ] Mapa com cara de mapa real (ruas e prédios), sem hexágonos.
[ ] Glow, contorno, rota desenhando e pulso do corredor presentes.
[ ] Hover e cursor reativo na versão web; reduced-motion respeitado.
[ ] Nomes dos dois integrantes na capa e no fechamento.
[ ] Fonte do dado de mercado e atribuição do OpenStreetMap no rodapé.
```
