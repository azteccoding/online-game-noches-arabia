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

export default function Intercambio({ s, onCerrar, inicial = 'comprar' }) {
  const [tab, setTab] = useState(inicial);
  const yo = s.jugadores[s.yo];
  const miTurno = s.turno?.pid === s.yo && s.fase === 'juego' && s.turno.fase !== 'ingreso' && !yo.transito && !yo.perdido && !s.turno.fin && !s.pend;
  const vendibles = s.mano.filter((c) => c.tipo !== 'especial');
  const companeros = Object.values(s.jugadores).filter((j) => j.id !== s.yo && j.ciudad === yo.ciudad && j.pj && !j.eliminado && !j.npc);
  const [con, setCon] = useState('');
  const [dinOfrece, setDinOfrece] = useState(0);
  const [dinPide, setDinPide] = useState(0);
  const [objs, setObjs] = useState([]);
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
        <p className="it">Tienes {yo.dinares} dinares. {miTurno ? 'Compras y ventas solo en tu turno.' : 'Podrás comprar y vender en tu turno.'}{s.mods?.feria ? ' Hoy hay feria: sin impuesto.' : ''}</p>
        {tab === 'comprar' && (
          <ul className="lista-merc">
            {s.tienda.map((it) => <Producto key={it.id || it.ref} it={it} puedeActuar={miTurno} s={s} />)}
            {!s.tienda.length && <li>Aquí no se vende nada.</li>}
          </ul>
        )}
        {tab === 'vender' && (
          <>
            {!vendibles.length && <p className="it">No tienes nada que vender.</p>}
            <ul className="lista-merc">
              {vendibles.map((c) => (
                <li key={c.uid}><div className="prod"><b>{c.datos?.titulo}</b> <small>{c.datos?.sub}</small></div>
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
                <p><b>{s.jugadores[t.de].nombre}</b> te ofrece {t.ofrece.dinares} dinares{t.ofrece.objetos.length ? ` y ${t.ofrece.objetos.length} carta(s)` : ''} a cambio de {t.pide.dinares} dinares{t.pide.objetos.length ? ` y ${t.pide.objetos.length} carta(s) tuyas` : ''}.</p>
                <div className="fila-btn"><button className="btn mini" onClick={() => enviar(ACCIONES.responderTrato(t.id, true))}>Aceptar</button><button className="btn mini sec" onClick={() => enviar(ACCIONES.responderTrato(t.id, false))}>Rechazar</button></div>
              </div>
            ))}
            {s.tratos.filter((t) => t.de === s.yo).map((t) => (
              <div key={t.id} className="trato"><p>Esperando a {s.jugadores[t.con].nombre}… <button className="btn mini sec" onClick={() => enviar(ACCIONES.cancelarTrato(t.id))}>Cancelar</button></p></div>
            ))}
            <h3 className="sub-h">Proponer un trato (misma ciudad)</h3>
            {!companeros.length ? <p className="it">Nadie más está en {yo.ciudad}.</p> : (
              <form className="form-trato" onSubmit={(e) => { e.preventDefault(); if (con) { enviar(ACCIONES.proponerTrato(con, { dinares: Number(dinOfrece), objetos: objs }, { dinares: Number(dinPide), objetos: [] })); setObjs([]); } }}>
                <label>Con <select value={con} onChange={(e) => setCon(e.target.value)}><option value="">— elige —</option>{companeros.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}</select></label>
                <label>Ofrezco (dinares) <input type="number" min="0" value={dinOfrece} onChange={(e) => setDinOfrece(e.target.value)} /></label>
                <label>Pido (dinares) <input type="number" min="0" value={dinPide} onChange={(e) => setDinPide(e.target.value)} /></label>
                {vendibles.map((c) => <label key={c.uid} className="chk"><input type="checkbox" checked={objs.includes(c.uid)} onChange={(e) => setObjs((o) => (e.target.checked ? [...o, c.uid] : o.filter((x) => x !== c.uid)))} /> Ofrezco: {c.datos?.titulo}</label>)}
                <button className="btn" type="submit" disabled={!con}>Enviar propuesta</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
