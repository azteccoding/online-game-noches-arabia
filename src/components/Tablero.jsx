import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { tablero, pjDe } from '../game/data.js';
import { crearPanZoom } from '../hooks/usePanZoom.js';
import Peon from './Peon3D.jsx';
import '../styles/board.css';

const W = tablero.width, H = tablero.height;
let mapaPromesa = null;
const cargarMapa = () => (mapaPromesa ||= fetch('/svg/tablero-mapa.svg').then((r) => r.text()).then((t) => t.replace('<svg ', `<svg x="0" y="0" width="${W}" height="${H}" `)));

const Digitos = ({ g }) => g.map(([d, x], i) => <path key={i} d={tablero.glifos[d]} transform={`translate(${x},0)`} />);

const Rutas = memo(function Rutas({ vivas }) {
  return (
    <g className="rutas">
      {tablero.routes.map((r) => {
        const viva = vivas && (vivas.has(r.a + '>' + r.b) || vivas.has(r.b + '>' + r.a));
        return (
          <g key={r.a + r.b} className={`ruta ${r.mode}${viva ? ' viva' : ''}`}>
            <path className="ruta-base" d={r.d} />
            <path className="ruta-linea" d={r.d} />
          </g>
        );
      })}
      {tablero.routes.map((r) => Object.entries(r.fares).map(([k, f]) => (
        <g key={r.a + r.b + k} className={`tarifa${vivas && vivas.has(k) ? ' viva' : ''}`} transform={`translate(${f.x},${f.y})`}>
          <g className="escala-fare"><circle r="17" /><g className="num"><Digitos g={f.g} /></g></g>
        </g>
      )))}
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
  Object.values(jugadores).filter((j) => j.pj && !j.eliminado).forEach((j) => (porCiudad[j.ciudad] ||= []).push(j));
  return Object.entries(porCiudad).flatMap(([ciudad, lista]) => lista.map((j, i) => ({ j, ciudad, i, n: lista.length, turno: j.id === turnoPid })));
}

export default memo(function Tablero({ jugadores, turnoPid, miId, vivas, ciudadesAlcance, ciudadActiva, onCiudad, rot = 0, uiRot = 0 }) {
  window.__rendersTablero = (window.__rendersTablero || 0) + 1;
  const cont = useRef(null), svgRef = useRef(null), baseRef = useRef(null), rectMini = useRef(null), pz = useRef(null);
  const [cargado, setCargado] = useState(false);
  const infoRef = useRef(null);
  const peones = useMemo(() => agruparPeones(jugadores, turnoPid), [jugadores, turnoPid]);
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
  const irMini = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    pz.current?.irA(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H, pz.current.vista.z);
  };

  return (
    <div className="tablero" ref={cont} tabIndex={0} role="application" aria-label="Tablero. Arrastra para mover, pellizca o usa la rueda para acercar.">
      <div className="tablero-cargando" hidden={cargado}>Desplegando el mapa…</div>
      <svg ref={svgRef} className="tablero-svg" xmlns="http://www.w3.org/2000/svg" data-lod="medio" aria-hidden="true">
        <defs>
          <linearGradient id="pinRelleno" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9c2a31" /><stop offset="1" stopColor="#5c151a" /></linearGradient>
          <linearGradient id="pinBorde" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e3b873" /><stop offset="1" stopColor="#8f5a1b" /></linearGradient>
          <radialGradient id="aroTurno"><stop offset="0" stopColor="#efd08f" stopOpacity=".95" /><stop offset="1" stopColor="#efd08f" stopOpacity="0" /></radialGradient>
        </defs>
        <g ref={baseRef} className="base-mapa" />
        <Rutas vivas={vivas} />
        <g className="ciudades">
          {Object.entries(tablero.cities).map(([id, c]) => <Pin key={id} id={id} c={c} resaltada={ciudadesAlcance?.has(id)} activa={id === ciudadActiva} />)}
          <g className="ciudad jorasan" transform={`translate(${tablero.jorasan.x},${tablero.jorasan.y})`}><g className="escala-pin"><polygon points="0,-30 9,-12 29,-9 14,5 18,26 0,16 -18,26 -14,5 -29,-9 -9,-12" /><circle r="6" /></g></g>
        </g>
        <g className="peones">{peones.map((p) => <Peon key={p.j.id} {...p} tablero={tablero} yo={p.j.id === miId} />)}</g>
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
