import React, { useRef } from 'react';
import { enviar, avisar, useJuego } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';
import { nombreCorto } from '../game/data.js';
import Sprite from './Sprite.jsx';
import Dinares from './Dinares.jsx';
import { cartaSinCerrar, saldoVisible } from '../game/lectura.js';
import { contadoresCarrera, vidaAnimales } from '../game/carrera.js';

const FASE = { ingreso: 'Ingreso: tira el dado', mov: 'Movimiento y acciones', accion: 'Acción principal' };

// Barra inferior: quién juega y los botones del turno. El detalle de acciones (combate, retos, objetos…) vive en el panel «Acciones».
export default function PanelAcciones({ s, abrir, panel }) {
  const t = s.turno, yo = s.jugadores[s.yo];
  const memSaldo = useRef({});
  const saldo = saldoVisible(memSaldo.current, yo, !!cartaSinCerrar(s));   // consecuencias de una carta: al cerrarla
  const miTurno = t?.pid === s.yo && s.fase === 'juego';
  const enTurno = t && s.jugadores[t.pid];
  const ocupado = !!s.dados || !!s.pend;
  const sinCC = !t?.ccActual;
  const nAcc = s.acciones.filter((a) => !['viajar', 'terminarTurno', 'cc', 'tirarDados'].includes(a.k)).length;
  const mano = s.mano.length + (s.mensajes?.length || 0);
  const marca = (p) => (panel === p ? ' on' : '');
  // Qué impide seguir: una decisión, los dados o una CC sin responder. En vez de un botón muerto, se avisa y se lleva a esa carta.
  const enPantalla = useJuego((x) => x.cartaEnPantalla);
  const cc = miTurno && t.ccActual ? s.historial.find((h) => h.nro === t.ccActual.nro) : null;
  const bloqueo = s.pend?.mia && !s.pend.respondiste ? { texto: `Primero responde: «${s.pend.titulo}»` }
    : s.pend ? { texto: `Esperando a ${s.pend.faltan.map((x) => s.jugadores[x]?.nombre || x).join(', ')}: «${s.pend.titulo}»` }
    : s.dados ? { texto: 'Primero cierra los dados en pantalla.' }
    : cc ? { texto: `Primero responde: «${cc.titulo}»`, carta: cc.nro } : null;
  const intentar = (fn) => () => { if (!bloqueo) return fn(); avisar('⚠ ' + bloqueo.texto); if (bloqueo.carta != null) abrir('carta:' + bloqueo.carta); };
  const ccPendiente = cc && enPantalla !== cc.nro;
  return (
    <footer className="acciones">
      <div className="acc-info">
        {enTurno && <Sprite pj={enTurno.pj} alto={40} />}
        <div className="acc-txt">
          <b>{miTurno ? 'Es tu turno' : `Turno de ${enTurno?.nombre || '—'}`}</b>
          <small>{miTurno ? FASE[t.fase] : `${nombreCorto(enTurno?.pj) || ''} · ${t ? FASE[t.fase] : ''}`} · ronda {s.ronda}</small>
        </div>
        <div className="acc-yo">
          <Dinares valor={saldo.dinares} /><span className="chip" title="Noches">{saldo.noches} noches</span>
          {vidaAnimales(s).length > 0 && <span className="chip" title="Turnos de vida que le quedan a cada animal después de este">{vidaAnimales(s).map((a) => a.texto).join(' · ')}</span>}
          {contadoresCarrera(s).map((c) => <span key={c.id} className="chip chip-ev" title="Cada noche cuenta al terminar tu turno en esa ciudad; si terminas un turno en otra, vuelves a 0. Con 2 noches seguidas ganas 60 dinares y 50 noches.">🏁 {c.texto}</span>)}
          {yo.herido && <span className="chip mal">Herido</span>}{yo.buscadoInfo && <span className="chip mal" title={yo.buscadoInfo}>Buscado</span>}{yo.perdido && <span className="chip mal">Perdido</span>}
        </div>
      </div>
      {ccPendiente && <div className="acc-responde"><button className="btn responde" onClick={() => abrir('carta:' + cc.nro)} title={`Falta responder «${cc.titulo}»`}>¡Responde! <small>{cc.titulo}</small></button></div>}
      <div className="acc-botones">
        {miTurno && t.fase === 'ingreso' && <button className="btn grande" disabled={ocupado} onClick={() => enviar(ACCIONES.tirarDados())}>Tirar dado de ingreso</button>}
        {miTurno && t.fase !== 'ingreso' && (
          <>
            <button className={`btn btn-ciudad${bloqueo ? ' bloq' : ''}`} aria-disabled={!!bloqueo} title="Qué hay aquí y consejos" aria-label={`${yo.ciudad}: qué hay aquí y consejos`} onClick={intentar(() => abrir('ciudad:' + yo.ciudad))}><span aria-hidden="true">📍</span><span className="ciudad-larga">{yo.ciudad}</span><span className="ciudad-corta">Esta ciudad</span></button>
            <button className={`btn${marca('acciones')}`} onClick={() => abrir('acciones')}>Acciones{nAcc ? ` (${nAcc})` : ''}</button>
          </>
        )}
        <button className={`btn sec${marca('mercado')}${s.tratos.some((x) => x.con === s.yo) ? ' trato-pendiente' : ''}`} onClick={() => abrir(s.tratos.some((x) => x.con === s.yo) ? 'mercado-tratos' : 'mercado')}>Mercado{s.tratos.some((x) => x.con === s.yo) ? ' 🤝' : ''}</button>
        <button className={`btn sec${marca('mano')}`} onClick={() => abrir('mano')}>Mano ({mano})</button>
        <button className={`btn sec${marca('misiones')}`} onClick={() => abrir('misiones')}>Retos{s.misiones.length ? ` (${s.misiones.length})` : ''}</button>
        {miTurno && t.fase !== 'ingreso' && <button className={`btn claro${bloqueo ? ' bloq' : ''}`} aria-disabled={!!bloqueo} onClick={intentar(() => enviar(ACCIONES.terminarTurno()))}>Terminar turno</button>}
      </div>
    </footer>
  );
}
