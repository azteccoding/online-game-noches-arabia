import React, { useState } from 'react';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Alerta de jugadores desconectados: se puede minimizar y volver a abrir; si se va alguien más, se vuelve a abrir sola.
export default function AlarmaDesconexion({ s }) {
  const [minimizadaCon, setMinimizadaCon] = useState(null);   // lista de ids cuando se minimizó
  const fuera = s.orden.map((id) => s.jugadores[id]).filter((j) => j && j.pj && !j.npc && !j.eliminado && j.conectado === false && j.id !== s.yo);
  if (!fuera.length) return null;
  const clave = fuera.map((j) => j.id).join();
  if (minimizadaCon === clave) return <button className="alarma-mini" onClick={() => setMinimizadaCon(null)} aria-label="Ver quién se desconectó">⚠ {fuera.length} {fuera.length === 1 ? 'desconectado' : 'desconectados'} ▾</button>;
  return (
    fuera.length && <div className="alarma-desconexion" role="alert">
      <button className="alarma-min" onClick={() => setMinimizadaCon(clave)} aria-label="Minimizar el aviso" title="Minimizar">▴</button>
      {fuera.map((j) => (
        <p key={j.id}>⚠ {j.nombre} se desconectó{s.turno?.pid === j.id ? ': es su turno y la partida lo está esperando' : ''}.
          {s.soyHost && <button className="btn mini sec" onClick={() => window.confirm(`¿Sacar a ${j.nombre} de la partida?`) && enviar(ACCIONES.host.eliminar(j.id))}>Sacar de la partida</button>}</p>
      ))}
    </div>
  );
}
