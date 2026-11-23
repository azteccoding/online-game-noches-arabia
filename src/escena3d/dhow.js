// Dhows: un velero pequeño de vela latina por cada ruta de mar. Espera fondeado frente a la costa donde la ruta entra al agua,
// lleva a la figura siguiendo el trazo de la ruta (con cabeceo, balanceo, estela y espuma) y se queda fondeado donde llega.
// Si está en la otra orilla cuando alguien lo necesita, cruza a recogerlo.
import * as THREE from 'three';
import { NIVEL_MAR } from './relieve.js';
import { lienzo, aTextura } from './texturas.js';

const LARGO = 1.7, MANGA = 0.3, PUNTAL = 0.3;      // eslora, media manga y altura de la borda
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (t) => t * t * (3 - 2 * t);

// --- Modelo: casco curvo de madera con proa alta, cubierta, mástil inclinado, verga y vela latina color marfil
function geometriaCasco() {
  const N = 18, M = 6, pos = [], col = [], idx = [];
  const c1 = new THREE.Color(0x4f2c16), c2 = new THREE.Color(0x8a5a30), c3 = new THREE.Color(0x3a1d0e), c4 = new THREE.Color(0xb98a4e), c = new THREE.Color();
  const manga = (t) => MANGA * Math.sin(Math.PI * (0.1 + 0.9 * t) ** 0.8) ** 0.62 * (t > 0.86 ? 1 - ((t - 0.86) / 0.14) ** 2 * 0.92 : 1);
  const borda = (t) => PUNTAL * (0.62 + 0.3 * (2 * t - 1) ** 2 + 0.75 * Math.max(0, t - 0.74) ** 1.4 * 4 + 0.3 * Math.max(0, 0.16 - t) * 4);
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = (t - 0.5) * LARGO + (t > 0.9 ? (t - 0.9) * 0.9 : 0), b = manga(t), h = borda(t), quilla = -0.1 + 0.1 * Math.max(0, t - 0.8) * 5 * h / PUNTAL;
    const sec = [[0, quilla], [0.5 * b, quilla + 0.035], [0.86 * b, 0.34 * h], [0.98 * b, 0.7 * h], [b, h - 0.02], [b, h], [0.9 * b, h]];
    for (let lado = -1; lado <= 1; lado += 2) sec.forEach(([x, y], m) => {
      pos.push(lado * x, y, z);
      c.copy(m <= 2 ? c1 : m === 3 ? c2 : m === 4 ? c4 : c3); col.push(c.r, c.g, c.b);
    });
  }
  const V = (i, lado, m) => i * (M + 1) * 2 + (lado ? M + 1 : 0) + m;
  for (let i = 0; i < N; i++) for (let m = 0; m < M; m++) {
    idx.push(V(i, 1, m), V(i + 1, 1, m), V(i, 1, m + 1), V(i, 1, m + 1), V(i + 1, 1, m), V(i + 1, 1, m + 1));
    idx.push(V(i, 0, m), V(i, 0, m + 1), V(i + 1, 0, m), V(i, 0, m + 1), V(i + 1, 0, m + 1), V(i + 1, 0, m));
  }
  // espejo de popa
  const p0 = pos.length / 3; for (let m = 0; m <= M; m++) for (const lado of [0, 1]) { const q = V(0, lado, m) * 3; pos.push(pos[q], pos[q + 1], pos[q + 2]); col.push(c1.r, c1.g, c1.b); }
  for (let m = 0; m < M; m++) idx.push(p0 + m * 2, p0 + m * 2 + 1, p0 + m * 2 + 2, p0 + m * 2 + 1, p0 + m * 2 + 3, p0 + m * 2 + 2);
  // cubierta
  const d0 = pos.length / 3, cd = new THREE.Color(0xa87b4a);
  for (let i = 0; i <= N; i++) { const t = i / N, z = (t - 0.5) * LARGO + (t > 0.9 ? (t - 0.9) * 0.9 : 0), b = manga(t) * 0.9, y = borda(t) * 0.62 + (t > 0.8 ? (t - 0.8) * 0.5 : 0); pos.push(-b, y, z, b, y, z); col.push(cd.r, cd.g, cd.b, cd.r * 0.9, cd.g * 0.9, cd.b * 0.9); }
  for (let i = 0; i < N; i++) idx.push(d0 + i * 2, d0 + i * 2 + 1, d0 + i * 2 + 2, d0 + i * 2 + 1, d0 + i * 2 + 3, d0 + i * 2 + 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return { g, borda, manga };
}
function texVela() {
  const c = lienzo(256, 256), g = c.getContext('2d'); g.fillStyle = '#f4ead2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(150,120,80,${0.1 + 0.05 * (i % 2)})`; g.fillRect(i * 30 + 6, 0, 2, 256); }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(120,95,60,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 14, 1); }
  return aTextura(c, { aniso: 4 });
}
function crearModelo(mats, tVela) {
  const grupo = new THREE.Group(), { g: gCasco, borda } = geometriaCasco();
  const casco = new THREE.Mesh(gCasco, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, envMapIntensity: 0.5, side: THREE.DoubleSide }));
  casco.castShadow = true; casco.receiveShadow = true; grupo.add(casco);
  const madera = new THREE.MeshStandardMaterial({ color: 0x4a2814, roughness: 0.6, envMapIntensity: 0.5 });
  const palo = (a, b, r0, r1 = r0) => { const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), 8), madera); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; grupo.add(m); return m; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // roda (proa alta y curva) y codaste
  const roda = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, borda(0.93) * 0.8, LARGO * 0.5 - 0.05), V(0, borda(1) + 0.03, LARGO * 0.5 + 0.06), V(0, borda(1) + 0.25, LARGO * 0.5 + 0.13), V(0, borda(1) + 0.45, LARGO * 0.5 + 0.08)]), 12, 0.03, 7), madera); roda.castShadow = true; grupo.add(roda);
  const remate = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mats.laton); remate.position.set(0, borda(1) + 0.47, LARGO * 0.5 + 0.075); grupo.add(remate);
  palo(V(0, 0.05, -LARGO * 0.5 - 0.01), V(0, borda(0) + 0.16, -LARGO * 0.5 - 0.04), 0.03, 0.022);
  const timon = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.13), madera); timon.position.set(0, 0.06, -LARGO * 0.5 - 0.08); grupo.add(timon);
  // toldilla de popa
  const toldilla = new THREE.Mesh(new THREE.BoxGeometry(MANGA * 1.25, 0.07, 0.34), new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.7 })); toldilla.position.set(0, borda(0.08) * 0.62 + 0.06, -LARGO * 0.5 + 0.26); toldilla.castShadow = true; grupo.add(toldilla);
  // mástil inclinado hacia proa, verga larga y vela latina
  const pie = V(0, 0.16, LARGO * 0.1), tope = V(0, 1.42, LARGO * 0.24);
  palo(pie, tope, 0.032, 0.02);
  const car = V(0.05, 0.5, LARGO * 0.5 - 0.1), pena = V(0.05, 1.95, -LARGO * 0.3), puno = V(0.1, 0.52, -LARGO * 0.5 + 0.12);
  palo(car, pena, 0.02, 0.014);
  const n = 9, pv = [], uv = [], iv = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
    const a = i / n, b = j / n, c = 1 - a - b, p = V(0, 0, 0).addScaledVector(car, a).addScaledVector(pena, b).addScaledVector(puno, c);
    p.x += 0.42 * (a * b + b * c + c * a) * 3 * (1 - 0.5 * b);      // la panza de la vela, hinchada a sotavento
    pv.push(p.x, p.y, p.z); uv.push(a + c * 0.5, b + c * 0.2);
  }
  const I = (i, j) => { let s = 0; for (let k = 0; k < i; k++) s += n - k + 1; return s + j; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) { iv.push(I(i, j), I(i + 1, j), I(i, j + 1)); if (j < n - i - 1) iv.push(I(i + 1, j), I(i + 1, j + 1), I(i, j + 1)); }
  const gv = new THREE.BufferGeometry(); gv.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3)); gv.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gv.setIndex(iv); gv.computeVertexNormals();
  const vela = new THREE.Mesh(gv, new THREE.MeshStandardMaterial({ map: tVela, roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.4, emissive: 0x3a3020, emissiveIntensity: 0.25 })); vela.castShadow = true; vela.receiveShadow = true; grupo.add(vela);
  // jarcia y gallardete
  const cabos = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([tope, V(0, borda(1) + 0.2, LARGO * 0.5 + 0.1), tope, V(-MANGA * 0.9, borda(0.3), -LARGO * 0.2), tope, V(MANGA * 0.9, borda(0.3), -LARGO * 0.2), puno, V(0, borda(0.05), -LARGO * 0.5 + 0.1)]), new THREE.LineBasicMaterial({ color: 0x2a1a10 })); grupo.add(cabos);
  const gall = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([V(0, 1.42, LARGO * 0.24), V(0, 1.52, LARGO * 0.24), V(0, 1.47, LARGO * 0.24 - 0.22)]), new THREE.MeshBasicMaterial({ color: 0x9a2330, side: THREE.DoubleSide })); grupo.add(gall);
  return { grupo, vela, yCubierta: borda(0.4) * 0.62, zPasajero: -LARGO * 0.14 };
}

// tablero: el de crearTablero (rutas con sus puntos y relieve.esMar)
export function crearFlota({ escena, tablero, mats, efectos, sonido }) {
  const barcos = new Map(), tVela = texVela(), esMar = tablero.relieve.esMar, v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  for (const r of tablero.rutas) {
    if (r.modo !== 'mar') continue;
    const P = r.puntos; let i0 = P.findIndex((p) => esMar(p.x, p.z)), i1 = P.length - 1 - P.slice().reverse().findIndex((p) => esMar(p.x, p.z));
    if (i0 < 0 || i1 - i0 < 6) continue;
    const agua = P.slice(i0, i1 + 1).map((p) => new THREE.Vector3(p.x, NIVEL_MAR, p.z)), lon = [0];
    for (let i = 1; i < agua.length; i++) lon.push(lon[i - 1] + agua[i].distanceTo(agua[i - 1]));
    const largo = lon[lon.length - 1], fondeo = Math.min(0.85, largo * 0.27), m = crearModelo(mats, tVela);
    const esc = Math.min(1, Math.max(0.62, largo / 3.4)); m.grupo.scale.setScalar(esc);
    escena.add(m.grupo);
    const b = { clave: r.a + '|' + r.b, ruta: r, i0, i1, agua, lon, largo, s: fondeo, sFondeo: [fondeo, largo - fondeo], extremo: 0, estado: 'fondeado', sentido: 1, vel: 0, meta: fondeo, reservado: null, cola: [], rumbo: 0, fase: Math.random() * 6, modelo: m, esc,
      estelas: [efectos.crearEstela(0xbfe0da, 46, 1.7), efectos.crearEstela(0xbfe0da, 46, 1.7)], tEspuma: 0, tOla: 0 };
    barcos.set(b.clave, b); barcos.set(r.b + '|' + r.a, b);
    situar(b, 0, 0); b.rumbo = b.rumboMeta; situar(b, 0, 0);
  }
  function puntoEn(b, s, out) {
    s = Math.min(b.largo, Math.max(0, s)); let i = 1; while (i < b.lon.length - 1 && b.lon[i] < s) i++;
    const u = (s - b.lon[i - 1]) / Math.max(1e-6, b.lon[i] - b.lon[i - 1]); return out.copy(b.agua[i - 1]).lerp(b.agua[i], u);
  }
  function situar(b, t, dt) {
    const p = puntoEn(b, b.s, v1), q = puntoEn(b, b.s + 0.25 * b.sentido, v2);
    if (q.distanceToSquared(p) > 1e-6) b.rumboMeta = Math.atan2(q.x - p.x, q.z - p.z);
    let dif = (b.rumboMeta ?? 0) - b.rumbo; dif = Math.atan2(Math.sin(dif), Math.cos(dif)); b.rumbo += dif * (dt ? 1 - Math.exp(-dt * 3.2) : 0);
    const g = b.modelo.grupo, marcha = Math.min(1, Math.abs(b.vel) / 2.2);
    g.position.set(p.x, NIVEL_MAR + 0.012 * Math.sin(t * 1.9 + b.fase) - 0.01, p.z);
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
    if (b.estado === 'fondeado' && b.extremo === extremo) return true;
    if (b.estado === 'fondeado') { b.estado = 'viniendo'; b.meta = b.sFondeo[extremo]; b.sentido = extremo ? 1 : -1; b.extremoMeta = extremo; }
    return false;
  }
  function zarpar(b, quien) {
    if (b.reservado !== quien || b.estado !== 'fondeado') return false;
    const destino = 1 - b.extremo; b.estado = 'llevando'; b.meta = b.sFondeo[destino]; b.sentido = destino ? 1 : -1; b.extremoMeta = destino;
    sonido?.tocar('barco-zarpar'); if (!b.sonando) { b.sonando = true; sonido?.bucle('barco-navegar', true); }
    efectos.onda(v1.copy(b.modelo.grupo.position).setY(NIVEL_MAR), 1.6, 0xdff2ee);
    return true;
  }
  const llego = (b) => b.estado === 'fondeado';
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
      if (b.estado !== 'fondeado') {
        sucio = true;
        const falta = (b.meta - b.s) * b.sentido, tope = b.estado === 'viniendo' ? 5.2 : Math.min(3.4, Math.max(1.5, b.largo / 3.2));
        const velMeta = tope * Math.min(1, 0.18 + falta / 0.9);
        b.vel += (velMeta - b.vel) * (1 - Math.exp(-dt * 2.6));
        b.s += b.sentido * b.vel * dt;
        if (falta <= 0.02 || (b.meta - b.s) * b.sentido <= 0) {
          b.s = b.meta; b.vel = 0; b.extremo = b.extremoMeta; const llevaba = b.estado === 'llevando'; b.estado = 'fondeado';
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
      situar(b, t, dt);
    }
  }
  function destruir() { tVela.dispose(); }
  return { de, extremoDe, pedir, zarpar, llego, soltar, cubierta, orilla, actualizar, destruir, barcos, get sucio() { return sucio; } };
}
