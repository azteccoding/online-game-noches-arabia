// Datos para la capa 3D (shared/vista3d.js):  node tests/vista3d.test.mjs
// La capa 3D solo anima lo que el motor ya decidió; aquí se comprueba que la vista le dice con qué arma, animal y medio de viaje.
import assert from 'node:assert/strict';
import { nuevoJuego, unir, reducir, vista, tick, viajarPropio } from '../shared/engine.js';
import { darItem, ITEMS } from '../shared/base.js';
import { medioDeViaje, vista3d, laudDeLinea } from '../shared/vista3d.js';
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

// Tocar el laúd (solo Jamil, solo en el 3D): la vista entrega la última línea «… toca el laúd en …» con su número.
assert.ok(laudDeLinea({ pid: 'p1', n: 7, texto: 'Jorge toca el laúd en Bagdad: gana 1 noche y 1 dinar.' }));
assert.equal(laudDeLinea({ pid: 'p1', n: 7, texto: 'Jorge le canta versos de sátira a Carolina.' }), null);
assert.equal(laudDeLinea({ n: 7, texto: 'Jorge toca el laúd en Bagdad: gana 1 noche y 1 dinar.' }), null, 'sin jugador no cuenta');
{
  const g = partida(['4', '7']); const { e, ids } = g; g.asentar();
  const [jamil, adi] = ids;
  assert.equal(vista3d(data, e).jugadores[jamil].laud, null, 'todavía no ha tocado');
  e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = [];
  e.turno = { pid: jamil, idx: e.orden.indexOf(jamil), fase: 'acciones', tramos: 0, ciudadInicio: e.jugadores[jamil].ciudad, movio: false, llegadas: [], cc: 0, ccBien: 0, ccActual: null, principal: false, gastos: {} };
  assert.ok(g.act(jamil, { t: 'pj', sub: 'laud' }).ok);
  const L = vista(data, e, adi).e3d.jugadores[jamil].laud;
  assert.ok(L && typeof L.n === 'number' && /toca el laúd/.test(L.texto), 'todos ven que Jamil tocó');
  assert.equal(vista3d(data, e).jugadores[adi].laud, null);
  assert.equal(L.callado, false, 'nadie lo ha callado'); assert.ok(e.votoLaud, 'con otro jugador en la mesa hay votación'); e.votoLaud = null;
  e.turno.principal = false; assert.ok(g.act(jamil, { t: 'pj', sub: 'laud' }).ok);
  assert.ok(vista3d(data, e).jugadores[jamil].laud.n > L.n, 'cada vez que toca sube el número');
}

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
// Esclavo peleador (Jorge, 27 de noviembre): quien lleva un esclavo de pelea tiene su monito al lado; el de carga lleva otro, el cargador.
// esclavoArma dice con qué arma pelea por su amo (11.3), o '' si no pelea: es lo que la capa 3D necesita para plantarlo al frente.
{
  const g = partida(['1', '4', '7']); const { e, ids } = g; g.asentar();
  const [nur, jamil, adi] = ids;
  for (const id of ids) e.jugadores[id].ciudad = 'Damasco';
  const v0 = vista3d(data, e);
  for (const id of ids) { assert.equal(v0.jugadores[id].esclavo, false, 'nadie empieza con esclavo'); assert.equal(v0.jugadores[id].esclavoArma, ''); }
  // de carga: su monito es otro (el cargador), no el del peleador
  darItem(e, e.jugadores[jamil], 'esclavoCarga');
  assert.equal(vista3d(data, e).jugadores[jamil].esclavo, false, 'el esclavo de carga no es el monito peleador');
  // de pelea, sin armas: lo acompaña pero no pelea
  darItem(e, e.jugadores[jamil], 'esclavoPelea');
  let J = vista3d(data, e).jugadores[jamil];
  assert.equal(J.esclavo, true, 'el esclavo de pelea se ve junto a su amo'); assert.equal(J.esclavoArma, '', 'sin un arma para él, no pelea');
  assert.equal(vista(data, e, adi).e3d.jugadores[jamil].esclavo, true, 'los demás también lo ven: es público');
  // su amo no tiene destreza y solo hay un arma: el esclavo pelea por él con esa (11.3, caso 1)
  darItem(e, e.jugadores[jamil], 'alfanje');
  J = vista3d(data, e).jugadores[jamil];
  assert.equal(J.armaPelea, 'alfanje'); assert.equal(J.esclavoArma, 'alfanje', 'pelea por su amo con la única arma');
  // dos esclavos siguen siendo un solo monito (el dato es sí o no)
  darItem(e, e.jugadores[jamil], 'esclavoPelea');
  assert.equal(vista3d(data, e).jugadores[jamil].esclavo, true);
  // Nur al Din tiene destreza con su cimitarra: el esclavo solo pelea si hay un arma de más, y pelea con esa (caso 2)
  darItem(e, e.jugadores[nur], 'esclavoPelea');
  let N = vista3d(data, e).jugadores[nur];
  assert.equal(N.esclavo, true); assert.equal(N.esclavoArma, '', 'con una sola arma, la usa su amo');
  darItem(e, e.jugadores[nur], 'alfanje');
  N = vista3d(data, e).jugadores[nur];
  assert.equal(N.armaPelea, 'cimitarra'); assert.equal(N.esclavoArma, 'alfanje', 'el esclavo toma el arma que sobra');
  // en Bagdad, sin Firmán, nadie pelea con armas: tampoco el esclavo; pero sigue al lado de su amo
  e.jugadores[nur].ciudad = 'Bagdad'; if (e.mods) e.mods.armasBagdad = false;
  N = vista3d(data, e).jugadores[nur];
  assert.equal(N.esclavo, true); assert.equal(N.esclavoArma, '', 'en Bagdad no hay arma para el esclavo');
  // lo pierde (se va, lo roban, muere en su lugar, lo deja o lo amarra): la carta sale de su mano y el monito desaparece
  e.jugadores[nur].mano = e.jugadores[nur].mano.filter((c) => c.ref !== 'esclavoPelea');
  assert.equal(vista3d(data, e).jugadores[nur].esclavo, false, 'sin la carta, sin monito');
}
// Esclavo cargador (Jorge, 27 de noviembre): quien lleva un esclavo de carga tiene al lado el monito del cargador (el de la cesta).
// Va aparte del peleador (un amo puede llevar los dos) y no pelea: nunca recibe arma ni cambia con qué pelea su amo.
{
  const g = partida(['1', '4', '7']); const { e, ids } = g; g.asentar();
  const [nur, jamil, adi] = ids;
  for (const id of ids) e.jugadores[id].ciudad = 'Damasco';
  for (const id of ids) assert.equal(vista3d(data, e).jugadores[id].cargador, false, 'nadie empieza con cargador');
  darItem(e, e.jugadores[jamil], 'esclavoCarga');
  let J = vista3d(data, e).jugadores[jamil];
  assert.equal(J.cargador, true, 'el esclavo de carga se ve junto a su amo'); assert.equal(J.esclavo, false, 'y no es el peleador'); assert.equal(J.esclavoArma, '');
  assert.equal(vista(data, e, adi).e3d.jugadores[jamil].cargador, true, 'los demás también lo ven: es público');
  assert.equal(vista3d(data, e).jugadores[nur].cargador, false, 'solo su amo lo lleva');
  // aunque su amo tenga un arma (y hasta una de más), el cargador no pelea: no hay arma para el esclavo si no hay peleador
  darItem(e, e.jugadores[jamil], 'alfanje');
  J = vista3d(data, e).jugadores[jamil];
  assert.equal(J.armaPelea, 'alfanje', 'su amo pelea con su arma, como siempre'); assert.equal(J.esclavoArma, '', 'el cargador no pelea');
  darItem(e, e.jugadores[jamil], 'cimitarra');
  assert.equal(vista3d(data, e).jugadores[jamil].esclavoArma, '', 'ni con un arma de sobra');
  // dos cargadores siguen siendo un solo monito (el dato es sí o no)
  darItem(e, e.jugadores[jamil], 'esclavoCarga');
  assert.equal(vista3d(data, e).jugadores[jamil].cargador, true);
  // con los dos esclavos lleva los dos monitos, y el que pelea es el peleador
  darItem(e, e.jugadores[jamil], 'esclavoPelea');
  J = vista3d(data, e).jugadores[jamil];
  assert.equal(J.esclavo, true); assert.equal(J.cargador, true, 'peleador y cargador a la vez'); assert.notEqual(J.esclavoArma, '', 'el peleador sí pelea por su amo');
  // en Bagdad, sin Firmán, no hay armas; el cargador sigue al lado de su amo
  e.jugadores[jamil].ciudad = 'Bagdad'; if (e.mods) e.mods.armasBagdad = false;
  J = vista3d(data, e).jugadores[jamil];
  assert.equal(J.cargador, true); assert.equal(J.esclavoArma, '');
  // pierde a los de carga (se van, se los roban, los deja): las cartas salen de su mano y el cargador desaparece; el peleador se queda
  e.jugadores[jamil].mano = e.jugadores[jamil].mano.filter((c) => c.ref !== 'esclavoCarga');
  J = vista3d(data, e).jugadores[jamil];
  assert.equal(J.cargador, false, 'sin la carta, sin monito'); assert.equal(J.esclavo, true, 'el peleador no se va con él');
}
// La figura del cargador existe y es más baja que la del peleador (su pintura incluye la cesta: la estatura se mide por el cuerpo).
{
  const { readFileSync } = await import('node:fs');
  const figuras = JSON.parse(readFileSync(new URL('../src/escena3d/datos/figuras.json', import.meta.url), 'utf8'));
  const monitos = JSON.parse(readFileSync(new URL('../src/escena3d/datos/monitos.json', import.meta.url), 'utf8'));
  assert.equal(figuras.EC?.vistas, 8, 'el cargador es un monito de ocho vistas'); assert.ok(figuras.EC.giro8?.length === 8, 'con su giro continuo');
  assert.equal(monitos.EC, 'esclavo-cargador_v1'); assert.equal(monitos.EP, 'esclavo-peleador_v1', 'el peleador sigue con su versión');
  const { ESTATURA, altoDe } = await import('../src/escena3d/figuras.js');
  assert.ok(ESTATURA.EC > 0 && ESTATURA.EC < ESTATURA.EP, 'el cargador no es más alto que el peleador'); assert.ok(altoDe('EC') < altoDe('EP'));
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
