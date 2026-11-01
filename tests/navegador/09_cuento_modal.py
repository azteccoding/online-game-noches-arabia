# Cuento de ambiente (19.7): al llegar a una ciudad sale el modal del cuento (barra de 5 s) y el servidor acredita 2 dinares.
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:4173/'
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome')
    c=b.new_context(viewport={'width':390,'height':780},device_scale_factor=2,has_touch=True,is_mobile=True)
    pg=c.new_page(); logs=[]
    pg.on('pageerror',lambda e: logs.append('PAGEERR '+str(e)))
    pg.on('console',lambda m: logs.append(m.text) if m.type=='error' else None)
    pg.goto(B+'?demo=1&bots=0&semilla=3'); pg.wait_for_timeout(1500)
    D="window.__demo"
    for _ in range(12):
        if pg.locator('.modal-cerrar:not([disabled])').count(): pg.locator('.modal-cerrar').first.click(); pg.wait_for_timeout(200); continue
        if pg.locator('.modal-carta').count(): pg.wait_for_timeout(500); continue
        if pg.evaluate(f"()=>{D}.e.turno.pid==={D}.yo && {D}.e.turno.fase==='ingreso'"): break
        pg.evaluate(f"()=>{{const D={D}; D.act(D.yo,{{t:'host.pasarTurno',pid:D.yo}})}}"); pg.wait_for_timeout(500)
    pg.evaluate(f"()=>{{const D={D}; D.act(D.yo,{{t:'tirarDados'}})}}"); pg.wait_for_timeout(2200)
    pg.evaluate(f"()=>{{const D={D}; D.act(D.yo,{{t:'cerrarDados'}})}}"); pg.wait_for_timeout(300)
    din0 = pg.evaluate(f"()=>{D}.e.jugadores[{D}.yo].dinares")
    pg.evaluate(f"()=>{{const D={D}; D.act(D.yo,{{t:'viajar',destino:'Damasco'}})}}"); pg.wait_for_timeout(500)
    t = pg.evaluate("()=>document.querySelector('.modal-carta [data-carta-completa]')?.getAttribute('aria-label')")
    barra = pg.locator('.barra-lectura').count()
    pg.screenshot(path='/tmp/cuento-modal.png')
    cerrar_antes = pg.locator('.modal-cerrar').is_disabled()
    pg.wait_for_timeout(5300)
    cerrar_despues = pg.locator('.modal-cerrar').is_disabled()
    din1 = pg.evaluate(f"()=>{D}.e.jugadores[{D}.yo].dinares")
    cuentos = pg.evaluate(f"()=>{D}.e.historial.filter(h=>h.deck==='cuento').map(h=>h.titulo)")
    print('modal:', t, '| barra:', barra, '| cerrar deshabilitado al abrir:', cerrar_antes, '| al pasar 5 s:', cerrar_despues)
    print('dinares', din0, '->', din1, '| cuentos', cuentos, '| errores', logs[:3])
    b.close()
