// Partida de muestra con los ocho personajes (Jorge, 24 de noviembre de 2026: «arma una partida local para poder ver a todos los
// personajes»). La arma el propio motor, sin tocar el estado a mano: ocho jugadores entran, cada uno elige un personaje, todos marcan
// «listo» y el banco inicia. Se prueba la semilla hasta que el primer turno sea de Jorge, para que al abrirla ya pueda jugar.
// Uso: node tools/partida-personajes.mjs [<salida.json>]      (por defecto, datos-personajes/partida.json)
// Se abre con:  node server/index.js --puerto 8081 --datos datos-personajes
// Para mover a otro personaje: ventana de incógnito y entrar con su nombre de jugador (el servidor lo reconoce por el nombre).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nuevoJuego, unir, reducir, serializar } from '../shared/engine.js';
import { cargarDatos } from '../server/datos.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.resolve(process.argv[2] || path.join(RAIZ, 'datos-personajes', 'partida.json'));
const data = cargarDatos();
// jugador → personaje (1 Nur al Din, 2 Zein, 3 Anís, 4 Jamil, 5 Ruyán, 6 Zubayda, 7 Adí, B Yafar)
const MESA = [['Jorge', '1'], ['Carolina', '6'], ['Papá Jorge', '5'], ['Mamá Isabel', '2'], ['Abuelo Fabi', '7'], ['Jugador 6', '3'], ['Jugador 7', '4'], ['Jugador 8', 'B']];

for (let semilla = 1; semilla < 5000; semilla++) {
  const e = nuevoJuego(data, { codigo: 'MIL8', semilla, ahora: Date.now() });
  let ahora = e.ahora;
  const act = (pid, a) => { ahora += 300; const r = reducir(data, e, pid, a, ahora); if (!r.ok) throw new Error(`${a.t}: ${r.error}`); };
  const ids = MESA.map(([nombre, pj], i) => { const id = unir(e, { nombre, token: 'muestra-' + i }); e.jugadores[id].conectado = true; act(id, { t: 'elegirPj', pj }); return id; });
  for (const id of ids) act(id, { t: 'listo', v: true });
  act(ids[0], { t: 'iniciar' });
  if (e.turno?.pid !== ids[0] || e.pend || e.colaPend.length) continue;      // que empiece Jorge y sin carta de ronda pendiente
  for (const j of Object.values(e.jugadores)) { j.conectado = false; j.token = null; }      // nadie está sentado todavía: cada quien entra con su nombre
  fs.mkdirSync(path.dirname(salida), { recursive: true }); fs.writeFileSync(salida, serializar(e));
  console.log('Partida de muestra en', salida, '· semilla', semilla, '· orden:', e.orden.map((id) => `${e.jugadores[id].nombre} (${data.personajes.personajes.find((p) => p.id === e.jugadores[id].pj).nombre})`).join(', '));
  process.exit(0);
}
console.error('No salió ninguna semilla en la que empiece Jorge.'); process.exit(1);
