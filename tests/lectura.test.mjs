// Cartas (Jorge, 8 de noviembre): primero se cierra la carta y luego se ven sus consecuencias; 4 s para todas y 7 s para Traición en
// Jerusalén; mientras tengas una carta sin cerrar, la barra muestra el saldo de antes y el registro no enseña lo que pasó desde ella.
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, vista } from '../shared/engine.js';
import { cargarDatos } from '../server/datos.js';
import { publicarCarta } from '../shared/base.js';
import { cartaSinCerrar, saldoVisible, logVisible, lecturaMs, MIN_LECTURA_MS } from '../src/game/lectura.js';

assert.equal(MIN_LECTURA_MS, 4000);
assert.equal(lecturaMs({ id: 'S4' }), 7000, 'Traición en Jerusalén: 7 s');
assert.equal(lecturaMs({ id: 'E3' }), 4000);

const data = cargarDatos();
const e = nuevoJuego(data, { semilla: 3, ahora: 1000, opciones: {} });
let now = 1000;
const act = (pid, a) => { now += 300; return reducir(data, e, pid, a, now); };
const ids = ['1', '4'].map((pj, i) => { const id = unir(e, { nombre: 'J' + i, token: 't' + i }); act(id, { t: 'elegirPj', pj }); return id; });
for (const id of ids) act(id, { t: 'listo', v: true });
assert.ok(act(ids[0], { t: 'iniciar' }).ok);
const [a] = ids, A = e.jugadores[a];
e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = [];
// el jugador ya cerró todo lo que había
assert.ok(act(a, { t: 'leido', nro: e.seq }).ok);
A.dinares = 20; A.noches = 50;
const mem = {};
const barra = () => { const v = vista(data, e, a); return saldoVisible(mem, v.jugadores[a], !!cartaSinCerrar(v)); };
assert.deepEqual(barra(), { dinares: 20, noches: 50 });

// sale «Traición en Jerusalén» para todos y el servidor aplica el efecto
e.ahora = now;
publicarCarta(e, { id: 'S4', deck: 'especial', titulo: 'Traición en Jerusalén' }, null);
A.dinares -= 1; A.noches -= 1;
e.log.push({ t: e.ahora, texto: 'Traición en Jerusalén: todos pierden 1 dinar y 1 noche.', n: 9999 });
let v = vista(data, e, a);
assert.equal(cartaSinCerrar(v)?.id, 'S4', 'la carta está por cerrar');
assert.deepEqual(barra(), { dinares: 20, noches: 50 }, 'mientras no la cierra: saldo de antes');
assert.ok(!logVisible(v).some((l) => /Traición/.test(l.texto)), 'el registro no la cuenta todavía');

// la cierra: ya se ven las consecuencias
assert.ok(act(a, { t: 'leido', nro: e.seq }).ok);
v = vista(data, e, a);
assert.equal(cartaSinCerrar(v), null);
assert.deepEqual(barra(), { dinares: 19, noches: 49 }, 'al cerrarla: saldo nuevo');
assert.ok(logVisible(v).some((l) => /Traición/.test(l.texto)));

// los cuentos de ambiente no congelan nada
publicarCarta(e, { id: 'C1', deck: 'cuento', titulo: 'Un cuento' }, null);
assert.equal(cartaSinCerrar(vista(data, e, a)), null);
console.log('lectura de cartas OK');
