// Fuego estilizado para las ciudades «quemadas»: lenguas de llama que suben, se estrechan y se apagan, más unas brasas.
// No usa luces (cambiar el número de luces obligaría a recompilar los materiales): solo destellos aditivos.
import * as THREE from 'three';

export function crearFuego(tex, { alto = 1.1, ancho = 0.5, n = 9 } = {}) {
  const grupo = new THREE.Group(), lenguas = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffa040, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.renderOrder = 18; grupo.add(s);
    lenguas.push({ s, fase: i / n, vel: 0.75 + Math.random() * 0.5, x: (Math.random() - 0.5) * ancho, z: (Math.random() - 0.5) * ancho * 0.7, giro: Math.random() * 6 });
  }
  const base = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff6a20, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  base.scale.set(ancho * 2.6, ancho * 1.5, 1); base.position.y = 0.12; base.renderOrder = 17; grupo.add(base);
  const c = new THREE.Color();
  function actualizar(t, fuerza = 1) {
    for (const l of lenguas) {
      const u = (t * l.vel + l.fase) % 1, vaiven = Math.sin(t * 3.1 + l.giro) * 0.06 * u;
      l.s.position.set(l.x * (1 - u * 0.7) + vaiven, 0.08 + u * alto, l.z * (1 - u * 0.7));
      const tam = ancho * (0.95 - 0.6 * u) * (0.85 + 0.15 * Math.sin(t * 11 + l.giro)); l.s.scale.set(tam, tam * 1.9, 1);
      l.s.material.opacity = fuerza * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.7 * 0.85;
      l.s.material.color.copy(c.setHSL(0.11 - 0.09 * u, 1, 0.6 - 0.22 * u));
    }
    base.material.opacity = fuerza * (0.45 + 0.12 * Math.sin(t * 9.3));
    grupo.visible = fuerza > 0.01;
  }
  function destruir() { for (const l of lenguas) l.s.material.dispose(); base.material.dispose(); }
  return { grupo, actualizar, destruir };
}
