import React, { useLayoutEffect, useRef } from 'react';
import { pjDe } from '../game/data.js';
import { useSprite } from '../game/sprites.js';

// Peón pseudo-3D 100 % vectorial: sprite SVG (billboard con volumen pintado) + sombra elíptica + animación de paso.
// Se contra-escala con --inv (1/zoom) para mantener tamaño constante en pantalla y se contra-rota con --contra en vista vertical.
// Al cambiar de ciudad camina por la ruta dando saltitos, como en el demo: sigue el trazo del mapa y tarda según la distancia.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const suave = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const sinMovimiento = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Tramos de ruta entre dos ciudades (el camino con menos tramos); cada uno con su sentido.
function camino(tablero, desde, hasta) {
  const prev = { [desde]: null }, cola = [desde];
  while (cola.length) {
    const c = cola.shift(); if (c === hasta) break;
    for (const r of tablero.routes) {
      const o = r.a === c ? r.b : r.b === c ? r.a : null;
      if (o && !(o in prev)) { prev[o] = { r, de: c }; cola.push(o); }
    }
  }
  if (!(hasta in prev)) return [];
  const tramos = [];
  for (let c = hasta; prev[c]; c = prev[c].de) tramos.unshift({ r: prev[c].r, rev: prev[c].r.a !== prev[c].de });
  return tramos;
}
function trazos(tablero, desde, hasta) {
  return camino(tablero, desde, hasta).map(({ r, rev }) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', r.d);
    return { p, rev, largo: p.getTotalLength() };
  });
}

export default function Peon({ j, ciudad, i, n, turno, tablero, yo, onViaje }) {
  const href = useSprite('p' + j.pj);
  const c = tablero.cities[ciudad] || (ciudad === 'Jorasán' ? tablero.jorasan : null);
  const grupo = useRef(null), cuerpo = useRef(null), sombra = useRef(null), anterior = useRef(ciudad), raf = useRef(0);

  useLayoutEffect(() => {
    const de = anterior.current; anterior.current = ciudad;
    const g = grupo.current, a = tablero.cities[de] || (de === 'Jorasán' ? tablero.jorasan : null);
    if (!g || !c || de === ciudad || !a || sinMovimiento()) return undefined;
    const tramos = trazos(tablero, de, ciudad);
    const recta = Math.hypot(c.x - a.x, c.y - a.y);
    const total = tramos.length ? tramos.reduce((s, x) => s + x.largo, 0) : recta;
    const T = clamp(total / 560, 1.3, 3.6) * 1000, t0 = performance.now();
    g.style.transform = `translate(${a.x}px, ${a.y}px)`;                       // React ya la puso en el destino: vuelve al origen antes de pintar
    if (yo) onViaje?.(c, T);
    const punto = (d) => {
      if (!tramos.length) { const k = total ? d / total : 1; return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k }; }
      let k = 0, resto = d;
      while (k < tramos.length - 1 && resto > tramos[k].largo) { resto -= tramos[k].largo; k++; }
      return tramos[k].p.getPointAtLength(tramos[k].rev ? tramos[k].largo - resto : resto);
    };
    const paso = (now) => {
      const t = Math.min(1, (now - t0) / T), d = total * suave(t), q = t < 1 ? punto(d) : c;
      g.style.transform = `translate(${q.x}px, ${q.y}px)`;
      const fase = t < 1 ? (d / 90) * Math.PI : 0, h = Math.abs(Math.sin(fase)) * 9, e = Math.cos(2 * fase);
      cuerpo.current?.setAttribute('transform', t < 1 ? `translate(0 ${-h}) translate(0 3) scale(${1.005 + 0.045 * e} ${0.995 - 0.055 * e}) translate(0 -3)` : '');
      sombra.current?.setAttribute('rx', t < 1 ? 20 - h * 0.5 : 20);
      if (t < 1) raf.current = requestAnimationFrame(paso);
    };
    raf.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf.current);
  }, [ciudad]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return null;
  const dx = (i - (n - 1) / 2) * 30;
  const nombre = pjDe(j.pj)?.nombre || j.nombre;
  return (
    <g ref={grupo} className={`peon${turno ? ' turno' : ''}${yo ? ' yo' : ''}${j.npc ? ' npc' : ''}${j.transito ? ' camino' : ''}`} style={{ transform: `translate(${c.x}px, ${c.y}px)` }} data-pid={j.id}>
      <title>{`${j.nombre} (${nombre}) en ${ciudad}${j.transito ? ' (de camino)' : ''}`}</title>
      <g className="escala-peon" style={{ transform: `scale(var(--inv, 1)) rotate(var(--contra, 0deg)) translate(${dx}px, 4px)` }}>
        <ellipse ref={sombra} className="sombra-peon" cx="0" cy="2" rx="20" ry="6" />
        {turno && <ellipse className="aro-turno" cx="0" cy="2" rx="30" ry="10" />}
        <g ref={cuerpo}>
          <use href={href} x="-23" y="-74" width="46" height="77" />
        </g>
      </g>
    </g>
  );
}
