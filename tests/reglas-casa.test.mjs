// Reglas de la casa del juego en línea: node tests/reglas-casa.test.mjs
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, tick } from '../shared/engine.js';
import { publicarCarta, mostrarDados } from '../shared/base.js';
import * as NPC from '../shared/npc.js';
import { cargarDatos } from '../server/datos.js';
import { simular } from './sim.mjs';

const data = cargarDatos();
function partida(pjs, opciones = {}, semilla = 5) {
  const e = nuevoJuego(data, { semilla, ahora: 1000, opciones });
  let now = 1000;
  const act = (pid, a) => { now += 300; return reducir(data, e, pid, a, now); };
  const ids = pjs.map((pj, i) => { const id = unir(e, { nombre: 'J' + i, token: 't' + i }); assert.ok(act(id, { t: 'elegirPj', pj }).ok); return id; });
  for (const id of ids) act(id, { t: 'listo', v: true });
  return { e, act, ids, iniciar: () => act(ids[0], { t: 'iniciar' }), tickear: (ms) => { now += ms; tick(data, e, now); } };
}

// 2) Jugar sin Yafar NPC (1 a 3 jugadores)
{
  const g = partida(['4']); assert.ok(g.act(g.ids[0], { t: 'opciones', sinYafar: true }).ok); assert.ok(g.iniciar().ok);
  assert.equal(g.e.jugadores.npc, undefined, 'en solitario sin Yafar no hay NPC'); assert.equal(g.e.solitario, false);
  const h = partida(['4', '7', '5']); h.act(h.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(h.iniciar().ok);
  assert.equal(h.e.jugadores.npc, undefined, 'con 3 jugadores sin Yafar no hay NPC');
  const k = partida(['4', '7']); assert.ok(k.iniciar().ok); assert.ok(k.e.jugadores.npc, 'sin la opción, Yafar NPC sigue jugando');
  for (let s = 1; s <= 12; s++) {
    const r = simular({ jugadores: 1 + (s % 3), conYafar: false, sinYafar: true, semilla: 900 + s });
    assert.ok(r.ok, 'partida completa sin Yafar NPC: ' + r.motivo); assert.ok(!Object.values(r.e.jugadores).some((j) => j.npc), 'nunca entra el NPC');
  }
}

// 15) Yafar NPC no contrata a los Asesinos; Yafar jugador sí puede
{
  for (let s = 1; s <= 30; s++) {
    const r = simular({ jugadores: 3, conYafar: false, semilla: 700 + s });
    assert.notEqual(r.e.asesinos.contrato?.por, 'npc', 'Yafar NPC nunca contrata');
  }
  const g = partida(['B', '4', '7', '5']); assert.ok(g.iniciar().ok);
  const yafar = g.ids[0], e = g.e;
  e.jugadores[yafar].ciudad = 'Samarcanda'; e.turno = { ...e.turno, pid: yafar, fase: 'mov', principal: false };
  assert.ok(NPC.disponibles(data, e, yafar).length, 'Yafar jugador puede contratar en Samarcanda');
}

// 1) Yafar NPC espera a que los jugadores conectados cierren sus cartas
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, j = g.ids[0];
  e.jugadores[j].conectado = true;
  assert.ok(g.act(j, { t: 'leido', nro: e.seq }).ok);
  assert.equal(NPC.esperaLectura(e), false, 'todo leído: no espera');
  publicarCarta(e, { deck: 'evento', titulo: 'Prueba' }, null);
  assert.equal(NPC.esperaLectura(e), true, 'carta sin cerrar: espera');
  assert.ok(g.act(j, { t: 'leido', nro: e.seq }).ok);
  assert.equal(NPC.esperaLectura(e), false, 'al cerrarla deja de esperar');
  publicarCarta(e, { deck: 'evento', titulo: 'Otra' }, null);
  e.ahora += NPC.ESPERA_LECTURA_MS + 1;
  assert.equal(NPC.esperaLectura(e), false, 'como máximo espera un minuto');
}
// 14) Los dados de un jugador (con cliente web) nunca se lanzan solos
{
  const g = partida(['4', '7', '5']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = [g.ids[1], g.ids[2]];
  while (e.dados) e.dados = null; e.colaDados = [];
  e.jugadores[a].extra.clienteWeb = true;
  mostrarDados(e, { por: a, motivo: 'reto', grupos: [{ etq: 'prueba', valores: [3] }] });
  assert.equal(e.dados.lanzado, false, 'espera el botón «Lanzar»');
  g.tickear(120000); assert.ok(e.dados && !e.dados.lanzado, 'ni a los 2 minutos se lanzan solos');
  assert.ok(!g.act(b, { t: 'cerrarDados' }).ok, 'otro jugador no puede cerrarlos');
  assert.ok(!g.act(e.host === a ? b : e.host, { t: 'lanzarDados' }).ok || e.jugadores[a].conectado === false, 'el banco no lanza por alguien conectado');
  e.jugadores[a].conectado = false;
  if (e.host !== a) { assert.ok(g.act(e.host, { t: 'lanzarDados' }).ok); assert.ok(e.dados.lanzado, 'el banco lanza por un desconectado'); }
  e.dados.lanzado = false; e.jugadores[a].conectado = true;
  assert.ok(g.act(a, { t: 'lanzarDados' }).ok); assert.ok(e.dados.lanzado, 'su dueño los lanza');
}
console.log('reglas de la casa OK');
