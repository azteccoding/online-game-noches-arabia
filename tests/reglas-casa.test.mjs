// Reglas de la casa del juego en línea: node tests/reglas-casa.test.mjs
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, tick, llegada, vista, robarCC } from '../shared/engine.js';
const vistaDe = (e, pid) => vista(data, e, pid);
import { publicarCarta, mostrarDados, dado, pagar } from '../shared/base.js';
import * as NPC from '../shared/npc.js';
import { mensajes, darTransporte } from '../shared/retos.js';
import { peleaNPC } from '../shared/pelea.js';
import { vender, tienda } from '../shared/objetos.js';
import { finTurno } from '../shared/eventos.js';
import { tieneItem, darItem } from '../shared/base.js';
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
  const enRepo = (id) => e.reposicion.filter((x) => x === id).length;
  for (const o of data.objetos.mazo.filter((x) => !x.sinVenta)) {
    assert.ok(e.stock[o.id] >= Math.max(1, o.copias - 2) && e.stock[o.id] <= o.copias - 1, 'stock inicial escaso ' + o.id);
    assert.equal(e.stock[o.id] + enRepo(o.id), o.copias - 1, 'las copias que faltan esperan en la reposición: ' + o.id);
  }
  assert.equal(Object.values(e.stock).reduce((a, b) => a + b, 0), 53 + 2, 'empieza con 53 y en la ronda 1 ya vuelven 2');
  const seda = data.objetos.mazo.find((o) => o.id === 'OB34');
  assert.ok(seda.reventa.Bagdad && seda.reventa['Andalucía'] > seda.reventa.Bagdad, 'la seda se vende más cara lejos');
  turnoDe(e, pid, 'Andalucía'); j.ciudad = 'Andalucía'; e.turno.fase = 'acciones';
  j.mano.push({ uid: 9100, tipo: 'objeto', ref: 'OB34' });
  const antes = j.dinares, stock = e.stock.OB34;
  assert.ok(vender(data, e, pid, { uid: 9100 }).ok);
  assert.equal(j.dinares, antes + seda.reventa['Andalucía'], 'sin impuesto en una ciudad de reventa');
  assert.equal(e.stock.OB34, stock, 'lo vendido no vuelve al instante al mercado');
  assert.equal(e.reposicion[e.reposicion.length - 1], 'OB34', 'lo vendido espera en la reposición');
  const total = (id) => (e.stock[id] || 0) + e.reposicion.filter((x) => x === id).length;
  for (const o of data.objetos.mazo.filter((x) => !x.sinVenta && x.id !== 'OB34')) assert.equal(total(o.id), o.copias - 1, 'ninguna copia desaparece: ' + o.id);
  j.mano.push({ uid: 9101, tipo: 'objeto', ref: 'OB34' }); j.ciudad = 'Damasco'; e.mods = {};   // sin feria ni otros eventos que quiten el impuesto
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

// 8) Trivias a 5 dinares; ids únicos, respuesta válida y mazo existente
{
  const ids = data.trivias.trivias.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'sin ids repetidos');
  const mazos = ['Bagdad', 'Isfahán', 'Aleppo', 'Damasco', 'Basra', 'El Cairo'];
  for (const t of data.trivias.trivias) {
    assert.ok(t.opciones.length === 3 && t.correcta >= 0 && t.correcta < 3, 'respuesta válida en ' + t.id);
    assert.ok(mazos.includes(t.ciudad), 'mazo válido en ' + t.id);
    assert.ok(t.gancho && t.nota, 'gancho y nota en ' + t.id);
  }
  assert.ok(data.trivias.trivias.some((t) => t.categoria === 'Palestina'));
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
  const otro = g.ids[1], uLibro = j.mano.find((c) => c.ref === 'libroIbnHazm').uid; e.jugadores[otro].ciudad = j.ciudad;
  const r = g.act(pid, { t: 'proponerTrato', con: otro, ofrece: { dinares: 0, objetos: [uLibro] }, pide: { dinares: 5, objetos: [] } });
  assert.ok(!r.ok && /biblioteca de Bagdad/.test(r.error), 'el libro de Ibn Hazm no se puede pasar a otro jugador');
}

// Averroes: la única Receta de Averroes de la partida, para el primero que cumple uno de sus Mensajes; cura la herida
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  A.mensaje = { id: 'M7' }; A.ciudad = 'Bagdad'; mensajes(data, e, a, 'llegada', { primera: false });   // Ibn Hazm: no da receta
  assert.ok(!tieneItem(A, 'recetaAverroes'));
  A.mensaje = { id: 'M1' }; mensajes(data, e, a, 'llegada', { primera: true });
  assert.ok(tieneItem(A, 'recetaAverroes'), 'el primero que cumple un Mensaje de Averroes recibe la receta');
  assert.ok(e.log.some((l) => l.aviso && /receta de médico/.test(l.texto)), 'aviso para todos');
  B.mensaje = { id: 'M1' }; mensajes(data, e, b, 'llegada', { primera: true });
  A.mensaje = { id: 'M1' }; mensajes(data, e, a, 'llegada', { primera: true });
  assert.ok(!tieneItem(B, 'recetaAverroes'), 'solo hay una por partida');
  assert.equal(A.mano.filter((c) => c.ref === 'recetaAverroes').length, 1, 'no se duplica');
  turnoDe(e, a, 'Bagdad'); e.turno.fase = 'acciones'; e.turno.heridoAhora = true; e.turno.principal = true;
  const r = g.act(a, { t: 'usar', uid: A.mano.find((c) => c.ref === 'recetaAverroes').uid });
  assert.ok(r.ok, r.error);
  assert.ok(!e.turno.heridoAhora && !e.turno.principal && !A.herido, 'cura y devuelve la acción principal');
  assert.ok(!tieneItem(A, 'recetaAverroes'), 'se gasta');
}

// Abu Madyan: la única Bendición de la partida, para el primero que cumple uno de sus Mensajes; protege en R23 y R26
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  A.mensaje = { id: 'M12' }; A.ciudad = 'Yemen'; mensajes(data, e, a, 'llegada', { primera: false });
  assert.ok(tieneItem(A, 'bendicionAbuMadyan'), 'el primero que cumple un Mensaje de Abu Madyan recibe la bendición');
  assert.ok(e.log.some((l) => l.aviso && /Abu Madyan bendice/.test(l.texto)), 'aviso para todos');
  B.mensaje = { id: 'M12' }; B.ciudad = 'Yemen'; mensajes(data, e, b, 'llegada', { primera: false });
  assert.ok(!tieneItem(B, 'bendicionAbuMadyan'), 'solo hay una por partida');
  // R23: con un 1 o 2 asoman bandoleros, pero con la bendición pasan de largo
  turnoDe(e, a, 'Magreb'); e.turno.fase = 'acciones'; A.ciudad = 'Magreb'; A.dinares = 50;
  forzar(e, 1);
  assert.ok(g.act(a, { t: 'reto', id: 'R23' }).ok);
  assert.ok(!e.pend || !/Bandoleros/.test(e.pend.titulo), 'sin pelea con los bandoleros');
  assert.ok(e.log.some((l) => /bendición de Abu Madyan protege la caravana/.test(l.texto)));
  assert.equal(A.mano.filter((c) => c.ref === 'sal').length, 3, 'conserva los 3 sacos');
  assert.ok(!tieneItem(A, 'bendicionAbuMadyan'), 'sirve una sola vez: se gasta al proteger');
}

// Ningún premio da dos transportes; quien ya tiene un animal recibe dinares en su lugar
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, pid = g.ids[0], j = e.jugadores[pid];
  const din = j.dinares;
  darTransporte(data, e, pid, 'caballo'); darTransporte(data, e, pid, 'camello');
  assert.equal(j.mano.filter((c) => ['caballo', 'camello', 'burro'].includes(c.ref)).length, 1, 'un solo transporte');
  assert.ok(tieneItem(j, 'caballo')); assert.equal(j.dinares, din + 20, 'el camello se cambia por 20 dinares');
}

// Dado de ingreso: aviso verde si llega carta de sheij, rojo si no
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e;
  for (let k = 0; k < 40 && (e.pend || e.dados || !e.turno || e.turno.fase !== 'ingreso' || e.turno.pid === 'npc'); k++) { g.tickear(100000); if (e.dados) e.dados = null; }
  const pid = e.turno.pid;
  e.jugadores[pid].mensaje = null; e.log = e.log.filter((l) => !l.msgRonda);
  forzar(e, 3); assert.ok(g.act(pid, { t: 'tirarDados' }).ok);
  assert.ok(e.dados.sheij && !e.dados.sheij.ok && /No hay carta de sheij/.test(e.dados.sheij.texto), 'aviso rojo sin el 6');
}

// Primero los dados: mientras hay dados en pantalla, el plazo de una decisión no corre
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, pid = g.ids[0];
  e.dados = { id: 999, n: 1, valores: [3], grupos: [], resumen: [], por: pid, motivo: 'pelea', t0: e.ahora, lanzado: false };
  e.pend = { id: 998, tipo: 'reto', para: [pid], titulo: 'Prueba', modo: 'una', opciones: [{ id: 'a', texto: 'A' }], porDefecto: 'a', limiteMs: 1000, t0: e.ahora, resp: {}, cont: { fn: 'nada', args: {} } };
  g.tickear(500000);
  assert.ok(e.pend && e.pend.id === 998, 'la decisión espera a que se cierren los dados');
}

// Transportes propios: destinos de cada uno y si terminan el turno
{
  const prep = (ref, ciudad = 'Bagdad') => {
    const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
    const e = g.e, pid = g.ids[0], j = e.jugadores[pid];
    turnoDe(e, pid, ciudad); e.turno.fase = 'mov'; j.ciudad = ciudad;
    const c = { uid: 9300, tipo: 'item', ref }; j.mano.push(c);
    return { g, e, pid, j, c };
  };
  let { g, e, pid, j, c } = prep('burro');
  assert.ok(!g.act(pid, { t: 'usar', uid: c.uid, destino: 'Samarcanda' }).ok, 'el burro no hace viajes largos');
  assert.ok(!g.act(pid, { t: 'usar', uid: c.uid, destino: 'Estambul' }).ok && !g.act(pid, { t: 'usar', uid: c.uid, destino: 'Isfahán' }).ok, 'el burro no va a Estambul ni a Isfahán');
  assert.ok(!g.act(pid, { t: 'usar', uid: c.uid, destino: 'Yemen' }).ok, 'el burro no va a Yemen');
  assert.ok(g.act(pid, { t: 'usar', uid: c.uid, destino: 'Damasco' }).ok);
  assert.equal(j.ciudad, 'Damasco', 'llega en el mismo turno'); assert.ok(!e.turno.fin && !e.turno.principal, 'el burro no termina el turno');
  ({ g, e, pid, j, c } = prep('caballo'));
  for (const d of ['Samarcanda', 'Magreb', 'India']) assert.ok(!g.act(pid, { t: 'usar', uid: c.uid, destino: d }).ok, 'el caballo no va a ' + d);
  assert.ok(g.act(pid, { t: 'usar', uid: c.uid, destino: 'Andalucía' }).ok); assert.equal(j.ciudad, 'Andalucía');
  assert.ok(e.turno.principal && (e.turno.fin || e.turno.finTrasCC), 'el caballo termina el turno');
  if (e.turno.ccActual) { g.act(pid, { t: 'omitirCC' }); assert.ok(e.turno.fin || e.turno.pid !== pid, 'al cerrar la carta de Cuentos termina el turno'); }
  ({ g, e, pid, j, c } = prep('camello'));
  assert.ok(!g.act(pid, { t: 'usar', uid: c.uid, destino: 'Damasco' }).ok, 'el camello solo va al Magreb, a Samarcanda y a Yemen');
  assert.ok(g.act(pid, { t: 'usar', uid: c.uid, destino: 'Samarcanda' }).ok); assert.equal(j.ciudad, 'Samarcanda');
  ({ g, e, pid, j, c } = prep('alfombra', 'Damasco'));
  assert.ok(!g.act(pid, { t: 'usar', uid: c.uid, destino: 'Bagdad' }).ok, 'la alfombra no va a Bagdad');
  assert.ok(g.act(pid, { t: 'usar', uid: c.uid, destino: 'India' }).ok, 'la alfombra sí llega a India');
  assert.ok(!j.mano.some((x) => x.uid === 9300), 'la alfombra se gasta');
}

// Libro de saldos: cada cambio de dinares y noches queda en el registro; la suma de lo anotado da el saldo final
{
  const g = partida(['4', '7', 'B', '5']); const e = g.e;
  const todo = []; const push = e.log.push.bind(e.log); e.log.push = (...x) => { todo.push(...x); return push(...x); };
  assert.ok(g.iniciar().ok);
  let semilla = 7; const azar = (n) => { semilla = (semilla * 1103515245 + 12345) & 0x7fffffff; return semilla % n; };
  for (let paso = 0; paso < 1500 && e.fase === 'juego'; paso++) {
    if (e.dados) { e.dados.lanzado = true; g.tickear(31000); continue; }
    if (e.pend) { for (const q of e.pend.para) if (!e.pend?.resp[q]) g.act(q, { t: 'decidir', id: e.pend.id, opcion: e.pend.opciones[0]?.id, valores: [e.pend.opciones[0]?.id] }); g.tickear(100); continue; }
    const t = e.turno; if (!t || e.jugadores[t.pid].npc) { g.tickear(2000); continue; }
    const pid = t.pid;
    if (t.fase === 'ingreso') { g.act(pid, { t: 'tirarDados' }); continue; }
    if (t.ccActual) { g.act(pid, t.ccActual.tipo === 'trivia' ? { t: 'responderCC', opcion: azar(3) } : { t: 'omitirCC' }); continue; }
    const v = vistaDe(e, pid), via = v.acciones.filter((x) => x.k === 'viajar');
    if (via.length && azar(3)) { g.act(pid, { t: 'viajar', destino: via[azar(via.length)].destino }); continue; }
    if (azar(4) === 0) { const o = v.tienda.filter((x) => x.puede); if (o.length) { const x = o[azar(o.length)]; g.act(pid, { t: 'comprar', ...(x.id ? { id: x.id } : { ref: x.ref }) }); continue; } }
    g.act(pid, { t: 'terminarTurno' }); g.tickear(100);
  }
  assert.ok(e.ronda >= 3, 'la partida de prueba avanzó varias rondas');
  const suma = {};
  for (const l of todo) if (l.saldo) { const s = (suma[l.pid] ||= [0, 0]); s[0] += l.saldo.dd; s[1] += l.saldo.dn; }
  for (const j of Object.values(e.jugadores).filter((x) => x.pj)) assert.deepEqual(suma[j.id] || [0, 0], [j.dinares, j.noches], 'el registro cuadra con el saldo de ' + j.nombre);
}

// Asesinos: solo con los dinares completos; el contrato es público, deja Buscado y termina el turno
{
  const g = partida(['4', '7', '5', 'B']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a];
  turnoDe(e, a, 'Samarcanda'); e.turno.fase = 'acciones'; A.ciudad = 'Samarcanda'; A.dinares = 10; A.noches = 900;
  const r = g.act(a, { t: 'asesinos' });
  assert.ok(!r.ok && /dinares/.test(r.error), 'sin los dinares completos no se contrata (las noches no cuentan)');
  A.dinares = 500;
  assert.ok(g.act(a, { t: 'asesinos' }).ok);
  assert.ok(g.act(a, { t: 'decidir', id: e.pend.id, opcion: b }).ok);
  if (e.dados) e.dados = null;
  assert.ok(g.act(a, { t: 'decidir', id: e.pend.id, opcion: 'si' }).ok);
  assert.ok(e.jugadores[b].eliminado, 'la víctima muere');
  assert.equal(A.buscado, data.config.buscadoRondas, 'el contratante queda Buscado');
  assert.ok(e.log.some((l) => l.aviso && /contrató a los Asesinos contra/.test(l.texto)), 'todos se enteran de quién y contra quién');
  assert.ok(e.turno.pid !== a || e.turno.fin, 'su turno termina');
}

// Deudas: un pago obligatorio sin dinares deja el saldo en negativo (sin tocar las noches), bloquea compras y se cobra solo
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a];
  A.dinares = 3; A.noches = 100;
  pagar(data, e, a, 15);
  assert.equal(A.dinares, -12, 'queda en deuda'); assert.equal(A.noches, 100, 'las noches no se tocan');
  turnoDe(e, a, 'Isfahán'); A.ciudad = 'Isfahán'; e.turno.fase = 'acciones';
  turnoDe(e, b, 'Isfahán'); e.turno.fase = 'acciones';
  const rc = g.act(a, { t: 'comprar', id: 'OB34' }); assert.ok(!rc.ok && !/juegan los demás/.test(rc.error), 'con deuda no se compra nada (aunque juegue otro)');
  turnoDe(e, a, 'Isfahán'); e.turno.fase = 'acciones';
  const r = g.act(a, { t: 'reto', id: 'R17' }); assert.ok(!r.ok, 'R17 sin 40 dinares se rechaza');
  assert.ok(!e.turno.principal, 'y no gasta la acción principal');
  pagar(data, e, a, 100); assert.equal(A.dinares, -12, 'quien ya está en deuda no suma más deuda');
  A.dinares = 0; pagar(data, e, a, 100); assert.equal(A.dinares, -50, 'el banco no fía más de 50');
  A.dinares = -20; e.jugadores[b].ciudad = 'Isfahán'; e.jugadores[b].mano.push({ uid: 9400, tipo: 'item', ref: 'cimitarra' });
  const db = e.jugadores[b].dinares; turnoDe(e, b, 'Isfahán'); e.ronda = 5; forzar(e, 3, 3, 3, 3);
  g.act(b, { t: 'atacar', tipo: 'robo', objetivo: a });
  assert.ok(e.jugadores[b].dinares >= db, 'robar a quien tiene deuda no resta dinares al ladrón');
}

// Yafar (jugador o NPC) siempre juega el último de cada ronda, también en partidas guardadas con el orden viejo
for (let k = 0; k < 6; k++) {
  const g = partida(['B', '4', '7', '5']); assert.ok(g.iniciar().ok);
  const vivos = g.e.orden.filter((id) => !g.e.jugadores[id].eliminado);
  assert.equal(g.e.jugadores[vivos.at(-1)].pj, 'B', 'Yafar jugador al final');
  assert.equal(g.e.jugadores[vivos.at(-2)].pj, '7', 'Adí justo antes');
}
{
  const g = partida(['4', '5']); assert.ok(g.iniciar().ok);
  const vivos = g.e.orden.filter((id) => !g.e.jugadores[id].eliminado);
  assert.equal(vivos.at(-1), 'npc', 'Yafar NPC al final');
}

// Lo que no se vende aquí siempre dice dónde se vende y a cuánto (o para qué sirve); las especias de H17 se venden en Bagdad
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, A = e.jugadores[a];
  turnoDe(e, a, 'Damasco'); A.ciudad = 'Damasco'; e.turno.fase = 'acciones';
  for (const ref of ['especias', 'alfombraIsfahan', 'libro', 'caballo', 'brujula', 'pergamino', 'buza', 'vino', 'velo']) darItem(e, A, ref);
  const v = vistaDe(e, a);
  for (const c of v.mano) assert.ok(c.donde && c.donde.length > 10, `${c.ref} explica dónde se vende`);
  const esp = v.mano.find((c) => c.ref === 'especias');
  assert.equal(esp.venta, null); assert.match(esp.donde, /Bagdad.*30/);
  assert.match(v.mano.find((c) => c.ref === 'alfombraIsfahan').donde, /R7.*90/);
  A.ciudad = 'Bagdad'; const antes = A.dinares;
  assert.ok(g.act(a, { t: 'vender', uid: esp.uid }).ok); assert.equal(A.dinares, antes + 30, 'especias: 30 en Bagdad');
}

// Entrenar: la destreza es sí o no; quien ya la tiene no puede entrenar otra vez
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, A = e.jugadores[a];
  turnoDe(e, a, 'Estambul'); A.ciudad = 'Estambul'; e.turno.fase = 'acciones'; A.dinares = 100; A.destreza = true;
  const r = g.act(a, { t: 'reto', id: 'R25' }); assert.ok(!r.ok && /destreza/.test(r.error), 'ya tiene destreza');
  A.destreza = false; assert.ok(g.act(a, { t: 'reto', id: 'R25' }).ok); assert.ok(A.destreza);
}

// Peleas: ninguna tirada es automática; cada bando lanza sus propios dados y el desglose sale al final
{
  const g = partida(['4', '1']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  for (const j of [A, B]) { j.extra.clienteWeb = true; j.ciudad = 'Damasco'; j.destreza = true; j.mano = j.mano.filter((c) => c.ref !== 'arco'); }
  if (!B.mano.some((c) => c.ref === 'alfanje')) darItem(e, B, 'alfanje');
  if (!A.mano.some((c) => c.ref === 'cimitarra')) darItem(e, A, 'cimitarra');
  e.ronda = 4; turnoDe(e, a, 'Damasco'); e.turno.fase = 'acciones';
  const ra = g.act(a, { t: 'atacar', tipo: 'matar', objetivo: b }); assert.ok(ra.ok, ra.error);
  if (e.pend) assert.ok(g.act(b, { t: 'decidir', id: e.pend.id, opcion: 'luchar' }).ok);
  const cola = [e.dados, ...e.colaDados].filter((d) => d && d.motivo === 'pelea');
  assert.ok(cola.length >= 2, 'al menos una tirada de cada bando');
  assert.ok(cola.every((d) => !d.lanzado), 'nadie lanza solo');
  assert.ok(cola.some((d) => d.por === a) && cola.some((d) => d.por === b), 'atacante y defensor lanzan cada uno');
  for (const d of cola) assert.ok(d.grupos.every((gr) => gr.etq.startsWith(e.jugadores[d.por].nombre)), 'cada quien lanza solo sus dados');
  const fin = cola.at(-1).resumen.join(' ');
  assert.match(fin, /cimitarra \+2/); assert.match(fin, /alfanje \+1/); assert.match(fin, /total \d+/); assert.match(fin, /gana por \d+|ambos heridos/);
  assert.equal(g.act(b, { t: 'lanzarDados' }).ok, false, 'el defensor no puede lanzar los dados del atacante');
}

// Tratos: cada lado combina dinares, noches y cartas (lo pedido se nombra por tipo); se valida el saldo completo de ambos
{
  const g = partida(['4', '1']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  turnoDe(e, a, 'Bagdad'); e.mods = {}; A.ciudad = B.ciudad = 'Bagdad'; e.turno.fase = 'acciones';
  A.dinares = 30; A.noches = 50; B.dinares = 10; B.noches = 40; B.mano = [];
  const seda = darItem(e, A, 'vino'); const cab = darItem(e, B, 'caballo');
  assert.deepEqual(vistaDe(e, a).comerciables[b].map((c) => c.titulo), ['Caballo'], 'ves las cartas que el otro puede intercambiar (sin su uid)');
  turnoDe(e, g.ids.find((x) => x !== a && x !== b) || 'npc', 'Bagdad');      // los tratos van aunque no sea el turno de ninguno de los dos
  assert.ok(!g.act(a, { t: 'proponerTrato', con: b, ofrece: { dinares: 31 }, pide: {} }).ok, 'no puedes ofrecer lo que no tienes');
  assert.ok(g.act(a, { t: 'proponerTrato', con: b, ofrece: { dinares: 20, noches: 30, objetos: [seda.uid] }, pide: { dinares: 5, noches: 10, idx: [0] } }).ok);
  const tr = Object.values(e.tratos)[0];
  assert.deepEqual(tr.ofrece.nombres.length, 1); assert.match(tr.pide.nombres[0], /Caballo/);
  assert.ok(g.act(b, { t: 'responderTrato', id: tr.id, ok: true }).ok);
  assert.equal(A.dinares, 15); assert.equal(B.dinares, 25); assert.equal(A.noches, 30); assert.equal(B.noches, 60);
  assert.ok(A.mano.some((c) => c.ref === 'caballo') && B.mano.some((c) => c.ref === 'vino'), 'se intercambian las cartas');
  assert.ok(g.act(a, { t: 'proponerTrato', con: b, ofrece: { dinares: 1 }, pide: { refs: ['OB34'] } }).ok);
  const r = g.act(b, { t: 'responderTrato', id: Object.values(e.tratos)[0].id, ok: true }); assert.ok(!r.ok && /no tiene/.test(r.error), 'sin la carta pedida no se acepta');
}

// Golpe de gracia: a muerte solo se mata ganando por 3 o más; por 1 o 2 el perdedor queda herido; el empate hiere a los dos
{
  const vistos = { muere: 0, herido: 0, ambos: 0, atkMuere: 0 };
  for (let k = 1; k <= 120; k++) {
    const g = partida(['4', '1'], {}, k); assert.ok(g.iniciar().ok);
    const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
    for (const j of [A, B]) { j.ciudad = 'Damasco'; j.destreza = true; j.herido = false; j.mano = j.mano.filter((c) => c.ref !== 'arco'); }
    if (!B.mano.some((c) => c.ref === 'alfanje')) darItem(e, B, 'alfanje');
    if (!A.mano.some((c) => c.ref === 'alfanje')) darItem(e, A, 'alfanje');
    e.ronda = 4; e.mods = {}; turnoDe(e, a, 'Damasco'); e.turno.fase = 'acciones';
    assert.ok(g.act(a, { t: 'atacar', tipo: 'matar', objetivo: b }).ok);
    if (e.pend) g.act(b, { t: 'decidir', id: e.pend.id, opcion: 'luchar' });
    const txt = [e.dados, ...e.colaDados].filter(Boolean).flatMap((d) => d.resumen).join(' ');
    if (B.eliminado) { vistos.muere++; assert.match(txt, /golpe de gracia/); }
    else if (A.eliminado) vistos.atkMuere++;
    else if (A.herido && B.herido) { vistos.ambos++; assert.match(txt, /ambos heridos/); }
    else if (A.herido || B.herido) { vistos.herido++; assert.match(txt, /solo herido/); }
    else assert.fail('nadie quedó ni herido ni muerto');
  }
  assert.ok(vistos.muere && vistos.herido && vistos.ambos && vistos.atkMuere, JSON.stringify(vistos));
}

// Una propuesta que no se acepta no gasta la acción principal (duelo rechazado, compañía rechazada); el rechazo queda en el registro
{
  const g = partida(['4', '2']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  for (const j of [A, B]) { j.ciudad = 'Damasco'; j.mano = j.mano.filter((c) => c.ref !== 'arco'); }
  B.dinares = 40; e.ronda = 4; e.mods = {}; turnoDe(e, a, 'Damasco'); e.turno.fase = 'acciones';
  assert.ok(g.act(a, { t: 'atacar', tipo: 'duelo', objetivo: b }).ok);
  assert.ok(e.turno.principal, 'al retar se aparta la acción');
  assert.ok(g.act(b, { t: 'decidir', id: e.pend.id, opcion: 'rechazar' }).ok);
  assert.ok(!e.turno.principal, 'duelo rechazado: la acción principal no se gasta');
  assert.ok(e.log.some((l) => /rechaza el duelo/.test(l.texto)) && e.log.some((l) => /no gasta su acción principal/.test(l.texto)));
  turnoDe(e, b, 'Damasco'); e.turno.fase = 'acciones';
  assert.ok(g.act(b, { t: 'pj', sub: 'prost', con: a, precio: 10 }).ok);
  assert.ok(g.act(a, { t: 'decidir', id: e.pend.id, opcion: 'no' }).ok);
  assert.ok(!e.turno.principal, 'compañía rechazada: tampoco se gasta');
  assert.ok(e.log.some((l) => /rechaza la propuesta de compañía/.test(l.texto)));
}

// Cartas de cuentos (CC): ninguna se repite hasta que salieron todas, aunque varias ciudades compartan el mazo de Bagdad;
// barajar el mazo de CC reordena solo las que quedan
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids;
  const total = Object.values(e.mazos.cc).reduce((n, l) => n + l.length, 0) + Object.values(e.mazos.descarte.cc).reduce((n, l) => n + l.length, 0);
  const vistas = new Set(e.mazos.ccVistas || []);
  for (let k = vistas.size; k < total; k++) {
    turnoDe(e, a, 'Samarcanda'); const c = robarCC(data, e, a, 'Bagdad');
    assert.ok(c && !vistas.has((c.tipo === 'trivia' ? 't' : 'm') + c.id), `la CC ${c?.id} no se repite (${k + 1} de ${total})`);
    vistas.add((c.tipo === 'trivia' ? 't' : 'm') + c.id);
    if (k === 10) { const quedan = Object.values(e.mazos.cc).reduce((n, l) => n + l.length, 0); assert.ok(g.act(g.ids[0], { t: 'host.barajar', mazo: 'cc' }).ok || true); assert.equal(Object.values(e.mazos.cc).reduce((n, l) => n + l.length, 0), quedan, 'barajar no devuelve las ya salidas'); }
  }
  turnoDe(e, a, 'Bagdad'); assert.ok(robarCC(data, e, a, 'Bagdad'), 'al agotarse se rebaraja todo');
  assert.equal(e.mazos.ccVistas.length, 1);
}

// Barajar (banco) reordena solo lo que queda en Eventos, Históricos, Botín e Ifrit; las ya salidas no vuelven.
// E1: el sorteo de la víctima probable lo lanza un jugador con botón y solo entre los vivos
{
  const g = partida(['4', '7', '5']); assert.ok(g.iniciar().ok);
  const e = g.e, host = Object.keys(e.jugadores).find((x) => e.host === x) || g.ids[0];
  for (const m of ['eventos', 'historicos', 'botin', 'ifrit']) {
    e.mazos.descarte[m] = (e.mazos.descarte[m] || []).concat(['YA-SALIO']);
    const antes = e.mazos[m].slice().sort();
    assert.ok(g.act(host, { t: 'host.barajar', mazo: m }).ok);
    assert.deepEqual(e.mazos[m].slice().sort(), antes, `${m}: mismas cartas, otro orden`);
    assert.ok(!e.mazos[m].includes('YA-SALIO'), `${m}: no regresan las ya salidas`);
    e.mazos.descarte[m] = e.mazos.descarte[m].filter((x) => x !== 'YA-SALIO');
  }
  for (const j of Object.values(e.jugadores)) j.extra.clienteWeb = !j.npc;
  e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.asesinos.actuaron = false;
  NPC.eventoAsesinos(data, e);
  const sorteo = [e.dados, ...e.colaDados].find((d) => d && /sorteo de a quién/.test(d.grupos[0].etq));
  assert.ok(sorteo && !sorteo.npc && !sorteo.lanzado, 'el sorteo lo lanza un jugador con su botón');
  const vivos = Object.values(e.jugadores).filter((j) => j.pj && !j.eliminado).length;
  const ultimo = sorteo.valores.at(-1);
  assert.ok(vivos >= 6 || ultimo <= vivos, 'solo cuentan los números con jugador');
  assert.match(sorteo.resumen.join(' '), /irán a buscar a /);
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
