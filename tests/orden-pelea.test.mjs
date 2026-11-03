// Orden de una pelea vista desde los navegadores (servidor real): primero los dados y el desglose, al final las consecuencias.
//   npm run build && node tests/orden-pelea.test.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { nuevoJuego, unir, reducir, serializar } from '../shared/engine.js';
import { darItem } from '../shared/base.js';
import { cargarDatos } from '../server/datos.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = cargarDatos();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Partida guardada: Ana (cimitarra y destreza) en su turno en Damasco, ronda 4, con Beto (alfanje y destreza). sinYafar: si Beto muere, Ana queda sola.
function guardada(dir, tipo) {
  const e = nuevoJuego(data, { semilla: 77, ahora: Date.now(), opciones: { sinYafar: true } });
  const t = Date.now();
  const a = unir(e, { nombre: 'Ana', token: 'tokA' }), b = unir(e, { nombre: 'Beto', token: 'tokB' });
  reducir(data, e, a, { t: 'elegirPj', pj: '7' }, t); reducir(data, e, b, { t: 'elegirPj', pj: '4' }, t);
  reducir(data, e, a, { t: 'listo', v: true }, t); reducir(data, e, b, { t: 'listo', v: true }, t);
  e.host = a; reducir(data, e, a, { t: 'iniciar' }, t);
  e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.ronda = 4; e.mods = {};
  for (const id of [a, b]) { const j = e.jugadores[id]; j.ciudad = 'Damasco'; j.destreza = true; j.extra.clienteWeb = true; j.mano = j.mano.filter((c) => c.ref !== 'arco'); j.dinares = 50; }
  darItem(e, e.jugadores[a], 'cimitarra'); darItem(e, e.jugadores[b], 'alfanje');
  e.turno = { pid: a, idx: e.orden.indexOf(a), fase: 'mov', tramos: 0, ciudadInicio: 'Damasco', movio: true, llegadas: [], cc: 0, ccBien: 0, ccActual: null, principal: false, gastos: {} };
  fs.writeFileSync(path.join(dir, 'p.json'), serializar(e));
  return { a, b };
}
function arrancar(dir, puerto) {
  const p = spawn(process.execPath, ['server/index.js', '--puerto', String(puerto), '--datos', dir, '--restaurar', path.join(dir, 'p.json'), '--sin-qr', '--solo-local'], { cwd: RAIZ, env: { ...process.env, MUN_CLAVE: '' } });
  let salida = ''; p.stdout.on('data', (d) => { salida += d; }); p.stderr.on('data', (d) => { salida += d; });
  return new Promise((ok, mal) => {
    const iv = setInterval(() => { if (salida.includes('Ctrl+C para detener')) { clearInterval(iv); ok(p); } }, 50);
    setTimeout(() => { clearInterval(iv); mal(new Error(salida)); }, 8000);
  });
}
function cliente(puerto, token) {
  return new Promise((ok) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}/ws`); const c = { ws, s: null, hist: [], errores: [] };
    ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.t === 'estado') { c.s = m.s; c.hist.push(m.s); } if (m.t === 'bienvenida') ok(c); if (m.t === 'error') c.errores.push(m.msg); });
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hola', token })));
    c.a = async (a) => { ws.send(JSON.stringify({ t: 'accion', a })); await dormir(200); };
  });
}

for (const tipo of ['matar', 'robo', 'duelo']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mun-orden-'));
  const { a, b } = guardada(dir, tipo);
  const puerto = 19000 + Math.floor(Math.random() * 900);
  const srv = await arrancar(dir, puerto);
  try {
    const A = await cliente(puerto, 'tokA'), B = await cliente(puerto, 'tokB');
    await dormir(200);
    const din0 = { a: A.s.jugadores[a].dinares, b: A.s.jugadores[b].dinares }, n0 = { a: A.s.jugadores[a].noches, b: A.s.jugadores[b].noches };
    await A.a({ t: 'atacar', tipo, objetivo: b });
    if (B.s.pend?.mia) await B.a({ t: 'decidir', id: B.s.pend.id, opcion: 'luchar' });
    await dormir(200);
    // mientras haya dados, nadie ve consecuencias
    let vueltas = 0;
    while (A.s.dados && vueltas++ < 20) {
      for (const X of [A, B]) {
        const s = X.s;
        assert.equal(s.fase, 'juego', `${tipo}: la partida no termina antes de los dados`);
        assert.ok(!s.jugadores[b].eliminado && !s.jugadores[a].eliminado, `${tipo}: nadie muere antes de los dados`);
        assert.equal(s.jugadores[a].dinares, din0.a, `${tipo}: los dinares no cambian antes de los dados`); assert.equal(s.jugadores[b].dinares, din0.b);
        assert.equal(s.jugadores[a].noches, n0.a); assert.equal(s.jugadores[b].noches, n0.b);
        assert.ok(!s.jugadores[a].herido && !s.jugadores[b].herido, `${tipo}: nadie queda herido antes de los dados`);
        assert.ok(!s.log.some((l) => /muere|roba|pierde el duelo|queda herido|gana por/.test(l.texto)), `${tipo}: el registro no adelanta el resultado`);
      }
      const quien = A.s.dados.por === a ? A : B;
      if (!A.s.dados.lanzado) await quien.a({ t: 'lanzarDados' });
      await dormir(2100);
      await quien.a({ t: 'cerrarDados' });
      await dormir(150);
    }
    assert.ok(!A.s.dados, `${tipo}: se cerraron todos los dados`);
    const cambio = A.s.jugadores[b].eliminado || A.s.jugadores[a].eliminado || A.s.jugadores[a].herido || A.s.jugadores[b].herido || A.s.jugadores[a].dinares !== din0.a || A.s.fase === 'fin' || A.s.log.some((l) => /no se lleva nada|pierde el duelo/.test(l.texto));
    if (!cambio) console.log(tipo, A.errores, B.errores, A.s.log.length, A.s.turno);
    assert.ok(cambio, `${tipo}: al final sí se ven las consecuencias`);
    A.ws.close(); B.ws.close();
  } finally { srv.kill(); }
}
console.log('orden-pelea.test.mjs OK');
