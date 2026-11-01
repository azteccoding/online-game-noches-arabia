import React, { useState } from 'react';
import { DATA } from '../game/data.js';
import { enviar } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';
import { useBloqueo } from '../hooks/useBloqueo.js';

// Panel del banco/anfitrión (R 22): corrige errores, reparte cartas, tira dados de NPC. El servidor NO depende de este dispositivo.
export default function PanelAnfitrion({ s, onCerrar }) {
  const jug = s.orden.map((id) => s.jugadores[id]).filter((j) => j && j.pj);
  const [pid, setPid] = useState(s.turno?.pid || jug[0]?.id || '');
  const [din, setDin] = useState(0);
  const [noc, setNoc] = useState(0);
  const [campo, setCampo] = useState('dinares');
  const [valor, setValor] = useState(0);
  const [obj, setObj] = useState(DATA.objetos.mazo[0].id);
  const [pin, setPin] = useState('');
  const [ocupado, una] = useBloqueo();
  const sel = <label>Jugador <select value={pid} onChange={(e) => setPid(e.target.value)}>{jug.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}</select></label>;
  if (!s.soyHost) {
    return (
      <div className="hoja-modal panel" role="dialog" aria-label="Banco">
        <div className="desp-cab"><h2>Banco / anfitrión</h2><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
        <div className="desp-cuerpo">
          <p>El banco actual es <b>{s.jugadores[s.host]?.nombre}</b> {s.hostConectado ? '' : '(desconectado: la partida sigue; cualquiera puede tirar por los NPC).'}</p>
          <form onSubmit={(e) => { e.preventDefault(); enviar(ACCIONES.reclamarAnfitrion(pin)); setPin(''); }} className="form-trato">
            <label>PIN del banco (1234) <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" autoComplete="off" /></label>
            <button className="btn" type="submit">Ser el banco</button>
          </form>
        </div>
      </div>
    );
  }
  return (
    <div className="hoja-modal panel" role="dialog" aria-label="Panel del banco">
      <div className="desp-cab"><h2>Banco / anfitrión</h2><span className="chip">PIN {s.host_info?.pinHost}</span><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo anf">
        {sel}
        <fieldset><legend>Dar</legend>
          <label>Dinares <input type="number" value={din} onChange={(e) => setDin(e.target.value)} /></label>
          <label>Noches <input type="number" value={noc} onChange={(e) => setNoc(e.target.value)} /></label>
          <button className="btn mini" disabled={ocupado} onClick={una(() => enviar(ACCIONES.host.dar(pid, Number(din), Number(noc))))}>Entregar</button></fieldset>
        <fieldset><legend>Corregir</legend>
          <label>Campo <select value={campo} onChange={(e) => setCampo(e.target.value)}>{['dinares', 'noches', 'escondido', 'buscado', 'herido', 'perdido', 'destreza', 'ciudad'].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Valor <input value={valor} onChange={(e) => setValor(e.target.value)} /></label>
          <button className="btn mini" disabled={ocupado} onClick={una(() => enviar(ACCIONES.host.corregir(pid, campo, ['herido', 'perdido', 'destreza'].includes(campo) ? valor === 'true' || valor === '1' : campo === 'ciudad' ? valor : Number(valor))))}>Aplicar</button>
          <small className="it">herido/perdido/destreza: 1 o 0; ciudad: nombre exacto. Para eliminar usa «Eliminar jugador».</small></fieldset>
        <fieldset><legend>Repartir</legend>
          <label>Objeto <select value={obj} onChange={(e) => setObj(e.target.value)}>{DATA.objetos.mazo.map((o) => <option key={o.id} value={o.id}>{o.nombre} ({s.stockPublico[o.id]})</option>)}</select></label>
          <div className="fila-btn"><button className="btn mini" disabled={ocupado} onClick={una(() => enviar(ACCIONES.host.repartir(pid, 'objeto', obj)))}>Dar objeto</button><button className="btn mini" disabled={ocupado} onClick={una(() => enviar(ACCIONES.host.repartir(pid, 'mensaje')))}>Dar mensaje</button></div></fieldset>
        <fieldset><legend>Mazos y dados</legend>
          <div className="fila-btn">
            <button className="btn mini" onClick={() => enviar(ACCIONES.host.revelarCarta('evento'))}>Revelar evento</button>
            <button className="btn mini" onClick={() => enviar(ACCIONES.host.revelarCarta('historico'))}>Revelar histórico</button>
            <button className="btn mini sec" disabled={!!s.dados} onClick={() => enviar(ACCIONES.host.tirarNPC('Asesinos', 2))}>Dados: Asesinos</button>
            <button className="btn mini sec" disabled={!!s.dados} onClick={() => enviar(ACCIONES.host.tirarNPC('Yafar NPC', 2))}>Dados: Yafar NPC</button>
          </div></fieldset>
        <fieldset><legend>Barajar</legend>
          <div className="fila-btn">{[['eventos', 'Eventos'], ['historicos', 'Históricos'], ['botin', 'Botín'], ['ifrit', 'Ifrit']].map(([m, t]) => <button key={m} className="btn mini sec" onClick={() => enviar(ACCIONES.host.barajar(m))}>{t}</button>)}</div>
          <small className="it">El mazo de mensajes no se vuelve a barajar: cada mensaje sale una sola vez.</small></fieldset>
        <fieldset><legend>Mesa</legend>
          <div className="fila-btn">
            <button className="btn mini" onClick={() => enviar(ACCIONES.host.pasarTurno())}>Pasar el turno</button>
            <button className="btn mini sec" onClick={() => window.confirm('¿Eliminar a este jugador?') && enviar(ACCIONES.host.eliminar(pid))}>Eliminar jugador</button>
            <button className="btn mini sec" onClick={() => window.confirm('¿Ceder el rol de banco?') && enviar(ACCIONES.host.ceder(pid))}>Ceder el banco</button>
          </div></fieldset>
        {s.host_info && <p className="it">Mazos: {s.host_info.mazos.eventos} eventos, {s.host_info.mazos.historicos} históricos, {s.host_info.mazos.mensajes} mensajes por salir (no se repiten), {s.host_info.mazos.botin} botín, {s.host_info.mazos.ifrit} ifrit.</p>}
      </div>
    </div>
  );
}
