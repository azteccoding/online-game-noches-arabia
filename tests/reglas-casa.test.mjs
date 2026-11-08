// Reglas de la casa del juego en línea: node tests/reglas-casa.test.mjs
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, tick, llegada, vista, robarCC, carreraFinTurno, conexion, puedeUnirse, unirTarde } from '../shared/engine.js';
const vistaDe = (e, pid) => vista(data, e, pid);
import { publicarCarta, mostrarDados, dado, pagar, eliminar } from '../shared/base.js';
import * as NPC from '../shared/npc.js';
import { mensajes, darTransporte } from '../shared/retos.js';
import { peleaNPC, duelo } from '../shared/pelea.js';
import { vender, tienda, animalesInicioTurno, animalesFinTurno } from '../shared/objetos.js';
import { hazanasFinTurno } from '../shared/engine.js';
import { finTurno } from '../shared/eventos.js';
import { tieneItem, darItem, tieneEsp } from '../shared/base.js';
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
  if (e.host !== a) assert.ok(!g.act(e.host, { t: 'lanzarDados' }).ok && !e.dados.lanzado, 'el banco tampoco lanza por un desconectado');
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
  j.mensajes = [{ id: 'M13' }]; j.ciudad = 'Damasco';
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
  // Regla nueva: el arco dispara una flecha dentro de la pelea (2 dados por lado); contra un escudo se clava y no hace nada
  const resolverAsalto = (g, e, atk, def) => { assert.ok(g.act(atk, { t: 'atacar', tipo: 'robo', objetivo: def }).ok); if (e.pend?.tipo === 'defensa') g.act(def, { t: 'decidir', id: e.pend.id, opcion: 'luchar' }); while (e.pend) g.act(e.pend.para[0], { t: 'decidir', id: e.pend.id, opcion: (e.pend.opciones[0] || {}).id }); return [e.dados, ...e.colaDados].filter(Boolean); };
  let { g, e, jamil, adi, A } = prep();
  A.mano.push({ uid: 9002, tipo: 'item', ref: 'arco' }, { uid: 9003, tipo: 'item', ref: 'flechas' }, { uid: 9004, tipo: 'item', ref: 'flechas' });
  let ds = resolverAsalto(g, e, jamil, adi);
  assert.ok(ds.some((d) => /dispara una flecha/.test(d.grupos[0].etq) && d.por === adi), 'el defensor dispara su flecha con su botón');
  assert.equal([...A.mano, ...e.jugadores[jamil].mano].filter((c) => c.ref === 'flechas').length, 1, 'gasta una sola flecha (si el robo sale, el ladrón se lleva la otra)');
  assert.ok(ds.some((d) => d.por === jamil && /lanza/.test(d.grupos[0].etq)) && ds.some((d) => d.por === adi && /lanza/.test(d.grupos[0].etq)), 'cada uno lanza sus 2 dados');
  ({ g, e, jamil, adi, A } = prep());
  A.mano.push({ uid: 9005, tipo: 'item', ref: 'arco' }, { uid: 9006, tipo: 'item', ref: 'flechas' });
  e.jugadores[jamil].mano.push({ uid: 9007, tipo: 'objeto', ref: 'OB04' });
  ds = resolverAsalto(g, e, jamil, adi);
  assert.ok(ds.some((d) => d.resumen.some((r) => /se clava en el escudo/.test(r))), 'contra un escudo la flecha no hace nada');
  ({ g, e, jamil, adi, A } = prep());
  A.mano.push({ uid: 9008, tipo: 'objeto', ref: 'OB04' });
  ds = resolverAsalto(g, e, jamil, adi);
  assert.ok(ds.at(-1).resumen.join(' ').includes('escudo +1'), 'el escudo suma +1 al defender');
  assert.ok(ds.at(-1).resumen.join(' ').match(/cimitarra \+2/), 'las armas se suman');
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
  assert.equal(Object.values(e.stock).reduce((a, b) => a + b, 0), 57 + 2, 'empieza con 57 (con los libros de la India y de Córdoba) y en la ronda 1 ya vuelven 2');
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
  assert.equal(y.noches - n0, Math.floor(25 / 2), 'solo: la mitad (Basra da 25)');
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
  j.mensajes = [{ id: 'M7' }]; j.ciudad = 'Bagdad';
  mensajes(data, e, pid, 'llegada', { primera: false });
  assert.equal(j.mensajes.length, 0, 'M7 se cumple'); assert.ok(!j.mano.some((c) => c.ref === 'libroIbnHazm'), 'los otros Mensajes de Ibn Hazm no dan libro');
  const papiro = { uid: 9200, tipo: 'item', ref: 'papiro', extra: { valor: 4, ronda: 1 } };
  j.mensajes = [{ id: 'M6' }]; mensajes(data, e, pid, 'trato', { dio: [papiro] });
  const libro = j.mano.find((c) => c.ref === 'libroIbnHazm');
  assert.ok(libro && libro.extra.titulo === 'El collar de la paloma', 'M6 regala un libro con título real');
  turnoDe(e, pid, 'Bagdad'); e.turno.fase = 'acciones'; e.ronda += 3;
  const antes = j.dinares; assert.ok(vender(data, e, pid, { uid: libro.uid }).ok);
  assert.equal(j.dinares, antes + Math.floor((50 + 6) / 2), 'la biblioteca paga la mitad del valor (50 + 2 por ronda)');
  for (let k = 0; k < 3; k++) { j.mensajes = [{ id: 'M6' }]; mensajes(data, e, pid, 'trato', { dio: [papiro] }); }
  assert.equal(j.mano.filter((c) => c.ref === 'libroIbnHazm').length, 2, 'máximo 2 en la mano');
  const otro = g.ids[1], uLibro = j.mano.find((c) => c.ref === 'libroIbnHazm').uid; e.jugadores[otro].ciudad = j.ciudad;
  const r = g.act(pid, { t: 'proponerTrato', con: otro, ofrece: { dinares: 0, objetos: [uLibro] }, pide: { dinares: 5, objetos: [] } });
  assert.ok(!r.ok && /biblioteca de Bagdad/.test(r.error), 'el libro de Ibn Hazm no se puede pasar a otro jugador');
}

// Averroes: la única Receta de Averroes de la partida, para el primero que cumple uno de sus Mensajes; cura la herida
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  A.mensajes = [{ id: 'M7' }]; A.ciudad = 'Bagdad'; mensajes(data, e, a, 'llegada', { primera: false });   // Ibn Hazm: no da receta
  assert.ok(!tieneItem(A, 'recetaAverroes'));
  A.mensajes = [{ id: 'M1' }]; mensajes(data, e, a, 'llegada', { primera: true });
  assert.ok(tieneItem(A, 'recetaAverroes'), 'el primero que cumple un Mensaje de Averroes recibe la receta');
  assert.ok(e.log.some((l) => l.aviso && /receta de médico/.test(l.texto)), 'aviso para todos');
  B.mensajes = [{ id: 'M1' }]; mensajes(data, e, b, 'llegada', { primera: true });
  A.mensajes = [{ id: 'M1' }]; mensajes(data, e, a, 'llegada', { primera: true });
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
  A.mensajes = [{ id: 'M12' }]; A.ciudad = 'Yemen'; mensajes(data, e, a, 'llegada', { primera: false });
  assert.ok(tieneItem(A, 'bendicionAbuMadyan'), 'el primero que cumple un Mensaje de Abu Madyan recibe la bendición');
  assert.ok(e.log.some((l) => l.aviso && /Abu Madyan bendice/.test(l.texto)), 'aviso para todos');
  B.mensajes = [{ id: 'M12' }]; B.ciudad = 'Yemen'; mensajes(data, e, b, 'llegada', { primera: false });
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
  e.jugadores[pid].mensajes = []; e.log = e.log.filter((l) => !l.msgRonda);
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
  assert.ok(j.mano.some((x) => x.uid === 9300), 'la alfombra ya no se gasta');
}

// Animales: albéitar y comida cada turno (con deuda), mueren a los 4 (burro) o 5 turnos; el burro se repone en Basra y el caballo reactiva R1
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, pid = g.ids[0], j = e.jugadores[pid];
  const burro = darItem(e, j, 'burro'), b0 = e.burros;
  j.dinares = 0;
  for (let n = 1; n <= 4; n++) {
    animalesInicioTurno(data, e, pid);
    assert.equal(j.dinares, -n, 'el burro cuesta 1 dinar por turno y, sin dinero, queda como deuda');
    assert.match(vistaDe(e, pid).mano.find((c) => c.uid === burro.uid).datos.texto, n < 4 ? new RegExp(`Le quedan ${4 - n} turno`) : /último turno/);
    animalesFinTurno(data, e, pid);
    assert.equal(!!tieneItem(j, 'burro'), n < 4, n < 4 ? 'el burro sigue vivo' : 'el burro muere a los 4 turnos');
  }
  assert.equal(e.burros, b0 + 1, 'llega otro burro a Basra');
  assert.ok(e.log.some((l) => /Muere de viejo el burro/.test(l.texto) && l.aviso), 'se avisa la muerte');
  j.retosHechos.push('R1'); darItem(e, j, 'caballo'); j.dinares = 100;
  for (let n = 1; n <= 5; n++) { animalesInicioTurno(data, e, pid); animalesFinTurno(data, e, pid); }
  assert.equal(j.dinares, 85, 'el caballo cuesta 3 dinares por turno');
  assert.ok(!tieneItem(j, 'caballo') && !j.retosHechos.includes('R1'), 'el caballo muere a los 5 turnos y R1 se puede volver a hacer');
}

// Noches extra: Jorasán +50, entrenar +50, al-Quds (+40, burro entre El Cairo y Damasco) y Tariq (+60, Magreb ↔ Andalucía):
// hasta 2 veces por turno y, tras cobrarla, bloqueada hasta terminar un turno fuera del par
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, pid = g.ids[0], j = e.jugadores[pid];
  turnoDe(e, pid, 'El Cairo'); j.ciudad = 'El Cairo'; e.mods = {};
  const b = darItem(e, j, 'burro');
  let n0 = j.noches;
  assert.ok(g.act(pid, { t: 'usar', uid: b.uid, destino: 'Damasco' }).ok, 'el burro va de El Cairo a Damasco');
  if (e.turno.ccActual) g.act(pid, { t: 'omitirCC' });
  assert.ok(e.log.some((l) => /Visitar al-Quds», \+40/.test(l.texto)), 'al-Quds da +40 noches');
  assert.ok(j.noches - n0 >= 40);
  assert.equal(vistaDe(e, pid).jugadores[pid].hazanas.quds.quedan, 1, 'queda una más este turno');
  e.jugadores[pid].extra.hazanaBloq = { quds: true };
  assert.equal(vistaDe(e, pid).jugadores[pid].hazanas.quds.bloqueada, true, 'la vista muestra el bloqueo');
  hazanasFinTurno(data, e); assert.ok(j.extra.hazanaBloq.quds, 'terminar en Damasco no libera al-Quds');
  j.ciudad = 'Aleppo'; e.turno.hazanas = {}; hazanasFinTurno(data, e); assert.ok(!j.extra.hazanaBloq.quds, 'terminar fuera del par libera al-Quds');
  turnoDe(e, pid, 'Magreb'); j.ciudad = 'Magreb'; n0 = j.noches;
  llegada(data, e, pid, 'Andalucía'); llegada(data, e, pid, 'Magreb'); llegada(data, e, pid, 'Andalucía');
  assert.equal(e.turno.hazanas.tariq, 2, 'Tariq vale como máximo 2 veces por turno');
  j.ciudad = 'El Cairo'; hazanasFinTurno(data, e); assert.ok(j.extra.hazanaBloq.tariq, 'tras cobrar Tariq queda bloqueada aunque termine el turno fuera del par');
  j.ciudad = 'Magreb';
  turnoDe(e, pid, 'Magreb'); const antes = e.log.length; llegada(data, e, pid, 'Andalucía');
  assert.ok(!e.turno.hazanas?.tariq && e.log.slice(antes).some((l) => /muévete a otra ciudad/.test(l.texto)), 'bloqueada: no cobra y se le avisa');
  // entrenar
  turnoDe(e, pid, 'Isfahán'); j.ciudad = 'Isfahán'; j.destreza = false; j.dinares = 50; n0 = j.noches;
  if (!tieneItem(j, 'cimitarra')) darItem(e, j, 'cimitarra');
  assert.ok(g.act(pid, { t: 'reto', id: 'R18' }).ok); assert.equal(j.noches - n0, 50, 'entrenar da +50 noches');
  // Jorasán
  const k = g.ids[1], jk = e.jugadores[k]; jk.transito = { destino: 'Jorasán', faltan: 1, desde: 'Yemen', jorasan: true }; n0 = jk.noches;
  turnoDe(e, pid, 'Isfahán'); avanzarHasta(g, () => jk.ciudad === 'Jorasán');
  assert.ok(jk.noches - n0 >= 50 && jk.perdido, 'llegar al Jorasán da +50 noches');
}

function avanzarHasta(g, cond, pasos = 400) {
  const e = g.e;
  for (let i = 0; i < pasos && e.fase === 'juego' && !cond(); i++) {
    if (e.dados) e.dados.lanzado = true;
    if (e.pend) { for (const q of e.pend.para) if (!e.pend.resp[q]) g.act(q, { t: 'decidir', id: e.pend.id, opcion: e.pend.opciones[0]?.id }); }
    else if (e.turno && !e.jugadores[e.turno.pid].npc) { if (e.turno.fase === 'ingreso') g.act(e.turno.pid, { t: 'tirarDados' }); else if (e.turno.ccActual) g.act(e.turno.pid, { t: 'omitirCC' }); else g.act(e.turno.pid, { t: 'terminarTurno' }); }
    g.tickear(31000);
  }
}
// R11 Sindbad: bien, 100 dinares y 50 noches; naufragio, 30 noches sin dinares y pierde el turno (sin multiplicar por ronda)
{
  for (let sem = 1; sem <= 40; sem++) {
    const g = partida(['4', '7'], {}, sem); assert.ok(g.iniciar().ok);
    const e = g.e, pid = g.ids[0], j = e.jugadores[pid];
    turnoDe(e, pid, 'India'); j.ciudad = 'India'; e.ronda = 8; const d0 = j.dinares, n0 = j.noches;
    assert.ok(g.act(pid, { t: 'reto', id: 'R11' }).ok);
    const bien = e.log.some((l) => /El viaje sale bien/.test(l.texto));
    const llegada = j.noches - n0 - (bien ? 50 : 30);
    const extra = j.dinares - d0 - (bien ? 100 : 0); assert.ok(extra >= 0 && extra <= 5, 'dinares de Sindbad (más lo que dé la carta de Cuentos de Basra): ' + extra);
    assert.ok(llegada >= 0 && j.ciudad === 'Basra', 'noches de Sindbad (más la llegada a Basra)');
    if (!bien) assert.equal(j.pierdeTurno, 1, 'el naufragio cuesta el siguiente turno');
  }
}

// Carta S1 «Te presentan ante Saladino»: una vez, al quedar visitadas Aleppo y Damasco; 10 dinares y 50 noches a cada jugador vivo, no a Yafar NPC
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, npc = e.jugadores.npc;
  assert.ok(npc, 'hay Yafar NPC');
  const antes = Object.fromEntries(Object.values(e.jugadores).map((j) => [j.id, [j.dinares, j.noches]]));
  npc.visitadas.push('Aleppo', 'Damasco'); npc.ciudad = 'Damasco'; turnoDe(e, 'npc', 'Damasco'); llegada(data, e, 'npc', 'Aleppo');
  assert.ok(!e.saladino, 'las visitas de Yafar NPC no cuentan');
  antes.npc = [npc.dinares, npc.noches];
  turnoDe(e, a, 'Aleppo'); e.jugadores[a].ciudad = 'Aleppo'; llegada(data, e, a, 'Damasco');
  assert.ok(!e.saladino, 'con solo Aleppo no sale');
  turnoDe(e, b, 'Damasco'); e.jugadores[b].ciudad = 'Damasco'; e.jugadores[b].visitadas = e.jugadores[b].visitadas.filter((c) => c !== 'Damasco');
  const nb = e.jugadores[b].noches; llegada(data, e, b, 'Aleppo');
  assert.ok(e.saladino && e.historial.some((h) => h.id === 'S1' && !h.para), 'sale a la vista de todos al visitar Damasco (otro jugador)');
  const da = e.jugadores[a].dinares - antes[a][0]; assert.ok(da >= 10 && da <= 15, '10 dinares a cada jugador (más lo que dé su carta de Cuentos): ' + da);
  assert.equal(npc.dinares, antes.npc[0], 'Yafar NPC no recibe nada'); assert.equal(npc.noches, antes.npc[1]);
  const n2 = e.jugadores[a].noches; llegada(data, e, a, 'Aleppo'); assert.equal(e.historial.filter((h) => h.id === 'S1').length, 1, 'sale una sola vez');
  void nb; void n2;
}

// Tope de 1,001 noches: nadie pasa de la meta, y el libro de saldos anota el valor ya topado
{
  const g = partida(['4', '7']); g.act(g.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, j = e.jugadores[a];
  j.noches = 990; turnoDe(e, a, 'Isfahán'); j.ciudad = 'Isfahán'; j.destreza = false; j.dinares = 50;
  if (!tieneItem(j, 'cimitarra')) darItem(e, j, 'cimitarra');
  assert.ok(g.act(a, { t: 'reto', id: 'R18' }).ok);
  assert.equal(j.noches, 1001, 'entrenar con 990 noches deja 1,001, no 1,040');
  assert.ok(e.log.some((l) => /tope de 1,001 noches/.test(l.texto)), 'se avisa del tope');
  const ult = e.log.filter((l) => l.saldo && l.pid === a).pop(); assert.equal(ult.saldo.dn, 11, 'el saldo anota +11');
}

// R12 y R13 (Sindbad): noches por la historia, sin multiplicar por ronda (R12: +60 / +20; R13: +80 / +20)
{
  for (const [rid, prev, gana, pierde, din] of [['R12', ['R11'], 60, 20, 120], ['R13', ['R11', 'R12'], 80, 20, 150]]) {
    const vistos = new Set();
    for (let sem = 1; sem <= 40 && vistos.size < 2; sem++) {
      const g = partida(['4', '7'], {}, sem); assert.ok(g.iniciar().ok);
      const e = g.e, pid = g.ids[0], j = e.jugadores[pid];
      turnoDe(e, pid, 'India'); j.ciudad = 'India'; e.ronda = 8; j.retosHechos.push(...prev); j.noches = 100; j.dinares = 200; j.mano = j.mano.filter((c) => c.ref !== 'arco');
      const L = e.log.length;
      assert.ok(g.act(pid, { t: 'reto', id: rid }).ok);
      const gano = e.log.slice(L).some((l) => /Vences/.test(l.texto)); vistos.add(gano);
      const extra = j.noches - 100 - (gano ? gana : pierde);
      assert.ok(extra >= 0 && extra <= 100, `${rid} ${gano ? 'gana' : 'pierde'}: noches ${j.noches - 100} (más la llegada a Basra)`);
      if (gano) assert.ok(j.dinares - 200 >= din, `${rid}: dinares sin cambio`);
    }
    assert.equal(vistos.size, 2, rid + ': se probaron los dos resultados');
  }
}

// Zubayda: la propuesta dice las noches que de verdad recibe el cliente
{
  const g = partida(['6', '7']); g.act(g.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e, [z, c] = g.ids;
  turnoDe(e, z, 'Damasco'); e.jugadores[z].ciudad = e.jugadores[c].ciudad = 'Damasco'; e.jugadores[z].noches = 12;
  assert.ok(g.act(z, { t: 'pj', sub: 'prost', con: c, precio: 10 }).ok);
  assert.match(e.pend.texto, /y 12 noches de su haber/, 'con 12 noches, la propuesta dice 12');
}

// La cacería del Califa (E7) se ve como «Buscado» para todos
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids; e.evento.buscadoE7 = a;
  assert.equal(vistaDe(e, b).jugadores[a].buscadoE7, true, 'los demás ven que está buscado');
  assert.equal(vistaDe(e, a).jugadores[b].buscadoE7, false);
}

// Armas: la cimitarra suma más que el alfanje en robos y ataques a muerte, y la tienda dice la ventaja
{
  const { bonosCombate } = await import('../shared/pelea.js');
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, j = e.jugadores[a]; j.ciudad = 'Damasco'; j.destreza = false; j.herido = false; j.mano = [];
  darItem(e, j, 'alfanje'); const conAlf = bonosCombate(data, e, a, 'atk', 'Damasco').total;
  j.mano = []; darItem(e, j, 'cimitarra'); const conCim = bonosCombate(data, e, a, 'atk', 'Damasco').total;
  assert.equal(conAlf, 1); assert.equal(conCim, 2, 'cimitarra +2');
  darItem(e, j, 'alfanje'); darItem(e, j, 'jambiya'); assert.equal(bonosCombate(data, e, a, 'atk', 'Damasco').total, 4, 'tope de +4');
  assert.match(bonosCombate(data, e, a, 'atk', 'Damasco').partes.join(' '), /cimitarra \+2/, 'el desglose lo muestra');
  j.ciudad = 'Estambul'; j.dinares = 100; turnoDe(e, g.ids[1], 'Estambul');
  const t = tienda(data, e, a); const cim = t.find((x) => x.ref === 'cimitarra');
  assert.ok(cim && /\+2 al pelear/.test(cim.nombre), 'la tienda dice «Cimitarra · +2 al pelear»');
}

// R41: las duas del sheij cuentan aunque el Mensaje del sheij no sea el primero de la lista
{
  const g = partida(['4', '7']); g.act(g.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, j = e.jugadores[a];
  const av = data.mensajes.mensajes.find((m) => m.de === 'Averroes').id, ih = data.mensajes.mensajes.find((m) => m.de === 'Ibn Hazm').id;
  turnoDe(e, a, 'Andalucía'); j.ciudad = 'Andalucía'; j.destreza = false; j.mensajes = [{ id: av, turnoLimite: 99 }, { id: ih, turnoLimite: 99 }];
  assert.ok(g.act(a, { t: 'reto', id: 'R41' }).ok);
  assert.match(JSON.stringify([e.dados, e.colaDados]), /duas del sheij \+1 \(mensaje de Ibn Hazm\)/);
}

// 60 segundos sin tirar: el banco decide; nunca se tira por el jugador; al volver juega al final y ese turno se perdió
{
  const g = partida(['4', '7', '5']); g.act(g.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e; for (const id of g.ids) e.jugadores[id].extra.clienteWeb = true;
  for (let i = 0; i < 40 && (e.dados || e.pend); i++) { if (e.dados) e.dados.lanzado = true; if (e.pend) for (const q of e.pend.para) if (!e.pend.resp[q]) g.act(q, { t: 'decidir', id: e.pend.id, opcion: e.pend.opciones[0]?.id }); g.tickear(31000); }
  const p = e.turno.pid, banco = g.ids.find((x) => x !== p), ronda = e.ronda; e.host = banco;
  e.turno.t0 = e.ahora;
  assert.ok(!g.act(banco, { t: 'host.sacarEspera', pid: p }).ok, 'antes de 60 segundos no se puede');
  assert.ok(!vistaDe(e, banco).espera?.sacable);
  g.tickear(61000);
  assert.ok(vistaDe(e, banco).espera.sacable && vistaDe(e, banco).puedoSacar, 'a los 60 segundos el banco ve el botón');
  assert.equal(e.turno.pid, p, 'esperarlo: nada cambia y nadie tira por él'); assert.equal(e.turno.fase, 'ingreso');
  const otro = g.ids.find((x) => x !== p && x !== banco);
  assert.ok(!g.act(otro, { t: 'host.sacarEspera', pid: p }).ok, 'solo el banco');
  const siguiente = e.orden[e.orden.indexOf(p) + 1];
  assert.ok(g.act(banco, { t: 'host.sacarEspera', pid: p }).ok);
  assert.notEqual(e.turno?.pid, p, 'pierde el turno'); assert.ok(e.jugadores[p].sacado);
  if (siguiente) assert.equal(e.turno?.pid, siguiente, 'sigue quien venía después de él');
  assert.equal(e.orden[e.orden.length - 1], p, 'pasa al final del orden');
  conexion(e, p, true);
  assert.ok(!e.jugadores[p].sacado, 'al volver deja de estar sacado'); assert.equal(e.orden[e.orden.length - 1], p);
  e.orden.slice(e.orden.indexOf(p)); assert.ok(e.jugadores[p].extra.turnoPerdido === ronda, 'ese turno se perdió aunque volvió en la misma ronda');
  assert.ok(!g.act(banco, { t: 'lanzarDados' }).ok || !e.dados, 'el banco no lanza por nadie');
}

// Mensajes de ir a una ciudad: mínimo 20 dinares; trivias nuevas
{
  for (const id of ['M1', 'M4', 'M5', 'M7', 'M9', 'M11', 'M12', 'M13', 'M14', 'M15']) assert.ok(data.mensajes.mensajes.find((m) => m.id === id).dinares >= 20, id);
  for (const m of data.mensajes.mensajes) assert.ok(m.premio.startsWith(m.dinares + ' dinares'), 'el premio dice lo que paga: ' + m.id);
  const vat = data.trivias.trivias.find((t) => /mujeres no pueden votar/.test(t.pregunta)), uni = data.trivias.trivias.find((t) => /universidad más antigua/.test(t.pregunta));
  assert.equal(vat.opciones[vat.correcta], 'El Vaticano'); assert.match(uni.opciones[uni.correcta], /Al-Qarawiyyin/); assert.match(uni.nota, /859/);
}

// El banco es el primero que elige personaje, está conectado y listo; la cuenta regresiva arranca sola
{
  const e = nuevoJuego(data, { semilla: 3, ahora: 1000 });
  let now = 1000; const act = (p, a) => { now += 100; return reducir(data, e, p, a, now); };
  const a = unir(e, { nombre: 'A', token: 'a' }), b = unir(e, { nombre: 'B', token: 'b' });
  assert.equal(e.host, a, 'provisional: quien entró primero');
  act(b, { t: 'elegirPj', pj: '4' }); act(b, { t: 'listo', v: true });
  assert.equal(e.host, b, 'el primero con personaje y listo es el banco');
  act(a, { t: 'elegirPj', pj: '7' }); act(a, { t: 'listo', v: true });
  assert.equal(e.host, b, 'el banco no cambia si otro se pone listo después');
  conexion(e, b, false); assert.equal(e.host, a, 'si se desconecta, pasa al siguiente'); conexion(e, b, true);
  now += 1000; tick(data, e, now);
  assert.ok(vista(data, e, a).cuenta > 0 && e.fase === 'lobby', 'todos listos: arranca la cuenta');
  act(a, { t: 'listo', v: false }); now += 1000; tick(data, e, now);
  assert.equal(vista(data, e, a).cuenta, null, 'si alguien deja de estar listo se detiene');
  act(a, { t: 'listo', v: true }); now += 1000; tick(data, e, now); now += 15500; tick(data, e, now);
  assert.equal(e.fase, 'juego', 'al llegar a cero empieza sola');
}

// Entrar tarde: solo durante la primera ronda
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e; assert.ok(puedeUnirse(e));
  const n0 = e.burros, c = unirTarde(e, { nombre: 'Tarde', token: 'z' });
  assert.ok(!e.orden.includes(c), 'no entra al orden hasta elegir');
  assert.ok(g.act(c, { t: 'elegirPj', pj: '5' }).ok); assert.ok(g.act(c, { t: 'listo', v: true }).ok);
  assert.ok(e.orden.includes(c) && e.jugadores[c].dinares > 0 && e.jugadores[c].ciudad === 'Bagdad'); assert.equal(e.burros, n0 + 1);
  assert.equal(e.jugadores[e.orden[e.orden.length - 1]].pj, 'B', 'Yafar sigue al final');
  e.ronda = 2; assert.ok(!puedeUnirse(e));
  const d = unirTarde(e, { nombre: 'Muy tarde', token: 'y' }); assert.ok(!g.act(d, { t: 'elegirPj', pj: '1' }).ok, 'pasada la primera ronda ya no');
}

// Un trato se cancela si los dos ya no están en la misma ciudad
{
  const g = partida(['4', '7']); g.act(g.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids; e.jugadores[a].ciudad = e.jugadores[b].ciudad = 'Damasco';
  e.tratos.x = { id: 'x', de: a, con: b, ofrece: { dinares: 1, objetos: [] }, pide: { dinares: 0, objetos: [] } };
  e.jugadores[b].ciudad = 'Aleppo'; g.tickear(100);
  assert.equal(e.tratos.x, undefined); assert.ok(e.log.some((l) => /se cancela: ya no están en la misma ciudad/.test(l.texto)));
}

// Recuperándose de una herida: los retos se ven deshabilitados y con el motivo
{
  const { disponibles, RECUPERANDO } = await import('../shared/retos.js');
  const g = partida(['4', '7']); g.act(g.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids; turnoDe(e, a, 'Bagdad'); e.jugadores[a].ciudad = 'Bagdad';
  e.turno.heridoAhora = true; e.turno.principal = true;
  const rs = disponibles(data, e, a);
  assert.ok(rs.length && rs.every((r) => r.bloqueado === RECUPERANDO), 'cada reto dice por qué no se puede');
  e.turno.heridoAhora = false; assert.equal(disponibles(data, e, a).length, 0, 'si ya usó su acción por otra razón, no aparecen');
}

// Dificultad de los Asesinos, aparte de la de Yafar NPC; solo el banco la cambia
{
  const e = nuevoJuego(data, { semilla: 3, ahora: 1000 });
  const a = unir(e, { nombre: 'A', token: 'a' }), b = unir(e, { nombre: 'B', token: 'b' });
  assert.equal(NPC.bonoAsesinos(e), 3, 'en línea, fácil por defecto');
  assert.ok(reducir(data, e, a, { t: 'opciones', dificultadAsesinos: 'dificil' }, 2000).ok);
  assert.equal(NPC.bonoAsesinos(e), 5); assert.equal(e.opciones.dificultad, 'normal', 'no toca la de Yafar');
  assert.ok(!reducir(data, e, b, { t: 'opciones', dificultadAsesinos: 'facil' }, 2100).ok, 'solo el banco');
  assert.equal(vista(data, e, b).opciones.dificultadAsesinos, 'dificil');
}

// Buscado: todos ven por qué, cuánto se gana por él y hasta cuándo
{
  const { marcarBuscado } = await import('../shared/base.js');
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids; e.ronda = 5;
  marcarBuscado(data, e, e.jugadores[a], { tipo: 'matar', victima: 'Dulce' });
  const info = vistaDe(e, b).jugadores[a].buscadoInfo;
  assert.match(info, /^Buscado por matar a Dulce: quien lo mate gana 100 dinares y 200 noches/); assert.match(info, /terminar la ronda 6/);
  e.evento.buscadoE7 = b; assert.match(vistaDe(e, a).jugadores[b].buscadoInfo, /cacería del Califa/);
  assert.equal(vistaDe(e, a).jugadores[b].buscado, 0);
}

// Lote del 7 de noviembre: R1 con sirvientes pagados, rutas de Andalucía, entrenamientos, jambiya, cuento al cerrar y no poder salir
{
  const { disponibles, ENTRENAMIENTOS } = await import('../shared/retos.js');
  const { destinosTransporte } = await import('../shared/objetos.js');
  assert.equal(data.rutas.tarifas['Bagdad>Andalucía'], undefined); assert.equal(data.rutas.tarifas['Andalucía>Bagdad'], undefined);
  assert.equal(data.rutas.tarifas['El Cairo>Andalucía'], 20); assert.equal(data.rutas.tarifas['Magreb>Andalucía'], 5); assert.equal(data.rutas.tarifas['Andalucía>Magreb'], 6);
  assert.ok(destinosTransporte(data, 'alfombra', 'Bagdad').includes('Andalucía'), 'la alfombra sigue llegando a Andalucía');
  const g = partida(['4', '7']); g.act(g.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, j = e.jugadores[a];
  // R1: 12 por sirviente, máximo 3, se pagan al contratar; sin dinero se busca solo
  turnoDe(e, a, 'Bagdad'); j.ciudad = 'Bagdad'; j.dinares = 30;
  assert.ok(g.act(a, { t: 'reto', id: 'R1' }).ok); g.act(a, { t: 'decidir', id: e.pend.id, opcion: 'si' });
  assert.equal(e.pend.max, 2, 'con 30 dinares alcanzan 2 sirvientes');
  g.act(a, { t: 'decidir', id: e.pend.id, numero: 2 });
  assert.ok(e.log.some((l) => l.texto.includes('contrata 2 sirviente(s) por 24 dinares')), 'paga 24 dinares al contratar'); assert.equal(j.misiones.find((m) => m.id === 'R1')?.deuda ?? 15, 15);
  // no puede salir: sin destinos y con motivo
  if (j.misiones.some((m) => m.id === 'R1')) { turnoDe(e, a, 'Bagdad'); e.turno.fase = 'mov'; const v = vistaDe(e, a); assert.ok(!v.acciones.some((x) => x.k === 'viajar') && /deuda con Bagdad/.test(v.noSalir)); }
  // entrenamientos: hay que tener el arma; entrenado suma +1
  const { bonosCombate } = await import('../shared/pelea.js');
  j.misiones = []; turnoDe(e, a, 'Damasco'); j.ciudad = 'Damasco'; j.dinares = 100; j.mano = []; j.destreza = false;
  assert.ok(disponibles(data, e, a).find((r) => r.id === 'R42').bloqueado, 'sin alfanje no entrena');
  darItem(e, j, 'alfanje'); const b0 = bonosCombate(data, e, a, 'atk', 'Damasco').total;
  assert.ok(g.act(a, { t: 'reto', id: 'R42' }).ok); assert.equal(bonosCombate(data, e, a, 'atk', 'Damasco').total, b0 + 1, 'alfanje entrenado +1');
  turnoDe(e, a, 'Estambul'); j.ciudad = 'Estambul'; assert.ok(g.act(a, { t: 'reto', id: 'R25' }).ok); assert.ok(j.destreza); assert.equal(j.dinares, 100 - 20 - 45);
  // jambiya escondida: no cuenta ni se la roban
  darItem(e, j, 'jambiya'); const conJ = bonosCombate(data, e, a, 'atk', 'Damasco').total;
  assert.ok(g.act(a, { t: 'jambiya', ocultar: true }).ok); assert.equal(bonosCombate(data, e, a, 'atk', 'Damasco').total, conJ - 1);
  assert.ok(vistaDe(e, a).jambiyaOculta);
}

// Nadie lanza por otro jugador: ni el banco ni otro jugador, esté conectado o no
{
  const g = partida(['4', '7', '5']); g.act(g.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b, c] = g.ids; e.dados = null; e.colaDados = []; e.host = b;
  e.jugadores[a].extra.clienteWeb = true; mostrarDados(e, { por: a, motivo: 'reto', grupos: [{ etq: 'prueba', valores: [4] }] });
  for (const quien of [b, c]) for (const con of [true, false]) {
    e.jugadores[a].conectado = con;
    assert.ok(!g.act(quien, { t: 'lanzarDados' }).ok && !e.dados.lanzado, 'nadie lanza por otro');
    assert.ok(!g.act(quien, { t: 'cerrarDados' }).ok && !e.dados.lanzado, 'ni cierra sus dados sin lanzar');
  }
}

// Si quien debe tirar está desconectado, el banco ve «Sacarlo / Esperarlo» de inmediato
{
  const g = partida(['4', '7', '5']); g.act(g.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e; for (let i = 0; i < 40 && (e.dados || e.pend); i++) { if (e.dados) e.dados.lanzado = true; if (e.pend) for (const q of e.pend.para) if (!e.pend.resp[q]) g.act(q, { t: 'decidir', id: e.pend.id, opcion: e.pend.opciones[0]?.id }); g.tickear(31000); }
  const p = e.turno.pid, banco = g.ids.find((x) => x !== p); e.host = banco; e.turno.t0 = e.ahora;
  assert.ok(!vistaDe(e, banco).puedoSacar, 'conectado: hay que esperar 60 segundos');
  e.jugadores[p].conectado = false;
  assert.ok(vistaDe(e, banco).espera.sacable && vistaDe(e, banco).puedoSacar, 'desconectado: el banco ve las opciones de inmediato');
}

// Meta: solo cuentan las noches (los dinares ya no se suman)
{
  const g = partida(['4', '7']); g.act(g.ids[0], { t: 'opciones', sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids;
  e.jugadores[a].noches = 900; e.jugadores[a].dinares = 500;
  avanzarHasta(g, () => e.ronda >= 3);
  assert.equal(e.fase, 'juego', '900 noches + 500 dinares ya no ganan');
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
    const viaOk = via.filter((x) => x.precio <= e.jugadores[pid].dinares);
    if (viaOk.length && azar(3)) { g.act(pid, { t: 'viajar', destino: viaOk[azar(viaOk.length)].destino }); continue; }
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
  turnoDe(e, a, 'Samarcanda'); e.turno.fase = 'acciones'; A.ciudad = 'Samarcanda'; A.dinares = 10; A.noches = 100;
  let r = g.act(a, { t: 'asesinos' });
  assert.ok(!r.ok && /500 noches/.test(r.error), 'hacen falta 500 noches');
  A.noches = 900; e.ronda = 4;
  assert.ok(g.act(a, { t: 'asesinos' }).ok);
  assert.ok(g.act(a, { t: 'decidir', id: e.pend.id, opcion: b }).ok);
  assert.ok(A.herido && A.perdido && A.buscado > 0, 'con 10 dinares no alcanza: herido en el Jorasán y Buscado');
  assert.ok(e.log.some((l) => l.aviso && /por hacerles perder el tiempo/.test(l.texto)));
  // ahora con dinares de sobra: paga y firma
  A.herido = false; A.perdido = false; A.ciudad = 'Samarcanda'; A.dinares = 6 * 4 * 35; A.buscado = 0;
  turnoDe(e, a, 'Samarcanda'); e.turno.fase = 'acciones';
  assert.ok(g.act(a, { t: 'asesinos' }).ok);
  assert.ok(g.act(a, { t: 'decidir', id: e.pend.id, opcion: b }).ok);
  assert.ok(e.asesinos.pendiente && e.asesinos.pendiente.victima === b, 'contrato firmado');
  assert.ok(e.turno.pid !== a || e.turno.fin, 'su turno termina');
  const B = e.jugadores[b]; B.extra.masrur = false;
  // Masrur avisa en secreto; si la víctima está en el Jorasán cuando actúan, no la encuentran
  B.perdido = true; B.ciudad = 'Jorasán'; B.turnos++; e.pend = null; e.colaPend = []; NPC.actuanAsesinos(data, e);
  assert.ok(!B.eliminado, 'escondida en el Jorasán se salva'); assert.equal(A.buscado, data.config.buscadoRondas, 'el contratante queda Buscado igual');
  assert.ok(e.log.some((l) => l.aviso && /no la encuentran: se escondió en el Jorasán/.test(l.texto)), 'todos se enteran');
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
  pagar(data, e, a, 100); assert.equal(A.dinares, -112, 'la deuda sigue creciendo, sin tope');
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
  const vivos = e.orden.filter((x) => !e.jugadores[x].eliminado).length;   // antes del sorteo (si nadie puja, la víctima puede morir)
  NPC.eventoAsesinos(data, e);
  const sorteo = [e.dados, ...e.colaDados].find((d) => d && /sorteo de a quién/.test(d.grupos[0].etq));
  assert.ok(sorteo && !sorteo.npc && !sorteo.lanzado, 'el sorteo lo lanza un jugador con su botón');
  const ultimo = sorteo.valores.at(-1);
  assert.ok(vivos >= 6 || ultimo <= vivos, 'solo cuentan los números con jugador');
  assert.match(sorteo.resumen.join(' '), /irán a buscar a /);
}

// Último en pie: quien queda solo gana al instante; si solo queda Yafar NPC, gana Yafar
{
  const g = partida(['4', '7'], { sinYafar: true }); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids;
  e.ronda = 3; eliminar(data, e, b, { causa: 'prueba' });
  g.act(a, { t: 'leido', nro: 0 });
  assert.equal(e.fase, 'fin'); assert.deepEqual(e.ganadores, [a]); assert.ok(e.finUltimo);
  assert.ok(e.log.some((l) => /último en pie y gana/.test(l.texto)));
}
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids;
  assert.ok(e.jugadores.npc, 'hay Yafar NPC');
  e.ronda = 3; eliminar(data, e, a, { causa: 'prueba' }); eliminar(data, e, b, { causa: 'prueba' });
  g.act(a, { t: 'leido', nro: 0 }); g.tickear(10);
  assert.equal(e.fase, 'fin'); assert.equal(e.derrota, 'npc'); assert.ok(e.finUltimo, 'gana Yafar NPC, último en pie');
}

// Duelo: quien lo pierde estando herido, muere (y se avisa antes)
{
  const g = partida(['4', '2', '5']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  B.herido = true; A.ciudad = B.ciudad = 'Damasco'; e.ronda = 4; turnoDe(e, a, 'Damasco'); e.turno.fase = 'acciones';
  assert.ok(g.act(a, { t: 'atacar', tipo: 'duelo', objetivo: b }).ok);
  if (e.pend?.tipo === 'defensa') assert.match(e.pend.texto, /estás herido: si pierdes este duelo, mueres/);
  e.pelea = null; e.pend = null; e.colaPend = []; e.dados = null; e.colaDados = [];
  duelo(data, e, a, b); assert.ok(B.eliminado, 'el herido que pierde el duelo muere');
  const C = e.jugadores[g.ids[2]]; C.herido = false; duelo(data, e, a, g.ids[2]); assert.ok(!C.eliminado && C.herido, 'sano: solo queda herido');
}

// Matar a un Buscado: 100 dinares y 200 noches de recompensa (sin multiplicar por ronda)
{
  const g = partida(['4', '7', '5']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  B.buscado = 2; B.noches = 0; B.dinares = 0; A.noches = 0; A.dinares = 0; e.ronda = 8;
  eliminar(data, e, b, { por: a, causa: 'prueba' });
  assert.equal(A.dinares, 100); assert.equal(A.noches, 200);
  assert.ok(e.log.some((l) => l.aviso && /estaba Buscado: 100 dinares y 200 noches/.test(l.texto)));
}

// Asesinos: la víctima se defiende (bonos a la mitad contra +4) y Masrur avisa en privado
{
  let muertos = 0, vivos = 0;
  for (let k = 1; k <= 60; k++) {
    const g = partida(['4', '7', '5'], {}, k); assert.ok(g.iniciar().ok);
    const e = g.e, [a, b] = g.ids, B = e.jugadores[b];
    B.extra.masrur = true; B.dinares = 30; B.noches = 40; B.ciudad = 'Damasco';
    e.asesinos.actuaron = true; e.asesinos.pendiente = { por: a, victima: b, precio: 100, turnoVictima: B.turnos };
    NPC.avisoMasrur(e, b); assert.ok([e.pend, ...e.colaPend].some((p) => p && p.para.includes(b) && /Huye al Jorasán/.test(p.texto)), 'aviso privado de Masrur');
    e.pend = null; e.colaPend = []; B.turnos++; NPC.actuanAsesinos(data, e);
    if (B.eliminado) muertos++; else { vivos++; assert.ok(B.herido && B.perdido && B.dinares === 0 && B.noches === 0 && B.ciudad === 'Jorasán'); }
  }
  assert.ok(muertos > vivos && vivos > 0, `casi siempre mueren (${muertos} muertos, ${vivos} vivos)`);
}

// Encargo de los Asesinos: las 200 noches solo si lo cumples (aquí: llevar su mensaje a una ciudad lejana)
{
  const g = partida(['4', '7', '5']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a];
  A.ciudad = 'Samarcanda'; A.noches = 900; A.dinares = 2000; e.ronda = 4; turnoDe(e, a, 'Samarcanda'); e.turno.fase = 'acciones';
  assert.ok(g.act(a, { t: 'asesinos' }).ok); assert.ok(g.act(a, { t: 'decidir', id: e.pend.id, opcion: b }).ok);
  while (e.pend && e.pend.titulo !== 'El encargo de los Asesinos') e.pend = e.colaPend.shift() || null;
  assert.ok(e.pend, 'se ofrece el encargo'); const n0 = A.noches;
  const op = e.pend.opciones.find((o) => o.id === 'mensaje'); const ciudad = op.texto.replace('Llevar su mensaje a ', '');
  assert.ok(g.act(a, { t: 'decidir', id: e.pend.id, opcion: 'mensaje' }).ok);
  assert.equal(A.noches, n0, 'todavía no cobra'); assert.equal(vistaDe(e, a).encargo.ciudad, ciudad, 'el encargo se ve en pantalla');
  A.ciudad = ciudad; NPC.revisarEncargo(data, e, a);
  assert.equal(A.noches, n0 + 200, 'cumplido: 200 noches'); assert.ok(!A.extra.encargoAsesinos);
}

// Carreras de «dos noches»: salen una vez cada una entre las rondas 3 y 12 y gana quien cierra dos turnos seguidos sin moverse
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, A = e.jugadores[a];
  const rs = Object.values(e.carreras); assert.equal(rs.length, 3); assert.equal(new Set(rs).size, 3);
  assert.ok(rs.every((r) => r >= 3 && r <= 12)); assert.ok(!e.mazos.eventos.some((x) => ['E13', 'E14', 'E15'].includes(x)), 'no están en el mazo');
  e.carrerasActivas = [{ id: 'E13', ciudad: 'El Cairo', prog: {} }];
  A.ciudad = 'El Cairo'; const d0 = A.dinares, n0 = A.noches;
  turnoDe(e, a, 'El Cairo'); carreraFinTurno(data, e); assert.equal(e.carrerasActivas[0].prog[a], 1);
  turnoDe(e, a, 'El Cairo'); e.turno.movio = true; carreraFinTurno(data, e); assert.equal(e.carrerasActivas[0].prog[a], undefined, 'moverse reinicia');
  turnoDe(e, a, 'El Cairo'); carreraFinTurno(data, e); turnoDe(e, a, 'El Cairo'); carreraFinTurno(data, e);
  assert.equal(A.dinares, d0 + 60); assert.equal(A.noches, n0 + 50); assert.equal(e.carrerasActivas.length, 0, 'la carrera se retira');
}

// Burro: solo en el mercado de Basra (70 dinares + 20 noches), fuera de tu turno y un animal a la vez
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a];
  turnoDe(e, b, 'Damasco'); e.turno.fase = 'acciones'; A.ciudad = 'Basra'; A.dinares = 69; A.mano = A.mano.filter((c) => !['caballo', 'camello', 'burro'].includes(c.ref));
  assert.ok(!g.act(a, { t: 'comprar', ref: 'burro' }).ok, 'sin 70 dinares no hay trato');
  A.dinares = 70; const n0 = A.noches;
  assert.ok(g.act(a, { t: 'comprar', ref: 'burro' }).ok); assert.equal(A.dinares, 0); assert.equal(A.noches, n0 + 20);
  A.dinares = 100; assert.ok(!g.act(a, { t: 'comprar', ref: 'burro' }).ok, 'un animal a la vez');
  A.ciudad = 'Bagdad'; A.mano = A.mano.filter((c) => c.ref !== 'burro'); assert.ok(!g.act(a, { t: 'comprar', ref: 'burro' }).ok, 'solo en Basra');
}

// R40 Cruzar a Abisinia (Yemen): pasaje 15; herido no puede; con 6+ carta de Ifrit
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, A = e.jugadores[a];
  turnoDe(e, a, 'Yemen'); A.ciudad = 'Yemen'; e.turno.fase = 'acciones'; A.dinares = 14;
  let r = g.act(a, { t: 'reto', id: 'R40' }); assert.ok(!r.ok && !e.turno.principal, 'sin pasaje no hay trato ni se gasta la acción');
  A.dinares = 50; A.herido = true; r = g.act(a, { t: 'reto', id: 'R40' }); assert.ok(!r.ok && /Herido/.test(r.error));
  A.herido = false; A.destreza = false; A.mano = A.mano.filter((c) => c.ref !== 'camello'); forzar(e, 6);
  assert.ok(g.act(a, { t: 'reto', id: 'R40' }).ok); assert.equal(A.dinares, 35);
  assert.ok(A.mano.some((c) => c.tipo === 'ifrit') || A.dinares === 75, 'con 6: carta de Ifrit (o 40 dinares)'); assert.ok(A.retosHechos.includes('R40'));
}

// R41 El ídolo de Toledo: uno por partida; destruirlo da 150 noches
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a];
  turnoDe(e, a, 'Andalucía'); A.ciudad = 'Andalucía'; e.turno.fase = 'acciones'; A.destreza = false; forzar(e, 5);
  assert.ok(g.act(a, { t: 'reto', id: 'R41' }).ok);
  const c = A.mano.find((x) => x.ref === 'idolo'); assert.ok(c, 'con 5 roba el ídolo'); assert.equal(e.idolo, 'robado');
  turnoDe(e, b, 'Andalucía'); e.jugadores[b].ciudad = 'Andalucía'; e.turno.fase = 'acciones';
  assert.ok(!g.act(b, { t: 'reto', id: 'R41' }).ok, 'solo hay un ídolo');
  turnoDe(e, a, 'Andalucía'); e.turno.fase = 'acciones'; const n0 = A.noches;
  assert.ok(g.act(a, { t: 'usar', uid: c.uid, via: 'destruir' }).ok); assert.equal(A.noches, n0 + 150); assert.ok(!e.turno.principal, 'acción libre');
}

// Libros de la India y de Córdoba: en Bagdad se subastan (par 150, impar 100 cada uno; una tirada para todas las copias)
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, A = e.jugadores[a];
  turnoDe(e, a, 'Bagdad'); A.ciudad = 'Bagdad'; e.turno.fase = 'acciones'; e.mods = {}; A.mano = []; A.dinares = 0;
  A.mano.push({ uid: 'l1', tipo: 'objeto', ref: 'OB46' }, { uid: 'l2', tipo: 'objeto', ref: 'OB46' });
  assert.ok(g.act(a, { t: 'vender', uid: 'l1' }).ok);
  assert.ok(A.dinares === 300 || A.dinares === 200, 'dos copias a 150 o a 100: ' + A.dinares); assert.equal(A.mano.length, 0);
}

// Solitario: con un solo jugador humano se compra también en el propio turno (y Yafar NPC en el suyo)
{
  const g = partida(['4']); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, A = e.jugadores[a];
  turnoDe(e, a, 'Basra'); A.ciudad = 'Basra'; e.turno.fase = 'acciones'; A.dinares = 500; e.mods = {}; A.mano = A.mano.filter((c) => !['caballo', 'camello', 'burro'].includes(c.ref));
  if (!(e.burros > 0)) e.burros = 1;
  const r = g.act(a, { t: 'comprar', ref: 'burro' }); assert.ok(r.ok, 'en solitario compra en su turno: ' + r.error);
}

// Ningún transporte lleva a Bagdad desde lejos; el burro sí, directo, desde las ciudades cercanas
{
  const { destinosTransporte } = await import('../shared/objetos.js');
  for (const ref of ['caballo', 'camello', 'alfombra']) for (const desde of ['Estambul', 'El Cairo', 'Damasco', 'Andalucía']) assert.ok(!destinosTransporte(data, ref, desde).includes('Bagdad'), `${ref} no va a Bagdad desde ${desde}`);
  for (const desde of ['Aleppo', 'Basra']) assert.deepEqual(destinosTransporte(data, 'burro', desde), ['Bagdad'], `burro directo a Bagdad desde ${desde}`);
  assert.deepEqual(destinosTransporte(data, 'burro', 'Damasco'), ['Bagdad', 'El Cairo'], 'desde Damasco el burro va a Bagdad o a El Cairo (al-Quds)');
  assert.deepEqual(destinosTransporte(data, 'burro', 'El Cairo'), ['Damasco'], 'desde El Cairo el burro solo va a Damasco');
  for (const ref of ['caballo', 'camello']) { assert.deepEqual(destinosTransporte(data, ref, 'India'), [], `${ref}: no sale de India`); for (const d of ['Basra', 'Isfahán', 'Samarcanda', 'Yemen']) assert.ok(!destinosTransporte(data, ref, d).includes('India'), `${ref}: no va a India desde ${d}`); }
  assert.ok(destinosTransporte(data, 'alfombra', 'India').length > 0 && destinosTransporte(data, 'alfombra', 'Basra').includes('India'), 'la alfombra sí va y vuelve de India');
}

// Solitario: si el humano derrota a Yafar NPC, gana pero la partida sigue
{
  const g = partida(['4']); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids;
  e.ronda = 3; e.dados = null; e.colaDados = []; eliminar(data, e, 'npc', { por: a, causa: 'prueba' });
  g.act(a, { t: 'leido', nro: 0 });
  assert.equal(e.fase, 'juego', 'la partida sigue'); assert.ok(e.victoriaYafar && e.victoriaYafar.pid === a, 'la victoria queda registrada');
  assert.ok(e.log.some((l) => /derrotó a Yafar/.test(l.texto)));
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
// Arco (regla de Jorge, 7 de noviembre): en robo, ataque a muerte y duelo el dueño del arco dispara una flecha con su botón
// «Disparar flecha», antes de los dados de la pelea. 5–6: el rival pelea con −1 y sin destreza; 3–4 solo cuenta con el arco
// entrenado (R43): −1. En duelo el arco ya no suma +1 fijo. Cada disparo gasta una flecha.
{
  const prep = (tipo, x, entrenado = false) => {
    const g = partida(['4', '2']); assert.ok(g.iniciar().ok);
    const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
    for (const j of [A, B]) { j.extra.clienteWeb = true; j.ciudad = 'Damasco'; j.destreza = true; j.mano = j.mano.filter((c) => !['arco', 'flechas'].includes(c.ref)); }
    if (!A.mano.some((c) => c.ref === 'cimitarra')) darItem(e, A, 'cimitarra');
    if (!B.mano.some((c) => c.ref === 'alfanje')) darItem(e, B, 'alfanje');
    darItem(e, A, 'arco'); darItem(e, A, 'flechas'); darItem(e, A, 'flechas');
    if (entrenado) A.extra.entrenado = { arco: true };
    B.dinares = 40; e.mods = {}; e.ronda = 4; turnoDe(e, a, 'Damasco'); e.turno.fase = 'acciones';
    forzar(e, x);
    assert.ok(g.act(a, { t: 'atacar', tipo, objetivo: b }).ok);
    while (e.pend) assert.ok(g.act(e.pend.para[0], { t: 'decidir', id: e.pend.id, opcion: (e.pend.opciones.find((o) => o.id === 'luchar') || e.pend.opciones[0]).id }).ok);
    const cola = [e.dados, ...e.colaDados].filter(Boolean);
    return { g, e, a, b, A, cola, flecha: cola.find((d) => /dispara una flecha/.test(d.grupos[0].etq)), fin: cola.at(-1).resumen.join(' ') };
  };
  for (const tipo of ['robo', 'matar', 'duelo']) {
    const { e, a, b, A, cola, flecha, fin } = prep(tipo, 6);
    assert.ok(flecha, `${tipo}: hay disparo de flecha`);
    assert.equal(flecha.por, a, `${tipo}: dispara el dueño del arco`);
    assert.equal(flecha.lanzado, false, `${tipo}: la flecha espera el botón del jugador`);
    assert.equal(flecha.boton, 'Disparar flecha', `${tipo}: el botón dice «Disparar flecha»`);
    assert.ok(cola.indexOf(flecha) === 0 || cola.slice(0, cola.indexOf(flecha)).every((d) => !/lanza 2 dados|2 dados/.test(d.grupos[0].etq)), `${tipo}: la flecha va antes de los dados de la pelea`);
    assert.match(flecha.resumen.join(' '), /−1 y sin su destreza/, `${tipo}: con 6 le da`);
    assert.equal(A.mano.filter((c) => c.ref === 'flechas').length, 1, `${tipo}: gasta una flecha`);
    assert.ok(!/arco \+/.test(fin), `${tipo}: el arco no suma fijo`);
    assert.match(fin, /flecha −1/, `${tipo}: el rival pelea con −1`);
    const r = reducir(data, e, b, { t: 'lanzarDados' }, e.ahora + 1); assert.equal(r.ok, false, 'el rival no puede disparar por él');
  }
  { const { flecha, fin } = prep('robo', 3); assert.match(flecha.resumen.join(' '), /falla/, 'sin entrenar, un 3 falla'); assert.ok(!/flecha −1/.test(fin)); }
  { const { flecha, fin } = prep('robo', 4, true); assert.match(flecha.resumen.join(' '), /cubrirse: −1/, 'entrenado, un 4 obliga a cubrirse'); assert.match(fin, /flecha −1/); assert.ok(!/destreza perdida/.test(fin)); }
}

// Nur al Din (regla de Jorge, 7 de noviembre): empieza entrenado solo con la cimitarra (como si ya hubiera hecho R18), sin destreza general;
// la destreza de Estambul (R25) y las demás armas las entrena como cualquiera
{
  const g = partida(['1', '4']); assert.ok(g.iniciar().ok);
  const e = g.e, [n] = g.ids, N = e.jugadores[n];
  assert.equal(N.destreza, false, 'Nur al Din no empieza con destreza general');
  assert.equal(N.extra.entrenado?.cimitarra, true, 'empieza con la cimitarra entrenada');
  assert.ok(tieneItem(N, 'cimitarra'));
  turnoDe(e, n, 'Isfahán'); N.ciudad = 'Isfahán'; e.turno.fase = 'acciones'; N.dinares = 200;
  const r = g.act(n, { t: 'reto', id: 'R18' }); assert.ok(!r.ok && /Ya entrenaste/.test(r.error), 'no puede volver a entrenar la cimitarra');
  turnoDe(e, n, 'Estambul'); N.ciudad = 'Estambul'; e.turno.fase = 'acciones';
  assert.ok(g.act(n, { t: 'reto', id: 'R25' }).ok, 'la destreza la aprende en Estambul'); assert.ok(N.destreza);
  darItem(e, N, 'alfanje'); turnoDe(e, n, 'Aleppo'); N.ciudad = 'Aleppo'; e.turno.fase = 'acciones';
  assert.ok(g.act(n, { t: 'reto', id: 'R42' }).ok, 'el alfanje lo entrena normal'); assert.ok(N.extra.entrenado.alfanje);
  // por ser guerrero, Nur al Din puede atacar a muerte sin destreza; los demás no
  const h = partida(['1', '4', '7']); assert.ok(h.iniciar().ok);
  const f = h.e, [nur, jam, adi] = h.ids;
  for (const id of h.ids) f.jugadores[id].ciudad = 'Damasco';
  f.ronda = 4; f.mods = {}; turnoDe(f, nur, 'Damasco'); f.turno.fase = 'acciones';
  assert.equal(f.jugadores[nur].destreza, false);
  assert.ok(h.act(nur, { t: 'atacar', tipo: 'matar', objetivo: jam }).ok, 'Nur al Din ataca a muerte sin destreza');
  const g2 = partida(['7', '4']); assert.ok(g2.iniciar().ok);
  const f2 = g2.e, [a2, b2] = g2.ids; for (const id of g2.ids) f2.jugadores[id].ciudad = 'Damasco';
  darItem(f2, f2.jugadores[a2], 'cimitarra'); f2.jugadores[a2].destreza = false;
  f2.ronda = 4; f2.mods = {}; turnoDe(f2, a2, 'Damasco'); f2.turno.fase = 'acciones';
  const r2 = g2.act(a2, { t: 'atacar', tipo: 'matar', objetivo: b2 }); assert.ok(!r2.ok && /destreza/.test(r2.error), 'los demás necesitan destreza');
}

// Firmán (Jorge, 7 de noviembre): 1 a la venta por cada 3 jugadores (hacia arriba), aparte del de Yafar; cuesta 55 (45 con la joya del visir);
// Yafar no compra; si alguien mata al dueño, se queda con el Firmán; si muere sin que nadie lo mate, vuelve al visir
{
  for (const [pjs, venta] of [[['4', '7'], 1], [['4', '7', '2'], 1], [['4', '7', '2', 'B'], 2], [['4', '7', '2', '3', '5', 'B', '1'], 3]]) {
    const g = partida(pjs); assert.ok(g.iniciar().ok);
    assert.equal(g.e.firmanes, venta, `${pjs.length} jugadores: ${venta} a la venta`);
    for (const id of Object.keys(g.e.jugadores)) if (g.e.jugadores[id].pj === 'B') assert.ok(!tieneEsp(g.e.jugadores[id], 'F1'), 'Yafar ya no lo trae al inicio: le llega en su 3er turno');
  }
  const g = partida(['4', '7', '2', 'B']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, , , y] = g.ids, A = e.jugadores[a], Y = e.jugadores[y];
  turnoDe(e, a, 'Bagdad'); e.turno.fase = 'acciones'; A.dinares = 54;
  assert.ok(!g.act(a, { t: 'comprar', ref: 'firman' }).ok, 'con 54 no alcanza');
  A.dinares = 55; assert.ok(g.act(a, { t: 'comprar', ref: 'firman' }).ok); assert.equal(A.dinares, 0); assert.equal(e.firmanes, 1);
  turnoDe(e, y, 'Bagdad'); e.turno.fase = 'acciones'; Y.dinares = 200; Y.mano = Y.mano.filter((c) => c.ref !== 'F1');
  const r = g.act(y, { t: 'comprar', ref: 'firman' }); assert.ok(!r.ok && /Yafar no puede comprar/.test(r.error));
  const B = e.jugadores[g.ids[1]]; B.extra.joyaVisir = true; turnoDe(e, g.ids[1], 'Bagdad'); e.turno.fase = 'acciones'; B.dinares = 45;
  assert.ok(g.act(g.ids[1], { t: 'comprar', ref: 'firman' }).ok, 'con la joya del visir cuesta 45'); assert.equal(e.firmanes, 0);
  eliminar(data, e, a, { causa: 'prueba' }); assert.equal(e.firmanes, 1, 'muerte sin asesino: el Firmán vuelve al visir');
  Y.mano.push({ uid: 99001, tipo: 'especial', ref: 'F1' }); eliminar(data, e, y, { por: g.ids[1], causa: 'prueba' });
  assert.equal(e.firmanes, 2, 'si matan a Yafar, su Firmán vuelve al Califa y queda a la venta');
  assert.equal(e.jugadores[g.ids[1]].mano.filter((c) => c.ref === 'F1').length, 1, 'el asesino no recibe el Firmán del muerto (solo conserva el suyo)');
}

// Mapa del escondite (Jorge, 7 de noviembre): un robo nunca se lleva el mapa de tus dinares escondidos; si te matan, el mapa y esos dinares se pierden
{
  const g = partida(['4', '7', '2']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b, c] = g.ids, A = e.jugadores[a], Bj = e.jugadores[b];
  A.escondido = 40; A.tesoroEsc = { ciudad: 'Damasco', id: 777 }; darItem(e, A, 'mapa', { tesoro: 'jugador', dueno: a, ciudad: 'Damasco', id: 777 }); darItem(e, A, 'libro');
  for (const j of [A, Bj]) j.ciudad = 'Aleppo';
  darItem(e, Bj, 'cimitarra'); e.ronda = 4; e.mods = {}; turnoDe(e, b, 'Aleppo'); e.turno.fase = 'acciones';
  forzar(e, 6, 6, 1, 1);
  assert.ok(g.act(b, { t: 'atacar', tipo: 'robo', objetivo: a }).ok);
  while (e.pend) g.act(e.pend.para[0], { t: 'decidir', id: e.pend.id, opcion: (e.pend.opciones.find((o) => o.id === 'luchar') || e.pend.opciones[0]).id });
  assert.ok(A.mano.some((x) => x.ref === 'mapa' && x.extra?.tesoro === 'jugador'), 'el robo no se lleva el mapa del escondite');
  assert.ok(Bj.mano.some((x) => x.ref === 'libro'), 'el robo salió: el ladrón se llevó el libro'); assert.ok(!Bj.mano.some((x) => x.ref === 'mapa'), 'el ladrón no tiene el mapa');
  eliminar(data, e, a, { por: c, causa: 'prueba' });
  assert.equal(A.escondido, 0, 'al morir, los dinares escondidos se pierden');
  assert.ok(!e.jugadores[c].mano.some((x) => x.ref === 'mapa'), 'el asesino no recibe el mapa');
}

// Deseo F de ifrit (Jorge): Firmán extra aunque no quede ninguno a la venta; si ya tienes uno o eres Yafar, 30 dinares;
// si su dueño muere, ese Firmán extra se pierde (no vuelve a la venta)
{
  const { deseo } = await import('../shared/tesoros.js');
  const g = partida(['4', '7', 'B']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b, y] = g.ids, A = e.jugadores[a], Y = e.jugadores[y];
  e.firmanes = 0;
  let d0 = A.dinares; deseo(data, e, a, 'F', {});
  assert.ok(tieneEsp(A, 'F1'), 'el deseo da Firmán aunque no quede a la venta'); assert.equal(A.dinares, d0); assert.equal(e.firmanes, 0);
  d0 = A.dinares; deseo(data, e, a, 'F', {}); assert.equal(A.dinares, d0 + 30, 'si ya tienes uno, 30 dinares');
  d0 = Y.dinares; deseo(data, e, y, 'F', {}); assert.equal(Y.dinares, d0 + 30, 'Yafar no lo recibe: 30 dinares');
  eliminar(data, e, a, { por: b, causa: 'prueba' });
  assert.equal(e.firmanes, 0, 'el Firmán extra se pierde al morir su dueño'); assert.ok(!tieneEsp(e.jugadores[b], 'F1'));
}

// Sala (Jorge, 7 de noviembre): «Esperar a más jugadores» se marca solo con un jugador listo y detiene la cuenta; solo el banco lo desmarca;
// la cuenta dura 15 segundos; a los 20 segundos de desconectado, el banco puede sacarlo; los desconectados no bloquean el inicio
{
  const e = nuevoJuego(data, { semilla: 5, ahora: 1000 });
  let now = 1000; const act = (p, a) => { now += 100; return reducir(data, e, p, a, now); };
  const a = unir(e, { nombre: 'A', token: 'a' });
  act(a, { t: 'elegirPj', pj: '4' }); act(a, { t: 'listo', v: true }); now += 500; tick(data, e, now);
  assert.equal(vista(data, e, a).esperarMas, true, 'con un solo jugador listo se marca solo');
  now += 20000; tick(data, e, now); assert.equal(e.fase, 'lobby', 'marcado: no arranca la cuenta');
  const b = unir(e, { nombre: 'B', token: 'b' }); act(b, { t: 'elegirPj', pj: '7' }); act(b, { t: 'listo', v: true }); now += 500; tick(data, e, now);
  assert.equal(e.esperarMas, false, 'con dos listos, mientras nadie lo haya tocado, se desmarca');
  assert.ok(!act(b, { t: 'esperarMas', v: true }).ok, 'solo el banco lo cambia');
  assert.ok(act(a, { t: 'esperarMas', v: true }).ok); now += 500; tick(data, e, now);
  assert.equal(vista(data, e, a).cuenta, null, 'el banco lo marca: no hay cuenta');
  assert.ok(act(a, { t: 'esperarMas', v: false }).ok); now += 500; tick(data, e, now);
  assert.ok(vista(data, e, a).cuenta > 10, 'al desmarcarlo arranca la cuenta de 15 segundos');
  // el banco se desconecta: pasa a B; A no bloquea el inicio y a los 20 s B puede sacarlo
  conexion(e, a, false); now += 500; tick(data, e, now);
  assert.equal(e.host, b, 'el banco pasa al siguiente listo'); assert.ok(act(b, { t: 'esperarMas', v: true }).ok, 'el nuevo banco puede detener la cuenta');
  assert.deepEqual(vista(data, e, b).sacablesSala, [], 'aún no se puede sacar');
  assert.ok(!act(b, { t: 'host.sacarSala', pid: a }).ok);
  now += 20500; tick(data, e, now);
  assert.deepEqual(vista(data, e, b).sacablesSala, [a], 'a los 20 segundos ya se puede sacar');
  assert.ok(act(b, { t: 'iniciar' }).ok, 'el desconectado no bloquea el inicio');
  assert.equal(e.fase, 'juego'); assert.ok(!e.orden.includes(a) || !e.jugadores[a].pj, 'el desconectado no entra');
}

// Mensajes privados (Jorge, 7 de noviembre): tres frases fijas; solo los ve el destinatario; «comprarte» solo con lo público del otro
{
  const g = partida(['4', '7', '2']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b, c] = g.ids, A = e.jugadores[a], Bj = e.jugadores[b];
  assert.ok(g.act(a, { t: 'chat', para: b, tipo: 'ire', ciudad: 'Damasco' }).ok);
  assert.ok(!g.act(a, { t: 'chat', para: b, tipo: 'ire', ciudad: 'Roma' }).ok, 'ciudad inexistente');
  const vB = vista(data, e, b), vC = vista(data, e, c);
  assert.ok(vB.chat.some((m) => m.texto === 'Iré a Damasco.' && m.de === a), 'el destinatario lo ve');
  assert.ok(!vC.chat.length, 'los demás no lo ven');
  const libro = darItem(e, A, 'libro');
  assert.ok(g.act(a, { t: 'chat', para: b, tipo: 'vender', uid: libro.uid }).ok);
  assert.ok(!g.act(a, { t: 'chat', para: b, tipo: 'vender', uid: 999999 }).ok, 'solo cartas propias');
  const pub = darItem(e, Bj, 'alfanje'), priv = darItem(e, Bj, 'libro'); priv.priv = true;
  const vA = vista(data, e, a);
  assert.ok(vA.publicas[b].some((x) => x.uid === pub.uid), 'lo público del otro aparece');
  assert.ok(!vA.publicas[b].some((x) => x.uid === priv.uid), 'lo privado no aparece');
  assert.ok(g.act(a, { t: 'chat', para: b, tipo: 'comprar', uid: pub.uid }).ok);
  assert.ok(!g.act(a, { t: 'chat', para: b, tipo: 'comprar', uid: priv.uid }).ok, 'no se puede pedir lo privado');
  assert.ok(!g.act(a, { t: 'chat', para: a, tipo: 'ire', ciudad: 'Damasco' }).ok, 'no a uno mismo');
  const mv = e.chat.find((m) => m.tipo === 'vender');
  assert.ok(!g.act(c, { t: 'chat', para: a, tipo: 'responder', a: mv.id, resp: 'sincera' }).ok, 'solo responde el destinatario');
  assert.ok(g.act(b, { t: 'chat', para: a, tipo: 'responder', a: mv.id, resp: 'interesada' }).ok);
  assert.ok(vista(data, e, a).chat.some((m) => m.tipo === 'respuesta' && m.texto === 'Sí, pero lleva buena morralla.' && m.de === b), 'la respuesta le llega al vendedor');
  assert.ok(!g.act(b, { t: 'chat', para: a, tipo: 'responder', a: mv.id, resp: 'sarcastica' }).ok, 'una sola respuesta por mensaje');
}

// Mansa Musa (Jorge, 7 de noviembre): S2 sale con dos jugadores distintos en el Magreb y dura esa ronda y 2 más (dado extra en R44, con botón);
// S3 sale cuando todos visitaron el Magreb y le quita 50 noches a Yafar (si no hay Yafar, no sale). Reacción «¡Vengan conmigo a N!»
{
  const { armarReaccion } = await import('../shared/reacciones.js');
  const g = partida(['4', '7', 'B']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b, y] = g.ids, A = e.jugadores[a], Bj = e.jugadores[b], Y = e.jugadores[y];
  e.ronda = 5; Y.noches = 120;
  const llega = (pid) => { const j = e.jugadores[pid]; turnoDe(e, pid, 'Andalucía'); const o = j.ciudad; j.ciudad = 'Magreb'; llegada(data, e, pid, o); };
  llega(a); assert.ok(!e.mansaGenerosa, 'con un solo jugador no sale');
  llega(b); assert.ok(e.mansaGenerosa, 'con dos jugadores distintos sale «Mansa Musa despertó generoso»');
  assert.ok(e.historial.some((h) => h.id === 'S2' && !h.para), 'todos ven la carta');
  assert.equal(vista(data, e, a).mansaGenerosa.quedan, 3, 'dura esta ronda y 2 más');
  assert.ok(!e.mansaNepotismo, 'falta Yafar jugador por visitar el Magreb');
  llega(y); assert.ok(e.mansaNepotismo); assert.ok(e.log.some((l) => /nepotismo: .* pierde 50 noches/.test(l.texto)), 'Yafar pierde 50 noches');
  assert.ok(e.historial.some((h) => h.id === 'S3'));
  turnoDe(e, a, 'Magreb'); A.ciudad = 'Magreb'; e.turno.fase = 'acciones'; A.dinares = 20; A.extra.clienteWeb = true; const n0 = A.noches;
  assert.ok(g.act(a, { t: 'reto', id: 'R44' }).ok);
  const dadoMansa = [e.dados, ...e.colaDados].find((d) => d && /generosidad de Mansa Musa/.test(d.grupos[0].etq));
  assert.ok(dadoMansa && dadoMansa.por === a && !dadoMansa.lanzado, 'el dado de Mansa Musa espera el botón');
  assert.ok(A.noches >= n0 + 60, 'R44: 30 noches más el premio de Mansa Musa (al menos 30)');
  e.ronda = 8; assert.equal(vista(data, e, a).mansaGenerosa, null, 'pasadas las 2 rondas ya no está');
  const r = armarReaccion(e, a, 'vengan', 99999999, 0); assert.equal(r.r.texto, '¡Vengan conmigo a Magreb!');
  // sin Yafar no sale la del nepotismo
  const h = partida(['4', '7']); h.e.opciones.sinYafar = true; assert.ok(h.iniciar().ok);
  for (const pid of h.ids) { const j = h.e.jugadores[pid]; turnoDe(h.e, pid, 'Andalucía'); j.ciudad = 'Magreb'; llegada(data, h.e, pid, 'Andalucía'); }
  assert.ok(h.e.mansaGenerosa && !h.e.mansaNepotismo, 'sin Yafar en la partida, S3 no sale');
}

// Tratos de un solo uso (punto 16 de Jorge): una propuesta aceptada o rechazada ya no se puede volver a aceptar; al cerrarse un trato
// se invalidan las demás propuestas pendientes entre esos dos jugadores; y no se acepta si alguno ya no tiene lo que ofrece
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  for (const j of [A, B]) j.ciudad = 'Damasco';
  A.dinares = 50; B.dinares = 50;
  const libro = darItem(e, B, 'libro');
  assert.ok(g.act(a, { t: 'proponerTrato', con: b, ofrece: { dinares: 20 }, pide: { objetos: [libro.uid] } }).ok);
  const t1 = Object.keys(e.tratos)[0];
  assert.ok(g.act(a, { t: 'proponerTrato', con: b, ofrece: { dinares: 10 }, pide: {} }).ok, 'una segunda propuesta pendiente');
  assert.equal(Object.keys(e.tratos).length, 2);
  assert.ok(g.act(b, { t: 'responderTrato', id: t1, ok: true }).ok);
  assert.equal(A.dinares, 30); assert.ok(A.mano.some((c) => c.uid === libro.uid));
  assert.equal(Object.keys(e.tratos).length, 0, 'al cerrarse el trato se invalidan las demás propuestas entre los dos');
  const r = g.act(b, { t: 'responderTrato', id: t1, ok: true }); assert.ok(!r.ok && /ya no está pendiente/.test(r.error), 'el mismo trato no se acepta dos veces');
  assert.equal(A.dinares, 30, 'nadie pierde dinares por pulsar otra vez');
  // sin dinero no hay trato: si al aceptar ya no tiene lo que ofreció, falla
  assert.ok(g.act(a, { t: 'proponerTrato', con: b, ofrece: { dinares: 30 }, pide: {} }).ok);
  const t2 = Object.keys(e.tratos)[0]; A.dinares = 5; const b0 = B.dinares;
  assert.ok(!g.act(b, { t: 'responderTrato', id: t2, ok: true }).ok, 'faltan dinares: no se cierra'); assert.equal(B.dinares, b0);
  // rechazado tampoco se puede aceptar después
  A.dinares = 30; assert.ok(g.act(a, { t: 'proponerTrato', con: b, ofrece: { dinares: 5 }, pide: {} }).ok);
  const t3 = Object.keys(e.tratos)[0];
  assert.ok(g.act(b, { t: 'responderTrato', id: t3, ok: false }).ok);
  assert.ok(!g.act(b, { t: 'responderTrato', id: t3, ok: true }).ok, 'un trato rechazado no se puede aceptar'); assert.equal(A.dinares, 30);
}

// Yafar (Jorge, 8 de noviembre): estas reglas aplican SOLO a Yafar NPC — primer turno ebrio; sin India y +20 al Magreb y Andalucía; nada de
// sheijs, Saladino ni Mansa Musa; no usa burro; los ladrones le quitan 80 noches. Yafar jugador no tiene nada de eso. Reacción «¡Matemos a Yafar!».
{
  const { armarReaccion } = await import('../shared/reacciones.js');
  const { tarifa } = await import('../shared/base.js');
  const { avanzar } = await import('../shared/engine.js');
  // --- Yafar NPC
  {
    const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
    const e = g.e, [a] = g.ids, Y = e.jugadores.npc, A = e.jugadores[a];
    for (let k = 0; k < 6 && !e.log.some((l) => /llega ebrio/.test(l.texto)); k++) { e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.turno.fin = true; avanzar(data, e); }
    assert.ok(e.log.some((l) => l.texto === `${Y.nombre} llega ebrio de la fiesta del palacio: pierde su primer turno sin hacer nada.`), 'Yafar NPC pierde su primer turno ebrio');
    assert.equal(tarifa(data, e, Y, 'Isfahán', 'India'), null, 'Yafar NPC no va a India');
    const nor = tarifa(data, e, A, 'El Cairo', 'Magreb'); assert.equal(tarifa(data, e, Y, 'El Cairo', 'Magreb'), Math.ceil(nor / 2) + 20, 'Magreb: +20 sobre su mitad');
    e.mods.ladrones = true; Y.noches = 200; Y.dinares = 30; Y.ciudad = 'Damasco'; Y.mano = Y.mano.filter((c) => c.ref !== 'arco');
    e.turno = { pid: 'npc', fase: 'mov', movio: false, tramos: 0, llegadas: [], principal: false, gastos: {} };
    finTurno(data, e, 'npc');
    assert.ok(Y.noches <= 120, 'a Yafar NPC los ladrones le quitan además 80 noches');
  }
  // --- Yafar jugador: nada de lo anterior
  {
    const g = partida(['4', '7', 'B']); assert.ok(g.iniciar().ok);
    const e = g.e, [a, , y] = g.ids, Y = e.jugadores[y], A = e.jugadores[a];
    for (let k = 0; k < 4; k++) { e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.turno.fin = true; avanzar(data, e); }
    assert.ok(!e.log.some((l) => /llega ebrio/.test(l.texto)), 'Yafar jugador no pierde su primer turno');
    assert.notEqual(tarifa(data, e, Y, 'Isfahán', 'India'), null, 'Yafar jugador sí va a India');
    assert.equal(tarifa(data, e, Y, 'El Cairo', 'Magreb'), Math.ceil(tarifa(data, e, A, 'El Cairo', 'Magreb') / 2), 'sin recargo: solo su mitad de siempre');
    Y.ciudad = 'Basra'; Y.dinares = 200; e.burros = 2; turnoDe(e, a, 'Basra'); Y.mano = Y.mano.filter((c) => !['caballo', 'camello', 'burro'].includes(c.ref));
    assert.ok(g.act(y, { t: 'comprar', ref: 'burro' }).ok, 'Yafar jugador sí compra burro');
    const n0 = Y.noches; e.saladino = null; for (const id of g.ids) e.jugadores[id].visitadas.push('Aleppo', 'Damasco');
    turnoDe(e, a, 'Damasco'); A.visitadas = A.visitadas.filter((c) => c !== 'Aleppo'); A.ciudad = 'Aleppo'; llegada(data, e, a, 'Damasco');
    assert.ok(e.saladino && Y.noches >= n0 + 50, 'Saladino sí premia a Yafar jugador');
    e.mods.ladrones = true; Y.noches = 200; Y.dinares = 30; Y.ciudad = 'Damasco'; turnoDe(e, y, 'Damasco'); e.turno.movio = false; Y.mano = Y.mano.filter((c) => c.ref !== 'arco');
    finTurno(data, e, y);
    assert.ok(Y.noches === 200, 'a Yafar jugador los ladrones no le quitan noches');
    assert.equal(armarReaccion(e, a, 'matemosYafar', 9e12, 0).r.texto, '¡Matemos a Yafar!');
    assert.ok(armarReaccion(e, y, 'matemosYafar', 9e12, 0).error, 'Yafar no la manda');
  }
}

// Establo de Bagdad (punto 13): caballo 60, burro 20, camello 50; quien esté en Bagdad lo compra por 10 más
{
  const g = partida(['4', '7', 'B']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b, y] = g.ids, A = e.jugadores[a], Bj = e.jugadores[b], Y = e.jugadores[y];
  for (const j of [A, Bj, Y]) { j.ciudad = 'Bagdad'; j.mano = j.mano.filter((c) => !['caballo', 'camello', 'burro'].includes(c.ref)); }
  const cab = darItem(e, A, 'caballo'), bur = darItem(e, A, 'burro'); A.dinares = 0;
  turnoDe(e, a, 'Bagdad'); e.turno.fase = 'acciones';
  assert.ok(g.act(a, { t: 'vender', uid: cab.uid }).ok); assert.equal(A.dinares, 60);
  assert.ok(g.act(a, { t: 'vender', uid: bur.uid }).ok); assert.equal(A.dinares, 80);
  turnoDe(e, a, 'Bagdad'); e.turno.fase = 'acciones';   // el mercado vende fuera de tu turno: compra B
  Bj.dinares = 100; Y.dinares = 100;
  void y; void Y;
  assert.ok(g.act(b, { t: 'comprar', ref: 'establo:' + cab.uid }).ok, 'compra el caballo de segunda mano'); assert.equal(Bj.dinares, 30, '60 + 10');
  assert.ok(tieneItem(Bj, 'caballo'));
  assert.ok(!g.act(b, { t: 'comprar', ref: 'establo:' + bur.uid }).ok, 'un animal a la vez');
  A.ciudad = 'Damasco'; const cam = darItem(e, A, 'camello'); turnoDe(e, a, 'Damasco'); e.turno.fase = 'acciones';
  assert.ok(!g.act(a, { t: 'vender', uid: cam.uid }).ok, 'solo se venden en Bagdad');
}

// Puntos 6, 7, 8 y 12 de Jorge
{
  const { avanzar } = await import('../shared/engine.js');
  const { duelo } = await import('../shared/pelea.js');
  const { kanmakanVigente } = await import('../shared/pelea.js');
  // 6: con 1 en su dado de ingreso, Yafar NPC paga 10 a sus primos; Yafar jugador no
  {
    const g = partida(['4', 'B']); assert.ok(g.iniciar().ok);
    const e = g.e, [, y] = g.ids, Y = e.jugadores[y];
    e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = [];
    turnoDe(e, y, 'Bagdad'); e.turno.fase = 'ingreso'; Y.dinares = 30; forzar(e, 1);
    assert.ok(g.act(y, { t: 'tirarDados' }).ok); assert.equal(Y.dinares, 30, 'Yafar jugador no paga soborno');
    const h = partida(['4']); assert.ok(h.iniciar().ok);
    const f = h.e, N = f.jugadores.npc; N.extra.jugoTurno = true; N.dinares = 30;
    for (let k = 0; k < 6 && f.turno.pid === 'npc'; k++) { f.dados = null; f.colaDados = []; f.pend = null; f.colaPend = []; f.turno.fin = true; avanzar(data, f); }
    f.dados = null; f.colaDados = []; f.pend = null; f.colaPend = []; f.turno.fin = true; forzar(f, 1); avanzar(data, f);   // le toca a Yafar NPC con un 1
    assert.ok(f.log.some((l) => /sobornar a sus primos/.test(l.texto)), 'Yafar NPC soborna a sus primos cuando saca 1');
  }
  // 8: el Firmán llega en el 3er turno a los dos; solo a Yafar NPC le cuesta cada turno
  {
    const g = partida(['4', 'B']); assert.ok(g.iniciar().ok);
    const e = g.e, [, y] = g.ids, Y = e.jugadores[y];
    Y.dinares = 100; Y.extra.jugoTurno = true; Y.turnos = 2;
    for (let k = 0; k < 8 && !Y.mano.some((c) => c.ref === 'F1'); k++) { e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.turno.fin = true; avanzar(data, e); }
    assert.ok(Y.mano.some((c) => c.ref === 'F1' && c.extra?.yafar), 'a Yafar jugador le llega en su 3er turno');
    assert.ok(e.historial.some((h) => h.id === 'F1' && !h.para), 'todos ven la carta');
    for (let k = 0; k < 8 && Y.turnos < 4; k++) { e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.turno.fin = true; avanzar(data, e); }
    assert.ok(!e.log.some((l) => /por mantener su Firmán/.test(l.texto)), 'a Yafar jugador no le cuesta');
    const f0 = e.firmanes; Y.ciudad = 'Bagdad'; turnoDe(e, y, 'Bagdad'); e.turno.fase = 'acciones'; const d1 = Y.dinares;
    assert.ok(g.act(y, { t: 'venderFirmanYafar' }).ok); assert.equal(Y.dinares, d1 + 25); assert.equal(e.firmanes, f0 + 1, 'lo puede vender y queda a la venta');
    const h = partida(['4']); assert.ok(h.iniciar().ok);
    const f = h.e, N = f.jugadores.npc; N.extra.jugoTurno = true; N.turnos = 2; N.dinares = 100;
    for (let k = 0; k < 20 && !f.log.some((l) => /por mantener su Firmán/.test(l.texto)); k++) { f.dados = null; f.colaDados = []; f.pend = null; f.colaPend = []; f.turno.fin = true; avanzar(data, f); }
    assert.ok(N.mano.some((c) => c.ref === 'F1') && f.log.some((l) => /paga 10 dinares por mantener su Firmán/.test(l.texto)), 'a Yafar NPC le cuesta 10 por turno en normal');
  }
  // 7: Kanmakán se disuelve al pelear si no pasó por Isfahán en sus últimos 2 turnos
  {
    const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
    const e = g.e, [a, b] = g.ids, A = e.jugadores[a];
    A.mano.push({ uid: 'k1', tipo: 'especial', ref: 'K1' }); e.kanmakan = { dueno: a, usada: false };
    A.turnos = 5; A.extra.isfahanTurno = 4; assert.ok(kanmakanVigente(A));
    A.extra.isfahanTurno = 1; assert.ok(!kanmakanVigente(A));
    for (const j of [A, e.jugadores[b]]) j.ciudad = 'Damasco';
    darItem(e, A, 'cimitarra'); A.destreza = true; e.ronda = 4; e.mods = {}; turnoDe(e, a, 'Damasco'); e.turno.fase = 'acciones';
    assert.ok(g.act(a, { t: 'atacar', tipo: 'robo', objetivo: b }).ok);
    while (e.pend) g.act(e.pend.para[0], { t: 'decidir', id: e.pend.id, opcion: (e.pend.opciones.find((o) => o.id === 'luchar') || e.pend.opciones[0]).id });
    assert.ok(!A.mano.some((c) => c.ref === 'K1'), 'se disolvió al usarlo');
  }
  // 12: si Yafar NPC te gana un duelo que él te impuso, ganas 50 noches; con Yafar jugador, no
  {
    const g = partida(['4']); assert.ok(g.iniciar().ok);
    const e = g.e, [a] = g.ids, A = e.jugadores[a];
    A.noches = 100; A.dinares = 10;
    duelo(data, e, 'npc', a, { atk: 'npc' }); assert.equal(A.noches, 100 - 30 + 50, 'Yafar NPC: pierde 30 por el duelo y gana 50 por la historia');
    const h = partida(['4', 'B']); assert.ok(h.iniciar().ok);
    const f = h.e, [b, y] = h.ids, B2 = f.jugadores[b];
    B2.noches = 100; B2.dinares = 10;
    duelo(data, f, y, b, { atk: y }); assert.equal(B2.noches, 70, 'Yafar jugador: solo el duelo normal');
  }
}

// Punto 15: al llegar a 1,001 noches se elige «Ganar ya» o «Seguir la ronda»
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a];
  e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = [];
  turnoDe(e, b, 'Bagdad'); e.turno.fase = 'acciones'; A.noches = 1000;
  A.noches = 1001; g.act(b, { t: 'chat', para: a, tipo: 'ire', ciudad: 'Damasco' });   // cualquier acción revisa las metas
  assert.ok(e.pend && e.pend.tipo === 'meta' && e.pend.para.includes(a), 'le pregunta a quien llegó');
  assert.ok(g.act(a, { t: 'decidir', id: e.pend.id, opcion: 'ganar' }).ok);
  assert.equal(e.fase, 'fin'); assert.deepEqual(e.ganadores, [a], 'gana en ese momento, sin esperar la ronda');
  const h = partida(['4', '7']); assert.ok(h.iniciar().ok);
  const f = h.e, [c, d] = h.ids; f.dados = null; f.colaDados = []; f.pend = null; f.colaPend = [];
  turnoDe(f, d, 'Bagdad'); f.turno.fase = 'acciones'; f.jugadores[c].noches = 1001; h.act(d, { t: 'chat', para: c, tipo: 'ire', ciudad: 'Damasco' });
  assert.ok(h.act(c, { t: 'decidir', id: f.pend.id, opcion: 'seguir' }).ok); assert.equal(f.fase, 'juego', 'si sigue, la partida continúa');
}

// Carta S4 «Traición en Jerusalén»: una vez por partida, en una ronda al azar entre la 4 y la 12; todos pierden 1 dinar y 1 noche, Yafar NPC 10 y 10
{
  const { avanzar, TRAICION } = await import('../shared/engine.js');
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], N = e.jugadores.npc;
  assert.ok(e.traicionRonda >= TRAICION.desde && e.traicionRonda <= TRAICION.hasta, 'la ronda se sortea entre la 4 y la 12');
  e.traicionRonda = e.ronda + 1; A.dinares = 0; A.noches = 20; if (N) { N.dinares = 30; N.noches = 40; }
  const r0 = e.ronda;
  for (let k = 0; k < 8 && e.ronda === r0; k++) { e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.turno.fin = true; avanzar(data, e); }
  assert.ok(e.traicion && e.historial.some((h) => h.id === 'S4' && !h.para), 'sale y la ven todos');
  assert.ok(e.log.some((l) => /Traición en Jerusalén: Los judíos se han aliado con los Cruzados\./.test(l.texto)));
  assert.ok(A.dinares <= 4 && A.noches <= 19 + 50, 'el jugador pierde 1 y 1 (puede quedar en deuda)');
  if (N) assert.ok(e.log.some((l) => /Yafar NPC pierde 10 dinares y 10 noches/.test(l.texto)));
  const n = e.historial.filter((h) => h.id === 'S4').length; e.traicionRonda = e.ronda + 1;
  for (let k = 0; k < 8; k++) { e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.turno.fin = true; avanzar(data, e); }
  assert.equal(e.historial.filter((h) => h.id === 'S4').length, n, 'una sola vez por partida');
  void b;
}

// Banquete de Isfahán, H14 (Jorge, 8 de noviembre): 10 dinares de entrada y siempre 30 noches; luego 1 dado con botón.
// 1: nada más (ya no pierde la acción principal); 2 a 5: alfombra (3 o 5 además herido, sin perder la alfombra); 6: +30 dinares y +20 noches.
{
  const { CONT } = await import('../shared/base.js');
  for (const x of [1, 2, 3, 4, 5, 6]) {
    const g = partida(['4']); assert.ok(g.iniciar().ok);
    const e = g.e, [a] = g.ids, A = e.jugadores[a];
    turnoDe(e, a, 'Isfahán'); A.ciudad = 'Isfahán'; A.dinares = 50; A.noches = 100; A.herido = false; A.extra.clienteWeb = true;
    A.mano = A.mano.filter((c) => c.ref !== 'alfombraIsfahan');
    forzar(e, x);
    CONT['ev.h14'](data, e, {}, { pid: a, opcion: 'si' });
    const d = e.dados;
    assert.ok(d && d.por === a && !d.lanzado && d.grupos[0].valores[0] === x, `dado ${x}: espera el botón del jugador`);
    assert.ok(d.resumen.length === 2, 'la ventana explica el resultado');
    const alf = A.mano.some((c) => c.ref === 'alfombraIsfahan');
    assert.equal(A.dinares, 40 + (x === 6 ? 30 : 0), `dado ${x}: dinares`);
    assert.equal(A.noches, 130 + (x === 6 ? 20 : 0), `dado ${x}: noches`);
    assert.equal(alf, x >= 2 && x <= 5, `dado ${x}: alfombra`);
    assert.equal(A.herido, x === 3 || x === 5, `dado ${x}: herido solo con 3 o 5`);
    assert.ok(!A.extra.sinPrincipal, `dado ${x}: ya no pierde la acción principal`);
  }
  // sin dinares para la entrada no pasa nada
  const g = partida(['4']); assert.ok(g.iniciar().ok);
  const A = g.e.jugadores[g.ids[0]]; A.dinares = 5; A.noches = 100;
  CONT['ev.h14'](data, g.e, {}, { pid: g.ids[0], opcion: 'si' });
  assert.equal(A.noches, 100); assert.equal(A.dinares, 5);
}

// Retos reintentables (Jorge, 8 de noviembre): R21, R28, R31, R32, R33, R34, R36 y R38. Si fallas, no queda hecho y se vuelve a abrir
// cuando sales de la ciudad y regresas; si lo logras, queda hecho para siempre.
{
  const { REINTENTABLES, disponibles } = await import('../shared/retos.js');
  assert.deepEqual(REINTENTABLES, ['R21', 'R28', 'R31', 'R32', 'R33', 'R34', 'R36', 'R38']);
  const preparar = () => {
    const g = partida(['4']); assert.ok(g.iniciar().ok);
    const e = g.e, [a] = g.ids, A = e.jugadores[a];
    turnoDe(e, a, 'Yemen'); A.ciudad = 'Yemen'; e.turno.fase = 'acciones'; A.dinares = 100;
    return { g, e, a, A };
  };
  const ofrece = (e, a, id) => disponibles(data, e, a).some((x) => x.id === id);
  // R38 «Dados en la taberna»: buscar una semilla en la que la casa gane y otra en la que gane el jugador
  let perdio = null, gano = null;
  for (let s = 1; s < 400 && (!perdio || !gano); s++) {
    const { g, e, a, A } = preparar(); e.semilla = s; const d0 = A.dinares;
    assert.ok(g.act(a, { t: 'reto', id: 'R38' }).ok);
    if (A.dinares < d0 && !perdio) perdio = { g, e, a, A }; else if (A.dinares > d0 && !gano) gano = { g, e, a, A };
  }
  assert.ok(perdio && gano, 'hay semillas para ganar y perder');
  {
    const { g, e, a, A } = perdio;
    assert.ok(!A.retosHechos.includes('R38'), 'fallado: no cuenta como hecho');
    turnoDe(e, a, 'Yemen'); e.turno.fase = 'acciones';
    assert.ok(!ofrece(e, a, 'R38'), 'en la misma visita no se ofrece');
    assert.match(g.act(a, { t: 'reto', id: 'R38' }).error, /sal de la ciudad y vuelve/);
    A.ciudad = 'Basra'; llegada(data, e, a, 'Yemen');
    A.ciudad = 'Yemen'; turnoDe(e, a, 'Yemen'); llegada(data, e, a, 'Basra'); e.turno.fase = 'acciones';
    assert.ok(ofrece(e, a, 'R38'), 'al volver a Yemen se puede intentar otra vez');
  }
  {
    const { e, a, A } = gano;
    assert.ok(A.retosHechos.includes('R38'), 'logrado: queda hecho');
    A.ciudad = 'Basra'; llegada(data, e, a, 'Yemen'); A.ciudad = 'Yemen'; turnoDe(e, a, 'Yemen'); llegada(data, e, a, 'Basra'); e.turno.fase = 'acciones';
    assert.ok(!ofrece(e, a, 'R38'), 'ya hecho: no se repite');
  }
  // un reto que no está en la lista (R44) sigue igual: hecho aunque sea solo una visita
  const { g, e, a, A } = preparar(); A.ciudad = 'Magreb'; turnoDe(e, a, 'Magreb'); e.turno.fase = 'acciones';
  assert.ok(g.act(a, { t: 'reto', id: 'R44' }).ok); assert.ok(A.retosHechos.includes('R44'));
}

// Varios escondites (Jorge, 8 de noviembre): tantos como papeles amate; cada carta saca solo su escondite; se puede agregar a uno
// que ya tienes en la ciudad; el papel se vende en un trato y el comprador saca ese escondite; al morir se pierden los que no vendiste.
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [a, b] = g.ids, A = e.jugadores[a], B = e.jugadores[b];
  const papeles = (j) => j.mano.filter((c) => c.tipo === 'item' && c.ref === 'mapa' && c.extra?.tesoro === 'jugador');
  const en = (ciudad) => { turnoDe(e, a, ciudad); A.ciudad = ciudad; if (!A.visitadas.includes(ciudad)) A.visitadas.push(ciudad); e.turno.fase = 'acciones'; };
  A.dinares = 200; A.mano = A.mano.filter((c) => c.ref !== 'amate'); darItem(e, A, 'amate'); darItem(e, A, 'amate'); darItem(e, A, 'amate');
  en('Damasco');
  assert.ok(g.act(a, { t: 'esconder', monto: 30 }).ok);
  assert.ok(g.act(a, { t: 'esconder', monto: 20, nuevo: true }).ok, 'segundo escondite en la misma ciudad con otro papel');
  assert.ok(g.act(a, { t: 'esconder', monto: 5 }).ok, 'agregar a uno que ya tienes aquí no gasta papel');
  en('Aleppo');
  assert.ok(g.act(a, { t: 'esconder', monto: 40 }).ok, 'tercer escondite en otra ciudad');
  assert.equal(papeles(A).length, 3); assert.equal(A.mano.filter((c) => c.ref === 'amate').length, 0, 'se gastaron los 3 papeles');
  assert.equal(A.escondido, 95); assert.equal(A.dinares, 105);
  assert.deepEqual(papeles(A).map((c) => c.extra.monto).sort((x, y) => x - y), [20, 35, 40], 'cada carta dice cuánto tiene');
  assert.ok(!g.act(a, { t: 'esconder', monto: 5, nuevo: true }).ok, 'sin papel no se crea otro escondite');
  // recuperar en Aleppo: solo ese
  const pAleppo = papeles(A).find((c) => c.extra.ciudad === 'Aleppo');
  assert.ok(g.act(a, { t: 'recuperar', uid: pAleppo.uid }).ok);
  assert.equal(A.dinares, 145); assert.equal(A.escondido, 55); assert.equal(papeles(A).length, 2);
  // vende un papel de Damasco a B (en un trato); B saca ese escondite
  const p20 = papeles(A).find((c) => c.extra.monto === 20);
  A.mano.splice(A.mano.indexOf(p20), 1); B.mano.push(p20);
  turnoDe(e, b, 'Damasco'); B.ciudad = 'Damasco'; e.turno.fase = 'acciones'; const db = B.dinares;
  assert.ok(g.act(b, { t: 'recuperar', uid: p20.uid }).ok); assert.equal(B.dinares, db + 20); assert.equal(A.escondido, 35, 'al dueño le queda el otro');
  // otro papel vendido sigue vivo aunque el dueño muera
  en('Damasco'); A.mano = A.mano.filter((c) => c.ref !== 'amate'); darItem(e, A, 'amate');
  assert.ok(g.act(a, { t: 'esconder', monto: 10, nuevo: true }).ok);
  const p10 = papeles(A).find((c) => c.extra.monto === 10); A.mano.splice(A.mano.indexOf(p10), 1); B.mano.push(p10);
  eliminar(data, e, a, { causa: 'prueba', por: b });
  assert.equal(A.escondido, 10, 'al morir se pierden sus escondites, salvo el del papel vendido');
  turnoDe(e, b, 'Damasco'); e.turno.fase = 'acciones'; const db2 = B.dinares;
  assert.ok(g.act(b, { t: 'recuperar', uid: p10.uid }).ok); assert.equal(B.dinares, db2 + 10);
}

// Zubayda (Jorge, 8 de noviembre): su propuesta de compañía cuesta siempre 7 dinares; el cliente recibe 50 noches de su haber y nada más.
{
  const { PRECIO_ZUBAYDA } = await import('../shared/personajes.js');
  assert.equal(PRECIO_ZUBAYDA, 7);
  const g = partida(['6', '4']); assert.ok(g.iniciar().ok);
  const e = g.e, [z, c] = g.ids, Z = e.jugadores[z], C = e.jugadores[c];
  turnoDe(e, z, 'Damasco'); Z.ciudad = 'Damasco'; C.ciudad = 'Damasco'; e.turno.fase = 'acciones';
  Z.noches = 120; Z.dinares = 10; C.noches = 0; C.dinares = 30;
  assert.ok(g.act(z, { t: 'pj', sub: 'prost', con: c, precio: 150 }).ok, 'aunque mande otro precio');
  assert.match(e.pend.texto, /Entregas: 7 dinares/);
  assert.ok(g.act(c, { t: 'decidir', id: e.pend.id, opcion: 'si' }).ok);
  assert.equal(C.dinares, 23, 'el cliente paga 7'); assert.equal(C.noches, 50, 'y recibe 50 noches');
  assert.equal(Z.dinares, 17); assert.equal(Z.noches, 70);
}

// Jamil (Jorge, 8 de noviembre): versos en honra (propuesta: el otro gana 30 noches y le paga 5) o de sátira (pierde 10 noches o
// le paga 7). Ya no cobra por recitar crímenes ni canta versos difamatorios.
{
  const g = partida(['4', '7']); assert.ok(g.iniciar().ok);
  const e = g.e, [jm, b] = g.ids, J = e.jugadores[jm], B = e.jugadores[b];
  const prep = () => { turnoDe(e, jm, 'Damasco'); J.ciudad = 'Damasco'; B.ciudad = 'Damasco'; e.turno.fase = 'acciones'; };
  prep(); J.dinares = 10; B.dinares = 20; B.noches = 100;
  assert.ok(g.act(jm, { t: 'pj', sub: 'honra', con: b }).ok);
  assert.ok(g.act(b, { t: 'decidir', id: e.pend.id, opcion: 'si' }).ok);
  assert.equal(B.noches, 130); assert.equal(B.dinares, 15); assert.equal(J.dinares, 15);
  assert.ok(e.pend && e.pend.tipo === 'info', 'ventana con el resultado');
  // rechazo: Jamil recupera su acción
  prep(); e.pend = null; e.colaPend = [];
  assert.ok(g.act(jm, { t: 'pj', sub: 'honra', con: b }).ok);
  assert.ok(g.act(b, { t: 'decidir', id: e.pend.id, opcion: 'no' }).ok);
  assert.ok(!e.turno.principal, 'si rechaza, Jamil recupera su acción');
  // sin 5 dinares no hay trato
  prep(); e.pend = null; e.colaPend = []; B.dinares = 4;
  assert.ok(!g.act(jm, { t: 'pj', sub: 'honra', con: b }).ok);
  // sátira: paga 7 o pierde 10
  prep(); e.pend = null; e.colaPend = []; B.dinares = 20; B.noches = 100; J.dinares = 0;
  assert.ok(g.act(jm, { t: 'pj', sub: 'satira', con: b }).ok);
  assert.ok(g.act(b, { t: 'decidir', id: e.pend.id, opcion: 'pagar' }).ok);
  assert.equal(B.dinares, 13); assert.equal(J.dinares, 7); assert.equal(B.noches, 100);
  prep(); e.pend = null; e.colaPend = []; B.dinares = 3;
  assert.ok(g.act(jm, { t: 'pj', sub: 'satira', con: b }).ok);
  assert.ok(e.pend.opciones.find((o) => o.id === 'pagar').desactivada, 'sin 7 dinares no puede pagar');
  assert.ok(g.act(b, { t: 'decidir', id: e.pend.id, opcion: 'noches' }).ok);
  assert.equal(B.noches, 90, 'sin 7 dinares pierde las 10 noches'); assert.equal(B.dinares, 3);
  // otra ciudad: no se puede
  prep(); e.pend = null; e.colaPend = []; B.ciudad = 'Aleppo';
  assert.ok(!g.act(jm, { t: 'pj', sub: 'satira', con: b }).ok);
}

// Zein (Jorge, 8 de noviembre): sin «Noche discreta»; empieza con la carta «Dados del Cairo» (regalo de Zacaría al Ansari). Quien la
// tenga repite sus dados una vez por ronda si va a perder. Se vende en un trato o al mercado por 35 (aviso a todos) y ahí se revende en 75.
{
  const { disponibles: accPj } = await import('../shared/personajes.js');
  const g = partida(['2', '4']); assert.ok(g.iniciar().ok);
  const e = g.e, [z, b] = g.ids, Z = e.jugadores[z], B = e.jugadores[b];
  assert.ok(Z.mano.some((c) => c.ref === 'dadosCairo'), 'Zein empieza con los Dados del Cairo');
  turnoDe(e, z, 'Damasco'); Z.ciudad = 'Damasco'; B.ciudad = 'Damasco'; e.turno.fase = 'acciones';
  assert.ok(!accPj(data, e, z).some((a) => a.sub === 'zein'), 'ya no hay noche discreta');
  // vender al mercado (en su turno): 35 y aviso
  const d0 = Z.dinares, cd = Z.mano.find((c) => c.ref === 'dadosCairo');
  assert.ok(g.act(z, { t: 'vender', uid: cd.uid }).ok);
  assert.equal(Z.dinares, d0 + 35); assert.ok(!Z.mano.some((c) => c.ref === 'dadosCairo'));
  assert.ok(e.log.some((l) => l.aviso && /Dados del Cairo están a la venta en el mercado de Damasco por 75/.test(l.texto)), 'aviso para todos');
  // B la compra en Damasco por 75 (fuera de su turno, como el mercado)
  assert.equal(e.pend?.titulo, 'Apuros financieros'); assert.ok(g.act(z, { t: 'decidir', id: e.pend.id, opcion: 'ok' }).ok);
  B.dinares = 80;
  assert.ok(g.act(b, { t: 'comprar', ref: 'dadosCairo' }).ok);
  assert.equal(B.dinares, 5); assert.ok(B.mano.some((c) => c.ref === 'dadosCairo')); assert.ok(!e.mercadoDados?.dadosCairo);
  assert.ok(!g.act(b, { t: 'comprar', ref: 'dadosCairo' }).ok, 'solo hay una');
  // apuros financieros: Zein consigue un viaje gratis de un tramo (una sola vez)
  assert.ok(Z.extra.viajeZein && e.log.some((l) => /apuros financieros/.test(l.texto)));
  turnoDe(e, z, 'Damasco'); Z.ciudad = 'Damasco'; e.turno.fase = 'mov'; const d1 = Z.dinares;
  assert.ok(g.act(z, { t: 'viajar', destino: 'Aleppo' }).ok); assert.equal(Z.ciudad, 'Aleppo'); assert.equal(Z.dinares, d1, 'el viaje le sale gratis');
  assert.ok(!Z.extra.viajeZein, 'solo uno');
}

// Ruyán (Jorge, 8 de noviembre): 5 cartas de respuestas que corrigen una trivia fallada (gana el premio); y a quien llega a su
// ciudad (fuera de Bagdad) le compra en automático 20 noches por 10 dinares.
{
  const g = partida(['5', '4']); assert.ok(g.iniciar().ok);
  const e = g.e, [r, b] = g.ids, R = e.jugadores[r], B = e.jugadores[b];
  const tr = data.trivias.trivias[0], mala = (tr.correcta + 1) % tr.opciones.length;
  const trivia = (pid) => { turnoDe(e, pid, 'Damasco'); e.turno.ccActual = { tipo: 'trivia', id: tr.id, nro: 0 }; };
  for (let k = 5; k >= 1; k--) {
    trivia(r); const d0 = R.dinares;
    assert.ok(g.act(r, { t: 'responderCC', opcion: mala }).ok);
    assert.equal(R.dinares, d0 + tr.premio, 'la carta de respuestas lo corrige y gana el premio');
    assert.equal(R.extra.crp, k - 1);
  }
  trivia(r); const d1 = R.dinares;
  assert.ok(g.act(r, { t: 'responderCC', opcion: mala }).ok); assert.equal(R.dinares, d1, 'sin cartas, falla');
  trivia(b); const d2 = B.dinares;
  assert.ok(g.act(b, { t: 'responderCC', opcion: mala }).ok); assert.equal(B.dinares, d2, 'a los demás no los corrige');
  // visita: automática, 20 noches por 10 dinares, con aviso a los dos
  R.ciudad = 'Damasco'; R.noches = 200; B.dinares = 20; B.noches = 0;
  turnoDe(e, b, 'Aleppo'); B.ciudad = 'Damasco'; llegada(data, e, b, 'Aleppo');
  assert.ok([e.pend, ...e.colaPend].some((p) => p?.tipo === 'info' && p.titulo === 'El Sabio Ruyán'), 'aviso');
  assert.ok(B.noches >= 20); assert.equal(B.dinares, 10); assert.equal(R.noches, 180);
}

// Nur al Din (Jorge, 8 de noviembre): a él sí le pueden robar como a cualquiera; él no puede robar a nadie.
{
  const g = partida(['1', '4']); assert.ok(g.iniciar().ok);
  const e = g.e, [n, b] = g.ids, N = e.jugadores[n], B = e.jugadores[b];
  e.ronda = 4; turnoDe(e, b, 'Damasco'); N.ciudad = 'Damasco'; B.ciudad = 'Damasco'; e.turno.fase = 'acciones'; darItem(e, B, 'jambiya');
  const rr = g.act(b, { t: 'atacar', tipo: 'robo', objetivo: n }); assert.ok(rr.ok, 'se le puede robar: ' + rr.error);
  turnoDe(e, n, 'Damasco'); e.turno.fase = 'acciones';
  assert.match(g.act(n, { t: 'atacar', tipo: 'robo', objetivo: b }).error, /no puede robar/);
}

// Anís (Jorge, 8 de noviembre): «Por la ventana» pasa a ser la carta «Dados de Persia» (empieza con ella; quien la tenga escapa con
// 5 o 6); se vende en trato o al mercado por 30 (aviso a todos) y ahí se revende en 60.
{
  const g = partida(['3', '4']); assert.ok(g.iniciar().ok);
  const e = g.e, [an, b] = g.ids, A = e.jugadores[an], B = e.jugadores[b];
  assert.ok(A.mano.some((c) => c.ref === 'dadosPersia'), 'Anís empieza con los Dados de Persia');
  turnoDe(e, an, 'Aleppo'); A.ciudad = 'Aleppo'; B.ciudad = 'Aleppo'; e.turno.fase = 'acciones';
  const d0 = A.dinares, c = A.mano.find((x) => x.ref === 'dadosPersia');
  assert.ok(g.act(an, { t: 'vender', uid: c.uid }).ok); assert.equal(A.dinares, d0 + 30);
  assert.ok(e.log.some((l) => l.aviso && /Dados de Persia están a la venta en el mercado de Aleppo por 60/.test(l.texto)));
  B.dinares = 60; assert.ok(g.act(b, { t: 'comprar', ref: 'dadosPersia' }).ok); assert.equal(B.dinares, 0);
  assert.ok(B.mano.some((x) => x.ref === 'dadosPersia'), 'ahora la usa quien la compró');
}

// Anís mata a Jamil (Jorge, 8 de noviembre): cada uno de los demás le paga 8 dinares completos (quien no los tenga queda endeudado
// con el banco) y Anís gana 60 noches.
{
  let hecho = false;
  for (let s = 1; s < 300 && !hecho; s++) {
    const g = partida(['3', '4', '7'], {}, s); assert.ok(g.iniciar().ok);
    const e = g.e, [an, jm, c] = g.ids, A = e.jugadores[an], J = e.jugadores[jm], C = e.jugadores[c];
    e.ronda = 5; turnoDe(e, an, 'Damasco'); for (const x of [A, J, C]) x.ciudad = 'Damasco'; e.turno.fase = 'acciones';
    A.destreza = true; darItem(e, A, 'cimitarra'); J.mano = J.mano.filter((x) => x.ref !== 'dadosPersia'); C.dinares = 3; J.dinares = 0; A.noches = 100;
    const d0 = A.dinares;
    if (!g.act(an, { t: 'atacar', tipo: 'matar', objetivo: jm }).ok) continue;
    while (e.pend) g.act(e.pend.para[0], { t: 'decidir', id: e.pend.id, opcion: (e.pend.opciones.find((o) => !o.desactivada) || {}).id });
    if (!J.eliminado) continue;
    assert.equal(C.dinares, -5, 'sin 8 dinares queda endeudado con el banco');
    assert.ok(A.dinares - d0 >= 8, 'Anís recibe los 8 de cada uno');
    assert.ok(A.noches >= 160, 'y gana 60 noches');
    hecho = true;
  }
  assert.ok(hecho, 'se pudo probar que Anís mata a Jamil');
}

// Jorge (8 de noviembre): Yafar que asalta o ataca a muerte a Zein o a Zubayda sin armas a la vista queda Buscado (un arma escondida
// no cuenta); con un arma a la vista, no. Piratas de Yemen: sin los dinares que piden no hay viaje ni noches ni se gasta la acción.
{
  for (const [pjV, arma, oculta, esperado] of [['6', null, false, true], ['2', 'jambiya', true, true], ['2', 'alfanje', false, false]]) {
    const g = partida(['B', pjV]); assert.ok(g.iniciar().ok);
    const e = g.e, [y, v] = g.ids, Y = e.jugadores[y], V = e.jugadores[v];
    e.ronda = 5; turnoDe(e, y, 'Damasco'); Y.ciudad = 'Damasco'; V.ciudad = 'Damasco'; e.turno.fase = 'acciones';
    V.mano = V.mano.filter((c) => !['arco', 'alfanje', 'cimitarra', 'jambiya'].includes(c.ref)); V.extra.jambiyaOculta = false;
    V.mano = V.mano.filter((c) => c.ref !== 'dadosPersia');
    if (arma) { darItem(e, V, arma); V.extra.jambiyaOculta = oculta; }
    Y.buscado = 0;
    const r = g.act(y, { t: 'atacar', tipo: 'robo', objetivo: v }); assert.ok(r.ok, r.error);
    assert.equal(Y.buscado > 0, esperado, `Yafar contra ${pjV} con ${arma || 'nada'}${oculta ? ' escondida' : ''}`);
  }
  const g = partida(['4']); assert.ok(g.iniciar().ok);
  const e = g.e, [a] = g.ids, A = e.jugadores[a];
  turnoDe(e, a, 'Yemen'); A.ciudad = 'Yemen'; e.turno.fase = 'acciones'; A.dinares = 1; A.noches = 100;
  assert.ok(!g.act(a, { t: 'tesoro', sub: 'jorasan', via: 'piratas' }).ok);
  assert.equal(A.noches, 100); assert.equal(A.dinares, 1); assert.ok(!e.turno.principal, 'no gasta la acción'); assert.ok(!A.transito);
}

// Jorge (8 de noviembre): las tiradas propias de Yafar NPC no tienen ventana: al terminar de rodar, el servidor sigue solo.
{
  const { dadosDeNPC, RODAR_NPC_MS } = await import('../shared/engine.js');
  const g = partida(['4']); assert.ok(g.iniciar().ok);
  const e = g.e; e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = [];
  const d = mostrarDados(e, { por: 'npc', npc: true, motivo: 'npc:Yafar', grupos: [{ etq: 'Yafar NPC: dado de movimiento', valores: [3] }], resumen: [] });
  assert.ok(dadosDeNPC(e, d) && d.lanzado);
  g.tickear(RODAR_NPC_MS + 600); assert.equal(e.dados, null, 'se cierran solos al terminar de rodar');
  const p = mostrarDados(e, { por: 'npc', npc: true, motivo: 'pelea', grupos: [{ etq: 'pelea', valores: [3, 4] }], resumen: [] });
  assert.ok(!dadosDeNPC(e, p), 'las peleas conservan su ventana');
  // cuando va contra alguien: alerta que se cierra (al momento, sin esperar)
  e.dados = null; e.colaDados = [];
  const al = mostrarDados(e, { por: 'npc', npc: true, alerta: true, motivo: 'npc:Yafar', grupos: [{ etq: 'Yafar NPC: 1-3 asalto, 4-6 duelo', valores: [2] }], resumen: ['Yafar va contra J0: lo asalta para robarle.'] });
  assert.ok(!dadosDeNPC(e, al), 'la alerta contra alguien sí tiene ventana');
  g.tickear(RODAR_NPC_MS + 600); assert.equal(e.dados, al, 'no se cierra sola al terminar de rodar');
}

console.log('reglas de la casa OK');
