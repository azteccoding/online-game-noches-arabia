import React from 'react';
import Sprite from './Sprite.jsx';

const MOTIVO = {
  npc: 'Yafar el Bermekí (NPC) llegó primero a las 1,001 noches: los jugadores pierden.',
  muerte: 'Ningún jugador sobrevivió.',
};

// Pantalla final: gana quien primero junta 1,001 noches (victoria única). Muestra también eliminados y derrotas contra Yafar NPC.
export default function Fin({ s, onCerrar }) {
  const filas = Object.values(s.jugadores).filter((j) => j.pj).sort((a, b) => (s.ganadores?.includes(b.id) ? 1 : 0) - (s.ganadores?.includes(a.id) ? 1 : 0) || b.noches - a.noches);
  const gan = (s.ganadores || []).map((id) => s.jugadores[id]?.nombre).filter(Boolean);
  return (
    <div className="modal-fondo fin-fondo" role="dialog" aria-modal="true" aria-label="Fin de la partida">
      <div className="panel fin">
        <h1>Mil y una noches</h1>
        <p className="ar" style={{ fontSize: 26, margin: 0, color: 'var(--oro-claro)' }}>ألف ليلة وليلة</p>
        {gan.length ? <p className="it gran">{gan.length > 1 ? 'Han llegado a las 1,001 noches: ' : 'Ha llegado a las 1,001 noches: '}<b>{gan.join(' y ')}</b></p> : <p className="it gran">{MOTIVO[s.derrota] || 'La partida terminó.'}</p>}
        <ul>{filas.map((j) => (
          <li key={j.id} className={s.ganadores?.includes(j.id) ? 'gana' : j.eliminado ? 'muerto' : ''}>
            <Sprite pj={j.pj} alto={44} /><b>{j.nombre}{j.npc ? '' : j.id === s.yo ? ' (tú)' : ''}</b>
            <span>{j.eliminado ? 'eliminado · ' : ''}{j.noches} noches · {j.dinares} dinares</span>
          </li>
        ))}</ul>
        <p className="it">Ronda {s.ronda}. Para empezar otra partida, reinicia el servidor con <code>npm start -- --nuevo</code>.</p>
        {onCerrar && <button className="btn sec" onClick={onCerrar}>Ver el tablero</button>}
      </div>
    </div>
  );
}
