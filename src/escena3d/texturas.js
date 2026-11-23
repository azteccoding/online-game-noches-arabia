// Texturas procedurales (madera, tapete, baldosas, resplandores…): todo se pinta en lienzos al cargar, sin archivos externos.
import * as THREE from 'three';
import { PALETA } from './medidas.js';

export const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function azar(semilla) { let a = semilla >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Grano: puntos claros y oscuros semitransparentes sobre el lienzo (sin leer píxeles de vuelta).
function grano(g, w, h, fuerza, semilla, trama = false) {
  const c = lienzo(w, h), x = c.getContext('2d'), im = x.createImageData(w, h), d = im.data, r = azar(semilla);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = r() - 0.5, osc = v < 0 || (trama && ((p % w) + Math.floor(p / w)) % 3 === 0);
    d[i] = d[i + 1] = d[i + 2] = osc ? 0 : 255; d[i + 3] = Math.min(255, (Math.abs(v) * 2 * fuerza + (trama && osc && v >= 0 ? fuerza * 0.5 : 0)) * 255);
  }
  x.putImageData(im, 0, 0); g.drawImage(c, 0, 0);
}
export function aTextura(c, { repetir = false, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  return t;
}

// Madera oscura con veta ondulada; se repite sin costuras.
export function texMadera({ base = '#3a1d12', clara = '#6b3a22', oscura = '#170a06', semilla = 7, tam = 1024 } = {}) {
  const c = lienzo(tam, tam), g = c.getContext('2d'), r = azar(semilla);
  g.fillStyle = base; g.fillRect(0, 0, tam, tam);
  const onda = (y, amp, f1, f2, p1, p2) => {
    for (const dy of [-tam, 0, tam]) {
      g.beginPath();
      for (let x = 0; x <= tam; x += 16) {
        const k = (x / tam) * Math.PI * 2;
        const yy = y + dy + Math.sin(k * f1 + p1) * amp + Math.sin(k * f2 + p2) * amp * 0.4;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
  };
  for (let i = 0; i < 46; i++) {           // bandas anchas de tono
    g.strokeStyle = r() < 0.5 ? clara : oscura; g.globalAlpha = 0.05 + r() * 0.1; g.lineWidth = 14 + r() * 70;
    onda(r() * tam, 6 + r() * 16, 1 + Math.floor(r() * 2), 2 + Math.floor(r() * 3), r() * 6.28, r() * 6.28);
  }
  for (let i = 0; i < 620; i++) {          // veta fina
    g.strokeStyle = r() < 0.62 ? oscura : clara; g.globalAlpha = 0.05 + r() * 0.16; g.lineWidth = 0.6 + r() * 2.2;
    onda(r() * tam, 4 + r() * 12, 1 + Math.floor(r() * 2), 2 + Math.floor(r() * 4), r() * 6.28, r() * 6.28);
  }
  g.globalAlpha = 0.5; g.fillStyle = oscura;
  for (let i = 0; i < 2600; i++) { const x = r() * tam, y = r() * tam; g.globalAlpha = 0.08 + r() * 0.2; g.fillRect(x, y, 3 + r() * 9, 0.8); }   // poros
  g.globalAlpha = 1;
  return aTextura(c, { repetir: true });
}

// Estrella de ocho puntas (dos cuadrados girados): motivo geométrico genérico para cenefas.
function estrella8(g, x, y, R, relleno, trazo, ancho = 1) {
  g.save(); g.translate(x, y);
  g.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, rr = i % 2 ? R * 0.74 : R; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath();
  if (relleno) { g.fillStyle = relleno; g.fill(); }
  if (trazo) { g.strokeStyle = trazo; g.lineWidth = ancho; g.stroke(); }
  g.restore();
}
function rombo(g, x, y, rx, ry, relleno) { g.beginPath(); g.moveTo(x - rx, y); g.lineTo(x, y - ry); g.lineTo(x + rx, y); g.lineTo(x, y + ry); g.closePath(); g.fillStyle = relleno; g.fill(); }

// Tapete bajo el tablero: campo vino con estrellas tenues y cenefa estrecha índigo, oro y turquesa (lo que asoma alrededor del marco).
export function texTapete(w = 2048, h = 1544) {
  const c = lienzo(w, h), g = c.getContext('2d'), r = azar(21);
  g.fillStyle = '#360a11'; g.fillRect(0, 0, w, h);
  const paso = 48;
  for (let y = paso / 2; y < h; y += paso) for (let x = paso / 2; x < w; x += paso) { estrella8(g, x, y, 15, '#421018', '#4e151d', 1.2); rombo(g, x + paso / 2, y + paso / 2, 5, 5, '#2b070c'); }
  const banda = (m, ancho, color) => { g.strokeStyle = color; g.lineWidth = ancho; g.strokeRect(m + ancho / 2, m + ancho / 2, w - 2 * m - ancho, h - 2 * m - ancho); };
  banda(0, 12, '#22050a');
  banda(12, 4, '#a9793a');
  banda(16, 52, '#101f45');
  banda(68, 4, '#a9793a');
  banda(72, 22, '#531219');
  banda(94, 3, '#b98b47');
  banda(97, 7, '#17504f');
  banda(104, 3, '#b98b47');
  const cy0 = 16 + 26, n = Math.round((w - 2 * cy0) / 58), dx = (w - 2 * cy0) / n;
  for (let i = 0; i <= n; i++) for (const y of [cy0, h - cy0]) { const x = cy0 + i * dx; estrella8(g, x, y, 16, '#a67a3b', '#d9b470', 1.5); estrella8(g, x, y, 7, '#101f45', null); if (i < n) rombo(g, x + dx / 2, y, 6, 10, '#237878'); }
  const m = Math.round((h - 2 * cy0) / 58), dy = (h - 2 * cy0) / m;
  for (let i = 1; i < m; i++) for (const x of [cy0, w - cy0]) { const y = cy0 + i * dy; estrella8(g, x, y, 16, '#a67a3b', '#d9b470', 1.5); estrella8(g, x, y, 7, '#101f45', null); }
  for (let i = 0; i < m; i++) for (const x of [cy0, w - cy0]) rombo(g, x, cy0 + (i + 0.5) * dy, 10, 6, '#237878');
  const ci = 83;
  for (let x = ci + 14; x < w - ci; x += 28) for (const y of [ci, h - ci]) rombo(g, x, y, 4.5, 4.5, '#b98b47');
  for (let y = ci + 14; y < h - ci; y += 28) for (const x of [ci, w - ci]) rombo(g, x, y, 4.5, 4.5, '#b98b47');
  grano(g, w, h, 0.1, 31, true);
  return aTextura(c);
}

// Flecos del tapete (hilos claros con transparencia).
export function texFlecos(w = 1024, h = 64) {
  const c = lienzo(w, h), g = c.getContext('2d'), r = azar(8);
  for (let x = 2; x < w; x += 5) { const l = h * (0.72 + r() * 0.26); g.strokeStyle = `rgba(${205 + r() * 30},${180 + r() * 30},${130 + r() * 30},${0.75 + r() * 0.25})`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (r() - 0.5) * 5, l * 0.6, x + (r() - 0.5) * 7, l); g.stroke(); }
  for (let x = 6; x < w; x += 20) { g.fillStyle = 'rgba(150,110,60,.9)'; g.fillRect(x - 5, 3, 13, 4); }
  const t = aTextura(c); t.wrapS = THREE.RepeatWrapping; return t;
}

// Suelo de terraza: baldosas oscuras con estrella y cruz.
export function texBaldosas(tam = 512) {
  const c = lienzo(tam, tam), g = c.getContext('2d'), r = azar(5);
  g.fillStyle = '#17121f'; g.fillRect(0, 0, tam, tam);
  const p = tam / 2;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x = i * p + p / 2, y = j * p + p / 2;
    estrella8(g, x, y, p * 0.46, (i + j) % 2 ? '#221a2e' : '#1d2038', '#0b0810', 4);
    estrella8(g, x, y, p * 0.16, '#2b2238', null);
  }
  for (const [x, y] of [[0, 0], [p, 0], [0, p], [p, p], [tam, 0], [0, tam], [tam, tam], [p, tam], [tam, p]]) rombo(g, x, y, p * 0.2, p * 0.2, '#2a1a22');
  grano(g, tam, tam, 0.06, 32);
  return aTextura(c, { repetir: true });
}

// Resplandor radial suave (halos de lámparas, motas de polvo, estrellas).
export function texResplandor(tam = 128, paradas = [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [0.6, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]) {
  const c = lienzo(tam, tam), g = c.getContext('2d');
  const gr = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  for (const [o, col] of paradas) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, tam, tam);
  return aTextura(c, { srgb: true });
}

// Sombra de contacto (mancha oscura suave bajo las piezas).
export function texSombra(tam = 128) {
  return texResplandor(tam, [[0, 'rgba(0,0,0,.62)'], [0.45, 'rgba(0,0,0,.38)'], [0.8, 'rgba(0,0,0,.08)'], [1, 'rgba(0,0,0,0)']]);
}

// Aro dorado con destellos para la ficha elegida y las ciudades a las que puede viajar.
export function texAro(tam = 256) {
  const c = lienzo(tam, tam), g = c.getContext('2d'), m = tam / 2;
  const gr = g.createRadialGradient(m, m, m * 0.5, m, m, m);
  gr.addColorStop(0, 'rgba(255,220,150,0)'); gr.addColorStop(0.5, 'rgba(255,214,140,.5)'); gr.addColorStop(0.72, 'rgba(255,240,200,1)'); gr.addColorStop(0.86, 'rgba(255,200,110,.45)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, tam, tam);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 16; i++) { g.save(); g.translate(m, m); g.rotate((i * Math.PI) / 8); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(-2, -m, 4, m * 0.42); g.restore(); }
  return aTextura(c);
}

// Trazos de ruta: guiones (tierra, río) y puntos (mar), como en el tablero 2D.
export function texGuion(tipo) {
  const c = lienzo(148, 16), g = c.getContext('2d');
  g.clearRect(0, 0, 148, 16); g.fillStyle = '#fff';
  if (tipo === 'puntos') { for (const x of [18.5, 55.5, 92.5, 129.5]) { g.beginPath(); g.arc(x, 8, 7, 0, 6.3); g.fill(); } }
  else { g.beginPath(); g.roundRect(4, 2, 100, 12, 5); g.fill(); }
  const t = aTextura(c, { srgb: true }); t.wrapS = THREE.RepeatWrapping; return t;
}

// Celosía calada de los faroles (vidrio ámbar tras latón).
export function texCelosia(tam = 256) {
  const c = lienzo(tam, tam * 2), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, tam * 2);
  gr.addColorStop(0, '#ffb85c'); gr.addColorStop(0.5, '#ffe2a3'); gr.addColorStop(1, '#ff9a3d');
  g.fillStyle = gr; g.fillRect(0, 0, tam, tam * 2);
  g.strokeStyle = '#2a1608'; g.lineWidth = 9;
  const p = tam / 2;
  for (let y = -p; y <= tam * 2 + p; y += p) for (let x = -p; x <= tam + p; x += p) {
    g.beginPath(); g.moveTo(x, y + p / 2); g.lineTo(x + p / 2, y); g.lineTo(x + p, y + p / 2); g.lineTo(x + p / 2, y + p); g.closePath(); g.stroke();
    estrella8(g, x + p / 2, y + p / 2, p * 0.2, null, '#2a1608', 7);
  }
  g.lineWidth = 16; g.strokeRect(0, 0, tam, tam * 2);
  return aTextura(c);
}

// Luz calada que el farol proyecta sobre la mesa.
export function texLuzCalada(tam = 512) {
  const c = lienzo(tam, tam), g = c.getContext('2d'), m = tam / 2;
  const gr = g.createRadialGradient(m, m, 0, m, m, m);
  gr.addColorStop(0, 'rgba(255,190,110,.75)'); gr.addColorStop(0.3, 'rgba(255,160,80,.3)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, tam, tam);
  for (let k = 1; k <= 6; k++) {
    const R = m * (0.2 + k * 0.125), n = 6 * (k + 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (k % 2) * (Math.PI / n);
      estrella8(g, m + Math.cos(a) * R, m + Math.sin(a) * R, 5 + k * 2.1, `rgba(255,214,150,${0.5 - k * 0.07})`, null);
    }
  }
  return aTextura(c);
}

// Terciopelo: ruido fino para el fondo de la bandeja de dados.
export function texTerciopelo(tam = 256) {
  const c = lienzo(tam, tam), g = c.getContext('2d'), r = azar(3);
  g.fillStyle = '#4c0f17'; g.fillRect(0, 0, tam, tam);
  grano(g, tam, tam, 0.16, 33);
  return aTextura(c, { repetir: true });
}

// Luna creciente con halo.
export function texLuna(tam = 256) {
  const c = lienzo(tam, tam), g = c.getContext('2d'), m = tam / 2;
  const gr = g.createRadialGradient(m, m, tam * 0.1, m, m, m);
  gr.addColorStop(0, 'rgba(255,240,205,.5)'); gr.addColorStop(0.35, 'rgba(255,225,170,.16)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = gr; g.fillRect(0, 0, tam, tam);
  const c2 = lienzo(tam, tam), g2 = c2.getContext('2d');
  g2.fillStyle = '#fff1cf'; g2.beginPath(); g2.arc(m, m, tam * 0.17, 0, 6.3); g2.fill();
  g2.globalCompositeOperation = 'destination-out'; g2.beginPath(); g2.arc(m + tam * 0.075, m - tam * 0.035, tam * 0.155, 0, 6.3); g2.fill();
  g.drawImage(c2, 0, 0);
  return aTextura(c);
}
