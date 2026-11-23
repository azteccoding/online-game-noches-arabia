import React, { memo, useEffect, useRef, useState } from 'react';
import { DATA, tablero, pjDe } from '../game/data.js';
import { crearEscena } from '../escena3d/index.js';
import { ponerEscena, escenaActual, enCola, viajeDe, quietos } from '../game/escena3d.js';
import { marcarIfrit } from '../game/store.js';
import '../styles/tablero3d.css';

// Tablero 3D: la misma mesa de siempre, dibujada por la capa 3D. Este componente no decide nada: mira el estado que manda el
// servidor y le pide a la escena la animación que le corresponde (viajes, peleas, cambio de ronda, ifrit, ciudades en llamas).
const COLORES_PJ = { 1: '#b3202a', 2: '#2a8a8a', 3: '#5a5fc0', 4: '#3d7a4a', 5: '#22407f', 6: '#8e2a5c', 7: '#d08a1e', B: '#1f2a5c' };
const DISTANCIA_INICIO = 16;   // la cámara empieza cerca de tu personaje, no en la vista de toda la mesa
const IFRIT_MAX_MS = 9000;   // si la animación no terminara, la carta del genio sale igual

function fichasDe(jugadores, e3d, turnoPid) {
  return Object.values(jugadores).filter((j) => j.pj && !j.eliminado && !j.sacado).map((j) => ({
    id: j.id, nombre: j.nombre, personaje: j.pj, color: COLORES_PJ[j.pj] || '#b3202a', ciudad: j.ciudad,
    arma: e3d?.jugadores?.[j.id]?.arma || '', escudo: !!e3d?.jugadores?.[j.id]?.escudo, transporte: e3d?.jugadores?.[j.id]?.transporte || null, turno: j.id === turnoPid,
    viajeN: e3d?.jugadores?.[j.id]?.viaje?.n || 0, medio: e3d?.jugadores?.[j.id]?.viaje?.medio || null,
  }));
}

export default memo(function Tablero3D({ jugadores, e3d, turnoPid, miId, quemadas, ciudadesAlcance, ciudadActiva, onCiudad, ronda, orden, pend, dados }) {
  const cont = useRef(null);
  const [lista, setLista] = useState(false);
  const [progreso, setProgreso] = useState('Desplegando el mapa…');
  const [fallo, setFallo] = useState(null);
  const [tip, setTip] = useState(null);
  const previo = useRef(null);            // fichas tal como las conoce la escena
  const alCiudad = useRef(onCiudad); alCiudad.current = onCiudad;
  const datos = useRef({ jugadores }); datos.current = { jugadores };

  // --- Crear y destruir la escena
  useEffect(() => {
    let vivo = true, esc = null, relojTip = 0;
    crearEscena(cont.current, {
      tablero, ciudades: DATA.ciudades.ciudades, jorasan: DATA.ciudades.jorasan || tablero.jorasan, rutas: DATA.rutas.rutas, personajes: DATA.personajes.personajes,
      opciones: { hora: 'dia', alProgreso: (t) => { if (vivo) setProgreso(t); } },
    }).then((e) => {
      if (!e) return;
      if (!vivo) { e.destruir(); return; }
      esc = e; ponerEscena(e); window.__escena3d = e;
      e.alHacerClicCiudad = (id) => alCiudad.current?.(id);
      const nombreDe = (id) => { const j = datos.current.jugadores[id]; return j ? (j.npc ? j.nombre : `${j.nombre} — ${pjDe(j.pj)?.nombre || ''}`) : null; };
      e.alApuntar = (u) => { clearTimeout(relojTip); setTip(u?.tipo === 'ficha' ? nombreDe(u.id) : null); };
      e.alHacerClicFicha = (id) => { clearTimeout(relojTip); setTip(nombreDe(id)); relojTip = setTimeout(() => setTip(null), 2500); };
      setLista(true);
    }).catch((err) => { console.error(err); if (vivo) setFallo(String(err?.message || err)); });
    return () => { vivo = false; clearTimeout(relojTip); if (esc) { if (escenaActual() === esc) ponerEscena(null); esc.destruir(); } previo.current = null; };
  }, []);

  // --- Fichas: altas, bajas, cambios y viajes
  useEffect(() => {
    const esc = escenaActual(); if (!lista || !esc) return;
    const ahora = fichasDe(jugadores, e3d, turnoPid);
    const antes = previo.current;
    previo.current = Object.fromEntries(ahora.map((f) => [f.id, f]));
    const limpio = ({ viajeN, medio, ...f }) => f;
    if (!antes) { esc.ponerJugadores(ahora.map(limpio)).then(() => { if (previo.current?.[miId]) return esc.enfocar(miId, { duracion: 1.6, distancia: DISTANCIA_INICIO }); }).catch((err) => console.warn('[3D]', err)); return; }
    for (const id of Object.keys(antes)) if (!previo.current[id]) viajeDe(id, (e) => e.quitarJugador(id));
    for (const f of ahora) {
      const a = antes[f.id];
      if (!a) { viajeDe(f.id, (e) => e.actualizarJugador(f.id, limpio(f))); continue; }
      const cambios = {};
      for (const k of ['nombre', 'personaje', 'color', 'arma', 'escudo', 'transporte', 'turno']) if (a[k] !== f[k]) cambios[k] = f[k];
      if (Object.keys(cambios).length) viajeDe(f.id, (e) => e.actualizarJugador(f.id, cambios));
      if (a.ciudad !== f.ciudad) {
        const medio = f.viajeN !== a.viajeN ? f.medio : null;                   // con su animal o su alfombra; si no, a pie (o en dhow por mar)
        viajeDe(f.id, (e) => (e.camino(a.ciudad, f.ciudad)?.length || medio === 'alfombra'
          ? (medio
            ? Promise.resolve(e.viajar(f.id, f.ciudad, { transporte: medio, seguir: f.id === miId })).then(() => e.actualizarJugador(f.id, { transporte: f.transporte }))   // al llegar: la alfombra se guarda y su animal, si tiene, queda con él
            : e.viajar(f.id, f.ciudad, { llevar: true, seguir: f.id === miId }))   // viaje normal: a pie, con su animal (si tiene) del cabestro
          : e.actualizarJugador(f.id, { ciudad: f.ciudad })));                   // sin camino dibujado: aparece allá
      }
    }
  }, [lista, jugadores, e3d, turnoPid, miId]);

  // --- Ciudades tomadas por los cruzados, y ciudades a las que puedes viajar
  const huellaQuemadas = (quemadas || []).join('|');
  useEffect(() => { if (lista) escenaActual()?.ponerCiudadesQuemadas(quemadas || []); }, [lista, huellaQuemadas]);   // eslint-disable-line react-hooks/exhaustive-deps
  const miCiudad = jugadores[miId]?.ciudad;
  const huellaAlcance = ciudadesAlcance ? [...ciudadesAlcance].sort().join('|') : '';
  useEffect(() => { if (lista) escenaActual()?.resaltarCiudades(ciudadesAlcance ? [...ciudadesAlcance] : [], { desde: miCiudad }); }, [lista, huellaAlcance, miCiudad]);   // eslint-disable-line react-hooks/exhaustive-deps
  void ciudadActiva;

  // --- Luz por turnos (Jorge, 23 de noviembre): el día dura la ronda entera y se reparte entre los jugadores según su lugar en el orden.
  // Va antes del cambio de ronda para que la primera «Ronda 1» ya sepa que la luz es por turnos.
  const enOrden = (orden || []).filter((id) => jugadores[id] && !jugadores[id].eliminado && !jugadores[id].sacado), lugar = enOrden.indexOf(turnoPid);
  useEffect(() => { if (lista && lugar >= 0) escenaActual()?.ponerLuzTurno?.(lugar, enOrden.length); }, [lista, lugar, enOrden.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  // --- Cambio de ronda: termina de anochecer, sale el rótulo de la ronda nueva y el amanecer llega en el turno del primero
  const rondaPrev = useRef(null);
  useEffect(() => {
    if (!lista || ronda == null) return;
    const antes = rondaPrev.current; rondaPrev.current = ronda;
    if (antes == null) { if (ronda <= 1) enCola((e) => e.amanecer?.()); return; }
    if (ronda > antes) enCola((e) => e.transicionRonda(ronda));
  }, [lista, ronda]);

  // --- Pelea: los dos se encaran y cruzan armas justo antes de los primeros dados de la pelea (solo animación; los dados deciden).
  // Si el retado rechaza el duelo o huye, no hay dados de pelea y no se anima nada.
  const peleaHecha = useRef(0);
  const P = e3d?.pelea || null;
  const dadoPelea = dados && ['pelea', 'categoria'].includes(dados.motivo) && !dados.boton ? dados.id : 0;   // la flecha y el escudo (con botón propio) van antes del choque
  useEffect(() => {
    if (!lista || !P || P.n <= peleaHecha.current) return;
    if (!dadoPelea) { if (!P.viva && !dados) peleaHecha.current = P.n; return; }                  // terminó sin pelear
    if (dados.por !== P.atk && dados.por !== P.def) return;
    peleaHecha.current = P.n;
    const arma = (id) => e3d.jugadores?.[id]?.armaPelea || '';
    enCola(async (e) => { await quietos(P.atk, P.def); return e.pelear(P.atk, P.def, { armaAtacante: arma(P.atk), armaDefensor: arma(P.def) }); });
  }, [lista, P?.n, P?.viva, dadoPelea, dados?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  // --- Ifrit: el genio sale de la lámpara junto al jugador; su carta se presenta cuando ya está fuera, y al elegir se esconde
  const ifritDe = pend?.tipo === 'ifrit' ? pend.para?.[0] || null : null;
  useEffect(() => {
    if (!lista || !ifritDe) return undefined;
    let vivo = true;
    const listo = () => { if (vivo) marcarIfrit(true); };
    const reloj = setTimeout(listo, IFRIT_MAX_MS);
    enCola(async (e) => { await quietos(ifritDe); await e.aparecerIfrit(ifritDe); }).then(listo);
    return () => { vivo = false; clearTimeout(reloj); marcarIfrit(false); enCola((e) => e.esconderIfrit()); };
  }, [lista, ifritDe]);

  const esc = lista ? escenaActual() : null;
  return (
    <div className="tablero tablero3d" role="application" aria-label="Tablero en 3D. Arrastra para mover, botón derecho o dos dedos para girar, rueda o pellizco para acercar.">
      <div className="tablero3d-lienzo" ref={cont} />
      {!lista && !fallo && <div className="tablero-cargando">{progreso}</div>}
      {fallo && <div className="tablero-cargando">No se pudo abrir el tablero 3D en este aparato: {fallo}</div>}
      {tip && <div className="tip-peon tip3d" role="tooltip">{tip}</div>}
      {esc && (
        <div className="tablero-controles">
          <button className="ctl" onClick={() => esc.girar(-1)} aria-label="Girar a la izquierda" title="Girar a la izquierda">⟲</button>
          <button className="ctl" onClick={() => esc.girar(1)} aria-label="Girar a la derecha" title="Girar a la derecha">⟳</button>
          <button className="ctl" onClick={() => esc.vistaGeneral()} aria-label="Vista general" title="Vista general">▣</button>
          <button className="ctl" onClick={() => { if (datos.current.jugadores[miId]?.pj) esc.enfocar(miId).catch(() => {}); }} aria-label="Centrar en mi personaje" title="Centrar en mi personaje">◎</button>
        </div>
      )}
    </div>
  );
});
