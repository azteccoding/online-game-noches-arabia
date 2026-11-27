# Armas pintadas (Jorge, 24 de noviembre de 2026): de cada hoja de vistas de ChatGPT (horizontal, cuatro vistas verticales en
# fila sobre fondo liso gris azulado, con la punta hacia arriba: un costado, el otro costado, de canto y de canto otra vez) sale:
#   public/arte3d/arma-<id>.webp        los dos costados recortados, con transparencia (el segundo, volteado para casar con el primero)
#   src/escena3d/datos/arma-<id>.json   el relieve (medio grosor de cada punto), el puño y los puntos de base y punta
# armas.js levanta con eso un modelo de dos cáscaras, una por costado. El grosor de cada altura sale de la tercera vista (de canto);
# el redondeo, de la distancia al contorno. En el arco, la tercera vista es su cara externa (da el ancho de las palas), el segundo
# costado es el mismo que el primero y la cuerda se quita de la pintura: la pone y la tensa el código.
# Uso: python3 -I preparar-armas.py <hoja.png> <id> [<repo>]      (VISTA=<carpeta> guarda imágenes de comprobación)
import sys, os, json, base64
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

hoja, aid = sys.argv[1], sys.argv[2]
R = sys.argv[3] if len(sys.argv) > 3 else os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
VISTA = os.environ.get('VISTA')
# alto: altura total en unidades de armas.js · puno: fila del centro de la empuñadura (fracción de la altura, 0 arriba)
# guarda: fila donde empieza la hoja · sz: +1 si el lado derecho de la pintura va hacia +Z (el filo), −1 si va hacia −Z (la cuerda del arco)
AJ = {
  'cimitarra': dict(alto=128, puno=0.855, guarda=0.73, sz=-1),   # Jorge (27 nov): la parte cóncava hacia el personaje y la convexa (el filo) hacia el oponente
  'alfanje': dict(alto=120, puno=0.80, guarda=0.635, sz=1),
  'jambiya': dict(alto=70, puno=0.79, guarda=0.60, sz=1),
  'arco': dict(alto=120, puno=0.465, guarda=0.465, sz=-1, arco=True),
}[aid]
TH, PASO = 640, 5

im = np.asarray(Image.open(hoja).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
borde = np.concatenate([im[:6].reshape(-1, 3), im[-6:].reshape(-1, 3), im[:, :6].reshape(-1, 3)])
fondo = np.median(borde, axis=0)
# el fondo lleva un degradado suave de arriba abajo: se compara cada fila con el color de su borde izquierdo
fila = ndi.gaussian_filter1d(np.median(im[:, :8], axis=1), 12, axis=0)
dist = np.sqrt(((im - fila[:, None, :]) ** 2).sum(axis=2))
m = ndi.binary_closing(dist > 24, iterations=2)
if not AJ.get('arco'): m = ndi.binary_fill_holes(m)      # (en el arco no: rellenaría el hueco entre el arco y la cuerda)
if not AJ.get('arco'): m = ndi.binary_opening(m, iterations=1)      # (en el arco no: se llevaría la cuerda)
lab, n = ndi.label(m); tam = ndi.sum(m, lab, range(1, n + 1)); m = np.isin(lab, 1 + np.nonzero(tam > 150)[0])
col = ndi.binary_closing(m.any(axis=0), structure=np.ones(25)); grupos, x0 = [], None
for x in range(W):
    if col[x] and x0 is None: x0 = x
    if not col[x] and x0 is not None: grupos.append((x0, x)); x0 = None
if x0 is not None: grupos.append((x0, W))
grupos = [g for g in grupos if g[1] - g[0] > 12]
assert len(grupos) >= 3, f'se esperaban al menos tres vistas y hay {len(grupos)}'

def vista(n):
    a, b = grupos[n]; mv = np.zeros_like(m); mv[:, a:b] = m[:, a:b]
    return mv

mA = vista(0); cuerda = None
if AJ.get('arco'):      # la cuerda es una raya fina: se va con una apertura horizontal y queda el cuerpo del arco
    cuerpo = ndi.binary_opening(mA, structure=np.ones((1, 11)))
    lab, n = ndi.label(cuerpo); tam = ndi.sum(cuerpo, lab, range(1, n + 1)); cuerpo = lab == 1 + int(np.argmax(tam))
    cuerpo = ndi.binary_dilation(cuerpo, iterations=2) & mA
    resto = mA & ~ndi.binary_dilation(cuerpo, iterations=4); ys, xs = np.nonzero(resto)
    xc = float(np.median(xs)); cerca = np.abs(xs - xc) < 5
    cuerda = (xc, int(ys[cerca].min()), int(ys[cerca].max()))
    mA = cuerpo

def caja(mm):
    ys, xs = np.nonzero(mm); return int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1

def rellenar(c, mm):      # el color de la figura se extiende hacia fuera: así el borde no toma el gris del papel
    _, (iy, ix) = ndi.distance_transform_edt(~ndi.binary_erosion(mm, iterations=2), return_indices=True)
    return c[iy, ix]

y0, y1, x0, x1 = caja(mA); M = 3
e = TH / (y1 - y0); TW = int(np.ceil(((x1 - x0) + 2 * M) * e / PASO)) * PASO
def tesela(mm, voltear=False, como=None):
    a0, a1, b0, b1 = caja(mm)
    c = rellenar(im, mm)[a0:a1, b0 - M:b1 + M].astype(np.uint8); k = mm[a0:a1, b0 - M:b1 + M]
    if voltear: c, k = c[:, ::-1], k[:, ::-1]
    c = np.asarray(Image.fromarray(np.ascontiguousarray(c)).resize((TW, TH), Image.LANCZOS))
    k = np.asarray(Image.fromarray((np.ascontiguousarray(k) * 255).astype(np.uint8)).resize((TW, TH), Image.LANCZOS))
    return c, k

cA, aA = tesela(mA)
cB, aB = (cA, aA) if AJ.get('arco') else tesela(vista(1), voltear=True)
mF = aA > 127
atlas = np.zeros((TH, TW * 2, 4), dtype=np.uint8)
atlas[:, :TW, :3] = cA; atlas[:, :TW, 3] = aA; atlas[:, TW:, :3] = cB; atlas[:, TW:, 3] = aA      # misma silueta en los dos costados
os.makedirs(os.path.join(R, 'public', 'arte3d'), exist_ok=True)
Image.fromarray(atlas, 'RGBA').save(os.path.join(R, 'public', 'arte3d', f'arma-{aid}.webp'), quality=92, method=6, exact=True)

# medio grosor por fila, de la vista de canto (tercera), llevado a la altura de la tesela
mC = vista(2); c0, c1, _, _ = caja(mC); ancho = mC[c0:c1].sum(axis=1).astype(np.float32) * ((y1 - y0) / (c1 - c0)) * e
Rf = np.interp(np.linspace(0, 1, TH), np.linspace(0, 1, c1 - c0), ancho) / 2
Rf = np.maximum(ndi.gaussian_filter1d(Rf, 2.0), 1.2)[:, None]
medio = np.maximum(mF.sum(axis=1), 1)[:, None] / 2
D = np.maximum(Rf, 0.35 * medio)
sd = np.where(mF, ndi.distance_transform_edt(mF) - 0.5, -(ndi.distance_transform_edt(~mF) - 0.5))
z = np.where(sd >= 0, Rf * np.sin(np.pi / 2 * np.minimum(sd, D) / D), np.pi / 2 * (Rf / D) * sd)
z = np.clip(ndi.gaussian_filter(z, 1.0), -12, None)
zmax, zmin = float(z.max()), float(z.min())
gy, gx = TH // PASO + 1, TW // PASO + 1
zg = z[np.minimum(TH - 1, np.arange(gy) * PASO)][:, np.minimum(TW - 1, np.arange(gx) * PASO)]
cub = np.zeros((gy - 1, gx - 1), dtype=np.uint8)
for j in range(gy - 1):
    for i in range(gx - 1): cub[j, i] = 1 if mF[j * PASO:(j + 1) * PASO + 1, i * PASO:(i + 1) * PASO + 1].any() else 0

def centro(fr):
    y = int(round(fr * (TH - 1))); xs = np.nonzero(mF[y])[0]
    return y, float((xs.min() + xs.max()) / 2)
py, eje = centro(AJ['puno']); by, bx = centro(AJ['guarda'])
ty = int(np.nonzero(mF.any(axis=1))[0].min()) + 2; tx = float(np.nonzero(mF[ty])[0].mean())
datos = dict(tw=TW, th=TH, paso=PASO, alto=AJ['alto'], sz=AJ['sz'], zmax=round(zmax, 2), zmin=round(zmin, 2),
             z=base64.b64encode(np.round((zg - zmin) / (zmax - zmin) * 255).astype(np.uint8).tobytes()).decode(),
             cubre=base64.b64encode(np.packbits(cub.reshape(-1)).tobytes()).decode(),
             puno=[round(eje, 1), py], base=[round(bx, 1), by], punta=[round(tx, 1), ty])
if cuerda:      # la cuerda, en píxeles de la tesela: columna y filas de sus dos nudos
    datos['cuerda'] = [round((cuerda[0] - (x0 - M)) * e, 1), round((cuerda[1] - y0) * e, 1), round((cuerda[2] - y0) * e, 1)]
with open(os.path.join(R, 'src', 'escena3d', 'datos', f'arma-{aid}.json'), 'w') as f: json.dump(datos, f, separators=(',', ':'))
if VISTA:
    v = np.full((TH, TW * 2, 3), (255, 0, 255), dtype=np.uint8); v[atlas[:, :, 3] > 127] = atlas[:, :, :3][atlas[:, :, 3] > 127]
    Image.fromarray(v).save(os.path.join(VISTA, f'arma-{aid}.png'))
    Image.fromarray(((z - zmin) / (zmax - zmin) * 255).astype(np.uint8)).save(os.path.join(VISTA, f'arma-z-{aid}.png'))
print(aid, 'tesela', TW, 'x', TH, 'vistas', len(grupos), 'grosor máx', round(float(Rf.max()) * 2, 1), 'cuerda', datos.get('cuerda'))
