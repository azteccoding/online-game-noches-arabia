// Figuras de los personajes: miniaturas con volumen levantadas a partir de la ilustración de cada hoja de referencia.
// preparar-figuras.py entrega, por personaje, una textura (frente | espalda) y un relieve (cuánto sale cada punto del cuerpo);
// aquí se arman dos cáscaras —la de delante y la de detrás— que se cierran en el contorno y se pintan con la ilustración.
// La figura mira hacia +Z y tiene los pies en el origen. En la cabeza, por delante, manda la vista de frente: así el rostro no se mezcla con el de perfil al mirar la figura en diagonal.
import * as THREE from 'three';
import { crearFiguraVistas } from './figuras8.js';

export const ALTO_FIGURA = 1.16;
// Estaturas (Jorge, 25 nov 2026), de mayor a menor y en tres grupos que deben notarse: los más altos, Anís, Yafar y Nur al Din;
// los de estatura promedio, Ruyán, Jamil y Zubayda; los más bajos, Adí y Zein. Entre un grupo y el siguiente hay un 12 % de
// diferencia; dentro de cada grupo, un escalón chico para respetar el orden. Es la proporción sobre ALTO_FIGURA.
export const ESTATURA = { 3: 1.15, B: 1.135, 1: 1.12, 5: 1.0, 4: 0.99, 6: 0.98, 7: 0.90, 2: 0.845,
  EP: 1.17,        // el esclavo peleador (27 nov): alto y fornido, un poco más que Yafar (su pintura llega hasta la punta de la cimera)
  EC: 1.10,
  CO: 1.12 };      // el esposo de Zein (28 nov): caballero alto, como Nur al Din      // el esclavo cargador (27 nov): su pintura llega hasta la tinaja que corona la cesta; el cuerpo (hasta el pelo) queda en 1.05, algo menos que el peleador
export const altoDe = (pid) => ALTO_FIGURA * (ESTATURA[pid] ?? 1);
const paso = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// datos: { tw, th, teselas, paso, zmax, z, zb, cubre, mano, tela, piernas } (zb, opcional: relieve propio de la cáscara de detrás) · textura: THREE.Texture del atlas (frente | espalda | costado)
export function crearFigura(datos, textura, { alto = ALTO_FIGURA } = {}) {
  if (datos.vistas) return crearFiguraVistas(datos, textura, { alto });      // monito de ocho vistas: una cáscara por pintura de la hoja de 360°
  const { tw, th, paso: P } = datos, gx = tw / P + 1, gy = th / P + 1, k = alto / th, NT = datos.teselas || 2;
  const zg = b64(datos.z), bits = b64(datos.cubre), cubre = (i, j) => { const n = j * (gx - 1) + i; return (bits[n >> 3] >> (7 - (n & 7))) & 1; };
  // el relieve viene con signo: vale cero en el contorno y es negativo fuera, así las dos cáscaras se cruzan justo en el borde
  const zMin = datos.zmin || 0, SOLAPE = 3 * k, zEn = (i, j) => (zMin + (zg[j * gx + i] / 255) * (datos.zmax - zMin)) * k - SOLAPE;
  const zgB = datos.zb ? b64(datos.zb) : zg, zDetras = (i, j) => (zMin + (zgB[j * gx + i] / 255) * (datos.zmax - zMin)) * k - SOLAPE;

  // bordes de la silueta en cada fila (para saber qué tan cerca del contorno está un punto)
  const izq = new Float32Array(gy).fill(1e9), der = new Float32Array(gy).fill(-1e9);
  for (let j = 0; j < gy - 1; j++) for (let i = 0; i < gx - 1; i++) if (cubre(i, j)) { for (const jj of [j, j + 1]) { izq[jj] = Math.min(izq[jj], i); der[jj] = Math.max(der[jj], i + 1); } }

  // fondo máximo de cada fila, por delante y por detrás: el costado se pinta con la vista de perfil, repartida de delante (u = 0) a atrás (u = 1)
  const zFila = new Float32Array(gy), zFilaB = new Float32Array(gy);
  for (let j = 0; j < gy; j++) { let m = 0, mB = 0; for (let i = 0; i < gx; i++) { m = Math.max(m, zEn(i, j)); mB = Math.max(mB, zDetras(i, j)); } zFila[j] = m; zFilaB[j] = mB; }
  for (const zf of [zFila, zFilaB]) for (let j = 0; j < gy; j++) zf[j] = Math.max(zf[j], 0.25 * Math.max(zf[Math.max(0, j - 1)], zf[Math.min(gy - 1, j + 1)]), 1e-4);
  const finaB = datos.fina ? b64(datos.fina) : null, esFina = (n) => (finaB ? (finaB[n >> 3] >> (7 - (n & 7))) & 1 : 0), fina = [];      // gasa suelta: de perfil puro se pinta entera con la vista de perfil (de canto era una raya sobre el cuerpo)
  const pos = [], uv = [], uvL = [], cara = [], idx = [], peso = [];      // peso: [piernas (con signo), tela, altura normalizada]
  const mapa = [new Int32Array(gx * gy).fill(-1), new Int32Array(gx * gy).fill(-1)];
  const [t0, t1] = datos.tela, piernas = datos.piernas || 0;
  function vertice(c, i, j) {
    const n = j * gx + i; let v = mapa[c][n]; if (v >= 0) return v;
    v = pos.length / 3; mapa[c][n] = v;
    const x = (i * P - tw / 2) * k, y = (th - j * P) * k, z = c ? -zDetras(i, j) : zEn(i, j), yn = (j * P) / th;
    pos.push(x, y, z); uv.push((c + (i * P) / tw) / NT, 1 - yn);
    uvL.push((2 + Math.min(0.995, Math.max(0.005, (zFila[j] - z) / (zFila[j] + zFilaB[j])))) / NT, 1 - yn);
    fina.push(esFina(n));
    cara.push(c ? 0 : 1 - paso(0.2, 0.26, yn));      // cabeza de la cáscara de delante
    const ancho = Math.max(1, der[j] - izq[j]), rel = Math.abs(((i - izq[j]) / ancho) * 2 - 1), xn = x / (alto * 0.2);
    // piernas: bajo el borde de la túnica, cada lado se mueve por su cuenta; con túnica larga solo se mece el bajo
    const wp = piernas ? paso(piernas - 0.02, piernas + 0.06, yn) * Math.sign(xn || 1) : 0.4 * paso(0.5, 1.0, yn) ** 1.5 * Math.tanh(xn * 3);
    // tela (capa, velo, chal): con vuelo por detrás y en los costados, más cuanto más abajo
    const wy = paso(t0, t1, yn) * (1 - paso(t1 + 0.02, t1 + 0.1, yn)), wt = wy * (c ? 1 : paso(0.62, 1, rel));
    peso.push(wp, wt, yn);
    return v;
  }
  for (let j = 0; j < gy - 1; j++) for (let i = 0; i < gx - 1; i++) {
    if (!cubre(i, j)) continue;
    const a = vertice(0, i, j), b = vertice(0, i + 1, j), c = vertice(0, i, j + 1), d = vertice(0, i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
    const a2 = vertice(1, i, j), b2 = vertice(1, i + 1, j), c2 = vertice(1, i, j + 1), d2 = vertice(1, i + 1, j + 1);
    idx.push(a2, b2, c2, b2, d2, c2);
  }
  const geo = new THREE.BufferGeometry(), base = new Float32Array(pos);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2)); geo.setAttribute('uvLado', new THREE.BufferAttribute(new Float32Array(uvL), 2)); geo.setAttribute('fina', new THREE.BufferAttribute(new Float32Array(fina), 1)); geo.setAttribute('cara', new THREE.BufferAttribute(new Float32Array(cara), 1));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.25;
  const mat = new THREE.MeshStandardMaterial({ map: textura, alphaTest: 0.5, roughness: 0.86, metalness: 0, envMapIntensity: 0.55, emissive: 0xfff0d0, emissiveMap: textura, emissiveIntensity: 0 });
  // Vista de costado: donde la superficie mira hacia los lados se pinta con la vista de perfil de la hoja, tanto más cuanto
  // más de lado se mira la figura (uLado: 0 de frente o de espalda, 1 de perfil). De frente no cambia nada.
  const uLado = { value: 0 };
  if (NT >= 3) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uLado = uLado;
      sh.uniforms.uCaraLado = { value: NT >= 4 ? 1 : 0 };      // con costado propio por lado, de perfil puro también la cabeza se pinta con la vista de perfil (si no, la cara salía cortada)
      sh.uniforms.uOtroLado = { value: NT >= 4 ? 1 / NT : 0 };      // cuarta tesela: el costado izquierdo de la figura (x > 0), distinto del derecho
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 uvLado;\nattribute float cara;\nattribute float fina;\nvarying float vFina;\nuniform float uOtroLado;\nvarying vec2 vUvLado;\nvarying float vPesoLado;\nvarying float vCara;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUvLado = uvLado + vec2(objectNormal.x > 0.0 ? uOtroLado : 0.0, 0.0); vPesoLado = abs(objectNormal.x); vCara = cara; vFina = fina;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLado;\nuniform float uCaraLado;\nvarying float vFina;\nvarying vec2 vUvLado;\nvarying float vPesoLado;\nvarying float vCara;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n{ float ca = vCara * (1.0 - uCaraLado * uLado); float wL = uLado * smoothstep(mix(0.3, 0.86, ca), mix(0.72, 0.99, ca), vPesoLado); wL = max(wL, uCaraLado * uLado * vFina); if (wL > 0.003) diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(map, vUvLado).rgb, wL); }');
    };
    mat.customProgramCacheKey = () => 'figura-lado-6';
  }
  const malla = new THREE.Mesh(geo, mat); malla.castShadow = true; malla.receiveShadow = true;
  const grupo = new THREE.Group(); grupo.add(malla);

  // La mano que empuña (la derecha de la figura): ahí se monta el arma. Sube y se adelanta cuando el golpe lo pide.
  const mi = Math.round((datos.mano[0] * tw) / P), mj = Math.round((datos.mano[1] * th) / P);
  const manoBase = new THREE.Vector3((datos.mano[0] * tw - tw / 2) * k, (1 - datos.mano[1]) * alto, zEn(Math.min(gx - 1, mi), Math.min(gy - 1, mj)) + 0.03 * alto);
  const brazo = new THREE.Group(); brazo.position.copy(manoBase); grupo.add(brazo);
  const mano = new THREE.Group(); brazo.add(mano);
  function alzar(u) { brazo.position.set(manoBase.x * (1 - 0.25 * u), manoBase.y + 0.2 * alto * u, manoBase.z + 0.07 * alto * u); }

  // Vértices que se mueven (piernas o bajo de la túnica, y telas con vuelo)
  const vivos = []; for (let v = 0; v < peso.length / 3; v++) if (Math.abs(peso[v * 3]) > 0.01 || peso[v * 3 + 1] > 0.01) vivos.push(v);
  const yCadera = (1 - Math.max(0.3, (piernas || 0.62) - 0.07)) * alto, P3 = geo.attributes.position;
  let quieto = true;
  const nVert = peso.length / 3, todos = Array.from({ length: nVert }, (_, v) => v), yAsiento = 0.47 * alto;
  // fase: avance del paso (radianes) · andar: 0–1 cuánto camina · vuelo: 0–1 cuánto se agitan las telas · empuje: inercia hacia atrás (−1…1)
  // montar: 0–1 cuánto va sentada (a horcajadas o sobre la alfombra): de la cadera para abajo se recoge («encoger»: fracción de
  // pierna que queda) y se abre hacia los lados («abrir»). La cadera no se mueve: quien llama sube o baja la figura entera.
  function animar(t, { fase = 0, andar = 0, vuelo = 0, empuje = 0, montar = 0, encoger = 0.55, abrir = 0.5 } = {}) {
    if (andar < 0.002 && vuelo < 0.002 && Math.abs(empuje) < 0.002 && montar < 0.002) { if (quieto) return; quieto = true; P3.array.set(base); P3.needsUpdate = true; return; }
    quieto = false;
    const A = P3.array, zancada = (piernas ? 0.5 : 0.34) * andar * (1 - montar), s0 = Math.sin(fase), sentada = montar > 0.002;
    if (!sentada && A.sucioPorMontar) { A.set(base); A.sucioPorMontar = false; }
    for (const v of sentada ? todos : vivos) {
      const q = v * 3, wp = peso[q], wt = peso[q + 1], yn = peso[q + 2];
      let x = base[q], y = base[q + 1], z = base[q + 2];
      if (wp && zancada) { const ang = zancada * s0 * wp, dy = y - yCadera, c = Math.cos(ang), s = Math.sin(ang); y = yCadera + dy * c + z * s; z = z * c - dy * s; }      // gira en la cadera, adelante y atrás
      if (wt) {
        const onda = Math.sin(t * 6.2 - yn * 11) * 0.5 + Math.sin(t * 9.7 - yn * 17 + x * 9) * 0.25;
        z -= wt * alto * (0.045 * vuelo * (0.6 + onda) + 0.09 * empuje * yn);
        x += wt * alto * 0.012 * vuelo * Math.sin(t * 5.1 - yn * 8);
      }
      if (sentada && y < yAsiento) {
        const d = (yAsiento - y) / yAsiento, caida = Math.min(1, d * 3.5);
        y = yAsiento - (yAsiento - y) * (1 - (1 - encoger) * montar);
        x += montar * caida * (x * abrir + Math.sign(x) * 0.03 * alto);
        z += montar * caida * 0.05 * alto * d;
      }
      A[q] = x; A[q + 1] = y; A[q + 2] = z;
    }
    if (sentada) A.sucioPorMontar = true;
    P3.needsUpdate = true;
  }
  function destruir() { geo.dispose(); mat.dispose(); }
  // con un costado por lado (4 teselas) la pintura de perfil solo entra casi de perfil: en tres cuartos duplicaba el brazo (Jorge, 24 de noviembre)
  return { grupo, malla, material: mat, brazo, mano, alzar, animar, destruir, ponerLado(u) { uLado.value = NT >= 4 ? Math.min(1, Math.max(0, (u - 0.86) / 0.12)) ** 2 : u; }, yAsiento, alto, ancho: (datos.x1 - datos.x0) * k, fondo: datos.zmax * k };
}

// Carga la textura de una figura (URL incrustada o normal). Devuelve una promesa.
export function cargarTexturaFigura(url, aniso = 8) {
  return new Promise((ok, mal) => {
    const img = new Image(); img.onload = () => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.needsUpdate = true; ok(t); };
    img.onerror = () => mal(new Error('No se pudo cargar la figura.')); img.src = url;
  });
}
