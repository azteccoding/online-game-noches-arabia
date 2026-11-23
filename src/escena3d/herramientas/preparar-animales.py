# Animales y dhow pintados (Jorge, 23 de noviembre de 2026): de cada hoja de vistas de ChatGPT (horizontal, cuatro vistas en
# fila sobre fondo liso gris azulado: perfil mirando a la izquierda, frente, atrás y tres cuartos) se saca:
#   public/arte3d/animal-<id>.webp   la vista de perfil recortada, con transparencia (es la piel del modelo)
#   src/escena3d/datos/animal-<id>.json   el relieve (cuánto sale cada punto, por los dos lados), las patas y los puntos de apoyo
# animalPintado.js levanta con eso un modelo de dos cáscaras (lado izquierdo y lado derecho) y mueve las patas.
# El grosor de cada altura sale de la vista de frente (ancho del cuerpo o de cada pata en esa fila); el redondeo, de la distancia
# al contorno en la vista de perfil. En las filas de las patas, las de la izquierda y las de la derecha se separan hacia su lado.
# Uso: python3 -I preparar-animales.py <hoja.png> <id> [<repo>]
import sys, os, json, base64
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

hoja, aid = sys.argv[1], sys.argv[2]
R = sys.argv[3] if len(sys.argv) > 3 else os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
# Ajustes por animal. asiento: dónde va sentado el jinete, en fracción del camino de la pata delantera (0) a la trasera (1).
AJ = {
  'caballo': dict(asiento=0.42, patas=True),
  'camello': dict(asiento=0.5, patas=True),
  'burro': dict(asiento=0.5, patas=True),
  'caballoMongol': dict(asiento=0.45, patas=True),
  'dhow': dict(asiento=0.5, patas=False, fino=(0.66, 0.12)),      # fino: por encima de esa fracción de la altura (la vela y la jarcia) el relieve se queda en esa parte: una vela es plana
  'lampara': dict(asiento=0.5, patas=False),
}[aid]
PASO = 5            # lado de la celda de la malla, en píxeles del recorte
MAXW = 900          # ancho máximo de la textura

im = np.asarray(Image.open(hoja).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
borde = np.concatenate([im[:6].reshape(-1, 3), im[-6:].reshape(-1, 3), im[:, :6].reshape(-1, 3), im[:, -6:].reshape(-1, 3)])
fondo = np.median(borde, axis=0)
dist = np.sqrt(((im - fondo) ** 2).sum(axis=2))
m = dist > 30
m = ndi.binary_opening(m, iterations=1)
lab, n = ndi.label(m)
tam = ndi.sum(m, lab, range(1, n + 1))
m = np.isin(lab, 1 + np.nonzero(tam > 400)[0])
# vistas: grupos de columnas con figura, separados por huecos de fondo
col = m.any(axis=0)
grupos, x0 = [], None
for x in range(W + 1):
    on = x < W and col[x]
    if on and x0 is None: x0 = x
    if not on and x0 is not None: grupos.append([x0, x]); x0 = None
# une huecos pequeños (una cuerda, un fleco suelto)
g2 = []
for g in grupos:
    if g2 and g[0] - g2[-1][1] < 4: g2[-1][1] = g[1]
    else: g2.append(g)
grupos = [g for g in g2 if g[1] - g[0] > 40]
# si dos vistas se tocan (crin, cola o una cuerda), se parte la más ancha por la columna con menos figura
cuenta = m.sum(axis=0)
while len(grupos) < 4:
    g = max(grupos, key=lambda g: g[1] - g[0]); a_, b_ = g; L = b_ - a_
    x = a_ + int(0.3 * L) + int(np.argmin(cuenta[a_ + int(0.3 * L):b_ - int(0.12 * L)]))
    i = grupos.index(g); grupos[i:i + 1] = [[a_, x], [x + 1, b_]]
if len(grupos) < 2: raise SystemExit(f'esperaba 4 vistas y encontré {len(grupos)}')
print('vistas', grupos)
(sx0, sx1), (fx0, fx1) = grupos[0], grupos[1]
ms = m[:, sx0:sx1]; mf = m[:, fx0:fx1]
filas = np.nonzero(ms.any(axis=1))[0]; sy0, sy1 = filas[0], filas[-1] + 1
ms = ms[sy0:sy1]; mf = mf[sy0:sy1]
# se tapan solo los agujeros chicos (brillos, motas); el hueco grande de una cuerda en lazo o del asa se queda abierto
hoyos, nh = ndi.label(ndi.binary_fill_holes(ms) & ~ms)
if nh: ms = ms | np.isin(hoyos, 1 + np.nonzero(ndi.sum(np.ones_like(ms), hoyos, range(1, nh + 1)) < 150)[0])
img = np.asarray(Image.open(hoja).convert('RGB'))[sy0:sy1, sx0:sx1]
th, tw = ms.shape
# --- grosor por fila desde la vista de frente: media longitud de los tramos (cuerpo entero o cada pata)
fc = (fx1 - fx0) / 2
medio = np.zeros(th); extension = np.zeros(th); sep = np.zeros(th); ntr = np.zeros(th, int)
for r in range(th):
    fila = mf[r]; xs = np.nonzero(np.diff(np.concatenate([[0], fila.astype(int), [0]])))[0]
    tr = [(a, b) for a, b in zip(xs[::2], xs[1::2]) if b - a > 2]
    if tr:
        medio[r] = np.mean([(b - a) / 2 for a, b in tr]); ntr[r] = len(tr); extension[r] = (tr[-1][1] - tr[0][0]) / 2
        sep[r] = np.mean([abs((a + b) / 2 - fc) for a, b in tr])
# fuera de las patas cuenta el ancho total de la fila (barandillas, flecos y cuerdas no adelgazan el cuerpo)
if AJ['patas']:
    # la panza: la fila más baja de la vista de perfil con un tramo continuo largo (de pecho a anca)
    def tramo_max(f):
        xs = np.nonzero(np.diff(np.concatenate([[0], f.astype(int), [0]])))[0]
        return max([b - a for a, b in zip(xs[::2], xs[1::2])], default=0)
    r = th - 1
    while r > 0 and tramo_max(ms[r]) < 0.38 * tw: r -= 1
    panza0 = r
else: panza0 = th
medio = np.where(np.arange(th) < panza0, extension, medio)
medio = ndi.uniform_filter1d(np.maximum(medio, 2), 9)
dt = ndi.distance_transform_edt(ms)
Rr = medio[:, None]
z = np.sqrt(np.maximum(0, Rr ** 2 - (Rr - np.minimum(dt, Rr)) ** 2))
z = np.minimum(z, 1.15 * dt)
z[~ms] = 0
if AJ.get('fino'):
    corte, cuanto = AJ['fino']; filas_n = np.arange(th) / th
    z *= (cuanto + (1 - cuanto) * np.clip((filas_n - corte + 0.04) / 0.08, 0, 1))[:, None]
# --- patas: la panza es la fila más baja en que la vista de frente es un solo tramo ancho
ancho = mf.sum(axis=1)
datos = dict(tw=tw, th=th, paso=PASO)
if AJ['patas']:
    panza = panza0
    # dónde se separan las delanteras de las traseras: el hueco más grande entre columnas con pata, en el tercio de abajo
    bajo = ms[int(panza + 0.55 * (th - panza)):]
    cc = bajo.any(axis=0); xs = np.nonzero(cc)[0]
    huecos = [(xs[i + 1] - xs[i], (xs[i] + xs[i + 1]) / 2) for i in range(len(xs) - 1)]
    medio_x = max(huecos)[1] if huecos else tw / 2
    patas = ms.copy(); patas[:panza] = False
    del_x = np.nonzero(patas[:, :int(medio_x)].any(axis=0))[0]; tra_x = np.nonzero(patas[:, int(medio_x):].any(axis=0))[0] + int(medio_x)
    cdel, ctra = float(del_x.mean()), float(tra_x.mean())
    filas_pata = np.arange(panza + int(0.25 * (th - panza)), th - int(0.08 * (th - panza)))
    separa = float(np.median(sep[filas_pata])) if len(filas_pata) else 0
    datos.update(panza=int(panza), medio=float(medio_x), del_=[cdel, panza - 0.1 * th], tra=[ctra, panza - 0.1 * th], separa=separa)
    xa = cdel + AJ['asiento'] * (ctra - cdel)
else:
    xa = tw * AJ['asiento']
# asiento: lo más alto de la silueta alrededor de xa (la parte de arriba de la silla o de la cubierta)
arriba = np.array([np.nonzero(ms[:, x])[0][0] if ms[:, x].any() else th for x in range(tw)])
w = int(0.04 * tw); ya = float(np.median(arriba[max(0, int(xa) - w):int(xa) + w]))
datos['asiento'] = [float(xa), ya]
# cabestro: bajo el hocico (las columnas de más a la izquierda)
izq = np.nonzero(ms.any(axis=0))[0][0]; cols = ms[:, izq:izq + max(3, int(0.03 * tw))]
fy = np.nonzero(cols.any(axis=1))[0]
datos['cabestro'] = [float(izq + 0.02 * tw), float(fy[-1]) if len(fy) else th * 0.5]
# --- malla: relieve en las esquinas de las celdas y qué celdas cubre la figura
gx, gy = tw // PASO + 1, th // PASO + 1
zz = np.zeros((gy, gx), np.float32)
for j in range(gy):
    for i in range(gx):
        y0, y1, x0_, x1_ = max(0, j * PASO - 2), min(th, j * PASO + 3), max(0, i * PASO - 2), min(tw, i * PASO + 3)
        zz[j, i] = z[y0:y1, x0_:x1_].max()
zmax = float(zz.max()) or 1
cub = np.zeros((gy - 1, gx - 1), np.uint8)
for j in range(gy - 1):
    for i in range(gx - 1):
        cub[j, i] = ms[j * PASO:(j + 1) * PASO, i * PASO:(i + 1) * PASO].mean() > 0.35
datos.update(gx=int(gx), gy=int(gy), zmax=zmax, z=base64.b64encode(np.round(zz / zmax * 255).astype(np.uint8).tobytes()).decode(),
             cubre=base64.b64encode(np.packbits(cub.flatten())).decode())
# --- textura: el perfil con transparencia (el borde se ensancha un poco con el color de dentro, para que no se vea el fondo)
rgba = np.dstack([img, (ms * 255).astype(np.uint8)])
esc = min(1, MAXW / tw)
Image.fromarray(rgba).resize((round(tw * esc), round(th * esc)), Image.LANCZOS).save(f'{R}/public/arte3d/animal-{aid}.webp', quality=88, method=6)
os.makedirs(f'{R}/src/escena3d/datos', exist_ok=True)
json.dump(datos, open(f'{R}/src/escena3d/datos/animal-{aid}.json', 'w'), separators=(',', ':'))
print(aid, 'recorte', tw, 'x', th, 'malla', gx, 'x', gy, 'zmax', round(zmax), {k: v for k, v in datos.items() if k not in ('z', 'cubre')})
VISTA = os.environ.get('VISTA')
if VISTA:      # control: perfil, relieve y puntos
    v = Image.fromarray(np.dstack([img, (ms * 255).astype(np.uint8)])).convert('RGB')
    zi = Image.fromarray((z / max(1, z.max()) * 255).astype(np.uint8)).convert('RGB')
    from PIL import ImageDraw
    d = ImageDraw.Draw(v)
    for k in ('asiento', 'cabestro', 'del_', 'tra'):
        if k in datos: x, y = datos[k]; d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(255, 0, 0))
    if 'panza' in datos: d.line([0, datos['panza'], tw, datos['panza']], fill=(0, 255, 0), width=2); d.line([datos['medio'], 0, datos['medio'], th], fill=(0, 0, 255), width=2)
    o = Image.new('RGB', (tw * 2, th)); o.paste(v, (0, 0)); o.paste(zi, (tw, 0)); o.save(f'{VISTA}/control-{aid}.png')
