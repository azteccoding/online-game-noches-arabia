// Retos y misiones R1-R39 (R 14), Mensajes de los sheijs (R 18) y carta de Kanmakán (R 15.5).
// Los retos con varios pasos usan decisiones pendientes (pend) con continuaciones registradas; los plazos cuentan turnos PROPIOS (R 14.1).
import {
  ok, err, dado, dados, suma, par, log, nombre, ciudadDe, objDe, activos, humanosVivos, enCiudad, tieneItem, tieneObj, tieneEsp, quitarCarta, quitarPrimero, uid, darItem, darObjeto, pagar, patrimonio,
  publicarCarta, cartaDatos, eliminar, TESOROS, HOOK, esLibro, valorLibro, mostrarDados, consumirObj, info, pedir, registrar, CONT, ofrecerObjetos, devolverObjeto, recortarMano, robarBotin, ITEMS, puedePrincipal, tarifa,
} from './base.js';
import { peleaNPC, perfil, armasUsables } from './pelea.js';

const m1 = (data, id) => data.retos.retos.find((r) => r.id === id);

// ---------------------------------------------------------------- utilidades
function nuevoCtx(e, pid, id) { return { grupos: [], res: [], t(etq, n = 1) { const v = dados(e, n); this.grupos.push({ etq, valores: v }); return v; }, say(x) { this.res.push(x); }, fin() { if (this.grupos.length) mostrarDados(e, { por: pid, motivo: 'reto:' + id, grupos: this.grupos, resumen: [`Reto ${id}:`, ...this.res] }); else for (const r of this.res) log(e, r, { pid }); } }; }
const nProb = (e) => activos(e).length;
export function premio(data, e, pid, { dinares = 0, noches = 0 }, texto = '') {
  const j = e.jugadores[pid];
  j.dinares += dinares; j.noches += noches;
  if (texto) log(e, texto + `${dinares ? ' +' + dinares + ' dinares' : ''}${noches ? ' +' + noches + ' noches' : ''}.`, { pid });
}
const cobrarFijo = (data, e, pid, monto) => { const j = e.jugadores[pid]; if (j.dinares < monto) return false; j.dinares -= monto; return true; };
function hacer(e, pid, id) { const j = e.jugadores[pid]; if (!j.retosHechos.includes(id)) j.retosHechos.push(id); }
const REPETIBLES = ['R8', 'R9'];
const libroNuevo = (e) => ({ valor: nProb(e) * 4, ronda: e.ronda });
export function darLibro(e, pid, ref = 'libro') { return darItem(e, e.jugadores[pid], ref, libroNuevo(e)); }
const bonoCim = (data) => data.config.armas?.cimitarra?.bono ?? 2;
function tomarDeBotin(data, e, pid, id) {
  const i = e.mazos.botin.indexOf(id);
  if (i < 0) return null;
  e.mazos.botin.splice(i, 1);
  const c = darObjeto(data, e, pid, id);
  publicarCarta(e, cartaDatos(data, 'objeto', id), pid, [pid]);
  return c;
}
const tieneArma = (data, e, j) => armasUsables(data, e, j, j.ciudad).length > 0 || ['arco', 'alfanje', 'cimitarra', 'jambiya'].some((r) => tieneItem(j, r));

// ---------------------------------------------------------------- catálogo (ciudad, objetos usables, requisito, ejecución)
const T = {};   // T[id] = { ciudad, objs, req(data,e,pid)->string|null, run(data,e,pid,ctx,usados) }
const OBJS = {
  R28: ['OB07', 'OB43', 'OB08', 'OB06', 'OB09'], R29: ['OB05', 'OB18'], R30: ['OB14', 'OB17', 'OB21'], R31: ['OB07', 'OB41', 'OB43', 'OB08', 'OB06'], R33: ['OB10', 'OB05', 'OB08'],
  R34: ['OB09', 'OB06', 'OB26'], R35: ['OB30'], R37: ['OB21', 'OB30'], R38: ['OB13'],
};
const hecho = (j, id) => j.retosHechos.includes(id);

export function disponibles(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, r = [];
  if (!puedePrincipal(t) || j.transito || j.perdido) return r;
  for (const id of Object.keys(T)) {
    const d = m1(data, id);
    if (!d || d.ciudad !== j.ciudad) continue;
    if (hecho(j, id) && !(REPETIBLES.includes(id) && !j.extra.rep?.[id])) continue;
    if (j.misiones.some((m) => m.id === id)) continue;
    const msg = T[id].req ? T[id].req(data, e, pid) : null;
    r.push({ k: 'reto', id, titulo: id + ' · ' + d.nombre, texto: d.resolucion, requisito: d.requisito, premio: d.premio, bloqueado: msg || undefined });
  }
  const deuda = j.misiones.find((m) => m.id === 'R1' && m.deuda > 0 && j.ciudad === 'Bagdad');
  if (deuda) r.push({ k: 'reto', id: 'R1', sub: 'pagar', titulo: `R1 · Pagar la deuda con la ciudad (${deuda.deuda} dinares)`, texto: j.dinares >= deuda.deuda ? 'Pagas con dinares y quedas libre para salir de Bagdad.' : 'No te alcanzan los dinares: pagas con TODAS tus noches y quedas libre para salir.' });
  return r;
}

export function iniciarReto(data, e, pid, a) {
  const j = e.jugadores[pid], t = e.turno;
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (a.sub === 'pagar') {
    const m = j.misiones.find((x) => x.id === 'R1' && x.deuda > 0);
    if (!m) return err('No debes nada.');
    pagarDeudaR1(e, j, m); return ok();
  }
  if (!puedePrincipal(t)) return err('No tienes acción principal disponible.');
  const def = T[a.id], d = m1(data, a.id);
  if (!def) return err('Reto inexistente.');
  if (j.ciudad !== d.ciudad) return err(`Ese reto está en ${d.ciudad}.`);
  if (j.transito || j.perdido) return err('No puedes ahora.');
  if (hecho(j, a.id) && !(REPETIBLES.includes(a.id) && !j.extra.rep?.[a.id])) return err('Ya completaste ese reto.');
  if (j.misiones.some((m) => m.id === a.id)) return err('Ya lo tienes en curso.');
  const msg = def.req ? def.req(data, e, pid) : null;
  if (msg) return err(msg);
  t.principal = true;
  log(e, `${j.nombre} intenta el reto ${a.id}: ${d.nombre}.`, { pid });
  const ids = OBJS[a.id];
  if (ids) ofrecerObjetos(data, e, pid, { ids, max: 2, titulo: `Reto ${a.id}: objetos`, texto: 'Puedes usar hasta 2 objetos (R 15.2). Elige los que quieras usar.', cont: { fn: 'reto.obj', args: { id: a.id } } });
  else ejecutar(data, e, pid, a.id, []);
  return ok();
}
registrar('reto.obj', (data, e, args, resp) => ejecutar(data, e, resp.pid, args.id, (resp.valores || []).map((u) => e.jugadores[resp.pid].mano.find((c) => c.uid === u)?.ref).filter(Boolean)));
function ejecutar(data, e, pid, id, usados) {
  const ctx = nuevoCtx(e, pid, id);
  T[id].run(data, e, pid, ctx, usados);
  ctx.fin();
}
const usa = (data, e, pid, usados, id) => { if (!usados.includes(id)) return false; return consumirObj(data, e, pid, id); };

// ---------------------------------------------------------------- misiones con plazo
function nuevaMision(e, pid, m, turnosPlazo) {
  const j = e.jugadores[pid];
  const mis = { limite: turnosPlazo ? j.turnos + turnosPlazo - 1 : null, ...m };
  j.misiones.push(mis); return mis;
}
const quitarMision = (j, m) => { const i = j.misiones.indexOf(m); if (i >= 0) j.misiones.splice(i, 1); };
function quitarCarga(e, pid, m) { const j = e.jugadores[pid]; for (const c of (m.carga || [])) { const x = j.mano.find((q) => q.uid === c.uid); if (x) quitarCarta(j, x.uid); } }
const cargaCompleta = (j, m) => (m.carga || []).every((c) => j.mano.some((q) => q.uid === c.uid));
function perder(data, e, pid, m, motivo) {
  const j = e.jugadores[pid];
  quitarCarga(e, pid, m); quitarMision(j, m);
  log(e, `${j.nombre} pierde el reto ${m.id}${motivo ? ' (' + motivo + ')' : ''}.`, { pid });
  const f = FALLO[m.id]; if (f) f(data, e, pid, m);
}
const FALLO = {
  R10: () => {}, R4: () => {}, R24: () => {}, R7: () => {}, R23: () => {},
  R30: (data, e, pid) => { pagar(data, e, pid, 10); }, R39: (data, e, pid) => { pagar(data, e, pid, 10); },
  R3: (data, e, pid, m) => {
    const j = e.jugadores[pid];
    for (let i = 0; i < 2; i++) quitarPrimero(j, 'item', 'esclava');
    quitarPrimero(j, 'item', 'mapa');
    pagar(data, e, pid, 30); log(e, `${j.nombre} devuelve el mapa y las esclavas y paga 30 dinares a la ciudad.`, { pid });
  },
  R2: (data, e, pid) => { pagar(data, e, pid, 50); e.jugadores[pid].extra.noBagdad = e.jugadores[pid].turnos + 2; },
};

export function inicioTurno(data, e, pid) {
  const j = e.jugadores[pid];
  for (const c of j.mano.slice()) if (c.tipo === 'item' && c.ref === 'veneno' && j.turnos - (c.extra?.turnos ?? j.turnos) >= 3) quitarCarta(j, c.uid);
  for (const m of j.misiones.slice()) {
    if (m.id === 'R1') { r1Turno(data, e, pid, m); if (j.eliminado) return; continue; }
    if (m.limite != null && j.turnos > m.limite) perder(data, e, pid, m, 'plazo vencido');
    else if (m.carga && !cargaCompleta(j, m)) perder(data, e, pid, m, 'perdiste la carga');
  }
}
export function finTurno(data, e, pid) {}

export function alLlegar(data, e, pid, origen) {
  const j = e.jugadores[pid];
  e.ultimaCiudadVisita ||= {};
  if (j.ciudad === 'Damasco') e.ultimoDamasco = pid;
  if (j.extra.rep) for (const id of Object.keys(j.extra.rep)) if (m1(data, id).ciudad !== j.ciudad) delete j.extra.rep[id];
  for (const m of j.misiones.slice()) {
    if (m.id === 'R3') { if (j.ciudad === 'Estambul') m.visito = true; if (j.ciudad === 'Bagdad' && m.visito) completarR3(data, e, pid, m); continue; }
    if (m.id === 'R29') { if (j.ciudad === 'Bagdad') { quitarMision(j, m); premio(data, e, pid, { dinares: 40, noches: 15 }, 'Cruzas el desierto con tu camello.'); hacer(e, pid, 'R29'); } else if (!j.transito) perder(data, e, pid, m, 'te desviaste'); continue; }
    if (m.destino && m.destino === j.ciudad) entregar(data, e, pid, m);
  }
}
function entregar(data, e, pid, m) {
  const j = e.jugadores[pid];
  if (m.limite != null && j.turnos > m.limite) return perder(data, e, pid, m, 'llegaste tarde');
  if (!cargaCompleta(j, m)) return perder(data, e, pid, m, 'perdiste la carga');
  const n = (m.carga || []).length;
  let pr = { dinares: 0, noches: 0 };
  switch (m.id) {
    case 'R10': pr = { dinares: 70, noches: 15 }; break;
    case 'R30': pr = { dinares: 60, noches: 15 }; break;
    case 'R39': pr = { dinares: 45, noches: 10 }; break;
    case 'R24': pr = { dinares: 30 }; break;
    case 'R23': pr = { dinares: 40 * n }; break;
    case 'R4': {
      let din = 0; for (const c of m.carga) { const q = j.mano.find((x) => x.uid === c.uid); din += valorLibro(data, e, q) + 20; }
      pr = { dinares: din, noches: 15 }; break;
    }
    default: break;
  }
  quitarCarga(e, pid, m); quitarMision(j, m); hacer(e, pid, m.id);
  premio(data, e, pid, pr, `${j.nombre} entrega su encargo (${m.id}):`);
}
function completarR3(data, e, pid, m) {
  const j = e.jugadores[pid];
  if (m.limite != null && j.turnos > m.limite) return perder(data, e, pid, m, 'llegaste tarde');
  const x = dado(e);
  mostrarDados(e, { por: pid, motivo: 'reto:R3', grupos: [{ etq: `${j.nombre} informa al Califa`, valores: [x] }], resumen: [`Dado ${x}: cobra ${5 * x} dinares.`] });
  for (let i = 0; i < 2; i++) quitarPrimero(j, 'item', 'esclava'); quitarPrimero(j, 'item', 'mapa');
  quitarMision(j, m); hacer(e, pid, 'R3'); premio(data, e, pid, { dinares: 5 * x }, `${j.nombre} cumple las órdenes del Califa.`);
}

export function misionesVista(data, e, pid) {
  const j = e.jugadores[pid];
  return j.misiones.map((m) => ({ id: m.id, nombre: m1(data, m.id)?.nombre, destino: m.destino || null, turnosRestantes: m.limite != null ? Math.max(0, m.limite - j.turnos + 1) : null, deuda: m.deuda || null, objetivo: m.objetivo ? nombre(e, m.objetivo) : null, texto: m.texto || null }));
}
export const tras = () => {};

// ---------------------------------------------------------------- el alta de misiones desde la eliminación (R2)
export function alEliminar(data, e, victima, por) {
  if (!por) return;
  const j = e.jugadores[por];
  const m = j?.misiones.find((x) => x.id === 'R2' && x.objetivo === victima);
  if (m) { quitarMision(j, m); hacer(e, por, 'R2'); darItem(e, j, 'astrolabio'); if (!tieneItem(j, 'alfanje')) darItem(e, j, 'alfanje'); premio(data, e, por, { dinares: 100 }, `${j.nombre} cumple el encargo de Yafar (R2):`); }
}
HOOK.alEliminar = alEliminar;

// ---------------------------------------------------------------- R1 (Éufrates)
function r1Turno(data, e, pid, m) {
  const j = e.jugadores[pid];
  if (m.busca) {
    const ctx = nuevoCtx(e, pid, 'R1');
    const v = ctx.t(`${j.nombre} y ${m.ayudantes} ayudante(s)`, 1 + m.ayudantes);
    m.busca = false;                                                       // regla de la casa: la deuda ya no se duplica
    if (v.some((x) => x <= 2)) { ctx.say('¡Encuentras el cofre!'); r1Exito(data, e, pid, m); }
    else ctx.say('No hay cofre: abandonas la búsqueda y sigues debiendo el alojamiento. No puedes salir de Bagdad hasta pagarlo.');
    ctx.fin();
    j.misiones.find((x) => x.id === 'R1') && (m.vence ??= j.turnos + 3);
    return;
  }
  if (m.deuda > 0 && j.turnos > m.vence) {
    pagarDeudaR1(e, j, m);                                                 // regla de la casa: sin dinares, se paga con todas las noches (ya no hay crucifixión)
  }
}
function pagarDeudaR1(e, j, m) {
  if (j.dinares >= m.deuda) { j.dinares -= m.deuda; log(e, `${j.nombre} paga su deuda con la ciudad de Bagdad (${m.deuda} dinares).`, { pid: j.id }); }
  else { log(e, `${j.nombre} no tiene dinares para su deuda con Bagdad y la paga con todas sus noches (${j.noches}).`, { pid: j.id }); j.noches = 0; }
  quitarMision(j, m);
}
function r1Exito(data, e, pid, m) {
  const j = e.jugadores[pid];
  quitarMision(j, m); hacer(e, pid, 'R1');
  darItem(e, j, 'camello'); darItem(e, j, 'caballo'); darItem(e, j, 'pergamino'); j.extra.viajeCalifa = true;
  premio(data, e, pid, { dinares: 50, noches: 50 }, `${j.nombre} halla el cofre del Éufrates:`);
  pagar(data, e, pid, m.deuda);
}
T.R1 = { ciudad: 'Bagdad', req: (data, e, pid) => (e.jugadores[pid].misiones.some((m) => m.id === 'R1') ? 'Ya lo tienes en curso.' : null),
  run(data, e, pid, ctx) {
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R1 · Buscar un cofre en el Éufrates', texto: 'Si aceptas, tu turno termina mientras buscas y contraes una deuda con la ciudad (alojamiento 15 + 2 por ayudante). Si rechazas, vas en burro a Basra y no puedes volver a Bagdad en 2 turnos.',
      opciones: [{ id: 'si', texto: 'Aceptar' }, { id: 'no', texto: 'Rechazar' }], porDefecto: 'no', cont: { fn: 'r1.acepta', args: {} } });
  } };
registrar('r1.acepta', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  if (resp.opcion !== 'si') {
    log(e, `${j.nombre} rechaza el reto y se va en burro a Basra.`, { pid });
    j.extra.noBagdad = j.turnos + 2; j.ciudad = 'Basra'; e.turno.movio = true; HOOK.llegada(data, e, pid, 'Bagdad'); return;
  }
  pedir(e, { tipo: 'reto', para: [pid], titulo: 'R1 · Ayudantes', texto: 'Cada ayudante añade un dado de búsqueda y 2 dinares de deuda (máximo 5). El cofre aparece con un 1 o un 2 en cualquier dado.', modo: 'numero', min: 0, max: 5, porDefecto: 0, cont: { fn: 'r1.ayudantes', args: {} } });
});
registrar('r1.ayudantes', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid], n = resp.numero || 0;
  const m = nuevaMision(e, pid, { id: 'R1', deuda: 15 + 2 * n, ayudantes: n, busca: false, vence: j.turnos + 3, destino: null, texto: 'Deuda con Bagdad: no puedes salir hasta pagarla.' });
  const ctx = nuevoCtx(e, pid, 'R1');
  const v = ctx.t(`${j.nombre} y ${n} ayudante(s)`, 1 + n);
  if (v.some((x) => x <= 2)) { ctx.say('¡Encuentras el cofre!'); r1Exito(data, e, pid, m); } else { ctx.say('Sin cofre por hoy: repetirás en tu siguiente turno. No puedes salir de Bagdad hasta pagar tu deuda.'); m.busca = true; }
  ctx.fin(); e.turno.fin = true; e.turno.movio = true;
});
T.R1.sinSalir = true;

// ---------------------------------------------------------------- R2 / R3
T.R2 = { ciudad: 'Bagdad', req: (data, e, pid) => {
  const j = e.jugadores[pid];
  if (j.turnos < 5) return 'Necesitas haber jugado 5 turnos.';
  const o = e.ultimoDamasco; if (!o || o === pid || e.jugadores[o].eliminado) return 'No hay testigo al que matar.';
  return null;
}, run(data, e, pid, ctx) {
  const o = e.ultimoDamasco;
  nuevaMision(e, pid, { id: 'R2', objetivo: o, texto: `Mata al testigo ${nombre(e, o)} en 3 turnos.` }, 3);
  ctx.say(`Yafar te encarga matar a ${nombre(e, o)} (tienes 3 turnos).`);
} };
T.R3 = { ciudad: 'Bagdad', run(data, e, pid, ctx) {
  pedir(e, { tipo: 'reto', para: [pid], titulo: 'R3 · Órdenes del Califa', texto: 'Recibes un mapa y dos esclavas abisinias. Debes ir a Estambul y volver a Bagdad en 3 turnos o menos. Éxito: 5 × un dado en dinares.', opciones: [{ id: 'si', texto: 'Aceptar' }, { id: 'no', texto: 'Rechazar' }], porDefecto: 'no', cont: { fn: 'r3.acepta', args: {} } });
} };
registrar('r3.acepta', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  if (resp.opcion !== 'si') { log(e, `${j.nombre} rechaza las órdenes del Califa.`, { pid }); return; }
  darItem(e, j, 'esclava'); darItem(e, j, 'esclava'); darItem(e, j, 'mapa', { tesoro: 'ruman' });
  nuevaMision(e, pid, { id: 'R3', visito: false, texto: 'Ve a Estambul y vuelve a Bagdad.' }, 3);
});
T.R4 = { ciudad: 'Bagdad', req: (data, e, pid) => { const j = e.jugadores[pid]; if (!(hecho(j, 'R5') || hecho(j, 'R6'))) return 'Debes haber completado R5 o R6.'; if (!j.mano.some(esLibro)) return 'Necesitas 1 a 3 libros o papiros.'; return null; },
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid];
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R4 · Libros para Damasco', texto: 'Elige de 1 a 3 libros o papiros para llevar a Damasco en 3 turnos.', modo: 'multi', min: 1, max: 3,
      opciones: j.mano.filter(esLibro).map((c) => ({ id: c.uid, texto: `${c.ref} (valor ${valorLibro(data, e, c)})` })), porDefecto: [j.mano.find(esLibro).uid], cont: { fn: 'r4.libros', args: {} } });
  } };
registrar('r4.libros', (data, e, args, resp) => {
  const pid = resp.pid;
  nuevaMision(e, pid, { id: 'R4', destino: 'Damasco', carga: (resp.valores || []).map((u) => ({ uid: u })), texto: 'Lleva los libros a Damasco.' }, 3);
});
// ---------------------------------------------------------------- R5 / R6
T.R5 = { ciudad: 'Bagdad', run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; const v = [];
  for (let i = 0; i < 4; i++) { const x = dado(e); v.push(x); if (x === 6) break; }
  ctx.grupos.push({ etq: `${j.nombre}: alquimia`, valores: v });
  hacer(e, pid, 'R5');
  if (v[v.length - 1] === 6) { const pr = [50, 40, 30, 20][v.length - 1]; darItem(e, j, 'camello'); premio(data, e, pid, { dinares: pr }, 'Alquimia lograda:'); ctx.say(`¡Un 6 en el intento ${v.length}! +${pr} dinares y un camello.`); }
  else { darItem(e, j, 'brujula'); premio(data, e, pid, { dinares: 10 }, 'Alquimia fallida:'); ctx.say('No sale el 6: 10 dinares y una brújula.'); }
} };
T.R6 = { ciudad: 'Bagdad', run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R6');
  const v = ctx.t(`${j.nombre}: álgebra`, 3); const prom = Math.floor(suma(v) / 3); const [x] = ctx.t('Un dado más', 1);
  if (Math.abs(x - prom) === 1) { premio(data, e, pid, { dinares: 50 }, 'Álgebra resuelta:'); darLibro(e, pid); ctx.say(`Promedio ${prom}, dado ${x}: ganas 50 dinares y un libro.`); }
  else { const [y] = ctx.t('Segunda tirada', 1); if (par(y)) { premio(data, e, pid, { dinares: 20 }); ctx.say(`Promedio ${prom}, dado ${x}; segunda tirada ${y} (par): 20 dinares.`); } else { pagar(data, e, pid, 1); darLibro(e, pid); ctx.say(`Promedio ${prom}, dado ${x}; segunda tirada ${y}: pagas 1 dinar y tomas un libro.`); } }
} };
// ---------------------------------------------------------------- R7 / R17
T.R7 = { ciudad: 'Bagdad', req: (data, e, pid) => { const j = e.jugadores[pid]; if (!hecho(j, 'R17')) return 'Debes haber hecho R17.'; if (!tieneItem(j, 'alfombraIsfahan')) return 'Necesitas 1 o 2 alfombras de Isfahán.'; return null; },
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; const n = Math.min(2, j.mano.filter((c) => c.tipo === 'item' && c.ref === 'alfombraIsfahan').length);
    for (let i = 0; i < n; i++) quitarPrimero(j, 'item', 'alfombraIsfahan');
    j.extra.viajeCalifa = true; hacer(e, pid, 'R7'); premio(data, e, pid, { dinares: 90 * n, noches: 10 }, `${j.nombre} entrega ${n} alfombra(s) al Califa (R7):`);
  } };
T.R17 = { ciudad: 'Isfahán', run(data, e, pid) {
  pedir(e, { tipo: 'reto', para: [pid], titulo: 'R17 · Alfombras de Isfahán', texto: 'Cuestan 40 dinares cada una. ¿Cuántas compras (1 o 2)?', modo: 'numero', min: 1, max: 2, porDefecto: 1, cont: { fn: 'r17.n', args: {} } });
} };
registrar('r17.n', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid], n = resp.numero || 1;
  const quepan = Math.min(n, Math.floor(j.dinares / 40));
  if (!quepan) { log(e, `${j.nombre} no puede pagar las alfombras.`, { pid }); return; }
  j.dinares -= 40 * quepan; for (let i = 0; i < quepan; i++) darItem(e, j, 'alfombraIsfahan');
  hacer(e, pid, 'R17'); log(e, `${j.nombre} compra ${quepan} alfombra(s) de Isfahán (R17).`, { pid });
});
// ---------------------------------------------------------------- R8 / R9 / R10
T.R8 = { ciudad: 'El Cairo', req: (data, e, pid) => (tieneArma(data, e, e.jugadores[pid]) ? null : 'Necesitas un arma.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.extra.rep ||= {}; j.extra.rep.R8 = true; hacer(e, pid, 'R8');
  const gana = peleaNPC(data, e, pid, { etq: 'Shams al Din', dados: 2, bono: 1 + bonoCim(data) + 1 });
  if (gana) premio(data, e, pid, { dinares: 100, noches: 30 }, `${j.nombre} vence a Shams al Din:`);
  else { pagar(data, e, pid, 20); j.herido = true; log(e, `${j.nombre} pierde ante Shams al Din: paga 20 dinares y queda herido.`, { pid }); }
} };
T.R9 = { ciudad: 'El Cairo', req: (data, e, pid) => (e.jugadores[pid].dinares >= 5 ? null : 'Necesitas 5 dinares para el guía.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.dinares -= 5; j.extra.rep ||= {}; j.extra.rep.R9 = true; hacer(e, pid, 'R9');
  const [x] = ctx.t(`${j.nombre}: pirámides`, 1);
  if (x <= 2) {
    ctx.say('Saqueadores te atacan.');
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R9 · Saqueadores', texto: 'Pelea (2 dados cada uno) o paga 15 dinares.', opciones: [{ id: 'pelear', texto: 'Pelear' }, { id: 'pagar', texto: 'Pagar 15 dinares' }], porDefecto: 'pagar', cont: { fn: 'r9.saqueo', args: {} } });
  } else {
    premio(data, e, pid, { dinares: 25 }, `${j.nombre} encuentra un cofre en las pirámides:`);
    if (x === 6) pedir(e, { tipo: 'reto', para: [pid], titulo: 'R9 · Mapa de tesoro', texto: 'Hallas un mapa. ¿Qué tesoro?', opciones: [{ id: 'persia', texto: 'Persia (Isfahán)' }, { id: 'ruman', texto: 'Rumán (Estambul)' }], porDefecto: 'persia', cont: { fn: 'r9.mapa', args: {} } });
  }
} };
registrar('r9.saqueo', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  if (resp.opcion === 'pagar') { pagar(data, e, pid, 15); return; }
  if (!peleaNPC(data, e, pid, { etq: 'Saqueadores', dados: 2 })) { pagar(data, e, pid, 15); j.herido = true; log(e, `${j.nombre} pierde la pelea y paga 15 dinares.`, { pid }); }
});
registrar('r9.mapa', (data, e, args, resp) => { darItem(e, e.jugadores[resp.pid], 'mapa', { tesoro: resp.opcion }); log(e, `${nombre(e, resp.pid)} halla un mapa de tesoro.`, { pid: resp.pid }); });
T.R10 = { ciudad: 'El Cairo', run(data, e, pid, ctx) {
  const j = e.jugadores[pid];
  const carga = [darLibro(e, pid, 'papiro'), darLibro(e, pid, 'papiro')].map((c) => ({ uid: c.uid }));
  nuevaMision(e, pid, { id: 'R10', destino: 'Bagdad', carga, texto: 'Lleva 2 papiros a Bagdad.' }, 2);
  ctx.say('El escriba te confía 2 papiros: entrégalos en Bagdad en 2 turnos.');
} };
// ---------------------------------------------------------------- Sindbad R11-R14
function sindbadFin(data, e, pid) { const j = e.jugadores[pid]; j.ciudad = 'Basra'; HOOK.llegada(data, e, pid, 'India'); }
T.R11 = { ciudad: 'India', run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R11'); const v = ctx.t(`${j.nombre}: viaje con Sindbad`, 2);
  if (suma(v) >= 7) { premio(data, e, pid, { dinares: 80 }, 'El viaje sale bien:'); ctx.say('Viaje sin tropiezos.'); }
  else { premio(data, e, pid, { dinares: 50 }, 'Naufragio:'); j.noches = Math.max(0, j.noches - 20); j.pierdeTurno = (j.pierdeTurno || 0) + 1; ctx.say('Naufragio: pierdes 20 noches y 1 turno.'); }
  sindbadFin(data, e, pid); chequeoSindbad(data, e, pid);
} };
T.R12 = { ciudad: 'India', req: (d, e, pid) => (hecho(e.jugadores[pid], 'R11') ? null : 'Debes haber completado R11.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R12');
  if (peleaNPC(data, e, pid, { etq: 'Piratas', dados: 2, bono: 1 })) premio(data, e, pid, { dinares: 100 }, 'Vences a los piratas:');
  else { pagar(data, e, pid, 60); j.herido = true; log(e, `${j.nombre} pierde ante los piratas.`, { pid }); }
  sindbadFin(data, e, pid); chequeoSindbad(data, e, pid);
} };
T.R13 = { ciudad: 'India', req: (d, e, pid) => (hecho(e.jugadores[pid], 'R12') ? null : 'Debes haber completado R12.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R13');
  if (peleaNPC(data, e, pid, { etq: 'Gigante', dados: 2, bono: 2 })) premio(data, e, pid, { dinares: 130 }, 'Vences al gigante:');
  else { pagar(data, e, pid, 80); const arma = ['cimitarra', 'alfanje', 'arco', 'jambiya'].find((r) => tieneItem(j, r)); if (arma) quitarPrimero(j, 'item', arma); log(e, `${j.nombre} pierde ante el gigante y su arma.`, { pid }); }
  sindbadFin(data, e, pid); chequeoSindbad(data, e, pid);
} };
T.R14 = { ciudad: 'India', req: (d, e, pid) => (hecho(e.jugadores[pid], 'R13') ? null : 'Debes haber completado R13.'), run(data, e, pid, ctx) {
  const otros = humanosVivos(e).filter((x) => x !== pid);
  if (!otros.length) { const x = dado(e); ctx.say(`Sin público: el dado ${x} decide.`); r14Fin(data, e, pid, par(x)); return; }
  pedir(e, { tipo: 'voto', para: otros, modo: 'una', titulo: `${nombre(e, pid)} cuenta el Cuarto Viaje de Sindbad`, texto: 'Escucha el relato en voz alta. ¿Te convence?', opciones: [{ id: 'si', texto: 'Me convence' }, { id: 'no', texto: 'No me convence' }], porDefecto: 'si', limiteMs: 120000, cont: { fn: 'r14.voto', args: { pid } } });
} };
registrar('r14.voto', (data, e, args, resp) => {
  const pid = args.pid, j = e.jugadores[pid];
  const votos = resp.opcion !== undefined && resp.pid ? { [resp.pid]: resp } : resp;
  let si = 0, no = 0; for (const v of Object.values(votos)) { if (v.opcion === 'si') si++; else no++; }
  if (tieneObj(j, 'OB30')) { si++; consumirObj(data, e, pid, 'OB30'); }
  r14Fin(data, e, pid, si >= no);
});
function r14Fin(data, e, pid, convence) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R14');
  const ctx = nuevoCtx(e, pid, 'R14');
  if (convence) { const [x] = ctx.t(`${j.nombre}: relato convincente`, 1); const din = Math.min(200, 50 + 25 * x); premio(data, e, pid, { dinares: din }, 'El relato convence:'); ctx.say(`Dado ${x}: ${din} dinares.`); }
  else { premio(data, e, pid, { dinares: 50 }, 'El relato no convence:'); ctx.say('El público no se convence.'); }
  ctx.fin(); sindbadFin(data, e, pid); chequeoSindbad(data, e, pid);
}
function chequeoSindbad(data, e, pid) {
  const j = e.jugadores[pid];
  if (['R11', 'R12', 'R13', 'R14'].every((r) => hecho(j, r))) darKanmakan(data, e, pid, 'completar los cuatro viajes de Sindbad');
}
export function darKanmakan(data, e, pid, motivo) {
  const j = e.jugadores[pid];
  if (e.kanmakan.dueno || e.kanmakan.usada || j.eliminado) return;
  e.kanmakan.dueno = pid; j.mano.push({ uid: uid(e), tipo: 'especial', ref: 'K1' });
  log(e, `${j.nombre} recibe la carta del Ejército de Kanmakán (${motivo}).`, { pid });
}
export function revisarKanmakan(data, e, pid) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado || j.npc || e.kanmakan.dueno || e.kanmakan.usada) return;
  if (j.noches >= 500) darKanmakan(data, e, pid, 'reunir 500 noches');
}
// ---------------------------------------------------------------- R15 / R16
T.R15 = { ciudad: 'Samarcanda', req: (data, e) => (e.asesinos.actuaron ? 'Los Asesinos ya actuaron.' : null), run(data, e, pid) { HOOK.contratarAsesinos(data, e, pid, { reto: true }); } };
T.R16 = { ciudad: 'Isfahán', req: (data, e, pid) => { const j = e.jugadores[pid]; if (j.retosHechos.length < 2) return 'Necesitas haber completado al menos 2 retos.'; if (j.dinares < 60) return 'Necesitas 60 dinares en regalos.'; return null; },
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; j.dinares -= 60; log(e, `${j.nombre} lleva 60 dinares en regalos a Sherezada.`, { pid });
    r16Pregunta(data, e, pid, 0);
  } };
function r16Pregunta(data, e, pid, n) {
  const j = e.jugadores[pid], m = e.mazos;
  let t = null;
  for (let g = 0; g < 40 && !t; g++) {
    if (!m.cc['Isfahán'] || !m.cc['Isfahán'].length) m.cc['Isfahán'] = (m.descarte.cc['Isfahán'] || []).splice(0).concat([]);
    const c = m.cc['Isfahán'].shift(); if (!c) break;
    (m.descarte.cc['Isfahán'] ||= []).push(c);
    if (c.k === 't') t = data.trivias.trivias.find((x) => x.id === c.id);
  }
  if (!t) { r16Tira(data, e, pid); return; }
  pedir(e, { tipo: 'trivia', para: [pid], titulo: `Sherezada · prueba ${n + 1} de 3`, texto: t.pregunta, opciones: t.opciones.map((o, i) => ({ id: String(i), texto: o })), porDefecto: String((t.correcta + 1) % t.opciones.length), limiteMs: 120000, cont: { fn: 'r16.q', args: { n, tid: t.id } } });
}
registrar('r16.q', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid], t = data.trivias.trivias.find((x) => x.id === args.tid);
  if (Number(resp.opcion) !== t.correcta) { log(e, `${j.nombre} falla la prueba de Sherezada: pierde los 60 dinares y su acción.`, { pid }); return; }
  log(e, `${j.nombre} acierta una prueba de Sherezada (${args.n + 1}/3).`, { pid });
  if (args.n + 1 >= 3) r16Tira(data, e, pid); else r16Pregunta(data, e, pid, args.n + 1);
});
function r16Tira(data, e, pid) {
  const j = e.jugadores[pid], ctx = nuevoCtx(e, pid, 'R16'); hacer(e, pid, 'R16');
  const v = ctx.t(`${j.nombre} ante Sherezada`, 2); const s = suma(v);
  const muerte = () => {
    if (e.kanmakan.dueno === pid && !e.kanmakan.usada) { e.kanmakan.usada = true; quitarPrimero(j, 'especial', 'K1'); ctx.say('El Ejército de Kanmakán te salva del rey Shariyar.'); return false; }
    ctx.say('El rey Shariyar te atrapa: muerte súbita.'); return true;
  };
  let muere = false;
  if (s <= 3) muere = muerte();
  else if (s <= 6) { if (j.dinares >= 30) { j.dinares -= 30; ctx.say('Sobornas a los criados con 30 dinares.'); } else muere = muerte(); }
  if (!muere) { premio(data, e, pid, { noches: 300 }, `${j.nombre} pasa la noche con Sherezada:`); ctx.say('Sales airoso: +300 noches.'); }
  ctx.fin();
  if (muere) eliminar(data, e, pid, { causa: 'muerte súbita de Shariyar' });
}
// ---------------------------------------------------------------- R18, R19, R25: entrenamientos
function entrenar(e, pid, costo, descuentos) {
  const j = e.jugadores[pid]; if (j.dinares < costo) return false;
  j.dinares -= costo; j.destreza = true; j.noches += 10; e.turno.descuentos = { ...(e.turno.descuentos || {}), ...descuentos };
  log(e, `${j.nombre} entrena: obtiene destreza con armas y +10 noches.`, { pid }); return true;
}
T.R18 = { ciudad: 'Isfahán', req: (d, e, pid) => (e.jugadores[pid].dinares >= 20 ? null : 'Cuesta 20 dinares.'), run(data, e, pid) { entrenar(e, pid, 20, { cimitarra: 25 }); hacer(e, pid, 'R18'); } };
T.R19 = { ciudad: 'Yemen', req: (d, e, pid) => (e.jugadores[pid].dinares >= 20 ? null : 'Cuesta 20 dinares.'), run(data, e, pid) { entrenar(e, pid, 20, { alfanje: 15 }); hacer(e, pid, 'R19'); } };
T.R25 = { ciudad: 'Estambul', req: (d, e, pid) => (e.jugadores[pid].dinares >= 30 ? null : 'Cuesta 30 dinares.'), run(data, e, pid) { entrenar(e, pid, 30, { cimitarra: 25, alfanje: 15 }); hacer(e, pid, 'R25'); } };
T.R20 = { ciudad: 'Damasco', req: (d, e, pid) => (e.jugadores[pid].dinares >= 30 ? null : 'Cuesta 30 dinares.'), run(data, e, pid) { const j = e.jugadores[pid]; j.dinares -= 30; darItem(e, j, 'velo'); hacer(e, pid, 'R20'); log(e, `${j.nombre} compra el velo quemado.`, { pid }); } };
T.R21 = { ciudad: 'Damasco', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.dinares -= 10; hacer(e, pid, 'R21'); const [x] = ctx.t(`${j.nombre}: casa embrujada`, 1);
  if (x <= 2) { j.noches = Math.max(0, j.noches - 20); ctx.say('Los fantasmas te echan: pierdes 20 noches y huyes a Aleppo.'); j.ciudad = 'Aleppo'; e.turno.movio = true; HOOK.llegada(data, e, pid, 'Damasco'); }
  else { premio(data, e, pid, { dinares: 40 }, `${j.nombre} halla un cofre en la casa embrujada:`); if (x === 6) { darItem(e, j, 'mapa', { tesoro: 'ruman' }); ctx.say('Y un mapa de los Rumán.'); } }
} };
T.R22 = { ciudad: 'Damasco', req: (data, e, pid) => {
  const j = e.jugadores[pid]; const l = j.mano.filter((c) => c.tipo === 'objeto' && objDe(data, c.ref).tipo === 'Lujo/Comercio');
  if (new Set(l.map((c) => c.ref)).size < 2) return 'Necesitas 2 o más objetos distintos de Lujo/Comercio.';
  return suma(l.map((c) => objDe(data, c.ref).valor + 10)) >= 60 ? null : 'Tus mercancías no suman 60 dinares de reventa.'; },
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; const l = j.mano.filter((c) => c.tipo === 'objeto' && objDe(data, c.ref).tipo === 'Lujo/Comercio');
    let tot = 0; for (const c of l) { tot += objDe(data, c.ref).valor + 10; quitarCarta(j, c.uid); devolverObjeto(data, e, c.ref); }
    hacer(e, pid, 'R22'); premio(data, e, pid, { dinares: tot + 30, noches: 15 }, `${j.nombre} comercia en el zoco de Damasco (${tot} dinares de mercancía):`);
  } };
T.R23 = { ciudad: 'Magreb', req: (d, e, pid) => (e.jugadores[pid].dinares >= 15 ? null : 'Cuesta 15 dinares.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.dinares -= 15;
  const carga = [0, 1, 2].map(() => ({ uid: darItem(e, j, 'sal').uid }));
  const [x] = ctx.t(`${j.nombre}: caravana de la sal`, 1);
  if (x <= 2) {
    ctx.say('Bandoleros asaltan la caravana.');
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R23 · Bandoleros', texto: 'Pelea (ellos tiran 2 dados con 1 de ventaja) o pierdes un saco.', opciones: [{ id: 'pelear', texto: 'Pelear' }, { id: 'saco', texto: 'Perder un saco' }], porDefecto: 'saco', cont: { fn: 'r23.banditos', args: { carga } } });
  } else nuevaMision(e, pid, { id: 'R23', destino: 'El Cairo', carga, texto: 'Lleva la sal a El Cairo.' }, 2);
} };
registrar('r23.banditos', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid]; let carga = args.carga;
  if (resp.opcion === 'saco' || !peleaNPC(data, e, pid, { etq: 'Bandoleros', dados: 2, bono: 1 })) { const c = carga.pop(); quitarCarta(j, c.uid); }
  if (carga.length) nuevaMision(e, pid, { id: 'R23', destino: 'El Cairo', carga, texto: 'Lleva la sal a El Cairo.' }, 2);
});
T.R24 = { ciudad: 'Basra', req: (d, e, pid) => (e.jugadores[pid].dinares >= 5 ? null : 'Cuesta 5 dinares.'), run(data, e, pid) {
  const j = e.jugadores[pid]; j.dinares -= 5; const c = darItem(e, j, 'cesta');
  nuevaMision(e, pid, { id: 'R24', destino: 'Bagdad', carga: [{ uid: c.uid }], texto: 'Entrega la cesta en Bagdad este turno.' }, 1);
} };
T.R26 = { ciudad: 'Andalucía', req: (data, e) => (activos(e).some((x) => e.jugadores[x].pj === '2') ? 'Zein juega: se usan las reglas de Zein (R 10.3).' : null), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R26');
  const r = zeinTirada(data, e, ctx, pid);
  if (r.salvo || j.pj === '3') { premio(data, e, pid, { dinares: j.pj === '3' ? 10 : 25, noches: 20 }, `${j.nombre} pasa la noche con Zein:`); ctx.say(r.salvo ? 'El esposo no los sorprende.' : 'Anís se escapa por la ventana.'); }
  else {
    ctx.say('El esposo los sorprende.'); ctx.fin(); ctx.grupos = []; ctx.res = [];
    if (!peleaNPC(data, e, pid, { etq: 'Esposo de Zein', dados: 2, bono: 1, jambiya: true })) { j.noches = Math.max(0, j.noches - 30); j.herido = true; log(e, `${j.nombre} pierde ante el esposo: pierde 30 noches y queda herido.`, { pid }); }
    else premio(data, e, pid, { dinares: 25, noches: 20 }, `${j.nombre} vence al esposo de Zein:`);
  }
} };
export function zeinTirada(data, e, ctx, pid, etq = 'Esposo de Zein') {
  const act = activos(e); const v = act.map((x) => dado(e));
  ctx.grupos.push({ etq: `Todos tiran (${etq})`, valores: v });
  const umbral = Math.floor(3.5 * act.length); const salvo = suma(v) > umbral;
  ctx.say(`Suma ${suma(v)} contra ${umbral}: ${salvo ? 'no los sorprenden' : 'los sorprende'}.`);
  return { salvo, suma: suma(v), umbral };
}
T.R27 = { ciudad: 'Aleppo', req: (d, e, pid) => (e.jugadores[pid].dinares >= 15 ? null : 'Cuesta 15 dinares.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.dinares -= 15; hacer(e, pid, 'R27'); const [x] = ctx.t(`${j.nombre}: pócimas`, 1);
  if (x === 1) { j.noches = Math.max(0, j.noches - 10); j.herido = true; ctx.say('La mezcla explota: -10 noches y herido.'); }
  else { darItem(e, j, 'veneno', { turnos: j.turnos }); j.noches += 10; ctx.say('Preparas un veneno y ganas 10 noches.'); }
} };
// ---------------------------------------------------------------- retos añadidos R28-R39
const aplic = (data, e, pid, usados, id) => usa(data, e, pid, usados, id);
T.R28 = { ciudad: 'Estambul', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 10; hacer(e, pid, 'R28');
  let ganz = aplic(data, e, pid, us, 'OB07'), b1 = (aplic(data, e, pid, us, 'OB43') ? 1 : 0) + (aplic(data, e, pid, us, 'OB08') ? 1 : 0);
  if (!ganz) { const v = ctx.t(`${j.nombre}: el guardia`, 2); if (suma(v) + b1 < 7) { j.noches = Math.max(0, j.noches - 20); j.herido = true; ctx.say('El guardia te sorprende: -20 noches, herido.'); return; } ctx.say('Pasas al guardia.'); } else ctx.say('La ganzúa neutraliza al guardia.');
  const llave = aplic(data, e, pid, us, 'OB06'), lin = aplic(data, e, pid, us, 'OB09') ? 1 : 0;
  if (!llave) { const [x] = ctx.t(`${j.nombre}: la cerradura`, 1); if (x + lin < 4) { pagar(data, e, pid, 10); ctx.say('La cerradura no cede: huyes y pagas 10 dinares.'); return; } }
  premio(data, e, pid, { dinares: 45, noches: 10 }, `${j.nombre} vacía el cofre del tesorero:`);
} };
T.R29 = { ciudad: 'Yemen', req: (d, e, pid) => { const j = e.jugadores[pid]; if (!tieneItem(j, 'camello')) return 'Necesitas un camello.'; return j.dinares >= 5 ? null : 'Cuestan 5 dinares las provisiones.'; }, run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 5; const [x] = ctx.t(`${j.nombre}: travesía`, 1);
  const lazo = aplic(data, e, pid, us, 'OB05'), odre = aplic(data, e, pid, us, 'OB18');
  if (x === 1 && !lazo) { quitarPrimero(j, 'item', 'camello'); ctx.say('El camello se escapa: pierdes camello y reto.'); return; }
  if (x === 2 && !odre) { ctx.say('Se acaba el agua: pierdes el reto.'); return; }
  nuevaMision(e, pid, { id: 'R29', texto: 'Cruza el desierto con tu camello hasta Bagdad.' }, 3);
  j.extra.rutaCamello = true;
  const c = j.mano.find((q) => q.tipo === 'item' && q.ref === 'camello');
  HOOK.viajarTransporte(data, e, pid, { destino: 'Bagdad', motivo: 'camello', turnos: 2 });
  ctx.say('Partes hacia Bagdad con tu camello.');
} };
T.R30 = { ciudad: 'Andalucía', req: (d, e, pid) => (e.jugadores[pid].dinares >= 5 ? null : 'Cuesta 5 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 5; const c = darItem(e, j, 'pergaminoSellado');
  const [x] = ctx.t(`${j.nombre}: el guardia del camino`, 1);
  if (x <= 2) {
    if (aplic(data, e, pid, us, 'OB21')) ctx.say('El pastel de pistachos suaviza al guardia.');
    else if (aplic(data, e, pid, us, 'OB14') || aplic(data, e, pid, us, 'OB17')) ctx.say('Pagas el peaje con tu objeto.');
    else if (j.dinares >= 10) { j.dinares -= 10; ctx.say('Pagas 10 dinares de peaje.'); } else { quitarCarta(j, c.uid); ctx.say('No puedes pagar el peaje: pierdes el reto.'); return; }
  }
  nuevaMision(e, pid, { id: 'R30', destino: 'Bagdad', carga: [{ uid: c.uid }], texto: 'Entrega el pergamino sellado en Bagdad.' }, 3);
} };
T.R31 = { ciudad: 'Isfahán', req: (d, e, pid) => (e.jugadores[pid].dinares >= 15 ? null : 'Cuesta 15 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 15; hacer(e, pid, 'R31');
  const ganz = aplic(data, e, pid, us, 'OB07') || aplic(data, e, pid, us, 'OB41'), b1 = (aplic(data, e, pid, us, 'OB43') ? 1 : 0) + (aplic(data, e, pid, us, 'OB08') ? 1 : 0);
  if (!ganz) { const v = ctx.t(`${j.nombre}: el capitán`, 2); if (suma(v) + b1 < 8) { j.noches = Math.max(0, j.noches - 30); j.herido = true; ctx.say('Te sorprenden: -30 noches, herido.'); return; } }
  if (!aplic(data, e, pid, us, 'OB06')) { const [x] = ctx.t(`${j.nombre}: la cerradura`, 1); if (x < 5) { ctx.say('La cerradura resiste: huyes sin botín.'); return; } }
  premio(data, e, pid, { dinares: 80, noches: 15 }, `${j.nombre} despoja la cámara del emir:`); robarBotin(data, e, pid);
} };
T.R32 = { ciudad: 'Aleppo', req: (data, e, pid) => (tieneArma(data, e, e.jugadores[pid]) ? null : 'Necesitas un arma.'), run(data, e, pid) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R32');
  if (peleaNPC(data, e, pid, { etq: 'Bandoleros', dados: 2, bono: 2 })) { premio(data, e, pid, { dinares: 40, noches: 10 }, `${j.nombre} despeja el paso:`); robarBotin(data, e, pid); }
  else { pagar(data, e, pid, 20); j.herido = true; log(e, `${j.nombre} pierde ante los bandoleros.`, { pid }); }
} };
T.R33 = { ciudad: 'Damasco', run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R33');
  if (aplic(data, e, pid, us, 'OB10')) { premio(data, e, pid, { dinares: 35, noches: 10 }, 'La red atrapa al ladrón:'); return; }
  const v = ctx.t(`${j.nombre}: persecución`, 2); const b = (aplic(data, e, pid, us, 'OB05') ? 2 : 0) + (aplic(data, e, pid, us, 'OB08') ? 1 : 0); const s = suma(v) + b;
  if (s >= 8) premio(data, e, pid, { dinares: 35, noches: 10 }, `${j.nombre} alcanza al ladrón:`);
  else if (s >= 5) ctx.say('El ladrón se escapa.'); else { pagar(data, e, pid, 5); ctx.say('Tropiezas y pagas 5 dinares por los puestos.'); }
} };
T.R34 = { ciudad: 'Magreb', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 10; hacer(e, pid, 'R34');
  const b = (aplic(data, e, pid, us, 'OB09') ? 1 : 0) + (aplic(data, e, pid, us, 'OB06') ? 1 : 0); const [x] = ctx.t(`${j.nombre}: la cueva`, 1); const r = x + b;
  if (r <= 1) { if (aplic(data, e, pid, us, 'OB26')) ctx.say('El espejo devuelve la maldición.'); else { j.noches = Math.max(0, j.noches - 20); j.herido = true; ctx.say('El guardián te maldice: -20 noches, herido.'); } }
  else if (r <= 3) premio(data, e, pid, { dinares: 20 }, 'Un cofre pequeño:');
  else { premio(data, e, pid, { dinares: 20 }, 'Una lámpara:'); if (!tomarDeBotin(data, e, pid, 'OB24')) premio(data, e, pid, { dinares: 30, noches: 15 }); }
} };
T.R35 = { ciudad: 'India', req: (data, e, pid) => { const j = e.jugadores[pid]; const l = j.mano.filter((c) => c.tipo === 'objeto' && objDe(data, c.ref).tipo === 'Lujo/Comercio'); return suma(l.map((c) => objDe(data, c.ref).valor + (c.ref === 'OB40' ? 2 : 0))) >= 30 ? null : 'Necesitas mercancías de Lujo/Comercio por 30 dinares o más.'; },
  run(data, e, pid, ctx, us) {
    const j = e.jugadores[pid]; hacer(e, pid, 'R35');
    const l = j.mano.filter((c) => c.tipo === 'objeto' && objDe(data, c.ref).tipo === 'Lujo/Comercio').sort((a, b) => objDe(data, b.ref).valor - objDe(data, a.ref).valor);
    let tot = 0; const dar = [];
    for (const c of l) { if (tot >= 30) break; tot += objDe(data, c.ref).valor + (c.ref === 'OB40' ? 2 : 0); dar.push(c); }
    const [x] = ctx.t(`${j.nombre}: el rajá`, 1);
    if (x === 1 && !aplic(data, e, pid, us, 'OB30')) { ctx.say('El rajá no está de humor: recuperas tus regalos y pierdes tu acción.'); return; }
    for (const c of dar) { quitarCarta(j, c.uid); devolverObjeto(data, e, c.ref); }
    premio(data, e, pid, { dinares: 55, noches: 15 }, `${j.nombre} agasaja al rajá:`);
  } };
T.R36 = { ciudad: 'Basra', req: (data, e, pid) => { const j = e.jugadores[pid]; if (!tieneArma(data, e, j)) return 'Necesitas un arma.'; return j.dinares >= 5 ? null : 'Cuesta 5 dinares.'; }, run(data, e, pid) {
  const j = e.jugadores[pid]; j.dinares -= 5; hacer(e, pid, 'R36');
  if (peleaNPC(data, e, pid, { etq: 'Campeón del puerto', dados: 2, bono: 2 })) { premio(data, e, pid, { dinares: 50, noches: 15 }, `${j.nombre} vence al campeón del puerto:`); robarBotin(data, e, pid); }
  else { pagar(data, e, pid, 15); j.herido = true; log(e, `${j.nombre} cae ante el campeón del puerto.`, { pid }); }
} };
T.R37 = { ciudad: 'El Cairo', req: (data, e, pid) => { const j = e.jugadores[pid]; return j.dinares >= 10 || tieneObj(j, 'OB30') ? null : 'Cuesta 10 dinares.'; }, run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R37');
  if (aplic(data, e, pid, us, 'OB30') || (j.dinares < 10 && consumirObj(data, e, pid, 'OB30'))) ctx.say('Entras con tu carta de recomendación.'); else j.dinares -= 10;
  const [x0] = ctx.t(`${j.nombre}: la boda`, 1); const x = x0 + (aplic(data, e, pid, us, 'OB21') ? 1 : 0);
  if (x <= 1) { j.extra.sinPrincipal = true; ctx.say('Se te sube el vino: perderás tu próxima acción principal.'); }
  else if (x <= 5) { premio(data, e, pid, { dinares: 30 }, 'Contactos útiles:'); HOOK.robarCC(data, e, pid, 'El Cairo'); }
  else premio(data, e, pid, { dinares: 60 }, 'Un socio generoso:');
} };
T.R38 = { ciudad: 'Yemen', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Apuesta mínima: 10 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R38');
  const cargados = aplic(data, e, pid, us, 'OB13');
  for (let g = 0; g < 30; g++) {
    let v = ctx.t(`${j.nombre} apuesta 10`, 2); let s = suma(v);
    if (cargados) { if (s === 2) { pagar(data, e, pid, 10); ctx.say('Te descubren con los dados cargados: pierdes el objeto y pagas 10 dinares.'); return; } s = 9; }
    const h = ctx.t('La casa', 2); const sh = suma(h);
    if (s === sh) { ctx.say('Empate: se repite.'); ctx.grupos.length = 0; continue; }
    if (s > sh) premio(data, e, pid, { dinares: 30 }, `${j.nombre} gana la apuesta:`); else { j.dinares -= 10; ctx.say('La casa gana: pierdes los 10 dinares.'); }
    return;
  }
} };
T.R39 = { ciudad: 'Aleppo', req: (d, e, pid) => (e.jugadores[pid].dinares >= 5 ? null : 'Cuesta 5 dinares.'), run(data, e, pid) {
  const j = e.jugadores[pid]; j.dinares -= 5; const c = darItem(e, j, 'cartaUrgente');
  nuevaMision(e, pid, { id: 'R39', destino: 'El Cairo', carga: [{ uid: c.uid }], texto: 'Lleva la carta urgente a El Cairo.' }, 2);
} };

// ---------------------------------------------------------------- Mensajes de los sheijs (R 18): se completan solos
const IDS_LIBRO = (c) => esLibro(c) || (c.tipo === 'objeto' && c.ref === 'OB38');
export function mensajes(data, e, pid, ev, inf) {
  const j = e.jugadores[pid];
  if (!j?.mensaje || j.eliminado) return;
  const id = j.mensaje.id, t = e.turno;
  let cumple = false;
  switch (id) {
    case 'M1': case 'M9': cumple = ev === 'llegada' && inf.primera; break;
    case 'M2': cumple = (ev === 'llegada' || ev === 'finTurno') && j.ciudad === 'Bagdad' && j.mano.some(IDS_LIBRO); break;
    case 'M3': cumple = ev === 'cc' && inf.n >= 2; break;
    case 'M4': cumple = ev === 'llegada' && t && t.tramos === 2 && data.rutas.tarifas[t.ciudadInicio + '>' + j.ciudad] === undefined && t.ciudadInicio !== j.ciudad; break;
    case 'M5': cumple = ev === 'llegada' && j.ciudad === 'Andalucía'; break;
    case 'M7': cumple = ev === 'llegada' && j.ciudad === 'Bagdad'; break;
    case 'M12': cumple = ev === 'llegada' && j.ciudad === 'Yemen'; break;
    case 'M13': cumple = ev === 'llegada' && j.ciudad === 'Damasco'; break;
    case 'M14': cumple = ev === 'llegada' && j.ciudad === 'El Cairo'; break;
    case 'M6': cumple = ev === 'trato' && (inf.dio || []).some((c) => IDS_LIBRO(c) || (c.tipo === 'item' && c.ref === 'mapa')); break;
    case 'M8': case 'M10': case 'M16': cumple = ev === 'ofrecer'; break;
    case 'M11': case 'M15': cumple = ev === 'llegada' && t && t.tramos >= 2; break;
    default: break;
  }
  if (!cumple) return;
  const m = data.mensajes.mensajes.find((x) => x.id === id);
  j.dinares += m.dinares; j.noches += m.noches; e.mazos.descarte.mensajes.push(id); j.mensaje = null;
  log(e, `${j.nombre} cumple un mensaje de ${m.de} y cobra ${m.dinares} dinares${m.noches ? ' y ' + m.noches + ' noches' : ''}.`, { pid });
  if (m.de === 'Ibn Arabi' && !tieneItem(j, 'dadoIbnArabi')) {                          // regla de la casa: el Dado de Ibn Arabi
    darItem(e, j, 'dadoIbnArabi'); log(e, `Ibn Arabi regala a ${j.nombre} un dado para cambiar su suerte: repetirá la próxima pelea que vaya a perder.`, { pid });
  }
}

export function ofrecer5(data, e, pid, a) {
  const j = e.jugadores[pid], k = e.jugadores[a.a];
  if (e.fase !== 'juego' || !e.turno || e.turno.pid !== pid) return err('Solo en tu turno.');
  if (!k || k.eliminado || k.npc || a.a === pid || k.ciudad !== j.ciudad) return err('Debe haber otro jugador en tu ciudad.');
  if (j.dinares < 5) return err('No tienes 5 dinares.');
  j.dinares -= 5; k.dinares += 5; log(e, `${j.nombre} ofrece 5 dinares a ${k.nombre}.`, { pid });
  mensajes(data, e, pid, 'ofrecer', {});
  return ok();
}
