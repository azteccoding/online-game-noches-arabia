// Fuego de las ciudades «quemadas» (la Cruzada toma el Levante). Jorge (23 de noviembre) lo pidió más intenso: arde la ciudad
// entera, con varios focos de llamas altas que lamen hacia arriba (corazón casi blanco, cuerpo naranja, puntas rojas),
// llamaradas que se desprenden, chispas que suben girando, una columna de humo negro y el suelo tiznado y encendido alrededor.
// No usa luces (cambiar el número de luces obligaría a recompilar los materiales). Todo el incendio de una ciudad es UNA sola
// malla con instancias: cada instancia es un cartel que mira a la cámara, y la forma de la llama se dibuja en el sombreador
// con un ruido que corre hacia arriba. Así las llamas tienen forma y color propios también de día, sobre el pergamino claro
// (con simples destellos aditivos se quemaban a blanco).
import * as THREE from 'three';
import { lienzo, aTextura, texResplandor } from './texturas.js';

const al = (a, b) => a + Math.random() * (b - a);

// Ruido suave que se repite sin costuras (dos octavas): con él se recortan las llamas y se deshilacha el humo.
let tRuido = null;
function texRuido(tam = 128) {
  if (tRuido) return tRuido;
  const c = lienzo(tam, tam), g = c.getContext('2d'), img = g.createImageData(tam, tam);
  const capa = (celdas) => {
    const v = Array.from({ length: celdas * celdas }, () => Math.random()), s = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const fx = (x / tam) * celdas, fy = (y / tam) * celdas, x0 = Math.floor(fx), y0 = Math.floor(fy), u = s(fx - x0), w = s(fy - y0), en = (i, j) => v[((j + celdas) % celdas) * celdas + ((i + celdas) % celdas)];
      return (en(x0, y0) * (1 - u) + en(x0 + 1, y0) * u) * (1 - w) + (en(x0, y0 + 1) * (1 - u) + en(x0 + 1, y0 + 1) * u) * w;
    };
  };
  const a = capa(5), b = capa(11), d = capa(23);
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) { const n = Math.round(255 * (a(x, y) * 0.55 + b(x, y) * 0.3 + d(x, y) * 0.15)), i = (y * tam + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = n; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  tRuido = aTextura(c, { repetir: true, srgb: false, aniso: 1 }); return tRuido;
}

// Mancha de tizne: oscura y pareja en el centro, deshecha hacia el borde.
let tTizne = null;
const texTizne = () => tTizne || (tTizne = texResplandor(128, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,.8)'], [0.75, 'rgba(255,255,255,.3)'], [1, 'rgba(255,255,255,0)']]));

const LLAMA = 0, HUMO = 1, CHISPA = 2, HALO = 3;
const VERTICES = `
  attribute vec3 aBase; attribute vec4 aForma; attribute vec2 aVida;
  varying vec2 vUv; varying float vTipo; varying float vSem; varying float vU; varying float vOp;
  void main() {
    vUv = uv; vTipo = aForma.z; vSem = aForma.w; vU = aVida.x; vOp = aVida.y;
    vec4 mv = modelViewMatrix * vec4( aBase, 1.0 );
    float esc = length( modelMatrix[0].xyz );
    vec3 d;
    if ( aForma.z < 0.5 ) {
      // la llama sale de su base hacia arriba (hacia el «arriba» del mundo, para que asome por encima de los edificios); vista
      // desde lo alto no se aplasta del todo: conserva algo de altura en pantalla
      vec3 arriba = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
      d = vec3( position.x * aForma.x, 0.0, 0.0 ) + position.y * aForma.y * vec3( 0.0, max( arriba.y, 0.62 ), arriba.z );
    } else d = vec3( position.x * aForma.x, ( position.y - 0.5 ) * aForma.y, 0.0 );      // humo, chispas y halo: redondos, centrados
    mv.xyz += d * esc;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAGMENTOS = `
  uniform sampler2D uRuido; uniform vec3 uCorre; uniform float uFuerza;
  varying vec2 vUv; varying float vTipo; varying float vSem; varying float vU; varying float vOp;
  const vec3 ROJO = vec3( 0.72, 0.07, 0.02 ), NARANJA = vec3( 1.0, 0.38, 0.03 ), AMARILLO = vec3( 1.0, 0.8, 0.22 ), BLANCO = vec3( 1.0, 0.97, 0.82 );
  void main() {
    vec3 col; float a; float cuerpo;      // cuerpo: cuánto tapa lo que hay detrás (0 = puro destello que se suma)
    if ( vTipo < 0.5 ) {
      float y = vUv.y, x = ( vUv.x - 0.5 ) * 2.0;
      float n1 = texture2D( uRuido, vec2( vUv.x * 0.55 + vSem, y * 0.5 - uCorre.x + vSem * 3.1 ) ).r;
      float n2 = texture2D( uRuido, vec2( vUv.x * 1.2 - vSem * 1.7, y * 1.05 - uCorre.y ) ).r;
      float n = n1 * 0.6 + n2 * 0.4;
      x += ( ( n1 - 0.5 ) * 1.2 + ( vSem - 0.5 ) * 0.5 ) * y;                                                            // la lengua culebrea, más cuanto más arriba
      float ancho = 0.8 * pow( 1.0 - y, 0.7 ) * ( 0.6 + 0.4 * smoothstep( 0.0, 0.2, y ) );      // gota: panzuda abajo, en punta arriba
      float f = 1.0 - abs( x ) / max( ancho, 0.001 );
      f += ( n - 0.5 ) * ( 0.7 + 2.2 * y );                                                    // el ruido muerde los bordes y parte las puntas
      f *= smoothstep( 0.0, 0.06, y );
      a = smoothstep( 0.0, 0.34, f );
      float calor = clamp( f * ( 1.25 - 0.85 * y ) - vU * 0.35, 0.0, 1.0 );
      col = mix( ROJO, NARANJA, smoothstep( 0.0, 0.28, calor ) ); col = mix( col, AMARILLO, smoothstep( 0.24, 0.58, calor ) ); col = mix( col, BLANCO, smoothstep( 0.62, 0.98, calor ) );
      cuerpo = 0.72;
    } else if ( vTipo < 1.5 ) {
      float r = length( vUv - 0.5 ) * 2.0;
      float n = texture2D( uRuido, vUv * 0.6 + vec2( vSem, vSem * 2.3 - uCorre.z ) ).r;
      a = 1.0 - smoothstep( 0.2, 1.0, r + ( n - 0.5 ) * 1.1 );
      col = mix( vec3( 0.62, 0.2, 0.04 ), vec3( 0.075, 0.062, 0.058 ), smoothstep( 0.0, 0.22, vU ) ) * ( 0.75 + 0.6 * n );      // recién salido, lo enciende la llama de abajo
      cuerpo = 1.0;
    } else {
      float r = length( vUv - 0.5 ) * 2.0;
      a = pow( max( 0.0, 1.0 - r ), vTipo < 2.5 ? 1.4 : 2.0 );
      col = vTipo < 2.5 ? mix( BLANCO, NARANJA, smoothstep( 0.0, 0.7, vU ) ) : vec3( 1.0, 0.42, 0.08 );
      cuerpo = 0.0;
    }
    a *= vOp * uFuerza;
    gl_FragColor = vec4( col * a, a * cuerpo );
  }`;

// tex: mancha redonda suave (texResplandor), para el resplandor del suelo. suelo: a qué altura sobre el origen del nodo que
// lleva el fuego queda el terreno (ahí se tienden el tizne y el resplandor).
export function crearFuego(tex, { alto = 1.1, ancho = 0.5, focos: nFocos = 5, suelo: ySuelo = 0.02 } = {}) {
  const grupo = new THREE.Group();
  // --- Qué arde: un foco grande al centro (sale por encima de la ciudad) y otros alrededor, a ras de suelo, algo más bajos.
  const focos = [{ x: 0, y: 0.1, z: 0, k: 1 }];
  for (let i = 1; i < nFocos; i++) { const a = ((i - 1) / (nFocos - 1)) * Math.PI * 2 + 0.6; focos.push({ x: Math.cos(a) * ancho * al(0.75, 0.95), y: -0.18, z: Math.sin(a) * ancho * al(0.6, 0.8), k: al(0.5, 0.78) }); }
  const piezas = [];
  const humos = 14, chispas = 30, sueltas = 9;
  for (let i = 0; i < humos; i++) piezas.push({ tipo: HUMO, fase: i / humos, vel: al(0.13, 0.19), x: al(-0.5, 0.5) * ancho, z: al(-0.5, 0.5) * ancho, sem: Math.random() });
  piezas.push({ tipo: HALO, sem: 0 });
  for (const f of focos) for (let c = 0; c < 3; c++) piezas.push({ tipo: LLAMA, f, capa: c, x: al(-0.22, 0.22) * ancho * f.k, z: al(-0.2, 0.2) * ancho * f.k, sem: Math.random(), giro: al(0, 6.28), vel: al(5, 9) });
  // llamaradas que se desprenden de lo alto y se consumen subiendo
  for (let i = 0; i < sueltas; i++) piezas.push({ tipo: LLAMA, suelta: true, f: focos[i % focos.length], fase: Math.random(), vel: al(0.7, 1.1), x: al(-0.3, 0.3) * ancho, sem: Math.random() });
  for (let i = 0; i < chispas; i++) piezas.push({ tipo: CHISPA, fase: Math.random(), vel: al(0.28, 0.6), x: al(-1, 1) * ancho, z: al(-1, 1) * ancho * 0.7, giro: al(0, 6.28), tam: al(0.04, 0.085), sem: Math.random() });
  const N = piezas.length, base = new Float32Array(N * 3), forma = new Float32Array(N * 4), vida = new Float32Array(N * 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); geo.setIndex([0, 1, 2, 0, 2, 3]);
  const aBase = new THREE.InstancedBufferAttribute(base, 3), aForma = new THREE.InstancedBufferAttribute(forma, 4), aVida = new THREE.InstancedBufferAttribute(vida, 2);
  for (const a of [aBase, aForma, aVida]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aBase', aBase); geo.setAttribute('aForma', aForma); geo.setAttribute('aVida', aVida); geo.instanceCount = N;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, alto * 1.6, 0), alto * 4.5);
  // se suma lo que brilla y se tapa lo que tiene cuerpo, todo en una pasada: color ya multiplicado por su opacidad
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERTICES, fragmentShader: FRAGMENTOS, uniforms: { uRuido: { value: texRuido() }, uCorre: { value: new THREE.Vector3() }, uFuerza: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const malla = new THREE.Mesh(geo, mat); malla.renderOrder = 18; grupo.add(malla);
  // --- El suelo: tizne (la tierra quemada alrededor, que además hace resaltar las llamas de día) y, encima, el resplandor naranja.
  const plano = new THREE.PlaneGeometry(1, 1); plano.rotateX(-Math.PI / 2);
  const tizne = new THREE.Mesh(plano, new THREE.MeshBasicMaterial({ map: texTizne(), color: 0x140c08, transparent: true, opacity: 0, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  tizne.scale.set(ancho * 5.4, 1, ancho * 4.8); tizne.position.y = -0.25; tizne.renderOrder = 14; grupo.add(tizne);
  const suelo = new THREE.Mesh(plano, new THREE.MeshBasicMaterial({ map: tex, color: 0xff5a14, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  suelo.scale.set(ancho * 8, 1, ancho * 7); suelo.position.y = -0.245; suelo.renderOrder = 15; grupo.add(suelo);

  function actualizar(t, fuerza = 1) {
    const latido = 0.82 + 0.1 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 13.1 + 1.3);      // el incendio respira: todo crece y mengua a la vez
    const brota = 0.35 + 0.65 * fuerza;      // al prender, las llamas crecen desde abajo
    for (let i = 0; i < N; i++) {
      const p = piezas[i], b = i * 3, f4 = i * 4, v = i * 2; let x = 0, y = 0, z = 0, w = 0, h = 0, u = 0, op = 1;
      if (p.tipo === LLAMA && !p.suelta) {
        const f = p.f, vivo = 0.86 + 0.14 * Math.sin(t * p.vel + p.giro), capa = p.capa;      // tres capas por foco: ancha y baja, media, alta y fina
        x = f.x + p.x; y = f.y; z = f.z + p.z + capa * 0.02;
        w = ancho * f.k * [2.1, 1.6, 1.15][capa]; h = alto * f.k * [0.7, 1.0, 1.3][capa] * (0.8 + 0.3 * latido) * vivo * brota; op = [0.95, 1, 0.9][capa];
      } else if (p.tipo === LLAMA) {
        u = (t * p.vel + p.fase) % 1; const f = p.f;
        x = f.x + p.x + Math.sin(t * 2.1 + p.sem * 9) * 0.08 * u; y = f.y + alto * f.k * (0.45 + 0.75 * u) * brota; z = f.z;
        w = ancho * f.k * 0.8 * (1 - 0.55 * u); h = alto * f.k * 0.45 * (1 - 0.5 * u); op = Math.min(1, u * 6) * (1 - u) ** 0.8;
      } else if (p.tipo === HUMO) {
        u = (t * p.vel + p.fase) % 1; const deriva = u * u * ancho * 2.2;      // el viento lo tiende hacia un lado al subir
        x = p.x * (1 + u) + deriva + Math.sin(t * 0.7 + p.sem * 6) * 0.1; y = alto * (0.55 + 2.7 * u); z = p.z * (1 + u) + deriva * 0.3 - 0.05;
        w = h = ancho * (1.5 + 3.1 * u); op = 0.46 * Math.min(1, u * 5) * (1 - u) ** 1.3;
      } else if (p.tipo === CHISPA) {
        u = (t * p.vel + p.fase) % 1;
        x = p.x * (1 - 0.4 * u) + Math.sin(t * 2.3 + p.giro + u * 6) * 0.24 * u; y = 0.1 + alto * 2.4 * u; z = p.z + Math.cos(t * 1.9 + p.giro + u * 5) * 0.2 * u;
        w = h = p.tam * (1 - 0.5 * u); op = (1 - u) ** 1.2 * (0.6 + 0.4 * Math.sin(t * 23 + p.giro * 9));
      } else {      // halo: el resplandor que envuelve las llamas
        y = alto * 0.45; w = ancho * 5.5; h = alto * 2.3; op = 0.2 + 0.1 * latido;
      }
      base[b] = x; base[b + 1] = y; base[b + 2] = z; forma[f4] = w; forma[f4 + 1] = h; forma[f4 + 2] = p.tipo; forma[f4 + 3] = p.sem; vida[v] = u; vida[v + 1] = op;
    }
    aBase.needsUpdate = aForma.needsUpdate = aVida.needsUpdate = true;
    mat.uniforms.uCorre.value.set((t * 0.85) % 1, (t * 1.65) % 1, (t * 0.07) % 1);      // el ruido corre hacia arriba (se repite cada 1: se manda ya recortado)
    mat.uniforms.uFuerza.value = fuerza;
    tizne.position.y = (ySuelo - grupo.position.y) / grupo.scale.y; suelo.position.y = tizne.position.y + 0.004;      // a ras del suelo de la ciudad, sea cual sea la escala del grupo
    tizne.material.opacity = fuerza * 0.7; suelo.material.opacity = fuerza * (0.26 + 0.16 * latido);
    grupo.visible = fuerza > 0.01;
  }
  function destruir() { geo.dispose(); mat.dispose(); plano.dispose(); tizne.material.dispose(); suelo.material.dispose(); }
  return { grupo, actualizar, destruir };
}
