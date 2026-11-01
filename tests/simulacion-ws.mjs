// Simula partidas COMPLETAS contra el servidor real por WebSocket (varios clientes bot). Sirve para encontrar bloqueos.
//   node tests/simulacion-ws.mjs            (4 jugadores con Yafar, solitario contra Yafar NPC y 8 jugadores)
// Arranca el servidor en modo --rapido, en un puerto libre y una carpeta temporal.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_MS = Number(process.env.MAX_MS || 90000);

function arrancar(puerto, dir) {
  const p = spawn(process.execPath, ['server/index.js', '--puerto', String(puerto), '--datos', dir, '--sin-qr', '--rapido', '--nuevo'], { cwd: RAIZ });
  let salida = '';
  p.stdout.on('data', (d) => { salida += d; }); p.stderr.on('data', (d) => { salida += d; });
  return new Promise((ok, mal) => {
    const t = setInterval(() => { if (salida.includes('servidor listo')) { clearInterval(t); ok({ p, salida: () => salida }); } }, 50);
    setTimeout(() => { clearInterval(t); mal(new Error('El servidor no arrancó:\n' + salida)); }, 8000);
  });
}

function bot(puerto, nombre, semilla) {
  let a = semilla;
  const R = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (l) => l[Math.floor(R() * l.length)];
  return new Promise((ok, mal) => {
    const ws = new WebSocket(`ws://127.0.0.1:${puerto}/ws`);
    const c = { ws, s: null, pid: null, errores: {}, acciones: 0, turnoClave: '', enTurno: 0 };
    const enviar = (x) => { ws.send(JSON.stringify({ t: 'accion', a: x })); c.acciones++; };
    c.enviar = enviar;
    function decidir() {
      const s = c.s; if (!s || s.fase !== 'juego') return;
      if (s.pend && s.pend.mia && !s.pend.respondiste) {
        const p = s.pend, dis = p.opciones.filter((o) => !o.desactivada);
        if (p.modo === 'multi') { const n = Math.max(p.min ?? 0, 0); return enviar({ t: 'decidir', id: p.id, valores: dis.slice(0, n).map((o) => o.id) }); }
        if (p.modo === 'numero') return enviar({ t: 'decidir', id: p.id, numero: p.min ?? 0 });
        return enviar({ t: 'decidir', id: p.id, opcion: pick(dis).id });
      }
      if (s.dados && s.yo === s.orden[0]) enviar({ t: 'cerrarDados' });
      const tr = s.tratos.find((x) => x.con === c.pid); if (tr) return enviar({ t: 'responderTrato', id: tr.id, ok: R() < 0.6 });
      if (s.pend || !s.turno || s.turno.pid !== c.pid) return;
      const clave = s.ronda + ':' + c.pid; if (clave !== c.turnoClave) { c.turnoClave = clave; c.enTurno = 0; }
      c.enTurno++;
      const ac = s.acciones; if (!ac.length) return;
      const fin = ac.find((x) => x.k === 'terminarTurno');
      let e = ac.find((x) => x.k === 'cc') || (c.enTurno > 12 && fin ? fin : null);
      if (!e) {
        const peso = { tirarDados: 100, cc: 100, viajar: 0.6, atacar: 0.2, reto: 0.3, tesoro: 0.3, esconder: 0.05, recuperar: 0.3, usar: 0.2, asesinos: 0.2, pj: 0.3, terminarTurno: 0.15 };
        const cand = ac.filter((x) => !x.bloqueado); let tot = 0; const w = cand.map((x) => { const q = peso[x.k] ?? 0.1; tot += q; return q; });
        let r = R() * tot; e = cand[0]; for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) { e = cand[i]; break; } }
      }
      switch (e.k) {
        case 'tirarDados': return enviar({ t: 'tirarDados' });
        case 'cc': { const h = s.historial.find((x) => x.nro === s.turno.ccActual?.nro); return s.turno.ccActual?.tipo === 'trivia' ? enviar({ t: 'responderCC', opcion: Math.floor(R() * (h?.opciones?.length || 3)) }) : enviar({ t: 'resolverMesa', ok: R() < 0.5 }); }
        case 'viajar': return enviar({ t: 'viajar', destino: e.destino });
        case 'atacar': return enviar({ t: 'atacar', tipo: e.tipo, objetivo: pick(e.objetivos), pedirDinares: 5, pedirNoches: 0 });
        case 'reto': return enviar({ t: 'reto', id: e.id, sub: e.sub });
        case 'tesoro': return enviar({ t: 'tesoro', sub: e.sub, uid: e.uid, via: e.via });
        case 'esconder': return enviar({ t: 'esconder', monto: 1 });
        case 'recuperar': return enviar({ t: 'recuperar' });
        case 'usar': return enviar({ t: 'usar', uid: e.uid, destino: e.destinos ? pick(e.destinos) : undefined, objetivo: e.objetivos ? pick(e.objetivos) : undefined, deseo: e.ifrit ? pick(e.ifrit) : undefined });
        case 'asesinos': return enviar({ t: 'asesinos' });
        case 'pj': return enviar({ t: 'pj', sub: e.sub, con: e.objetivos ? pick(e.objetivos) : undefined, precio: 10 });
        default: return enviar({ t: 'terminarTurno' });
      }
    }
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.t === 'bienvenida') { c.pid = m.pid; c.token = m.token; ok(c); }
      if (m.t === 'estado') { c.s = m.s; try { decidir(); } catch (x) { console.error('bot', x.message); } }
      if (m.t === 'error') c.errores[m.msg.replace(/\d+/g, 'N')] = (c.errores[m.msg.replace(/\d+/g, 'N')] || 0) + 1;
    });
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hola', nombre })));
    ws.on('error', mal);
    c.latido = setInterval(() => { try { decidir(); } catch { /* ignorar */ } }, 400);
  });
}

async function partida(titulo, { n, yafar, dificultad = 'normal' }) {
  const puerto = 19000 + Math.floor(Math.random() * 900), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mun-ws-'));
  const srv = await arrancar(puerto, dir);
  const pin = /PIN de anfitri[oó]n[^:]*:\s*(\S+)/.exec(srv.salida())[1];
  const bots = [];
  for (let i = 0; i < n; i++) bots.push(await bot(puerto, 'Bot' + (i + 1), 31 * (i + 7) + n));
  await dormir(200);
  const [A] = bots; A.enviar({ t: 'reclamarAnfitrion', pin }); await dormir(150);
  const pjs = ['1', '2', '3', '4', '5', '6', '7'];
  bots.forEach((b, i) => b.enviar({ t: 'elegirPj', pj: yafar && i === 0 ? 'B' : pjs[(i - (yafar ? 1 : 0) + 7) % 7] }));
  await dormir(300);
  if (dificultad !== 'normal') { A.enviar({ t: 'opciones', dificultad }); await dormir(100); }
  bots.forEach((b) => b.enviar({ t: 'listo', v: true })); await dormir(300);
  A.enviar({ t: 'iniciar' }); await dormir(300);
  if (A.s.fase !== 'juego') { srv.p.kill(); throw new Error(titulo + ': no inició: ' + JSON.stringify(A.errores)); }
  const t0 = Date.now(); let ultimo = JSON.stringify([A.s.ronda, A.s.turno?.pid]), sinProgreso = 0;
  while (A.s.fase === 'juego' && Date.now() - t0 < MAX_MS) {
    await dormir(500);
    const f = JSON.stringify([A.s.ronda, A.s.turno?.pid, A.s.pend?.id, A.s.dados?.id, A.s.jugadores && Object.values(A.s.jugadores).map((j) => [j.dinares, j.noches, j.ciudad])]);
    if (f === ultimo) sinProgreso++; else { sinProgreso = 0; ultimo = f; }
    if (sinProgreso > 160) break;
  }
  const fase = A.s.fase, resumen = { fase, ronda: A.s.ronda, ganadores: A.s.ganadores, derrota: A.s.derrota, acciones: bots.reduce((x, b) => x + b.acciones, 0) };
  if (fase !== 'fin') console.log('  estado final:', JSON.stringify({ turno: A.s.turno, pend: A.s.pend && { tipo: A.s.pend.tipo, para: A.s.pend.para, faltan: A.s.pend.faltan, titulo: A.s.pend.titulo }, dados: !!A.s.dados, acciones: bots.map((b) => (b.s.acciones || []).map((x) => x.k).join(',')), errores: bots.map((b) => b.errores), log: A.s.log.slice(-6).map((l) => l.texto) }));
  const errs = {}; for (const b of bots) for (const [k, v] of Object.entries(b.errores)) errs[k] = (errs[k] || 0) + v;
  const log = srv.salida();
  for (const b of bots) { clearInterval(b.latido); b.ws.close(); }
  srv.p.kill('SIGTERM'); await dormir(400);
  fs.rmSync(dir, { recursive: true, force: true });
  const motor = /Error (del motor|en el reloj)/.test(log);
  console.log(`${titulo}: ${fase === 'fin' ? 'OK' : 'FALLO (no terminó)'} ${JSON.stringify(resumen)} ${motor ? 'ERRORES DE MOTOR EN LA CONSOLA DEL SERVIDOR' : ''}`);
  if (motor) console.log(log.split('\n').filter((l) => /Error/.test(l)).slice(0, 5).join('\n'));
  return fase === 'fin' && !motor;
}

const casos = [['4 jugadores con Yafar', { n: 4, yafar: true }], ['Solitario contra Yafar NPC', { n: 1, yafar: false }], ['8 jugadores', { n: 8, yafar: true }], ['3 jugadores + NPC (difícil)', { n: 3, yafar: false, dificultad: 'dificil' }]];
let fallos = 0;
for (const [t, c] of casos) { try { if (!(await partida(t, c))) fallos++; } catch (x) { fallos++; console.log(t + ': ' + x.message); } }
process.exit(fallos ? 1 : 0);
