"""Copia as capturas do mockup (saída do shots2.js) para mockup/imagens no formato usado pelos slides.
Uso: python3 exportar_imagens.py <pasta-capturas> <mockup/imagens>"""
import sys
from PIL import Image
src, dst = sys.argv[1:3]
Image.open(f'{src}/capa-mapa.png').convert('RGB').save(f'{dst}/capa-mapa.jpg', quality=90)
for n in ('tel-mapa', 'tel-corrida', 'tel-conquista'):
    Image.open(f'{src}/{n}.png').save(f'{dst}/{n}.png', optimize=True)
Image.open(f'{src}/hero.png').save(f'{dst}/hero.png', optimize=True)
print('ok')
