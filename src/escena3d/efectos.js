// Efectos de las peleas: chispas, polvo, destellos, ondas en el suelo y estelas de las hojas. Todo con pocos objetos reutilizados.
import * as THREE from 'three';
import { texResplandor, texAro } from './texturas.js';

export function crearEfectos(escena) {
  const tGlow = texResplandor(), tAro = texAro(), grupo = new THREE.Group(); escena.add(grupo);
  const al = (a, b) => a + Math.random() * (b - a);
  let vivos = 0;

  // --- Chispas: puntos aditivos con gravedad
  const NC = 260, pC = new Float32Array(NC * 3).fill(-999), cC = new Float32Array(NC * 3), vC = new Float32Array(NC * 3), eC = new Float32Array(NC).fill(9), dC = new Float32Array(NC).fill(1), bC = new Float32Array(NC * 3);
  const gC = new THREE.BufferGeometry(); gC.setAttribute('position', new THREE.BufferAttribute(pC, 3)); gC.setAttribute('color', new THREE.BufferAttribute(cC, 3));
  const mallaC = new THREE.Points(gC, new THREE.PointsMaterial({ size: 0.1, map: tGlow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  mallaC.frustumCulled = false; mallaC.renderOrder = 20; grupo.add(mallaC);
  let iC = 0; const col = new THREE.Color();
  function chispas(p, n = 14, fuerza = 1, color = 0xffd27a, dir = null) {
    col.set(color);
    for (let k = 0; k < n; k++) {
      const i = iC; iC = (iC + 1) % NC;
      const a = al(0, Math.PI * 2), el = al(-0.3, 1.2), v = al(1.6, 5.2) * fuerza;
      pC[i * 3] = p.x; pC[i * 3 + 1] = p.y; pC[i * 3 + 2] = p.z;
      vC[i * 3] = Math.cos(a) * Math.cos(el) * v + (dir ? dir.x * 2.2 * fuerza : 0); vC[i * 3 + 1] = Math.sin(el) * v + 1.2; vC[i * 3 + 2] = Math.sin(a) * Math.cos(el) * v + (dir ? dir.z * 2.2 * fuerza : 0);
      const b = al(0.7, 1.5); bC[i * 3] = col.r * b; bC[i * 3 + 1] = col.g * b; bC[i * 3 + 2] = col.b * b;
      eC[i] = 0; dC[i] = al(0.22, 0.6);
    }
  }

  // --- Polvo, destellos y ondas: sprites y planos reciclados
  const fondo = (n, crear) => Array.from({ length: n }, () => { const o = crear(); o.visible = false; grupo.add(o); return { o, t: 9, dur: 1 }; });
  const polvos = fondo(34, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: tGlow, color: 0xd8c29a, transparent: true, opacity: 0, depthWrite: false })));
  const destellos = fondo(8, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tGlow, color: 0xfff1c4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.renderOrder = 21; return s; });
  const gPlano = new THREE.PlaneGeometry(1, 1); gPlano.rotateX(-Math.PI / 2);
  const ondas = fondo(5, () => { const m = new THREE.Mesh(gPlano, new THREE.MeshBasicMaterial({ map: tAro, color: 0xffe6b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 9; return m; });
  const libre = (lista) => lista.reduce((a, b) => (b.t / b.dur > a.t / a.dur ? b : a));
  function polvo(p, n = 6, radio = 0.5, color = 0xd8c29a) {
    for (let k = 0; k < n; k++) {
      const e = libre(polvos), a = al(0, Math.PI * 2);
      e.t = 0; e.dur = al(0.5, 0.95); e.o.visible = true; e.o.material.color.set(color);
      e.o.position.set(p.x + Math.cos(a) * 0.08, p.y + 0.06, p.z + Math.sin(a) * 0.08);
      e.vx = Math.cos(a) * al(0.5, 1.5) * radio; e.vz = Math.sin(a) * al(0.5, 1.5) * radio; e.vy = al(0.25, 0.8); e.t0 = al(0.16, 0.26); e.t1 = al(0.5, 0.85) * (0.6 + radio);
    }
  }
  function destello(p, tam = 0.7, color = 0xfff1c4) { const e = libre(destellos); e.t = 0; e.dur = 0.16; e.tam = tam; e.o.visible = true; e.o.material.color.set(color); e.o.position.copy(p); }
  function onda(p, tam = 1.6, color = 0xffe6b0) { const e = libre(ondas); e.t = 0; e.dur = 0.5; e.tam = tam; e.o.visible = true; e.o.material.color.set(color); e.o.position.set(p.x, p.y + 0.02, p.z); }

  // --- Estelas: una cinta que sigue la hoja (base y punta) y se desvanece
  const estelas = [];
  function crearEstela(color = 0xfff3d0, N = 26, vida = 0.2) {
    const pos = new Float32Array(N * 6), colr = new Float32Array(N * 6), idx = [];
    for (let i = 0; i < N - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setIndex(idx);
    const malla = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    malla.frustumCulled = false; malla.visible = false; malla.renderOrder = 19; grupo.add(malla);
    const c = new THREE.Color(color), muestras = [];
    const e = {
      muestra(a, b, edad = 0) { muestras.unshift({ ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, edad: -edad }); if (muestras.length > N) muestras.pop(); },
      cortar() { muestras.length = 0; malla.visible = false; },
      actualizar(dt) {
        for (const m of muestras) m.edad += dt;
        while (muestras.length && muestras[muestras.length - 1].edad > vida) muestras.pop();
        malla.visible = muestras.length > 1; if (!malla.visible) return false;
        for (let i = 0; i < N; i++) {
          const m = muestras[Math.min(i, muestras.length - 1)], k = i * 6, b = i < muestras.length ? Math.max(0, 1 - Math.max(0, m.edad) / vida) ** 1.6 : 0;
          pos[k] = m.ax; pos[k + 1] = m.ay; pos[k + 2] = m.az; pos[k + 3] = m.bx; pos[k + 4] = m.by; pos[k + 5] = m.bz;
          colr[k] = 0; colr[k + 1] = 0; colr[k + 2] = 0; colr[k + 3] = c.r * b * 0.34; colr[k + 4] = c.g * b * 0.34; colr[k + 5] = c.b * b * 0.34;
        }
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; return true;
      },
    };
    estelas.push(e); return e;
  }

  function actualizar(dt) {
    vivos = 0;
    for (let i = 0; i < NC; i++) {
      if (eC[i] >= dC[i]) continue;
      eC[i] += dt; const k = i * 3;
      if (eC[i] >= dC[i]) { pC[k + 1] = -999; cC[k] = cC[k + 1] = cC[k + 2] = 0; continue; }
      vivos++; vC[k + 1] -= 13 * dt; pC[k] += vC[k] * dt; pC[k + 1] += vC[k + 1] * dt; pC[k + 2] += vC[k + 2] * dt;
      const b = (1 - eC[i] / dC[i]) ** 1.5; cC[k] = bC[k] * b; cC[k + 1] = bC[k + 1] * b; cC[k + 2] = bC[k + 2] * b;
    }
    gC.attributes.position.needsUpdate = true; gC.attributes.color.needsUpdate = true;
    for (const e of polvos) {
      if (e.t >= e.dur) { e.o.visible = false; continue; }
      e.t += dt; vivos++; const u = Math.min(1, e.t / e.dur), fr = Math.exp(-dt * 3);
      e.vx *= fr; e.vz *= fr; e.vy *= fr; e.o.position.x += e.vx * dt; e.o.position.y += e.vy * dt; e.o.position.z += e.vz * dt;
      const s = e.t0 + (e.t1 - e.t0) * (1 - (1 - u) ** 2); e.o.scale.set(s, s, 1); e.o.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.15) ** 0.6) * (1 - u);
    }
    for (const e of destellos) {
      if (e.t >= e.dur) { e.o.visible = false; continue; }
      e.t += dt; vivos++; const u = Math.min(1, e.t / e.dur), s = e.tam * (0.35 + 0.65 * u); e.o.scale.set(s, s, 1); e.o.material.opacity = (1 - u) ** 1.5;
    }
    for (const e of ondas) {
      if (e.t >= e.dur) { e.o.visible = false; continue; }
      e.t += dt; vivos++; const u = Math.min(1, e.t / e.dur), s = e.tam * (0.25 + 0.75 * (1 - (1 - u) ** 2)); e.o.scale.set(s, 1, s); e.o.material.opacity = 0.8 * (1 - u);
    }
    for (const e of estelas) if (e.actualizar(dt)) vivos++;
  }
  return { chispas, polvo, destello, onda, crearEstela, actualizar, get activo() { return vivos > 0; } };
}
