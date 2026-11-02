import React, { useEffect, useRef, useState } from 'react';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Dados rojos con puntos blancos, 100 % SVG (caras) sobre un cubo CSS 3D. El servidor decide los valores; el cliente solo anima.
// Todos los clientes ven los mismos dados; cualquiera puede cerrar el resultado y entonces desaparecen para todos (estado.dados = null).
const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]] };
export const Cara = ({ v }) => (
  <svg viewBox="0 0 100 100" className="cara-svg" aria-hidden="true">
    <defs>
      <linearGradient id="dadoRojo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e2383f" /><stop offset=".55" stopColor="#b3202a" /><stop offset="1" stopColor="#7c1018" /></linearGradient>
      <radialGradient id="dadoPip" cx=".35" cy=".35" r=".8"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#e8dfd0" /></radialGradient>
    </defs>
    <rect x="3" y="3" width="94" height="94" rx="16" fill="url(#dadoRojo)" stroke="#4a0a10" strokeWidth="3" />
    <rect x="7" y="7" width="86" height="86" rx="13" fill="none" stroke="#f08a8f" strokeOpacity=".35" strokeWidth="1.5" />
    {PIPS[v].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8.4" fill="url(#dadoPip)" />)}
  </svg>
);
const ROT = { 1: 'rotateX(0deg) rotateY(0deg)', 2: 'rotateX(-90deg) rotateY(0deg)', 3: 'rotateX(0deg) rotateY(-90deg)', 4: 'rotateX(0deg) rotateY(90deg)', 5: 'rotateX(90deg) rotateY(0deg)', 6: 'rotateX(0deg) rotateY(180deg)' };
const FACES = [['f1', 'translateZ(var(--m))', 1], ['f2', 'rotateX(90deg) translateZ(var(--m))', 2], ['f3', 'rotateY(90deg) translateZ(var(--m))', 3], ['f4', 'rotateY(-90deg) translateZ(var(--m))', 4], ['f5', 'rotateX(-90deg) translateZ(var(--m))', 5], ['f6', 'rotateY(180deg) translateZ(var(--m))', 6]];

function Cubo({ valor, rodando, idx }) {
  return (
    <div className={`dado-escena${rodando ? ' rueda' : ''}`} style={{ '--i': idx }}>
      <div className="dado-sombra" />
      <div className="dado-salto">
        <div className="dado-cubo" style={{ '--fin': ROT[valor] }}>
          {FACES.map(([k, t, n]) => <div key={k} className="dado-cara" style={{ transform: t }}><Cara v={n} /></div>)}
        </div>
      </div>
    </div>
  );
}

export default function Dados({ s }) {
  const d = s.dados;
  const [rodando, setRodando] = useState(false);
  const idVisto = useRef(null);
  useEffect(() => {
    if (!d) { setRodando(false); idVisto.current = null; return undefined; }
    if (!d.lanzado) { setRodando(false); idVisto.current = null; return undefined; }       // espera a que su dueño pulse «Lanzar dados»
    if (idVisto.current === d.id) return undefined;
    idVisto.current = d.id;
    const transcurrido = Math.max(0, s.ahora - d.t0);                      // reloj del servidor: quien se une tarde ve el final
    const resto = 1700 - transcurrido;
    if (resto <= 0) { setRodando(false); return undefined; }
    setRodando(true);
    const t = setTimeout(() => setRodando(false), resto);
    return () => clearTimeout(t);
  }, [d?.id, d?.lanzado]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const por = s.jugadores[d.por];
  if (!d.lanzado) {
    const mio = d.por === s.yo;
    return (
      <div className="modal-fondo dados-modal" role="dialog" aria-modal="true" aria-label="Lanzar los dados">
        <div className="dados-resultado panel">
          <p className="quien">{(d.grupos?.[0]?.etq) || (por?.nombre || 'Banco')}</p>
          {mio ? <button className="btn grande" onClick={() => enviar(ACCIONES.lanzarDados())} ref={(el) => el?.focus({ preventScroll: true })}>Lanzar {d.n > 1 ? 'los dados' : 'el dado'}</button>
            : <p className="it">{por?.nombre || 'Alguien'} va a lanzar {d.n > 1 ? 'los dados' : 'el dado'}…</p>}
        </div>
      </div>
    );
  }
  const total = d.valores.reduce((a2, b) => a2 + b, 0);
  const MOTIVOS = { ingreso: 'dado de ingreso', asesinos: 'Los Asesinos', ventana: 'por la ventana', lazo: 'lazo', buza: 'venta de buza', apedreo: 'apedreo', piratas: 'piratas' };
  const motivo = d.npc || d.motivo.startsWith('npc:') ? `NPC ${d.motivo.startsWith('npc:') ? d.motivo.slice(4) : ''}`.trim() : MOTIVOS[d.motivo] || d.motivo;
  const grupos = d.grupos?.length ? d.grupos : [{ etq: '', valores: d.valores }];
  return (
    <>
      <div className="dados-mesa" aria-hidden={!rodando}>{d.valores.slice(0, 8).map((v, i) => <Cubo key={d.id + '-' + i} valor={v} rodando={rodando} idx={i} />)}</div>
      {!rodando && (
        <div className="modal-fondo dados-modal" role="dialog" aria-modal="true" aria-label="Resultado de los dados">
          <div className="dados-resultado panel">
            {(grupos.length > 1 || !grupos[0].etq || s.enCola > 0) && <p className="quien">{por?.nombre || 'Banco'} · {motivo}{s.enCola ? ` · ${s.enCola} tirada(s) más en cola` : ''}</p>}
            {grupos.map((g, gi) => (
              <div key={gi} className="dados-grupo">
                {g.etq && <p className="etq">{g.etq}</p>}
                <div className="dados-caras">{g.valores.map((v, i) => <div key={i} className="cara-fija"><Cara v={v} /></div>)}</div>
                {g.valores.length > 1 && <p className="suma">Suma {g.valores.reduce((a2, b) => a2 + b, 0)}</p>}
              </div>
            ))}
            {d.resumen?.length > 0 && <ul className="dados-resumen" role="status">{d.resumen.map((r, i) => <li key={i}>{r}</li>)}</ul>}
            {!d.resumen?.length && grupos.length === 1 && <p className="total" role="status">{d.valores.length > 1 ? `Suma: ${total}` : `Salió ${total}`}</p>}
            <button className="btn" onClick={() => enviar(ACCIONES.cerrarDados())} ref={(el) => el?.focus({ preventScroll: true })}>Cerrar para todos</button>
          </div>
        </div>
      )}
    </>
  );
}
