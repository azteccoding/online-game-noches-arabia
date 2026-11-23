# Retratos de cuerpo entero para la ventana de elegir personaje (Jorge, 23 nov 2026: «reemplaza los monitos en la ventana
# donde salen para escoger personaje»): la vista de frente de cada figura 3D, recortada a su silueta.
# Uso, desde la raíz del repositorio y después de preparar-figuras.py:
#     python3 src/escena3d/herramientas/preparar-elegir.py
# Lee public/arte3d/fig-<id>.webp (frente | espalda | costado) y escribe public/arte3d/elegir-<id>.webp.
import os, json, glob
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..', '..'))
A = os.path.join(RAIZ, 'public', 'arte3d')
FIG = json.load(open(os.path.join(AQUI, '..', 'datos', 'figuras.json'), encoding='utf8'))
ALTO = 320                      # el doble de lo que se ve en pantalla, para que se vea nítido en teléfonos
for pid in sorted(FIG):
    if pid == 'G': continue     # el genio no es personaje
    d = FIG[pid]; atlas = Image.open(os.path.join(A, f'fig-{pid}.webp')).convert('RGBA')
    tw = atlas.width // d.get('teselas', 3)
    frente = atlas.crop((0, 0, tw, atlas.height))
    caja = frente.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    frente = frente.crop(caja)
    frente = frente.resize((max(1, round(frente.width * ALTO / frente.height)), ALTO), Image.LANCZOS)
    frente.save(os.path.join(A, f'elegir-{pid}.webp'), quality=86, method=6)
    print(pid, frente.size, os.path.getsize(os.path.join(A, f'elegir-{pid}.webp')) // 1024, 'KB')
