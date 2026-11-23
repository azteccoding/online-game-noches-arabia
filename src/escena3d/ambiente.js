// Ambiente: terraza con mesa, tapete, faroles, cielo y ciudad lejana; la luz recorre el día (amanecer, mediodía, atardecer y noche).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ANCHO, ALTO } from './medidas.js';
import { azar, texMadera, texTapete, texFlecos, texBaldosas, texResplandor, texSombra, texCelosia, texLuzCalada, texLuna } from './texturas.js';

export const SUELO_Y = -15;          // suelo de la terraza
export const MESA_Y = -0.62;         // cara superior de la mesa (el tablero descansa encima)
export const NIEBLA = 0x0b0c1f;

export const unir = (lista) => mergeGeometries(lista.map((g) => (g.index ? g.toNonIndexed() : g)), false);

export function rectRedondeado(forma, x, y, w, h, r) {
  forma.moveTo(x + r, y); forma.lineTo(x + w - r, y); forma.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  forma.lineTo(x + w, y + h - r); forma.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  forma.lineTo(x + r, y + h); forma.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  forma.lineTo(x, y + r); forma.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return forma;
}

// Materiales compartidos.
export function crearMateriales() {
  const maderaOsc = texMadera({ base: '#2c150d', clara: '#5a2f1b', oscura: '#0e0604', semilla: 11 });
  maderaOsc.repeat.set(1 / 7, 1 / 7);
  const maderaMesa = texMadera({ base: '#3d1d10', clara: '#7a4124', oscura: '#160905', semilla: 4 });
  maderaMesa.repeat.set(1 / 16, 1 / 16);
  return {
    laton: new THREE.MeshStandardMaterial({ color: 0xe6b866, metalness: 1, roughness: 0.34, envMapIntensity: 2.3 }),
    oroViejo: new THREE.MeshStandardMaterial({ color: 0xcf9a4c, metalness: 1, roughness: 0.42, envMapIntensity: 1.9 }),
    marco: new THREE.MeshPhysicalMaterial({ map: maderaOsc, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.28, envMapIntensity: 0.9 }),
    mesa: new THREE.MeshPhysicalMaterial({ map: maderaMesa, roughness: 0.46, clearcoat: 0.4, clearcoatRoughness: 0.35, envMapIntensity: 0.8 }),
  };
}

// Mapa de entorno para los reflejos del latón y el barniz: un cuarto oscuro con lámparas cálidas y un claro de luna.
export function crearEntorno(renderer) {
  const esc = new THREE.Scene();
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 p; void main(){ float h = normalize(p).y; vec3 arriba = vec3(0.035,0.05,0.14); vec3 medio = vec3(0.07,0.045,0.07); vec3 abajo = vec3(0.05,0.022,0.015); vec3 c = h > 0.0 ? mix(medio, arriba, smoothstep(0.0,0.8,h)) : mix(medio, abajo, smoothstep(0.0,-0.6,h)); gl_FragColor = vec4(c,1.0); }',
  }));
  esc.add(cielo);
  const panel = (x, y, z, w, h, color, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); esc.add(m); };
  panel(-22, 9, -18, 9, 12, 0xffb060, 9);
  panel(24, 8, -14, 8, 11, 0xffa050, 8);
  panel(-20, 7, 22, 9, 10, 0xff9a48, 6);
  panel(6, 36, 6, 22, 22, 0xffe0b0, 3.2);
  panel(30, 16, 26, 14, 12, 0x8aa6ff, 1.6);
  panel(-6, 4, -40, 60, 5, 0x30386a, 1.2);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(esc, 0.035, 0.1, 200);
  pm.dispose(); cielo.geometry.dispose(); cielo.material.dispose();
  return rt.texture;
}

// Farol de latón con vidrio ámbar calado.
function crearFarol(mats, tex) {
  const g = new THREE.Group();
  const laton = [];
  const cil = (rt, rb, h, y, seg = 6) => { const c = new THREE.CylinderGeometry(rt, rb, h, seg); c.translate(0, y + h / 2, 0); return c; };
  laton.push(cil(1.0, 1.08, 0.16, 0), cil(0.82, 0.95, 0.2, 0.16), cil(0.86, 0.8, 0.14, 2.56), cil(0.95, 0.95, 0.07, 2.7));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const p = new THREE.BoxGeometry(0.09, 2.25, 0.09); p.rotateY(-a); p.translate(Math.cos(a) * 0.78, 0.36 + 1.1, Math.sin(a) * 0.78); laton.push(p); }
  // cúpula
  const perfil = [[0.92, 0], [0.96, 0.12], [0.9, 0.36], [0.72, 0.62], [0.46, 0.84], [0.2, 1.0], [0.1, 1.16], [0.14, 1.26], [0.1, 1.36], [0, 1.4]].map(([r, y]) => new THREE.Vector2(r, y));
  const cup = new THREE.LatheGeometry(perfil, 24); cup.translate(0, 2.77, 0); laton.push(cup);
  const asa = new THREE.TorusGeometry(0.24, 0.035, 8, 24); asa.translate(0, 4.36, 0); laton.push(asa);
  const mLaton = new THREE.Mesh(unir(laton), mats.oroViejo); mLaton.castShadow = true; g.add(mLaton);
  const vidrio = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 2.2, 6, 1, true), new THREE.MeshBasicMaterial({ map: tex.celosia, color: new THREE.Color(1.5, 1.22, 0.9), side: THREE.DoubleSide, fog: false }));
  vidrio.material.map.wrapS = THREE.RepeatWrapping; vidrio.material.map.repeat.set(6, 1);
  vidrio.position.y = 0.36 + 1.1; g.add(vidrio);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.resplandor, color: 0xffa24a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.set(9.5, 9.5, 1); halo.position.y = 1.6; g.add(halo);
  const luz = new THREE.PointLight(0xff9440, 46, 34, 1.9); luz.position.y = 1.7; g.add(luz);
  const calada = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: tex.luzCalada, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  calada.rotation.x = -Math.PI / 2; calada.position.y = 0.012; g.add(calada);
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: tex.sombra, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.02; g.add(sombra);
  g.userData = { halo, luz, calada, vidrio, fase: Math.random() * 100 };
  return g;
}

export function crearAmbiente(escena, mats) {
  const r = azar(99);
  const tex = { resplandor: texResplandor(), sombra: texSombra(), celosia: texCelosia(), luzCalada: texLuzCalada() };
  escena.fog = new THREE.FogExp2(NIEBLA, 0.0034);
  escena.background = new THREE.Color(NIEBLA);

  // --- Luces
  const hemi = new THREE.HemisphereLight(0x5466b0, 0x2a1408, 0.5); escena.add(hemi);
  // «clave»: charco de luz de lámpara sobre la mesa, solo de noche y sin sombra propia.
  const clave = new THREE.SpotLight(0xffe0b8, 0.95, 0, 0.8, 0.9, 0);
  clave.position.set(-9, 38, 9); clave.target.position.set(0, 0, -3.2); escena.add(clave, clave.target);
  // «sol»: la luz que proyecta las sombras. De día es el sol (sale por el este, pasa por el sur y se pone por el oeste);
  // de noche es la lámpara alta. Su cámara de sombra se ajusta a la mesa en cada posición.
  const sol = new THREE.DirectionalLight(0xfff1dc, 3);
  sol.castShadow = true; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.03; sol.shadow.radius = 2.4;
  escena.add(sol, sol.target);
  const luna = new THREE.DirectionalLight(0x7f9bff, 0.42); luna.position.set(30, 22, -34); escena.add(luna);
  const ESQ = []; for (const x of [-23.6, 23.6]) for (const y of [-0.8, 5.4]) for (const z of [-21, 16.4]) ESQ.push(new THREE.Vector3(x, y, z));
  const vS = new THREE.Vector3(), mS = new THREE.Matrix4();
  function encuadrarSombra(dir) {
    sol.target.position.set(0, 0, -2.3); sol.position.copy(sol.target.position).addScaledVector(dir, 80);
    const cs = sol.shadow.camera; cs.position.copy(sol.position); cs.lookAt(sol.target.position); cs.updateMatrixWorld(); mS.copy(cs.matrixWorld).invert();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const e of ESQ) { vS.copy(e).applyMatrix4(mS); x0 = Math.min(x0, vS.x); x1 = Math.max(x1, vS.x); y0 = Math.min(y0, vS.y); y1 = Math.max(y1, vS.y); z0 = Math.min(z0, vS.z); z1 = Math.max(z1, vS.z); }
    cs.left = x0; cs.right = x1; cs.bottom = y0; cs.top = y1; cs.near = Math.max(1, -z1 - 2); cs.far = -z0 + 2; cs.updateProjectionMatrix();
  }

  // --- Cielo (sigue a la cámara): cúpula con degradado, estrellas y luna baja
  const cielo = new THREE.Group(); escena.add(cielo);
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uDia: { value: 0 }, uOcaso: { value: 0 }, uSol: { value: new THREE.Vector3(1, 0, 0) }, uNiebla: { value: new THREE.Color(NIEBLA) } },
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uDia; uniform float uOcaso; uniform vec3 uSol; uniform vec3 uNiebla; varying vec3 p;
      void main(){ vec3 d = normalize(p); float h = d.y;
      vec3 n = mix(vec3(0.150,0.075,0.130), vec3(0.035,0.050,0.165), smoothstep(0.0,0.16,h)); n = mix(n, vec3(0.012,0.016,0.060), smoothstep(0.12,0.75,h));
      vec3 dd = mix(vec3(0.78,0.76,0.70), vec3(0.34,0.54,0.86), smoothstep(0.0,0.32,h)); dd = mix(dd, vec3(0.12,0.28,0.68), smoothstep(0.2,0.95,h));
      vec3 c = mix(n, dd, uDia);
      vec3 s = normalize(uSol); float hacia = max(dot(normalize(d.xz + vec2(1e-5)), normalize(s.xz + vec2(1e-5))), 0.0);
      float arrebol = uOcaso * exp(-max(h,0.0) * 5.0) * (0.3 + 0.7 * hacia * hacia);
      c = mix(c, vec3(1.0,0.46,0.16), clamp(arrebol * 0.9, 0.0, 1.0));
      c += vec3(0.85,0.30,0.28) * uOcaso * exp(-max(h,0.0) * 2.2) * 0.14;
      float cs = max(dot(d, s), 0.0); float visible = smoothstep(-0.07, 0.02, s.y);
      vec3 cSol = mix(vec3(1.0,0.5,0.2), vec3(1.0,0.95,0.84), smoothstep(0.0,0.4,s.y));
      c += cSol * (smoothstep(0.99950, 0.99972, cs) * 1.3 + pow(cs, 220.0) * 0.5 + pow(cs, 26.0) * 0.12) * visible;
      c = mix(uNiebla, c, smoothstep(-0.03,0.015,h));
      gl_FragColor = vec4(c,1.0);
      #include <colorspace_fragment>
      }`,
  }));
  cupula.renderOrder = -10; cielo.add(cupula);
  const nE = 1500, posE = new Float32Array(nE * 3), colE = new Float32Array(nE * 3);
  for (let i = 0; i < nE; i++) {
    const az = r() * Math.PI * 2, el = Math.asin(0.012 + Math.pow(r(), 1.5) * 0.97);
    posE.set([Math.cos(el) * Math.cos(az) * 560, Math.sin(el) * 560, Math.cos(el) * Math.sin(az) * 560], i * 3);
    const b = 0.35 + Math.pow(r(), 3) * 0.9, t = r(); colE.set([b * (0.85 + t * 0.15), b * (0.86 + 0.06 * t), b * (1 - t * 0.25)], i * 3);
  }
  const gE = new THREE.BufferGeometry(); gE.setAttribute('position', new THREE.BufferAttribute(posE, 3)); gE.setAttribute('color', new THREE.BufferAttribute(colE, 3));
  const estrellas = new THREE.Points(gE, new THREE.PointsMaterial({ size: 2.1, sizeAttenuation: false, vertexColors: true, map: tex.resplandor, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  estrellas.renderOrder = -9; cielo.add(estrellas);
  const discoLuna = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLuna(), transparent: true, depthWrite: false, fog: false }));
  const azL = -Math.PI / 2 + 0.5, elL = 0.125; discoLuna.position.set(Math.cos(elL) * Math.cos(azL) * 540, Math.sin(elL) * 540, Math.cos(elL) * Math.sin(azL) * 540);
  discoLuna.scale.set(150, 150, 1); discoLuna.renderOrder = -8; cielo.add(discoLuna);

  // --- Ciudad lejana: siluetas de casas, cúpulas y alminares con ventanas encendidas
  const matSil = new THREE.MeshBasicMaterial({ color: 0x06060f });
  const cajas = [], domos = [], luces = [];
  for (let i = 0; i < 230; i++) {
    const a = r() * Math.PI * 2, d = 150 + r() * 130, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const w = 7 + r() * 16, h = 5 + r() * 15 + (d - 150) * 0.05, p = 7 + r() * 12;
    const c = new THREE.BoxGeometry(w, h, p); c.rotateY(-a + (r() - 0.5) * 0.5); c.translate(x, SUELO_Y + h / 2, z); cajas.push(c);
    const tipo = r();
    if (tipo < 0.3) { const dm = new THREE.SphereGeometry(Math.min(w, p) * 0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); dm.scale(1, 1.25, 1); dm.translate(x, SUELO_Y + h, z); domos.push(dm); }
    else if (tipo < 0.44) {
      const ht = h + 12 + r() * 16, t = new THREE.CylinderGeometry(0.75, 1.0, ht, 7); t.translate(x + w * 0.4, SUELO_Y + ht / 2, z); cajas.push(t);
      const bal = new THREE.CylinderGeometry(1.5, 1.2, 0.9, 7); bal.translate(x + w * 0.4, SUELO_Y + ht * 0.8, z); cajas.push(bal);
      const cap = new THREE.ConeGeometry(1.05, 4, 7); cap.translate(x + w * 0.4, SUELO_Y + ht + 2, z); cajas.push(cap);
    }
    const nv = Math.floor(r() * 4);
    for (let k = 0; k < nv; k++) { const f = 1 - 9 / d; luces.push(x * f + (r() - 0.5) * w * 0.7, SUELO_Y + 2 + r() * (h - 3), z * f + (r() - 0.5) * w * 0.7); }
  }
  const siluetas = new THREE.Mesh(unir([...cajas, ...domos]), matSil); siluetas.matrixAutoUpdate = false; escena.add(siluetas);
  const gV = new THREE.BufferGeometry(); gV.setAttribute('position', new THREE.Float32BufferAttribute(luces, 3));
  const ventanas = new THREE.Points(gV, new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: false, color: 0xffb25e, map: tex.resplandor, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  escena.add(ventanas);

  // --- Suelo de la terraza
  const tb = texBaldosas(); tb.repeat.set(70, 70);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: tb, color: 0x6f6f84, roughness: 0.7, metalness: 0.0, envMapIntensity: 0.22 }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = SUELO_Y; suelo.matrixAutoUpdate = false; suelo.updateMatrix(); escena.add(suelo);

  // --- Mesa baja con canto de latón, patas torneadas y tapete
  const MW = 52, MH = 43.5, GROSOR = 1.3, MESA_Z = -1.6;
  const fm = rectRedondeado(new THREE.Shape(), -MW / 2, -MH / 2, MW, MH, 3.2);
  const gm = new THREE.ExtrudeGeometry(fm, { depth: GROSOR - 0.24, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3, curveSegments: 16 });
  gm.rotateX(-Math.PI / 2); gm.translate(0, MESA_Y - GROSOR + 0.12, MESA_Z);
  const mesa = new THREE.Mesh(gm, mats.mesa); mesa.receiveShadow = true; escena.add(mesa);
  const fc = rectRedondeado(new THREE.Shape(), -MW / 2 - 0.16, -MH / 2 - 0.16, MW + 0.32, MH + 0.32, 3.36);
  const gc = new THREE.ExtrudeGeometry(fc, { depth: 0.22, bevelEnabled: false, curveSegments: 16 }); gc.rotateX(-Math.PI / 2); gc.translate(0, MESA_Y - 0.62, MESA_Z);
  escena.add(new THREE.Mesh(gc, mats.oroViejo));
  const perfilPata = [[1.9, 0], [2.0, 0.5], [1.4, 1.2], [1.1, 3], [1.6, 5.5], [1.9, 8], [1.5, 10.5], [1.25, 12], [1.7, 13], [1.9, SUELO_Y * -1 + MESA_Y - GROSOR]].map(([x, y]) => new THREE.Vector2(x, y));
  const patas = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.LatheGeometry(perfilPata, 16); p.translate(sx * (MW / 2 - 4.5), SUELO_Y, MESA_Z + sz * (MH / 2 - 4.5)); patas.push(p); }
  escena.add(new THREE.Mesh(unir(patas), mats.mesa));
  const TW = ANCHO + 2 * 1.3 + 4.6, TH = ALTO + 2 * 1.3 + 4.6;
  const tapete = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), new THREE.MeshStandardMaterial({ map: texTapete(), roughness: 0.95, metalness: 0, envMapIntensity: 0.25 }));
  tapete.rotation.x = -Math.PI / 2; tapete.position.set(0, MESA_Y + 0.03, 0); tapete.receiveShadow = true; escena.add(tapete);
  // canto fino y flecos, para que sea una tela y no una calcomanía
  const cantoT = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.03, TH), new THREE.MeshStandardMaterial({ color: 0x24060a, roughness: 1 }));
  cantoT.position.set(0, MESA_Y + 0.014, 0); cantoT.receiveShadow = true; escena.add(cantoT);
  const tf = texFlecos(); tf.repeat.set(5, 1);
  const matFleco = new THREE.MeshStandardMaterial({ map: tf, transparent: true, roughness: 1, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [-1, 1]) { const fl = new THREE.Mesh(new THREE.PlaneGeometry(TH, 0.62), matFleco); fl.rotation.set(-Math.PI / 2, 0, s * Math.PI / 2); fl.position.set(s * (TW / 2 + 0.3), MESA_Y + 0.012, 0); fl.receiveShadow = true; escena.add(fl); }

  // --- Faroles sobre la mesa
  const faroles = [];
  for (const [x, z, s] of [[-20.6, -17.6, 1.15], [20.6, -17.6, 1.15], [-22.2, 14.6, 0.95]]) {
    const f = crearFarol(mats, tex); f.position.set(x, MESA_Y, z); f.scale.setScalar(s); escena.add(f); faroles.push(f);
  }

  // --- Motas de polvo doradas flotando sobre la mesa
  const nP = 260, posP = new Float32Array(nP * 3), semP = [];
  for (let i = 0; i < nP; i++) { posP.set([(r() - 0.5) * 50, 0.5 + r() * 13, -1.6 + (r() - 0.5) * 42], i * 3); semP.push([r() * 6.28, 0.2 + r() * 0.5, r() * 6.28]); }
  const gP = new THREE.BufferGeometry(); gP.setAttribute('position', new THREE.BufferAttribute(posP, 3));
  const polvo = new THREE.Points(gP, new THREE.PointsMaterial({ size: 0.16, map: tex.resplandor, color: 0xffcf8a, transparent: true, opacity: 0.36, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  polvo.frustumCulled = false; escena.add(polvo);

  // --- Hora del día: 0 = medianoche, 0,25 = sale el sol, 0,5 = mediodía, 0,75 = se pone.
  const paso = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const C = (h) => new THREE.Color(h);
  const COL = { solBajo: C(0xff7a2e), solAlto: C(0xfff0dc), lampara: C(0xffc98f), cieloN: C(0x5a70d8), sueloN: C(0x2a1408), cieloD: C(0xc4d8ff), sueloD: C(0xa88458), cieloO: C(0xf0a488),
    nieblaN: C(NIEBLA), nieblaD: C(0xc9bca4), nieblaO: C(0x9a6a5c), silN: C(0x06060f), silD: C(0x9c8b78), vidrioSi: new THREE.Color(1.5, 1.22, 0.9), vidrioNo: new THREE.Color(0.5, 0.33, 0.18) };
  const dirSol = new THREE.Vector3(), dirLuz = new THREE.Vector3(), dirLampara = new THREE.Vector3(-9, 38, 12.2).normalize(), niebla = new THREE.Color();
  let hora = -1, noche = 1, luzSucia = false;
  function ponerHora(h) {
    h = ((h % 1) + 1) % 1; if (Math.abs(h - hora) < 2e-5) return; hora = h; luzSucia = true;
    const ang = (h - 0.25) * Math.PI * 2, e = Math.sin(ang);
    dirSol.set(Math.cos(ang), e * 0.95, 0.42 * Math.max(0, e) + 0.2).normalize();
    const dia = paso(-0.12, 0.22, e), ocaso = Math.exp(-(((e - 0.03) / 0.2) ** 2));
    noche = 1 - paso(-0.22, 0.02, e);
    if (e > -0.03) {       // sol
      sol.intensity = 4.3 * paso(-0.03, 0.26, e) * (1 - 0.36 * paso(0.5, 1, e)); sol.color.copy(COL.solBajo).lerp(COL.solAlto, paso(0.02, 0.5, e));
      dirLuz.copy(dirSol); dirLuz.y = Math.max(dirLuz.y, 0.2); dirLuz.normalize();
    } else {               // lámpara alta
      sol.intensity = 1.2 * paso(-0.05, -0.3, e); sol.color.copy(COL.lampara); dirLuz.copy(dirLampara);
    }
    encuadrarSombra(dirLuz);
    clave.intensity = 0.5 * noche; luna.intensity = 0.42 * noche;
    hemi.color.copy(COL.cieloN).lerp(COL.cieloD, dia).lerp(COL.cieloO, ocaso * 0.45); hemi.groundColor.copy(COL.sueloN).lerp(COL.sueloD, dia); hemi.intensity = 0.85 + 0.17 * dia;
    niebla.copy(COL.nieblaN).lerp(COL.nieblaD, dia).lerp(COL.nieblaO, ocaso * 0.5 * dia);
    escena.fog.color.copy(niebla); escena.background.copy(niebla);
    const u = cupula.material.uniforms; u.uDia.value = dia; u.uOcaso.value = ocaso; u.uSol.value.copy(dirSol); u.uNiebla.value.copy(niebla);
    discoLuna.material.opacity = noche; ventanas.material.opacity = 0.85 * noche; matSil.color.copy(COL.silN).lerp(COL.silD, dia);
    polvo.material.opacity = 0.36 * (0.3 + 0.7 * noche);
    escena.environmentIntensity = 0.36 + 0.26 * dia;      // de día manda el sol; de noche, el reflejo cálido de las lámparas
    for (const f of faroles) f.userData.vidrio.material.color.copy(COL.vidrioNo).lerp(COL.vidrioSi, noche);
  }

  const base = posP.slice();
  function actualizar(t, camara) {
    cielo.position.copy(camara.position);
    for (const f of faroles) {
      const u = f.userData, k = (0.86 + 0.09 * Math.sin(t * 7.3 + u.fase) + 0.06 * Math.sin(t * 13.1 + u.fase * 2.1) + 0.04 * Math.sin(t * 23.7 + u.fase * 0.7)) * noche;
      u.luz.intensity = 46 * k; u.halo.material.opacity = 0.5 * k; u.calada.material.opacity = 0.46 * k; u.calada.rotation.z = Math.sin(t * 0.21 + u.fase) * 0.05;
    }
    for (let i = 0; i < nP; i++) {
      const s = semP[i];
      posP[i * 3] = base[i * 3] + Math.sin(t * 0.11 * s[1] * 3 + s[0]) * 1.4;
      posP[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.17 * s[1] * 3 + s[2]) * 0.9;
      posP[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.09 * s[1] * 3 + s[0]) * 1.4;
    }
    gP.attributes.position.needsUpdate = true;
    estrellas.material.opacity = (0.9 + 0.1 * Math.sin(t * 1.7)) * noche * noche; estrellas.visible = noche > 0.01;
  }
  ponerHora(0.345);
  const cielo2 = { ponerHora, get exposicion() { return 0.82 + 0.18 * (1 - noche); }, get hora() { return hora; }, get noche() { return noche; }, tomarSucio() { const s = luzSucia; luzSucia = false; return s; } };
  return { actualizar, sol, clave, tex, faroles, cielo: cielo2, dirLuna: discoLuna.position.clone().normalize() };
}
