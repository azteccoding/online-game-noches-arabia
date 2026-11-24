// Monito de ocho vistas (Zubayda v5): una cáscara con relieve por cada pintura de la hoja de giro de 360°, todas de pie sobre
// el mismo eje y cada una mirando hacia su ángulo. Solo se dibuja la que mira a la cámara (y, al pasar de una a otra, las dos
// entretejidas punto a punto), así que desde cada ángulo se ve la pintura de ese ángulo tal como es: sin brazo doble, sin cara
// cortada y sin torso aplanado. preparar-vistas8.py deja el atlas (ocho vistas en fila) y los datos.
// La figura mira hacia +Z y tiene los pies en el origen; su costado izquierdo es +X. Devuelve lo mismo que crearFigura.
import * as THREE from 'three';

const paso = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const GRADOS = Math.PI / 180, HOLGURA = 3 * GRADOS, FUNDIDO = 160;      // cuánto hay que pasarse del límite para cambiar de vista, y milisegundos del relevo

// datos: { tw, th, paso, vistas, azimut[], zmax, z8[], cubre8[], x0, x1, mano, tela, piernas }
export function crearFiguraVistas(datos, textura, { alto }) {
  const { tw, th, paso: P, vistas: NV } = datos, gx = tw / P + 1, gy = th / P + 1, k = alto / th;
  const [t0, t1] = datos.tela, grupo = new THREE.Group(), capas = [];
  let zMano = 0;
  for (let n = 0; n < NV; n++) {
    const zg = b64(datos.z8[n]), bits = b64(datos.cubre8[n]), cubre = (i, j) => { const q = j * (gx - 1) + i; return (bits[q >> 3] >> (7 - (q & 7))) & 1; };
    const zEn = (i, j) => (zg[j * gx + i] / 255) * datos.zmax * k;
    const az = datos.azimut[n] * GRADOS, sn = Math.sin(az), cs = Math.cos(az);
    if (n === 0) zMano = zEn(Math.min(gx - 1, Math.round((datos.mano[0] * tw) / P)), Math.min(gy - 1, Math.round((datos.mano[1] * th) / P)));
    const izq = new Float32Array(gy).fill(1e9), der = new Float32Array(gy).fill(-1e9);
    for (let j = 0; j < gy - 1; j++) for (let i = 0; i < gx - 1; i++) if (cubre(i, j)) for (const jj of [j, j + 1]) { izq[jj] = Math.min(izq[jj], i); der[jj] = Math.max(der[jj], i + 1); }
    const pos = [], uv = [], idx = [], peso = [], mapa = new Int32Array(gx * gy).fill(-1);
    const vertice = (i, j) => {
      const q = j * gx + i; let v = mapa[q]; if (v >= 0) return v;
      v = pos.length / 3; mapa[q] = v;
      // en la cáscara: xs a lo ancho de la pintura, zs hacia quien mira; se pasa al espacio de la figura girando en el eje
      const xs = (i * P - tw / 2) * k, y = (th - j * P) * k, zs = zEn(i, j), yn = (j * P) / th;
      const x = xs * cs + zs * sn, z = -xs * sn + zs * cs;
      pos.push(x, y, z); uv.push((n + (i * P) / tw) / NV, 1 - yn);
      const ancho = Math.max(1, der[j] - izq[j]), rel = Math.abs(((i - izq[j]) / ancho) * 2 - 1), xn = x / (alto * 0.2);
      // bajo de la falda: cada lado se mece por su cuenta al andar
      const wp = 0.4 * paso(0.5, 1.0, yn) ** 1.5 * Math.tanh(xn * 3);
      // telas con vuelo (velo y gasa): lo que queda detrás del cuerpo y las orillas, más cuanto más abajo
      const wy = paso(t0, t1, yn) * (1 - paso(t1 + 0.02, t1 + 0.1, yn));
      const detras = cs < -0.5 ? 1 : paso(0.03, 0.12, -z / alto), wt = wy * Math.max(detras, paso(0.62, 1, rel) * (cs > 0.5 ? 1 : 0.5));
      peso.push(wp, wt, yn);
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
      sh.uniforms.uVer = uVer; sh.uniforms.uAlReves = uAlReves;
      // al cambiar de vista las dos cáscaras se reparten los puntos de la pantalla: una pinta los que la otra deja
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uVer;\nuniform float uAlReves;')
        .replace('#include <map_fragment>', '#include <map_fragment>\nif (uVer < 0.999) { float r = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (uAlReves > 0.5 ? r < 1.0 - uVer : r >= uVer) discard; }');
    };
    mat.customProgramCacheKey = () => 'figura-vistas-1';
    const malla = new THREE.Mesh(geo, mat); malla.castShadow = true; malla.receiveShadow = false; malla.visible = n === 0; grupo.add(malla);
    capas.push({ malla, geo, mat, uVer, uAlReves, az, base: new Float32Array(pos), peso, P3: geo.attributes.position, quieto: true, sucio: false });
  }

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
      const ver = n === actual ? u : n === previa ? 1 - u : 0;
      c.uVer.value = ver; c.uAlReves.value = n === previa ? 1 : 0; c.malla.visible = ver > 0.001;
    });
  }

  // La mano que empuña (la derecha de la figura): ahí se monta el arma.
  const manoBase = new THREE.Vector3((datos.mano[0] * tw - tw / 2) * k, (1 - datos.mano[1]) * alto, zMano + 0.03 * alto);
  const brazo = new THREE.Group(); brazo.position.copy(manoBase); grupo.add(brazo);
  const mano = new THREE.Group(); brazo.add(mano);
  function alzar(u) { brazo.position.set(manoBase.x * (1 - 0.25 * u), manoBase.y + 0.2 * alto * u, manoBase.z + 0.07 * alto * u); }

  const yCadera = (1 - 0.55) * alto, yAsiento = 0.47 * alto;
  // Igual que en crearFigura: fase y andar (paso), vuelo (telas), empuje (inercia) y montar (sentada). Solo se mueven las cáscaras que se ven.
  function animar(t, { fase = 0, andar = 0, vuelo = 0, empuje = 0, montar = 0, encoger = 0.55, abrir = 0.5 } = {}) {
    const parado = andar < 0.002 && vuelo < 0.002 && Math.abs(empuje) < 0.002 && montar < 0.002;
    const zancada = 0.34 * andar * (1 - montar), s0 = Math.sin(fase), sentada = montar > 0.002;
    for (const c of capas) {
      if (!c.malla.visible && c.quieto) continue;
      const A = c.P3.array, base = c.base, peso = c.peso;
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
        A[q] = x; A[q + 1] = y; A[q + 2] = z;
      }
      c.P3.needsUpdate = true;
    }
  }
  function destruir() { for (const c of capas) { c.geo.dispose(); c.mat.dispose(); } }
  // quien usa la figura solo le toca el brillo al material: se reparte a las ocho cáscaras
  const material = { get emissiveIntensity() { return capas[0].mat.emissiveIntensity; }, set emissiveIntensity(v) { for (const c of capas) c.mat.emissiveIntensity = v; }, emissive: { set(col) { for (const c of capas) c.mat.emissive.set(col); } } };
  return { grupo, malla: capas[0].malla, material, brazo, mano, alzar, animar, destruir, ponerLado() {}, ponerAzimut, yAsiento, alto, ancho: (datos.x1 - datos.x0) * k, fondo: datos.zmax * k * 1.6 };
}
