"""Monta um HTML de impressão com os 10 slides (fonte em docs/apresentacao/slides) para virar PDF.
Uso: python3 montar_pdf.py <pasta-slides> <pasta-imagens> <pasta-fontes> <saida.html>"""
import json, re, sys
SL, IMG, FONTS, OUT = sys.argv[1:5]
deck = json.load(open(f'{SL}/deck.json'))
BLOBS = {
    '17213839fd13fc13c9cc6034d27b6ac2': 'capa-mapa.jpg',
    '6027ed46e05cc17b886c8301244cc940': 'tel-mapa.png',
    'b3d54f0335dbc2852b72e0f2b1eb18e6': 'tel-corrida.png',
    '3037a2ff4c861e05ad51f489c21497eb': 'tel-conquista.png',
}
ICONS = {  # traço 24×24, cor = currentColor
    'Activity': '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    'Clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'Chart': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    'Trust': '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
    'Globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    'Check': '<path d="m4 12 5 5L20 6"/>',
}
def icon(m):
    name, style = m.group(1), m.group(2)
    return f'<svg viewBox="0 0 24 24" style="{style};flex:none" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>'
def connector(m):
    style = m.group(1)
    w = int(re.search(r'width:(\d+)px', style).group(1))
    color = re.search(r'color:(#[0-9A-Fa-f]+)', style).group(1)
    return f'<svg width="{w}" height="24" viewBox="0 0 {w} 24" style="flex:none"><path d="M2 12H{w-4}M{w-12} 5l8 7-8 7" fill="none" stroke="{color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
def embed(m):
    style, body = m.group(1), m.group(2)
    if 'AO VIVO' in body:
        return (f'<div style="{style};display:flex;align-items:center;justify-content:flex-end;gap:14px;font:700 26px/1 \'JetBrains Mono\',monospace;letter-spacing:4px;color:#FF6A13">'
                '<span style="width:16px;height:16px;border-radius:50%;background:#FF6A13;box-shadow:0 0 14px #FF6A13"></span>AO VIVO</div>')
    # pulso do corredor congelado: dois anéis
    return (f'<svg style="{style}" viewBox="0 0 240 240"><defs><filter id="pg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>'
            '<circle cx="120" cy="120" r="58" fill="none" stroke="#FF6A13" stroke-width="3" opacity=".75" filter="url(#pg)"/>'
            '<circle cx="120" cy="120" r="58" fill="none" stroke="#FF6A13" stroke-width="3" opacity=".75"/>'
            '<circle cx="120" cy="120" r="96" fill="none" stroke="#FF6A13" stroke-width="3" opacity=".3"/></svg>')
pages = []
for sid in deck['order']:
    h = open(f'{SL}/slides/{sid}.html').read()
    h = re.sub(r'<aside>.*?</aside>', '', h, flags=re.S)
    h = re.sub(r'/_blob/([0-9a-f]{32})', lambda m: f'file://{IMG}/{BLOBS[m.group(1)]}', h)
    h = re.sub(r'<x-icon name="(\w+)" style="([^"]*)"></x-icon>', icon, h)
    h = re.sub(r'<x-connector style="([^"]*)"[^>]*></x-connector>', connector, h)
    h = re.sub(r'<x-embed style="([^"]*)">(.*?)</x-embed>', embed, h, flags=re.S)
    h = re.sub(r' data-build-in="\w+"', '', h)
    pages.append(h)
F = FONTS
import os
HERE = os.path.dirname(os.path.abspath(__file__))  # Unbounded 800 sem contornos sobrepostos (fontTools removeOverlaps), para o texto em contorno
html = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>NOMADE RUN — Apresentação</title><style>
/* pesos estáticos: o arquivo variável tem contornos sobrepostos que aparecem com text-stroke */
@font-face{{font-family:'Unbounded';src:url('file://{F}/@fontsource/unbounded/files/unbounded-latin-500-normal.woff2') format('woff2');font-weight:500}}
@font-face{{font-family:'Unbounded';src:url('file://{F}/@fontsource/unbounded/files/unbounded-latin-600-normal.woff2') format('woff2');font-weight:600}}
@font-face{{font-family:'Unbounded';src:url('file://{F}/@fontsource/unbounded/files/unbounded-latin-700-normal.woff2') format('woff2');font-weight:700}}
@font-face{{font-family:'Unbounded';src:url('file://{F}/@fontsource/unbounded/files/unbounded-latin-800-normal.woff2') format('woff2');font-weight:800}}
@font-face{{font-family:'Unbounded';src:url('file://{F}/@fontsource/unbounded/files/unbounded-latin-900-normal.woff2') format('woff2');font-weight:900}}
@font-face{{font-family:'Inter';src:url('file://{F}/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2') format('woff2');font-weight:100 900}}
@font-face{{font-family:'JetBrains Mono';src:url('file://{F}/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2') format('woff2');font-weight:100 800}}
@font-face{{font-family:'Unbounded Line';src:url('file://{HERE}/UnboundedLine-800.woff2') format('woff2');font-weight:800}}
@page{{size:1920px 1080px;margin:0}}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{background:#070708}}
section{{position:relative;width:1920px;height:1080px;overflow:hidden;page-break-after:always;break-after:page}}
div{{display:flex;flex-direction:column;min-width:0}}
h1{{font-size:96px;font-weight:600;line-height:1.1}} h2{{font-size:64px;font-weight:600;line-height:1.15}}
h3{{font-size:44px;font-weight:600;line-height:1.2}} p{{font-size:32px;line-height:1.4}}
ul{{padding-left:1.2em}} li{{margin:0}}
img{{display:block}}
/* como no deck: o conteúdo em fluxo pinta acima dos fundos fixados */
section > :not([style*="position:absolute"]){{position:relative}}
</style></head><body>{''.join(pages)}</body></html>'''
open(OUT, 'w').write(html)
print('ok', len(pages), 'slides')
