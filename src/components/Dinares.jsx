import React, { useEffect, useRef, useState } from 'react';

// Marcador de dinares con aviso flotante: «+N» verde que cae al ganar y «−N» rojo que sube al perder; se desvanece en ~1.3 s.
export default function Dinares({ valor, sufijo = ' din.' }) {
  const prev = useRef(valor);
  const [deltas, setDeltas] = useState([]);
  useEffect(() => {
    const d = valor - prev.current; prev.current = valor;
    if (!d) return undefined;
    const id = Math.random();
    setDeltas((xs) => [...xs.slice(-3), { id, d }]);
    const t = setTimeout(() => setDeltas((xs) => xs.filter((x) => x.id !== id)), 1400);
    return () => clearTimeout(t);
  }, [valor]);
  return (
    <span className="chip chip-din" title="Dinares">
      {valor.toLocaleString('es-MX')}{sufijo}
      {deltas.map((x, i) => (
        <span key={x.id} className={`delta-din ${x.d > 0 ? 'gana' : 'pierde'}`} style={{ '--i': i }} aria-hidden="true">
          {x.d > 0 ? '+' : '−'}{Math.abs(x.d).toLocaleString('es-MX')}
        </span>
      ))}
    </span>
  );
}
