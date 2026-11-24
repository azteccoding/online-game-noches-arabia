# Giro continuo de los monitos de ocho vistas (24 de noviembre de 2026). Jorge: al girar, el paso de una pintura a la otra se
# veía como un salto, «parece que se desvanecen en polvo del color de sus ropas y luego vuelven a aparecer».
# Aquí se calcula, para cada par de pinturas vecinas (están a 45°), a dónde va a parar en la vecina cada punto de la pintura:
# con eso figuras8.js va deformando la pintura hacia la siguiente conforme gira la figura (la silueta y los rasgos se corren
# poco a poco) y, a medio camino, las dos ya casan y el relevo es un fundido corto entre dos imágenes casi iguales.
# Uso, desde la raíz del repositorio (preparar-vistas8.py y «monitos.py usar» ya lo llaman solos):
#     python3 src/escena3d/herramientas/preparar-giro8.py <id> [<id> …]        sin ids: todos los monitos de ocho vistas
#     VISTA=<carpeta> …   guarda además, por par, una tira de control: A a medio camino | las dos mezcladas | B a medio camino
# Solo lee public/arte3d/fig-<id>.webp y añade «giro8», «giroEsc» y «giroPaso» a la entrada del personaje en src/escena3d/datos/figuras.json;
# no toca las pinturas ni el atlas. Necesita Pillow, numpy y scipy.
#
# Cómo: al girar sobre su eje, cada punto de la figura se mueve solo de lado, así que cada fila de una pintura se corresponde
# con la misma fila de la vecina. Fila por fila se busca el emparejamiento que mejor casa colores y contorno sin cruzarse
# (programación dinámica, como en visión estéreo), apoyado en las filas de arriba y abajo y en un mapa previo (el tramo de la
# silueta de una va al de la otra, girando como un cilindro). Lo que una vista enseña y la otra no, se encoge hacia el borde.
import sys, os, json, base64
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..', '..'))
A = os.path.join(RAIZ, 'public', 'arte3d'); FIGURAS = os.path.join(AQUI, '..', 'datos', 'figuras.json')
R = 2                      # se trabaja a media resolución
TAU = 28.0                 # diferencia de color a partir de la cual dos puntos ya «no se parecen»
KAPPA = 0.42               # lo que cuesta dejar un punto de la figura sin pareja (queda tapado en la otra vista)
SIG_Y = 5.0                # cuántas filas vecinas apoyan a cada fila
RHO = 0.55                 # cuánto «gira como cilindro» el mapa previo (1 = cilindro redondo, 0 = lámina plana)
ESTIRA = [0.33, 3.0]       # lo más que puede encogerse o estirarse un trozo de pintura al llegar a la vecina
GRUESO = 2                 # el desplazamiento se guarda cada GRUESO vértices de la cáscara (es suave; figuras8.js lo interpola)


def teselas(d, pid):
    im = np.asarray(Image.open(os.path.join(A, f'fig-{pid}.webp')).convert('RGBA'))
    tw, th = d['tw'], d['th']; filas = d.get('filas', 1); nt = d['vistas'] + (1 if d.get('cenital') else 0); cols = -(-nt // filas)
    return [im[(n // cols) * th:(n // cols + 1) * th, (n % cols) * tw:(n % cols + 1) * tw] for n in range(d['vistas'])]


def lab(rgb):
    c = rgb.astype(np.float32) / 255; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]], np.float32) / np.array([0.9505, 1.0, 1.089], np.float32)
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def rasgos(t):
    """Media resolución: color (Lab suavizado; la luz pintada cambia de una vista a otra y pesa menos) y máscara."""
    im = Image.fromarray(t).reduce(R); a = np.asarray(im)
    rgb = np.stack([ndi.gaussian_filter(a[:, :, c].astype(np.float32), 1.2) for c in range(3)], -1)
    L = lab(rgb); L[:, :, 0] *= 1.53
    return L.astype(np.float32), a[:, :, 3] > 127


def previo(mA, mB, theta):
    """Mapa previo por fila: el tramo [izquierda, derecha] de A va al de B y dentro los rasgos corren como en un cilindro que gira."""
    h, w = mA.shape; x = np.arange(w, dtype=np.float32); P = np.tile(x, (h, 1))
    def bordes(m):
        mm = ndi.binary_closing(m, iterations=2) | m; hay = mm.any(1)
        return hay, np.where(hay, mm.argmax(1), 0).astype(np.float32), np.where(hay, w - 1 - mm[:, ::-1].argmax(1), w - 1).astype(np.float32)
    hA, LA, RA = bordes(mA); hB, LB, RB = bordes(mB)
    for y in range(h):
        if not (hA[y] and hB[y]): continue
        u = np.clip((x - LA[y]) / max(1.0, RA[y] - LA[y]) * 2 - 1, -1, 1)
        ub = np.sin(np.clip(np.arcsin(u) - theta * RHO, -np.pi / 2, np.pi / 2)); pb = LB[y] + (ub + 1) / 2 * (RB[y] - LB[y])
        P[y] = np.where(x < LA[y], LB[y] - (LA[y] - x), np.where(x > RA[y], RB[y] + (x - RA[y]), pb))      # fuera del tramo se conserva la distancia al borde
    return ndi.gaussian_filter1d(P, 3.0, axis=0)


def emparejar(labA, mA, labB, mB, P, lam, ancho):
    """F[y, xa] = a qué columna de B va la columna xa de A (creciente en cada fila)."""
    h, w = mA.shape; C = np.empty((h, w, w), np.float32); xb = np.arange(w, dtype=np.float32)[None, :]
    for xa in range(w):
        dif = np.sqrt(((labA[:, xa:xa + 1, :] - labB) ** 2).sum(2)); c = np.minimum(dif, TAU) / TAU; a = mA[:, xa:xa + 1]
        C[:, xa, :] = np.where(a & mB, c, np.where(a | mB, 1.6, 0.0))      # figura con papel casi nunca; papel con papel, gratis
    C = ndi.gaussian_filter1d(C, SIG_Y, axis=0)
    for xa in range(w): C[:, xa, :] += lam * 0.5 * np.minimum(np.abs(xb - P[:, xa:xa + 1]) / (ancho * w), 2.0) ** 2
    saltaA = np.where(ndi.gaussian_filter1d(mA.astype(np.float32), SIG_Y, axis=0) > 0.5, KAPPA, 0.02).astype(np.float32)
    saltaB = np.where(ndi.gaussian_filter1d(mB.astype(np.float32), SIG_Y, axis=0) > 0.5, KAPPA, 0.02).astype(np.float32)
    S0 = np.concatenate([np.zeros((h, 1), np.float32), np.cumsum(saltaB, axis=1)], axis=1)
    D = S0.copy(); elec = np.zeros((h, w + 1, w + 1), np.uint8); elec[:, 0, 1:] = 2
    for xa in range(1, w + 1):
        diag = D[:, :-1] + C[:, xa - 1, :]; izq = D + saltaA[:, xa - 1:xa]
        E = izq.copy(); E[:, 1:] = np.minimum(E[:, 1:], diag); ch = np.ones((h, w + 1), np.uint8); ch[:, 1:][diag < izq[:, 1:]] = 0
        D = S0 + np.minimum.accumulate(E - S0, axis=1); ch[D < E - 1e-7] = 2; elec[:, xa] = ch
    F = np.zeros((h, w), np.float32)
    for y in range(h):
        xa, b = w, w; e = elec[y]
        while xa > 0:
            c = e[xa, b]
            if c == 0: xa -= 1; b -= 1; F[y, xa] = b
            elif c == 1: xa -= 1; F[y, xa] = b - 0.5
            else: b -= 1
    return F


def limitar(F, m):
    """Reparte el estirado dentro de cada tramo de figura de cada fila: los extremos del tramo no se mueven (el contorno sigue
    casando con el de la vecina) y ningún trozo se estira o se encoge más de ESTIRA, salvo que el tramo entero lo haga."""
    out = F.copy(); lo, hi = ESTIRA
    for y in range(F.shape[0]):
        cambios = np.flatnonzero(np.diff(np.concatenate([[0], m[y].astype(np.int8), [0]])))
        for i0, i1 in zip(cambios[::2], cambios[1::2] - 1):
            n = i1 - i0
            if n < 2: continue
            s = np.diff(F[y, i0:i1 + 1]); T = s.sum()
            if T <= lo * n or T >= hi * n: s2 = np.full(n, T / n, np.float32)
            else:
                s2 = np.clip(s, lo, hi); falta = T - s2.sum()
                if falta > 1e-6: cap = hi - s2; s2 = s2 + cap * (falta / cap.sum())
                elif falta < -1e-6: cap = s2 - lo; s2 = s2 + cap * (falta / cap.sum())
            out[y, i0:i1 + 1] = F[y, i0] + np.concatenate([[0], np.cumsum(s2)])
    return out


def alisar(F, sy, sx, m=None):
    G = ndi.gaussian_filter(F, (sy, sx), mode='nearest')
    if m is not None: G = ndi.gaussian_filter(limitar(G, m), (sy / 2, sx / 2), mode='nearest')
    return np.maximum.accumulate(G, axis=1)


def invertir(F):
    x = np.arange(F.shape[1], dtype=np.float32); G = np.empty_like(F)
    for y in range(F.shape[0]): G[y] = np.interp(x, F[y] + x * 1e-4, x)
    return G


def par(tA, tB):
    """Mapas (a media resolución) de A hacia B y de B hacia A; A es la vista de menor azimut."""
    labA, mA = rasgos(tA); labB, mB = rasgos(tB)
    F = emparejar(labA, mA, labB, mB, previo(mA, mB, np.pi / 4), 0.9, 0.12)
    F = emparejar(labA, mA, labB, mB, alisar(F, 10, 5), 2.0, 0.05)      # segunda vuelta: se apoya en la primera, ya alisada
    F = alisar(F, 7, 3, mA)
    return F, invertir(F)


def nudos(d):
    P = d['paso']; return -(-(d['tw'] // P) // GRUESO) + 1, -(-(d['th'] // P) // GRUESO) + 1


def en_rejilla(F, d):
    """Desplazamiento (en píxeles de la tesela, hacia la derecha de la pintura) en la rejilla gruesa: un nudo cada GRUESO vértices de la cáscara."""
    P = d['paso'] * GRUESO; cx, cy = nudos(d)
    ys = np.minimum(np.arange(cy) * P, d['th'] - 1); xs = np.minimum(np.arange(cx) * P, d['tw'] - 1)
    yy, xx = np.meshgrid((ys - (R - 1) / 2) / R, (xs - (R - 1) / 2) / R, indexing='ij')
    f = ndi.map_coordinates(F, [yy, xx], order=1, mode='nearest') * R + (R - 1) / 2
    return f - xs[None, :]


# --- tira de control (solo con VISTA): cada pintura llevada a medio camino y las dos mezcladas
def deformar(t, D, d, s):
    P = d['paso'] * GRUESO; h, w = t.shape[:2]; x = np.arange(w, dtype=np.float32); gxs = np.minimum(np.arange(D.shape[1]) * P, w - 1); gys = np.minimum(np.arange(D.shape[0]) * P, h - 1)
    out = np.zeros_like(t)
    for y in range(h):
        j = np.searchsorted(gys, y, side='right') - 1; j1 = min(j + 1, len(gys) - 1); v = 0 if j1 == j else (y - gys[j]) / (gys[j1] - gys[j])
        dx = np.interp(x, gxs, D[j] * (1 - v) + D[j1] * v); xt = np.maximum.accumulate(x + s * dx) + x * 1e-4; src = np.interp(x, xt, x)
        i0 = np.clip(np.floor(src).astype(int), 0, w - 2); fr = (src - i0)[:, None]
        fila = t[y, i0].astype(np.float32) * (1 - fr) + t[y, i0 + 1].astype(np.float32) * fr
        fila[(x < xt[0]) | (x > xt[-1])] = 0; out[y] = fila
    return out


def sobre(t, fondo=(58, 63, 74)):
    a = t[:, :, 3:4].astype(np.float32) / 255; return (t[:, :, :3] * a + np.array(fondo, np.float32) * (1 - a)).astype(np.uint8)


def preparar(pid, figuras=None, guardar=True):
    """Añade giro8 y giroEsc a la entrada del personaje. Devuelve la entrada."""
    propio = figuras is None
    if propio: figuras = json.load(open(FIGURAS, encoding='utf8'))
    d = figuras[pid]
    if not d.get('vistas'): sys.exit(f'El personaje {pid} no es un monito de ocho vistas.')
    T = teselas(d, pid); NV = d['vistas']; vista = os.environ.get('VISTA')
    anillo = sorted(range(NV), key=lambda n: d['azimut'][n] % 360)      # las vistas por azimut creciente: cada una y la que le sigue son vecinas
    cx, cy = nudos(d)
    mas = [None] * NV; menos = [None] * NV
    for q in range(NV):
        a, b = anillo[q], anillo[(q + 1) % NV]
        Fa, Fb = par(T[a], T[b]); mas[a] = en_rejilla(Fa, d); menos[b] = en_rejilla(Fb, d)
        if vista:
            ta = deformar(T[a], mas[a], d, 0.5); tb = deformar(T[b], menos[b], d, 0.5)
            fa = ta.astype(np.float32); fb = tb.astype(np.float32); al = (fa[:, :, 3:4] + fb[:, :, 3:4]) / 2
            mez = np.dstack([(fa[:, :, :3] * fa[:, :, 3:4] + fb[:, :, :3] * fb[:, :, 3:4]) / np.maximum(2 * al, 1e-3), al]).clip(0, 255).astype(np.uint8)
            Image.fromarray(np.hstack([sobre(T[a]), sobre(ta), sobre(mez), sobre(tb), sobre(T[b])])).save(os.path.join(vista, f'giro-{pid}-{q}-vistas-{a}-{b}.jpg'), quality=88)
    tope = max(max(np.abs(m).max() for m in mas), max(np.abs(m).max() for m in menos)); esc = max(1e-3, float(tope) / 127)
    d['giro8'] = [base64.b64encode(np.concatenate([np.round(mas[n] / esc).astype(np.int8).ravel(), np.round(menos[n] / esc).astype(np.int8).ravel()]).tobytes()).decode() for n in range(NV)]
    d['giroEsc'] = round(esc, 4); d['giroPaso'] = GRUESO
    assert len(base64.b64decode(d['giro8'][0])) == 2 * cx * cy
    if propio and guardar: json.dump(figuras, open(FIGURAS, 'w', encoding='utf8'), ensure_ascii=False)
    print(f'giro de {pid}: {NV} pares, desplazamiento máximo {tope:.0f} px')
    return d


if __name__ == '__main__':
    ids = sys.argv[1:] or [k for k, v in json.load(open(FIGURAS, encoding='utf8')).items() if v.get('vistas')]
    for pid in ids: preparar(pid)
