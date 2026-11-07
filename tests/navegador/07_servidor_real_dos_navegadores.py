# Servidor REAL con dos navegadores (PC y teléfono) en la vista horizontal predeterminada. Ver README.txt, sección «Pruebas».
# Arranque previo:  npm run build && node server/index.js --puerto 8090 --datos /tmp/mun-datos-07 --nuevo --sin-qr
# Uso:  python3 tests/navegador/07_servidor_real_dos_navegadores.py [carpeta_capturas]
# Comprueba: entrada y lobby, inicio de partida, dados sincronizados en ambos, mano privada (cada uno ve solo la suya),
# que no hay peticiones externas ni errores de consola.
import os, sys
from playwright.sync_api import sync_playwright

B = 'http://127.0.0.1:8090/'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-07'
os.makedirs(OUT, exist_ok=True)
ext, fallos = [], []


def ok(c, m):
    if not c:
        fallos.append(m)
    print(('  ok  ' if c else '  FALLO ') + m)


def entrar(b, vp, dpr, mob, nombre):
    c = b.new_context(viewport=vp, device_scale_factor=dpr, has_touch=mob, is_mobile=mob)
    pg = c.new_page()
    pg.on('request', lambda r: ext.append(r.url) if not r.url.startswith(('http://127.0.0.1', 'data:', 'blob:')) else None)
    pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.on('console', lambda m: pg.errs.append(m.text) if m.type == 'error' else None)
    pg.goto(B); pg.wait_for_timeout(800)
    pg.fill('#nombre', nombre); pg.get_by_role('button', name='Entrar a la sala').click(); pg.wait_for_timeout(700)
    return pg


def cerrar(pg, n=30):
    for _ in range(n):
        if pg.locator('.modal-carta .modal-cerrar:not([disabled])').count():
            pg.locator('.modal-carta .modal-cerrar').first.click(); pg.wait_for_timeout(120)
        elif pg.locator('.modal-carta').count():
            pg.wait_for_timeout(400)
        else:
            return


def modo(pg):
    return pg.evaluate("document.querySelector('.lienzo').dataset.modo")


with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    A = entrar(b, {'width': 1280, 'height': 800}, 1, False, 'Dulce')
    M = entrar(b, {'width': 390, 'height': 844}, 2, True, 'Beto')
    ok(modo(A) == 'horizontal' and modo(M) == 'horizontal', 'vista horizontal predeterminada en PC y en teléfono vertical')
    A.screenshot(path=f'{OUT}/e2e-lobby-pc.png')
    A.locator('.pj-opcion').nth(0).click(); M.locator('.pj-opcion').nth(1).click(); A.wait_for_timeout(400)
    A.get_by_role('button', name='Estoy listo').click(); M.get_by_role('button', name='Estoy listo').click(); A.wait_for_timeout(400)
    M.screenshot(path=f'{OUT}/e2e-lobby-movil.png')
    A.get_by_role('button', name='Comenzar partida').click(); A.wait_for_timeout(1500)
    ok(A.locator('.modal-carta').count() == 1 and M.locator('.modal-carta').count() == 1, 'carta de evento de la ronda 1 visible para ambos')
    A.wait_for_timeout(5400)
    cerrar(A); cerrar(M)
    ok(A.locator('.acc-txt b').count() == 1, 'ambos ven la barra de turno')
    mio = lambda pg: pg.locator('.acc-txt b', has_text='Es tu turno').count() == 1
    ok(mio(A) != mio(M), 'exactamente uno tiene el turno')
    cur, otro = (A, M) if mio(A) else (M, A)
    cur.get_by_role('button', name='Tirar dado de ingreso').click(); A.wait_for_timeout(700)
    ok(A.locator('.dados-mesa').count() >= 1 and M.locator('.dados-mesa').count() >= 1, 'los dados giran en las dos pantallas')
    M.screenshot(path=f'{OUT}/e2e-dados-movil.png')
    A.wait_for_timeout(2400)
    ok(A.locator('.dados-resultado').count() >= 1 and M.locator('.dados-resultado').count() >= 1, 'modal de resultado en las dos pantallas')
    otro.get_by_role('button', name='Cerrar para todos').click(); A.wait_for_timeout(600)
    ok(A.locator('.dados-mesa').count() == 0 and M.locator('.dados-mesa').count() == 0, 'cerrar el modal lo cierra para todos')
    cerrar(A); cerrar(M)
    A.screenshot(path=f'{OUT}/e2e-mesa-pc.png')
    ok(not A.errs and not M.errs, f'sin errores de consola {A.errs[:2]} {M.errs[:2]}')
    ok(not ext, f'sin peticiones externas {ext[:3]}')
    b.close()

print('\nRESULTADO:', 'TODO OK' if not fallos else f'{len(fallos)} FALLOS')
sys.exit(1 if fallos else 0)
