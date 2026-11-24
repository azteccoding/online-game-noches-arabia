// Simulación de partidas completas con bots aleatorios (motor en proceso, sin red).
//   node tests/sim.mjs [partidas=6] [semilla=1]
// Comprueba: ninguna excepción, ningún bloqueo, valores sanos y que la partida termina (1,001 noches o muerte).
import { nuevoJuego, unir, reducir, vista, tick, serializar, restaurar, avanzar, multiplicadorRonda } from '../shared/engine.js';
import { cargarDatos } from '../server/datos.js';
import { tieneItem, tieneObj, SHATRANJ, DATILES, cargaExcedida, pesaCarta, jambiyaEscondida, nCarga, soloJambiya } from '../shared/base.js';
import { atacaMujer } from '../shared/pelea.js';

const data = cargarDatos();
const PJS = ['1', '2', '3', '4', '5', '6', '7'];
// Compras útiles (Jorge, 19 de noviembre: «enséñale a los bots a comprar artefactos para los retos»): objetos que piden o ayudan en
// los retos (R22/R30 balanza, R23 odre, R27 antídoto, R31 pastel y carta, sobornos, llaves, cuerdas…), cítricos para el mar, dátiles
// (R53), Shatranj en India y caballo mongol en Estambul. Sigue siendo al azar, pero con sentido: solo lo que le sirve y si le alcanza.
const OBJ_RETOS = { OB04: 1, OB18: 2, OB12: 2, OB20: 2, OB21: 1.5, OB30: 1.5, OB14: 1.5, OB05: 1, OB06: 1, OB07: 1, OB08: 1, OB09: 1, OB10: 1, OB13: 1, OB17: 1, OB26: 1, OB38: 1, OB40: 1, OB43: 1 };
// Debilidades ajenas y fortalezas propias (Jorge, 19 de noviembre: «enséñale a los bots a aprovecharse de la debilidad de Zein o de
// que Ruyán se deja comprar noches», «que jueguen con las fortalezas de su personaje» y «que Yafar aproveche todas sus ventajas»).
// Solo el bot: el juego no cambia. Lo que se aprovecha se cuenta en stats.acciones como explota:* y fortaleza:*.
const ARMAS_BOT = ['alfanje', 'cimitarra', 'jambiya'];   // el arco no cuenta como arma (Jorge, 19 de noviembre)
const desarmado = (j) => !ARMAS_BOT.some((r) => tieneItem(j, r));
const sinDestreza = (j) => !j.destreza;
const HONOR = ['El Cairo', 'Damasco', 'Aleppo'];
const VECINOS = {};
for (const k of Object.keys(data.rutas.tarifas)) { const [a, b] = k.split('>'); (VECINOS[a] ||= new Set()).add(b); }
const DIST = {};   // DIST[destino][ciudad] = tramos que faltan
for (const dst of ['Estambul', 'Damasco', 'Samarcanda', 'Bagdad', 'Yemen', 'El Cairo', 'Aleppo', 'Isfahán', 'Andalucía']) {
  const d = (DIST[dst] = { [dst]: 0 }), cola = [dst];
  while (cola.length) { const c = cola.shift(); for (const [a, vs] of Object.entries(VECINOS)) if (vs.has(c) && d[a] === undefined) { d[a] = d[c] + 1; cola.push(a); } }
}
const acerca = (desde, hacia, meta) => DIST[meta]?.[hacia] !== undefined && DIST[meta][hacia] < (DIST[meta][desde] ?? Infinity);
const seVendeEn = (o, ciudad) => /^(todas|cualquier)/i.test(String(o?.seConsigueEn || '').trim()) || String(o?.seConsigueEn || '').split(/,| y /).map((x) => x.trim()).includes(ciudad);

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
    else {
      const dis = p.opciones.filter((o) => !o.desactivada), tiene = (id) => dis.some((o) => o.id === id), jp = e.jugadores[pid], adi = jp.pj === '7';
      let op = null;
      if (p.titulo === 'El Sabio Ruyán' && tiene('si')) op = adi || R() < 0.85 ? 'si' : 'no';
      else if (p.titulo === 'Versos en tu honra' && tiene('si')) op = adi || R() < 0.8 ? 'si' : 'no';
      else if (p.titulo === 'Versos de sátira') op = tiene('pagar') && jp.dinares >= 15 ? 'pagar' : 'noches';
      else if (p.titulo === 'R50 · Llevar yeguas de la estepa' && tiene('1')) op = jp.dinares >= 230 && tiene('2') && R() < 0.3 ? '2' : '1';   // deja dinero para el viaje
      if (op && tiene(op)) { const r = act(pid, { t: 'decidir', id: p.id, opcion: op }); if (r.ok) cuenta(stats.acciones, (adi && op === 'si' ? 'fortaleza:Adí paga ' : 'explota:') + p.titulo + ':' + op); return r; }
    }
    if (!a) { const dis = p.opciones.filter((o) => !o.desactivada); a = { t: 'decidir', id: p.id, opcion: pick(dis).id }; }
    return act(pid, a);
  };

  // qué tan apetecible es atacar a x (0 = no lo ataca) y por qué
  const atractivo = (pid, tipo, x) => {
    const A = e.jugadores[pid], D = e.jugadores[x];
    if (A.pj === 'B' && ['2', '6'].includes(D.pj) && tipo !== 'duelo' && desarmado(D)) return [R() < 0.1 ? 0.2 : 0, null];   // Yafar quedaría Buscado
    if (atacaMujer(A, D)) return [A.buscado > 0 ? 1 : 0.25, 'costo:ataca a ' + (D.pj === '2' ? 'Zein' : 'Zubayda') + ' aunque quede Buscado'];   // Jorge (19 de noviembre): quedaría Buscado
    if (tipo === 'matar' && D.buscado > 0) return [4, 'explota:mata a un Buscado'];
    if (D.pj === 'B' && tipo !== 'robo') return [3, 'explota:ataca a Yafar (blanco de todos)'];
    if (A.pj === 'B') return [1 + Math.min(3, D.dinares / 20), 'fortaleza:Yafar ataca con jambiya y destreza' + (A.ciudad === 'Bagdad' ? ' (con su Firmán en Bagdad)' : '')];
    if (['2', '5'].includes(D.pj) && sinDestreza(D)) return [3, 'explota:ataca a Zein o Ruyán (sin destreza)'];
    if (tipo === 'robo' && D.pj === '1') return [2.5, 'explota:roba a Nur al Din'];
    if (tipo === 'robo' && desarmado(D)) return [2.5, 'explota:roba a quien va sin armas'];
    if (tipo === 'duelo' && A.pj === '1' && (desarmado(D) || sinDestreza(D))) return [2.5, 'fortaleza:Nur reta a duelo a quien va sin armas o sin destreza'];
    if (tipo === 'duelo' && A.pj === '1' && HONOR.includes(A.ciudad)) return [2, 'fortaleza:Nur reta en su ciudad de honor'];
    return [1, null];
  };
  const objetivoAtaque = (pid, x) => {
    const ws = x.objetivos.map((o) => atractivo(pid, x.tipo, o)), tot = ws.reduce((a, w) => a + w[0], 0);
    if (!tot) return [pick(x.objetivos), null];
    let r = R() * tot; for (let i = 0; i < ws.length; i++) { r -= ws[i][0]; if (r <= 0) return [x.objetivos[i], ws[i][1]]; }
    return [x.objetivos[x.objetivos.length - 1], ws[ws.length - 1][1]];
  };
  const enCiudad = (pid, c) => Object.values(e.jugadores).filter((y) => y.id !== pid && !y.eliminado && y.ciudad === c).length;
  const ruyanEn = (pid, c) => Object.values(e.jugadores).some((y) => y.pj === '5' && y.id !== pid && !y.eliminado && !y.transito && y.ciudad === c && c !== 'Bagdad' && y.noches > 0);
  const apuros = (j) => j.herido || j.buscado > 0 || j.dinares < 15;
  // Metas largas (Jorge, 19 de noviembre: «tus bots están tontos»): R52 (forjar en Damasco, todos menos Yafar) y la cadena de los
  // caballos mongoles (R50 en Samarcanda → vender la yegua en Estambul → se venden los mongoles). Cada bot decide al inicio si las persigue.
  const metas = {}, zubRonda = {};
  const meta = (pid) => {
    const j = e.jugadores[pid];
    const m = (metas[pid] ||= { forja: j.pj !== 'B' && R() < 0.35, estepa: j.pj !== 'B' && R() < (j.pj === '7' ? 0.9 : 0.5), entrena: j.pj === '6' || R() < 0.6 });   // Adí, con su dinero, es quien más va por las yeguas
    if (tieneItem(j, 'yegua')) return 'Estambul';
    if (tieneItem(j, 'costalPistaches')) return 'Bagdad';   // R56: los pistaches se entregan solos al llegar
    if (m.entrena && !j.npc) {   // Jorge (20 de noviembre): entrenar las armas que trae (cada una da 50 noches) y la destreza en Estambul
      for (const [arma, ciudad, costo] of [['jambiya', 'Yemen', 20], ['alfanje', 'Damasco', 20], ['cimitarra', 'Isfahán', 25], ['arco', 'Andalucía', 20]])
        if (tieneItem(j, arma) && !j.extra?.entrenado?.[arma] && (!soloJambiya(j) || arma === 'jambiya') && j.dinares >= costo + 10) return ciudad;
      if (!j.destreza && !soloJambiya(j) && j.dinares >= 60) return 'Estambul';
    }
    if (j.pj === '6' && !j.npc) {   // Zubayda (Jorge, 20 de noviembre): carreras «Dos noches» y entrenar la jambiya en Yemen
      const car = (e.carrerasActivas || []).find((c) => !(c.prog || {})[pid] || c.ciudad === j.ciudad);
      if (car && DIST[car.ciudad]) return car.ciudad;
      if (tieneItem(j, 'jambiya') && !j.extra?.entrenado?.jambiya && !(j.retosHechos || []).includes('R19') && j.dinares >= 30) return 'Yemen';
      // Jorge (20 de noviembre): también entrena alfanje (Damasco) o cimitarra (Isfahán), aunque pierda su protección de «sin armas»
      if (tieneItem(j, 'alfanje') && !j.extra?.entrenado?.alfanje && j.dinares >= 25) return 'Damasco';
      if (tieneItem(j, 'cimitarra') && !j.extra?.entrenado?.cimitarra && j.dinares >= 30) return 'Isfahán';
    }
    if (j.pj !== 'B' && ['lampara', 'amate', 'buza'].every((x) => tieneItem(j, x)) && !(j.retosHechos || []).includes('R47') && j.dinares >= 8) return 'Yemen';   // con mecenas, a aprender árabe (Jorge, 20 de noviembre)
    if (m.forja && j.pj !== 'B' && !tieneItem(j, 'cimitarra') && !j.extra?.forja && j.dinares >= 20) return 'Damasco';
    if (m.estepa && !(j.retosHechos || []).includes('R50') && j.dinares >= 115) return 'Samarcanda';
    return null;
  };
  const porViaje = (pid, x) => {
    const j = e.jugadores[pid];
    { const m = meta(pid); if (m && acerca(j.ciudad, x.destino, m)) return 'meta:' + (m === 'Estambul' ? 'lleva la yegua a Estambul' : m === 'Bagdad' ? 'lleva pistaches a Bagdad' : m === 'Damasco' ? 'va a Damasco a forjar' : 'va a Samarcanda por yeguas'); }
    if (j.dinares >= 10 && ruyanEn(pid, x.destino)) return 'explota:viaja a donde está Ruyán';
    if (j.pj === '6' && x.destino === 'Bagdad' && apuros(j)) return 'fortaleza:Zubayda vuelve a Bagdad (harén)';
    if (j.pj === 'B' && enCiudad(pid, x.destino) >= 2) return 'fortaleza:Yafar va donde hay gente (comisión)';
    return undefined;
  };
  const porReto = (pid, x) => {
    const pj = e.jugadores[pid].pj;
    if (pj === '3' && x.id === 'R26') return 'fortaleza:Anís repite R26';
    if (pj === '4' && ['R47', 'R48', 'R55'].includes(x.id)) return 'fortaleza:Jamil usa su persa (' + x.id + ')';
    if (pj === '2' && ['R46', 'R49', 'R55'].includes(x.id)) return 'fortaleza:Zein usa su árabe (' + x.id + ')';
    if (pj === '5' && ['R46', 'R49', 'R55'].includes(x.id)) return 'fortaleza:Ruyán usa su árabe (' + x.id + ')';
    return undefined;
  };
  const porPj = (pid, x) => {
    const j = e.jugadores[pid];
    if (x.sub === 'haren') return apuros(j) ? 'fortaleza:Zubayda se refugia en el harén' : 'fortaleza:Zubayda pasa la noche en el harén';
    if (x.sub === 'honra') return 'fortaleza:Jamil propone versos en honra';
    if (x.sub === 'satira') return 'fortaleza:Jamil canta sátira';
    if (x.sub === 'laud') return 'fortaleza:Jamil toca el laúd';
    return undefined;
  };
  const pesoAccion = (pid, x, base) => {
    const j = e.jugadores[pid];
    if (x.k === 'atacar') {
      if (j.pj === '6' && x.tipo === 'robo') { const m = x.objetivos.some((o) => { const D = e.jugadores[o]; return D && D.dinares >= 25 && desarmado(D) && !(D.pj === 'B'); }); return m ? base * 6 : base * 0.3; }   // Zubayda roba a quien trae dinero y va sin armas (Jorge, 20 de noviembre)
      const m = Math.max(...x.objetivos.map((o) => atractivo(pid, x.tipo, o)[0]));
      if (m === 0) return 0.01;
      let w = base * (m > 1 ? 2.5 : 1);
      if (j.pj === 'B') w *= j.ciudad === 'Bagdad' ? 3 : 2;                                   // Yafar: jambiya, destreza y Firmán
      if (j.pj === '1' && x.tipo === 'duelo') w *= 2;                                         // Nur al Din reta a duelo
      return w;
    }
    if (x.k === 'viajar') {
      if (j.ciudad === 'Estambul' && e.mongoles?.habilitado && e.mongoles.stock > 0 && !tieneItem(j, 'caballoMongol') && j.dinares >= 40) return base * 0.05;   // espera a comprar su mongol
      { const m = meta(pid); if (m && acerca(j.ciudad, x.destino, m)) return base * (m === 'Estambul' ? 20 : 6); }   // con la yegua, derecho a Estambul
      if (j.dinares >= 10 && ruyanEn(pid, x.destino)) return base * 3;
      if (j.pj === '6' && x.destino === 'Bagdad' && apuros(j)) return base * 3;
      if (j.pj === 'B') return base * (1 + 0.5 * Math.min(3, enCiudad(pid, x.destino)));
      if (j.pj === '7') return base * 1.6;                                                     // Adí paga caravanas caras sin miedo
      return base;
    }
    if (x.k === 'reto' && ['R18', 'R19', 'R42', 'R43', 'R25'].includes(x.id)) return 4;   // entrenar (Jorge, 20 de noviembre)
    if (x.k === 'esconder' && j.dinares >= 50) return 1.5;   // esconde la mitad con su papel amate
    if (x.k === 'reto' && x.id === 'R52') return 2;                                          // forjar acero de Damasco
    if (x.k === 'reto' && x.id === 'R47') return ['lampara', 'amate', 'buza'].every((r) => tieneItem(j, r)) ? 4 : 1.5;   // aprender árabe (Jorge, 20 de noviembre); con mecenas, siempre
    if (x.k === 'reto' && x.id === 'R54') return 1.5;
    if (j.pj === '6' && x.k === 'reto' && ['R19', 'R42', 'R18'].includes(x.id)) return 6;   // Zubayda entrena sus armas (50 noches)   // Zubayda entrena su jambiya (50 noches)
    if (j.pj === '6' && x.k === 'reto' && j.dinares >= 30) return base * 4;   // Zubayda gasta sus dinares en retos con noches
    if (x.k === 'reto' && x.id === 'R50') return j.dinares < 105 ? 0.02 : metas[pid]?.estepa ? 2 : 0.6;   // yeguas: solo con dinero para volver a Estambul
    if (x.k === 'reto' && porReto(pid, x)) return 1.2;
    if (x.k === 'usar' && j.pj === '3' && j.mano.find((c) => c.uid === x.uid)?.ref === 'OB42') return 0.6;
    if (x.k === 'asesinos' && j.pj === '6') return 0.6;
    if (x.k === 'venderFirmanYafar') return 0.02;                                             // Yafar conserva su Firmán
    if (x.k === 'pj' && x.sub === 'honra') return 0.8;
    if (x.k === 'pj' && x.sub === 'satira') return 0.3;
    if (x.k === 'pj' && x.sub === 'laud') return 0.25;   // 1 noche y 1 dinar: solo cuando no hay nada mejor que hacer
    if (x.k === 'pj' && x.sub === 'haren') return apuros(j) ? 2.5 : base + 0.3 * enCiudad(pid, 'Bagdad');
    return base;
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
      // «Que se calle Jamil»: mientras Jamil toca, cada uno de los demás lo calla una de cada tres veces; luego corre el reloj de la votación
      if (e.votoLaud) {
        const vl = e.votoLaud;
        for (const id of e.orden) { const x = e.jugadores[id]; if (e.votoLaud === vl && id !== vl.pid && x && !x.npc && !x.eliminado && R() < 0.34) { const r = act(id, { t: 'callarJamil' }); cuenta(r.ok ? stats.acciones : stats.errores, 'callarJamil' + (r.ok ? '' : ':' + r.error)); } }
        if (e.votoLaud === vl) { now += 41000; tick(data, e, now); }
        cuenta(stats.acciones, e.votoLaud ? 'votoLaud:sigue abierto' : 'votoLaud:cerrado');
        if (e.votoLaud === vl) e.votoLaud = null;
        continue;
      }
      const t = e.turno;
      if (!t) { now += 1000; tick(data, e, now); continue; }
      const pid = t.pid;
      if (e.jugadores[pid].npc) { now += 1000; tick(data, e, now); continue; }
      const tkey = e.ronda + ':' + pid; if (tkey !== turnoActual) { turnoActual = tkey; accionesTurno = 0; }
      // Sobrecargado, el bot vende lo que pese hasta poder viajar (si no, se queda atorado para siempre en una ciudad).
      if (t.fase !== 'ingreso' && !t.ccActual && cargaExcedida(e.jugadores[pid], e)) {
        for (const c of e.jugadores[pid].mano.filter((c) => pesaCarta(c, e.jugadores[pid])).slice()) { if (!cargaExcedida(e.jugadores[pid], e)) break; act(pid, { t: 'vender', uid: c.uid }); }
        // atorado: primero intenta comprarle un animal de carga a otro jugador de su ciudad (Jorge, 19 de noviembre); si nadie le vende, tira
        if (cargaExcedida(e.jugadores[pid], e)) {
          const yo = e.jugadores[pid];
          for (const x of ids) {
            const o = e.jugadores[x]; if (x === pid || !o || o.eliminado || o.npc || o.ciudad !== yo.ciudad) continue;
            const an = o.mano.find((c) => c.tipo === 'item' && ['caballo', 'camello', 'burro'].includes(c.ref)); if (!an) continue;
            const r0 = act(pid, { t: 'proponerTrato', con: x, ofrece: { dinares: Math.min(Math.max(0, yo.dinares), 30), objetos: [] }, pide: { dinares: 0, objetos: [an.uid] } });
            if (r0.ok) { const tr = Object.values(e.tratos).find((q) => q.de === pid && q.con === x); if (tr) { const r1 = act(x, { t: 'responderTrato', id: tr.id, ok: R() < 0.7 }); if (r1.ok && !cargaExcedida(yo, e)) { cuenta(stats.acciones, 'compra un animal a otro jugador para no quedar atorado'); break; } } }
          }
        }
        for (const c of e.jugadores[pid].mano.filter((c) => pesaCarta(c, e.jugadores[pid])).slice()) { if (!cargaExcedida(e.jugadores[pid], e)) break; act(pid, { t: 'tirar', uid: c.uid }); }   // si nadie le vende, tira lo que no se vende aquí
      }
      const v = vista(data, e, pid);
      const ac = v.acciones;
      if (!ac.length) { now += 1000; tick(data, e, now); continue; }
      const fin = ac.find((x) => x.k === 'terminarTurno');
      let elegida = null;
      // Zubayda (Jorge, 20 de noviembre): esconde la jambiya para ir «sin armas» (quien la ataque queda Buscado) y hace su ronda del
      // harén: primer tramo de Bagdad a una ciudad con caravana de regreso (noches de llegada y su Carta de Trivias), segundo tramo de
      // vuelta a Bagdad y entonces el harén. Si no le alcanza para ida y vuelta, el harén directo.
      let zubElegida = null;
      { const z = e.jugadores[pid], t = e.turno;
        if (z.pj === '6' && !z.npc && t) {
          if (z.mano.some((c) => c.tipo === 'item' && c.ref === 'jambiya' && !jambiyaEscondida(z, c)) && act(pid, { t: 'jambiya', ocultar: true }).ok) cuenta(stats.acciones, 'fortaleza:Zubayda esconde la jambiya');
          const haren = ac.find((x) => x.k === 'pj' && x.sub === 'haren' && !x.bloqueado);
          const vuelta = (d) => data.rutas.tarifas[`${d}>Bagdad`];
          const palacio = z.extra.viajePalacio && !t.tramos ? ac.filter((x) => x.k === 'viajar' && ['Yemen', 'El Cairo', 'Damasco'].includes(x.destino) && !x.precio) : [];
          if (palacio.length) { zubElegida = palacio.find((x) => x.destino === 'Yemen' && !z.extra?.entrenado?.jambiya) || palacio[Math.floor(R() * palacio.length)]; cuenta(stats.acciones, 'fortaleza:Zubayda usa su viaje gratis a los palacios'); }   // Jorge (20 de noviembre)
          else if (z.ciudad === 'Bagdad' && !t.tramos && !t.principal) {
            // Solo cuando conviene (Jorge, 20 de noviembre): noches ya multiplicadas (×2 o más), que la ciudad dé al menos 10 noches
            // con el multiplicador y que tras pagar ida y vuelta le queden al menos 10 dinares. Si no, harén directo, como siempre.
            const mult = multiplicadorRonda(data, e.ronda, Object.values(e.jugadores).filter((x) => !x.eliminado).length);
            const nochesEn = (d) => { const c = data.ciudades.ciudades.find((q) => q.id === d); return c ? (z.visitadas?.includes(d) ? c.nochesLuego : c.nochesLlegada) * mult : 0; };
            const ida = mult < 2 ? [] : ac.filter((x) => x.k === 'viajar' && vuelta(x.destino) != null && x.destino !== 'Jorasán' && nochesEn(x.destino) >= 10 && z.dinares >= (x.precio || 0) + vuelta(x.destino) + 10)
              .sort((p, q) => (p.precio || 0) + vuelta(p.destino) - (q.precio || 0) - vuelta(q.destino));
            if (ida.length) { zubElegida = ida[Math.floor(R() * Math.min(3, ida.length))]; zubRonda[pid] = true; }
            else if (haren) zubElegida = haren;
          } else if (zubRonda[pid] && z.ciudad !== 'Bagdad' && t.tramos === 1) zubElegida = ac.find((x) => x.k === 'viajar' && x.destino === 'Bagdad') || null;
          else if (z.ciudad === 'Bagdad' && haren && zubRonda[pid]) { zubElegida = haren; zubRonda[pid] = false; }
          if (zubElegida) cuenta(stats.acciones, 'fortaleza:Zubayda ronda del harén (' + (zubElegida.k === 'viajar' ? 'tramo' : 'harén') + ')');
        }
      }
      accionesTurno++;
      if (ac.find((x) => x.k === 'cc')) elegida = ac.find((x) => x.k === 'cc');
      else if (zubElegida) elegida = zubElegida;
      else if (e.asesinos?.pendiente?.victima === pid && e.jugadores[pid].extra.masrur && ac.find((x) => x.k === 'tesoro' && x.sub === 'jorasan')) elegida = ac.find((x) => x.k === 'tesoro' && x.sub === 'jorasan');   // avisado por Masrur: huye al Jorasán
      else if (fin && (e.carrerasActivas || []).some((c) => c.ciudad === e.jugadores[pid].ciudad) && !t.movio && (e.jugadores[pid].pj === '6' || R() < 0.6)) elegida = fin;   // carrera de «dos noches»: se queda
      else if (accionesTurno > 14 && fin) elegida = fin;
      else {
        const peso = { tirarDados: 100, cc: 100, viajar: 0.5, atacar: 0.2, reto: 0.35, tesoro: 0.3, esconder: 0.1, recuperar: 0.4, usar: 0.3, asesinos: 0.3, pj: 0.4, terminarTurno: 0.15 };
        const cand = ac.filter((x) => !x.bloqueado);
        let tot = 0; const w = cand.map((x) => { const p = pesoAccion(pid, x, peso[x.k] ?? 0.1); tot += p; return p; });
        let r = R() * tot; elegida = cand[0];
        for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) { elegida = cand[i]; break; } }
      }
      let a = null;
      switch (elegida.k) {
        case 'tirarDados': a = { t: 'tirarDados' }; break;
        case 'cc': { const cc = t.ccActual; a = cc?.tipo === 'trivia' ? { t: 'responderCC', opcion: Math.floor(R() * (data.trivias.trivias.find((x) => x.id === cc.id)?.opciones.length || 3)) } : { t: 'resolverMesa', ok: R() < 0.5 }; break; }
        case 'viajar': { a = { t: 'viajar', destino: elegida.destino }; const j = e.jugadores[pid];
          a._por = porViaje(pid, elegida); break; }
        case 'atacar': if (elegida.tipo === 'duelo' && e.jugadores[pid].herido) a = { t: 'terminarTurno' };   // herido, no se arriesga a un duelo
          else { const [obj, por] = objetivoAtaque(pid, elegida); a = { t: 'atacar', tipo: elegida.tipo, objetivo: obj, pedirDinares: e.jugadores[pid].pj === '1' && HONOR.includes(e.jugadores[pid].ciudad) ? 10 + Math.floor(R() * 11) : 5, pedirNoches: 0, _por: por }; }
          break;
        case 'reto': a = { t: 'reto', id: elegida.id, sub: elegida.sub, _por: porReto(pid, elegida) }; break;
        case 'tesoro': a = { t: 'tesoro', sub: elegida.sub, uid: elegida.uid, via: elegida.via }; break;
        case 'esconder': a = { t: 'esconder', monto: e.jugadores[pid].dinares >= 50 ? Math.floor(e.jugadores[pid].dinares / 2) : 1 + Math.floor(R() * Math.max(1, e.jugadores[pid].dinares - 1)) }; break;
        case 'recuperar': a = { t: 'recuperar' }; break;
        case 'usar': a = { _por: e.jugadores[pid].mano.find((c) => c.uid === elegida.uid)?.ref === 'OB42' && e.jugadores[pid].pj === '3' ? 'fortaleza:Anís usa su disfraz' : undefined, t: 'usar', uid: elegida.uid, via: elegida.via, destino: elegida.destinos ? pick(elegida.destinos) : undefined, objetivo: elegida.objetivos ? pick(elegida.objetivos) : undefined, deseo: elegida.ifrit ? pick(elegida.ifrit) : undefined }; break;
        case 'asesinos': { const zub = e.jugadores[pid].pj === '6';   // solo si casi seguro le alcanza (a Zubayda le cuestan la mitad)
          a = e.jugadores[pid].dinares >= 6 * Math.max(1, e.ronda) * 35 / (zub ? 2 : 1) ? { t: 'asesinos', _por: zub ? 'fortaleza:Zubayda contrata a los Asesinos a mitad de precio' : undefined } : { t: 'terminarTurno' }; break; }
        case 'pj': a = { _por: porPj(pid, elegida), t: 'pj', sub: elegida.sub, con: elegida.objetivos ? pick(elegida.objetivos) : undefined, precio: 10 }; break;
        case 'terminarTurno': a = { t: 'terminarTurno' }; break;
        default: a = { t: 'terminarTurno' };
      }
      if (R() < 0.12 && !t.ccActual && t.fase !== 'ingreso') {                                  // compras y ventas al azar
        const j = e.jugadores[pid];
        const q = R();
        const ahorra = (x) => metas[x]?.estepa && !(e.jugadores[x].retosHechos || []).includes('R50') && R() < 0.97;   // junta para las yeguas
        // el mercado vende fuera de tu turno: compra otro jugador (Yafar NPC, en el suyo)
        const fuera = ids.filter((x) => x !== pid && !e.jugadores[x].eliminado && !e.jugadores[x].npc);
        const comprador = e.jugadores[pid].npc ? pid : fuera.length ? pick(fuera) : pid;
        if (ahorra(comprador)) { /* no gasta */ } else if (q < 0.4) { const o = pick(data.objetos.mazo); const r0 = act(comprador, { t: 'comprar', id: o.id }); cuenta(stats.acciones, 'comprar:' + (r0.ok ? 'ok' : 'x')); }
        else if (q < 0.6) { const ref = e.jugadores[comprador].ciudad === 'Basra' && R() < 0.5 ? 'burro' : pick(['arco', 'flechas', 'alfanje', 'cimitarra', 'vino', 'buza', 'cesta']); const r0 = act(ref === 'ifrit' ? pid : comprador, { t: 'comprar', ref }); cuenta(stats.acciones, 'comprarRef:' + (r0.ok ? 'ok' : 'x')); }
        else if (q < 0.8 && j.mano.length) { const c = pick(j.mano); const r0 = act(pid, { t: 'vender', uid: c.uid }); cuenta(stats.acciones, 'vender:' + (r0.ok ? 'ok' : 'x')); }
        else if (q < 0.9) { const o = ids.filter((x) => x !== pid && !e.jugadores[x].eliminado && e.jugadores[x].ciudad === j.ciudad); if (o.length) { const r0 = act(pid, { t: 'proponerTrato', con: pick(o), ofrece: { dinares: 3, objetos: j.mano.slice(0, 1).map((c) => c.uid) }, pide: { dinares: 1, objetos: [] } }); cuenta(stats.acciones, 'trato:' + (r0.ok ? 'ok' : 'x')); } }
        else { const r0 = act(pid, { t: 'comprar', ref: 'firman' }); cuenta(stats.acciones, 'firman:' + (r0.ok ? 'ok' : 'x')); }
      }
      if (R() < 0.15 && !t.ccActual && t.fase !== 'ingreso') {                                  // compras útiles para los retos
        const fuera = ids.filter((x) => x !== pid && !e.jugadores[x].eliminado && !e.jugadores[x].npc && !e.jugadores[x].transito && !e.jugadores[x].perdido);
        const pesos = fuera.map((x) => (e.jugadores[x].pj === '7' ? 3 : 1));
        let rb = R() * pesos.reduce((a, w) => a + w, 0), b = fuera.length ? fuera[fuera.length - 1] : pid;
        for (let i = 0; i < fuera.length; i++) { rb -= pesos[i]; if (rb <= 0) { b = fuera[i]; break; } }
        { const enEst = fuera.filter((x) => e.jugadores[x].ciudad === 'Estambul' && e.jugadores[x].dinares >= 40 && !tieneItem(e.jugadores[x], 'caballoMongol'));
          if (e.mongoles?.habilitado && e.mongoles.stock > 0 && enEst.length && R() < 0.6) b = pick(enEst); }   // hay caballos mongoles: va por uno
        const jb = e.jugadores[b], c = jb.ciudad, op = [];
        if (jb.pj === '7' && desarmado(jb) && jb.dinares >= 25) op.push([{ ref: 'jambiya' }, 3]);
        if (jb.pj === '7' && !tieneItem(jb, 'arco') && jb.dinares >= 30) op.push([{ ref: 'arco' }, 2]);
        if (jb.pj === '7' && ['Basra', 'Aleppo', 'Damasco'].includes(c) && !['burro', 'camello', 'caballo', 'caballoMongol'].some((r) => tieneItem(jb, r)) && jb.dinares >= 35) op.push([{ ref: 'burro' }, 3]);
        if (jb.pj === 'B' && !tieneItem(jb, 'arco') && jb.dinares >= 25) op.push([{ ref: 'arco' }, 2]);
        // Jorge (20 de noviembre): armas, papel amate y alforja para todos
        if (!tieneItem(jb, 'jambiya') && jb.dinares >= 20) op.push([{ ref: 'jambiya' }, ['2', '6'].includes(jb.pj) ? 6 : desarmado(jb) ? 1.5 : 0.3]);   // Zein (destreza en jambiya) y Zubayda (la esconde) primero
        if (jb.pj === '1' && !tieneItem(jb, 'cimitarra') && jb.dinares >= 45) op.push([{ ref: 'cimitarra' }, 4]);   // Nur al Din ya está entrenado con la cimitarra
        if (!['2', '5', '6'].includes(jb.pj) && desarmado(jb) === false && !tieneItem(jb, 'alfanje') && !tieneItem(jb, 'cimitarra') && jb.dinares >= 60) op.push([{ ref: 'alfanje' }, 1]);
        if (!tieneItem(jb, 'amate') && jb.dinares >= 50) op.push([{ ref: 'amate' }, 1]);   // para esconder dinares
        if (c === 'Basra' && !['burro', 'camello', 'caballo', 'caballoMongol'].some((r) => tieneItem(jb, r)) && !tieneItem(jb, 'alforja') && nCarga(jb) >= 5 && jb.dinares >= 15) op.push([{ ref: 'alforja' }, 2]);
        if (jb.pj === '6' && !jb.npc && !tieneItem(jb, 'alfanje') && !tieneItem(jb, 'cimitarra') && (jb.extra?.entrenado?.jambiya || jb.dinares >= 60)) {   // Zubayda compra arma para entrenarla (Jorge, 20 de noviembre)
          if (jb.dinares >= 50) op.push([{ ref: 'alfanje' }, 6]);
          if (jb.dinares >= 70) op.push([{ ref: 'cimitarra' }, 3]);
        }
        const hecho = (id) => (jb.retosHechos || []).includes(id);
        if (!tieneItem(jb, 'citricos') && jb.dinares >= 10) op.push([{ ref: 'citricos' }, 3]);
        if (jb.pj !== 'B' && !hecho('R47') && !tieneItem(jb, 'lampara') && c !== 'India' && jb.dinares >= 14) op.push([{ ref: 'lampara' }, 1.5]);   // Lámpara de aceite (Jorge, 20 de noviembre)
        if (tieneItem(jb, 'lampara') && !tieneItem(jb, 'amate') && jb.dinares >= 4) op.push([{ ref: 'amate' }, 3]);
        if (tieneItem(jb, 'lampara') && !tieneItem(jb, 'buza') && ['Damasco', 'Basra'].includes(c) && jb.dinares >= 4) op.push([{ ref: 'buza' }, 3]);
        if (c === 'Isfahán' && !tieneItem(jb, 'costalPistaches') && jb.dinares >= 12) op.push([{ ref: 'costalPistaches', n: 2 + Math.floor(R() * 4) }, 5]);   // R56
        if ((c === 'Basra' || c === 'Andalucía') && !tieneItem(jb, 'vino') && jb.dinares >= 30) op.push([{ ref: 'vino' }, 1.5]);   // vino: +2 por ronda, se vende en cualquier mercado
        if (DATILES.ciudades.includes(c) && !hecho(DATILES.reto) && !tieneItem(jb, 'almudDatiles') && jb.dinares >= 6) op.push([{ ref: 'almudDatiles' }, 2]);
        if (c === SHATRANJ.ciudad && !tieneItem(jb, 'shatranj') && jb.dinares >= SHATRANJ.precio + 5) op.push([{ ref: 'shatranj' }, 2]);
        if (c === 'Estambul' && e.mongoles?.habilitado && e.mongoles.stock > 0 && !tieneItem(jb, 'caballoMongol') && jb.dinares >= 40) op.push([{ ref: 'caballoMongol' }, 4]);
        if ((c === 'Basra' || c === 'Bagdad') && !tieneItem(jb, 'cesta') && !hecho('R24')) op.push([{ ref: 'cesta' }, 1.5]);
        for (const [id, w] of Object.entries(OBJ_RETOS)) { const o = data.objetos.mazo.find((x) => x.id === id); if (id === 'OB21' && !e.pistachesBagdad) continue; if (o && seVendeEn(o, c) && !tieneObj(jb, id) && jb.dinares >= o.valor + 5) op.push([{ id }, w]); }
        if (op.length && !(metas[b]?.estepa && !(jb.retosHechos || []).includes('R50') && R() < 0.97)) {
          let r = R() * op.reduce((a, x) => a + x[1], 0), q = op[0][0];
          for (const [x, w] of op) { r -= w; if (r <= 0) { q = x; break; } }
          const r0 = act(b, { t: 'comprar', ...q }); cuenta(stats.acciones, 'util:' + (q.ref || q.id) + ':' + (r0.ok ? 'ok' : 'x'));
          if (r0.ok && jb.pj === '7') cuenta(stats.acciones, 'fortaleza:Adí compra con su dinero (' + (q.ref || q.id) + ')');
          if (r0.ok && jb.pj === 'B' && q.ref === 'arco') cuenta(stats.acciones, 'fortaleza:Yafar compra el arco (lo usa en Bagdad con su Firmán)');
        }
      }
      {                                                                                          // y vende lo que conviene vender ahí (en su turno)
        const j = e.jugadores[pid], c = j.ciudad;
        const sh = SHATRANJ.venta[c] && tieneItem(j, 'shatranj'), da = c === DATILES.ciudadVenta && tieneItem(j, 'almudDatiles'), ye = c === 'Estambul' && tieneItem(j, 'yegua'), vi = c !== 'Jorasán' && tieneItem(j, 'vino') && R() < 0.12;
        if ((sh || da || ye || vi) && R() < (ye ? 0.9 : vi ? 1 : 0.5) && !t.ccActual && t.fase !== 'ingreso') { const k = ye ? 'yegua' : sh ? 'shatranj' : da ? 'almudDatiles' : 'vino'; const r0 = act(pid, { t: 'vender', uid: tieneItem(j, k).uid }); cuenta(stats.acciones, 'utilVende:' + k + ':' + (r0.ok ? 'ok' : 'x')); }
      }
      if (!Object.keys(e.tratos).length && !t.ccActual) {
        const j = e.jugadores[pid], aqui = ids.filter((x) => x !== pid && !e.jugadores[x].eliminado && !e.jugadores[x].npc && !e.jugadores[x].transito && e.jugadores[x].ciudad === j.ciudad);
        const dueños = aqui.filter((x) => tieneItem(e.jugadores[x], 'dadosCairo') || tieneItem(e.jugadores[x], 'dadosPersia'));
        if (dueños.length && j.dinares >= 50 && R() < (j.pj === '7' ? 0.15 : 0.05)) {                    // comprarle los dados a Zein o a Anís
          const d = pick(dueños), D = e.jugadores[d], c = tieneItem(D, 'dadosCairo') || tieneItem(D, 'dadosPersia');
          const r0 = act(pid, { t: 'proponerTrato', con: d, ofrece: { dinares: 40, objetos: [] }, pide: { dinares: 0, objetos: [c.uid] } });
          if (r0.ok) cuenta(stats.acciones, j.pj === '7' ? 'fortaleza:Adí ofrece comprar los dados' : 'explota:ofrece comprar los dados');
        } else if (j.pj === '5' && j.dinares < 10 && j.noches >= 60 && aqui.length && R() < 0.15) {        // Ruyán corto de dinares vende noches
          const r0 = act(pid, { t: 'proponerTrato', con: pick(aqui), ofrece: { dinares: 0, noches: 20, objetos: [] }, pide: { dinares: 10, objetos: [] } });
          if (r0.ok) cuenta(stats.acciones, 'fortaleza:Ruyán ofrece 20 noches por 10 dinares');
        }
      }
      if (e.jugadores[pid].pj === '2' && e.jugadores[pid].dinares < 10 && tieneItem(e.jugadores[pid], 'dadosCairo') && !t.ccActual && t.fase !== 'ingreso' && R() < 0.1) {   // Zein en apuros vende sus dados
        const r0 = act(pid, { t: 'vender', uid: tieneItem(e.jugadores[pid], 'dadosCairo').uid }); if (r0.ok) cuenta(stats.acciones, 'fortaleza:Zein vende los Dados del Cairo en apuros');
      }
      const tr = Object.values(e.tratos);
      if (tr.length) {
        const x = tr[0], D = e.jugadores[x.con], uids = x.pide?.objetos || [];
        const pideDados = uids.some((u) => D?.mano.some((c) => c.uid === u && (c.ref === 'dadosCairo' || c.ref === 'dadosPersia')));
        const r0 = act(x.con, { t: 'responderTrato', id: x.id, ok: R() < (pideDados ? 0.35 : 0.7) });
        if (r0.ok && pideDados && !D.mano.some((c) => uids.includes(c.uid))) cuenta(stats.acciones, 'explota:vende sus dados en un trato');
        if (r0.ok && e.jugadores[x.de]?.pj === '5' && x.ofrece?.noches && !e.tratos[x.id] && e.jugadores[x.de].extra) { /* el trato se cerró o se rechazó */ }
      }
      const por = a._por; delete a._por;
      const r = act(pid, a);
      cuenta(stats.acciones, a.t + (a.sub ? ':' + a.sub : '') + ':' + (r.ok ? 'ok' : 'x'));
      if (r.ok && por) cuenta(stats.acciones, por.startsWith('meta:') ? 'fortaleza:' + por.slice(5) : por.startsWith('costo:') ? 'explota:' + por.slice(6) : por);
      if (r.ok && a.t === 'atacar' && e.jugadores[a.objetivo] && ['2', '6'].includes(e.jugadores[a.objetivo].pj) && e.log.slice(-6).some((l) => / \((Zein|Zubayda)\): queda Buscado durante /.test(l.texto || ''))) cuenta(stats.acciones, 'buscadoMujer:' + (e.jugadores[a.objetivo].pj === '2' ? 'Zein' : 'Zubayda') + ' · ' + a.tipo);
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
    for (const k of ['dinares', 'noches']) if (!Number.isFinite(j[k])) throw new Error(`${j.nombre}.${k} = ${j[k]}`);   // dinares (deuda con el banco) y noches (Jorge, 19 de noviembre) pueden quedar en negativo
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
