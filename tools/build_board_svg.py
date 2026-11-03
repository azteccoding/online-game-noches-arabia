"""Genera el tablero 100% VECTORIAL (sin PNG, sin filtros SVG, sin <text>/fuentes) a partir de Natural Earth.

Salidas:
  public/svg/tablero-mapa.svg   mapa estático: mares, costas, ríos, montañas, desiertos, rótulos y caligrafía (todo path)
  public/svg/tablero-mini.svg   mapa simplificado para el minimapa
  src/data/tablero.json         ciudades, rutas (path d), tarifas (cifras como path) y metadatos de zoom
Uso: python3 tools/build_board_svg.py        (requiere fonttools + uharfbuzz, solo para generar)
Criterios (ver plan, sección «Tablero nítido»):
  - Coordenadas con 1 decimal: error de cuantización ≤ 0.05 unidades.
  - Costas suavizadas con curvas cuadráticas (sin facetas) y ondulación determinista horneada en la geometría
    (el aspecto «dibujado a mano» no usa filtros: los filtros se rasterizan y se pixelan al hacer zoom).
  - Texturas procedurales como <pattern> vectorial (grano, fibras, ondas, arena)."""
import json, math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapgeo import *            # P, W, H, CITIES, JORASAN, D, EDGES, DESIERTOS, MONTES, rings_of, rdp, poly_pts, pip, fare_pos, edge_pts, G
from textpath import text_path, text_use, glyph_defs

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
Q = 0.1                          # cuantización de coordenadas (unidades de tablero)
MARCELLUS, ALEGREYA_I, ARAF = 'MarcellusSC.ttf', 'Alegreya-Italic.ttf', 'ArefRuqaa-Bold.ttf'
INK, CREAM, WINE, BLUE = '#2b130c', '#f1e3b8', '#7b1e24', '#22407f'

LABEL = {'Bagdad': (0, -82, 'middle'), 'Damasco': (-30, 22, 'end'), 'Aleppo': (0, -70, 'middle'), 'Estambul': (-6, -70, 'middle'), 'El Cairo': (0, 62, 'middle'),
         'Basra': (34, 36, 'start'), 'Isfahán': (34, 8, 'start'), 'Samarcanda': (0, -70, 'middle'), 'India': (-30, 50, 'end'), 'Yemen': (0, 62, 'middle'),
         'Magreb': (-30, 58, 'middle'), 'Andalucía': (-6, -70, 'start')}


def f(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def wob(x, y, a=3.2):
    """Ondulación suave determinista (misma para costa, halo y ríos: todo encaja)."""
    dx = math.sin(x * 0.021 + 1.3 * math.sin(y * 0.013)) + 0.5 * math.sin(y * 0.047 + x * 0.011) + 0.25 * math.sin(x * 0.11 + y * 0.09)
    dy = math.sin(y * 0.019 + 1.1 * math.sin(x * 0.015)) + 0.5 * math.sin(x * 0.043 - y * 0.013) + 0.25 * math.sin(y * 0.12 - x * 0.08)
    return x + a * dx, y + a * dy


def quad_path(pts, closed=True, a=3.2):
    pts = [wob(x, y, a) for x, y in pts]
    n = len(pts)
    if n < 3:
        return ''
    cur = None
    out = []
    def mid(p, q): return ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
    def rnd(p): return (round(p[0] / Q) * Q, round(p[1] / Q) * Q)
    if closed:
        s = rnd(mid(pts[-1], pts[0])); out.append('M' + f(s[0]) + ',' + f(s[1])); cur = s
        for i in range(n):
            c = rnd(pts[i]); e = rnd(mid(pts[i], pts[(i + 1) % n]))
            out.append('q' + f(c[0] - cur[0]) + ',' + f(c[1] - cur[1]) + ' ' + f(e[0] - cur[0]) + ',' + f(e[1] - cur[1])); cur = e
        out.append('z')
    else:
        s = rnd(pts[0]); out.append('M' + f(s[0]) + ',' + f(s[1])); cur = s
        for i in range(1, n - 1):
            c = rnd(pts[i]); e = rnd(mid(pts[i], pts[i + 1]))
            out.append('q' + f(c[0] - cur[0]) + ',' + f(c[1] - cur[1]) + ' ' + f(e[0] - cur[0]) + ',' + f(e[1] - cur[1])); cur = e
        e = rnd(pts[-1]); out.append('L' + f(e[0]) + ',' + f(e[1]))
    return ''.join(out)


def cubic_path(pts, t=0.9):
    """Catmull-Rom -> Bézier con 1 decimal (rutas; sin ondulación para que coincidan con ciudades)."""
    r = lambda v: f(round(v / Q) * Q)
    if len(pts) == 2:
        return f'M{r(pts[0][0])},{r(pts[0][1])}L{r(pts[1][0])},{r(pts[1][1])}'
    d = f'M{r(pts[0][0])},{r(pts[0][1])}'
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[i + 2] if i + 2 < len(pts) else pts[i + 1]
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3); c2 = (p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3)
        d += f'C{r(c1[0])},{r(c1[1])} {r(c2[0])},{r(c2[1])} {r(p2[0])},{r(p2[1])}'
    return d


def peak(x, y, s):
    w = 26 * s; h = 30 * s
    return (f'<path d="M{f(x-w)},{f(y)}L{f(x-w*.2)},{f(y-h)}L{f(x+w*.15)},{f(y-h*.72)}L{f(x+w*.35)},{f(y-h)}L{f(x+w)},{f(y)}" fill="#d8c08a" stroke="#6a4520" stroke-width="{3.2*s:.1f}" stroke-linejoin="round"/>'
            f'<path d="M{f(x-w*.2)},{f(y-h)}L{f(x+w*.05)},{f(y-h*.3)}L{f(x+w*.55)},{f(y-h*.2)}L{f(x+w*.35)},{f(y-h)}z" fill="#9b7a45" opacity=".45"/>')


def mountains(rng, scale):
    out = []
    for name, pts in MONTES.items():
        pp = poly_pts(pts)
        for i in range(len(pp) - 1):
            (x0, y0), (x1, y1) = pp[i], pp[i + 1]; n = max(2, int(math.hypot(x1 - x0, y1 - y0) / (34 * scale)))
            for k in range(n + 1):
                u = k / n
                out.append((x0 + (x1 - x0) * u + rng.uniform(-14, 14), y0 + (y1 - y0) * u + rng.uniform(-12, 12), rng.uniform(.8, 1.25) * scale))
    out.sort(key=lambda t: t[1])
    return out


def defs():
    rng = random.Random(5)
    grano = ''.join(f'<circle cx="{rng.uniform(0,90):.0f}" cy="{rng.uniform(0,90):.0f}" r="{rng.uniform(.5,1.5):.1f}"/>' for _ in range(34))
    fibras = ''.join(f'<path d="M{(x:=rng.uniform(0,120)):.0f},{(y:=rng.uniform(0,120)):.0f}l{rng.uniform(-14,14):.0f},{rng.uniform(-6,6):.0f}"/>' for _ in range(22))
    arena = ''.join(f'<circle cx="{rng.uniform(0,64):.0f}" cy="{rng.uniform(0,64):.0f}" r="{rng.uniform(.9,2.2):.1f}"/>' for _ in range(30))
    return f'''<defs>
<radialGradient id="mar" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#86ada6"/><stop offset=".7" stop-color="#6f9a96"/><stop offset="1" stop-color="#4b777c"/></radialGradient>
<linearGradient id="tierra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2cf9a"/><stop offset=".5" stop-color="#ecdcae"/><stop offset="1" stop-color="#e6d19a"/></linearGradient>
<radialGradient id="vig" cx="50%" cy="50%" r="72%"><stop offset=".62" stop-color="#2b130c" stop-opacity="0"/><stop offset="1" stop-color="#2b130c" stop-opacity=".5"/></radialGradient>
<linearGradient id="bruma" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8c490" stop-opacity=".95"/><stop offset="1" stop-color="#d8c490" stop-opacity="0"/></linearGradient>
<pattern id="olas" width="70" height="46" patternUnits="userSpaceOnUse"><path d="M4,14q8,-9 16,0t16,0t16,0" fill="none" stroke="#e8f2ee" stroke-width="2.2" opacity=".55" stroke-linecap="round"/><path d="M38,38q8,-9 16,0t16,0" fill="none" stroke="#e8f2ee" stroke-width="2" opacity=".4" stroke-linecap="round"/></pattern>
<pattern id="grano" width="90" height="90" patternUnits="userSpaceOnUse"><g fill="#8a6330" opacity=".22">{grano}</g></pattern>
<pattern id="fibras" width="120" height="120" patternUnits="userSpaceOnUse"><g fill="none" stroke="#b08a4c" stroke-width="1.1" opacity=".3" stroke-linecap="round">{fibras}</g></pattern>
<pattern id="arena" width="64" height="64" patternUnits="userSpaceOnUse"><g fill="#8a6330" opacity=".55">{arena}</g></pattern>
</defs>'''


def label_layer():
    o = []
    for t, lon, lat, sz, rot in [('Mar Mediterráneo', 17, 35.1, 44, 0), ('Mar Negro', 34.5, 43.2, 38, 0), ('Mar Caspio', 51.2, 41.3, 34, -80), ('Mar Rojo', 37.3, 19.6, 34, -55),
                                 ('Golfo Pérsico', 51.6, 27.6, 32, -38), ('Océano Índico', 58, 5.2, 56, 0), ('Mar Arábigo', 66, 19, 34, 0), ('Océano Atlántico', -8.8, 30, 38, -90)]:
        x, y = P(lon, lat); o.append(text_use(t, ALEGREYA_I, sz, x, y, 'middle', '#e8f2ee', spacing=10, rot=rot, opacity=.85))
    for t, lon, lat, sz in [('ANATOLIA', 32.3, 38.9, 40), ('ARABIA', 45.5, 24, 58), ('PERSIA', 55.5, 29.6, 52), ('ASIA CENTRAL', 60, 44.3, 46), ('SAHARA', 12, 24.5, 60), ('EGIPTO', 29.7, 26.6, 34), ('SIRIA', 37.6, 35, 26), ('ABISINIA', 38.5, 10.5, 34)]:
        x, y = P(lon, lat); o.append(text_use(t, MARCELLUS, sz, x, y, 'middle', '#6a4520', spacing=18, opacity=.5))
    for t, lon, lat, rot in [('Atlas', -2.5, 32.8, -12), ('Zagros', 50, 32.6, -48), ('Hindu Kush', 70, 35, -20), ('Cáucaso', 43.5, 42.8, -8), ('Tauro', 35.5, 38.3, 0)]:
        x, y = P(lon, lat); o.append(text_use(t, ALEGREYA_I, 26, x, y, 'middle', '#5a3a17', spacing=4, rot=rot, opacity=.75))
    for t, lon, lat in [('Toledo', -4.1, 40.9), ('Timbuktú', -2.0, 17.2), ('Meca y Medina', 40.3, 22.4), ('China →', 77.2, 43.3)]:
        x, y = P(lon, lat)
        o.append(f'<g opacity=".38"><circle cx="{x:.0f}" cy="{y:.0f}" r="7" fill="#5a3a17"/>{text_use(t, ALEGREYA_I, 36, x, y - 16, "middle", "#3b2410")}</g>')
    for n, (lon, lat, ar) in CITIES.items():
        x, y = P(lon, lat); dx, dy, an = LABEL[n]; big = n == 'Bagdad'
        tx, ty = x + dx, y + dy
        o.append(text_use(n, MARCELLUS, 56 if big else 46, tx, ty, an, INK, CREAM, 9))
        o.append(text_use(ar, ARAF, 40, tx, ty + 40, an, WINE, CREAM, 7, rtl=True))
    jx, jy = P(*JORASAN)
    o.append(text_use('Jorasán', MARCELLUS, 42, jx + 44, jy + 12, 'start', INK, CREAM, 8))
    return ''.join(o)


def deco_layer(rng):
    o = []
    def ship(x, y, s=1, fl=1):
        return (f'<g transform="translate({x:.0f},{y:.0f}) scale({s*fl:.2f},{s:.2f})"><path d="M-34,0L34,0L24,16L-24,16z" fill="#7a4e1d" stroke="#2b130c" stroke-width="3"/><path d="M0,0L0,-52M0,-50L30,-8L0,-8zM-4,-44L-26,-10L-4,-10z" fill="#f6ecd0" stroke="#2b130c" stroke-width="3" stroke-linejoin="round"/><path d="M-40,22q10,-8 20,0t20,0t20,0t20,0" fill="none" stroke="#e8f2ee" stroke-width="3"/></g>')
    for lon, lat, s, fl in [(18, 34.4, 1.0, 1), (8, 36.8, .9, -1), (60, 15.5, 1.1, 1), (39.1, 16.4, .8, 1)]:
        x, y = P(lon, lat); o.append(ship(x, y, s * 1.3, fl))
    cx, cy = P(48.5, 22.6)
    for i in range(4):
        o.append(f'<g transform="translate({cx+i*74:.0f},{cy+(i%2)*10-i*14:.0f}) scale(1.35)" fill="#4a2c12"><path d="M-30,-18q8,-18 18,-4q8,-16 18,0l6,0l8,-16l8,2l-6,12l-6,2l2,32l-6,0l-2,-24l-22,0l-2,24l-6,0l2,-26q-6,0 -4,-2z"/></g>')
    sx, sy = P(57, 9.3)
    o.append(f'<g transform="translate({sx:.0f},{sy:.0f}) scale(1.5)" fill="none" stroke="#2b130c" stroke-width="5" stroke-linecap="round"><path d="M-80,10q20,-34 40,0t40,0t40,0q16,0 20,-26q4,-14 -8,-16q-10,0 -6,10"/><path d="M-80,10q20,-20 40,0t40,0t40,0" stroke="#e8f2ee" stroke-width="2" opacity=".6"/><circle cx="82" cy="-40" r="3" fill="#2b130c" stroke="none"/></g>')
    rx, ry = P(72.5, 5.6)
    n_txt = text_use('N', MARCELLUS, 34, 0, -128, 'middle', '#3b2410')
    o.append(f'<g transform="translate({rx:.0f},{ry:.0f}) scale(1.15)" opacity=".95"><circle r="86" fill="#f1e3b8" fill-opacity=".55" stroke="#3b2410" stroke-width="3"/><circle r="70" fill="none" stroke="#7a4e1d" stroke-width="2"/>'
             '<path d="M0,-118L16,-16L0,0zM0,118L-16,16L0,0zM-118,0L-16,-16L0,0zM118,0L16,16L0,0z" fill="#7b1e24"/><path d="M0,-118L-16,-16L0,0zM0,118L16,16L0,0zM-118,0L-16,16L0,0zM118,0L16,-16L0,0z" fill="#efd08f" stroke="#7b1e24" stroke-width="2"/>'
             f'<path d="M0,-70L12,-12L70,0L12,12L0,70L-12,12L-70,0L-12,-12z" fill="none" stroke="#3b2410" stroke-width="2" transform="rotate(45)"/>{n_txt}</g>')
    cx0, cy0 = P(11, 10.5); cw, ch = 860, 250
    t1 = text_use('Mil y una Noches', MARCELLUS, 88, cw / 2, 108, 'middle', '#2b130c', spacing=4)
    t2 = text_use('Las Noches de Arabia · sin escala', ALEGREYA_I, 46, cw / 2, 172, 'middle', '#7b1e24')
    o.append(f'<g transform="translate({cx0-cw/2:.0f},{cy0-ch/2:.0f})"><rect x="6" y="9" width="{cw}" height="{ch}" rx="14" fill="#000" opacity=".28"/><rect width="{cw}" height="{ch}" rx="14" fill="#f1e3b8" stroke="#7b1e24" stroke-width="7"/><rect x="14" y="14" width="{cw-28}" height="{ch-28}" rx="8" fill="none" stroke="#b9803a" stroke-width="3.5"/>{t1}{t2}</g>')
    return ''.join(o)


def build_map():
    rng = random.Random(11)
    land = rings_of('ne_50m_land.geojson', eps=1.4, min_area=120)
    land_d = ''.join(quad_path(c) for c, _, _ in land)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">', defs()]
    o.append(f'<rect width="{W}" height="{H}" fill="#1d0709"/><rect x="40" y="40" width="{W-80}" height="{H-80}" fill="url(#mar)"/><rect x="40" y="40" width="{W-80}" height="{H-80}" fill="url(#olas)"/>')
    o.append(f'<defs><path id="costa" d="{land_d}" fill-rule="evenodd"/></defs>')
    o.append('<g fill="none" stroke="#cfe3dc" stroke-linejoin="round"><use href="#costa" stroke-width="46" opacity=".16"/><use href="#costa" stroke-width="28" opacity=".2"/><use href="#costa" stroke-width="12" opacity=".28"/></g>')
    o.append('<use href="#costa" fill="url(#tierra)" stroke="#4a2c12" stroke-width="3.6" stroke-linejoin="round"/>')
    o.append(f'<clipPath id="cl"><use href="#costa" clip-rule="evenodd"/></clipPath><g clip-path="url(#cl)"><rect width="{W}" height="{H}" fill="url(#fibras)"/><rect width="{W}" height="{H}" fill="url(#grano)"/>')
    for nm, poly in DESIERTOS.items():
        pp = poly_pts(poly); d = quad_path(pp, True, 6)
        o.append(f'<path d="{d}" fill="url(#arena)" stroke="#8a6330" stroke-width="2" stroke-dasharray="1 9" stroke-linecap="round" opacity=".7"/>')
        xs = [p[0] for p in pp]; ys = [p[1] for p in pp]; dunes = []
        for _ in range(int(12 + (max(xs) - min(xs)) * (max(ys) - min(ys)) / 40000)):
            x = rng.uniform(min(xs), max(xs)); y = rng.uniform(min(ys), max(ys))
            if pip(x, y, pp):
                dunes.append(f'M{f(x)},{f(y)}q14,-12 30,0t30,0')
        o.append(f'<path d="{"".join(dunes)}" fill="none" stroke="#8a6330" stroke-width="2.6" stroke-linecap="round" opacity=".5"/>')
    rv = json.load(open(G + 'ne_50m_rivers_lake_centerlines.geojson')); rd = []
    for ft in rv['features']:
        if ft['properties'].get('name') not in ('Nile', 'Tigris', 'Euphrates', 'Indus', 'Amu Darya', 'Syr Darya'):
            continue
        g = ft['geometry']; lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        for ln in lines:
            pr = [P(*c[:2]) for c in ln]
            if max(p[0] for p in pr) < 0 or min(p[0] for p in pr) > W or max(p[1] for p in pr) < 0 or min(p[1] for p in pr) > H:
                continue
            pr = rdp(pr, 1.6)
            if len(pr) >= 3:
                rd.append(quad_path(pr, False, 3))
    o.append(f'<path d="{"".join(rd)}" fill="none" stroke="#3f7f82" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>')
    o.append('<g>' + ''.join(peak(*m) for m in mountains(rng, 1.25)) + '</g></g>')
    o.append(f'<rect width="{W}" height="330" fill="url(#bruma)" opacity=".8"/><rect width="{W}" height="{H}" fill="url(#vig)"/>')
    lab = label_layer(); dec = deco_layer(rng)
    o.append(glyph_defs()); o.append(lab); o.append(dec)
    o.append(f'<rect x="26" y="26" width="{W-52}" height="{H-52}" fill="none" stroke="#b9803a" stroke-width="6" opacity=".9"/><rect x="42" y="42" width="{W-84}" height="{H-84}" fill="none" stroke="#7a4e1d" stroke-width="2.5" opacity=".9"/>')
    o.append('</svg>')
    return ''.join(o)


def build_mini():
    land = rings_of('ne_50m_land.geojson', eps=5, min_area=900)
    d = ''.join('M' + 'L'.join(f'{x:.0f},{y:.0f}' for x, y in c) + 'z' for c, _, _ in land)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="#4b777c"/>'
            f'<path d="{d}" fill="#e2cf9a" fill-rule="evenodd" stroke="#4a2c12" stroke-width="10"/></svg>')


DIG = {}


def digits(text, size=22):
    """Cifras de tarifa: glifos compartidos en tablero.json['glifos'] y por tarifa [[digito, x], ...] centradas en 0."""
    adv = []
    tot = 0.0
    for ch in text:
        d, w = text_path(ch, MARCELLUS, size, 0, size * 0.36, 'start')
        DIG[ch] = d
        adv.append((ch, tot)); tot += w
    return [[c, round(x - tot / 2, 1)] for c, x in adv]


def board_data():
    cities = {}
    for n, (lon, lat, ar) in CITIES.items():
        x, y = P(lon, lat); dx, dy, an = LABEL[n]
        cities[n] = {'x': round(x, 1), 'y': round(y, 1), 'ar': ar, 'label': {'dx': dx, 'dy': dy, 'anchor': an}}
    jx, jy = P(*JORASAN)
    routes = []
    for a, b, md, wp in EDGES:
        pts = edge_pts(a, b, wp); d = cubic_path(pts)
        fares = {}
        for (u, v, pp) in [(a, b, pts), (b, a, pts[::-1])]:
            if (u, v) in D:
                x, y = fare_pos(pp, .3)
                fares[u + '>' + v] = {'fare': D[(u, v)], 'x': round(x, 1), 'y': round(y, 1), 'g': digits(str(D[(u, v)]))}
        routes.append({'a': a, 'b': b, 'mode': {'t': 'tierra', 'r': 'rio', 'm': 'mar'}[md], 'd': d, 'fares': fares, 'points': [[round(px, 1), round(py, 1)] for px, py in pts]})
    return {'width': W, 'height': H, 'cities': cities, 'jorasan': {'x': round(jx, 1), 'y': round(jy, 1)}, 'routes': routes,
            'glifos': DIG, 'zoom': {'cuantizacion': Q, 'spanMaxPct': 0.60, 'spanMinUnidades': 220, 'overscan': 0.25}}


if __name__ == '__main__':
    os.makedirs(ROOT + '/public/svg', exist_ok=True)
    for fn, s in [('tablero-mapa.svg', build_map()), ('tablero-mini.svg', build_mini())]:
        open(f'{ROOT}/public/svg/{fn}', 'w', encoding='utf-8').write(s)
        import gzip
        print(fn, len(s.encode()) // 1024, 'KB (gzip', len(gzip.compress(s.encode())) // 1024, 'KB)')
    json.dump(board_data(), open(ROOT + '/src/data/tablero.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('tablero.json', os.path.getsize(ROOT + '/src/data/tablero.json') // 1024, 'KB')
