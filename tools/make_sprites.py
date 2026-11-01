"""Genera los SVG de personajes (pseudo-3D), dados e iconos en public/svg/.
Uso: python3 tools/make_sprites.py
Los personajes siguen el estilo aprobado: sin rostros identificables (rostro cubierto o en sombra)."""
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'svg')
for d in ('personajes', 'dados', 'iconos'):
    os.makedirs(os.path.join(ROOT, d), exist_ok=True)

# id: (nombre archivo, color túnica claro, medio, oscuro, turbante claro, medio, oscuro, accesorio)
PERS = {
    '1': ('nur-al-din', '#c4403f', '#8e1f2a', '#4d0e17', '#e9c875', '#b9873a', '#6e4a18', 'scimitar'),
    '2': ('zein', '#5fc1b8', '#2a8a8a', '#124d56', '#f0d9a8', '#c79a55', '#7a5427', 'dice'),
    '3': ('anis', '#8a8fe0', '#4a4fa8', '#23275e', '#f6ecd0', '#cdbb8c', '#8a7648', 'rope'),
    '4': ('jamil', '#7fb27a', '#42794a', '#1f4326', '#e8d6a0', '#b49560', '#6c552b', 'scroll'),
    '5': ('ruyan', '#5f86d6', '#2c4f9e', '#142a5c', '#f2ead0', '#d1c093', '#8b7a4b', 'book'),
    '6': ('zubayda', '#c25a8a', '#7e2756', '#45112e', '#efc972', '#b98a34', '#6e4d14', 'lamp'),
    '7': ('adi', '#f0b04a', '#c27a1c', '#6e400a', '#f6e5b0', '#d0a84d', '#7d6020', 'purse'),
    'B': ('yafar', '#515a8f', '#2a2f5e', '#10132d', '#e3b873', '#b3792a', '#6a4515', 'key'),
}

def defs(p, k):
    _, l, m, d, tl, tm, td, _ = p
    return f'''<defs>
<linearGradient id="r{k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{l}"/><stop offset=".45" stop-color="{m}"/><stop offset="1" stop-color="{d}"/></linearGradient>
<linearGradient id="t{k}" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="{tl}"/><stop offset=".5" stop-color="{tm}"/><stop offset="1" stop-color="{td}"/></linearGradient>
<radialGradient id="f{k}" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#4a2f22"/><stop offset=".7" stop-color="#241410"/><stop offset="1" stop-color="#120a08"/></radialGradient>
<radialGradient id="s{k}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".6" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="g{k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d493"/><stop offset="1" stop-color="#9a6a1e"/></linearGradient>
<linearGradient id="m{k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f2f4f6"/><stop offset=".5" stop-color="#b9c1c8"/><stop offset="1" stop-color="#6c747c"/></linearGradient>
</defs>'''

def accesorio(kind, k, p):
    if kind == 'scimitar':
        return (f'<g transform="rotate(-24 96 130)"><path d="M92,76 C112,100 112,150 92,178 C100,150 100,100 92,76Z" fill="url(#m{k})" stroke="#2a1a10" stroke-width="1.6"/>'
                f'<rect x="87" y="168" width="14" height="5" rx="2" fill="url(#g{k})" stroke="#2a1a10" stroke-width="1.2"/><rect x="90" y="172" width="8" height="12" rx="3" fill="#4d0e17" stroke="#2a1a10" stroke-width="1.2"/></g>')
    if kind == 'dice':
        return ('<g transform="translate(88 140) rotate(12)"><rect width="18" height="18" rx="3" fill="#b3202a" stroke="#2a1a10" stroke-width="1.4"/>'
                '<circle cx="5" cy="5" r="1.7" fill="#fff"/><circle cx="13" cy="13" r="1.7" fill="#fff"/><circle cx="9" cy="9" r="1.7" fill="#fff"/></g>')
    if kind == 'rope':
        return (f'<g fill="none" stroke="#6b4a24" stroke-width="3.2" stroke-linecap="round"><path d="M30,150 q-10,8 0,18 q12,6 18,-4"/><path d="M30,158 q-8,6 0,12" stroke="#c9a463" stroke-width="1.6"/></g>')
    if kind == 'scroll':
        return (f'<g transform="rotate(14 92 140)"><rect x="82" y="124" width="22" height="34" rx="5" fill="#efe0b4" stroke="#2a1a10" stroke-width="1.4"/><ellipse cx="93" cy="124" rx="11" ry="3.4" fill="#d9c58f" stroke="#2a1a10" stroke-width="1.2"/>'
                '<path d="M86,134h14M86,140h14M86,146h10" stroke="#7b1e24" stroke-width="1.2"/></g>'
                '<path d="M30,120 l-6,-24" stroke="#f1e3b8" stroke-width="2.4" stroke-linecap="round"/>')
    if kind == 'book':
        return (f'<g transform="translate(78 132) rotate(-8)"><rect width="28" height="22" rx="3" fill="#7b1e24" stroke="#2a1a10" stroke-width="1.4"/><rect x="3" y="3" width="22" height="16" rx="2" fill="none" stroke="url(#g{k})" stroke-width="1.6"/>'
                '<path d="M14,6 l3,5 -3,5 -3,-5z" fill="#efd08f"/></g>')
    if kind == 'lamp':
        return (f'<g transform="translate(86 140)"><path d="M0,10 q8,10 20,2 l6,-6 q2,-4 -2,-3 l-6,3 q-8,-6 -18,0z" fill="url(#g{k})" stroke="#2a1a10" stroke-width="1.4"/>'
                '<path d="M4,6 q4,-10 -2,-16 q10,4 6,16" fill="#ffb347" stroke="#c26a00" stroke-width="1"/></g>')
    if kind == 'purse':
        return (f'<g transform="translate(84 138)"><path d="M4,2 q10,-6 20,0 l4,8 q4,14 -14,16 q-18,-2 -14,-16z" fill="#8a5a22" stroke="#2a1a10" stroke-width="1.5"/>'
                '<path d="M6,4 q8,5 16,0" fill="none" stroke="#f3d493" stroke-width="2"/><circle cx="14" cy="16" r="5" fill="#f3d493" stroke="#9a6a1e" stroke-width="1.2"/></g>')
    if kind == 'key':
        return (f'<g transform="translate(86 128) rotate(18)"><circle cx="6" cy="6" r="6" fill="none" stroke="url(#g{k})" stroke-width="3"/><path d="M6,12 v26 M6,30 h8 M6,36 h6" stroke="url(#g{k})" stroke-width="3" stroke-linecap="round" fill="none"/></g>'
                '<rect x="26" y="118" width="16" height="24" rx="3" fill="#efe0b4" stroke="#2a1a10" stroke-width="1.2" transform="rotate(-10 34 130)"/>')
    return ''

def personaje(k, p, sombra=True, extra=''):
    acc = accesorio(p[7], k, p)
    sh = f'<ellipse cx="60" cy="188" rx="40" ry="9" fill="url(#s{k})"/>' if sombra else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200" width="120" height="200">{defs(p, k)}
{sh}
<!-- túnica con volumen -->
<path d="M30,184 C20,150 24,112 38,92 L82,92 C98,112 100,150 90,184 C74,194 46,194 30,184Z" fill="url(#r{k})" stroke="#1d110b" stroke-width="2" stroke-linejoin="round"/>
<path d="M60,96 C58,130 58,160 60,190" stroke="#000" stroke-opacity=".22" stroke-width="2" fill="none"/>
<path d="M46,100 C42,130 40,160 42,188 M76,100 C80,130 82,160 80,186" stroke="#000" stroke-opacity=".16" stroke-width="2" fill="none"/>
<path d="M36,98 C34,124 33,148 34,176" stroke="#fff" stroke-opacity=".22" stroke-width="3" fill="none" stroke-linecap="round"/>
<!-- faja dorada -->
<path d="M32,126 C48,134 72,134 88,126 L89,136 C72,144 48,144 31,136Z" fill="url(#g{k})" stroke="#1d110b" stroke-width="1.6" stroke-linejoin="round"/>
<!-- hombros y brazos -->
<path d="M30,98 C22,106 22,130 28,146 C34,146 38,140 38,132 L40,100Z" fill="url(#r{k})" stroke="#1d110b" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M90,98 C99,106 99,130 93,146 C87,146 83,140 83,132 L80,100Z" fill="url(#r{k})" stroke="#1d110b" stroke-width="1.8" stroke-linejoin="round"/>
{acc}
<!-- cuello y capucha sombreada -->
<path d="M44,92 C46,80 74,80 76,92 L80,98 C66,106 54,106 40,98Z" fill="url(#t{k})" stroke="#1d110b" stroke-width="1.8" stroke-linejoin="round"/>
<!-- cabeza: rostro en sombra, paño sobre la boca -->
<ellipse cx="60" cy="64" rx="23" ry="25" fill="url(#f{k})" stroke="#1d110b" stroke-width="2"/>
<path d="M38,70 C44,86 76,86 82,70 C76,76 44,76 38,70Z" fill="url(#t{k})" stroke="#1d110b" stroke-width="1.4"/>
<path d="M46,62 q14,-6 28,0" stroke="#e8c98a" stroke-opacity=".35" stroke-width="2.2" stroke-linecap="round" fill="none"/>
<!-- turbante -->
<path d="M35,56 C32,30 52,20 64,22 C84,24 90,40 85,58 C76,50 48,50 35,56Z" fill="url(#t{k})" stroke="#1d110b" stroke-width="2" stroke-linejoin="round"/>
<path d="M38,50 C54,40 76,40 84,50 M36,42 C52,32 76,32 86,42 M42,33 C56,27 72,28 82,34" stroke="#000" stroke-opacity=".22" stroke-width="1.8" fill="none"/>
<path d="M60,22 C62,16 68,16 70,22" stroke="#1d110b" stroke-width="1.6" fill="#e9c875"/>
<path d="M40,40 C44,34 52,30 60,29" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" fill="none" stroke-linecap="round"/>
{extra}
</svg>'''

def asesinos():
    p = ('', '#3d3d48', '#23232c', '#0d0d12', '#7b1e24', '#4d0e17', '#240509', 'dagger')
    def uno(dx, k):
        return f'<g transform="translate({dx} 0) scale(.82)">' + personaje(k, p, sombra=False).split('</defs>', 1)[1].rsplit('</svg>', 1)[0].replace(accesorio('x', k, p), '') + f'<g transform="translate(86 130) rotate(24)"><path d="M0,0 l6,40 l6,-40z" fill="url(#m{k})" stroke="#1d110b" stroke-width="1.4"/><rect x="-2" y="-8" width="16" height="8" rx="2" fill="#4d0e17" stroke="#1d110b" stroke-width="1.2"/></g></g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">{defs(p, "a")}'
            '<ellipse cx="100" cy="188" rx="76" ry="9" fill="url(#sa)"/>' + uno(0, 'a') + uno(80, 'a') + '</svg>')

def dado_cara(n, ancho=100):
    pts = {1: [(50, 50)], 2: [(28, 28), (72, 72)], 3: [(28, 28), (50, 50), (72, 72)], 4: [(28, 28), (72, 28), (28, 72), (72, 72)],
           5: [(28, 28), (72, 28), (50, 50), (28, 72), (72, 72)], 6: [(28, 26), (72, 26), (28, 50), (72, 50), (28, 74), (72, 74)]}[n]
    dots = ''.join(f'<circle cx="{x}" cy="{y}" r="8.5" fill="url(#pip)"/>' for x, y in pts)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="{ancho}" height="{ancho}"><defs>
<linearGradient id="cara" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2383f"/><stop offset=".55" stop-color="#b3202a"/><stop offset="1" stop-color="#7c1018"/></linearGradient>
<radialGradient id="pip" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e8dfd0"/></radialGradient></defs>
<rect x="3" y="3" width="94" height="94" rx="16" fill="url(#cara)" stroke="#4a0a10" stroke-width="3"/>
<rect x="7" y="7" width="86" height="86" rx="13" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2"/>{dots}</svg>'''

ICONOS = {
 'dinar': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="o" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fbe3a0"/><stop offset=".6" stop-color="#d9a441"/><stop offset="1" stop-color="#8f5a1b"/></radialGradient></defs><circle cx="32" cy="32" r="29" fill="url(#o)" stroke="#5a3a12" stroke-width="3"/><circle cx="32" cy="32" r="22" fill="none" stroke="#7a4e1d" stroke-width="2"/><path d="M32,15 l4.2,10 10.8,.8 -8.3,7 2.6,10.5 -9.3,-5.8 -9.3,5.8 2.6,-10.5 -8.3,-7 10.8,-.8z" fill="#7a4e1d" opacity=".8"/></svg>''',
 'noche': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="n" cx=".3" cy=".3" r=".9"><stop offset="0" stop-color="#2d3d86"/><stop offset="1" stop-color="#0f1740"/></radialGradient></defs><circle cx="32" cy="32" r="29" fill="url(#n)" stroke="#d9a441" stroke-width="3"/><path d="M40,14 A19,19 0 1 0 50,42 A15,15 0 1 1 40,14Z" fill="#f3d493" stroke="#9a6a1e" stroke-width="1.5"/><path d="M46,20 l2,4.5 4.8,.4 -3.6,3.2 1.1,4.7 -4.3,-2.6 -4.3,2.6 1.1,-4.7 -3.6,-3.2 4.8,-.4z" fill="#f3d493"/></svg>''',
 'herido': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#f7efe0" stroke="#7b1e24" stroke-width="4"/><rect x="26" y="12" width="12" height="40" rx="3" fill="#b3202a"/><rect x="12" y="26" width="40" height="12" rx="3" fill="#b3202a"/></svg>''',
 'perdido': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#e9d9ae" stroke="#22407f" stroke-width="4"/><path d="M32,10 L40,34 L32,30 L24,34Z" fill="#22407f"/><path d="M32,54 L24,34 L32,38 L40,34Z" fill="#b3202a"/><text x="32" y="38" text-anchor="middle" font-size="16" font-family="serif" fill="#2b130c">?</text></svg>''',
 'buscado': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="6" width="48" height="52" rx="6" fill="#ecdcae" stroke="#7b1e24" stroke-width="4"/><circle cx="32" cy="26" r="11" fill="#3b2410"/><path d="M14,52 C18,38 46,38 50,52Z" fill="#3b2410"/><path d="M12,14 H52" stroke="#7b1e24" stroke-width="3"/></svg>''',
 'caravana': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M8,44 q4,-22 14,-8 q6,-16 14,0 l4,0 l6,-12 l8,2 l-4,10 l-4,2 l2,24 l-5,0 l-2,-16 l-16,0 l-2,16 l-5,0z" fill="#4a2c12"/></svg>''',
 'reloj': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M16,8 H48 V14 C48,26 40,30 32,32 C40,34 48,38 48,50 V56 H16 V50 C16,38 24,34 32,32 C24,30 16,26 16,14Z" fill="#efd08f" stroke="#5a3a12" stroke-width="3" stroke-linejoin="round"/></svg>''',
}

def w(path, s):
    with open(os.path.join(ROOT, path), 'w', encoding='utf-8') as f:
        f.write(s)

for k, p in PERS.items():
    w(f'personajes/{k}-{p[0]}.svg', personaje(k, p))
w('personajes/yafar-npc.svg', personaje('N', PERS['B'], extra='<circle cx="60" cy="14" r="5" fill="#e9c875" stroke="#1d110b" stroke-width="1.4"/>'))
w('personajes/asesinos.svg', asesinos())
for n in range(1, 7):
    w(f'dados/cara-{n}.svg', dado_cara(n))
for k, s in ICONOS.items():
    w(f'iconos/{k}.svg', s)
print('sprites OK')
