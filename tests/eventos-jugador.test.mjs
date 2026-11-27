// Mazo de eventos de jugador (EJ), solo 3D (Jorge, 26 de noviembre): reemplaza a las Cartas de Cuentos. node tests/eventos-jugador.test.mjs
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, vista, serializar, restaurar, tick } from '../shared/engine.js';
import { validarAtaque } from '../shared/pelea.js';
import { cargarDatos } from '../server/datos.js';

const data = cargarDatos();
const EJ = data.ej.cartas;
assert.equal(EJ.length, 48, '48 cartas');
assert.equal(EJ.filter((c) => c.jorasan).length, 7, '7 del Jorasán');
assert.deepEqual(EJ.filter((c) => c.jorasan).map((c) => c.id), ['EJ33', 'EJ34', 'EJ36', 'EJ39', 'EJ40', 'EJ43', 'EJ44']);
for (const c of EJ) assert.ok(['EJ', 'EJ-pierdes', 'EJ-ganas', 'EJ-jorasan'].includes(c.arte), c.id);
assert.ok(EJ.find((c) => c.id === 'EJ1').texto[0].startsWith('El Zalmedina te sorprende bebiendo orina de camellos'), 'textos de Jorge tal cual');
for (const c of EJ) assert.ok(!/Mahoma/.test(c.texto.join(' ')));

function partida(pjs, semilla = 7) {
  const e = nuevoJuego(data, { semilla, ahora: 1000, opciones: { sinYafar: true } });   // sin Yafar NPC: los turnos son de los jugadores
  let now = 1000;
  const act = (pid, a) => { now += 3000; return reducir(data, e, pid, a, now); };
  const ids = pjs.map((pj, i) => { const id = unir(e, { nombre: 'J' + i, token: 't' + i }); assert.ok(act(id, { t: 'elegirPj', pj }).ok); return id; });
  for (const id of ids) act(id, { t: 'listo', v: true });
  assert.ok(act(ids[0], { t: 'iniciar' }).ok);
  despejar({ e, act });
  const g = { e, act, ids, ahora: () => now, avanzarReloj: (ms) => { now += ms; } };
  // primera ronda: nadie saca carta en su primer turno; todos en Damasco para que paguen alojamiento
  for (const id of e.orden) { e.jugadores[id].ciudad = 'Damasco'; e.jugadores[id].dinares = 100; }
  for (let k = 0; k < ids.length; k++) turnoQuieto(g);
  for (const id of e.orden) e.jugadores[id].extra.ejPend = null;   // la carta al azar del inicio de la segunda ronda no cuenta
  for (let k = 0; k < 5 && e.dados; k++) act(e.dados.por, { t: 'cerrarDados' });
  despejar(g);
  return g;
}
const siguiente = (e, pid) => { const vivos = e.orden.filter((i) => !e.jugadores[i].eliminado); return vivos[(vivos.indexOf(pid) + 1) % vivos.length]; };
function despejar({ e, act }) {   // eventos de ronda y avisos que salen al azar
  for (let k = 0; k < 20 && e.pend; k++) act(e.pend.para[0], { t: 'decidir', id: e.pend.id, opcion: e.pend.porDefecto ?? e.pend.opciones?.[0]?.id });
}
let nuid = 0;
const dar = (j, ref, tipo = 'objeto') => j.mano.push({ uid: 'p' + (++nuid), tipo, ref, pub: true });
// Fuerza la próxima carta: todas las demás ya «salieron».
const forzar = (e, id) => { const jor = EJ.find((c) => c.id === id).jorasan; e.mazos[jor ? 'ejVistasJor' : 'ejVistas'] = EJ.filter((c) => c.id !== id && !!c.jorasan === jor).map((c) => c.id); };
// Juega el turno de quien sigue sin moverse (dado de ingreso y terminar). Al terminarlo empieza el turno del siguiente, que saca la
// carta EJ al iniciar (Jorge, 27 de noviembre). preparar() se aplica a ese siguiente jugador antes. Devuelve { pid: el siguiente, carta }.
function turnoQuieto(g, preparar = () => {}) {
  const { e, act } = g;
  for (let k = 0; k < 5 && e.dados; k++) act(e.dados.por, { t: 'cerrarDados' });   // dados que quedaron en la mesa (el de la viuda)
  despejar(g);
  const pid = e.turno.pid;
  const rt = act(pid, { t: 'tirarDados' }); assert.ok(rt.ok, JSON.stringify(rt) + JSON.stringify(e.dados) + e.turno.fase); act(pid, { t: 'cerrarDados' });
  despejar(g);
  e.mods = {}; e.evento.actual = null;
  const sig = siguiente(e, pid);
  preparar(e.jugadores[sig]);
  const n0 = e.seq;
  const r = act(pid, { t: 'terminarTurno' }); assert.ok(r.ok, r.error);
  return { pid: sig, carta: e.historial.find((h) => h.nro > n0 && h.deck === 'ej' && h.quien === sig) || null };
}
const leer = (g, pid, carta) => assert.ok(g.act(pid, { t: 'leido', nro: carta.nro }).ok);

{
  // Ya no salen Cartas de Cuentos: ni al viajar con la trivia ni al contestarla
  const g = partida(['4', '7', '5']); const { e, act } = g;
  const p = e.turno.pid;
  assert.ok(act(p, { t: 'tirarDados' }).ok); act(p, { t: 'cerrarDados' }); despejar(g);
  const j = e.jugadores[p]; j.ciudad = 'Bagdad'; j.dinares = 100; j.mensajes = []; e.sinCaravanasBagdad = false; e.mods = {}; e.evento.actual = null;
  { const rv = act(p, { t: 'viajar', destino: 'Damasco' }); assert.ok(rv.ok, JSON.stringify(rv)); }
  despejar(g);
  if (e.turno.ccActual?.tipo === 'trivia') { const tr = data.trivias.trivias.find((t) => t.id === e.turno.ccActual.id); assert.ok(act(p, { t: 'responderCC', opcion: tr.correcta }).ok); }
  assert.equal(e.historial.filter((h) => h.deck === 'cuento').length, 0, 'sin cuentos en el 3D');
  despejar(g);
  const n0 = e.seq; assert.ok(act(p, { t: 'terminarTurno' }).ok);
  assert.ok(!e.historial.some((h) => h.nro > n0 && h.deck === 'ej' && h.quien === p), 'al terminar el turno no sale');
  // al iniciar su siguiente turno sí, aunque haya viajado: durmió en Damasco
  for (let k = 0; k < 5 && e.turno.pid !== p; k++) turnoQuieto(g);
  assert.equal(e.turno.pid, p);
  assert.ok(e.historial.some((h) => h.nro > n0 && h.deck === 'ej' && h.quien === p), 'sale al iniciar el turno aunque haya viajado');
  assert.equal(e.historial.filter((h) => h.nro > n0 && h.deck === 'ej' && h.quien === p).length, 1, 'una sola');
}

{
  // Al pagar alojamiento sale una carta pública; las consecuencias llegan al cerrarla (EJ11 sin Refranero: paga 2)
  const g = partida(['4', '7', '5']); const { e } = g;
  forzar(e, 'EJ11');
  const { pid, carta } = turnoQuieto(g, (j) => { j.dinares = 50; });
  assert.ok(carta, 'sale un evento de jugador');
  assert.equal(carta.id, 'EJ11'); assert.equal(carta.quien, pid); assert.equal(carta.para, null, 'público para toda la mesa');
  assert.equal(carta.arte, 'EJ-pierdes');
  assert.ok(vista(data, e, e.orden.find((i) => i !== pid)).historial.some((h) => h.deck === 'ej'), 'todos la ven');
  const antes = e.jugadores[pid].dinares;
  leer(g, pid, carta);
  assert.equal(e.jugadores[pid].dinares, antes - 2, 'paga 2 al cerrar la carta');
  // con Refranero andalusí gana 3
  forzar(e, 'EJ11');
  const t2 = turnoQuieto(g, (j) => { dar(j, 'OB33'); });
  const a2 = e.jugadores[t2.pid].dinares; leer(g, t2.pid, t2.carta);
  assert.equal(e.jugadores[t2.pid].dinares, a2 + 3);
}

{
  // Fianza (EJ2): eliges pagar o perder la acción; sin dinares pierdes la acción sin elegir
  const g = partida(['4', '7', '5']); const { e, act } = g;
  forzar(e, 'EJ2');
  const t1 = turnoQuieto(g, (j) => { j.dinares = 20; });
  leer(g, t1.pid, t1.carta);
  assert.equal(e.pend?.tipo, 'ej'); assert.deepEqual(e.pend.para, [t1.pid]);
  const d0 = e.jugadores[t1.pid].dinares;
  assert.ok(act(t1.pid, { t: 'decidir', id: e.pend.id, opcion: 'pagar' }).ok);
  assert.equal(e.jugadores[t1.pid].dinares, d0 - 4);
  forzar(e, 'EJ2');
  const t2 = turnoQuieto(g, (j) => { j.dinares = 0; j.mano = j.mano.filter((c) => c.ref !== 'OB12'); });
  // sin dinares: no alcanza la fianza
  e.jugadores[t2.pid].dinares = 0;   // al iniciar el turno pudo cobrar algo; la fianza se decide al cerrar la carta
  leer(g, t2.pid, t2.carta);
  assert.ok(!e.pend || e.pend.tipo !== 'ej', 'no hay elección');
  assert.equal(e.jugadores[t2.pid].extra.sinPrincipal, true, 'pierde su acción principal el próximo turno');
  assert.ok(e.log.some((l) => /No tienes dinares/.test(l.texto)));
}

{
  // Si nunca la cierra, se aplica a los 90 s; y como máximo una por turno; NPC no saca
  const g = partida(['4', '7', '5']); const { e, act } = g;
  forzar(e, 'EJ25');
  const t1 = turnoQuieto(g, (j) => { dar(j, 'OB26'); });
  const d0 = e.jugadores[t1.pid].dinares;
  g.avanzarReloj(95000); tick(data, e, g.ahora());
  assert.equal(e.jugadores[t1.pid].dinares, d0 + 60, 'el Espejo encantado: +60 a los 90 s');
  assert.equal(e.jugadores[t1.pid].extra.ejPend, null);
}

{
  // Personajes en la ciudad: EJ17 (Nur al Din) devuelve el alojamiento; EJ47 reparte la inscripción
  const g = partida(['1', '7', '5']); const { e } = g;
  const nur = e.orden.find((i) => e.jugadores[i].pj === '1');
  let t;
  for (let k = 0; k < 3; k++) { if (siguiente(e, e.turno.pid) === nur) { turnoQuieto(g); continue; } forzar(e, 'EJ17'); t = turnoQuieto(g, (j) => { e.jugadores[nur].ciudad = 'Damasco'; j.ciudad = 'Damasco'; j.dinares = 40; }); break; }
  const pagado = e.jugadores[t.pid].extra.ejPend.aloj; assert.ok(pagado > 0, 'pagó alojamiento');
  const d0 = e.jugadores[t.pid].dinares; leer(g, t.pid, t.carta);
  assert.equal(e.jugadores[t.pid].dinares, d0 + pagado, 'le devuelven el alojamiento');

  forzar(e, 'EJ47');
  const ru = e.orden.find((i) => e.jugadores[i].pj === '5'), adi = e.orden.find((i) => e.jugadores[i].pj === '7');
  for (const id of e.orden) e.jugadores[id].dinares = 30;
  const t2 = turnoQuieto(g);
  for (const id of e.orden) e.jugadores[id].dinares = 30;
  leer(g, t2.pid, t2.carta);
  const pagan = e.orden.filter((i) => i !== ru && i !== adi);
  for (const id of pagan) assert.equal(e.jugadores[id].dinares, 25);
  assert.equal(e.jugadores[ru].dinares + e.jugadores[adi].dinares, 60 + 5 * pagan.length, 'Ruyán y Adí se reparten la inscripción');
}

{
  // EJ47 sin Ruyán ni Adí: todo va a Yafar
  const g = partida(['B', '4', '1']); const { e } = g;
  const y = e.orden.find((i) => e.jugadores[i].pj === 'B');
  forzar(e, 'EJ47');
  const t = turnoQuieto(g);
  for (const id of e.orden) e.jugadores[id].dinares = 10;
  leer(g, t.pid, t.carta);
  assert.equal(e.jugadores[y].dinares, 5 + 15, 'Yafar paga sus 5 y cobra los 15');
}

{
  // EJ42: los poetas protegen a Zein esa ronda
  const g = partida(['2', '1', '4']); const { e } = g;
  const z = e.orden.find((i) => e.jugadores[i].pj === '2'), nur = e.orden.find((i) => e.jugadores[i].pj === '1');
  forzar(e, 'EJ42');
  const t = turnoQuieto(g, (j) => { j.ciudad = 'Andalucía'; });
  leer(g, t.pid, t.carta);
  e.jugadores[nur].ciudad = e.jugadores[z].ciudad;
  const r = validarAtaque(data, e, nur, { tipo: 'duelo', objetivo: z }, { npc: true });
  assert.equal(r.ok, false); assert.match(r.error, /poetas/);
}

{
  // Jorasán: si empiezas perdido y no sales, sale una carta del Jorasán; EJ39 saca a Anís a Basra en su próximo turno
  const g = partida(['3', '4']); const { e, act } = g;
  const anis = e.orden.find((i) => e.jugadores[i].pj === '3');
  if (e.turno.pid !== anis) turnoQuieto(g);
  assert.equal(e.turno.pid, anis);
  // aún no estaba perdido al empezar: no hay carta del Jorasán
  assert.ok(act(anis, { t: 'tirarDados' }).ok); act(anis, { t: 'cerrarDados' }); despejar(g);
  Object.assign(e.jugadores[anis], { perdido: true, ciudad: 'Jorasán' });
  const m0 = e.seq; assert.ok(act(anis, { t: 'terminarTurno' }).ok);
  assert.ok(!e.historial.some((h) => h.nro > m0 && h.deck === 'ej' && h.quien === anis), 'se perdió en este turno: todavía no');
  const t1 = turnoQuieto(g);
  assert.equal(e.turno.pid, anis); assert.equal(t1.carta, null, 'perdido en el Jorasán no saca carta de ciudad al iniciar');
  forzar(e, 'EJ39');
  assert.ok(act(anis, { t: 'tirarDados' }).ok); act(anis, { t: 'cerrarDados' }); despejar(g);
  const n0 = e.seq; assert.ok(act(anis, { t: 'terminarTurno' }).ok);
  const c = e.historial.find((h) => h.nro > n0 && h.deck === 'ej');
  assert.equal(c?.id, 'EJ39'); assert.equal(c.arte, 'EJ-jorasan');
  const a = e.jugadores[anis]; const d0 = a.dinares, n1 = a.noches;
  leer(g, anis, c);
  assert.equal(a.dinares, d0 + 15); assert.equal(a.noches, n1 + 20);
  turnoQuieto(g);
  assert.equal(e.turno.pid, anis);
  assert.equal(a.perdido, false); assert.equal(a.ciudad, 'Basra', 'sale a Basra sin tirar');
}

{
  // EJ26: la viuda fallece en tantos turnos como diga el dado; persistencia del mazo
  const g = partida(['4', '7', '5']); const { e } = g;
  forzar(e, 'EJ26');
  const t = turnoQuieto(g, (j) => { j.ciudad = 'Damasco'; dar(j, 'OB41'); });
  leer(g, t.pid, t.carta);
  const j = e.jugadores[t.pid]; const v = j.extra.ejViuda; assert.ok(v && v.turno > j.turnos);
  assert.ok(!j.mano.some((c) => c.ref === 'OB41'), 'da la Joya de granate');
  const d0 = j.dinares;
  for (let k = 0; k < 20 && j.extra.ejViuda; k++) turnoQuieto(g);
  assert.equal(j.extra.ejViuda, null); assert.ok(e.log.some((l) => /Fallece la viuda/.test(l.texto)));
  assert.ok(j.dinares >= d0 + 80 - 200, 'hereda (sin contar alojamientos e ingresos)');
  const copia = restaurar(serializar(e));
  assert.ok(Array.isArray(copia.mazos.ejVistas));
}

{
  // EJ3: sin armas ni destreza eliges a la víctima y el objeto sale al azar; con arma la carta no te sale
  const g = partida(['4', '7', '5']); const { e, act } = g;
  forzar(e, 'EJ3');
  let vic;
  const t = turnoQuieto(g, (j) => { j.ciudad = 'Damasco'; j.destreza = false; j.mano = j.mano.filter((c) => !['alfanje', 'cimitarra', 'jambiya'].includes(c.ref)); vic = e.orden.find((i) => i !== j.id); e.jugadores[vic].ciudad = 'Damasco'; dar(e.jugadores[vic], 'OB21'); });
  assert.equal(t.carta?.id, 'EJ3');
  const nV = e.jugadores[vic].mano.length, nL = e.jugadores[t.pid].mano.length;
  leer(g, t.pid, t.carta);
  assert.equal(e.pend?.tipo, 'ej'); assert.ok(e.pend.opciones.some((o) => o.id === vic));
  assert.ok(act(t.pid, { t: 'decidir', id: e.pend.id, opcion: vic }).ok);
  assert.equal(e.jugadores[vic].mano.length, nV - 1); assert.equal(e.jugadores[t.pid].mano.length, nL + 1);
  forzar(e, 'EJ3');
  const t2 = turnoQuieto(g, (j) => { j.ciudad = 'Damasco'; dar(j, 'alfanje', 'item'); });
  assert.notEqual(t2.carta?.id, 'EJ3', 'con arma sale otra carta');
}

{
  // EJ4: con Botella de vino eliges Jorasán o 30 dinares y te quitan la botella
  const g = partida(['4', '7', '5']); const { e, act } = g;
  forzar(e, 'EJ4');
  const t = turnoQuieto(g, (j) => { j.ciudad = 'Damasco'; j.dinares = 60; dar(j, 'vino', 'item'); });
  leer(g, t.pid, t.carta);
  assert.equal(e.pend?.tipo, 'ej');
  assert.ok(act(t.pid, { t: 'decidir', id: e.pend.id, opcion: 'jorasan' }).ok);
  const j = e.jugadores[t.pid];
  assert.equal(j.perdido, true); assert.equal(j.ciudad, 'Jorasán'); assert.ok(!j.mano.some((c) => c.ref === 'vino'));
}
{
  // Alojamiento cada turno (Jorge, 27 de noviembre): sin dinares duermes en la calle y pierdes 5 noches, aunque quedes en negativo
  const g = partida(['4', '7', '5']); const { e, act } = g;
  for (let k = 0; k < 5 && e.dados; k++) act(e.dados.por, { t: 'cerrarDados' }); despejar(g);
  const pid = e.turno.pid, j = e.jugadores[pid];
  assert.ok(act(pid, { t: 'tirarDados' }).ok); act(pid, { t: 'cerrarDados' }); despejar(g);
  e.mods = {}; e.evento.actual = null;
  j.ciudad = 'Damasco'; j.dinares = 3; j.noches = 2; j.mano = j.mano.filter((c) => c.ref !== 'OB22');
  assert.ok(act(pid, { t: 'terminarTurno' }).ok);
  assert.equal(j.dinares, 3, 'no paga nada'); assert.equal(j.noches, -3, 'pierde 5 noches aunque quede en negativo');
  assert.ok([e.pend, ...(e.colaPend || [])].some((p) => p && p.titulo === 'Duermes en la calle' && p.para[0] === pid), 'se le avisa');
  // con dinares paga el alojamiento nuevo de Damasco (4) aunque haya llegado ese turno
  despejar(g);
  for (let k = 0; k < 5 && e.turno.pid !== pid; k++) turnoQuieto(g);
  for (let k = 0; k < 5 && e.dados; k++) act(e.dados.por, { t: 'cerrarDados' }); despejar(g);
  assert.ok(act(pid, { t: 'tirarDados' }).ok); act(pid, { t: 'cerrarDados' }); despejar(g);
  e.mods = {}; e.evento.actual = null; j.ciudad = 'Damasco'; j.dinares = 30; j.noches = 10; e.turno.movio = true;
  assert.ok(act(pid, { t: 'terminarTurno' }).ok);
  assert.equal(j.dinares, 26, 'paga 4 en Damasco aunque llegó este turno');
}
console.log('eventos-jugador.test.mjs OK');
