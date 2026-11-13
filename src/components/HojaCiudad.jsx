import React, { useState } from 'react';
import { ciudadDe, DATA, tablero } from '../game/data.js';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';
import { consejosVenta } from '../game/ventas.js';

import { entrenamientosEn } from '../../shared/retos.js';
import { objetosRaros, REPARA_ESCUDO } from '../../shared/objetos.js';
import { textoPremio } from '../game/premiosRetos.js';
import retosData from '../data/retos.json';
const rotulo = (x) => x.nombre + (x.precio != null ? ` (${x.precio})` : '');
// Jorge (11 de noviembre): la ficha de la ciudad dice qué entrenamiento ofrece, de la misma fuente que usa el motor.
const entrenamientos = (c, yo) => entrenamientosEn(c.id).map((x) => `${x.que} (${x.costo} dinares)${(x.id === 'R25' ? yo?.destreza : (yo?.entrenado || []).includes(x.que)) ? ' — ya lo tienes' : ''}`);
import { confirmarViajeBurro } from '../game/burro.js';

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
  return (
    <div className="hoja-modal panel hoja-ciudad" role="dialog" aria-label={`Ciudad ${id}`}>
      <div className="desp-cab"><h2>{id} <span className="ar">{c.ar}</span></h2><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo">
        {s.noSalir && <p className="aviso-mal">⛔ No puedes salir de tu ciudad: {s.noSalir}</p>}
        <p><b>Llegada:</b> {c.nochesLlegada === c.nochesLuego ? `${c.nochesLlegada}` : `${c.nochesLlegada} la primera vez, luego ${c.nochesLuego}`} noches (×{mult} esta ronda) · <b>Alojamiento:</b> {c.alojamiento} dinares · <b>Impuesto de venta:</b> {c.impuestoVenta}%</p>
        {c.notas && <p className="it">{c.notas}</p>}
        {id === 'Bagdad' && <p className={s.armasBagdad ? '' : 'aviso-mal'}><b>Pelear aquí:</b> {s.armasBagdad ? 'esta ronda el Califa permite armas en Bagdad (Torneo del Califa): se puede pelear como en cualquier ciudad.' : 'solo con el Firmán del Califa (robos, ataques a muerte y duelos). Con Firmán solo sirven el arco y la jambiya; el alfanje y la cimitarra no se usan en Bagdad.'}</p>}
        <p><b>Entrenamiento:</b> {entrenamientos(c, yo).join(' · ') || 'esta ciudad no ofrece entrenamiento'}{c.retos.includes('R51') ? ' · Torneo de Murcia (16 dinares): campeón de arco' : ''}</p>
        {(() => {   // Jorge (12 de noviembre): qué armas vende la ciudad (de las existencias del mercado), con su precio
          const a = s.armasCiudades?.[id];
          if (!a) return null;
          return <p><b>Armas:</b> {a.length ? a.map((x) => `${x.nombre} ${x.precio}${x.quedan != null ? ` (${x.quedan === 1 ? 'queda 1' : `quedan ${x.quedan}`})` : ''}`).join(' · ') : 'no vende armas'}</p>;
        })()}
        {c.retos.length > 0 && <div><b>Retos aquí:</b><ul className="retos-ciudad">{c.retos.map((r) => { const d = retosData.retos.find((x) => x.id === r); const p = textoPremio(r); return <li key={r}>{r} {d?.nombre}{p ? ` — ${p}` : ''}</li>; })}</ul></div>}
        {id === REPARA_ESCUDO.ciudad && <p><b>Reparación de escudos:</b> {REPARA_ESCUDO.costo} dinares (no gasta tu acción principal).</p>}
        {(() => {   // Jorge (12 de noviembre): solo lo que se vende únicamente en esta ciudad (de los mismos datos del mercado), con su precio
          const solo = objetosRaros(DATA, id).filter((x) => x.soloAqui);
          return solo.length > 0 ? <p><b>Solo aquí:</b> {solo.map(rotulo).join(', ')}</p> : null;
        })()}
        <p><b>Aquí:</b> {presentes.length ? presentes.map((j) => j.nombre).join(', ') : 'nadie'}</p>
        {id !== yo.ciudad && <p><b>Caravana desde {yo.ciudad}:</b> {tarifa !== undefined ? `${tarifa} dinares` : 'sin ruta directa (usa un transbordo)'}</p>}
        <button className="btn mini sec" aria-expanded={verVentas} onClick={() => setVerVentas((v) => !v)}>{verVentas ? 'Ocultar consejos de venta' : 'Consejos para ganar dinares aquí'}</button>
        {verVentas && <ul className="consejos-venta">{consejosVenta(id).map((x) => <li key={x}>{x}</li>)}</ul>}
        {puedeViajar && <button className="btn" disabled={yo.dinares < tarifa} onClick={() => { if (!confirmarViajeBurro(s, id)) return; enviar(ACCIONES.viajar(id)); onCerrar(); }}>Viajar a {id} ({tarifa} dinares)</button>}
        {puedeViajar && yo.dinares < tarifa && <p className="error">No te alcanzan los dinares.</p>}
        {miTurno && s.turno.fase !== 'ingreso' && id !== yo.ciudad && !viaje && <p className="it">Ahora no puedes viajar a {id} desde aquí (sin ruta, sin caravana, ya hiciste tus tramos o hay una carta por resolver).</p>}
      </div>
    </div>
  );
}
