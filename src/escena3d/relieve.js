// Relieve del mapa: el mar más bajo que la tierra, cordilleras donde el mapa dibuja montañas y dunas suaves en los arenales.
// Todo sale del propio tablero-mapa.svg (ver preparar-recursos.js) y llega como recurso: relieve.webp (rojo = tierra, verde = arenal, azul = río)
// y montes.json (un registro por cada glifo de montaña). Aquí se arma la rejilla de alturas, la malla y el mapa de normales.
import * as THREE from 'three';
import { U, ANCHO, ALTO } from './medidas.js';
import { lienzo } from './texturas.js';

export const NIVEL_MAR = -0.09;      // la tierra queda en 0
const ALTO_MAX = 0.44;               // techo de las cordilleras (una ficha mide 0,94)
const paso = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// llanos: [{ x, y, r0, r1 }] círculos (ciudades) y cajas: [{ x0, y0, x1, y1 }] (rótulos), en unidades del mapa: ahí el terreno
// se aplana para que los edificios apoyen bien y los nombres se lean.
export async function crearRelieve({ relieveURL, montes, llanos = [], cajas = [], segX = 372 }) {
  const img = new Image(); img.src = relieveURL; await img.decode();
  const W = img.width, H = img.height, k = (ANCHO / U) / W;      // unidades de mapa por celda
  const cv = lienzo(W, H), g2 = cv.getContext('2d', { willReadFrequently: true }); g2.drawImage(img, 0, 0);
  const px = g2.getImageData(0, 0, W, H).data;
  const N = W * H, h = new Float32Array(N), llano = new Float32Array(N).fill(1), P = new Float32Array(N).fill(1);

  const ventana = (x0, y0, x1, y1, f) => {
    const i0 = Math.max(0, Math.floor(x0 / k)), i1 = Math.min(W - 1, Math.ceil(x1 / k)), j0 = Math.max(0, Math.floor(y0 / k)), j1 = Math.min(H - 1, Math.ceil(y1 / k));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) f(j * W + i, i * k, j * k);
  };
  for (const c of llanos) ventana(c.x - c.r1, c.y - c.r1, c.x + c.r1, c.y + c.r1, (n, x, y) => { llano[n] *= paso(c.r0, c.r1, Math.hypot(x - c.x, y - c.y)); });
  const M = 30;
  for (const c of cajas) ventana(c.x0 - M, c.y0 - M, c.x1 + M, c.y1 + M, (n, x, y) => {
    const dx = Math.max(c.x0 - x, 0, x - c.x1), dy = Math.max(c.y0 - y, 0, y - c.y1); llano[n] *= paso(0, M, Math.hypot(dx, dy));
  });
  // Cordilleras: cada glifo tiene dos picos; el terreno sube debajo del dibujo (un poco al norte de su base).
  for (const m of montes) {
    const ancho = m.x1 - m.x0;
    for (const [px0, py0] of m.picos) {
      const alto = Math.min(ALTO_MAX * 0.94, (m.y0 - py0) * U * 0.82), cx = px0, cy = m.y0 - (m.y0 - py0) * 0.42, sx = ancho * 0.34, sy = ancho * 0.3;
      ventana(cx - sx * 2.4, cy - sy * 2.4, cx + sx * 2.4, cy + sy * 2.4, (n, x, y) => {
        const r = Math.hypot((x - cx) / sx, (y - cy) / sy);
        const c = (alto / ALTO_MAX) * (0.5 * Math.exp(-1.6 * r * r) + 0.5 * Math.max(0, 1 - r / 1.5) ** 1.6);
        P[n] *= 1 - Math.min(0.97, c);
      });
    }
  }
  const AW = ANCHO / U, AH = ALTO / U;
  const agua = new Uint8Array(N * 4), cerca = new Float32Array(N);
  for (let j = 0, n = 0; j < H; j++) for (let i = 0; i < W; i++, n++) {
    const x = i * k, y = j * k, L = px[n * 4] / 255, D = px[n * 4 + 1] / 255, R = px[n * 4 + 2] / 255;
    const tierra = paso(0.3, 0.72, L), f = llano[n], borde = paso(45, 120, Math.min(x, AW - x, y, AH - y));
    const ruido = Math.sin(x * 0.021 + Math.sin(y * 0.017) * 2.1) * Math.sin(y * 0.023 + Math.sin(x * 0.013) * 1.7);
    const fino = Math.sin(x * 0.085 + y * 0.047 + ruido * 2) * Math.sin(y * 0.105 - x * 0.031);
    let a = NIVEL_MAR * (1 - tierra);
    a += tierra * (0.012 + 0.012 * ruido) * (0.35 + 0.65 * f);                                   // ondulación general de la tierra
    const duna = 1 - Math.abs(Math.sin(x * 0.047 + Math.sin(y * 0.019) * 2.4 + ruido * 1.2));    // crestas de duna
    a += tierra * D * f * (0.008 + 0.042 * duna * duna);
    const monte = ALTO_MAX * (1 - P[n]);
    a += tierra * borde * f * monte * (1 + 0.2 * fino + 0.1 * ruido);
    a -= tierra * R * 0.02 * f;                                                                  // cauce de los ríos
    h[n] = a;
    agua[n * 4] = 255 * (1 - tierra); agua[n * 4 + 1] = 255 * R * tierra; agua[n * 4 + 3] = 255; cerca[n] = tierra;
  }
  // Cercanía a tierra (la máscara muy difuminada): sirve para la espuma y los rizos que llegan a la orilla.
  { const tmp = new Float32Array(N), RAD = 14;
    for (let pasada = 0; pasada < 2; pasada++) {
      for (let j = 0; j < H; j++) { let s = 0; for (let i = -RAD; i <= RAD; i++) s += cerca[j * W + Math.min(W - 1, Math.max(0, i))]; for (let i = 0; i < W; i++) { tmp[j * W + i] = s / (2 * RAD + 1); s += cerca[j * W + Math.min(W - 1, i + RAD + 1)] - cerca[j * W + Math.max(0, i - RAD)]; } }
      for (let i = 0; i < W; i++) { let s = 0; for (let j = -RAD; j <= RAD; j++) s += tmp[Math.min(H - 1, Math.max(0, j)) * W + i]; for (let j = 0; j < H; j++) { cerca[j * W + i] = s / (2 * RAD + 1); s += tmp[Math.min(H - 1, j + RAD + 1) * W + i] - tmp[Math.max(0, j - RAD) * W + i]; } }
    }
    for (let n = 0; n < N; n++) agua[n * 4 + 2] = 255 * cerca[n]; }
  // la textura va con el norte arriba, igual que el mapa (v = 1 − y)
  const aguaV = new Uint8Array(N * 4); for (let j = 0; j < H; j++) aguaV.set(agua.subarray(j * W * 4, (j + 1) * W * 4), (H - 1 - j) * W * 4);
  const texAgua = new THREE.DataTexture(aguaV, W, H, THREE.RGBAFormat); texAgua.magFilter = THREE.LinearFilter; texAgua.minFilter = THREE.LinearMipmapLinearFilter; texAgua.generateMipmaps = true; texAgua.needsUpdate = true;
  const esMar = (xm, zm) => { const x = (xm + ANCHO / 2) / U, y = (zm + ALTO / 2) / U, i = Math.min(W - 1, Math.max(0, Math.round(x / k))), j = Math.min(H - 1, Math.max(0, Math.round(y / k))); return agua[(j * W + i) * 4] > 150; };

  // Altura en cualquier punto (interpolación bilineal). x, y en unidades del mapa.
  function alturaMapa(x, y) {
    const fx = Math.min(W - 1.001, Math.max(0, x / k)), fy = Math.min(H - 1.001, Math.max(0, y / k)), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, n = j * W + i;
    return (h[n] * (1 - u) + h[n + 1] * u) * (1 - v) + (h[n + W] * (1 - u) + h[n + W + 1] * u) * v;
  }
  const altura = (xm, zm) => alturaMapa((xm + ANCHO / 2) / U, (zm + ALTO / 2) / U);        // en coordenadas del mundo
  function maxEnCaja(x0, y0, x1, y1) { let m = -1; ventana(x0, y0, x1, y1, (n) => { if (h[n] > m) m = h[n]; }); return m; }

  // Malla: rejilla desplazada (las normales salen del mapa de normales, más fino que la malla).
  const segY = Math.round(segX * ALTO / ANCHO), nx = segX + 1, ny = segY + 1;
  const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), nor = new Float32Array(nx * ny * 3), idx = new Uint32Array(segX * segY * 6);
  for (let j = 0, n = 0; j < ny; j++) for (let i = 0; i < nx; i++, n++) {
    const u = i / segX, v = j / segY;
    pos[n * 3] = (u - 0.5) * ANCHO; pos[n * 3 + 1] = alturaMapa(u * AW, v * AH); pos[n * 3 + 2] = (v - 0.5) * ALTO;
    uv[n * 2] = u; uv[n * 2 + 1] = 1 - v; nor[n * 3 + 1] = 1;
  }
  for (let j = 0, q = 0; j < segY; j++) for (let i = 0; i < segX; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geometria.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometria.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geometria.setIndex(new THREE.BufferAttribute(idx, 1)); geometria.computeBoundingSphere(); geometria.computeBoundingBox();

  // Mapa de normales en espacio tangente (u = este, v = norte).
  const dat = g2.createImageData(W, H), d = dat.data, celda = k * U;
  for (let j = 0, n = 0; j < H; j++) for (let i = 0; i < W; i++, n++) {
    const dxh = (h[j * W + Math.min(W - 1, i + 1)] - h[j * W + Math.max(0, i - 1)]) / (2 * celda), dzh = (h[Math.min(H - 1, j + 1) * W + i] - h[Math.max(0, j - 1) * W + i]) / (2 * celda);
    const l = 1 / Math.hypot(dxh, dzh, 1);
    d[n * 4] = (-dxh * l * 0.5 + 0.5) * 255; d[n * 4 + 1] = (dzh * l * 0.5 + 0.5) * 255; d[n * 4 + 2] = (l * 0.5 + 0.5) * 255; d[n * 4 + 3] = 255;
  }
  g2.putImageData(dat, 0, 0);
  const texNormal = new THREE.CanvasTexture(cv); texNormal.colorSpace = THREE.NoColorSpace; texNormal.anisotropy = 4;
  return { geometria, texNormal, texAgua, altura, alturaMapa, maxEnCaja, esMar };
}
