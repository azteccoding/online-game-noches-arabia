// Adaptador LOCAL / DEMO: ejecuta el MISMO motor (shared/engine.js) dentro del navegador, con bots, sin servidor ni red.
// Mismo contrato que wsAdapter. Parámetros de URL: ?demo=1 (parte en juego) | ?demo=lobby | &bots=0 (sin bots) | &pj=4 | &minLectura=50 (ms; solo pruebas).
import config from '../../data/config.json';
import ciudades from '../../data/ciudades.json';
import rutas from '../../data/rutas.json';
import personajes from '../../data/personajes.json';
import objetos from '../../data/objetos.json';
import eventos from '../../data/eventos.json';
import mensajes from '../../data/mensajes.json';
import trivias from '../../data/trivias.json';
import cuentos from '../../data/cuentos.json';
import retos from '../../data/retos.json';
import { nuevoJuego, unir, reducir, vista, tick } from '../../../shared/engine.js';
import { armarReaccion } from '../../../shared/reacciones.js';

const DATA = { config, ciudades, rutas, personajes, objetos, eventos, mensajes, trivias, cuentos, retos };

export function crearLocal() {
  const cb = { estado: () => {}, conexion: () => {}, error: () => {}, reaccion: () => {} };
  const ultimas = {};
  const q = new URLSearchParams(location.search);
  const e = nuevoJuego(DATA, { semilla: Number(q.get('semilla')) || 20261101, codigo: 'DEMO' });
  let yo = null, mirando = null, timer = null;
  const botIds = [];
  const emitir = () => cb.estado(vista(DATA, e, mirando || yo));
  const act = (pid, a) => { const r = reducir(DATA, e, pid, a, Date.now()); if (!r.ok && pid === (mirando || yo)) cb.error(r.error); emitir(); return r; };

  const azar = (a) => a[Math.floor(Math.random() * a.length)];
  function bot() {
    if (e.fase !== 'juego') return;
    if (e.dados) { if (Date.now() - e.dados.t0 > 2600) act(yo, { t: 'cerrarDados' }); return; }
    if (e.pend) {
      const p = e.pend, b = p.para.find((x) => botIds.includes(x) && !p.resp[x]);
      if (!b || Date.now() - e.pend.t0 < 1500) return;
      const dis = p.opciones.filter((o) => !o.desactivada);
      return void act(b, p.modo === 'multi' ? { t: 'decidir', id: p.id, valores: [] } : p.modo === 'numero' ? { t: 'decidir', id: p.id, numero: p.min ?? 0 } : { t: 'decidir', id: p.id, opcion: (p.opciones.find((o) => o.id === 'no') || azar(dis)).id });
    }
    if (!e.turno || !botIds.includes(e.turno.pid)) return;
    const t = e.turno, pid = t.pid;
    if (e.historial.length && Date.now() - e.historial[e.historial.length - 1].t < 6500) return;           // deja leer la carta al humano
    const ac = vista(DATA, e, pid).acciones;
    if (t.fase === 'ingreso') return void act(pid, { t: 'tirarDados' });
    if (t.ccActual) return void act(pid, t.ccActual.tipo === 'trivia' ? { t: 'responderCC', opcion: Math.floor(Math.random() * 3) } : { t: 'resolverMesa', ok: Math.random() < 0.5 });
    const viajes = ac.filter((x) => x.k === 'viajar' && x.precio <= e.jugadores[pid].dinares);
    if (viajes.length && Math.random() < 0.7 && act(pid, { t: 'viajar', destino: azar(viajes).destino }).ok) return;
    const retosOk = ac.filter((x) => x.k === 'reto' && !x.bloqueado && !x.sub);
    if (retosOk.length && Math.random() < 0.25 && act(pid, { t: 'reto', id: azar(retosOk).id }).ok) return;
    act(pid, { t: 'terminarTurno' });
  }

  return {
    modo: 'demo',
    pids: () => ({ yo, bots: botIds }),
    conectar(p) {
      const modo = q.get('demo');
      yo = unir(e, { nombre: p.nombre || 'Dulce', token: 'demo' });
      const nombres = ['Beto', 'Cleo', 'Dani'], pjs = ['4', '6', 'B'];
      nombres.forEach((n, i) => { const id = unir(e, { nombre: n, token: 'bot' + i }); botIds.push(id); reducir(DATA, e, id, { t: 'elegirPj', pj: pjs[i] }, Date.now()); reducir(DATA, e, id, { t: 'listo', v: true }, Date.now()); });
      cb.conexion('ok');
      if (modo !== 'lobby') {
        reducir(DATA, e, yo, { t: 'elegirPj', pj: q.get('pj') || '1' }, Date.now());
        reducir(DATA, e, yo, { t: 'listo', v: true }, Date.now());
        reducir(DATA, e, yo, { t: 'iniciar' }, Date.now());
      }
      emitir();
      timer = setInterval(() => { if (tick(DATA, e, Date.now())) emitir(); if (q.get('bots') !== '0') bot(); }, 1100);
      window.__demo = { e, act, DATA, yo, botIds };
    },
    enviar(a) { act(mirando || yo, a); },
    verComo(pid) { mirando = pid === yo ? null : pid; emitir(); },
    reaccionar(id) { const p = mirando || yo, x = armarReaccion(e, p, id, Date.now(), ultimas[p]); if (x.error) return cb.error(x.error); ultimas[p] = Date.now(); cb.reaccion(x.r); },
    cerrar() { clearInterval(timer); },
    onEstado: (f) => { cb.estado = f; }, onConexion: (f) => { cb.conexion = f; }, onError: (f) => { cb.error = f; }, onReaccion: (f) => { cb.reaccion = f; },
  };
}
