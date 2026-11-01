"""Convierte las fuentes de tools/fuentes/*.ttf (origen, licencia OFL) a WOFF2 en public/fonts/ (subconjunto latino para Alegreya y Marcellus).
Uso:  python3 tools/fuentes_woff2.py        (requiere fonttools y brotli; solo herramienta, no se instala en el juego)
Los .ttf de tools/fuentes también los usa tools/textpath.py para convertir el texto del tablero en trazos SVG."""
import pathlib
from fontTools import subset
from fontTools.ttLib import TTFont

RAIZ = pathlib.Path(__file__).resolve().parent
ORIGEN = RAIZ / 'fuentes'
DIR = RAIZ.parent / 'public' / 'fonts'
LATIN = list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2039, 0x203A, 0x20AC, 0x2116, 0x2212, 0x00D7, 0x2190, 0x2192, 0x25BE, 0x2713, 0x2022]
for ttf in sorted(ORIGEN.glob('*.ttf')):
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']; opt.notdef_outline = True; opt.name_IDs = [1, 2, 3, 4, 6]
    f = TTFont(ttf)
    sub = subset.Subsetter(opt)
    if ttf.stem.startswith('Alegreya') or ttf.stem.startswith('Marcellus'):
        sub.populate(unicodes=LATIN)
    else:
        sub.populate(unicodes=[c for c in f.getBestCmap()])      # Aref Ruqaa: todo el árabe
    sub.subset(f)
    out = DIR / (ttf.stem + '.woff2'); f.flavor = 'woff2'; f.save(out)
    print(f'{ttf.name:28s} {ttf.stat().st_size//1024:4d} KB -> {out.name:28s} {out.stat().st_size//1024:4d} KB')
