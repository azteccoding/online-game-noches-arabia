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
  const cuenta = `${v.callan} de ${v.total} ${v.callan === 1 ? 'pide' : 'piden'} que se calle`;
  if (v.yaVote) return <div className="callar-jamil" role="status"><span className="callar-nota">Pediste que se calle · {cuenta} · {resta} s</span></div>;
  return (
    <div className="callar-jamil">
      {abierto && (
        <div className="callar-aviso" role="alertdialog" aria-label="Que se calle Jamil">
          <p><b>Si lo oprimes:</b> votas por callar a {jamil}. Si más de la mitad de los demás jugadores lo pide, deja de tocar y termina su turno.</p>
          <p><b>Si no lo oprimes:</b> cuenta como que siga tocando. Si no lo callan, {jamil} gana {v.premio.noches} noches y {v.premio.dinares} dinares.</p>
          <p className="it">{cuenta} · quedan {resta} s</p>
          <div className="callar-botones">
            <button className="btn mini" onClick={() => { enviar(ACCIONES.callarJamil()); setAbierto(false); }}>Que se calle</button>
            <button className="btn mini sec" onClick={() => setAbierto(false)}>Dejarlo tocar</button>
          </div>
        </div>
      )}
      <button className="btn mini callar-boton" onClick={() => setAbierto((x) => !x)} aria-expanded={abierto}>Que se calle Jamil · {resta} s</button>
    </div>
  );
}
