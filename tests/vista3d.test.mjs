// Datos para la capa 3D (shared/vista3d.js):  node tests/vista3d.test.mjs
// La capa 3D solo anima lo que el motor ya decidió; aquí se comprueba que la vista le dice con qué arma, animal y medio de viaje.
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, vista, tick, viajarPropio } from '../shared/engine.js';
import { darItem, ITEMS } from '../shared/base.js';
import { medioDeViaje, vista3d } from '../shared/vista3d.js';
import { vistaCongelada } from '../shared/congelar.js';
import { cargarDatos } from '../server/datos.js';

const data = cargarDatos();
function partida(pjs) {
  const e = nuevoJuego(data, { semilla: 42, ahora: 1000, opciones: {} });
  let now = 1000;
  const act = (pid, a) => { now += 300; return reducir(data, e, pid, a, now); };
  const ids = pjs.map((pj, i) => { const id = unir(e, { nombre: 'J' + i, token: 't' + i }); assert.ok(act(id, { t: 'elegirPj', pj }).ok); return id; });
  for (const id of ids) act(id, { t: 'listo', v: true });
  assert.ok(act(ids[0], { t: 'iniciar' }).ok);
  const asentar = () => { for (let k = 0; k < 60 && (e.pend || e.dados || (!e.turno && e.fase === 'juego')); k++) { now += 100000; tick(data, e, now); } };
  return { e, act, ids, asentar };
}

// El medio de viaje se lee de la línea del registro que escribe viajarPropio: si esa frase cambia, esta prueba avisa.
for (const ref of ['burro', 'caballo', 'camello', 'alfombra', 'caballoMongol']) {
  const nombre = ITEMS[ref].nombre.toLowerCase();
  assert.equal(medioDeViaje(`Jorge viaja de Basra a Bagdad en ${nombre}.`), ref);
  assert.equal(medioDeViaje(`Jorge viaja de Basra a Bagdad en ${nombre} y termina su turno.`), ref);
}
assert.equal(medioDeViaje('Jorge viaja de Bagdad a Damasco (10 dinares).'), null, 'el viaje normal es a pie');
assert.equal(medioDeViaje('Jorge viaja de Bagdad a Damasco.'), null);

{
  const g = partida(['1', '4', '7']); const { e, ids } = g;
  g.asentar();
  const [nur, jamil] = ids;
  const v = vista(data, e, jamil);
  assert.ok(v.e3d && v.e3d.jugadores[nur], 'la vista trae los datos de la capa 3D');
  assert.equal(v.e3d.jugadores[nur].arma, 'cimitarra', 'Nur al Din empieza con cimitarra');
  assert.equal(v.e3d.jugadores[jamil].arma, '', 'Jamil empieza sin armas');
  assert.equal(v.e3d.jugadores[jamil].transporte, null);
  assert.equal(v.e3d.pelea, null);
  assert.deepEqual(vista(data, e, nur).e3d, v.e3d, 'todos ven lo mismo: son datos públicos');

  // Animales: se ve el que lleva; la alfombra va guardada (no cuenta como animal a la vista).
  darItem(e, e.jugadores[jamil], 'alfombra');
  assert.equal(vista3d(data, e).jugadores[jamil].transporte, null);
  darItem(e, e.jugadores[jamil], 'burro');
  assert.equal(vista3d(data, e).jugadores[jamil].transporte, 'burro');
  darItem(e, e.jugadores[jamil], 'caballoMongol');
  assert.equal(vista3d(data, e).jugadores[jamil].transporte, 'caballoMongol');

  // Escudo de cuero (OB04): se le ve a quien lo tiene.
  assert.equal(vista3d(data, e).jugadores[jamil].escudo, false);
  e.jugadores[jamil].mano.push({ uid: 'prueba-escudo', tipo: 'objeto', ref: 'OB04' });
  assert.equal(vista3d(data, e).jugadores[jamil].escudo, true);
  e.jugadores[jamil].mano = e.jugadores[jamil].mano.filter((c) => c.uid !== 'prueba-escudo');

  // Viaje con transporte propio: el motor escribe el medio en el registro y la vista lo entrega con su número de línea.
  const pid = e.turno.pid, j = e.jugadores[pid];
  const destino = j.ciudad === 'Basra' ? 'Bagdad' : 'Basra';
  viajarPropio(data, e, pid, { destino, motivo: ITEMS.burro.nombre.toLowerCase(), termina: false });
  const tras = vista3d(data, e).jugadores[pid];
  assert.equal(tras.viaje?.medio, 'burro', 'el viaje en burro se anima en burro');
  assert.ok(tras.viaje.n > 0);
}

// Pelea en curso: quién ataca, a quién y con qué.
{
  const g = partida(['1', '4', '7']); const { e, act, ids } = g;
  g.asentar();
  const [nur, jamil] = ids;
  for (const id of ids) { e.jugadores[id].ciudad = 'Damasco'; }
  const pid = e.turno.pid;
  if (e.turno.fase === 'ingreso') { act(pid, { t: 'tirarDados' }); g.asentar(); }
  const atk = e.turno.pid, def = atk === nur ? jamil : nur;
  const r = act(atk, { t: 'atacar', tipo: 'duelo', objetivo: def });
  if (r.ok && e.pelea) {
    const v3 = vista3d(data, e), P = v3.pelea;
    assert.equal(P.atk, atk); assert.equal(P.def, def); assert.equal(P.tipo, 'duelo');
    assert.equal(v3.jugadores[nur].armaPelea, 'cimitarra', 'en Damasco Nur al Din pelea con su cimitarra');
    assert.equal(typeof P.n, 'number'); assert.equal(P.viva, true);
    // Con dados por tirar, la vista congelada solo adelanta la pelea (para animar el choque antes de los dados), nada más.
    const antes = vista(data, e, atk);
    e.jugadores[nur].ciudad = 'Bagdad'; if (e.mods) e.mods.armasBagdad = false;
    const despues = vista(data, e, atk);
    const vf = vistaCongelada(antes, despues, new Set([1]));
    assert.equal(vf.e3d.jugadores[nur].armaPelea, 'cimitarra', 'lo demás de la capa 3D sigue como antes de los dados');
    assert.deepEqual(vf.e3d.pelea, despues.e3d.pelea);
    assert.equal(vista3d(data, e).jugadores[nur].armaPelea, '', 'en Bagdad, sin Firmán, se pelea sin armas');
  } else assert.fail('no se pudo armar el duelo de prueba: ' + (r.error || ''));
}
// Luz por turnos (Jorge, 23 de noviembre): el día dura la ronda entera y se reparte entre los jugadores.
{
  const { tramoDeTurno, ALBA, OCASO, NOCHE } = await import('../src/escena3d/ronda.js');
  const cerca = (a, b) => Math.abs(a - b) < 1e-9, deDia = (h) => h > 0.285 && h < 0.715;
  // con 3: el primero ve aclarar, el segundo juega a pleno día y con el tercero atardece y anochece
  const [a, b, c] = [0, 1, 2].map((i) => tramoDeTurno(i, 3));
  assert.ok(cerca(a[0], ALBA) && deDia(a[1]), 'el primero empieza de noche y termina con luz');
  assert.ok(deDia(b[0]) && deDia(b[1]) && b[0] < 0.5 && b[1] > 0.5, 'el segundo tiene el mediodía');
  assert.ok(deDia(c[0]) && cerca(c[1], OCASO), 'el tercero empieza con sol y termina de noche');
  // con 4 o más: los tramos con sol son de todos menos el último, que juega de noche
  for (const n of [4, 5]) {
    assert.ok(cerca(tramoDeTurno(n - 2, n)[1], OCASO), 'el penúltimo ve caer la noche');
    assert.deepEqual(tramoDeTurno(n - 1, n), [OCASO, NOCHE], 'el último juega sin sol');
  }
  // con 6 (Jorge: «con 6 los dos últimos juegan de noche»): el cuarto ve caer la noche y el quinto y el sexto juegan sin sol
  for (const n of [6, 7, 8]) {
    assert.ok(cerca(tramoDeTurno(n - 3, n)[1], OCASO) && deDia(tramoDeTurno(n - 3, n)[0]), 'el antepenúltimo empieza con sol y ve caer la noche');
    assert.ok(cerca(tramoDeTurno(n - 2, n)[0], OCASO) && cerca(tramoDeTurno(n - 1, n)[1], NOCHE), 'los dos últimos juegan sin sol');
  }
  // los tramos se encadenan sin huecos, con cualquier número de jugadores
  for (let n = 1; n <= 8; n++) for (let i = 1; i < n; i++) assert.ok(cerca(tramoDeTurno(i - 1, n)[1], tramoDeTurno(i, n)[0]), `tramos seguidos (${n} jugadores)`);
  assert.deepEqual(tramoDeTurno(0, 1), [ALBA, OCASO], 'uno solo: el día entero');
}
console.log('vista3d OK');
