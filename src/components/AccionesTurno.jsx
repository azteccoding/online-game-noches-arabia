import React, { useState } from 'react';
import { DATA } from '../game/data.js';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

const nom = (s, id) => s.jugadores[id]?.nombre || id;
const TIPO_ATAQUE = { robo: ['Robar a', 'Asalto: sin armas ni gritos, se resuelve con dados (R 12).'], matar: ['Atacar a muerte a', 'Pelea a muerte: quien pierde es eliminado (R 11).'], duelo: ['Desafiar a duelo a', 'Duelo: pelea limpia; el perdedor paga o queda herido (R 11).'] };

function Objetivo({ s, ids, valor, onChange }) {
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)} aria-label="Objetivo">
      {ids.map((x) => <option key={x} value={x}>{nom(s, x)}</option>)}
    </select>
  );
}

// Formulario de uso de un objeto / carta de la mano (lazo, transporte, ifrit, cuaderno de ruta…). `a` es la entrada k:'usar' de s.acciones.
export function UsarCarta({ s, a, etiqueta }) {
  const carta = s.mano.find((c) => c.uid === a.uid);
  const [obj, setObj] = useState(a.objetivos?.[0] || '');
  const [dest, setDest] = useState(a.destinos?.[0] || '');
  const [deseo, setDeseo] = useState(a.ifrit?.[0] || '');
  const plazos = carta?.ref === 'OB31' ? [...(s.mensaje ? [{ v: 'mensaje', t: 'Mensaje del sheij' }] : []), ...s.misiones.map((m, i) => (m.turnosRestantes != null ? { v: i, t: `${m.id} · ${m.nombre}` } : null)).filter(Boolean)] : null;
  const [mision, setMision] = useState(plazos?.[0]?.v ?? '');
  const enviarUso = () => {
    const x = {};
    if (a.objetivos) x.objetivo = obj;
    if (a.destinos) x.destino = dest;
    if (a.ifrit) x.deseo = deseo;
    if (plazos) x.mision = mision;
    if (a.via) x.via = a.via;
    enviar(ACCIONES.usar(a.uid, x));
  };
  return (
    <div className="accion-fila">
      <div className="accion-txt"><b>{etiqueta || a.titulo}</b>
        {a.ifrit && <small>{DATA.objetos.ifrit.deseos[deseo]}</small>}
      </div>
      <div className="accion-ctl">
        {a.objetivos && <Objetivo s={s} ids={a.objetivos} valor={obj} onChange={setObj} />}
        {a.destinos && <select value={dest} onChange={(e) => setDest(e.target.value)} aria-label="Destino">{a.destinos.map((d) => <option key={d}>{d}</option>)}</select>}
        {a.ifrit && <select value={deseo} onChange={(e) => setDeseo(e.target.value)} aria-label="Deseo">{a.ifrit.map((d) => <option key={d} value={d}>Deseo {d}</option>)}</select>}
        {plazos && <select value={mision} onChange={(e) => setMision(e.target.value)} aria-label="Plazo a ampliar">{plazos.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}</select>}
        <button className="btn mini" disabled={(plazos && !plazos.length) || !!s.pend || !!s.dados} onClick={enviarUso}>Usar</button>
      </div>
    </div>
  );
}

function Atacar({ s, a }) {
  const [obj, setObj] = useState(a.objetivos[0]);
  const [din, setDin] = useState(0);
  const [noc, setNoc] = useState(0);
  const mi = s.jugadores[s.yo];
  const nur = mi.pj === '1' && a.tipo === 'duelo' && ['El Cairo', 'Damasco', 'Aleppo'].includes(mi.ciudad);
  const [t, ayuda] = TIPO_ATAQUE[a.tipo];
  return (
    <div className="accion-fila">
      <div className="accion-txt"><b>{t}…</b><small>{ayuda}</small>
        {nur && <small>Nur al Din (honor): puedes pedir una indemnización si ganas.</small>}</div>
      <div className="accion-ctl">
        <Objetivo s={s} ids={a.objetivos} valor={obj} onChange={setObj} />
        {nur && <><input type="number" min="0" value={din} onChange={(e) => setDin(e.target.value)} aria-label="Dinares que pides" title="Dinares que pides" style={{ width: 70 }} /><input type="number" min="0" value={noc} onChange={(e) => setNoc(e.target.value)} aria-label="Noches que pides" title="Noches que pides" style={{ width: 70 }} /></>}
        <button className="btn mini" disabled={!!s.pend || !!s.dados} onClick={() => enviar(ACCIONES.atacar(a.tipo, obj, nur ? { pedirDinares: Number(din), pedirNoches: Number(noc) } : {}))}>{a.tipo === 'robo' ? 'Robar' : a.tipo === 'matar' ? 'Atacar' : 'Desafiar'}</button>
      </div>
    </div>
  );
}

function Reto({ a, s }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="accion-fila reto">
      <div className="accion-txt">
        <b>{a.titulo}</b>
        {a.premio && <small>Premio: {typeof a.premio === 'string' ? a.premio : JSON.stringify(a.premio)}</small>}
        {a.bloqueado && <small className="error">{a.bloqueado}</small>}
        {ver && <small>{a.texto}{a.requisito ? ` · Requisito: ${a.requisito}` : ''}</small>}
      </div>
      <div className="accion-ctl">
        {(a.texto || a.requisito) && <button className="btn mini sec" onClick={() => setVer((v) => !v)}>{ver ? 'Menos' : 'Detalles'}</button>}
        <button className="btn mini" disabled={!!a.bloqueado || !!s.pend || !!s.dados} onClick={() => enviar(ACCIONES.reto(a.id, a.sub))}>{a.sub === 'pagar' ? 'Pagar' : 'Intentar'}</button>
      </div>
    </div>
  );
}

function Personaje({ a, s }) {
  const [con, setCon] = useState(a.objetivos?.[0] || '');
  const [precio, setPrecio] = useState(30);
  return (
    <div className="accion-fila">
      <div className="accion-txt"><b>{a.titulo}</b>{a.texto && <small>{a.texto}</small>}</div>
      <div className="accion-ctl">
        {a.objetivos && <Objetivo s={s} ids={a.objetivos} valor={con} onChange={setCon} />}
        {a.pidePrecio && <input type="number" min="0" max="200" value={precio} onChange={(e) => setPrecio(e.target.value)} aria-label="Precio en dinares" title="Precio en dinares" style={{ width: 80 }} />}
        <button className="btn mini" disabled={!!s.pend || !!s.dados} onClick={() => enviar(ACCIONES.pj(a.sub, { con, precio: Number(precio) }))}>Hacerlo</button>
      </div>
    </div>
  );
}

function Tesoro({ s, mi, mt }) {
  const [monto, setMonto] = useState(10);
  const puedeEsc = mt && mi.pj !== 'B' && !mi.perdido && mi.dinares > 0;
  return (
    <>
      {puedeEsc && (
        <div className="accion-fila">
          <div className="accion-txt"><b>Esconder dinares</b><small>Guardas dinares en esta ciudad (ya visitada) y recibes un mapa. Recupéralos aquí cuando quieras.</small></div>
          <div className="accion-ctl"><input type="number" min="1" max={mi.dinares} value={monto} onChange={(e) => setMonto(e.target.value)} aria-label="Dinares a esconder" style={{ width: 80 }} />
            <button className="btn mini" disabled={!!s.pend} onClick={() => enviar(ACCIONES.esconder(Number(monto)))}>Esconder</button></div>
        </div>
      )}
      {mt && mi.escondido > 0 && (
        <div className="accion-fila"><div className="accion-txt"><b>Recuperar el tesoro escondido</b><small>Tienes {mi.escondido} dinares escondidos (solo si estás en la ciudad donde los dejaste).</small></div>
          <div className="accion-ctl"><button className="btn mini" disabled={!!s.pend} onClick={() => enviar(ACCIONES.recuperar())}>Recuperar</button></div></div>
      )}
    </>
  );
}

function OfrecerCinco({ s, ids }) {
  const [a, setA] = useState(ids[0]);
  return (
    <div className="accion-fila">
      <div className="accion-txt"><b>Ofrecer 5 dinares</b><small>Gesto de cortesía (cuenta para ciertos encargos de los sheijs).</small></div>
      <div className="accion-ctl"><Objetivo s={s} ids={ids} valor={a} onChange={setA} /><button className="btn mini" disabled={!!s.pend || s.jugadores[s.yo].dinares < 5} onClick={() => enviar(ACCIONES.ofrecer5(a))}>Ofrecer</button></div>
    </div>
  );
}

const SECCIONES = [['atacar', 'Combate y robos'], ['reto', 'Retos y misiones'], ['pj', 'Tu personaje'], ['tesoro', 'Tesoros y Jorasán'], ['asesinos', 'Los Asesinos'], ['usar', 'Usar objetos']];

export default function AccionesTurno({ s, onCerrar }) {
  const mi = s.jugadores[s.yo];
  const mt = s.turno?.pid === s.yo && s.fase === 'juego';
  const lista = s.acciones;
  const aqui = Object.values(s.jugadores).filter((j) => j.id !== s.yo && j.ciudad === mi.ciudad && j.pj && !j.eliminado && !j.npc && !j.transito).map((j) => j.id);
  const hay = (k) => lista.filter((a) => a.k === k);
  const principalUsada = mt && s.turno.principal;
  return (
    <div className="hoja-modal panel" role="dialog" aria-label="Acciones del turno">
      <div className="desp-cab"><h2>Acciones</h2>{mt && <span className="chip">{principalUsada ? 'Acción principal usada' : 'Una acción principal por turno'}</span>}<button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo">
        {!mt && <p className="it">Las acciones se habilitan en tu turno. Mientras tanto puedes mirar el mercado, tu mano y tus misiones.</p>}
        {mt && s.turno.fase === 'ingreso' && <p className="it">Primero tira el dado de ingreso.</p>}
        {SECCIONES.map(([k, titulo]) => {
          const xs = hay(k);
          if (!xs.length && k !== 'tesoro') return null;
          if (k === 'tesoro' && !xs.length && !(mt && s.turno.fase !== 'ingreso')) return null;
          return (
            <section key={k} className="accion-sec">
              <h3 className="sub-h">{titulo}</h3>
              {xs.map((a, i) => {
                if (k === 'atacar') return <Atacar key={a.tipo} s={s} a={a} />;
                if (k === 'reto') return <Reto key={a.id + (a.sub || '') + i} s={s} a={a} />;
                if (k === 'pj') return <Personaje key={a.sub} s={s} a={a} />;
                if (k === 'usar') return <UsarCarta key={a.uid + (a.via || '')} s={s} a={a} />;
                return (
                  <div key={k + i} className="accion-fila">
                    <div className="accion-txt"><b>{a.titulo}</b>{a.texto && <small>{a.texto}</small>}</div>
                    <div className="accion-ctl"><button className="btn mini" disabled={!!s.pend || !!s.dados} onClick={() => enviar(k === 'asesinos' ? ACCIONES.asesinos() : ACCIONES.tesoro(a.sub, { uid: a.uid, via: a.via }))}>{k === 'asesinos' ? 'Contratar' : 'Hacerlo'}</button></div>
                  </div>
                );
              })}
              {k === 'tesoro' && <Tesoro s={s} mi={mi} mt={mt && s.turno.fase !== 'ingreso'} />}
            </section>
          );
        })}
        {mt && s.turno.fase !== 'ingreso' && aqui.length > 0 && <section className="accion-sec"><h3 className="sub-h">Con otros jugadores</h3><OfrecerCinco s={s} ids={aqui} /><p className="it">Para comerciar usa Mercado → Tratos.</p></section>}
        {mt && !lista.some((a) => !['viajar', 'terminarTurno', 'cc', 'tirarDados'].includes(a.k)) && s.turno.fase !== 'ingreso' && <p className="it">No hay acciones especiales disponibles aquí. Puedes viajar, comprar o vender, o terminar el turno.</p>}
      </div>
    </div>
  );
}
