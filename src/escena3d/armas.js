// Armas a escala de las fichas (las cuatro van pintadas; debajo queda la versión estilizada de reserva). Todas se empuñan en el origen; la hoja apunta a +Y y el filo mira a +Z.
// Solo son figuras para la animación: no llevan ninguna regla del juego.
import * as THREE from 'three';
import dCimitarra from './datos/arma-cimitarra.json';
import dAlfanje from './datos/arma-alfanje.json';
import dJambiya from './datos/arma-jambiya.json';
import dArco from './datos/arma-arco.json';

const K = 0.92 / 170;
export const ARMAS = ['cimitarra', 'jambiya', 'alfanje', 'arco'];
export const NOMBRE_ARMA = { cimitarra: 'Cimitarra', jambiya: 'Jambiya', alfanje: 'Alfanje', arco: 'Arco', '': 'Sin armas' };
export const esHoja = (tipo) => tipo === 'cimitarra' || tipo === 'jambiya' || tipo === 'alfanje';

function hoja(puntos, grosor) {
  const f = new THREE.Shape(); puntos(f);
  const g = new THREE.ExtrudeGeometry(f, { depth: grosor, bevelEnabled: true, bevelThickness: grosor * 0.45, bevelSize: 0.7, bevelSegments: 1, curveSegments: 14 });
  g.translate(0, 0, -grosor / 2); g.rotateY(-Math.PI / 2); g.scale(K, K, K);      // el plano de la hoja queda en YZ, con la curva hacia +Z
  return g;
}

// Armas pintadas (Jorge, 24 de noviembre: hojas de vistas de ChatGPT, preparadas con herramientas/preparar-armas.py). Dos
// cáscaras, una por costado, con el relieve de la vista de canto; se empuñan en el origen, la hoja a +Y y el filo a +Z.
const PINTADAS = { cimitarra: dCimitarra, alfanje: dAlfanje, jambiya: dJambiya, arco: dArco }, texArmas = {};
const b64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
function crearArmaPintada(tipo, mats) {
  const d = PINTADAS[tipo], { tw, th, paso: P, sz } = d, gx = tw / P + 1, gy = th / P + 1, k = (d.alto * K) / th, grupo = new THREE.Group();
  const tex = (texArmas[tipo] ||= (() => { const t = new THREE.TextureLoader().load((import.meta.env?.BASE_URL || '/') + `arte3d/arma-${tipo}.webp`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })());
  const zg = b64(d.z), bits = b64(d.cubre), cubre = (i, j) => { const n = j * (gx - 1) + i; return (bits[n >> 3] >> (7 - (n & 7))) & 1; };
  const punto = ([px, py]) => new THREE.Vector3(0, (d.puno[1] - py) * k, sz * (px - d.puno[0]) * k);
  const pos = [], uv = [], idx = [], mapa = [new Int32Array(gx * gy).fill(-1), new Int32Array(gx * gy).fill(-1)];
  const vertice = (c, i, j) => {      // c = 0: el primer costado de la hoja de vistas; c = 1: el otro
    const n = j * gx + i; let v = mapa[c][n]; if (v >= 0) return v;
    v = mapa[c][n] = pos.length / 3;
    const rel = (d.zmin + (zg[n] / 255) * (d.zmax - d.zmin)) * k - 1.2 * k;      // con signo: las dos cáscaras se cruzan justo en el contorno
    pos.push((c ? 1 : -1) * sz * rel, (d.puno[1] - j * P) * k, sz * (i * P - d.puno[0]) * k); uv.push((c + (i * P) / tw) / 2, 1 - (j * P) / th);
    return v;
  };
  for (let j = 0; j < gy - 1; j++) for (let i = 0; i < gx - 1; i++) {
    if (!cubre(i, j)) continue;
    for (const c of [0, 1]) { const a = vertice(c, i, j), b = vertice(c, i + 1, j), e = vertice(c, i, j + 1), f = vertice(c, i + 1, j + 1); if (c) idx.push(a, b, e, b, f, e); else idx.push(a, e, b, b, e, f); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const metal = tipo === 'arco' ? 0.05 : 0.45;
  grupo.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: tipo === 'arco' ? 0.6 : 0.42, metalness: metal, envMapIntensity: 1.2, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 })));
  const res = { tipo, grupo, base: punto(d.base), punta: punto(d.punta), tensar: null, flecha: null };
  if (d.cuerda) {      // arco: la cuerda y la flecha las pone el código, entre los dos nudos de la pintura
    const [cx, cy0, cy1] = d.cuerda, n0 = punto([cx, cy0]), n1 = punto([cx, cy1]);
    const gC = new THREE.BufferGeometry(); gC.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    const cuerda = new THREE.Line(gC, new THREE.LineBasicMaterial({ color: 0xf1e3b8 })); cuerda.frustumCulled = false; grupo.add(cuerda);
    const flecha = crearFlecha(mats); flecha.grupo.rotation.x = Math.PI / 2; grupo.add(flecha.grupo); res.flecha = flecha.grupo;
    res.tensar = (u, conFlecha) => {      // u = 0 cuerda en reposo, 1 = tensada del todo
      const z = n0.z - 30 * K * u, p = gC.attributes.position.array;
      p.set([0, n1.y, n1.z, 0, 0, z, 0, n0.y, n0.z]); gC.attributes.position.needsUpdate = true;
      flecha.grupo.visible = !!conFlecha; flecha.grupo.position.set(0, 0, z + LARGO_FLECHA / 2);
    };
    res.tensar(0, false); res.base.copy(n1); res.punta.copy(n0);
  }
  grupo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return res;
}

export function crearArma(tipo, mats) {
  if (PINTADAS[tipo]) return crearArmaPintada(tipo, mats);
  const grupo = new THREE.Group(), base = new THREE.Vector3(), punta = new THREE.Vector3();
  const acero = new THREE.MeshStandardMaterial({ color: 0xe4e9ee, metalness: 1, roughness: 0.24, envMapIntensity: 2.2, emissive: 0x9aa6b4, emissiveIntensity: 0.42 });
  const cuero = new THREE.MeshStandardMaterial({ color: 0x4d0e17, roughness: 0.5 });
  const cil = (r1, r2, h, y) => { const c = new THREE.CylinderGeometry(r1 * K, r2 * K, h * K, 12); c.translate(0, y * K, 0); return c; };
  const res = { tipo, grupo, base, punta, tensar: null, flecha: null };
  if (tipo === 'cimitarra') {
    grupo.add(new THREE.Mesh(hoja((f) => { f.moveTo(-4, 6); f.bezierCurveTo(-5, 44, 2, 78, 24, 104); f.bezierCurveTo(15, 80, 7, 46, 6, 6); f.closePath(); }, 1.5), acero));
    const guarda = new THREE.BoxGeometry(5 * K, 4 * K, 19 * K); guarda.translate(0, 5 * K, 1 * K);
    grupo.add(new THREE.Mesh(guarda, mats.laton), new THREE.Mesh(cil(3, 3.4, 15, -4), cuero));
    const pomo = new THREE.SphereGeometry(4.2 * K, 10, 8); pomo.translate(0, -13 * K, 0); grupo.add(new THREE.Mesh(pomo, mats.laton));
    base.set(0, 12 * K, 0); punta.set(0, 102 * K, 22 * K);
  } else if (tipo === 'jambiya') {
    grupo.add(new THREE.Mesh(hoja((f) => { f.moveTo(-6, 4); f.bezierCurveTo(-7, 22, 0, 40, 22, 50); f.bezierCurveTo(10, 38, 7, 22, 7, 4); f.closePath(); }, 1.6), acero));
    grupo.add(new THREE.Mesh(cil(3.2, 3.2, 12, -3), mats.laton));
    const d1 = new THREE.CylinderGeometry(7.5 * K, 7.5 * K, 2.6 * K, 14); d1.scale(0.6, 1, 1); d1.translate(0, 4 * K, 0);
    const d2 = new THREE.CylinderGeometry(6.5 * K, 6.5 * K, 2.6 * K, 14); d2.scale(0.6, 1, 1); d2.translate(0, -10 * K, 0);
    grupo.add(new THREE.Mesh(d1, mats.laton), new THREE.Mesh(d2, mats.laton));
    base.set(0, 8 * K, 0); punta.set(0, 49 * K, 21 * K);
  } else if (tipo === 'alfanje') {
    const osc = acero.clone(); osc.color.set(0xc9d0d8); osc.roughness = 0.3;
    grupo.add(new THREE.Mesh(hoja((f) => { f.moveTo(-5, 6); f.lineTo(-6, 80); f.lineTo(6, 106); f.bezierCurveTo(24, 92, 22, 44, 9, 6); f.closePath(); }, 2.6), osc));
    const guarda = new THREE.BoxGeometry(6 * K, 5 * K, 24 * K); guarda.translate(0, 5 * K, 1 * K);
    grupo.add(new THREE.Mesh(guarda, mats.laton), new THREE.Mesh(cil(3.4, 3.8, 18, -6), cuero));
    const pomo = new THREE.SphereGeometry(5 * K, 10, 8); pomo.translate(0, -17 * K, 0); grupo.add(new THREE.Mesh(pomo, mats.laton));
    base.set(0, 12 * K, 0); punta.set(0, 104 * K, 10 * K);
  } else if (tipo === 'arco') {
    const pts = [[-56, -20], [-40, -4], [-16, 3], [0, 4], [16, 3], [40, -4], [56, -20]].map(([y, z]) => new THREE.Vector3(0, y * K, z * K));
    const palo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 1.9 * K, 8);
    grupo.add(new THREE.Mesh(palo, new THREE.MeshStandardMaterial({ color: 0x6a2a14, roughness: 0.45 })));
    grupo.add(new THREE.Mesh(cil(2.6, 2.6, 13, 0).translate(0, 0, 4 * K), mats.laton));
    for (const s of [-1, 1]) { const t = new THREE.SphereGeometry(2.6 * K, 8, 6); t.translate(0, s * 56 * K, -20 * K); grupo.add(new THREE.Mesh(t, mats.laton)); }
    const gC = new THREE.BufferGeometry(); gC.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    const cuerda = new THREE.Line(gC, new THREE.LineBasicMaterial({ color: 0xf1e3b8 })); cuerda.frustumCulled = false; grupo.add(cuerda);
    const flecha = crearFlecha(mats); flecha.grupo.rotation.x = Math.PI / 2; grupo.add(flecha.grupo);
    res.flecha = flecha.grupo;
    res.tensar = (u, conFlecha) => {      // u = 0 cuerda en reposo, 1 = tensada del todo
      const z = (-20 - 30 * u) * K, p = gC.attributes.position.array;
      p.set([0, -56 * K, -20 * K, 0, 0, z, 0, 56 * K, -20 * K]); gC.attributes.position.needsUpdate = true;
      flecha.grupo.visible = !!conFlecha; flecha.grupo.position.set(0, 0, z + LARGO_FLECHA / 2);
    };
    res.tensar(0, false);
    base.set(0, -56 * K, -20 * K); punta.set(0, 56 * K, -20 * K);
  }
  grupo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return res;
}

export const LARGO_FLECHA = 66 * K;
// Flecha pintada (Jorge, 24 de noviembre: hoja de ChatGPT, preparada con herramientas/preparar-flecha.py): dos planos cruzados
// a lo largo del astil, uno con la flecha de frente y otro girada un cuarto de vuelta. Apunta a +Y (va de -L/2 a +L/2).
let texFlecha = null;
export function crearFlecha() {
  if (!texFlecha) { texFlecha = new THREE.TextureLoader().load((import.meta.env?.BASE_URL || '/') + 'arte3d/flecha.webp'); texFlecha.colorSpace = THREE.SRGBColorSpace; texFlecha.anisotropy = 8; }
  const grupo = new THREE.Group(), L = LARGO_FLECHA;
  const mat = new THREE.MeshStandardMaterial({ map: texFlecha, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, emissive: 0xffffff, emissiveMap: texFlecha, emissiveIntensity: 0.15 });
  [[0.11, 0, 0], [0.0794, 0.5, Math.PI / 2]].forEach(([ancho, u0, giro]) => {
    const p = new THREE.PlaneGeometry(L * ancho, L), uv = p.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * 0.5);
    p.rotateY(giro); const m = new THREE.Mesh(p, mat); m.castShadow = true; grupo.add(m);
  });
  return { grupo };
}

// Escudo de cuero (OB04) pintado (Jorge, 23 de noviembre: hoja de vistas de ChatGPT). Un disco abombado con la vista de frente
// por delante y la de atrás (con sus correas) por detrás. Mira hacia +Z; el centro está en el origen.
let texEscudo = null;
export function crearEscudo(diametro = 0.44) {
  if (!texEscudo) { texEscudo = new THREE.TextureLoader().load((import.meta.env?.BASE_URL || '/') + 'arte3d/escudo.webp'); texEscudo.colorSpace = THREE.SRGBColorSpace; texEscudo.anisotropy = 8; }
  const R = diametro / 2, NR = 10, NA = 36, grupo = new THREE.Group();
  const cara = (frente) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= NR; i++) for (let j = 0; j <= NA; j++) {
      const r = i / NR, a = (j / NA) * Math.PI * 2, x = Math.cos(a) * r, y = Math.sin(a) * r;
      const comba = 0.16 * (1 - r * r) + (frente ? 0.22 * Math.max(0, 1 - (r / 0.28) ** 2) : 0);      // disco abombado; por delante, el umbo
      pos.push(x * R, y * R, (frente ? comba : comba - 0.05) * R);
      uv.push(((frente ? x : -x) * 0.49 + 0.5) / 2 + (frente ? 0 : 0.5), y * 0.49 + 0.5);
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const p = i * (NA + 1) + j, q = p + NA + 1; if (frente) idx.push(p, q, p + 1, p + 1, q, q + 1); else idx.push(p, p + 1, q, p + 1, q + 1, q); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texEscudo, roughness: 0.6, metalness: 0.15, envMapIntensity: 0.6 })); m.castShadow = true; grupo.add(m);
  };
  cara(true); cara(false);
  return { grupo, destruir() { grupo.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); } };
}
