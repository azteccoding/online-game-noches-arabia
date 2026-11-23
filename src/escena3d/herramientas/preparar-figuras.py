# Prepara las figuras 3D de los personajes a partir de sus hojas de referencia (las hojas solo se leen).
# Uso, desde la raíz del repositorio:
#     python3 src/escena3d/herramientas/preparar-figuras.py <carpeta ilustraciones/personajes>
# Necesita Pillow, numpy y scipy. Variables opcionales: SOLO=1,2 (rehace solo esos personajes) y VISTA=<carpeta> (guarda
# vistas de control).
#
# Las hojas pueden ser la lámina original de 2480 × 1754 o una imagen de formato libre con las cuatro vistas en fila sobre fondo liso.
# De cada hoja (cuatro vistas: frente, tres cuartos, perfil, espalda) se recortan la figura de frente, la de espalda y la de
# perfil, se les quita el papel de fondo y se calcula un relieve: cuánto «sale» cada punto de la figura (más en el centro del
# cuerpo, cero en el contorno; el grosor de cada altura se toma de la vista de perfil). Con eso la escena levanta una miniatura
# con volumen pintada con la propia ilustración. Además se recorta el busto para el retrato.
# Salida: public/arte3d/fig-<id>.webp (frente | espalda | costado), public/arte3d/busto-<id>.webp y
# src/escena3d/datos/figuras.json.
import sys, os, json, base64
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ORIGEN = sys.argv[1] if len(sys.argv) > 1 else None
if not ORIGEN: sys.exit('Falta la carpeta de las hojas de personaje.')
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..', '..'))
A = os.path.join(RAIZ, 'public', 'arte3d'); D = os.path.join(AQUI, '..', 'datos')
VISTA = os.environ.get('VISTA')          # carpeta opcional para guardar vistas de control

HOJAS = {'1': 'hoja-personaje-1-nur-al-din.png', '2': 'hoja-personaje-2-zein-al-mawasif.png', '3': 'hoja-personaje-3-anis.png', '4': 'hoja-personaje-4-jamil-al-udhri.png',
         '5': 'hoja-personaje-5-sabio-ruyan.png', '6': 'hoja-personaje-6-zubayda.png', '7': 'hoja-personaje-7-adi.png', 'B': 'hoja-personaje-B-yafar-el-bermeki.png'}
PANEL = (214, 264, 2266, 1402)           # la lámina con las cuatro vistas, dentro de la hoja de 2480 × 1754
HOJA_LAMINA = (2480, 1754); LIBRE = False
TEXTURA = 0            # hoja libre: umbral de textura («textura» en AJUSTES) para personajes vestidos del color del papel; 0 = por color
UMBRAL_LIBRE = 26      # hoja libre: cuánto puede apartarse un color del papel y seguir siendo papel («umbral» en AJUSTES; se baja si se come ropa clara)
TH = 896                                 # alto de la figura en la textura
PERFIL_A_LA_DERECHA = set()              # personajes cuya vista de perfil mira a la derecha (se voltea para que todos miren a la izquierda)
PASO = 8                                 # paso de la rejilla del relieve, en píxeles de textura
# Ajustes por personaje. «quitar»: rectángulos (x0, y0, x1, y1 en fracción del recorte de frente) que no forman parte del
# cuerpo (un bastón que se modela aparte). «mano»: dónde empuña el arma (fracción del recorte de frente; x desde la izquierda
# de la imagen, y desde arriba). «tela»: tramo de altura (desde arriba) donde la capa, el velo o el chal tienen vuelo.
AJUSTES = {
    '1': dict(mano=(0.19, 0.55), tela=(0.2, 0.9), piernas=0.86),
    '2': dict(mano=(0.53, 0.44), tela=(0.12, 0.9), piernas=0, umbral=18),      # manos juntas al frente: ahí va el arma
    '3': dict(mano=(0.16, 0.50), tela=(0.15, 0.9), piernas=0, textura=7.5),
    '4': dict(mano=(0.14, 0.50), tela=(0.2, 0.6), piernas=0),
    '5': dict(mano=(0.17, 0.52), tela=(0.15, 0.9), piernas=0, textura=7.5),
    '6': dict(mano=(0.13, 0.52), tela=(0.15, 0.8), piernas=0),
    '7': dict(mano=(0.12, 0.52), tela=(0.15, 0.6), piernas=0),
    'B': dict(mano=(0.72, 0.40), tela=(0.2, 0.9), piernas=0, umbral=18),      # la bolsa va en la derecha: el arma, en la izquierda
}

def mascara(rgb):
    """Figura = todo lo que no es papel alcanzable desde el borde de la lámina."""
    a = np.asarray(rgb.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32)
    h, w, _ = a.shape
    borde = np.concatenate([a[:12].reshape(-1, 3), a[-12:].reshape(-1, 3), a[:, :12].reshape(-1, 3), a[:, -12:].reshape(-1, 3)])
    papel = np.median(borde, axis=0)
    # el papel tiene una viñeta suave: se ajusta su tono con un polinomio de segundo grado sobre lo que ya parece papel
    yy, xx = np.mgrid[0:h:6, 0:w:6]; sub = a[::6, ::6]; X = xx / w - 0.5; Y = yy / h - 0.5
    base = np.stack([np.ones_like(X), X, Y, X * X, X * Y, Y * Y, X ** 4, Y ** 4], axis=-1).reshape(-1, 8)
    modelo = np.broadcast_to(papel, a.shape).astype(np.float32)
    for _ in range(3):
        ok = (np.sqrt(((sub - modelo[::6, ::6]) ** 2).sum(axis=2)) < 30).reshape(-1)
        coef, *_ = np.linalg.lstsq(base[ok], sub.reshape(-1, 3)[ok], rcond=None)
        Xf, Yf = np.meshgrid(np.arange(w) / w - 0.5, np.arange(h) / h - 0.5)
        modelo = (np.stack([np.ones_like(Xf), Xf, Yf, Xf * Xf, Xf * Yf, Yf * Yf, Xf ** 4, Yf ** 4], axis=-1) @ coef).astype(np.float32)
    dist = np.sqrt(((a - modelo) ** 2).sum(axis=2))
    lum = a.mean(axis=2); lp = modelo.mean(axis=2)
    croma = np.sqrt((((a / np.maximum(lum[..., None], 1)) - modelo / lp[..., None]) ** 2).sum(axis=2))
    como_papel = dist < (UMBRAL_LIBRE if LIBRE else 26)
    como_sombra = (croma < 0.105) & (lum > lp * 0.42) & (lum < lp * 1.04)      # sombra en el suelo: papel más oscuro, sin color propio
    if LIBRE: como_sombra = (croma < 0.24) & (lum > lp * 0.56) & (lum < lp * 1.04)      # hoja libre: el suelo va pintado, con manchas de arena clara
    if LIBRE and TEXTURA:      # ropa del color del papel: la figura se distingue por la pincelada (textura fina), no por el color
        fino = lum - ndi.gaussian_filter(lum, 2.0); tex = np.sqrt(ndi.uniform_filter(fino ** 2, 11))
        fig = ndi.binary_closing((tex > TEXTURA) | (dist > 45), structure=np.ones((9, 9)), iterations=2)
        como_papel = ~fig; como_sombra = np.zeros_like(como_papel)
    return a, como_papel, como_sombra

def fondo_desde_borde(libre):
    et, n = ndi.label(libre)
    toca = np.unique(np.concatenate([et[0], et[-1], et[:, 0], et[:, -1]]))
    return np.isin(et, toca[toca > 0])

def vistas(m):
    """Las cuatro figuras, de izquierda a derecha: la lámina se corta por las columnas más vacías cerca de cada cuarto."""
    H, W = m.shape; col = ndi.uniform_filter1d(m.sum(axis=0).astype(np.float32), 9)
    # Hoja de formato libre (no la lámina de 2480 × 1754): las figuras se separan por los valles entre ellas (las columnas con
    # menos figura entre cada dos, sin contar la franja de los pies y su sombra) y se toman las cuatro primeras de izquierda a derecha; si hay
    # una quinta, por ejemplo una pose de ataque, se ignora.
    cortes = None
    if LIBRE:
        ys = np.where(m.any(axis=1))[0]; arriba = m[:int(ys[0] + (ys[-1] - ys[0]) * 0.86)]
        masa = ndi.uniform_filter1d(arriba.sum(axis=0).astype(np.float32), max(5, W // 120))
        gorda = ndi.gaussian_filter1d(masa, W / 50)      # un pico por figura
        picos = [x for x in range(1, W - 1) if gorda[x] >= gorda[x - 1] and gorda[x] > gorda[x + 1] and gorda[x] > gorda.max() * 0.45]
        picos = [x for k, x in enumerate(picos) if k == 0 or x - picos[k - 1] > W / 14]
        if len(picos) >= 4:
            entre = [picos[k] + int(np.argmin(masa[picos[k]:picos[k + 1]])) for k in range(len(picos) - 1)]
            cortes = [0, entre[0], entre[1], entre[2], entre[3] if len(entre) > 3 else W]
    if cortes is not None: pass
    else:
        cortes = [0]
        for f in (0.25, 0.5, 0.75):
            a, b = int(W * (f - 0.09)), int(W * (f + 0.09)); cortes.append(a + int(np.argmin(col[a:b])))
        cortes.append(W)
    cajas = []
    for k in range(4):
        sub = m[:, cortes[k]:cortes[k + 1]]
        et, n = ndi.label(sub)
        if n == 0: continue
        tam = ndi.sum(sub, et, range(1, n + 1)); sub = np.isin(et, 1 + np.where(tam > tam.max() * (0.025 if LIBRE else 0.004))[0])
        xs = np.where(sub.any(axis=0))[0]; ys = np.where(sub.any(axis=1))[0]
        cajas.append((cortes[k] + xs[0], ys[0], cortes[k] + xs[-1] + 1, ys[-1] + 1))
    return cajas

def rellenar(rgb, m):
    """Extiende los colores de la figura hacia fuera, para que el borde no se manche de papel."""
    idx = ndi.distance_transform_edt(~m, return_distances=False, return_indices=True)
    return rgb[idx[0], idx[1]]

def procesar(pid, archivo):
    global LIBRE, UMBRAL_LIBRE, TEXTURA
    UMBRAL_LIBRE = AJUSTES[pid].get('umbral', 26); TEXTURA = AJUSTES[pid].get('textura', 0)
    hoja = Image.open(os.path.join(ORIGEN, archivo)).convert('RGB')
    LIBRE = hoja.size != HOJA_LAMINA      # una hoja de otro tamaño es de formato libre: toda la imagen es la lámina
    if not LIBRE: hoja = hoja.crop(PANEL)
    a, papel, sombra = mascara(hoja)
    H, W = papel.shape
    m0 = ~fondo_desde_borde(papel | sombra)      # primera pasada, solo para situar las cuatro figuras
    m0 = ndi.binary_opening(m0, iterations=2)
    cajas = vistas(m0)
    if len(cajas) != 4: raise SystemExit(f'{pid}: esperaba 4 vistas y encontré {len(cajas)}')
    # la sombra del suelo solo se descuenta en la franja de los pies
    y_pies = max(c[3] for c in cajas); alto = y_pies - min(c[1] for c in cajas)
    zona = np.zeros_like(papel); zona[int(y_pies - alto * 0.12):] = True
    libre = papel | (sombra & zona)
    m = ~fondo_desde_borde(libre)
    m = ndi.binary_opening(m, iterations=2)
    et, n = ndi.label(m)
    if n:      # fuera motas sueltas
        tam = ndi.sum(m, et, range(1, n + 1)); m = np.isin(et, 1 + np.where(tam > 900)[0])
    cajas = vistas(m)
    aj = AJUSTES[pid]
    if LIBRE and aj.get('piernas'):      # hoja libre: el papel que queda encerrado entre las piernas (lo cierra la sombra del suelo) no es figura
        for (x0, y0, x1, y1) in cajas:
            ya = int(y0 + (y1 - y0) * aj['piernas'])
            hueco = (papel | sombra)[ya:y1, x0:x1] & m[ya:y1, x0:x1]
            et, n = ndi.label(hueco)
            if n:
                tam = ndi.sum(hueco, et, range(1, n + 1)); m[ya:y1, x0:x1] &= ~np.isin(et, 1 + np.where(tam > 120)[0])
        m = ndi.binary_opening(m, iterations=1)
    if LIBRE and TEXTURA:      # silueta de túnica y manto: se cierran las mordidas, se rellena cada fila de borde a borde y se recorta el halo de papel
        for (x0, y0, x1, y1) in cajas:
            sub = np.pad(m[y0:y1, x0:x1], 20); sub = ndi.binary_closing(sub, structure=np.ones((17, 17)), iterations=1)[20:-20, 20:-20]
            for y in range(sub.shape[0]):
                xs = np.where(sub[y])[0]
                if len(xs): sub[y, xs[0]:xs[-1] + 1] = True
            for x in range(sub.shape[1]):      # y cada columna de arriba abajo: el manto cae recto, sin entrantes
                ys = np.where(sub[:, x])[0]
                if len(ys): sub[ys[0]:ys[-1] + 1, x] = True
            sub = ndi.binary_erosion(sub, iterations=4)
            m[y0:y1, x0:x1] = sub
        cajas = vistas(m)
    rgb = np.asarray(hoja, dtype=np.uint8)

    def recorte(c, espejo=False):
        x0, y0, x1, y1 = c
        mm = m[y0:y1, x0:x1].copy(); cc = rgb[y0:y1, x0:x1].copy()
        et, n = ndi.label(mm)
        if n > 1:      # solo la figura (lo más grande) y lo que casi la toca
            tam = ndi.sum(mm, et, range(1, n + 1)); mm = np.isin(et, 1 + np.where(tam > tam.max() * (0.025 if LIBRE else 0.004))[0])      # hoja libre: el papel pintado deja motas más grandes
        if espejo: mm = mm[:, ::-1]; cc = cc[:, ::-1]
        return mm, cc

    mf, cf = recorte(cajas[0]); mb, cb = recorte(cajas[3], espejo=True); mp, cp = recorte(cajas[2], espejo=pid in PERFIL_A_LA_DERECHA)
    for (qx0, qy0, qx1, qy1) in aj.get('quitar', []):
        hh, ww = mf.shape; mf[int(qy0 * hh):int(qy1 * hh), int(qx0 * ww):int(qx1 * ww)] = False
    hf, wf = mf.shape; esc = TH / hf
    def centro_de(mm):      # eje del cuerpo: centro de la franja del torso
        h = mm.shape[0]; xs = np.where(mm[int(h * 0.25):int(h * 0.55)].any(axis=0))[0]; return (xs[0] + xs[-1]) / 2
    cfx = centro_de(mf)
    TW = int(np.ceil(max(cfx, wf - cfx) * esc / PASO + 1)) * 2 * PASO      # ancho de la tesela: múltiplo del paso, centrada en el eje
    def a_tesela(mm, cc):
        h, w = mm.shape; e = TH / h; cx = centro_de(mm)
        col = Image.fromarray(rellenar(cc, mm)).resize((max(1, round(w * e)), TH), Image.LANCZOS)
        alf = Image.fromarray((mm * 255).astype(np.uint8)).resize((max(1, round(w * e)), TH), Image.LANCZOS)
        lienzo = Image.new('RGB', (TW, TH)); alfa = Image.new('L', (TW, TH), 0)
        dx = round(TW / 2 - cx * e)
        lienzo.paste(col, (dx, 0)); alfa.paste(alf, (dx, 0))
        return lienzo, alfa
    colF, alfF = a_tesela(mf, cf); colB, alfB = a_tesela(mb, cb)
    mF = np.asarray(alfF) > 127; mB = np.asarray(alfB) > 127
    cF = rellenar(np.asarray(colF), mF); cB = rellenar(np.asarray(colB), mB)
    # la espalda se pinta sobre la silueta de frente: fila a fila se estira un poco para que sus bordes coincidan
    def bordes(mm):
        iz = np.full(TH, np.nan); de = np.full(TH, np.nan)
        for y in range(TH):
            xs = np.where(mm[y])[0]
            if len(xs): iz[y], de[y] = xs[0], xs[-1]
        return iz, de
    fi, fd = bordes(mF); bi, bd = bordes(mB)
    ok = ~np.isnan(fi) & ~np.isnan(bi)
    def desfase(f, b):      # diferencia de borde por fila; donde no es fiable (un objeto que solo sale en una vista) se interpola
        d = f - b; fiable = ok & (np.abs(d) < TW * 0.09); ys = np.arange(TH)
        if fiable.sum() < 8: return np.zeros(TH)
        d = np.interp(ys, ys[fiable], ndi.median_filter(d[fiable], 9))
        return ndi.gaussian_filter1d(d, 14)
    di, dd = desfase(fi, bi), desfase(fd, bd)
    bi2 = np.where(np.isnan(bi), TW * 0.3, bi); bd2 = np.where(np.isnan(bd), TW * 0.7, bd)
    bi2 = ndi.gaussian_filter1d(ndi.median_filter(bi2, 9), 6); bd2 = ndi.gaussian_filter1d(ndi.median_filter(bd2, 9), 6)
    cols = np.arange(TW, dtype=np.float32); cBw = np.empty_like(cB); mBw = np.zeros((TH, TW), dtype=np.float32)
    for y in range(TH):
        a0, a1 = bi2[y] + di[y], bd2[y] + dd[y]
        if a1 - a0 < 4: cBw[y] = cB[y]; mBw[y] = mB[y]; continue
        t = (cols - a0) / (a1 - a0); src = np.clip(bi2[y] + t * (bd2[y] - bi2[y]), 0, TW - 1)
        for c in range(3): cBw[y, :, c] = np.interp(src, cols, cB[y, :, c])
        mBw[y] = np.interp(src, cols, mB[y].astype(np.float32))
    # lo que solo existe en la vista de frente (un bastón, una lámpara) lleva por detrás su mismo color de frente
    lejos = np.clip((ndi.distance_transform_edt(mBw < 0.5) - 4) / 6, 0, 1)[..., None]
    cB = (cBw * (1 - lejos) + cF * lejos).astype(np.uint8)
    alfa_suave = np.asarray(alfF.filter(ImageFilter.GaussianBlur(0.7)))
    # Tercera tesela: el costado, sacado de la vista de perfil (que mira a la izquierda). Cada fila se estira de borde a borde:
    # u = 0 es el frente del cuerpo y u = 1 la espalda; la escena la proyecta de lado según el fondo (z) de cada punto.
    hp0, wp0 = mp.shape; ep0 = TH / hp0; wP = max(1, round(wp0 * ep0))
    colP = np.asarray(Image.fromarray(rellenar(cp, mp)).resize((wP, TH), Image.LANCZOS))
    mP = np.asarray(Image.fromarray((mp * 255).astype(np.uint8)).resize((wP, TH), Image.LANCZOS)) > 127
    cP = rellenar(colP, mP)
    pi_, pd_ = np.full(TH, np.nan), np.full(TH, np.nan)
    for y in range(TH):
        xs = np.where(mP[y])[0]
        if len(xs):      # el tramo seguido más largo de la fila: el cuerpo, sin un bastón o un objeto que asome suelto
            cortes = np.where(np.diff(xs) > 3)[0]; ini = np.r_[0, cortes + 1]; fin = np.r_[cortes, len(xs) - 1]; k = int(np.argmax(xs[fin] - xs[ini]))
            pi_[y], pd_[y] = xs[ini[k]], xs[fin[k]]
    ys = np.arange(TH); hay = ~np.isnan(pi_)
    pi_ = ndi.gaussian_filter1d(ndi.median_filter(np.interp(ys, ys[hay], pi_[hay]), 7), 3); pd_ = ndi.gaussian_filter1d(ndi.median_filter(np.interp(ys, ys[hay], pd_[hay]), 7), 3)
    cL = np.empty((TH, TW, 3), dtype=np.uint8); us = np.linspace(0, 1, TW); colsP = np.arange(wP, dtype=np.float32)
    for y in range(TH):
        src = np.clip(pi_[y] + us * (pd_[y] - pi_[y]), 0, wP - 1)
        for c in range(3): cL[y, :, c] = np.interp(src, colsP, cP[y, :, c])
    atlas = np.zeros((TH, TW * 3, 4), dtype=np.uint8)
    atlas[:, :TW, :3] = cF; atlas[:, :TW, 3] = alfa_suave
    atlas[:, TW:TW * 2, :3] = cB; atlas[:, TW:TW * 2, 3] = alfa_suave
    atlas[:, TW * 2:, :3] = cL; atlas[:, TW * 2:, 3] = 255
    Image.fromarray(atlas, 'RGBA').save(os.path.join(A, f'fig-{pid}.webp'), quality=90, method=6, exact=True)

    # --- Relieve: grosor por altura (de la vista de perfil) y redondeo desde el borde (transformada de distancia)
    hp, wp = mp.shape; ep = TH / hp
    cuenta = mp.sum(axis=1).astype(np.float32) * ep                       # ancho del perfil en cada fila, en píxeles de textura
    filas_p = np.interp(np.arange(TH), np.linspace(0, TH - 1, hp), cuenta)
    R = ndi.gaussian_filter1d(filas_p, 10) / 2 * 0.92                     # medio grosor por fila
    R = np.maximum(R, 6)
    # Distancia al contorno con signo (dentro +, fuera −): el relieve sube desde cero justo en el contorno, con pendiente finita,
    # para que la cáscara de delante y la de detrás se encuentren ahí y la figura quede cerrada vista de canto.
    sd = np.where(mF, ndi.distance_transform_edt(mF) - 0.5, -(ndi.distance_transform_edt(~mF) - 0.5))
    Rf = R[:, None]; Dm = 0.7 * Rf
    z = np.where(sd >= 0, Rf * np.sin(np.pi / 2 * np.minimum(sd, Dm) / Dm), np.pi / 2 * (Rf / Dm) * sd)
    z = np.clip(ndi.gaussian_filter(z, 1.5), -40, None)
    zmax = float(z.max()); zmin = float(z.min())
    gy, gx = TH // PASO + 1, TW // PASO + 1
    zg = np.zeros((gy, gx), dtype=np.float32)
    for j in range(gy):
        for i in range(gx):
            y, x = min(TH - 1, j * PASO), min(TW - 1, i * PASO); zg[j, i] = z[y, x]
    cub = np.zeros((gy - 1, gx - 1), dtype=np.uint8)
    for j in range(gy - 1):
        for i in range(gx - 1):
            cub[j, i] = 1 if mF[j * PASO:(j + 1) * PASO + 1, i * PASO:(i + 1) * PASO + 1].any() else 0
    xs = np.where(mF.any(axis=0))[0]
    datos = dict(tw=TW, th=TH, teselas=3, paso=PASO, zmax=round(zmax, 2), zmin=round(zmin, 2), z=base64.b64encode(np.round((zg - zmin) / (zmax - zmin) * 255).astype(np.uint8).tobytes()).decode(),
                 cubre=base64.b64encode(np.packbits(cub.reshape(-1)).tobytes()).decode(), x0=int(xs[0]), x1=int(xs[-1]),
                 mano=[round((TW / 2 + (aj['mano'][0] * wf - cfx) * esc) / TW, 4), round(aj['mano'][1], 4)], tela=aj['tela'], piernas=aj['piernas'])

    # --- Busto para el retrato del panel (con su papel de fondo)
    x0, y0, x1, y1 = cajas[0]; lado = int((y1 - y0) * 0.36); cx = (x0 + x1) // 2
    bx0 = max(0, cx - lado // 2); by0 = max(0, y0 - int(lado * 0.1))
    hoja.crop((bx0, by0, bx0 + lado, by0 + lado)).resize((176, 176), Image.LANCZOS).save(os.path.join(A, f'busto-{pid}.webp'), quality=88, method=6)
    if VISTA:
        v = Image.new('RGB', (TW * 3, TH), (255, 0, 255)); v.paste(Image.fromarray(atlas, 'RGBA'), (0, 0), Image.fromarray(atlas[:, :, 3]))
        v.save(os.path.join(VISTA, f'fig-{pid}.png'))
        Image.fromarray(((z - zmin) / (zmax - zmin) * 255).astype(np.uint8)).save(os.path.join(VISTA, f'z-{pid}.png'))
    print(pid, 'teselas', TW, 'x', TH, 'zmax', round(zmax, 1), 'peso', os.path.getsize(os.path.join(A, f'fig-{pid}.webp')) // 1024, 'KB')
    return datos

solo = os.environ.get('SOLO')
ruta = os.path.join(D, 'figuras.json')
figuras = json.load(open(ruta, encoding='utf8')) if solo and os.path.exists(ruta) else {}
for pid, archivo in HOJAS.items():
    if solo and pid not in solo.split(','): continue
    figuras[pid] = procesar(pid, archivo)
json.dump(figuras, open(ruta, 'w', encoding='utf8'), ensure_ascii=False)
print('figuras.json', os.path.getsize(ruta) // 1024, 'KB')
