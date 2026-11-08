import React, { useEffect, useRef, useState } from 'react';
import { enviar, avisar, useJuego } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';
import { avisosTrato } from '../game/tratos.js';

// Alertas de tratos entre jugadores: a quien recibe una propuesta le sale una tarjeta con el resumen y los botones;
// a quien la hizo se le avisa si la aceptaron, la rechazaron o le contraofertaron. Si hay dados o una decisión propia
// en pantalla la tarjeta espera (el botón Mercado palpita mientras tanto).
// Leyendas rojas «Trato costoso» / «Trato demasiado barato» (src/game/tratos.js).
export const AvisoTrato = ({ ofrece, pide }) => { const a = avisosTrato(ofrece, pide); return a.length ? <p className="trato-aviso" role="note">{a.map((x) => <span key={x}>⚠ {x}</span>)}</p> : null; };
// Cada cosa del trato en su propio renglón y en grande, para que no pasen desapercibidas las noches (Jorge, 8 de noviembre).
const partesTrato = (x) => [x.dinares ? `${x.dinares} dinares` : '', x.noches ? `${x.noches} noches` : '', ...(x.nombres || [])].filter(Boolean);
export const LadoTrato = ({ x }) => { const p = partesTrato(x); return p.length ? p.map((t) => <span key={t} className="trato-linea">{t}</span>) : <span className="trato-linea">nada</span>; };
// Al aceptar un trato costoso se pide confirmación (ventana del juego, no del navegador) con lo que vas a entregar.
export const esCostoso = (t) => avisosTrato(t.ofrece, t.pide).includes('Trato costoso');
export const ConfirmaTrato = ({ t, onSi, onNo }) => (
  <div className="trato-confirma" role="alertdialog" aria-label="Confirmar trato">
    <p>Vas a entregar <b>{partesTrato(t.pide).join(', ').replace(/, ([^,]*)$/, ' y $1')}</b>. ¿Aceptas?</p>
    <div className="fila-btn"><button className="btn mini" onClick={onSi}>Sí, acepto</button><button className="btn mini sec" onClick={onNo}>No</button></div>
  </div>
);
export const ladoTrato = (x) => [x.dinares ? `${x.dinares} dinares` : '', x.noches ? `${x.noches} noches` : '', ...(x.nombres || [])].filter(Boolean).join(', ') || 'nada';

export default function AlertaTrato({ s, abrir }) {
  const [vistas, setVistas] = useState([]);                  // propuestas que el jugador ya apartó («Luego»)
  const [respondidas, setRespondidas] = useState([]);        // ya se mandó la respuesta: no se puede volver a pulsar
  const [confirma, setConfirma] = useState(null);           // trato costoso esperando el «Sí, acepto»
  const entrantes = s.tratos.filter((t) => t.con === s.yo);
  const nombre = (id) => s.jugadores[id]?.nombre || 'Alguien';
  const leyendo = useJuego((x) => x.cartaEnPantalla);

  const t = entrantes.find((x) => !vistas.includes(x.id) && !respondidas.includes(x.id));
  if (!t) return null;
  const ocupado = !!s.dados || (s.pend?.mia && !s.pend.respondiste) || leyendo != null;
  if (ocupado) return null;                                   // espera detrás de los dados y las decisiones
  return (
    <div className="alerta-trato panel" role="alertdialog" aria-label={`${nombre(t.de)} te propone un trato`}>
      <p className="alerta-trato-tit">🤝 <b>{nombre(t.de)}</b> {t.contra ? 'te hace una contraoferta' : 'te propone un trato'}</p>
      <div className="trato-bloques">
        <div className="trato-bloque recibes"><b>Recibes</b><LadoTrato x={t.ofrece} /></div>
        <div className="trato-bloque entregas"><b>Entregas</b><LadoTrato x={t.pide} /></div>
      </div>
      <AvisoTrato ofrece={t.ofrece} pide={t.pide} />
      {confirma === t.id ? <ConfirmaTrato t={t} onSi={() => { setConfirma(null); setRespondidas((v) => [...v, t.id]); enviar(ACCIONES.responderTrato(t.id, true)); }} onNo={() => setConfirma(null)} /> : (
      <div className="fila-btn">
        <button className="btn mini" onClick={() => { if (esCostoso(t)) { setConfirma(t.id); return; } setRespondidas((v) => [...v, t.id]); enviar(ACCIONES.responderTrato(t.id, true)); }}>Aceptar</button>
        <button className="btn mini sec" onClick={() => { setRespondidas((v) => [...v, t.id]); enviar(ACCIONES.responderTrato(t.id, false)); }}>Rechazar</button>
        <button className="btn mini sec" onClick={() => abrir('mercado-contra:' + t.id)}>Contraofertar</button>
        <button className="btn mini sec" onClick={() => { abrir('mercado-tratos'); setVistas((v) => [...v, t.id]); }}>Ver</button>
        <button className="btn mini sec" onClick={() => setVistas((v) => [...v, t.id])}>Luego</button>
      </div>)}
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
      const cancelado = s.log.slice(-15).some((l) => l.texto.includes('se cancela: ya no están en la misma ciudad') && l.texto.includes(otro));
      avisar(cancelado ? `❌ Tu trato con ${otro} se canceló: ya no están en la misma ciudad.` : contra ? `🔄 ${otro} te hace una contraoferta.` : rechazo ? `❌ ${otro} rechazó tu trato.` : `🤝 ${otro} aceptó tu trato.`);
    }
    mias.current = abiertas;
  }, [s.tratos]);   // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
