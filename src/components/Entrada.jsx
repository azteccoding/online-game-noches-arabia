import React, { useEffect, useState } from 'react';
import { iniciarJuego, useJuego } from '../game/store.js';

export default function Entrada({ demoDisponible }) {
  const [nombre, setNombre] = useState(localStorage.getItem('mun.nombre') || '');
  const [clave, setClave] = useState(localStorage.getItem('mun.clave') || '');
  const [conClave, setConClave] = useState(false);
  const rechazo = useJuego((s) => s.rechazo);
  const pideClave = useJuego((s) => s.pideClave);
  useEffect(() => { fetch('/api/config').then((r) => r.json()).then((c) => setConClave(!!c.clave)).catch(() => {}); }, []);   // solo el servidor en línea con MUN_CLAVE la pide
  const entrar = () => {
    if (conClave || pideClave) localStorage.setItem('mun.clave', clave.trim());
    iniciarJuego({ nombre: nombre.trim() || 'Jugador' });
  };
  return (
    <main className="pantalla entrada">
      <svg className="logo" viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="#efd08f" strokeWidth="3"><rect x="22" y="22" width="76" height="76" /><rect x="22" y="22" width="76" height="76" transform="rotate(45 60 60)" /><circle cx="60" cy="60" r="20" /></g><circle cx="60" cy="60" r="5" fill="#efd08f" /></svg>
      <h1>Mil y una Noches</h1>
      <p className="ar" style={{ fontSize: 30, color: 'var(--oro-claro)', margin: 0 }}>ألف ليلة وليلة</p>
      <form className="panel form-entrada" onSubmit={(e) => { e.preventDefault(); entrar(); }}>
        <label htmlFor="nombre">¿Cómo te llamas?</label>
        <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={24} placeholder="Tu nombre" autoComplete="nickname" autoFocus />
        {(conClave || pideClave) && <>
          <label htmlFor="clave">Clave de la partida</label>
          <input id="clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} maxLength={64} placeholder="La que te dio el banco" autoComplete="current-password" required />
        </>}
        <button className="btn" type="submit">Entrar a la sala</button>
        {rechazo && <p className="error">{rechazo}</p>}
      </form>
      <a className="btn-demo" href="/demo/">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3.2" /></svg>
        Ver demostración
      </a>
      {demoDisponible && <p className="it">Modo demostración: <a href="?demo=1">partida con bots</a> · <a href="?demo=lobby">sala</a></p>}
    </main>
  );
}
