# Flecha pintada (Jorge, 24 de noviembre de 2026): de la hoja de ChatGPT (cuatro flechas verticales con la punta hacia arriba) se
# recortan la primera (plumas de frente) y la segunda (girada un cuarto de vuelta) a public/arte3d/flecha.webp, lado a lado y con
# transparencia. armas.js las pone en dos planos cruzados a lo largo del astil.
# Uso: python3 -I preparar-flecha.py <hoja.png> [<repo>]
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

hoja = sys.argv[1]
R = sys.argv[2] if len(sys.argv) > 2 else os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
TH, TW = 768, 96
im = np.asarray(Image.open(hoja).convert('RGB')).astype(np.float32); H, W, _ = im.shape
fondo = ndi.gaussian_filter(im, (25, 25, 0))      # el papel tiene grano y viñeta: se compara con su propio promedio local
borde = np.median(np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3)]), axis=0)
dist = np.maximum(np.sqrt(((im - borde) ** 2).sum(axis=2)), 0)
m = ndi.binary_fill_holes(ndi.binary_closing(dist > 30, iterations=3))
lab, n = ndi.label(m); tam = ndi.sum(m, lab, range(1, n + 1)); m = np.isin(lab, 1 + np.nonzero(tam > 2000)[0])
col = ndi.binary_closing(m.any(axis=0), structure=np.ones(15)); grupos, x0 = [], None
for x in range(W):
    if col[x] and x0 is None: x0 = x
    if not col[x] and x0 is not None: grupos.append((x0, x)); x0 = None
assert len(grupos) >= 2, f'se esperaban al menos dos flechas y hay {len(grupos)}'
atlas = np.zeros((TH, TW * 2, 4), dtype=np.uint8)
for n, (a, b) in enumerate(grupos[:2]):
    mv = np.zeros_like(m); mv[:, a:b] = m[:, a:b]; ys, xs = np.nonzero(mv); y0, y1 = ys.min(), ys.max() + 1
    cx = int(round(np.median(xs[(ys > y0 + (y1 - y0) * 0.3) & (ys < y0 + (y1 - y0) * 0.5)])))      # el astil: centro de la tesela
    medio = max(cx - xs.min(), xs.max() - cx) + 3
    _, (iy, ix) = ndi.distance_transform_edt(~ndi.binary_erosion(mv, iterations=2), return_indices=True)
    c = im[iy, ix][y0:y1, cx - medio:cx + medio].astype(np.uint8); k = (mv[y0:y1, cx - medio:cx + medio] * 255).astype(np.uint8)
    atlas[:, n * TW:(n + 1) * TW, :3] = np.asarray(Image.fromarray(c).resize((TW, TH), Image.LANCZOS))
    atlas[:, n * TW:(n + 1) * TW, 3] = np.asarray(Image.fromarray(k).resize((TW, TH), Image.LANCZOS))
    print('flecha', n + 1, 'alto', y1 - y0, 'ancho', 2 * medio, 'proporción', round(2 * medio / (y1 - y0), 4))
Image.fromarray(atlas, 'RGBA').save(os.path.join(R, 'public', 'arte3d', 'flecha.webp'), quality=92, method=6, exact=True)
if os.environ.get('VISTA'):
    v = np.full((TH, TW * 2, 3), (255, 0, 255), dtype=np.uint8); v[atlas[:, :, 3] > 127] = atlas[:, :, :3][atlas[:, :, 3] > 127]
    Image.fromarray(v).save(os.path.join(os.environ['VISTA'], 'flecha.png'))
