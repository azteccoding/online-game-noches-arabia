// Monito de ocho vistas (Zubayda v5): una cáscara con relieve por cada pintura de la hoja de giro de 360°, todas de pie sobre
// el mismo eje y cada una mirando hacia su ángulo. Solo se dibuja la que mira a la cámara (y, al pasar de una a otra, las dos
// entretejidas punto a punto), así que desde cada ángulo se ve la pintura de ese ángulo tal como es: sin brazo doble, sin cara
// cortada y sin torso aplanado. preparar-vistas8.py deja el atlas (las ocho vistas en fila, o en dos filas) y los datos.
// La figura mira hacia +Z y tiene los pies en el origen; su costado izquierdo es +X. Devuelve lo mismo que crearFigura.
import * as THREE from 'three';

const paso = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const GRADOS = Math.PI / 180, HOLGURA = 3 * GRADOS, FUNDIDO = 160;      // cuánto hay que pasarse del límite para cambiar de vista, y milisegundos del relevo

// Lo que se le añade al material de cada cáscara. uVer / uAlReves: el relevo entre vistas (y con la cenital). uPres / uPresReves:
// el relevo entre dos figuras del mismo personaje (Jamil de pie y Jamil sentado tocando): otra trama, para que no se estorben.
const TRAMA = '#include <map_fragment>\nif (uVer < 0.999) { float r = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (uAlReves > 0.5 ? r < 1.0 - uVer : r >= uVer) discard; }'
  + '\nif (uPres < 0.999) { float r2 = fract(52.9829189 * fract(dot(gl_FragCoord.yx + 17.0, vec2(0.06711056, 0.00583715)))); if (uPresReves > 0.5 ? r2 < 1.0 - uPres : r2 >= uPres) discard; }';
const CABECERA = '#include <common>\nuniform float uVer;\nuniform float uAlReves;\nuniform float uPres;\nuniform float uPresReves;';

// datos: { tw, th, paso, vistas, azimut[], zmax, z8[], cubre8[], x0, x1, mano, tela, piernas, toca? }
// toca (la figura que toca el laúd): { rasgueo: [[x, y] | null × 8], dedos: [[x, y] | null × 8], cuello } en fracciones de la tesela:
// dónde está en cada vista la mano que rasguea y la que pisa las cuerdas, y a qué altura empieza la cabeza.
export function crearFiguraVistas(datos, textura, { alto }) {
  const { tw, th, paso: P, vistas: NV } = datos, gx = tw / P + 1, gy = th / P + 1, k = alto / th;
  const NT = datos.cenital ? NV + 1 : NV;      // con vista cenital (Yafar, 24 nov) el atlas lleva una novena tesela
  // el atlas va en una fila, o en varias si las teselas son anchas (datos.filas): la tesela n está en la columna n % COLS de la fila ⌊n / COLS⌋
  const FILAS = datos.filas || 1, COLS = Math.ceil(NT / FILAS), uDe = (n, fx) => ((n % COLS) + fx) / COLS, vDe = (n, fy) => 1 - (Math.floor(n / COLS) + fy) / FILAS;
  const [t0, t1] = datos.tela, grupo = new THREE.Group(), capas = [];
  const uPres = { value: 1 }, uPresReves = { value: 0 }, TOCA = datos.toca || null, R_MANO = 34, R_DEDOS = 26;
  const campana = (px, py, c, r) => (c ? Math.exp(-(((px - c[0] * tw) ** 2 + (py - c[1] * th) ** 2) / (r * r))) : 0);
  let zMano = 0;
  for (let n = 0; n < NV; n++) {
    const zg = b64(datos.z8[n]), bits = b64(datos.cubre8[n]), cubre = (i, j) => { const q = j * (gx - 1) + i; return (bits[q >> 3] >> (7 - (q & 7))) & 1; };
    const zEn = (i, j) => (zg[j * gx + i] / 255) * datos.zmax * k;
    const az = datos.azimut[n] * GRADOS, sn = Math.sin(az), cs = Math.cos(az);
    if (n === 0) zMano = zEn(Math.min(gx - 1, Math.round((datos.mano[0] * tw) / P)), Math.min(gy - 1, Math.round((datos.mano[1] * th) / P)));
    const izq = new Float32Array(gy).fill(1e9), der = new Float32Array(gy).fill(-1e9);
    for (let j = 0; j < gy - 1; j++) for (let i = 0; i < gx - 1; i++) if (cubre(i, j)) for (const jj of [j, j + 1]) { izq[jj] = Math.min(izq[jj], i); der[jj] = Math.max(der[jj], i + 1); }
    const pos = [], uv = [], idx = [], peso = [], manos = TOCA ? [] : null, mapa = new Int32Array(gx * gy).fill(-1);
    const vertice = (i, j) => {
      const q = j * gx + i; let v = mapa[q]; if (v >= 0) return v;
      v = pos.length / 3; mapa[q] = v;
      // en la cáscara: xs a lo ancho de la pintura, zs hacia quien mira; se pasa al espacio de la figura girando en el eje
      const xs = (i * P - tw / 2) * k, y = (th - j * P) * k, zs = zEn(i, j), yn = (j * P) / th;
      const x = xs * cs + zs * sn, z = -xs * sn + zs * cs;
      pos.push(x, y, z); uv.push(uDe(n, (i * P) / tw), vDe(n, yn));
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
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.25;
    const mat = new THREE.MeshStandardMaterial({ map: textura, alphaTest: 0.5, roughness: 0.86, metalness: 0, envMapIntensity: 0.55, emissive: 0xfff0d0, emissiveMap: textura, emissiveIntensity: 0, shadowSide: THREE.DoubleSide });
    const uVer = { value: n === 0 ? 1 : 0 }, uAlReves = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uVer = uVer; sh.uniforms.uAlReves = uAlReves; sh.uniforms.uPres = uPres; sh.uniforms.uPresReves = uPresReves;
      // al cambiar de vista las dos cáscaras se reparten los puntos de la pantalla: una pinta los que la otra deja
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', CABECERA).replace('#include <map_fragment>', TRAMA);
    };
    mat.customProgramCacheKey = () => 'figura-vistas-2';
    const malla = new THREE.Mesh(geo, mat); malla.castShadow = true; malla.receiveShadow = false; malla.visible = n === 0; grupo.add(malla);
    capas.push({ malla, geo, mat, uVer, uAlReves, az, base: new Float32Array(pos), peso, manos, P3: geo.attributes.position, quieto: true, sucio: false });
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
    mat.customProgramCacheKey = () => 'figura-vistas-2';
    const malla = new THREE.Mesh(geo, mat); malla.position.y = alto * (datos.cenital.y0 ?? 0.97); malla.visible = false; malla.castShadow = false; grupo.add(malla);
    cenital = { malla, geo, mat, uVer, uAlReves };
  }
  // ángulo de la cámara sobre el horizonte, visto desde la figura: de 58° a 70° se pasa a la vista cenital (el dhow cambia hacia los 60°)
  function ponerElevacion(e) { if (cenital) uArriba = paso(58 * GRADOS, 70 * GRADOS, e); }
  // Presencia (0 a 1): cuánto de la figura se ve cuando comparte sitio con otra del mismo personaje. Las dos se reparten los
  // puntos de la pantalla: a una se le da p y a la otra 1 − p con alReves. La vista cenital no entra: se ve siempre.
  let presencia = 1;
  function ponerPresencia(p, alReves = false) { presencia = Math.min(1, Math.max(0, p)); uPres.value = presencia; uPresReves.value = alReves ? 1 : 0; }

  // Desde dónde se mira la figura (ángulo de la cámara alrededor de ella, en su propio espacio; 0 = de frente): elige la vista.
  // La vista no cambia hasta pasar un poco de la mitad del camino a la vecina (así no titila en el límite) y el relevo es un
  // fundido breve: nunca se quedan dos pinturas a la vez.
  let actual = -1, previa = -1, tCambio = 0;
  const lejos = (a, c) => { let d = Math.abs(a - c.az) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
  function ponerAzimut(a, ahora = performance.now()) {
    let mejor = 0; for (let n = 1; n < NV; n++) if (lejos(a, capas[n]) < lejos(a, capas[mejor])) mejor = n;
    if (actual < 0) actual = mejor;
    else if (mejor !== actual && lejos(a, capas[actual]) > Math.PI / NV + HOLGURA) { previa = actual; actual = mejor; tCambio = ahora; }
    const u = previa < 0 ? 1 : Math.min(1, (ahora - tCambio) / FUNDIDO); if (u >= 1) previa = -1;
    capas.forEach((c, n) => {
      const ver = (n === actual ? u : n === previa ? 1 - u : 0) * (1 - uArriba);
      c.uVer.value = ver; c.uAlReves.value = n === previa ? 1 : 0; c.malla.visible = ver > 0.001 && presencia > 0.001;
    });
    // la pintura cenital se gira con la cámara para que su frente (los pies) quede siempre hacia quien mira: desde atrás no sale de cabeza
    if (cenital) { cenital.uVer.value = uArriba; cenital.malla.visible = uArriba > 0.001; cenital.malla.rotation.y = a; }
  }

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
  function destruir() { for (const c of capas) { c.geo.dispose(); c.mat.dispose(); } if (cenital) { cenital.geo.dispose(); cenital.mat.dispose(); } }
  // quien usa la figura solo le toca el brillo al material: se reparte a las ocho cáscaras
  const material = { get emissiveIntensity() { return capas[0].mat.emissiveIntensity; }, set emissiveIntensity(v) { for (const c of capas) c.mat.emissiveIntensity = v; if (cenital) cenital.mat.emissiveIntensity = v; }, emissive: { set(col) { for (const c of capas) c.mat.emissive.set(col); if (cenital) cenital.mat.emissive.set(col); } } };
  return { grupo, malla: capas[0].malla, material, brazo, mano, alzar, animar, destruir, ponerLado() {}, ponerAzimut, ponerElevacion, ponerPresencia, get arriba() { return uArriba; }, yAsiento, alto, ancho: (datos.x1 - datos.x0) * k, fondo: datos.zmax * k * 1.6 };
}
