# Monito de ocho vistas (Zubayda v5, 24 de noviembre de 2026): de las dos hojas de giro de 360° (cuatro figuras cada una)
# se recortan las ocho pinturas y se arma una cáscara con relieve por vista. En la escena solo se ve la cáscara que mira
# a la cámara (figuras8.js), así que desde cada ángulo el monito es la pintura de ese ángulo: sin brazo doble, sin cara
# cortada y sin torso aplanado. Las hojas solo se leen.
# Uso, desde la raíz del repositorio:
#     python3 src/escena3d/herramientas/preparar-vistas8.py <id> <hoja fila 1> <hoja fila 2> [<vista cenital>] [VISTA=<carpeta de control>]
# La vista cenital (opcional, Yafar 24 nov) es una pintura de la figura desde arriba con su frente hacia abajo de la imagen:
# va como novena tesela y figuras8.js la muestra cuando la cámara está casi a plomo.
# Orden de las figuras en las hojas: frente, 3/4 de frente derecho, perfil derecho, 3/4 de espalda derecho | espalda,
# 3/4 de espalda izquierdo, perfil izquierdo, 3/4 de frente izquierdo. Necesita Pillow, numpy y scipy.
# Salida: public/arte3d/fig-<id>.webp (las ocho vistas en fila, o en dos filas si son muy anchas) y la entrada del personaje en src/escena3d/datos/figuras.json
# (con «vistas»; mano, tela y demás se conservan de la entrada anterior).
# Al final llama a preparar-giro8.py, que añade a esa entrada el giro continuo entre vistas (giro8).
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
EJES = {'6': [190, 198, 190, 205, 190, 195, 140, 170],      # Zubayda V5-Z (24 nov, ocho pinturas sueltas de Jorge armadas en dos hojas); la v5 anterior: [195, 165, 152, 168, 177, 158, 140, 153]
        '1': [235, 195, 130, 183, 218, 205, 120, 205],      # Nur al Din: entre la punta del yelmo y el centro de los pies
        '4': [189, 155, 134, 167, 169, 152, 116, 169],      # Jamil (24 nov): entre el centro del turbante y el centro de los pies; el laúd a la espalda queda fuera del eje
        '4t': [198, 147, 102, 167, 214, 252, 268, 252],     # Jamil sentado tocando el laúd: el centro del turbante (el tronco va derecho bajo la cabeza)
        'B': [185, 155, 140, 170, 171, 160, 120, 190],      # Yafar (24 nov): entre el centro del turbante y el centro de los pies; fila 2 = vistas 5 a 7 rehechas + la 8 de la primera
        'EP': [221, 191, 174, 213, 221, 194, 130, 213],     # esclavo peleador abisinio (27 nov): entre el centro del yelmo y el centro de los pies
        'EC': [186, 150, 139, 175, 185, 135, 82, 154],      # esclavo cargador abisinio (27 nov): entre el centro de la cabeza y el centro de los pies; la cesta de la espalda queda fuera del eje
        'CO': [241, 258, 189, 240, 233, 199, 103, 185]}     # el esposo cornudo de Zein (28 nov, NPC de la Ira del cornudo): entre el centro de la cabeza y el centro de los pies, medido con la máscara
# Nur al Din (24 nov): sus hojas de 360° se arman con armar-hojas-360-nur.py (cinco vistas de su hoja técnica y tres de la hoja nueva)
# mano que empuña (la derecha de la figura) en la vista de frente: fracción del ancho de la tesela y de la altura
MANO = {'6': [0.116, 0.506], '1': None, '4': [0.085, 0.545], '4t': [0.5, 0.5], 'B': [0.905, 0.53], 'EP': [0.078, 0.533], 'EC': [0.068, 0.535], 'CO': [0.09, 0.52]}      # Yafar empuña con la izquierda (a la derecha de la imagen); la bolsa va en el cinturón
# fracción de arriba de la figura donde se rellena todo hueco (el brillo del yelmo de Nur al Din es del gris del papel)
RELLENO_ARRIBA = {'1': 0.14}
# Figuras que no van de pie (Jamil sentado tocando, 24 nov): (alto de la tesela, alto de la figura) en píxeles, a la misma escala
# que la figura de pie (880), y desde qué fracción de la tesela se busca la sombra del suelo (sentado, el fleco claro de la faja
# llega al piso y no es sombra). El id lleva una «t» tras el del personaje: fichas.js la usa mientras toca.
TALLA = {'4t': (576, 560)}
FRANJA_SOMBRA = {'4t': 0.975}
# Filas del atlas: las teselas anchas (el sentado, con el laúd atravesado) no caben en una sola fila de 4096 píxeles, que es
# la textura más grande que aceptan muchos teléfonos. figuras8.js lee «filas» de los datos.
FILAS = {'4t': 2}
# Papel que quedó dentro del contorno (esclavo peleador, 27 nov): entre los mechones de la cimera y en los rotos de la malla
# del rostro se ve el gris del papel, y como son huecos angostos el recorte los deja dentro. En esa fracción de arriba de la
# figura, lo que es del color del papel, está cerca del contorno y no es una mota suelta se hace transparente.
PAPEL_DENTRO = {'EP': 0.2}
# Cenitales pintadas con sombra gris en el suelo: se les quita (la de Yafar no la trae y se queda como está)
SOMBRA_CENITAL = {'6'}
# Altura a la que se acuesta la cenital, en fracción del alto de la figura (figuras8.js: 0.97 si no se dice). A media altura
# su centro coincide en pantalla con el de la figura de pie y el cambio no la sube (Zubayda, cenital a plomo del 24 nov)
Y0_CENITAL = {}      # Zubayda llevó 0.5 hasta el 25 nov; desde entonces se acuesta como la de Yafar (Jorge: «con Yafar quedó tan bien»)


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


def recorte_cenital(ruta, sin_sombra=False):
    im = Image.open(ruta).convert('RGB'); d = papel_y_distancia(im)
    m = ndi.binary_opening(d > 20, iterations=1); lab, n = ndi.label(m)
    if not n: sys.exit(f'{ruta}: no encontré la figura.')
    tam = ndi.sum(m, lab, range(1, n + 1)); m = lab == (int(np.argmax(tam)) + 1)
    m = ndi.binary_fill_holes(ndi.binary_closing(m, iterations=2))
    if sin_sombra:      # la sombra gris pintada en el suelo, pegada al contorno, no es parte de la figura (Zubayda V5-Z)
        c = np.asarray(im.filter(ImageFilter.GaussianBlur(1.5)), dtype=np.float32); sat = (c.max(2) - c.min(2)) / np.maximum(c.max(2), 1)
        q = ndi.binary_opening(m & (sat >= 0.16), iterations=2); lab, n = ndi.label(q); tam = ndi.sum(q, lab, range(1, n + 1))
        m = ndi.binary_fill_holes(ndi.binary_closing(lab == (int(np.argmax(tam)) + 1), iterations=2)) & m
    ys, xs = np.where(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return np.asarray(im)[y0:y1, x0:x1], m[y0:y1, x0:x1]


def b64(a): return base64.b64encode(a.tobytes()).decode()


def main():
    if len(sys.argv) < 4: sys.exit(__doc__ or 'Uso: preparar-vistas8.py <id> <fila 1> <fila 2>')
    global TH, ALTO
    pid = sys.argv[1]; TH, ALTO = TALLA.get(pid, (TH, ALTO)); figs = recortes(sys.argv[2]) + recortes(sys.argv[3]); ejes = EJES[pid]; vista = os.environ.get('VISTA')
    esc = []
    for (rgb, m), eje in zip(figs, ejes):
        k = ALTO / rgb.shape[0]; w = round(rgb.shape[1] * k)
        r = np.asarray(Image.fromarray(rgb).resize((w, ALTO), Image.LANCZOS)); mm = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((w, ALTO), Image.LANCZOS)) > 127
        esc.append((r, mm, eje))
    medio = max(max(e, r.shape[1] - e) for r, _, e in esc); tw = int(np.ceil((2 * medio + 12) / PASO) * PASO); gx = tw // PASO + 1; gy = TH // PASO + 1
    cen = recorte_cenital(sys.argv[4], sin_sombra=pid in SOMBRA_CENITAL) if len(sys.argv) > 4 else None
    filas = FILAS.get(pid, 1); nt = 9 if cen else 8; cols = -(-nt // filas)
    atlas = np.zeros((TH * filas, tw * cols, 4), np.uint8); zs = []; cubres = []
    def tesela(n): fy, fx = divmod(n, cols); return atlas[fy * TH:(fy + 1) * TH, fx * tw:(fx + 1) * tw]
    for i, (r, mm, eje) in enumerate(esc):
        ox = tw // 2 - eje; oy = TH - 8 - ALTO
        M = np.zeros((TH, tw), bool); M[oy:oy + ALTO, ox:ox + r.shape[1]] = mm
        C = np.zeros((TH, tw, 3), np.uint8); C[oy:oy + ALTO, ox:ox + r.shape[1]] = r
        M = ndi.binary_erosion(M, iterations=1)      # quita el filo claro del papel
        # la sombra pintada en el suelo (gris, sin color propio) no es parte de la figura: fuera, en la franja de los pies
        cf = C.astype(np.float32); sat = (cf.max(2) - cf.min(2)) / np.maximum(cf.max(2), 1); pie = np.zeros_like(M); pie[int(TH * FRANJA_SOMBRA.get(pid, 0.88)):] = True
        M = M & ~(pie & (sat < 0.2)); M = ndi.binary_opening(M, iterations=1) | (M & ~pie)
        huecos = ndi.binary_fill_holes(M) & ~M; lab, n = ndi.label(huecos)      # cierra los poros sueltos; los huecos de verdad (entre brazo y cuerpo) se quedan
        if n: tam = ndi.sum(huecos, lab, range(1, n + 1)); M = M | np.isin(lab, [q + 1 for q, t in enumerate(tam) if t < 60])
        if pid in PAPEL_DENTRO:
            fuera = ~ndi.binary_dilation(M, iterations=3); fuera[:oy] = False; fuera[:, :ox] = False; fuera[:, ox + r.shape[1]:] = False
            papel = np.median(cf[fuera], axis=0); arriba = np.zeros_like(M); arriba[:oy + int(ALTO * PAPEL_DENTRO[pid])] = True
            q = M & arriba & (np.sqrt(((cf - papel) ** 2).sum(2)) < 32); lab, n = ndi.label(q)
            orilla = ndi.binary_dilation(~M, iterations=10)      # solo cerca del contorno: los brillos grises del yelmo y de las cadenas se quedan
            if n: tam = ndi.sum(q, lab, range(1, n + 1)); toca = ndi.maximum(orilla, lab, range(1, n + 1)); M = M & ~np.isin(lab, [k + 1 for k in range(n) if tam[k] >= 5 and toca[k]])
            lab, n = ndi.label(M)      # y los hilos de la cimera que al quitar el papel quedaron sueltos
            if n > 1: tam = ndi.sum(M, lab, range(1, n + 1)); M = np.isin(lab, [k + 1 for k, t in enumerate(tam) if t >= 40])
        if pid in RELLENO_ARRIBA:
            tope = oy + int(ALTO * RELLENO_ARRIBA[pid]); arriba = np.zeros_like(M); arriba[:tope] = True
            M = M | (ndi.binary_fill_holes(M | ~arriba) & arriba)
            # y los brillos grises de las botas, que el quitado de la sombra del suelo dejó huecos
            M = M | (ndi.binary_fill_holes(ndi.binary_closing(M & pie, iterations=3) | ~pie) & pie)
        # el color se corre hacia fuera del contorno para que el filtrado de la textura no traiga papel
        _, (iy, ix) = ndi.distance_transform_edt(~M, return_indices=True); C = C[iy, ix]
        tesela(i)[:, :, :3] = C; tesela(i)[:, :, 3] = ndi.gaussian_filter(M.astype(np.float32), 0.6).clip(0, 1) * 255
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
    datos_cen = None
    if cen:
        rgb, m = cen; k = min((tw - 8) / rgb.shape[1], (TH - 8) / rgb.shape[0]); w, h = round(rgb.shape[1] * k), round(rgb.shape[0] * k)
        r = np.asarray(Image.fromarray(rgb).resize((w, h), Image.LANCZOS)); mm = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)) > 127
        M = np.zeros((TH, tw), bool); M[4:4 + h, 4:4 + w] = ndi.binary_erosion(mm, iterations=1)
        C = np.zeros((TH, tw, 3), np.uint8); C[4:4 + h, 4:4 + w] = r
        _, (iy, ix) = ndi.distance_transform_edt(~M, return_indices=True); C = C[iy, ix]
        tesela(8)[:, :, :3] = C; tesela(8)[:, :, 3] = ndi.gaussian_filter(M.astype(np.float32), 0.6).clip(0, 1) * 255
        f0w = esc[0][0].shape[1]
        datos_cen = {'x': 4, 'y': 4, 'w': w, 'h': h, 'ancho': round(f0w / TH, 4)}      # tan ancha como la vista de frente
        if pid in Y0_CENITAL: datos_cen['y0'] = Y0_CENITAL[pid]
        if vista: Image.fromarray(np.dstack([C, (M * 255).astype(np.uint8)])).save(os.path.join(vista, f'vista-{pid}-cenital.png'))
    Image.fromarray(atlas).save(os.path.join(A, f'fig-{pid}.webp'), quality=92, method=6)
    figuras = json.load(open(FIGURAS, encoding='utf8')); antes = figuras.get(pid, {})
    f0, m0, e0 = esc[0]; x0 = tw // 2 - e0; x1 = x0 + f0.shape[1]
    mano = MANO.get(pid) or [((antes['mano'][0] * antes['tw'] - antes['tw'] / 2) + tw / 2) / tw, antes['mano'][1]]
    figuras[pid] = {'tw': tw, 'th': TH, 'paso': PASO, 'vistas': 8, 'azimut': AZIMUT, 'zmax': ZMAX, 'z8': zs, 'cubre8': cubres, 'x0': int(x0), 'x1': int(x1),
                    'mano': [round(mano[0], 4), mano[1]], 'tela': antes.get('tela', [0.1, 0.66]), 'piernas': antes.get('piernas', 0)}
    if datos_cen: figuras[pid]['cenital'] = datos_cen
    if filas > 1: figuras[pid]['filas'] = filas
    if antes.get('toca'): figuras[pid]['toca'] = antes['toca']      # dónde rasguea y se mece la figura que toca: se pone a mano en figuras.json
    json.dump(figuras, open(FIGURAS, 'w', encoding='utf8'), ensure_ascii=False)
    print(f'fig-{pid}.webp: 8 vistas de {tw} × {TH} en {filas} fila(s), {atlas.shape[1]} × {atlas.shape[0]}; rejilla {gx} × {gy}')
    # giro continuo (24 nov): a dónde va cada punto de cada pintura al llegar a la vista vecina; figuras8.js lo usa para que
    # el paso de una pintura a otra no sea un salto. Lee el atlas recién guardado y completa la entrada del personaje.
    import importlib.util
    esp = importlib.util.spec_from_file_location('preparar_giro8', os.path.join(AQUI, 'preparar-giro8.py')); giro = importlib.util.module_from_spec(esp); esp.loader.exec_module(giro)
    giro.preparar(pid)


if __name__ == '__main__': main()
