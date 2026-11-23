// Tablero: el mapa real sobre una tabla con marco de madera y latón, rutas reales, ciudades y rótulos.
import * as THREE from 'three';
import { U, ANCHO, ALTO, aMundo, PALETA } from './medidas.js';
import { crearSuperficie } from './mapa.js';
import { crearFuego } from './fuego.js';
import { texResplandor } from './texturas.js';
import { lienzo, aTextura, texGuion, texAro } from './texturas.js';
import { unir, rectRedondeado, MESA_Y } from './ambiente.js';
import { crearRelieve } from './relieve.js';

export const MARCO = 1.3;            // ancho del marco de madera
export const MARCO_Y = 0.34;         // altura del marco sobre el mapa

// Dónde va el rótulo de cada ciudad para que las piezas no lo tapen: (dx, dy) es un punto respecto a la ciudad, en unidades
// del mapa, y (ax, ay) dice qué punto del rótulo se clava ahí (0 = izquierda/arriba, 1 = derecha/abajo). Desde ese punto crece al alejar la cámara.
const ROTULOS = {
  'Andalucía': { dx: 44, dy: -6, ax: 0, ay: 0.5, lado: 'izq' },
  'Magreb': { dx: 4, dy: 40, ax: 0.5, ay: 0, lado: 'centro' },
  'El Cairo': { dx: 0, dy: 40, ax: 0.5, ay: 0, lado: 'centro' },
  'Estambul': { dx: -34, dy: 16, ax: 1, ay: 1, lado: 'der' },
  'Aleppo': { dx: -44, dy: -36, ax: 1, ay: 0.5, lado: 'der' },
  'Damasco': { dx: -44, dy: -52, ax: 1, ay: 0, lado: 'der' },
  'Yemen': { dx: 0, dy: 40, ax: 0.5, ay: 0, lado: 'centro' },
  'Basra': { dx: 40, dy: -8, ax: 0, ay: 0, lado: 'izq' },
  'Bagdad': { dx: 56, dy: 50, ax: 1, ay: 0, lado: 'centro' },
  'Isfahán': { dx: 44, dy: 30, ax: 0, ay: 1, lado: 'izq' },
  'Samarcanda': { dx: 0, dy: 40, ax: 0.5, ay: 0, lado: 'centro' },
  'India': { dx: -44, dy: -6, ax: 1, ay: 0.5, lado: 'der' },
};
// Sitios para las fichas alrededor de cada ciudad (x este, z sur, en radios), según de qué lado quede el rótulo:
// a los costados y por detrás del edificio, nunca delante, para no taparlo ni tapar el rótulo.
const RANURAS = {
  centro: [[-1, 0.25], [1, 0.25], [-1.8, -0.35], [1.8, -0.35], [0, -1.25], [-1, -1.3], [1, -1.3], [0, -2.1]],
  izq: [[-1, 0.2], [-0.55, -0.98], [-1.85, -0.3], [0.5, -1.05], [-1.45, -1.15], [-2.5, 0.45], [-2.4, -1.0], [-0.1, -1.95]],
  der: [[1, 0.2], [0.55, -0.98], [1.85, -0.3], [-0.5, -1.05], [1.45, -1.15], [2.5, 0.45], [2.4, -1.0], [0.1, -1.95]],
};
const RADIO_RANURA = 0.58;

// --- Curvas de las rutas (los mismos trazos Bézier del tablero 2D)
function curvaDeRuta(d) {
  const fichas = d.match(/[MCL]|-?\d*\.?\d+/g), camino = new THREE.CurvePath();
  let i = 0, cmd = null, p = null;
  const num = () => parseFloat(fichas[i++]);
  const pt = () => aMundo(num(), num());
  while (i < fichas.length) {
    if (/[MCL]/.test(fichas[i])) cmd = fichas[i++];
    if (cmd === 'M') { p = pt(); cmd = 'L'; }
    else if (cmd === 'C') { const a = pt(), b = pt(), c = pt(); camino.add(new THREE.CubicBezierCurve3(p, a, b, c)); p = c; }
    else { const q = pt(); camino.add(new THREE.LineCurve3(p, q)); p = q; }
  }
  return camino;
}

// Cinta plana sobre el mapa que sigue una lista de puntos; u = distancia recorrida / periodo (para los guiones).
function cinta(puntos, ancho, periodo, recorte = 0, y = 0, altura = () => 0) {
  const pos = [], uv = [], idx = [];
  const dist = [0];
  for (let i = 1; i < puntos.length; i++) dist.push(dist[i - 1] + puntos[i].distanceTo(puntos[i - 1]));
  const total = dist[dist.length - 1];
  let n = 0;
  for (let i = 0; i < puntos.length; i++) {
    if (dist[i] < recorte || dist[i] > total - recorte) continue;
    const a = puntos[Math.max(0, i - 1)], b = puntos[Math.min(puntos.length - 1, i + 1)];
    const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
    const xa = puntos[i].x + nx * ancho / 2, za = puntos[i].z + nz * ancho / 2, xb = puntos[i].x - nx * ancho / 2, zb = puntos[i].z - nz * ancho / 2, yc = altura(puntos[i].x, puntos[i].z);
    pos.push(xa, Math.max(yc, altura(xa, za)) + y, za, xb, Math.max(yc, altura(xb, zb)) + y, zb);
    uv.push(dist[i] / periodo, 0, dist[i] / periodo, 1);
    if (n > 0) { const k = n * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
  g.setIndex(idx);
  return g;
}

// --- Edificio estilizado de cada ciudad: tambor de piedra clara, cúpula turquesa (dorada en Bagdad), alminar y remates de latón.
function geometriasCiudad(capital) {
  const piedra = [], cupula = [], laton = [];
  const cil = (rt, rb, h, y, seg = 24) => { const c = new THREE.CylinderGeometry(rt, rb, h, seg); if (seg === 8) c.rotateY(Math.PI / 8); c.translate(0, y + h / 2, 0); return c; };
  laton.push(cil(0.285, 0.3, 0.035, 0, 32));
  piedra.push(cil(0.235, 0.25, 0.05, 0.035, 8), cil(0.19, 0.2, 0.2, 0.085, 8), cil(0.215, 0.2, 0.03, 0.285, 8));
  laton.push(cil(0.2, 0.2, 0.014, 0.315, 24));
  const perfil = [[0.176, 0], [0.196, 0.035], [0.2, 0.08], [0.184, 0.135], [0.145, 0.19], [0.09, 0.24], [0.036, 0.285], [0.0, 0.31]].map(([r, y]) => new THREE.Vector2(r, y));
  const dm = new THREE.LatheGeometry(perfil, 28); dm.translate(0, 0.325, 0); cupula.push(dm);
  const bola = new THREE.SphereGeometry(0.024, 10, 8); bola.translate(0, 0.65, 0); laton.push(bola);
  const aguja = new THREE.ConeGeometry(0.012, 0.085, 8); aguja.translate(0, 0.71, 0); laton.push(aguja);
  // puerta en arco al frente (sur)
  const arco = new THREE.Shape(); arco.moveTo(-0.05, 0); arco.lineTo(-0.05, 0.08); arco.quadraticCurveTo(-0.05, 0.13, 0, 0.16); arco.quadraticCurveTo(0.05, 0.13, 0.05, 0.08); arco.lineTo(0.05, 0);
  const alminar = (x, z, alto) => {
    const t = new THREE.CylinderGeometry(0.04, 0.05, alto, 10); t.translate(x, 0.035 + alto / 2, z); piedra.push(t);
    const b = new THREE.CylinderGeometry(0.068, 0.05, 0.03, 10); b.translate(x, 0.035 + alto * 0.74, z); piedra.push(b);
    const b2 = new THREE.CylinderGeometry(0.06, 0.045, 0.025, 10); b2.translate(x, 0.035 + alto, z); piedra.push(b2);
    const c = new THREE.ConeGeometry(0.05, 0.14, 10); c.translate(x, 0.035 + alto + 0.08, z); cupula.push(c);
    const s = new THREE.SphereGeometry(0.016, 8, 6); s.translate(x, 0.035 + alto + 0.165, z); laton.push(s);
  };
  if (capital) { alminar(-0.27, -0.03, 0.62); alminar(0.27, -0.03, 0.62); } else alminar(0.25, -0.06, 0.52);
  const gArco = new THREE.ShapeGeometry(arco, 8);
  return { piedra: unir(piedra), cupula: unir(cupula), laton: unir(laton), arco: gArco };
}

// Medidas del rótulo de una ciudad (en unidades del mapa), para dibujarlo y para aplanar el relieve debajo.
function medidasRotulo(id, ar, capital, PX = 4) {
  const tam = capital ? 68 : 55, tamAr = capital ? 54 : 47, margen = 14;
  const fNom = `400 ${tam * PX}px "Marcellus SC", serif`, fAr = `700 ${tamAr * PX}px "Aref Ruqaa", serif`;
  const med = lienzo(8, 8).getContext('2d');
  med.font = fNom; const wN = med.measureText(id).width / PX; med.font = fAr; const wA = med.measureText(ar).width / PX;
  const w = Math.max(wN, wA) + margen * 2, baseN = margen + tam * 0.74, baseA = baseN + tamAr * 1.0, h = baseA + tamAr * 0.42 + margen;
  return { tam, tamAr, margen, fNom, fAr, w, h, baseN, baseA, PX };
}
const ROTULO_MAX = 1.3;      // cuánto crece el rótulo, como mucho, al alejar la cámara

export async function crearTablero(escena, mats, recursos, renderer, { ciudades: CIUDADES, rutas: RUTAS, movil = false, anchoMapa = 0, alProgreso = null }) {
  const grupo = new THREE.Group(); escena.add(grupo);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  // --- Relieve: se aplana bajo cada ciudad y bajo su rótulo
  const medidas = new Map(), llanos = [], cajas = [];
  for (const c of CIUDADES) {
    if (c.lugar) { llanos.push({ x: c.x, y: c.y, r0: 40, r1: 90 }); continue; }      // un lugar sin ciudad (el Jorasán): solo se aplana el suelo
    const capital = c.id === 'Bagdad', rot = ROTULOS[c.id] || { dx: 0, dy: 40, ax: 0.5, ay: 0, lado: 'centro' }, m = medidasRotulo(c.id, c.ar, capital);
    const px = c.x + rot.dx, py = c.y + rot.dy, k = ROTULO_MAX;
    m.caja = { x0: px - rot.ax * m.w * k, x1: px + (1 - rot.ax) * m.w * k, y0: py - rot.ay * m.h * k, y1: py + (1 - rot.ay) * m.h * k };
    medidas.set(c.id, m); cajas.push(m.caja); llanos.push({ x: c.x, y: c.y, r0: capital ? 62 : 48, r1: capital ? 130 : 104 });
  }
  const rel = await crearRelieve({ relieveURL: recursos.relieve, montes: recursos.montes, llanos, cajas, segX: movil ? 300 : 372 });
  const altura = rel.altura;

  // --- Superficie: el mapa real, rasterizado aquí mismo desde su SVG (ver mapa.js), con el mar vivo.
  const sup = await crearSuperficie({ renderer, recursos, rel, movil, anchoMapa, alProgreso });
  const matMapa = sup.material;
  const mapa = new THREE.Mesh(rel.geometria, matMapa);
  mapa.receiveShadow = true; mapa.castShadow = true; grupo.add(mapa);

  // --- Marco de madera oscura con bisel, filete y esquineras de latón
  const fondoY = MESA_Y + 0.03, bis = 0.07, altoMarco = MARCO_Y - fondoY;
  const fm = rectRedondeado(new THREE.Shape(), -ANCHO / 2 - MARCO, -ALTO / 2 - MARCO, ANCHO + 2 * MARCO, ALTO + 2 * MARCO, 0.45);
  const hueco = (w, h) => { const p = new THREE.Path(); p.moveTo(-w / 2, -h / 2); p.lineTo(-w / 2, h / 2); p.lineTo(w / 2, h / 2); p.lineTo(w / 2, -h / 2); p.closePath(); return p; };
  fm.holes.push(hueco(ANCHO, ALTO));
  const gm = new THREE.ExtrudeGeometry(fm, { depth: altoMarco - 2 * bis, bevelEnabled: true, bevelThickness: bis, bevelSize: bis, bevelSegments: 4, curveSegments: 10 });
  gm.rotateX(-Math.PI / 2); gm.translate(0, fondoY + bis, 0);
  const marco = new THREE.Mesh(gm, mats.marco); marco.castShadow = true; marco.receiveShadow = true; grupo.add(marco);
  const fondo = new THREE.Mesh(new THREE.BoxGeometry(ANCHO + 1, 0.3, ALTO + 1), new THREE.MeshStandardMaterial({ color: 0x120805 })); fondo.position.y = -0.3; grupo.add(fondo);

  const marcoFino = (w, h, ancho, alto, y, radio, bisel = 0) => {
    const f = radio > 0 ? rectRedondeado(new THREE.Shape(), -w / 2 - ancho, -h / 2 - ancho, w + 2 * ancho, h + 2 * ancho, radio) : new THREE.Shape([new THREE.Vector2(-w / 2 - ancho, -h / 2 - ancho), new THREE.Vector2(w / 2 + ancho, -h / 2 - ancho), new THREE.Vector2(w / 2 + ancho, h / 2 + ancho), new THREE.Vector2(-w / 2 - ancho, h / 2 + ancho)]);
    f.holes.push(hueco(w, h));
    const g = new THREE.ExtrudeGeometry(f, bisel ? { depth: alto - 2 * bisel, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2 } : { depth: alto, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, y + bisel, 0); return g;
  };
  const latones = [marcoFino(ANCHO - 0.4, ALTO - 0.4, 0.17, 0.085, 0.002, 0, 0.02), marcoFino(ANCHO + 1.16, ALTO + 1.16, 0.07, 0.012, MARCO_Y, 0.2)];
  // esquineras
  const i0 = 0.12, L = 3.1, aw = MARCO - 2 * i0, esq = new THREE.Shape();
  esq.moveTo(i0 + 0.4, i0); esq.lineTo(L - 0.55, i0); esq.quadraticCurveTo(L - 0.12, i0 + 0.08, L, i0 + aw / 2); esq.quadraticCurveTo(L - 0.12, i0 + aw - 0.08, L - 0.55, i0 + aw);
  esq.lineTo(i0 + aw + 0.4, i0 + aw); esq.quadraticCurveTo(i0 + aw, i0 + aw, i0 + aw, i0 + aw + 0.4);
  esq.lineTo(i0 + aw, L - 0.55); esq.quadraticCurveTo(i0 + aw - 0.08, L - 0.12, i0 + aw / 2, L); esq.quadraticCurveTo(i0 + 0.08, L - 0.12, i0, L - 0.55);
  esq.lineTo(i0, i0 + 0.4); esq.quadraticCurveTo(i0, i0, i0 + 0.4, i0);
  const X0 = ANCHO / 2 + MARCO, Z0 = ALTO / 2 + MARCO;
  [[-X0, -Z0, 0], [X0, -Z0, -Math.PI / 2], [X0, Z0, Math.PI], [-X0, Z0, Math.PI / 2]].forEach(([x, z, rot]) => {
    const g = new THREE.ExtrudeGeometry(esq, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 8 });
    g.rotateX(Math.PI / 2); g.translate(0, MARCO_Y + 0.045, 0);
    const c = i0 + aw / 2;
    const domo = new THREE.SphereGeometry(0.2, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2); domo.scale(1, 0.6, 1); domo.translate(c, MARCO_Y + 0.045, c);
    const p1 = new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); p1.translate(L - 0.75, MARCO_Y + 0.045, c);
    const p2 = new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); p2.translate(c, MARCO_Y + 0.045, L - 0.75);
    for (const q of [g, domo, p1, p2]) { q.rotateY(rot); q.translate(x, 0, z); latones.push(q); }
  });
  // tachuelas a lo largo del marco
  const tach = (x, z) => { const s = new THREE.SphereGeometry(0.06, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); s.translate(x, MARCO_Y + 0.008, z); latones.push(s); };
  for (let k = -3; k <= 3; k++) { tach(k * 3.3, -ALTO / 2 - MARCO / 2 + 0.035); tach(k * 3.3, ALTO / 2 + MARCO / 2 - 0.035); }
  for (let k = -2; k <= 2; k++) { tach(-ANCHO / 2 - MARCO / 2 + 0.035, k * 3.3); tach(ANCHO / 2 + MARCO / 2 - 0.035, k * 3.3); }
  const laton = new THREE.Mesh(unir(latones), mats.laton); laton.castShadow = true; laton.receiveShadow = true; grupo.add(laton);

  // --- Rutas reales: base clara + trazo punteado (vino en tierra, índigo en río y mar)
  const tGuion = texGuion('guion'), tPuntos = texGuion('puntos');
  tGuion.anisotropy = tPuntos.anisotropy = aniso;
  const matBase = new THREE.MeshStandardMaterial({ color: 0xf6ecd0, transparent: true, opacity: 0.34, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const matLinea = (color, tex) => new THREE.MeshStandardMaterial({ color, map: tex, transparent: true, opacity: 0.74, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const matModo = { tierra: matLinea(0x7b1e24, tGuion), rio: matLinea(0x22407f, tGuion), mar: matLinea(0x22407f, tPuntos) };
  const tVivo = texGuion('guion'), tVivoInv = texGuion('guion'); tVivo.anisotropy = tVivoInv.anisotropy = aniso;
  const matVivaBase = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const matVivaLinea = new THREE.MeshBasicMaterial({ color: 0x0f6f6a, map: tVivo, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const porModo = { tierra: [], rio: [], mar: [] }, bases = [], rutas = [];
  for (const r of RUTAS) {
    const curva = curvaDeRuta(r.d), largo = curva.getLength();
    const puntos = curva.getSpacedPoints(Math.max(8, Math.ceil(largo / 0.05)));
    bases.push(cinta(puntos, 0.11, 1, 0.34, 0.006, altura));
    porModo[r.modo || r.mode].push(cinta(puntos, r.modo === 'mar' ? 0.06 : 0.05, r.modo === 'mar' ? 0.56 : 0.37, 0.34, 0.008, altura));
    const vb = new THREE.Mesh(cinta(puntos, 0.19, 1, 0.34, 0.01, altura), matVivaBase.clone()); vb.renderOrder = 3; vb.visible = false;
    const vl = new THREE.Mesh(cinta(puntos, 0.085, 0.37, 0.34, 0.012, altura), matVivaLinea.clone()); vl.material.map = tVivo; vl.renderOrder = 4; vl.visible = false;
    grupo.add(vb, vl);
    rutas.push({ a: r.a, b: r.b, modo: r.modo || r.mode, puntos, largo, vb, vl, nivel: 0, meta: 0, sentido: 1 });
  }
  const mBase = new THREE.Mesh(unir(bases), matBase); mBase.renderOrder = 1; mBase.receiveShadow = true; grupo.add(mBase);
  for (const m of Object.keys(porModo)) if (porModo[m].length) { const malla = new THREE.Mesh(unir(porModo[m]), matModo[m]); malla.renderOrder = 2; malla.receiveShadow = true; grupo.add(malla); }

  // --- Ciudades
  const matPiedra = new THREE.MeshStandardMaterial({ color: 0xf3e6c4, roughness: 0.72, envMapIntensity: 0.6 });
  const matPuerta = new THREE.MeshStandardMaterial({ color: 0x3a1a10, roughness: 0.8 });
  const gNormal = geometriasCiudad(false), gCapital = geometriasCiudad(true);
  const tAro = texAro(), gAro = new THREE.PlaneGeometry(1, 1); gAro.rotateX(-Math.PI / 2);
  const gBlanco = new THREE.CylinderGeometry(0.46, 0.46, 0.95, 12); gBlanco.translate(0, 0.47, 0);
  const ciudades = new Map(), blancos = [];
  for (const c of CIUDADES) {
    const capital = c.id === 'Bagdad', geos = capital ? gCapital : gNormal, esc = capital ? 1.32 : c.lugar ? 0.42 : 1;
    const nodo = new THREE.Group(); nodo.position.copy(aMundo(c.x, c.y)); nodo.position.y = altura(nodo.position.x, nodo.position.z); grupo.add(nodo);
    const edificio = new THREE.Group(); edificio.scale.setScalar(esc); nodo.add(edificio);
    const matCupula = new THREE.MeshPhysicalMaterial(capital ? { color: 0xd9a441, metalness: 1, roughness: 0.28, envMapIntensity: 1.3, emissive: 0xffb44a, emissiveIntensity: 0 } : { color: 0x2f9a98, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 1.1, emissive: 0x3ad6cf, emissiveIntensity: 0 });
    const m1 = new THREE.Mesh(geos.piedra, matPiedra), m2 = new THREE.Mesh(geos.cupula, matCupula), m3 = new THREE.Mesh(geos.laton, mats.laton), m4 = new THREE.Mesh(geos.arco, matPuerta);
    m4.position.set(0, 0.086, 0.1835);
    for (const m of [m1, m2, m3]) { m.castShadow = true; m.receiveShadow = true; }
    edificio.add(m1, m2, m3, m4);
    const aro = new THREE.Mesh(gAro, new THREE.MeshBasicMaterial({ map: tAro, color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    aro.position.y = 0.012; aro.scale.setScalar(1.25 * esc); aro.renderOrder = 6; aro.visible = false; nodo.add(aro);
    const blanco = new THREE.Mesh(gBlanco, new THREE.MeshBasicMaterial()); blanco.visible = false; blanco.scale.setScalar(esc); blanco.userData = { tipo: 'ciudad', id: c.id }; nodo.add(blanco); if (!c.lugar) blancos.push(blanco);
    const rot = ROTULOS[c.id] || { dx: 0, dy: 40, ax: 0.5, ay: 0, lado: 'centro' };
    const ranuras = RANURAS[rot.lado].map(([x, z]) => { const R = RADIO_RANURA * (capital ? 1.24 : 1); return new THREE.Vector3(x * R, 0, z * R); });
    ciudades.set(c.id, { id: c.id, datos: c, capital, pos: nodo.position.clone(), nodo, edificio, matCupula, aro, blanco, rot, ranuras, ocupantes: [], colorCupula: matCupula.color.getHex(), quemada: false, fuego: null, ardor: 0, lugar: !!c.lugar, escBase: esc, alto: 0.78 * esc, nivel: 0, foco: false, alcance: false, s: 1 });
  }

  // --- Rótulos impresos sobre el mapa (se dibujan cuando las fuentes reales ya cargaron)
  function crearRotulos() {
    const PX = movil ? 4 : 5;
    for (const c of ciudades.values()) {
      if (!medidas.has(c.id)) continue;
      const { tam, tamAr, margen, fNom, fAr, w, h, baseN, baseA, caja } = medidas.get(c.id);
      const cv = lienzo(Math.ceil(w * PX), Math.ceil(h * PX)), g = cv.getContext('2d');
      g.scale(PX, PX); g.lineJoin = 'round'; g.textBaseline = 'alphabetic';
      const x = c.rot.ax === 0 ? margen : c.rot.ax === 1 ? w - margen : w / 2;
      g.textAlign = c.rot.ax === 0 ? 'left' : c.rot.ax === 1 ? 'right' : 'center';
      const pinta = (texto, fuenteTxt, y, color, halo, dir) => { g.font = fuenteTxt.replace(/(\d+)px/, (m, n) => `${n / PX}px`); g.direction = dir; g.strokeStyle = 'rgba(241,227,184,.92)'; g.lineWidth = halo; g.strokeText(texto, x, y); g.fillStyle = color; g.fillText(texto, x, y); };
      pinta(c.id, fNom, baseN, PALETA.tinta, 9, 'ltr');
      pinta(c.datos.ar, fAr, baseA, PALETA.vino, 8, 'rtl');
      const t = aTextura(cv, { aniso }); 
      const geo = new THREE.PlaneGeometry(w * U, h * U); geo.translate((0.5 - c.rot.ax) * w * U, (c.rot.ay - 0.5) * h * U, 0);
      const malla = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
      malla.rotation.x = -Math.PI / 2; malla.renderOrder = 5; malla.receiveShadow = true;
      malla.position.copy(aMundo(c.datos.x + c.rot.dx, c.datos.y + c.rot.dy, Math.max(0, rel.maxEnCaja(caja.x0, caja.y0, caja.x1, caja.y1)) + 0.012));
      grupo.add(malla); c.rotulo = malla;
    }
  }

  // --- Estado visual: foco (cursor), alcance (destinos posibles) y rutas vivas
  function enfocar(id) { for (const c of ciudades.values()) c.foco = c.id === id; }
  function marcarAlcance(desde, ids) {
    for (const c of ciudades.values()) c.alcance = !!ids && ids.has(c.id);
    for (const r of rutas) { const viva = !!ids && (r.a === desde || r.b === desde); r.meta = viva ? 1 : 0; if (viva) { r.sentido = r.a === desde ? 1 : -1; r.vl.material.map = r.sentido > 0 ? tVivo : tVivoInv; } }
  }
  let sucio = false, sPrevia = 1;
  // s = escala de las piezas: crecen un poco al alejar la cámara para que sigan leyéndose (como los peones del tablero 2D).
  function actualizar(t, dt, s = 1) {
    sucio = Math.abs(s - sPrevia) > 0.0005; sPrevia = s;
    const k = 1 - Math.exp(-dt * 10);
    for (const c of ciudades.values()) {
      const meta = c.foco ? 1 : 0, antes = c.nivel;
      c.nivel += (meta - c.nivel) * k; if (Math.abs(c.nivel - meta) < 0.002) c.nivel = meta;
      if (antes !== c.nivel) sucio = true;
      c.s = s; if (c.rotulo) { const sr = Math.min(ROTULO_MAX, s); c.rotulo.scale.set(sr, sr, 1); } c.edificio.scale.setScalar(c.escBase * s * (1 + 0.16 * c.nivel)); c.blanco.scale.setScalar(c.escBase * s);
      c.matCupula.emissiveIntensity = (c.capital ? 0.5 : 0.75) * c.nivel + (c.alcance ? 0.16 + 0.1 * Math.sin(t * 4) : 0);
      const op = Math.max(c.nivel * 0.95, c.alcance ? 0.6 + 0.3 * Math.sin(t * 4) : 0);
      c.aro.visible = op > 0.01; c.aro.material.opacity = op; c.aro.rotation.y = t * 0.5;
      c.aro.scale.setScalar(c.escBase * s * (c.alcance ? 1.3 + 0.08 * Math.sin(t * 4) : 1.25));
    }
    for (const r of rutas) {
      r.nivel += (r.meta - r.nivel) * k; if (Math.abs(r.nivel - r.meta) < 0.004) r.nivel = r.meta;
      const v = r.nivel > 0.005; r.vb.visible = r.vl.visible = v;
      if (v) { r.vb.material.opacity = 0.62 * r.nivel; r.vl.material.opacity = 0.95 * r.nivel; }
    }
    tVivo.offset.x = -t * 1.6; tVivoInv.offset.x = t * 1.6;
    for (const c of ciudades.values()) if (c.fuego) { c.ardor += ((c.quemada ? 1 : 0) - c.ardor) * (1 - Math.exp(-dt * 3)); c.fuego.actualizar(t + c.pos.x, c.ardor); c.fuego.grupo.scale.setScalar(c.escBase * s); if (c.ardor > 0.01) sucio = sucio || false; if (!c.quemada && c.ardor < 0.01) { c.nodo.remove(c.fuego.grupo); c.fuego.destruir(); c.fuego = null; } }
  }
  // Ciudades quemadas: arden (llamas sobre la ciudad, cúpula tiznada) hasta que se quiten de la lista.
  const tLlama = texResplandor();
  function ponerQuemadas(ids) {
    const q = new Set(ids || []);
    for (const c of ciudades.values()) {
      const arde = q.has(c.id); if (arde === !!c.quemada) continue;
      c.quemada = arde; c.matCupula.color.setHex(arde ? 0x3a2a22 : c.colorCupula); c.matCupula.envMapIntensity = arde ? 0.3 : c.capital ? 1.3 : 1.1;
      if (arde && !c.fuego) { c.fuego = crearFuego(tLlama, { alto: 1.25, ancho: 0.55 }); c.ardor = 0; c.fuego.grupo.position.y = 0.3; c.nodo.add(c.fuego.grupo); }
    }
    sucio = true;
  }
  return { ponerQuemadas, grupo, mapa, superficie: sup, relieve: rel, ciudades, rutas, blancos, altura, crearRotulos, enfocar, marcarAlcance, actualizar, get sucio() { return sucio; } };
}
