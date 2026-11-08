// Mensajes ligeros (shared/delta.js): en partidas simuladas, después de cada acción, la vista que el cliente arma juntando los mensajes
// reducidos es idéntica a la vista completa; al reconectarse (memoria nueva) recibe todo. Además mide el peso de los mensajes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { vista } from '../shared/engine.js';
import { cargarDatos } from '../server/datos.js';
import { nuevaMemoria, reducirVista, aplicarDelta } from '../shared/delta.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fuente = fs.readFileSync(path.join(RAIZ, 'tests', 'sim.mjs'), 'utf8')
  .replace('const act = (pid, a) => { now += 250; return reducir(data, e, pid, a, now); };', 'const act = (pid, a) => { now += 250; const r = reducir(data, e, pid, a, now); globalThis.__trasAccion?.(e); return r; };')
  .replace(/if \(process\.argv\[1\][\s\S]*$/, '');
assert.ok(fuente.includes('globalThis.__trasAccion'), 'no se pudo instrumentar la simulación');
const tmp = path.join(RAIZ, 'tests', `_sim-delta-${process.pid}.mjs`);
fs.writeFileSync(tmp, fuente);
let simular;
try { ({ simular } = await import(pathToFileURL(tmp).href)); } finally { fs.rmSync(tmp, { force: true }); }
const data = cargarDatos();
const quitarDinamicos = (v) => { const { ahora, ...r } = v; return r; };

const medir = process.argv.includes('--medir');
let total = { completo: 0, ligero: 0, n: 0 }, mitad = { completo: 0, ligero: 0, n: 0 }, comparaciones = 0;
for (const semilla of medir ? [21, 22, 23] : [21]) {
  const mem = {}, cliente = {};
  let pasos = 0;
  globalThis.__trasAccion = (e) => {
    if (e.fase !== 'juego') return;
    pasos++;
    for (const pid of Object.keys(e.jugadores)) {
      const j = e.jugadores[pid]; if (j.npc || !j.pj) continue;
      if (pasos % 97 === 0 && pid === Object.keys(e.jugadores)[0]) { mem[pid] = nuevaMemoria(); cliente[pid] = null; }   // reconexión a media partida
      const v = vista(data, e, pid);
      const msj = reducirVista(v, (mem[pid] ||= nuevaMemoria()));
      const kbC = JSON.stringify(v).length, kbL = JSON.stringify(msj).length;
      total.completo += kbC; total.ligero += kbL; total.n++;
      if (e.ronda >= 7 && e.ronda <= 9) { mitad.completo += kbC; mitad.ligero += kbL; mitad.n++; }
      cliente[pid] = aplicarDelta(cliente[pid], JSON.parse(JSON.stringify(msj)));
      if (medir && pasos % 5) continue;
      assert.deepEqual(quitarDinamicos(cliente[pid]), quitarDinamicos(JSON.parse(JSON.stringify(v))), `la vista armada por el cliente es idéntica (semilla ${semilla}, paso ${pasos}, ${pid})`);
      comparaciones++;
    }
  };
  const r = simular({ jugadores: 6, semilla, maxPasos: medir ? 60000 : 3000 });
  assert.ok(r.ok || r.motivo === 'maxPasos', r.motivo);
}
globalThis.__trasAccion = null;
const kb = (x) => (x / 1024).toFixed(1);
if (medir) {
  console.log(`Todos los mensajes (6 jugadores): completo ${kb(total.completo / total.n)} KB promedio, ligero ${kb(total.ligero / total.n)} KB promedio (${total.n} mensajes)`);
  console.log(`A media partida (rondas 7 a 9): completo ${kb(mitad.completo / Math.max(1, mitad.n))} KB, ligero ${kb(mitad.ligero / Math.max(1, mitad.n))} KB por mensaje y jugador`);
}
console.log(`delta OK (${comparaciones} vistas comparadas, incluida reconexión)`);
