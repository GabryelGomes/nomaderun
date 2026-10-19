"""Gera o mockup NOMADE RUN (preto + laranja neon) com o mapa real do entorno do Parque Flamboyant.
Uso: python3 gen.py <mapa.json> <saida.html> <google|local:<pasta-fontes>>"""
import json, math, sys

M = json.load(open(sys.argv[1]))
OUT, FONTS = sys.argv[2], sys.argv[3]
L = M['layers']
pts = M['routePts']

# posição do corredor: 58% do percurso
def along(frac):
    total = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
    goal, acc = total * frac, 0
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        d = math.dist(a, b)
        if acc + d >= goal:
            t = (goal - acc) / d
            return i, (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        acc += d
    return len(pts) - 2, tuple(pts[-1])
RI, RUN = along(0.58)
done = pts[: RI + 1] + [list(RUN)]
d_done = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in done)
LAP = M['routeLen'] / 1000
def km(v): return f"{v:.2f}".replace('.', ',')
def clock(minutes):
    m = int(minutes); s_ = round((minutes - m) * 60)
    return f"{m:02d}:{s_:02d}"
DONE_KM = LAP * 0.58
xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
CX, CY = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2

def vb(cx, cy, w, ratio):
    h = w * ratio
    return f'{cx - w / 2:.0f} {cy - h / 2:.0f} {w:.0f} {h:.0f}'

base_defs = f'''
<g id="base">
  <rect x="-4000" y="-4000" width="8000" height="8000" class="m-land"/>
  <path class="m-park" d="{L['park']}"/>
  <path class="m-water" d="{L['water']}"/>
  <path class="m-stream" d="{L['stream']}"/>
  <path class="m-bldg" d="{L['bldg']}"/>
  <path class="m-path" d="{L['path']}"/>
  <path class="m-res" d="{L['res']}"/>
  <path class="m-ter" d="{L['ter']}"/>
  <path class="m-sec" d="{L['sec']}"/>
  <path class="m-pri" d="{L['pri']}"/>
  <path class="m-mot" d="{L['mot']}"/>
  {''.join(f'<path id="lb{i}" d="{l["d"]}" fill="none"/>' for i, l in enumerate(M['labels']))}
  {''.join(f'<text class="m-label"><textPath href="#lb{i}" startOffset="50%" text-anchor="middle">{l["name"].upper()}</textPath></text>' for i, l in enumerate(M['labels']))}
</g>'''

def territory(only=None, dim=1.0):
    out = []
    for r in M['regions']:
        if only and r['owner'] != only: continue
        out.append(f'<path class="t-fill" d="{r["d"]}" style="--c:{r["color"]};fill-opacity:{0.13 * dim:.2f}"/>'
                   f'<path class="t-edge" d="{r["d"]}" style="--c:{r["color"]}"/>')
    for c in M['contested']:
        out.append(f'<path class="t-contest" d="{c["d"]}" style="--c:{c["color"]}"/>')
    return ''.join(out)

def runner(x, y, cls='me'):
    return (f'<g class="{cls}" transform="translate({x:.1f} {y:.1f})">'
            f'<circle class="me-pulse" r="60"/><circle class="me-pulse p2" r="60"/>'
            f'<circle class="me-ring" r="17"/><circle class="me-dot" r="11"/></g>')

chests = ''.join(f'<g class="chest" transform="translate({x} {y})"><rect x="-11" y="-11" width="22" height="22" rx="5" transform="rotate(45)"/></g>' for x, y in M['chests'][:6])

ROUTE = M['route']
PHONE_RATIO = 844 / 390

if FONTS == 'google':
    font_css = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Inter:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap">'
else:
    d = FONTS.split(':', 1)[1]
    font_css = f'''<style>
@font-face{{font-family:'Archivo';src:url('file://{d}/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2') format('woff2');font-weight:100 900;font-stretch:62% 125%}}
@font-face{{font-family:'Inter';src:url('file://{d}/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2') format('woff2');font-weight:100 900}}
@font-face{{font-family:'JetBrains Mono';src:url('file://{d}/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2') format('woff2');font-weight:100 800}}
</style>'''

TEAMS = [('Neon Striders', '#2FA8FF', 'circle'), ('Volt Runners', '#19E6A8', 'tri'), ('Night Owls', '#FF4FD8', 'diamond'), ('Urban Coyotes', '#FFD60A', 'square')]
def shape(kind, color, s=22):
    c = s / 2
    if kind == 'circle': return f'<svg width="{s}" height="{s}" viewBox="0 0 {s} {s}"><circle cx="{c}" cy="{c}" r="{c-2}" fill="{color}"/></svg>'
    if kind == 'tri': return f'<svg width="{s}" height="{s}" viewBox="0 0 {s} {s}"><polygon points="{c},2 {s-2},{s-3} 2,{s-3}" fill="{color}"/></svg>'
    if kind == 'diamond': return f'<svg width="{s}" height="{s}" viewBox="0 0 {s} {s}"><polygon points="{c},1 {s-1},{c} {c},{s-1} 1,{c}" fill="{color}"/></svg>'
    return f'<svg width="{s}" height="{s}" viewBox="0 0 {s} {s}"><rect x="3" y="3" width="{s-6}" height="{s-6}" rx="3" fill="{color}"/></svg>'

TAB = '''<nav class="tabs">
  <div class="tab {a0}"><svg viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>Mapa</div>
  <div class="tab {a1}"><svg viewBox="0 0 24 24"><path d="M6 9h12l2 8H4l2-8zM9 9V7a3 3 0 0 1 6 0v2"/></svg>Arena</div>
  <div class="tab {a2}"><svg viewBox="0 0 24 24"><path d="M13 4a2 2 0 1 0 0 .1M10 21l2-6 3 2v4M7 12l3-3 3 1 2 3h3"/></svg>Correr</div>
  <div class="tab {a3}"><svg viewBox="0 0 24 24"><path d="M8 11a3 3 0 1 0 0-.1M16 11a3 3 0 1 0 0-.1M3 20c0-3 2-5 5-5s5 2 5 5M11 20c0-3 2-5 5-5s5 2 5 5"/></svg>Clube</div>
  <div class="tab {a4}"><svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-.1M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>Perfil</div>
</nav>'''
def tabs(i): return TAB.format(**{f'a{k}': 'on' if k == i else '' for k in range(5)})

STATUS = '<div class="status"><span>6:42</span><span class="isl"></span><span class="sig">5G ▮▮▮ 92%</span></div>'

phone_mapa = f'''
<div class="phone" id="p-mapa"><div class="screen">
  <svg class="map" viewBox="{vb(CX + 20, CY + 140, 1250, PHONE_RATIO)}" preserveAspectRatio="xMidYMid slice">
    <use href="#base"/>
    <g class="terr">{territory()}</g>
    {chests}
    <path class="route-glow" d="{ROUTE}" pathLength="1"/>
    <path class="route" d="{ROUTE}" pathLength="1"/>
    <path id="rt-m" d="{ROUTE}" fill="none" stroke="none"/>
    <g class="me"><circle class="me-pulse" r="60"/><circle class="me-pulse p2" r="60"/><circle class="me-ring" r="17"/><circle class="me-dot" r="11"/>
      <animateMotion dur="14s" repeatCount="indefinite" rotate="0"><mpath href="#rt-m"/></animateMotion></g>
  </svg>
  <div class="vignette"></div>
  {STATUS}
  <div class="top">
    <div class="pill team">{shape('circle', '#2FA8FF', 26)}<div><b>Neon Striders</b><small>77 zonas · Goiânia</small></div><span class="live">AO VIVO</span></div>
    <div class="chips"><span class="chip on">Todos</span><span class="chip">Só meu time</span><span class="chip">Onde já corri</span></div>
  </div>
  <div class="bottom">
    <div class="alert"><span class="alert-ico"></span><div><b>Parque Flamboyant sob ataque</b><small>Urban Coyotes avançando · pontos em dobro</small></div></div>
    <button class="cta"><span>CORRER</span><i></i></button>
  </div>
  {tabs(0)}
</div></div>'''

phone_corrida = f'''
<div class="phone" id="p-corrida"><div class="screen run">
  <div class="run-map">
    <svg class="map" viewBox="{vb(RUN[0], RUN[1] + 40, 760, 470 / 390)}" preserveAspectRatio="xMidYMid slice">
      <use href="#base"/>
      <g class="terr">{territory()}</g>
      <path class="route-ghost" d="{ROUTE}"/>
      <path class="route-glow" d="{d_done}" pathLength="1"/>
      <path class="route" d="{d_done}" pathLength="1"/>
      {runner(*RUN)}
    </svg>
    <div class="vignette"></div>
    {STATUS}
    <div class="toast rival"><span class="toast-ico"></span><div><b>Território dos Urban Coyotes</b><small>Corra aqui para conquistar</small></div></div>
  </div>
  <div class="hud">
    <div class="hud-top"><span class="mono dim">CAÇA · GPS</span><span class="mono rec">● REC</span></div>
    <div class="time mono">{clock(DONE_KM * 5.2)}</div>
    <div class="metrics">
      <div><b class="mono">{km(DONE_KM)}</b><small>KM</small></div>
      <div><b class="mono">5'12"</b><small>RITMO /KM</small></div>
      <div><b class="mono">162</b><small>BPM</small></div>
    </div>
    <div class="zone">
      <div class="zone-row">{shape('square', '#FFD60A', 18)}<b>Jardim Goiás · Rua 15</b><span class="mono hot">+28 RP</span></div>
      <div class="bar"><i style="width:72%"></i></div>
      <small>Faltam 8 RP para conquistar</small>
    </div>
    <div class="controls"><span class="ctl">♪</span><span class="ctl stop"><i></i></span><span class="ctl pause">❚❚</span></div>
  </div>
</div></div>'''

phone_conq = f'''
<div class="phone" id="p-conq"><div class="screen conq">
  {STATUS}
  <div class="burst"></div>
  <div class="ring-wrap">
    <svg viewBox="0 0 200 200" class="ring"><circle cx="100" cy="100" r="86" class="ring-bg"/><circle cx="100" cy="100" r="86" class="ring-fg" pathLength="1"/></svg>
    <div class="ring-mark">{shape('circle', '#2FA8FF', 64)}</div>
  </div>
  <p class="kicker mono">ZONA CONQUISTADA</p>
  <h3 class="conq-title">Jardim Goiás</h3>
  <p class="conq-rp mono">+46 RP</p>
  <div class="mini">
    <svg class="map" viewBox="{vb(CX, CY, 1500, 170 / 340)}" preserveAspectRatio="xMidYMid slice">
      <use href="#base"/><g class="terr">{territory()}</g>
      <path class="route-glow" d="{ROUTE}" pathLength="1"/><path class="route" d="{ROUTE}" pathLength="1"/>
    </svg>
  </div>
  <div class="stats">
    <div><small>DISTÂNCIA</small><b class="mono">{km(LAP)}<em>km</em></b></div>
    <div><small>TEMPO</small><b class="mono">{clock(LAP * 5.2)}</b></div>
    <div><small>RITMO</small><b class="mono">5'12"<em>/km</em></b></div>
    <div><small>TERRITÓRIO</small><b class="mono hot">+183<em>RP</em></b></div>
  </div>
  <button class="cta small"><span>COMPARTILHAR</span><i></i></button>
</div></div>'''

hero_map = f'''<svg class="hero-map" viewBox="{vb(CX - 0.29 * 2500, CY - 30, 2500, 1080 / 1920)}" preserveAspectRatio="xMidYMid slice">
  <use href="#base"/><g class="terr">{territory(dim=0.6)}</g>
  <path class="route-glow big" d="{ROUTE}" pathLength="1"/><path class="route big" d="{ROUTE}" pathLength="1"/>
  <path id="rt-h" d="{ROUTE}" fill="none" stroke="none"/>
  <g class="me big"><circle class="me-pulse" r="90"/><circle class="me-pulse p2" r="90"/><circle class="me-ring" r="26"/><circle class="me-dot" r="17"/>
    <animateMotion dur="14s" repeatCount="indefinite"><mpath href="#rt-h"/></animateMotion></g>
</svg>'''

team_cards = ''.join(f'<div class="team-card" style="--c:{c}">{shape(k, c, 34)}<b>{n}</b><small>{m}</small></div>'
                     for (n, c, k), m in zip(TEAMS, ['Ritmo e precisão', 'Resistência sem fim', 'Donos da madrugada', 'Correm em matilha']))

CSS = open(sys.argv[0].replace('gen.py', 'mockup.css')).read()
JS = open(sys.argv[0].replace('gen.py', 'mockup.js')).read()

ARTIFACT = FONTS == 'google'
head = ('<title>NOMADE RUN Mockup</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' if ARTIFACT else
        '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOMADE RUN Mockup</title>')
html = f'''{head}
{font_css}
<style>{CSS}</style>{'' if ARTIFACT else '</head><body>'}
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
  {base_defs}
</defs></svg>
<div class="cursor-blob" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>

<header class="nav"><span class="logo"><i></i>NOMADE RUN</span><span class="mono dim">MOCKUP · PRETO &amp; LARANJA · v2</span><span class="mono dim">GOIÂNIA −16.70 −49.24</span></header>

<section class="hero" id="hero">
  {hero_map}
  <div class="hero-shade"></div>
  <div class="hero-copy">
    <p class="mono kicker">TCC · GESTÃO E GAMIFICAÇÃO DE CORRIDAS URBANAS</p>
    <h1 class="mega"><span class="outline">NOMADE</span><span class="fill">RUN</span></h1>
    <p class="lede">Corra a sua cidade. <em>Cada rua conta.</em></p>
  </div>
  <div class="hud-chip c1 mono"><b>{km(LAP)} km</b><small>volta real · Parque Flamboyant</small></div>
  <div class="hud-chip c2 mono"><b>+183 RP</b><small>território conquistado</small></div>
</section>

<div class="ticker" aria-hidden="true"><div class="ticker-track">{'<span>CORRA</span><span class="o">✦</span><span>EXPLORE</span><span class="o">✦</span><span>CONQUISTE</span><span class="o">✦</span>' * 8}</div></div>

<section class="stage" id="stage">
  <figure class="shot">{phone_mapa}<figcaption><b>01</b> Mapa vivo da cidade</figcaption></figure>
  <figure class="shot">{phone_corrida}<figcaption><b>02</b> Corrida ao vivo</figcaption></figure>
  <figure class="shot">{phone_conq}<figcaption><b>03</b> Zona conquistada</figcaption></figure>
</section>

<section class="teams"><p class="mono kicker">QUATRO TIMES · COR + FORMA</p><div class="team-row">{team_cards}</div></section>

<footer class="foot mono">Mapa: dados reais © OpenStreetMap contributors, via Overture Maps Foundation (ODbL) · Território e rota: protótipo NOMADE RUN</footer>
<script>{JS}</script>
{'' if ARTIFACT else '</body></html>'}'''
open(OUT, 'w').write(html)
print('ok', len(html) // 1024, 'KB')
