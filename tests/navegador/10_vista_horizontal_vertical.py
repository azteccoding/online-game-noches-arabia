# Vista HORIZONTAL por defecto y VERTICAL opcional (Chrome headless + Playwright; demo en :4173, ver README.txt «Pruebas»).
# Comprueba, en teléfono / tablet / PC y en los dos modos: modo y rotación del lienzo, selector visible, preferencia en localStorage,
# que nada de la interfaz se sale del lienzo, y que pan y pellizco-zoom del tablero siguen al dedo aunque el lienzo esté girado.
# Uso:  python3 tests/navegador/10_vista_horizontal_vertical.py [carpeta_capturas]
import sys, os, math
from playwright.sync_api import sync_playwright

B = 'http://127.0.0.1:4173/'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots'
os.makedirs(OUT, exist_ok=True)
DISP = [('tel-vertical', 390, 844, 3, True), ('tel-horizontal', 844, 390, 3, True), ('tablet-vertical', 820, 1180, 2, True),
        ('tablet-horizontal', 1180, 820, 2, True), ('pc', 1280, 800, 1, False)]
fallos = []
SOLO = os.environ.get('SOLO')   # p. ej. SOLO=tel-vertical para un solo dispositivo


def ok(cond, msg):
    if not cond:
        fallos.append(msg)
    print(('  ok  ' if cond else '  FALLO ') + msg)


def estado(pg):
    return pg.evaluate("(()=>{const l=document.querySelector('.lienzo');const r=l.getBoundingClientRect();return {modo:l.dataset.modo,tam:l.dataset.tam,forma:l.dataset.forma,rot:l.dataset.rotado,w:l.offsetWidth,h:l.offsetHeight,rect:[r.left,r.top,r.width,r.height],ls:localStorage.getItem('mun.vista')}})()")


def cerrar_modales(pg, veces=40):
    for _ in range(veces):
        b = pg.locator('.modal-carta .modal-cerrar:not([disabled])')
        d = pg.locator('.dados-modal button')
        if b.count():
            b.first.click(); pg.wait_for_timeout(60)
        elif d.count():
            d.first.click(); pg.wait_for_timeout(60)
        elif pg.locator('.modal-carta').count() or pg.locator('.dados-mesa .dado-escena').count() and pg.locator('.dados-modal').count() == 0:
            pg.wait_for_timeout(250)
        else:
            return


def mi_turno(pg):
    for _ in range(60):
        cerrar_modales(pg)
        if pg.locator('.acc-txt b', has_text='Es tu turno').count():
            return True
        pg.evaluate("(()=>{const d=window.__demo; if(d.e.turno && d.e.turno.pid!==d.yo && !d.e.dados) d.act(d.yo,{t:'host.pasarTurno'});})()")
        pg.wait_for_timeout(1300)
    return False


def dentro(pg, selector, rect, tol=2):
    """Todos los elementos visibles de `selector` deben caber en el lienzo (rect = bounding box del lienzo en pantalla)."""
    bad = pg.evaluate("""([sel, r, tol]) => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'absolute').map(e => { const b = e.getBoundingClientRect(); return [e.className.toString().slice(0, 30), b.left, b.top, b.right, b.bottom]; })
      .filter(([c, l, t, rr, bb]) => l < r[0] - tol || t < r[1] - tol || rr > r[0] + r[2] + tol || bb > r[1] + r[3] + tol)""", [selector, rect, tol])
    return bad


def pins_visibles(pg):
    return pg.evaluate("""(() => { const t = document.querySelector('.tablero').getBoundingClientRect();
      return [...document.querySelectorAll('.ciudad[data-ciudad] .pin')].map(p => { const b = p.getBoundingClientRect(); return [p.parentElement.parentElement.dataset.ciudad, b.left + b.width / 2, b.top + b.height / 2]; })
        .filter(([c, x, y]) => x > t.left + 30 && x < t.right - 30 && y > t.top + 30 && y < t.bottom - 30); })()""")


def pos_pin(pg, ciudad):
    return pg.evaluate("""(c) => { const p = document.querySelector(`.ciudad[data-ciudad="${c}"] .pin`).getBoundingClientRect(); return [p.left + p.width / 2, p.top + p.height / 2]; }""", ciudad)


def gestos(pg, cdp, touch, etiqueta):
    pins = pins_visibles(pg)
    ok(len(pins) >= 2, f'{etiqueta}: hay al menos 2 ciudades visibles para medir gestos ({len(pins)})')
    if len(pins) < 2:
        return
    t = pg.evaluate("(()=>{const r=document.querySelector('.tablero').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
    cx, cy = t[0] + t[2] / 2, t[1] + t[3] / 2
    a = pins[0][0]
    p0 = pos_pin(pg, a)
    # --- pan: el contenido sigue al dedo (en el marco de la pantalla), con el lienzo girado o no
    for (dx, dy) in [(60, 0), (0, 60), (-40, -30)]:
        antes = pos_pin(pg, a)
        if touch:
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': cx, 'y': cy, 'id': 1}]})
            for k in range(1, 7):
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': cx + dx * k / 6, 'y': cy + dy * k / 6, 'id': 1}]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        else:
            pg.mouse.move(cx, cy); pg.mouse.down()
            for k in range(1, 7):
                pg.mouse.move(cx + dx * k / 6, cy + dy * k / 6)
            pg.mouse.up()
        pg.wait_for_timeout(450)
        des = pos_pin(pg, a)
        ex, ey = des[0] - antes[0], des[1] - antes[1]
        ok(abs(ex - dx) < 6 and abs(ey - dy) < 6, f'{etiqueta}: pan ({dx},{dy}) mueve el mapa ({ex:.0f},{ey:.0f})')
    # --- zoom (pellizco con dos dedos / rueda en PC): la distancia entre dos ciudades escala con el gesto y el punto central se mantiene
    b = pins[1][0]
    d_antes = math.dist(pos_pin(pg, a), pos_pin(pg, b))
    if touch:
        sep0, sep1 = 60, 90
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': cx - sep0, 'y': cy, 'id': 1}, {'x': cx + sep0, 'y': cy, 'id': 2}]})
        for k in range(1, 9):
            s = sep0 + (sep1 - sep0) * k / 8
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': cx - s, 'y': cy, 'id': 1}, {'x': cx + s, 'y': cy, 'id': 2}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        esperado = sep1 / sep0
    else:
        pg.mouse.move(cx, cy)
        pg.mouse.wheel(0, -300)
        esperado = None
    pg.wait_for_timeout(500)
    d_des = math.dist(pos_pin(pg, a), pos_pin(pg, b))
    r = d_des / d_antes
    if esperado:
        ok(abs(r - esperado) / esperado < 0.12, f'{etiqueta}: pellizco ×{esperado:.2f} escala el mapa ×{r:.2f}')
    else:
        ok(r > 1.1, f'{etiqueta}: rueda acerca el mapa ×{r:.2f}')


with sync_playwright() as p:
    nav = p.chromium.launch(channel='chrome')
    for nombre, w, h, dpr, touch in DISP:
        if SOLO and SOLO != nombre:
            continue
        for modo in ['horizontal', 'vertical']:
            etiqueta = f'{nombre}/{modo}'
            print(f'== {etiqueta} {w}x{h}')
            ctx = nav.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, has_touch=touch, is_mobile=touch)
            pg = ctx.new_page(); logs = []
            pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error',) else None)
            pg.on('pageerror', lambda e: logs.append('PAGEERR ' + str(e)))
            pg.goto(B + '?demo=lobby'); pg.wait_for_timeout(900)
            st = estado(pg)
            ok(st['modo'] == 'horizontal' and st['ls'] is None, f'{etiqueta}: predeterminado = horizontal sin preferencia guardada')
            ok(st['w'] >= st['h'], f'{etiqueta}: el lienzo horizontal es más ancho que alto ({st["w"]}x{st["h"]})')
            ok(st['rot'] == ('1' if h > w else '0'), f'{etiqueta}: el lienzo gira solo si la ventana es vertical (rot={st["rot"]})')
            ok(pg.locator('.selector-vista button[aria-pressed="true"]', has_text='Horizontal').count() == 1, f'{etiqueta}: selector visible en la sala')
            pg.screenshot(path=f'{OUT}/{nombre}-{modo}-0-sala.png')
            if modo == 'vertical':
                pg.locator('.selector-vista button', has_text='Vertical').first.click(); pg.wait_for_timeout(300)
                st = estado(pg)
                ok(st['modo'] == 'vertical' and st['ls'] == 'vertical' and st['h'] >= st['w'], f'{etiqueta}: cambio inmediato a vertical y guardado en localStorage ({st["w"]}x{st["h"]})')
                ok(st['rot'] == '0', f'{etiqueta}: en vertical el lienzo no se gira')
            pg.goto(B + '?demo=1&minLectura=50'); pg.wait_for_timeout(1500)
            ok(estado(pg)['modo'] == modo, f'{etiqueta}: la preferencia sobrevive a recargar')
            st = estado(pg)
            # modal de carta (evento de la ronda 1) con la barra de lectura
            pg.wait_for_selector('.modal-carta', timeout=8000)
            pg.screenshot(path=f'{OUT}/{nombre}-{modo}-1-carta.png')
            mal = dentro(pg, '.modal-carta .modal-cerrar, .modal-carta .modal-sup', st['rect'])
            ok(not mal, f'{etiqueta}: botón Cerrar y cabecera de la carta dentro del lienzo {mal[:2]}')
            cerrar_modales(pg)
            ok(mi_turno(pg), f'{etiqueta}: llega mi turno')
            cerrar_modales(pg)
            pg.wait_for_timeout(400)
            pg.screenshot(path=f'{OUT}/{nombre}-{modo}-2-mesa.png')
            mal = dentro(pg, '.barra, .acciones, .barra .btn, .acciones .btn, .tablero-controles, .minimapa', st['rect'])
            ok(not mal, f'{etiqueta}: barra, acciones, controles y minimapa dentro del lienzo {mal[:3]}')
            cdp = ctx.new_cdp_session(pg) if touch else None
            gestos(pg, cdp, touch, etiqueta)
            # dados + modal de resultado
            pg.get_by_role('button', name='Tirar dado de ingreso').click(); pg.wait_for_timeout(700)
            pg.screenshot(path=f'{OUT}/{nombre}-{modo}-3-dados-rodando.png')
            pg.wait_for_selector('.dados-modal', timeout=6000)
            pg.screenshot(path=f'{OUT}/{nombre}-{modo}-4-dados-modal.png')
            mal = dentro(pg, '.dados-resultado, .dados-resultado button', st['rect'])
            ok(not mal, f'{etiqueta}: modal de dados dentro del lienzo {mal[:2]}')
            cerrar_modales(pg)
            # paneles y menús
            for boton, sel, esc in [('Acciones', '.hoja-modal', '5-acciones'), ('Mercado', '.hoja-modal', '6-mercado'), ('Mano', '.desplegable', '7-mano'), ('Retos', '.hoja-modal', '8-retos')]:
                pg.locator('.acciones .btn', has_text=boton).first.click(); pg.wait_for_timeout(350)
                pg.screenshot(path=f'{OUT}/{nombre}-{modo}-{esc}.png')
                mal = dentro(pg, sel, st['rect'])
                ok(not mal and pg.locator(sel).count() >= 1, f'{etiqueta}: panel {boton} dentro del lienzo {mal[:2]}')
                pg.locator(sel + ' .desp-cab .btn', has_text='Cerrar').first.click(); pg.wait_for_timeout(150)
            pg.locator('.barra .btn', has_text='Personajes').first.click(); pg.wait_for_timeout(350)
            pg.screenshot(path=f'{OUT}/{nombre}-{modo}-9-personajes.png')
            mal = dentro(pg, '.desplegable', st['rect'])
            ok(not mal, f'{etiqueta}: menú de personajes dentro del lienzo {mal[:2]}')
            pg.locator('.desplegable .btn', has_text='Cerrar').first.click(); pg.wait_for_timeout(150)
            pg.locator('.barra .btn', has_text='Más').first.click(); pg.wait_for_timeout(250)
            mal = dentro(pg, '.menu-lista', st['rect'])
            ok(not mal, f'{etiqueta}: menú «Más» dentro del lienzo {mal[:2]}')
            ok(not logs, f'{etiqueta}: sin errores de consola {logs[:2]}')
            ctx.close()
    nav.close()

print('\nRESULTADO:', 'TODO OK' if not fallos else f'{len(fallos)} FALLOS')
for f in fallos:
    print(' -', f)
sys.exit(1 if fallos else 0)
