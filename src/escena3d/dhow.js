// Dhows: un velero pequeño de vela latina por cada ruta de mar. Espera fondeado frente a la costa donde la ruta entra al agua,
// lleva a la figura siguiendo el trazo de la ruta (con cabeceo, balanceo, estela y espuma) y se queda fondeado donde llega.
// Si está en la otra orilla cuando alguien lo necesita, cruza a recogerlo.
import * as THREE from 'three';
import { NIVEL_MAR } from './relieve.js';
import { crearModeloPintado, texturaPintada } from './animalPintado.js';
import hojaDhow from './datos/animal-dhow.json';

const LARGO = 1.7;      // eslora de referencia (estela y espuma)

// Dhow pintado (Jorge, 23 de noviembre): se levanta de su hoja de vistas como los animales (ver animalPintado.js). La hoja lo
// trae «sacado del agua»; aquí se hunde hasta la línea de flotación. Mide de punta a punta lo mismo que el de antes, con la proa a +Z.
const ESLORA_PINTADO = 1.95, CALADO = 0.09, CUBIERTA = 0.205;      // calado y cubierta: fracción de la altura de la hoja (de la quilla hacia arriba)
function crearModeloPintado2() {
  const alto = (ESLORA_PINTADO * hojaDhow.th) / hojaDhow.tw;
  const M = crearModeloPintado(hojaDhow, texturaPintada('dhow'), { alto, centroX: hojaDhow.tw / 2, material: { roughness: 0.72 } });
  const grupo = new THREE.Group(); M.malla.position.y = -CALADO * alto; grupo.add(M.malla);
  return { grupo, vela: new THREE.Object3D(), yCubierta: (CUBIERTA - CALADO) * alto, zPasajero: -0.12 * ESLORA_PINTADO };
}

// tablero: el de crearTablero (rutas con sus puntos y relieve.esMar)
export function crearFlota({ escena, tablero, mats, efectos, sonido }) {
  const barcos = new Map(), esMar = tablero.relieve.esMar, v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  for (const r of tablero.rutas) {
    if (r.modo !== 'mar') continue;
    const P = r.puntos; let i0 = P.findIndex((p) => esMar(p.x, p.z)), i1 = P.length - 1 - P.slice().reverse().findIndex((p) => esMar(p.x, p.z));
    if (i0 < 0 || i1 - i0 < 6) continue;
    const agua = P.slice(i0, i1 + 1).map((p) => new THREE.Vector3(p.x, NIVEL_MAR, p.z)), lon = [0];
    for (let i = 1; i < agua.length; i++) lon.push(lon[i - 1] + agua[i].distanceTo(agua[i - 1]));
    const largo = lon[lon.length - 1], fondeo = Math.min(0.85, largo * 0.27), m = crearModeloPintado2();
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
  function destruir() { /* las texturas pintadas se comparten */ }
  return { de, extremoDe, pedir, zarpar, llego, soltar, cubierta, orilla, actualizar, destruir, barcos, get sucio() { return sucio; } };
}
