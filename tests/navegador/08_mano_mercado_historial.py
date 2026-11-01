# Prueba con Chrome headless (Python + Playwright). Ver README.txt, sección «Pruebas». Ajusta B (URL base) si hace falta.
from playwright.sync_api import sync_playwright
import os; os.makedirs('/tmp/shots-08',exist_ok=True)
B='http://127.0.0.1:4173/'
def run(name,vp,dpr,mob):
    with sync_playwright() as p:
        b=p.chromium.launch(channel='chrome')
        c=b.new_context(viewport=vp,device_scale_factor=dpr,has_touch=mob,is_mobile=mob)
        pg=c.new_page(); errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        pg.goto(B+'?demo=1&bots=0&minLectura=50'); pg.wait_for_timeout(1200)
        pg.evaluate("""()=>{const D=window.__demo; for (const id of ['OB01','OB06','OB12','OB20']) D.act(D.yo,{t:'host.repartir',pid:D.yo,mazo:'objeto',id}); D.act(D.yo,{t:'host.repartir',pid:D.yo,mazo:'mensaje'});}""")
        pg.wait_for_timeout(300)
        for _ in range(8):
            if pg.locator('.modal-cerrar').count(): pg.wait_for_timeout(120); pg.locator('.modal-cerrar').click(); pg.wait_for_timeout(100)
        pg.get_by_role('button',name='Mano').click(); pg.wait_for_timeout(600)
        pg.screenshot(path=f'/tmp/shots-08/{name}-i-mano.png')
        pg.locator('.mano-carta').first.click(); pg.wait_for_timeout(500)
        pg.screenshot(path=f'/tmp/shots-08/{name}-j-mano-carta.png')
        pg.locator('.modal-cerrar').click(); pg.wait_for_timeout(200)
        pg.get_by_role('button',name='Cerrar').first.click()
        pg.get_by_role('button',name='Mercado').click(); pg.wait_for_timeout(500)
        pg.screenshot(path=f'/tmp/shots-08/{name}-k-mercado.png')
        pg.get_by_role('button',name='Cerrar').first.click()
        pg.get_by_role('button',name='Más ▾').click(); pg.get_by_role('menuitem',name='Historial de cartas').click(); pg.wait_for_timeout(400)
        pg.screenshot(path=f'/tmp/shots-08/{name}-l-historial.png')
        pg.get_by_role('button',name='Cerrar').first.click()
        pg.get_by_role('button',name='Última carta').click(); pg.wait_for_timeout(400)
        pg.screenshot(path=f'/tmp/shots-08/{name}-m-ultima.png'); print('ultima: barra?',pg.locator('.barra-lectura').count())
        pg.locator('.modal-cerrar').click()
        print(name,errs, pg.evaluate('window.__cartas'))
        b.close()
run('pc',{'width':1280,'height':800},1,False)
run('mov',{'width':390,'height':780},2,True)
