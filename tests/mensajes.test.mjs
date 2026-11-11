// Mensajes de sheijs (reglamento 18.2): varios Mensajes activos por jugador, sin repetirse y sin fallar al agotarse. node tests/mensajes.test.mjs
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, vista, tick, serializar, restaurar } from '../shared/engine.js';
import { mensajes } from '../shared/retos.js';
import { dado } from '../shared/base.js';
import { cargarDatos } from '../server/datos.js';

const data = cargarDatos();
data.config.meta = 1e9;                       // la partida de prueba no debe terminar por noches
const TOTAL = data.mensajes.mensajes.length;
assert.equal(TOTAL, 18);   // 16 encargos + 2 cartas de permiso (Ibn Hazm e Ibn Arabi, 10 de noviembre)

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

// Tira el dado de ingreso del jugador en turno forzando `valor`; devuelve los Mensajes activos antes y después.
const ids = (j) => [...j.mensajes.map((m) => m.id), ...j.mano.filter((c) => c.extra?.msg).map((c) => c.extra.msg)];   // las cartas de permiso van a la mano
function ingreso(g, valor) {
  const { e, act } = g;
  const pid = e.turno.pid;
  const antes = ids(e.jugadores[pid]);
  for (let sem = 1; ; sem++) { const p = { semilla: sem }; if (dado(p) === valor) { e.semilla = sem; break; } }
  const r = act(pid, { t: 'tirarDados' });
  assert.ok(r.ok, r.error);
  assert.equal(e.log.filter((l) => l.pid === pid && /dado de ingreso/.test(l.texto)).pop().texto.slice(-2, -1), String(valor));
  if (e.dados) act(pid, { t: 'cerrarDados' });
  return { pid, antes, despues: ids(e.jugadores[pid]) };
}
const cierraTurno = (g) => { g.asentar(); const r = g.act(g.e.turno.pid, { t: 'terminarTurno' }); assert.ok(r.ok, r.error); g.asentar(); };

{
  // Se pueden tener varios Mensajes activos: un segundo 6 trae otro y no quita el que ya tiene.
  const g = partida(['4', '7', '5']); const { e } = g;
  const a = ingreso(g, 6);
  assert.deepEqual(a.antes, []);
  assert.equal(a.despues.length, 1, 'con un 6 roba su Mensaje');
  const resto = e.mazos.mensajes.length;
  assert.equal(resto, TOTAL - 1);
  cierraTurno(g);
  for (let k = 0; k < 2; k++) { ingreso(g, 1); cierraTurno(g); }
  assert.equal(e.turno.pid, a.pid, 'vuelve a tocarle');
  const b = ingreso(g, 6);
  assert.equal(b.despues.length, 2, 'recibe otro Mensaje');
  assert.equal(b.despues[0], a.despues[0], 'conserva el primero');
  assert.equal(e.mazos.mensajes.length, resto - 1, 'el 6 saca otra carta del mazo');
  assert.equal(vista(data, e, a.pid).mensajes.length, 2, 'su vista trae los dos, con su carta');
  assert.ok(vista(data, e, a.pid).mensajes.every((m) => m.carta?.texto));
  const otro = e.orden.find((i) => i !== a.pid);
  assert.equal(vista(data, e, otro).mensajes.length, 0, 'los demás no ven sus Mensajes');
  assert.equal(vista(data, e, otro).jugadores[a.pid].nMensajes, 2);
}

{
  // El anfitrión también puede dar un segundo Mensaje.
  const g = partida(['4', '7']); const { e, act } = g;
  const host = e.host, otro = e.orden.find((i) => i !== host);
  assert.ok(act(host, { t: 'host.repartir', pid: otro, mazo: 'mensaje' }).ok);
  assert.ok(act(host, { t: 'host.repartir', pid: otro, mazo: 'mensaje' }).ok, 'segundo Mensaje activo');
  assert.equal(ids(e.jugadores[otro]).length, 2);
  assert.equal(e.mazos.mensajes.length, TOTAL - 2);
}

{
  // Partida simulada: se fuerza un 6 en cada ingreso y los jugadores cumplen o dejan caducar sus Mensajes.
  const g = partida(['4', '7', '5']); const { e, act } = g;
  const vistos = [];
  let vueltas = 0, agotado = false;
  while (vueltas++ < 400) {
    const pid = e.turno.pid;
    const r = ingreso(g, 6);
    vistos.push(...r.despues.filter((x) => !r.antes.includes(x)));
    for (const j of Object.values(e.jugadores)) assert.ok(!j.eliminado || !j.mensajes.length);
    for (const id of e.orden) for (const m of e.jugadores[id].mensajes) assert.equal(typeof m.id, 'string');
    assert.equal(new Set(vistos).size, vistos.length, 'ningún Mensaje se repite: ' + vistos.join(','));
    if (!e.mazos.mensajes.length) agotado = true;
    cierraTurno(g);
    if (agotado && vistos.length === TOTAL) {
      for (let k = 0; k < 12; k++) {             // el mazo está agotado: un 6 ya no hace nada y el motor sigue sin fallar
        const q = ingreso(g, 6);
        assert.deepEqual(q.despues, q.antes, 'sin Mensajes nuevos');
        assert.equal(e.mazos.mensajes.length, 0);
        cierraTurno(g);
      }
      break;
    }
  }
  assert.equal(vistos.length, TOTAL, 'los 18 salieron, cada uno una sola vez');
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
  const id = a.despues[0]; assert.ok(id);
  e.jugadores[a.pid].mensajes[0].turnoLimite = e.ronda - 1;
  cierraTurno(g);
  assert.equal(e.jugadores[a.pid].mensajes.length, 0, 'vence');
  assert.ok(!e.mazos.mensajes.includes(id), 'no vuelve al mazo');
  assert.ok(e.mazos.descarte.mensajes.includes(id));
  const otro = e.orden.find((i) => i !== a.pid);
  assert.ok(act(e.host, { t: 'host.repartir', pid: otro, mazo: 'mensaje' }).ok);
  const mid = e.jugadores[otro].mensajes[0].id;
  assert.ok(act(e.host, { t: 'host.eliminar', pid: otro }).ok);
  assert.equal(e.jugadores[otro].mensajes.length, 0);
  assert.ok(!e.mazos.mensajes.includes(mid), 'el Mensaje de un eliminado sale del juego');
}
{
  // Con dos Mensajes, cumplir uno deja el otro; una partida guardada con el campo viejo se migra.
  const g = partida(['4', '7']); const { e } = g;
  g.asentar();
  const pid = e.turno.pid, j = e.jugadores[pid];
  j.mensajes = [{ id: 'M12', turnoLimite: 99 }, { id: 'M7', turnoLimite: 99 }]; j.ciudad = 'Bagdad';
  mensajes(data, e, pid, 'llegada', { primera: false });
  assert.deepEqual(ids(j), ['M12'], 'solo se cumple M7');
  j.ciudad = 'Yemen'; mensajes(data, e, pid, 'llegada', { primera: false });
  assert.deepEqual(ids(j), [], 'luego se cumple el otro');
  const viejo = JSON.parse(serializar(e)); viejo.v = 2;
  for (const x of Object.values(viejo.jugadores)) { delete x.mensajes; x.mensaje = null; }
  viejo.jugadores[pid].mensaje = { id: 'M3', turnoLimite: 9 };
  const m = restaurar(JSON.stringify(viejo));
  assert.deepEqual(m.jugadores[pid].mensajes, [{ id: 'M3', turnoLimite: 9 }], 'partida guardada: el Mensaje pasa a la lista');
  assert.equal(m.jugadores[pid].mensaje, undefined);
}
console.log('mensajes OK');
