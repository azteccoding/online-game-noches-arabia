// Desenlace de cada reto (Jorge, 21 de noviembre): «cada reto que pierdas o ganes debe decirte qué pasó, cuál fue el desenlace».
// Con dados, la ventana de los dados lo dice (y las consecuencias se ven al cerrarla); sin dados, una alerta propia de 5 s.
// node tests/desenlace.test.mjs
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, vista } from '../shared/engine.js';
import { darItem } from '../shared/base.js';
import { cargarDatos } from '../server/datos.js';

const data = cargarDatos();
const TITULAR = /¡Lo lograste!|No lo lograste\.|El reto sigue en curso\./;
let probados = 0;
const vistos = new Set();
for (const { id, ciudad } of data.retos.retos) {
  for (let sem = 1; sem <= 12; sem++) {
    const e = nuevoJuego(data, { semilla: sem * 7, ahora: 1000, opciones: {} }); let now = 1000;
    const act = (pid, a) => { now += 300; return reducir(data, e, pid, a, now); };
    const ps = ['4', '7'].map((pj, i) => { const p = unir(e, { nombre: 'J' + i, token: 't' + i }); act(p, { t: 'elegirPj', pj }); return p; });
    act(ps[0], { t: 'opciones', sinYafar: true }); ps.forEach((p) => act(p, { t: 'listo', v: true })); act(ps[0], { t: 'iniciar' });
    e.semilla = sem * 13;
    const a = ps[0], j = e.jugadores[a];
    j.ciudad = ciudad; j.dinares = 400; j.noches = 300;
    for (const r of ['alfanje', 'jambiya', 'cimitarra']) darItem(e, j, r);
    e.turno = { pid: a, idx: e.orden.indexOf(a), fase: 'acciones', tramos: 0, ciudadInicio: ciudad, movio: false, llegadas: [], cc: 0, ccBien: 0, ccActual: null, principal: false, gastos: {} };
    e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.anuncios = [];
    if (!act(a, { t: 'reto', id }).ok) break;   // requisito que esta prueba no cumple: se prueba en reglas-casa
    for (let k = 0; k < 5 && e.pend?.para.includes(a) && e.pend.tipo === 'objetos'; k++) act(a, { t: 'decidir', id: e.pend.id, r: { valores: [] } });
    const pendiente = [e.pend, ...(e.colaPend || [])].some((p) => p && p.para.includes(a) && p.tipo !== 'info');
    if (pendiente) continue;   // el reto sigue con una decisión tuya: su desenlace sale al terminar
    const dados = [e.dados, ...(e.colaDados || [])].filter((d) => d && d.por === a && d.motivo === 'reto:' + id);
    const alerta = (vista(data, e, a).anuncios || []).find((x) => x.propio && !/cítricos/.test(x.texto));   // los cítricos avisan aparte, en rojo (Jorge, 27 de noviembre)
    assert.ok(dados.some((d) => d.resumen.some((r) => TITULAR.test(r))) || (alerta && TITULAR.test(alerta.texto)), `${id} (semilla ${sem}) termina sin desenlace`);
    assert.ok(![e.pend, ...(e.colaPend || [])].some((p) => p && p.tipo === 'info' && p.titulo === `Reto ${id}`), `${id}: ya no sale la ventana «Entendido», sino la alerta`);
    if (alerta) assert.match(alerta.texto, new RegExp(`^Reto ${id} · `), `${id}: la alerta dice de qué reto es`);
    probados++; vistos.add(id);
  }
}
assert.ok(vistos.size >= 30, 'se prueban casi todos los retos: ' + vistos.size);

// R34 (lo que vio Jorge): con 3 o 4, la ventana de los dados dice qué hallaste, que lo lograste y el saldo
{
  let visto = false;
  for (let sem = 1; sem <= 40 && !visto; sem++) {
    const e = nuevoJuego(data, { semilla: sem, ahora: 1000, opciones: {} }); let now = 1000;
    const act = (pid, a) => { now += 300; return reducir(data, e, pid, a, now); };
    const ps = ['4', '7'].map((pj, i) => { const p = unir(e, { nombre: 'J' + i, token: 't' + i }); act(p, { t: 'elegirPj', pj }); return p; });
    act(ps[0], { t: 'opciones', sinYafar: true }); ps.forEach((p) => act(p, { t: 'listo', v: true })); act(ps[0], { t: 'iniciar' });
    e.semilla = sem * 31;
    const a = ps[0], j = e.jugadores[a]; j.ciudad = 'Magreb'; j.dinares = 50;
    e.turno = { pid: a, idx: e.orden.indexOf(a), fase: 'acciones', tramos: 0, ciudadInicio: 'Magreb', movio: false, llegadas: [], cc: 0, ccBien: 0, ccActual: null, principal: false, gastos: {} };
    e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = [];
    assert.ok(act(a, { t: 'reto', id: 'R34' }).ok);
    if (e.pend?.tipo === 'objetos') act(a, { t: 'decidir', id: e.pend.id, r: { valores: [] } });
    const d = [e.dados, ...(e.colaDados || [])].find((x) => x?.motivo === 'reto:R34');
    if (d.valores[0] < 3 || d.valores[0] > 4) continue;
    visto = true;
    assert.deepEqual(d.resumen, ['Reto R34:', 'Un cofre pequeño: +20 dinares.', '¡Lo lograste!', 'En total: +10 dinares.']);
    assert.equal(e.log.filter((l) => l.texto === 'Un cofre pequeño: +20 dinares.').length, 1, 'no se repite en el registro');
  }
  assert.ok(visto, 'hay una semilla con 3 o 4 en la cueva');
}

// Reto en varios pasos (R10): al entregar en Bagdad sale el desenlace, sin contar el pasaje ni las noches de la llegada
{
  const e = nuevoJuego(data, { semilla: 5, ahora: 1000, opciones: {} }); let now = 1000;
  const act = (pid, a) => { now += 300; return reducir(data, e, pid, a, now); };
  const ps = ['4', '7'].map((pj, i) => { const p = unir(e, { nombre: 'J' + i, token: 't' + i }); act(p, { t: 'elegirPj', pj }); return p; });
  act(ps[0], { t: 'opciones', sinYafar: true }); ps.forEach((p) => act(p, { t: 'listo', v: true })); act(ps[0], { t: 'iniciar' });
  const a = ps[0], A = e.jugadores[a], ciudad = data.retos.retos.find((r) => r.id === 'R10').ciudad;
  const turno = (fase) => { e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; A.ciudad = ciudad; e.turno = { pid: a, idx: e.orden.indexOf(a), fase, tramos: 0, ciudadInicio: ciudad, movio: false, llegadas: [], cc: 0, ccBien: 0, ccActual: null, principal: false, gastos: {} }; };
  turno('acciones'); A.dinares = 200;
  assert.ok(act(a, { t: 'reto', id: 'R10' }).ok);
  assert.match(vista(data, e, a).anuncios.find((x) => x.propio).texto, /El reto sigue en curso\./, 'al aceptarlo: en curso');
  e.anuncios = []; turno('mov');
  assert.ok(act(a, { t: 'viajar', destino: 'Bagdad' }).ok);
  const al = vista(data, e, a).anuncios.find((x) => x.propio);
  assert.equal(al?.texto, 'Reto R10 · Llevar papiros a Bagdad:\nJ0 entrega su encargo (R10): +35 dinares +15 noches.\n¡Lo lograste!\nEn total: +35 dinares; +15 noches; entregas 2 × Papiro.');
  assert.equal(al.tono, 'ok');
}
console.log(`desenlace de los retos OK (${vistos.size} retos, ${probados} intentos)`);
