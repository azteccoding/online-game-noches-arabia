import React, { useEffect, useRef, useState } from 'react';
import { enviar, useJuego } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';
import { decisionVisible, estadoDeseo } from '../game/orden.js';
import { escenaActual } from '../game/escena3d.js';

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
  const leyendo = useJuego((x) => x.cartaEnPantalla);
  const porLeer = useJuego((x) => x.cartaPorLeer);
  const ifritFuera = useJuego((x) => x.ifritFuera);
  const deseoAbierto = useJuego((x) => x.deseoAbierto);
  const [sel, setSel] = useState([]);
  const [num, setNum] = useState(0);
  useEffect(() => { setSel([]); setNum(p?.min ?? 0); }, [p?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null;
  const genio = estadoDeseo({ pend: p, en3d: !!escenaActual(), ifritFuera, deseoAbierto });
  if (genio === 'genio' || genio === 'boton') return null;   // el genio sale con la pantalla despejada; la ventana, solo con «Pedir un deseo»
  const nombres = (ids) => ids.map((x) => s.jugadores[x]?.nombre || x).join(', ');
  if (!p.mia || p.respondiste) {
    return <div className="espera-pend" role="status">{p.respondiste ? 'Respuesta enviada. ' : ''}Esperando a {nombres(p.faltan)} · {p.titulo}{p.subasta ? ` · puja más alta: ${p.subasta.mejor || 'ninguna'} · quedan ${resta} s` : ''}</div>;
  }
  // Jorge (19 de noviembre): los botones de una decisión nunca salen antes que la carta que la provoca ni antes de los dados:
  // primero se lee (y se cierra) la carta, luego se lanzan y se cierran los dados, y solo entonces se elige.
  // Y ninguna decisión sale encima de una carta, aunque la carta sea posterior (p. ej. la Temporada de especias al llegar a Basra con
  // la Carta de Trivias de la llegada): primero se cierran todas las cartas por leer.
  if (!decisionVisible({ leyendo, porLeer, dados: s.dados, yo: s.yo })) return null;
  const responder = (r) => enviar(ACCIONES.decidir(p.id, r));
  const pct = Math.min(100, Math.max(0, (resta / (p.limiteMs / 1000)) * 100));
  const nMin = p.min ?? 0, nMax = p.tipo === 'subasta' ? Math.max(0, Math.min(p.max ?? 0, s.jugadores[s.yo]?.dinares ?? 0)) : (p.max ?? 6);   // subasta: puja libre, hasta lo que tienes
  return (
    <div className={`modal-fondo decision-fondo${genio === 'ventana' ? ' decision-genio' : ''}`} role="dialog" aria-modal="true" aria-label={p.titulo}>
      <div className="panel decision">
        <h2>{p.titulo}</h2>
        {p.texto && <p className="decision-texto">{p.texto}</p>}
        {p.subasta && <p className="it"><b>{p.subasta.mejor ? `Puja más alta por ahora: ${p.subasta.mejor} dinares` : 'Nadie ha pujado todavía'}</b> · tienes {s.jugadores[s.yo]?.dinares} dinares (no puedes pujar más de lo que tienes).</p>}
        {p.para.length > 1 && <p className="it">Deciden: {nombres(p.para)}{p.faltan.length ? ` · faltan ${nombres(p.faltan)}` : ''}</p>}
        {p.modo === 'multi' ? (
          <>
            <ul className={`decision-opc${p.tipo === 'numeros' ? ' decision-numeros' : ''}`} role="group">
              {p.opciones.map((o) => (
                <li key={o.id}>
                  <label className={`chk-opc${sel.includes(o.id) ? ' on' : ''}${o.desactivada ? ' off' : ''}`}>
                    <input type="checkbox" disabled={o.desactivada} checked={sel.includes(o.id)} onChange={(e) => setSel((a) => (e.target.checked ? (p.max === 1 ? [o.id] : p.max != null && a.length >= p.max ? a : [...a, o.id]) : a.filter((x) => x !== o.id)))} />
                    <span>{o.texto}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="it">{p.min === 1 && p.max === 1 ? 'Elige uno (si tocas otro, cambia).' : <>{p.min ? `Elige al menos ${p.min}` : 'Elige los que quieras'}{p.max != null ? ` (máximo ${p.max})` : ''}.}</>}</p>
            <button className="btn" disabled={sel.length < nMin} onClick={() => responder({ valores: sel })}>Confirmar{sel.length ? ` (${sel.length})` : ' sin elegir'}</button>
          </>
        ) : p.modo === 'numero' ? (
          <>
            <div className="decision-num">
              <button className="btn mini sec" onClick={() => setNum((n) => Math.max(nMin, n - 1))} aria-label="Menos">−</button>
              <input type="number" min={nMin} max={nMax} value={num} onChange={(e) => setNum(Math.min(nMax, Math.max(nMin, Math.floor(Number(e.target.value) || 0))))} aria-label="Número" />
              <button className="btn mini sec" onClick={() => setNum((n) => Math.min(nMax, n + 1))} aria-label="Más">+</button>
            </div>
            <p className="it">{p.nota || `Entre ${nMin} y ${nMax}.`}</p>
            <button className="btn" onClick={() => responder({ numero: num })}>Confirmar</button>
          </>
        ) : (
          <div className="decision-botones">
            {p.opciones.map((o) => <button key={o.id} className="btn" disabled={o.desactivada || (p.tipo === 'subasta' && Number(o.id) > (s.jugadores[s.yo]?.dinares ?? 0))} onClick={() => responder({ opcion: o.id })}>{o.texto}</button>)}
          </div>
        )}
        <div className="barra-decision" aria-hidden="true"><i style={{ width: pct + '%' }} /></div>
        <p className="it nota">Si no respondes en {resta} s, el servidor elige por ti la opción más prudente.</p>
      </div>
    </div>
  );
}
