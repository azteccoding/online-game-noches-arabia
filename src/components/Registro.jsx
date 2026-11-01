import React from 'react';
import { ETIQUETA, Icono } from './iconos.jsx';

export function Historial({ s, onAbrir, onCerrar }) {
  const lista = s.historial.slice().reverse();
  return (
    <div className="hoja-modal panel" role="dialog" aria-label="Historial de cartas">
      <div className="desp-cab"><h2>Historial de cartas</h2><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo">
        {!lista.length && <p className="it">Aún no ha salido ninguna carta.</p>}
        <ul className="lista-hist">
          {lista.map((h) => (
            <li key={h.nro}>
              <button onClick={() => onAbrir(h.nro)}>
                <span className={`ic deck-${h.deck}`}><Icono deck={h.deck} size={18} /></span>
                <span className="t"><b>{h.titulo}</b><small>{ETIQUETA[h.deck]?.[0]} · ronda {h.ronda}{h.quien ? ' · ' + (s.jugadores[h.quien]?.nombre || '') : ''}{h.para ? ' · privada' : ''}</small></span>
                <span className="h">{new Date(h.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Registro({ s, onCerrar }) {
  return (
    <div className="hoja-modal panel" role="dialog" aria-label="Registro de eventos">
      <div className="desp-cab"><h2>Registro</h2><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo">
        <ol className="registro" aria-live="polite">
          {s.log.slice().reverse().map((l, i) => <li key={i}><time>{new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time> {l.texto}</li>)}
        </ol>
      </div>
    </div>
  );
}
