import React, { useEffect, useRef, useState } from 'react';
import { enviar, useJuego } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Dados rojos con puntos blancos, 100 % SVG (caras) sobre un cubo CSS 3D. El servidor decide los valores; el cliente solo anima.
// Todos los clientes ven los mismos dados; cualquiera puede cerrar el resultado y entonces desaparecen para todos (estado.dados = null).
const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]] };
// Colores de dado: rojo = jugadores, amarillo = Yafar (jugador o NPC), azul = asaltantes y demás NPC. Puntos claros o, en el amarillo, oscuros.
const COLORES = {
  rojo: { g: ['#e2383f', '#b3202a', '#7c1018'], borde: '#4a0a10', brillo: '#f08a8f', pip: ['#fff', '#e8dfd0'] },
  amarillo: { g: ['#ffe27a', '#e9b62a', '#b07d0c'], borde: '#6b4a05', brillo: '#fff3c2', pip: ['#4a2e05', '#2a1802'] },
  azul: { g: ['#4f8fe0', '#2459b3', '#123571'], borde: '#0b1f45', brillo: '#9cc3f5', pip: ['#fff', '#dfe8f5'] },
};
export const Cara = ({ v, color = 'rojo' }) => {
  const c = COLORES[color] || COLORES.rojo, id = 'dado-' + color;
  return (
    <svg viewBox="0 0 100 100" className="cara-svg" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.g[0]} /><stop offset=".55" stopColor={c.g[1]} /><stop offset="1" stopColor={c.g[2]} /></linearGradient>
        <radialGradient id={id + '-pip'} cx=".35" cy=".35" r=".8"><stop offset="0" stopColor={c.pip[0]} /><stop offset="1" stopColor={c.pip[1]} /></radialGradient>
      </defs>
      <rect x="3" y="3" width="94" height="94" rx="16" fill={`url(#${id})`} stroke={c.borde} strokeWidth="3" />
      <rect x="7" y="7" width="86" height="86" rx="13" fill="none" stroke={c.brillo} strokeOpacity=".35" strokeWidth="1.5" />
      {PIPS[v].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8.4" fill={`url(#${id}-pip)`} />)}
    </svg>
  );
};
// A quién pertenece cada grupo de dados (por la etiqueta): un jugador (rojo), Yafar (amarillo) u otro NPC (azul).
export function colorGrupo(s, d, g) {
  const etq = g.etq || '';
  const j = Object.values(s.jugadores).find((x) => x.nombre && etq.startsWith(x.nombre));
  if (j) return j.pj === 'B' ? 'amarillo' : 'rojo';
  if (/Yafar/i.test(etq) || (!etq && (d.motivo === 'npc:Yafar'))) return 'amarillo';
  if (!etq) { const por = s.jugadores[d.por]; return por?.pj === 'B' ? 'amarillo' : por && !por.npc ? 'rojo' : 'azul'; }
  return 'azul';
}
const ROT = { 1: 'rotateX(0deg) rotateY(0deg)', 2: 'rotateX(-90deg) rotateY(0deg)', 3: 'rotateX(0deg) rotateY(-90deg)', 4: 'rotateX(0deg) rotateY(90deg)', 5: 'rotateX(90deg) rotateY(0deg)', 6: 'rotateX(0deg) rotateY(180deg)' };
const FACES = [['f1', 'translateZ(var(--m))', 1], ['f2', 'rotateX(90deg) translateZ(var(--m))', 2], ['f3', 'rotateY(90deg) translateZ(var(--m))', 3], ['f4', 'rotateY(-90deg) translateZ(var(--m))', 4], ['f5', 'rotateX(-90deg) translateZ(var(--m))', 5], ['f6', 'rotateY(180deg) translateZ(var(--m))', 6]];
export const RUEDA_MS = 1700;   // lo que tarda en rodar cada fila; las filas ruedan una después de otra

function Cubo({ valor, rodando, idx, color }) {
  return (
    <div className={`dado-escena${rodando ? ' rueda' : ''}`} style={{ '--i': idx }}>
      <div className="dado-sombra" />
      <div className="dado-salto">
        <div className="dado-cubo" style={{ '--fin': ROT[valor] }}>
          {FACES.map(([k, t, n]) => <div key={k} className="dado-cara" style={{ transform: t }}><Cara v={n} color={color} /></div>)}
        </div>
      </div>
    </div>
  );
}

export default function Dados({ s }) {
  const d = s.dados;
  const cartaPrevia = useJuego((x) => x.cartaEnPantalla);
  const [fila, setFila] = useState(-1);          // fila que está rodando; -1 = ninguna (todas fijas)
  const idVisto = useRef(null);
  const nFilas = Math.max(1, d?.grupos?.length || 1);
  useEffect(() => {
    if (!d || !d.lanzado) { setFila(-1); idVisto.current = null; return undefined; }       // espera a que su dueño pulse «Lanzar dados»
    if (idVisto.current === d.id) return undefined;
    idVisto.current = d.id;
    const transcurrido = Math.max(0, s.ahora - d.t0);                      // reloj del servidor: quien se une tarde ve el final
    const total = RUEDA_MS * nFilas;
    if (transcurrido >= total) { setFila(-1); return undefined; }
    const ts = [];
    const primera = Math.floor(transcurrido / RUEDA_MS);
    setFila(primera);
    for (let k = primera + 1; k <= nFilas; k++) ts.push(setTimeout(() => setFila(k < nFilas ? k : -1), k * RUEDA_MS - transcurrido));
    return () => ts.forEach(clearTimeout);
  }, [d?.id, d?.lanzado]);   // eslint-disable-line react-hooks/exhaustive-deps
  const rodando = fila >= 0;
  if (!d) return null;
  const por = s.jugadores[d.por];
  if (s.pend?.mia && !s.pend.respondiste) return null;              // primero tu decisión; los dados esperan detrás
  if (cartaPrevia != null && cartaPrevia < d.id) return null;          // primero se lee la carta que explica la tirada
  if (!d.lanzado) {
    const mio = d.por === s.yo;
    return (
      <div className="modal-fondo dados-modal" role="dialog" aria-modal="true" aria-label="Lanzar los dados">
        <div className="dados-resultado panel">
          <p className="quien">{(d.grupos?.[0]?.etq) || (por?.nombre || 'Banco')}</p>
          {(() => {                                                       // contexto: la carta que provoca esta tirada
            const cerca = s.historial.filter((h) => h.nro < d.id && d.id - h.nro < 12 && h.deck !== 'cuento' && h.deck !== 'trivia');
            const c = (d.contexto && cerca.filter((h) => h.titulo === d.contexto).pop()) || cerca.pop();
            if (d.titulo) return <p className="dados-contexto">{d.titulo}</p>;      // peleas: no las explica ninguna carta
            return c ? <p className="dados-contexto">Por la carta «{c.titulo}»: {c.texto}</p> : d.contexto ? <p className="dados-contexto">Por «{d.contexto}».</p> : null;
          })()}
          {mio ? <button className="btn grande" onClick={() => enviar(ACCIONES.lanzarDados())} ref={(el) => el?.focus({ preventScroll: true })}>Lanzar {d.n > 1 ? 'los dados' : 'el dado'}</button>
            : <><p className="it">Esperando a {por?.nombre || 'alguien'} para lanzar {d.n > 1 ? 'los dados' : 'el dado'}…</p>{s.soyHost && por && !por.conectado && <button className="btn mini sec" onClick={() => enviar(ACCIONES.lanzarDados())}>Lanzar por {por.nombre} (desconectado)</button>}</>}
        </div>
      </div>
    );
  }
  const total = d.valores.reduce((a2, b) => a2 + b, 0);
  const MOTIVOS = { ingreso: 'dado de ingreso', asesinos: 'Los Asesinos', ventana: 'por la ventana', lazo: 'lazo', buza: 'venta de buza', apedreo: 'apedreo', piratas: 'piratas', defensa: 'arco y escudo' };
  const motivo = d.npc || d.motivo.startsWith('npc:') ? `NPC ${d.motivo.startsWith('npc:') ? d.motivo.slice(4) : ''}`.trim() : MOTIVOS[d.motivo] || d.motivo;
  const grupos = d.grupos?.length ? d.grupos : [{ etq: '', valores: d.valores }];
  return (
    <>
      {rodando && (
        <div className="dados-mesa" aria-hidden="true">
          {grupos.slice(0, fila + 1).map((g, gi) => (
            <div key={gi} className={`dados-fila${gi < fila ? ' fija' : ''}`}>
              {g.etq && <span className="dados-fila-etq">{g.etq}</span>}
              <div className="dados-fila-cubos">{g.valores.slice(0, 6).map((v, i) => <Cubo key={d.id + '-' + gi + '-' + i} valor={v} rodando={gi === fila} idx={i} color={colorGrupo(s, d, g)} />)}</div>
            </div>
          ))}
        </div>
      )}
      {!rodando && (
        <div className="modal-fondo dados-modal" role="dialog" aria-modal="true" aria-label="Resultado de los dados">
          <div className="dados-resultado panel">
            {(grupos.length > 1 || !grupos[0].etq || s.enCola > 0) && <p className="quien">{por?.nombre || 'Banco'} · {motivo}{s.enCola ? ` · ${s.enCola} tirada(s) más en cola` : ''}</p>}
            {grupos.map((g, gi) => (
              <div key={gi} className="dados-grupo">
                {g.etq && <p className="etq">{g.etq}</p>}
                <div className="dados-caras">{g.valores.map((v, i) => <div key={i} className="cara-fija"><Cara v={v} color={colorGrupo(s, d, g)} /></div>)}</div>
                {g.valores.length > 1 && d.motivo !== 'pelea' && <p className="suma">Suma {g.valores.reduce((a2, b) => a2 + b, 0)}</p>}
              </div>
            ))}
            {d.sheij && <p className={`aviso-sheij ${d.sheij.ok ? 'si' : 'no'}`} role="status">{d.sheij.texto}</p>}
            {d.resumen?.length > 0 && (                                     // en las peleas el desglose aparece línea por línea
              <ul className={`dados-resumen${d.motivo === 'pelea' ? ' paso-a-paso' : ''}`} role="status">{d.resumen.map((r, i) => <li key={d.id + '-' + i} style={{ '--i': i }} className={/^Gana |vence a|muere|roba|se salva|no se lleva|pierde el duelo/.test(r) ? 'final' : undefined}>{r}</li>)}</ul>
            )}
            {!d.resumen?.length && grupos.length === 1 && <p className="total" role="status">{d.valores.length > 1 ? `Suma: ${total}` : `Salió ${total}`}</p>}
            <button className="btn" onClick={() => enviar(ACCIONES.cerrarDados())} ref={(el) => el?.focus({ preventScroll: true })}>Cerrar para todos</button>
          </div>
        </div>
      )}
    </>
  );
}
