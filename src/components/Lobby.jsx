import React from 'react';
import Sprite from './Sprite.jsx';
import { DATA } from '../game/data.js';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';

const NIVEL = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

export default function Lobby({ s }) {
  const yo = s.jugadores[s.yo];
  const tomados = Object.fromEntries(Object.values(s.jugadores).filter((j) => j.pj).map((j) => [j.pj, j]));
  const todos = Object.values(s.jugadores);
  const yafarHumano = Object.values(s.jugadores).some((j) => j.pj === 'B' && !j.npc);   // si alguien juega con Yafar, no hay Yafar NPC que ajustar
  const tarde = s.fase === 'juego';                // entra con la partida empezada, durante la primera ronda
  const puedeIniciar = s.soyHost && todos.some((j) => j.pj) && todos.filter((j) => j.pj).every((j) => j.listo);
  return (
    <main className="pantalla lobby">
      <header className="lobby-cab">
        <h1>Sala {s.codigo}</h1>
        {tarde ? <p>{s.puedeUnirse ? 'La partida ya empezó. Elige personaje y entra: jugarás al final de esta ronda.' : 'La primera ronda ya terminó: ya no se puede entrar a esta partida.'}</p>
          : <p>Los demás entran abriendo <b>{s.urls?.[0] || location.host}</b> en su navegador (misma red).</p>}
        {!tarde && s.cuenta == null && todos.some((j) => j.listo) && s.faltaInicio?.length > 0 && <p className="it">La cuenta regresiva arranca cuando todos estén conectados y listos. Falta: {s.faltaInicio.join(', ')}.</p>}
        {s.cuenta != null && <p className="cuenta-inicio" role="status">La partida empieza en <b>{s.cuenta}</b>…</p>}
      </header>
      <section className="panel bloque" aria-label="Elige personaje">
        <h2>Elige tu personaje</h2>
        <div className="rejilla-pj">
          {DATA.personajes.personajes.map((p) => {
            const t = tomados[p.id], mio = t?.id === s.yo;
            return (
              <button key={p.id} className={`pj-opcion${mio ? ' mio' : ''}`} disabled={!!t && !mio} onClick={() => enviar(ACCIONES.elegirPj(p.id))} aria-pressed={mio}>
                <Sprite pj={p.id} alto={84} />
                <span className="nom">{p.nombre}</span><span className="it">{p.titulo}</span>
                <span className="mini-stats">{p.stats.map((v, i) => <i key={i} title={p.statsEtiquetas[i]} style={{ '--v': v }} />)}</span>
                {t && <span className="chip">{mio ? 'Tuyo' : t.nombre}</span>}
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel bloque" aria-label="Jugadores">
        <h2>Jugadores ({todos.length}/8)</h2>
        <ul className="lista-jug">
          {todos.map((j) => (
            <li key={j.id}>
              {j.pj ? <Sprite pj={j.pj} alto={34} /> : <span className="sin-pj" />}
              <span className="nom">{j.nombre}{j.id === s.yo ? ' (tú)' : ''}{j.id === s.host && j.listo ? ' · banco' : ''}</span>
              <span className={`chip${j.conectado ? '' : ' mal'}`}>{j.conectado ? 'conectado' : 'desconectado'}</span>
              <span className={`chip${j.listo ? '' : ' mal'}`}>{j.listo ? 'listo' : j.pj ? 'sin confirmar' : 'sin personaje'}</span>
            </li>
          ))}
        </ul>
        <div className="fila-btn">
          {tarde ? <button className="btn" disabled={!yo?.pj || !s.puedeUnirse} onClick={() => enviar(ACCIONES.listo(true))}>Entrar a la partida</button> : <>
            <button className="btn sec" disabled={!yo?.pj} onClick={() => enviar(ACCIONES.listo(!yo.listo))}>{yo?.listo ? 'Ya no estoy listo' : 'Estoy listo'}</button>
            <button className="btn" disabled={!puedeIniciar} onClick={() => enviar(ACCIONES.iniciar())}>Comenzar partida</button>
          </>}
        </div>
        {s.soyHost && !yafarHumano && (
          <label className="dificultad">Dificultad de Yafar NPC
            <select value={s.opciones?.dificultad || 'normal'} onChange={(e) => enviar(ACCIONES.opciones(e.target.value))}>
              <option value="facil">Fácil</option><option value="normal">Normal</option><option value="dificil">Difícil</option>
            </select>
          </label>
        )}
        <details className="dificultad">
          <summary>Dificultad de los Asesinos: {NIVEL[s.opciones?.dificultadAsesinos || 'facil']}</summary>
          {s.soyHost ? (
            <select value={s.opciones?.dificultadAsesinos || 'facil'} onChange={(e) => enviar(ACCIONES.dificultadAsesinos(e.target.value))} aria-label="Dificultad de los Asesinos">
              <option value="facil">Fácil</option><option value="normal">Normal</option><option value="dificil">Difícil</option>
            </select>
          ) : <small> Solo el banco la cambia.</small>}
          <small className="it"> Cuánto cuesta salvarse: los Asesinos suman +3 (fácil), +4 (normal) o +5 (difícil) a sus dados.</small>
        </details>
        {s.soyHost && todos.filter((j) => j.pj).length < 4 && !todos.some((j) => j.pj === 'B') && (
          <label className="dificultad"><input type="checkbox" checked={!!s.opciones?.sinYafar} onChange={(e) => enviar(ACCIONES.sinYafar(e.target.checked))} /> Jugar sin Yafar NPC</label>
        )}
        <p className="it nota">{todos.filter((j) => j.pj).length === 1 && !s.opciones?.sinYafar ? 'Con un solo jugador es partida en solitario: Yafar el Bermekí (NPC) juega contra ti. ' : ''}{!todos.some((j) => j.pj === 'B') && todos.filter((j) => j.pj).length >= 4 ? 'Con 4 o más jugadores alguien debe elegir a Yafar el Bermekí. ' : ''}{s.soyHost ? 'Eres el banco/anfitrión: tú inicias la partida y repartes en el panel «Banco». Si te desconectas, la partida sigue en el servidor.' : 'Espera a que el banco/anfitrión inicie la partida.'}</p>
      </section>
    </main>
  );
}
