// Reglas de la casa del juego en línea: node tests/reglas-casa.test.mjs
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, tick, llegada } from '../shared/engine.js';
import { publicarCarta, mostrarDados, dado } from '../shared/base.js';
import * as NPC from '../shared/npc.js';
import { mensajes } from '../shared/retos.js';
import { peleaNPC } from '../shared/pelea.js';
import { vender, tienda } from '../shared/objetos.js';
import { finTurno } from '../shared/eventos.js';
import { tieneItem } from '../shared/base.js';
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
// 10) Reto del Éufrates (R1): con deuda no se sale de Bagdad; sin dinares, se paga con todas las noches
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e;
  for (let k = 0; k < 40 && (e.pend || e.dados || !e.turno || e.jugadores[e.turno.pid].npc); k++) { e.dados = null; e.colaDados = []; g.tickear(100000); }
  const pid = e.turno.pid, j = e.jugadores[pid];
  if (e.turno.fase === 'ingreso') { assert.ok(g.act(pid, { t: 'tirarDados' }).ok); e.dados = null; e.colaDados = []; }
  j.ciudad = 'Bagdad'; j.misiones.push({ id: 'R1', deuda: 21, ayudantes: 3, busca: false, vence: j.turnos + 3 });
  const r = g.act(pid, { t: 'viajar', destino: 'Damasco' });
  assert.ok(!r.ok && /deuda con Bagdad/.test(r.error), 'con deuda no puedes salir de Bagdad');
  j.dinares = 3; j.noches = 140;
  assert.ok(g.act(pid, { t: 'reto', id: 'R1', sub: 'pagar' }).ok);
  assert.equal(j.noches, 0, 'sin dinares, la deuda se paga con todas las noches'); assert.equal(j.dinares, 3);
  assert.ok(!j.misiones.some((m) => m.id === 'R1'), 'queda libre');
}
// 13) Dado de Ibn Arabi: lo regalan sus mensajes y repite una pelea perdida
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, pid = g.ids[0], j = e.jugadores[pid];
  j.mensaje = { id: 'M13' }; j.ciudad = 'Damasco';
  mensajes(data, e, pid, 'llegada', { primera: false });
  assert.ok(tieneItem(j, 'dadoIbnArabi'), 'Ibn Arabi regala el dado al cumplir su mensaje');
  const gana = peleaNPC(data, e, pid, { etq: 'Gigante invencible', dados: 2, bono: 100 });
  assert.equal(gana, false);
  assert.ok(!tieneItem(j, 'dadoIbnArabi'), 'el dado se gasta');
  assert.ok(e.log.some((l) => /usa el Dado de Ibn Arabi/.test(l.texto)), 'se repitió la pelea');
}
// 3) Yafar herido puede ofrecer 50 dinares al retador para huir
{
  const prep = (dinYafar) => {
    const g = partida(['1', '7']); assert.ok(g.iniciar().ok);
    const e = g.e, nur = g.ids[0], y = e.jugadores.npc;
    e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.pelea = null;
    for (const id of [nur, 'npc']) e.jugadores[id].ciudad = 'Damasco';
    y.herido = true; y.dinares = dinYafar; e.jugadores[nur].dinares = 10;
    e.turno = { pid: nur, idx: e.orden.indexOf(nur), fase: 'mov', tramos: 0, ciudadInicio: 'Damasco', movio: false, llegadas: [], cc: 0, ccBien: 0, ccActual: null, principal: false, gastos: {} };
    assert.ok(g.act(nur, { t: 'atacar', tipo: 'duelo', objetivo: 'npc' }).ok);
    return { g, e, nur, y };
  };
  let { g, e, nur, y } = prep(80);
  assert.equal(e.pend?.titulo, 'Yafar ofrece 50 dinares', 'el retador recibe la oferta');
  assert.ok(g.act(nur, { t: 'decidir', id: e.pend.id, opcion: 'acepto' }).ok);
  assert.equal(e.jugadores[nur].dinares, 60); assert.equal(y.dinares, 30); assert.equal(e.pelea, null, 'no hay pelea');
  ({ g, e, nur, y } = prep(80));
  assert.ok(g.act(nur, { t: 'decidir', id: e.pend.id, opcion: 'no' }).ok);
  assert.ok(e.log.some((l) => /gana el duelo|Gana /.test(l.texto)), 'si rechaza, la pelea sigue normal');
  ({ g, e, nur, y } = prep(40));
  assert.notEqual(e.pend?.titulo, 'Yafar ofrece 50 dinares', 'sin 50 dinares no hay oferta');
}
// Prepara un turno de pruebas para pid sin dados ni decisiones pendientes.
const turnoDe = (e, pid, ciudad) => {
  e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.pelea = null;
  e.turno = { pid, idx: e.orden.indexOf(pid), fase: 'mov', tramos: 0, ciudadInicio: ciudad, movio: false, llegadas: [], cc: 0, ccBien: 0, ccActual: null, principal: false, gastos: {} };
};
// Fuerza los próximos dados (dado() usa e.semilla): busca una semilla cuyos primeros dados sean `valores`.
function forzar(e, ...valores) {
  for (let s = 1; s < 200000; s++) { const p = { semilla: s }; if (valores.every((v) => dado(p) === v)) { e.semilla = s; return; } }
  throw new Error('sin semilla');
}

// 2) Arco y escudo: disparo y escudo antes de un asalto o un ataque a muerte
{
  const prep = () => {
    const g = partida(['4', '7', '5']); assert.ok(g.iniciar().ok);
    const e = g.e, [jamil, adi] = g.ids;
    for (const id of g.ids) e.jugadores[id].ciudad = 'Damasco';
    e.ronda = 5; turnoDe(e, jamil, 'Damasco');
    e.jugadores[jamil].mano.push({ uid: 9001, tipo: 'item', ref: 'cimitarra' });
    return { g, e, jamil, adi, A: e.jugadores[adi] };
  };
  let { g, e, jamil, adi, A } = prep();
  A.mano.push({ uid: 9002, tipo: 'item', ref: 'arco' }, { uid: 9003, tipo: 'item', ref: 'flechas' }, { uid: 9004, tipo: 'item', ref: 'flechas' });
  forzar(e, 6);
  assert.ok(g.act(jamil, { t: 'atacar', tipo: 'robo', objetivo: adi }).ok);
  assert.equal(e.pelea, null, 'la flecha frustra el asalto');
  assert.ok(e.jugadores[jamil].herido, 'el atacante queda herido');
  assert.equal(A.mano.filter((c) => c.ref === 'flechas').length, 1, 'gasta una flecha');
  ({ g, e, jamil, adi, A } = prep());
  A.mano.push({ uid: 9005, tipo: 'objeto', ref: 'OB04' });
  forzar(e, 5);
  const din = A.dinares;
  assert.ok(g.act(jamil, { t: 'atacar', tipo: 'robo', objetivo: adi }).ok);
  assert.equal(e.pelea, null, 'el escudo para el golpe'); assert.equal(A.dinares, din);
  ({ g, e, jamil, adi, A } = prep());
  A.mano.push({ uid: 9006, tipo: 'objeto', ref: 'OB04' });
  forzar(e, 1);
  assert.ok(g.act(jamil, { t: 'atacar', tipo: 'robo', objetivo: adi }).ok);
  assert.ok(!A.mano.some((c) => c.ref === 'OB04'), 'con un 1 el escudo se rompe');
  assert.ok(e.pelea, 'y la pelea sigue');
  ({ g, e, jamil, adi, A } = prep());
  A.mano.push({ uid: 9007, tipo: 'objeto', ref: 'OB04' });
  forzar(e, 6);
  assert.ok(g.act(jamil, { t: 'atacar', tipo: 'duelo', objetivo: adi }).ok);
  assert.ok(e.pelea, 'en los duelos no hay escudo previo');
  // contra NPC (bandoleros) el arco también dispara primero
  ({ g, e, jamil, adi, A } = prep());
  A.ciudad = 'Basra'; A.mano.push({ uid: 9008, tipo: 'item', ref: 'arco' }, { uid: 9009, tipo: 'item', ref: 'flechas' });
  forzar(e, 5);
  assert.equal(peleaNPC(data, e, adi, { etq: 'Bandoleros', dados: 2, bono: 100 }), true, 'la flecha pone en fuga a los bandoleros');
  // los ladrones de Alí Babá (E2)
  ({ g, e, jamil, adi, A } = prep());
  e.mods.ladrones = true; turnoDe(e, adi, 'Damasco'); A.dinares = 30;
  A.mano.push({ uid: 9010, tipo: 'objeto', ref: 'OB04' });
  forzar(e, 6); finTurno(data, e, adi);
  assert.equal(A.dinares, 30, 'el escudo ahuyenta a los ladrones');
}

// 1) y 7) Mercado escaso, reposición lenta y mercancías que se venden caras en otras ciudades
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, pid = g.ids[0], j = e.jugadores[pid];
  for (const o of data.objetos.mazo.filter((x) => !x.sinVenta)) assert.equal(e.stock[o.id], Math.max(1, o.copias - 2), 'stock inicial ' + o.id);
  const seda = data.objetos.mazo.find((o) => o.id === 'OB34');
  assert.ok(seda.reventa.Bagdad && seda.reventa['Andalucía'] > seda.reventa.Bagdad, 'la seda se vende más cara lejos');
  turnoDe(e, pid, 'Andalucía'); j.ciudad = 'Andalucía'; e.turno.fase = 'acciones';
  j.mano.push({ uid: 9100, tipo: 'objeto', ref: 'OB34' });
  const antes = j.dinares, stock = e.stock.OB34;
  assert.ok(vender(data, e, pid, { uid: 9100 }).ok);
  assert.equal(j.dinares, antes + seda.reventa['Andalucía'], 'sin impuesto en una ciudad de reventa');
  assert.equal(e.stock.OB34, stock, 'lo vendido no vuelve al instante al mercado');
  assert.deepEqual(e.reposicion, ['OB34']);
  j.mano.push({ uid: 9101, tipo: 'objeto', ref: 'OB34' }); j.ciudad = 'Damasco';
  const a2 = j.dinares; assert.ok(vender(data, e, pid, { uid: 9101 }).ok);
  assert.equal(j.dinares, a2 + seda.valor - Math.floor(seda.valor * 20 / 100), 'en otra ciudad vale lo normal menos impuesto');
  assert.ok(!tienda(data, e, pid).some((x) => x.id === 'OB34'), 'la seda solo se compra en Isfahán');
}

// 6) Yafar NPC cobra la mitad de las noches de llegada si no hay ningún jugador en la ciudad
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, y = e.jugadores.npc;
  turnoDe(e, 'npc', 'Damasco'); e.ronda = 1;
  for (const id of g.ids) e.jugadores[id].ciudad = 'Bagdad';
  y.ciudad = 'Basra'; y.visitadas = ['Bagdad', 'Basra']; let n0 = y.noches; llegada(data, e, 'npc', 'Damasco');
  assert.equal(y.noches - n0, Math.floor(15 / 2), 'solo: la mitad');
  turnoDe(e, 'npc', 'Damasco'); e.jugadores[g.ids[0]].ciudad = 'Isfahán';
  y.ciudad = 'Isfahán'; y.visitadas.push('Isfahán'); n0 = y.noches; llegada(data, e, 'npc', 'Damasco');
  assert.equal(y.noches - n0, 15, 'con un jugador en la ciudad: completo');
}

// 8) Trivias a 5 dinares
{
  assert.equal(data.config.premioTrivia, 5);
  assert.ok(data.trivias.trivias.every((t) => t.premio === 5));
}

// 9) Ibn Hazm regala un libro solo con su Mensaje M6 (entregar un libro, papiro o mapa); la biblioteca de Bagdad lo compra
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, pid = g.ids[0], j = e.jugadores[pid];
  j.mensaje = { id: 'M7' }; j.ciudad = 'Bagdad';
  mensajes(data, e, pid, 'llegada', { primera: false });
  assert.equal(j.mensaje, null, 'M7 se cumple'); assert.ok(!j.mano.some((c) => c.ref === 'libroIbnHazm'), 'los otros Mensajes de Ibn Hazm no dan libro');
  const papiro = { uid: 9200, tipo: 'item', ref: 'papiro', extra: { valor: 4, ronda: 1 } };
  j.mensaje = { id: 'M6' }; mensajes(data, e, pid, 'trato', { dio: [papiro] });
  const libro = j.mano.find((c) => c.ref === 'libroIbnHazm');
  assert.ok(libro && libro.extra.titulo === 'El collar de la paloma', 'M6 regala un libro con título real');
  turnoDe(e, pid, 'Bagdad'); e.turno.fase = 'acciones'; e.ronda += 3;
  const antes = j.dinares; assert.ok(vender(data, e, pid, { uid: libro.uid }).ok);
  assert.equal(j.dinares, antes + Math.floor((50 + 6) / 2), 'la biblioteca paga la mitad del valor (50 + 2 por ronda)');
  for (let k = 0; k < 3; k++) { j.mensaje = { id: 'M6' }; mensajes(data, e, pid, 'trato', { dio: [papiro] }); }
  assert.equal(j.mano.filter((c) => c.ref === 'libroIbnHazm').length, 2, 'máximo 2 en la mano');
}

// 10) Bazar del genio: una carta de Ifrit por ronda en Samarcanda o India, por 60 dinares
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  turnoDe(e, a, 'Bagdad'); e.turno.fase = 'acciones'; A.dinares = 200; B.dinares = 200;
  assert.ok(!g.act(a, { t: 'comprar', ref: 'ifrit' }).ok, 'en Bagdad no hay bazar del genio');
  A.ciudad = 'Samarcanda';
  assert.ok(tienda(data, e, a).some((x) => x.ref === 'ifrit' && x.puede), 'aparece en la tienda de Samarcanda');
  assert.ok(g.act(a, { t: 'comprar', ref: 'ifrit' }).ok);
  assert.equal(A.dinares, 140); assert.equal(A.mano.filter((c) => c.tipo === 'ifrit').length, 1, 'la carta queda en la mano');
  assert.ok(e.historial.some((h) => h.deck === 'ifrit' && h.para?.includes(a)), 'se le muestra la carta');
  turnoDe(e, b, 'India'); e.turno.fase = 'acciones'; B.ciudad = 'India';
  assert.ok(!g.act(b, { t: 'comprar', ref: 'ifrit' }).ok, 'solo una por ronda en toda la partida');
  e.ronda++;
  assert.ok(g.act(b, { t: 'comprar', ref: 'ifrit' }).ok, 'en la ronda siguiente hay otra');
}

// 4) El banco propone terminar y empezar de nuevo: votación por mayoría y sala nueva con los mismos jugadores
{
  const g = partida(['4', '7', '5']); assert.ok(g.iniciar().ok);
  const e = g.e, [host, b, c] = g.ids;
  for (const id of g.ids) e.jugadores[id].conectado = true;
  assert.ok(!g.act(b, { t: 'host.reiniciar' }).ok, 'solo el banco lo propone');
  assert.ok(g.act(host, { t: 'host.reiniciar' }).ok);
  assert.ok(e.votoReinicio, 'empieza la votación');
  assert.ok(g.act(b, { t: 'votarReinicio', si: false }).ok);
  assert.equal(e.fase, 'juego');
  assert.ok(g.act(c, { t: 'votarReinicio', si: false }).ok);
  assert.equal(e.votoReinicio, null, 'sin mayoría la partida sigue'); assert.equal(e.fase, 'juego');
  assert.ok(g.act(host, { t: 'host.reiniciar' }).ok);
  g.tickear(70000);
  assert.equal(e.votoReinicio, null, 'al minuto vence sin mayoría'); assert.equal(e.fase, 'juego');
  assert.ok(g.act(host, { t: 'host.reiniciar' }).ok);
  assert.ok(g.act(b, { t: 'votarReinicio', si: true }).ok);
  assert.equal(e.fase, 'lobby', 'con mayoría vuelve a la sala');
  assert.ok(e.archivoPendiente && JSON.parse(e.archivoPendiente).fase === 'juego', 'la partida anterior queda para archivar');
  assert.deepEqual([...e.orden].sort(), [host, b, c].sort()); assert.equal(e.host, host); assert.equal(e.jugadores.npc, undefined);
  assert.ok(g.ids.every((id) => e.jugadores[id].listo && e.jugadores[id].pj), 'mismos personajes, listos');
  const nuevo = unir(e, { nombre: 'Nuevo', token: 'tn' }); assert.ok(e.jugadores[nuevo], 'pueden entrar jugadores nuevos');
  // al terminar la partida, el banco empieza otra sin votación
  const h = partida(['4', '7']); assert.ok(h.iniciar().ok); h.e.fase = 'fin';
  assert.ok(h.act(h.ids[0], { t: 'host.reiniciar' }).ok); assert.equal(h.e.fase, 'lobby');
}
console.log('reglas de la casa OK');
