import React, { useEffect, useRef, useState } from 'react';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Mensajes privados entre jugadores (Jorge, 7 de noviembre): tres frases fijas y solo las ve el destinatario.
// «Quiero comprarte» solo ofrece lo que se sabe que tiene el otro (lo público), nunca lo que nadie sabe.
const CIUDADES = ['Bagdad', 'Damasco', 'Aleppo', 'Basra', 'Estambul', 'Yemen', 'El Cairo', 'Isfahán', 'Samarcanda', 'India', 'Magreb', 'Andalucía'];
const conPropuesta = (m) => m.tipo === 'vender' || m.tipo === 'comprar' || (m.tipo === 'respuesta' && m.resp === 'interesada');
// Los tratos solo se cierran en la misma ciudad (R 8.6): a distancia el chat sirve para quedar de verse.
const juntos = (s, otro) => s.jugadores[otro]?.ciudad === s.jugadores[s.yo]?.ciudad && !s.jugadores[otro]?.transito && !s.jugadores[s.yo]?.transito;
function BotonPropuesta({ s, otro, onAbrir }) {
  const ok = juntos(s, otro);
  return <>{ok ? <button className="btn mini sec" onClick={onAbrir}>Abrir propuesta</button>
    : <small className="it">Tienen que estar en la misma ciudad para comerciar ({s.jugadores[otro]?.nombre} está en {s.jugadores[otro]?.ciudad}).</small>}</>;
}
const RESPUESTAS = [{ id: 'sarcastica', texto: '¡Qué bueno! Bien por ti.' }, { id: 'sincera', texto: '¿Necesitas ayuda?' }, { id: 'interesada', texto: 'Sí, pero lleva buena morralla.' }];
function Responder({ m, despues }) {
  if (m.tipo !== 'vender' || m.respondido) return null;
  return <div className="chat-resp">{RESPUESTAS.map((r) => <button key={r.id} className="btn mini sec" onClick={() => { enviar(ACCIONES.chat(m.de, 'responder', { a: m.id, resp: r.id })); despues?.(); }}>{r.texto}</button>)}</div>;
}
const hora = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
// Mensajes leídos: se guarda el último id visto (por sala y jugador) y se avisa a la barra para quitar el circulito.
const claveLeido = (s) => `mun.chatLeido.${s.codigo}.${s.yo}`;
export const ultimoLeido = (s) => { try { return Number(localStorage.getItem(claveLeido(s))) || 0; } catch { return 0; } };
export const noLeidos = (s) => (s.chat || []).filter((m) => m.para === s.yo && m.id > ultimoLeido(s)).length;
function marcarLeidos(s) {
  const max = Math.max(0, ...(s.chat || []).filter((m) => m.para === s.yo).map((m) => m.id));
  try { if (max > ultimoLeido(s)) { localStorage.setItem(claveLeido(s), String(max)); window.dispatchEvent(new Event('chat-leido')); } } catch { /* sin almacenamiento */ }
}

export function PanelChat({ s, onCerrar, abrir }) {
  const otros = Object.values(s.jugadores).filter((j) => j.id !== s.yo && j.pj && !j.npc && !j.eliminado);
  const [para, setPara] = useState(otros[0]?.id || '');
  const [tipo, setTipo] = useState('ire');
  const [ciudad, setCiudad] = useState(CIUDADES[0]);
  const [uid, setUid] = useState('');
  const opciones = tipo === 'vender' ? s.miMano || [] : tipo === 'comprar' ? s.publicas?.[para] || [] : [];
  useEffect(() => { setUid(opciones[0]?.uid ?? ''); }, [tipo, para]);   // eslint-disable-line react-hooks/exhaustive-deps
  const puede = para && (tipo === 'ire' || opciones.some((o) => String(o.uid) === String(uid)));
  const mandar = () => enviar(ACCIONES.chat(para, tipo, tipo === 'ire' ? { ciudad } : { uid }));
  const lista = (s.chat || []).slice().reverse();
  useEffect(() => { marcarLeidos(s); }, [s.chat?.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nomPara = s.jugadores[para]?.nombre || '';
  const TIPOS = [
    { id: 'ire', texto: 'Iré a…', no: null },
    { id: 'vender', texto: 'Quiero venderte…', no: (s.miMano || []).length ? null : 'No tienes nada que vender' },
    { id: 'comprar', texto: 'Quiero comprarte…', no: (s.publicas?.[para] || []).length ? null : `${nomPara} no tiene nada a la vista` },
  ];
  useEffect(() => { if (TIPOS.find((x) => x.id === tipo)?.no) setTipo('ire'); }, [para]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="hoja-modal panel" role="dialog" aria-label="Mensajes">
      <div className="desp-cab"><h2>Mensajes</h2><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo chat">
        {!otros.length ? <p className="it">No hay otros jugadores a quienes escribir.</p> : (
          <div className="chat-form">
            <label>Para <select value={para} onChange={(e) => setPara(e.target.value)}>{otros.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}</select></label>
            <div className="chat-tipos" role="radiogroup" aria-label="Mensaje">
              {TIPOS.map((x) => (
                <button key={x.id} role="radio" aria-checked={tipo === x.id} className={`btn mini${tipo === x.id ? ' on' : ' sec'}`} disabled={!!x.no} title={x.no || ''} onClick={() => setTipo(x.id)}>
                  {x.texto}{x.no && <small className="it"> ({x.no})</small>}
                </button>
              ))}
            </div>
            {tipo === 'ire' && <label>Ciudad <select value={ciudad} onChange={(e) => setCiudad(e.target.value)}>{CIUDADES.map((c) => <option key={c}>{c}</option>)}</select></label>}
            {tipo !== 'ire' && (opciones.length
              ? <label>{tipo === 'vender' ? 'Lo que tienes' : `Lo que se sabe que tiene ${s.jugadores[para]?.nombre || ''}`} <select value={uid} onChange={(e) => setUid(e.target.value)}>{opciones.map((o) => <option key={o.uid} value={o.uid}>{o.titulo}</option>)}</select></label>
              : <p className="it">{tipo === 'vender' ? 'No tienes cartas que ofrecer.' : 'No se sabe que tenga nada a la vista.'}</p>)}
            <button className="btn" disabled={!puede} onClick={mandar}>Enviar</button>
          </div>
        )}
        <h3 className="sub-h">Recibidos y enviados</h3>
        {!lista.length && <p className="it">Todavía no hay mensajes.</p>}
        <ul className="chat-lista">
          {lista.map((m) => (
            <li key={m.id} className={m.de === s.yo ? 'mio' : 'suyo'}>
              <small>{m.de === s.yo ? `Tú a ${s.jugadores[m.para]?.nombre}` : `${s.jugadores[m.de]?.nombre} te escribe`} · {hora(m.t)}</small>
              <span>{m.texto}</span>
              {m.de !== s.yo && <Responder m={m} />}
              {m.de !== s.yo && conPropuesta(m) && <BotonPropuesta s={s} otro={m.de} onAbrir={() => { onCerrar(); abrir('mercado-tratos'); }} />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Aviso de mensaje nuevo para el destinatario (aparece sobre el tablero hasta que lo cierra).
export function AvisoChat({ s, abrir }) {
  const recibidos = (s.chat || []).filter((m) => m.para === s.yo);
  const ultimo = recibidos[recibidos.length - 1];
  const visto = useRef(ultimo?.id ?? 0);
  const [aviso, setAviso] = useState(null);
  useEffect(() => { if (ultimo && ultimo.id > visto.current) { visto.current = ultimo.id; setAviso(ultimo); } }, [ultimo?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!aviso) return null;
  return (
    <div className="aviso-chat panel" role="status" aria-live="polite">
      <p><b>{s.jugadores[aviso.de]?.nombre}</b> te escribe: {aviso.texto}</p>
      <Responder m={aviso} despues={() => setAviso(null)} />
      <div className="fila-btn">
        {conPropuesta(aviso) && <BotonPropuesta s={s} otro={aviso.de} onAbrir={() => { setAviso(null); abrir('mercado-tratos'); }} />}
        <button className="btn mini sec" onClick={() => { setAviso(null); abrir('chat'); }}>Ver mensajes</button>
        <button className="btn mini sec" onClick={() => setAviso(null)}>Cerrar</button>
      </div>
    </div>
  );
}
