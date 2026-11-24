# Dhow visto desde la popa (Jorge, 24 de noviembre de 2026: «aquí está el dhow», hoja de ChatGPT a ras de piso con tres vistas: tres
# cuartos traseros, popa de frente y tres cuartos traseros). El modelo de dos cáscaras sale de la vista de perfil y por detrás acababa
# en punta, con un hueco entre las dos cáscaras y la vela de canto. De la vista del centro (popa de frente) se sacan dos recortes,
# con transparencia:
#   public/arte3d/dhow-popa.webp        el casco, la galería, el toldo y los faroles vistos desde atrás: es el espejo de popa del modelo
#   public/arte3d/dhow-popa-vela.webp   el palo y la vela vistos desde atrás: se enseñan solo cuando la cámara está justo detrás
#   src/escena3d/datos/dhow-popa.json   medidas de los dos recortes (en píxeles de la hoja) y dónde cae el eje del barco en cada uno
# Uso: python3 -I preparar-dhow-popa.py <hoja.png> [<repo>]      (VISTA=<carpeta> deja una imagen de control)
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

hoja = sys.argv[1]
R = sys.argv[2] if len(sys.argv) > 2 else os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
im = np.asarray(Image.open(hoja).convert('RGB')).astype(np.float32); H, W, _ = im.shape
fila = ndi.gaussian_filter1d(np.median(im[:, :8], axis=1), 12, axis=0)
dist = np.sqrt(((im - fila[:, None, :]) ** 2).sum(axis=2)); m = ndi.binary_closing(dist > 26, iterations=1)
lleno = ndi.binary_fill_holes(m)      # se tapan los brillos; los huecos grandes de fondo (entre la jarcia y la vela) se quedan abiertos
lh, nh = ndi.label(lleno & ~m); ix = range(1, nh + 1)
lleno &= ~np.isin(lh, 1 + np.nonzero((ndi.sum(lleno, lh, ix) > 60) & (ndi.mean(dist, lh, ix) < 14))[0]); m = lleno
lab, n = ndi.label(ndi.binary_closing(m, iterations=3)); tam = ndi.sum(m, lab, range(1, n + 1))
cm = ndi.center_of_mass(m, lab, range(1, n + 1))
centro = 1 + max((i for i in range(n) if tam[i] > 0.02 * H * W), key=lambda i: -abs(cm[i][1] - W / 2))      # el barco de en medio
mv = m & (lab == centro)
ys, xs = np.nonzero(mv); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
mv = mv[y0:y1, x0:x1]; img = im[y0:y1, x0:x1]
ext = np.array([(np.nonzero(f)[0].max() - np.nonzero(f)[0].min() + 1) if f.any() else 0 for f in mv])      # ancho de la figura en cada fila
# la sombra del piso bajo la quilla: las filas del final en que la figura vuelve a ensancharse; fuera
fin = len(ext)
for r in range(int(0.94 * len(ext)), len(ext)):
    if ext[r] > 1.12 * ext[r - 10]: fin = r; break
mv = mv[:fin]; img = img[:fin]; ext = ext[:fin]
# dónde empieza la galería (toldo y faroles): la primera fila, de arriba abajo, en que la figura ya mide casi todo el ancho
tope = ext.max(); gal = int(np.argmax(ext >= 0.8 * tope)); corte = max(0, gal - int(0.035 * mv.shape[0]))      # un poco más arriba: los remates de los postes
eje_filas = mv[int(0.75 * mv.shape[0]):int(0.95 * mv.shape[0])]      # el casco: su centro es el eje del barco
cols = np.nonzero(eje_filas.any(axis=0))[0]; eje = (cols.min() + cols.max() + 1) / 2
def guardar(nombre, a, b):
    sub = mv[a:b]; xs_ = np.nonzero(sub.any(axis=0))[0]; xa, xb = xs_.min(), xs_.max() + 1
    _, (iy, ixx) = ndi.distance_transform_edt(~ndi.binary_erosion(sub, iterations=1), return_indices=True)
    v = Image.fromarray(img[a:b][iy, ixx][:, xa:xb].astype(np.uint8)).convert('RGBA')
    v.putalpha(Image.fromarray((sub[:, xa:xb] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)))
    v.save(os.path.join(R, 'public', 'arte3d', f'dhow-{nombre}.webp'), quality=90, method=6, exact=True)
    return dict(ancho=int(xb - xa), alto=int(b - a), eje=round(float(eje - xa), 1))
datos = dict(popa=guardar('popa', corte, mv.shape[0]), vela=guardar('popa-vela', 0, corte))
# media manga del barco a cada altura del espejo (en píxeles de la hoja, una cada 4 filas), sin los faroles que cuelgan a los lados:
# el tramo de figura que pasa por el eje, con mediana para saltar los brazos de los faroles. Con ella el modelo ensancha las cáscaras
# hacia la popa, que así acaba en espejo (como en la pintura) y no en punta.
cerr = ndi.binary_closing(np.pad(mv[corte:], ((0, 0), (20, 20))), structure=np.ones((1, 25)))[:, 20:-20]; semi = []
for f in cerr:
    e = int(round(eje)); a_ = e
    if not f[e]: semi.append(semi[-1] if semi else 0); continue
    while a_ > 0 and f[a_ - 1]: a_ -= 1
    b_ = e
    while b_ < len(f) - 1 and f[b_ + 1]: b_ += 1
    semi.append((b_ - a_ + 1) / 2)
semi = ndi.median_filter(np.array(semi), 21, mode='nearest')
baranda = int(np.argmax(semi >= 0.97 * semi.max())); semi[:baranda] = np.median(semi[:max(1, baranda // 3)])      # arriba de la baranda, el ancho del toldo (sin faroles)
datos['popa']['semi'] = [round(float(v), 1) for v in semi[::4]]
with open(os.path.join(R, 'src', 'escena3d', 'datos', 'dhow-popa.json'), 'w') as f: json.dump(datos, f, separators=(',', ':'))
print(datos, 'corte en la fila', corte, 'de', mv.shape[0])
if os.environ.get('VISTA'):
    c = Image.new('RGB', (mv.shape[1], mv.shape[0]), (255, 0, 255)); v = Image.fromarray(img.astype(np.uint8)).convert('RGBA'); v.putalpha(Image.fromarray((mv * 255).astype(np.uint8)))
    c.paste(v, (0, 0), v); from PIL import ImageDraw; d = ImageDraw.Draw(c); d.line([0, corte, c.width, corte], fill=(0, 255, 0), width=2); d.line([eje, 0, eje, c.height], fill=(0, 0, 255), width=1)
    c.save(os.path.join(os.environ['VISTA'], 'control-dhow-popa.png'))
