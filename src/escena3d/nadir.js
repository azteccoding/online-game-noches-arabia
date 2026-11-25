// Versión nadir de un personaje: al acercarse a un personaje que tenga pintura propia en contrapicado (public/arte3d/nadir-<id>.webp
// de frente, nadir-<id>-r.webp de espaldas; las dos con fondo transparente), su figura 3D se cambia por esa pintura, parada en su
// sitio sobre la arena del mapa y de cara a la cámara. De frente se ve el anverso; desde atrás, el reverso. Sin pintura, todo sigue igual.
import * as THREE from 'three';
import { altoDe } from './figuras.js';

export const ESCALA_NADIR = 1;       // la versión nadir mide lo mismo que la figura normal: conserva su estatura frente a los demás

export function crearPinturaNadir(escena, dir, alCargar) {
  const cache = new Map();
  function cargar(nombre) {
    let c = cache.get(nombre); if (c) return c;
    c = { estado: 'cargando', tex: null }; cache.set(nombre, c);
    new THREE.TextureLoader().load(`${dir}${nombre}.webp`, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; c.tex = tx; c.estado = 'si'; alCargar?.(); }, undefined, () => { c.estado = 'no'; });
    return c;
  }
  const lado = (id, l) => cargar(l < 0 ? `nadir-${id}-r` : `nadir-${id}`);
  // ¿Qué caras tiene este personaje? { anverso, reverso }
  function caras(ficha) {
    if (!ficha?.pid) return { anverso: false, reverso: false };
    return { anverso: lado(ficha.pid, 1).estado === 'si', reverso: lado(ficha.pid, -1).estado === 'si' };
  }
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);      // apoyada por los pies
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, alphaTest: 0.02, side: THREE.DoubleSide, depthWrite: true });
  const malla = new THREE.Mesh(geo, mat); malla.visible = false; malla.renderOrder = 6; escena.add(malla);
  let oculta = null;
  function mostrarFigura() { if (oculta) { oculta.cuerpo.visible = true; oculta = null; } }

  function actualizar(cam) {
    const t = cam.userData.nadir || 0, ficha = cam.userData.nadirFicha || null, l = cam.userData.nadirLado || 0;
    const c = ficha?.pid && l ? lado(ficha.pid, l) : null;
    const x = c?.estado === 'si' ? Math.min(1, Math.max(0, (t - 0.25) / 0.4)) : 0, k = x * x * (3 - 2 * x);
    if (oculta && (oculta !== ficha || k < 0.5)) mostrarFigura();
    if (k <= 0.001) { malla.visible = false; return; }
    if (k >= 0.5 && oculta !== ficha) { ficha.cuerpo.visible = false; oculta = ficha; }
    if (mat.map !== c.tex) { mat.map = c.tex; mat.needsUpdate = true; }
    mat.opacity = k; malla.visible = true;
    const p = ficha.nodo.position, alto = altoDe(ficha.pid) * (ficha.cuerpo.scale.y || 1) * ESCALA_NADIR, img = c.tex.image;
    malla.position.set(p.x, p.y - 0.02 * alto, p.z);      // los pies se hunden un pelo en la arena: siempre la tocan
    malla.rotation.set(0, Math.atan2(cam.position.x - p.x, cam.position.z - p.z), 0);      // siempre de cara a la cámara
    malla.scale.set(alto * img.width / img.height, alto, 1);
  }
  function destruir() { mostrarFigura(); escena.remove(malla); geo.dispose(); mat.dispose(); for (const c of cache.values()) c.tex?.dispose(); }
  return { actualizar, caras, tiene: (f) => { const c = caras(f); return c.anverso || c.reverso; }, destruir };
}
