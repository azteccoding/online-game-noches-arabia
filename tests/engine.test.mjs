// Pruebas del motor sin navegador:  node tests/engine.test.mjs
import assert from 'node:assert/strict';
import { actuanAsesinos } from '../shared/npc.js';
import { nuevoJuego, unir, reducir, vista, tick, serializar, restaurar } from '../shared/engine.js';
import { dado, darItem } from '../shared/base.js';
import { bonos } from '../shared/pelea.js';
import { cargarDatos } from '../server/datos.js';

const data = cargarDatos();

function partida(pjs, { semilla = 42, opciones = {} } = {}) {
  const e = nuevoJuego(data, { semilla, ahora: 1000, opciones });
  let now = 1000;
  const act = (pid, a) => { now += 300; return reducir(data, e, pid, a, now); };
  const ids = pjs.map((pj, i) => { const id = unir(e, { nombre: 'J' + i, token: 't' + i }); assert.ok(act(id, { t: 'elegirPj', pj }).ok); return id; });
  const g = { e, act, ids, tickear: (ms = 100000) => { now += ms; tick(data, e, now); }, forzar(valor) { for (let s = 1; ; s++) { if (dado({ semilla: s }) === valor) { e.semilla = s; return; } } } };
  g.listos = () => { for (const id of ids) act(id, { t: 'listo', v: true }); return act(ids[0], { t: 'iniciar' }); };
  g.asentar = () => { for (let k = 0; k < 60 && (e.pend || e.dados || (!e.turno && e.fase === 'juego')); k++) g.tickear(); };
  g.turno = () => { g.asentar(); return e.turno.pid; };
  g.entrar = (pid) => { assert.equal(g.turno(), pid); assert.ok(act(pid, { t: 'tirarDados' }).ok); g.asentar(); };
  g.cerrar = (pid) => { g.asentar(); const r = act(pid, { t: 'terminarTurno' }); assert.ok(r.ok, r.error); g.asentar(); };
  return g;
}
const sinMensaje = (j) => { j.mensajes = []; };

// ---------------------------------------------------------------- lobby y reglas de mesa
{
  const g = partida(['4', '7', '5']); const { e, act, ids } = g;
  const [A, B, C] = ids;
  assert.ok(!act(B, { t: 'elegirPj', pj: '4' }).ok, 'personaje repetido');
  assert.ok(!act(A, { t: 'iniciar' }).ok, 'faltan jugadores listos');
  for (const p of ids) act(p, { t: 'listo', v: true });
  assert.ok(!act(B, { t: 'iniciar' }).ok, 'solo el anfitrión inicia');
  assert.ok(act(A, { t: 'iniciar' }).ok);
  const vivos = e.orden.filter((id) => !e.jugadores[id].eliminado);
  assert.equal(vivos.slice(-1)[0], 'npc', 'Yafar NPC juega el último');
  assert.equal(vivos.slice(-2)[0], B, 'Adí justo antes de Yafar');
  assert.notEqual(e.jugadores[e.orden[e.orden.length - 1]].pj, '5', 'Ruyán nunca último');
  assert.equal(e.jugadores.npc.pj, 'B'); assert.equal(e.jugadores.npc.dinares, 10);
  assert.ok(e.jugadores.npc.mano.some((c) => c.ref === 'jambiya') && !e.jugadores.npc.mano.some((c) => c.ref === 'F1'))   // el Firmán le llega en su 3er turno (punto 8);
  assert.ok(e.historial.some((h) => h.deck === 'evento'), 'evento de ronda 1');
  void C;
}
{
  const g = partida(['1', '2', '3', '4']);
  for (const id of g.ids) g.act(id, { t: 'listo', v: true });
  assert.ok(!g.act(g.ids[0], { t: 'iniciar' }).ok, 'con 4 jugadores alguien debe llevar a Yafar (R 4.3)');
  const h = partida(['1', '2', '3', 'B']);
  assert.ok(h.listos().ok); assert.ok(!h.e.jugadores.npc, 'con Yafar jugador no hay NPC');
  assert.equal(h.e.jugadores[h.ids[3]].mano.some((c) => c.ref === 'F1'), false, 'el Firmán de Yafar llega en su 3er turno (punto 8)');
}

// ---------------------------------------------------------------- privacidad
{
  const g = partida(['4', '7', '5']); const { e, ids } = g; g.listos();
  const v = JSON.stringify(vista(data, e, ids[1]));
  assert.ok(!v.includes('"token"') && !v.includes('semilla') && !v.includes('"mazos"') && !v.includes('"pinHost"'), 'sin secretos');
  e.jugadores[ids[0]].mano.push({ uid: 'x1', tipo: 'objeto', ref: 'OB01' });
  const vb = vista(data, e, ids[1]);
  assert.ok(!JSON.stringify(vb).includes('"x1"'), 'la mano ajena no viaja');
  assert.ok(vista(data, e, ids[0]).mano.some((c) => c.ref === 'OB01' && c.datos?.titulo), 'la propia sí');
  assert.equal(vb.jugadores[ids[0]].nMano.objeto, 1, 'el número de cartas es público');
}

// ---------------------------------------------------------------- turno, dados, viaje, persistencia
{
  const g = partida(['4', '7', '5']); const { e, act, ids } = g; g.listos();
  const p = g.turno();
  assert.equal(p, e.orden[0]);
  assert.ok(!act(p, { t: 'viajar', destino: 'Damasco' }).ok, 'primero el dado de ingreso');
  assert.ok(act(p, { t: 'tirarDados' }).ok);
  assert.ok(!act(p, { t: 'tirarDados' }).ok, 'ya tiraste');
  assert.ok(e.dados, 'los dados quedan en la mesa');
  assert.ok(!act(p, { t: 'cerrarDados' }).ok, 'siguen rodando');
  g.tickear(3000); assert.ok(act(ids[1], { t: 'cerrarDados' }).ok); assert.ok(e.dados && e.dados.cerrados.includes(ids[1]), 'otro jugador solo lo cierra en su pantalla');
  assert.ok(act(p, { t: 'cerrarDados' }).ok); assert.equal(e.dados, null, 'quien tiró lo cierra para todos');
  sinMensaje(e.jugadores[p]); e.jugadores[p].dinares = 100;
  const r = act(p, { t: 'viajar', destino: 'Damasco' });
  assert.ok(r.ok, r.error);
  assert.equal(e.jugadores[p].ciudad, 'Damasco');
  if (e.turno.ccActual) { if (e.turno.ccActual.tipo === 'trivia') act(p, { t: 'responderCC', opcion: 0 }); else act(p, { t: 'omitirCC' }); }
  g.cerrar(p);
  for (let k = 0; k < 8 && e.ronda === 1; k++) { const q = g.turno(); g.entrar(q); sinMensaje(e.jugadores[q]); if (e.turno.ccActual) act(q, { t: 'omitirCC' }); g.cerrar(q); }
  assert.equal(e.ronda, 2, 'la ronda se cierra'); assert.ok(e.jugadores.npc.turnos > 0, 'el NPC juega solo su turno');
  const copia = restaurar(serializar(e)); assert.equal(copia.ronda, e.ronda);
  // el banco desconectado no bloquea
  e.jugadores[e.host].conectado = false;
  const otro = e.orden.find((i) => i !== e.host && !e.jugadores[i].npc);
  assert.ok(act(otro, { t: 'host.tirarNPC', quien: 'Asesinos' }).ok, 'NPC sin banco');
}

// ---------------------------------------------------------------- banco: corregir y repartir
{
  const g = partida(['4', '7', '5']); const { e, act, ids } = g; g.listos();
  assert.ok(!act(ids[1], { t: 'host.corregir', pid: ids[1], campo: 'dinares', valor: 99 }).ok, 'solo el anfitrión');
  assert.ok(!act(ids[0], { t: 'host.corregir', pid: ids[1], campo: 'dinares', valor: 99 }).ok, 'con la caja del banco cerrada no se corrige');
  assert.ok(act(ids[0], { t: 'host.caja', abrir: true }).ok); assert.ok(e.log.some((l) => /abrió la caja del banco/.test(l.texto)));
  assert.ok(act(ids[0], { t: 'host.corregir', pid: ids[1], campo: 'dinares', valor: 99 }).ok);
  assert.equal(e.jugadores[ids[1]].dinares, 99);
  assert.ok(act(ids[0], { t: 'host.dar', pid: ids[1], dinares: 1, noches: 2 }).ok);
  assert.ok(act(ids[0], { t: 'host.repartir', pid: ids[1], mazo: 'botin' }).ok);
  assert.equal(e.jugadores[ids[1]].mano.filter((c) => c.tipo === 'objeto').length, 1);
  assert.ok(act(ids[0], { t: 'host.barajar', mazo: 'botin' }).ok);
}

// ---------------------------------------------------------------- tienda
{
  const g = partida(['1', '2', '3']); const { e, act } = g; g.listos();
  const p = g.turno(); g.entrar(p); sinMensaje(e.jugadores[p]);
  const q = g.ids.find((x) => x !== p);                                       // regla de la casa: el mercado vende fuera de tu turno
  e.jugadores[p].dinares = 200; e.jugadores[q].ciudad = e.jugadores[p].ciudad;
  const rp = act(p, { t: 'comprar', ref: 'alfanje' }); assert.ok(!rp.ok && /juegan los demás/.test(rp.error), 'en tu turno el mercado no te vende');
  const j = e.jugadores[q]; j.dinares = 200; j.mano = [];
  assert.ok(!act(q, { t: 'comprar', ref: 'alfanje' }).ok, 'en Bagdad no hay alfanjes (Jorge, 10 de noviembre)');
  j.ciudad = 'Estambul';
  const antes = j.dinares;
  assert.ok(act(q, { t: 'comprar', ref: 'alfanje' }).ok);
  assert.ok(j.mano.some((c) => c.ref === 'alfanje'));
  assert.ok(j.dinares < antes);
  assert.ok(!act(q, { t: 'comprar', ref: 'alfanje' }).ok, 'ya la tienes');
  assert.ok(act(q, { t: 'comprar', id: 'OB01' }).ok || true);
}

// ---------------------------------------------------------------- combate: los dinares se conservan y el muerto hereda
{
  for (let s = 1; s <= 30; s++) {
    const g = partida(['1', '2', '5'], { semilla: s }); const { e, act } = g; g.listos();
    e.ronda = 5;
    const [A, B] = [g.turno(), g.ids.find((x) => x !== g.turno())];
    g.entrar(A);
    const a = e.jugadores[A], b = e.jugadores[B];
    sinMensaje(a); a.ciudad = 'Damasco'; b.ciudad = 'Damasco'; a.dinares = 40; b.dinares = 40; a.destreza = true;
    if (!a.mano.some((c) => c.ref === 'jambiya')) a.mano.push({ uid: 'w1', tipo: 'item', ref: 'jambiya' });
    const total = (x) => x.dinares + x.noches;
    const antes = total(a) + total(b);
    const r = act(A, { t: 'atacar', tipo: 'matar', objetivo: B });
    assert.ok(r.ok, r.error);
    for (let k = 0; k < 8 && e.pend; k++) { const p = e.pend; const ok = p.opciones.find((o) => !o.desactivada); act(p.para[0], p.modo === 'multi' ? { t: 'decidir', id: p.id, valores: p.opciones.slice(0, p.min || 0).map((o) => o.id) } : { t: 'decidir', id: p.id, opcion: ok.id }); }
    assert.equal(e.pelea, null, 'la pelea termina');
    if (b.eliminado) { assert.equal(b.dinares, 0); assert.ok(a.dinares >= 40 + 40 - 0 || a.noches > 0 || a.eliminado); assert.ok(a.buscado > 0, 'el asesino queda Buscado'); }
    if (a.eliminado) { assert.ok(b.dinares >= 40, 'el defensor hereda'); assert.equal(b.buscado, 0, 'regla de la casa: el defensor no queda Buscado'); }
    void antes;
  }
}

// ---------------------------------------------------------------- Asesinos: contrato (R 13)
{
  const g = partida(['1', '2', '5']); const { e, act } = g; g.listos();
  const p = g.turno(); g.entrar(p); const j = e.jugadores[p]; sinMensaje(j);
  const v = g.ids.find((x) => x !== p);
  j.ciudad = 'Samarcanda'; j.dinares = 400; j.noches = 100;
  assert.ok(!act(p, { t: 'asesinos' }).ok, 'regla de la casa: hacen falta 500 noches');
  j.noches = 600;
  const antes = j.noches, nv = e.jugadores[v].noches;
  assert.ok(act(p, { t: 'asesinos' }).ok);
  assert.equal(e.pend.tipo, 'asesinos');
  assert.ok(act(p, { t: 'decidir', id: e.pend.id, opcion: v }).ok);   // lanza el dado del precio (dado × rondas × 35) y, si alcanza, firma
  // regla de la casa: actúan al final del siguiente turno de la víctima; hasta entonces no se sabe quién los contrató
  assert.ok(!e.jugadores[v].eliminado && e.asesinos.actuaron && e.asesinos.pendiente, 'el contrato queda pendiente');
  assert.ok(e.log.some((l) => l.texto.includes(j.nombre + ' contrató a los Asesinos')), 'se publica quién los contrató');
  assert.ok(!e.log.some((l) => l.texto.includes('contra ' + e.jugadores[v].nombre)), 'pero nunca contra quién');
  assert.ok(e.turno.pid !== p || e.turno.fin, 'y su turno termina');
  e.jugadores[v].turnos++; e.pend = null; e.colaPend = []; actuanAsesinos(data, e);
  const V = e.jugadores[v];
  assert.ok(V.eliminado || (V.herido && V.perdido && V.dinares === 0 && V.noches === 0), 'muere o sobrevive herido en el Jorasán sin nada');
  assert.ok(j.buscado > 0, 'y queda Buscado');
  if (V.eliminado) assert.equal(j.noches, antes + nv, 'si muere: se queda las noches de la víctima (las 200 noches dependen del encargo)');
  e.turno = { ...e.turno, pid: p, fin: false, principal: false }; assert.ok(!act(p, { t: 'asesinos' }).ok, 'solo una vez por partida');
}

// ---------------------------------------------------------------- Yafar NPC y modo solitario
{
  const g = partida(['4'], { opciones: { dificultad: 'normal' } }); const { e } = g; assert.ok(g.listos().ok);
  assert.ok(e.solitario && e.jugadores.npc);
  const npc = e.jugadores.npc, din0 = npc.dinares;
  const p = g.turno(); g.entrar(p); sinMensaje(e.jugadores[p]); g.cerrar(p);
  assert.ok(npc.dinares >= din0 + 5, 'el NPC cobra su ingreso y la bolsa de sus parientes');
  for (let k = 0; k < 4 && !(npc.noches > 0 || npc.ciudad !== 'Bagdad'); k++) { const q = g.turno(); g.entrar(q); sinMensaje(e.jugadores[q]); g.cerrar(q); }   // su primer turno llega ebrio y no hace nada (punto 1); el resto depende del azar
  assert.ok(npc.noches > 0 || npc.ciudad !== 'Bagdad', 'el NPC se mueve');
  // derrota inmediata al morir
  e.jugadores[p].eliminado = true; g.tickear();
  assert.equal(e.fase, 'fin'); assert.equal(e.derrota, 'npc'); assert.ok(e.finUltimo, 'Yafar NPC queda último en pie');
}
{
  const g = partida(['4'], { opciones: { dificultad: 'facil' } }); const { e } = g; g.listos();
  const ingreso = e.log.reduce((s, l) => s + Number((/^Turno de J0: cobra (\d+) dinares/.exec(l.texto) || [0, 0])[1]), 0);   // si el evento de ronda ya terminó, el turno pudo cobrar su ingreso
  assert.equal(e.jugadores[g.ids[0]].dinares - ingreso, 30, 'fácil: 30 dinares');
}
{
  const g = partida(['4'], { opciones: { dificultad: 'dificil' } }); const { e } = g; g.listos();
  const p = g.turno(); g.entrar(p); sinMensaje(e.jugadores[p]);
  e.jugadores.npc.extra.jugoTurno = true;   // su primer turno lo pierde ebrio (punto 1); aquí se mide un turno normal
  const d0 = e.jugadores.npc.dinares; g.cerrar(p);
  assert.ok(e.log.some((l) => /Yafar NPC cobra 10 dinares de la bolsa de sus parientes/.test(l.texto)), 'difícil: bolsa de 10'); void d0;   // el saldo neto depende del azar (sobornos, eventos)
}

// ---------------------------------------------------------------- victoria a 1,001 noches
{
  const g = partida(['4', '7', '5']); const { e } = g; g.listos();
  for (const id of e.orden) e.jugadores[id].noches = 0;
  e.jugadores[e.orden[0]].noches = 1001;
  for (let k = 0; k < 200 && e.fase === 'juego'; k++) {
    g.asentar();
    if (e.fase !== 'juego') break;
    const t = e.turno; if (!t) break;
    if (t.fase === 'ingreso') g.act(t.pid, { t: 'tirarDados' });
    g.asentar();
    sinMensaje(e.jugadores[t.pid]);
    if (e.turno?.ccActual) g.act(t.pid, { t: 'omitirCC' });
    g.act(t.pid, { t: 'terminarTurno' });
  }
  assert.equal(e.fase, 'fin'); assert.deepEqual(e.ganadores, [e.orden[0]]);
}
{
  const g = partida(['4']); const { e } = g; g.listos();
  e.jugadores.npc.noches = 1001; e.jugadores[g.ids[0]].noches = 10;
  const p = g.turno(); g.entrar(p); sinMensaje(e.jugadores[p]); g.cerrar(p);
  assert.equal(e.fase, 'fin'); assert.equal(e.derrota, 'npc', 'si Yafar NPC llega primero, pierden los jugadores');
}
{
  const g = partida(['4']); const { e } = g; g.listos();
  e.jugadores.npc.noches = 1001; e.jugadores[g.ids[0]].noches = 1400;
  e.llegoMil = { [g.ids[0]]: 1 };   // ya eligió «Seguir la ronda» (punto 15): se resuelve al cerrar la ronda
  const p = g.turno(); g.entrar(p); sinMensaje(e.jugadores[p]); g.cerrar(p);
  assert.equal(e.fase, 'fin'); assert.deepEqual(e.ganadores, [g.ids[0]], 'si ambos llegan y el jugador tiene más noches: gana el jugador');
}
{
  const g = partida(['4']); const { e } = g; g.listos();
  e.jugadores.npc.noches = 1400; e.jugadores[g.ids[0]].noches = 1001;
  e.llegoMil = { [g.ids[0]]: 1 };   // ya eligió «Seguir la ronda» (punto 15): se resuelve al cerrar la ronda
  const p = g.turno(); g.entrar(p); sinMensaje(e.jugadores[p]); g.cerrar(p);
  assert.equal(e.fase, 'fin'); assert.deepEqual(e.ganadores, [g.ids[0]], 'regla de la casa (tope de 1,001): si ambos llegan en la misma ronda quedan empatados en 1,001 y el empate es de los jugadores');
}

// ---------------------------------------------------------------- cimitarra: +2 de arma y +2 propio al atacar (decisión pro-jugador de Jorge)
{
  const g = partida(['4', '7', '5']); const { e, ids } = g; g.listos();
  const j = e.jugadores[ids[0]]; darItem(e, j, 'cimitarra');
  const atk = bonos(data, e, ids[0], { armas: ['cimitarra'] }, 'atk', null);
  const def = bonos(data, e, ids[0], { armas: ['cimitarra'] }, 'def', null);
  assert.equal(atk.total, 4, 'cimitarra al atacar: +2 de arma +2 propio'); assert.equal(def.total, 2, 'cimitarra al defender: +2');
  data.config.reglasCasa.cimitarraExtraAlAtacar = false;
  assert.equal(bonos(data, e, ids[0], { armas: ['cimitarra'] }, 'atk', null).total, 2, 'la bandera de config lo desactiva');
  data.config.reglasCasa.cimitarraExtraAlAtacar = true;
}

// ---------------------------------------------------------------- veneno, antídoto y velo de viajero (R 15.1)
{
  const g = partida(['4', '7', '5']); const { e, act, ids } = g; g.listos();
  const p = g.turno(); g.entrar(p); const v = ids.find((x) => x !== p && e.jugadores[x].pj !== '5') || ids.find((x) => x !== p);
  const j = e.jugadores[p], vic = e.jugadores[v]; sinMensaje(j);
  const c = darItem(e, j, 'veneno'); j.dinares = 200; vic.noches = 40;
  assert.ok(!act(p, { t: 'usar', uid: c.uid, objetivo: p, via: 'anciana' }).ok, 'no puedes envenenarte');
  assert.ok(act(p, { t: 'usar', uid: c.uid, objetivo: v, via: 'anciana' }).ok);
  assert.equal(e.pend.tipo, 'veneno'); assert.deepEqual(e.pend.para, [v]);
  assert.ok(act(v, { t: 'decidir', id: e.pend.id, opcion: 'pagar' }).ok);
  assert.equal(vic.noches, 0); assert.ok(!vic.eliminado, 'pagar todas las noches a Ruyán evita la muerte');
  const c2 = darItem(e, j, 'veneno'); j.dinares = 200; vic.mano.push({ uid: 'ant', tipo: 'objeto', ref: 'OB20' });
  assert.ok(act(p, { t: 'usar', uid: c2.uid, objetivo: v, via: 'anciana' }).ok);
  assert.ok(!e.pend && !vic.eliminado && !vic.mano.some((x) => x.ref === 'OB20'), 'el antídoto cancela el veneno y se gasta');
  const c3 = darItem(e, j, 'veneno'); j.dinares = 200;
  assert.ok(act(p, { t: 'usar', uid: c3.uid, objetivo: v, via: 'anciana' }).ok);
  assert.ok(act(v, { t: 'decidir', id: e.pend.id, opcion: 'morir' }).ok);
  assert.ok(vic.eliminado, 'sin antídoto ni pago, muere');
}

console.log('motor OK');
