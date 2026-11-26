import json, sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import os
B = os.path.dirname(os.path.abspath(__file__)) + '/'
cartas = json.load(open(B + (sys.argv[2] if len(sys.argv) > 2 else 'cartas.json'), encoding='utf-8'))
salida = sys.argv[1]
W, H = 178.58267, 249.39167
XS = [29.763779, 208.34644, 386.92915]; YS = [545.6979, 296.24906, 46.800233]
from PIL import Image
os.makedirs(B + 'jpg', exist_ok=True)
for ca in cartas:   # los PNG de render.js pasan a JPEG para que el PDF pese menos
    for cara in ('frente', 'dorso'):
        Image.open(B + f"png/{ca['id']}-{cara}.png").convert('RGB').save(B + f"jpg/{ca['id']}-{cara}.jpg", quality=92)
c = canvas.Canvas(salida, pagesize=A4)
c.setTitle('Mil y Una Noches · Cartas de eventos de jugador'); c.setAuthor('aztecdev')
for i in range(0, len(cartas), 9):
    hoja = cartas[i:i + 9]
    for k, ca in enumerate(hoja):
        c.drawImage(B + f"jpg/{ca["id"]}-frente.jpg", XS[k % 3], YS[k // 3], W, H)
    c.showPage()
    for k, ca in enumerate(hoja):   # dorsos en espejo para doble cara (borde largo)
        c.drawImage(B + f"jpg/{ca["id"]}-dorso.jpg", XS[2 - k % 3], YS[k // 3], W, H)
    c.showPage()
c.save(); print(salida, len(cartas), 'cartas')
