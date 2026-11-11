// Simulación de partidas completas con bots aleatorios (motor en proceso, sin red).
//   node tests/sim.mjs [partidas=6] [semilla=1]
// Comprueba: ninguna excepción, ningún bloqueo, valores sanos y que la partida termina (1,001 noches o muerte).
import { nuevoJuego, unir, reducir, vista, tick, serializar, restaurar, avanzar } from '../shared/engine.js';
import { cargarDatos } from '../server/datos.js';

const data = cargarDatos();
const PJS = ['1', '2', '3', '4', '5', '6', '7'];

function mulberry(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function simular({ jugadores = 4, semilla = 1, rapido = true, maxPasos = 60000, conYafar = null, dificultad = 'normal', verbose = false, restaurarCada = 0, sinYafar = false } = {}) {
  const R = mulberry(semilla * 7919 + 13);
  const pick = (a) => a[Math.floor(R() * a.length)];
  let e = nuevoJuego(data, { semilla, ahora: 1000, opciones: { rapido, dificultad, sinYafar } });
  const ids = [];
  const yafar = conYafar ?? jugadores >= 4;
  const pool = PJS.slice().sort(() => R() - 0.5);
  for (let i = 0; i < jugadores; i++) ids.push(unir(e, { nombre: 'Bot' + (i + 1), token: 't' + i }));
  let now = 1000;
  const act = (pid, a) => { now += 250; return reducir(data, e, pid, a, now); };
  ids.forEach((id, i) => act(id, { t: 'elegirPj', pj: yafar && i === 0 ? 'B' : pool[i - (yafar ? 1 : 0)] }));
  if (jugadores === 1 && !yafar) { /* solitario con personaje original */ }
  ids.forEach((id) => act(id, { t: 'listo', v: true }));
  const ini = act(ids[0], { t: 'iniciar' });
  if (!ini.ok) throw new Error('No inicia: ' + ini.error);
  const stats = { pasos: 0, acciones: {}, errores: {}, pends: {}, rondas: 0 };
  const cuenta = (o, k) => { o[k] = (o[k] || 0) + 1; };
  let sinCambio = 0, ultimaFirma = '';
  let accionesTurno = 0, turnoActual = '';

  const responder = (p, pid) => {
    let a;
    if (p.modo === 'multi') {
      const dis = p.opciones.filter((o) => !o.desactivada);
      const n = Math.min(dis.length, p.min ?? 0 + Math.floor(R() * ((p.max ?? 2) - (p.min ?? 0) + 1)));
      const sel = dis.slice().sort(() => R() - 0.5).slice(0, Math.max(p.min ?? 0, Math.min(p.max ?? n, n)));
      a = { t: 'decidir', id: p.id, valores: sel.map((o) => o.id) };
    } else if (p.modo === 'numero') a = { t: 'decidir', id: p.id, numero: (p.min ?? 0) + Math.floor(R() * ((p.max ?? 6) - (p.min ?? 0) + 1)) };
    else { const dis = p.opciones.filter((o) => !o.desactivada); a = { t: 'decidir', id: p.id, opcion: pick(dis).id }; }
    return act(pid, a);
  };

  for (let paso = 0; paso < maxPasos && e.fase !== 'fin'; paso++) {
    stats.pasos = paso;
    const firma = JSON.stringify([e.ronda, e.turno?.pid, e.turno?.fase, e.turno?.tramos, e.pend?.id, e.dados?.id, e.pelea?.id, e.jugadores && Object.values(e.jugadores).map((j) => [j.dinares, j.noches, j.ciudad, j.eliminado, j.mano.length])]);
    if (firma === ultimaFirma) sinCambio++; else { sinCambio = 0; ultimaFirma = firma; }
    if (sinCambio > 40) { return { ok: false, motivo: 'bloqueo', e, stats, detalle: resumen(e) }; }
    if (sinCambio > 20) { now += 100000; tick(data, e, now); continue; }
    try {
      if (restaurarCada && paso % restaurarCada === 0) { e = restaurar(serializar(e)); }
      if (e.dados) {
        if (now - e.dados.t0 >= 2000) { const r = act(ids[0], { t: 'cerrarDados' }); if (!r.ok) cuenta(stats.errores, 'cerrarDados:' + r.error); } else now += 500;
        continue;
      }
      if (e.pend) {
        const p = e.pend; cuenta(stats.pends, p.tipo);
        const falta = p.para.filter((x) => !p.resp[x] && !e.jugadores[x].eliminado);
        if (!falta.length) { now += 100000; tick(data, e, now); continue; }
        const r = responder(p, falta[0]);
        if (!r.ok) { cuenta(stats.errores, 'pend:' + r.error); now += 100000; tick(data, e, now); }
        continue;
      }
      const t = e.turno;
      if (!t) { now += 1000; tick(data, e, now); continue; }
      const pid = t.pid;
      if (e.jugadores[pid].npc) { now += 1000; tick(data, e, now); continue; }
      const tkey = e.ronda + ':' + pid; if (tkey !== turnoActual) { turnoActual = tkey; accionesTurno = 0; }
      const v = vista(data, e, pid);
      const ac = v.acciones;
      if (!ac.length) { now += 1000; tick(data, e, now); continue; }
      const fin = ac.find((x) => x.k === 'terminarTurno');
      let elegida = null;
      accionesTurno++;
      if (ac.find((x) => x.k === 'cc')) elegida = ac.find((x) => x.k === 'cc');
      else if (e.asesinos?.pendiente?.victima === pid && e.jugadores[pid].extra.masrur && ac.find((x) => x.k === 'tesoro' && x.sub === 'jorasan')) elegida = ac.find((x) => x.k === 'tesoro' && x.sub === 'jorasan');   // avisado por Masrur: huye al Jorasán
      else if (fin && (e.carrerasActivas || []).some((c) => c.ciudad === e.jugadores[pid].ciudad) && !t.movio && R() < 0.6) elegida = fin;   // carrera de «dos noches»: se queda
      else if (accionesTurno > 14 && fin) elegida = fin;
      else {
        const peso = { tirarDados: 100, cc: 100, viajar: 0.5, atacar: 0.2, reto: 0.35, tesoro: 0.3, esconder: 0.1, recuperar: 0.4, usar: 0.3, asesinos: 0.3, pj: 0.4, terminarTurno: 0.15 };
        const cand = ac.filter((x) => !x.bloqueado);
        let tot = 0; const w = cand.map((x) => { const p = peso[x.k] ?? 0.1; tot += p; return p; });
        let r = R() * tot; elegida = cand[0];
        for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) { elegida = cand[i]; break; } }
      }
      let a = null;
      switch (elegida.k) {
        case 'tirarDados': a = { t: 'tirarDados' }; break;
        case 'cc': { const cc = t.ccActual; a = cc?.tipo === 'trivia' ? { t: 'responderCC', opcion: Math.floor(R() * (data.trivias.trivias.find((x) => x.id === cc.id)?.opciones.length || 3)) } : { t: 'resolverMesa', ok: R() < 0.5 }; break; }
        case 'viajar': a = { t: 'viajar', destino: elegida.destino }; if (e.jugadores[pid].pj === '6' && R() < 0.3) a.servicios = true; break;
        case 'atacar': a = elegida.tipo === 'duelo' && e.jugadores[pid].herido ? { t: 'terminarTurno' } : { t: 'atacar', tipo: elegida.tipo, objetivo: pick(elegida.objetivos), pedirDinares: 5, pedirNoches: 0 }; break;   // herido, no se arriesga a un duelo
        case 'reto': a = { t: 'reto', id: elegida.id, sub: elegida.sub }; break;
        case 'tesoro': a = { t: 'tesoro', sub: elegida.sub, uid: elegida.uid, via: elegida.via }; break;
        case 'esconder': a = { t: 'esconder', monto: 1 + Math.floor(R() * Math.max(1, e.jugadores[pid].dinares - 1)) }; break;
        case 'recuperar': a = { t: 'recuperar' }; break;
        case 'usar': a = { t: 'usar', uid: elegida.uid, via: elegida.via, destino: elegida.destinos ? pick(elegida.destinos) : undefined, objetivo: elegida.objetivos ? pick(elegida.objetivos) : undefined, deseo: elegida.ifrit ? pick(elegida.ifrit) : undefined }; break;
        case 'asesinos': a = e.jugadores[pid].dinares >= 6 * Math.max(1, e.ronda) * 35 ? { t: 'asesinos' } : { t: 'terminarTurno' }; break;   // solo si casi seguro le alcanza
        case 'pj': a = { t: 'pj', sub: elegida.sub, con: elegida.objetivos ? pick(elegida.objetivos) : undefined, precio: 10 }; break;
        case 'terminarTurno': a = { t: 'terminarTurno' }; break;
        default: a = { t: 'terminarTurno' };
      }
      if (R() < 0.12 && !t.ccActual && t.fase !== 'ingreso') {                                  // compras y ventas al azar
        const j = e.jugadores[pid];
        const q = R();
        // el mercado vende fuera de tu turno: compra otro jugador (Yafar NPC, en el suyo)
        const fuera = ids.filter((x) => x !== pid && !e.jugadores[x].eliminado && !e.jugadores[x].npc);
        const comprador = e.jugadores[pid].npc ? pid : fuera.length ? pick(fuera) : pid;
        if (q < 0.4) { const o = pick(data.objetos.mazo); const r0 = act(comprador, { t: 'comprar', id: o.id }); cuenta(stats.acciones, 'comprar:' + (r0.ok ? 'ok' : 'x')); }
        else if (q < 0.6) { const ref = e.jugadores[comprador].ciudad === 'Basra' && R() < 0.5 ? 'burro' : pick(['arco', 'flechas', 'alfanje', 'cimitarra', 'vino', 'buza', 'cesta']); const r0 = act(ref === 'ifrit' ? pid : comprador, { t: 'comprar', ref }); cuenta(stats.acciones, 'comprarRef:' + (r0.ok ? 'ok' : 'x')); }
        else if (q < 0.8 && j.mano.length) { const c = pick(j.mano); const r0 = act(pid, { t: 'vender', uid: c.uid }); cuenta(stats.acciones, 'vender:' + (r0.ok ? 'ok' : 'x')); }
        else if (q < 0.9) { const o = ids.filter((x) => x !== pid && !e.jugadores[x].eliminado && e.jugadores[x].ciudad === j.ciudad); if (o.length) { const r0 = act(pid, { t: 'proponerTrato', con: pick(o), ofrece: { dinares: 3, objetos: j.mano.slice(0, 1).map((c) => c.uid) }, pide: { dinares: 1, objetos: [] } }); cuenta(stats.acciones, 'trato:' + (r0.ok ? 'ok' : 'x')); } }
        else { const r0 = act(pid, { t: 'comprar', ref: 'firman' }); cuenta(stats.acciones, 'firman:' + (r0.ok ? 'ok' : 'x')); }
      }
      const tr = Object.values(e.tratos);
      if (tr.length) { const x = tr[0]; act(x.con, { t: 'responderTrato', id: x.id, ok: R() < 0.7 }); }
      const r = act(pid, a);
      cuenta(stats.acciones, a.t + (a.sub ? ':' + a.sub : '') + ':' + (r.ok ? 'ok' : 'x'));
      if (!r.ok) {
        cuenta(stats.errores, a.t + ':' + r.error);
        if (fin) { const r2 = act(pid, { t: 'terminarTurno' }); if (!r2.ok) cuenta(stats.errores, 'FIN:' + r2.error); }
      }
      verificar(e);
    } catch (x) { return { ok: false, motivo: 'excepcion', error: x.stack, e, stats, detalle: resumen(e) }; }
  }
  stats.rondas = e.ronda;
  verificar(e);
  return { ok: e.fase === 'fin', motivo: e.fase === 'fin' ? 'fin' : 'maxPasos', e, stats, detalle: resumen(e) };
}

function verificar(e) {
  for (const j of Object.values(e.jugadores)) {
    for (const k of ['dinares', 'noches']) if (!Number.isFinite(j[k]) || (k === 'noches' && j[k] < 0)) throw new Error(`${j.nombre}.${k} = ${j[k]}`);   // los dinares pueden quedar en negativo (deuda con el banco)
    if (j.mano.some((c) => !c.uid || !c.tipo || !c.ref)) throw new Error('carta malformada en ' + j.nombre);
  }
}
export function resumen(e) {
  return { fase: e.fase, ronda: e.ronda, turno: e.turno && { pid: e.turno.pid, fase: e.turno.fase, fin: e.turno.fin, npc: e.turno.npc }, pend: e.pend && { tipo: e.pend.tipo, para: e.pend.para, cont: e.pend.cont, titulo: e.pend.titulo }, pelea: !!e.pelea, dados: !!e.dados,
    ganadores: e.ganadores, derrota: e.derrota, jugadores: Object.values(e.jugadores).map((j) => `${j.nombre}(${j.pj}) ${j.eliminado ? 'ELIM ' : ''}${j.dinares}d ${j.noches}n ${j.ciudad}`), log: e.log.slice(-8).map((l) => l.texto) };
}

if (process.argv[1] && process.argv[1].endsWith('sim.mjs')) {
  const n = Number(process.argv[2] || 6), s0 = Number(process.argv[3] || 1);
  let fallos = 0;
  for (let i = 0; i < n; i++) {
    const cfg = [{ jugadores: 4 }, { jugadores: 1, conYafar: false }, { jugadores: 8 }, { jugadores: 2, conYafar: false }, { jugadores: 5 }, { jugadores: 3, conYafar: false }][i % 6];
    const r = simular({ ...cfg, semilla: s0 + i });
    const st = r.stats;
    console.log(`#${i} ${JSON.stringify(cfg)} sem=${s0 + i}: ${r.ok ? 'OK' : 'FALLO ' + r.motivo} rondas=${r.e.ronda} pasos=${st.pasos} ganadores=${JSON.stringify(r.e.ganadores)} derrota=${r.e.derrota}`);
    if (!r.ok) { fallos++; console.log(r.error || '', JSON.stringify(r.detalle, null, 1)); }
    if (process.env.STATS) console.log(JSON.stringify(st.errores, null, 1), JSON.stringify(st.acciones), JSON.stringify(st.pends));
  }
  process.exit(fallos ? 1 : 0);
}
void avanzar;
