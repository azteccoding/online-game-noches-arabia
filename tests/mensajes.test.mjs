// Mensajes de sheijs (reglamento 18.2): un solo Mensaje activo por jugador, sin repetirse y sin fallar al agotarse. node tests/mensajes.test.mjs
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, vista, tick } from '../shared/engine.js';
import { dado } from '../shared/base.js';
import { cargarDatos } from '../server/datos.js';

const data = cargarDatos();
data.config.meta = 1e9;                       // la partida de prueba no debe terminar por noches
const TOTAL = data.mensajes.mensajes.length;
assert.equal(TOTAL, 16);

function partida(pjs, semilla = 11) {
  const e = nuevoJuego(data, { semilla, ahora: 1000 });
  let now = 1000;
  const act = (pid, a) => { now += 3000; return reducir(data, e, pid, a, now); };
  const ids = pjs.map((pj, i) => { const id = unir(e, { nombre: 'J' + i, token: 't' + i }); assert.ok(act(id, { t: 'elegirPj', pj }).ok); return id; });
  for (const id of ids) act(id, { t: 'listo', v: true });
  assert.ok(act(ids[0], { t: 'iniciar' }).ok);
  e.cajaAbierta = true;                       // las pruebas reparten mensajes desde el banco
  const asentar = () => { for (let k = 0; k < 40 && (e.pend || e.dados || !e.turno) && e.fase === 'juego'; k++) { now += 100000; tick(data, e, now); } };
  return { e, act, ids, asentar };
}

// Tira el dado de ingreso del jugador en turno forzando `valor`; devuelve el Mensaje activo antes y después.
function ingreso(g, valor) {
  const { e, act } = g;
  const pid = e.turno.pid;
  const antes = e.jugadores[pid].mensaje?.id || null;
  for (let sem = 1; ; sem++) { const p = { semilla: sem }; if (dado(p) === valor) { e.semilla = sem; break; } }
  const r = act(pid, { t: 'tirarDados' });
  assert.ok(r.ok, r.error);
  assert.equal(e.log.filter((l) => l.pid === pid && /dado de ingreso/.test(l.texto)).pop().texto.slice(-2, -1), String(valor));
  if (e.dados) act(pid, { t: 'cerrarDados' });
  return { pid, antes, despues: e.jugadores[pid].mensaje?.id || null };
}
const cierraTurno = (g) => { g.asentar(); const r = g.act(g.e.turno.pid, { t: 'terminarTurno' }); assert.ok(r.ok, r.error); g.asentar(); };

{
  // Un solo Mensaje activo por jugador: un segundo 6 no cambia el que ya tiene ni consume una carta del mazo.
  const g = partida(['4', '7', '5']); const { e } = g;
  const a = ingreso(g, 6);
  assert.equal(a.antes, null);
  assert.ok(a.despues, 'con un 6 roba su Mensaje');
  const resto = e.mazos.mensajes.length;
  assert.equal(resto, TOTAL - 1);
  cierraTurno(g);
  for (let k = 0; k < 2; k++) { ingreso(g, 1); cierraTurno(g); }
  assert.equal(e.turno.pid, a.pid, 'vuelve a tocarle');
  const b = ingreso(g, 6);
  assert.equal(b.antes, a.despues);
  assert.equal(b.despues, a.despues, 'su Mensaje activo no cambia');
  assert.equal(e.mazos.mensajes.length, resto, 'el 6 no saca otra carta del mazo');
}

{
  // El anfitrión tampoco puede dar un segundo Mensaje activo.
  const g = partida(['4', '7']); const { e, act } = g;
  const host = e.host, otro = e.orden.find((i) => i !== host);
  assert.ok(act(host, { t: 'host.repartir', pid: otro, mazo: 'mensaje' }).ok);
  assert.ok(e.jugadores[otro].mensaje);
  const r = act(host, { t: 'host.repartir', pid: otro, mazo: 'mensaje' });
  assert.ok(!r.ok, 'segundo Mensaje activo rechazado');
  assert.equal(e.mazos.mensajes.length, TOTAL - 1);
}

{
  // Partida simulada: se fuerza un 6 en cada ingreso y los jugadores cumplen o dejan caducar sus Mensajes.
  const g = partida(['4', '7', '5']); const { e, act } = g;
  const vistos = [];
  let vueltas = 0, agotado = false;
  while (vueltas++ < 400) {
    const pid = e.turno.pid;
    const antes = e.jugadores[pid].mensaje?.id || null;
    const r = ingreso(g, 6);
    if (r.despues && r.despues !== antes) vistos.push(r.despues);
    for (const j of Object.values(e.jugadores)) assert.ok(!j.eliminado || !j.mensaje);
    for (const id of e.orden) { const m = e.jugadores[id].mensaje; assert.ok(m === null || typeof m.id === 'string'); }
    assert.equal(new Set(vistos).size, vistos.length, 'ningún Mensaje se repite: ' + vistos.join(','));
    if (!e.mazos.mensajes.length) agotado = true;
    cierraTurno(g);
    if (agotado && vistos.length === TOTAL) {
      for (let k = 0; k < 12; k++) {             // el mazo está agotado: un 6 ya no hace nada y el motor sigue sin fallar
        const antes2 = e.jugadores[e.turno.pid].mensaje?.id || null;
        const q = ingreso(g, 6);
        assert.equal(q.despues, antes2, 'sin Mensajes nuevos');
        assert.equal(e.mazos.mensajes.length, 0);
        cierraTurno(g);
      }
      break;
    }
  }
  assert.equal(vistos.length, TOTAL, 'los 16 salieron, cada uno una sola vez');
  assert.equal(new Set(vistos).size, TOTAL);
  assert.equal(e.mazos.mensajes.length, 0);
  const fuera = e.mazos.descarte.mensajes.length;
  assert.ok(fuera <= TOTAL);
  assert.equal(vista(data, e, e.orden.find((id) => id !== e.host)).host_info, undefined, 'la vista de un jugador no falla con el mazo agotado');
  assert.equal(vista(data, e, e.host).host_info.mazos.mensajes, 0);
  const r = act(e.host, { t: 'host.repartir', pid: e.orden[0], mazo: 'mensaje' });
  assert.ok(!r.ok, 'el banco no puede repartir Mensajes agotados');
}

{
  // Un Mensaje vencido o de un jugador eliminado sale del juego y no vuelve al mazo.
  const g = partida(['4', '7', '5']); const { e, act } = g;
  const a = ingreso(g, 6);
  const id = a.despues; assert.ok(id);
  e.jugadores[a.pid].mensaje.turnoLimite = e.ronda - 1;
  cierraTurno(g);
  assert.equal(e.jugadores[a.pid].mensaje, null, 'vence');
  assert.ok(!e.mazos.mensajes.includes(id), 'no vuelve al mazo');
  assert.ok(e.mazos.descarte.mensajes.includes(id));
  const otro = e.orden.find((i) => i !== a.pid);
  assert.ok(act(e.host, { t: 'host.repartir', pid: otro, mazo: 'mensaje' }).ok);
  const mid = e.jugadores[otro].mensaje.id;
  assert.ok(act(e.host, { t: 'host.eliminar', pid: otro }).ok);
  assert.equal(e.jugadores[otro].mensaje, null);
  assert.ok(!e.mazos.mensajes.includes(mid), 'el Mensaje de un eliminado sale del juego');
}
console.log('mensajes OK');
