import React, { useEffect, useState } from 'react';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Votación para terminar la partida y empezar otra (la propone el banco). Quien ya votó o no vota ve solo el recuento.
export default function VotoReinicio({ s }) {
  const v = s.votoReinicio;
  const [, fuerza] = useState(0);
  useEffect(() => { if (!v) return undefined; const iv = setInterval(() => fuerza((x) => x + 1), 1000); return () => clearInterval(iv); }, [v?.t0]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return null;
  const quien = s.jugadores[v.por]?.nombre || 'El banco';
  const resta = Math.max(0, Math.ceil((v.limiteMs - (s.ahora - v.t0)) / 1000));
  const cuenta = `${v.si} sí · ${v.no} no · de ${v.total} (gana con más de la mitad)`;
  if (v.votas && v.miVoto === null && s.pend?.mia && !s.pend.respondiste) {         // tu decisión va primero: el voto queda como barra, sin tapar nada
    return <div className="espera-pend voto-barra" role="status">¿Empezar otra partida? <button className="btn mini" onClick={() => enviar(ACCIONES.votarReinicio(true))}>Sí</button> <button className="btn mini sec" onClick={() => enviar(ACCIONES.votarReinicio(false))}>No</button> · quedan {resta} s</div>;
  }
  if (!v.votas || v.miVoto !== null) return <div className="espera-pend" role="status">Votación para empezar de nuevo: {cuenta}{v.miVoto !== null ? ` · votaste ${v.miVoto ? 'sí' : 'no'}` : ''}</div>;
  return (
    <div className="modal-fondo decision-fondo" role="dialog" aria-modal="true" aria-label="Votación: partida nueva">
      <div className="panel decision">
        <h2>¿Empezar otra partida?</h2>
        <p className="decision-texto">{quien} (banco) propone terminar esta partida y empezar otra desde cero, con los mismos jugadores y dejando entrar a nuevos. La partida actual se guarda aparte.</p>
        <p className="it">{cuenta} · quedan unos {resta} s; si no votas, cuenta como que no.</p>
        <div className="decision-botones">
          <button className="btn" onClick={() => enviar(ACCIONES.votarReinicio(true))}>Sí, empezar de nuevo</button>
          <button className="btn" onClick={() => enviar(ACCIONES.votarReinicio(false))}>No, seguir jugando</button>
        </div>
      </div>
    </div>
  );
}
