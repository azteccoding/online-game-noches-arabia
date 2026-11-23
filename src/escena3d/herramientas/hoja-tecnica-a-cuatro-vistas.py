# Arma la hoja de cuatro vistas (frente, tres cuartos, perfil, espalda) desde una hoja técnica de cinco vistas con líneas guía.
# Uso: python3 hoja-tecnica-a-cuatro-vistas.py <hoja técnica> <salida> <fila donde acaba la fila de figuras> [vistas, por defecto 0,1,2,4]
# La hoja técnica solo se lee; la salida es la hoja «-pose-a» que usa preparar-figuras.py. Necesita Pillow, numpy y scipy.
# Zubayda: fila 645 · Nur al Din: fila 596.
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
src, out, corte = sys.argv[1], sys.argv[2], int(sys.argv[3]); usar = [int(v) for v in (sys.argv[4] if len(sys.argv) > 4 else '0,1,2,4').split(',')]
a = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32)[:corte]
H, W, _ = a.shape
lum = a.mean(axis=2); sat = a.max(axis=2) - a.min(axis=2)
med = ndi.median_filter(lum, size=(15, 1))
oscuro = (med - lum > 4) & (sat < 30)
filas = [y for y in range(H) if oscuro[y].mean() > 0.2]
bg = np.median(a[:8].reshape(-1, 3), axis=0); print('filas', filas, 'fondo', bg)
m = np.zeros(H, bool); m[filas] = True; m = ndi.binary_dilation(m, iterations=2)
b = a.copy(); lab, n = ndi.label(m); fl = float(bg.mean())
gris = lambda f: (f.max(axis=1) - f.min(axis=1) < 22) & (np.abs(f.mean(axis=1) - fl) < 26)
for i in range(1, n + 1):
    t = np.where(lab == i)[0]; y0, y1 = max(0, t[0] - 1), min(H - 1, t[-1] + 1)
    arr, aba = a[y0], a[y1]
    for y in t:
        k = (y - y0) / max(1, y1 - y0); mezcla = arr * (1 - k) + aba * k
        px = a[y]; es_linea = (px.max(axis=1) - px.min(axis=1) < 30) & (px.mean(axis=1) < fl - 3) & (px.mean(axis=1) > fl - 110)
        cambia = (gris(arr) & gris(aba)) | (es_linea & (gris(arr) | gris(aba)))
        rel = np.where(gris(arr)[:, None] & ~gris(aba)[:, None], arr, np.where(gris(aba)[:, None] & ~gris(arr)[:, None], aba, mezcla))
        b[y][cambia] = rel[cambia]
fig = np.sqrt(((ndi.gaussian_filter(b, (1, 1, 0)) - bg) ** 2).sum(axis=2)) > 30
col = fig.sum(axis=0) > 3
lab, n = ndi.label(ndi.binary_closing(col, iterations=6))
grupos = [(np.where(lab == i)[0][0], np.where(lab == i)[0][-1]) for i in range(1, n + 1)]
grupos = [g for g in grupos if g[1] - g[0] > 40]; print('grupos', grupos)
grupos = [grupos[k] for k in usar]
pad = 40; anchos = [x1 - x0 + 2 * pad for x0, x1 in grupos]
lienzo = np.broadcast_to(bg, (H + 60, sum(anchos), 3)).copy(); x = 0
for (x0, x1), an in zip(grupos, anchos):
    i0, i1 = max(0, x0 - pad), min(W, x1 + pad); trozo = b[:, i0:i1].copy()
    lienzo[30:30 + H, x + (i0 - (x0 - pad)):x + (i0 - (x0 - pad)) + (i1 - i0)] = trozo; x += an
Image.fromarray(lienzo.clip(0, 255).astype(np.uint8)).save(out); print(lienzo.shape)
