// Dados: las caras reales del juego sobre una bandeja de madera, latón y terciopelo. Ruedan con física de cuerpos rígidos
// y caen EXACTAMENTE en los valores que se piden (los decide el servidor): la tirada se simula entera antes de mostrarla y,
// como un dado es simétrico, se gira qué cara lleva cada número para que esa misma caída muestre el valor pedido.
// Admite varias filas (grupos) de hasta 6 dados, cada una de un color; al terminar de rodar, cada fila se ordena al fondo
// de la bandeja y ahí se queda hasta limpiar().
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ALTO } from './medidas.js';
import { lienzo, aTextura, texTerciopelo } from './texturas.js';
import { rectRedondeado, MESA_Y } from './ambiente.js';
import { MARCO } from './tablero.js';

// La bandeja queda al fondo de la mesa (norte), entre los dos faroles.
export const BANDEJA = { x: 0, z: -(ALTO / 2 + MARCO + 3.0 + 2.1), w: 7.0, h: 4.2, pared: 0.55, alto: 0.72 };
const LADO = 0.66, G = -44;
// Orden de materiales de una caja: +x, -x, +y, -y, +z, -z. Caras opuestas suman 7.
const VALOR_CARA = [3, 4, 1, 6, 2, 5];
const NORMALES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((n) => new THREE.Vector3(...n));

const MAX_POR_FILA = 6, MAX_FILAS = 6;
// Los mismos colores que usa el juego para sus dados (src/components/Dados.jsx).
export const COLORES_DADO = {
  rojo: { g: ['#e2383f', '#b3202a', '#7c1018'], borde: '#4a0a10', pip: ['#fff', '#e8dfd0'] },
  amarillo: { g: ['#ffe27a', '#e9b62a', '#b07d0c'], borde: '#6b4a05', pip: ['#4a2e05', '#2a1802'] },
  azul: { g: ['#4f8fe0', '#2459b3', '#123571'], borde: '#0b1f45', pip: ['#fff', '#dfe8f5'] },
  verde: { g: ['#5cc77a', '#2e8f4c', '#165a2c'], borde: '#0c3a1b', pip: ['#fff', '#e0f2e4'] },
};

// recursos.carasSVG: { 1: '<svg…>', …, 6: '<svg…>' } (las caras reales del juego; aquí se tiñen del color pedido y se rasterizan).
// enMapa: ayudante opcional (dadosMapa.js) para que la tirada caiga sobre el mapa en lugar de en la bandeja; sin él, nada cambia.
export function crearDados(escena, mats, recursos, renderer, sonido, { menosMovimiento = false, enMapa = null } = {}) {
  const pisoY = MESA_Y + 0.12;       // fondo de terciopelo de la bandeja
  const B = BANDEJA;

  // --- Bandeja
  const grupo = new THREE.Group(); grupo.position.set(B.x, 0, B.z); escena.add(grupo);
  // Dados y rótulos cuelgan de «raiz»: en la bandeja no se mueve; sobre el mapa, dadosMapa.js la lleva entera al claro elegido.
  const raiz = new THREE.Group(); escena.add(raiz);
  if (enMapa) grupo.visible = false;
  const forma = rectRedondeado(new THREE.Shape(), -B.w / 2 - B.pared, -B.h / 2 - B.pared, B.w + 2 * B.pared, B.h + 2 * B.pared, 0.5);
  const hueco = rectRedondeado(new THREE.Path(), -B.w / 2, -B.h / 2, B.w, B.h, 0.22); forma.holes.push(hueco);
  const bis = 0.06, gMarco = new THREE.ExtrudeGeometry(forma, { depth: B.alto + 0.12 - 2 * bis, bevelEnabled: true, bevelThickness: bis, bevelSize: bis, bevelSegments: 3, curveSegments: 10 });
  gMarco.rotateX(-Math.PI / 2); gMarco.translate(0, MESA_Y + bis, 0);
  const marco = new THREE.Mesh(gMarco, mats.marco); marco.castShadow = true; marco.receiveShadow = true; grupo.add(marco);
  const tv = texTerciopelo(); tv.repeat.set(5, 3.4);
  const fondo = new THREE.Mesh(new THREE.PlaneGeometry(B.w + 0.2, B.h + 0.2), new THREE.MeshPhysicalMaterial({ map: tv, roughness: 1, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xb8444c), envMapIntensity: 0.2 }));
  fondo.rotation.x = -Math.PI / 2; fondo.position.y = pisoY; fondo.receiveShadow = true; grupo.add(fondo);
  const filete = (w, h, ancho, alto, y, r) => { const f = rectRedondeado(new THREE.Shape(), -w / 2 - ancho, -h / 2 - ancho, w + 2 * ancho, h + 2 * ancho, r + ancho); f.holes.push(rectRedondeado(new THREE.Path(), -w / 2, -h / 2, w, h, r)); const g = new THREE.ExtrudeGeometry(f, { depth: alto, bevelEnabled: false, curveSegments: 10 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
  const topeY = MESA_Y + B.alto + 0.12;
  const lat = new THREE.Mesh(filete(B.w + 0.42, B.h + 0.42, 0.07, 0.012, topeY, 0.36), mats.laton); grupo.add(lat);
  const lat2 = new THREE.Mesh(filete(B.w - 0.16, B.h - 0.16, 0.09, 0.03, pisoY, 0.2), mats.laton); grupo.add(lat2);

  // --- Caras: el SVG real de cada cara, teñido del color pedido ('rojo', 'amarillo', 'azul', 'verde' o cualquier color CSS)
  const juegos = new Map();      // color → Promise<materiales[6]>
  function paletaDe(color) {
    if (COLORES_DADO[color]) return COLORES_DADO[color];
    const base = new THREE.Color(color), hsl = base.getHSL({}), tono = (dl) => '#' + new THREE.Color().setHSL(hsl.h, hsl.s, Math.min(0.95, Math.max(0.03, hsl.l + dl))).getHexString();
    return { g: [tono(0.13), tono(0), tono(-0.14)], borde: tono(-0.24), pip: hsl.l > 0.62 ? ['#4a2e05', '#2a1802'] : ['#fff', '#e8dfd0'] };
  }
  function materialesDe(color = 'rojo') {
    const clave = String(color || 'rojo');
    if (!juegos.has(clave)) juegos.set(clave, (async () => {
      const c = paletaDe(clave), mats6 = [];
      for (let k = 0; k < 6; k++) {
        const svg = recursos.carasSVG[VALOR_CARA[k]].replace(/#e2383f/gi, c.g[0]).replace(/#b3202a/gi, c.g[1]).replace(/#7c1018/gi, c.g[2]).replace(/#4a0a10/gi, c.borde)
          .replace(/(<radialGradient id="pip"[^>]*>)[\s\S]*?(<\/radialGradient>)/, `$1<stop offset="0" stop-color="${c.pip[0]}"/><stop offset="1" stop-color="${c.pip[1]}"/>$2`).replace(/width="100" height="100"/, 'width="384" height="384"');
        const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
        const cv = lienzo(384, 384), g = cv.getContext('2d'); g.fillStyle = c.g[2]; g.fillRect(0, 0, 384, 384); g.drawImage(img, 0, 0, 384, 384);
        const t = aTextura(cv, { aniso: renderer.capabilities.getMaxAnisotropy() });
        mats6.push(new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.18, envMapIntensity: 1.0 }));
      }
      return mats6;
    })());
    return juegos.get(clave);
  }
  const geo = new RoundedBoxGeometry(LADO, LADO, LADO, 5, 0.085);

  // --- Mundo físico: piso, cuatro paredes y un tope móvil que protege las filas ya ordenadas al fondo
  const mundo = new CANNON.World({ gravity: new CANNON.Vec3(0, G, 0) });
  mundo.allowSleep = true; mundo.solver.iterations = 14;
  const mDado = new CANNON.Material('dado'), mPiso = new CANNON.Material('piso'), mPared = new CANNON.Material('pared');
  mundo.addContactMaterial(new CANNON.ContactMaterial(mDado, mPiso, { friction: 0.3, restitution: 0.56 }));
  mundo.addContactMaterial(new CANNON.ContactMaterial(mDado, mPared, { friction: 0.12, restitution: 0.62 }));
  mundo.addContactMaterial(new CANNON.ContactMaterial(mDado, mDado, { friction: 0.2, restitution: 0.44 }));
  const piso = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: mPiso });
  piso.quaternion.setFromEuler(-Math.PI / 2, 0, 0); piso.position.set(0, pisoY, 0); mundo.addBody(piso);
  const pared = (x, z, sx, sz) => { const b = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(sx, 4, sz)), material: mPared }); b.position.set(B.x + x, pisoY + 4, B.z + z); mundo.addBody(b); return b; };
  pared(-B.w / 2 - 1, 0, 1, B.h / 2 + 2); pared(B.w / 2 + 1, 0, 1, B.h / 2 + 2); pared(0, B.h / 2 + 1, B.w / 2 + 2, 1);
  const fondo2 = pared(0, -B.h / 2 - 1, B.w / 2 + 2, 1);      // la pared del fondo avanza para dejar sitio a las filas ordenadas

  // --- Dados y filas
  const ESC_FILA = 0.8, PASO_X = LADO * ESC_FILA + 0.13, PASO_Z = LADO * ESC_FILA + 0.12;
  const libres = [], filas = [];      // filas: [{ etq, dados: [...], rotulo }]
  let grabando = null, tSim = 0;
  function tomarDado() {
    let d = libres.pop();
    if (!d) {
      const malla = new THREE.Mesh(geo, []); malla.castShadow = true; malla.receiveShadow = true; raiz.add(malla);
      const cuerpo = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(LADO / 2, LADO / 2, LADO / 2)), material: mDado, angularDamping: 0.07, linearDamping: 0.02, allowSleep: true, sleepSpeedLimit: 0.2, sleepTimeLimit: 0.3 });
      cuerpo.addEventListener('collide', (e) => { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (grabando && v > 0.6) grabando.push({ t: tSim, fuerza: Math.min(1, v / 14), variante: e.body === piso ? 'fieltro' : 'madera', x: cuerpo.position.x, z: cuerpo.position.z }); });
      d = { malla, cuerpo, fix: new THREE.Quaternion(), de: new THREE.Vector3(), a: new THREE.Vector3(), qDe: new THREE.Quaternion(), qA: new THREE.Quaternion(), qAFix: new THREE.Quaternion(), enMundo: false };
    }
    d.malla.visible = true; d.malla.scale.setScalar(0.001); d.fix.identity(); d.saliendo = 0;
    return d;
  }
  const alMundo = (d, v) => { if (v !== d.enMundo) { d.enMundo = v; if (v) mundo.addBody(d.cuerpo); else mundo.removeBody(d.cuerpo); } };
  function soltarDado(d) { alMundo(d, false); d.malla.visible = false; libres.push(d); }
  // Rótulo de una fila (la etiqueta del grupo), tendido sobre el terciopelo a la izquierda de sus dados.
  function rotuloDe(texto) {
    const cv = lienzo(512, 96), g = cv.getContext('2d'); g.font = 'italic 500 54px "Alegreya", Georgia, serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
    let t = texto; while (g.measureText(t).width > 496 && t.length > 4) t = t.slice(0, -2); if (t !== texto) t = t.trimEnd() + '…';
    g.shadowColor = enMapa ? 'rgba(255,244,214,.9)' : 'rgba(0,0,0,.7)'; g.shadowBlur = 6; g.fillStyle = enMapa ? '#3b2208' : '#f6e6bd'; g.fillText(t, 506, 50);      // sobre el mapa, tinta oscura
    const tex = aTextura(cv, { aniso: 8 }), m = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.43), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 4; raiz.add(m); return m;
  }
  // Sitio de cada dado de una fila ya ordenada (al fondo de la bandeja, una fila detrás de otra)
  function sitio(iFila, k, n, out) { return out.set(B.x + (k - (n - 1) / 2) * PASO_X + 0.55, pisoY + (LADO * ESC_FILA) / 2, B.z - B.h / 2 + 0.42 + iFila * PASO_Z); }
  function ajustarFondo() { fondo2.aabbNeedsUpdate = true; fondo2.position.z = B.z - B.h / 2 - 1 + (filas.length ? 0.1 + filas.length * PASO_Z : 0); }

  // Cara superior de un dado: la normal local que más apunta hacia arriba.
  const v = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), EJE_Y = new THREE.Vector3(0, 1, 0);
  function caraArriba(q) { let mejor = -2, valor = 0, k0 = 0; for (let k = 0; k < 6; k++) { const y = v.copy(NORMALES[k]).applyQuaternion(q).y; if (y > mejor) { mejor = y; valor = VALOR_CARA[k]; k0 = k; } } return { valor, plano: mejor, indice: k0 }; }
  // Giro que deja el dado bien plano y encarado (sin cambiar la cara de arriba), para ordenarlo en su fila.
  function encarado(q, out) {
    const arriba = caraArriba(q).indice, lado = NORMALES[(arriba + 2) % 6], d = v.copy(lado).applyQuaternion(q), ang = Math.atan2(d.z, d.x), giro = ang - Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
    out.setFromAxisAngle(EJE_Y, giro).multiply(q);
    const up = v.copy(NORMALES[arriba]).applyQuaternion(out); return out.premultiply(q2.setFromUnitVectors(up, EJE_Y));
  }

  let estado = 'quieto';       // quieto | preparando | alzando | rodando | ordenando | limpiando
  let tFase = 0, cinta = null, iGolpe = 0, cola = null, actual = null, alTerminar = null, resultado = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const PASO = 1 / 120, CADA = 2;      // la simulación va a 120 pasos por segundo y se guarda un cuadro cada dos
  // Segundos que rueda una fila a la vista. Sumando alzar (0,25) y ordenar (0,35): una fila sola, de 2,6 a 3,0 s; cuando la
  // tirada trae varias filas, cada una rueda algo menos (de 2,2 a 2,6 s) para que el conjunto no se alargue de más.
  const DUR_RODAR = [2.0, 2.4], DUR_RODAR_VARIAS = [1.6, 2.0];
  let ultima = null, enTanda = 1;
  const T = enMapa?.tiro || null;      // sobre el mapa los dados se dejan caer desde arriba en vez de cruzar la bandeja

  // Simula la tirada completa de una fila de una vez (sin dibujar) y la guarda. Devuelve null si algún dado no quedó bien plano.
  function simular(lote) {
    const golpes = []; grabando = golpes; tSim = 0;
    const brio = lote.length === 1 ? 1.25 : lote.length <= 3 ? 1.12 : 1;      // pocos dados se estorban menos y se asientan antes: salen con algo más de impulso
    for (const d of lote) {
      const c = d.cuerpo; alMundo(d, true);
      c.position.set(d.a.x, d.a.y, d.a.z); c.quaternion.set(d.qA.x, d.qA.y, d.qA.z, d.qA.w);
      // lanzados con brío: caen hacia la mitad de la bandeja y siguen dando tumbos y rebotes hasta la pared de enfrente
      if (T) c.velocity.set(-d.lado * rnd(T.vx[0], T.vx[1]), rnd(T.vy[0], T.vy[1]) * brio, rnd(-T.vz, T.vz));
      else c.velocity.set(-d.lado * rnd(8.5, 11.5), rnd(2.2, 5.2) * brio, rnd(-2.4, 3.8));
      c.angularVelocity.set(rnd(-26, 26) * brio, rnd(-18, 18), rnd(-26, 26) * brio);
      c.wakeUp(); d.atasco = 0;
    }
    const cuadros = []; let quieto = 0, empujones = 0, n = 0;
    const guardar = () => { const f = new Float32Array(lote.length * 7); lote.forEach((d, i) => { const p = d.cuerpo.position, q = d.cuerpo.quaternion; f.set([p.x, p.y, p.z, q.x, q.y, q.z, q.w], i * 7); }); cuadros.push(f); };
    const torcido = (d) => caraArriba(d.cuerpo.quaternion).plano < 0.985 || d.cuerpo.position.y > pisoY + LADO / 2 + 0.08;
    const empujar = (d) => { const c = d.cuerpo; c.wakeUp(); c.velocity.set(rnd(-2.5, 2.5), 5.5, rnd(-1, 2.5)); c.angularVelocity.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)); };
    guardar();
    while (tSim < 12) {
      mundo.step(PASO); tSim += PASO; n++;
      if (n % CADA === 0) guardar();
      const lento = lote.every((d) => d.cuerpo.sleepState === CANNON.Body.SLEEPING || (d.cuerpo.velocity.length() < 0.08 && d.cuerpo.angularVelocity.length() < 0.12));
      quieto = lento ? quieto + PASO : 0;
      for (const d of lote) {      // un dado apoyado de canto puede quedarse temblando sin dormirse: se le da un empujoncito
        const c = d.cuerpo; d.atasco = torcido(d) && c.velocity.length() < 0.7 && c.angularVelocity.length() < 1.6 ? d.atasco + PASO : 0;
        if (d.atasco > 0.45 && empujones < 8) { d.atasco = 0; empujones++; quieto = 0; empujar(d); }
      }
      if (quieto > 0.3) { const malos = lote.filter(torcido); if (malos.length && empujones < 10) { empujones++; quieto = 0; malos.forEach(empujar); } else break; }
    }
    guardar(); grabando = null;
    const bien = !lote.some(torcido);
    for (const d of lote) { d.cuerpo.velocity.setZero(); d.cuerpo.angularVelocity.setZero(); d.cuerpo.sleep(); alMundo(d, false); }
    return bien ? { cuadros, golpes, dur: (cuadros.length - 1) * PASO * CADA, viva: Math.max(0.3, tSim - quieto) } : null;
  }

  function validar(grupos) {
    if (!Array.isArray(grupos) || !grupos.length || grupos.length > MAX_FILAS) throw new Error(`lanzarDados: se esperan de 1 a ${MAX_FILAS} grupos.`);
    for (const g of grupos) if (!Array.isArray(g.valores) || g.valores.length < 1 || g.valores.length > MAX_POR_FILA || g.valores.some((x) => !(Number.isInteger(x) && x >= 1 && x <= 6))) throw new Error(`lanzarDados: cada grupo lleva de 1 a ${MAX_POR_FILA} valores enteros entre 1 y 6.`);
  }
  // Lanza una tirada: { grupos: [{ etq, valores, color, fijo }] } o, para una sola fila, { valores, color }. Lo que hubiera en la
  // bandeja se retira antes. cb(resultado, error): resultado = valores de cada fila, leídos de la cara de arriba, de izquierda a derecha.
  function lanzar(pedido = {}, cb) {
    if (estado !== 'quieto') return false;
    const grupos = pedido.grupos || [{ etq: pedido.etq || '', valores: pedido.valores, color: pedido.color, fijo: pedido.fijo }];
    validar(grupos);
    estado = 'preparando'; alTerminar = cb; resultado = []; enTanda = grupos.filter((g) => !g.fijo).length;
    if (enMapa) { for (const d of saliendo) soltarDado(d); saliendo = []; retirar(true); enMapa.alEmpezar(); }
    Promise.all(grupos.map((g) => materialesDe(g.color || 'rojo'))).then((mm) => {
      retirar(true); cola = grupos.map((g, i) => ({ ...g, mats: mm[i] })); siguiente();
    }).catch((e) => { estado = 'quieto'; const f = alTerminar; alTerminar = null; f?.(null, e); });
    return true;
  }
  function siguiente() {
    if (!cola.length) { estado = 'quieto'; cola = null; actual = null; sonido?.tocar('dados-resultado'); const f = alTerminar; alTerminar = null; f?.(leer()); return; }
    const g = cola.shift(), N = g.valores.length, iFila = filas.length, lado = Math.random() < 0.5 ? 1 : -1;
    const lote = g.valores.map(() => { const d = tomarDado(); d.malla.material = g.mats; return d; });
    const fila = { etq: g.etq || '', dados: lote, rotulo: g.etq ? rotuloDe(g.etq) : null, valores: g.valores.slice() };
    if (fila.rotulo) { sitio(iFila, 0, N, v); fila.rotulo.position.set(v.x - PASO_X / 2 - 1.2, pisoY + 0.012, v.z); if (enMapa) fila.rotulo.position.y += enMapa.apoyoRotulo(fila.rotulo.position); }
    const zLibre = B.z - B.h / 2 + (iFila ? 0.1 + iFila * PASO_Z : 0), zMed = (zLibre + B.z + B.h / 2) / 2, hondo = B.z + B.h / 2 - zLibre;
    actual = { fila, iFila, lote, fijo: !!g.fijo || menosMovimiento || hondo < 1.7 };      // sin sitio para rodar (muchas filas), la fila aparece ya ordenada
    if (actual.fijo) {      // sin rodar: los dados aparecen ya en su sitio con su valor
      lote.forEach((d, k) => { sitio(iFila, k, N, d.malla.position); d.malla.quaternion.setFromUnitVectors(NORMALES[VALOR_CARA.indexOf(g.valores[k])], EJE_Y); d.orden = k; if (enMapa) d.malla.position.y += enMapa.apoyo(d.malla.position) - enMapa.hunde; });
      filas.push(fila); ajustarFondo(); estado = 'ordenando'; tFase = 0; actual.directo = true; return;
    }
    lote.forEach((d, i) => {
      d.lado = lado; d.malla.scale.setScalar(0.001);
      const fila3 = i % 3, col = Math.floor(i / 3), zs = N === 1 ? 0 : (fila3 - Math.min(2, N - 1 - col * 3) / 2) * Math.min(1.0, hondo * 0.28);
      d.a.set(B.x + lado * (B.w / 2 - 0.9 - fila3 * 0.22 - col * 0.95), pisoY + 2.2 + fila3 * 0.45 + col * 0.3, zMed + zs + rnd(-0.15, 0.15));
      if (T) d.a.set(B.x + lado * (T.dx + fila3 * 0.3 + col * 0.8), pisoY + T.alto + fila3 * 0.45 + col * 0.3, zMed + zs + rnd(-0.15, 0.15));
      d.de.copy(d.a); d.de.x += lado * 1.2; d.de.y += 0.5;
    });
    let rec = null;
    // Se presimulan unas cuantas tiradas limpias y se queda la que, por sí sola, dura lo más parecido a lo previsto: así se ve a
    // su ritmo natural (con todo su recorrido, sus tumbos y sus rebotes) y no hace falta acelerarla ni frenarla apenas.
    const [durMin, durMax] = enTanda > 1 ? DUR_RODAR_VARIAS : DUR_RODAR, durMedia = (durMin + durMax) / 2, lejos = (r) => Math.abs(Math.log(r.viva / durMedia));
    let giros = null, intentos = 0, buenas = 0; const tPre = performance.now();
    for (; intentos < 22 && buenas < 10; intentos++) {
      for (const d of lote) d.qA.setFromEuler(new THREE.Euler(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)));
      const r = simular(lote); if (!r) continue; buenas++;
      if (!rec || lejos(r) < lejos(rec)) { rec = r; giros = lote.map((d) => d.qA.clone()); }
      if ((rec.viva >= durMin && rec.viva <= durMax) || performance.now() - tPre > 70) break;      // sin pasarse de tiempo de cálculo: nada de tirones
    }
    if (rec) lote.forEach((d, i) => d.qA.copy(giros[i]));
    if (!rec) { const f = Float32Array.from(lote.flatMap((d, i) => [B.x + (i - (N - 1) / 2) * 0.95, pisoY + LADO / 2, zMed, 0, 0, 0, 1])); rec = { cuadros: [f, f], golpes: [], dur: 0, viva: 0.3 }; for (const d of lote) d.qA.identity(); }
    // la tirada se reproduce al ritmo que la deja dentro de la duración prevista por fila (ver DUR_RODAR)
    rec.k = rec.viva / Math.min(durMax, Math.max(durMin, rec.viva)); ultima = { viva: rec.viva, k: rec.k, intentos, buenas, ms: performance.now() - tPre };
    // de izquierda a derecha según quedan: a cada dado, el valor que le toca y el giro de caras que lo deja arriba
    const fin = rec.cuadros[rec.cuadros.length - 1], orden = lote.map((d, i) => i).sort((p, q) => fin[p * 7] - fin[q * 7]);
    orden.forEach((i, k) => {
      const d = lote[i], arriba = caraArriba(q1.set(fin[i * 7 + 3], fin[i * 7 + 4], fin[i * 7 + 5], fin[i * 7 + 6])).indice;
      d.fix.setFromUnitVectors(NORMALES[VALOR_CARA.indexOf(g.valores[k])], NORMALES[arriba]); d.qAFix.copy(d.qA).multiply(d.fix); d.qDe.copy(d.qAFix); d.orden = k;
    });
    filas.push(fila); cinta = rec; iGolpe = 0; estado = 'alzando'; tFase = 0;
  }
  // Valores a la vista, fila por fila (cada fila de izquierda a derecha), leídos de la cara que mira hacia arriba.
  function leer() { return filas.map((f) => f.dados.slice().sort((p, q) => p.orden - q.orden).map((d) => caraArriba(d.malla.quaternion).valor)); }
  function retirar(yaMismo = false) {
    for (const f of filas) { for (const d of f.dados) { if (yaMismo) soltarDado(d); else d.saliendo = 1; } if (f.rotulo) { raiz.remove(f.rotulo); f.rotulo.material.map.dispose(); f.rotulo.material.dispose(); f.rotulo.geometry.dispose(); } }
    const viejas = filas.splice(0); ajustarFondo(); enMapa?.alRetirar(); return viejas;
  }
  let saliendo = [];
  // Retira los dados de la bandeja (se encogen y desaparecen).
  function limpiar() { if (estado !== 'quieto') return false; saliendo.push(...retirar(false).flatMap((f) => f.dados)); enMapa?.limpiar(); return true; }

  let sucio = false;
  function actualizar(dt) {
    if (enMapa) enMapa.actualizar(dt);
    sucio = estado !== 'quieto' || saliendo.length > 0;
    if (saliendo.length) { for (const d of saliendo) { d.saliendo -= dt / 0.25; d.malla.scale.setScalar(Math.max(0.001, d.saliendo) * ESC_FILA); if (d.saliendo <= 0) soltarDado(d); } saliendo = saliendo.filter((d) => d.saliendo > 0); }
    if (estado === 'alzando') {
      tFase = Math.min(1, tFase + dt / 0.25);
      const s = 1 - (1 - tFase) ** 3;
      for (const d of actual.lote) { d.malla.position.lerpVectors(d.de, d.a, s); d.malla.quaternion.copy(d.qAFix); d.malla.scale.setScalar(Math.max(0.001, s)); }
      if (tFase >= 1) { estado = 'rodando'; tFase = 0; sonido?.tocar('dados-lanzar'); }
    } else if (estado === 'rodando') {
      tFase += dt * cinta.k;
      const x = Math.min(cinta.cuadros.length - 1, tFase / (PASO * CADA)), i0 = Math.floor(x), i1 = Math.min(cinta.cuadros.length - 1, i0 + 1), u = x - i0, A = cinta.cuadros[i0], Bq = cinta.cuadros[i1];
      actual.lote.forEach((d, i) => {
        const k = i * 7;
        d.malla.position.set(A[k] + (Bq[k] - A[k]) * u, A[k + 1] + (Bq[k + 1] - A[k + 1]) * u, A[k + 2] + (Bq[k + 2] - A[k + 2]) * u);
        q1.set(A[k + 3], A[k + 4], A[k + 5], A[k + 6]); q2.set(Bq[k + 3], Bq[k + 4], Bq[k + 5], Bq[k + 6]);
        d.malla.quaternion.slerpQuaternions(q1, q2, u).multiply(d.fix); d.malla.scale.setScalar(1);
        if (enMapa) d.malla.position.y += enMapa.apoyo(d.malla.position);      // sobre el mapa el suelo tiene relieve
      });
      while (iGolpe < cinta.golpes.length && cinta.golpes[iGolpe].t <= tFase) { const g = cinta.golpes[iGolpe++]; if (!enMapa?.alGolpe(g)) sonido?.tocar('dados-golpe', g.fuerza, g.variante); }
      if (tFase >= cinta.viva) {
        estado = 'ordenando'; tFase = 0; ajustarFondo();
        for (const d of actual.lote) { d.de.copy(d.malla.position); d.qDe.copy(d.malla.quaternion); encarado(d.qDe, d.qA); }
      }
    } else if (estado === 'ordenando') {
      tFase = Math.min(1, tFase + dt / (actual.directo ? 0.22 : 0.35));
      const s = tFase * tFase * (3 - 2 * tFase), N = actual.lote.length;
      for (const d of actual.lote) {
        if (actual.directo) { d.malla.scale.setScalar(Math.max(0.001, s * ESC_FILA)); continue; }
        sitio(actual.iFila, d.orden, N, v); if (enMapa) v.y += enMapa.apoyo(v) - enMapa.hunde; d.malla.position.lerpVectors(d.de, v, s); d.malla.position.y += Math.sin(Math.PI * s) * 0.18;
        d.malla.quaternion.slerpQuaternions(d.qDe, d.qA, s); d.malla.scale.setScalar(1 + (ESC_FILA - 1) * s);
      }
      if (actual.fila.rotulo) actual.fila.rotulo.material.opacity = s;
      if (tFase >= 1) { enMapa?.alAsentar(actual.lote, !!actual.directo); resultado.push(actual.fila.valores); siguiente(); }
    }
  }
  const centro = new THREE.Vector3(B.x, pisoY, B.z);
  function destruir() { retirar(true); enMapa?.destruir(); for (const p of juegos.values()) p.then((m) => m.forEach((x) => { x.map.dispose(); x.dispose(); })).catch(() => {}); geo.dispose(); }
  // dos dados rojos de adorno, en reposo, hasta la primera tirada
  enMapa?.montar(raiz, { x: B.x, y: pisoY, z: B.z, w: B.w, h: B.h, lado: LADO * ESC_FILA });
  const listos = materialesDe('rojo').then((m) => {
    if (enMapa) return;      // la bandeja no se ve: sin dados de adorno
    const fila = { etq: '', dados: [], rotulo: null, valores: [5, 3], adorno: true };
    [[-0.9, 0.35, 0.5, 5], [0.75, -0.3, -0.35, 3]].forEach(([x, z, giro, valor], k) => { const d = tomarDado(); d.malla.material = m; d.malla.position.set(B.x + x, pisoY + LADO / 2, B.z + z); d.malla.quaternion.setFromAxisAngle(EJE_Y, giro).multiply(q1.setFromUnitVectors(NORMALES[VALOR_CARA.indexOf(valor)], EJE_Y)); d.malla.scale.setScalar(1); d.orden = k; fila.dados.push(d); });
    filas.push(fila);
  });
  return { lanzar, limpiar, actualizar, leer, filas, centro, destruir, MAX_POR_FILA, MAX_FILAS, get estado() { return estado === 'quieto' ? 'quieto' : 'rodando'; }, get sucio() { return sucio; }, get listos() { return listos; }, get ultima() { return ultima; }, raiz, vistaTirada: enMapa ? () => enMapa.vista() : null };
}
