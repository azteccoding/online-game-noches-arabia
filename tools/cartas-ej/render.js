// node render.js [ruta-arte] [solo-ids]   (CARTAS=cartas-jorasan.json para las del Jorasán)
// Las pinturas van en ./arte/ (EJ.png, EJ-pierdes.png, EJ-ganas.png, EJ-jorasan.png); cada carta dice cuál usa en «arte».
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const base = __dirname;
  const cartas = JSON.parse(fs.readFileSync(base + '/' + (process.env.CARTAS || 'cartas.json'), 'utf8'));
  const arte = process.argv[2] && fs.existsSync(process.argv[2]) ? 'file://' + process.argv[2] : '';
  const solo = process.argv[3] ? process.argv[3].split(',') : null;
  fs.mkdirSync(base + '/png', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 744, height: 1039 }, deviceScaleFactor: 1 });
  await p.goto('file://' + base + '/carta.html');
  const avisos = [];
  for (const c of cartas) {
    if (solo && !solo.includes(c.id)) continue;
    for (const cara of ['frente', 'dorso']) {
      const suArte = c.arte && fs.existsSync(base + '/arte/' + c.arte) ? 'file://' + base + '/arte/' + c.arte : arte;
      const r = await p.evaluate(([c, cara, arte]) => window.pintar(c, cara, arte), [c, cara, suArte]);
      if (r.texto && r.texto < 19) avisos.push(`${c.id} texto ${r.texto}px`);
      if (r.titulo && r.titulo < 34) avisos.push(`${c.id} título ${r.titulo}px`);
      await p.screenshot({ path: `${base}/png/${c.id}-${cara}.png` });
    }
  }
  console.log('listo', avisos.join('; ') || 'sin avisos');
  await b.close();
})();
