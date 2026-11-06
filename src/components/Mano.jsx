import React from 'react';
import Carta from './Carta.jsx';
import { UsarCarta } from './AccionesTurno.jsx';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

// Mano PRIVADA (el servidor solo la envía a su dueño): miniaturas ligeras con el componente Carta (tam="mini"); la carta completa solo se monta al abrirla.
export default function Mano({ s, onAbrir, onCerrar }) {
  const mano = s.mano;
  const msgs = s.mensajes || [];
  const mt = s.turno?.pid === s.yo && s.fase === 'juego' && !s.pend;
  const usos = Object.fromEntries(s.acciones.filter((a) => a.k === 'usar').map((a) => [a.uid, a]));
  return (
    <div className="desplegable panel abajo" role="region" aria-label="Mi mano">
      <div className="desp-cab"><h2>Mi mano</h2><span className="chip">Solo tú la ves</span><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo">
        {msgs.map((m) => (
          <div className="mano-msg" key={m.id}>
            <button className="mano-carta" onClick={() => onAbrir(m.carta)} aria-label={`Abrir mensaje: ${m.carta.titulo}`}><Carta datos={m.carta} tam="mini" /></button>
            <div><p><b>Mensaje en curso</b>: {m.carta.texto}</p><p className="it">Premio {m.carta.premio}. Plazo hasta la ronda {m.turnoLimite}. Se cumple solo cuando haces lo que pide; no hay que marcarlo.</p></div>
          </div>
        ))}
        {!mano.length && !msgs.length && <p className="it">No tienes cartas. Compra objetos en el Mercado.</p>}
        <div className="mano-fila">
          {mano.map((c) => (
            <div key={c.uid} className="mano-item">
              <button className="mano-carta" onClick={() => onAbrir({ ...c.datos, nro: 'mano-' + c.uid, uid: c.uid })} aria-label={`Abrir ${c.datos?.titulo}`}><Carta datos={c.datos} tam="mini" /></button>
              {c.venta != null ? <button className="btn mini sec mano-vender" disabled={!mt} onClick={() => enviar(ACCIONES.vender(c.uid))}>Vender ≈{c.venta}</button>
                : c.donde && <small className="donde-venta" title={c.donde}>{c.donde}</small>}
            </div>
          ))}
        </div>
        {Object.values(usos).length > 0 && (
          <section className="accion-sec"><h3 className="sub-h">Usar</h3>{Object.values(usos).map((a) => <UsarCarta key={a.uid} s={s} a={a} />)}</section>
        )}
      </div>
    </div>
  );
}
