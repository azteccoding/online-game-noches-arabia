"""Prepara los assets raster MÍNIMOS del cliente a partir de ../cartas (PNG 744x1039).

Diseño (plan, sección «Cartas bajo demanda»): el bundle NO lleva las 195 cartas. Se genera:
  public/cartas/dorsos/<mazo>.webp        10 dorsos (360 px) — se usan en la mano y en los mazos
  public/arte/<clave>.webp                un arte por CATEGORÍA (recorte de la ventana de ilustración), carga perezosa
  fallback/cartas-completas/<mazo>/<ID>.webp   cartas completas (480 px). OPCIONAL, FUERA del bundle: el servidor las
                                          expone solo con --cartas-completas (ver README) para quien quiera ver el PNG original
Uso: python3 tools/optimize_assets.py [--sin-fallback]      (requiere Pillow con WebP)"""
import glob, json, os, re, shutil, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
DOCS = os.path.abspath(os.path.join(ROOT, '..'))
PUB = ROOT + '/public'
FALL = ROOT + '/fallback/cartas-completas'
DECKS = ['eventos', 'eventos-historicos', 'mensajes', 'retos', 'mazo-de-objetos', 'objetos-originales', 'ifrit', 'especiales', 'personajes']
CROP = (0.13, 0.19, 0.87, 0.49)       # ventana de ilustración en las cartas (fracciones x0,y0,x1,y1)
ART_W = 480


def save(im, dst, width, q):
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=q, method=6)
    return os.path.getsize(dst)


def first(pattern):
    r = sorted(glob.glob(f'{DOCS}/cartas/{pattern}'))
    return r[0] if r else None


def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', t.lower().replace('/', '-').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')).strip('-')


def main(fallback=True):
    total = {'dorsos': 0, 'arte': 0, 'fallback': 0}
    for fn in sorted(os.listdir(f'{DOCS}/cartas/dorsos')):
        if fn.endswith('.png'):
            key = re.sub(r'^d-', '', fn)[:-4].split('-dorso')[0]
            total['dorsos'] += save(Image.open(f'{DOCS}/cartas/dorsos/{fn}').convert('RGB'), f'{PUB}/cartas/dorsos/{key}.webp', 360, 80)
    objs = json.load(open(ROOT + '/src/data/objetos.json', encoding='utf-8'))['mazo']
    arte = {'ev': first('eventos/E2-*.png'), 'hi': first('eventos-historicos/H3-*.png'), 'me': first('mensajes/M1-*.png'), 're': first('retos/R1-*.png'),
            'if': first('ifrit/I1-*.png'), 'es': first('especiales/F1-*.png'), 'ob-orig': first('objetos-originales/*.png')}
    for o in objs:
        k = 'ob-' + slug(o['tipo'])
        if k not in arte:
            arte[k] = first(f"mazo-de-objetos/{o['id']}-*.png")
    for pid in '1234567B':
        arte['pj-' + pid] = first(f'personajes/p{pid}-*.png')
    shutil.rmtree(PUB + '/arte', ignore_errors=True)
    for k, src in arte.items():
        if not src:
            print('sin origen para', k); continue
        im = Image.open(src).convert('RGB')
        w, h = im.size
        box = (round(w * CROP[0]), round(h * CROP[1]), round(w * CROP[2]), round(h * CROP[3]))
        total['arte'] += save(im.crop(box), f'{PUB}/arte/{k}.webp', ART_W, 74)
    if fallback:
        shutil.rmtree(FALL, ignore_errors=True)
        for d in DECKS:
            for fn in sorted(os.listdir(f'{DOCS}/cartas/{d}')):
                if fn.endswith('.png'):
                    total['fallback'] += save(Image.open(f'{DOCS}/cartas/{d}/{fn}').convert('RGB'), f"{FALL}/{d}/{fn.split('-')[0]}.webp", 480, 78)
    json.dump(sorted(arte), open(ROOT + '/src/data/arte-claves.json', 'w'))
    print({k: round(v / 1024) for k, v in total.items()}, 'KB')


if __name__ == '__main__':
    main('--sin-fallback' not in sys.argv)
