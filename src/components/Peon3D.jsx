import React from 'react';
import { pjDe } from '../game/data.js';

// Peón pseudo-3D 100 % vectorial: sprite SVG (billboard con volumen pintado) + sombra elíptica + animación de paso.
// Se contra-escala con --inv (1/zoom) para mantener tamaño constante en pantalla y se contra-rota con --contra en vista vertical.
export default function Peon({ j, ciudad, i, n, turno, tablero, yo }) {
  const c = tablero.cities[ciudad] || (ciudad === 'Jorasán' ? tablero.jorasan : null);
  if (!c) return null;
  const dx = (i - (n - 1) / 2) * 30;
  const nombre = pjDe(j.pj)?.nombre || j.nombre;
  return (
    <g className={`peon${turno ? ' turno' : ''}${yo ? ' yo' : ''}${j.npc ? ' npc' : ''}${j.transito ? ' camino' : ''}`} style={{ transform: `translate(${c.x}px, ${c.y}px)` }} data-pid={j.id}>
      <title>{`${j.nombre} (${nombre}) en ${ciudad}${j.transito ? ' (de camino)' : ''}`}</title>
      <g className="escala-peon" style={{ transform: `scale(var(--inv, 1)) rotate(var(--contra, 0deg)) translate(${dx}px, 4px)` }}>
        <ellipse className="sombra-peon" cx="0" cy="2" rx="20" ry="6" />
        {turno && <ellipse className="aro-turno" cx="0" cy="2" rx="30" ry="10" />}
        <g key={ciudad} className="camina">
          <use href={`/svg/sprites.svg#p${j.pj}`} x="-23" y="-74" width="46" height="77" />
        </g>
      </g>
    </g>
  );
}
