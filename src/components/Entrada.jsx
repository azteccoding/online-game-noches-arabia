import React, { useState } from 'react';
import { iniciarJuego, useJuego } from '../game/store.js';

export default function Entrada({ demoDisponible }) {
  const [nombre, setNombre] = useState(localStorage.getItem('mun.nombre') || '');
  const rechazo = useJuego((s) => s.rechazo);
  return (
    <main className="pantalla entrada">
      <svg className="logo" viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="#efd08f" strokeWidth="3"><rect x="22" y="22" width="76" height="76" /><rect x="22" y="22" width="76" height="76" transform="rotate(45 60 60)" /><circle cx="60" cy="60" r="20" /></g><circle cx="60" cy="60" r="5" fill="#efd08f" /></svg>
      <h1>Mil y una Noches</h1>
      <p className="ar" style={{ fontSize: 30, color: 'var(--oro-claro)', margin: 0 }}>ألف ليلة وليلة</p>
      <form className="panel form-entrada" onSubmit={(e) => { e.preventDefault(); iniciarJuego({ nombre: nombre.trim() || 'Jugador' }); }}>
        <label htmlFor="nombre">¿Cómo te llamas?</label>
        <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={24} placeholder="Tu nombre" autoComplete="nickname" autoFocus />
        <button className="btn" type="submit">Entrar a la sala</button>
        {rechazo && <p className="error">{rechazo}</p>}
      </form>
      {demoDisponible && <p className="it">Modo demostración: <a href="?demo=1">partida con bots</a> · <a href="?demo=lobby">sala</a></p>}
    </main>
  );
}
