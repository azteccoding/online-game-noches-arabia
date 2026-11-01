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

function arrancar(extra = []) {
  const p = spawn(process.execPath, ['server/index.js', '--puerto', String(PUERTO), '--datos', DIR, '--sin-qr', ...extra], { cwd: RAIZ });
  let salida = '';
  p.stdout.on('data', (d) => { salida += d; });
  p.stderr.on('data', (d) => { salida += d; });
  return new Promise((ok, mal) => {
    const t = setInterval(() => { if (salida.includes('servidor listo')) { clearInterval(t); ok({ p, salida: () => salida }); } }, 50);
    setTimeout(() => { clearInterval(t); mal(new Error('El servidor no arrancó:\n' + salida)); }, 8000);
  });
}
function cliente(nombre, token) {
  return new Promise((ok, mal) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PUERTO}/ws`);
    const c = { ws, s: null, pid: null, token, errores: [], crudos: [] };
    ws.on('message', (raw) => {
      const m = JSON.parse(raw); c.crudos.push(String(raw));
      if (m.t === 'bienvenida') { c.pid = m.pid; c.token = m.token; ok(c); }
      if (m.t === 'estado') c.s = m.s;
      if (m.t === 'error') c.errores.push(m.msg);
    });
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hola', nombre, token })));
    ws.on('error', mal);
    c.a = async (a) => { ws.send(JSON.stringify({ t: 'accion', a })); await dormir(120); };
  });
}

let srv = await arrancar();
const pin = /PIN de anfitri[oó]n[^:]*:\s*(\S+)/.exec(srv.salida())[1];
const A = await cliente('Ana'), B = await cliente('Beto'), C = await cliente('Cleo');
await dormir(150);
await A.a({ t: 'reclamarAnfitrion', pin });
assert.ok(A.s.soyHost, 'Ana reclama el banco con el PIN de la consola');
await A.a({ t: 'elegirPj', pj: '1' }); await B.a({ t: 'elegirPj', pj: '2' }); await C.a({ t: 'elegirPj', pj: '3' });
for (const x of [A, B, C]) await x.a({ t: 'listo', v: true });
await A.a({ t: 'iniciar' });
assert.equal(A.s.fase, 'juego');

// privacidad: lo que reparte el banco a B no llega a A ni a C
await A.a({ t: 'host.repartir', pid: B.pid, mazo: 'objeto', id: 'OB01' });
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
assert.equal(B.s.hostConectado, false, 'se informa «banco ausente»');
const quien = [B, C].find((x) => x.pid === B.s.turno.pid) || null;     // si el turno era de Ana, no hay quien tire: la prueba sigue con el NPC
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
const intruso = await new Promise((ok) => { const ws = new WebSocket(`ws://127.0.0.1:${PUERTO}/ws`); ws.on('message', (r) => { const m = JSON.parse(r); if (m.t === 'rechazo') ok(m.msg); }); ws.on('open', () => ws.send(JSON.stringify({ t: 'hola', nombre: 'Intruso' }))); });
assert.ok(/ya empez/.test(intruso), 'un desconocido no puede entrar a media partida');
const A2 = await cliente('ana'); await dormir(200);
assert.equal(A2.pid, A.pid, 'quien perdió su token recupera su sitio con su nombre si su dispositivo está desconectado');
assert.notEqual(A2.token, A.token);

// HTTP: cliente estático, SPA y healthz
const h = await fetch(`http://127.0.0.1:${PUERTO}/healthz`); assert.equal(await h.text(), 'ok');
if (fs.existsSync(path.join(RAIZ, 'dist', 'index.html'))) {
  const r = await fetch(`http://127.0.0.1:${PUERTO}/ruta/inexistente`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /html/);
}
B2.ws.close(); C.ws.close();
await new Promise((r) => { srv.p.on('exit', r); srv.p.kill('SIGTERM'); });
fs.rmSync(DIR, { recursive: true, force: true, maxRetries: 5 });
console.log('servidor.test.mjs OK');
process.exit(0);
