import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Carta from './Carta.jsx';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';
import { nombreCorto } from '../game/data.js';
import '../styles/ui.css';

export const MIN_LECTURA_MS = (import.meta.env.VITE_DEMO === '1' && Number(new URLSearchParams(location.search).get('minLectura'))) || 5000;
const PASO_MS = 1000;            // la ficha tarda .95 s en llegar a la ciudad (.peon en board.css): la carta espera a que termine
const GIRO_MS = 600;             // el dorso se ve y gira; luego entra el anverso (animaciones .carta-dorso / .modal-carta.gira)
const DORSOS = { evento: 'eventos', historico: 'historicos', mensaje: 'mensajes', objeto: 'objetos', item: 'objetos', especial: 'objetos', trivia: 'trivia', mesa: 'cc', cuento: 'crp', personaje: 'personajes', reto: 'retos', ifrit: 'ifrit' };
const sinMovimiento = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Ciclo de vida de una carta (ver plan «Cartas bajo demanda»):
//   1. llega a estado.historial (DATOS) -> entra en la cola de lectura
//   2. espera a que la ficha termine de moverse, muestra el dorso y gira; luego se MONTA un único <Carta completa>;
//      barra descendente de 5 s; el botón Cerrar espera a que acabe (los cuentos de ambiente se cierran al instante)
//   3. al cerrar se DESMONTA (se libera el DOM y las imágenes) y solo permanece el dato en el historial
// «Última carta» e historial vuelven a dibujar la carta desde esos datos (modo consulta, sin temporizador).
export default function ModalCarta({ s, consulta, onCerrarConsulta }) {
  const vistos = useRef(null);
  const botonCerrar = useRef(null), puedeCerrarRef = useRef(false);
  const [cola, setCola] = useState([]);
  const [abierto, setAbierto] = useState(0);
  const [resta, setResta] = useState(0);
  const [fase, setFase] = useState('frente');      // espera | dorso | frente
  const veniaVacia = useRef(true);

  useEffect(() => {
    // Al montar (inicio de partida o recarga) solo se dan por leídas las cartas antiguas; la del arranque (evento de la ronda 1) sí se muestra.
    if (!vistos.current) vistos.current = new Set(s.historial.filter((h) => s.ahora - h.t > 15000).map((h) => h.nro));
    const nuevos = s.historial.filter((h) => !vistos.current.has(h.nro) && (!h.para || h.para.includes(s.yo)));
    if (nuevos.length) { nuevos.forEach((h) => vistos.current.add(h.nro)); setCola((c) => [...c, ...nuevos.map((h) => h.nro)]); }
  }, [s.historial, s.yo]);

  // Avisa al servidor hasta qué carta cerró este jugador (Yafar NPC espera a que todos cierren sus cartas).
  const avisado = useRef(0);
  useEffect(() => {
    if (cola.length || !vistos.current) return;
    const max = Math.max(0, ...vistos.current);
    if (max > avisado.current) { avisado.current = max; enviar({ t: 'leido', nro: max }); }
  }, [cola.length, s.historial]);

  const consultaObj = consulta && typeof consulta === 'object' ? consulta : null;
  // Una carta nueva espera a que se cierren los dados en pantalla (p. ej. el Botín tras ganar una pelea no tapa el resultado).
  // Prioridad de ventanas: primero lo que hay que responder (tu decisión, tu voto) y los dados; las cartas nuevas esperan detrás.
  const debesResponder = (s.pend?.mia && !s.pend.respondiste) || (s.votoReinicio?.votas && s.votoReinicio.miVoto == null);
  const tapaDados = consulta == null && cola.length > 0 && (!!s.dados || !!debesResponder);
  const nroActual = consultaObj ? consultaObj.nro : tapaDados ? null : (consulta ?? cola[0] ?? null);
  const modoLectura = consulta == null && cola.length > 0 && !tapaDados;
  const carta = useMemo(() => consultaObj || (nroActual != null ? s.historial.find((h) => h.nro === nroActual) : null), [nroActual, s.historial, consultaObj]);

  useLayoutEffect(() => {
    if (!modoLectura) { veniaVacia.current = true; setFase('frente'); return undefined; }
    if (sinMovimiento()) { veniaVacia.current = false; setFase('frente'); return undefined; }
    const espera = veniaVacia.current ? PASO_MS : 0; veniaVacia.current = false;
    setFase(espera ? 'espera' : 'dorso');
    const t1 = setTimeout(() => setFase('dorso'), espera), t2 = setTimeout(() => setFase('frente'), espera + GIRO_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [modoLectura, nroActual]);

  useEffect(() => {
    if (!modoLectura || fase !== 'frente') return undefined;
    const t0 = Date.now(); setAbierto(t0); setResta(Math.ceil(MIN_LECTURA_MS / 1000));
    const iv = setInterval(() => { const r = Math.max(0, Math.ceil((MIN_LECTURA_MS - (Date.now() - t0)) / 1000)); setResta(r); if (r === 0) clearInterval(iv); }, 200);
    return () => clearInterval(iv);
  }, [modoLectura, nroActual, fase]);

  useEffect(() => { if (puedeCerrarRef.current) botonCerrar.current?.focus({ preventScroll: true }); });
  if (!carta) return null;
  if (modoLectura && fase === 'espera') return null;
  if (modoLectura && fase === 'dorso') {
    return (
      <div className="modal-fondo" role="dialog" aria-modal="true" aria-label={carta.titulo}>
        <div className="modal-carta"><div className="carta-dorso" style={{ animationDuration: GIRO_MS + 'ms' }}><img src={`/cartas/dorsos/${DORSOS[carta.deck] || 'cc'}.webp`} alt="" /></div></div>
      </div>
    );
  }
  const puedeCerrar = !modoLectura || resta === 0 || carta.deck === 'cuento';
  puedeCerrarRef.current = puedeCerrar;
  const cerrar = () => { if (!puedeCerrar) return; if (modoLectura) setCola((c) => c.slice(1)); else onCerrarConsulta(); };
  const quien = carta.quien ? s.jugadores[carta.quien] : null;
  const esTrivia = carta.deck === 'trivia', esMesa = carta.deck === 'mesa';
  const enCurso = s.turno?.ccActual?.nro === carta.nro;
  const soyYo = s.turno?.pid === s.yo;
  const res = carta.resuelto;

  return (
    <div className="modal-fondo" role="dialog" aria-modal="true" aria-label={carta.titulo} onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className={`modal-carta${modoLectura ? ' gira' : ''}`} key={modoLectura ? carta.nro : 'consulta'}>
        <div className="modal-sup">
          <span>{quien ? `${quien.nombre} · ${nombreCorto(quien.pj) || ''}` : 'Para toda la mesa'}{carta.para ? ' · privada' : ''}</span>
          {modoLectura && cola.length > 1 && <span className="chip">{cola.length} por leer</span>}
          {!modoLectura && <span className="chip">Consulta</span>}
        </div>
        {modoLectura && (
          <div className="barra-lectura" role="progressbar" aria-label="Tiempo mínimo de lectura" aria-valuemin="0" aria-valuemax={MIN_LECTURA_MS / 1000} aria-valuenow={resta}>
            <i className="barra-i" key={abierto} style={{ animationDuration: MIN_LECTURA_MS + 'ms' }} />
          </div>
        )}
        <Carta datos={carta} key={carta.nro}>
          {esTrivia && (
            <div className="opciones" role="group" aria-label="Opciones">
              {carta.opciones.map((o, i) => (
                <button key={i} hidden={enCurso && s.turno.ccActual.descartada === i && !res} className={`opcion${res ? (i === res.correcta ? ' ok' : i === res.elegida ? ' mal' : '') : ''}${res && i === res.elegida ? ' elegida' : ''}`}
                  disabled={!(enCurso && soyYo && !res)} onClick={() => enviar(ACCIONES.responderCC(i))}>
                  {String.fromCharCode(65 + i)}. {o}
                </button>
              ))}
              {res && <p className="nota-crp">{res.acierto ? '¡Correcto! ' : 'Respuesta correcta: ' + carta.opciones[res.correcta] + '. '}{res.nota}</p>}
              {!res && !(enCurso && soyYo) && <p className="c-nota">Responde {quien?.nombre || 'el jugador en turno'}. La respuesta se revela al contestar.</p>}
            </div>
          )}
          {esMesa && enCurso && (soyYo || s.soyHost) && (
            <div className="opciones">
              <button className="opcion" onClick={() => enviar(ACCIONES.resolverMesa(true))}>Se cumplió (+{carta.premio} dinares)</button>
              <button className="opcion" onClick={() => enviar(ACCIONES.resolverMesa(false))}>No se cumplió</button>
            </div>
          )}
        </Carta>
        <div className="modal-pie">
          {consultaObj?.uid && s.mano.some((c) => c.uid === consultaObj.uid && c.venta != null) && s.turno?.pid === s.yo && <button className="btn sec" onClick={() => { enviar(ACCIONES.vender(consultaObj.uid)); onCerrarConsulta(); }}>Vender</button>}
          <button className="btn modal-cerrar" ref={botonCerrar} disabled={!puedeCerrar} onClick={cerrar}>
            {puedeCerrar ? 'Cerrar' : `Leyendo… ${resta}`}
          </button>
        </div>
      </div>
    </div>
  );
}
