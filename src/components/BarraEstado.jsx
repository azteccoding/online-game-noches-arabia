import React, { useEffect, useState } from 'react';
import { verComo } from '../game/store.js';

// Pantalla completa (Fullscreen API). En iPhone no existe: se explica cómo agregar el juego a la pantalla de inicio.
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsPuede = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function alternarPantalla() {
  const r = document.documentElement;
  if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  else (r.requestFullscreen || r.webkitRequestFullscreen)?.call(r)?.catch?.(() => {});
}

export default function BarraEstado({ s, demo, pids, panel, abrir }) {
  const [mas, setMas] = useState(false);
  const [completa, setCompleta] = useState(() => !!fsEl());
  useEffect(() => { const f = () => setCompleta(!!fsEl()); document.addEventListener('fullscreenchange', f); document.addEventListener('webkitfullscreenchange', f); return () => { document.removeEventListener('fullscreenchange', f); document.removeEventListener('webkitfullscreenchange', f); }; }, []);
  const act = (p) => { setMas(false); abrir(p); };
  const ev = s.evento?.actual && s.historial.slice().reverse().find((h) => h.deck === 'evento');
  return (
    <header className="barra">
      <div className="barra-izq">
        <span className="sala">Sala {s.codigo}</span>
        <span className="chip" title="Multiplicador de noches de esta ronda">Ronda {s.ronda} · ×{s.mult}</span>
        {ev && <button className="chip chip-ev" onClick={() => abrir('evento')} title="Evento de la ronda">{ev.titulo}</button>}
        {(s.carreras || []).map((c) => <button key={c.id} className="chip chip-ev" onClick={() => abrir('misiones')} title={`Carrera: dos noches seguidas en ${c.ciudad} (60 dinares y 50 noches). ` + (Object.entries(c.prog).map(([id, n]) => `${s.jugadores[id]?.nombre} ${n}/2`).join(', ') || 'Nadie ha empezado.')}>🏁 {c.ciudad}</button>)}
        {Object.entries(s.jugadores[s.yo]?.hazanas || {}).filter(([, h]) => h.bloqueada).map(([k, h]) => <button key={k} className="chip mal" onClick={() => abrir('misiones')} title={`${h.nombre}: bloqueada hasta que salgas de ${h.par.join(' y ')}. Para volver a ganar estas noches, muévete a otra ciudad.`}>{k === 'tariq' ? 'Tariq' : 'al-Quds'}: bloqueada</button>)}
        {!s.hostConectado && <span className="chip mal" title="El banco está desconectado; la partida sigue.">banco ausente</span>}
      </div>
      <nav className="barra-der" aria-label="Menú">
        <button className="btn mini btn-pantalla" onClick={() => (fsPuede() ? alternarPantalla() : window.alert('En iPhone y iPad: toca Compartir y luego «Agregar a inicio». Al abrir el juego desde ese ícono se ve en pantalla completa.'))} title={completa ? 'Salir de pantalla completa' : 'Pantalla completa'} aria-label={completa ? 'Salir de pantalla completa' : 'Pantalla completa'}><span aria-hidden="true">⛶</span><span className="txt-pantalla">{completa ? 'Salir de pantalla completa' : 'Pantalla completa'}</span></button>
        <button className={`btn mini${panel === 'personajes' ? ' on' : ''}`} aria-expanded={panel === 'personajes'} onClick={() => abrir('personajes')}>Personajes ▾</button>
        <button className="btn mini" disabled={s.ultimaCarta == null} onClick={() => abrir('ultima')}>Última carta</button>
        <div className="menu-mas">
          <button className="btn mini" aria-expanded={mas} onClick={() => setMas((m) => !m)}>Más ▾</button>
          {mas && (
            <ul className="menu-lista panel" role="menu">
              <li><button role="menuitem" onClick={() => act('historial')}>Historial de cartas</button></li>
              <li><button role="menuitem" onClick={() => act('registro')}>Registro de eventos</button></li>
              <li><button role="menuitem" onClick={() => act('anfitrion')}>{s.soyHost ? 'Panel del banco' : 'Banco / anfitrión'}</button></li>
              <li><button role="menuitem" onClick={() => act('acerca')}>Acerca de</button></li>
              {demo && pids && <li className="sep">Ver como (demo)</li>}
              {demo && pids && [pids.yo, ...pids.bots].map((id) => <li key={id}><button role="menuitem" onClick={() => { setMas(false); verComo(id); }}>{s.jugadores[id]?.nombre}{id === s.yo ? ' ✓' : ''}</button></li>)}
            </ul>
          )}
        </div>
      </nav>
    </header>
  );
}
