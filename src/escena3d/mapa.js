// Superficie del mapa: el SVG real del tablero se rasteriza en el navegador (no viaja como imagen), a todo lo que da la tarjeta,
// y al acercar la cámara se vuelve a rasterizar solo la zona que se mira («ventana de detalle») para que líneas y letras
// sigan nítidas a cualquier zoom. Aquí vive también el mar: oleaje, brillo del sol y de la luna y espuma en las costas.
import * as THREE from 'three';
import { ANCHO, ALTO, U } from './medidas.js';
import { lienzo } from './texturas.js';

const MAPA_W = ANCHO / U, MAPA_H = ALTO / U;      // 2970 × 2100

// Textura de oleaje que se repite sin costuras: pendientes (x, z) de una suma de ondas, en los canales rojo y verde.
function texOlas(N = 256) {
  const cv = lienzo(N, N), g = cv.getContext('2d'), im = g.createImageData(N, N), d = im.data;
  const ondas = [[1, 2, 0.0, 1], [-2, 1, 1.3, 0.8], [3, 1, 2.1, 0.55], [1, -4, 0.7, 0.42], [-4, -3, 4.0, 0.3], [5, -2, 5.2, 0.24], [2, 7, 3.3, 0.16], [-7, 4, 0.4, 0.13], [9, 5, 2.6, 0.09]];
  for (let j = 0, n = 0; j < N; j++) for (let i = 0; i < N; i++, n += 4) {
    let dx = 0, dz = 0, h = 0;
    for (const [kx, kz, f, a] of ondas) { const ph = (2 * Math.PI * (kx * i + kz * j)) / N + f, c = Math.cos(ph) * a; dx += c * kx; dz += c * kz; h += Math.sin(ph) * a; }
    d[n] = 128 + 127 * Math.max(-1, Math.min(1, dx / 9)); d[n + 1] = 128 + 127 * Math.max(-1, Math.min(1, dz / 9)); d[n + 2] = 128 + 127 * Math.max(-1, Math.min(1, h / 2.6)); d[n + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  return t;
}

// recursos.mapaSVG: texto del SVG del tablero; recursos.fuenteMapa: URL (data:) de la fuente de sus rótulos, si los lleva como texto.
export async function crearSuperficie({ renderer, recursos, rel, movil, anchoMapa, alProgreso }) {
  const maxTex = renderer.capabilities.maxTextureSize, aniso = renderer.capabilities.getMaxAnisotropy();
  const anchoBase = Math.min(maxTex, anchoMapa || (movil ? 4096 : 8192)), altoBase = Math.round(anchoBase * MAPA_H / MAPA_W);

  // --- Rasterizado del SVG: cualquier rectángulo del mapa, al tamaño en píxeles que se pida
  const svg = recursos.mapaSVG, m = svg.match(/<svg[^>]*>/);
  if (!m) throw new Error('El mapa no es un SVG.');
  const estilo = recursos.fuenteMapa ? `<style>@font-face{font-family:'Marcellus SC';src:url(${recursos.fuenteMapa}) format('woff2')}</style>` : '';
  const resto = encodeURIComponent(estilo + svg.slice(m.index + m[0].length));
  async function rasterizar(cv, x0, y0, w, h) {
    const cab = `<svg xmlns="http://www.w3.org/2000/svg" width="${cv.width}" height="${cv.height}" viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="none">`;
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cab) + resto;
    await img.decode();
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
  }
  alProgreso?.('Dibujando el mapa…');
  const cvBase = lienzo(anchoBase, altoBase); await rasterizar(cvBase, 0, 0, MAPA_W, MAPA_H);
  const tMapa = new THREE.CanvasTexture(cvBase); tMapa.colorSpace = THREE.SRGBColorSpace; tMapa.anisotropy = aniso; tMapa.minFilter = THREE.LinearMipmapLinearFilter; tMapa.generateMipmaps = true;
  tMapa.onUpdate = () => { cvBase.width = cvBase.height = 1; };      // ya está en la tarjeta: se suelta la copia en memoria

  // --- Ventana de detalle
  const DW = movil || maxTex < 8192 ? 2048 : 4096, DH = Math.round(DW * MAPA_H / MAPA_W);
  const cvDet = lienzo(DW, DH); cvDet.getContext('2d').fillStyle = '#e6d19a'; cvDet.getContext('2d').fillRect(0, 0, DW, DH);
  const tDet = new THREE.CanvasTexture(cvDet); tDet.colorSpace = THREE.SRGBColorSpace; tDet.anisotropy = aniso; tDet.minFilter = THREE.LinearMipmapLinearFilter; tDet.generateMipmaps = true;
  const det = { rect: null, mezcla: 0, activa: false, pendiente: false, quieta: 0, ux: 0, uz: 0, ud: 0, permitida: true };
  const uDetRect = { value: new THREE.Vector4(0, 0, 1, 1) }, uDetMezcla = { value: 0 }, uDet = { value: tDet };
  const pxBase = anchoBase / ANCHO;      // píxeles por unidad de mundo de la textura general

  // --- Material
  const tOlas = texOlas();
  const uni = { uAgua: { value: 0 }, tAgua: { value: rel.texAgua }, tOlas: { value: tOlas }, uLuna: { value: new THREE.Vector3(0, 1, 0) }, uLunaColor: { value: new THREE.Color(0) }, uMar: { value: 1 }, tDet: uDet, uDetRect, uDetMezcla };
  const mat = new THREE.MeshStandardMaterial({ map: tMapa, normalMap: rel.texNormal, normalScale: new THREE.Vector2(1.25, 1.25), roughness: 0.93, metalness: 0, envMapIntensity: 0.16, shadowSide: THREE.FrontSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvPosMundo = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vPosMundo;
      uniform float uAgua, uMar, uDetMezcla; uniform sampler2D tAgua, tOlas, tDet; uniform vec4 uDetRect; uniform vec3 uLuna, uLunaColor;
      float esMar, esRio, cercaTierra; vec3 olaN;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec2 dq = ( vMapUv - uDetRect.xy ) * uDetRect.zw;
          float borde = min( min( dq.x, 1.0 - dq.x ), min( dq.y, 1.0 - dq.y ) );
          float dentro = uDetMezcla * smoothstep( 0.0, 0.05, borde );
          if ( dentro > 0.0 ) diffuseColor.rgb = mix( diffuseColor.rgb, texture2D( tDet, dq ).rgb, dentro ); }
        { vec4 ag = texture2D( tAgua, vMapUv );
          esMar = smoothstep( 0.5, 0.64, ag.r ) * uMar; esRio = ag.g * 0.8 * uMar; cercaTierra = ag.b;
          vec2 p = vPosMundo.xz;
          vec3 o1 = texture2D( tOlas, p * 0.42 + uAgua * vec2( 0.021, 0.013 ) ).rgb - 0.5;
          vec3 o2 = texture2D( tOlas, p * 1.07 - uAgua * vec2( 0.017, 0.031 ) ).rgb - 0.5;
          vec3 o3 = texture2D( tOlas, p * 2.6 + uAgua * vec2( -0.04, 0.026 ) ).rgb - 0.5;
          olaN = o1 * 1.0 + o2 * 0.7 + o3 * 0.4;
          // espuma: una orla fina pegada a la costa y rizos que llegan a la orilla de vez en cuando
          float orla = smoothstep( 0.5, 0.58, ag.r ) * ( 1.0 - smoothstep( 0.62, 0.86, ag.r ) );
          float llega = sin( cercaTierra * 30.0 + uAgua * 1.25 + olaN.z * 5.0 );
          float rizo = smoothstep( 0.72, 0.98, llega ) * smoothstep( 0.04, 0.2, cercaTierra ) * ( 1.0 - smoothstep( 0.3, 0.5, cercaTierra ) );
          float espuma = clamp( orla * ( 0.45 + 0.9 * smoothstep( -0.1, 0.5, olaN.z + 0.25 * sin( uAgua * 0.9 + p.x * 3.0 + p.y * 2.0 ) ) ) + rizo * 0.5, 0.0, 1.0 ) * esMar;
          // el agua respira: un poco más honda o más clara según pasa la ola
          diffuseColor.rgb *= 1.0 + esMar * ( olaN.z * 0.16 );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.94, 0.97, 0.95 ), espuma * 0.4 ); }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix( roughness, 0.27, max( esMar, esRio ) );')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize( normal + ( viewMatrix * vec4( olaN.x, 0.0, olaN.y, 0.0 ) ).xyz * ( 0.34 * esMar + 0.12 * esRio ) );`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { vec3 rl = reflect( - geometryViewDir, normal );
          float bl = pow( max( dot( rl, uLuna ), 0.0 ), 90.0 );
          reflectedLight.directSpecular += uLunaColor * bl * esMar; }`);
  };

  // Luz de la luna sobre el agua: dirección (en el mundo) y color; la escena la pone según la hora.
  const dirLuna = new THREE.Vector3(0.5, 0.25, -0.8).normalize(), vTmp = new THREE.Vector3();
  function ponerLuna(dir, color, fuerza) { dirLuna.copy(dir).normalize(); uni.uLunaColor.value.copy(color).multiplyScalar(fuerza); }

  // Se llama en cada cuadro con la cámara ({ x, z, d } de camara.leer()). Decide si hace falta redibujar la ventana de detalle.
  function actualizar(t, dt, cam, vista, calma = true) {
    uni.uAgua.value = t;
    uni.uLuna.value.copy(vTmp.copy(dirLuna).transformDirection(cam.matrixWorldInverse));
    const movida = Math.hypot(vista.x - det.ux, vista.z - det.uz) > 0.02 * vista.d || Math.abs(vista.d - det.ud) > 0.02 * vista.d;
    det.ux = vista.x; det.uz = vista.z; det.ud = vista.d; det.quieta = movida ? 0 : det.quieta + dt;
    const ancho = Math.min(ANCHO, Math.max(3.2, vista.d * 1.55)), ganancia = (DW / ancho) / pxBase, quiere = det.permitida && ganancia >= 1.3;
    let sirve = false, util = false;
    if (det.rect) {
      const r = det.rect, cx = (vista.x + ANCHO / 2) / U, cy = (vista.z + ALTO / 2) / U, mx = r.w * 0.24, my = r.h * 0.22, anchoR = r.w * U;
      const okX = (cx > r.x + mx || r.x <= 0.5) && (cx < r.x + r.w - mx || r.x + r.w >= MAPA_W - 0.5), okY = (cy > r.y + my || r.y <= 0.5) && (cy < r.y + r.h - my || r.y + r.h >= MAPA_H - 0.5);
      sirve = okX && okY && anchoR < ancho * 1.5 && anchoR > ancho * 0.72;
      util = anchoR < ancho * 2.4;      // aunque ya no sea la ideal, mientras llega la nueva sigue mejorando lo que cubre
    }
    det.activa = quiere && (sirve || util);
    det.mezcla += ((det.activa ? 1 : 0) - det.mezcla) * (1 - Math.exp(-dt * 9)); if (det.mezcla < 0.004 && !det.activa) det.mezcla = 0;
    uDetMezcla.value = det.mezcla;
    if (quiere && !sirve && !det.pendiente && calma && det.quieta > 0.16) redibujar(vista, ancho);
  }
  async function redibujar(vista, ancho) {
    det.pendiente = true;
    try {
      const w = Math.min(MAPA_W, ancho / U), h = w * DH / DW;
      const x = Math.min(MAPA_W - w, Math.max(0, (vista.x + ANCHO / 2) / U - w / 2)), y = Math.min(MAPA_H - h, Math.max(0, (vista.z + ALTO / 2) / U - h / 2));
      await rasterizar(cvDet, x, y, w, h);
      det.rect = { x, y, w, h }; tDet.needsUpdate = true;
      uDetRect.value.set(x / MAPA_W, 1 - (y + h) / MAPA_H, MAPA_W / w, MAPA_H / h);
    } catch (e) { det.permitida = false; }
    det.pendiente = false;
  }
  // Tras recuperar el contexto WebGL: se vuelve a dibujar el mapa (su lienzo se había soltado al subirlo a la tarjeta).
  async function restaurar() { cvBase.width = anchoBase; cvBase.height = altoBase; await rasterizar(cvBase, 0, 0, MAPA_W, MAPA_H); tMapa.needsUpdate = true; det.rect = null; det.mezcla = 0; }
  function destruir() { tMapa.dispose(); tDet.dispose(); tOlas.dispose(); mat.dispose(); }
  return { material: mat, actualizar, ponerLuna, restaurar, destruir, anchoBase, anchoDetalle: DW, estadoDetalle: det, set permitirDetalle(v) { det.permitida = !!v; if (!v) det.rect = null; }, get detalleActivo() { return det.activa; }, get pendiente() { return det.pendiente; } };
}
