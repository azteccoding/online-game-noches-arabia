# Prueba con Chrome headless (Python + Playwright). Ver README.txt, sección «Pruebas». Ajusta B (URL base) si hace falta.
import sys, json
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:4173/'
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome')
    for name,vp,dpr in [('pc',{'width':1280,'height':800},1),('mov',{'width':390,'height':780},2)]:
        c=b.new_context(viewport=vp,device_scale_factor=dpr,has_touch=(name=='mov'),is_mobile=(name=='mov'))
        pg=c.new_page()
        logs=[]
        pg.on('console',lambda m: logs.append(m.type+': '+m.text) if m.type in('error','warning') else None)
        pg.on('pageerror',lambda e: logs.append('PAGEERR '+str(e)))
        pg.goto(B+'?demo=lobby'); pg.wait_for_timeout(1200)
        pg.screenshot(path=f'/tmp/shots/{name}-lobby.png')
        pg.goto(B+'?demo=1'); pg.wait_for_timeout(2000)
        pg.screenshot(path=f'/tmp/shots/{name}-mesa.png')
        print(name,logs[:10])
        c.close()
    b.close()
