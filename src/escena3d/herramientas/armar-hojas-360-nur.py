# Hojas de 360° de Nur al Din (24 de noviembre de 2026): su hoja técnica de cinco vistas (con líneas guía) ya traía frente,
# 3/4 de frente derecho, perfil izquierdo, 3/4 de espalda izquierdo y espalda; Jorge pidió a ChatGPT las tres que faltaban
# (hoja-tecnica-nur-al-din-2.png: frente de referencia, perfil derecho, 3/4 de espalda derecho, 3/4 de frente izquierdo).
# Este script las junta en las dos filas que lee preparar-vistas8.py, todas a la misma altura y sobre el mismo gris.
# Uso, desde la raíz del repositorio:
#     python3 src/escena3d/herramientas/hoja-tecnica-a-cuatro-vistas.py hoja-tecnica-nur-al-din.png vieja-5.png 596 0,1,2,3,4
#     python3 src/escena3d/herramientas/armar-hojas-360-nur.py vieja-5.png hoja-tecnica-nur-al-din-2.png <carpeta de salida>
import sys, os, importlib.util, numpy as np
from PIL import Image
from scipy import ndimage as ndi
spec = importlib.util.spec_from_file_location('pv', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preparar-vistas8.py')); pv = importlib.util.module_from_spec(spec); spec.loader.exec_module(pv)
def figuras(ruta):
    im = Image.open(ruta).convert('RGB'); d = pv.papel_y_distancia(im)
    m = ndi.binary_opening(d > 20, iterations=1); lab, n = ndi.label(m); tam = ndi.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, [i + 1 for i, t in enumerate(tam) if t > 300])
    col = m.sum(0); tr = []; dentro = False
    for x in range(m.shape[1]):
        if col[x] > 2 and not dentro: s = x; dentro = True
        if (col[x] <= 2 or x == m.shape[1] - 1) and dentro: tr.append((s, x)); dentro = False
    tr = [t for t in tr if t[1] - t[0] > 100]; rgb = np.asarray(im).astype(np.float32); out = []
    bg = np.median(np.concatenate([rgb[:10].reshape(-1,3), rgb[-10:].reshape(-1,3)]), 0)
    for x0, x1 in tr:
        filas = np.where(m[:, x0:x1].any(1))[0]; y0, y1 = filas[0], filas[-1] + 1
        c = rgb[y0:y1, x0:x1]; mm = ndi.binary_dilation(m[y0:y1, x0:x1], iterations=3)
        out.append((c, mm, bg))
    print(ruta, len(out)); return out
V = figuras(sys.argv[1]); N = figuras(sys.argv[2])
BG = np.array([214, 214, 214], np.float32); H = 640
def fila(figs, sal):
    piezas = []
    for c, mm, bg in figs:
        k = H / c.shape[0]; w = round(c.shape[1] * k)
        cc = np.asarray(Image.fromarray(c.clip(0,255).astype(np.uint8)).resize((w, H), Image.LANCZOS)).astype(np.float32)
        mk = np.asarray(Image.fromarray((ndi.gaussian_filter(mm.astype(np.float32), 1.2) * 255).astype(np.uint8)).resize((w, H), Image.LANCZOS)) / 255.
        cc = cc + (BG - bg)  # iguala el papel
        piezas.append(cc * mk[..., None] + BG * (1 - mk[..., None]))
    W = sum(p.shape[1] for p in piezas) + 90 * 5; lz = np.broadcast_to(BG, (H + 100, W, 3)).copy(); x = 90
    for p in piezas: lz[50:50 + H, x:x + p.shape[1]] = p; x += p.shape[1] + 90
    Image.fromarray(lz.clip(0, 255).astype(np.uint8)).save(sal); print(sal, lz.shape)
# viejas: 0 frente, 1 3/4 frente der, 2 perfil izq, 3 3/4 esp izq, 4 espalda. nuevas: 0 frente, 1 perfil der, 2 3/4 esp der, 3 3/4 frente izq
fila([V[0], V[1], N[1], N[2]], os.path.join(sys.argv[3], 'hoja-tecnica-nur-al-din-360-fila1.png'))
fila([V[4], V[3], V[2], N[3]], os.path.join(sys.argv[3], 'hoja-tecnica-nur-al-din-360-fila2.png'))
