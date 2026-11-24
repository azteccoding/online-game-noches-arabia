// Dhows: un velero pequeño de vela latina por cada ruta de mar. Espera fondeado frente a la costa donde la ruta entra al agua,
// lleva a la figura siguiendo el trazo de la ruta (con cabeceo, balanceo, estela y espuma) y se queda fondeado donde llega.
// Si está en la otra orilla cuando alguien lo necesita, cruza a recogerlo.
import * as THREE from 'three';
import { NIVEL_MAR } from './relieve.js';
import { crearModeloPintado, texturaPintada } from './animalPintado.js';
import hojaDhow from './datos/animal-dhow.json';
import cenitalDhow from './datos/dhow-cenital.json';
import popaDhow from './datos/dhow-popa.json';
import rotulosMapa from './datos/rotulos.json';
import { U, ANCHO, ALTO } from './medidas.js';

const LARGO = 1.7;      // eslora de referencia (estela y espuma)
const ESPERA_MAX = 2;   // hasta dónde puede alejarse de la orilla el lugar donde el barco espera quieto, para no tapar un nombre
// Jorge (23 de noviembre): el barco del Mar Rojo, en la orilla de Yemen, espera afuera, en el golfo frente al Cuerno de África,
// justo debajo del nombre de Yemen (en unidades del mapa). Todos esperan paralelos a la costa más cercana.
const ESPERA_FIJA = { 'Yemen|El Cairo': [[1850, 1705], null] };

// Dhow pintado (Jorge, 23 de noviembre): se levanta de su hoja de vistas como los animales (ver animalPintado.js). La hoja lo
// trae «sacado del agua»; aquí se hunde hasta la línea de flotación. Mide de punta a punta lo mismo que el de antes, con la proa a +Z.
const ESLORA_PINTADO = 1.95, CALADO = 0.09, CUBIERTA = 0.205;      // calado y cubierta: fracción de la altura de la hoja (de la quilla hacia arriba)
// Vista desde arriba (Jorge, 24 de noviembre: hoja cenital de ChatGPT, preparada con herramientas/preparar-dhow-cenital.py). El
// modelo de dos cáscaras sale de la vista de perfil y desde arriba se veía como una mancha partida en dos. Ahora lleva una
// cubierta pintada (el casco visto desde arriba) y, cuando la cámara mira casi a plomo (vista de pájaro), las cáscaras se
// esconden y se ve la pintura cenital completa, con su vela.
const A_PLOMO = 0.86;      // |dirección de la cámara · vertical| a partir del cual se usa la pintura cenital (unos 60° de picado)
const texCenital = {};
function texturaCenital(nombre) {
  return (texCenital[nombre] ||= (() => { const t = new THREE.TextureLoader().load((import.meta.env?.BASE_URL || '/') + `arte3d/dhow-${nombre}.webp`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })());
}
function planoCenital(nombre, y) {      // horizontal, con la proa (izquierda de la pintura) hacia +Z y el borde de abajo de la pintura hacia +X
  const d = cenitalDhow[nombre], L = ESLORA_PINTADO, zProa = L / 2, xAbajo = (cenitalDhow.cubierta.ancho * L) / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([xAbajo - d.ancho * L, y, zProa, xAbajo, y, zProa, xAbajo - d.ancho * L, y, zProa - d.largo * L, xAbajo, y, zProa - d.largo * L], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 1, 1, 0], 2)); g.setIndex([0, 1, 2, 2, 1, 3]); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texturaCenital(nombre), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 }));
}
// Visto desde atrás (Jorge, 24 de noviembre: hoja de la popa a ras de piso, preparada con herramientas/preparar-dhow-popa.py). Las dos
// cáscaras del perfil se juntan en el contorno, así que la popa acababa en punta, con una rendija, y la vela se veía de canto. Ahora:
//  · de la galería hacia atrás las cáscaras se abren hasta la media manga que pinta la hoja a cada altura (toldo, baranda y casco), y
//  · el hueco lo cierra el espejo de popa: la pintura de la popa de frente, colgada del borde trasero del perfil (solo se ve desde atrás);
//  · el toldo es una caja: sus dos costados (los del perfil), el fondo (el espejo), un frente y el techo (el tapete de la pintura
//    cenital). Cada pared se pinta SOLO por fuera: así nunca se ve la pared de enfrente a través de la de acá, que era lo que hacía
//    que el toldo y los sacos salieran dobles (Jorge, 24 de noviembre: «sale doble»; y con el toldo plano al centro, como antes, de
//    tres cuartos «no tienen el techito ni los sacos blancos»);
//  · el palo y la vela vistos desde atrás van en un plano atravesado en el palo, que se abre cuando la cámara mira a lo largo del
//    barco (por la popa o por la proa) y se cierra hasta desaparecer cuando lo ve de lado, donde manda la vela del perfil.
const POPA = { toldo: 425, frente: 468, galeria: 522, quilla: 660, desde: 455, hasta: 500, baranda: 555, borde: 618, palo: 318 };      // filas y columnas de la vista de perfil (píxeles de animal-dhow)
// el techo del toldo: fila del perfil donde va y el recorte del tapete en dhow-cubierta.webp (563 × 205: columnas 436 a 516, filas 11 a
// 127) como [u de proa, u de popa, v de estribor (arriba de la pintura), v de babor]
const TECHO = { fila: 441, uv: [436 / 563, 516 / 563, 1 - 11 / 205, 1 - 127 / 205] };
const escalon = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function texturaPopa(nombre) { return texturaCenital(nombre); }
function abrirPopa(M, alto) {
  const { tw, th, gx, gy, paso: P } = hojaDhow, k = alto / th, cx = tw / 2, d = popaDhow.popa;
  const esc = (POPA.quilla - POPA.toldo) / d.alto, mangaMax = Math.max(...d.semi) * esc * k, relMax = hojaDhow.zmax * k, ajuste = relMax / mangaMax;      // la popa pintada, a la manga del modelo
  const semi = (fila) => { const f = Math.min(d.semi.length - 1, Math.max(0, (fila - POPA.toldo) / esc / 4)), i = Math.floor(f), j = Math.min(d.semi.length - 1, i + 1); return (d.semi[i] + (d.semi[j] - d.semi[i]) * (f - i)) * esc * k * ajuste; };
  // las cáscaras: de la galería hacia atrás, a la media manga de la pintura. Bajo la cubierta, el casco se abre poco a poco; de la
  // cubierta para arriba (toldo, postes, baranda y farol), de golpe en el frente del toldo: son los costados de la caja.
  const A = M.geo.attributes.position, xToldo = semi(POPA.toldo), caja = new Uint8Array(A.count);
  for (let v = 0; v < A.count; v++) {
    const x = A.getX(v), fila = th - A.getY(v) / k, col = cx - A.getZ(v) / k;
    if (fila < POPA.toldo - 4 || col < POPA.desde) continue;
    const tCaja = escalon(POPA.frente - 4, POPA.frente + 2, col); let t, m;
    if (fila < POPA.galeria) { if (col < POPA.frente - 4) continue; caja[v] = 1; t = tCaja; m = xToldo + (semi(fila) - xToldo) * escalon(495, 515, fila); }
    else { t = tCaja + (escalon(POPA.desde, POPA.hasta, col) - tCaja) * escalon(POPA.galeria, POPA.galeria + 30, fila); m = Math.max(Math.abs(x), semi(fila)); }
    A.setX(v, Math.sign(x || 1) * (Math.abs(x) + (m - Math.abs(x)) * t));
  }
  A.needsUpdate = true; M.geo.computeVertexNormals(); M.geo.computeBoundingSphere(); M.geo.boundingSphere.radius *= 1.2;
  // los costados de la caja, aparte y pintados solo por fuera (las caras de las cáscaras miran hacia dentro: de ahí BackSide)
  const I = M.geo.index.array, resto = [], costados = [];
  for (let n = 0; n < I.length; n += 3) (caja[I[n]] && caja[I[n + 1]] && caja[I[n + 2]] ? costados : resto).push(I[n], I[n + 1], I[n + 2]);
  M.geo.setIndex(resto.concat(costados)); M.geo.clearGroups(); M.geo.addGroup(0, resto.length, 0); M.geo.addGroup(resto.length, costados.length, 1);
  const matCaja = M.material.clone(); matCaja.side = THREE.BackSide; M.malla.material = [M.material, matCaja];
  // el borde trasero del perfil en cada fila: la galería cae a plomo y de ahí el casco se recoge hacia la quilla
  const bits = Uint8Array.from(atob(hojaDhow.cubre), (c) => c.charCodeAt(0)), cubre = (i, j) => { const n = j * (gx - 1) + i; return (bits[n >> 3] >> (7 - (n & 7))) & 1; };
  const borde = (fila) => {
    if (fila <= POPA.baranda) return POPA.borde;
    const j = Math.min(gy - 2, Math.round(fila / P)); let i = gx - 2; while (i > 0 && !cubre(i, j)) i--;
    return Math.min(POPA.borde, (i + 1) * P);
  };
  const filas = []; for (let f = POPA.toldo; f < POPA.quilla; f += 5) filas.push(f); filas.push(POPA.quilla);
  const cols = filas.map(borde); for (let i = 1; i < cols.length; i++) cols[i] = Math.min(cols[i], cols[i - 1]);      // hacia abajo nunca vuelve a salir
  const aMundo = esc * k * ajuste, matPopa = () => new THREE.MeshStandardMaterial({ map: texturaPopa('popa'), alphaTest: 0.5, side: THREE.FrontSide, roughness: 0.72, metalness: 0, envMapIntensity: 0.5 });
  // un tramo del espejo, entre dos filas del perfil: media = media manga que se usa de la pintura (en sus píxeles; sin ella, toda);
  // col = columna del perfil donde va (sin ella, el borde trasero); alFrente = mirando a proa (se ve desde delante)
  const tramo = (desde, hasta, { media = null, col = null, alFrente = false } = {}) => {
    const pos = [], uv = [], idx = [], pxI = media == null ? 0 : d.eje - media, pxD = media == null ? d.ancho : d.eje + media; let n = 0;      // la izquierda de la pintura, a babor visto desde atrás (+X)
    filas.forEach((f, i) => {
      if (f < desde || f > hasta) return;
      const y = (th - f) * k, z = (cx - (col ?? cols[i] - 1.5)) * k, vv = 1 - (f - POPA.toldo) / (POPA.quilla - POPA.toldo);
      pos.push((d.eje - pxI) * aMundo, y, z, (d.eje - pxD) * aMundo, y, z); uv.push(pxI / d.ancho, vv, pxD / d.ancho, vv);
      if (n) { const a = (n - 1) * 2; if (alFrente) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } n++;
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return new THREE.Mesh(g, matPopa());
  };
  // el espejo (casco y galería, a todo lo ancho) y, de la cubierta para arriba, el fondo y el frente de la caja del toldo (sin los
  // faroles de la pintura: el farol ya cuelga de cada costado)
  const mediaToldo = d.semi[0], espejo = tramo(POPA.galeria, POPA.quilla), fondo = tramo(POPA.toldo, POPA.galeria, { media: mediaToldo }), frente = tramo(POPA.toldo, POPA.galeria, { media: mediaToldo, col: POPA.frente, alFrente: true });
  const yt = (th - TECHO.fila) * k, zt0 = (cx - POPA.frente) * k, zt1 = (cx - POPA.borde) * k, [u0, u1, v0, v1] = TECHO.uv;
  const gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.Float32BufferAttribute([-xToldo, yt, zt0, xToldo, yt, zt0, -xToldo, yt, zt1, xToldo, yt, zt1], 3));
  gt.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u0, v1, u1, v0, u1, v1], 2)); gt.setIndex([0, 1, 2, 2, 1, 3]); gt.computeVertexNormals();
  const techo = new THREE.Mesh(gt, new THREE.MeshStandardMaterial({ map: texturaCenital('cubierta'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, envMapIntensity: 0.5 }));
  // la vela vista desde atrás: de la punta del toldo hacia arriba, atravesada en el palo
  const w = popaDhow.vela, yv = (th - POPA.toldo) * k, hv = w.alto * esc * k, x0 = w.eje * esc * k * ajuste, x1 = (w.eje - w.ancho) * esc * k * ajuste;
  const gv = new THREE.BufferGeometry(); gv.setAttribute('position', new THREE.Float32BufferAttribute([x0, yv + hv, 0, x1, yv + hv, 0, x0, yv, 0, x1, yv, 0], 3));
  gv.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2)); gv.setIndex([0, 2, 1, 1, 2, 3]); gv.computeVertexNormals();
  const vela = new THREE.Mesh(gv, new THREE.MeshStandardMaterial({ map: texturaPopa('popa-vela'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0, envMapIntensity: 0.5 }));
  vela.position.z = (cx - POPA.palo) * k;
  return { vela, piezas: [espejo, fondo, frente, techo], materiales: [M.material, matCaja, espejo.material, fondo.material, frente.material, techo.material] };
}
const A_LO_LARGO = [0.95, 0.992];      // |cámara · quilla| (en planta): de aquí a aquí se abre la vela vista desde atrás (de unos 18° a unos 7° de la quilla; más abierto, la vela del perfil ya se ve tan ancha como ella y se verían dos palos)

export function crearDhowPintado() {
  const alto = (ESLORA_PINTADO * hojaDhow.th) / hojaDhow.tw;
  const M = crearModeloPintado(hojaDhow, texturaPintada('dhow'), { alto, centroX: hojaDhow.tw / 2, material: { roughness: 0.72 } });
  const grupo = new THREE.Group(), casco = new THREE.Group(); casco.position.y = -CALADO * alto; grupo.add(casco);
  const popa = abrirPopa(M, alto); casco.add(M.malla, ...popa.piezas, popa.vela);
  const yCubierta = (CUBIERTA - CALADO) * alto, cubierta = planoCenital('cubierta', yCubierta - 0.004), cenital = planoCenital('cenital', yCubierta + 0.012);
  cubierta.receiveShadow = true; grupo.add(cubierta, cenital);
  const dir = new THREE.Vector3(), giro = new THREE.Quaternion();
  cubierta.onBeforeRender = (r, e, camara) => {      // a plomo: fuera las cáscaras (con alphaTest, una opacidad menor que el umbral no pinta nada) y dentro la pintura cenital
    const plomo = Math.abs(camara.getWorldDirection(dir).y) > A_PLOMO;
    for (const m of popa.materiales) m.opacity = plomo ? 0.3 : 1;
    cenital.material.opacity = plomo ? 1 : 0.3;
    dir.applyQuaternion(grupo.getWorldQuaternion(giro).invert());      // la mirada de la cámara, en los ejes del barco
    const abre = plomo ? 0 : escalon(A_LO_LARGO[0], A_LO_LARGO[1], Math.abs(dir.z) / (Math.hypot(dir.x, dir.z) || 1));
    popa.vela.visible = abre > 0.02; popa.vela.scale.x = Math.max(0.02, abre);
  };
  cenital.material.opacity = 0.3; popa.vela.visible = false;
  return { grupo, vela: new THREE.Object3D(), yCubierta, zPasajero: -0.12 * ESLORA_PINTADO };
}

// Jorge (23 de noviembre): que el barco no parezca navegar sobre tierra. El trazo de agua de cada ruta se rehace buscando, en una
// rejilla sobre el mar, el camino más barato entre los dos puntos donde la ruta entra al agua: cada celda cuesta más cuanto más
// cerca está de la costa (hasta COSTA_LEJOS) y cuanto más se aparta del trazo dibujado, así que rodea cabos e islas por el agua,
// se mantiene lejos de la orilla y sigue, en lo que puede, la ruta del mapa. Luego se suaviza sin dejar el mar.
const CELDA = 0.05, COSTA_LEJOS = 0.5, PESO_COSTA = 10, PESO_RUTA = 0.03, MARGEN_REJILLA = 1.5;
function distancias(n, ancho, semillas, paso) {      // distancia en celdas (8 vecinos) desde las semillas; paso(i) dice si se puede pasar
  const d = new Float32Array(n).fill(Infinity), cola = [];
  for (const i of semillas) { d[i] = 0; cola.push(i); }
  for (let k = 0; k < cola.length; k++) {
    const i = cola[k], x = i % ancho;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, j = i + dy * ancho + dx;
      if (xx < 0 || xx >= ancho || j < 0 || j >= n || !paso(j)) continue;
      const nd = d[i] + (dx && dy ? 1.4142 : 1); if (nd < d[j] - 1e-3) { d[j] = nd; cola.push(j); }
    }
  }
  return d;
}
function trazoPorAgua(P, esMar) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of P) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
  x0 -= MARGEN_REJILLA; z0 -= MARGEN_REJILLA; x1 += MARGEN_REJILLA; z1 += MARGEN_REJILLA;
  const W = Math.ceil((x1 - x0) / CELDA) + 1, H = Math.ceil((z1 - z0) / CELDA) + 1, n = W * H;
  const celda = (p) => Math.min(H - 1, Math.max(0, Math.round((p.z - z0) / CELDA))) * W + Math.min(W - 1, Math.max(0, Math.round((p.x - x0) / CELDA)));
  const mar = new Uint8Array(n); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) mar[j * W + i] = esMar(x0 + i * CELDA, z0 + j * CELDA) ? 1 : 0;
  const ini = celda(P[0]), fin = celda(P[P.length - 1]); mar[ini] = mar[fin] = 1;
  const tierra = []; for (let i = 0; i < n; i++) if (!mar[i]) tierra.push(i);
  const dCosta = distancias(n, W, tierra, (j) => mar[j]), dRuta = distancias(n, W, P.map(celda), () => true);
  const lejos = COSTA_LEJOS / CELDA, coste = (j) => { const c = Math.max(0, 1 - dCosta[j] / lejos); return 1 + PESO_COSTA * c * c + PESO_RUTA * dRuta[j]; };
  // Dijkstra con montículo binario
  const g = new Float64Array(n).fill(Infinity), de = new Int32Array(n).fill(-1), heap = [], hv = [];
  const meter = (i, v) => { heap.push(i); hv.push(v); let k = heap.length - 1; while (k) { const m = (k - 1) >> 1; if (hv[m] <= hv[k]) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [hv[m], hv[k]] = [hv[k], hv[m]]; k = m; } };
  const sacar = () => { const i = heap[0], ui = heap.pop(), uv = hv.pop(); if (heap.length) { heap[0] = ui; hv[0] = uv; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let m = k; if (a < heap.length && hv[a] < hv[m]) m = a; if (b < heap.length && hv[b] < hv[m]) m = b; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [hv[m], hv[k]] = [hv[k], hv[m]]; k = m; } } return i; };
  g[ini] = 0; meter(ini, 0);
  while (heap.length) {
    const v = hv[0], i = sacar(); if (v > g[i]) continue; if (i === fin) break;
    const x = i % W;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, j = i + dy * W + dx;
      if (xx < 0 || xx >= W || j < 0 || j >= n || !mar[j]) continue;
      const nv = g[i] + (dx && dy ? 1.4142 : 1) * coste(j); if (nv < g[j]) { g[j] = nv; de[j] = i; meter(j, nv); }
    }
  }
  if (de[fin] < 0) return P.map((p) => new THREE.Vector3(p.x, NIVEL_MAR, p.z));      // sin camino por agua: el trazo de siempre
  const camino = []; for (let i = fin; i >= 0; i = de[i]) { camino.push(new THREE.Vector3(x0 + (i % W) * CELDA, NIVEL_MAR, z0 + Math.floor(i / W) * CELDA)); if (i === ini) break; }
  // holgura: distancia a la costa que deja el trazo en sus tramos más estrechos (cuartil bajo), en unidades del mundo
  const h = []; for (let i = fin; i >= 0; i = de[i]) { h.push(dCosta[i] * CELDA); if (i === ini) break; } h.sort((a, b) => a - b);
  camino.reverse(); camino.holgura = h[Math.floor(h.length * 0.25)] ?? 1; camino[0].set(P[0].x, NIVEL_MAR, P[0].z); camino[camino.length - 1].set(P[P.length - 1].x, NIVEL_MAR, P[P.length - 1].z);
  for (let vuelta = 0; vuelta < 12; vuelta++) for (let i = 2; i < camino.length - 2; i++) {      // suavizar (sin pisar tierra)
    let x = 0, z = 0; for (let k = -2; k <= 2; k++) { x += camino[i + k].x; z += camino[i + k].z; }
    x /= 5; z /= 5; if (esMar(x, z)) camino[i].set(x, NIVEL_MAR, z);
  }
  return camino;
}
// Y que fondeado no tape ningún nombre ni dibujo: rótulos y dibujos del mapa (datos/rotulos.json, cuatro esquinas cada uno, ver
// herramientas/rotulos-mapa.cjs), nombres de las ciudades y las propias ciudades, en coordenadas del mundo.
const MARGEN_ROTULO = 0.1;
const LADOS = [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.5, -0.5, 0.75, -0.75, 1, -1, 1.25, -1.25, 1.5, -1.5];      // cuánto puede apartarse del trazo para esperar
function zona(esquinas) {      // esquinas en unidades del mapa
  const p = esquinas.map(([x, y]) => [x * U - ANCHO / 2, y * U - ALTO / 2]), xs = p.map((q) => q[0]), zs = p.map((q) => q[1]);
  return { p, x0: Math.min(...xs) - MARGEN_ROTULO, x1: Math.max(...xs) + MARGEN_ROTULO, z0: Math.min(...zs) - MARGEN_ROTULO, z1: Math.max(...zs) + MARGEN_ROTULO };
}
const rect = (x0, y0, x1, y1) => zona([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
function dentro(k, x, z) {      // dentro del cuadrilátero o a menos de MARGEN_ROTULO de su borde
  if (x < k.x0 || x > k.x1 || z < k.z0 || z > k.z1) return false;
  let signo = 0, cerca = Infinity;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = k.p[i], [bx, bz] = k.p[(i + 1) % 4], ex = bx - ax, ez = bz - az, c = ex * (z - az) - ez * (x - ax);
    signo |= c > 0 ? 1 : c < 0 ? 2 : 0;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
    cerca = Math.min(cerca, Math.hypot(ax + ex * t - x, az + ez * t - z));
  }
  return signo !== 3 || cerca < MARGEN_ROTULO;
}
function zonasQueNoSeTapan(tablero) {
  const zonas = rotulosMapa.map(zona);
  for (const c of tablero.obstaculos?.cajas || []) zonas.push(rect(c.x0, c.y0, c.x1, c.y1));
  for (const c of tablero.obstaculos?.ciudades || []) zonas.push(rect(c.x - 45, c.y - 55, c.x + 45, c.y + 35));
  return zonas;
}

// tablero: el de crearTablero (rutas con sus puntos y relieve.esMar)
export function crearFlota({ escena, tablero, mats, efectos, sonido }) {
  const barcos = new Map(), esMar = tablero.relieve.esMar, zonas = zonasQueNoSeTapan(tablero), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  for (const r of tablero.rutas) {
    if (r.modo !== 'mar') continue;
    const P = r.puntos; let i0 = P.findIndex((p) => esMar(p.x, p.z)), i1 = P.length - 1 - P.slice().reverse().findIndex((p) => esMar(p.x, p.z));
    if (i0 < 0 || i1 - i0 < 6) continue;
    const agua = trazoPorAgua(P.slice(i0, i1 + 1), esMar), lon = [0];
    for (let i = 1; i < agua.length; i++) lon.push(lon[i - 1] + agua[i].distanceTo(agua[i - 1]));
    const largo = lon[lon.length - 1], fondeo = Math.min(0.85, largo * 0.27), m = crearDhowPintado();
    // en mares estrechos (el Mar Rojo, el Golfo Pérsico) el barco es algo más chico para que no se monte en las dos orillas
    const esc = Math.min(1, Math.max(0.62, largo / 3.4), Math.max(0.62, (agua.holgura ?? 1) / 0.45)); m.grupo.scale.setScalar(esc);
    escena.add(m.grupo);
    const b = { clave: r.a + '|' + r.b, ruta: r, i0, i1, agua, lon, largo, s: fondeo, sFondeo: [fondeo, largo - fondeo], extremo: 0, estado: 'fondeado', sentido: 1, vel: 0, meta: fondeo, reservado: null, cola: [], rumbo: 0, fase: Math.random() * 6, modelo: m, esc,
      estelas: [efectos.crearEstela(0xbfe0da, 46, 1.7), efectos.crearEstela(0xbfe0da, 46, 1.7)], tEspuma: 0, tOla: 0 };
    // sFondeo: donde atraca para que la figura suba o baje (cerca de la orilla). sEspera: donde se queda quieto sin pasajero.
    // desvio: cuánto se aparta del trazo hacia b.aparte (0 navegando o atracado, 1 esperando)
    const fija = ESPERA_FIJA[b.clave] || [], espera = [0, 1].map((e) => (fija[e] ? esperaFija(b, e, e ? largo - fondeo : fondeo, fija[e]) : esperaLibre(b, e, e ? largo - fondeo : fondeo)));
    b.sEspera = espera.map((e) => e.s); b.aparteDe = espera.map((e) => new THREE.Vector3(e.x, 0, e.z)); b.rumboEspera = espera.map((e) => e.rumbo);
    b.s = b.sEspera[0]; b.meta = b.s; b.atracado = false; b.aparte = b.aparteDe[0].clone(); b.desvio = 1;
    barcos.set(b.clave, b); barcos.set(r.b + '|' + r.a, b);
    situar(b, 0, 0); b.rumbo = b.rumboMeta; situar(b, 0, 0);
  }
  // Dónde espera quieto en cada orilla: el primer punto, desde el atracadero y alejándose de la costa (sin pasar de ESPERA_MAX ni de
  // la mitad de la ruta), donde el casco y la vela no tocan ninguna caja de rótulo ni de ciudad, ni tierra. Puede apartarse un poco a un
  // lado del trazo (hasta 1.5, por agua). Si ninguno queda libre, el que menos tapa.
  // Un punto dado del mapa: el barco atraca en s0 y se aparta hasta el sitio libre más cercano a ese punto.
  function esperaFija(b, extremo, s0, [mx, my]) {
    const p = puntoEn(b, s0, v1).clone(), cx = mx * U - ANCHO / 2, cz = my * U - ALTO / 2;
    let mejor = null, menos = Infinity;
    for (let r = 0; r <= 1.2 && menos > 0; r += 0.1) for (let k = 0; k < (r ? 16 : 1); k++) {
      const x = cx + r * Math.cos((k * Math.PI) / 8), z = cz + r * Math.sin((k * Math.PI) / 8), ru = rumboCosta(x, z, 1.2);
      const c = tapa(b, x, z, Math.sin(ru), Math.cos(ru)) + r;
      if (c < menos) { menos = c; mejor = { s: s0, x: x - p.x, z: z - p.z, rumbo: ru }; }
    }
    return mejor;
  }
  // Rumbo paralelo a la costa más cercana a (x, z) (de los dos sentidos, el más cercano a ref). Sin costa cerca, ref.
  function rumboCosta(x, z, ref) {
    for (let r = 0.05; r <= 2; r += 0.05) {
      let sx = 0, sz = 0;
      for (let k = 0; k < 32; k++) { const dx = Math.cos((k * Math.PI) / 16), dz = Math.sin((k * Math.PI) / 16); if (!esMar(x + dx * r, z + dz * r)) { sx += dx; sz += dz; } }
      if (sx || sz) {
        const a = Math.atan2(-sz, sx), d = (u) => Math.abs(Math.atan2(Math.sin(u - ref), Math.cos(u - ref)));      // (−sz, sx): paralelo a la costa
        return d(a) <= d(a + Math.PI) ? a : a + Math.PI;
      }
    }
    return ref;
  }
  function esperaLibre(b, extremo, s0) {
    const lado = extremo ? -1 : 1, tope = Math.min(ESPERA_MAX, b.largo * 0.45), d0 = extremo ? b.largo - s0 : s0;
    let mejor = { s: s0, x: 0, z: 0 }, menos = Infinity;
    busca: for (let d = d0; d <= Math.max(tope, d0) + 1e-6; d += 0.06) {
      const s = extremo ? b.largo - d : d, p = puntoEn(b, s, v1), q = puntoEn(b, s + 0.25 * lado, v2);
      let tx = q.x - p.x, tz = q.z - p.z; const n = Math.hypot(tx, tz) || 1; tx /= n; tz /= n;
      for (const a of LADOS) {
        const ox = -tz * a, oz = tx * a;
        let paso = true; for (let k = 1; k <= 6 && a; k++) if (!esMar(p.x + (ox * k) / 6, p.z + (oz * k) / 6)) { paso = false; break; }
        if (!paso) continue;
        const ru = rumboCosta(p.x + ox, p.z + oz, Math.atan2(tx * lado, tz * lado)), c = tapa(b, p.x + ox, p.z + oz, Math.sin(ru), Math.cos(ru));
        if (c === 0) { mejor = { s, x: ox, z: oz, rumbo: ru }; break busca; }
        const v = c + 0.1 * Math.abs(a) + 0.05 * (d - d0);      // si nada queda libre: lo que menos tape, sin irse lejos
        if (v < menos) { menos = v; mejor = { s, x: ox, z: oz, rumbo: ru }; }
      }
    }
    return mejor;
  }
  // cuánto tapa el barco puesto en (x, z) con la proa hacia (tx, tz): muestras del casco en tierra o sobre un rótulo
  function tapa(b, x0, z0, tx, tz) {
    const L = ESLORA_PINTADO * b.esc, en = (u, w, dz = 0) => [x0 + tx * u * L - tz * w * L, z0 + tz * u * L + tx * w * L - dz * L];
    let c = 0;
    for (let u = -0.5; u <= 0.501; u += 0.125) for (const w of [-0.14, -0.07, 0, 0.07, 0.14]) {
      const [x, z] = en(u, w);
      if (Math.abs(w) < 0.1 && !esMar(x, z)) c += 1.5;      // el casco en tierra se ve peor que rozar un rótulo
      if (zonas.some((k) => dentro(k, x, z))) c += 1;
    }
    for (let u = -0.5; u <= 0.501; u += 0.25) for (const w of [-0.17, 0.17]) { const [x, z] = en(u, w); if (!esMar(x, z)) c += 0.3; }      // y un poco de agua alrededor
    // la vela, vista desde la cámara (que mira hacia el norte), sube un poco por encima del casco en la pantalla
    for (const u of [-0.25, 0, 0.25]) for (const dz of [0.1, 0.2, 0.3, 0.4]) { const [x, z] = en(u, 0, dz); if (zonas.some((k) => dentro(k, x, z))) c += 1; }
    return c;
  }
  function puntoEn(b, s, out) {
    s = Math.min(b.largo, Math.max(0, s)); let i = 1; while (i < b.lon.length - 1 && b.lon[i] < s) i++;
    const u = (s - b.lon[i - 1]) / Math.max(1e-6, b.lon[i] - b.lon[i - 1]); return out.copy(b.agua[i - 1]).lerp(b.agua[i], u);
  }
  function situar(b, t, dt) {
    const p = puntoEn(b, b.s, v1), q = puntoEn(b, b.s + 0.25 * b.sentido, v2);
    if (q.distanceToSquared(p) > 1e-6) b.rumboMeta = Math.atan2(q.x - p.x, q.z - p.z);
    if (b.estado === 'fondeado' && !b.atracado && b.rumboEspera?.[b.extremo] != null) b.rumboMeta = b.rumboEspera[b.extremo];      // esperando: paralelo a la costa
    let dif = (b.rumboMeta ?? 0) - b.rumbo; dif = Math.atan2(Math.sin(dif), Math.cos(dif)); b.rumbo += dif * (dt ? 1 - Math.exp(-dt * 3.2) : 0);
    const g = b.modelo.grupo, marcha = Math.min(1, Math.abs(b.vel) / 2.2);
    const meta = b.estado === 'fondeado' && !b.atracado ? 1 : 0;
    if (meta && b.desvio < 0.01) b.aparte.copy(b.aparteDe[b.extremo]);
    b.desvio += (meta - b.desvio) * (dt ? 1 - Math.exp(-dt * 1.6) : 0); if (Math.abs(meta - b.desvio) < 0.005) b.desvio = meta;
    g.position.set(p.x + b.aparte.x * b.desvio, NIVEL_MAR + 0.012 * Math.sin(t * 1.9 + b.fase) - 0.01, p.z + b.aparte.z * b.desvio);
    g.rotation.set(0.035 * Math.sin(t * 1.6 + b.fase) + 0.05 * marcha * Math.sin(t * 3.1 + b.fase), b.rumbo, 0.05 * Math.sin(t * 1.15 + b.fase * 2) + 0.06 * marcha, 'YXZ');
    b.modelo.vela.scale.x = 0.55 + 0.45 * marcha + 0.04 * Math.sin(t * 2.3 + b.fase);
  }
  const de = (a, b) => barcos.get(a + '|' + b) || null;
  // extremo: 0 si la figura sale de la ciudad «a» de la ruta, 1 si sale de «b»
  const extremoDe = (b, desde) => (b.ruta.a === desde ? 0 : 1);

  // La figura pide el barco en su orilla. Devuelve true cuando está fondeado ahí y reservado para ella.
  function pedir(b, extremo, quien) {
    if (b.reservado && b.reservado !== quien) { if (!b.cola.includes(quien)) b.cola.push(quien); return false; }
    if (!b.reservado) { if (b.cola.length && b.cola[0] !== quien) { if (!b.cola.includes(quien)) b.cola.push(quien); return false; } b.cola.shift(); b.reservado = quien; }
    if (b.estado === 'fondeado' && b.atracado && b.extremo === extremo) return b.desvio === 0;
    if (b.estado === 'fondeado') ir(b, 'viniendo', extremo, b.sFondeo[extremo]);
    return false;
  }
  function zarpar(b, quien) {
    if (b.reservado !== quien || b.estado !== 'fondeado') return false;
    const destino = 1 - b.extremo; ir(b, 'llevando', destino, b.sFondeo[destino]);
    sonido?.tocar('barco-zarpar'); if (!b.sonando) { b.sonando = true; sonido?.bucle('barco-navegar', true); }
    efectos.onda(v1.copy(b.modelo.grupo.position).setY(NIVEL_MAR), 1.6, 0xdff2ee);
    return true;
  }
  function ir(b, estado, extremo, meta) { b.estado = estado; b.meta = meta; b.sentido = Math.sign(meta - b.s) || 1; b.extremoMeta = extremo; b.atracado = false; }
  const llego = (b) => b.estado === 'fondeado' && b.atracado && b.desvio === 0;
  function soltar(b, quien) { if (b.reservado === quien) b.reservado = null; b.cola = b.cola.filter((x) => x !== quien); }
  // Dónde va el pasajero (sobre cubierta) y hacia dónde mira el barco.
  function cubierta(b, out) { const g = b.modelo.grupo; g.updateMatrixWorld(); return out.set(0, b.modelo.yCubierta, b.modelo.zPasajero).applyMatrix4(g.matrixWorld); }
  // Punto de tierra donde se embarca o desembarca en cada extremo.
  function orilla(b, extremo) { const P = b.ruta.puntos; return extremo ? P[Math.min(P.length - 1, b.i1 + 1)] : P[Math.max(0, b.i0 - 1)]; }

  let sucio = false;
  function actualizar(t, dt) {
    sucio = false;
    const vistos = new Set();
    for (const b of barcos.values()) {
      if (vistos.has(b)) continue; vistos.add(b);
      // sin pasajero ni nadie esperándolo, deja el atracadero y se va a esperar donde no tapa ningún nombre
      if (b.estado === 'fondeado' && b.atracado && !b.reservado && !b.cola.length && (Math.abs(b.s - b.sEspera[b.extremo]) > 0.02 || b.aparteDe[b.extremo].lengthSq() > 0)) ir(b, 'retirando', b.extremo, b.sEspera[b.extremo]);
      if (b.estado !== 'fondeado') {
        sucio = true;
        const falta = (b.meta - b.s) * b.sentido, tope = b.estado === 'viniendo' ? 5.2 : b.estado === 'retirando' ? 1.4 : Math.min(3.4, Math.max(1.5, b.largo / 3.2));
        const velMeta = tope * Math.min(1, 0.18 + falta / 0.9);
        b.vel += (velMeta - b.vel) * (1 - Math.exp(-dt * 2.6));
        b.s += b.sentido * b.vel * dt;
        if (falta <= 0.02 || (b.meta - b.s) * b.sentido <= 0) {
          b.s = b.meta; b.vel = 0; b.extremo = b.extremoMeta; const llevaba = b.estado === 'llevando'; b.atracado = b.estado !== 'retirando'; b.estado = 'fondeado';
          if (b.sonando) { b.sonando = false; sonido?.bucle('barco-navegar', false); }
          if (llevaba) { sonido?.tocar('barco-llegar'); efectos.onda(v1.copy(b.modelo.grupo.position).setY(NIVEL_MAR), 1.4, 0xdff2ee); }
        }
        // estela en V y espuma a proa
        const g = b.modelo.grupo, sn = Math.sin(b.rumbo), cs = Math.cos(b.rumbo), L = LARGO * b.esc;
        const popa = v1.set(g.position.x - sn * L * 0.46, NIVEL_MAR + 0.012, g.position.z - cs * L * 0.46), ancho = 0.2 * b.esc * (0.5 + 0.5 * Math.min(1, b.vel / 2));
        if (b.vel > 0.25) {
          b.estelas[0].muestra(popa, v2.set(popa.x + cs * ancho, popa.y, popa.z - sn * ancho)); b.estelas[1].muestra(popa, v3.set(popa.x - cs * ancho, popa.y, popa.z + sn * ancho));
          b.tEspuma -= dt; if (b.tEspuma <= 0) { b.tEspuma = 0.09; efectos.polvo(v2.set(g.position.x + sn * L * 0.42, NIVEL_MAR, g.position.z + cs * L * 0.42), 1, 0.35, 0xf2fbf8); efectos.polvo(popa, 1, 0.3, 0xe6f4f0); }
          b.tOla -= dt; if (b.tOla <= 0) { b.tOla = 1.25; sonido?.tocar('mar-olas', 0.5 + 0.3 * Math.random()); }
        }
      }
      situar(b, t, dt); if (b.desvio > 0 && b.desvio < 1) sucio = true;
    }
  }
  function destruir() { /* las texturas pintadas se comparten */ }
  return { de, extremoDe, pedir, zarpar, llego, soltar, cubierta, orilla, actualizar, destruir, barcos, get sucio() { return sucio; } };
}
