# Prueba con Chrome headless (Python + Playwright). Ver README.txt, sección «Pruebas». Ajusta B (URL base) si hace falta.
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:4173/'
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome')
    for ancho in (360,300):
        pg=b.new_context(viewport={'width':1300,'height':900}).new_page(); errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)))
        for m in ['evento','historico','mensaje','objeto','trivia','mesa','cuento','personaje']:
            pg.goto(B+f'?demo=1&galeria={m}&ancho={ancho}'); pg.wait_for_timeout(1500)
            r=pg.evaluate('window.__galeria'); print(ancho,m,r['total'] if r else None,r['desbordan'] if r else None,errs[:2])
            if ancho==360 and m in('objeto','trivia','personaje'): pg.screenshot(path=f'/tmp/shots/gal-{m}.png')
    b.close()
