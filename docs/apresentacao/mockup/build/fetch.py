"""Baixa do Overture Maps (dados derivados do OpenStreetMap) as feições reais do entorno do Parque Flamboyant."""
import json, sys, time
import pyarrow.dataset as ds, pyarrow.fs as fs, pyarrow.compute as pc
from shapely import wkb
from shapely.geometry import mapping
W, S, E, N = -49.2640, -16.7390, -49.2130, -16.6830
R = 'overturemaps-us-west-2/release/2026-09-23.1'
s3 = fs.S3FileSystem(anonymous=True, region='us-west-2')
out = sys.argv[1]
def get(theme, typ, cols):
    t = time.time()
    d = ds.dataset(f'{R}/theme={theme}/type={typ}/', filesystem=s3, format='parquet')
    f = (pc.field('bbox', 'xmin') < E) & (pc.field('bbox', 'xmax') > W) & (pc.field('bbox', 'ymin') < N) & (pc.field('bbox', 'ymax') > S)
    tb = d.to_table(filter=f, columns=['geometry'] + cols)
    feats = []
    for row in tb.to_pylist():
        g = wkb.loads(row.pop('geometry'))
        props = {k: v for k, v in row.items() if v is not None}
        if 'names' in props: props['name'] = (props.pop('names') or {}).get('primary')
        feats.append({'type': 'Feature', 'geometry': mapping(g), 'properties': props})
    json.dump({'type': 'FeatureCollection', 'features': feats}, open(f'{out}/{typ}.geojson', 'w'))
    print(typ, len(feats), f'{time.time()-t:.0f}s', flush=True)
get('base', 'water', ['class', 'subtype', 'names'])
get('base', 'land_use', ['class', 'subtype', 'names'])
get('transportation', 'segment', ['class', 'subtype', 'names'])
get('buildings', 'building', ['class', 'height'])
