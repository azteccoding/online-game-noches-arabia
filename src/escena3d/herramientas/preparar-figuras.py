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

HOJAS = {'1': 'hoja-personaje-1-nur-al-din-pose-a.png', '2': 'hoja-personaje-2-zein-al-mawasif.png', '3': 'hoja-personaje-3-anis.png', '4': 'hoja-personaje-4-jamil-al-udhri.png',
         '5': 'hoja-personaje-5-sabio-ruyan.png', '6': 'hoja-personaje-6-zubayda-360-pose-a.png', '7': 'hoja-personaje-7-adi.png', 'B': 'hoja-personaje-B-yafar-el-bermeki.png',
         'G': 'genio.png'}      # el genio de la lámpara (Jorge, 23 nov): lo usa ifrit.js
# Las hojas «-pose-a» salen de la hoja técnica de cinco vistas con hoja-tecnica-a-cuatro-vistas.py (quita las líneas guía y deja frente, tres cuartos, perfil y espalda).
PANEL = (214, 264, 2266, 1402)           # la lámina con las cuatro vistas, dentro de la hoja de 2480 × 1754
HOJA_LAMINA = (2480, 1754); LIBRE = False
VISTAS_M = []          # hoja libre: la máscara propia de cada una de las cuatro vistas
TEXTURA = 0            # hoja libre: umbral de textura («textura» en AJUSTES) para personajes vestidos del color del papel; 0 = por color
UMBRAL_LIBRE = 26      # hoja libre: cuánto puede apartarse un color del papel y seguir siendo papel («umbral» en AJUSTES; se baja si se come ropa clara)
TH = 896                                 # alto de la figura en la textura
PERFIL_A_LA_DERECHA = {'6'}              # personajes cuya vista de perfil mira a la derecha (se voltea para que todos miren a la izquierda)
PASO = 8                                 # paso de la rejilla del relieve, en píxeles de textura
# Ajustes por personaje. «quitar»: rectángulos (x0, y0, x1, y1 en fracción del recorte de frente) que no forman parte del
# cuerpo (un bastón que se modela aparte). «mano»: dónde empuña el arma (fracción del recorte de frente; x desde la izquierda
# de la imagen, y desde arriba). «tela»: tramo de altura (desde arriba) donde la capa, el velo o el chal tienen vuelo.
# «solido»: para figuras con velos o gasas que cuelgan sueltos. Dice qué parte de la silueta de frente es cuerpo de verdad:
#   'cuerpo' son polígonos y 'brazos' líneas de puntos (x, y, radio), todo en fracción de la tesela de frente. El cuerpo se
#   abulta como siempre, cada brazo es un tubo redondo de su propio grosor y el resto de la silueta (la gasa) queda como una
#   lámina delgada. 'perfil' (con 'eje') es el cuerpo en la vista de perfil, en fracción de su recorte: da cuánto sale el cuerpo
#   por delante y por detrás del eje en cada altura (pecho, vientre, cadera), sin contar la tela que cuelga a la espalda.
# «orla»: píxeles del contorno que se repintan con el color de más adentro (quita el filo claro de papel).
# «paso»: paso de la rejilla del relieve si hace falta más fino que el normal (8).
# «bultos»: relieve extra solo por detrás, elipsoides (cx, cy, a, b, alto) en fracción de la tesela (alto, en fracción de su altura).
ZUBAYDA_SOLIDO = dict(
    cuerpo=[[(0.40, 0), (0.60, 0), (0.66, 0.05), (0.68, 0.13), (0.725, 0.17), (0.735, 0.215), (0.70, 0.255), (0.665, 0.29), (0.65, 0.335), (0.69, 0.39), (0.705, 0.47),
             (0.70, 0.62), (0.69, 0.80), (0.70, 0.955), (0.67, 1), (0.27, 1), (0.25, 0.955), (0.31, 0.80), (0.31, 0.62), (0.305, 0.47), (0.325, 0.39), (0.385, 0.335),
             (0.33, 0.29), (0.295, 0.255), (0.275, 0.215), (0.285, 0.17), (0.32, 0.13), (0.34, 0.05)]],
    brazos=[[(0.295, 0.195, 0.045), (0.263, 0.262, 0.042), (0.196, 0.346, 0.036), (0.123, 0.430, 0.036), (0.085, 0.480, 0.030), (0.067, 0.536, 0.026)],
            [(0.699, 0.195, 0.045), (0.732, 0.262, 0.042), (0.799, 0.346, 0.036), (0.882, 0.430, 0.036), (0.920, 0.480, 0.030), (0.938, 0.516, 0.026)]],
    perfil=[(0.30, 0), (0.17, 0.035), (0.15, 0.09), (0.20, 0.13), (0.30, 0.165), (0.22, 0.19), (0.04, 0.225), (0.02, 0.25), (0.08, 0.285), (0.14, 0.31), (0.10, 0.36), (0.07, 0.40),
            (0.07, 0.46), (0.10, 0.55), (0.13, 0.65), (0.14, 0.75), (0.12, 0.90), (0.06, 0.97), (0.08, 1), (0.55, 1), (0.52, 0.95), (0.47, 0.85), (0.50, 0.75), (0.55, 0.65),
            (0.66, 0.56), (0.76, 0.50), (0.77, 0.46), (0.70, 0.41), (0.60, 0.37), (0.70, 0.32), (0.78, 0.25), (0.80, 0.15), (0.76, 0.06), (0.62, 0)], eje=0.38)
# Zubayda v2 (Jorge, 23 nov, hoja técnica v3): el velo largo cae de la diadema por la espalda y cubre solo su brazo derecho (a la
# izquierda de la imagen de frente); funciona como capa. La falda cuenta como cuerpo; el velo es lámina delgada.
ZUBAYDA_V2_SOLIDO = dict(
    cuerpo=[[(0.44, 0), (0.57, 0), (0.60, 0.05), (0.60, 0.10), (0.57, 0.145), (0.62, 0.17), (0.71, 0.20), (0.71, 0.245), (0.675, 0.27), (0.645, 0.30), (0.63, 0.34), (0.67, 0.39),
             (0.70, 0.45), (0.71, 0.52), (0.72, 0.62), (0.74, 0.72), (0.76, 0.85), (0.78, 0.96), (0.74, 1), (0.27, 1), (0.25, 0.96), (0.27, 0.85), (0.29, 0.72), (0.31, 0.62),
             (0.32, 0.52), (0.33, 0.45), (0.36, 0.39), (0.40, 0.34), (0.385, 0.30), (0.36, 0.27), (0.33, 0.245), (0.33, 0.20), (0.42, 0.17), (0.46, 0.145), (0.42, 0.10), (0.42, 0.05)]],
    brazos=[[(0.34, 0.225, 0.042), (0.28, 0.29, 0.040), (0.21, 0.355, 0.034), (0.14, 0.42, 0.032), (0.095, 0.46, 0.028), (0.07, 0.51, 0.024)],
            [(0.70, 0.225, 0.042), (0.75, 0.29, 0.040), (0.81, 0.345, 0.034), (0.88, 0.415, 0.032), (0.92, 0.46, 0.028), (0.945, 0.51, 0.024)]],
    perfil=[(0.36, 0), (0.24, 0.035), (0.21, 0.09), (0.26, 0.13), (0.32, 0.165), (0.24, 0.19), (0.05, 0.225), (0.03, 0.25), (0.10, 0.285), (0.15, 0.31), (0.13, 0.36), (0.12, 0.40),
            (0.12, 0.46), (0.12, 0.55), (0.13, 0.65), (0.13, 0.75), (0.11, 0.90), (0.07, 0.97), (0.08, 1), (0.58, 1), (0.56, 0.95), (0.55, 0.85), (0.57, 0.75), (0.60, 0.65),
            (0.66, 0.56), (0.71, 0.50), (0.71, 0.46), (0.64, 0.41), (0.56, 0.37), (0.60, 0.32), (0.64, 0.25), (0.64, 0.15), (0.66, 0.06), (0.58, 0)], eje=0.38)
# Zubayda v3 (Jorge, 24 nov, hojas de 360°): velo continuo de la diadema al hombro derecho y sobre ese brazo; brazo izquierdo
# descubierto y pierna izquierda fuera de la falda. «perfil» es su costado derecho (volteado para mirar a la izquierda) y
# «perfil2» el costado izquierdo, de la hoja «izquierda».
ZUBAYDA_V3_SOLIDO = dict(
    cuerpo=[[(0.43, 0), (0.58, 0), (0.62, 0.05), (0.62, 0.10), (0.57, 0.155), (0.63, 0.18), (0.73, 0.205), (0.74, 0.25), (0.70, 0.28), (0.675, 0.31), (0.67, 0.34), (0.70, 0.39),
             (0.73, 0.44), (0.76, 0.52), (0.75, 0.60), (0.73, 0.68), (0.72, 0.80), (0.73, 0.96), (0.70, 1), (0.30, 1), (0.27, 0.96), (0.29, 0.80), (0.32, 0.68), (0.33, 0.58),
             (0.34, 0.50), (0.35, 0.44), (0.37, 0.39), (0.40, 0.34), (0.385, 0.31), (0.37, 0.28), (0.34, 0.25), (0.34, 0.205), (0.42, 0.18), (0.46, 0.155), (0.40, 0.10), (0.40, 0.05)]],
    brazos=[[(0.335, 0.225, 0.042), (0.27, 0.29, 0.040), (0.20, 0.355, 0.034), (0.13, 0.425, 0.032), (0.095, 0.47, 0.028), (0.07, 0.52, 0.024)],
            [(0.745, 0.235, 0.042), (0.80, 0.30, 0.040), (0.85, 0.365, 0.034), (0.895, 0.43, 0.032), (0.92, 0.47, 0.028), (0.945, 0.52, 0.024)]],
    perfil=[(0.42, 0), (0.31, 0.04), (0.29, 0.09), (0.33, 0.13), (0.38, 0.165), (0.30, 0.19), (0.14, 0.225), (0.12, 0.25), (0.19, 0.285), (0.22, 0.31), (0.21, 0.36), (0.19, 0.42),
            (0.17, 0.50), (0.11, 0.60), (0.06, 0.70), (0.10, 0.80), (0.08, 0.90), (0.03, 0.96), (0.05, 1), (0.50, 1), (0.48, 0.95), (0.50, 0.85), (0.55, 0.75), (0.62, 0.62),
            (0.68, 0.52), (0.69, 0.47), (0.62, 0.41), (0.55, 0.36), (0.58, 0.30), (0.63, 0.24), (0.62, 0.16), (0.64, 0.07), (0.58, 0)], eje=0.40,
    perfil2=[(0.42, 0), (0.33, 0.04), (0.30, 0.09), (0.34, 0.13), (0.39, 0.165), (0.33, 0.19), (0.23, 0.225), (0.21, 0.25), (0.28, 0.285), (0.30, 0.31), (0.28, 0.36), (0.26, 0.42),
             (0.20, 0.50), (0.13, 0.60), (0.11, 0.68), (0.15, 0.80), (0.13, 0.90), (0.08, 0.96), (0.10, 1), (0.52, 1), (0.50, 0.95), (0.52, 0.85), (0.56, 0.75), (0.62, 0.62),
             (0.66, 0.52), (0.67, 0.47), (0.61, 0.41), (0.55, 0.36), (0.57, 0.30), (0.61, 0.24), (0.60, 0.16), (0.62, 0.07), (0.58, 0)])
NUR_SOLIDO = dict(
    cuerpo=[[(0.50, 0), (0.53, 0), (0.60, 0.05), (0.635, 0.10), (0.62, 0.17), (0.66, 0.20), (0.76, 0.235), (0.79, 0.28), (0.74, 0.33), (0.69, 0.38), (0.69, 0.45), (0.71, 0.52),
             (0.72, 0.68), (0.73, 0.83), (0.77, 0.88), (0.78, 1), (0.26, 1), (0.27, 0.88), (0.29, 0.83), (0.30, 0.68), (0.30, 0.52), (0.35, 0.45), (0.36, 0.38), (0.30, 0.33),
             (0.24, 0.28), (0.265, 0.235), (0.37, 0.20), (0.40, 0.17), (0.395, 0.10), (0.43, 0.05)]],
    brazos=[[(0.27, 0.27, 0.055), (0.20, 0.355, 0.052), (0.105, 0.44, 0.042), (0.06, 0.50, 0.032), (0.045, 0.55, 0.026)],
            [(0.76, 0.27, 0.055), (0.83, 0.355, 0.052), (0.905, 0.44, 0.042), (0.945, 0.49, 0.032), (0.96, 0.53, 0.026)]],
    perfil=[(0.56, 0), (0.50, 0.04), (0.30, 0.06), (0.27, 0.10), (0.31, 0.13), (0.31, 0.17), (0.27, 0.20), (0.22, 0.23), (0.20, 0.30), (0.17, 0.40), (0.13, 0.50), (0.10, 0.60),
            (0.10, 0.70), (0.09, 0.80), (0.11, 0.855), (0.20, 0.88), (0.20, 0.95), (0.17, 0.985), (0.18, 1), (0.66, 1), (0.64, 0.93), (0.66, 0.87), (0.72, 0.84), (0.70, 0.70),
            (0.68, 0.50), (0.68, 0.36), (0.74, 0.26), (0.74, 0.20), (0.68, 0.16), (0.74, 0.10), (0.70, 0.05), (0.62, 0)], eje=0.44)
AJUSTES = {
    # Nur al Din (Jorge, 23 nov): hoja técnica en pose A; brazos simétricos y la capa como tela delgada
    '1': dict(mano=(0.03, 0.52), tela=(0.2, 0.9), piernas=0.86, orla=2, paso=4, solido=NUR_SOLIDO),
    '2': dict(mano=(0.53, 0.44), tela=(0.12, 0.9), piernas=0, umbral=18),      # manos juntas al frente: ahí va el arma
    '3': dict(mano=(0.16, 0.50), tela=(0.15, 0.9), piernas=0, textura=7.5),
    '4': dict(mano=(0.14, 0.505), tela=(0.2, 0.9), piernas=0, umbral=18),
    '5': dict(mano=(0.17, 0.52), tela=(0.15, 0.9), piernas=0, textura=7.5),
    # Zubayda (Jorge, 23 nov: «brazo izquierdo muy grande y más ancha»; las gasas son láminas delgadas, no cuerpo; de espaldas se le marcan las pompas)
    # (zubayda_v1 se hizo con hoja-personaje-6-zubayda-pose-a.png, mano=(0.05, 0.50), tela=(0.15, 0.8), solido=ZUBAYDA_SOLIDO y bultos en x 0.415 y 0.585, y 0.475)
    # (zubayda_v2: hoja-personaje-6-zubayda-v3-pose-a.png, mano=(0.06, 0.50), tela=(0.10, 0.66), solido=ZUBAYDA_V2_SOLIDO, bultos en x 0.435 y 0.60, y 0.485)
    '6': dict(mano=(0.07, 0.51), tela=(0.10, 0.66), piernas=0, orla=3, paso=4, izquierda='hoja-personaje-6-zubayda-360-izquierda.png', solido=ZUBAYDA_V3_SOLIDO, torso=(0.17, 0.47, 1.25), bultos=[(0.455, 0.47, 0.10, 0.062, 0.016), (0.625, 0.47, 0.10, 0.062, 0.016)]),
    '7': dict(mano=(0.23, 0.51), tela=(0.15, 0.9), piernas=0, umbral=18),
    'B': dict(mano=(0.72, 0.40), tela=(0.2, 0.9), piernas=0, umbral=18),      # la bolsa va en la derecha: el arma, en la izquierda
    'G': dict(mano=(0.5, 0.4), tela=(0.55, 1.0), piernas=0),      # genio: la cola de humo ondula como una tela
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
    cortes = None; VISTAS_M.clear()
    if LIBRE:
        ys = np.where(m.any(axis=1))[0]; arriba = m[:int(ys[0] + (ys[-1] - ys[0]) * 0.86)]
        masa = ndi.uniform_filter1d(arriba.sum(axis=0).astype(np.float32), max(5, W // 120))
        gorda = ndi.gaussian_filter1d(masa, W / 50)      # un pico por figura
        picos = [x for x in range(1, W - 1) if gorda[x] >= gorda[x - 1] and gorda[x] > gorda[x + 1] and gorda[x] > gorda.max() * 0.45]
        picos = [x for k, x in enumerate(picos) if k == 0 or x - picos[k - 1] > W / 14]
        if len(picos) >= 4:
            entre = [picos[k] + int(np.argmin(masa[picos[k]:picos[k + 1]])) for k in range(len(picos) - 1)]
            cortes = [0, entre[0], entre[1], entre[2], entre[3] if len(entre) > 3 else W]
            # El corte entre dos figuras no es una recta: en cada fila pasa por el hueco de papel más cercano al valle, para no
            # rebanar un escudo o un manto que se mete en la franja de la vecina.
            costuras = [np.zeros(H)]
            for k in range(len(entre)):
                a, b, v = picos[k], picos[k + 1], entre[k]; s = np.full(H, np.nan)
                for y in range(H):
                    libre = ~m[y, a:b]
                    if libre.all(): s[y] = v; continue
                    et, n = ndi.label(libre)
                    if n == 0: continue
                    cs = [(np.where(et == j)[0][0] + np.where(et == j)[0][-1]) / 2 + a for j in range(1, n + 1)]
                    s[y] = min(cs, key=lambda c: abs(c - v))
                hay = ~np.isnan(s); s = np.interp(np.arange(H), np.arange(H)[hay], s[hay]) if hay.any() else np.full(H, float(v))
                costuras.append(s)
            if len(costuras) < 5: costuras.append(np.full(H, float(W)))
            xx = np.arange(W)[None, :]
            VISTAS_M[:] = [m & (xx >= costuras[k][:, None]) & (xx < costuras[k + 1][:, None]) for k in range(4)]
    if cortes is not None: pass
    else:
        cortes = [0]
        for f in (0.25, 0.5, 0.75):
            a, b = int(W * (f - 0.09)), int(W * (f + 0.09)); cortes.append(a + int(np.argmin(col[a:b])))
        cortes.append(W)
    cajas = []
    if LIBRE and cortes is not None and len(VISTAS_M) == 4:      # cada figura con su propia máscara (la caja puede pisar a la vecina)
        tiradas = []
        for k in range(4):
            sub = VISTAS_M[k]; et, n = ndi.label(sub)
            if n == 0: tiradas.append(np.zeros_like(sub)); continue
            tam = ndi.sum(sub, et, range(1, n + 1)); keep = np.isin(et, 1 + np.where(tam > tam.max() * 0.025)[0])
            tiradas.append(sub & ~keep); VISTAS_M[k] = keep
        # Jorge (23 de noviembre): a Nur al Din le faltaba la mano izquierda. La muñeca es tan delgada que el «opening» la separa del
        # puño, y la costura entre dos vistas la partía: un trozo quedaba suelto en su vista y otro en la vecina, y los dos se tiraban
        # como motas. Un pedazo tirado que queda a pocos píxeles de una figura (de su vista o de la vecina) se le devuelve; se repite
        # para que vuelvan también los que tocan a un pedazo ya devuelto.
        piezas = []
        for j in range(4):
            et, n = ndi.label(tiradas[j])
            for l, sl in enumerate(ndi.find_objects(et), start=1):
                if sl is None: continue
                y0, y1 = max(0, sl[0].start - 8), min(H, sl[0].stop + 8); x0, x1 = max(0, sl[1].start - 8), min(W, sl[1].stop + 8)
                pieza = et[y0:y1, x0:x1] == l
                piezas.append((y0, y1, x0, x1, pieza, ndi.binary_dilation(pieza, iterations=6)))
        for _ in range(3):
            quedan = []
            for (y0, y1, x0, x1, pieza, cerca) in piezas:
                k = next((k for k in range(4) if (cerca & VISTAS_M[k][y0:y1, x0:x1]).any()), None)
                if k is None: quedan.append((y0, y1, x0, x1, pieza, cerca))
                else: VISTAS_M[k][y0:y1, x0:x1] |= pieza
            if len(quedan) == len(piezas): break
            piezas = quedan
        for k in range(4):
            sub = VISTAS_M[k]
            if not sub.any(): continue
            xs = np.where(sub.any(axis=0))[0]; ys = np.where(sub.any(axis=1))[0]
            cajas.append((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))
        return cajas
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

def procesar(pid, archivo, solo_perfil=False):
    global LIBRE, UMBRAL_LIBRE, TEXTURA
    UMBRAL_LIBRE = AJUSTES[pid].get('umbral', 26); TEXTURA = AJUSTES[pid].get('textura', 0)
    # «izquierda»: segunda hoja de cuatro vistas cuya tercera figura es el perfil IZQUIERDO (mirando a la izquierda). Con ella la
    # figura lleva un costado distinto para cada lado (Zubayda: velo solo en su brazo derecho; Jorge, 24 de noviembre).
    izq = procesar(pid, AJUSTES[pid]['izquierda'], solo_perfil=True) if AJUSTES[pid].get('izquierda') and not solo_perfil else None
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
        m = ndi.binary_opening(m, iterations=1); cajas = vistas(m)
    if LIBRE and TEXTURA:      # silueta de túnica y manto: se cierran las mordidas, se rellena cada fila de borde a borde y se recorta el halo de papel
        nueva = np.zeros_like(m)
        for k, (x0, y0, x1, y1) in enumerate(cajas):
            sub = np.pad(VISTAS_M[k][y0:y1, x0:x1], 20); sub = ndi.binary_closing(sub, structure=np.ones((17, 17)), iterations=1)[20:-20, 20:-20]
            for y in range(sub.shape[0]):
                xs = np.where(sub[y])[0]
                if len(xs): sub[y, xs[0]:xs[-1] + 1] = True
            for x in range(sub.shape[1]):      # y cada columna de arriba abajo: el manto cae recto, sin entrantes
                ys = np.where(sub[:, x])[0]
                if len(ys): sub[ys[0]:ys[-1] + 1, x] = True
            nueva[y0:y1, x0:x1] |= ndi.binary_erosion(sub, iterations=4)
        m = nueva
        cajas = vistas(m)
    rgb = np.asarray(hoja, dtype=np.uint8)

    def recorte(k, espejo=False):
        x0, y0, x1, y1 = cajas[k]
        mm = (VISTAS_M[k] if len(VISTAS_M) == 4 else m)[y0:y1, x0:x1].copy(); cc = rgb[y0:y1, x0:x1].copy()
        et, n = ndi.label(mm)
        if n > 1:      # solo la figura (lo más grande) y lo que casi la toca
            tam = ndi.sum(mm, et, range(1, n + 1)); mm = np.isin(et, 1 + np.where(tam > tam.max() * (0.025 if LIBRE else 0.004))[0])      # hoja libre: el papel pintado deja motas más grandes
            if LIBRE and len(VISTAS_M) == 4:      # lo que está a pocos píxeles de la figura (una mano con la muñeca delgada) se queda
                for _ in range(3):
                    mas = np.isin(et, np.unique(et[ndi.binary_dilation(mm, iterations=6) & (et > 0)]))
                    if (mas == mm).all(): break
                    mm = mas
        if espejo: mm = mm[:, ::-1]; cc = cc[:, ::-1]
        return mm, cc

    if solo_perfil: return recorte(2)      # hoja «izquierda»: solo interesa su vista de perfil
    mf, cf = recorte(0); mb, cb = recorte(3, espejo=True); mp, cp = recorte(2, espejo=pid in PERFIL_A_LA_DERECHA)
    if izq is not None: VISTAS_M[:] = []      # las máscaras por vista eran de la otra hoja
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
    if aj.get('orla'):      # la espalda también trae su orla de papel: se pinta desde más adentro y su silueta se da por más estrecha
        mBe = ndi.binary_erosion(mB, iterations=aj['orla'] + 1); cB = rellenar(np.asarray(colB), mBe)
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
        if a1 - a0 < 4: cBw[y] = cB[y]; mBw[y] = (mBe if aj.get('orla') else mB)[y]; continue
        t = (cols - a0) / (a1 - a0); src = np.clip(bi2[y] + t * (bd2[y] - bi2[y]), 0, TW - 1)
        for c in range(3): cBw[y, :, c] = np.interp(src, cols, cB[y, :, c])
        mBw[y] = np.interp(src, cols, (mBe if aj.get('orla') else mB)[y].astype(np.float32))
    # lo que solo existe en la vista de frente (un bastón, una lámpara) lleva por detrás su mismo color de frente
    lejos = np.clip((ndi.distance_transform_edt(mBw < 0.5) - 4) / 6, 0, 1)[..., None]
    cB = (cBw * (1 - lejos) + cF * lejos).astype(np.uint8)
    alfa_suave = np.asarray(alfF.filter(ImageFilter.GaussianBlur(0.7)))
    if aj.get('orla'):      # el contorno pintado se funde con el papel (más aún en una gasa): esa orla clara se repinta con el color de más adentro
        mE = ndi.binary_erosion(mF, iterations=aj['orla']); _, (iy, ix) = ndi.distance_transform_edt(~mE, return_indices=True)
        cF = cF[iy, ix]; cB = cB[iy, ix]
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
    fondoF = fondoB = None
    if aj.get('solido', {}).get('perfil'):      # el cuerpo en la vista de perfil (sin la gasa ni la capa que cuelgan detrás): da el fondo por delante y por detrás del eje
        from PIL import ImageDraw
        lp_ = Image.new('L', (wP, TH), 0); ImageDraw.Draw(lp_).polygon([(px * wP, py * TH) for px, py in aj['solido']['perfil']], fill=255)
        mPB = (np.asarray(lp_) > 127) & mP; hayB = mPB.any(axis=1); eje = aj['solido']['eje'] * wP
        pf = np.where(hayB, mPB.argmax(axis=1), np.nan); pb = np.where(hayB, wP - 1 - mPB[:, ::-1].argmax(axis=1), np.nan)
        lisa = lambda v: ndi.gaussian_filter1d(ndi.median_filter(np.interp(ys, ys[hayB], v[hayB]), 7), 4)
        pi_, pd_ = lisa(pf), lisa(pb)
        fondoF = np.maximum(eje - pi_, 6) * 0.96; fondoB = np.maximum(pd_ - eje, 6) * 0.96
        if aj.get('torso'):      # (y0, y1, factor): el torso salía más delgado que en la vista de perfil (el redondeo le come fondo); se engruesa en esas alturas
            ty0, ty1, tf = aj['torso']; yn_ = ys / TH; gan = 1 + (tf - 1) * np.clip((yn_ - ty0) / 0.03, 0, 1) * np.clip((ty1 - yn_) / 0.04, 0, 1)
            fondoF = fondoF * gan; fondoB = fondoB * gan
    cL = np.empty((TH, TW, 3), dtype=np.uint8); us = np.linspace(0, 1, TW); colsP = np.arange(wP, dtype=np.float32)
    for y in range(TH):
        src = np.clip(pi_[y] + us * (pd_[y] - pi_[y]), 0, wP - 1)
        for c in range(3): cL[y, :, c] = np.interp(src, colsP, cP[y, :, c])
    NT = 3; cL2 = None
    if izq is not None:      # cuarta tesela: el costado izquierdo, de su propia vista de perfil
        mp2, cp2 = izq; h2, w2 = mp2.shape; wP2 = max(1, round(w2 * TH / h2))
        colP2 = np.asarray(Image.fromarray(rellenar(cp2, mp2)).resize((wP2, TH), Image.LANCZOS))
        mP2 = np.asarray(Image.fromarray((mp2 * 255).astype(np.uint8)).resize((wP2, TH), Image.LANCZOS)) > 127
        cP2 = rellenar(colP2, mP2)
        from PIL import ImageDraw
        l2 = Image.new('L', (wP2, TH), 0); ImageDraw.Draw(l2).polygon([(px * wP2, py * TH) for px, py in aj['solido']['perfil2']], fill=255)
        m2 = (np.asarray(l2) > 127) & mP2; hay2 = m2.any(axis=1)
        f2 = np.where(hay2, m2.argmax(axis=1), np.nan); b2 = np.where(hay2, wP2 - 1 - m2[:, ::-1].argmax(axis=1), np.nan)
        lisa2 = lambda v: ndi.gaussian_filter1d(ndi.median_filter(np.interp(ys, ys[hay2], v[hay2]), 7), 4)
        f2, b2 = lisa2(f2), lisa2(b2); cL2 = np.empty((TH, TW, 3), dtype=np.uint8); cols2 = np.arange(wP2, dtype=np.float32)
        for y in range(TH):
            src = np.clip(f2[y] + us * (b2[y] - f2[y]), 0, wP2 - 1)
            for c in range(3): cL2[y, :, c] = np.interp(src, cols2, cP2[y, :, c])
        NT = 4
        if VISTA: vp2 = np.full((TH, wP2, 3), (255, 0, 255), dtype=np.uint8); vp2[mP2] = colP2[mP2]; Image.fromarray(vp2).save(os.path.join(VISTA, f'perfil2-{pid}.png'))
    atlas = np.zeros((TH, TW * NT, 4), dtype=np.uint8)
    atlas[:, :TW, :3] = cF; atlas[:, :TW, 3] = alfa_suave
    atlas[:, TW:TW * 2, :3] = cB; atlas[:, TW:TW * 2, 3] = alfa_suave
    atlas[:, TW * 2:TW * 3, :3] = cL; atlas[:, TW * 2:, 3] = 255
    if cL2 is not None: atlas[:, TW * 3:, :3] = cL2
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
    if aj.get('solido'):      # cuerpo y brazos con volumen; la gasa que cuelga, una lámina delgada
        from PIL import ImageDraw
        sol = aj['solido']; lz = Image.new('L', (TW, TH), 0); dib = ImageDraw.Draw(lz)
        for pol in sol.get('cuerpo', []): dib.polygon([(px * TW, py * TH) for px, py in pol], fill=255)
        mS = (np.asarray(lz) > 127) & mF
        sdS = ndi.distance_transform_edt(mS) - 0.5
        if fondoF is not None: Rf = ((fondoF + fondoB) / 2)[:, None]; Dm = 0.7 * Rf
        forma = np.where(mS, np.sin(np.pi / 2 * np.minimum(sdS, Dm) / Dm), 0)
        zc = Rf * forma if fondoF is None else fondoF[:, None] * forma; zcB = None if fondoF is None else fondoB[:, None] * forma
        yy, xx = np.mgrid[0:TH, 0:TW].astype(np.float32); zt = np.zeros((TH, TW), dtype=np.float32)
        for linea in sol.get('brazos', []):
            for (ax, ay, ar), (bx, by, br) in zip(linea, linea[1:]):
                ax, bx, ar, br = ax * TW, bx * TW, ar * TW, br * TW; ay, by = ay * TH, by * TH
                t = np.clip(((xx - ax) * (bx - ax) + (yy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1)
                d2 = (xx - ax - t * (bx - ax)) ** 2 + (yy - ay - t * (by - ay)) ** 2; r = ar + t * (br - ar)
                zt = np.maximum(zt, np.sqrt(np.clip(r * r - d2, 0, None)) * 0.9)
        zt = np.where(mF, ndi.gaussian_filter(zt, 3.0) * 1.12, 0) * np.clip(sd / 5, 0, 1)      # suavizado al paso de la rejilla (que el tubo no salga a dientes) y cerrado en cero justo en el contorno
        LAMINA = 5.0      # medio grosor de la gasa, en píxeles de textura
        dentro = np.maximum(np.maximum(zc, zt), np.minimum(sd, LAMINA))
        # fuera de la silueta el relieve baja con la pendiente de lo que tiene al lado: fuerte junto al cuerpo, suave junto a la gasa
        _, (iy, ix) = ndi.distance_transform_edt(~mF, return_indices=True)
        cerca = np.where(mS[iy, ix], np.pi / 2 * (Rf / Dm), np.where(zt[iy, ix] > LAMINA, 1.2, 0.5))
        z = np.where(sd >= 0, dentro, cerca * sd)
        fina_m = mF & ~ndi.binary_dilation(mS, iterations=3) & (zt <= LAMINA)      # la gasa suelta: de perfil puro la escena la pinta con la vista de perfil (de canto era una raya sobre el cuerpo)
        zEsp = None if zcB is None else np.where(sd >= 0, np.maximum(np.maximum(zcB, zt), np.minimum(sd, LAMINA)), cerca * sd)
    zEsp = None if not aj.get('solido') or zEsp is None else np.clip(ndi.gaussian_filter(zEsp, 1.5), -40, None)
    z = np.clip(ndi.gaussian_filter(z, 1.5), -40, None)
    zb = zEsp if aj.get('solido') else None
    if aj.get('bultos'):      # la cáscara de detrás lleva su propio relieve: el de delante más los bultos
        yy, xx = np.mgrid[0:TH, 0:TW].astype(np.float32); extra = np.zeros((TH, TW), dtype=np.float32)
        for (bcx, bcy, ba, bb, bh) in aj['bultos']:
            q = 1 - ((xx / TW - bcx) / ba) ** 2 - ((yy / TH - bcy) / bb) ** 2
            extra = np.maximum(extra, bh * TH * np.sqrt(np.clip(q, 0, None)))
        zb = (z if zb is None else zb) + ndi.gaussian_filter(np.where(mF, extra, 0), 2.0)
    zmax = float(max(z.max(), zb.max() if zb is not None else z.max())); zmin = float(z.min())
    PF = aj.get('paso', PASO)      # rejilla más fina para figuras con brazos sueltos y telas delgadas
    gy, gx = TH // PF + 1, TW // PF + 1
    zg = np.zeros((gy, gx), dtype=np.float32)
    for j in range(gy):
        for i in range(gx):
            y, x = min(TH - 1, j * PF), min(TW - 1, i * PF); zg[j, i] = z[y, x]
    cod = lambda g: base64.b64encode(np.round((g - zmin) / (zmax - zmin) * 255).astype(np.uint8).tobytes()).decode()
    cub = np.zeros((gy - 1, gx - 1), dtype=np.uint8)
    for j in range(gy - 1):
        for i in range(gx - 1):
            cub[j, i] = 1 if mF[j * PF:(j + 1) * PF + 1, i * PF:(i + 1) * PF + 1].any() else 0
    xs = np.where(mF.any(axis=0))[0]
    datos = dict(tw=TW, th=TH, teselas=NT, paso=PF, zmax=round(zmax, 2), zmin=round(zmin, 2), z=cod(zg),
                 cubre=base64.b64encode(np.packbits(cub.reshape(-1)).tobytes()).decode(), x0=int(xs[0]), x1=int(xs[-1]),
                 mano=[round((TW / 2 + (aj['mano'][0] * wf - cfx) * esc) / TW, 4), round(aj['mano'][1], 4)], tela=aj['tela'], piernas=aj['piernas'])

    if aj.get('solido') and aj.get('izquierda'):
        fg = np.zeros((gy, gx), dtype=np.uint8)
        for j in range(gy):
            for i in range(gx): fg[j, i] = 1 if fina_m[min(TH - 1, j * PF), min(TW - 1, i * PF)] else 0
        datos['fina'] = base64.b64encode(np.packbits(fg.reshape(-1)).tobytes()).decode()
    if zb is not None: datos['zb'] = cod(zb[np.minimum(TH - 1, np.arange(gy) * PF)][:, np.minimum(TW - 1, np.arange(gx) * PF)])

    # --- Busto para el retrato del panel (con su papel de fondo)
    x0, y0, x1, y1 = cajas[0]; lado = int((y1 - y0) * 0.36); cx = (x0 + x1) // 2
    bx0 = max(0, cx - lado // 2); by0 = max(0, y0 - int(lado * 0.1))
    hoja.crop((bx0, by0, bx0 + lado, by0 + lado)).resize((176, 176), Image.LANCZOS).save(os.path.join(A, f'busto-{pid}.webp'), quality=88, method=6)
    if VISTA:
        v = Image.new('RGB', (TW * NT, TH), (255, 0, 255)); v.paste(Image.fromarray(atlas, 'RGBA'), (0, 0), Image.fromarray(atlas[:, :, 3]))
        v.save(os.path.join(VISTA, f'fig-{pid}.png'))
        Image.fromarray(((z - zmin) / (zmax - zmin) * 255).astype(np.uint8)).save(os.path.join(VISTA, f'z-{pid}.png'))
        if zb is not None: Image.fromarray(((zb - zmin) / (zmax - zmin) * 255).astype(np.uint8)).save(os.path.join(VISTA, f'zb-{pid}.png'))
        vp = np.full((TH, wP, 3), (255, 0, 255), dtype=np.uint8); vp[mP] = colP[mP]; Image.fromarray(vp).save(os.path.join(VISTA, f'perfil-{pid}.png'))
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
