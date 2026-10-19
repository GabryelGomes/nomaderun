"""Mapa real (Overture Maps / OpenStreetMap) do entorno do Parque Flamboyant, em SVG escuro,
com a rota da demonstração traçada sobre as ruas de verdade e os territórios do protótipo."""
import json, math, sys
import networkx as nx
from shapely.geometry import shape, Point, LineString, Polygon, mapping
from shapely.ops import transform

D = sys.argv[1]
park = [shape(f['geometry']) for f in json.load(open(f'{D}/land_use.geojson'))['features'] if f['properties'].get('name') == 'Parque Flamboyant'][0]
LAT0, LNG0 = park.centroid.y, park.centroid.x
KX, KY = math.cos(math.radians(LAT0)) * 111320, 110574
def xy(lng, lat): return ((lng - LNG0) * KX, (LAT0 - lat) * KY)
def proj(g): return transform(lambda x, y, z=None: xy(x, y), g)
VIEW = 2100  # raio útil em metros
def near(g): return g.distance(Point(0, 0)) < VIEW
def d_path(g, prec=1):
    def ring(cs, close):
        s = 'M' + 'L'.join(f'{x:.{prec}f} {y:.{prec}f}' for x, y in cs)
        return s + ('Z' if close else '')
    if g.geom_type == 'Polygon':
        return ''.join(ring(r.coords, True) for r in [g.exterior, *g.interiors])
    if g.geom_type == 'MultiPolygon':
        return ''.join(d_path(p, prec) for p in g.geoms)
    if g.geom_type == 'LineString':
        return ring(g.coords, False)
    if g.geom_type == 'MultiLineString':
        return ''.join(ring(l.coords, False) for l in g.geoms)
    return ''

layers = {k: [] for k in ['park', 'water', 'stream', 'bldg', 'path', 'res', 'ter', 'sec', 'pri', 'mot']}
for f in json.load(open(f'{D}/land_use.geojson'))['features']:
    if f['properties'].get('class') in ('park', 'grass', 'garden', 'pitch', 'playground', 'stadium'):
        g = proj(shape(f['geometry']))
        if near(g): layers['park'].append(d_path(g))
for f in json.load(open(f'{D}/water.geojson'))['features']:
    g = proj(shape(f['geometry']))
    if not near(g): continue
    (layers['water'] if g.geom_type.endswith('Polygon') else layers['stream']).append(d_path(g))
for f in json.load(open(f'{D}/building.geojson'))['features']:
    g = proj(shape(f['geometry']))
    if g.area > 40 and near(g): layers['bldg'].append(d_path(g.simplify(1.2), 0))
CLS = {'residential': 'res', 'living_street': 'res', 'unclassified': 'res', 'service': 'path', 'footway': 'path', 'cycleway': 'path',
       'pedestrian': 'path', 'path': 'path', 'steps': 'path', 'tertiary': 'ter', 'secondary': 'sec', 'primary': 'pri', 'trunk': 'mot', 'motorway': 'mot'}
G = nx.Graph()
labels = {}
for f in json.load(open(f'{D}/segment.geojson'))['features']:
    p = f['properties']; k = CLS.get(p.get('class'))
    if not k or f['geometry']['type'] != 'LineString': continue
    g = proj(shape(f['geometry']))
    if not near(g): continue
    layers[k].append(d_path(g.simplify(0.8)))
    name = p.get('name')
    if name and k in ('pri', 'sec') and g.length > 250:
        if name not in labels or g.length > labels[name].length: labels[name] = g
    if k in ('res', 'ter', 'sec', 'pri', 'path'):
        cs = [(round(x, 1), round(y, 1)) for x, y in g.coords]
        for a, b in zip(cs, cs[1:]):
            G.add_edge(a, b, w=math.dist(a, b) * (1.0 if k != 'path' else 1.15))

# Rota: volta pelas ruas que contornam o parque real (pontos a cada ~110 m no contorno, ligados pela malha viária)
road_nodes = [n for n in G.nodes if G.degree(n) > 0]
ring = proj(park).buffer(28).exterior
ring = LineString(list(ring.coords)[::-1])  # sentido anti-horário na tela
N = max(8, int(ring.length // 110))
wp = []
for i in range(N + 1):
    q = ring.interpolate(i / N, normalized=True)
    wp.append(min(road_nodes, key=lambda n: (n[0] - q.x) ** 2 + (n[1] - q.y) ** 2))
pts = []
for a_, b_ in zip(wp, wp[1:]):
    if a_ == b_: continue
    seg = nx.shortest_path(G, a_, b_, weight='w')
    pts += seg if not pts else seg[1:]
# remove idas e voltas (espora A→B→A) criadas pelo encaixe dos pontos
clean = []
for p in pts:
    if len(clean) >= 2 and clean[-2] == p: clean.pop(); continue
    if clean and clean[-1] == p: continue
    clean.append(p)
pts = clean
route = LineString(pts)
print('rota', round(route.length), 'm', file=sys.stderr)

# Território do protótipo, deslocado para o parque real
game = json.load(open(f'{D}/game.json'))
c = game['center']; DLAT, DLNG = LAT0 - (-16.7108), LNG0 - (-49.2394)
def gxy(p): return xy(p['lng'] + DLNG, p['lat'] + DLAT)
TEAM = {'striders': '#2FA8FF', 'volt': '#19E6A8', 'owls': '#FF4FD8', 'coyotes': '#FFD60A'}
regions = []
for r in game['regions']:
    rings = [[gxy(p) for p in ring] for ring in r['rings']]
    poly = Polygon(rings[0], rings[1:])
    if poly.distance(Point(0, 0)) < VIEW:
        regions.append({'owner': r['owner'], 'color': TEAM[r['owner']], 'd': d_path(poly)})
contested = [{'color': TEAM[z['attacker']], 'd': d_path(Polygon([gxy(p) for p in z['ring']]))} for z in game['contested']]
chests = [gxy(ch['position']) for ch in game['chests']]
lab = [{'name': n, 'd': d_path(g if g.coords[0][0] < g.coords[-1][0] else LineString(g.coords[::-1]))} for n, g in labels.items()]

json.dump({'layers': {k: ''.join(v) for k, v in layers.items()}, 'labels': lab, 'route': d_path(route), 'routeLen': route.length,
           'routePts': [[round(x, 1), round(y, 1)] for x, y in route.coords], 'regions': regions, 'contested': contested,
           'chests': [[round(x), round(y)] for x, y in chests], 'origin': [LAT0, LNG0]}, open(f'{D}/mapa.json', 'w'))
print({k: len(v) for k, v in layers.items()}, file=sys.stderr)

