import React, { useState } from 'react';
import { DATA } from '../game/data.js';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Mercado de la ciudad (comprar / vender, R 15 y 8.5) y Tratos entre jugadores de la misma ciudad (R 8.6: propuesta + aceptación).
function Producto({ it, puedeActuar, s }) {
  const [n, setN] = useState(1);
  const total = it.precio * n;
  const mi = s.jugadores[s.yo];
  return (
    <li>
      <div className="prod"><b>{it.nombre}</b> <span className="chip">{it.tipo}</span><br /><small>{it.texto}</small></div>
      <div className="der">
        <span className="chip">{it.precio} din.</span>
        {it.stock != null && <span className="chip">quedan {it.stock}</span>}
        {it.cantidad && <span className="cant"><button className="btn mini sec" onClick={() => setN((x) => Math.max(1, x - 1))} aria-label="Menos">−</button><b>{n}</b><button className="btn mini sec" onClick={() => setN((x) => Math.min(10, x + 1))} aria-label="Más">+</button></span>}
        <button className="btn mini" disabled={!puedeActuar || !it.puede || mi.dinares < total} onClick={() => enviar(ACCIONES.comprar(it.id ? { id: it.id } : { ref: it.ref, n }))}>Comprar{n > 1 ? ` (${total})` : ''}</button>
      </div>
    </li>
  );
}

// Lo que se puede pedir en un trato (la mano ajena es secreta: se pide por tipo de carta).
const CATALOGO = [...DATA.objetos.mazo.map((o) => [o.id, o.nombre]), ['arco', 'Arco'], ['flechas', 'Flechas'], ['alfanje', 'Alfanje'], ['cimitarra', 'Cimitarra'], ['jambiya', 'Jambiya'],
  ['caballo', 'Caballo'], ['camello', 'Camello'], ['burro', 'Burro'], ['alfombra', 'Alfombra mágica'], ['vino', 'Botella de vino'], ['mapa', 'Mapa de tesoro'], ['alfombraIsfahan', 'Alfombra de Isfahán'], ['especias', 'Especias']]
  .filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i).sort((a, b) => a[1].localeCompare(b[1], 'es'));

export default function Intercambio({ s, onCerrar, inicial = 'comprar' }) {
  const [tab, setTab] = useState(inicial);
  const yo = s.jugadores[s.yo];
  const miTurno = s.turno?.pid === s.yo && s.fase === 'juego' && s.turno.fase !== 'ingreso' && !yo.transito && !yo.perdido && !s.turno.fin && !s.pend;
  const vendibles = s.mano.filter((c) => c.tipo !== 'especial');
  const esMiTurno = s.turno?.pid === s.yo;
  const puedeComprar = s.fase === 'juego' && !!s.turno && !esMiTurno && !yo.transito && !yo.perdido && !yo.eliminado && !s.pend;   // regla de la casa: fuera de tu turno
  const companeros = Object.values(s.jugadores).filter((j) => j.id !== s.yo && j.ciudad === yo.ciudad && j.pj && !j.eliminado && !j.npc);
  const [con, setCon] = useState('');
  const [dinOfrece, setDinOfrece] = useState(0);
  const [dinPide, setDinPide] = useState(0);
  const [objs, setObjs] = useState([]);
  const [nchOfrece, setNchOfrece] = useState(0);
  const [nchPide, setNchPide] = useState(0);
  const [pideRefs, setPideRefs] = useState([]);
  const [refSel, setRefSel] = useState('');
  const lado = (x) => [x.dinares ? `${x.dinares} dinares` : '', x.noches ? `${x.noches} noches` : '', ...(x.nombres || [])].filter(Boolean).join(', ') || 'nada';
  const entrantes = s.tratos.filter((t) => t.con === s.yo);
  return (
    <div className="hoja-modal panel" role="dialog" aria-label="Mercado">
      <div className="desp-cab">
        <h2>Mercado de {yo.ciudad}</h2>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'comprar'} className={tab === 'comprar' ? 'on' : ''} onClick={() => setTab('comprar')}>Comprar</button>
          <button role="tab" aria-selected={tab === 'vender'} className={tab === 'vender' ? 'on' : ''} onClick={() => setTab('vender')}>Vender</button>
          <button role="tab" aria-selected={tab === 'tratos'} className={tab === 'tratos' ? 'on' : ''} onClick={() => setTab('tratos')}>Tratos{s.tratos.length ? ` (${s.tratos.length})` : ''}</button>
        </div>
        <button className="btn mini" onClick={onCerrar}>Cerrar</button>
      </div>
      <div className="desp-cuerpo">
        <p className="it">Tienes {yo.dinares} dinares. {tab === 'comprar' ? (puedeComprar ? 'El mercado te vende mientras juegan los demás.' : esMiTurno ? 'Compra mientras juegan los demás: en tu turno el mercado no te vende (el Firmán y el bazar del genio, sí).' : 'Ahora no puedes comprar.') : miTurno ? 'Vendes en tu turno.' : 'Podrás vender en tu turno.'}{s.mods?.feria ? ' Hoy hay feria: sin impuesto.' : ''}</p>
        {tab === 'comprar' && (
          <ul className="lista-merc">
            {s.tienda.map((it) => <Producto key={it.id || it.ref} it={it} puedeActuar={it.ref === 'firman' || it.ref === 'ifrit' ? miTurno : puedeComprar} s={s} />)}
            {!s.tienda.length && <li>Aquí no se vende nada.</li>}
          </ul>
        )}
        {tab === 'vender' && (
          <>
            {!vendibles.length && <p className="it">No tienes nada que vender.</p>}
            <ul className="lista-merc">
              {vendibles.map((c) => (
                <li key={c.uid}><div className="prod"><b>{c.datos?.titulo}</b> <small>{c.datos?.sub}</small>{c.donde && <small className="donde-venta">{c.donde}</small>}</div>
                  <div className="der">{c.venta != null ? <span className="chip">≈ {c.venta} din. netos</span> : <span className="chip mal">no se vende aquí</span>}
                    <button className="btn mini sec" disabled={!miTurno || c.venta == null} onClick={() => enviar(ACCIONES.vender(c.uid))}>Vender</button></div></li>
              ))}
            </ul>
            <p className="it nota">El vendedor paga al banco el impuesto de la ciudad (Bagdad 0 %, Samarcanda 50 %). Las ventas de varias cartas iguales (buza) se resuelven con dados.</p>
          </>
        )}
        {tab === 'tratos' && (
          <>
            {entrantes.map((t) => (
              <div key={t.id} className="trato entrante">
                <p><b>{s.jugadores[t.de].nombre}</b> te ofrece <b>{lado(t.ofrece)}</b> a cambio de <b>{lado(t.pide)}</b>.</p>
                <div className="fila-btn"><button className="btn mini" onClick={() => enviar(ACCIONES.responderTrato(t.id, true))}>Aceptar</button><button className="btn mini sec" onClick={() => enviar(ACCIONES.responderTrato(t.id, false))}>Rechazar</button></div>
              </div>
            ))}
            {s.tratos.filter((t) => t.de === s.yo).map((t) => (
              <div key={t.id} className="trato"><p>Ofreces {lado(t.ofrece)} por {lado(t.pide)}. Esperando a {s.jugadores[t.con].nombre}… <button className="btn mini sec" onClick={() => enviar(ACCIONES.cancelarTrato(t.id))}>Cancelar</button></p></div>
            ))}
            <h3 className="sub-h">Proponer un trato (misma ciudad)</h3>
            {!companeros.length ? <p className="it">Nadie más está en {yo.ciudad}.</p> : (
              <form className="form-trato" onSubmit={(e) => { e.preventDefault(); if (con) { enviar(ACCIONES.proponerTrato(con, { dinares: Number(dinOfrece), noches: Number(nchOfrece), objetos: objs }, { dinares: Number(dinPide), noches: Number(nchPide), refs: pideRefs })); setObjs([]); setPideRefs([]); } }}>
                <label>Con <select value={con} onChange={(e) => setCon(e.target.value)}><option value="">— elige —</option>{companeros.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}</select></label>
                <fieldset className="lado-trato"><legend>Yo doy</legend>
                  <label>Dinares <input type="number" min="0" max={yo.dinares} value={dinOfrece} onChange={(e) => setDinOfrece(e.target.value)} /></label>
                  <label>Noches <input type="number" min="0" max={yo.noches} value={nchOfrece} onChange={(e) => setNchOfrece(e.target.value)} /></label>
                  {vendibles.map((c) => <label key={c.uid} className="chk"><input type="checkbox" checked={objs.includes(c.uid)} onChange={(e) => setObjs((o) => (e.target.checked ? [...o, c.uid] : o.filter((x) => x !== c.uid)))} /> {c.datos?.titulo}</label>)}
                </fieldset>
                <fieldset className="lado-trato"><legend>Pido a cambio</legend>
                  <label>Dinares <input type="number" min="0" value={dinPide} onChange={(e) => setDinPide(e.target.value)} /></label>
                  <label>Noches <input type="number" min="0" value={nchPide} onChange={(e) => setNchPide(e.target.value)} /></label>
                  <label>Una carta <select value={refSel} onChange={(e) => setRefSel(e.target.value)}><option value="">— elige qué pides —</option>{CATALOGO.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
                    <button type="button" className="btn mini sec" disabled={!refSel || pideRefs.length >= 6} onClick={() => { setPideRefs((r) => [...r, refSel]); setRefSel(''); }}>Añadir</button></label>
                  {pideRefs.length > 0 && <p className="it">Pides: {pideRefs.map((r, i) => <button key={i} type="button" className="chip" title="Quitar" onClick={() => setPideRefs((x) => x.filter((_, k) => k !== i))}>{(CATALOGO.find(([id]) => id === r) || [r, r])[1]} ✕</button>)}</p>}
                  <p className="it nota">Si no tiene la carta que pides, no podrá aceptar.</p>
                </fieldset>
                <button className="btn" type="submit" disabled={!con || Number(dinOfrece) > yo.dinares || Number(nchOfrece) > yo.noches}>Enviar propuesta</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
