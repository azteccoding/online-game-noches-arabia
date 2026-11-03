import React, { useEffect, useRef, useState } from 'react';
import { enviar, avisar, useJuego } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Alertas de tratos entre jugadores: a quien recibe una propuesta le sale una tarjeta con el resumen y los botones;
// a quien la hizo se le avisa si la aceptaron, la rechazaron o le contraofertaron. Si hay dados o una decisión propia
// en pantalla la tarjeta espera (el botón Mercado palpita mientras tanto).
export const ladoTrato = (x) => [x.dinares ? `${x.dinares} dinares` : '', x.noches ? `${x.noches} noches` : '', ...(x.nombres || [])].filter(Boolean).join(', ') || 'nada';

export default function AlertaTrato({ s, abrir }) {
  const [vistas, setVistas] = useState([]);                  // propuestas que el jugador ya apartó («Luego»)
  const entrantes = s.tratos.filter((t) => t.con === s.yo);
  const nombre = (id) => s.jugadores[id]?.nombre || 'Alguien';
  const leyendo = useJuego((x) => x.cartaEnPantalla);

  const t = entrantes.find((x) => !vistas.includes(x.id));
  if (!t) return null;
  const ocupado = !!s.dados || (s.pend?.mia && !s.pend.respondiste) || leyendo != null;
  if (ocupado) return null;                                   // espera detrás de los dados y las decisiones
  return (
    <div className="alerta-trato panel" role="alertdialog" aria-label={`${nombre(t.de)} te propone un trato`}>
      <p className="alerta-trato-tit">🤝 <b>{nombre(t.de)}</b> {t.contra ? 'te hace una contraoferta' : 'te propone un trato'}</p>
      <div className="trato-bloques">
        <div className="trato-bloque recibes"><b>Recibes</b><span>{ladoTrato(t.ofrece)}</span></div>
        <div className="trato-bloque entregas"><b>Entregas</b><span>{ladoTrato(t.pide)}</span></div>
      </div>
      <div className="fila-btn">
        <button className="btn mini" onClick={() => enviar(ACCIONES.responderTrato(t.id, true))}>Aceptar</button>
        <button className="btn mini sec" onClick={() => enviar(ACCIONES.responderTrato(t.id, false))}>Rechazar</button>
        <button className="btn mini sec" onClick={() => abrir('mercado-contra:' + t.id)}>Contraofertar</button>
        <button className="btn mini sec" onClick={() => { abrir('mercado-tratos'); setVistas((v) => [...v, t.id]); }}>Ver</button>
        <button className="btn mini sec" onClick={() => setVistas((v) => [...v, t.id])}>Luego</button>
      </div>
    </div>
  );
}

// Siempre montado (aunque el Mercado esté abierto): avisa a quien propuso cuando su propuesta se resuelve.
export function AvisosTrato({ s }) {
  const mias = useRef(new Map());                             // mis propuestas abiertas: id -> destinatario
  const nombre = (id) => s.jugadores[id]?.nombre || 'Alguien';
  // Aviso a quien propuso cuando su propuesta se resuelve.
  useEffect(() => {
    const abiertas = new Map(s.tratos.filter((t) => t.de === s.yo).map((t) => [t.id, t.con]));
    for (const [id, con] of mias.current) {
      if (abiertas.has(id)) continue;
      const otro = nombre(con), yo = nombre(s.yo);
      const contra = s.tratos.some((t) => t.de === con && t.con === s.yo && t.contra);
      const rechazo = s.log.slice(-15).some((l) => l.texto.startsWith(`${otro} rechaza el trato de ${yo}`));
      avisar(contra ? `🔄 ${otro} te hace una contraoferta.` : rechazo ? `❌ ${otro} rechazó tu trato.` : `🤝 ${otro} aceptó tu trato.`);
    }
    mias.current = abiertas;
  }, [s.tratos]);   // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
