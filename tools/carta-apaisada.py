# Pintura que no llegó en 2:3 (por ejemplo «la posta urgente» de Jorge, 24 de noviembre de 2026, de 1199 × 1312): en vez de recortarle
# los lados y perder personajes, se pone entera al ancho de la carta (800 × 1200) y lo que falta arriba y abajo se rellena con el
# reflejo de la propia pintura, desenfocado y oscurecido. Arriba va el título de la carta y abajo el recuadro de texto, así que el
# relleno casi no se ve. La pintura original no se toca.
# Si la pintura es muy apaisada (la «Guerra entre hermanos», de 1536 × 1024), se le da además un alto en la carta: se agranda hasta ese
# alto y se le recortan por igual los dos lados, lo justo para que quepa lo importante.
# Uso: python3 -I tools/carta-apaisada.py <pintura.png> <salida.webp> [<fracción del relleno que va arriba, 0 a 1; por defecto 0.45> [<alto de la pintura en la carta, en píxeles>]]
import sys
import numpy as np
from PIL import Image, ImageFilter

W, H = 800, 1200
origen, salida = sys.argv[1], sys.argv[2]
arriba = float(sys.argv[3]) if len(sys.argv) > 3 else 0.45
alto = int(sys.argv[4]) if len(sys.argv) > 4 else None
im = Image.open(origen).convert('RGB')
if alto:      # más alta que al ancho justo: sobran lados, que se recortan por igual
    w = round(im.width * alto / im.height); im = im.resize((w, alto), Image.LANCZOS); x = (w - W) // 2; im = im.crop((x, 0, x + W, alto)); h = alto
else:
    h = round(im.height * W / im.width); im = im.resize((W, h), Image.LANCZOS)
assert h < H, 'la pintura ya es tan alta como la carta: basta con redimensionarla'
y0 = round((H - h) * arriba); y1 = y0 + h
lienzo = Image.new('RGB', (W, H))
def relleno(tira, alto, junta_abajo):      # reflejo desenfocado que se va oscureciendo al alejarse de la pintura
    t = np.asarray(tira.transpose(Image.FLIP_TOP_BOTTOM).resize((W, alto), Image.LANCZOS).filter(ImageFilter.GaussianBlur(9))).astype(np.float32)
    d = np.linspace(1, 0, alto) if junta_abajo else np.linspace(0, 1, alto)      # 0 junto a la pintura, 1 en la orilla de la carta
    return Image.fromarray((t * (0.97 - 0.62 * d ** 0.8)[:, None, None]).astype(np.uint8))
n = 24      # filas en las que la pintura y el relleno se funden (el relleno se mete esas filas por debajo de la pintura)
if y0 > 0: lienzo.paste(relleno(im.crop((0, 0, W, min(h, y0 + n))), y0 + n, True), (0, 0))
if y1 < H: lienzo.paste(relleno(im.crop((0, max(0, h - (H - y1) - n), W, h)), H - y1 + n, False), (0, y1 - n))
# la pintura entra con sus orillas de arriba y abajo difuminadas, para que no se note la costura
alfa = np.ones((h, W), dtype=np.float32); rampa = np.linspace(0, 1, n)
if y0 > 0: alfa[:n] = rampa[:, None]
if y1 < H: alfa[-n:] = rampa[::-1][:, None]
lienzo.paste(im, (0, y0), Image.fromarray((alfa * 255).astype(np.uint8)))
lienzo.save(salida, quality=88, method=6); print(salida, lienzo.size, 'pintura de', y0, 'a', y1)
