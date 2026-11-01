// Estadísticas por personaje a partir de partidas simuladas con los bots aleatorios de tests/sim.mjs.
//   node tools/estadisticas-personajes.mjs [partidas_por_config=300]
// Ojo: los bots eligen acciones al azar; los números describen el personaje con juego «promedio», no con estrategia experta.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Copia de sim.mjs que conserva el registro completo (el motor solo guarda los últimos 300 mensajes).
const fuente = fs.readFileSync(path.join(RAIZ, 'tests', 'sim.mjs'), 'utf8')
  .replace("let e = nuevoJuego(data, { semilla, ahora: 1000, opciones: { rapido, dificultad } });",
    "let e = nuevoJuego(data, { semilla, ahora: 1000, opciones: { rapido, dificultad } }); const todo = []; const _push = e.log.push.bind(e.log); e.log.push = (...x) => { todo.push(...x); return _push(...x); };")
  .replace(/return \{ ok: e\.fase === 'fin'/, "return { todo, ok: e.fase === 'fin'")
  .replace(/if \(process\.argv\[1\][\s\S]*$/, '');
const tmp = path.join(RAIZ, 'tests', `_sim-estadisticas-${process.pid}.mjs`);
fs.writeFileSync(tmp, fuente);
let simular;
try { ({ simular } = await import(pathToFileURL(tmp).href)); } finally { fs.rmSync(tmp, { force: true }); }

const N = Number(process.argv[2] || 300);
const NOMBRES = { 1: 'Nur al Din', 2: 'Zein', 3: 'Anís', 4: 'Jamil', 5: 'Ruyán', 6: 'Zubayda', 7: 'Adí', B: 'Yafar (jugador)' };
const est = {};
const s = (pj) => (est[pj] ||= { partidas: 0, victorias: 0, eliminado: 0, nochesRonda: 0, dinares: 0, robosHechos: 0, robado: 0, duelosG: 0, duelosP: 0, premios: 0, rondas: 0 });
let terminadas = 0, total = 0;
for (const [i, cfg] of [{ jugadores: 4 }, { jugadores: 3, conYafar: false }, { jugadores: 5 }].entries()) {
  for (let k = 0; k < N; k++) {
    total++;
    const r = simular({ ...cfg, semilla: 100000 * (i + 1) + k });
    if (!r.ok) continue;
    terminadas++;
    const { e, todo } = r;
    for (const j of Object.values(e.jugadores)) {
      if (j.npc || !j.pj) continue;
      const x = s(j.pj), n = j.nombre;
      x.partidas++; x.rondas += e.ronda;
      if ((e.ganadores || []).includes(j.id)) x.victorias++;
      if (j.eliminado) x.eliminado++;
      x.nochesRonda += j.noches / Math.max(1, e.ronda); x.dinares += j.dinares;
      for (const l of todo) {
        const t = l.texto || '';
        if (t.startsWith(n + ' roba ')) x.robosHechos++;
        if (t.includes(' roba ') && t.endsWith(' a ' + n + '.')) x.robado++;
        if (t.startsWith(n + ' gana el duelo')) x.duelosG++;
        if (t.includes(': ' + n + ' entrega ')) x.duelosP++;
        if (l.pid === j.id && /\+\d+ (dinares|noches)\.$/.test(t)) x.premios++;
      }
    }
  }
}
const f = (v, d = 1) => v.toFixed(d);
console.log(`Partidas terminadas: ${terminadas}/${total} (bots al azar)\n`);
console.log('Personaje        | partidas | victoria | eliminado | noches/ronda | dinares final | robos hechos | robado | duelos G/P | premios retos/tesoros');
for (const [pj, x] of Object.entries(est).sort()) {
  const p = x.partidas;
  console.log(`${(NOMBRES[pj] || pj).padEnd(16)} | ${String(p).padStart(8)} | ${f(100 * x.victorias / p).padStart(7)}% | ${f(100 * x.eliminado / p).padStart(8)}% | ${f(x.nochesRonda / p).padStart(12)} | ${f(x.dinares / p, 0).padStart(13)} | ${f(x.robosHechos / p, 2).padStart(12)} | ${f(x.robado / p, 2).padStart(6)} | ${f(x.duelosG / p, 2)}/${f(x.duelosP / p, 2)} | ${f(x.premios / p, 2)}`);
}
