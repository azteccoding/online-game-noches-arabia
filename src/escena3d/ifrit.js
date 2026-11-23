// Ifrit: una lámpara de aceite de latón aparece junto a la ficha, tiembla, humea y de su boquilla brota el genio —un torso
// imponente de humo turquesa sobre una cola que nace en la lámpara, con brazaletes de oro, turbante con una brasa por joya y el rostro velado en sombra—.
// Queda flotando hasta que se le manda esconderse: entonces se arremolina, la lámpara lo absorbe, destella y desaparece.
// Los colores salen del arte del juego (lámpara dorada con gema turquesa y humo turquesa sobre noche índigo).
import * as THREE from 'three';
import { crearFigura, cargarTexturaFigura } from './figuras.js';
import { crearModeloPintado, texturaPintada } from './animalPintado.js';
import hojaLampara from './datos/animal-lampara.json';

const suave = (t) => t * t * (3 - 2 * t);
const lim = (x) => Math.min(1, Math.max(0, x));
const ALTO = 2.55;       // altura del genio (una figura mide 1,16)

// Lámpara pintada (Jorge, 23 de noviembre): se levanta de su hoja de vistas (ver animalPintado.js), con el pico hacia +Z.
const LARGO_LAMPARA = 1.05;
function crearLamparaPintada() {
  const alto = (LARGO_LAMPARA * hojaLampara.th) / hojaLampara.tw;
  const M = crearModeloPintado(hojaLampara, texturaPintada('lampara'), { alto, centroX: hojaLampara.tw * 0.55, material: { roughness: 0.38, metalness: 0.55, envMapIntensity: 1 } });
  // de perfil a la cámara, como en la hoja: el pico apunta a −X (a la izquierda de quien mira)
  const g = new THREE.Group(); M.malla.rotation.y = -Math.PI / 2; g.add(M.malla);
  const b = M.punto([hojaLampara.cabestro[0] + 4, hojaLampara.cabestro[1] - 10]);
  return { grupo: g, boca: new THREE.Vector3(-b.z, b.y, 0), gema: { emissiveIntensity: 0 } };
}
export function crearIfrit({ escena, mats, efectos, sonido, camara, tablero, figuraGenio = null }) {
  const raiz = new THREE.Group(); raiz.visible = false; escena.add(raiz);
  const lamp = crearLamparaPintada(); raiz.add(lamp.grupo);
  // --- Materia del genio: humo turquesa con luz propia
  const matHumo = new THREE.MeshStandardMaterial({ color: 0x1c8f93, emissive: 0x2fd0c6, emissiveIntensity: 0.2, roughness: 0.5, transparent: true, opacity: 0.95, envMapIntensity: 0.3 });
  matHumo.onBeforeCompile = (sh) => {      // el borde brilla y el cuerpo se deshace hacia abajo, como humo
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float borde = pow( 1.0 - abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) ), 2.2 );
      gl_FragColor.rgb += vec3( 0.35, 0.95, 0.9 ) * borde * 0.9;`);
  };
  const matOscuro = new THREE.MeshStandardMaterial({ color: 0x071a30, emissive: 0x0d3550, emissiveIntensity: 0.3, roughness: 0.8, transparent: true, opacity: 0.97 });
  const matTela = new THREE.MeshStandardMaterial({ color: 0xf1ead6, emissive: 0x2fd0c6, emissiveIntensity: 0.12, roughness: 0.7 });
  const matBrasa = new THREE.MeshBasicMaterial({ color: 0xffb040 });
  const genio = new THREE.Group(); raiz.add(genio);
  const pieza = (geo, mat, padre = genio) => { const x = new THREE.Mesh(geo, mat); x.castShadow = true; padre.add(x); return x; };
  // torso: pecho ancho que se estrecha a la cintura; hombros, brazos cruzados, chaleco índigo, fajín y turbante; el rostro queda en sombra
  const torso = new THREE.Group(); genio.add(torso);
  const pecho = pieza(new THREE.LatheGeometry([[0.0, -0.55], [0.2, -0.5], [0.27, -0.3], [0.4, 0.0], [0.5, 0.22], [0.46, 0.4], [0.3, 0.5], [0.14, 0.56], [0, 0.58]].map(([r, y]) => new THREE.Vector2(r, y)), 28), matHumo, torso); pecho.scale.z = 0.66;
  for (const s of [-1, 1]) {
    const hombro = pieza(new THREE.SphereGeometry(0.2, 16, 12), matHumo, torso); hombro.position.set(s * 0.5, 0.32, 0); hombro.scale.set(1.05, 0.95, 0.95);
    const brazo = pieza(new THREE.CapsuleGeometry(0.125, 0.36, 6, 12), matHumo, torso); brazo.position.set(s * 0.56, 0.06, 0.1); brazo.rotation.set(-0.5, 0, s * 0.18);
    const ante = pieza(new THREE.CapsuleGeometry(0.11, 0.4, 6, 12), matHumo, torso); ante.position.set(s * 0.28, -0.1 + (s > 0 ? 0.07 : 0), 0.4); ante.rotation.set(0, 0, s * 1.25);
    const aro = pieza(new THREE.TorusGeometry(0.125, 0.03, 8, 20), mats.laton, torso); aro.position.set(s * 0.44, -0.06 + (s > 0 ? 0.045 : 0), 0.36); aro.rotation.set(0, Math.PI / 2 - s * 0.3, s * 0.3);
    const aro2 = pieza(new THREE.TorusGeometry(0.15, 0.028, 8, 20), mats.laton, torso); aro2.position.set(s * 0.6, 0.2, 0.05); aro2.rotation.set(Math.PI / 2 - 0.5, 0, 0);
  }
  const cuello = pieza(new THREE.CylinderGeometry(0.1, 0.14, 0.14, 12), matHumo, torso); cuello.position.y = 0.6;
  const cabeza = new THREE.Group(); cabeza.position.y = 0.82; torso.add(cabeza);
  const craneo = pieza(new THREE.SphereGeometry(0.19, 20, 16), matOscuro, cabeza); craneo.scale.set(0.92, 1.12, 0.95);
  const velo = pieza(new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48), matOscuro, cabeza); velo.scale.set(0.98, 1.2, 1.02); velo.position.y = 0.01;
  const turbante = pieza(new THREE.LatheGeometry([[0.0, 0.0], [0.17, 0.0], [0.245, 0.06], [0.265, 0.15], [0.22, 0.25], [0.12, 0.31], [0, 0.33]].map(([r, y]) => new THREE.Vector2(r, y)), 22), matTela, cabeza); turbante.position.y = 0.05; turbante.scale.z = 0.98;
  for (let i = 0; i < 3; i++) { const v = pieza(new THREE.TorusGeometry(0.235 - i * 0.03, 0.034, 6, 22), matTela, cabeza); v.position.y = 0.14 + i * 0.065; v.rotation.set(Math.PI / 2 + (i - 1) * 0.16, 0.2 * i, 0); }
  const joya = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), matBrasa); joya.position.set(0, 0.19, 0.25); joya.scale.set(0.8, 1.15, 0.5); cabeza.add(joya);
  const engaste = pieza(new THREE.TorusGeometry(0.045, 0.012, 6, 14), mats.laton, cabeza); engaste.position.copy(joya.position); engaste.scale.y = 1.15;
  const llama = pieza(new THREE.ConeGeometry(0.07, 0.42, 10), matHumo, cabeza); llama.position.set(0, 0.56, -0.02); llama.rotation.x = -0.2;      // penacho de humo
  // chaleco abierto y fajín
  for (const s of [-1, 1]) { const ch = pieza(new THREE.LatheGeometry([[0.25, -0.34], [0.415, 0.0], [0.515, 0.22], [0.475, 0.4], [0.33, 0.49]].map(([r, y]) => new THREE.Vector2(r, y)), 14, s > 0 ? Math.PI * 0.14 : -Math.PI * 0.14 - Math.PI * 0.86, Math.PI * 0.86), matOscuro, torso); ch.scale.z = 0.68; ch.material.side = THREE.DoubleSide; }
  const fajin = pieza(new THREE.TorusGeometry(0.25, 0.055, 8, 24), mats.laton, torso); fajin.position.y = -0.33; fajin.rotation.x = Math.PI / 2; fajin.scale.set(1, 0.68, 1.25);
  const collar = pieza(new THREE.TorusGeometry(0.2, 0.03, 8, 24), mats.laton, torso); collar.position.y = 0.53; collar.rotation.x = Math.PI / 2; collar.scale.z = 0.8;
  // estrella de ocho puntas en el pecho (el emblema del mazo)
  const estrella = new THREE.Group(); estrella.position.set(0, 0.47, 0.25); estrella.scale.setScalar(0.62); estrella.rotation.x = -0.6; torso.add(estrella);
  for (const r of [0, Math.PI / 4]) { const c = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.1, 4), new THREE.MeshBasicMaterial({ color: 0xffd98a, side: THREE.DoubleSide })); c.rotation.z = r; estrella.add(c); }
  // cola de humo: tubo que serpentea desde la boquilla de la lámpara hasta la cintura
  const NR = 26, NS = 12, gCola = new THREE.BufferGeometry(), pCola = new Float32Array((NR + 1) * (NS + 1) * 3), iCola = [];
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) { const a = i * (NS + 1) + j, b = a + NS + 1; iCola.push(a, b, a + 1, a + 1, b, b + 1); }
  gCola.setAttribute('position', new THREE.BufferAttribute(pCola, 3)); gCola.setIndex(iCola);
  const cola = new THREE.Mesh(gCola, matHumo); cola.frustumCulled = false; cola.castShadow = true; raiz.add(cola);
  // Genio pintado (Jorge, 23 de noviembre: hoja de vistas de ChatGPT, con el rostro visible): sustituye al torso tallado. Trae su
  // propia cola de humo; el chorro de la lámpara sube solo hasta la punta de esa cola.
  const ALTO_PINTADO = 2.3;
  let figura = null;
  if (figuraGenio) cargarTexturaFigura(figuraGenio.atlas).then((tx) => {
    figura = crearFigura(figuraGenio.datos, tx, { alto: ALTO_PINTADO });
    figura.material.emissive.set(0x2fd0c6); figura.material.emissiveIntensity = 0.12; figura.ponerLado(0.6);
    for (const c of torso.children) c.visible = false;
    torso.add(figura.grupo);
  }, () => {});
  const luz = new THREE.PointLight(0x4fe6dc, 0, 9, 1.6); raiz.add(luz);
  const tinte = new THREE.HemisphereLight(0x39c9c9, 0x101a48, 0); escena.add(tinte);

  const E = { fase: 'oculto', t: 0, g: 0, giro: 0, previa: null, resolver: null, pos: new THREE.Vector3(), tHumo: 0, tocada: false };
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), c0 = new THREE.Vector3();
  function centro(u, t, g, out) {      // eje de la cola: u = 0 en la boquilla, 1 en la cintura
    const alto = (ALTO - 1.15) * g * (figura ? 0.42 : 1), bamb = 0.16 * Math.sin(u * 5.5 - t * 1.7) * u * (1 - u * 0.55) + 0.05 * Math.sin(u * 11 + t * 2.3) * u;
    return out.set(lamp.boca.x * (1 - suave(u) * g) + bamb, lamp.boca.y + alto * (u ** 0.85), lamp.boca.z + 0.1 * Math.cos(u * 4.7 - t * 1.3) * u * (1 - u));      // del pico (a un lado) sube hasta quedar sobre la lámpara
  }
  function modelar(t) {
    const g = E.g;
    for (let i = 0; i <= NR; i++) {
      const u = i / NR; centro(u, t, g, c0);
      const r = (figura ? 0.03 + 0.05 * u * g : 0.035 + 0.3 * u ** 1.6 * g) * (1 + 0.1 * Math.sin(u * 16 - t * 4.2)), giro = E.giro * (1 - u) * 2 + u * 2.2 + t * 0.5;
      for (let j = 0; j <= NS; j++) { const a = (j / NS) * Math.PI * 2 + giro, k = (i * (NS + 1) + j) * 3; pCola[k] = c0.x + Math.cos(a) * r; pCola[k + 1] = c0.y; pCola[k + 2] = c0.z + Math.sin(a) * r * 0.75; }
    }
    gCola.attributes.position.needsUpdate = true; gCola.computeVertexNormals();
    centro(1, t, g, c0);
    const resp = 1 + 0.025 * Math.sin(t * 1.6), esc = Math.max(0.001, g * (0.6 + 0.4 * g)) * (1 + 0.1 * Math.sin(Math.min(1, g) * Math.PI) * (E.fase === 'saliendo' ? 1 : 0));
    torso.position.set(c0.x, c0.y + (figura ? -0.04 : 0.5) * esc, c0.z);
    if (figura) figura.animar(t, { vuelo: 0.6 + 0.4 * g }); torso.scale.set(esc * resp, esc, esc * resp); torso.rotation.set(0.06 * Math.sin(t * 0.9), E.giro + 0.12 * Math.sin(t * 0.6), 0.04 * Math.sin(t * 1.1));
    cabeza.rotation.y = 0.18 * Math.sin(t * 0.5 + 1); llama.rotation.z = 0.25 * Math.sin(t * 2.1); llama.scale.y = 1 + 0.2 * Math.sin(t * 3.3);
    matBrasa.color.setHSL(0.09, 1, 0.55 + 0.12 * Math.sin(t * 6.1));
    luz.position.set(c0.x * 0.4 + 0.35, 0.75 + 0.5 * g, lamp.boca.z + 0.75); luz.intensity = 12 * g; tinte.intensity = 0.55 * g; lamp.gema.emissiveIntensity = 0.6 + 2 * g;
    genio.visible = cola.visible = g > 0.002;
  }
  const boca = (out) => raiz.localToWorld(out.copy(lamp.boca));

  // dónde: { x, z } en el mundo (junto a una ficha o a una ciudad). Devuelve una promesa: el genio ya está fuera, en reposo.
  function aparecer(donde) {
    if (E.fase !== 'oculto') return Promise.reject(new Error('El ifrit ya está fuera.'));
    return new Promise((ok) => {
      E.fase = 'lampara'; E.t = 0; E.g = 0; E.giro = 0; E.resolver = ok;
      E.pos.set(donde.x, tablero.altura(donde.x, donde.z), donde.z); raiz.position.copy(E.pos); raiz.rotation.y = -0.5; raiz.visible = true; raiz.scale.setScalar(1);
      lamp.grupo.scale.setScalar(0.001); lamp.grupo.rotation.set(0, 0, 0);
      E.previa = camara.leer(); camara.tocado = false;
      const p = [[-1.5, 0, 0.9], [1.5, 0, 0.9], [-1.3, ALTO + 0.75, -0.3], [1.3, ALTO + 0.75, -0.3]].map(([x, y, z]) => new THREE.Vector3(E.pos.x + x, E.pos.y + y, E.pos.z + z));
      camara.volar(camara.encuadre(p, { x: E.pos.x, z: E.pos.z - 0.9, pol: 1.02, az: 0 }, 0.84), 1.5);
      sonido?.tocar('ifrit-lampara');
    });
  }
  function esconder() {
    if (E.fase === 'oculto') return Promise.resolve();
    if (E.fase !== 'reposo') return new Promise((ok) => { const previo = E.resolver; E.resolver = () => { previo?.(); esconder().then(ok); }; });
    return new Promise((ok) => { E.fase = 'entrando'; E.t = 0; E.resolver = ok; if (E.sonando) { E.sonando = false; sonido?.bucle('ifrit-ambiente', false); } sonido?.tocar('ifrit-se-esconde'); });
  }
  function actualizar(t, dt) {
    if (E.fase === 'oculto') return false;
    E.t += dt;
    if (E.fase === 'lampara') {      // aparece la lámpara, se posa y empieza a temblar y a humear
      const a = lim(E.t / 0.45), bote = Math.sin(Math.PI * a) * 0.3 * (1 - a);
      lamp.grupo.scale.setScalar(Math.max(0.001, suave(a) * (1 + 0.15 * Math.sin(a * Math.PI))));
      lamp.grupo.position.y = bote;
      const tiembla = lim((E.t - 0.5) / 0.8); lamp.grupo.rotation.z = 0.09 * tiembla * Math.sin(E.t * 46); lamp.grupo.rotation.x = 0.06 * tiembla * Math.sin(E.t * 39 + 1);
      E.tHumo -= dt; if (E.t > 0.45 && E.tHumo <= 0) { E.tHumo = 0.07; efectos.polvo(boca(v1), 1, 0.4, 0x7fe9e0); }
      if (E.t >= 1.35) { E.fase = 'saliendo'; E.t = 0; efectos.chispas(boca(v1), 26, 1.1, 0x9ff5ee); efectos.destello(boca(v1), 1.3, 0x9ff5ee); sonido?.tocar('ifrit-aparece'); camara.temblor(0.08); }
    } else if (E.fase === 'saliendo') {
      const a = lim(E.t / 1.35); E.g = 1 - (1 - a) ** 3; E.giro = (1 - E.g) * 5.5;
      lamp.grupo.rotation.z = 0.05 * (1 - a) * Math.sin(E.t * 46); lamp.grupo.rotation.x = 0;
      E.tHumo -= dt; if (E.tHumo <= 0) { E.tHumo = 0.05; centro(Math.random(), t, E.g, v2); efectos.polvo(raiz.localToWorld(v2), 1, 0.7, 0x58d8d0); if (Math.random() < 0.4) efectos.chispas(raiz.localToWorld(centro(1, t, E.g, v1)), 3, 0.6, 0xffe2a0); }
      if (a >= 1) { E.fase = 'reposo'; E.g = 1; E.giro = 0; E.sonando = true; sonido?.bucle('ifrit-ambiente', true); const f = E.resolver; E.resolver = null; f?.(); }
    } else if (E.fase === 'reposo') {
      E.tHumo -= dt; if (E.tHumo <= 0) { E.tHumo = 0.22; centro(0.1 + Math.random() * 0.6, t, 1, v2); efectos.polvo(raiz.localToWorld(v2), 1, 0.45, 0x58d8d0); }
    } else if (E.fase === 'entrando') {      // se arremolina y la lámpara lo absorbe
      const a = lim(E.t / 1.05); E.g = 1 - a * a * a; E.giro = a * a * 14;
      E.tHumo -= dt; if (E.tHumo <= 0) { E.tHumo = 0.06; efectos.polvo(boca(v1), 1, 0.3, 0x7fe9e0); }
      if (a >= 1) { E.fase = 'cierre'; E.t = 0; E.g = 0; efectos.destello(boca(v1), 1.6, 0xfff1c4); efectos.chispas(boca(v1), 22, 0.9, 0xffe2a0); efectos.onda(v2.copy(E.pos), 1.8, 0xbff5ee); camara.temblor(0.05); }
    } else if (E.fase === 'cierre') {
      const a = lim((E.t - 0.25) / 0.4); lamp.grupo.scale.setScalar(Math.max(0.001, 1 - suave(a))); lamp.grupo.rotation.y = a * 5;
      if (a >= 1) {
        E.fase = 'oculto'; raiz.visible = false; luz.intensity = 0; tinte.intensity = 0; lamp.grupo.rotation.y = 0;
        if (E.previa && !camara.tocado) camara.volar(E.previa, 1.1); E.previa = null;
        const f = E.resolver; E.resolver = null; f?.(); return true;
      }
    }
    modelar(t);
    return true;
  }
  function destruir() { figura?.destruir(); raiz.traverse((o) => { o.geometry?.dispose(); }); matHumo.dispose(); matOscuro.dispose(); matTela.dispose(); matBrasa.dispose(); escena.remove(raiz, tinte); }
  return { aparecer, esconder, actualizar, destruir, get fase() { return E.fase; }, get nivel() { return E.g; }, get activo() { return E.fase !== 'oculto'; } };
}
