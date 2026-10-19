# Mockup NOMADE RUN (preto + laranja neon)

- `NOMADE RUN Mockup.html`: página interativa (hover, cursor reativo, rota desenhando, celulares em 3D).
- `imagens/`: capa com o mapa e os três celulares em PNG transparente, usados nos slides.

## Mapa real

As ruas, prédios, parques e água vêm do **Overture Maps** (dados derivados do OpenStreetMap), release 2026-09-23.1, recorte do entorno do Parque Flamboyant, em Goiânia.
Mapa: © OpenStreetMap contributors, via Overture Maps Foundation (ODbL).
A volta de 2,02 km segue as ruas reais em torno do parque. O território e a zona disputada são do protótipo (`apps/mobile/src/demo`).

## Regerar

```bash
pip install pyarrow shapely networkx
python3 build/fetch.py <pasta>          # baixa as feições do S3 público do Overture
npx tsx build/export-game.ts <pasta>/game.json   # rodar dentro de apps/mobile
python3 build/mapa.py <pasta>           # gera mapa.json (mapa escuro + rota pelas ruas)
python3 build/gen.py build/mapa.json "NOMADE RUN Mockup.html" google
```
