// Cajas de los rótulos del mapa (nombres de ciudades, mares, regiones) y de sus dibujos sueltos (barquitos, camellos, la serpiente
// marina, la rosa de los vientos, el cartel del título), en unidades del mapa (2970 × 2100): cada una son sus cuatro
// esquinas [[x, y], …], giradas como el rótulo (el Mar Rojo y el Golfo Pérsico van inclinados). Las usa dhow.js para
// que un barco fondeado no tape ningún nombre (Jorge, 23 de noviembre de 2026).
// Uso, desde la raíz del repositorio (con Playwright y Chromium instalados):
//     node src/escena3d/herramientas/rotulos-mapa.cjs
// Lee public/svg/tablero-mapa.svg y escribe src/escena3d/datos/rotulos.json.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..', '..', '..');
(async () => {
  const svg = fs.readFileSync(path.join(RAIZ, 'public/svg/tablero-mapa.svg'), 'utf8');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2970, height: 2100 } });
  await p.setContent(`<!doctype html><html><body style="margin:0">${svg.replace('<svg ', '<svg width="2970" height="2100" ')}</body></html>`);
  const cajas = await p.evaluate(() => {
    const raiz = document.querySelector('svg'), aRaiz = raiz.getScreenCTM().inverse(), out = [];
    for (const g of raiz.querySelectorAll('g[transform*="translate"]')) {
      if (g.parentElement.closest('g[transform*="translate"]')) continue;      // solo el grupo de fuera
      const bb = g.getBBox(); if (!bb.width || !bb.height) continue;
      const m = aRaiz.multiply(g.getScreenCTM()), P = raiz.createSVGPoint();
      out.push([[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x + bb.width, bb.y + bb.height], [bb.x, bb.y + bb.height]].map(([x, y]) => { P.x = x; P.y = y; const q = P.matrixTransform(m); return [Math.round(q.x), Math.round(q.y)]; }));
    }
    return out;
  });
  await b.close();
  fs.writeFileSync(path.join(RAIZ, 'src/escena3d/datos/rotulos.json'), JSON.stringify(cajas) + '\n');
  console.log(cajas.length, 'rótulos');
})();
