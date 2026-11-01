# Prueba con Chrome headless (Python + Playwright). Ver README.txt, sección «Pruebas». Ajusta B (URL base) si hace falta.
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:4173/'
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome',args=['--enable-precise-memory-info','--js-flags=--expose-gc'])
    c=b.new_context(viewport={'width':390,'height':780},device_scale_factor=2,has_touch=True,is_mobile=True)
    pg=c.new_page(); logs=[]
    pg.on('pageerror',lambda e: logs.append('PAGEERR '+str(e)))
    pg.on('console',lambda m: logs.append(m.text) if m.type=='error' else None)
    pg.goto(B+'?demo=1&bots=0&minLectura=50&semilla=3'); pg.wait_for_timeout(1200)
    def estado(): return pg.evaluate("()=>({dom:document.getElementsByTagName('*').length, imgs:document.images.length, heap:performance.memory.usedJSHeapSize, cart:window.__cartas})")
    print('inicio',estado())
    over=[]; tipos={}
    for i in range(100):
        deck = ['evento','historico'][i%2]
        pg.evaluate("(d)=>{const D=window.__demo; D.act(D.yo,{t:'host.revelarCarta',mazo:d})}", deck)
        pg.wait_for_timeout(120)
        if pg.locator('.modal-carta').count()==0:
            continue
        pg.wait_for_timeout(100)
        info=pg.evaluate("()=>{const e=document.querySelector('.c-cuerpo'); const a=document.querySelector('[data-carta-completa]'); return e?{t:a.getAttribute('aria-label'),over:e.scrollHeight>e.clientHeight+1,sh:e.scrollHeight,ch:e.clientHeight}:null}")
        if info and info['over']: over.append(info)
        if i in (10,): pg.screenshot(path='/tmp/shots/mov-carta-i10.png')
        pg.locator('.modal-cerrar').click(); pg.wait_for_timeout(60)
        if i in (0,49): pg.evaluate("gc()"); print(i,estado())
    pg.evaluate("gc()"); pg.wait_for_timeout(300)
    print('fin',estado()); print('overflow',len(over),over[:5]); print(logs[:5])
    print(pg.evaluate("window.__demo.e.historial.length"))
    b.close()
