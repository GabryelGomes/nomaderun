"""Gera a 'Unbounded Line': Unbounded 800 com os contornos sobrepostos removidos.
Sem isso, o texto em contorno (-webkit-text-stroke) mostra riscos dentro das letras.
Uso: python3 corrigir_fonte.py <unbounded-latin-800-normal.woff2> <saida.woff2>
(o arquivo de entrada vem de node_modules/@fontsource/unbounded/files/; licença SIL OFL 1.1)"""
import sys
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps

f = TTFont(sys.argv[1])
removeOverlaps(f)
for rec in f['name'].names:
    if rec.nameID in (1, 4, 16):
        rec.string = 'Unbounded Line'
    if rec.nameID == 6:
        rec.string = 'UnboundedLine-ExtraBold'
f.flavor = 'woff2'
f.save(sys.argv[2])
print('ok', sys.argv[2])
