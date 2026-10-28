"""Monta a apresentação completa numa página web só, com os mesmos slides do PDF (deck.json).
Uso: python3 montar_web.py <pasta-slides> <mockup/build> <saida.html>
Os slides vêm da fonte do deck (docs/apresentacao/slides); o mockup vem do gerador (mockup/build/gen.py)."""
import json, re, runpy, sys, tempfile, os

SL, MB, OUT = sys.argv[1:4]
deck = json.load(open(f'{SL}/deck.json'))
TOTAL = len(deck['order'])

# --- peças do mockup (mapa real, celulares, CSS e JS) a partir do próprio gerador
tmp = tempfile.mktemp(suffix='.html')
argv = sys.argv
sys.argv = [f'{MB}/gen.py', f'{MB}/mapa.json', tmp, 'google']
G = runpy.run_path(f'{MB}/gen.py')
sys.argv = argv
os.remove(tmp)

BLOBS = {
    '17213839fd13fc13c9cc6034d27b6ac2': 'img/capa-mapa.jpg',
    '6027ed46e05cc17b886c8301244cc940': 'img/tel-mapa.png',
    'b3d54f0335dbc2852b72e0f2b1eb18e6': 'img/tel-corrida.png',
    '3037a2ff4c861e05ad51f489c21497eb': 'img/tel-conquista.png',
}
ICONS = {
    'Activity': '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    'Clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'Chart': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    'Trust': '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
    'Globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    'Check': '<path d="m4 12 5 5L20 6"/>',
}

def convert(h):
    notes = re.search(r'<aside>(.*?)</aside>', h, flags=re.S)
    h = re.sub(r'<aside>.*?</aside>', '', h, flags=re.S)
    h = re.sub(r'/_blob/([0-9a-f]{32})', lambda m: BLOBS[m.group(1)], h)
    h = h.replace('src="telas-v2/', 'src="img/')  # capturas reais da v2, copiadas para web/img pelo npm run web
    h = re.sub(r'<x-icon name="(\w+)" style="([^"]*)"></x-icon>',
               lambda m: f'<svg viewBox="0 0 24 24" style="{m.group(2)};flex:none" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{ICONS[m.group(1)]}</svg>', h)
    def conn(m):
        st = m.group(1); w = int(re.search(r'width:(\d+)px', st).group(1)); c = re.search(r'color:(#[0-9A-Fa-f]+)', st).group(1)
        return f'<svg width="{w}" height="24" viewBox="0 0 {w} 24" style="flex:none"><path d="M2 12H{w-4}M{w-12} 5l8 7-8 7" fill="none" stroke="{c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    h = re.sub(r'<x-connector style="([^"]*)"[^>]*></x-connector>', conn, h)
    # o anel parado do corredor ganha vida aqui: dois pulsos animados no mesmo lugar
    h = re.sub(r'<svg aria-label="Corredor no mapa"[^>]*style="([^"]*)">.*?</svg>',
               lambda m: f'<div class="pulse" style="{m.group(1)}"><i></i><i></i></div>', h, flags=re.S)
    h = h.replace('● AO VIVO</p>', '<span class="blink">●</span> AO VIVO</p>')
    h = re.sub(r'(\d\d)/\d\d<', lambda m: f'{m.group(1)}/{TOTAL:02d}<', h)
    return h, (notes.group(1).strip() if notes else '')

slides = []
for i, sid in enumerate(deck['order']):
    h, notes = convert(open(f'{SL}/slides/{sid}.html').read())
    h = h.replace(f'<section id="{sid}"', f'<section id="{sid}" class="slide ds" data-notes="{notes.replace(chr(34), "&quot;")}"', 1)
    slides.append(h)

# Os dois slides do mockup interativo (telas da v1) saíram da página na v2: o mockup continua em mockup/.

VIEWER_CSS = '''
/* Palco fixo 1920×1080 escalado para caber na janela; fundo preto nas sobras */
:root{color-scheme:dark;--o:#FF6A13;--ink:#F3F1ED;--ink2:#A8A6A1;--bg0:#030304}
html,body{height:100%;margin:0;background:var(--bg0);color:var(--ink);overflow:hidden}
.deck-stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:center;transform:translate(-50%,-50%) scale(var(--k,0.5))}
.slide{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;opacity:0;visibility:hidden;transition:opacity .5s cubic-bezier(.23,1,.32,1),visibility 0s .5s}
.slide.active{opacity:1;visibility:visible;transition:opacity .5s cubic-bezier(.23,1,.32,1),visibility 0s}
/* padrões do formato dos slides (só nos slides do deck) */
.ds{box-sizing:border-box}
.ds *{box-sizing:border-box;margin:0;padding:0}
.ds div{display:flex;flex-direction:column;min-width:0}
.ds h1{font-size:96px;font-weight:600;line-height:1.1}.ds h2{font-size:64px;font-weight:600;line-height:1.15}
.ds h3{font-size:44px;font-weight:600;line-height:1.2}.ds p{font-size:32px;line-height:1.4}
.ds ul{padding-left:1.2em}.ds img{display:block}
.ds > :not([style*="position:absolute"]){position:relative}
.slide.active [data-build-in="fade"]{animation:bin-fade .8s cubic-bezier(.23,1,.32,1) .25s both}
.slide.active [data-build-in="rise"]{animation:bin-rise .9s cubic-bezier(.23,1,.32,1) .2s both}
@keyframes bin-fade{from{opacity:0}}
@keyframes bin-rise{from{opacity:0;transform:translateY(40px)}}
.pulse{pointer-events:none}
.pulse i{position:absolute;left:50%;top:50%;width:200px;height:200px;margin:-100px 0 0 -100px;border-radius:50%;border:3px solid var(--o);box-shadow:0 0 18px var(--o),inset 0 0 18px rgba(255,106,19,.5);animation:pz 2.2s cubic-bezier(.23,1,.32,1) infinite}
.pulse i+i{animation-delay:1.1s}
@keyframes pz{from{transform:scale(.12);opacity:1}to{transform:scale(1);opacity:0}}
.blink{animation:blink 1.4s steps(2) infinite}
/* slides do mockup */
.ms .hero{height:1080px;min-height:0}
.ms .hero-copy{left:128px;bottom:150px;max-width:1150px}
.ms .mega{font-size:200px}
.ms .stage{height:1080px;padding:120px 0 0;gap:56px;align-items:flex-start;background:radial-gradient(ellipse at 50% 45%,rgba(255,106,19,.10),transparent 60%),#050506}
.ms .shot{padding:0}
.ms figcaption{font-size:18px;margin-top:22px}
.mock-kicker{position:absolute;left:0;right:0;top:52px;text-align:center;font-size:22px;letter-spacing:.3em;color:#FF7A2A;z-index:2}
.foot-note{position:absolute;left:128px;bottom:36px;font-size:22px;color:#8A8883;z-index:3}
/* controles */
.bar{position:fixed;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.08);z-index:60}
.bar i{display:block;height:100%;background:var(--o);box-shadow:0 0 12px var(--o);transition:width .5s cubic-bezier(.23,1,.32,1)}
.ctrl{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:center;z-index:60;font:600 13px 'JetBrains Mono',monospace;color:var(--ink2);opacity:.35;transition:opacity .25s}
.ctrl:hover,.ctrl:focus-within,body.show-ui .ctrl{opacity:1}
.ctrl button{all:unset;cursor:pointer;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(20,20,24,.85);border:1px solid rgba(255,255,255,.1);color:var(--ink);font:700 16px 'JetBrains Mono',monospace}
.ctrl button:hover{border-color:var(--o);box-shadow:0 0 16px rgba(255,106,19,.45)}
.ctrl button:focus-visible{outline:2px solid var(--o);outline-offset:2px}
.ctrl .count{min-width:72px;text-align:center}
.notes{position:fixed;left:max(16px,env(safe-area-inset-left,0px));bottom:calc(70px + env(safe-area-inset-bottom,0px));max-width:min(560px,calc(100vw - 32px));max-height:45vh;overflow:auto;padding:18px 20px;border-radius:16px;background:rgba(12,12,14,.94);border:1px solid rgba(255,106,19,.4);font:400 15px/1.55 'Inter',sans-serif;color:var(--ink);white-space:pre-line;z-index:60}
.notes b{display:block;font:700 12px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#FF7A2A;margin-bottom:8px}
.hint{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);font:500 13px 'JetBrains Mono',monospace;color:var(--ink2);background:rgba(12,12,14,.85);border:1px solid rgba(255,255,255,.1);padding:10px 16px;border-radius:999px;z-index:60;transition:opacity .6s}
body:not(.on-mock) .cursor-blob{display:none}
@media (prefers-reduced-motion:reduce){.slide,.slide.active{transition:none}.pulse i,.blink{animation:none}}
'''

VIEWER_JS = '''
(() => {
  const stage = document.querySelector('.deck-stage');
  const slides = [...document.querySelectorAll('.slide')];
  const count = document.querySelector('.count'), bar = document.querySelector('.bar i');
  const notes = document.querySelector('.notes'), notesText = notes.querySelector('span');
  let i = 0;
  const fit = () => stage.style.setProperty('--k', Math.min(innerWidth / 1920, innerHeight / 1080));
  function go(n, fromHash) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((s, k) => s.classList.toggle('active', k === i));
    const s = slides[i];
    // reinicia as animações do slide (rota desenhando, anel fechando, entradas)
    s.getAnimations({ subtree: true }).forEach((a) => { try { a.cancel(); a.play(); } catch (e) {} });
    document.body.classList.toggle('on-mock', s.classList.contains('ms'));
    count.textContent = `${String(i + 1).padStart(2, '0')} / ${slides.length}`;
    bar.style.width = `${((i + 1) / slides.length) * 100}%`;
    notesText.textContent = s.dataset.notes || '';
    if (!fromHash) history.replaceState(null, '', `#s${i + 1}`);
  }
  const next = () => go(i + 1), prev = () => go(i - 1);
  document.querySelector('[data-a=next]').onclick = next;
  document.querySelector('[data-a=prev]').onclick = prev;
  document.querySelector('[data-a=notes]').onclick = () => { notes.hidden = !notes.hidden; };
  document.querySelector('[data-a=full]').onclick = () => {
    const d = document.documentElement;
    (document.fullscreenElement ? document.exitFullscreen() : d.requestFullscreen?.())?.catch?.(() => {});
  };
  addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(slides.length - 1);
    else if (e.key === 'n' || e.key === 'N') notes.hidden = !notes.hidden;
    else if (e.key === 'f' || e.key === 'F') document.querySelector('[data-a=full]').click();
  });
  // clique avança nos slides do deck (nos do mockup o mouse é para interagir)
  stage.addEventListener('click', (e) => { if (!slides[i].classList.contains('ms') && !e.target.closest('button')) next(); });
  let x0 = null;
  addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) (dx < 0 ? next : prev)(); x0 = null; });
  addEventListener('resize', fit);
  addEventListener('pointermove', () => { document.body.classList.add('show-ui'); clearTimeout(window.__ui); window.__ui = setTimeout(() => document.body.classList.remove('show-ui'), 1800); });
  const hint = document.querySelector('.hint');
  setTimeout(() => { hint.style.opacity = 0; }, 4500);
  fit();
  const m = /^#s(\\d+)$/.exec(location.hash);
  go(m ? Number(m[1]) - 1 : 0, true);
})();
'''

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Inter:wght@400..700&family=JetBrains+Mono:wght@400..700&family=Unbounded:wght@400..900&display=swap">')
html = f'''<title>NOMADE RUN Apresentação</title>
{FONTS}
<style>
@font-face{{font-family:'Unbounded Line';src:url('fonts/UnboundedLine-800.woff2') format('woff2');font-weight:800;font-display:swap}}
{G['CSS']}
{VIEWER_CSS}
</style>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
  {G['base_defs']}
</defs></svg>
<div class="cursor-blob" aria-hidden="true"></div>
<main class="deck-stage" aria-roledescription="apresentação">
{''.join(slides)}
</main>
<div class="bar" aria-hidden="true"><i></i></div>
<nav class="ctrl" aria-label="Controles da apresentação">
  <button data-a="prev" aria-label="Slide anterior">‹</button>
  <span class="count" aria-live="polite">01 / {TOTAL}</span>
  <button data-a="next" aria-label="Próximo slide">›</button>
  <button data-a="notes" aria-label="Mostrar notas do apresentador">N</button>
  <button data-a="full" aria-label="Tela cheia">⛶</button>
</nav>
<aside class="notes" hidden><b>NOTAS DO APRESENTADOR</b><span></span></aside>
<p class="hint">← → ou clique para avançar · F tela cheia · N notas</p>
<script>{G['JS']}</script>
<script>{VIEWER_JS}</script>
'''
open(OUT, 'w').write(html)
print('ok', TOTAL, 'slides', len(html) // 1024, 'KB')
