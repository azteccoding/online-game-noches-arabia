import React, { useEffect, useRef, useState } from 'react';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Decisión pendiente (pend del motor): defensa en una pelea, trato, elegir objetos, contratos, etc. Solo la ve quien debe decidir;
// los demás ven un aviso «esperando a…». Si se agota el tiempo el servidor decide por la opción por defecto.
function useRestante(s) {
  const p = s.pend;
  const ancla = useRef({ id: null, ahora: 0, local: 0 });
  if (p && (ancla.current.id !== p.id || ancla.current.ahora !== s.ahora)) ancla.current = { id: p.id, ahora: s.ahora, local: Date.now() };
  const [, fuerza] = useState(0);
  useEffect(() => { if (!p) return undefined; const iv = setInterval(() => fuerza((x) => x + 1), 500); return () => clearInterval(iv); }, [p?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return 0;
  const transcurrido = s.ahora - p.t0 + (Date.now() - ancla.current.local);
  return Math.max(0, Math.ceil((p.limiteMs - transcurrido) / 1000));
}

export default function Decision({ s }) {
  const p = s.pend;
  const resta = useRestante(s);
  const [sel, setSel] = useState([]);
  const [num, setNum] = useState(0);
  useEffect(() => { setSel([]); setNum(p?.min ?? 0); }, [p?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null;
  const nombres = (ids) => ids.map((x) => s.jugadores[x]?.nombre || x).join(', ');
  if (!p.mia || p.respondiste) {
    return <div className="espera-pend" role="status">{p.respondiste ? 'Respuesta enviada. ' : ''}Esperando a {nombres(p.faltan)} · {p.titulo}</div>;
  }
  const responder = (r) => enviar(ACCIONES.decidir(p.id, r));
  const pct = Math.min(100, Math.max(0, (resta / (p.limiteMs / 1000)) * 100));
  const nMin = p.min ?? 0, nMax = p.max ?? 6;
  return (
    <div className="modal-fondo decision-fondo" role="dialog" aria-modal="true" aria-label={p.titulo}>
      <div className="panel decision">
        <h2>{p.titulo}</h2>
        {p.texto && <p className="decision-texto">{p.texto}</p>}
        {p.para.length > 1 && <p className="it">Deciden: {nombres(p.para)}{p.faltan.length ? ` · faltan ${nombres(p.faltan)}` : ''}</p>}
        {p.modo === 'multi' ? (
          <>
            <ul className="decision-opc" role="group">
              {p.opciones.map((o) => (
                <li key={o.id}>
                  <label className={`chk-opc${sel.includes(o.id) ? ' on' : ''}${o.desactivada ? ' off' : ''}`}>
                    <input type="checkbox" disabled={o.desactivada} checked={sel.includes(o.id)} onChange={(e) => setSel((a) => (e.target.checked ? (p.max != null && a.length >= p.max ? a : [...a, o.id]) : a.filter((x) => x !== o.id)))} />
                    <span>{o.texto}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="it">{p.min ? `Elige al menos ${p.min}` : 'Elige los que quieras'}{p.max != null ? ` (máximo ${p.max})` : ''}.</p>
            <button className="btn" disabled={sel.length < nMin} onClick={() => responder({ valores: sel })}>Confirmar{sel.length ? ` (${sel.length})` : ' sin elegir'}</button>
          </>
        ) : p.modo === 'numero' ? (
          <>
            <div className="decision-num">
              <button className="btn mini sec" onClick={() => setNum((n) => Math.max(nMin, n - 1))} aria-label="Menos">−</button>
              <input type="number" min={nMin} max={nMax} value={num} onChange={(e) => setNum(Math.min(nMax, Math.max(nMin, Math.floor(Number(e.target.value) || 0))))} aria-label="Número" />
              <button className="btn mini sec" onClick={() => setNum((n) => Math.min(nMax, n + 1))} aria-label="Más">+</button>
            </div>
            <p className="it">Entre {nMin} y {nMax}.</p>
            <button className="btn" onClick={() => responder({ numero: num })}>Confirmar</button>
          </>
        ) : (
          <div className="decision-botones">
            {p.opciones.map((o) => <button key={o.id} className="btn" disabled={o.desactivada} onClick={() => responder({ opcion: o.id })}>{o.texto}</button>)}
          </div>
        )}
        <div className="barra-decision" aria-hidden="true"><i style={{ width: pct + '%' }} /></div>
        <p className="it nota">Si no respondes en {resta} s, el servidor elige por ti la opción más prudente.</p>
      </div>
    </div>
  );
}
