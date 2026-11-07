import React, { useState } from 'react';

// Anuncio para toda la mesa cuando alguien queda Buscado: por qué, cuánto se gana por él y hasta cuándo.
export default function AvisoBuscado({ s }) {
  const [vistos, setVistos] = useState(() => new Set());
  const nuevo = Object.values(s.jugadores).find((j) => j.buscadoInfo && j.buscadoClave && !j.eliminado && !vistos.has(j.id + j.buscadoClave));
  if (!nuevo || s.dados) return null;
  const yo = nuevo.id === s.yo;
  return (
    <div className="aviso-espera panel aviso-buscado" role="alert">
      <p><b>¡{yo ? 'Estás' : `${nuevo.nombre} está`} {nuevo.buscadoInfo.split(':')[0]}!</b> {nuevo.buscadoInfo.slice(nuevo.buscadoInfo.indexOf(':') + 1).trim()}</p>
      <div className="fila-btn"><button className="btn mini" onClick={() => setVistos((v) => new Set(v).add(nuevo.id + nuevo.buscadoClave))}>Entendido</button></div>
    </div>
  );
}
