import React, { memo, useEffect, useRef, useState } from 'react';
import { DATA, tablero, pjDe } from '../game/data.js';
import { crearEscena } from '../escena3d/index.js';
import { ponerEscena, escenaActual, enCola, viajeDe, quietos, dadosDePelea, armaDePelea } from '../game/escena3d.js';
import { marcarIfrit, avisar } from '../game/store.js';
import { SONIDOS } from '../escena3d/banco/sonidos.js';
import { leerAjusteSonido, guardarAjusteSonido } from '../game/sonidos3d.js';
import '../styles/board.css';      // el marco del tablero y los botones de la esquina (girar, vista general, centrar, sonido) viven ahí
import '../styles/tablero3d.css';

// Tablero 3D: la misma mesa de siempre, dibujada por la capa 3D. Este componente no decide nada: mira el estado que manda el
// servidor y le pide a la escena la animación que le corresponde (viajes, peleas, cambio de ronda, ifrit, ciudades en llamas).
const COLORES_PJ = { 1: '#b3202a', 2: '#2a8a8a', 3: '#5a5fc0', 4: '#3d7a4a', 5: '#22407f', 6: '#8e2a5c', 7: '#d08a1e', B: '#1f2a5c' };
const DISTANCIA_INICIO = 16;   // la cámara empieza cerca de tu personaje, no en la vista de toda la mesa
const IFRIT_MAX_MS = 9000;   // si la animación no terminara, la carta del genio sale igual

function fichasDe(jugadores, e3d, turnoPid) {
  // Jorge (28 de noviembre, BUG5): el esposo de Zein (Ira del cornudo, la Giralda) sale en el tablero mientras duran los dados de su
  // pelea, en la ciudad de quien pelea con él; luego se va (con la cola de animaciones, para no cortar el choque).
  const P = e3d?.pelea, rival = P?.figura && P.activa && jugadores[P.def] ? [{ id: P.atk, nombre: P.nombre || 'NPC', personaje: P.figura, color: '#7a1e1e', ciudad: P.ciudad || jugadores[P.def].ciudad, arma: P.armaNPC || '', desde: P.desde || null, escudo: false, transporte: null, turno: false, esclavo: false, cargador: false, viajeN: 0, medio: null, laudN: 0, laudTexto: '', laudCallado: false, laudPieza: 1 }] : [];
  return Object.values(jugadores).filter((j) => j.pj && !j.eliminado && !j.sacado).map((j) => ({
    id: j.id, nombre: j.nombre, personaje: j.pj, color: COLORES_PJ[j.pj] || '#b3202a', ciudad: j.ciudad,
    arma: e3d?.jugadores?.[j.id]?.arma || '', escudo: !!e3d?.jugadores?.[j.id]?.escudo, transporte: e3d?.jugadores?.[j.id]?.transporte || null, turno: j.id === turnoPid,
    esclavo: !!e3d?.jugadores?.[j.id]?.esclavo,      // lo acompaña el monito del esclavo peleador (27 de noviembre)
    cargador: !!e3d?.jugadores?.[j.id]?.cargador,    // y el del esclavo cargador, con su cesta (no pelea)
    viajeN: e3d?.jugadores?.[j.id]?.viaje?.n || 0, medio: e3d?.jugadores?.[j.id]?.viaje?.medio || null,
    laudN: e3d?.jugadores?.[j.id]?.laud?.n || 0, laudTexto: e3d?.jugadores?.[j.id]?.laud?.texto || '', laudCallado: !!e3d?.jugadores?.[j.id]?.laud?.callado, laudPieza: e3d?.jugadores?.[j.id]?.laud?.pieza || 1,
  })).concat(rival);
}

export default memo(function Tablero3D({ jugadores, e3d, turnoPid, miId, quemadas, ciudadesAlcance, ciudadActiva, onCiudad, ronda, orden, pend, dados, misDinares }) {
  const cont = useRef(null);
  const [lista, setLista] = useState(false);
  const [progreso, setProgreso] = useState('Desplegando el mapa…');
  const [fallo, setFallo] = useState(null);
  const [tip, setTip] = useState(null);
  const [ajusteSonido, setAjusteSonido] = useState(leerAjusteSonido);   // { volumen: 0..1, silencio: bool }, se recuerda en este navegador
  const [panelSonido, setPanelSonido] = useState(false);
  const previo = useRef(null);            // fichas tal como las conoce la escena
  const alCiudad = useRef(onCiudad); alCiudad.current = onCiudad;
  const datos = useRef({ jugadores, e3d }); datos.current = { jugadores, e3d };

  // --- Crear y destruir la escena
  useEffect(() => {
    let vivo = true, esc = null, relojTip = 0, quitarGesto = () => {};
    crearEscena(cont.current, {
      tablero, ciudades: DATA.ciudades.ciudades, jorasan: DATA.ciudades.jorasan || tablero.jorasan, rutas: DATA.rutas.rutas, personajes: DATA.personajes.personajes,
      sonidos: SONIDOS,
      opciones: { hora: 'dia', volumen: ajusteSonido.volumen, silencio: ajusteSonido.silencio, alProgreso: (t) => { if (vivo) setProgreso(t); } },
    }).then((e) => {
      if (!e) return;
      if (!vivo) { e.destruir(); return; }
      esc = e; ponerEscena(e); window.__escena3d = e;
      e.alHacerClicCiudad = (id) => alCiudad.current?.(id);
      const nombreDe = (id) => { if (String(id).startsWith('npc:')) return datos.current.e3d?.pelea?.nombre || null; const j = datos.current.jugadores[id]; return j ? (j.npc ? j.nombre : `${j.nombre} — ${pjDe(j.pj)?.nombre || ''}`) : null; };
      e.alApuntar = (u) => { clearTimeout(relojTip); setTip(u?.tipo === 'ficha' ? nombreDe(u.id) : null); };
      e.alHacerClicFicha = (id) => { clearTimeout(relojTip); setTip(nombreDe(id)); relojTip = setTimeout(() => setTip(null), 2500); };
      // Jorge (23 de noviembre): MIENTRAS HAYA ANIMACIÓN DE PELEA no se ve ninguna ventana ni aviso; lo que venga sale al terminar (ui.css)
      e.alPelear = (v) => document.body.classList.toggle('viendo-pelea', !!v);
      // El navegador no deja sonar nada antes de un gesto: el primer clic o tecla en cualquier parte de la página (no solo en el mapa) lo habilita.
      const gesto = () => esc?.activarSonido();
      for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, gesto, { capture: true, passive: true });
      quitarGesto = () => { for (const ev of ['pointerdown', 'keydown']) document.removeEventListener(ev, gesto, { capture: true }); };
      setLista(true);
    }).catch((err) => { console.error(err); if (vivo) setFallo(String(err?.message || err)); });
    return () => { vivo = false; document.body.classList.remove('viendo-pelea'); clearTimeout(relojTip); quitarGesto(); if (esc) { if (escenaActual() === esc) ponerEscena(null); esc.destruir(); } previo.current = null; };
  }, []);

  // --- Fichas: altas, bajas, cambios y viajes
  useEffect(() => {
    const esc = escenaActual(); if (!lista || !esc) return;
    const ahora = fichasDe(jugadores, e3d, turnoPid);
    const antes = previo.current;
    previo.current = Object.fromEntries(ahora.map((f) => [f.id, f]));
    const limpio = ({ viajeN, medio, laudN, laudTexto, laudCallado, desde, ...f }) => f;
    if (!antes) { esc.ponerJugadores(ahora.map(limpio)).then(() => { if (previo.current?.[miId]) return esc.enfocar(miId, { duracion: 1.6, distancia: DISTANCIA_INICIO }); }).catch((err) => console.warn('[3D]', err)); return; }
    for (const id of Object.keys(antes)) {
      if (previo.current[id]) continue;
      if (id.startsWith('npc:')) { enCola((e) => e.quitarJugador(id)); continue; }   // el NPC de una pelea se va cuando termina su animación
      const murio = !!jugadores[id]?.eliminado;    // muerto (asesinado, ghul, duelo…); a quien saca el banco o se va, solo se le quita la ficha
      viajeDe(id, (e) => { if (murio) e.tocar('muerte'); return e.quitarJugador(id); });
    }
    for (const f of ahora) {
      const a = antes[f.id];
      // Rayhán (R68) sale de Bagdad y camina hasta la ciudad de su víctima; la pelea (y sus dados) esperan a que llegue.
      if (!a && f.desde && f.desde !== f.ciudad) { viajeDe(f.id, (e) => Promise.resolve(e.ponerJugador({ ...limpio(f), ciudad: f.desde })).then(() => (e.camino(f.desde, f.ciudad)?.length ? e.viajar(f.id, f.ciudad, { llevar: true, seguir: false }) : e.actualizarJugador(f.id, { ciudad: f.ciudad })))); continue; }
      if (!a) { viajeDe(f.id, (e) => e.ponerJugador(limpio(f))); continue; }   // ficha nueva (antes actualizarJugador, que solo cambia una que ya está)
      const cambios = {};
      for (const k of ['nombre', 'personaje', 'color', 'arma', 'escudo', 'transporte', 'esclavo', 'cargador', 'turno']) if (a[k] !== f[k]) cambios[k] = f[k];
      if (Object.keys(cambios).length) viajeDe(f.id, (e) => e.actualizarJugador(f.id, cambios));
      if (a.ciudad !== f.ciudad) {
        const medio = f.viajeN !== a.viajeN ? f.medio : null;                   // con su animal o su alfombra; si no, a pie (o en dhow por mar)
        viajeDe(f.id, (e) => (e.camino(a.ciudad, f.ciudad)?.length || medio === 'alfombra'
          ? (medio
            ? Promise.resolve(e.viajar(f.id, f.ciudad, { transporte: medio, seguir: f.id === miId })).then(() => e.actualizarJugador(f.id, { transporte: f.transporte }))   // al llegar: la alfombra se guarda y su animal, si tiene, queda con él
            : e.viajar(f.id, f.ciudad, { llevar: true, seguir: f.id === miId }))   // viaje normal: a pie, con su animal (si tiene) del cabestro
          : e.actualizarJugador(f.id, { ciudad: f.ciudad })));                   // sin camino dibujado: aparece allá
      }
      // Jamil toca el laúd (Jorge, 24 de noviembre): se lo pone al frente y toca, con música; el premio y su aviso salen al terminar
      // (el resto de la pantalla espera, igual que con un viaje: useTrasViajes).
      // Toca una de sus dos piezas (40 o 22 segundos; la elige el juego al azar: laudPieza), que es también lo que dura la votación «Que se calle Jamil»; solo si
      // la mayoría lo calla deja de tocar antes.
      if (f.laudN > a.laudN) viajeDe(f.id, (e) => {
        const p = previo.current?.[f.id], callado = f.laudCallado || (p?.laudN === f.laudN && p.laudCallado);      // por si lo callaron mientras esperaba su turno en la cola
        return Promise.resolve(e.tocarLaud(f.id, { seguir: f.id === miId, pieza: f.laudPieza, duracion: callado ? 1.5 : undefined })).catch((err) => console.warn('[3D]', err?.message || err)).then(() => { if (f.laudTexto) avisar(f.laudTexto); });
      });
      else if (f.laudCallado && !a.laudCallado && f.laudN === a.laudN) esc.callarLaud(f.id);
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

  // --- Pelea (Jorge, 23 de noviembre): con los primeros dados de la pelea (flecha incluida) los dos se plantan uno frente al otro; las
  // flechas salen desde ahí; el choque de armas va después de la última tirada (Dados.jsx) y luego sale el conteo. Solo animación.
  // Si el retado rechaza el duelo o huye, no hay dados de pelea y no se anima nada; si la pelea acaba sin choque, vuelven a su sitio.
  const peleaHecha = useRef(0);
  const P = e3d?.pelea || null;
  const dadoPelea = dados && ['pelea', 'categoria'].includes(dados.motivo) ? dados.id : 0;
  useEffect(() => {
    if (!lista) return;
    if (!dados && (!P || !P.viva)) enCola((e) => e.deshacerPelea?.());          // por si quedaron formados (no hace nada si ya pelearon)
    if (!P || P.n <= peleaHecha.current) return;
    if (!dadoPelea) { if (!P.viva && !dados) peleaHecha.current = P.n; return; }                  // terminó sin pelear
    if (!dadosDePelea(dados, P)) return;                                         // dados de otra pelea (BUG5): no se anima esta
    peleaHecha.current = P.n;
    const arma = (id) => armaDePelea(e3d, P, id), esclavo = (id) => e3d.jugadores?.[id]?.esclavoArma || '';      // el esclavo que pelea por su amo se planta junto a él
    enCola(async (e) => { await quietos(P.atk, P.def); return e.formarPelea(P.atk, P.def, { armaAtacante: arma(P.atk), armaDefensor: arma(P.def), esclavoAtacante: esclavo(P.atk), esclavoDefensor: esclavo(P.def) }); });
  }, [lista, P?.n, P?.viva, dadoPelea, dados?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (lista) escenaActual()?.ponerFichaPropia?.(miId); }, [lista, miId]);   // solo tu monito gira

  // --- Ifrit: el genio sale de la lámpara junto al jugador; su carta se presenta cuando ya está fuera, y al elegir se esconde
  const ifritDe = pend?.tipo === 'ifrit' ? pend.para?.[0] || null : null;
  useEffect(() => {
    if (!lista || !ifritDe) return undefined;
    let vivo = true;
    const listo = () => { if (vivo) marcarIfrit(true); };
    const reloj = setTimeout(listo, IFRIT_MAX_MS);
    enCola(async (e) => { await quietos(ifritDe); await e.aparecerIfrit(ifritDe); }).then(listo);
    return () => { vivo = false; clearTimeout(reloj); marcarIfrit(false); escenaActual()?.soltarIfrit?.(); enCola((e) => e.esconderIfrit()); };
  }, [lista, ifritDe]);

  // --- Sonido: volumen y silencio (se recuerdan en este navegador)
  useEffect(() => { const e = lista ? escenaActual() : null; if (!e) return; e.volumen(ajusteSonido.volumen); e.silenciar(ajusteSonido.silencio); guardarAjusteSonido(ajusteSonido); }, [lista, ajusteSonido]);
  // --- Monedas: suenan cuando tus dinares cambian de verdad (App pasa los dinares ya con el viaje terminado y la carta cerrada)
  const dinaresPrev = useRef(null);
  useEffect(() => {
    const antes = dinaresPrev.current; dinaresPrev.current = misDinares ?? null;
    if (!lista || antes == null || misDinares == null || misDinares === antes) return;
    escenaActual()?.tocar(misDinares > antes ? 'monedas' : 'monedas-pagar', Math.min(1, 0.5 + Math.abs(misDinares - antes) / 40));
  }, [lista, misDinares]);

  const esc = lista ? escenaActual() : null;
  const mudo = ajusteSonido.silencio || ajusteSonido.volumen === 0;
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
          <button className="ctl" onClick={() => setPanelSonido((v) => !v)} aria-expanded={panelSonido} aria-label="Sonido" title="Sonido">{mudo ? '🔇' : '🔊'}</button>
          {panelSonido && (
            <div className="panel-sonido" role="group" aria-label="Sonido">
              <label>Volumen <input type="range" min="0" max="100" step="5" value={Math.round(ajusteSonido.volumen * 100)} aria-label="Volumen"
                onChange={(ev) => setAjusteSonido({ volumen: +ev.target.value / 100, silencio: false })} /></label>
              <button className="btn mini" onClick={() => setAjusteSonido((a) => ({ ...a, silencio: !a.silencio }))}>{ajusteSonido.silencio ? 'Activar sonido' : 'Silenciar'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
