import React, { useState } from 'react';
import HojaPersonaje from './HojaPersonaje.jsx';
import Sprite from './Sprite.jsx';
import GuiaPersonaje from './GuiaPersonaje.jsx';
import { DATA } from '../game/data.js';

// Panel desplegable con las hojas de los personajes: jugadores en la partida (estado público) y las 8 hojas de referencia.
export default function MenuPersonajes({ s, onCerrar }) {
  const [abierto, setAbierto] = useState(s.yo);
  const jug = s.orden.map((id) => s.jugadores[id]).filter((j) => j && j.pj);
  const toggle = (k) => setAbierto((a) => (a === k ? null : k));
  return (
    <div className="desplegable panel" role="region" aria-label="Personajes">
      <div className="desp-cab"><h2>Personajes</h2><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo">
        <h3 className="sub-h">En la partida</h3>
        {jug.map((j) => (
          <section key={j.id} className={`acordeon${abierto === j.id ? ' abierto' : ''}${s.turno?.pid === j.id ? ' en-turno' : ''}`}>
            <button className="acordeon-cab" aria-expanded={abierto === j.id} onClick={() => toggle(j.id)}>
              <Sprite pj={j.pj} alto={36} />
              <span className="nom">{j.nombre}{j.id === s.yo ? ' (tú)' : ''}</span>
              <span className="chip">{j.dinares} din.</span><span className="chip">{j.noches} noches</span>
              {j.herido && <span className="chip mal">H</span>}{j.perdido && <span className="chip mal">P</span>}{j.buscado > 0 && <span className="chip mal">B</span>}
            </button>
            {abierto === j.id && <HojaPersonaje pj={j.pj} jugador={j} esYo={j.id === s.yo} />}
            {abierto === j.id && j.id === s.yo && s.miGuia && <GuiaPersonaje g={s.miGuia} />}
          </section>
        ))}
        <h3 className="sub-h">Las 8 hojas</h3>
        {DATA.personajes.personajes.map((p) => (
          <section key={p.id} className={`acordeon${abierto === 'p' + p.id ? ' abierto' : ''}`}>
            <button className="acordeon-cab" aria-expanded={abierto === 'p' + p.id} onClick={() => toggle('p' + p.id)}>
              <Sprite pj={p.id} alto={36} /><span className="nom">{p.nombre}</span><span className="it">{p.titulo}</span>
            </button>
            {abierto === 'p' + p.id && <HojaPersonaje pj={p.id} />}
          </section>
        ))}
      </div>
    </div>
  );
}
