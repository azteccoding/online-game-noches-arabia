import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { tablero, pjDe } from '../game/data.js';
import { crearPanZoom } from '../hooks/usePanZoom.js';
import Peon from './Peon3D.jsx';
import '../styles/board.css';

const W = tablero.width, H = tablero.height;
let mapaPromesa = null;
// Los glifos del mapa (id g1, g2…) se renombran: los sprites de personajes, incrustados en la misma página, también usan g1…g7 y tapaban letras.
// Rótulos agregados después de generar el mapa (al regenerarlo con tools/build_board_svg.py ya vienen dentro).
const ROTULOS_NUEVOS = '<text x="1662" y="1716" text-anchor="middle" font-family="Marcellus SC, serif" font-size="34" letter-spacing="18" fill="#6a4520" opacity=".5">ABISINIA</text>';
const conRotulosNuevos = (t) => (t.includes('ABISINIA') ? t : t.replace(/<\/svg>\s*$/, ROTULOS_NUEVOS + '</svg>'));
const cargarMapa = () => (mapaPromesa ||= fetch('/svg/tablero-mapa.svg').then((r) => r.text()).then((t) => conRotulosNuevos(t).replace(/id="g(\d+)"/g, 'id="mapa-g$1"').replace(/href="#g(\d+)"/g, 'href="#mapa-g$1"').replace('<svg ', `<svg x="0" y="0" width="${W}" height="${H}" `)));


// Camino más corto (en tramos) entre dos ciudades por las rutas del tablero; devuelve las claves «a|b» de sus tramos.
function caminoRutas(desde, hasta) {
  if (!desde || !hasta || desde === hasta) return null;
  const prev = { [desde]: null }, cola = [desde];
  while (cola.length) {
    const c = cola.shift(); if (c === hasta) break;
    for (const r of tablero.routes) {
      const o = r.a === c ? r.b : r.b === c ? r.a : null;
      if (o && !(o in prev)) { prev[o] = r; cola.push(o); }
    }
  }
  if (!(hasta in prev)) return null;
  const tramos = new Set();
  for (let c = hasta; prev[c]; c = prev[c].a === c ? prev[c].b : prev[c].a) tramos.add(prev[c].a + '|' + prev[c].b);
  return tramos;
}

const Rutas = memo(function Rutas({ vivas, animadas }) {
  return (
    <g className="rutas">
      {tablero.routes.map((r) => {
        const viva = vivas && (vivas.has(r.a + '>' + r.b) || vivas.has(r.b + '>' + r.a));
        return (
          <g key={r.a + r.b} className={`ruta ${r.mode}${viva ? ' viva' : ''}${animadas?.has(r.a + '|' + r.b) ? ' animada' : ''}`}>
            <path className="ruta-base" d={r.d} />
            <path className="ruta-linea" d={r.d} />
          </g>
        );
      })}
      {/* Jorge (11 de noviembre): sin los círculos con la tarifa encima de las rutas; la tarifa real se ve en la ficha de la ciudad y al viajar */}
    </g>
  );
});

const Pin = ({ id, c, resaltada, activa }) => (
  <g className={`ciudad${resaltada ? ' alcance' : ''}${activa ? ' activa' : ''}`} data-ciudad={id} transform={`translate(${c.x},${c.y})`} role="button" aria-label={`Ciudad ${id}`}>
    <g className="escala-pin">
      <circle className="hit" r="38" cy="-24" />
      <path className="pin" d="M0,0 L-16,-30 A19,19 0 1 1 16,-30Z" />
      <circle className="pin-ojo" cx="0" cy="-34" r="6" />
    </g>
  </g>
);

function agruparPeones(jugadores, turnoPid) {
  const porCiudad = {};
  Object.values(jugadores).filter((j) => j.pj && !j.eliminado && !j.sacado).forEach((j) => (porCiudad[j.ciudad] ||= []).push(j));
  return Object.entries(porCiudad).flatMap(([ciudad, lista]) => lista.map((j, i) => ({ j, ciudad, i, n: lista.length, turno: j.id === turnoPid })));
}

export default memo(function Tablero({ jugadores, turnoPid, miId, vivas, ciudadesAlcance, ciudadActiva, onCiudad, rot = 0, uiRot = 0 }) {
  window.__rendersTablero = (window.__rendersTablero || 0) + 1;
  const cont = useRef(null), svgRef = useRef(null), baseRef = useRef(null), rectMini = useRef(null), pz = useRef(null);
  const [cargado, setCargado] = useState(false);
  const infoRef = useRef(null);
  // Tooltip de los monitos (Jorge, 7 de noviembre): «Jugador — Personaje» al pasar el cursor; en teléfono, al tocarlo (2.5 s).
  // Los peones no reciben eventos (para no tapar las ciudades), así que se busca cuál está bajo el puntero por su recuadro.
  const [tip, setTip] = useState(null), tipTimer = useRef(null);
  const peonEn = (x, y) => {
    const gs = [...(svgRef.current?.querySelectorAll('.peones .peon') || [])].reverse();
    return gs.find((g) => { const r = g.querySelector('use')?.getBoundingClientRect(); return r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }) || null;
  };
  const mostrarTip = (g, x, y) => { const r = cont.current.getBoundingClientRect(); setTip({ texto: g.dataset.tip, x: x - r.left, y: y - r.top }); };
  const alMover = (ev) => {
    if (ev.pointerType !== 'mouse' || ev.buttons) return;
    const g = peonEn(ev.clientX, ev.clientY);
    if (g) mostrarTip(g, ev.clientX, ev.clientY); else if (tip) setTip(null);
  };
  const alSoltar = (ev) => {
    if (ev.pointerType === 'mouse') return;
    const g = peonEn(ev.clientX, ev.clientY); if (!g) return;
    mostrarTip(g, ev.clientX, ev.clientY); clearTimeout(tipTimer.current); tipTimer.current = setTimeout(() => setTip(null), 2500);
  };
  useEffect(() => () => clearTimeout(tipTimer.current), []);
  const peones = useMemo(() => agruparPeones(jugadores, turnoPid), [jugadores, turnoPid]);
  const miCiudad = jugadores?.[miId]?.ciudad;
  const animadas = useMemo(() => caminoRutas(miCiudad, ciudadActiva), [miCiudad, ciudadActiva]);   // ruta hacia la ciudad elegida, en movimiento
  const ciudadMia = jugadores[miId]?.ciudad;

  useEffect(() => {
    let vivo = true;
    cargarMapa().then((t) => { if (vivo && baseRef.current) { baseRef.current.innerHTML = t; setCargado(true); } });
    return () => { vivo = false; };
  }, []);

  useLayoutEffect(() => {
    if (!cargado) return undefined;
    const ctl = crearPanZoom({
      contenedor: cont.current, svg: svgRef.current, ancho: W, alto: H, overscan: tablero.zoom.overscan, spanMaxPct: tablero.zoom.spanMaxPct, spanMinU: tablero.zoom.spanMinUnidades,
      onFrame: (v, m) => {
        const r = rectMini.current;
        if (r) { const bw = m.fw / v.z, bh = m.fh / v.z; r.setAttribute('x', v.cx - bw / 2); r.setAttribute('y', v.cy - bh / 2); r.setAttribute('width', bw); r.setAttribute('height', bh); }
      },
      onCommit: (v, lim) => { const d = infoRef.current?.dataset; if (d) { d.z = v.z.toFixed(3); d.zmin = lim.zmin.toFixed(3); d.zmax = lim.zmax.toFixed(3); d.rot = lim.rot; d.ui = lim.uiRot; } },
      onTap: (obj) => { const el = obj?.closest?.('[data-ciudad]'); if (el) onCiudad?.(el.dataset.ciudad); },
    });
    pz.current = ctl; window.__tablero = ctl;
    ctl.setRot(rot, uiRot);
    const c0 = tablero.cities[ciudadMia] || tablero.cities.Bagdad;
    ctl.iniciar(c0.x, c0.y, ctl.limites.zmin * 1.7);
    return () => ctl.destruir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado]);

  useEffect(() => { pz.current?.setRot(rot, uiRot); }, [rot, uiRot]);
  const centrar = useCallback(() => { const c = tablero.cities[ciudadMia] || tablero.cities.Bagdad; pz.current?.irA(c.x, c.y, Math.max(pz.current.limites.zmin * 2.4, 0.5)); }, [ciudadMia]);
  const alViajar = useCallback((c, ms) => { pz.current?.irA(c.x, c.y, pz.current.vista.z, ms); }, []);   // la cámara acompaña a tu personaje, como en el demo
  const irMini = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    pz.current?.irA(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H, pz.current.vista.z);
  };

  return (
    <div className="tablero" ref={cont} tabIndex={0} role="application" aria-label="Tablero. Arrastra para mover, pellizca o usa la rueda para acercar." onPointerMove={alMover} onPointerUp={alSoltar} onPointerLeave={() => setTip(null)}>
      {tip && <div className="tip-peon" role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.texto}</div>}
      <div className="tablero-cargando" hidden={cargado}>Desplegando el mapa…</div>
      <svg ref={svgRef} className="tablero-svg" xmlns="http://www.w3.org/2000/svg" data-lod="medio" aria-hidden="true">
        <defs>
          <linearGradient id="pinRelleno" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9c2a31" /><stop offset="1" stopColor="#5c151a" /></linearGradient>
          <linearGradient id="pinBorde" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e3b873" /><stop offset="1" stopColor="#8f5a1b" /></linearGradient>
          <radialGradient id="aroTurno"><stop offset="0" stopColor="#efd08f" stopOpacity=".95" /><stop offset="1" stopColor="#efd08f" stopOpacity="0" /></radialGradient>
        </defs>
        <g ref={baseRef} className="base-mapa" />
        <Rutas vivas={vivas} animadas={animadas} />
        <g className="ciudades">
          {Object.entries(tablero.cities).map(([id, c]) => <Pin key={id} id={id} c={c} resaltada={ciudadesAlcance?.has(id)} activa={id === ciudadActiva} />)}
          <g className="ciudad jorasan" transform={`translate(${tablero.jorasan.x},${tablero.jorasan.y})`}><g className="escala-pin"><polygon points="0,-30 9,-12 29,-9 14,5 18,26 0,16 -18,26 -14,5 -29,-9 -9,-12" /><circle r="6" /></g></g>
        </g>
        <g className="peones">{peones.map((p) => <Peon key={p.j.id} {...p} tablero={tablero} yo={p.j.id === miId} onViaje={alViajar} />)}</g>
      </svg>

      <div className="tablero-controles">
        <button className="ctl" onClick={() => pz.current?.zoom(1.4)} aria-label="Acercar">+</button>
        <button className="ctl" onClick={() => pz.current?.zoom(1 / 1.4)} aria-label="Alejar">−</button>
        <button className="ctl" onClick={centrar} aria-label="Centrar en mi personaje" title="Centrar en mi personaje">◎</button>
      </div>
      <div className="minimapa" onPointerDown={irMini} aria-label="Minimapa: toca para ir a ese lugar" role="img">
        <img src="/svg/tablero-mini.svg" alt="" draggable="false" />
        <svg viewBox={`0 0 ${W} ${H}`}>
          <rect ref={rectMini} className="mini-vista" />
          {peones.map((p) => { const c = tablero.cities[p.ciudad] || tablero.jorasan; return <circle key={p.j.id} cx={c.x + (p.i - (p.n - 1) / 2) * 40} cy={c.y} r="26" className={p.j.id === miId ? 'yo' : ''} />; })}
        </svg>
      </div>
      <div className="solo-lectores" ref={infoRef} id="zoom-info" />
    </div>
  );
});
