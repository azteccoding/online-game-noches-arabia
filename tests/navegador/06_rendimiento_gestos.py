# Prueba con Chrome headless (Python + Playwright). Ver README.txt, sección «Pruebas». Ajusta B (URL base) si hace falta.
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:4173/'
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome')
    for name,w,h,dpr in [('pc',1280,800,2),('mov-emul',390,780,3)]:
        c=b.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr)
        pg=c.new_page(); pg.goto(B+'?demo=1&bots=0'); pg.wait_for_timeout(1500)
        pg.evaluate("""()=>{window.__ft=[];let l=performance.now();const f=(t)=>{window.__ft.push(t-l);l=t;requestAnimationFrame(f)};requestAnimationFrame(f)}""")
        r0=pg.evaluate('window.__rendersTablero')
        cx,cy=w//2,h//2
        pg.mouse.move(cx,cy); pg.mouse.down()
        for i in range(90): pg.mouse.move(cx+i*3,cy+i*2); pg.wait_for_timeout(8)
        pg.mouse.up()
        for i in range(25): pg.mouse.wheel(0,-120); pg.wait_for_timeout(16)
        for i in range(25): pg.mouse.wheel(0,120); pg.wait_for_timeout(16)
        pg.wait_for_timeout(600)
        r1=pg.evaluate('window.__rendersTablero'); ft=pg.evaluate('window.__ft')
        ft=sorted(ft); n=len(ft)
        print(name,'renders React durante gestos:',r1-r0,'frames',n,'mediana ms',round(ft[n//2],1),'p95',round(ft[int(n*.95)],1),'max',round(ft[-1],1))
        c.close()
    b.close()
