// Laúd de Jamil (Jorge, 24 de noviembre, solo en el 3D): Jamil se sienta con el laúd al frente y hace como que toca, con música.
// El Jamil sentado es su segunda figura pintada (fig-4t, ver fichas.js y figuras8.js); aquí están los tiempos de la secuencia y
// las notas que suben mientras toca. No lleva ninguna regla del juego: el premio lo da el motor (shared/personajes.js).
import * as THREE from 'three';
import { lienzo, aTextura } from './texturas.js';

// Tiempos, en segundos: sentarse con el laúd, tocar (lo que pida quien llama) y levantarse.
// Jorge, 24 de noviembre: «la canción de Jamil debe empezar en el segundo 15 y durar 20 segundos». El archivo de la música ya es
// ese tramo (del segundo 15 al 35 de la pieza, con el final fundido: herramientas/preparar-musica-laud.py); T_TOCAR es lo que dura.
export const T_SACAR = 0.9, T_GUARDAR = 0.8, T_TOCAR = 20;
const suave = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };

// --- Notas: una corchea y un par de corcheas dibujadas a mano (no dependen de que el equipo tenga una fuente con ♪)
let texNotas = null;
function texturasNotas() {
  if (texNotas) return texNotas;
  const dibujar = (doble) => {
    const c = lienzo(128, 128), g = c.getContext('2d');
    const nota = (x, y, alto) => { g.beginPath(); g.ellipse(x, y, 17, 12, -0.45, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x + 14, y - 4); g.lineTo(x + 14, y - alto); g.stroke(); };
    g.lineWidth = 7; g.lineJoin = 'round'; g.lineCap = 'round';
    for (const [trazo, relleno, ancho] of [['#3a2208', '#3a2208', 13], ['#fff3c8', '#fff3c8', 6]]) {      // primero el contorno oscuro, encima la nota clara: se lee de día y de noche
      g.strokeStyle = trazo; g.fillStyle = relleno; g.lineWidth = ancho;
      if (doble) { nota(34, 96, 62); nota(84, 86, 62); g.beginPath(); g.moveTo(48, 34); g.lineTo(98, 24); g.stroke(); }
      else { nota(52, 94, 66); g.beginPath(); g.moveTo(66, 28); g.quadraticCurveTo(96, 40, 90, 66); g.stroke(); }
    }
    return aTextura(c, { aniso: 2 });
  };
  texNotas = [dibujar(false), dibujar(true)];
  return texNotas;
}

// Las notas de una ficha que toca: van sueltas en la escena, para subir derechas aunque la figura se meza. alto: el de la figura de pie.
export function crearNotas({ escena, alto }) {
  const tex = texturasNotas();
  const notas = Array.from({ length: 7 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex[i % 2], transparent: true, opacity: 0, depthWrite: false, fog: false })); s.visible = false; s.renderOrder = 22; escena.add(s); return { s, t: 9, dur: 1, x: 0, y: 0, z: 0, fase: 0, lado: 1 }; });
  let iNota = 0, tNota = 0;
  // Mientras toca (tocando de 0 a 1) suelta una nota cada tanto desde «boca» (la roseta del laúd, en el mundo). esc: tamaño de la ficha.
  function sonar(tocando, dt, boca, esc) {
    if (tocando <= 0.01) return;
    tNota -= dt; if (tNota > 0) return;
    tNota = 0.42 + Math.random() * 0.3;
    const n = notas[iNota]; iNota = (iNota + 1) % notas.length;
    Object.assign(n, { t: 0, dur: 1.5 + Math.random() * 0.6, x: boca.x, y: boca.y, z: boca.z, fase: Math.random() * 6.3, lado: Math.random() < 0.5 ? -1 : 1, esc }); n.s.visible = true;
  }
  // Las notas siguen su camino aunque ya se esté levantando. Devuelve si queda alguna a la vista.
  function actualizar(dt) {
    let vivas = false;
    for (const n of notas) {
      if (!n.s.visible) continue;
      n.t += dt; const u = n.t / n.dur; if (u >= 1) { n.s.visible = false; n.s.material.opacity = 0; continue; }
      vivas = true;
      const k = n.esc || 1, sube = (0.1 + 0.9 * u) * 0.62 * alto * k;
      n.s.position.set(n.x + n.lado * (0.05 + 0.16 * u) * alto * k + Math.sin(n.fase + u * 7) * 0.035 * alto * k, n.y + sube, n.z + 0.05 * alto * k);
      n.s.scale.setScalar((0.13 + 0.07 * u) * alto * k); n.s.material.opacity = Math.min(1, u / 0.12) * (1 - suave((u - 0.6) / 0.4)); n.s.material.rotation = n.lado * 0.25 * Math.sin(n.fase + u * 5);
    }
    return vivas;
  }
  function esconder() { for (const n of notas) { n.s.visible = false; n.t = 9; } }
  function destruir() { esconder(); for (const n of notas) { escena.remove(n.s); n.s.material.dispose(); } }
  return { sonar, actualizar, esconder, destruir };
}
