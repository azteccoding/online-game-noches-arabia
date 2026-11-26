import re, json
import os
# Carpeta con los .md de las cartas (en la PC: diseño de mejoras). Se cambia con EJ_MD.
A = os.environ.get('EJ_MD', os.path.dirname(os.path.abspath(__file__))) + '/'
SALIDA = os.path.dirname(os.path.abspath(__file__)) + '/'
def bloques(texto):
    out = []
    for b in re.split(r'\n\s*\n', texto):
        b = b.strip()
        m = re.match(r'\*\*(EJ\d+)(?:\. ([^*]+))?\*\*(?: \(([^)]*)\))?\n(.*)', b, re.S)
        if m: out.append(m)
    return out
import sys
JOR = len(sys.argv) > 1 and sys.argv[1] == 'jorasan'
# Pintura de cada carta (Claude, 26 nov 23:20; Jorge: «arma todo»). En las mixtas manda lo que pasa casi siempre.
POSADA = 'EJ1 EJ7 EJ28 EJ42 EJ45'.split()
PIERDES = 'EJ2 EJ4 EJ9 EJ11 EJ12 EJ13 EJ14 EJ16 EJ18 EJ20 EJ21 EJ23 EJ30 EJ31 EJ32 EJ47'.split()
GANAS = 'EJ3 EJ5 EJ6 EJ8 EJ10 EJ15 EJ17 EJ19 EJ22 EJ24 EJ25 EJ26 EJ27 EJ29 EJ35 EJ37 EJ38 EJ41 EJ46 EJ48'.split()
def pintura(i):
    return 'EJ-jorasan.png' if JOR else 'EJ-pierdes.png' if i in PIERDES else 'EJ-ganas.png' if i in GANAS else 'EJ.png'
cartas = {}
src = open(A+'eventos-de-jugador-12-cartas.md',encoding='utf-8').read().split('## Las cartas',1)[1]
src += '\n\n' + open(A+'eventos-de-jugador-ej13-ej36.md',encoding='utf-8').read()
src += '\n\n' + open(A+'eventos-de-jugador-ej37-ej48.md',encoding='utf-8').read()
for m in bloques(src):
    id_, tit, rev, cuerpo = m.group(1), (m.group(2) or '').strip(), (m.group(3) or '').strip(), m.group(4)
    if ('Jorasán' in rev) != JOR: continue
    rev = rev.replace('reverso: ', '')
    if rev.lower() == 'cualquier ciudad': rev = ''
    if rev.startswith('todas menos'): rev = 'Bagdad, Estambul, El Cairo, Yemen, India, Samarcanda, Isfahán, Andalucía, Magreb'
    lineas, regla = [], []
    for l in cuerpo.split('\n'):
        l = l.strip()
        if not l or l.startswith('>'): continue
        if l.startswith('- Regla:'): regla.append(l[2:].replace('Regla: ', '', 1)[0].upper() + l[2:].replace('Regla: ', '', 1)[1:]); continue
        if l.startswith('- '): continue   # notas y pendientes, no van impresas
        lineas.append(l)
    cartas[id_] = {'id': id_, 'n': int(id_[2:]), 'titulo': tit, 'ciudades': rev, 'texto': lineas, 'regla': regla, 'arte': pintura(id_)}
    POS = {'EJ-pierdes.png': '50% 38%', 'EJ-ganas.png': '50% 45%'}
    if pintura(id_) in POS: cartas[id_]['pos'] = POS[pintura(id_)]
    if JOR: cartas[id_].update(ciudades='Jorasán', jorasan=True, sub='Se lee a toda la mesa · si no logras salir del Jorasán', pos='50% 36%')
L = sorted(cartas.values(), key=lambda c: c['n'])
json.dump(L, open(SALIDA + ('cartas-jorasan.json' if JOR else 'cartas.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(L), [c['id'] for c in L])
from collections import Counter; print(Counter(c['arte'] for c in L))
faltan = [c['id'] for c in L if not JOR and c['id'] not in POSADA + PIERDES + GANAS]; print('sin asignar:', faltan)
for c in L:
    if not c['titulo'] or c['ciudades'] or c['regla']: print(c['id'], '|', c['titulo'] or '(sin título)', '|', c['ciudades'], '|', c['regla'])
