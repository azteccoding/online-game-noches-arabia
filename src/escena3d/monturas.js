// Monturas: caballo árabe, caballo mongol, camello, burro (blanco) y alfombra mágica. Modelos estilizados, cada uno con su
// andar: galope (caballo), trote corto y rápido (mongol), ambladura (camello: las dos patas del mismo lado a la vez),
// trotecito (burro). La alfombra no tiene patas: levita, ondula, y se enrolla para guardarse.
// Todos miran hacia +Z y apoyan en y = 0. La escena no decide quién tiene qué: solo dibuja lo que se le pide.
import * as THREE from 'three';
import { lienzo, aTextura } from './texturas.js';

export const TRANSPORTES = ['burro', 'caballo', 'camello', 'caballoMongol', 'alfombra'];
export const NOMBRE_TRANSPORTE = { '': 'A pie', burro: 'Burro', caballo: 'Caballo', camello: 'Camello', caballoMongol: 'Caballo mongol', alfombra: 'Alfombra mágica' };
export const esAnimal = (t) => t === 'burro' || t === 'caballo' || t === 'camello' || t === 'caballoMongol';

// --- Animales: tallas de juguete hechas por secciones. Cada animal se describe de perfil con anillos [z, y, a, b]
// (centro del anillo, semieje a lo ancho y semieje en el plano del perfil); piel() los une en una superficie lisa.
const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
function afinar(anillos, veces = 4) {
  const out = [], n = anillos.length;
  for (let i = 0; i < n - 1; i++) {
    const A = anillos[Math.max(0, i - 1)], B = anillos[i], C = anillos[i + 1], D = anillos[Math.min(n - 1, i + 2)];
    for (let k = 0; k < veces; k++) { const t = k / veces; out.push([0, 1, 2, 3].map((q) => (q < 2 ? cr(A[q], B[q], C[q], D[q], t) : Math.max(0.004, cr(A[q], B[q], C[q], D[q], t))))); }
  }
  out.push(anillos[n - 1].slice()); return out;
}
// arco: [desde, hasta] en radianes (π/2 = arriba) para una cáscara abierta (mantas); sin arco, superficie cerrada.
function piel(anillos, { radial = 14, arco = null, holgura = 0, veces = 4 } = {}) {
  const R = afinar(anillos, veces), n = R.length, pos = [], uv = [], idx = [], cols = radial + 1;
  for (let i = 0; i < n; i++) {
    const [z, y, a, b] = R[i], P = R[Math.max(0, i - 1)], Q = R[Math.min(n - 1, i + 1)];
    let tz = Q[0] - P[0], ty = Q[1] - P[1]; const l = Math.hypot(tz, ty) || 1; tz /= l; ty /= l;
    const nz = -ty, ny = tz;      // normal «hacia arriba» en el plano del perfil
    for (let k = 0; k <= radial; k++) {
      const th = arco ? arco[0] + ((arco[1] - arco[0]) * k) / radial : -Math.PI / 2 + (2 * Math.PI * k) / radial, c = Math.cos(th), s = Math.sin(th);
      pos.push((a + holgura) * c, y + (b + holgura) * s * ny, z + (b + holgura) * s * nz); uv.push(k / radial, i / (n - 1));
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < radial; k++) { const a = i * cols + k, b = a + 1, c = a + cols, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  if (!arco) { const N = g.attributes.normal; for (let i = 0; i < n; i++) { const a = i * cols, b = a + radial, x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1; N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l); } }
  return g;
}
function texManta(c1, c2, c3) {
  const W = 128, H = 128, c = lienzo(W, H), g = c.getContext('2d');
  g.fillStyle = c1; g.fillRect(0, 0, W, H);
  g.fillStyle = c2; g.fillRect(0, 0, 14, H); g.fillRect(W - 14, 0, 14, H); g.fillRect(0, 0, W, 9); g.fillRect(0, H - 9, W, 9);
  g.fillStyle = c3; g.fillRect(18, 0, 4, H); g.fillRect(W - 22, 0, 4, H);
  for (let i = 0; i < 6; i++) { const y = 20 + i * 18; g.fillStyle = i % 2 ? c2 : c3; g.beginPath(); g.moveTo(W / 2, y - 7); g.lineTo(W / 2 + 9, y); g.lineTo(W / 2, y + 7); g.lineTo(W / 2 - 9, y); g.closePath(); g.fill(); }
  return aTextura(c, { aniso: 4 });
}

// Medidas (en unidades de mundo; una figura mide 1,16). Todos miran a +Z.
const ANIMAL = {
  // Árabe: fino, cuello arqueado, cara cóncava, cola en alto.
  caballo: {
    tronco: [[-0.385, 0.615, 0.012, 0.012], [-0.36, 0.61, 0.085, 0.09], [-0.29, 0.6, 0.122, 0.135], [-0.17, 0.585, 0.116, 0.126], [-0.03, 0.57, 0.118, 0.133], [0.1, 0.575, 0.124, 0.15], [0.21, 0.595, 0.114, 0.15], [0.29, 0.625, 0.085, 0.12], [0.33, 0.65, 0.02, 0.03]],
    pivote: [0.24, 0.66],
    cuello: [[0.19, 0.6, 0.065, 0.1], [0.27, 0.7, 0.068, 0.112], [0.33, 0.8, 0.054, 0.088], [0.385, 0.9, 0.044, 0.07], [0.43, 0.975, 0.041, 0.058], [0.478, 1.008, 0.044, 0.054], [0.535, 0.985, 0.046, 0.056], [0.59, 0.93, 0.036, 0.044], [0.635, 0.878, 0.029, 0.034], [0.662, 0.848, 0.03, 0.033], [0.676, 0.832, 0.01, 0.012]],
    crin: { de: 1, a: 5, alto: 0.05, grueso: 0.016 }, tupe: 0.03, oreja: [0.455, 1.035, 0.03, 0.07, 0.25], ojo: [0.535, 1.003, 0.041, 0.009],
    cola: { base: [-0.37, 0.67], anillos: [[0, 0, 0.018, 0.018], [-0.06, 0.055, 0.03, 0.034], [-0.14, 0.05, 0.036, 0.046], [-0.215, -0.05, 0.036, 0.05], [-0.255, -0.19, 0.03, 0.044], [-0.268, -0.32, 0.01, 0.016]] },
    patas: { zd: 0.215, zt: -0.27, x: 0.072, yd: 0.5, yt: 0.53, l1: 0.26, l2: 0.215, r: [0.05, 0.03, 0.023, 0.019], casco: 0.027 },
    capa: 0x8c4a20, crinC: 0x1a100a, cascoC: 0x15100c, calza: 0x2a1a10, hocico: 0x4a2a16, rug: 0.62,
    manta: { z0: -0.2, z1: 0.14, arco: 1.75, colores: ['#7b1e24', '#e6b866', '#22407f'] }, silla: [[-0.15, 0.725, 0.01, 0.01], [-0.125, 0.745, 0.07, 0.035], [-0.03, 0.722, 0.085, 0.022], [0.06, 0.74, 0.07, 0.03], [0.085, 0.735, 0.01, 0.01]],
    asiento: [0.745, -0.03], andar: 'galope', zancada: 1.25, vel: 1.55, sonido: 'caballo-galope' },
  // Mongol: bajo y recio, patas cortas, cabeza grande, cuello grueso, crin y cola largas y espesas.
  caballoMongol: {
    tronco: [[-0.36, 0.47, 0.012, 0.012], [-0.335, 0.465, 0.1, 0.1], [-0.26, 0.455, 0.146, 0.15], [-0.13, 0.44, 0.152, 0.156], [0, 0.43, 0.158, 0.166], [0.12, 0.44, 0.152, 0.17], [0.21, 0.46, 0.132, 0.16], [0.28, 0.49, 0.092, 0.12], [0.31, 0.51, 0.02, 0.03]],
    pivote: [0.22, 0.52],
    cuello: [[0.17, 0.46, 0.085, 0.115], [0.26, 0.56, 0.09, 0.126], [0.33, 0.65, 0.078, 0.108], [0.385, 0.715, 0.066, 0.088], [0.432, 0.752, 0.063, 0.075], [0.49, 0.745, 0.066, 0.08], [0.56, 0.7, 0.056, 0.067], [0.62, 0.645, 0.046, 0.053], [0.655, 0.612, 0.042, 0.046], [0.672, 0.596, 0.012, 0.014]],
    crin: { de: 1, a: 4, alto: 0.085, grueso: 0.034 }, tupe: 0.055, oreja: [0.405, 0.79, 0.04, 0.055, 0.2], ojo: [0.495, 0.772, 0.058, 0.01],
    cola: { base: [-0.345, 0.5], anillos: [[0, 0, 0.03, 0.03], [-0.05, -0.02, 0.046, 0.05], [-0.088, -0.14, 0.052, 0.062], [-0.1, -0.28, 0.046, 0.056], [-0.098, -0.4, 0.016, 0.022]] },
    patas: { zd: 0.2, zt: -0.25, x: 0.09, yd: 0.37, yt: 0.39, l1: 0.18, l2: 0.15, r: [0.06, 0.04, 0.034, 0.03], casco: 0.038 },
    capa: 0xb48d58, crinC: 0x22160e, cascoC: 0x15100c, calza: 0x33241a, hocico: 0xdcc79e, rug: 1,
    manta: { z0: -0.19, z1: 0.13, arco: 1.6, colores: ['#22407f', '#c27a1c', '#f1e3b8'] }, silla: [[-0.14, 0.59, 0.01, 0.01], [-0.115, 0.615, 0.085, 0.04], [-0.02, 0.59, 0.1, 0.024], [0.06, 0.612, 0.085, 0.036], [0.085, 0.6, 0.01, 0.01]],
    asiento: [0.615, -0.03], andar: 'trote', zancada: 0.6, vel: 1.4, sonido: 'caballo-mongol' },
  // Dromedario: una joroba, patas largas, cuello en S, silla con mantas de colores.
  camello: {
    tronco: [[-0.36, 0.7, 0.012, 0.012], [-0.335, 0.69, 0.08, 0.085], [-0.27, 0.675, 0.114, 0.125], [-0.15, 0.665, 0.12, 0.14], [-0.02, 0.655, 0.124, 0.16], [0.1, 0.64, 0.124, 0.175], [0.2, 0.635, 0.114, 0.17], [0.27, 0.63, 0.085, 0.13], [0.305, 0.63, 0.02, 0.03]],
    joroba: [[-0.21, 0.79, 0.01, 0.01], [-0.165, 0.815, 0.075, 0.05], [-0.08, 0.86, 0.1, 0.1], [-0.01, 0.875, 0.1, 0.125], [0.06, 0.85, 0.09, 0.09], [0.12, 0.805, 0.06, 0.04], [0.155, 0.785, 0.01, 0.01]],
    pivote: [0.24, 0.6],
    cuello: [[0.19, 0.57, 0.07, 0.1], [0.3, 0.6, 0.06, 0.085], [0.385, 0.68, 0.05, 0.07], [0.43, 0.8, 0.044, 0.06], [0.45, 0.93, 0.04, 0.054], [0.468, 1.04, 0.04, 0.05], [0.502, 1.1, 0.042, 0.05], [0.557, 1.115, 0.046, 0.052], [0.62, 1.1, 0.04, 0.045], [0.672, 1.08, 0.036, 0.038], [0.702, 1.066, 0.032, 0.033], [0.716, 1.06, 0.01, 0.011]],
    crin: null, tupe: 0, oreja: [0.5, 1.15, 0.036, 0.03, -0.4], ojo: [0.565, 1.135, 0.04, 0.009],
    cola: { base: [-0.35, 0.7], anillos: [[0, 0, 0.015, 0.015], [-0.03, -0.05, 0.016, 0.018], [-0.042, -0.17, 0.012, 0.014], [-0.044, -0.24, 0.02, 0.03], [-0.044, -0.285, 0.005, 0.008]] },
    patas: { zd: 0.19, zt: -0.25, x: 0.072, yd: 0.56, yt: 0.6, l1: 0.3, l2: 0.245, r: [0.047, 0.027, 0.021, 0.019], casco: 0.035 },
    capa: 0xc79c62, crinC: 0x8a6a40, cascoC: 0x5a4630, calza: 0xb88c56, hocico: 0xb48a55, rug: 0.9,
    manta: { anillos: [[-0.25, 0.69, 0.125, 0.14], [-0.16, 0.76, 0.128, 0.165], [-0.08, 0.8, 0.13, 0.2], [-0.01, 0.81, 0.13, 0.215], [0.06, 0.79, 0.13, 0.19], [0.13, 0.74, 0.128, 0.16], [0.2, 0.69, 0.125, 0.14]], arco: 1.95, colores: ['#9a2330', '#22407f', '#e6b866'] },
    manta2: { anillos: [[-0.15, 0.78, 0.132, 0.17], [-0.08, 0.81, 0.134, 0.205], [-0.01, 0.82, 0.134, 0.22], [0.06, 0.8, 0.134, 0.195], [0.12, 0.76, 0.132, 0.17]], arco: 1.15, colores: ['#2a8a8a', '#f1e3b8', '#7b1e24'] },
    asiento: [1.03, -0.02], andar: 'ambladura', zancada: 1.05, vel: 1.05, sonido: 'camello-paso' },
  // Burro: BLANCO, pequeño, cabezón, orejas largas.
  burro: {
    tronco: [[-0.29, 0.42, 0.012, 0.012], [-0.27, 0.415, 0.075, 0.08], [-0.21, 0.405, 0.105, 0.115], [-0.1, 0.395, 0.11, 0.125], [0.01, 0.39, 0.112, 0.13], [0.11, 0.395, 0.108, 0.13], [0.185, 0.41, 0.095, 0.12], [0.24, 0.43, 0.07, 0.095], [0.265, 0.445, 0.015, 0.025]],
    pivote: [0.19, 0.46],
    cuello: [[0.14, 0.41, 0.062, 0.088], [0.22, 0.5, 0.062, 0.09], [0.275, 0.585, 0.052, 0.075], [0.315, 0.652, 0.047, 0.062], [0.352, 0.693, 0.05, 0.06], [0.405, 0.69, 0.054, 0.065], [0.465, 0.65, 0.047, 0.056], [0.515, 0.6, 0.04, 0.045], [0.545, 0.572, 0.038, 0.04], [0.56, 0.556, 0.01, 0.012]],
    crin: { de: 1, a: 4, alto: 0.03, grueso: 0.014 }, tupe: 0, oreja: [0.335, 0.735, 0.036, 0.17, 0.12], ojo: [0.41, 0.716, 0.048, 0.009],
    cola: { base: [-0.28, 0.45], anillos: [[0, 0, 0.014, 0.014], [-0.03, -0.04, 0.016, 0.018], [-0.05, -0.16, 0.013, 0.015], [-0.056, -0.24, 0.022, 0.03], [-0.056, -0.29, 0.005, 0.008]] },
    patas: { zd: 0.17, zt: -0.2, x: 0.063, yd: 0.33, yt: 0.35, l1: 0.17, l2: 0.135, r: [0.04, 0.026, 0.02, 0.018], casco: 0.024 },
    capa: 0xf6f4ee, crinC: 0xc9c3b6, cascoC: 0x4a4038, calza: 0xeeeae0, hocico: 0xd6cbc0, rug: 0.8,
    manta: { z0: -0.15, z1: 0.1, arco: 1.7, colores: ['#2a8a8a', '#7b1e24', '#e6b866'] },
    asiento: [0.53, -0.02], andar: 'trote', zancada: 0.46, vel: 0.95, sonido: 'burro-trote' },
};
// desfase de cada pata dentro del ciclo: [delantera izq., delantera der., trasera izq., trasera der.]
const DESFASE = { trote: [0, 0.5, 0.5, 0], ambladura: [0, 0.5, 0, 0.5], galope: [0.42, 0.52, 0, 0.1] };

function crearAnimal(tipo) {
  const A = ANIMAL[tipo], grupo = new THREE.Group(), cuerpo = new THREE.Group(); grupo.add(cuerpo);
  const texturas = [];
  const mat = (color, rug = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rug, envMapIntensity: 0.5 });
  const mCapa = mat(A.capa, A.rug), mCrin = mat(A.crinC, 0.95), mCasco = mat(A.cascoC, 0.55), mCalza = mat(A.calza, A.rug), mHocico = mat(A.hocico, 0.8), mOjo = mat(0x120c08, 0.3), mCuero = mat(0x5a3418, 0.6);
  const malla = (g, m, padre = cuerpo) => { const x = new THREE.Mesh(g, m); x.castShadow = true; x.receiveShadow = true; padre.add(x); return x; };
  malla(piel(A.tronco), mCapa);
  if (A.joroba) malla(piel(A.joroba), mCapa);
  // cuello y cabeza (giran juntos en la base del cuello)
  const [pz, py] = A.pivote, cuello = new THREE.Group(); cuello.position.set(0, py, pz); cuerpo.add(cuello);
  const local = (l) => l.map(([z, y, a, b]) => [z - pz, y - py, a, b]), C = local(A.cuello);
  malla(piel(C, { radial: 12 }), mCapa, cuello);
  const morro = C[C.length - 2], gm = new THREE.SphereGeometry(1, 10, 8), mm = malla(gm, mHocico, cuello); mm.scale.set(morro[2] * 1.06, morro[3] * 1.1, morro[3] * 1.25); mm.position.set(0, morro[1] - 0.004, morro[0] + 0.004);
  const orejas = [];
  { const [z, y, x, l, inc] = A.oreja; for (const s of [-1, 1]) { const g = new THREE.ConeGeometry(l * (tipo === 'burro' ? 0.2 : 0.3), l, 7); g.translate(0, l / 2, 0); g.scale(1, 1, 0.55); const o = malla(g, mCapa, cuello); o.position.set(s * x, y - py, z - pz); o.rotation.set(-inc, 0, -s * (tipo === 'burro' ? 0.28 : 0.2)); o.userData.base = -inc; orejas.push(o); } }
  { const [z, y, x, r] = A.ojo; for (const s of [-1, 1]) { const o = malla(new THREE.SphereGeometry(r, 8, 6), mOjo, cuello); o.position.set(s * x, y - py, z - pz); o.castShadow = false; } }
  let crin = null;
  if (A.crin) {      // cresta a lo largo del borde de atrás del cuello
    const R = afinar(C, 3), i0 = A.crin.de * 3, i1 = A.crin.a * 3, cr2 = [];
    for (let i = i0; i <= i1; i++) {
      const [z, y, , b] = R[i], P = R[i - 1], Q = R[Math.min(R.length - 1, i + 1)]; let tz = Q[0] - P[0], ty = Q[1] - P[1]; const l = Math.hypot(tz, ty) || 1; tz /= l; ty /= l;
      const u = (i - i0) / (i1 - i0), h = A.crin.alto * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.15))), d = b + h * 0.42;
      cr2.push([z - ty * d, y + tz * d, A.crin.grueso, h]);      // hacia el lado de la nuca
    }
    crin = malla(piel([[cr2[0][0], cr2[0][1], 0.004, 0.004], ...cr2, [cr2[cr2.length - 1][0] + 0.01, cr2[cr2.length - 1][1] + 0.012, 0.004, 0.004]], { radial: 8, veces: 1 }), mCrin, cuello);
    if (A.tupe) { const top = C[5], g = new THREE.SphereGeometry(1, 8, 6), tp = malla(g, mCrin, cuello); tp.scale.set(A.tupe * 0.75, A.tupe * 0.6, A.tupe * 1.5); tp.position.set(0, top[1] + top[3] * 0.82, top[0] + 0.012); tp.rotation.x = 0.5; }
  }
  // cola
  const cola = new THREE.Group(); cola.position.set(0, A.cola.base[1], A.cola.base[0]); cuerpo.add(cola);
  malla(piel(A.cola.anillos, { radial: 8 }), tipo === 'camello' || tipo === 'burro' ? mCapa : mCrin, cola);
  if (tipo === 'camello' || tipo === 'burro') { const p = A.cola.anillos[3], b = malla(new THREE.SphereGeometry(1, 7, 6), mCrin, cola); b.scale.set(0.02, 0.04, 0.024); b.position.set(0, p[1] - 0.012, p[0]); }
  // patas: cadera → rodilla → casco. Las de atrás llevan el corvejón marcado.
  const P = A.patas, [r0, r1, r2, r3] = P.r, patas = [];
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz], i) => {
    const del = sz > 0, cadera = new THREE.Group(); cadera.position.set(sx * P.x, del ? P.yd : P.yt, del ? P.zd : P.zt); cuerpo.add(cadera);
    const L1 = P.l1 + (del ? 0 : P.yt - P.yd);
    malla(piel([[0, 0.05, r0 * 0.5, r0 * 0.6], [del ? 0 : -0.005, 0.01, r0 * 0.95, r0 * (del ? 1.05 : 1.35)], [del ? 0 : -0.008, -L1 * 0.45, r0 * 0.72, r0 * (del ? 0.8 : 0.95)], [0, -L1 * 0.85, r1, r1 * 1.05], [0, -L1 - 0.004, r1 * 1.08, r1 * 1.12], [0, -L1 - 0.02, r1 * 0.5, r1 * 0.5]].map(([z, y, a, b]) => [z, y, a, b]).reverse(), { radial: 8, veces: 2 }), mCapa, cadera);
    const rodilla = new THREE.Group(); rodilla.position.y = -L1; cadera.add(rodilla);
    malla(piel([[0, -P.l2, r3 * 1.15, r3 * 1.2], [0, -P.l2 + 0.03, r3, r3], [0, -P.l2 * 0.5, r2 * 0.92, r2 * 0.95], [0, -0.01, r2 * 1.15, r2 * 1.2], [0, 0.012, r2 * 0.6, r2 * 0.6]], { radial: 8, veces: 2 }), mCalza, rodilla);
    const gc = new THREE.CylinderGeometry(P.casco * 0.82, P.casco, 0.04, 9); gc.translate(0, -P.l2 - 0.016, 0.004); if (tipo === 'camello') gc.scale(1.15, 0.7, 1.3); malla(gc, mCasco, rodilla);
    patas.push({ cadera, rodilla, delantera: del, desfase: DESFASE[A.andar][i], c0: del ? 0 : 0.2, r0: del ? 0 : -0.34 });
  });
  // mantas y silla
  const afTronco = afinar(A.tronco, 4);
  function manta(M) {
    const an = M.anillos || afTronco.filter((r) => r[0] >= M.z0 && r[0] <= M.z1), t = texManta(...M.colores); texturas.push(t);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.35 });
    return malla(piel(an, { radial: 16, arco: [Math.PI / 2 - M.arco, Math.PI / 2 + M.arco], holgura: 0.009, veces: M.anillos ? 4 : 1 }), m);
  }
  manta(A.manta); if (A.manta2) manta(A.manta2);
  if (A.silla) malla(piel(A.silla, { radial: 10 }), mCuero);
  if (tipo === 'camello') for (const z of [-0.14, 0.1]) { const g = new THREE.CylinderGeometry(0.014, 0.018, 0.13, 6); const palo = malla(g, mCuero); palo.position.set(0, 1.04, z); palo.rotation.x = z < 0 ? -0.25 : 0.25; const pomo = malla(new THREE.SphereGeometry(0.022, 8, 6), mat(0xe6b866, 0.4), palo); pomo.position.y = 0.07; }
  // posa los cascos en el suelo (postura de reposo)
  const base = { cuello: cuello.rotation.x, cola: cola.rotation.x };
  for (const p of patas) { p.cadera.rotation.x = p.c0; p.rodilla.rotation.x = p.r0; }
  cuerpo.updateMatrixWorld(true); const piso = -new THREE.Box3().setFromObject(cuerpo).min.y; cuerpo.position.y = piso;
  const asiento = new THREE.Vector3(0, A.asiento[0] + piso, A.asiento[1]);
  const hocico = A.cuello[A.cuello.length - 3], cabestro = new THREE.Vector3(0, hocico[1] + piso - hocico[3], hocico[0] - 0.02);      // donde se ata el cabestro, bajo el hocico
  let bote = 0;
  function animar(t, fase, marcha) {
    const g = A.andar === 'galope', amp = (g ? 0.62 : A.andar === 'ambladura' ? 0.4 : 0.5) * marcha;
    for (const p of patas) {
      const a = fase + p.desfase * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      p.cadera.rotation.x = p.c0 - amp * s + (g ? (p.delantera ? -0.12 : 0.12) * marcha : 0);
      p.rodilla.rotation.x = p.r0 + (p.delantera ? 1.5 : -0.9) * amp * Math.max(0, c) + (p.delantera ? 0 : 0.25 * marcha * Math.max(0, -c));
    }
    bote = marcha * (g ? 0.05 * Math.max(0, Math.sin(fase + 1.2)) : A.andar === 'ambladura' ? 0.018 * Math.sin(fase * 2) : 0.022 * Math.abs(Math.sin(fase)));
    cuerpo.position.y = piso + bote;
    cuerpo.rotation.x = marcha * (g ? 0.085 * Math.sin(fase + 2.4) : 0.015 * Math.sin(fase * 2));
    cuerpo.rotation.z = marcha * (A.andar === 'ambladura' ? 0.07 * Math.sin(fase) : 0.015 * Math.sin(fase));
    cuello.rotation.x = base.cuello + marcha * (g ? 0.16 + 0.09 * Math.sin(fase + 0.6) : A.andar === 'ambladura' ? 0.07 * Math.sin(fase * 2 + 0.8) : 0.05 * Math.sin(fase * 2)) + 0.02 * Math.sin(t * 1.3);
    cola.rotation.x = base.cola + marcha * (g ? -0.5 : -0.12) + 0.04 * Math.sin(t * 2.1); cola.rotation.z = 0.2 * Math.sin(t * 2.7 + 1) * (1 - 0.6 * marcha) + marcha * 0.14 * Math.sin(fase * 2);
    if (crin) { crin.rotation.z = marcha * 0.1 * Math.sin(fase * 2 + 0.5); }
    for (const o of orejas) o.rotation.x = o.userData.base + 0.1 * Math.sin(t * 3.1 + o.position.x * 40) - marcha * 0.3;
  }
  animar(0, 0, 0);
  const destruir = () => { grupo.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); for (const t of texturas) t.dispose(); };
  return { tipo, grupo, asiento, cabestro, animar, destruir, get bote() { return bote; }, zancada: A.zancada, vel: A.vel, sonido: A.sonido, cabalga: cuerpo, alto: A.asiento[0], largo: 0.8 };
}

// --- Alfombra mágica
function texAlfombra() {
  const W = 256, H = 384, c = lienzo(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { g.fillStyle = i % 2 ? '#e6b866' : '#f1e3b8'; g.fillRect(8 + i * 9.4, 0, 4, 22); g.fillRect(8 + i * 9.4, H - 22, 4, 22); }      // flecos
  g.fillStyle = '#7b1e24'; g.fillRect(4, 20, W - 8, H - 40);
  g.strokeStyle = '#e6b866'; g.lineWidth = 5; g.strokeRect(13, 29, W - 26, H - 58);
  g.fillStyle = '#22407f'; g.fillRect(26, 42, W - 52, H - 84);
  g.strokeStyle = '#efd08f'; g.lineWidth = 2.5; g.strokeRect(33, 49, W - 66, H - 98);
  const rombo = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r * 1.35); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.35); g.lineTo(x - r, y); g.closePath(); g.fill(); };
  rombo(W / 2, H / 2, 62, '#7b1e24'); rombo(W / 2, H / 2, 46, '#e6b866'); rombo(W / 2, H / 2, 30, '#2a8a8a'); rombo(W / 2, H / 2, 12, '#f1e3b8');
  for (const [x, y] of [[62, 86], [W - 62, 86], [62, H - 86], [W - 62, H - 86]]) { rombo(x, y, 17, '#e6b866'); rombo(x, y, 8, '#7b1e24'); }
  for (let i = 0; i < 11; i++) { rombo(22 + 0, 60 + i * 26.5, 4, '#efd08f'); rombo(W - 22, 60 + i * 26.5, 4, '#efd08f'); }
  return aTextura(c, { aniso: 8 });
}
function crearAlfombra() {
  const ANCHO = 0.74, LARGO = 1.12, NX = 6, NZ = 34, tex = texAlfombra();
  const geo = new THREE.PlaneGeometry(ANCHO, LARGO, NX, NZ); geo.rotateX(-Math.PI / 2);
  const base = geo.attributes.position.array.slice(), P = geo.attributes.position;
  const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.92, alphaTest: 0.5, envMapIntensity: 0.4, emissive: 0xffd98a, emissiveMap: tex, emissiveIntensity: 0.1 });
  const malla = new THREE.Mesh(geo, mat); malla.castShadow = true; malla.receiveShadow = true;
  const grupo = new THREE.Group(); grupo.add(malla);
  // rollo: 0 = extendida, 1 = enrollada del todo (empieza por la punta de delante y acaba en un cilindro atrás)
  function animar(t, { rollo = 0, onda = 1 } = {}) {
    const A = P.array, libre = LARGO * (1 - rollo), R = 0.05;
    for (let i = 0; i < A.length; i += 3) {
      const x = base[i], z = base[i + 2], d = z + LARGO / 2;      // d: distancia desde el borde de atrás
      let y = onda * (0.022 * Math.sin(t * 5.2 - d * 6.5) + 0.012 * Math.sin(t * 3.1 + x * 7 - d * 3)) * (0.35 + Math.abs(d - LARGO / 2) / LARGO * 1.6), zz = z;
      if (d > libre) { const e = d - libre, ang = e / (R * 0.82), r = Math.max(0.012, R - ang * 0.0035); zz = -LARGO / 2 + libre + r * Math.sin(ang); y = y * 0.2 + R - r * Math.cos(ang); }
      A[i] = x; A[i + 1] = y; A[i + 2] = zz;
    }
    P.needsUpdate = true; geo.computeVertexNormals();
  }
  animar(0, { rollo: 1 });
  return { tipo: 'alfombra', grupo, asiento: new THREE.Vector3(0, 0.02, -0.05), animar, destruir() { geo.dispose(); mat.dispose(); tex.dispose(); }, largo: LARGO, vel: 1.5, sonido: 'alfombra-vuelo' };
}

export function crearMontura(tipo) {
  if (tipo === 'alfombra') return crearAlfombra();
  if (!ANIMAL[tipo]) throw new Error(`Transporte desconocido: «${tipo}».`);
  return crearAnimal(tipo);
}
