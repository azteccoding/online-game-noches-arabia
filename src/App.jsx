import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useJuego, iniciarJuego, leer, avisar, avisarPerdida, enviar, cerrarAviso } from './game/store.js';
import { ACCIONES } from './game/protocol.js';
import { alertaVisible } from './game/orden.js';
import { DATA } from './game/data.js';
import { useLienzo, LienzoCtx } from './hooks/useLienzo.js';
import Entrada from './components/Entrada.jsx';
import Lobby from './components/Lobby.jsx';
import Tablero3D from './components/Tablero3D.jsx';
import { turnoVisible } from './game/escena3d.js';
import { useTrasViajes } from './hooks/useTrasViajes.js';
import { BurbujasReacciones, BotonReacciones } from './components/Reacciones.jsx';
import BarraEstado from './components/BarraEstado.jsx';
import PanelAcciones from './components/PanelAcciones.jsx';
import AccionesTurno from './components/AccionesTurno.jsx';
import ModalCarta from './components/ModalCarta.jsx';
import Dados from './components/Dados.jsx';
import Decision from './components/Decision.jsx';
import MenuPersonajes from './components/MenuPersonajes.jsx';
import Mano from './components/Mano.jsx';
import Misiones from './components/Misiones.jsx';
import HojaCiudad from './components/HojaCiudad.jsx';
import Intercambio from './components/Intercambio.jsx';
import { PanelChat, AvisoChat } from './components/Chat.jsx';
import AlertaTrato, { AvisosTrato } from './components/AlertaTrato.jsx';
import VictoriaYafar from './components/VictoriaYafar.jsx';
import PanelAnfitrion from './components/PanelAnfitrion.jsx';
import { Historial, Registro } from './components/Registro.jsx';
import AcercaDe from './components/AcercaDe.jsx';
import Fin from './components/Fin.jsx';
import AlarmaDesconexion from './components/AlarmaDesconexion.jsx';
import AvisoEspera from './components/AvisoEspera.jsx';
import AvisoBuscado from './components/AvisoBuscado.jsx';
import VotoReinicio from './components/VotoReinicio.jsx';
import Alerta from './components/Alerta.jsx';
import './styles/ui.css';

const params = new URLSearchParams(location.search);
const DEMO = import.meta.env.VITE_DEMO === '1';
const Galeria = DEMO ? React.lazy(() => import('./components/Galeria.jsx')) : null;

function Juego({ lienzo }) {
  const sVivo = useJuego((x) => x.estado);
  const [s, enViaje] = useTrasViajes(sVivo);   // cartas y consecuencias esperan a que la ficha llegue a su ciudad
  const conexion = useJuego((x) => x.conexion);
  const error = useJuego((x) => x.error);
  const aviso = useJuego((x) => x.aviso);
  const demo = useJuego((x) => x.demo);
  const pids = useJuego((x) => x.pids);
  const [verTablero, setVerTablero] = useState(false);   // sin personaje en la primera ronda: mirar la partida en vez de la sala
  const [panel, setPanel] = useState(null);       // personajes | mano | mercado | acciones | misiones | historial | registro | anfitrion | acerca | ciudad:X
  const [consulta, setConsulta] = useState(null);
  const [verFin, setVerFin] = useState(true);
  useEffect(() => { if (s?.fase === 'fin') setVerFin(true); }, [s?.fase]);   // cada vez que la partida termina (también tras «Volver a la partida») sale el resultado
  // Avisos verdes: premios propios (dinares o noches que suben) y comienzo de cada ronda.
  const prev = useRef(null);
  useEffect(() => {
    const mi = s?.jugadores?.[s.yo];
    if (!s || !mi || s.fase !== 'juego') { prev.current = null; return; }
    const propia = Math.max(0, ...(s.anuncios || []).filter((a) => a.propio).map((a) => a.id));   // última alerta con el desenlace de un reto propio
    const p = prev.current; prev.current = { din: mi.dinares, noc: mi.noches, ronda: s.ronda, logN: s.log.length ? s.log[s.log.length - 1].n || 0 : 0, propia };
    if (!p) return;
    if (s.ronda > p.ronda) avisar(`Comienza la ronda ${s.ronda}`);
    if (propia > p.propia) return;   // el desenlace del reto ya dice qué ganaste y qué perdiste: no se repite en otro aviso
    const dd = mi.dinares - p.din, dn = mi.noches - p.noc;
    if (dd < 0) {                                                       // pagos y pérdidas: aviso rojo con el motivo (alojamiento, robo, multa…)
      const motivo = s.log.filter((l) => (l.n || 0) > p.logN && !l.saldo && (l.pid === s.yo || l.texto.includes(mi.nombre))).pop()?.texto;
      avisarPerdida(`Pierdes ${-dd} dinares${motivo ? ': ' + motivo : ''}`);
    }
    if (dd > 0 || dn > 0) {
      const motivo = s.log.filter((l) => (l.n || 0) > p.logN && !l.saldo && (l.pid === s.yo || l.texto.includes(mi.nombre))).pop()?.texto;
      avisar(`Ganaste ${[dd > 0 && `${dd} dinares`, dn > 0 && `${dn} noches`].filter(Boolean).join(' y ')}${motivo ? ': ' + motivo : ''}`);
    }
  }, [s]);

  // El panel de Acciones se cierra solo al viajar, al usar la acción principal o al comprar/vender; se vuelve a abrir a mano.
  const huellaAcc = s?.jugadores?.[s.yo] ? `${s.jugadores[s.yo].ciudad}|${s.turno?.principal}|${s.jugadores[s.yo].dinares}|${s.mano?.length}` : '';
  const huellaPrev = useRef(huellaAcc);
  // Cuando salen dados se cierran los paneles abiertos (Acciones, Mercado, Mano…) para que se vea la tirada.
  // Jorge (19 de noviembre): los dados de un reto ajeno no se le muestran a los demás, así que tampoco les cierran el mercado ni otro panel.
  // Igual con el dado de ingreso de otro jugador: queda en el registro y, solo si lo acierta, sale un anuncio gris.
  const dadosAjenos = !!s?.dados && s.dados.por !== s.yo && (String(s.dados.motivo || '').startsWith('reto:') || (s.dados.motivo === 'ingreso' || s.dados.motivo === 'tumba'));
  const idDados = dadosAjenos ? null : s?.dados?.id;
  useEffect(() => { if (idDados) setPanel(null); }, [idDados]);
  // Resultado de los retos ajenos: alerta verde (lo logró) o gris (no lo logró / en curso). Y el desenlace de tus propios retos (Jorge,
  // 21 de noviembre): verde si lo lograste, roja si no, gris si sigue en curso. Todas duran 3 s (23 de noviembre) y se cierran al tocarlas o deslizarlas.
  const [anunciosVistos, setAnunciosVistos] = useState(null);
  useEffect(() => {
    if (!s?.anuncios || anunciosVistos) return;
    setAnunciosVistos(new Set(s.anuncios.filter((a) => s.ahora - a.t > 20000).map((a) => a.id)));   // al entrar o recargar, los viejos ya no salen
  }, [s?.anuncios]);   // eslint-disable-line react-hooks/exhaustive-deps
  const leyendo = useJuego((x) => x.cartaEnPantalla), porLeer = useJuego((x) => x.cartaPorLeer);
  const anuncios = !anunciosVistos || s?.dados ? [] : (s?.anuncios || []).filter((a) => !anunciosVistos.has(a.id) && (!a.propio || alertaVisible({ leyendo, porLeer, id: a.id }))).slice(-3);
  // Cuando alguien se mueve de ciudad se cierran las ventanas abiertas en todas las pantallas; los dados y las decisiones siguen.
  const huellaCiudades = s ? Object.values(s.jugadores).map((j) => j.id + j.ciudad).join() : '';
  const ciudadesPrev = useRef(huellaCiudades);
  useEffect(() => {
    if (ciudadesPrev.current && ciudadesPrev.current !== huellaCiudades && s?.fase === 'juego') { setPanel(null); setConsulta(null); }
    ciudadesPrev.current = huellaCiudades;
  }, [huellaCiudades]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (huellaPrev.current !== huellaAcc && panel === 'acciones') setPanel(null);
    huellaPrev.current = huellaAcc;
  }, [huellaAcc]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (DEMO && params.get('demo')) iniciarJuego({ demo: true, nombre: params.get('nombre') || 'Dulce' });
  }, []);

  const abrir = useCallback((p) => {
    if (p === 'ultima') { const u = leer().estado?.ultimaCarta; if (u != null) setConsulta(u); return; }
    if (p === 'mercado-tratos' || p.startsWith('mercado-contra:')) { setPanel(p); return; }   // desde la alerta de trato
    if (p.startsWith('carta:')) { setPanel(null); setConsulta(Number(p.slice(6))); return; }   // la carta que falta responder
    if (p === 'evento') { const h = leer().estado?.historial.slice().reverse().find((x) => x.deck === 'evento'); if (h) setConsulta(h.nro); return; }
    setPanel((a) => (a === p ? null : p));
  }, []);
  const cerrar = useCallback(() => setPanel(null), []);
  const onCiudad = useCallback((id) => setPanel('ciudad:' + id), []);

  const mi = s?.jugadores[s.yo];
  const viajes = s?.acciones;
  const { vivas, alcance } = useMemo(() => {
    const v = (viajes || []).filter((a) => a.k === 'viajar');
    if (!v.length || !mi) return { vivas: null, alcance: null };
    const ok = v.filter((a) => a.precio <= mi.dinares);
    return { vivas: new Set(ok.map((a) => mi.ciudad + '>' + a.destino)), alcance: new Set(ok.map((a) => a.destino)) };
  }, [viajes, mi?.ciudad, mi?.dinares]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (DEMO && params.get('galeria')) return <React.Suspense fallback={null}><Galeria mazo={params.get('galeria')} ancho={Number(params.get('ancho')) || 360} /></React.Suspense>;
  if (!s) return conexion === 'inicio' ? <div className="app"><Entrada demoDisponible={DEMO} /></div> : <div className="app"><div className="pantalla"><p className="it">Conectando con el servidor…</p></div></div>;
  // Sin personaje en la primera ronda se ve la sala para entrar tarde; con «Ver el tablero» se mira la partida (y se puede ser el banco).
  const sinEntrar = s.fase === 'juego' && s.puedeUnirse && (s.jugadores[s.yo]?.tarde || !s.jugadores[s.yo]?.pj);
  if (s.fase === 'lobby' || (sinEntrar && !verTablero)) return <div className="app"><Lobby s={s} onVerTablero={s.fase === 'juego' ? () => setVerTablero(true) : null} />{error && <div className="toast" role="alert">{error}</div>}</div>;

  const ciudadPanel = panel?.startsWith('ciudad:') ? panel.slice(7) : null;
  return (
    <div className={enViaje ? 'app en-viaje' : 'app'}>
      <BarraEstado s={s} demo={demo} pids={pids} panel={panel} abrir={abrir} />
      <main className="mesa">
        <Tablero3D quemadas={s.quemadas} jugadores={(sVivo || s).jugadores} e3d={(sVivo || s).e3d} turnoPid={turnoVisible(s)} miId={s.yo} ciudadesAlcance={alcance} ciudadActiva={ciudadPanel} onCiudad={onCiudad} ronda={s.ronda} orden={(sVivo || s).orden} pend={s.pend} dados={s.dados} />
        <Dados s={s} />
        {panel === 'personajes' && <MenuPersonajes s={s} onCerrar={cerrar} />}
        {panel === 'mano' && <Mano s={s} onCerrar={cerrar} onAbrir={(d) => setConsulta(d)} />}
        {ciudadPanel && <HojaCiudad s={s} id={ciudadPanel} onCerrar={cerrar} />}
        {panel === 'mercado' && <Intercambio s={s} onCerrar={cerrar} />}
        {panel?.startsWith('mercado-') && <Intercambio key={panel} s={s} onCerrar={cerrar} inicial="tratos" contraDe={panel.startsWith('mercado-contra:') ? panel.slice(15) : null} />}
        {s.fase === 'juego' && !panel?.startsWith('mercado') && <AlertaTrato s={s} abrir={abrir} />}
        {s.fase === 'juego' && <AvisosTrato s={s} />}
        {s.fase === 'juego' && <VictoriaYafar s={s} />}
        {panel === 'acciones' && <AccionesTurno s={s} onCerrar={cerrar} />}
        {panel === 'misiones' && <Misiones s={s} onCerrar={cerrar} onAbrir={(d) => setConsulta(d)} />}
        {panel === 'historial' && <Historial s={s} onCerrar={cerrar} onAbrir={(n) => { setConsulta(n); }} />}
        {panel === 'registro' && <Registro s={s} onCerrar={cerrar} />}
        {panel === 'anfitrion' && <PanelAnfitrion s={s} onCerrar={cerrar} />}
        {panel === 'acerca' && <AcercaDe onCerrar={cerrar} />}
        {panel === 'chat' && <PanelChat s={s} onCerrar={cerrar} abrir={abrir} />}
        {s.fase === 'juego' && panel !== 'chat' && <AvisoChat s={s} abrir={abrir} />}
        {s.fase !== 'fin' && <Decision s={s} />}
        {s.fase === 'juego' && <VotoReinicio s={s} />}
      </main>
      <PanelAcciones s={s} abrir={abrir} panel={panel} />
      <ModalCarta s={s} consulta={consulta} onCerrarConsulta={() => setConsulta(null)} huellaCiudades={huellaCiudades} />
      {s.fase === 'fin' && verFin && <Fin s={s} onCerrar={() => setVerFin(false)} />}
      {sinEntrar && <button className="btn entrar-tarde" onClick={() => setVerTablero(false)}>Elegir personaje y entrar</button>}
      {s.fase === 'fin' && !verFin && <button className="btn volver-fin" onClick={() => setVerFin(true)}>Volver al resultado{s.soyHost ? ' · Nueva partida' : ''}</button>}
      {conexion !== 'ok' && <div className="aviso-red" role="status">Reconectando…</div>}
      {s.fase === 'juego' && <AlarmaDesconexion s={s} />}
      {s.fase === 'juego' && <AvisoEspera s={s} />}
      {s.fase === 'juego' && <AvisoBuscado s={s} />}
      {s.fase === 'juego' && s.noSalir && !panel && <div className="alerta-roja" role="alert">⛔ No puedes salir de {s.jugadores[s.yo]?.ciudad}: {s.noSalir}</div>}
      <BurbujasReacciones yo={s.yo} />
      <BotonReacciones s={s} />
      {anuncios.length > 0 && <div className="anuncios-reto">{anuncios.map((a) => <Alerta key={a.id} className={`toast-reto ${a.tono}${a.propio ? ' propio' : ''}`} onCerrar={() => setAnunciosVistos((v) => new Set([...v, a.id]))}>{a.tono === 'ok' ? '✓ ' : ''}{a.texto}</Alerta>)}</div>}
      {error && <Alerta key={'e:' + error} className="toast" role="alert" onCerrar={() => cerrarAviso('error')}>{error}</Alerta>}
      {aviso && !error && <Alerta key={'a:' + aviso} className="toast ok" onCerrar={() => cerrarAviso('aviso')}>{/^(⚠|❌|🤝|🔄|🪔)/u.test(aviso) ? '' : '✓ '}{aviso}</Alerta>}
    </div>
  );
}

export default function App() {
  const lienzo = useLienzo();
  return (
    <LienzoCtx.Provider value={lienzo}>
      <div className="lienzo-raiz">
        <div className="lienzo" style={lienzo.estilo} data-modo={lienzo.modo} data-tam={lienzo.tam} data-forma={lienzo.lw >= lienzo.lh ? 'ancha' : 'alta'} data-rotado={lienzo.rotar ? '1' : '0'}>
          <Juego lienzo={lienzo} />
        </div>
      </div>
    </LienzoCtx.Provider>
  );
}
