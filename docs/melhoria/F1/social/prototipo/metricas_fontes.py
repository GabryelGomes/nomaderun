"""Gera font-metrics.json: largura de avanço de cada caractere (em 1/1000 do corpo) para medir
texto sem DOM (o mesmo truque serve no app: o SVG do card não tem medida de texto antes de desenhar)."""
import json, sys
from fontTools.ttLib import TTFont

BASE = sys.argv[1]  # apps/mobile/node_modules/@expo-google-fonts
FONTS = {
    'InterTight_800ExtraBold': f'{BASE}/inter-tight/800ExtraBold/InterTight_800ExtraBold.ttf',
    'InterTight_600SemiBold': f'{BASE}/inter-tight/600SemiBold/InterTight_600SemiBold.ttf',
    'Inter_700Bold': f'{BASE}/inter/700Bold/Inter_700Bold.ttf',
    'Inter_500Medium': f'{BASE}/inter/500Medium/Inter_500Medium.ttf',
}
CHARS = ''.join(chr(c) for c in range(32, 127)) + 'ÀÁÂÃÇÉÊÍÓÔÕÚàáâãçéêíóôõú·–—→’“”º°×'
out = {}
for name, path in FONTS.items():
    f = TTFont(path)
    upm = f['head'].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f['hmtx']
    adv = {}
    for ch in CHARS:
        g = cmap.get(ord(ch))
        if g:
            adv[ch] = round(hmtx[g][0] * 1000 / upm, 1)
    out[name] = {'fallback': adv.get('n', 560), 'adv': adv}
json.dump(out, open('font-metrics.json', 'w'), ensure_ascii=False)
print({k: len(v['adv']) for k, v in out.items()})
