// Pan / zoom del tablero SIN re-render de React por frame.
//
// Técnica «transformación GPU + confirmación vectorial»:
//  - El <svg> del tablero es MÁS GRANDE que la pantalla (overscan 25 % por lado) y su viewBox muestra solo esa ventana.
//  - Durante el gesto solo se escribe `style.transform` (translate/scale compuestos en GPU) dentro de requestAnimationFrame.
//  - Al terminar el gesto (o si la escala cambia demasiado / el desplazamiento agota el overscan) se «confirma»: se escribe
//    el viewBox nuevo y se quita la transformación. El navegador vuelve a rasterizar el VECTOR a la escala real y a la densidad
//    del dispositivo, por eso en reposo nunca hay píxeles ampliados (nitidez a cualquier zoom y devicePixelRatio).
//  - React no interviene: el estado del gesto vive en variables locales; solo se notifica onCommit (fin de gesto) para decisiones lentas.
//
// Marcos: el dispositivo (eventos del puntero) -> el lienzo (gira 90° con CSS en vista horizontal sobre pantalla vertical: uiRot) -> el svg
// (gira 90° dentro del lienzo en vista vertical: rot). Los deltas del puntero se convierten por ese camino, y el tamaño del contenedor
// se mide con clientWidth/clientHeight (dimensiones de layout, que no cambian con la rotación del ancestro).
// Fórmulas de zoom (z = píxeles CSS por unidad de tablero; W×H = 2970×2100):
//   z_min = max( Fu / (spanMax·W) , Fv / (1.15·H) )          Fu,Fv = ancho,alto de la pantalla en el marco del svg; spanMax = 0.60
//   z_max = max( min( min(Fu,Fv)/spanMin , 10/DPR ) , 3·z_min )   spanMin = 220 unidades; 10/DPR = tope por cuantización (0.1 u)
import { useEffect, useRef } from 'react';

const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

export function crearPanZoom({ contenedor, svg, ancho, alto, spanMaxPct = 0.6, spanMinU = 220, overscan = 0.25, onFrame, onCommit, onTap }) {
  let rot = 0, uiRot = 0, vw = 0, vh = 0, fw = 0, fh = 0, sw = 0, sh = 0, zmin = 0.2, zmax = 2;
  let v = { cx: ancho / 2, cy: alto / 2, z: 1 };
  let c = { ...v };
  let raf = 0, tCommit = 0, ultimoCommit = 0, anim = 0, inicial = true;
  const ptrs = new Map();
  let g = null;

  const dpr = () => window.devicePixelRatio || 1;
  const aLienzo = (dx, dy) => (uiRot ? [dy, -dx] : [dx, dy]);
  const aMarco = (dx, dy) => { const [a, b] = aLienzo(dx, dy); return rot ? [b, -a] : [a, b]; };

  function medir() {
    vw = contenedor.clientWidth; vh = contenedor.clientHeight;
    fw = rot ? vh : vw; fh = rot ? vw : vh;
    sw = fw * (1 + 2 * overscan); sh = fh * (1 + 2 * overscan);
    svg.style.width = sw + 'px'; svg.style.height = sh + 'px';
    svg.style.left = (vw - sw) / 2 + 'px'; svg.style.top = (vh - sh) / 2 + 'px';
    zmin = Math.max(fw / (spanMaxPct * ancho), fh / (1.15 * alto));
    zmax = Math.max(Math.min(Math.min(fw, fh) / spanMinU, 10 / dpr()), 3 * zmin);
  }
  function limitar() {
    v.z = clamp(v.z, zmin, zmax);
    const hw = fw / (2 * v.z), hh = fh / (2 * v.z);
    v.cx = 2 * hw >= ancho ? ancho / 2 : clamp(v.cx, hw - hw * 0.12, ancho - hw + hw * 0.12);
    v.cy = 2 * hh >= alto ? alto / 2 : clamp(v.cy, hh - hh * 0.12, alto - hh + hh * 0.12);
  }
  function aplicar() {
    raf = 0;
    const s = v.z / c.z, tx = (c.cx - v.cx) * v.z, ty = (c.cy - v.cy) * v.z;
    svg.style.transform = `rotate(${rot}deg) translate(${tx}px,${ty}px) scale(${s})`;
    onFrame && onFrame(v, { fw, fh, rot });
    const gastado = Math.abs(tx) > overscan * fw * 0.8 || Math.abs(ty) > overscan * fh * 0.8 || Math.abs(Math.log(s)) > 0.55;
    if (gastado && performance.now() - ultimoCommit > 160) confirmar();
  }
  function confirmar() {
    clearTimeout(tCommit);
    c = { ...v };
    const bw = sw / v.z, bh = sh / v.z;
    svg.setAttribute('viewBox', `${(v.cx - bw / 2).toFixed(2)} ${(v.cy - bh / 2).toFixed(2)} ${bw.toFixed(2)} ${bh.toFixed(2)}`);
    svg.style.transform = `rotate(${rot}deg)`;
    svg.style.setProperty('--inv', (1 / v.z).toFixed(5));
    svg.style.setProperty('--kpin', Math.max(1, 30 / (40 * v.z)).toFixed(4));
    svg.style.setProperty('--kfare', Math.max(1, 11 / (17 * v.z)).toFixed(4));
    svg.style.setProperty('--contra', `${-rot}deg`);
    svg.dataset.lod = v.z < 0.34 ? 'lejos' : v.z > 1.2 ? 'cerca' : 'medio';
    ultimoCommit = performance.now();
    onFrame && onFrame(v, { fw, fh, rot });
    onCommit && onCommit({ ...v }, { zmin, zmax, rot });
  }
  const pedir = () => { if (!raf) raf = requestAnimationFrame(aplicar); clearTimeout(tCommit); tCommit = setTimeout(confirmar, 140); };

  function zoomEn(f, ax, ay) {
    const z2 = clamp(v.z * f, zmin, zmax);
    const bx = v.cx + ax / v.z, by = v.cy + ay / v.z;
    v.cx = bx - ax / z2; v.cy = by - ay / z2; v.z = z2;
  }
  const relMarco = (x, y) => { const r = contenedor.getBoundingClientRect(); return aMarco(x - (r.left + r.width / 2), y - (r.top + r.height / 2)); };

  function bajar(ev) {
    cancelAnimationFrame(anim);
    contenedor.setPointerCapture?.(ev.pointerId);
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.size === 1) g = { x0: ev.clientX, y0: ev.clientY, mov: 0, t0: performance.now(), objetivo: ev.target };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; g.d = Math.hypot(a.x - b.x, a.y - b.y); g.mov = 99; }
  }
  function mover(ev) {
    const p = ptrs.get(ev.pointerId); if (!p || !g) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    if (ptrs.size === 1) {
      g.mov += Math.abs(dx) + Math.abs(dy);
      if (g.mov > 8) { const [du, dv] = aMarco(dx, dy); v.cx -= du / v.z; v.cy -= dv / v.z; limitar(); pedir(); }
      p.x = ev.clientX; p.y = ev.clientY;
    } else if (ptrs.size === 2) {
      const antes = [...ptrs.values()]; const m0 = { x: (antes[0].x + antes[1].x) / 2, y: (antes[0].y + antes[1].y) / 2 };
      p.x = ev.clientX; p.y = ev.clientY;
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const [mu, mv] = relMarco(m1.x, m1.y);
      if (g.d > 0 && d > 0) zoomEn(d / g.d, mu, mv);
      const [du, dv] = aMarco(m1.x - m0.x, m1.y - m0.y); v.cx -= du / v.z; v.cy -= dv / v.z;
      g.d = d; limitar(); pedir();
    }
  }
  function subir(ev) {
    const eraUno = ptrs.size === 1;
    ptrs.delete(ev.pointerId);
    if (eraUno && g && g.mov <= 8 && performance.now() - g.t0 < 500) onTap && onTap(g.objetivo, ev);
    if (ptrs.size === 0) g = null; else if (ptrs.size === 1) { g.mov = 99; g.d = 0; }
  }
  function rueda(ev) {
    ev.preventDefault();
    const [au, av] = relMarco(ev.clientX, ev.clientY);
    zoomEn(Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0016)), au, av); limitar(); pedir();
  }
  function doble(ev) { const [au, av] = relMarco(ev.clientX, ev.clientY); zoomEn(ev.shiftKey ? 1 / 1.8 : 1.8, au, av); limitar(); pedir(); }
  function tecla(ev) {
    const k = { '+': () => zoomEn(1.25, 0, 0), '=': () => zoomEn(1.25, 0, 0), '-': () => zoomEn(0.8, 0, 0), ArrowLeft: () => { v.cx -= 80 / v.z; }, ArrowRight: () => { v.cx += 80 / v.z; }, ArrowUp: () => { v.cy -= 80 / v.z; }, ArrowDown: () => { v.cy += 80 / v.z; } }[ev.key];
    if (k) { ev.preventDefault(); k(); limitar(); pedir(); }
  }

  contenedor.addEventListener('pointerdown', bajar);
  contenedor.addEventListener('pointermove', mover);
  contenedor.addEventListener('pointerup', subir);
  contenedor.addEventListener('pointercancel', subir);
  contenedor.addEventListener('wheel', rueda, { passive: false });
  contenedor.addEventListener('dblclick', doble);
  contenedor.addEventListener('keydown', tecla);
  const ro = new ResizeObserver(() => { medir(); if (inicial) return; limitar(); confirmar(); });
  ro.observe(contenedor);

  medir();
  const api = {
    get vista() { return { ...v }; },
    get limites() { return { zmin, zmax, fw, fh, rot, uiRot, dpr: dpr() }; },
    iniciar(cx = ancho / 2, cy = alto / 2, z = zmin * 1.5) { inicial = false; v = { cx, cy, z }; limitar(); confirmar(); },
    irA(x, y, z = v.z, dur = 320) {
      cancelAnimationFrame(anim);
      const a = { ...v }, t0 = performance.now(), zf = clamp(z, zmin, zmax);
      const paso = (t) => {
        const u = Math.min(1, (t - t0) / dur), e = u * u * (3 - 2 * u);
        v.cx = a.cx + (x - a.cx) * e; v.cy = a.cy + (y - a.cy) * e; v.z = Math.exp(Math.log(a.z) + (Math.log(zf) - Math.log(a.z)) * e); limitar(); aplicar();
        if (u < 1) anim = requestAnimationFrame(paso); else confirmar();
      };
      anim = requestAnimationFrame(paso);
    },
    zoom(f) { zoomEn(f, 0, 0); limitar(); pedir(); },
    setRot(r, u = uiRot) { rot = r; uiRot = u; medir(); limitar(); confirmar(); },
    destruir() {
      cancelAnimationFrame(raf); cancelAnimationFrame(anim); clearTimeout(tCommit); ro.disconnect();
      contenedor.removeEventListener('pointerdown', bajar); contenedor.removeEventListener('pointermove', mover);
      contenedor.removeEventListener('pointerup', subir); contenedor.removeEventListener('pointercancel', subir);
      contenedor.removeEventListener('wheel', rueda); contenedor.removeEventListener('dblclick', doble); contenedor.removeEventListener('keydown', tecla);
    },
  };
  return api;
}

export function usePanZoom(opciones) {
  const ref = useRef(null);
  useEffect(() => () => ref.current?.destruir(), []);
  return { ref, crear: (o) => { ref.current?.destruir(); ref.current = crearPanZoom({ ...opciones, ...o }); return ref.current; } };
}
