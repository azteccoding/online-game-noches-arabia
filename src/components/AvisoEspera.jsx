import React, { useState } from 'react';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Al banco: un jugador lleva 60 segundos sin tirar su dado. Decide sacarlo o esperarlo; nadie tira por él.
export default function AvisoEspera({ s }) {
  const [esperando, setEsperando] = useState(null);
  const yo = s.jugadores[s.yo];
  if (yo?.sacado) return <div className="aviso-espera panel" role="alert"><p>El banco te sacó por no tirar tu dado. Tu turno pasa al final del orden.</p><button className="btn mini" onClick={() => enviar(ACCIONES.volver())}>Volver a la partida</button></div>;
  const x = s.espera;
  if (!x?.sacable || !s.puedoSacar) return null;
  const clave = x.pid + ':' + x.desde;
  if (esperando === clave) return null;
  const nom = s.jugadores[x.pid]?.nombre || 'Ese jugador';
  return (
    <div className="aviso-espera panel" role="alertdialog" aria-label={`${nom} no ha tirado su dado`}>
      <p><b>{nom}</b> lleva más de 60 segundos sin tirar su dado. Nadie puede tirar por él: puedes esperarlo o sacarlo. Si lo sacas, pierde este turno y cuando vuelva juega al final del orden.</p>
      <div className="fila-btn">
        <button className="btn mini" onClick={() => enviar(ACCIONES.host.sacarEspera(x.pid))}>Sacarlo</button>
        <button className="btn mini sec" onClick={() => setEsperando(clave)}>Esperarlo</button>
      </div>
    </div>
  );
}
