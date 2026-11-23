// Prepara el relieve del tablero a partir del mapa real del juego (public/svg/tablero-mapa.svg, que solo se lee).
// Uso, desde la raíz del repositorio:   node src/escena3d/herramientas/preparar-relieve.mjs
// Necesita Playwright con Chromium (rasteriza las capas en un navegador).
//
// Del propio mapa salen la máscara tierra/mar (el trazo «costa»), los arenales (dunas), los ríos y la posición de cada glifo
// de montaña. Salida: public/arte3d/relieve.webp (canales: rojo = tierra, verde = arenal, azul = río, todos suavizados) y
// src/escena3d/datos/montes.json (dónde se levanta cada montaña).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.resolve(AQUI, '../../..');
const SALIDA = process.argv[2] ? path.resolve(process.argv[2]) : null;      // carpeta opcional de salida (para comparar sin pisar)
const orig = fs.readFileSync(path.join(RAIZ, 'public/svg/tablero-mapa.svg'), 'utf8');
const costa = orig.match(/<path id="costa" d="([^"]+)"/)[1];
const arenales = [...orig.matchAll(/<path d="([^"]+)" fill="url\(#arena\)"/g)].map((m) => m[1]);
const rios = [...orig.matchAll(/<path d="([^"]+)" fill="none" stroke="#3f7f82"/g)].map((m) => m[1]);
const montes = [...orig.matchAll(/<path d="M([-\d.]+),([-\d.]+)L([-\d.]+),([-\d.]+)L([-\d.]+),([-\d.]+)L([-\d.]+),([-\d.]+)L([-\d.]+),([-\d.]+)" fill="#d8c08a"/g)]
  .map((m) => m.slice(1).map(Number)).map((v) => ({ x0: v[0], x1: v[8], y0: v[1], picos: [[v[2], v[3]], [v[6], v[7]]] }));
if (!arenales.length || montes.length < 40) throw new Error('No encontré arenales o montañas en el mapa.');
const RW = 1188, RH = 840, cab = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2970 2100" width="${RW}" height="${RH}">`;
const capas = [
  `${cab}<filter id="f" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="7"/></filter><path d="${costa}" fill="#f00" fill-rule="evenodd" filter="url(#f)"/></svg>`,
  `${cab}<filter id="f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="20"/></filter><clipPath id="c"><path d="${costa}" clip-rule="evenodd"/></clipPath><g clip-path="url(#c)"><g filter="url(#f)" fill="#0f0">${arenales.map((d) => `<path d="${d}"/>`).join('')}</g></g></svg>`,
  `${cab}<filter id="f"><feGaussianBlur stdDeviation="3"/></filter><g filter="url(#f)" fill="none" stroke="#00f" stroke-width="9" stroke-linecap="round">${rios.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`,
];
const nav = await chromium.launch(), pag = await nav.newPage();
const relieve = Buffer.from(await pag.evaluate(async ({ capas, RW, RH }) => {
  const c = document.createElement('canvas'); c.width = RW; c.height = RH; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, RW, RH); g.globalCompositeOperation = 'lighter';
  for (const s of capas) { const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); await img.decode(); g.drawImage(img, 0, 0, RW, RH); }
  return c.toDataURL('image/webp', 0.93).split(',')[1];
}, { capas, RW, RH }), 'base64');
await nav.close();
const dirArte = SALIDA || path.join(RAIZ, 'public/arte3d'), dirDatos = SALIDA || path.join(AQUI, '../datos');
fs.mkdirSync(dirArte, { recursive: true }); fs.mkdirSync(dirDatos, { recursive: true });
fs.writeFileSync(path.join(dirArte, 'relieve.webp'), relieve);
fs.writeFileSync(path.join(dirDatos, 'montes.json'), JSON.stringify(montes));
console.log('relieve.webp', (relieve.length / 1024).toFixed(0) + ' KB;', montes.length, 'montañas,', arenales.length, 'arenales,', rios.length, 'ríos');
