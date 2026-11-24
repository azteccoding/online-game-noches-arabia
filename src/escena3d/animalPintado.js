// Animales (y objetos) pintados (Jorge, 23 de noviembre de 2026): el modelo se levanta de la hoja de vistas que Jorge generó en
// ChatGPT. preparar-animales.py deja la vista de perfil recortada (la piel) y un relieve; aquí se arman dos cáscaras, la del lado
// izquierdo (+X) y la del derecho (−X), que se juntan en el contorno. En las patas las dos cáscaras se separan hacia su lado: así
// la izquierda lleva sus dos patas y la derecha las suyas, y cada pata se mueve por su cuenta (cadera y rodilla).
// Mira hacia +Z (la cabeza de la hoja, a la izquierda, queda delante) y apoya en y = 0.
import * as THREE from 'three';

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const paso = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// datos: el JSON de preparar-animales.py · textura: la vista de perfil · alto: altura total en unidades de mundo
// centroX: columna de la hoja que queda en z = 0 (por omisión, la del asiento)
export function crearModeloPintado(datos, textura, { alto = 1, centroX = null, material = {} } = {}) {
  const { tw, th, paso: P, gx, gy } = datos, k = alto / th, cx = centroX ?? (datos.asiento ? datos.asiento[0] : tw / 2);
  const zg = b64(datos.z), bits = b64(datos.cubre), cubre = (i, j) => { const n = j * (gx - 1) + i; return (bits[n >> 3] >> (7 - (n & 7))) & 1; };
  // Jorge (24 de noviembre: «el camello tiene 8 patas»): si el perfil pinta las cuatro patas, cada una va en una sola cáscara
  const bIzq = datos.soloIzq ? b64(datos.soloIzq) : null, bDer = datos.soloDer ? b64(datos.soloDer) : null;
  const solo = (bs, i, j) => { if (!bs) return 0; const n = j * (gx - 1) + i; return (bs[n >> 3] >> (7 - (n & 7))) & 1; };
  const patas = datos.panza != null, panza = datos.panza ?? th, separa = (datos.separa || 0) * k;
  const yRodilla = panza + 0.5 * (th - panza);
  const pos = [], uv = [], idx = [], info = [];      // info por vértice: [lado (+1/−1), grupo (0 delantera, 1 trasera), peso pata, peso rodilla]
  const mapa = [new Int32Array(gx * gy).fill(-1), new Int32Array(gx * gy).fill(-1)];
  function vertice(c, i, j) {
    const n = j * gx + i; let v = mapa[c][n]; if (v >= 0) return v;
    v = pos.length / 3; mapa[c][n] = v;
    const xp = Math.min(tw, i * P), yp = Math.min(th, j * P), s = c ? -1 : 1;
    const wl = patas ? paso(panza - 0.03 * th, panza + 0.06 * th, yp) : 0;
    const rel = (zg[n] / 255) * datos.zmax * k;
    pos.push(s * (rel + separa * wl), (th - yp) * k, (cx - xp) * k);
    uv.push(xp / tw, 1 - yp / th);
    info.push(s, xp < (datos.medio ?? tw / 2) ? 0 : 1, patas ? paso(panza - 0.08 * th, panza + 0.05 * th, yp) : 0, patas ? paso(yRodilla - 0.02 * th, yRodilla + 0.04 * th, yp) : 0);
    return v;
  }
  for (let j = 0; j < gy - 1; j++) for (let i = 0; i < gx - 1; i++) {
    if (!cubre(i, j)) continue;
    if (!solo(bDer, i, j)) { const a = vertice(0, i, j), b = vertice(0, i + 1, j), c = vertice(0, i, j + 1), d = vertice(0, i + 1, j + 1); idx.push(a, b, c, b, d, c); }
    if (!solo(bIzq, i, j)) { const a2 = vertice(1, i, j), b2 = vertice(1, i + 1, j), c2 = vertice(1, i, j + 1), d2 = vertice(1, i + 1, j + 1); idx.push(a2, c2, b2, b2, c2, d2); }
  }
  const geo = new THREE.BufferGeometry(), base = new Float32Array(pos);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.2;
  const mat = new THREE.MeshStandardMaterial({ map: textura, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0, envMapIntensity: 0.5, ...material });
  const malla = new THREE.Mesh(geo, mat); malla.castShadow = true; malla.receiveShadow = true;
  const P3 = geo.attributes.position, vivos = [];
  for (let v = 0; v < info.length / 4; v++) if (info[v * 4 + 2] > 0.001) vivos.push(v);
  const pivote = (p) => [(th - p[1]) * k, (cx - p[0]) * k];      // [y, z] en el mundo
  const cadera = patas ? [pivote(datos.del_), pivote(datos.tra)] : null;
  const rodilla = patas ? [[(th - yRodilla) * k, (cx - datos.del_[0]) * k], [(th - yRodilla) * k, (cx - datos.tra[0]) * k]] : null;
  // angulos[lado izq./der.][delantera/trasera] = [giro de cadera, doblez de rodilla] (radianes, como rotation.x: positivo lleva el casco hacia atrás)
  function moverPatas(angulos) {
    if (!patas) return;
    const A = P3.array;
    for (const v of vivos) {
      const q = v * 3, l = info[v * 4] > 0 ? 0 : 1, g = info[v * 4 + 1], w = info[v * 4 + 2], wr = info[v * 4 + 3];
      const [ac, ar] = angulos[l][g];
      let y = base[q + 1], z = base[q + 2];
      if (wr && ar) { const [py, pz] = rodilla[g], an = ar * wr, c = Math.cos(an), s = Math.sin(an), dy = y - py, dz = z - pz; y = py + dy * c - dz * s; z = pz + dy * s + dz * c; }
      if (ac) { const [py, pz] = cadera[g], an = ac * w, c = Math.cos(an), s = Math.sin(an), dy = y - py, dz = z - pz; y = py + dy * c - dz * s; z = pz + dy * s + dz * c; }
      A[q + 1] = y; A[q + 2] = z;
    }
    P3.needsUpdate = true;
  }
  const enMundo = (p) => new THREE.Vector3(0, (th - p[1]) * k, (cx - p[0]) * k);
  return { malla, material: mat, geo, moverPatas, k, asiento: datos.asiento ? enMundo(datos.asiento) : null, cabestro: datos.cabestro ? enMundo(datos.cabestro) : null, punto: enMundo,
    largo: tw * k, destruir() { geo.dispose(); mat.dispose(); } };
}

// Texturas: una por modelo, compartida por todas sus copias; empiezan a cargarse al importar este módulo.
const cache = {};
export function texturaPintada(clave) {
  if (!cache[clave]) {
    const t = new THREE.TextureLoader().load((import.meta.env?.BASE_URL || '/') + 'arte3d/animal-' + clave + '.webp');
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; cache[clave] = t;
  }
  return cache[clave];
}
