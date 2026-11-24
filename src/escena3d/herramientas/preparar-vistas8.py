# Monito de ocho vistas (Zubayda v5, 24 de noviembre de 2026): de las dos hojas de giro de 360° (cuatro figuras cada una)
# se recortan las ocho pinturas y se arma una cáscara con relieve por vista. En la escena solo se ve la cáscara que mira
# a la cámara (figuras8.js), así que desde cada ángulo el monito es la pintura de ese ángulo: sin brazo doble, sin cara
# cortada y sin torso aplanado. Las hojas solo se leen.
# Uso, desde la raíz del repositorio:
#     python3 src/escena3d/herramientas/preparar-vistas8.py <id> <hoja fila 1> <hoja fila 2> [VISTA=<carpeta de control>]
# Orden de las figuras en las hojas: frente, 3/4 de frente derecho, perfil derecho, 3/4 de espalda derecho | espalda,
# 3/4 de espalda izquierdo, perfil izquierdo, 3/4 de frente izquierdo. Necesita Pillow, numpy y scipy.
# Salida: public/arte3d/fig-<id>.webp (las ocho vistas en fila) y la entrada del personaje en src/escena3d/datos/figuras.json
# (con «vistas»; mano, tela y demás se conservan de la entrada anterior).
import sys, os, json, base64
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..', '..'))
A = os.path.join(RAIZ, 'public', 'arte3d'); FIGURAS = os.path.join(AQUI, '..', 'datos', 'figuras.json')
TH = 896; ALTO = 880; PASO = 8; ZMAX = 44.0
# hacia dónde mira cada cáscara (grados; 0 = de frente, negativo = costado derecho de la figura)
AZIMUT = [0, -45, -90, -135, 180, 135, 90, 45]
# eje vertical del cuerpo en cada recorte, en píxeles desde su borde izquierdo con la figura a 880 de alto (medido a ojo sobre la rejilla de control)
EJES = {'6': [195, 165, 152, 168, 177, 158, 140, 153]}
# mano que empuña (la derecha de la figura) en la vista de frente: fracción del ancho de la tesela y de la altura
MANO = {'6': None}


def papel_y_distancia(im):
    a = np.asarray(im.convert('RGB').filter(ImageFilter.GaussianBlur(1.0)), dtype=np.float32); h, w, _ = a.shape
    borde = np.concatenate([a[:10].reshape(-1, 3), a[-10:].reshape(-1, 3), a[:, :10].reshape(-1, 3), a[:, -10:].reshape(-1, 3)])
    yy, xx = np.mgrid[0:h, 0:w]; X = xx / w - .5; Y = yy / h - .5; B = np.stack([np.ones_like(X), X, Y, X * X, X * Y, Y * Y], -1)
    modelo = np.broadcast_to(np.median(borde, axis=0), a.shape).astype(np.float32)
    for _ in range(3):      # el papel tiene una viñeta suave
        ok = np.sqrt(((a - modelo) ** 2).sum(2)) < 22
        coef, *_ = np.linalg.lstsq(B[ok][::7], a[ok][::7], rcond=None); modelo = (B @ coef).astype(np.float32)
    return np.sqrt(((a - modelo) ** 2).sum(2))


def recortes(ruta):
    im = Image.open(ruta).convert('RGB'); d = papel_y_distancia(im)
    m = ndi.binary_opening(d > 20, iterations=1); lab, n = ndi.label(m); tam = ndi.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, [i + 1 for i, t in enumerate(tam) if t > 300])
    col = m.sum(0); tramos = []; dentro = False
    for x in range(m.shape[1]):
        if col[x] > 2 and not dentro: s = x; dentro = True
        if (col[x] <= 2 or x == m.shape[1] - 1) and dentro: tramos.append((s, x)); dentro = False
    tramos = [t for t in tramos if t[1] - t[0] > 100]
    if len(tramos) != 4: sys.exit(f'{ruta}: se esperaban 4 figuras separadas y hay {len(tramos)}.')
    rgb = np.asarray(im); fuera = []
    for x0, x1 in tramos:
        filas = np.where(m[:, x0:x1].any(1))[0]; y0, y1 = filas[0], filas[-1] + 1
        fuera.append((rgb[y0:y1, x0:x1], m[y0:y1, x0:x1]))
    return fuera


def b64(a): return base64.b64encode(a.tobytes()).decode()


def main():
    if len(sys.argv) < 4: sys.exit(__doc__ or 'Uso: preparar-vistas8.py <id> <fila 1> <fila 2>')
    pid = sys.argv[1]; figs = recortes(sys.argv[2]) + recortes(sys.argv[3]); ejes = EJES[pid]; vista = os.environ.get('VISTA')
    esc = []
    for (rgb, m), eje in zip(figs, ejes):
        k = ALTO / rgb.shape[0]; w = round(rgb.shape[1] * k)
        r = np.asarray(Image.fromarray(rgb).resize((w, ALTO), Image.LANCZOS)); mm = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((w, ALTO), Image.LANCZOS)) > 127
        esc.append((r, mm, eje))
    medio = max(max(e, r.shape[1] - e) for r, _, e in esc); tw = int(np.ceil((2 * medio + 12) / PASO) * PASO); gx = tw // PASO + 1; gy = TH // PASO + 1
    atlas = np.zeros((TH, tw * 8, 4), np.uint8); zs = []; cubres = []
    for i, (r, mm, eje) in enumerate(esc):
        ox = tw // 2 - eje; oy = TH - 8 - ALTO
        M = np.zeros((TH, tw), bool); M[oy:oy + ALTO, ox:ox + r.shape[1]] = mm
        C = np.zeros((TH, tw, 3), np.uint8); C[oy:oy + ALTO, ox:ox + r.shape[1]] = r
        M = ndi.binary_erosion(M, iterations=1)      # quita el filo claro del papel
        # la sombra pintada en el suelo (gris, sin color propio) no es parte de la figura: fuera, en la franja de los pies
        cf = C.astype(np.float32); sat = (cf.max(2) - cf.min(2)) / np.maximum(cf.max(2), 1); pie = np.zeros_like(M); pie[int(TH * 0.88):] = True
        M = M & ~(pie & (sat < 0.2)); M = ndi.binary_opening(M, iterations=1) | (M & ~pie)
        huecos = ndi.binary_fill_holes(M) & ~M; lab, n = ndi.label(huecos)      # cierra los poros sueltos; los huecos de verdad (entre brazo y cuerpo) se quedan
        if n: tam = ndi.sum(huecos, lab, range(1, n + 1)); M = M | np.isin(lab, [q + 1 for q, t in enumerate(tam) if t < 60])
        # el color se corre hacia fuera del contorno para que el filtrado de la textura no traiga papel
        _, (iy, ix) = ndi.distance_transform_edt(~M, return_indices=True); C = C[iy, ix]
        atlas[:, i * tw:(i + 1) * tw, :3] = C; atlas[:, i * tw:(i + 1) * tw, 3] = ndi.gaussian_filter(M.astype(np.float32), 0.6).clip(0, 1) * 255
        # relieve: cero en el contorno, sube hacia dentro y se aplana (bajorrelieve); los huecos pequeños no lo hunden
        lleno = ndi.binary_closing(M, iterations=6) | M; d = ndi.distance_transform_edt(lleno)
        z = ZMAX * (1 - np.exp(-d / 26.0)); z = ndi.gaussian_filter(z, 5.0)
        zg = np.zeros((gy, gx), np.float32)
        for j in range(gy):
            for q in range(gx): zg[j, q] = z[min(TH - 1, j * PASO), min(tw - 1, q * PASO)]
        zs.append(b64(np.round(zg / ZMAX * 255).clip(0, 255).astype(np.uint8)))
        Md = ndi.binary_dilation(M, iterations=2); bits = np.zeros((gy - 1) * (gx - 1), np.uint8)
        for j in range(gy - 1):
            for q in range(gx - 1): bits[j * (gx - 1) + q] = Md[j * PASO:(j + 1) * PASO, q * PASO:(q + 1) * PASO].any()
        cubres.append(b64(np.packbits(bits)))
        if vista: Image.fromarray(np.dstack([C, (M * 255).astype(np.uint8)])).save(os.path.join(vista, f'vista-{pid}-{i}.png'))
    Image.fromarray(atlas).save(os.path.join(A, f'fig-{pid}.webp'), quality=92, method=6)
    figuras = json.load(open(FIGURAS, encoding='utf8')); antes = figuras.get(pid, {})
    f0, m0, e0 = esc[0]; x0 = tw // 2 - e0; x1 = x0 + f0.shape[1]
    mano = MANO.get(pid) or [((antes['mano'][0] * antes['tw'] - antes['tw'] / 2) + tw / 2) / tw, antes['mano'][1]]
    figuras[pid] = {'tw': tw, 'th': TH, 'paso': PASO, 'vistas': 8, 'azimut': AZIMUT, 'zmax': ZMAX, 'z8': zs, 'cubre8': cubres, 'x0': int(x0), 'x1': int(x1),
                    'mano': [round(mano[0], 4), mano[1]], 'tela': antes.get('tela', [0.1, 0.66]), 'piernas': antes.get('piernas', 0)}
    json.dump(figuras, open(FIGURAS, 'w', encoding='utf8'), ensure_ascii=False)
    print(f'fig-{pid}.webp: 8 vistas de {tw} × {TH}; rejilla {gx} × {gy}')


if __name__ == '__main__': main()
