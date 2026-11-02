// Cartas de cuento de ambiente (reglamento 19.7): node tests/cuentos.test.mjs
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, vista, serializar, restaurar, sacarCuento } from '../shared/engine.js';
import { cargarDatos } from '../server/datos.js';

const todos = cargarDatos();
assert.equal(todos.cuentos.cuentos.length, 21, '7 originales + 14 nuevos');
for (const clave of ['Bagdad', 'Isfahán', 'Aleppo', 'Damasco', 'Basra', 'El Cairo', 'Respuestas']) assert.equal(todos.cuentos.cuentos.filter((c) => c.clave === clave).length, 3, '3 cuentos en ' + clave);
// Las pruebas de la regla 19.7 usan solo los 7 cuentos originales (uno por mazo) para que el resultado no dependa del azar.
const data = { ...todos, cuentos: { ...todos.cuentos, cuentos: todos.cuentos.cuentos.filter((c) => !/\d$/.test(c.id)) } };
assert.equal(data.cuentos.cuentos.length, 7);
assert.equal(data.config.premioCuento, 2);

function partida(pjs, semilla = 7) {
  const e = nuevoJuego(data, { semilla, ahora: 1000 });
  let now = 1000;
  const act = (pid, a) => { now += 3000; return reducir(data, e, pid, a, now); };
  const ids = pjs.map((pj, i) => { const id = unir(e, { nombre: 'J' + i, token: 't' + i }); assert.ok(act(id, { t: 'elegirPj', pj }).ok); return id; });
  for (const id of ids) act(id, { t: 'listo', v: true });
  assert.ok(act(ids[0], { t: 'iniciar' }).ok);
  return { e, act, ids };
}

// Prepara el turno de `pid` hasta poder viajar, con un mazo de Damasco controlado (trivia primero).
function aViajar(g, pid, destino = 'Damasco') {
  const { e, act } = g;
  assert.equal(e.turno.pid, pid);
  assert.ok(act(pid, { t: 'tirarDados' }).ok);
  assert.ok(act(pid, { t: 'cerrarDados' }).ok);
  const j = e.jugadores[pid]; j.dinares = 100; j.mensaje = null;
  e.sinCaravanasBagdad = false;                                   // el evento de ronda sale al azar: la prueba necesita poder viajar
  const antes = j.dinares;
  const r = act(pid, { t: 'viajar', destino });
  assert.ok(r.ok, r.error);
  const m = e.log.filter((l) => l.pid === pid && /viaja de/.test(l.texto)).pop().texto.match(/\((\d+) dinares\)/);
  return { antes, precio: Number(m[1]) };
}

{
  const g = partida(['4', '7', '5']); const { e, act } = g;
  const trivs = data.trivias.trivias.filter((t) => t.ciudad === 'Damasco').map((t) => ({ k: 't', id: t.id }));
  e.mazos.cc.Damasco = trivs.slice();
  const p1 = e.turno.pid;
  const { antes, precio } = aViajar(g, p1);
  const cuentos = e.historial.filter((h) => h.deck === 'cuento');
  assert.equal(cuentos.length, 1, 'sale el cuento de Damasco');
  assert.equal(cuentos[0].titulo, 'Alí Babá y los cuarenta ladrones');
  assert.equal(cuentos[0].quien, p1, 'lo saca quien tomó la CC');
  assert.equal(cuentos[0].para, null, 'público para toda la mesa');
  assert.equal(cuentos[0].premio, 2);
  assert.equal(e.jugadores[p1].dinares, antes - precio + 2, 'el lector cobra 2 dinares del banco');
  const cc = e.historial.find((h) => h.deck === 'trivia');
  assert.ok(cuentos[0].nro < cc.nro, 'el cuento se lee antes que la CC');
  assert.ok(vista(data, e, e.orden.find((i) => i !== p1)).historial.some((h) => h.deck === 'cuento'), 'todos ven el cuento');

  // la primera trivia resuelta saca el cuento de las Respuestas
  const dinAntes = e.jugadores[p1].dinares;
  const tr = data.trivias.trivias.find((t) => t.id === e.turno.ccActual.id);
  assert.ok(act(p1, { t: 'responderCC', opcion: tr.correcta }).ok);
  assert.equal(e.jugadores[p1].dinares, dinAntes + 10 + 2, 'trivia (10) y cuento de Respuestas (2)');
  const resp = e.historial.filter((h) => h.deck === 'cuento');
  assert.deepEqual(resp.map((h) => h.titulo), ['Alí Babá y los cuarenta ladrones', 'Scheherezade y el sultán']);
  assert.ok(act(p1, { t: 'terminarTurno' }).ok);

  // el segundo jugador en Damasco: ya no hay cuento ni de la ciudad ni de las Respuestas
  e.mazos.cc.Damasco = trivs.slice(5);
  const p2 = e.turno.pid;
  const s2 = aViajar(g, p2);
  assert.equal(e.historial.filter((h) => h.deck === 'cuento').length, 2, 'cada cuento sale una sola vez');
  const visita = e.log.filter((l) => l.texto.startsWith(e.jugadores[p2].nombre + ' visita a')).reduce((s, l) => s + Number((/por (\d+) dinares/.exec(l.texto) || [0, 0])[1]), 0);   // la visita al otro jugador depende del azar
  assert.equal(e.jugadores[p2].dinares, s2.antes - s2.precio - visita, 'sin premio');
  assert.ok(act(p2, { t: 'responderCC', opcion: 0 }).ok);
  assert.equal(e.historial.filter((h) => h.deck === 'cuento').length, 2);

  // persistencia: tras restaurar no se repite
  const copia = restaurar(serializar(e));
  assert.deepEqual(copia.cuentosSacados.sort(), ['Damasco', 'Respuestas']);
  assert.equal(sacarCuento(data, copia, p1, 'Damasco'), null);
}

{
  // eliminados y NPC no leen ni cobran; la carta queda disponible para otro jugador
  const g = partida(['4', '7', '5']); const { e } = g;
  const [a, b] = e.orden;
  e.jugadores[a].eliminado = true; const din = e.jugadores[a].dinares;
  assert.equal(sacarCuento(data, e, a, 'Bagdad'), null);
  assert.equal(e.jugadores[a].dinares, din);
  assert.ok(!e.cuentosSacados.includes('Bagdad'));
  e.jugadores[b].npc = true;
  assert.equal(sacarCuento(data, e, b, 'Bagdad'), null);
  e.jugadores[b].npc = false;
  const din2 = e.jugadores[b].dinares;
  assert.ok(sacarCuento(data, e, b, 'Bagdad'));
  assert.equal(e.jugadores[b].dinares, din2 + 2);
  assert.equal(sacarCuento(data, e, b, 'Bagdad'), null, 'una sola vez');
}

{
  // solitario: el jugador lee y cobra igual
  const g = partida(['4']); const { e } = g;
  const p = e.turno.pid;
  const { antes, precio } = aViajar(g, p, 'Isfahán');
  assert.ok(e.historial.some((h) => h.deck === 'cuento' && h.quien === p));
  assert.equal(e.jugadores[p].dinares, antes - precio + 2);
}
{
  // Yafar: jugado por una persona cobra los 2 dinares como cualquier jugador; como NPC no lee ni cobra (reglamento 19.7)
  const g = partida(['B', '4', '7']); const { e } = g;
  const y = e.orden.find((id) => e.jugadores[id].pj === 'B');
  assert.ok(y && !e.jugadores[y].npc, 'Yafar lo juega una persona');
  const din = e.jugadores[y].dinares;
  assert.ok(sacarCuento(data, e, y, 'Bagdad'), 'Yafar jugador lee el cuento');
  assert.equal(e.jugadores[y].dinares, din + 2, 'y cobra 2 dinares');
  assert.equal(sacarCuento(data, e, y, 'Bagdad'), null, 'una sola vez');
  e.jugadores[y].npc = true;
  const din2 = e.jugadores[y].dinares;
  assert.equal(sacarCuento(data, e, y, 'Aleppo'), null, 'Yafar NPC no lee');
  assert.equal(e.jugadores[y].dinares, din2, 'Yafar NPC no cobra');
  assert.ok(!e.cuentosSacados.includes('Aleppo'), 'la carta sigue disponible para una persona');
  assert.equal(data.config.reglasCasa.yafarNpcNoCobraCuentos, true);
}
// Cada cuento pertenece a un solo mazo (ids únicos), así ningún cuento puede salir dos veces en una partida
assert.equal(new Set(data.cuentos.cuentos.map((c) => c.id)).size, data.cuentos.cuentos.length, 'ids de cuentos únicos');
// Varios cuentos en un mazo: en cada partida sale uno al azar, y el mazo sigue dando un solo cuento por partida
{
  const extra = { ...data, cuentos: { ...data.cuentos, cuentos: [...data.cuentos.cuentos, { ...data.cuentos.cuentos.find((c) => c.clave === 'Bagdad'), id: 'CU-B2', titulo: 'Otro cuento de Bagdad' }] } };
  const vistos = new Set();
  for (let semilla = 1; semilla <= 200; semilla++) {
    const e = nuevoJuego(extra, { semilla, ahora: 1000 }); const id = unir(e, { nombre: 'J', token: 't' });
    assert.ok(sacarCuento(extra, e, id, 'Bagdad'));
    assert.equal(sacarCuento(extra, e, id, 'Bagdad'), null, 'un solo cuento por mazo y partida');
    const e2 = restaurar(serializar(e));
    assert.equal(sacarCuento(extra, e2, id, 'Bagdad'), null, 'tras guardar y restaurar no se repite ni cambia');
    for (const clave of new Set(extra.cuentos.cuentos.map((c) => c.clave))) sacarCuento(extra, e2, id, clave);
    const titulos = e2.historial.filter((h) => h.deck === 'cuento').map((h) => h.titulo);
    assert.equal(new Set(titulos).size, titulos.length, 'ningún cuento se repite en una partida');
    vistos.add(e.historial.find((h) => h.deck === 'cuento').titulo);
  }
  assert.equal(vistos.size, 2, 'salen los dos cuentos de Bagdad en distintas partidas');
}
// Con los datos reales (3 por mazo): cada mazo da uno solo y ningún cuento se repite en una partida, ni tras guardar y restaurar
{
  const claves = [...new Set(todos.cuentos.cuentos.map((c) => c.clave))];
  const vistos = new Set();
  for (let semilla = 1; semilla <= 200; semilla++) {
    let e = nuevoJuego(todos, { semilla, ahora: 1000 }); const id = unir(e, { nombre: 'J', token: 't' });
    for (const [k, clave] of claves.entries()) { if (k === 3) e = restaurar(serializar(e)); sacarCuento(todos, e, id, clave); sacarCuento(todos, e, id, clave); }
    const t = e.historial.filter((h) => h.deck === 'cuento').map((h) => h.titulo);
    assert.equal(t.length, claves.length, 'un cuento por mazo'); assert.equal(new Set(t).size, t.length, 'sin repetir');
    t.forEach((x) => vistos.add(x));
  }
  assert.equal(vistos.size, 21, 'en 200 partidas salen los 21 cuentos');
}
console.log('cuentos OK');
