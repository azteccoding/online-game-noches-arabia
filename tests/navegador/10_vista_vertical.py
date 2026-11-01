# Vista según la forma de la pantalla (Chrome + Playwright para Python, servidor real).
# En vertical: interfaz vertical a pantalla completa, sin girar nada, y tablero apaisado (norte arriba) en la sala y en la partida.
# En PC: horizontal. Partida real de 2 jugadores.
# Uso:  npm run build && node server/index.js --puerto 8090 --datos <carpeta_temporal> --nuevo --sin-qr
#       python tests/navegador/10_vista_vertical.py [carpeta_capturas]
import sys, os
from playwright.sync_api import sync_playwright

B = 'http://127.0.0.1:8090/'
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'capturas')
os.makedirs(OUT, exist_ok=True)
fallos = []


def ok(cond, msg):
    if not cond:
        fallos.append(msg)
    print(('  ok  ' if cond else '  FALLO ') + msg)


def estado(pg):
    return pg.evaluate("(()=>{const l=document.querySelector('.lienzo'),t=document.querySelector('.tablero svg');return {modo:l.dataset.modo,rot:l.dataset.rotado,"
                       "giro:getComputedStyle(l).transform,ancho:l.offsetWidth,vw:innerWidth,selector:!!document.querySelector('.selector-vista'),"
                       "svg:t?getComputedStyle(t).transform:null}})()")


with sync_playwright() as p:
    nav = p.chromium.launch(channel='chrome')
    pc = nav.new_context(viewport={'width': 1366, 'height': 820}).new_page()   # PC: basta con la pantalla de entrada (no ocupa la sala)
    pc.goto(B); pc.wait_for_selector('#nombre'); e = estado(pc)
    ok(e['modo'] == 'horizontal' and e['rot'] == '0' and e['giro'] == 'none', f'PC: horizontal sin girar: {e}')
    etq = 'telefono'
    pgs = [nav.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True).new_page() for _ in range(2)]
    for pg, n in zip(pgs, ('Jorge', 'Carolina')):
        pg.goto(B); pg.wait_for_selector('#nombre'); pg.fill('#nombre', n); pg.click('text=Entrar a la sala'); pg.wait_for_selector('.pj-opcion')
    a = pgs[0]
    e = estado(a)
    ok(e['modo'] == 'vertical' and e['rot'] == '0' and e['giro'] == 'none' and e['ancho'] == e['vw'], f'sala en vertical, sin girar y a lo ancho: {e}')
    ok(not e['selector'], 'sin selector Horizontal | Vertical')
    a.wait_for_timeout(300); a.locator('.pj-opcion').nth(0).click()
    pgs[1].wait_for_timeout(300); pgs[1].locator('.pj-opcion:not([disabled])').nth(0).click()
    for pg in pgs:
        pg.wait_for_timeout(300); pg.click('text=Estoy listo')
    a.wait_for_timeout(400); a.screenshot(path=f'{OUT}/10-{etq}-sala.png')
    a.click('text=Comenzar partida'); a.wait_for_selector('.tablero'); a.wait_for_timeout(1500)
    for pg, n in zip(pgs, ('Jorge', 'Carolina')):
        e = estado(pg)
        ok(e['modo'] == 'vertical' and e['rot'] == '0' and e['giro'] == 'none', f'partida ({n}): interfaz vertical sin girar: {e}')
    a.screenshot(path=f'{OUT}/10-{etq}-partida.png')
print('RESULTADO:', 'OK' if not fallos else f'{len(fallos)} fallos')
sys.exit(1 if fallos else 0)
