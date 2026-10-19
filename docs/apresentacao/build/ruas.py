"""Gera um mosaico de ruas no estilo de mapa claro (só para as capturas da apresentação)."""
import random, sys
random.seed(11)
T = 960; B = 112; S = 8  # tile, bloco, rua
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{T}" height="{T}" viewBox="0 0 {T} {T}">',
       f'<rect width="{T}" height="{T}" fill="#ECEAE6"/>']
step = B + S
n = T // step
for c in range(n):
    for r in range(n):
        x, y = c * step + S / 2, r * step + S / 2
        k = random.random()
        if k < 0.06:
            out.append(f'<rect x="{x}" y="{y}" width="{B}" height="{B}" rx="3" fill="#D3EBC7"/>')
            for _ in range(9):
                out.append(f'<circle cx="{x+8+random.random()*(B-16):.0f}" cy="{y+8+random.random()*(B-16):.0f}" r="{3+random.random()*3:.1f}" fill="#BCDDAD"/>')
            continue
        out.append(f'<rect x="{x}" y="{y}" width="{B}" height="{B}" rx="2" fill="#F4F3F0"/>')
        cols = random.choice([3, 4])
        bw = (B - 8) / cols
        for i in range(cols):
            for top in (True, False):
                if random.random() < 0.2: continue
                h = 18 + random.random() * 20
                yy = y + 4 if top else y + B - 4 - h
                out.append(f'<rect x="{x+4+i*bw+1:.1f}" y="{yy:.1f}" width="{bw-3:.1f}" height="{h:.1f}" fill="#E8E6E2"/>')
# ruas comuns já são o espaço entre blocos (branco)
for i in range(n + 1):
    p = i * step + S / 2 - S / 2
    out.append(f'<rect x="{p}" y="0" width="{S}" height="{T}" fill="#FFFFFF"/>')
    out.append(f'<rect x="0" y="{p}" width="{T}" height="{S}" fill="#FFFFFF"/>')
# avenidas
for i in (2, 6):
    p = i * step
    out.append(f'<rect x="{p-7}" y="0" width="14" height="{T}" fill="#FFFFFF" stroke="#DCDAD5" stroke-width="1"/>')
    out.append(f'<rect x="0" y="{p-7}" width="{T}" height="14" fill="#FFFFFF" stroke="#DCDAD5" stroke-width="1"/>')
p = 4 * step
out.append(f'<rect x="{p-8}" y="0" width="16" height="{T}" fill="#FCE7A8" stroke="#EDCF78" stroke-width="1"/>')
out.append('</svg>')
open(sys.argv[1], 'w').write('\n'.join(out))
