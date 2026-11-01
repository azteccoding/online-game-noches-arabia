# Prueba con Chrome headless (Python + Playwright). Ver README.txt, sección «Pruebas». Ajusta B (URL base) si hace falta.
import json
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:4173/'
tab=json.load(open('/tmp/online-run/src/data/tablero.json'))
cs=tab['cities']; bag=cs['Bagdad'] if isinstance(cs,dict) else [c for c in cs if c.get('id')=='Bagdad' or c.get('nombre')=='Bagdad'][0]
bx,by=bag['x'],bag['y']; print('bagdad',bx,by)
cfg=[('pc',1280,800,1,False),('pc',1280,800,2,False),('pc',1280,800,3,False),('mov',390,780,1,True),('mov',390,780,2,True),('mov',390,780,3,True)]
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome')
    for name,w,h,dpr,mob in cfg:
        c=b.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr,has_touch=mob,is_mobile=mob)
        pg=c.new_page(); pg.goto(B+'?demo=1&bots=0'); pg.wait_for_timeout(1500)
        lim=pg.evaluate('window.__tablero.limites'); print(name,dpr,{k:round(v,3) for k,v in lim.items()})
        for tag,z in [('max',lim['zmax']),('min',lim['zmin'])]:
            pg.evaluate(f'window.__tablero.irA({bx},{by},{z},0)'); pg.wait_for_timeout(900)
            pg.screenshot(path=f'/tmp/shots/zoom-{name}-dpr{dpr}-{tag}.png')
        c.close()
    b.close()
