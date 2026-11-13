import React from 'react';
import Sprite from './Sprite.jsx';
import { pjDe, ciudadDe } from '../game/data.js';

// Hoja ligera de personaje (texto + barras + estado). NO es una carta completa: se puede mostrar en listas sin cargar arte.
const NOMBRE_TIPO = { objeto: 'objetos', mensaje: 'mensajes', especial: 'especiales' };
export default function HojaPersonaje({ pj, jugador, esYo }) {
  const p = pjDe(pj);
  if (!p) return null;
  const nm = jugador?.nMano || {};
  return (
    <div className="hoja">
      <div className="hoja-cab">
        <Sprite pj={pj} alto={72} />
        <div>
          <h3>{p.nombre}</h3>
          <p className="it">{p.titulo}</p>
          {jugador && <p className="quien">{jugador.nombre}{esYo ? ' (tú)' : ''}{!jugador.conectado ? ' · desconectado' : ''}</p>}
        </div>
      </div>
      {jugador && (
        <div className="hoja-estado">
          <span className="chip" title="Dinares">{jugador.dinares} dinares</span>
          <span className="chip" title="Noches">{jugador.noches} noches</span>
          <span className="chip">{jugador.ciudad}</span>
          {jugador.herido && <span className="chip mal">Herido</span>}
          {jugador.perdido && <span className="chip mal">Perdido</span>}
          {(jugador.buscado > 0 || jugador.buscadoE7) && <span className="chip mal" title={jugador.buscadoInfo || ''}>Buscado{jugador.buscado > 0 ? ` (${jugador.buscado})` : ''}</span>}
          {Object.entries(nm).map(([t, n]) => <span className="chip" key={t}>{n} {NOMBRE_TIPO[t] || t}</span>)}
          {jugador.tieneMensaje && <span className="chip">{jugador.nMensajes > 1 ? `${jugador.nMensajes} Mensajes en curso` : 'Mensaje en curso'}</span>}
        </div>
      )}
      {!jugador && <ul className="stats-hoja">{p.stats.map((v, i) => <li key={i}><span>{p.statsEtiquetas[i]}</span><i>{Array.from({ length: 5 }, (_, k) => <b key={k} className={k < v ? 'on' : ''} />)}</i></li>)}</ul>}   {/* Jorge (12 de noviembre): en los personajes en la partida no se muestran Saber, Labia… */}
      <ul className="hab">{p.habilidades.map((h, i) => <li key={i}>{h}</li>)}</ul>
      <p className="lim"><b>Límite:</b> {p.limite}</p>
      <p className="it">{p.cita}</p>
      <p className="ref">Inicio: {p.inicio.dinares} dinares, cobra {p.inicio.ingreso} por turno{p.inicio.noches ? `, ${p.inicio.noches} noches` : ''} · Reglamento {p.refReglamento}</p>
    </div>
  );
}
