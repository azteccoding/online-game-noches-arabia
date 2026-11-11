import React, { useState } from 'react';
import { DATA } from '../game/data.js';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';
import { confirmarViajeBurro } from '../game/burro.js';
import { useBloqueo } from '../hooks/useBloqueo.js';

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
  const plazos = carta?.ref === 'OB31' ? [...(s.mensajes || []).filter((m) => m.turnoLimite != null).map((m) => ({ v: 'mensaje:' + m.id, t: `Mensaje de ${m.carta.titulo}` })), ...s.misiones.map((m, i) => (m.turnosRestantes != null ? { v: i, t: `${m.id} · ${m.nombre}` } : null)).filter(Boolean)] : null;
  const [mision, setMision] = useState(plazos?.[0]?.v ?? '');
  const enviarUso = () => {
    const x = {};
    if (a.objetivos) x.objetivo = obj;
    if (a.destinos) x.destino = dest;
    if (a.ifrit) x.deseo = deseo;
    if (plazos) x.mision = mision;
    if (a.via) x.via = a.via;
    if (x.destino && !confirmarViajeBurro(s, x.destino)) return;   // el burro muere fuera de su zona
    enviar(ACCIONES.usar(a.uid, x));
  };
  return (
    <div className="accion-fila">
      <div className="accion-txt"><b>{etiqueta || a.titulo}</b>
        {a.ifrit && <small>{DATA.objetos.ifrit.deseos[deseo]}</small>}
        {a.bloqueado && <small className="error">{a.bloqueado}</small>}
      </div>
      <div className="accion-ctl">
        {a.objetivos && <Objetivo s={s} ids={a.objetivos} valor={obj} onChange={setObj} />}
        {a.destinos && <select value={dest} onChange={(e) => setDest(e.target.value)} aria-label="Destino">{a.destinos.map((d) => <option key={d}>{d}</option>)}</select>}
        {a.ifrit && <select value={deseo} onChange={(e) => setDeseo(e.target.value)} aria-label="Deseo">{a.ifrit.map((d) => <option key={d} value={d}>Deseo {d}</option>)}</select>}
        {plazos && <select value={mision} onChange={(e) => setMision(e.target.value)} aria-label="Plazo a ampliar">{plazos.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}</select>}
        <button className="btn mini" disabled={(plazos && !plazos.length) || !!a.bloqueado || !!s.pend || !!s.dados} onClick={enviarUso}>Usar</button>
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
        {nur && <small>Nur al Din (honor): puedes pedir una indemnización si ganas.</small>}
        {a.tipo === 'duelo' && mi.herido && <small className="aviso-mal">Estás herido: si pierdes este duelo, mueres.</small>}
        {a.tipo === 'duelo' && obj && s.jugadores[obj]?.herido && <small className="aviso-bien">{s.jugadores[obj].nombre} está herido: si ganas tú, muere.</small>}</div>
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
  const [ocupado, una] = useBloqueo();
  const tengoAmate = s.mano.some((c) => c.tipo === 'item' && c.ref === 'amate');
  const puedeEsc = mt && mi.pj !== 'B' && !mi.perdido && mi.dinares > 0;
  const papeles = s.mano.filter((c) => c.tipo === 'item' && c.ref === 'mapa' && c.extra?.tesoro === 'jugador');
  // Jorge (8 de noviembre): tantos escondites como papeles amate. Si ya tienes aquí uno (con su papel), puedes agregarle dinares.
  const aqui = papeles.find((c) => c.extra.dueno === s.yo && c.extra.ciudad === mi.ciudad);
  const esconder = (nuevo) => enviar(ACCIONES.esconder(Number(monto), nuevo));
  const bloq = !!s.pend || ocupado;
  return (
    <>
      {puedeEsc && (
        <div className="accion-fila">
          <div className="accion-txt"><b>Esconder dinares</b><small>{aqui || tengoAmate ? 'Los dejas en esta ciudad (ya visitada). Cada papel amate es un escondite con su propia carta; puedes tener tantos como papeles. El papel lo puedes vender a otro jugador; un robo no te lo quita.' : 'Necesitas un papel amate para anotar dónde los escondes: se compra en el mercado de cualquier ciudad.'}</small></div>
          <div className="accion-ctl"><input type="number" min="1" max={mi.dinares} value={monto} onChange={(e) => setMonto(e.target.value)} aria-label="Dinares a esconder" style={{ width: 80 }} />
            {aqui && <button className="btn mini" disabled={bloq} onClick={una(() => esconder(false))}>Agregar a mi escondite</button>}
            <button className="btn mini" disabled={bloq || !tengoAmate} onClick={una(() => esconder(true))}>{aqui ? 'Nuevo escondite (papel amate)' : 'Esconder'}</button></div>
        </div>
      )}
      {mt && papeles.map((c) => (
        <div key={c.uid} className="accion-fila"><div className="accion-txt"><b>{c.datos?.titulo || 'Papel amate'}</b><small>{c.extra.ciudad === mi.ciudad ? 'Estás en esa ciudad: puedes sacar los dinares.' : `Tienes que ir a ${c.extra.ciudad} para sacarlos.`}</small></div>
          <div className="accion-ctl"><button className="btn mini" disabled={!!s.pend || ocupado || c.extra.ciudad !== mi.ciudad} onClick={una(() => enviar(ACCIONES.recuperar(c.uid)))}>Sacar los dinares</button></div></div>
      ))}
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

// Explica por qué no aparece ninguna opción de combate aunque haya otros jugadores en la ciudad.
function porQueNoAtacar(s, mi) {
  const firman = s.mano.some((c) => c.tipo === 'especial' && c.ref === 'F1');
  if (mi.ciudad === 'Bagdad' && !firman && !s.mods?.armasBagdad) return 'En Bagdad solo se puede desafiar a duelo, robar o atacar con un Firmán del Califa (lo vende el visir aquí, en el Mercado). En cualquier otra ciudad sí puedes desafiar.';
  if (s.turno?.principal) return 'Ya usaste tu acción principal de este turno: los desafíos y ataques serán en tu próximo turno.';
  return 'Ahora no puedes desafiar ni atacar a nadie aquí (por ejemplo, por estar herido o porque nadie puede ser atacado en este momento).';
}

const SECCIONES = [['atacar', 'Combate y robos'], ['reto', 'Retos y misiones'], ['pj', 'Tu personaje'], ['tesoro', 'Tesoros y Jorasán'], ['asesinos', 'Los Asesinos'], ['venderFirmanYafar', 'Tu Firmán'], ['usar', 'Usar objetos']];

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
        {mi.buscadoInfo && <p className="aviso-mal">Estás {mi.buscadoInfo}</p>}
        {mt && s.turno.heridoAhora && s.turno.principal && <p className="aviso-mal">Ya no estás herido, pero te estás recuperando: este turno no tienes acción principal, así que no puedes iniciar retos, robar, desafiar ni buscar tesoros. En tu próximo turno, sí.</p>}
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
                    <div className="accion-ctl"><button className="btn mini" disabled={!!s.pend || !!s.dados} onClick={() => { if (k === 'tesoro' && a.sub === 'jorasan' && !confirmarViajeBurro(s, 'Jorasán')) return; enviar(k === 'asesinos' ? ACCIONES.asesinos() : k === 'venderFirmanYafar' ? ACCIONES.venderFirmanYafar() : ACCIONES.tesoro(a.sub, { uid: a.uid, via: a.via })); }}>{k === 'asesinos' ? 'Contratar' : 'Hacerlo'}</button></div>
                  </div>
                );
              })}
              {k === 'tesoro' && <Tesoro s={s} mi={mi} mt={mt && s.turno.fase !== 'ingreso'} />}
            </section>
          );
        })}
        {mt && s.turno.fase !== 'ingreso' && aqui.length > 0 && <section className="accion-sec"><h3 className="sub-h">Con otros jugadores</h3><OfrecerCinco s={s} ids={aqui} /><p className="it">Para comerciar usa Mercado → Tratos.</p>{!hay('atacar').length && <p className="it aviso-regla">{porQueNoAtacar(s, mi)}</p>}</section>}
        {mt && !lista.some((a) => !['viajar', 'terminarTurno', 'cc', 'tirarDados'].includes(a.k)) && s.turno.fase !== 'ingreso' && <p className="it">No hay acciones especiales disponibles aquí. Puedes viajar, comprar o vender, o terminar el turno.</p>}
      </div>
    </div>
  );
}
