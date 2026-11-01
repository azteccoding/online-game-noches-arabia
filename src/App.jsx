import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useJuego, iniciarJuego, leer } from './game/store.js';
import { DATA } from './game/data.js';
import { useLienzo, LienzoCtx } from './hooks/useLienzo.js';
import Entrada from './components/Entrada.jsx';
import Lobby from './components/Lobby.jsx';
import Tablero from './components/Tablero.jsx';
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
import PanelAnfitrion from './components/PanelAnfitrion.jsx';
import { Historial, Registro } from './components/Registro.jsx';
import AcercaDe from './components/AcercaDe.jsx';
import Fin from './components/Fin.jsx';
import './styles/ui.css';

const params = new URLSearchParams(location.search);
const DEMO = import.meta.env.VITE_DEMO === '1';
const Galeria = DEMO ? React.lazy(() => import('./components/Galeria.jsx')) : null;

function Juego({ lienzo }) {
  const s = useJuego((x) => x.estado);
  const conexion = useJuego((x) => x.conexion);
  const error = useJuego((x) => x.error);
  const aviso = useJuego((x) => x.aviso);
  const demo = useJuego((x) => x.demo);
  const pids = useJuego((x) => x.pids);
  const [panel, setPanel] = useState(null);       // personajes | mano | mercado | acciones | misiones | historial | registro | anfitrion | acerca | ciudad:X
  const [consulta, setConsulta] = useState(null);
  const [verFin, setVerFin] = useState(true);

  useEffect(() => {
    if (DEMO && params.get('demo')) iniciarJuego({ demo: true, nombre: params.get('nombre') || 'Ana' });
    else if (localStorage.getItem('mun.token') && localStorage.getItem('mun.nombre')) iniciarJuego({ nombre: localStorage.getItem('mun.nombre') });
  }, []);

  const abrir = useCallback((p) => {
    if (p === 'ultima') { const u = leer().estado?.ultimaCarta; if (u != null) setConsulta(u); return; }
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
  if (s.fase === 'lobby') return <div className="app"><Lobby s={s} />{error && <div className="toast" role="alert">{error}</div>}</div>;

  const ciudadPanel = panel?.startsWith('ciudad:') ? panel.slice(7) : null;
  return (
    <div className="app">
      <BarraEstado s={s} demo={demo} pids={pids} panel={panel} abrir={abrir} />
      <main className="mesa">
        <Tablero jugadores={s.jugadores} turnoPid={s.turno?.pid} miId={s.yo} vivas={vivas} ciudadesAlcance={alcance} ciudadActiva={ciudadPanel} onCiudad={onCiudad} rot={lienzo.rotTablero} uiRot={lienzo.rotUi} />
        <Dados s={s} />
        {panel === 'personajes' && <MenuPersonajes s={s} onCerrar={cerrar} />}
        {panel === 'mano' && <Mano s={s} onCerrar={cerrar} onAbrir={(d) => setConsulta(d)} />}
        {ciudadPanel && <HojaCiudad s={s} id={ciudadPanel} onCerrar={cerrar} />}
        {panel === 'mercado' && <Intercambio s={s} onCerrar={cerrar} />}
        {panel === 'acciones' && <AccionesTurno s={s} onCerrar={cerrar} />}
        {panel === 'misiones' && <Misiones s={s} onCerrar={cerrar} onAbrir={(d) => setConsulta(d)} />}
        {panel === 'historial' && <Historial s={s} onCerrar={cerrar} onAbrir={(n) => { setConsulta(n); }} />}
        {panel === 'registro' && <Registro s={s} onCerrar={cerrar} />}
        {panel === 'anfitrion' && <PanelAnfitrion s={s} onCerrar={cerrar} />}
        {panel === 'acerca' && <AcercaDe onCerrar={cerrar} />}
        {s.fase !== 'fin' && <Decision s={s} />}
        {s.fase === 'fin' && !verFin && <button className="btn flotante" onClick={() => setVerFin(true)}>Ver resultado</button>}
      </main>
      <PanelAcciones s={s} abrir={abrir} panel={panel} />
      <ModalCarta s={s} consulta={consulta} onCerrarConsulta={() => setConsulta(null)} />
      {s.fase === 'fin' && verFin && <Fin s={s} onCerrar={() => setVerFin(false)} />}
      {conexion !== 'ok' && <div className="aviso-red" role="status">Reconectando…</div>}
      {error && <div className="toast" role="alert">{error}</div>}
      {aviso && !error && <div className="toast ok" role="status">✓ {aviso}</div>}
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
