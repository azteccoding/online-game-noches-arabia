// Estadísticas por personaje a partir de partidas simuladas con los bots aleatorios de tests/sim.mjs.
//   node tools/estadisticas-personajes.mjs [partidas_por_config=300]
// Ojo: los bots eligen acciones al azar; los números describen el personaje con juego «promedio», no con estrategia experta.
// Cuatro configuraciones con semillas fijas (100000·i + k): 4 jugadores (uno lleva a Yafar), 3 con Yafar NPC, 5 jugadores (uno lleva
// a Yafar) y 3 sin Yafar NPC. Al llegar a 1,001 noches el bot elige siempre «Ganar ya», para que las partidas terminen como antes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Copia de sim.mjs que conserva el registro completo (el motor solo guarda los últimos 300 mensajes).
const fuente = fs.readFileSync(path.join(RAIZ, 'tests', 'sim.mjs'), 'utf8')
  .replace(/let e = nuevoJuego\(data, \{.*\}\);/, (m) => m + " const todo = []; const _push = e.log.push.bind(e.log); e.log.push = (...x) => { todo.push(...x); return _push(...x); };")
  .replace(/return \{ ok: e\.fase === 'fin'/, "return { todo, ok: e.fase === 'fin'")
  // «Ganar ya» siempre al llegar a 1,001 (la decisión llega como un pendiente de tipo 'meta')
  .replace("if (!a) { const dis = p.opciones.filter((o) => !o.desactivada); a = { t: 'decidir', id: p.id, opcion: pick(dis).id }; }",
    "if (!a && p.tipo === 'meta') a = { t: 'decidir', id: p.id, opcion: 'ganar' }; if (!a) { const dis = p.opciones.filter((o) => !o.desactivada); a = { t: 'decidir', id: p.id, opcion: pick(dis).id }; }")
  // cuenta los retos por número
  .replace("cuenta(stats.acciones, a.t + (a.sub ? ':' + a.sub : '') + ':' + (r.ok ? 'ok' : 'x'));",
    "cuenta(stats.acciones, a.t + (a.t === 'reto' ? ':' + a.id : '') + (a.sub ? ':' + a.sub : '') + ':' + (r.ok ? 'ok' : 'x')); if (r.ok && a.t === 'comprar' && (a.id === 'OB21' || a.ref === 'OB21')) cuenta(stats.acciones, 'pastel:comprado');")
  .replace(/if \(process\.argv\[1\][\s\S]*$/, '');
if (!fuente.includes("p.tipo === 'meta'") || !fuente.includes("a.t === 'reto' ? ':' + a.id")) throw new Error('No pude adaptar tests/sim.mjs (cambió su código).');
const tmp = path.join(RAIZ, 'tests', `_sim-estadisticas-${process.pid}.mjs`);
fs.writeFileSync(tmp, fuente);
let simular;
try { ({ simular } = await import(pathToFileURL(tmp).href)); } finally { fs.rmSync(tmp, { force: true }); }

const N = Number(process.argv[2] || 300);
const NOMBRES = { 1: 'Nur al Din', 2: 'Zein', 3: 'Anís', 4: 'Jamil', 5: 'Ruyán', 6: 'Zubayda', 7: 'Adí', B: 'Yafar (jugador)' };
const CONFIGS = [
  { cfg: { jugadores: 4 }, etq: '4 jugadores (uno lleva a Yafar)' },
  { cfg: { jugadores: 3, conYafar: false }, etq: '3 con Yafar NPC' },
  { cfg: { jugadores: 5 }, etq: '5 jugadores (uno lleva a Yafar)' },
  { cfg: { jugadores: 3, conYafar: false, sinYafar: true }, etq: '3 sin Yafar NPC' },
];
const est = {}, porCfg = {};
const nuevo = () => ({ partidas: 0, victorias: 0, eliminado: 0, nochesRonda: 0, noches: 0, dinares: 0, robosHechos: 0, robado: 0, duelosG: 0, duelosP: 0, premios: 0, rondas: 0 });
const s = (pj) => (est[pj] ||= nuevo());
const sc = (cfg, pj) => ((porCfg[cfg] ||= {})[pj] ||= nuevo());
const C = {}; const inc = (k, n = 1) => { C[k] = (C[k] || 0) + n; };
const cfgRes = {};   // por configuración: partidas, ganadas por jugador, por Yafar NPC, sin ganador, rondas
const retosIntentos = {}, retosHechos = {}, viajes = {};
let terminadas = 0, total = 0, lamparas = 0, conMongol = 0, conForja = 0, conYegua = 0, conYeguaEst = 0; let negFin = 0;
const bot = {};   // compras útiles, debilidades aprovechadas y fortalezas usadas por los bots (tests/sim.mjs)
const NPC_NOMBRE = 'Yafar el Bermekí (NPC)';
const npcRes = {};   // Yafar NPC por dificultad
function medirNPC(dif, r) {
  const X = (npcRes[dif] ||= { partidas: 0, gana: 0, llega1001: 0, ultimo: 0, eliminado: 0, noches: 0, dinares: 0, robos: 0, robado: 0, duelosG: 0, duelosP: 0, burros: 0, mongoles: 0, compras: 0, rondas: 0 });
  const { e, todo } = r, j = e.jugadores.npc; if (!j) return;
  X.partidas++; X.rondas += e.ronda; if (e.derrota === 'npc') X.gana++; if (j.eliminado) X.eliminado++; X.noches += j.noches; X.dinares += j.dinares;
  for (const l of todo) { const t = l.texto || '';
    if (t.startsWith('Yafar NPC llega')) X.llega1001++;
    if (t === 'Yafar NPC es el último en pie: gana la partida.') X.ultimo++;
    if (t.startsWith(NPC_NOMBRE + ' roba ')) X.robos++;
    if (t.includes(' roba ') && t.endsWith(' a ' + NPC_NOMBRE + '.')) X.robado++;
    if (t.startsWith(NPC_NOMBRE + ' gana el duelo')) X.duelosG++;
    if (t.includes(': ' + NPC_NOMBRE + ' entrega ')) X.duelosP++;
    if (l.pid === 'npc' && / compra un burro/.test(t)) X.burros++;
    if (l.pid === 'npc' && / compra un caballo mongol /.test(t)) X.mongoles++;
    if (l.pid === 'npc' && / compra /.test(t)) X.compras++; }
}
const REG = [   // [clave, prueba sobre el texto del registro]
  ['R1 cofre hallado', (t) => t === '¡Encuentras el cofre!'],
  ['R1 abandono (sin cofre, debe el alojamiento)', (t) => t.startsWith('No hay cofre: abandonas la búsqueda')],
  ['R1 sin cofre, repite el turno siguiente', (t) => t.startsWith('Sin cofre por hoy')],
  ['R23 bandoleros asaltan', (t) => t.includes('Bandoleros asaltan la caravana')],
  ['R23 bandoleros apartados por la bendición', (t) => t.startsWith('Asoman bandoleros, pero la bendición')],
  ['Pierde ante los bandoleros (R32 del paso y R23)', (t) => / pierde ante los bandoleros\.$/.test(t)],
  ['R26 pasa la noche con Zein (premio)', (t) => / pasa la noche con Zein:/.test(t)],
  ['R26 el esposo los sorprende', (t) => t.includes('El esposo los sorprende')],
  ['R26 Anís escapa por la ventana', (t) => t.includes('Anís se escapa por la ventana')],
  ['R26 vence al esposo', (t) => / vence al esposo de Zein:/.test(t)],
  ['R26 pierde ante el esposo', (t) => / pierde ante el esposo: /.test(t)],
  ['R53 cumplido (primera venta de dátiles)', (t) => / cumple el reto R53 /.test(t)],
  ['Almudes de dátiles vendidos', (t) => / vende un almud de dátiles en /.test(t)],
  ['R54 impar: herido, 25 noches y 5 dinares', (t) => t.startsWith('Impar: quedas herido, pero ganas 25 noches')],
  ['R54 par: entrenado (o noches) y 10 noches', (t) => t.startsWith('Par: sales sin heridas')],
  ['R54 la batalla sigue: pierde el turno', (t) => / la batalla sigue; tu siguiente turno/.test(t)],
  ['R55 empieza a investigar', (t) => / empieza a investigar el fuego griego/.test(t)],
  ['R55 termina: nuevo polímata', (t) => / ya es polímata\.$/.test(t)],
  ['Polímata cobra +12 dinares', (t) => /, polímata, cobra /.test(t)],
  ['Escorbuto: herido por no llevar cítricos', (t) => / queda herido por escorbuto\.$/.test(t)],
  ['Escorbuto: sin cítricos pero ya estaba herido', (t) => / no llevaba cítricos .* pero ya estaba herido\.$/.test(t)],
  ['Cítricos comidos en un viaje por mar', (t) => / come sus cítricos .* no le da escorbuto\.$/.test(t)],
  ['Shatranj comprados (India)', (t) => / compra un Shatranj \(ajedrez\)/.test(t)],
  ['Shatranj vendidos (se esfuman)', (t) => / vende un Shatranj \(ajedrez\)/.test(t)],
  ['Burros comprados', (t) => / compra un burro/.test(t)],
  ['Caballos mongoles comprados', (t) => / compra un caballo mongol /.test(t)],
  ['R50 yeguas compradas en Samarcanda (compras)', (t) => / yeguas? de la estepa en Samarcanda por /.test(t)],
  ['Yeguas vendidas en Estambul', (t) => / vende una yegua de la estepa al mercado de Estambul/.test(t)],
  ['Atacar a Zein o a Zubayda: Buscado', (t) => / atacó a .+ \((Zein|Zubayda)\): queda Buscado durante /.test(t)],
  ['Zein recibe su mahr (dote)', (t) => / recibe su mahr \(dote\)/.test(t)],
  ['Zubayda renta su cuerpo (pasan la noche juntos)', (t) => / y .+ pasan la noche juntos\.$/.test(t)],
  ['Apedreo: tira 30 dinares y se libra', (t) => / lanza 30 dinares y se libra del linchamiento/.test(t)],
  ['Apedreo: herida y Buscada', (t) => / queda herido por las pedradas/.test(t)],
  ['Zein no paga alojamiento en Andalucía', (t) => / no paga alojamiento en Andalucía\.$/.test(t)],
  ['Zein llega a El Cairo: sus dados duran 7', (t) => / llega a El Cairo con sus Dados del Cairo: en vez de 5/.test(t)],
  ['Un ifrit se robó los Dados del Cairo', (t) => /^Un ifrit se robó los Dados del Cairo /.test(t)],
  ['R52 empieza a forjar', (t) => / empieza a forjar acero de Damasco/.test(t)],
  ['R52 termina: recibe su cimitarra', (t) => / termina de forjar su acero de Damasco/.test(t)],
  ['R52 primero en forjar (abre la venta de cimitarras)', (t) => / termina de forjar su acero de Damasco: .* por ser el primero/.test(t)],
  ['R52 pierde el acero a medio forjar', (t) => / pierde su acero a medio forjar/.test(t)],
  ['Llegadas a 1,001 noches', (t) => /^¡.+ llega a las 1,001 noches!$/.test(t)],
  ['Ganar ya (gana con 1,001)', (t) => / gana la partida con 1,001 noches\.$/.test(t)],
  ['Seguir jugando con 1,001', (t) => / decide seguir jugando con sus 1,001 noches/.test(t)],
  ['Último en pie (jugador)', (t) => / es el último en pie y gana la partida\.$/.test(t)],
  ['Yafar NPC último en pie', (t) => t === 'Yafar NPC es el último en pie: gana la partida.'],
  ['Yafar NPC llega a 1,001', (t) => t.startsWith('Yafar NPC llega')],
  ['Líneas del registro sobre el servicio del Emir', (t) => /Emir/.test(t) && / sirve | al servicio /.test(t)],
  ['R56 entregas de pistaches en Bagdad', (t) => / costales? de pistaches en Bagdad y cobra \d+ dinares\.$/.test(t)],
  ['R56 primero en traer la cosecha (+60 noches)', (t) => / es el primero en traer la cosecha de pistaches/.test(t)],
  ['Pasteles usados: guardia de R28', (t) => / convence al guardia con un pastel de pistaches\.$/.test(t)],
  ['Pasteles usados: capitán de R31', (t) => / convence al capitán de la guardia con un pastel de pistaches\.$/.test(t)],
  ['Pasteles usados: guardia del camino (peaje)', (t) => / pasa al guardia del camino con un pastel de pistaches\.$/.test(t)],
  ['Pasteles usados: guardias de Toledo (R41)', (t) => / distrae a los guardias de Toledo con un pastel/.test(t)],
  ['Vino: botellas compradas', (t) => / compra (\d+ )?Botella de vino\.$/.test(t)],
  ['Vino: botellas vendidas (se esfuman)', (t) => / vende una botella de vino en .+ por \d+ dinares; la botella se esfuma\.$/.test(t)],
  ['Alojamientos cobrados', (t) => / paga \d+ dinares? de alojamiento/.test(t)],
];
const EXTRA = { costales: 0, ingresoPist: 0, vinoVentas: [], partidasPist: 0 };
for (const [i, { cfg, etq }] of CONFIGS.entries()) {
  const R = (cfgRes[etq] ||= { partidas: 0, terminadas: 0, jugador: 0, npc: 0, nadie: 0, rondas: [], noches: 0, dinares: 0, humanos: 0 });
  for (let k = 0; k < N; k++) {
    total++; R.partidas++;
    const r = simular({ ...cfg, semilla: 100000 * (i + 1) + k });
    if (!r.ok) continue;
    terminadas++; R.terminadas++;
    const { e, todo, stats } = r;
    if (e.lampara) lamparas++;
    for (const j of Object.values(e.jugadores)) if (j.pj && j.noches < 0) negFin++;
    if (todo.some((l) => / compra un caballo mongol /.test(l.texto || ''))) conMongol++;
    if (todo.some((l) => / yeguas? de la estepa en Samarcanda por /.test(l.texto || ''))) conYegua++;
    if (todo.some((l) => / vende una yegua de la estepa al mercado de Estambul/.test(l.texto || ''))) conYeguaEst++;
    if (todo.some((l) => / termina de forjar su acero de Damasco/.test(l.texto || ''))) conForja++;
    R.rondas.push(e.ronda);
    if (todo.some((l) => / es el primero en traer la cosecha de pistaches/.test(l.texto || ''))) EXTRA.partidasPist++;
    if ((e.ganadores || []).length) R.jugador++; else if (e.derrota === 'npc') R.npc++; else R.nadie++;
    if (cfg.conYafar === false && !cfg.sinYafar) medirNPC('normal', r);
    for (const [key, n] of Object.entries(stats.acciones)) {
      if (/^(util|utilVende|explota|fortaleza|buscadoMujer|pastel):/.test(key)) bot[key] = (bot[key] || 0) + n;
      const m = key.match(/^reto:(R\d+)(?::[^:]+)?:(ok|x)$/);
      if (m) { const o = (retosIntentos[m[1]] ||= { ok: 0, x: 0 }); o[m[2]] += n; }
    }
    for (const l of todo) {
      const t = l.texto || '';
      for (const [key, f] of REG) if (f(t)) inc(key);
      let m = t.match(/ entrega (\d+) costales? de pistaches en Bagdad y cobra (\d+) dinares\.$/); if (m) { EXTRA.costales += +m[1]; EXTRA.ingresoPist += +m[2]; }
      m = t.match(/ vende una botella de vino en .+ por (\d+) dinares; la botella se esfuma\.$/); if (m) EXTRA.vinoVentas.push(+m[1]);
      const v = t.match(/ viaja de .+ a .+ en (.+?)( y termina su turno)?\.$/);
      if (v) viajes[v[1]] = (viajes[v[1]] || 0) + 1;
    }
    for (const j of Object.values(e.jugadores)) {
      if (j.npc || !j.pj) continue;
      for (const id of j.retosHechos || []) retosHechos[id] = (retosHechos[id] || 0) + 1;
      R.humanos++; R.noches += j.noches; R.dinares += j.dinares;
      const xs = [s(j.pj), sc(etq, j.pj)], n = j.nombre;
      for (const x of xs) {
      x.partidas++; x.rondas += e.ronda;
      if ((e.ganadores || []).includes(j.id)) x.victorias++;
      if (j.eliminado) x.eliminado++;
      x.nochesRonda += j.noches / Math.max(1, e.ronda); x.noches += j.noches; x.dinares += j.dinares;
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
}
// Yafar NPC en fácil y difícil: 300 partidas más de cada una, con las mismas semillas que «3 con Yafar NPC» (que es la normal)
for (const dif of ['facil', 'dificil']) for (let k = 0; k < N; k++) { const r = simular({ jugadores: 3, conYafar: false, dificultad: dif, semilla: 200000 + k }); if (r.ok) medirNPC(dif, r); }
const f = (v, d = 1) => v.toFixed(d);
console.log(`Partidas terminadas: ${terminadas}/${total} (bots al azar; «Ganar ya» siempre al llegar a 1,001)
Lámpara mágica encontrada en ${f(100 * lamparas / Math.max(1, terminadas))}% de las partidas
Jugadores que terminan con noches negativas: ${negFin}
Partidas en que alguien fue por yeguas (R50): ${conYegua} (${f(100 * conYegua / Math.max(1, terminadas))}%); en que una yegua llegó a Estambul: ${conYeguaEst} (${f(100 * conYeguaEst / Math.max(1, terminadas))}%); en que alguien compró un caballo mongol: ${conMongol} (${f(100 * conMongol / Math.max(1, terminadas))}%); en que alguien terminó de forjar (R52): ${conForja} (${f(100 * conForja / Math.max(1, terminadas))}%)
`);
function tabla(est) {
console.log('Personaje        | partidas | victoria | eliminado | noches/ronda | noches final | dinares final | robos hechos | robado | duelos G/P | premios retos/tesoros');
for (const [pj, x] of Object.entries(est).sort()) {
  const p = x.partidas;
  console.log(`${(NOMBRES[pj] || pj).padEnd(16)} | ${String(p).padStart(8)} | ${f(100 * x.victorias / p).padStart(7)}% | ${f(100 * x.eliminado / p).padStart(8)}% | ${f(x.nochesRonda / p).padStart(12)} | ${f(x.noches / p, 0).padStart(12)} | ${f(x.dinares / p, 0).padStart(13)} | ${f(x.robosHechos / p, 2).padStart(12)} | ${f(x.robado / p, 2).padStart(6)} | ${f(x.duelosG / p, 2)}/${f(x.duelosP / p, 2)} | ${f(x.premios / p, 2)}`);
}
}
tabla(est);
for (const [etq, t] of Object.entries(porCfg)) { const R = cfgRes[etq], rs = R.rondas; console.log(`
--- ${etq}: ${R.terminadas}/${R.partidas} partidas, ${f(rs.reduce((a, b) => a + b, 0) / rs.length)} rondas de media (mín. ${Math.min(...rs)}, máx. ${Math.max(...rs)}); ganadas por un jugador ${R.jugador}, por Yafar NPC ${R.npc}, sin ganador ${R.nadie}; noches medias al final ${f(R.noches / R.humanos, 0)}, dinares ${f(R.dinares / R.humanos, 0)}`); tabla(t); }
const G = Object.values(cfgRes).reduce((a, R) => ({ j: a.j + R.jugador, n: a.n + R.npc, z: a.z + R.nadie, no: a.no + R.noches, di: a.di + R.dinares, h: a.h + R.humanos }), { j: 0, n: 0, z: 0, no: 0, di: 0, h: 0 });
console.log(`
=== Total: ganadas por un jugador ${G.j}, por Yafar NPC ${G.n}, sin ganador ${G.z}; noches medias al final ${f(G.no / G.h, 0)}, dinares ${f(G.di / G.h, 0)}`);
const num = (id) => Number(id.slice(1));
console.log('\n=== Retos: intentos (acción aceptada / rechazada) y jugadores que lo tienen hecho al final (R52 se puede repetir y el juego no lo marca como hecho: ver «R52 termina» abajo)');
for (const id of [...new Set([...Object.keys(retosIntentos), ...Object.keys(retosHechos)])].sort((a, b) => num(a) - num(b))) {
  const o = retosIntentos[id] || { ok: 0, x: 0 };
  console.log(`${id.padEnd(4)} intentos ${String(o.ok).padStart(6)} | rechazados ${String(o.x).padStart(6)} | hechos ${String(retosHechos[id] || 0).padStart(6)}`);
}
console.log('\n=== Viajes propios por transporte');
for (const [k, v] of Object.entries(viajes).sort((a, b) => b[1] - a[1])) console.log(`${k.padEnd(28)} ${v}`);
console.log('\n=== Otras cifras del registro');
for (const [k] of REG) console.log(`${k.padEnd(52)} ${C[k] || 0}`);
const grupo = (pre, titulo) => {
  console.log('\n=== ' + titulo);
  const ks = Object.keys(bot).filter((k) => k.startsWith(pre + ':')).sort((a, b) => bot[b] - bot[a]);
  for (const k of ks) console.log(`${k.slice(pre.length + 1).padEnd(64)} ${bot[k]}`);
  if (!ks.length) console.log('(ninguna)');
};
grupo('util', 'Compras útiles de los bots (artefactos para retos y reglas; ok = comprado, x = rechazado)');
grupo('utilVende', 'Ventas útiles de los bots (Shatranj y dátiles)');
grupo('explota', 'Debilidades ajenas aprovechadas');
grupo('fortaleza', 'Fortalezas propias usadas');
grupo('buscadoMujer', 'Quedan Buscados por atacar a Zein o a Zubayda (víctima · tipo de ataque; solo jugadores bot)');
console.log('\n=== Pistaches (R56), pasteles y vino');
const med = (xs) => xs.length ? f(xs.reduce((a, b) => a + b, 0) / xs.length, 1) : '—';
console.log(`Partidas en que alguien entregó pistaches: ${EXTRA.partidasPist}/${terminadas}`);
console.log(`Costales entregados: ${EXTRA.costales}; dinares cobrados por pistaches: ${EXTRA.ingresoPist} (media por entrega ${f(EXTRA.ingresoPist / Math.max(1, C['R56 entregas de pistaches en Bagdad'] || 0), 1)})`);
console.log(`Pasteles de pistaches comprados (bots): ${bot['pastel:comprado'] || 0}`);
console.log(`Vino: ${C['Vino: botellas compradas'] || 0} compradas, ${EXTRA.vinoVentas.length} vendidas y esfumadas; valor medio de venta ${med(EXTRA.vinoVentas)} dinares (mín ${EXTRA.vinoVentas.length ? Math.min(...EXTRA.vinoVentas) : '—'}, máx ${EXTRA.vinoVentas.length ? Math.max(...EXTRA.vinoVentas) : '—'})`);
console.log('\n=== Yafar NPC por dificultad (3 jugadores con Yafar NPC; fácil y difícil son 300 partidas extra cada una)');
console.log('Dificultad | partidas | gana | llega a 1,001 | último en pie | eliminado | noches final | dinares final | robos hechos | le roban | duelos G/P | burros | mongoles | compras | rondas');
for (const dif of ['facil', 'normal', 'dificil']) { const X = npcRes[dif]; if (!X) continue; const p = X.partidas;
  console.log(`${dif.padEnd(10)} | ${String(p).padStart(8)} | ${f(100 * X.gana / p).padStart(4)}% | ${String(X.llega1001).padStart(13)} | ${String(X.ultimo).padStart(13)} | ${f(100 * X.eliminado / p).padStart(8)}% | ${f(X.noches / p, 0).padStart(12)} | ${f(X.dinares / p, 0).padStart(13)} | ${f(X.robos / p, 2).padStart(12)} | ${f(X.robado / p, 2).padStart(8)} | ${f(X.duelosG / p, 2)}/${f(X.duelosP / p, 2)} | ${f(X.burros / p, 2).padStart(6)} | ${f(X.mongoles / p, 2).padStart(8)} | ${f(X.compras / p, 2).padStart(7)} | ${f(X.rondas / p, 1)}`); }
