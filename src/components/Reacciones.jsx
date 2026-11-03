import React, { useEffect, useState } from 'react';
import { REACCIONES, ESPERA_REACCION_MS } from '../../shared/reacciones.js';
import { reaccionar, useJuego } from '../game/store.js';

// Botón 💬 flotante, siempre visible (también sobre dados, cartas, tratos y peleas): abre las reacciones rápidas. Las de «turno» van a quien está jugando; no se las manda uno mismo.
export function BotonReacciones({ s }) {
  const [abierto, setAbierto] = useState(false);
  const [hasta, setHasta] = useState(0);
  const [, refrescar] = useState(0);
  const [alto, setAlto] = useState(null);                 // alto real de la barra superior (en teléfono ocupa dos filas)
  useEffect(() => {
    const b = document.querySelector('.barra'); if (!b) return undefined;
    const medir = () => { const y = b.getBoundingClientRect().bottom; setAlto(y); document.documentElement.style.setProperty('--tope', y + 'px'); };
    medir(); const ro = new ResizeObserver(medir); ro.observe(b); window.addEventListener('resize', medir);
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); };
  }, []);
  useEffect(() => { if (Date.now() >= hasta) return; const t = setInterval(() => refrescar((n) => n + 1), 1000); return () => clearInterval(t); }, [hasta]);
  const yo = s.jugadores[s.yo];
  if ((s.fase !== 'juego' && s.fase !== 'fin') || !yo?.pj) return null;   // cualquier jugador, en cualquier momento de la partida
  const turno = s.turno?.pid && s.jugadores[s.turno.pid];
  const puedeTurno = turno && turno.id !== s.yo && !turno.npc;
  const falta = Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
  const mandar = (id) => { reaccionar(id); setHasta(Date.now() + ESPERA_REACCION_MS); setAbierto(false); };
  return (
    <div className="reacciones-flotante" style={alto != null ? { '--tope': alto + 'px' } : undefined}>
      <button className="btn reacciones-btn" aria-expanded={abierto} aria-label="Reacciones rápidas" title="Reacciones rápidas" onClick={() => setAbierto((v) => !v)}>💬</button>
      {abierto && (
        <ul className="panel reacciones-lista" role="menu">
          {falta > 0 && <li className="sep">Espera {falta} s</li>}
          <li className="sep">{puedeTurno ? `Para ${turno.nombre}` : turno?.id === s.yo ? 'Para quien juega (es tu turno)' : 'Para quien juega (ahora no hay a quién)'}</li>
          {REACCIONES.filter((r) => r.para === 'turno').map((r) => <li key={r.id}><button role="menuitem" disabled={!puedeTurno || falta > 0} onClick={() => mandar(r.id)}>{r.emoji} {r.texto}</button></li>)}
          <li className="sep">Para todos</li>
          {REACCIONES.filter((r) => r.para === 'todos').map((r) => <li key={r.id}><button role="menuitem" disabled={falta > 0} onClick={() => mandar(r.id)}>{r.emoji} {r.texto}</button></li>)}
        </ul>
      )}
    </div>
  );
}

// Burbujas breves bajo la barra: no bloquean clics ni tapan la mano.
export function BurbujasReacciones({ yo }) {
  const lista = useJuego((x) => x.reacciones);
  if (!lista?.length) return null;
  return (
    <div className="burbujas-reaccion" aria-live="polite">
      {lista.map((r) => (
        <div key={r.k} className={`burbuja-reaccion${r.a === yo ? ' para-mi' : ''}`}>
          <span className="emoji" aria-hidden="true">{r.emoji}</span>
          <span><b>{r.de === yo ? 'Tú' : r.nombre}</b>{r.aNombre ? ` → ${r.a === yo ? 'ti' : r.aNombre}` : ''}: {r.texto}</span>
        </div>
      ))}
    </div>
  );
}
