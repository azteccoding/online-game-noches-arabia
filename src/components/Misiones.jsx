import React from 'react';

// Hazañas (Tariq, al-Quds) y vida de los animales propios.
export function NochesExtra({ s }) {
  const yo = s.jugadores[s.yo], hz = Object.entries(yo?.hazanas || {});
  const animales = (s.mano || []).filter((c) => c.datos?.vida != null);
  if (!hz.length && !animales.length) return null;
  return (
    <>
      <h3 className="sub-h">Noches extra y animales</h3>
      <ul className="lista-merc">
        {hz.map(([k, h]) => (
          <li key={k}><div className="prod"><b>{h.nombre}</b> (+{h.noches} noches, cruzando entre {h.par.join(' y ')}{k === 'quds' ? ' en burro' : ''})
            <br /><small>{h.bloqueada ? `Bloqueada hasta que salgas de ${h.par.join(' y ')}. Para volver a ganar estas noches, muévete a otra ciudad.` : `Disponible: ${h.quedan} de 2 este turno.`}</small></div>
            <div className="der"><span className={`chip${h.bloqueada ? ' mal' : ''}`}>{h.bloqueada ? 'bloqueada' : 'disponible'}</span></div></li>
        ))}
        {animales.map((c) => (
          <li key={c.uid}><div className="prod"><b>{c.datos.titulo}</b><br /><small>Albéitar y comida cada turno; muere al cumplir sus turnos.</small></div>
            <div className="der"><span className={`chip${c.datos.vida <= 1 ? ' mal' : ''}`}>{c.datos.vida ? `${c.datos.vida} turno(s) más` : 'último turno'}</span></div></li>
        ))}
      </ul>
    </>
  );
}

// Retos en curso (misiones con plazo, deudas, encargos), retos ya cumplidos y mensaje del sheij.
export default function Misiones({ s, onCerrar, onAbrir }) {
  const msg = s.mensaje && s.historial.slice().reverse().find((h) => h.deck === 'mensaje' && h.para?.includes(s.yo));
  return (
    <div className="hoja-modal panel" role="dialog" aria-label="Retos y misiones">
      <div className="desp-cab"><h2>Retos y misiones</h2><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo">
        <h3 className="sub-h">En curso</h3>
        {!s.misiones.length && !msg && !s.encargo && <p className="it">No tienes misiones en curso. Los retos se intentan desde Acciones, en la ciudad donde están.</p>}
        {msg && <div className="trato"><p><b>Mensaje de un sheij</b>: {msg.texto}</p><p className="it">Premio {msg.premio} · plazo hasta la ronda {s.mensaje.turnoLimite}.</p><button className="btn mini sec" onClick={() => onAbrir(msg)}>Ver carta</button></div>}
        {s.encargo && <div className="trato"><p><b>Encargo de los Asesinos</b>: {s.encargo.tipo === 'reto' ? 'cumple un reto en Samarcanda o Isfahán' : `lleva su mensaje a ${s.encargo.ciudad}`}.</p><p className="it">Premio: 200 noches · plazo hasta el final de la ronda {s.encargo.hasta}. Solo tú lo ves.</p></div>}
        {(s.carreras || []).map((c) => <div key={c.id} className="trato"><p><b>🏁 Carrera: dos noches en {c.ciudad}</b>: el primero que cierre dos turnos seguidos allí sin moverse gana 60 dinares y 50 noches.</p><p className="it">{Object.entries(c.prog).map(([id, n]) => `${s.jugadores[id]?.nombre} ${n}/2`).join(' · ') || 'Nadie ha empezado.'}</p></div>)}
        <ul className="lista-merc">
          {s.misiones.map((m, i) => (
            <li key={m.id + i}><div className="prod"><b>{m.id} · {m.nombre}</b>
              <br /><small>{[m.destino && `Destino: ${m.destino}`, m.objetivo && `Objetivo: ${m.objetivo}`, m.texto, m.deuda && `Deuda: ${m.deuda} dinares`].filter(Boolean).join(' · ') || 'En curso'}</small></div>
              {m.turnosRestantes != null && <div className="der"><span className={`chip${m.turnosRestantes <= 1 ? ' mal' : ''}`}>{m.turnosRestantes} turno(s)</span></div>}</li>
          ))}
        </ul>
        <NochesExtra s={s} />
        <h3 className="sub-h">Cumplidos</h3>
        {s.retosHechos.length ? <p>{s.retosHechos.map((r) => <span className="chip" key={r}>{r}</span>)}</p> : <p className="it">Ninguno todavía.</p>}
      </div>
    </div>
  );
}
