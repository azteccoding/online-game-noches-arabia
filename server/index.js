// Servidor ligero de «Mil y una Noches». Un solo comando:  npm start
// - Sirve el cliente estático (dist/) y el WebSocket (/ws) en el mismo puerto.
// - Estado AUTORITATIVO en memoria + guardado automático en disco (JSON atómico, copias rotativas).
// - Sin dependencias nativas (solo `ws` y `qrcode-terminal`, JavaScript puro): corre en Raspberry Pi OS ARM 32/64 con Node >= 18.
// - Sin pantalla ni navegador en el servidor: imprime IP(s) + QR en la consola.
// Opciones:  --puerto 8080  --datos ./datos  --nuevo  --restaurar <archivo.json>  --cliente ./dist  --sin-qr  --rapido (sin esperas de dados: para pruebas)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { nuevoJuego, unir, reducir, vista, conexion, tick, serializar, restaurar } from '../shared/engine.js';
import { cargarDatos } from './datos.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const PUERTO = Number(arg('puerto', process.env.PORT || 8080));
const DIR_DATOS = path.resolve(String(arg('datos', process.env.MUN_DATOS || path.join(RAIZ, 'datos'))));
const DIR_CLIENTE = path.resolve(String(arg('cliente', path.join(RAIZ, 'dist'))));
const ARCHIVO = path.join(DIR_DATOS, 'partida.json');
const data = cargarDatos();
fs.mkdirSync(DIR_DATOS, { recursive: true });

// ---------------------------------------------------------------- estado y persistencia
let estado = null;
function cargar() {
  const rest = arg('restaurar', null);
  if (rest && rest !== true) { estado = restaurar(fs.readFileSync(path.resolve(String(rest)), 'utf8')); console.log('Partida restaurada desde', rest); return; }
  if (!arg('nuevo', false) && fs.existsSync(ARCHIVO)) {
    for (const f of [ARCHIVO, ARCHIVO + '.bak1', ARCHIVO + '.bak2', ARCHIVO + '.bak3']) {
      try { estado = restaurar(fs.readFileSync(f, 'utf8')); console.log('Partida reanudada desde', path.basename(f), `(ronda ${estado.ronda}, ${Object.keys(estado.jugadores).length} jugadores)`); break; } catch { /* archivo dañado: probar la copia siguiente */ }
    }
  }
  if (!estado) {
    if (fs.existsSync(ARCHIVO)) fs.copyFileSync(ARCHIVO, path.join(DIR_DATOS, `partida-anterior-${Date.now()}.json`));
    estado = nuevoJuego(data, { codigo: 'MIL' + crypto.randomInt(100, 999), opciones: { rapido: !!arg('rapido', false) } });
    console.log('Partida nueva.');
  }
  if (arg('rapido', false)) estado.opciones.rapido = true;
  for (const j of Object.values(estado.jugadores)) j.conectado = false;
}
let sucio = false, temporizador = null, ultimaCopia = 0;
function guardarAhora() {
  if (!sucio) return;
  sucio = false;
  const tmp = ARCHIVO + '.tmp';
  fs.writeFileSync(tmp, serializar(estado), { mode: 0o600 });
  if (Date.now() - ultimaCopia > 60000 && fs.existsSync(ARCHIVO)) {                  // copias rotativas cada minuto como máximo
    ultimaCopia = Date.now();
    for (const [de, a] of [['.bak2', '.bak3'], ['.bak1', '.bak2'], ['', '.bak1']]) if (fs.existsSync(ARCHIVO + de)) fs.copyFileSync(ARCHIVO + de, ARCHIVO + a);
  }
  fs.renameSync(tmp, ARCHIVO);                                                       // atómico: nunca queda un archivo a medias
}
function marcar() { sucio = true; if (!temporizador) temporizador = setTimeout(() => { temporizador = null; try { guardarAhora(); } catch (e) { console.error('No se pudo guardar:', e.message); } }, 400); }

// ---------------------------------------------------------------- HTTP estático
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const COMPRIMIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
const cacheGz = new Map();
function servir(req, res) {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url.endsWith('/')) url += 'index.html';
  let file = path.normalize(path.join(DIR_CLIENTE, url));
  if (!file.startsWith(DIR_CLIENTE)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(DIR_CLIENTE)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<meta charset=utf-8><h1>Falta el cliente</h1><p>Ejecuta <code>npm run build</code> (o copia la carpeta <code>dist/</code>) y reinicia.</p>'); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIR_CLIENTE, 'index.html');      // SPA
  const ext = path.extname(file);
  const st = fs.statSync(file);
  const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': url.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', ETag: `"${st.size}-${st.mtimeMs}"` };
  if (req.headers['if-none-match'] === h.ETag) { res.writeHead(304, h); return res.end(); }
  if (COMPRIMIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    let z = cacheGz.get(file);
    if (!z || z.etag !== h.ETag) { z = { etag: h.ETag, buf: zlib.gzipSync(fs.readFileSync(file), { level: 6 }) }; cacheGz.set(file, z); }
    res.writeHead(200, { ...h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', 'Content-Length': z.buf.length }); return res.end(z.buf);
  }
  res.writeHead(200, { ...h, 'Content-Length': st.size });
  fs.createReadStream(file).pipe(res);
}

// ---------------------------------------------------------------- WebSocket
cargar();
const servidor = http.createServer(servir);
const wss = new WebSocketServer({ server: servidor, path: '/ws', maxPayload: 64 * 1024 });
const clientes = new Map();            // ws -> pid
let difusionPendiente = false;

function enviar(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function difundir() {
  if (difusionPendiente) return;
  difusionPendiente = true;
  setTimeout(() => {
    difusionPendiente = false;
    for (const [ws, pid] of clientes) enviar(ws, { t: 'estado', s: { ...vista(data, estado, pid), urls: direcciones() } });
  }, 25);
}
// Confirmación privada para quien hizo la acción, en las acciones que un doble clic podría repetir (entregas del banco, tesoro).
function confirmacion(a, pid) {
  const nom = (id) => estado.jugadores[id]?.nombre || '?', yo = estado.jugadores[pid];
  switch (a.t) {
    case 'host.dar': return `Entregado a ${nom(a.pid)}: ${Math.floor(a.dinares || 0)} dinares y ${Math.floor(a.noches || 0)} noches.`;
    case 'host.repartir': return `Entregado a ${nom(a.pid)}: ${a.mazo === 'objeto' ? 'un objeto' : a.mazo === 'mensaje' ? 'un mensaje' : 'una carta'}.`;
    case 'host.corregir': return `Corregido: ${a.campo} de ${nom(a.pid)}.`;
    case 'esconder': return `Escondiste ${Math.floor(a.monto || 0)} dinares en ${yo?.ciudad}. Tienes ${yo?.escondido} escondidos.`;
    case 'recuperar': return 'Recuperaste tu tesoro escondido.';
    default: return null;
  }
}
function desconectar(ws) {
  const pid = clientes.get(ws);
  if (!pid) return;
  clientes.delete(ws);
  if (![...clientes.values()].includes(pid)) { conexion(estado, pid, false); marcar(); difundir(); }
}

wss.on('connection', (ws) => {
  ws.vivo = true; ws.cuenta = 0; ws.ventana = Date.now();
  ws.on('pong', () => { ws.vivo = true; });
  ws.on('close', () => desconectar(ws));
  ws.on('error', () => desconectar(ws));
  ws.on('message', (raw) => {
    const ahora = Date.now();
    if (ahora - ws.ventana > 1000) { ws.ventana = ahora; ws.cuenta = 0; }
    if (++ws.cuenta > 40) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'ping') return enviar(ws, { t: 'pong' });
    if (m.t === 'hola') {
      let pid = Object.values(estado.jugadores).find((j) => m.token && j.token === m.token)?.id;
      let token = m.token;
      if (!pid && estado.fase !== 'lobby' && m.nombre) {
        const nom = String(m.nombre).trim().toLowerCase();
        const perdido = Object.values(estado.jugadores).find((j) => !j.npc && !j.conectado && String(j.nombre).trim().toLowerCase() === nom);
        if (perdido) { token = crypto.randomBytes(16).toString('hex'); perdido.token = token; pid = perdido.id; }
      }
      if (!pid) {
        if (estado.fase !== 'lobby') return enviar(ws, { t: 'rechazo', msg: 'La partida ya empezó. Solo puede volver quien ya estaba: mismo navegador, o su mismo nombre si su dispositivo está desconectado.' });
        if (Object.keys(estado.jugadores).length >= 8) return enviar(ws, { t: 'rechazo', msg: 'Sala llena (8 jugadores).' });
        token = crypto.randomBytes(16).toString('hex');
        pid = unir(estado, { nombre: m.nombre, token });
      } else if (m.nombre) estado.jugadores[pid].nombre = String(m.nombre).slice(0, 24);
      clientes.set(ws, pid); conexion(estado, pid, true); marcar();
      enviar(ws, { t: 'bienvenida', token, pid, codigo: estado.codigo });
      return difundir();
    }
    const pid = clientes.get(ws);
    if (!pid) return;
    if (m.t === 'accion' && m.a && typeof m.a.t === 'string') {
      let r; const copia = serializar(estado);
      try { r = reducir(data, estado, pid, m.a, ahora); } catch (x) { estado = restaurar(copia); console.error('Error del motor en', m.a.t, x.stack); r = { ok: false, error: 'Error interno del servidor (anotado en la consola). Prueba de nuevo.' }; }
      if (!r.ok) enviar(ws, { t: 'error', msg: r.error, n: m.n });
      else { const msg = confirmacion(m.a, pid); if (msg) enviar(ws, { t: 'hecho', msg, n: m.n }); }
      marcar(); difundir();
    }
  });
});

setInterval(() => { try { if (tick(data, estado, Date.now())) { marcar(); difundir(); } } catch (x) { console.error('Error en el reloj del motor', x.stack); } }, 1000);
setInterval(() => { for (const ws of wss.clients) { if (!ws.vivo) { ws.terminate(); continue; } ws.vivo = false; ws.ping(); } }, 25000);

// ---------------------------------------------------------------- arranque
let cacheUrls = { t: 0, v: [] };
const direcciones = () => { if (Date.now() - cacheUrls.t > 30000) cacheUrls = { t: Date.now(), v: ips().map((x) => `${x.ip}:${PUERTO}`) }; return cacheUrls.v; };
function ips() {
  const r = [];
  for (const [n, l] of Object.entries(os.networkInterfaces())) for (const i of l || []) if (i.family === 'IPv4' && !i.internal) r.push({ n, ip: i.address });
  return r;
}
servidor.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `El puerto ${PUERTO} ya está en uso (otra instancia?). Usa --puerto OTRO.` : e.message); process.exit(1); });
servidor.listen(PUERTO, '0.0.0.0', () => {
  const lista = ips();
  console.log('\n  MIL Y UNA NOCHES · servidor listo');
  console.log(`  Sala: ${estado.codigo}   Datos: ${ARCHIVO}`);
  if (!fs.existsSync(path.join(DIR_CLIENTE, 'index.html'))) console.log('  AVISO: no hay cliente compilado en', DIR_CLIENTE, '→ ejecuta «npm run build».');
  console.log('  Abre en el teléfono, tablet o PC (misma red Wi-Fi):');
  for (const { n, ip } of lista) console.log(`     http://${ip}:${PUERTO}   (${n})`);
  if (!lista.length) console.log(`     http://localhost:${PUERTO}   (no se detectó red: conecta el Wi-Fi o crea un punto de acceso)`);
  console.log(`  PIN de anfitrión (para recuperar el rol de banco desde otro dispositivo): ${estado.pinHost}`);
  console.log('  Ctrl+C para detener: la partida queda guardada y se reanuda al volver a arrancar.\n');
  if (lista.length && !arg('sin-qr', false)) {
    import('qrcode-terminal').then((m) => (m.default || m).generate(`http://${lista[0].ip}:${PUERTO}`, { small: true }, (q) => console.log(q))).catch(() => {});
  }
});

function salir() { try { sucio = true; guardarAhora(); } catch (e) { console.error(e.message); } process.exit(0); }
process.on('SIGINT', salir); process.on('SIGTERM', salir);
