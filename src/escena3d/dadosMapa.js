// Dados sobre el mapa (opción «dadosEnMapa» de crearEscena): en vez de rodar en su bandeja, los dados caen en un claro del
// mapa, en la zona que mira la cámara; al tocar el suelo levantan polvo y granos de arena (o salpican, si caen al mar) y se
// quedan donde paran: justo antes de detenerse se entierran un poco, cada uno con su reborde de arena, y ya nada los mueve.
// Este módulo solo añade «dónde» y «con qué adorno»: la física, los valores forzados y los tiempos son los de siempre (dados.js).
// La tirada se simula en el recinto de la bandeja y ese recinto entero se traslada, se gira y se escala hasta el claro elegido;
// por eso, apagando la opción, todo vuelve a ser exactamente la bandeja.
import * as THREE from 'three';
import { ANCHO, ALTO } from './medidas.js';

const ESCALA = 0.85;        // tamaño del recinto (y de los dados) sobre el mapa, respecto a la bandeja
const HUNDE = 0.1;          // cuánto queda hundido cada dado al asentarse (en unidades de la bandeja)
const MAX_HOYOS = 36, MAX_PARTICULAS = 520;
const al = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// camara y fichas se pasan como funciones porque se crean después que los dados.
export function crearDadosMapa({ escena, tablero, camara, fichas, sonido, menosMovimiento = false }) {
  const EJE_Y = new THREE.Vector3(0, 1, 0), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), col = new THREE.Color();
  let raiz = null, R = null;       // R: el recinto de la bandeja { x, y, z, w, h, lado } en sus propias unidades
  let margen = 0;                  // franja a la izquierda del recinto donde van los rótulos de las filas (mismas unidades): solo cuenta para el encuadre
  let zona = null, vistaZona = null;

  // ------------------------------------------------------------------------------------------------------------------
  // Dónde: un claro cerca de donde mira la cámara. Se prueban sitios alrededor y gana el que menos estorba: sin ciudades ni
  // fichas debajo (la del jugador en turno pesa más), llano, en tierra mejor que en el mar y lo más cerca posible.
  // ------------------------------------------------------------------------------------------------------------------
  function estorbo(cx, cz, giro, w, h) {
    const c = Math.cos(giro), s = Math.sin(giro);
    const dentro = (p, margen) => { const dx = p.x - cx, dz = p.z - cz, lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < w / 2 + margen && Math.abs(lz) < h / 2 + margen; };
    let pena = 0;
    for (const ciudad of tablero.ciudades.values()) if (dentro(ciudad.pos, 0.95)) pena += ciudad.capital ? 11 : 9;
    for (const f of fichas()?.fichas || []) if (dentro(f.nodo.position, 0.7)) pena += f.turno ? 22 : 12;
    let min = 9, max = -9, mar = 0, n = 0;
    for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) {
      const lx = (i / 3) * (w / 2), lz = (j / 2) * (h / 2), x = cx + lx * c + lz * s, z = cz - lx * s + lz * c, y = tablero.altura(x, z);
      min = Math.min(min, y); max = Math.max(max, y); n++; if (tablero.relieve.esMar(x, z)) mar++;
    }
    return { pena: pena + Math.max(0, max - min - 0.04) * 26 + (mar / n) * 6, mar: mar / n };
  }
  function elegirZona() {
    const cam = camara().leer(), giro = cam.az, w = R.w * ESCALA, h = R.h * ESCALA;
    // si la cámara sigue donde la dejó la tirada anterior, se repite el claro (mientras siga despejado y sea del mismo tamaño)
    if (zona && vistaZona && zona.w === w && zona.h === h && Math.hypot(cam.x - vistaZona.x, cam.z - vistaZona.z) < 1 && Math.abs(cam.d - vistaZona.d) < 1.2) {
      const e = estorbo(zona.x, zona.z, zona.giro, w, h); if (e.pena <= zona.pena + 0.5) return zona;
    }
    const c = Math.cos(giro), s = Math.sin(giro), ex = Math.abs(c) * w / 2 + Math.abs(s) * h / 2 + 0.35, ez = Math.abs(s) * w / 2 + Math.abs(c) * h / 2 + 0.35;
    const topeX = ANCHO / 2 - ex, topeZ = ALTO / 2 - ez, radio = clamp(cam.d * 0.55, 5, 12);
    let mejor = null;
    for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) {
      const lejos = Math.hypot(i, j); if (lejos > radio) continue;
      const x = clamp(cam.x + i * c + j * s, -topeX, topeX), z = clamp(cam.z - i * s + j * c, -topeZ, topeZ);
      const e = estorbo(x, z, giro, w, h), pena = e.pena + Math.hypot(x - cam.x, z - cam.z) * 0.3;
      if (!mejor || pena < mejor.pena) mejor = { x, z, giro, mar: e.mar, pena, w, h };
    }
    return mejor;
  }
  // Lleva el recinto entero (dados, rótulos y hoyos, que cuelgan de «raiz») al claro: p_mundo = P + giro · escala · (p − centro del recinto)
  function situar() {
    raiz.scale.setScalar(ESCALA); raiz.rotation.set(0, zona.giro, 0);
    v1.set(R.x, R.y, R.z).multiplyScalar(ESCALA).applyAxisAngle(EJE_Y, zona.giro);
    raiz.position.set(zona.x, 0.004, zona.z).sub(v1); raiz.updateMatrixWorld(true);      // el suelo del recinto queda a la altura 0 del mapa; el relieve lo pone apoyo()
  }
  const aMundo = (x, y, z, out) => raiz.localToWorld(out.set(x, y, z));
  // Cuánto sube o baja el suelo del mapa bajo un punto del recinto (en unidades del recinto): los dados siguen el relieve y el mar.
  const v3 = new THREE.Vector3();
  const apoyo = (p) => { aMundo(p.x, R.y, p.z, v3); return tablero.altura(v3.x, v3.z) / ESCALA; };
  // Lo mismo para un dado entero: se apoya en lo más bajo que tenga debajo (centro y esquinas), para que en una cuesta no quede
  // con un lado en el aire; por el otro lado queda algo más enterrado, como en la arena de verdad.
  const ESQ = [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]], pe = { x: 0, z: 0 };
  const apoyoDado = (p) => { let m = 9; for (const [a, b] of ESQ) { pe.x = p.x + a * R.lado * 0.4; pe.z = p.z + b * R.lado * 0.4; m = Math.min(m, apoyo(pe)); } return Math.max(m, apoyo(p) - 0.1); };      // sin pasarse: en una ladera brusca no se lo traga

  // Vista de cámara para la tirada: si la actual ya enseña el claro entero, desde un ángulo que deja leer las caras y a una
  // distancia razonable, no se mueve; si no (muy lejos, muy cerca o a pie de calle), se abre lo justo para encuadrarlo.
  function vista() {
    const cam = camara(), ahora = cam.leer(); if (!zona) return ahora;
    const pts = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (const y of [0, 1.1]) pts.push(aMundo(R.x + sx * (R.w / 2 + 0.3) - (sx < 0 ? margen : 0), R.y + y, R.z + sz * (R.h / 2 + 0.3), new THREE.Vector3()));
    const ideal = cam.encuadre(pts, { x: zona.x, z: zona.z, pol: 0.6, az: zona.giro }, 0.86); ideal.d = Math.max(8, ideal.d);
    const cabe = pts.every((p) => cam.enPantalla(p, 0.93));
    vistaZona = cabe && ahora.pol >= 0.28 && ahora.pol <= 0.92 && ahora.d <= ideal.d * 1.45 ? ahora : ideal;
    return vistaZona;
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Polvo y arena: un solo sistema de puntos. Nubecillas (grandes, lentas, que se abren y se deshacen) y granos (pequeños, que
  // saltan y caen). Sin luces propias: se tiñen con la luz que haya en la escena para no brillar de noche.
  // ------------------------------------------------------------------------------------------------------------------
  const N = MAX_PARTICULAS, pos = new Float32Array(N * 3).fill(-999), dat = new Float32Array(N * 2), tinte = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3), edad = new Float32Array(N).fill(9), vida = new Float32Array(N).fill(1), tam = new Float32Array(N), clase = new Uint8Array(N), suelo = new Float32Array(N), opac = new Float32Array(N);
  const gPart = new THREE.BufferGeometry();
  gPart.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gPart.setAttribute('aDatos', new THREE.BufferAttribute(dat, 2)); gPart.setAttribute('aTinte', new THREE.BufferAttribute(tinte, 3));
  const matPart = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uEscala: { value: 600 }, uLuz: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `attribute vec2 aDatos; attribute vec3 aTinte; uniform float uEscala; varying float vOpa; varying float vBorde; varying vec3 vTinte;
      void main() { vec4 mv = modelViewMatrix * vec4( position, 1.0 ); gl_Position = projectionMatrix * mv; gl_PointSize = max( 1.5, aDatos.x * uEscala / -mv.z );
        vOpa = aDatos.y; vBorde = aDatos.x > 0.1 ? 0.02 : 0.3; vTinte = aTinte; }`,
    fragmentShader: `uniform vec3 uLuz; varying float vOpa; varying float vBorde; varying vec3 vTinte;
      void main() { float r = length( gl_PointCoord - 0.5 ); float a = vOpa * ( 1.0 - smoothstep( vBorde, 0.5, r ) ); if ( a < 0.004 ) discard;
        gl_FragColor = vec4( vTinte * uLuz, a );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const puntos = new THREE.Points(gPart, matPart); puntos.frustumCulled = false; puntos.renderOrder = 18; puntos.visible = false; escena.add(puntos);
  const tamPant = new THREE.Vector2();
  puntos.onBeforeRender = (renderer, _e, cam) => { matPart.uniforms.uEscala.value = renderer.getDrawingBufferSize(tamPant).y * cam.projectionMatrix.elements[5] * 0.5; };
  let iPart = 0, vivas = 0, luces = null;
  function luzAmbiente() {
    if (!luces) { luces = []; escena.traverse((o) => { if (o.isHemisphereLight || o.isAmbientLight || o.isDirectionalLight) luces.push(o); }); }
    const c = matPart.uniforms.uLuz.value.setRGB(0, 0, 0);
    for (const l of luces) { const k = l.intensity * (l.isDirectionalLight ? 0.3 : 0.75); c.r += l.color.r * k; c.g += l.color.g * k; c.b += l.color.b * k; }
    const gris = (c.r + c.g + c.b) / 3; c.r += (gris - c.r) * 0.6; c.g += (gris - c.g) * 0.6; c.b += (gris - c.b) * 0.6;      // el polvo toma la claridad de la hora, no su color
    const tope = Math.max(c.r, c.g, c.b, 1.05) / 1.05; c.multiplyScalar(1 / tope); c.r = Math.max(c.r, 0.1); c.g = Math.max(c.g, 0.11); c.b = Math.max(c.b, 0.14);
  }
  const NUBE = [0xfff6e2, 0xf6e6c4, 0xead4a6], ARENA = [0xb8935a, 0xd9bd89, 0x9c7a48, 0xf2e2bc], ESPUMA = [0xf4fbfa, 0xd6ecec, 0xbfe0e2];
  function particula(p, clase_, enMar, fuerza) {
    const i = iPart; iPart = (iPart + 1) % N; const a = al(0, Math.PI * 2), paleta = enMar ? ESPUMA : clase_ === 0 ? NUBE : ARENA;
    col.set(paleta[Math.floor(Math.random() * paleta.length)]); tinte[i * 3] = col.r; tinte[i * 3 + 1] = col.g; tinte[i * 3 + 2] = col.b;
    clase[i] = clase_; edad[i] = 0; suelo[i] = p.y;
    if (clase_ === 0) {      // nubecilla
      const r = al(0.05, 0.22), v = al(0.35, 1.25) * (0.6 + fuerza);
      pos[i * 3] = p.x + Math.cos(a) * r; pos[i * 3 + 1] = p.y + al(0.03, 0.12); pos[i * 3 + 2] = p.z + Math.sin(a) * r;
      vel[i * 3] = Math.cos(a) * v; vel[i * 3 + 1] = al(0.15, 0.55) * (0.6 + fuerza); vel[i * 3 + 2] = Math.sin(a) * v;
      vida[i] = al(0.75, 1.3); tam[i] = al(0.4, 0.75) * (0.75 + 0.5 * fuerza); opac[i] = al(0.42, 0.66);
    } else {                 // grano que salta
      const v = al(0.8, 3.0) * (0.5 + fuerza);
      pos[i * 3] = p.x + Math.cos(a) * 0.2; pos[i * 3 + 1] = p.y + 0.03; pos[i * 3 + 2] = p.z + Math.sin(a) * 0.2;
      vel[i * 3] = Math.cos(a) * v; vel[i * 3 + 1] = al(1.4, 4.2) * (0.5 + fuerza); vel[i * 3 + 2] = Math.sin(a) * v;
      vida[i] = al(0.4, 0.8); tam[i] = al(0.035, 0.075); opac[i] = al(0.8, 1);
    }
  }
  // Levanta polvo en un punto del mundo. fuerza: de 0 a 1.
  function polvareda(p, fuerza, enMar) {
    if (menosMovimiento) fuerza *= 0.5;
    const nubes = Math.round(3 + 6 * fuerza), granos = Math.round(4 + 16 * fuerza);
    for (let k = 0; k < nubes; k++) particula(p, 0, enMar, fuerza);
    for (let k = 0; k < granos; k++) particula(p, 1, enMar, fuerza);
    vivas = Math.max(vivas, 1); puntos.visible = true;
  }
  function moverParticulas(dt) {
    if (!puntos.visible) return;
    luzAmbiente(); vivas = 0;
    for (let i = 0; i < N; i++) {
      if (edad[i] >= vida[i]) continue;
      edad[i] += dt; const u = edad[i] / vida[i], k = i * 3;
      if (u >= 1) { pos[k + 1] = -999; dat[i * 2 + 1] = 0; continue; }
      vivas++;
      if (clase[i] === 0) {
        const freno = Math.exp(-dt * 2.6); vel[k] *= freno; vel[k + 1] *= freno; vel[k + 2] *= freno;
        dat[i * 2] = tam[i] * (0.55 + 1.5 * (1 - (1 - u) ** 2)); dat[i * 2 + 1] = opac[i] * Math.min(1, u * 9) * (1 - u) ** 1.4;
      } else {
        vel[k + 1] -= 15 * dt;
        if (pos[k + 1] + vel[k + 1] * dt < suelo[i] + 0.012 && vel[k + 1] < 0) { vel[k + 1] *= -0.28; vel[k] *= 0.5; vel[k + 2] *= 0.5; }
        dat[i * 2] = tam[i]; dat[i * 2 + 1] = opac[i] * (u < 0.7 ? 1 : (1 - u) / 0.3);
      }
      pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
    }
    gPart.attributes.position.needsUpdate = true; gPart.attributes.aDatos.needsUpdate = true; gPart.attributes.aTinte.needsUpdate = true;
    if (!vivas) puntos.visible = false;
  }
  function limpiarParticulas() { edad.fill(9); pos.fill(-999); dat.fill(0); vivas = 0; puntos.visible = false; gPart.attributes.position.needsUpdate = true; gPart.attributes.aDatos.needsUpdate = true; }

  // ------------------------------------------------------------------------------------------------------------------
  // Hoyos: el reborde de arena que queda alrededor de cada dado asentado (una sola malla con instancias).
  // ------------------------------------------------------------------------------------------------------------------
  let hoyos = null, nHoyos = 0;
  const ARENA_HOYO = 0xdcc391, ESPUMA_HOYO = 0xeef8f7;      // en el mar el reborde es un cerco de espuma
  function crearHoyos(lado) {
    const K = 44, medio = lado / 2, aros = [[-0.03, -0.09, 0.5, 1], [0.022, 0.0, 0.56, 0.95], [0.08, 0.055, 1.07, 1], [0.15, 0.03, 0.9, 0.9], [0.3, 0.0, 0.82, 0]];      // [hacia fuera, alto, tono, opacidad]
    const p = [], c = [], idx = [];      // la geometría lleva solo el claroscuro; el color (arena o espuma) lo pone cada instancia
    for (let a = 0; a < aros.length; a++) for (let k = 0; k <= K; k++) {
      const t = (k % K) / K * Math.PI * 2, cuadro = medio / (Math.abs(Math.cos(t)) ** 6 + Math.abs(Math.sin(t)) ** 6) ** (1 / 6);      // contorno de cuadrado con las esquinas redondeadas
      const ruido = a < 2 ? 0 : 0.5 + 0.5 * Math.sin(t * 5 + a) * Math.sin(t * 3 + 1.7), r = cuadro + aros[a][0] * (1 + 0.45 * ruido);
      p.push(Math.cos(t) * r, aros[a][1] * (a === 2 ? 0.7 + 0.6 * ruido : 1), Math.sin(t) * r);
      const tono = aros[a][2] * (0.94 + 0.08 * ruido); c.push(tono, tono, tono, aros[a][3]);
    }
    for (let a = 0; a < aros.length - 1; a++) for (let k = 0; k < K; k++) { const i0 = a * (K + 1) + k, i1 = i0 + K + 1; idx.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 4)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 1, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: 0.25 });
    hoyos = new THREE.InstancedMesh(g, m, MAX_HOYOS); hoyos.count = 0; hoyos.receiveShadow = true; hoyos.frustumCulled = false; hoyos.renderOrder = 3;
    hoyos.setColorAt(0, col.set(ARENA_HOYO)); raiz.add(hoyos);
  }
  const datosHoyo = [];
  // Pone el reborde de un dado (giro: hacia dónde quedó girado el dado). Devuelve su número, para irlo levantando con crecerHoyo.
  function ponerHoyo(x, z, enMar, giro = Math.floor(al(0, 4)) * Math.PI / 2, crece = 1) {
    if (nHoyos >= MAX_HOYOS) return -1;
    const i = nHoyos; datosHoyo[i] = { x, z, giro, e: al(0.96, 1.07), alto: al(0.85, 1.2) };
    hoyos.setColorAt(i, col.set(enMar ? ESPUMA_HOYO : ARENA_HOYO)); hoyos.count = ++nHoyos; hoyos.instanceColor.needsUpdate = true;
    crecerHoyo(i, crece); return i;
  }
  // El reborde sale a la vez que el dado se entierra: la arena desplazada sube alrededor (u de 0 a 1).
  function crecerHoyo(i, u) {
    const h = datosHoyo[i]; if (!h || i >= nHoyos) return;
    const k = Math.max(0.001, u), e = h.e * (0.9 + 0.1 * k);
    m4.compose(v1.set(h.x, R.y + 0.004 + apoyo(h), h.z), q0.setFromAxisAngle(EJE_Y, h.giro), v2.set(e, h.alto * k, e));
    hoyos.setMatrixAt(i, m4); hoyos.instanceMatrix.needsUpdate = true;
  }
  // Hacia dónde está girado un dado (alrededor de la vertical): el rumbo de su arista más tendida.
  const EJES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  function rumbo(q) { let mejor = 2, giro = 0; for (const n of EJES) { v2.copy(n).applyQuaternion(q); if (Math.abs(v2.y) < mejor) { mejor = Math.abs(v2.y); giro = Math.atan2(-v2.z, v2.x); } } return giro; }

  // ------------------------------------------------------------------------------------------------------------------
  // Agua: si un dado cae en el mar salpica (gotas que saltan alto y caen) y deja ondas que se abren y se apagan.
  // ------------------------------------------------------------------------------------------------------------------
  const ondas = [], gOnda = new THREE.RingGeometry(0.88, 1, 48); gOnda.rotateX(-Math.PI / 2);
  function onda(p, fuerza, espera = 0) {
    let o = ondas.find((x) => x.u >= 1);
    if (!o) { if (ondas.length >= 24) return; o = { m: new THREE.Mesh(gOnda, new THREE.MeshBasicMaterial({ color: 0xf2fbfb, transparent: true, depthWrite: false, opacity: 0 })), u: 1 }; o.m.renderOrder = 17; escena.add(o.m); ondas.push(o); }
    o.u = 0; o.espera = espera; o.dur = al(0.9, 1.3); o.r = 0.35 + 0.9 * fuerza; o.f = fuerza; o.m.position.set(p.x, p.y + 0.012, p.z); o.m.scale.set(0.12, 1, 0.12); o.m.material.opacity = 0; o.m.visible = true;
  }
  function moverOndas(dt) {
    for (const o of ondas) {
      if (o.u >= 1) continue; if (o.espera > 0) { o.espera -= dt; continue; } o.u = Math.min(1, o.u + dt / o.dur);
      const s = 0.12 + o.r * (1 - (1 - o.u) ** 2); o.m.scale.set(s, 1, s); o.m.material.opacity = (0.55 + 0.3 * o.f) * (1 - o.u) ** 1.5;
      if (o.u >= 1) o.m.visible = false;
    }
  }
  function salpicar(p, fuerza) {
    if (menosMovimiento) fuerza *= 0.5;
    const gotas = Math.round(10 + 26 * fuerza);
    for (let k = 0; k < gotas; k++) {
      particula(p, 1, true, fuerza); const i = (iPart + N - 1) % N, j = i * 3;
      vel[j] *= 0.55; vel[j + 2] *= 0.55; vel[j + 1] = al(2.2, 5.8) * (0.55 + fuerza); tam[i] = al(0.04, 0.09); vida[i] = al(0.5, 0.9);
    }
    for (let k = 0; k < 3; k++) particula(p, 0, true, fuerza * 0.6);
    onda(p, fuerza); if (fuerza > 0.35) onda(p, fuerza * 0.6, 0.16);      // un golpe fuerte deja una segunda onda, algo después
    vivas = Math.max(vivas, 1); puntos.visible = true;
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Enganches que llama dados.js
  // ------------------------------------------------------------------------------------------------------------------
  const arena = () => (sonido?.tabla?.['dados-arena'] ? 'dados-arena' : 'dados-golpe');      // sin archivo propio, suena el golpe sordo de siempre
  const enMundo = (p) => { aMundo(p.x, R.y, p.z, v1); v1.y = tablero.altura(v1.x, v1.z); return tablero.relieve.esMar(v1.x, v1.z); };
  return {
    hunde: HUNDE, apoyo: apoyoDado,
    // el rótulo de una fila va tendido sobre el mapa: se sube lo justo para que el relieve no lo tape
    apoyoRotulo: (p) => Math.max(apoyo({ x: p.x - 1.1, z: p.z }), apoyo(p), apoyo({ x: p.x + 1.1, z: p.z })) + 0.03,
    // La tirada: en vez de lanzarse de lado a lado, los dados se dejan caer desde arriba con poco empuje, para que rueden y se
    // asienten dentro del claro. (Velocidades en unidades de la bandeja, igual que en dados.js.)
    tiro: { dx: 1.5, alto: 3.2, vx: [2.6, 5.2], vy: [0.5, 3.2], vz: 1.7 },
    montar(nodo, recinto) { raiz = nodo; R = recinto; crearHoyos(recinto.lado); },
    // hondo: fondo que necesita esta tirada (crece con el número de filas); margen: franja de los rótulos, a la izquierda (la cámara la encuadra también)
    alEmpezar({ hondo = R.h, margen: m = 0 } = {}) { R.h = hondo; margen = m; zona = elegirZona(); situar(); },
    vista,
    // Un dado toca el suelo (g: golpe grabado en la simulación, con su punto en unidades de la bandeja).
    alGolpe(g) {
      if (g.variante !== 'fieltro') return false;      // dado contra dado: suena como siempre
      const enMar = enMundo(g);
      if (enMar) { if (g.fuerza > 0.04) salpicar(v1, clamp(g.fuerza * 1.6, 0.15, 1)); sonido?.tocar('dados-agua', g.fuerza); }
      else { if (g.fuerza > 0.06) polvareda(v1, clamp(g.fuerza * 1.5, 0.12, 1), enMar); sonido?.tocar(arena(), g.fuerza, 'fieltro'); }
      return true;
    },
    // Un dado empieza a enterrarse en sus últimos instantes de movimiento: sale su reborde (y, en el mar, unas ondas).
    alHundir(d) { const p = d.malla.position, enMar = enMundo(p); if (enMar) onda(v1, 0.3); return ponerHoyo(p.x, p.z, enMar, rumbo(d.malla.quaternion), 0); },
    // mientras el dado acaba de asentarse, el reborde lo sigue (posición y giro) y sube con lo que lleva hundido
    hoyoCrece(i, d) { const h = datosHoyo[i]; if (!h) return; h.x = d.malla.position.x; h.z = d.malla.position.z; h.giro = rumbo(d.malla.quaternion); crecerHoyo(i, d.hundido); },
    // Los dados que aparecen ya puestos (sin rodar): se hunden, queda su reborde y sale un último soplo de arena.
    alAsentar(dados, suave = false) {
      for (const d of dados) {
        const p = d.malla.position; aMundo(p.x, R.y, p.z, v1); v1.y = tablero.altura(v1.x, v1.z); const enMar = tablero.relieve.esMar(v1.x, v1.z);
        ponerHoyo(p.x, p.z, enMar); if (!suave) polvareda(v1, 0.32, enMar);
      }
      if (!suave) sonido?.tocar(arena(), 0.35, 'fieltro');
    },
    alRetirar() { nHoyos = 0; if (hoyos) hoyos.count = 0; },
    limpiar() { limpiarParticulas(); },
    actualizar(dt) { moverParticulas(dt); moverOndas(dt); },
    get vivo() { return vivas > 0 || ondas.some((o) => o.u < 1); },
    get zona() { return zona; },
    destruir() { for (const o of ondas) { escena.remove(o.m); o.m.material.dispose(); } gOnda.dispose(); escena.remove(puntos); gPart.dispose(); matPart.dispose(); if (hoyos) { hoyos.geometry.dispose(); hoyos.material.dispose(); hoyos.dispose(); } },
  };
}
