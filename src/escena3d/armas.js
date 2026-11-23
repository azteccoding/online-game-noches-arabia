// Armas estilizadas, a escala de las fichas. Todas se empuñan en el origen; la hoja apunta a +Y y el filo mira a +Z.
// Solo son figuras para la animación: no llevan ninguna regla del juego.
import * as THREE from 'three';

const K = 0.92 / 170;
export const ARMAS = ['cimitarra', 'jambiya', 'alfanje', 'arco'];
export const NOMBRE_ARMA = { cimitarra: 'Cimitarra', jambiya: 'Jambiya', alfanje: 'Alfanje', arco: 'Arco', '': 'Sin armas' };
export const esHoja = (tipo) => tipo === 'cimitarra' || tipo === 'jambiya' || tipo === 'alfanje';

function hoja(puntos, grosor) {
  const f = new THREE.Shape(); puntos(f);
  const g = new THREE.ExtrudeGeometry(f, { depth: grosor, bevelEnabled: true, bevelThickness: grosor * 0.45, bevelSize: 0.7, bevelSegments: 1, curveSegments: 14 });
  g.translate(0, 0, -grosor / 2); g.rotateY(-Math.PI / 2); g.scale(K, K, K);      // el plano de la hoja queda en YZ, con la curva hacia +Z
  return g;
}

export function crearArma(tipo, mats) {
  const grupo = new THREE.Group(), base = new THREE.Vector3(), punta = new THREE.Vector3();
  const acero = new THREE.MeshStandardMaterial({ color: 0xe4e9ee, metalness: 1, roughness: 0.24, envMapIntensity: 2.2, emissive: 0x9aa6b4, emissiveIntensity: 0.42 });
  const cuero = new THREE.MeshStandardMaterial({ color: 0x4d0e17, roughness: 0.5 });
  const cil = (r1, r2, h, y) => { const c = new THREE.CylinderGeometry(r1 * K, r2 * K, h * K, 12); c.translate(0, y * K, 0); return c; };
  const res = { tipo, grupo, base, punta, tensar: null, flecha: null };
  if (tipo === 'cimitarra') {
    grupo.add(new THREE.Mesh(hoja((f) => { f.moveTo(-4, 6); f.bezierCurveTo(-5, 44, 2, 78, 24, 104); f.bezierCurveTo(15, 80, 7, 46, 6, 6); f.closePath(); }, 1.5), acero));
    const guarda = new THREE.BoxGeometry(5 * K, 4 * K, 19 * K); guarda.translate(0, 5 * K, 1 * K);
    grupo.add(new THREE.Mesh(guarda, mats.laton), new THREE.Mesh(cil(3, 3.4, 15, -4), cuero));
    const pomo = new THREE.SphereGeometry(4.2 * K, 10, 8); pomo.translate(0, -13 * K, 0); grupo.add(new THREE.Mesh(pomo, mats.laton));
    base.set(0, 12 * K, 0); punta.set(0, 102 * K, 22 * K);
  } else if (tipo === 'jambiya') {
    grupo.add(new THREE.Mesh(hoja((f) => { f.moveTo(-6, 4); f.bezierCurveTo(-7, 22, 0, 40, 22, 50); f.bezierCurveTo(10, 38, 7, 22, 7, 4); f.closePath(); }, 1.6), acero));
    grupo.add(new THREE.Mesh(cil(3.2, 3.2, 12, -3), mats.laton));
    const d1 = new THREE.CylinderGeometry(7.5 * K, 7.5 * K, 2.6 * K, 14); d1.scale(0.6, 1, 1); d1.translate(0, 4 * K, 0);
    const d2 = new THREE.CylinderGeometry(6.5 * K, 6.5 * K, 2.6 * K, 14); d2.scale(0.6, 1, 1); d2.translate(0, -10 * K, 0);
    grupo.add(new THREE.Mesh(d1, mats.laton), new THREE.Mesh(d2, mats.laton));
    base.set(0, 8 * K, 0); punta.set(0, 49 * K, 21 * K);
  } else if (tipo === 'alfanje') {
    const osc = acero.clone(); osc.color.set(0xc9d0d8); osc.roughness = 0.3;
    grupo.add(new THREE.Mesh(hoja((f) => { f.moveTo(-5, 6); f.lineTo(-6, 80); f.lineTo(6, 106); f.bezierCurveTo(24, 92, 22, 44, 9, 6); f.closePath(); }, 2.6), osc));
    const guarda = new THREE.BoxGeometry(6 * K, 5 * K, 24 * K); guarda.translate(0, 5 * K, 1 * K);
    grupo.add(new THREE.Mesh(guarda, mats.laton), new THREE.Mesh(cil(3.4, 3.8, 18, -6), cuero));
    const pomo = new THREE.SphereGeometry(5 * K, 10, 8); pomo.translate(0, -17 * K, 0); grupo.add(new THREE.Mesh(pomo, mats.laton));
    base.set(0, 12 * K, 0); punta.set(0, 104 * K, 10 * K);
  } else if (tipo === 'arco') {
    const pts = [[-56, -20], [-40, -4], [-16, 3], [0, 4], [16, 3], [40, -4], [56, -20]].map(([y, z]) => new THREE.Vector3(0, y * K, z * K));
    const palo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 1.9 * K, 8);
    grupo.add(new THREE.Mesh(palo, new THREE.MeshStandardMaterial({ color: 0x6a2a14, roughness: 0.45 })));
    grupo.add(new THREE.Mesh(cil(2.6, 2.6, 13, 0).translate(0, 0, 4 * K), mats.laton));
    for (const s of [-1, 1]) { const t = new THREE.SphereGeometry(2.6 * K, 8, 6); t.translate(0, s * 56 * K, -20 * K); grupo.add(new THREE.Mesh(t, mats.laton)); }
    const gC = new THREE.BufferGeometry(); gC.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    const cuerda = new THREE.Line(gC, new THREE.LineBasicMaterial({ color: 0xf1e3b8 })); cuerda.frustumCulled = false; grupo.add(cuerda);
    const flecha = crearFlecha(mats); flecha.grupo.rotation.x = Math.PI / 2; grupo.add(flecha.grupo);
    res.flecha = flecha.grupo;
    res.tensar = (u, conFlecha) => {      // u = 0 cuerda en reposo, 1 = tensada del todo
      const z = (-20 - 30 * u) * K, p = gC.attributes.position.array;
      p.set([0, -56 * K, -20 * K, 0, 0, z, 0, 56 * K, -20 * K]); gC.attributes.position.needsUpdate = true;
      flecha.grupo.visible = !!conFlecha; flecha.grupo.position.set(0, 0, z + LARGO_FLECHA / 2);
    };
    res.tensar(0, false);
    base.set(0, -56 * K, -20 * K); punta.set(0, 56 * K, -20 * K);
  }
  grupo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return res;
}

export const LARGO_FLECHA = 66 * K;
// Flecha: apunta a +Y (el astil va de -L/2 a +L/2).
export function crearFlecha(mats) {
  const grupo = new THREE.Group(), L = LARGO_FLECHA;
  const astil = new THREE.CylinderGeometry(0.9 * K, 0.9 * K, L, 6);
  grupo.add(new THREE.Mesh(astil, new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.6 })));
  const punta = new THREE.ConeGeometry(2.4 * K, 8 * K, 8); punta.translate(0, L / 2 + 3 * K, 0); grupo.add(new THREE.Mesh(punta, mats.laton));
  const pluma = new THREE.MeshStandardMaterial({ color: 0x9a2630, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) { const p = new THREE.PlaneGeometry(4.5 * K, 12 * K); p.translate(2.6 * K, -L / 2 + 7 * K, 0); p.rotateY((i / 3) * Math.PI * 2); grupo.add(new THREE.Mesh(p, pluma)); }
  grupo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { grupo };
}
