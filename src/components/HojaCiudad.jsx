import React, { useState } from 'react';
import { ciudadDe, DATA, tablero } from '../game/data.js';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';
import { consejosVenta } from '../game/ventas.js';

// Ficha de ciudad (al tocar un pin) con la acción de viajar si procede.
export default function HojaCiudad({ s, id, onCerrar }) {
  const c = ciudadDe(id);
  const [verVentas, setVerVentas] = useState(false);
  const yo = s.jugadores[s.yo];
  if (!c) return null;
  const miTurno = s.turno?.pid === s.yo && s.fase === 'juego';
  const viaje = s.acciones.find((x) => x.k === 'viajar' && x.destino === id);
  const tarifa = viaje ? viaje.precio : DATA.rutas.tarifas[yo.ciudad + '>' + id];
  const puedeViajar = !!viaje && !s.dados && !s.pend;
  const mult = s.mult;
  const presentes = Object.values(s.jugadores).filter((j) => j.ciudad === id && j.pj && !j.eliminado);
  const vende = DATA.objetos.mazo.filter((o) => o.seConsigueEn.split(/,| y /).map((x) => x.trim()).includes(id));
  return (
    <div className="hoja-modal panel hoja-ciudad" role="dialog" aria-label={`Ciudad ${id}`}>
      <div className="desp-cab"><h2>{id} <span className="ar">{c.ar}</span></h2><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo">
        <p><b>Llegada:</b> {c.nochesLlegada === c.nochesLuego ? `${c.nochesLlegada}` : `${c.nochesLlegada} la primera vez, luego ${c.nochesLuego}`} noches (×{mult} esta ronda) · <b>Alojamiento:</b> {c.alojamiento} dinares · <b>Impuesto de venta:</b> {c.impuestoVenta}%</p>
        {c.notas && <p className="it">{c.notas}</p>}
        {c.retos.length > 0 && <p><b>Retos aquí:</b> {c.retos.join(', ')}</p>}
        <p><b>Aquí:</b> {presentes.length ? presentes.map((j) => j.nombre).join(', ') : 'nadie'}</p>
        {vende.length > 0 && <p><b>Se venden:</b> {vende.map((o) => o.nombre).join(', ')}</p>}
        {id !== yo.ciudad && <p><b>Caravana desde {yo.ciudad}:</b> {tarifa !== undefined ? `${tarifa} dinares` : 'sin ruta directa (usa un transbordo)'}</p>}
        <button className="btn mini sec" aria-expanded={verVentas} onClick={() => setVerVentas((v) => !v)}>{verVentas ? 'Ocultar consejos de venta' : 'Consejos para ganar dinares aquí'}</button>
        {verVentas && <ul className="consejos-venta">{consejosVenta(id).map((x) => <li key={x}>{x}</li>)}</ul>}
        {puedeViajar && <button className="btn" disabled={yo.dinares < tarifa} onClick={() => { enviar(ACCIONES.viajar(id)); onCerrar(); }}>Viajar a {id} ({tarifa} dinares)</button>}
        {puedeViajar && yo.dinares < tarifa && <p className="error">No te alcanzan los dinares.</p>}
        {miTurno && s.turno.fase !== 'ingreso' && id !== yo.ciudad && !viaje && <p className="it">Ahora no puedes viajar a {id} desde aquí (sin ruta, sin caravana, ya hiciste tus tramos o hay una carta por resolver).</p>}
      </div>
    </div>
  );
}
