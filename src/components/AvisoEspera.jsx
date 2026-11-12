import React, { useEffect, useState } from 'react';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Al banco: un jugador no tira su dado (desconectado o 60 segundos sin tirar). Decide sacarlo o esperarlo; nadie tira por él.
// «Esperarlo» da otros 60 segundos con contador, sin cerrar el aviso; después solo queda «Sacarlo».
const ESPERA_MS = 60000;
export default function AvisoEspera({ s }) {
  const [espera, setEspera] = useState(null);                 // { clave, hasta }
  const [, setReloj] = useState(0);
  const [mini, setMini] = useState(null);                     // clave del aviso minimizado (solo en esta pantalla; no cambia el juego)
  useEffect(() => { if (!espera) return undefined; const iv = setInterval(() => setReloj((n) => n + 1), 500); return () => clearInterval(iv); }, [espera]);
  const yo = s.jugadores[s.yo];
  if (yo?.sacado) return <div className="aviso-espera panel" role="alert"><p>El banco te sacó de tu turno. Tu turno pasa al final del orden.</p><button className="btn mini" onClick={() => enviar(ACCIONES.volver())}>Volver a la partida</button></div>;
  const x = s.espera;
  if (!x?.sacable || !s.puedoSacar) return null;
  const clave = x.pid + ':' + x.desde;
  const esperando = espera?.clave === clave ? Math.max(0, Math.ceil((espera.hasta - Date.now()) / 1000)) : null;
  const nom = s.jugadores[x.pid]?.nombre || 'Ese jugador';
  // Minimizado (Jorge, 11 de noviembre): una pastilla con el nombre y la cuenta; al tocarla vuelve la ventana. Al acabarse la espera
  // se vuelve a abrir sola para que decidas.
  if (mini === clave && esperando !== 0) {
    return <button className="espera-mini" onClick={() => setMini(null)} title="Abrir la ventana para sacarlo o seguir esperando">⏳ {esperando > 0 ? `Esperando a ${nom}: ${esperando} s` : `${nom} no ha tirado`} · abrir</button>;
  }
  return (
    <div className="aviso-espera panel" role="alertdialog" aria-label={`${nom} no ha tirado su dado`}>
      <button className="alarma-min" onClick={() => setMini(clave)} aria-label="Minimizar la ventana" title="Minimizar">▾</button>
      <p style={{ paddingRight: 24 }}><b>{nom}</b> {s.jugadores[x.pid]?.conectado === false ? 'se desconectó y no ha tirado' : 'lleva más de 60 segundos sin tirar'} su dado. Nadie puede tirar por él: puedes esperarlo o sacarlo. Si lo sacas, pierde este turno y cuando vuelva juega al final del orden.</p>
      {esperando > 0 && <p className="it" role="status">Esperando a {nom}… <b>{esperando}</b> s</p>}
      {esperando === 0 && <p className="it">Ya lo esperaste 60 segundos más.</p>}
      <div className="fila-btn">
        <button className="btn mini" onClick={() => { if (window.confirm(`¿Seguro que quieres sacar a ${nom}? Perderá este turno y, cuando vuelva, jugará al final del orden.`)) enviar(ACCIONES.host.sacarEspera(x.pid)); }}>Sacarlo</button>
        {esperando == null && <button className="btn mini sec" onClick={() => setEspera({ clave, hasta: Date.now() + ESPERA_MS })}>Esperarlo</button>}
      </div>
    </div>
  );
}
