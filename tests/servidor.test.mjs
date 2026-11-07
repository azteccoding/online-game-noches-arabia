// Prueba de integración del servidor real (WebSocket): privacidad, persistencia y continuidad sin el banco.
//   npm run build && node tests/servidor.test.mjs        (arranca su propia instancia en un puerto libre y una carpeta temporal)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 18000 + Math.floor(Math.random() * 1000);
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mun-test-'));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function arrancar(extra = [], env = {}) {
  const p = spawn(process.execPath, ['server/index.js', '--puerto', String(PUERTO), '--datos', DIR, '--sin-qr', ...extra], { cwd: RAIZ, env: { ...process.env, MUN_CLAVE: '', ...env } });
  let salida = '';
  p.stdout.on('data', (d) => { salida += d; });
  p.stderr.on('data', (d) => { salida += d; });
  return new Promise((ok, mal) => {
    const t = setInterval(() => { if (salida.includes('Ctrl+C para detener')) { clearInterval(t); ok({ p, salida: () => salida }); } }, 50);
    setTimeout(() => { clearInterval(t); mal(new Error('El servidor no arrancó:\n' + salida)); }, 8000);
  });
}
function cliente(nombre, token, clave) {
  return new Promise((ok, mal) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PUERTO}/ws`);
    const c = { ws, s: null, pid: null, token, errores: [], crudos: [] };
    ws.on('message', (raw) => {
      const m = JSON.parse(raw); c.crudos.push(String(raw));
      if (m.t === 'bienvenida') { c.pid = m.pid; c.token = m.token; ok(c); }
      if (m.t === 'estado') c.s = m.s;
      if (m.t === 'error') c.errores.push(m.msg);
    });
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hola', nombre, token, clave })));
    ws.on('error', mal);
    c.a = async (a) => { ws.send(JSON.stringify({ t: 'accion', a })); await dormir(120); };
  });
}

let srv = await arrancar();
const pin = /PIN de anfitri[oó]n[^:]*:\s*(\S+)/.exec(srv.salida())[1];
assert.equal(pin, '1234', 'en local el PIN del banco es 1234');
const A = await cliente('Dulce'), B = await cliente('Beto'), C = await cliente('Cleo');
await dormir(150);
await A.a({ t: 'reclamarAnfitrion', pin });
assert.ok(A.s.soyHost, 'Dulce reclama el banco con el PIN de la consola');
await A.a({ t: 'elegirPj', pj: '1' }); await B.a({ t: 'elegirPj', pj: '2' }); await C.a({ t: 'elegirPj', pj: '3' });
for (const x of [A, B, C]) await x.a({ t: 'listo', v: true });
await A.a({ t: 'iniciar' });
assert.equal(A.s.fase, 'juego');

// reacciones rápidas: llegan a todos, no quedan en el registro y hay un antirrebote de 1 s por jugador
{
  const quien = [A, B, C].find((x) => x.pid !== A.s.turno.pid);
  const antesLog = A.s.log.length, n = (x) => x.crudos.filter((r) => r.includes('"t":"reaccion"')).length;
  const [na, nb, nc] = [n(A), n(B), n(C)];
  quien.ws.send(JSON.stringify({ t: 'reaccion', id: 'te' })); await dormir(150);
  assert.ok(n(A) === na + 1 && n(B) === nb + 1 && n(C) === nc + 1, 'la reacción llega a todos');
  const r = JSON.parse(A.crudos.filter((x) => x.includes('"t":"reaccion"')).at(-1)).r;
  assert.equal(r.a, A.s.turno.pid, 'va dirigida a quien está jugando'); assert.equal(r.emoji, '🫖');
  quien.ws.send(JSON.stringify({ t: 'reaccion', id: 'pelea' })); await dormir(150);
  assert.ok(quien.errores.some((m) => /Espera \d+ s/.test(m)), 'antirrebote de 1 s');
  assert.equal(n(A), na + 1, 'la segunda no se difunde');
  const enTurno = [A, B, C].find((x) => x.pid === A.s.turno.pid);
  enTurno.ws.send(JSON.stringify({ t: 'reaccion', id: 'dormir' })); await dormir(150);
  assert.ok(enTurno.errores.some((m) => /tu turno/.test(m)), 'no te puedes apurar a ti mismo');
  assert.ok(!A.s.log.slice(antesLog).some((l) => /enfría el té/.test(l.texto)), 'no queda en el registro');
}

// guía privada: cada jugador recibe solo la de su personaje
const guias = JSON.parse(fs.readFileSync(path.join(RAIZ, 'server', 'guias.json'), 'utf8')).guias;
assert.equal(A.s.miGuia?.resumen, guias['1'].resumen, 'Dulce recibe la guía de Nur al Din');
assert.equal(B.s.miGuia?.resumen, guias['2'].resumen, 'Beto recibe la guía de Zein');
for (const [x, propio] of [[A, '1'], [B, '2'], [C, '3']]) {
  for (const [pj, g] of Object.entries(guias)) if (pj !== propio) assert.ok(!x.crudos.some((r) => r.includes(g.resumen)), `la guía de ${pj} no llega a quien lleva ${propio}`);
}

// privacidad: lo que reparte el banco a B no llega a A ni a C
// caja del banco: cerrada, las entregas se rechazan; al abrirla todos reciben el aviso con el nombre de quien la abre
await A.a({ t: 'host.dar', pid: B.pid, dinares: 5, noches: 0 });
assert.ok(A.errores.some((m) => /caja del banco está cerrada/.test(m)), 'sin abrir la caja, el banco no entrega');
await A.a({ t: 'host.caja', abrir: true });
for (const x of [A, B, C]) assert.ok(x.crudos.some((r) => r.includes('"t":"aviso"') && r.includes('Dulce abrió la caja del banco')), 'todos ven quién abrió la caja');
await A.a({ t: 'host.repartir', pid: B.pid, mazo: 'objeto', id: 'OB01' });
await A.a({ t: 'host.dar', pid: B.pid, dinares: 5, noches: 0 });
assert.ok(A.crudos.some((r) => r.includes('"t":"hecho"') && r.includes('Entregado a Beto: 5 dinares')), 'el banco recibe confirmación de la entrega');
assert.ok(!B.crudos.some((r) => r.includes('"t":"hecho"')), 'la confirmación solo llega a quien hizo la acción');
const objetoId = (B.s.mano.find((c) => c.tipo === 'objeto') || {}).uid;
if (!objetoId) console.log('  (aviso) el id de objeto de prueba no existe en el mazo; se omite la comprobación de mano de B:', B.errores.slice(-1));
else {
  assert.equal(A.s.mano.filter((c) => c.tipo === 'objeto').length, 0); assert.equal(C.s.mano.filter((c) => c.tipo === 'objeto').length, 0);
  for (const x of [A, C]) assert.ok(!x.crudos.some((r) => r.includes(objetoId)), 'el uid del objeto de B nunca viaja a otros jugadores');
  assert.equal(A.s.jugadores[B.pid].nMano.objeto, 1, 'los demás solo ven el CONTEO');
}
for (const x of [A, B, C]) {
  const todo = x.crudos.filter((r) => r.startsWith('{"t":"estado"')).join('');
  assert.ok(!todo.includes('"token"') && !todo.includes('"semilla"'), 'sin tokens ni semilla en ninguna vista');
  if (x !== A) assert.ok(!todo.includes('"mazos"') && !todo.includes('host_info'), 'solo el banco ve el tamaño de los mazos');
}

// continuidad: el banco se desconecta y la partida sigue
A.ws.close(); await dormir(300);
assert.ok(B.crudos.some((r) => r.includes('"t":"aviso"') && r.includes('Dulce se desconectó')), 'todos ven la alarma de desconexión');
await B.a({ t: 'host.eliminar', pid: A.pid }); // B no es el banco: se rechaza (A sigue siendo el banco)
assert.ok(B.errores.some((m) => /anfitrión/.test(m)));
assert.equal(B.s.hostConectado, false, 'se informa «banco ausente»');
const quien = [B, C].find((x) => x.pid === B.s.turno.pid) || null;     // si el turno era de Dulce, no hay quien tire: la prueba sigue con el NPC
if (quien) { await quien.a({ t: 'tirarDados' }); assert.ok(quien.s.dados, 'el jugador en turno tira aunque el banco no esté'); }
await B.a({ t: 'host.tirarNPC', quien: 'Asesinos', n: 1 }).catch(() => {});
await dormir(2200);
await B.a({ t: 'cerrarDados' });

// persistencia: se mata el servidor, se reinicia y todos recuperan su sitio con el token guardado
const antes = JSON.stringify({ r: B.s.ronda, t: B.s.turno.pid, din: B.s.jugadores[B.pid].dinares, mano: B.s.mano.length });
await dormir(700);
srv.p.kill('SIGTERM'); await dormir(500);
assert.ok(fs.existsSync(path.join(DIR, 'partida.json')), 'partida.json guardada');
srv = await arrancar();
const B2 = await cliente('Beto', B.token); await dormir(200);
assert.equal(B2.pid, B.pid, 'el token recupera al mismo jugador');
assert.equal(JSON.stringify({ r: B2.s.ronda, t: B2.s.turno.pid, din: B2.s.jugadores[B2.pid].dinares, mano: B2.s.mano.length }), antes, 'estado idéntico tras reiniciar');
const tarde = await new Promise((ok) => { const ws = new WebSocket(`ws://127.0.0.1:${PUERTO}/ws`); ws.on('message', (r) => { const m = JSON.parse(r); if (m.t === 'rechazo' || m.t === 'bienvenida') { ok(m); ws.close(); } }); ws.on('open', () => ws.send(JSON.stringify({ t: 'hola', nombre: 'Tarde' }))); });
assert.equal(tarde.t, B2.s.ronda === 1 ? 'bienvenida' : 'rechazo', 'se puede entrar tarde solo mientras no termine la primera ronda');
const A2 = await cliente('dulce'); await dormir(200);
assert.ok(B2.crudos.some((r) => r.includes('"t":"aviso"') && /dulce volvió a la partida/i.test(r)), 'al volver se avisa a todos');
assert.equal(A2.pid, A.pid, 'quien perdió su token recupera su sitio con su nombre si su dispositivo está desconectado');
assert.notEqual(A2.token, A.token);

// HTTP: cliente estático, SPA y healthz
const h = await fetch(`http://127.0.0.1:${PUERTO}/healthz`); assert.equal(await h.text(), 'ok');
if (fs.existsSync(path.join(RAIZ, 'dist', 'index.html'))) {
  const r = await fetch(`http://127.0.0.1:${PUERTO}/ruta/inexistente`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /html/);
}
assert.deepEqual(await (await fetch(`http://127.0.0.1:${PUERTO}/api/config`)).json(), { clave: false }, 'sin MUN_CLAVE no se pide clave');

// partida nueva: el banco la propone, la mayoría acepta, todos vuelven a la sala y la anterior se guarda en datos/
await A2.a({ t: 'host.reiniciar' }); await dormir(150);
assert.ok(B2.s.votoReinicio && B2.s.votoReinicio.votas, 'los jugadores conectados ven la votación');
assert.ok(B2.crudos.some((r) => r.includes('"t":"aviso"') && r.includes('propone terminar esta partida')), 'todos reciben el aviso de la propuesta');
await B2.a({ t: 'votarReinicio', si: true }); await dormir(600);
assert.equal(B2.s.fase, 'lobby', 'con mayoría vuelven todos a la sala');
assert.equal(B2.s.jugadores[B2.pid].pj != null, true, 'cada uno conserva su personaje');
assert.ok(fs.readdirSync(DIR).some((f) => /^partida-terminada-\d+\.json$/.test(f)), 'la partida anterior se archiva en datos/');
B2.ws.close(); C.ws.close();
await new Promise((r) => { srv.p.on('exit', r); srv.p.kill('SIGTERM'); });

// clave de entrada (MUN_CLAVE, solo en línea): sin clave o con clave mala se rechaza; con la buena se entra; el token solo basta para una reconexión automática
srv = await arrancar(['--nuevo'], { MUN_CLAVE: 'camello-azul' });
assert.ok(!srv.salida().includes('camello-azul'), 'la clave nunca se imprime');
assert.deepEqual(await (await fetch(`http://127.0.0.1:${PUERTO}/api/config`)).json(), { clave: true });
const hola = (m) => new Promise((ok) => { const ws = new WebSocket(`ws://127.0.0.1:${PUERTO}/ws`); ws.on('message', (r) => { const x = JSON.parse(r); if (x.t === 'rechazo' || x.t === 'bienvenida') { ws.close(); ok(x); } }); ws.on('open', () => ws.send(JSON.stringify({ t: 'hola', ...m }))); });
let r1 = await hola({ nombre: 'Sin clave' }); assert.equal(r1.t, 'rechazo'); assert.ok(r1.clave && /pide clave/.test(r1.msg));
r1 = await hola({ nombre: 'Mala', clave: 'camello-rojo' }); assert.equal(r1.t, 'rechazo'); assert.match(r1.msg, /Clave incorrecta/);
const D = await cliente('Dina', undefined, 'camello-azul'); assert.ok(D.pid, 'con la clave buena se entra');
D.ws.close(); await dormir(150);
r1 = await hola({ nombre: 'Dina', token: D.token }); assert.equal(r1.t, 'rechazo', 'al entrar siempre se pide la clave, aunque tenga token');
r1 = await hola({ nombre: 'Dina', token: D.token, reconecta: true }); assert.equal(r1.t, 'bienvenida', 'una reconexión automática con token no la vuelve a pedir');
const E = await cliente('Eva', undefined, 'camello-azul'); await dormir(150);
await E.a({ t: 'reclamarAnfitrion', pin: '1234' }); assert.ok(!E.s.soyHost && E.errores.includes('PIN incorrecto.'), 'en línea 1234 no sirve');
await E.a({ t: 'reclamarAnfitrion', pin: 'camello-azul' }); assert.ok(E.s.soyHost, 'en línea el PIN del banco es la clave de entrada');
assert.equal(E.s.host_info.pinHost, null, 'la clave no viaja al cliente');
E.ws.close();
r1 = await hola({ nombre: 'Falso', token: 'token-inventado' }); assert.equal(r1.t, 'rechazo', 'un token inválido exige clave');
for (let k = 0; k < 10; k++) await hola({ nombre: 'X', clave: 'mala' + k });
r1 = await hola({ nombre: 'X', clave: 'camello-azul' }); assert.match(r1.msg, /Demasiados intentos/, 'máx. 10 fallos por minuto e IP');
if (fs.existsSync(path.join(RAIZ, 'dist', 'demo', 'index.html'))) {                // la muestra /demo/ es pública aunque haya clave
  const d1 = await fetch(`http://127.0.0.1:${PUERTO}/demo`, { redirect: 'manual' }); assert.equal(d1.status, 301); assert.equal(d1.headers.get('location'), '/demo/');
  const d2 = await fetch(`http://127.0.0.1:${PUERTO}/demo/`); assert.equal(d2.status, 200); assert.match(d2.headers.get('content-type'), /html/);
  assert.match(await d2.text(), /milyunanoches\.net\/demo\//);
  const img = await fetch(`http://127.0.0.1:${PUERTO}/demo/vista-previa.jpg`); assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/jpeg', 'vista previa para compartir con su tipo correcto');
  assert.equal((await fetch(`http://127.0.0.1:${PUERTO}/..%2f..%2fpackage.json`)).status, 403, 'sin salir de dist/');
  const raiz = await (await fetch(`http://127.0.0.1:${PUERTO}/`)).text();                // vista previa de la página principal al compartir
  assert.match(raiz, /og:image" content="https:\/\/milyunanoches\.net\/vista-previa\.jpg"/); assert.match(raiz, /og:title" content="[^"]*amigos/);
  assert.equal((await fetch(`http://127.0.0.1:${PUERTO}/vista-previa.jpg`)).headers.get('content-type'), 'image/jpeg');
}
await new Promise((r) => { srv.p.on('exit', r); srv.p.kill('SIGTERM'); });
fs.rmSync(DIR, { recursive: true, force: true, maxRetries: 5 });
console.log('servidor.test.mjs OK');
process.exit(0);
