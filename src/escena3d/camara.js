// Cámara: órbita, zoom y desplazamiento suaves (ratón y táctil), con límites, vuelos de presentación y acompañamiento de fichas.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ANCHO, ALTO } from './medidas.js';
import { MARCO, MARCO_Y } from './tablero.js';
import { BANDEJA } from './dados.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const suaveCubo = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const suaveSal = (t) => 1 - (1 - t) ** 3;

export function crearCamara(el) {
  const cam = new THREE.PerspectiveCamera(36, 1, 0.2, 2500);
  const estado = { W: 1, H: 1, margen: { izq: 0, der: 0, arr: 0, aba: 0 } };
  let dMeta = null, ancla = null, vuelo = null, compas = null, tocado = false, enGeneral = true;
  // La rueda (o el pellizco) lleva de la vista de pájaro al pie de calle: lejos se mira casi desde arriba y, al acercarse, la cámara
  // baja hasta quedar a la altura de las figuras, mirando hacia el horizonte.
  const POL_LEJOS = 0.14, POL_CERCA = 1.40, D_CERCA = 3.2;
  let dLejos = 40, dPrevia = null, inclinar = 0;
  // A pie de calle la cámara sube a la altura de los ojos de las figuras (si no, les cortaría la cabeza): se suma al final de cada cuadro.
  const ALZA = 0.85; let alza = 0;
  const alzaDe = (pol) => ALZA * clamp((pol - 0.85) / (POL_CERCA - 0.85), 0, 1) ** 2;
  function polDe(d) {
    const t = clamp(Math.log(dLejos / Math.max(d, 0.01)) / Math.log(dLejos / D_CERCA), 0, 1);
    return POL_LEJOS + (POL_CERCA - POL_LEJOS) * t ** 1.3;
  }
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), rayo = new THREE.Raycaster(), ndc = new THREE.Vector2(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

  function puntoSuelo(cx, cy) {
    const r = el.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(ndc, cam); const p = rayo.ray.intersectPlane(plano, new THREE.Vector3());
    return p && p.length() < 60 ? p : null;
  }
  // La rueda se suaviza aquí (y acerca hacia el cursor); va antes de OrbitControls para que no la procese dos veces.
  const alRodar = (e) => {
    e.preventDefault(); e.stopImmediatePropagation(); interrumpir();
    let delta = e.deltaY; if (e.deltaMode === 1) delta *= 32; else if (e.deltaMode === 2) delta *= 400;
    const d = dMeta ?? cam.position.distanceTo(ctl.target);
    dMeta = clamp(d * Math.exp(clamp(delta, -500, 500) * (e.ctrlKey ? 0.009 : 0.0012)), ctl.minDistance, ctl.maxDistance);
    ancla = puntoSuelo(e.clientX, e.clientY);
  };
  el.addEventListener('wheel', alRodar, { passive: false });

  // Teclado (Jorge, 23 de noviembre): las flechas mueven la cámara sobre el mapa (arriba = adelante, hacia donde mira) y + / − del
  // teclado numérico (o del teclado normal) acercan y alejan. No actúan mientras se escribe en un campo.
  const flechas = new Set();
  const escribiendo = (ev) => { const t = ev.target; return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')); };
  const FLECHAS = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };
  function zoomTecla(f) { interrumpir(); const d = dMeta ?? cam.position.distanceTo(ctl.target); dMeta = clamp(d * f, ctl.minDistance, ctl.maxDistance); ancla = null; }
  const alTecla = (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || escribiendo(ev)) return;
    // Con Shift, las flechas recorren el menú abierto (App.jsx), no mueven la cámara.
    if (FLECHAS[ev.key] && !ev.shiftKey) { ev.preventDefault(); if (!flechas.has(ev.key)) interrumpir(); flechas.add(ev.key); return; }
    if (ev.key === '+' || ev.code === 'NumpadAdd') { ev.preventDefault(); zoomTecla(0.8); }
    else if (ev.key === '-' || ev.code === 'NumpadSubtract') { ev.preventDefault(); zoomTecla(1.25); }
  };
  const alSoltar = (ev) => { flechas.delete(ev.key); };
  const alPerderFoco = () => flechas.clear();
  window.addEventListener('keydown', alTecla); window.addEventListener('keyup', alSoltar); window.addEventListener('blur', alPerderFoco);
  const adelante = new THREE.Vector3(), lado = new THREE.Vector3();
  function moverConFlechas(dt) {
    if (!flechas.size || vuelo) return;
    const fz = (flechas.has('ArrowUp') ? 1 : 0) - (flechas.has('ArrowDown') ? 1 : 0), fx = (flechas.has('ArrowRight') ? 1 : 0) - (flechas.has('ArrowLeft') ? 1 : 0);
    if (!fz && !fx) return;
    cam.getWorldDirection(adelante); adelante.y = 0;
    if (adelante.lengthSq() < 1e-6) adelante.set(0, 0, -1); adelante.normalize();
    lado.set(-adelante.z, 0, adelante.x);
    const vel = Math.max(0.8, cam.position.distanceTo(ctl.target) * 0.22) * dt;   // más lejos, más rápido
    v2.copy(adelante).multiplyScalar(fz).addScaledVector(lado, fx).normalize().multiplyScalar(vel);
    ctl.target.add(v2); cam.position.add(v2);
  }

  const ctl = new OrbitControls(cam, el);
  ctl.enableDamping = true; ctl.dampingFactor = 0.085; ctl.rotateSpeed = 0.55; ctl.panSpeed = 1.0; ctl.zoomSpeed = 0.9;
  ctl.screenSpacePanning = false;
  ctl.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  ctl.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  ctl.minPolarAngle = 0.1; ctl.maxPolarAngle = 1.43; ctl.minDistance = D_CERCA; ctl.maxDistance = 120;
  ctl.addEventListener('start', () => { interrumpir(); dMeta = null; });
  function interrumpir() { if (vuelo) { const f = vuelo.alInterrumpir; vuelo = null; f?.(); } compas = null; tocado = true; enGeneral = false; }

  const LIM = { x: ANCHO / 2 + 0.8, z0: BANDEJA.z - BANDEJA.h / 2, z1: ALTO / 2 + 0.8 };
  const limitar = (t) => { t.x = clamp(t.x, -LIM.x, LIM.x); t.z = clamp(t.z, LIM.z0, LIM.z1); t.y = 0; };

  const esf = new THREE.Spherical();
  function leer() { v1.copy(cam.position).sub(ctl.target); v1.y -= alza; esf.setFromVector3(v1); return { x: ctl.target.x, z: ctl.target.z, d: esf.radius, pol: esf.phi, az: esf.theta }; }
  function poner(p) { ctl.target.set(p.x, 0, p.z); esf.set(p.d, clamp(p.pol, 0.02, 1.5), p.az); cam.position.setFromSpherical(esf).add(ctl.target); cam.lookAt(ctl.target); alza = 0; }

  // Distancia a la que un conjunto de puntos cabe en la zona libre de la pantalla (sin los paneles).
  const camPrueba = new THREE.PerspectiveCamera();
  function distanciaParaVer(puntos, p, holgura = 0.965) {
    const m = estado.margen, lx = clamp((estado.W - m.izq - m.der) / estado.W, 0.3, 1) * holgura, ly = clamp((estado.H - m.arr - m.aba) / estado.H, 0.3, 1) * holgura;
    camPrueba.fov = cam.fov; camPrueba.aspect = estado.W / estado.H; camPrueba.near = 0.5; camPrueba.far = 2500; camPrueba.updateProjectionMatrix();
    let a = 4, b = 500;
    for (let i = 0; i < 26; i++) {
      const d = (a + b) / 2; esf.set(d, p.pol, p.az); camPrueba.position.setFromSpherical(esf).add(v2.set(p.x, 0, p.z)); camPrueba.lookAt(v2); camPrueba.updateMatrixWorld();
      let cabe = true;
      for (const q of puntos) { v1.copy(q).project(camPrueba); if (Math.abs(v1.x) > lx || Math.abs(v1.y) > ly || v1.z > 1) { cabe = false; break; } }
      if (cabe) b = d; else a = d;
    }
    return b;
  }
  const X = ANCHO / 2 + MARCO, Z = ALTO / 2 + MARCO, Zb = BANDEJA.z - BANDEJA.h / 2 - BANDEJA.pared;
  const PUNTOS_MESA = [[-X, -Z], [X, -Z], [-X, Z], [X, Z], [BANDEJA.x - BANDEJA.w / 2 - 0.6, Zb], [BANDEJA.x + BANDEJA.w / 2 + 0.6, Zb]].map(([x, z]) => new THREE.Vector3(x, MARCO_Y, z));
  const PUNTOS_DADOS = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => new THREE.Vector3(BANDEJA.x + sx * (BANDEJA.w / 2 + 1.2), 1.4, BANDEJA.z + sz * (BANDEJA.h / 2 + 1.2)));

  function vistaGeneral() { const p = { x: 0, z: -1.5, pol: POL_LEJOS, az: 0 }; p.d = distanciaParaVer(PUNTOS_MESA, p); return p; }
  function vistaDados(az = 0) { const p = { x: BANDEJA.x, z: BANDEJA.z + 0.3, pol: 0.66, az: clamp(az, -0.5, 0.5) }; p.d = Math.max(10, distanciaParaVer(PUNTOS_DADOS, p, 0.8)); return p; }

  function volar(a, dur = 1.4, { curva = suaveCubo, alTerminar, alInterrumpir } = {}) {
    const de = leer(); let daz = a.az - de.az; daz = Math.atan2(Math.sin(daz), Math.cos(daz));
    dMeta = null; compas = null; enGeneral = false;
    vuelo = { de, a: { ...a, az: de.az + daz }, t: 0, dur, curva, alTerminar, alInterrumpir };
  }
  // La cámara acompaña a la ficha que viaja: se desliza una parte del camino hacia su destino.
  function acompanar(destino, dur, peso = 0.6) {
    if (vuelo) return;
    const de = ctl.target.clone(), a = de.clone().lerp(destino, peso); limitar(a);
    compas = { de, a, t: 0, dur, previo: de.clone() }; enGeneral = false;
  }
  function enPantalla(p, borde = 0.72) { v1.copy(p).project(cam); return Math.abs(v1.x) < borde && Math.abs(v1.y) < borde; }

  function redimensionar(W, H, margen) {
    estado.W = W; estado.H = H; estado.margen = margen;
    cam.aspect = W / H;
    // centra la escena en la zona libre de paneles
    cam.setViewOffset(W, H, -(margen.izq - margen.der) / 2, -(margen.arr - margen.aba) / 2, W, H);
    cam.updateProjectionMatrix();
    dLejos = vistaGeneral().d; ctl.maxDistance = Math.max(60, dLejos * 1.25);
  }

  function actualizar(dt) {
    cam.position.sub(desvio); desvio.set(0, 0, 0); cam.position.y -= alza; alza = 0;
    if (vuelo) {
      vuelo.t = Math.min(1, vuelo.t + dt / vuelo.dur); const e = vuelo.curva(vuelo.t), A = vuelo.de, Bv = vuelo.a, L = (x, y) => x + (y - x) * e;
      poner({ x: L(A.x, Bv.x), z: L(A.z, Bv.z), d: L(A.d, Bv.d), pol: L(A.pol, Bv.pol), az: L(A.az, Bv.az) });
      if (vuelo.t >= 1) { const f = vuelo.alTerminar; vuelo = null; f?.(); }
    } else if (compas) {
      compas.t = Math.min(1, compas.t + dt / compas.dur); const e = suaveCubo(compas.t);
      v1.lerpVectors(compas.de, compas.a, e); v2.copy(v1).sub(compas.previo); compas.previo.copy(v1);
      ctl.target.add(v2); cam.position.add(v2);
      if (compas.t >= 1) compas = null;
    } else if (dMeta != null) {
      const d = cam.position.distanceTo(ctl.target); let nd = d + (dMeta - d) * (1 - Math.exp(-dt * 9));
      if (Math.abs(nd - dMeta) < 0.003 * dMeta) { nd = dMeta; dMeta = null; }
      const k = nd / d; v1.copy(cam.position).sub(ctl.target).multiplyScalar(k);
      if (ancla) { ctl.target.sub(ancla).multiplyScalar(k).add(ancla); limitar(ctl.target); }
      cam.position.copy(ctl.target).add(v1);
    }
    ctl.update(dt);
    // Inclinación ligada a la distancia: mientras cambia el zoom (rueda o pellizco) y un instante después, la cámara busca el ángulo
    // que le toca a esa distancia. Los vuelos de presentación (dados, pelea, genio) llevan su propio ángulo.
    if (!vuelo) {
      const p = leer();
      if (dPrevia != null && Math.abs(p.d - dPrevia) > 1e-4 * p.d) inclinar = 0.5;
      if (inclinar > 0) {
        inclinar -= dt; const meta = polDe(dMeta ?? p.d);
        if (Math.abs(meta - p.pol) > 0.002) { p.pol += (meta - p.pol) * (1 - Math.exp(-dt * 8)); poner(p); }
      }
      dPrevia = p.d;
    } else { dPrevia = null; inclinar = 0; }
    moverConFlechas(dt);
    const antes = v2.copy(ctl.target); limitar(ctl.target);
    if (!antes.equals(ctl.target)) { /* el objetivo tocó el límite: la cámara lo acompaña para no cambiar el ángulo */ cam.position.add(v1.copy(ctl.target).sub(antes)); }
    alza = alzaDe(leer().pol); cam.position.y += alza;
    if (tiembla > 0.002) { desvio.set((Math.random() - 0.5) * 2 * tiembla, (Math.random() - 0.5) * 2 * tiembla, (Math.random() - 0.5) * tiembla); cam.position.add(desvio); tiembla *= Math.exp(-dt * 11); } else tiembla = 0;
  }
  // Encuadre para que un grupo de puntos quepa en la zona libre, y temblor breve para los golpes.
  function encuadre(puntos, p, holgura = 0.85) { return { ...p, d: clamp(distanciaParaVer(puntos, p, holgura), ctl.minDistance, 40) }; }
  let tiembla = 0; const desvio = new THREE.Vector3();
  function temblor(a) { tiembla = Math.max(tiembla, a); }
  function girar(pasos) { const p = leer(); volar({ ...p, az: p.az + pasos * (Math.PI / 4) }, 0.7, { curva: suaveSal }); }

  function destruir() { el.removeEventListener('wheel', alRodar); window.removeEventListener('keydown', alTecla); window.removeEventListener('keyup', alSoltar); window.removeEventListener('blur', alPerderFoco); ctl.dispose(); }
  return { destruir, cam, ctl, leer, poner, polDe, volar, acompanar, enPantalla, vistaGeneral, vistaDados, encuadre, temblor, redimensionar, actualizar, girar, interrumpir, puntoSuelo, get enVuelo() { return !!vuelo; }, get tocado() { return tocado; }, set tocado(v) { tocado = v; }, get enGeneral() { return enGeneral; }, set enGeneral(v) { enGeneral = v; } };
}
