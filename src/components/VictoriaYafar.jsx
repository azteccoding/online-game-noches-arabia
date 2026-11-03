import React, { useState } from 'react';

// Solitario: al derrotar a Yafar NPC se anuncia la victoria, pero se puede seguir jugando hasta las 1,001 noches.
export default function VictoriaYafar({ s }) {
  const clave = `mun.victoriaYafar.${s.codigo}.${s.victoriaYafar?.ronda}`;
  const [visto, setVisto] = useState(() => { try { return !!localStorage.getItem(clave); } catch { return false; } });
  if (!s.victoriaYafar || s.victoriaYafar.pid !== s.yo || visto || s.dados) return null;
  const seguir = () => { try { localStorage.setItem(clave, '1'); } catch { /* sin almacenamiento */ } setVisto(true); };
  return (
    <div className="modal-fondo" role="dialog" aria-modal="true" aria-label="¡Ganaste!">
      <div className="panel decision">
        <h2>¡Ganaste! Derrotaste a Yafar</h2>
        <p className="decision-texto">Yafar el Bermekí ha caído y la victoria queda registrada. Si quieres, sigue tu camino hasta las 1,001 noches.</p>
        <div className="decision-botones"><button className="btn" onClick={seguir}>Seguir jugando</button></div>
      </div>
    </div>
  );
}
