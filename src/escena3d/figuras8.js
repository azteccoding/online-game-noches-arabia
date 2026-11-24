// Monito de ocho vistas (Zubayda v5): una cáscara con relieve por cada pintura de la hoja de giro de 360°, todas de pie sobre
// el mismo eje y cada una mirando hacia su ángulo. Solo se dibuja la que mira a la cámara, así que desde cada ángulo se ve la
// pintura de ese ángulo tal como es: sin brazo doble, sin cara cortada y sin torso aplanado. preparar-vistas8.py deja el atlas
// (las ocho vistas en fila, o en dos filas) y los datos.
// La figura mira hacia +Z y tiene los pies en el origen; su costado izquierdo es +X. Devuelve lo mismo que crearFigura.
//
// Giro continuo (Jorge, 24 de noviembre: al girar «parece que se desvanecen en polvo del color de sus ropas y luego vuelven a
// aparecer»). Entre una pintura y la siguiente ya no hay salto ni trama de puntos:
//  · la cáscara que se ve da siempre la cara a quien mira y, conforme la figura gira, su pintura se va deformando hacia la de la
//    vista vecina (preparar-giro8.py calcula a dónde va cada punto: datos.giro8): la silueta y los rasgos se corren poco a poco;
//  · a medio camino las dos pinturas ya casan, y el relevo es un fundido corto de una sobre la otra (transparencia de verdad,
//    no puntos), centrado en ese medio camino cuando la figura va girando.
import * as THREE from 'three';

const paso = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const GRADOS = Math.PI / 180, HOLGURA = 3 * GRADOS, FUNDIDO = 200;      // cuánto hay que pasarse del límite para cambiar de vista, y milisegundos del relevo
const ADELANTO = 14 * GRADOS;      // lo más que se adelanta el relevo cuando la figura va girando (para que caiga a medio camino entre las dos vistas)
const angulo = (d) => { d %= 2 * Math.PI; return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d; };

// Lo que se le añade al material de cada cáscara. uVer / uAlReves: el relevo con la vista cenital. uPres / uPresReves:
// el relevo entre dos figuras del mismo personaje (Jamil de pie y Jamil sentado tocando): otra trama, para que no se estorben.
// El relevo entre vistas ya no usa trama: uFunde es la transparencia de la cáscara que va encima (ver ponerAzimut).
const TRAMA = '#include <map_fragment>\nif (uVer < 0.999) { float r = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (uAlReves > 0.5 ? r < 1.0 - uVer : r >= uVer) discard; }'
  + '\nif (uPres < 0.999) { float r2 = fract(52.9829189 * fract(dot(gl_FragCoord.yx + 17.0, vec2(0.06711056, 0.00583715)))); if (uPresReves > 0.5 ? r2 < 1.0 - uPres : r2 >= uPres) discard; }';
const CABECERA = '#include <common>\nuniform float uVer;\nuniform float uAlReves;\nuniform float uPres;\nuniform float uPresReves;';
const FUNDE = '#include <alphatest_fragment>\ndiffuseColor.a *= uFunde;';
// En los vértices: uVuelta gira la cáscara sobre el eje de la figura hasta dar la cara a la cámara (y con ella su luz); giro es
// lo que cada punto se corre de lado al llegar a la vista vecina de más azimut (x) o de menos (y), y uGiro cuánto de ese camino
// lleva (−1 a 1); uLado, hacia dónde queda la derecha de quien mira. uCerca acerca un poco a la cámara la cáscara que va encima.
const CABECERA_V = '#include <common>\nattribute vec2 giro;\nuniform float uVuelta;\nuniform float uGiro;\nuniform vec2 uLado;\nuniform float uCerca;';
const NORMAL_V = '#include <beginnormal_vertex>\n{ float cg = cos(uVuelta), sg = sin(uVuelta); objectNormal.xz = vec2(cg * objectNormal.x + sg * objectNormal.z, cg * objectNormal.z - sg * objectNormal.x); }';
const VERTICE_V = '#include <begin_vertex>\n{ float cg = cos(uVuelta), sg = sin(uVuelta); transformed.xz = vec2(cg * transformed.x + sg * transformed.z, cg * transformed.z - sg * transformed.x) + uLado * ((uGiro > 0.0 ? giro.x : giro.y) * abs(uGiro)); }';
const CERCA_V = '#include <project_vertex>\nif (uCerca > 0.0) { mvPosition.xyz -= normalize(mvPosition.xyz) * (uCerca * length(modelMatrix[0].xyz)); gl_Position = projectionMatrix * mvPosition; }';

// datos: { tw, th, paso, vistas, azimut[], zmax, z8[], cubre8[], giro8[]?, giroEsc?, giroPaso?, x0, x1, mano, tela, piernas, toca? }
// toca (la figura que toca el laúd): { rasgueo: [[x, y] | null × 8], dedos: [[x, y] | null × 8], cuello } en fracciones de la tesela:
// dónde está en cada vista la mano que rasguea y la que pisa las cuerdas, y a qué altura empieza la cabeza.
export function crearFiguraVistas(datos, textura, { alto }) {
  const { tw, th, paso: P, vistas: NV } = datos, gx = tw / P + 1, gy = th / P + 1, k = alto / th;
  const NT = datos.cenital ? NV + 1 : NV;      // con vista cenital (Yafar, 24 nov) el atlas lleva una novena tesela
  // el atlas va en una fila, o en varias si las teselas son anchas (datos.filas): la tesela n está en la columna n % COLS de la fila ⌊n / COLS⌋
  const FILAS = datos.filas || 1, COLS = Math.ceil(NT / FILAS), uDe = (n, fx) => ((n % COLS) + fx) / COLS, vDe = (n, fy) => 1 - (Math.floor(n / COLS) + fy) / FILAS;
  const [t0, t1] = datos.tela, grupo = new THREE.Group(), capas = [];
  const uPres = { value: 1 }, uPresReves = { value: 0 }, uLado = { value: new THREE.Vector2(1, 0) }, TOCA = datos.toca || null, R_MANO = 34, R_DEDOS = 26;
  const campana = (px, py, c, r) => (c ? Math.exp(-(((px - c[0] * tw) ** 2 + (py - c[1] * th) ** 2) / (r * r))) : 0);
  let zMano = 0;
  for (let n = 0; n < NV; n++) {
    const zg = b64(datos.z8[n]), bits = b64(datos.cubre8[n]), cubre = (i, j) => { const q = j * (gx - 1) + i; return (bits[q >> 3] >> (7 - (q & 7))) & 1; };
    const zEn = (i, j) => (zg[j * gx + i] / 255) * datos.zmax * k;
    // cuánto se corre cada punto, a lo ancho de la pintura, al llegar a la vista vecina (de más azimut | de menos azimut)
    // viene en una rejilla más gruesa (un nudo cada giroPaso vértices) y aquí se interpola
    const gg = datos.giro8 ? new Int8Array(b64(datos.giro8[n]).buffer) : null, ke = (datos.giroEsc || 0) * k, GP = datos.giroPaso || 1, cx = Math.ceil((gx - 1) / GP) + 1, cy = Math.ceil((gy - 1) / GP) + 1;
    const giroEn = (i, j, lado) => {
      const I = Math.min(cx - 2, Math.floor(i / GP)), J = Math.min(cy - 2, Math.floor(j / GP)), fi = i / GP - I, fj = j / GP - J, o = lado * cx * cy + J * cx + I;
      return ((gg[o] * (1 - fi) + gg[o + 1] * fi) * (1 - fj) + (gg[o + cx] * (1 - fi) + gg[o + cx + 1] * fi) * fj) * ke;
    };
    const az = datos.azimut[n] * GRADOS, sn = Math.sin(az), cs = Math.cos(az);
    if (n === 0) zMano = zEn(Math.min(gx - 1, Math.round((datos.mano[0] * tw) / P)), Math.min(gy - 1, Math.round((datos.mano[1] * th) / P)));
    const izq = new Float32Array(gy).fill(1e9), der = new Float32Array(gy).fill(-1e9);
    for (let j = 0; j < gy - 1; j++) for (let i = 0; i < gx - 1; i++) if (cubre(i, j)) for (const jj of [j, j + 1]) { izq[jj] = Math.min(izq[jj], i); der[jj] = Math.max(der[jj], i + 1); }
    const pos = [], uv = [], idx = [], peso = [], giro = [], manos = TOCA ? [] : null, mapa = new Int32Array(gx * gy).fill(-1);
    const vertice = (i, j) => {
      const q = j * gx + i; let v = mapa[q]; if (v >= 0) return v;
      v = pos.length / 3; mapa[q] = v;
      // en la cáscara: xs a lo ancho de la pintura, zs hacia quien mira; se pasa al espacio de la figura girando en el eje
      const xs = (i * P - tw / 2) * k, y = (th - j * P) * k, zs = zEn(i, j), yn = (j * P) / th;
      const x = xs * cs + zs * sn, z = -xs * sn + zs * cs;
      pos.push(x, y, z); uv.push(uDe(n, (i * P) / tw), vDe(n, yn)); giro.push(gg ? giroEn(i, j, 0) : 0, gg ? giroEn(i, j, 1) : 0);
      const ancho = Math.max(1, der[j] - izq[j]), rel = Math.abs(((i - izq[j]) / ancho) * 2 - 1), xn = x / (alto * 0.2);
      // bajo de la falda: cada lado se mece por su cuenta al andar
      const wp = 0.4 * paso(0.5, 1.0, yn) ** 1.5 * Math.tanh(xn * 3);
      // telas con vuelo (velo y gasa): lo que queda detrás del cuerpo y las orillas, más cuanto más abajo
      const wy = paso(t0, t1, yn) * (1 - paso(t1 + 0.02, t1 + 0.1, yn));
      const detras = cs < -0.5 ? 1 : paso(0.03, 0.12, -z / alto), wt = wy * Math.max(detras, paso(0.62, 1, rel) * (cs > 0.5 ? 1 : 0.5));
      peso.push(wp, wt, yn);
      if (manos) manos.push(campana(i * P, j * P, TOCA.rasgueo?.[n], R_MANO), campana(i * P, j * P, TOCA.dedos?.[n], R_DEDOS));
      return v;
    };
    for (let j = 0; j < gy - 1; j++) for (let i = 0; i < gx - 1; i++) {
      if (!cubre(i, j)) continue;
      const a = vertice(i, j), b = vertice(i + 1, j), c = vertice(i, j + 1), d = vertice(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2)); geo.setAttribute('giro', new THREE.BufferAttribute(new Float32Array(giro), 2));
    geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.5;      // con holgura: la cáscara gira hacia la cámara y se deforma
    // Dos materiales por cáscara: el de siempre (opaco) y el mismo translúcido, que solo se usa durante el relevo, cuando la
    // cáscara va encima de la otra. Comparten todo lo demás.
    const uVer = { value: 1 }, uAlReves = { value: 0 }, uVuelta = { value: 0 }, uGiro = { value: 0 }, uFunde = { value: 1 }, uCerca = { value: 0 };
    const material = (encima) => {
      const m = new THREE.MeshStandardMaterial({ map: textura, alphaTest: 0.5, roughness: 0.86, metalness: 0, envMapIntensity: 0.55, emissive: 0xfff0d0, emissiveMap: textura, emissiveIntensity: 0, shadowSide: THREE.DoubleSide, transparent: encima });
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uVer, uAlReves, uPres, uPresReves, uVuelta, uGiro, uLado, uFunde, uCerca });
        sh.vertexShader = sh.vertexShader.replace('#include <common>', CABECERA_V).replace('#include <beginnormal_vertex>', NORMAL_V).replace('#include <begin_vertex>', VERTICE_V).replace('#include <project_vertex>', CERCA_V);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', CABECERA + '\nuniform float uFunde;').replace('#include <map_fragment>', TRAMA).replace('#include <alphatest_fragment>', FUNDE);
      };
      m.customProgramCacheKey = () => 'figura-vistas-3';
      return m;
    };
    const mat = material(false), matEncima = material(true);
    const malla = new THREE.Mesh(geo, mat); malla.castShadow = true; malla.receiveShadow = false; malla.visible = n === 0; grupo.add(malla);
    capas.push({ malla, geo, mat, matEncima, uVer, uAlReves, uVuelta, uGiro, uFunde, uCerca, az, base: new Float32Array(pos), peso, manos, P3: geo.attributes.position, quieto: true, sucio: false });
  }

  // Vista cenital (Yafar, 24 nov): la pintura desde arriba, acostada a la altura del turbante. Aparece cuando la cámara está
  // casi a plomo (ponerElevacion) y se reparte los puntos con la cáscara de turno, igual que en el relevo entre vistas.
  let cenital = null, uArriba = 0;
  if (datos.cenital) {
    const { x: cx, y: cy, w: cw, h: ch, ancho } = datos.cenital, an = ancho * alto, fo = an * ch / cw;
    const geo = new THREE.PlaneGeometry(an, fo); geo.rotateX(-Math.PI / 2);      // la orilla de arriba de la pintura (la espalda) queda hacia −Z
    const uvA = geo.attributes.uv;
    for (let q = 0; q < uvA.count; q++) uvA.setXY(q, uDe(NV, (cx + uvA.getX(q) * cw) / tw), vDe(NV, (cy + (1 - uvA.getY(q)) * ch) / th));
    const mat = new THREE.MeshStandardMaterial({ map: textura, alphaTest: 0.5, roughness: 0.86, metalness: 0, emissive: 0xfff0d0, emissiveMap: textura, emissiveIntensity: 0 });
    const uVer = { value: 0 }, uAlReves = { value: 1 }, siempre = { value: 1 }, no = { value: 0 };      // la cenital no entra en el relevo entre figuras
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uVer = uVer; sh.uniforms.uAlReves = uAlReves; sh.uniforms.uPres = siempre; sh.uniforms.uPresReves = no;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', CABECERA).replace('#include <map_fragment>', TRAMA);
    };
    mat.customProgramCacheKey = () => 'figura-cenital-1';
    const malla = new THREE.Mesh(geo, mat); malla.position.y = alto * (datos.cenital.y0 ?? 0.97); malla.visible = false; malla.castShadow = false; grupo.add(malla);
    cenital = { malla, geo, mat, uVer, uAlReves };
  }
  // ángulo de la cámara sobre el horizonte, visto desde la figura: de 58° a 70° se pasa a la vista cenital (el dhow cambia hacia los 60°)
  function ponerElevacion(e) { if (cenital) uArriba = paso(58 * GRADOS, 70 * GRADOS, e); }
  // Presencia (0 a 1): cuánto de la figura se ve cuando comparte sitio con otra del mismo personaje. Las dos se reparten los
  // puntos de la pantalla: a una se le da p y a la otra 1 − p con alReves. La vista cenital no entra: se ve siempre.
  let presencia = 1;
  function ponerPresencia(p, alReves = false) { presencia = Math.min(1, Math.max(0, p)); uPres.value = presencia; uPresReves.value = alReves ? 1 : 0; }

  // El material translúcido se compila la primera vez que se dibuja; para que eso no caiga en el primer giro (un tirón), se
  // dibuja desde el principio en un triángulo sin tamaño y se retira al rato.
  let cebo = new THREE.Mesh(new THREE.BufferGeometry(), capas[0].matEncima), cuadrosCebo = 0;
  cebo.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); cebo.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(9), 3));
  cebo.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2)); cebo.geometry.setAttribute('giro', new THREE.BufferAttribute(new Float32Array(6), 2));
  cebo.frustumCulled = false; cebo.castShadow = false; grupo.add(cebo);

  // Desde dónde se mira la figura (ángulo de la cámara alrededor de ella, en su propio espacio; 0 = de frente): elige la vista,
  // la pone de cara a quien mira y la deforma hacia la vecina según lo que lleve girado.
  // La vista no cambia hasta pasar un poco de la mitad del camino a la vecina (así no titila en el límite); si la figura va
  // girando, el cambio se adelanta lo justo para que el relevo quede centrado en esa mitad, donde las dos pinturas casan.
  // El relevo es un fundido breve y nunca se quedan dos pinturas a la vez: primero la nueva aparece encima de la anterior y,
  // desde la mitad, es la anterior la que se va de encima de la nueva (así ninguna orilla aparece ni desaparece de golpe).
  let actual = -1, previa = -1, tCambio = 0, aAntes = null, tAntes = 0, vel = 0;
  const lejos = (a, c) => Math.abs(angulo(a - c.az));
  function ponerAzimut(a, ahora = performance.now()) {
    if (aAntes === null) { aAntes = a; tAntes = ahora; }
    else if (ahora - tAntes >= 8) { const w = ahora - tAntes < 250 ? angulo(a - aAntes) / (ahora - tAntes) : 0; vel += (w - vel) * 0.4; aAntes = a; tAntes = ahora; }      // velocidad de giro, radianes por milisegundo
    const aAdel = a + Math.min(ADELANTO, Math.max(-ADELANTO, vel * FUNDIDO * 0.5));
    let mejor = 0; for (let n = 1; n < NV; n++) if (lejos(aAdel, capas[n]) < lejos(aAdel, capas[mejor])) mejor = n;
    if (actual < 0) actual = mejor;
    else if (mejor !== actual && lejos(aAdel, capas[actual]) > Math.PI / NV + HOLGURA) { previa = actual; actual = mejor; tCambio = ahora; }
    const u = previa < 0 ? 1 : Math.min(1, (ahora - tCambio) / FUNDIDO); if (u >= 1) previa = -1;
    const s = u * u * (3 - 2 * u), deLado = 1 - uArriba, ancho = 2 * Math.PI / NV;
    uLado.value.set(Math.cos(a), -Math.sin(a));
    for (let n = 0; n < NV; n++) {
      const c = capas[n], esta = n === actual || n === previa;
      c.malla.visible = esta && deLado > 0.001 && presencia > 0.001; if (!esta) continue;
      const d = angulo(a - c.az); c.uVuelta.value = d; c.uGiro.value = Math.min(1, Math.max(-1, d / ancho));
      c.uVer.value = deLado; c.uAlReves.value = 0;
      const encima = previa >= 0 && (s < 0.5 ? n === actual : n === previa);
      c.uFunde.value = encima ? (n === actual ? s : 1 - s) : 1; c.uCerca.value = encima ? 0.09 * alto : 0;
      const m = encima ? c.matEncima : c.mat; if (c.malla.material !== m) c.malla.material = m;
      c.malla.renderOrder = encima ? 1 : 0;
    }
    if (cebo && ++cuadrosCebo > 90) { grupo.remove(cebo); cebo.geometry.dispose(); cebo = null; }
    // la pintura cenital se gira con la cámara para que su frente (los pies) quede siempre hacia quien mira: desde atrás no sale de cabeza
    if (cenital) { cenital.uVer.value = uArriba; cenital.malla.visible = uArriba > 0.001; cenital.malla.rotation.y = a; }
  }
  // true mientras dura un relevo entre vistas (quien dibuja bajo demanda debe seguir dibujando)
  const enRelevo = () => previa >= 0;

  // La mano que empuña (la derecha de la figura): ahí se monta el arma.
  const manoBase = new THREE.Vector3((datos.mano[0] * tw - tw / 2) * k, (1 - datos.mano[1]) * alto, zMano + 0.03 * alto);
  const brazo = new THREE.Group(); brazo.position.copy(manoBase); grupo.add(brazo);
  const mano = new THREE.Group(); brazo.add(mano);
  function alzar(u) { brazo.position.set(manoBase.x * (1 - 0.25 * u), manoBase.y + 0.2 * alto * u, manoBase.z + 0.07 * alto * u); }

  const yCadera = (1 - 0.55) * alto, yAsiento = 0.47 * alto;
  // Igual que en crearFigura: fase y andar (paso), vuelo (telas), empuje (inercia) y montar (sentada). Solo se mueven las cáscaras que se ven.
  // tocar (0 a 1, solo la figura con «toca»): la mano del plectro rasguea, los dedos de la otra se mueven sobre el mástil y la
  // cabeza se mece con la música.
  const yCuello = TOCA ? (1 - TOCA.cuello) * alto : 0, altoCabeza = Math.max(1e-4, alto - yCuello);
  function animar(t, { fase = 0, andar = 0, vuelo = 0, empuje = 0, montar = 0, encoger = 0.55, abrir = 0.5, tocar = 0 } = {}) {
    if (!TOCA) tocar = 0;
    const parado = andar < 0.002 && vuelo < 0.002 && Math.abs(empuje) < 0.002 && montar < 0.002 && tocar < 0.002;
    const rasgueo = tocar * 9 * k * Math.sin(t * 19.2) * (0.35 + 0.65 * Math.max(0, Math.sin(t * 3.2))), dedos = tocar * 3.5 * k * Math.sin(t * 7.3 + 1), mecer = tocar * 0.022 * alto * Math.sin(t * 1.6), asentir = tocar * 0.012 * alto * Math.sin(t * 3.2 + 0.6);
    const zancada = 0.34 * andar * (1 - montar), s0 = Math.sin(fase), sentada = montar > 0.002;
    for (const c of capas) {
      if (!c.malla.visible && c.quieto) continue;
      const A = c.P3.array, base = c.base, peso = c.peso, manos = c.manos, cs = Math.cos(c.az), sn = Math.sin(c.az);
      if (parado || !c.malla.visible) { if (!c.quieto) { A.set(base); c.P3.needsUpdate = true; c.quieto = true; } continue; }
      c.quieto = false;
      for (let v = 0, nv = peso.length / 3; v < nv; v++) {
        const q = v * 3, wp = peso[q], wt = peso[q + 1], yn = peso[q + 2];
        let x = base[q], y = base[q + 1], z = base[q + 2];
        if (wp && zancada) { const ang = zancada * s0 * wp, dy = y - yCadera, co = Math.cos(ang), si = Math.sin(ang); y = yCadera + dy * co + z * si; z = z * co - dy * si; }
        if (wt) {
          const onda = Math.sin(t * 6.2 - yn * 11) * 0.5 + Math.sin(t * 9.7 - yn * 17 + x * 9) * 0.25;
          z -= wt * alto * (0.045 * vuelo * (0.6 + onda) + 0.09 * empuje * yn);
          x += wt * alto * 0.012 * vuelo * Math.sin(t * 5.1 - yn * 8);
        }
        if (sentada && y < yAsiento) {
          const d = (yAsiento - y) / yAsiento, caida = Math.min(1, d * 3.5);
          y = yAsiento - (yAsiento - y) * (1 - (1 - encoger) * montar);
          x += montar * caida * (x * abrir + Math.tanh(x / (0.03 * alto)) * 0.03 * alto);
          z += montar * caida * 0.05 * alto * d;
        }
        if (tocar) {
          const wr = manos[v * 2], wd = manos[v * 2 + 1];
          if (wr > 0.01) y += wr * rasgueo;                                                   // el plectro sube y baja sobre las cuerdas
          if (wd > 0.01) { x += wd * dedos * cs; z -= wd * dedos * sn; y += wd * dedos * 0.4; }      // los dedos, a lo largo del mástil
          if (y > yCuello) { const h = ((y - yCuello) / altoCabeza) ** 1.3; x += mecer * h; y -= Math.abs(mecer) * 0.15 * h; z += asentir * h; }
        }
        A[q] = x; A[q + 1] = y; A[q + 2] = z;
      }
      c.P3.needsUpdate = true;
    }
  }
  function destruir() { for (const c of capas) { c.geo.dispose(); c.mat.dispose(); c.matEncima.dispose(); } if (cebo) cebo.geometry.dispose(); if (cenital) { cenital.geo.dispose(); cenital.mat.dispose(); } }
  // quien usa la figura solo le toca el brillo al material: se reparte a las ocho cáscaras (a sus dos materiales)
  const material = { get emissiveIntensity() { return capas[0].mat.emissiveIntensity; }, set emissiveIntensity(v) { for (const c of capas) { c.mat.emissiveIntensity = v; c.matEncima.emissiveIntensity = v; } if (cenital) cenital.mat.emissiveIntensity = v; }, emissive: { set(col) { for (const c of capas) { c.mat.emissive.set(col); c.matEncima.emissive.set(col); } if (cenital) cenital.mat.emissive.set(col); } } };
  return { grupo, malla: capas[0].malla, material, brazo, mano, alzar, animar, destruir, ponerLado() {}, ponerAzimut, ponerElevacion, ponerPresencia, get enRelevo() { return enRelevo(); }, get arriba() { return uArriba; }, yAsiento, alto, ancho: (datos.x1 - datos.x0) * k, fondo: datos.zmax * k * 1.6 };
}
