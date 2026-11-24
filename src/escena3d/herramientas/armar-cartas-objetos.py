# Cartas de objetos armadas con las hojas de vistas de Jorge (24 de noviembre de 2026: «arma las cartas de objetos, ya tienes
# escudo, armas, etc., incluida la flecha» y «arma la carta de genio con la imagen del genio y la lámpara»). De cada hoja se recorta
# una vista y se pone sobre un fondo vertical 2:3 (800 × 1200), como las demás cartas pintadas:
#   armas, flechas y escudo → sobre el fondo genérico de objetos (GEN-3, el zoco), oscurecido para que el objeto resalte
#   genio → el genio saliendo de la lámpara, sobre un fondo de noche
# Salen a public/arte/cartas/<nombre>.webp; el alta va en src/data/arteCartas.json (clave = id de la carta, «imagen» = nombre).
# Uso: python3 -I armar-cartas-objetos.py <carpeta de arte (con armas/ y transportes/)> [<repo>]
import sys, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ARTE = sys.argv[1]
R = sys.argv[2] if len(sys.argv) > 2 else os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
W, H = 800, 1200

def vistas(ruta, umbral=24, rellenar=True, cierre=25):
    """Las vistas de una hoja, de izquierda a derecha, recortadas y con transparencia."""
    im = np.asarray(Image.open(ruta).convert('RGB')).astype(np.float32); h, w, _ = im.shape
    fila = ndi.gaussian_filter1d(np.median(im[:, :8], axis=1), 12, axis=0)
    m = ndi.binary_closing(np.sqrt(((im - fila[:, None, :]) ** 2).sum(axis=2)) > umbral, iterations=2)
    if rellenar: m = ndi.binary_fill_holes(m)
    lab, n = ndi.label(m); tam = ndi.sum(m, lab, range(1, n + 1)); m = np.isin(lab, 1 + np.nonzero(tam > 150)[0])
    col = ndi.binary_closing(m.any(axis=0), structure=np.ones(cierre)); grupos, x0 = [], None
    for x in range(w):
        if col[x] and x0 is None: x0 = x
        if not col[x] and x0 is not None: grupos.append((x0, x)); x0 = None
    if x0 is not None: grupos.append((x0, w))
    res = []
    for a, b in [g for g in grupos if g[1] - g[0] > 12]:
        mv = np.zeros_like(m); mv[:, a:b] = m[:, a:b]; ys, xs = np.nonzero(mv); y0, y1, xa, xb = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        _, (iy, ix) = ndi.distance_transform_edt(~ndi.binary_erosion(mv, iterations=2), return_indices=True)
        alfa = Image.fromarray((mv[y0:y1, xa:xb] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        v = Image.fromarray(im[iy, ix][y0:y1, xa:xb].astype(np.uint8)).convert('RGBA'); v.putalpha(alfa); res.append(v)
    return res

def fondo_zoco():
    g = Image.open(os.path.join(R, 'public', 'arte', 'cartas', 'GEN-3.webp')).convert('RGB').resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(3))
    a = np.asarray(g).astype(np.float32); yy, xx = np.mgrid[0:H, 0:W]
    luz = 0.34 + 0.22 * np.exp(-(((xx - W / 2) / (W * 0.5)) ** 2 + ((yy - H * 0.42) / (H * 0.42)) ** 2))      # más oscuro en las orillas
    return Image.fromarray(np.clip(a * luz[..., None], 0, 255).astype(np.uint8))

def fondo_noche():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.exp(-(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H * 0.40) / (H * 0.46)) ** 2))
    brasa = np.exp(-(((xx - W * 0.6) / (W * 0.5)) ** 2 + ((yy - H * 0.66) / (H * 0.16)) ** 2))      # resplandor cálido de la lámpara
    a = np.array([10, 14, 34])[None, None] * (1 - d[..., None]) + np.array([28, 86, 104])[None, None] * d[..., None] + np.array([120, 70, 18])[None, None] * brasa[..., None] * 0.7
    rng = np.random.default_rng(7); a += rng.normal(0, 2.2, (H, W, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def poner(fondo, v, caja, giro=0, sombra=True):
    """Pega la vista dentro de la caja (x0, y0, x1, y1), centrada y sin deformar, con una sombra suave detrás."""
    if giro: v = v.rotate(giro, expand=True, resample=Image.BICUBIC)
    x0, y0, x1, y1 = caja; e = min((x1 - x0) / v.width, (y1 - y0) / v.height); v = v.resize((max(1, round(v.width * e)), max(1, round(v.height * e))), Image.LANCZOS)
    px, py = round((x0 + x1 - v.width) / 2), round((y0 + y1 - v.height) / 2)
    if sombra:
        s = Image.new('RGBA', fondo.size, (0, 0, 0, 0)); negro = Image.new('RGBA', v.size, (0, 0, 0, 150)); negro.putalpha(v.getchannel('A').point(lambda t: t * 150 // 255))
        s.paste(negro, (px + 14, py + 20)); fondo.paste(Image.new('RGB', fondo.size, (0, 0, 0)), (0, 0), s.filter(ImageFilter.GaussianBlur(16)).getchannel('A'))
    fondo.paste(v, (px, py), v); return (px, py, px + v.width, py + v.height)

def guardar(im, nombre):
    im.save(os.path.join(R, 'public', 'arte', 'cartas', nombre + '.webp'), quality=88, method=6); print(nombre)

CAJA = (90, 150, W - 90, 880)      # el objeto va arriba y al centro: abajo queda sitio para el texto de la carta
for nombre, hoja, giro in [('it-cimitarra', 'armas/cimitarra.png', 0), ('it-alfanje', 'armas/alfanje.png', 0), ('it-jambiya', 'armas/jambiya.png', 0)]:
    f = fondo_zoco(); poner(f, vistas(os.path.join(ARTE, hoja))[0], CAJA, giro); guardar(f, nombre)
f = fondo_zoco(); poner(f, vistas(os.path.join(ARTE, 'armas/arco-mongol.png'), rellenar=False)[0], CAJA); guardar(f, 'it-arco')
f = fondo_zoco(); fl = vistas(os.path.join(ARTE, 'armas/flecha.png'), umbral=30)      # tres flechas en abanico
for v, giro, dx in [(fl[1], 12, -150), (fl[2], -12, 150), (fl[0], 0, 0)]: poner(f, v, (CAJA[0] + dx, CAJA[1], CAJA[2] + dx, CAJA[3]), giro)
guardar(f, 'it-flechas')
f = fondo_zoco(); poner(f, vistas(os.path.join(ARTE, 'transportes/escudo.png'), cierre=7)[0], (130, 150, W - 130, 740)); guardar(f, 'OB04')
# Genio: la lámpara (de perfil, con el pico a la izquierda) y el genio saliendo de su boquilla; todo en los dos tercios de arriba, porque abajo va el texto de los deseos
f = fondo_noche(); lam = vistas(os.path.join(ARTE, 'transportes/lampara.png'), cierre=3, rellenar=False)[0]; gen = vistas(os.path.join(ARTE, 'transportes/genio.png'))[0]
cl = poner(f, lam, (340, 690, 730, 885)); pico = (cl[0] + 8, cl[1] + round((cl[3] - cl[1]) * 0.33))
alto = pico[1] - 185; e = alto / gen.height; ancho = round(gen.width * e); cola = round(ancho * 0.52)      # la punta de la cola cae sobre la boquilla
poner(f, gen, (pico[0] - cola, 185, pico[0] - cola + ancho, pico[1]), sombra=False); guardar(f, 'if')
