import React, { useEffect, useRef, useState } from 'react';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// «Que se calle Jamil» (Jorge, 24 de noviembre, solo en el 3D): mientras Jamil toca el laúd, a los demás jugadores les sale este
// botón chico junto a la barra de acciones. Al oprimirlo, un aviso explica qué pasa si lo oprimes y si no; el voto se manda desde
// ahí. Recibe el estado al momento (no el que espera a las animaciones): la votación corre mientras Jamil toca.
export default function CallarJamil({ s }) {
  const v = s.fase === 'juego' ? s.votoLaud : null;
  const [abierto, setAbierto] = useState(false);
  const [, pintar] = useState(0);
  const visto = useRef(null);      // cuándo llegó esta votación a este navegador y cuánto le quedaba (el reloj del servidor puede no coincidir con el de aquí)
  if (v && visto.current?.t0 !== v.t0) visto.current = { t0: v.t0, en: Date.now(), queda: Math.max(0, v.limiteMs - (s.ahora - v.t0)) };
  useEffect(() => { if (!v) { setAbierto(false); return undefined; } const iv = setInterval(() => pintar((x) => x + 1), 500); return () => clearInterval(iv); }, [v?.t0]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!v || !v.votas) return null;
  const jamil = s.jugadores[v.pid]?.nombre || 'Jamil';
  const resta = Math.max(0, Math.ceil((visto.current.queda - (Date.now() - visto.current.en)) / 1000));
  // Jorge (25 de noviembre): todos votan y los votos se cuentan hasta el final; aquí solo se ve cuántos ya votaron
  const cuenta = `votaron ${v.votaron} de ${v.total}`;
  if (v.yaVote) return <div className="callar-jamil" role="status"><span className="callar-nota">Votaste que {v.miVoto ? 'se calle' : 'siga'} · {cuenta} · {resta} s</span></div>;
  return (
    <div className="callar-jamil">
      {abierto && (
        <div className="callar-aviso" role="alertdialog" aria-label="Que se calle Jamil">
          <p><b>Que se calle:</b> si al final de la votación más de la mitad de los demás jugadores lo pidió, {jamil} deja de tocar y termina su turno.</p>
          <p><b>Dejarlo tocar:</b> si no lo callan, {jamil} gana {v.premio.noches} noches y {v.premio.dinares} dinares. Si no votas a tiempo, cuenta como que siga.</p>
          <p>Los votos se cuentan cuando ya votaron todos o se acaba el tiempo.</p>
          {v.votoNpc && <p>{v.votoNpc} ya votó que se calle.</p>}
          <p className="it">{cuenta} · quedan {resta} s</p>
          <div className="callar-botones">
            <button className="btn mini" onClick={() => { enviar(ACCIONES.callarJamil()); setAbierto(false); }}>Que se calle</button>
            <button className="btn mini sec" onClick={() => { enviar(ACCIONES.callarJamil(false)); setAbierto(false); }}>Dejarlo tocar</button>
          </div>
        </div>
      )}
      <button className="btn mini callar-boton" onClick={() => setAbierto((x) => !x)} aria-expanded={abierto}>Que se calle Jamil · {resta} s</button>
    </div>
  );
}
