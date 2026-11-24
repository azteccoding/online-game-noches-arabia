# Dhow visto desde arriba (Jorge, 24 de noviembre de 2026): de la hoja cenital de ChatGPT (tres vistas: desde arriba con vela,
# desde arriba solo el casco, y de popa; proa a la IZQUIERDA) se recortan las dos primeras, con transparencia:
#   public/arte3d/dhow-cenital.webp    el barco completo desde arriba (se ve cuando la cámara mira casi a plomo)
#   public/arte3d/dhow-cubierta.webp   solo el casco y la cubierta (tapa por arriba el modelo de dos cáscaras)
#   src/escena3d/datos/dhow-cenital.json   medidas de los dos recortes, en fracción de la eslora (de la proa al farol de popa)
# Uso: python3 -I preparar-dhow-cenital.py <hoja.png> [<repo>]
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

hoja = sys.argv[1]
R = sys.argv[2] if len(sys.argv) > 2 else os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
im = np.asarray(Image.open(hoja).convert('RGB')).astype(np.float32); H, W, _ = im.shape
fila = ndi.gaussian_filter1d(np.median(im[:, :8], axis=1), 12, axis=0)
m = ndi.binary_fill_holes(ndi.binary_closing(np.sqrt(((im - fila[:, None, :]) ** 2).sum(axis=2)) > 24, iterations=2))
lab, n = ndi.label(m); tam = ndi.sum(m, lab, range(1, n + 1)); orden = np.argsort(tam)[::-1][:3]
cajas = sorted([ndi.find_objects((lab == o + 1).astype(int))[0] + (o + 1,) for o in orden], key=lambda c: c[1].start)      # de izquierda a derecha
datos = {}
(ysC, xsC, eC), (ysK, xsK, eK) = cajas[0], cajas[1]
eslora = xsK.stop - xsK.start      # el casco solo, de la punta de la proa al farol: es la medida común con la vista de perfil
for nombre, (ys, xs, et) in (('cenital', cajas[0]), ('cubierta', cajas[1])):
    mv = lab == et
    _, (iy, ix) = ndi.distance_transform_edt(~ndi.binary_erosion(mv, iterations=2), return_indices=True)
    v = Image.fromarray(im[iy, ix][ys, xs].astype(np.uint8)).convert('RGBA')
    v.putalpha(Image.fromarray((mv[ys, xs] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)))
    v.save(os.path.join(R, 'public', 'arte3d', f'dhow-{nombre}.webp'), quality=90, method=6, exact=True)
    # largo y ancho en fracción de la eslora; las dos vistas comparten la punta de la proa (izquierda) y el borde de abajo
    datos[nombre] = dict(largo=round((xs.stop - xs.start) / eslora, 4), ancho=round((ys.stop - ys.start) / eslora, 4))
    print(nombre, v.size, datos[nombre])
with open(os.path.join(R, 'src', 'escena3d', 'datos', 'dhow-cenital.json'), 'w') as f: json.dump(datos, f, separators=(',', ':'))
