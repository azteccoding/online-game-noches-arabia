import React from 'react';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';
import { nombreCorto } from '../game/data.js';
import Sprite from './Sprite.jsx';

const FASE = { ingreso: 'Ingreso: tira el dado', mov: 'Movimiento y acciones', accion: 'Acción principal' };

// Barra inferior: quién juega y los botones del turno. El detalle de acciones (combate, retos, objetos…) vive en el panel «Acciones».
export default function PanelAcciones({ s, abrir, panel }) {
  const t = s.turno, yo = s.jugadores[s.yo];
  const miTurno = t?.pid === s.yo && s.fase === 'juego';
  const enTurno = t && s.jugadores[t.pid];
  const ocupado = !!s.dados || !!s.pend;
  const sinCC = !t?.ccActual;
  const nAcc = s.acciones.filter((a) => !['viajar', 'terminarTurno', 'cc', 'tirarDados'].includes(a.k)).length;
  const puedeViajar = s.acciones.some((a) => a.k === 'viajar');
  const mano = s.mano.length + (s.mensaje ? 1 : 0);
  const marca = (p) => (panel === p ? ' on' : '');
  return (
    <footer className="acciones">
      <div className="acc-info">
        {enTurno && <Sprite pj={enTurno.pj} alto={40} />}
        <div className="acc-txt">
          <b>{miTurno ? 'Es tu turno' : `Turno de ${enTurno?.nombre || '—'}`}</b>
          <small>{miTurno ? FASE[t.fase] : `${nombreCorto(enTurno?.pj) || ''} · ${t ? FASE[t.fase] : ''}`} · ronda {s.ronda}</small>
        </div>
        <div className="acc-yo">
          <span className="chip" title="Dinares">{yo.dinares} din.</span><span className="chip" title="Noches">{yo.noches} noches</span>
          {yo.herido && <span className="chip mal">Herido</span>}{yo.buscado > 0 && <span className="chip mal">Buscado</span>}{yo.perdido && <span className="chip mal">Perdido</span>}
        </div>
      </div>
      <div className="acc-botones">
        {miTurno && t.fase === 'ingreso' && <button className="btn grande" disabled={ocupado} onClick={() => enviar(ACCIONES.tirarDados())}>Tirar dado de ingreso</button>}
        {miTurno && t.fase !== 'ingreso' && (
          <>
            <button className="btn" disabled={ocupado || !puedeViajar || !sinCC} onClick={() => abrir('ciudad:' + yo.ciudad)}>Viajar</button>
            <button className={`btn${marca('acciones')}`} onClick={() => abrir('acciones')}>Acciones{nAcc ? ` (${nAcc})` : ''}</button>
          </>
        )}
        <button className={`btn sec${marca('mercado')}`} onClick={() => abrir('mercado')}>Mercado{s.tratos.some((x) => x.con === s.yo) ? ' •' : ''}</button>
        <button className={`btn sec${marca('mano')}`} onClick={() => abrir('mano')}>Mano ({mano})</button>
        <button className={`btn sec${marca('misiones')}`} onClick={() => abrir('misiones')}>Retos{s.misiones.length ? ` (${s.misiones.length})` : ''}</button>
        {miTurno && t.fase !== 'ingreso' && <button className="btn claro" disabled={ocupado || !sinCC} onClick={() => enviar(ACCIONES.terminarTurno())}>Terminar turno</button>}
      </div>
    </footer>
  );
}
