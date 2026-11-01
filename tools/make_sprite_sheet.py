"""Une los SVG de personajes/NPC en public/svg/sprites.svg como <symbol> (un solo archivo, todo vectorial).
Uso en el cliente: <use href="/svg/sprites.svg#p1"/>. Los ids internos de cada sprite ya son únicos (sufijo por personaje).
Uso: python3 tools/make_sprite_sheet.py   (después de tools/make_sprites.py)"""
import glob, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'svg')
syms = []
files = sorted(glob.glob(ROOT + '/personajes/*.svg'))
for fp in files:
    name = os.path.basename(fp)[:-4]
    sid = 'p' + name.split('-')[0] if name[0] in '12345678B' and '-' in name else name.replace('-', '_')
    s = open(fp, encoding='utf-8').read()
    m = re.match(r'<svg[^>]*viewBox="([^"]+)"[^>]*>(.*)</svg>\s*$', s, re.S)
    inner = re.sub(r'<!--.*?-->', '', m.group(2), flags=re.S)
    syms.append(f'<symbol id="{sid}" viewBox="{m.group(1)}">{inner}</symbol>')
out = '<svg xmlns="http://www.w3.org/2000/svg">' + ''.join(syms) + '</svg>'
open(ROOT + '/sprites.svg', 'w', encoding='utf-8').write(out)
print('sprites.svg', len(files), 'símbolos', len(out) // 1024, 'KB')
