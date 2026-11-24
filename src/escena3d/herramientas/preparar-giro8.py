# Giro continuo de los monitos de ocho vistas (24 de noviembre de 2026). Jorge: al girar, el paso de una pintura a la otra se
# veía como un salto, «parece que se desvanecen en polvo del color de sus ropas y luego vuelven a aparecer».
# Aquí se calcula, para cada par de pinturas vecinas (están a 45°), a dónde va a parar en la vecina cada punto de la pintura:
# con eso figuras8.js va deformando la pintura hacia la siguiente conforme gira la figura (la silueta y los rasgos se corren
# poco a poco) y, a medio camino, las dos ya casan y el relevo es un fundido corto entre dos imágenes casi iguales.
# Uso, desde la raíz del repositorio (preparar-vistas8.py y «monitos.py usar» ya lo llaman solos):
#     python3 src/escena3d/herramientas/preparar-giro8.py <id> [<id> …]        sin ids: todos los monitos de ocho vistas
#     VISTA=<carpeta> …   guarda además, por par, una tira de control: A a medio camino | las dos mezcladas | B a medio camino
# Solo lee public/arte3d/fig-<id>.webp y añade «giro8», «giroEsc», «giroEscY», «giroEscZ» y «giroPaso» a la entrada del personaje en
# src/escena3d/datos/figuras.json; no toca las pinturas ni el atlas. Necesita Pillow, numpy y scipy.
#
# Cómo: al girar sobre su eje, cada punto de la figura se mueve solo de lado, así que cada fila de una pintura se corresponde
# con la misma fila de la vecina. Fila por fila se busca el emparejamiento que mejor casa colores y contorno sin cruzarse
# (programación dinámica, como en visión estéreo), apoyado en las filas de arriba y abajo y en un mapa previo (el tramo de la
# silueta de una va al de la otra, girando como un cilindro). Lo que una vista enseña y la otra no, se encoge hacia el borde.
#
# Alturas y relieve (Jorge, 24 de noviembre, ya con el giro continuo: «aún se sienten como golpes de transición… las partes del
# cuerpo quedan unas más altas respecto a las de la imagen anterior»). Cada pintura está hecha por separado y un brazalete, el
# cinturón o una rodilla no quedan a la misma altura en dos vistas vecinas; además el relieve de cada cáscara es distinto y, con
# la cámara en alto, lo que sobresale más se ve más abajo. Por eso, además de lo que cada punto se corre de lado, se guarda lo que
# sube o baja (ya casadas de lado, se busca por zonas el pequeño corrimiento a lo alto que mejor las casa) y lo que le cambia el
# relieve al llegar a la vecina: a medio camino las dos cáscaras coinciden también en altura y en fondo.
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
ALTO_MAX = 6               # lo más que se busca subir o bajar un punto, en píxeles de media resolución (12 de la pintura)
ALTO_ZONA = 10.0           # tamaño de la zona que vota cada corrimiento a lo alto (media resolución)
ALTO_LISO = 12.0           # alisado del corrimiento a lo alto: son ajustes por partes del cuerpo, no por detalle
FINO = (1e-3, 0.5, 1.0)     # paso más fino con que se guarda cada plano (de lado, a lo alto, relieve), en píxeles: así pesa menos
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


def de_lado(labA, mA, F):
    """A llevada a las columnas de B (cada punto se queda en su fila)."""
    h, w = mA.shape; Fi = invertir(F); yy = np.tile(np.arange(h, dtype=np.float32)[:, None], (1, w))
    L = np.stack([ndi.map_coordinates(labA[:, :, c], [yy, Fi], order=1, mode='nearest') for c in range(3)], -1)
    return L, ndi.map_coordinates(mA.astype(np.float32), [yy, Fi], order=1, mode='constant') > 0.5


def alturas(labA, mA, labB, mB, vueltas=2):
    """V[y, x]: lo que hay que bajar (filas de media resolución) el punto de A que cae en (y, x) de B para que case con B.
    A ya viene casada de lado. Cada zona vota el corrimiento que mejor casa colores y contorno; pesa más quien lo tiene claro
    (una orilla, una joya) que la piel lisa, y el resultado se alisa: sale un ajuste suave, por partes del cuerpo."""
    h, w = mA.shape; ds = np.arange(-ALTO_MAX, ALTO_MAX + 1); V = np.zeros((h, w), np.float32)
    yy, xx = np.meshgrid(np.arange(h, dtype=np.float32), np.arange(w, dtype=np.float32), indexing='ij'); ii, jj = np.indices((h, w))
    for _ in range(vueltas):
        C = np.empty((len(ds), h, w), np.float32)
        for i, dy in enumerate(ds):
            lb = np.stack([ndi.map_coordinates(labB[:, :, c], [yy + V + dy, xx], order=1, mode='nearest') for c in range(3)], -1)
            mb = ndi.map_coordinates(mB.astype(np.float32), [yy + V + dy, xx], order=1, mode='constant') > 0.5
            c = np.minimum(np.sqrt(((labA - lb) ** 2).sum(2)), TAU) / TAU
            C[i] = ndi.gaussian_filter(np.where(mA & mb, c, np.where(mA | mb, 1.6, 0.0)), ALTO_ZONA) + 0.3 * (dy / ALTO_MAX) ** 2
        k = np.clip(C.argmin(0), 1, len(ds) - 2); c0 = C[k - 1, ii, jj]; c1 = C[k, ii, jj]; c2 = C[k + 1, ii, jj]; den = c0 - 2 * c1 + c2
        v = ds[k] + np.where(den > 1e-6, 0.5 * (c0 - c2) / np.maximum(den, 1e-6), 0).clip(-0.5, 0.5)
        claro = np.maximum((C.mean(0) - C.min(0)) * (mA | mB), 1e-5)
        V = V + ndi.gaussian_filter(claro * v, ALTO_LISO) / ndi.gaussian_filter(claro, ALTO_LISO)
    return V


def par(tA, tB):
    """De A hacia B (A es la vista de menor azimut), a media resolución: F[y, x] = columna de B a la que va el punto (y, x) de A,
    y V[y, x'] = filas que baja al llegar, dado en las columnas de B."""
    labA, mA = rasgos(tA); labB, mB = rasgos(tB)
    F = emparejar(labA, mA, labB, mB, previo(mA, mB, np.pi / 4), 0.9, 0.12)
    F = emparejar(labA, mA, labB, mB, alisar(F, 10, 5), 2.0, 0.05)      # segunda vuelta: se apoya en la primera, ya alisada
    F = alisar(F, 7, 3, mA)
    return F, alturas(*de_lado(labA, mA, F), labB, mB)


def relieve(d, n):
    """El relieve de la vista n (píxeles de la pintura hacia quien mira) y cómo leerlo en coordenadas de media resolución."""
    P = d['paso']; gx, gy = d['tw'] // P + 1, d['th'] // P + 1
    Z = np.frombuffer(base64.b64decode(d['z8'][n]), np.uint8).reshape(gy, gx).astype(np.float32) / 255 * d['zmax']
    return lambda y, x: ndi.map_coordinates(Z, [(y * R + (R - 1) / 2) / P, (x * R + (R - 1) / 2) / P], order=1, mode='nearest')


def campos(F, V, zA, zB):
    """Lo que se mueve cada punto de A al llegar a B y cada punto de B al llegar a A (uno es el inverso del otro, así a medio
    camino coinciden): [de lado, hacia abajo, hacia quien mira], los dos primeros en píxeles de media resolución."""
    h, w = F.shape; yy, xx = np.meshgrid(np.arange(h, dtype=np.float32), np.arange(w, dtype=np.float32), indexing='ij')
    va = ndi.map_coordinates(V, [yy, F], order=1, mode='nearest')
    deA = [F - xx, va, zB(yy + va, F) - zA(yy, xx)]
    y = np.arange(h, dtype=np.float32); yi = np.empty_like(F)
    for x in range(w): yi[:, x] = np.interp(y, np.maximum.accumulate(y + V[:, x]) + y * 1e-4, y)      # de qué fila de A viene cada fila de B
    xi = ndi.map_coordinates(invertir(F), [yi, xx], order=1, mode='nearest')
    return deA, [xi - xx, yi - yy, zA(yi, xi) - zB(yy, xx)]


def nudos(d):
    P = d['paso']; return -(-(d['tw'] // P) // GRUESO) + 1, -(-(d['th'] // P) // GRUESO) + 1


def en_rejilla(D, d, escala=R):
    """Un campo de media resolución leído en la rejilla gruesa (un nudo cada GRUESO vértices de la cáscara), en píxeles de la tesela."""
    P = d['paso'] * GRUESO; cx, cy = nudos(d)
    ys = np.minimum(np.arange(cy) * P, d['th'] - 1); xs = np.minimum(np.arange(cx) * P, d['tw'] - 1)
    yy, xx = np.meshgrid((ys - (R - 1) / 2) / R, (xs - (R - 1) / 2) / R, indexing='ij')
    return ndi.map_coordinates(D, [yy, xx], order=1, mode='nearest') * escala


# --- tira de control (solo con VISTA): cada pintura llevada a medio camino y las dos mezcladas
def deformar(t, D, d, s):
    """La tesela con cada punto llevado la fracción s de su camino: primero de lado (fila por fila) y luego a lo alto."""
    P = d['paso'] * GRUESO; h, w = t.shape[:2]; x = np.arange(w, dtype=np.float32); y = np.arange(h, dtype=np.float32)
    yy, xx = np.meshgrid(np.minimum(y / P, D[0].shape[0] - 1), np.minimum(x / P, D[0].shape[1] - 1), indexing='ij')
    dx = ndi.map_coordinates(D[0], [yy, xx], order=1, mode='nearest'); dy = ndi.map_coordinates(D[1], [yy, xx], order=1, mode='nearest')
    def correr(v, hacia, ejes):      # v[n, m, canales] corrido a lo largo del segundo eje
        out = np.zeros_like(v); n, m = v.shape[:2]; e = np.arange(m, dtype=np.float32)
        for q in range(n):
            et = np.maximum.accumulate(e + s * hacia[q]) + e * 1e-4; src = np.interp(e, et, e)
            i0 = np.clip(np.floor(src).astype(int), 0, m - 2); fr = (src - i0)[:, None]
            fila = v[q, i0] * (1 - fr) + v[q, i0 + 1] * fr; fila[(e < et[0]) | (e > et[-1])] = 0; out[q] = fila
        return out
    paso1 = correr(np.dstack([t.astype(np.float32), dy]), dx, 1)
    paso2 = correr(paso1[:, :, :4].transpose(1, 0, 2), paso1[:, :, 4].T, 0).transpose(1, 0, 2)
    return paso2.clip(0, 255).astype(np.uint8)


def sobre(t, fondo=(58, 63, 74)):
    a = t[:, :, 3:4].astype(np.float32) / 255; return (t[:, :, :3] * a + np.array(fondo, np.float32) * (1 - a)).astype(np.uint8)


def preparar(pid, figuras=None, guardar=True):
    """Añade giro8 y sus escalas a la entrada del personaje. Devuelve la entrada."""
    propio = figuras is None
    if propio: figuras = json.load(open(FIGURAS, encoding='utf8'))
    d = figuras[pid]
    if not d.get('vistas'): sys.exit(f'El personaje {pid} no es un monito de ocho vistas.')
    T = teselas(d, pid); NV = d['vistas']; vista = os.environ.get('VISTA')
    anillo = sorted(range(NV), key=lambda n: d['azimut'][n] % 360)      # las vistas por azimut creciente: cada una y la que le sigue son vecinas
    cx, cy = nudos(d)
    mas = [None] * NV; menos = [None] * NV; esc = (R, R, 1)
    for q in range(NV):
        a, b = anillo[q], anillo[(q + 1) % NV]
        deA, deB = campos(*par(T[a], T[b]), relieve(d, a), relieve(d, b))
        mas[a] = [en_rejilla(D, d, e) for D, e in zip(deA, esc)]; menos[b] = [en_rejilla(D, d, e) for D, e in zip(deB, esc)]
        if vista:
            ta = deformar(T[a], mas[a], d, 0.5); tb = deformar(T[b], menos[b], d, 0.5)
            fa = ta.astype(np.float32); fb = tb.astype(np.float32); al = (fa[:, :, 3:4] + fb[:, :, 3:4]) / 2
            mez = np.dstack([(fa[:, :, :3] * fa[:, :, 3:4] + fb[:, :, :3] * fb[:, :, 3:4]) / np.maximum(2 * al, 1e-3), al]).clip(0, 255).astype(np.uint8)
            Image.fromarray(np.hstack([sobre(T[a]), sobre(ta), sobre(mez), sobre(tb), sobre(T[b])])).save(os.path.join(vista, f'giro-{pid}-{q}-vistas-{a}-{b}.jpg'), quality=88)
    # tres planos por lado (de lado, hacia abajo, hacia quien mira), cada uno con su escala: [más azimut ×3 | menos azimut ×3]
    topes = [max(max(np.abs(m[c]).max() for m in mas), max(np.abs(m[c]).max() for m in menos)) for c in range(3)]; escs = [max(m, float(t) / 127) for t, m in zip(topes, FINO)]
    d['giro8'] = [base64.b64encode(np.concatenate([np.round(m[c] / escs[c]).astype(np.int8).ravel() for m in (mas[n], menos[n]) for c in range(3)]).tobytes()).decode() for n in range(NV)]
    d['giroEsc'] = round(escs[0], 4); d['giroEscY'] = round(escs[1], 4); d['giroEscZ'] = round(escs[2], 4); d['giroPaso'] = GRUESO
    assert len(base64.b64decode(d['giro8'][0])) == 6 * cx * cy
    if propio and guardar: json.dump(figuras, open(FIGURAS, 'w', encoding='utf8'), ensure_ascii=False)
    print(f'giro de {pid}: {NV} pares; lo más que se corre un punto: {topes[0]:.0f} px de lado, {topes[1]:.0f} a lo alto y {topes[2]:.0f} de relieve')
    return d


if __name__ == '__main__':
    ids = sys.argv[1:] or [k for k, v in json.load(open(FIGURAS, encoding='utf8')).items() if v.get('vistas')]
    for pid in ids: preparar(pid)
