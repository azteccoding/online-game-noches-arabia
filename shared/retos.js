// Retos y misiones R1-R41 (R 14), Mensajes de los sheijs (R 18) y carta de Kanmakán (R 15.5).
// Los retos con varios pasos usan decisiones pendientes (pend) con continuaciones registradas; los plazos cuentan turnos PROPIOS (R 14.1).
import {
  ok, err, dado, dados, suma, par, log, nombre, ciudadDe, objDe, activos, humanosVivos, enCiudad, tieneItem, tieneObj, tieneEsp, quitarCarta, quitarPrimero, uid, darItem, darObjeto, pagar, patrimonio,
  publicarCarta, cartaDatos, robar, eliminar, TESOROS, HOOK, esLibro, valorLibro, mostrarDados, consumirObj, info, pedir, registrar, CONT, ofrecerObjetos, devolverObjeto, recortarMano, robarBotin, ITEMS, puedePrincipal, tarifa,
itemDatos, } from './base.js';
import { peleaNPC, perfil, armasUsables } from './pelea.js';

const m1 = (data, id) => data.retos.retos.find((r) => r.id === id);

// ---------------------------------------------------------------- utilidades
// Las cartas que el reto publica antes de mostrar sus dados (un caballo, un camello, una carta de Ifrit…) son consecuencias: se marcan
// con trasDados para que el servidor no las muestre hasta que el jugador tire y se cierren los dados (Jorge, 11 de noviembre).
function marcarTrasDados(e, nro0, d) { if (d) for (const h of e.historial) if (h.nro > nro0 && h.nro < d.id) h.trasDados = d.id; }
function nuevoCtx(e, pid, id) { const nro0 = e.seq; return { grupos: [], res: [], t(etq, n = 1) { const v = dados(e, n); this.grupos.push({ etq, valores: v }); return v; }, say(x) { this.res.push(x); }, fin() { if (this.grupos.length) marcarTrasDados(e, nro0, mostrarDados(e, { por: pid, motivo: 'reto:' + id, grupos: this.grupos, resumen: [`Reto ${id}:`, ...this.res] })); else { for (const r of this.res) log(e, r, { pid }); if (this.res.length) info(e, pid, `Reto ${id}`, this.res.join(' ')); } } }; }
const nProb = (e) => activos(e).length;
export function premio(data, e, pid, { dinares = 0, noches = 0 }, texto = '') {
  const j = e.jugadores[pid];
  j.dinares += dinares; j.noches += noches;
  if (texto) log(e, texto + `${dinares ? ' +' + dinares + ' dinares' : ''}${noches ? ' +' + noches + ' noches' : ''}.`, { pid });
}
const cobrarFijo = (data, e, pid, monto) => { const j = e.jugadores[pid]; if (j.dinares < monto) return false; j.dinares -= monto; return true; };
function hacer(e, pid, id) { const j = e.jugadores[pid]; if (!j.retosHechos.includes(id)) j.retosHechos.push(id); }
const REPETIBLES = ['R8', 'R9'];
// Reintentables (Jorge, 8 de noviembre): si fallas uno de estos retos no queda hecho; se vuelve a abrir cuando sales de su ciudad y
// regresas (como R8 y R9). Si lo logras, queda hecho para siempre. Cada reto marca su fallo con ctx.fallo.
export const REINTENTABLES = ['R21', 'R28', 'R31', 'R32', 'R33', 'R34', 'R36', 'R38'];
const esperaVolver = (j, id) => REINTENTABLES.includes(id) && !!j.extra.rep?.[id];
// Jorge (10 de noviembre): se pueden tener varios animales, también del mismo tipo; un premio siempre da el animal.

export function darTransporte(data, e, pid, ref) {
  const j = e.jugadores[pid];
  // Jorge (10 de noviembre): al ganar un animal sale su carta (solo para quien lo gana) y queda en el registro.
  const c = darItem(e, j, ref);
  publicarCarta(e, { ...itemDatos(data, ref), sub: `Ganaste un ${ITEMS[ref]?.nombre?.toLowerCase() || ref}` }, pid, [pid]);
  log(e, `${j.nombre} gana un ${ITEMS[ref]?.nombre?.toLowerCase() || ref}.`, { pid });
  return c;
}
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
// «Sirve para»: retos (y mensajes) donde se usa o se entrega cada carta, para mostrarlo en la mano y en el mercado.
const ITEM_RETO = { yegua: ['R50'], alfombraIsfahan: ['R7'], esclava: ['R3'], mapa: ['R3'], libro: ['R4'], papiro: ['R4', 'R10'], cesta: ['R24'], sal: ['R23'], pergaminoSellado: ['R30'], cartaUrgente: ['R39'], camello: ['R29'], idolo: ['R41'],
  alfanje: ['R8', 'R32', 'R36', 'R42'], cimitarra: ['R8', 'R32', 'R36', 'R18'], jambiya: ['R8', 'R32', 'R36', 'R19'], arco: ['R8', 'R32', 'R36', 'R43'] };
export function sirvePara(data, c) {
  let ids = c.tipo === 'item' ? (ITEM_RETO[c.ref] || []) : Object.entries(OBJS).filter(([, l]) => l.includes(c.ref)).map(([r]) => r);
  if (c.tipo === 'objeto' && objDe(data, c.ref)?.tipo === 'Lujo/Comercio') ids = [...ids, 'R22', 'R35'];
  const txt = [...new Set(ids)].map((r) => { const d = m1(data, r); return d ? `${r} (${d.ciudad})` : r; });
  if (c.tipo === 'item' && ['libro', 'papiro', 'mapa'].includes(c.ref)) txt.push('el Mensaje del jurista que pide un libro, papiro o mapa');
  if (c.tipo === 'item' && c.ref === 'especias') txt.push('el evento H17 (se venden en Bagdad)');
  return txt.length ? `Sirve para: ${txt.join(', ')}.` : '';
}

// Quien empieza su turno herido se cura, pero ese turno no tiene acción principal (R 11): ni retos, ni robos, ni duelos, ni tesoros.
export const RECUPERANDO = 'Ya no estás herido, pero te estás recuperando: este turno no tienes acción principal, así que no puedes iniciar retos (ni robar, desafiar o buscar tesoros). En tu próximo turno, sí.';
export function disponibles(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, r = [];
  const recupera = t?.heridoAhora && t.principal && !j.transito && !j.perdido ? RECUPERANDO : null;   // se ven, pero deshabilitados y con el motivo
  const sinPrincipal = t && !recupera && !puedePrincipal(t) ? 'Ya usaste tu acción principal en este turno.' : null;   // se ven, apagados y con el motivo (Jorge, 11 de noviembre)
  if (!t || j.transito || j.perdido) return r;
  for (const id of Object.keys(T)) {
    const d = m1(data, id);
    if (!d || !(T[id].ciudades || [d.ciudad]).includes(j.ciudad)) continue;
    if (hecho(j, id) && !(REPETIBLES.includes(id) && !j.extra.rep?.[id])) {
      // los entrenamientos ya hechos se siguen viendo, apagados y con el motivo (Jorge, 11 de noviembre)
      if (id === 'R25' || ENTRENAMIENTOS[id]) r.push({ k: 'reto', id, titulo: id + ' · ' + d.nombre, texto: d.resolucion, requisito: d.requisito, premio: d.premio, bloqueado: id === 'R25' ? 'Ya tienes destreza con armas.' : `Ya entrenaste con ${ENTRENAMIENTOS[id].arma}.` });
      continue;
    }
    if (esperaVolver(j, id)) continue;
    if (j.misiones.some((m) => m.id === id)) continue;
    const msg = T[id].req ? T[id].req(data, e, pid) : null;
    r.push({ k: 'reto', id, titulo: id + ' · ' + d.nombre, texto: d.resolucion, requisito: d.requisito, premio: d.premio, bloqueado: recupera || sinPrincipal || msg || undefined });
  }
  return r;
}
// Pagar la deuda con Bagdad (Jorge, 11 de noviembre): voluntario, en cualquier momento de tu turno mientras exista (también el mismo turno
// en que la adquieres), sin gastar la acción principal; solo si te alcanzan los dinares. Si no la pagas a tiempo, se cobra sola como antes.
export function opcionPagoDeuda(e, j) {
  const deuda = j.misiones.find((m) => m.id === 'R1' && m.deuda > 0);
  if (!deuda || j.ciudad !== 'Bagdad' || j.transito || j.perdido) return null;
  const falta = deuda.deuda - j.dinares;
  return { k: 'reto', id: 'R1', sub: 'pagar', titulo: `R1 · Pagar la deuda con la ciudad (${deuda.deuda} dinares)`, texto: 'Pagas con dinares y quedas libre para salir de Bagdad. No gasta tu acción principal.', bloqueado: falta > 0 ? `Te faltan ${falta} dinares para pagar tu deuda.` : undefined };
}

export function iniciarReto(data, e, pid, a) {
  const j = e.jugadores[pid], t = e.turno;
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (a.sub === 'pagar') {
    const m = j.misiones.find((x) => x.id === 'R1' && x.deuda > 0);
    if (!m) return err('No debes nada.');
    if (j.dinares < m.deuda) return err(`Te faltan ${m.deuda - j.dinares} dinares para pagar tu deuda.`);   // sin dinero no hay trato
    pagarDeudaR1(e, j, m); return ok();
  }
  if (!puedePrincipal(t)) return err('No tienes acción principal disponible.');
  const def = T[a.id], d = m1(data, a.id);
  if (!def) return err('Reto inexistente.');
  if (!(def.ciudades || [d.ciudad]).includes(j.ciudad)) return err(`Ese reto está en ${(def.ciudades || [d.ciudad]).join(' o ')}.`);
  if (j.transito || j.perdido) return err('No puedes ahora.');
  if (hecho(j, a.id) && !(REPETIBLES.includes(a.id) && !j.extra.rep?.[a.id])) return err('Ya completaste ese reto.');
  if (esperaVolver(j, a.id)) return err('Fallaste este reto: sal de la ciudad y vuelve para intentarlo otra vez.');
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
// Yafar NPC (Jorge, 12 de noviembre): hace el reto sin elegir objetos. libre = no gasta su acción principal (destreza en difícil).
export function retoNPC(data, e, pid, id, { libre = false } = {}) {
  const j = e.jugadores[pid], def = T[id], d = m1(data, id);
  if (!def || !d || !(def.ciudades || [d.ciudad]).includes(j.ciudad) || hecho(j, id)) return false;
  if (def.req && def.req(data, e, pid)) return false;
  if (!libre) e.turno.principal = true;
  log(e, `${j.nombre} intenta el reto ${id}: ${d.nombre}.`, { pid });
  ejecutar(data, e, pid, id, []);
  return true;
}
export const puedeRetoNPC = (data, e, pid, id) => { const j = e.jugadores[pid], def = T[id], d = m1(data, id); return !!(def && d && !hecho(j, id) && !(def.req && def.req(data, e, pid))); };
registrar('reto.obj', (data, e, args, resp) => ejecutar(data, e, resp.pid, args.id, (resp.valores || []).map((u) => e.jugadores[resp.pid].mano.find((c) => c.uid === u)?.ref).filter(Boolean)));
function ejecutar(data, e, pid, id, usados) {
  const ctx = nuevoCtx(e, pid, id);
  { const antes = e.ctxCarta; e.ctxCarta = cartaDatos(data, 'reto', id).titulo; try { T[id].run(data, e, pid, ctx, usados); } finally { e.ctxCarta = antes; } }   // contexto de las tiradas del reto
  if (ctx.fallo && REINTENTABLES.includes(id)) {
    const j = e.jugadores[pid], ciudad = m1(data, id).ciudad;
    j.retosHechos = j.retosHechos.filter((r) => r !== id);
    if (j.ciudad === ciudad) { (j.extra.rep ||= {})[id] = true; ctx.say(`Puedes volver a intentarlo cuando salgas de ${ciudad} y regreses.`); }
    else ctx.say(`Puedes volver a intentarlo cuando regreses a ${ciudad}.`);
  }
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
  if (j.ciudad === 'Damasco' || j.ciudad === 'Aleppo') e.ultimoDamasco = pid;   // Jorge (10 de noviembre): el testigo es el último que visitó Damasco o Aleppo
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
  if (m) { quitarMision(j, m); hacer(e, por, 'R2'); darItem(e, j, 'astrolabio'); darTransporte(data, e, por, 'caballo'); premio(data, e, por, { dinares: 50 }, `${j.nombre} cumple el encargo de Yafar (R2):`); }   // Jorge (10 de noviembre): astrolabio, 50 dinares y un caballo (ya no alfanje)
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
  darTransporte(data, e, pid, 'caballo'); darTransporte(data, e, pid, 'camello'); darItem(e, j, 'pergamino'); j.extra.viajeCalifa = true;   // el caballo (mejor) y, como ya tiene transporte, 20 dinares por el camello
  premio(data, e, pid, { dinares: 50, noches: 50 }, `${j.nombre} halla el cofre del Éufrates:`);
  pagar(data, e, pid, m.deuda);
}
T.R1 = { ciudad: 'Bagdad', req: (data, e, pid) => (e.jugadores[pid].misiones.some((m) => m.id === 'R1') ? 'Ya lo tienes en curso.' : null),
  run(data, e, pid, ctx) {
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R1 · Buscar un cofre en el Éufrates', texto: `Si aceptas, tu turno termina mientras buscas y contraes una deuda de 15 dinares con la ciudad; puedes pagar sirvientes, a ${data.config.r1?.costoAyudante ?? 12} dinares cada uno, para buscar con más dados. Si rechazas, vas en burro a Basra y no puedes volver a Bagdad en 2 turnos.`,
      opciones: [{ id: 'si', texto: 'Aceptar' }, { id: 'no', texto: 'Rechazar' }], porDefecto: 'no', cont: { fn: 'r1.acepta', args: {} } });
  } };
registrar('r1.acepta', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  if (resp.opcion !== 'si') {
    log(e, `${j.nombre} rechaza el reto y se va en burro a Basra.`, { pid });
    j.extra.noBagdad = j.turnos + 2; j.ciudad = 'Basra'; e.turno.movio = true; HOOK.llegada(data, e, pid, 'Bagdad'); return;
  }
  // Regla de la casa: cada sirviente cuesta 17 dinares (Jorge, 10 de noviembre: antes 12) y se pueden contratar hasta 4 (antes 3) y se paga al contratarlo; sin dinares no hay trato y se busca solo.
  const cA = data.config.r1?.costoAyudante ?? 12, mA = data.config.r1?.maxAyudantes ?? 3, alcanza = Math.min(mA, Math.floor(Math.max(0, j.dinares) / cA));
  if (!alcanza) { log(e, `${j.nombre} no tiene ${cA} dinares para contratar sirvientes: busca solo.`, { pid }); return CONT['r1.ayudantes'](data, e, {}, { pid, numero: 0 }); }
  pedir(e, { tipo: 'reto', para: [pid], titulo: 'R1 · Sirvientes', texto: `Cada sirviente añade un dado de búsqueda y cuesta ${cA} dinares, que se pagan ahora (máximo ${mA}). El cofre aparece con un 1 o un 2 en cualquier dado.`, nota: `Te alcanza para contratar hasta ${alcanza} ${alcanza === 1 ? 'sirviente' : 'sirvientes'}.`, modo: 'numero', min: 0, max: alcanza, porDefecto: 0, cont: { fn: 'r1.ayudantes', args: {} } });
});
registrar('r1.ayudantes', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid], cA = data.config.r1?.costoAyudante ?? 12;
  const n = Math.max(0, Math.min(resp.numero || 0, data.config.r1?.maxAyudantes ?? 3, Math.floor(Math.max(0, j.dinares) / cA)));
  if (n) { j.dinares -= cA * n; log(e, `${j.nombre} contrata ${n} sirviente(s) por ${cA * n} dinares.`, { pid }); }
  const m = nuevaMision(e, pid, { id: 'R1', deuda: 15, ayudantes: n, busca: false, vence: j.turnos + 3, destino: null, texto: 'Deuda con Bagdad: no puedes salir hasta pagarla.' });
  const ctx = nuevoCtx(e, pid, 'R1');
  const v = ctx.t(`${j.nombre} y ${n} sirviente(s)`, 1 + n);
  if (v.some((x) => x <= 2)) { ctx.say('¡Encuentras el cofre!'); r1Exito(data, e, pid, m); } else { ctx.say('Sin cofre por hoy: repetirás en tu siguiente turno. No puedes salir de Bagdad hasta pagar tu deuda.'); m.busca = true; }
  ctx.fin(); e.turno.movio = true;
  // Con deuda, el turno queda abierto para que puedas pagarla antes de terminarlo (Jorge, 11 de noviembre); sin más viajes ni acción principal.
  if (j.misiones.some((x) => x.id === 'R1' && x.deuda > 0)) { e.turno.principal = true; e.turno.maxTramos = e.turno.tramos; } else e.turno.fin = true;
});
T.R1.sinSalir = true;

// ---------------------------------------------------------------- R2 / R3
// Testigo de R2 (Jorge, 10 de noviembre): primero quien cobró las «Dos noches» en Damasco o Aleppo (el más reciente); si no vale
// (eres tú, o ya no está en la partida), el último que pasó por Damasco o Aleppo.
const valeTestigo = (e, x, pid) => !!x && x !== pid && !!e.jugadores[x] && !e.jugadores[x].eliminado && !e.jugadores[x].sacado;
export const testigoR2 = (e, pid) => [e.testigoCarrera, e.ultimoDamasco].find((x) => valeTestigo(e, x, pid)) || null;
T.R2 = { ciudad: 'Bagdad', req: (data, e, pid) => {
  const j = e.jugadores[pid];
  if (j.turnos < 5) return 'Necesitas haber jugado 5 turnos.';
  if (!e.crimenPresenciado) return 'Todavía nadie ha presenciado el crimen: alguien debe cobrar antes una carrera «Dos noches» en Damasco o Aleppo.';   // Jorge (10 de noviembre)
  if (!testigoR2(e, pid)) return 'No hay testigo al que matar.';
  return null;
}, run(data, e, pid, ctx) {
  const o = testigoR2(e, pid);
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
  for (let i = 0; i < 3; i++) { const x = dado(e); v.push(x); if (x === 6) break; }   // 3 intentos (antes 4)
  ctx.grupos.push({ etq: `${j.nombre}: alquimia`, valores: v });
  hacer(e, pid, 'R5');
  if (v[v.length - 1] === 6) { const pr = [50, 40, 30][v.length - 1]; darTransporte(data, e, pid, 'camello'); premio(data, e, pid, { dinares: pr }, 'Alquimia lograda:'); ctx.say(`¡Un 6 en el intento ${v.length}! +${pr} dinares y un camello.`); }
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
T.R17 = { ciudad: 'Isfahán', req: (d, e, pid) => (e.jugadores[pid].dinares >= 40 ? null : 'Cada alfombra cuesta 40 dinares: no te alcanza.'), run(data, e, pid) {
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
  // Jorge (10 de noviembre): gana 50 dinares y 20 noches (antes 100 y 30); si pierde, pierde 15 noches y queda herido (ya no paga 20)
  if (gana) premio(data, e, pid, { dinares: 50, noches: 20 }, `${j.nombre} vence a Shams al Din:`);
  else { j.noches = Math.max(0, j.noches - 15); j.herido = true; log(e, `${j.nombre} pierde ante Shams al Din: pierde 15 noches y queda herido.`, { pid }); }
} };
T.R9 = { ciudad: 'El Cairo', req: (data, e, pid) => (e.jugadores[pid].dinares >= 5 ? null : 'Necesitas 5 dinares para el guía.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.dinares -= 5; j.extra.rep ||= {}; j.extra.rep.R9 = true; hacer(e, pid, 'R9');
  const [x] = ctx.t(`${j.nombre}: pirámides`, 1);
  if (x <= 2) {
    ctx.say('Saqueadores te atacan.');
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R9 · Saqueadores', texto: 'Pelea (2 dados cada uno) o paga 15 dinares.', opciones: [{ id: 'pelear', texto: 'Pelear' }, { id: 'pagar', texto: 'Pagar 15 dinares' }], porDefecto: 'pagar', cont: { fn: 'r9.saqueo', args: {} } });
  } else {
    premio(data, e, pid, { dinares: 25 }, `${j.nombre} encuentra un cofre en las pirámides:`);
    if (x === 6) pedir(e, { tipo: 'reto', para: [pid], titulo: 'R9 · Mapa de tesoro', texto: 'Hallas un mapa. ¿Qué tesoro?', opciones: [{ id: 'persia', texto: 'Persia (Isfahán)' }, { id: 'ruman', texto: 'Rumán (Estambul)' }, { id: 'mansa', texto: 'Mansa Musa (Magreb)' }], porDefecto: 'persia', cont: { fn: 'r9.mapa', args: {} } });
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
  // Regla de la casa (noviembre de 2026): las noches de Sindbad no se multiplican por ronda; al naufragar no hay dinares pero se ganan 30 noches por la historia vivida.
  if (suma(v) >= 6) { premio(data, e, pid, { dinares: 100, noches: 50 }, 'El viaje sale bien:'); ctx.say('Viaje sin tropiezos: +100 dinares y +50 noches.'); }
  else { premio(data, e, pid, { noches: 30 }, 'Naufragio, pero qué historia:'); j.pierdeTurno = (j.pierdeTurno || 0) + 1; ctx.say('Naufragio: sin dinares, pero +30 noches por la historia vivida; pierdes tu siguiente turno.'); }
  sindbadFin(data, e, pid); chequeoSindbad(data, e, pid);
} };
T.R12 = { ciudad: 'India', req: (d, e, pid) => (hecho(e.jugadores[pid], 'R11') ? null : 'Debes haber completado R11.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R12');
  // Regla de la casa (noviembre de 2026): noches por la historia, sin multiplicar por ronda.
  if (peleaNPC(data, e, pid, { etq: 'Piratas', dados: 2, bono: 0 })) premio(data, e, pid, { dinares: 120, noches: 60 }, 'Vences a los piratas:');
  else { pagar(data, e, pid, 60); j.herido = true; j.noches += 20; log(e, `${j.nombre} pierde ante los piratas y queda herido, pero gana 20 noches por la historia.`, { pid }); }
  sindbadFin(data, e, pid); chequeoSindbad(data, e, pid);
} };
T.R13 = { ciudad: 'India', req: (d, e, pid) => (hecho(e.jugadores[pid], 'R12') ? null : 'Debes haber completado R12.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R13');
  if (peleaNPC(data, e, pid, { etq: 'Gigante', dados: 2, bono: 1 })) premio(data, e, pid, { dinares: 150, noches: 80 }, 'Vences al gigante:');
  else { pagar(data, e, pid, 80); const arma = ['cimitarra', 'alfanje', 'arco', 'jambiya'].find((r) => tieneItem(j, r)); if (arma) quitarPrimero(j, 'item', arma); j.noches += 20; log(e, `${j.nombre} pierde ante el gigante y su arma, pero gana 20 noches por la historia.`, { pid }); }
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
// ---------------------------------------------------------------- entrenamientos (regla de la casa, noviembre de 2026)
// La destreza (+1 en toda pelea) se aprende solo en Estambul. Cada arma tiene su maestro: hay que llevar el arma, y quien entrena suma
// +1 con ella (dentro del tope de armas); con el arco, también un 3 o 4 en la flecha deja al rival con −1.
export const DESTREZA = { costo: 50 };   // R25, Estambul (Jorge, 10 de noviembre)
// Entrenamientos que ofrece cada ciudad, de la misma fuente que usa el motor (para la ficha de la ciudad; Jorge, 11 de noviembre).
export function entrenamientosEn(ciudad) {
  const r = [];
  if ((T.R25.ciudades || [T.R25.ciudad]).includes(ciudad)) r.push({ id: 'R25', que: 'destreza con armas', costo: DESTREZA.costo });
  for (const [id, x] of Object.entries(ENTRENAMIENTOS)) if ((T[id].ciudades || [T[id].ciudad]).includes(ciudad)) r.push({ id, que: x.arma, costo: x.costo });
  return r;
}
export const ENTRENAMIENTOS = { R18: { arma: 'cimitarra', costo: 25 }, R19: { arma: 'jambiya', costo: 20 }, R42: { arma: 'alfanje', costo: 20 }, R43: { arma: 'arco', costo: 20 } };
const entrenado = (j, arma) => !!j.extra.entrenado?.[arma];
function entrenarArma(e, pid, id) {
  const j = e.jugadores[pid], { arma, costo } = ENTRENAMIENTOS[id];
  j.dinares -= costo; (j.extra.entrenado ||= {})[arma] = true; j.noches += 50; hacer(e, pid, id);
  log(e, `${j.nombre} entrena con ${arma}: desde ahora suma +1 con ella${arma === 'arco' ? ' (con 3 o 4 en su flecha el rival también pelea con −1)' : ''} y gana 50 noches.`, { pid });
}
const reqArma = (id) => (d, e, pid) => {
  const j = e.jugadores[pid], { arma, costo } = ENTRENAMIENTOS[id];
  if (!tieneItem(j, arma)) return `Necesitas tener ${{ arco: 'un arco', jambiya: 'una jambiya', cimitarra: 'una cimitarra', alfanje: 'un alfanje' }[arma] || arma} para entrenar con ${['jambiya', 'cimitarra'].includes(arma) ? 'ella' : 'él'}.`;
  if (entrenado(j, arma)) return `Ya entrenaste con ${arma}.`;
  return j.dinares >= costo ? null : `Cuesta ${costo} dinares.`;
};
T.R18 = { ciudad: 'Isfahán', ciudades: ['Isfahán', 'Samarcanda'], req: reqArma('R18'), run(data, e, pid) { entrenarArma(e, pid, 'R18'); } };
T.R42 = { ciudad: 'Aleppo', ciudades: ['Aleppo', 'Damasco'], req: reqArma('R42'), run(data, e, pid) { entrenarArma(e, pid, 'R42'); } };
T.R19 = { ciudad: 'Yemen', req: reqArma('R19'), run(data, e, pid) { entrenarArma(e, pid, 'R19'); } };
T.R43 = { ciudad: 'Andalucía', req: reqArma('R43'), run(data, e, pid) { entrenarArma(e, pid, 'R43'); } };
T.R25 = { ciudad: 'Estambul', req: (d, e, pid) => (e.jugadores[pid].destreza ? 'Ya tienes destreza con armas.' : e.jugadores[pid].dinares >= DESTREZA.costo ? null : `Cuesta ${DESTREZA.costo} dinares.`), run(data, e, pid) {
  const j = e.jugadores[pid]; j.dinares -= DESTREZA.costo; j.destreza = true; j.noches += 50; hacer(e, pid, 'R25');   // Jorge (10 de noviembre): 50 (antes 45)
  log(e, `${j.nombre} entrena en Estambul: obtiene destreza con armas (+1 en todas las peleas, robos, ataques y duelos) y gana 50 noches.`, { pid });
} };
T.R20 = { ciudad: 'Damasco', req: (d, e, pid) => (e.jugadores[pid].dinares >= 30 ? null : 'Cuesta 30 dinares.'), run(data, e, pid) { const j = e.jugadores[pid]; j.dinares -= 30; darItem(e, j, 'velo'); hacer(e, pid, 'R20'); log(e, `${j.nombre} compra el velo quemado.`, { pid }); } };
T.R21 = { ciudad: 'Damasco', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.dinares -= 10; hacer(e, pid, 'R21'); const [x] = ctx.t(`${j.nombre}: casa embrujada`, 1);
  if (x <= 3) { j.noches = Math.max(0, j.noches - 20); ctx.say('Los fantasmas te echan: pierdes 20 noches y huyes a Aleppo.'); ctx.fallo = true; j.ciudad = 'Aleppo'; e.turno.movio = true; HOOK.llegada(data, e, pid, 'Damasco'); }
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
  if (x <= 2 && tieneItem(j, 'bendicionAbuMadyan')) { quitarPrimero(j, 'item', 'bendicionAbuMadyan'); ctx.say('Asoman bandoleros, pero la bendición de Abu Madyan protege la caravana: pasan de largo (la bendición se gasta).'); nuevaMision(e, pid, { id: 'R23', destino: 'El Cairo', carga, texto: 'Lleva la sal a El Cairo.' }, 2); }
  else if (x <= 2) {
    ctx.say('Bandoleros asaltan la caravana.');
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R23 · Bandoleros', texto: 'Pelea (ellos tiran 2 dados con 1 de ventaja) o pierdes un saco.', opciones: [{ id: 'pelear', texto: 'Pelear' }, { id: 'saco', texto: 'Perder un saco' }], porDefecto: 'saco', cont: { fn: 'r23.banditos', args: { carga } } });
  } else nuevaMision(e, pid, { id: 'R23', destino: 'El Cairo', carga, texto: 'Lleva la sal a El Cairo.' }, 2);
} };
registrar('r23.banditos', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid]; let carga = args.carga;
  if (resp.opcion === 'saco' || !peleaNPC(data, e, pid, { etq: 'Bandoleros', dados: 2, bono: 1 })) { const c = carga.pop(); quitarCarta(j, c.uid); }
  if (carga.length) nuevaMision(e, pid, { id: 'R23', destino: 'El Cairo', carga, texto: 'Lleva la sal a El Cairo.' }, 2);
});
T.R24 = { ciudad: 'Basra', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid) {
  const j = e.jugadores[pid]; j.dinares -= 10; const c = darItem(e, j, 'cesta');
  nuevaMision(e, pid, { id: 'R24', destino: 'Bagdad', carga: [{ uid: c.uid }], texto: 'Entrega la cesta en Bagdad este turno.' }, 1);
} };
T.R26 = { ciudad: 'Andalucía', req: (data, e) => (activos(e).some((x) => e.jugadores[x].pj === '2') ? 'Zein juega: se usan las reglas de Zein (R 10.3).' : null), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R26');
  const r = zeinTirada(data, e, ctx, pid);
  const bendito = !r.salvo && j.pj !== '3' && tieneItem(j, 'bendicionAbuMadyan');
  if (bendito) { quitarPrimero(j, 'item', 'bendicionAbuMadyan'); ctx.say('El esposo llega a la Giralda, pero la bendición de Abu Madyan lo aparta: no los sorprende (la bendición se gasta).'); }
  if (r.salvo || j.pj === '3' || bendito) { premio(data, e, pid, { dinares: j.pj === '3' ? 10 : 25, noches: 20 }, `${j.nombre} pasa la noche con Zein:`); if (!bendito) ctx.say(r.salvo ? 'El esposo no los sorprende.' : 'Anís se escapa por la ventana.'); }
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
  if (!ganz) { const v = ctx.t(`${j.nombre}: el guardia`, 2); if (suma(v) + b1 < 7) { j.noches = Math.max(0, j.noches - 20); j.herido = true; ctx.say('El guardia te sorprende: -20 noches, herido.'); ctx.fallo = true; return; } ctx.say('Pasas al guardia.'); } else ctx.say('La ganzúa neutraliza al guardia.');
  const llave = aplic(data, e, pid, us, 'OB06'), lin = aplic(data, e, pid, us, 'OB09') ? 1 : 0;
  if (!llave) { const [x] = ctx.t(`${j.nombre}: la cerradura`, 1); if (x + lin < 4) { pagar(data, e, pid, 10); ctx.say('La cerradura no cede: huyes y pagas 10 dinares.'); ctx.fallo = true; return; } }
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
  if (x <= 3) {
    if (aplic(data, e, pid, us, 'OB21')) ctx.say('El pastel de pistachos suaviza al guardia.');
    else if (aplic(data, e, pid, us, 'OB14') || aplic(data, e, pid, us, 'OB17')) ctx.say('Pagas el peaje con tu objeto.');
    else if (j.dinares >= 15) { j.dinares -= 15; ctx.say('Pagas 15 dinares de peaje.'); } else { quitarCarta(j, c.uid); ctx.say('No puedes pagar el peaje: pierdes el reto.'); return; }
  }
  nuevaMision(e, pid, { id: 'R30', destino: 'Bagdad', carga: [{ uid: c.uid }], texto: 'Entrega el pergamino sellado en Bagdad.' }, 3);
} };
T.R31 = { ciudad: 'Isfahán', req: (d, e, pid) => (e.jugadores[pid].dinares >= 15 ? null : 'Cuesta 15 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 15; hacer(e, pid, 'R31');
  const ganz = aplic(data, e, pid, us, 'OB07') || aplic(data, e, pid, us, 'OB41'), b1 = (aplic(data, e, pid, us, 'OB43') ? 1 : 0) + (aplic(data, e, pid, us, 'OB08') ? 1 : 0);
  if (!ganz) { const v = ctx.t(`${j.nombre}: el capitán`, 2); if (suma(v) + b1 < 8) { j.noches = Math.max(0, j.noches - 30); j.herido = true; ctx.say('Te sorprenden: -30 noches, herido.'); ctx.fallo = true; return; } }
  if (!aplic(data, e, pid, us, 'OB06')) { const [x] = ctx.t(`${j.nombre}: la cerradura`, 1); if (x < 5) { ctx.say('La cerradura resiste: huyes sin botín.'); ctx.fallo = true; return; } }
  premio(data, e, pid, { dinares: 80, noches: 15 }, `${j.nombre} despoja la cámara del emir:`); robarBotin(data, e, pid);
} };
T.R32 = { ciudad: 'Aleppo', req: (data, e, pid) => (tieneArma(data, e, e.jugadores[pid]) ? null : 'Necesitas un arma.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R32');
  if (peleaNPC(data, e, pid, { etq: 'Bandoleros', dados: 2, bono: 2 })) { premio(data, e, pid, { dinares: 40, noches: 10 }, `${j.nombre} despeja el paso:`); robarBotin(data, e, pid); }
  else { pagar(data, e, pid, 20); j.herido = true; log(e, `${j.nombre} pierde ante los bandoleros.`, { pid }); ctx.fallo = true; }
} };
T.R33 = { ciudad: 'Damasco', run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R33');
  if (aplic(data, e, pid, us, 'OB10')) { premio(data, e, pid, { dinares: 35, noches: 10 }, 'La red atrapa al ladrón:'); return; }
  const v = ctx.t(`${j.nombre}: persecución`, 2); const b = (aplic(data, e, pid, us, 'OB05') ? 2 : 0) + (aplic(data, e, pid, us, 'OB08') ? 1 : 0); const s = suma(v) + b;
  if (s >= 8) premio(data, e, pid, { dinares: 35, noches: 10 }, `${j.nombre} alcanza al ladrón:`);
  else if (s >= 5) { ctx.say('El ladrón se escapa.'); ctx.fallo = true; } else { pagar(data, e, pid, 5); ctx.say('Tropiezas y pagas 5 dinares por los puestos.'); ctx.fallo = true; }
} };
T.R34 = { ciudad: 'Magreb', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 10; hacer(e, pid, 'R34');
  const b = (aplic(data, e, pid, us, 'OB09') ? 1 : 0) + (aplic(data, e, pid, us, 'OB06') ? 1 : 0); const [x] = ctx.t(`${j.nombre}: la cueva`, 1); const r = x + b;
  if (r <= 2) { ctx.fallo = true; if (aplic(data, e, pid, us, 'OB26')) ctx.say('El espejo devuelve la maldición.'); else { j.noches = Math.max(0, j.noches - 20); j.herido = true; ctx.say('El guardián te maldice: -20 noches, herido.'); } }
  else if (r <= 4) premio(data, e, pid, { dinares: 20 }, 'Un cofre pequeño:');
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
    premio(data, e, pid, { dinares: 70, noches: 20 }, `${j.nombre} agasaja al rajá:`);
  } };
T.R36 = { ciudad: 'Basra', req: (data, e, pid) => { const j = e.jugadores[pid]; if (!tieneArma(data, e, j)) return 'Necesitas un arma.'; return j.dinares >= 5 ? null : 'Cuesta 5 dinares.'; }, run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.dinares -= 5; hacer(e, pid, 'R36');
  if (peleaNPC(data, e, pid, { etq: 'Campeón del puerto', dados: 2, bono: 2 })) { premio(data, e, pid, { dinares: 50, noches: 15 }, `${j.nombre} vence al campeón del puerto:`); robarBotin(data, e, pid); }
  else { pagar(data, e, pid, 15); j.herido = true; log(e, `${j.nombre} cae ante el campeón del puerto.`, { pid }); ctx.fallo = true; }
} };
T.R37 = { ciudad: 'El Cairo', req: (data, e, pid) => { const j = e.jugadores[pid]; return j.dinares >= 10 || tieneObj(j, 'OB30') ? null : 'Cuesta 10 dinares.'; }, run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R37');
  if (aplic(data, e, pid, us, 'OB30') || (j.dinares < 10 && consumirObj(data, e, pid, 'OB30'))) ctx.say('Entras con tu carta de recomendación.'); else j.dinares -= 10;
  const [x0] = ctx.t(`${j.nombre}: la boda`, 1); const x = x0 + (aplic(data, e, pid, us, 'OB21') ? 1 : 0);
  if (x <= 2) { j.extra.sinPrincipal = true; ctx.say('Se te sube el vino: perderás tu próxima acción principal.'); }
  else if (x <= 5) { premio(data, e, pid, { dinares: 30 }, 'Contactos útiles:'); HOOK.robarCC(data, e, pid, 'El Cairo'); }
  else premio(data, e, pid, { dinares: 60 }, 'Un socio generoso:');
} };
T.R38 = { ciudad: 'Yemen', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Apuesta mínima: 10 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R38');
  const cargados = aplic(data, e, pid, us, 'OB13');
  for (let g = 0; g < 30; g++) {
    let v = ctx.t(`${j.nombre} apuesta 10`, 2); let s = suma(v);
    if (cargados) { if (s === 2) { pagar(data, e, pid, 10); ctx.say('Te descubren con los dados cargados: pierdes el objeto y pagas 10 dinares.'); ctx.fallo = true; return; } s = 9; }
    const h = ctx.t('La casa', 2); const sh = suma(h);
    if (s === sh) { ctx.say('Empate: se repite.'); ctx.grupos.length = 0; continue; }
    if (s > sh) premio(data, e, pid, { dinares: 30 }, `${j.nombre} gana la apuesta:`); else { j.dinares -= 10; ctx.say('La casa gana: pierdes los 10 dinares.'); ctx.fallo = true; }
    return;
  }
} };
T.R39 = { ciudad: 'Aleppo', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid) {
  const j = e.jugadores[pid]; j.dinares -= 10; const c = darItem(e, j, 'cartaUrgente');
  nuevaMision(e, pid, { id: 'R39', destino: 'El Cairo', carga: [{ uid: c.uid }], texto: 'Lleva la carta urgente a El Cairo.' }, 2);
} };
// R40 (regla de la casa): cruzar a Abisinia desde Yemen. Pasaje de 15; 1 dado +1 destreza +1 camello: 6+ carta de Ifrit
// (o 40 dinares), 4–5 vuelves a Moca, 1–3 tormenta y quedas herido. Se gana una vez por partida; herido no se intenta.
// R44 «Visitar Timbuktú» (Jorge, 7 de noviembre): desde el Magreb, 10 dinares de caravana y 30 noches; una vez por jugador. Mientras dure la
// carta S2 «Mansa Musa despertó generoso», además se tira 1 dado (con su botón): 6, 50 dinares y 60 noches; 4–5, 35 y 40; 1–3, 30 noches.
// R45 «Trabajar para el Nizam de Hyderabad» (Jorge, 10 de noviembre), con la estructura de R41: se inicia desde Acciones en India con
// la acción principal y queda hecho (una vez por jugador). Tiras 1 dado (con botón): cobras 10 + 5 por punto y 10 noches, al momento. Pierdes tu
// siguiente turno y, en el que sigue, no tienes acción principal (quedas herido por tanto trabajo: engine.iniciarTurno).
// R50 «Llevar yeguas de la estepa» (Jorge, 12 de noviembre): en Samarcanda compras de 1 a 3 yeguas a 70 dinares cada una; una sola vez por
// jugador y Yafar (NPC o jugador) no puede. Las yeguas se venden en Estambul (objetos.js) y ahí ponen a la venta caballos mongoles.
const PRECIO_YEGUA = 70, MAX_YEGUAS = 3;
T.R50 = { ciudad: 'Samarcanda', req: (d, e, pid) => { const j = e.jugadores[pid]; return j.pj === 'B' ? 'Yafar no puede llevar yeguas de la estepa.' : j.dinares < PRECIO_YEGUA ? `Cada yegua cuesta ${PRECIO_YEGUA} dinares: sin dinero no hay trato.` : null; },
  run(data, e, pid) {
    const j = e.jugadores[pid], n = Math.min(MAX_YEGUAS, Math.floor(j.dinares / PRECIO_YEGUA));
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R50 · Llevar yeguas de la estepa', texto: `¿Cuántas yeguas compras? ${PRECIO_YEGUA} dinares cada una; el mercado de Estambul paga 150 por cada una.`,
      opciones: Array.from({ length: n }, (_, i) => ({ id: String(i + 1), texto: `${i + 1} yegua${i ? 's' : ''} (${PRECIO_YEGUA * (i + 1)} dinares)` })), porDefecto: '1', limiteMs: 60000, cont: { fn: 'reto.yeguas', args: {} } });
  } };
registrar('reto.yeguas', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  const n = Math.max(1, Math.min(MAX_YEGUAS, parseInt(resp.opcion, 10) || 1));
  if (j.dinares < PRECIO_YEGUA * n) return;
  j.dinares -= PRECIO_YEGUA * n; hacer(e, pid, 'R50');
  for (let i = 0; i < n; i++) darItem(e, j, 'yegua');
  log(e, `${j.nombre} compra ${n} yegua${n > 1 ? 's' : ''} de la estepa en Samarcanda por ${PRECIO_YEGUA * n} dinares: el mercado de Estambul paga 150 por cada una.`, { pid });
});
// R51 «Torneo de Murcia» (Jorge, 12 de noviembre): en Andalucía, Ibn Mardanish convoca a disparar con arco. Hay que traer arco y una flecha
// (se gasta); cuesta 16 dinares; una vez cada dos turnos propios. Un dado con su botón: con 1 o 6, destreza máxima en arco para toda la
// partida (pelea.js: tus flechas siempre aciertan y el rival pelea con −1) y el torneo deja de aparecerte; con 2 a 5 pierdes y ganas 20 noches.
// Yafar (NPC o jugador) puede además sobornar a los jueces: 20 dinares más y gana sin tirar.
// Yafar NPC, si llega a elegir este reto, siempre soborna (Jorge): solo puede hacerlo si le alcanzan los 36 dinares.
export const TORNEO = { costo: 16, soborno: 20, gana: [1, 6], noches: 20, cadaTurnos: 2 };
const motivoTorneo = (e, j) => !tieneItem(j, 'arco') ? 'Necesitas tener un arco para participar.' : !tieneItem(j, 'flechas') ? 'Necesitas al menos una flecha.'
  : j.extra.murciaTurno != null && j.turnos < j.extra.murciaTurno + TORNEO.cadaTurnos ? 'Podrás volver a participar en tu próximo turno.'
  : j.npc && j.dinares < TORNEO.costo + TORNEO.soborno ? `Yafar NPC soborna a los jueces: necesita ${TORNEO.costo + TORNEO.soborno} dinares.`
  : j.dinares < TORNEO.costo ? `Cuesta ${TORNEO.costo} dinares: sin dinero no hay trato.` : null;
T.R51 = { ciudad: 'Andalucía', req: (d, e, pid) => motivoTorneo(e, e.jugadores[pid]),
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid];
    if (j.npc) return torneoSoborno(e, pid);   // Yafar NPC siempre soborna
    if (j.pj === 'B') {   // Yafar jugador decide: tirar o sobornar
      const total = TORNEO.costo + TORNEO.soborno, falta = total - j.dinares;
      pedir(e, { tipo: 'reto', para: [pid], titulo: 'R51 · Torneo de Murcia', texto: `Entrada: ${TORNEO.costo} dinares. Puedes tirar tu dado (1 o 6 ganas) o sobornar a los jueces con ${TORNEO.soborno} dinares más y ganar sin tirar.`,
        opciones: [{ id: 'tirar', texto: `Tirar el dado (${TORNEO.costo} dinares)` }, { id: 'sobornar', texto: `Sobornar a los jueces (${total} dinares en total)${falta > 0 ? ` — te faltan ${falta} dinares` : ''}`, desactivada: falta > 0 }],
        porDefecto: 'tirar', limiteMs: 60000, cont: { fn: 'reto.murcia', args: {} } });
      return;
    }
    torneoTirar(data, e, pid, ctx);
  } };
function torneoEntrar(e, j) { j.dinares -= TORNEO.costo; quitarPrimero(j, 'item', 'flechas'); j.extra.murciaTurno = j.turnos; }
function torneoGana(e, pid, como) {
  const j = e.jugadores[pid]; j.extra.arcoMaximo = true; hacer(e, pid, 'R51');
  log(e, `${j.nombre} gana el Torneo de Murcia${como}: desde ahora tiene la destreza máxima en arco (sus flechas siempre aciertan).`, { pid, aviso: true });
}
function torneoSoborno(e, pid) {
  const j = e.jugadores[pid]; torneoEntrar(e, j); j.dinares -= TORNEO.soborno;
  if (!j.npc) info(e, pid, 'Torneo de Murcia', `Pagas ${TORNEO.costo} de entrada y ${TORNEO.soborno} de soborno a los jueces: ganas el torneo y la destreza máxima en arco.`);
  torneoGana(e, pid, ` sobornando a los jueces (${TORNEO.costo + TORNEO.soborno} dinares)`);
}
function torneoTirar(data, e, pid, ctx) {
  const j = e.jugadores[pid]; torneoEntrar(e, j);
  const [x] = ctx.t(`${j.nombre}: Torneo de Murcia (1 o 6 gana)`, 1);
  if (TORNEO.gana.includes(x)) { ctx.say('¡Ganas el torneo! Destreza máxima en arco: tus flechas siempre aciertan y el rival pelea con −1.'); torneoGana(e, pid, ''); }
  else { j.noches += TORNEO.noches; ctx.say(`No ganas esta vez, pero te llevas ${TORNEO.noches} noches por la historia. Podrás volver a participar dentro de ${TORNEO.cadaTurnos} turnos.`); log(e, `${j.nombre} pierde el Torneo de Murcia y gana ${TORNEO.noches} noches.`, { pid }); }
}
registrar('reto.murcia', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  if (resp.opcion === 'sobornar' && j.dinares >= TORNEO.costo + TORNEO.soborno) return torneoSoborno(e, pid);
  const ctx = nuevoCtx(e, pid, 'R51'); torneoTirar(data, e, pid, ctx); ctx.fin();
});
T.R45 = { ciudad: 'India', req: (d, e, pid) => (e.jugadores[pid].npc ? 'Yafar NPC no trabaja para el Nizam.' : null),
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; hacer(e, pid, 'R45');
    const [x] = ctx.t(`${j.nombre}: trabajo para el Nizam (10 dinares + 5 por punto)`, 1);
    const pago = 10 + 5 * x; j.dinares += pago; j.noches += 10;   // Jorge (10 de noviembre): además 10 noches
    j.pierdeTurno = (j.pierdeTurno || 0) + 1; j.extra.nizam = true;
    ctx.say(`El Nizam te paga ${pago} dinares y ganas 10 noches. Pierdes tu siguiente turno y, en el que sigue, tu acción principal.`);
    log(e, `${j.nombre} trabaja para el Nizam de Hyderabad y cobra ${pago} dinares y 10 noches: pierde su siguiente turno y, en el que sigue, su acción principal.`, { pid });
  } };
// R46 «Aprender persa» (Isfahán) y R47 «Aprender árabe» (Yemen), Jorge (10 de noviembre): pagas 5 dinares y tiras 1 dado (con botón);
// par: te quedas 1 turno, impar: 2. Esos turnos no puedes salir de la ciudad y tu acción principal se va en las clases (sí cobras
// ingreso, compras y haces acciones libres). Al terminar, «Habla persa» o «Habla árabe» para siempre. Una vez por jugador.
// R48 «Enseñar persa» (Estambul o Bagdad) y R49 «Enseñar árabe» (Andalucía): con tu acción principal, 4 dinares por noche; cada turno.
const IDIOMAS = { R46: { idioma: 'persa', ciudad: 'Isfahán' }, R47: { idioma: 'árabe', ciudad: 'Yemen' } };
export const hablaIdioma = (j, idioma) => (j.extra?.idiomas || []).includes(idioma);
for (const [id, I] of Object.entries(IDIOMAS)) {
  T[id] = { ciudad: I.ciudad, req: (d, e, pid) => { const j = e.jugadores[pid]; return j.npc ? 'Yafar NPC no toma clases.' : hablaIdioma(j, I.idioma) ? `Ya hablas ${I.idioma}.` : j.dinares < 5 ? 'Las clases cuestan 5 dinares: sin dinero no hay trato.' : null; },
    run(data, e, pid, ctx) {
      const j = e.jugadores[pid]; j.dinares -= 5; hacer(e, pid, id);
      const [x] = ctx.t(`${j.nombre}: clases de ${I.idioma} (par, 1 turno; impar, 2)`, 1);
      const n = x % 2 === 0 ? 1 : 2;
      j.extra.estudio = { idioma: I.idioma, ciudad: I.ciudad, desde: j.turnos, hasta: j.turnos + n };
      ctx.say(`Pagas 5 dinares de clases. Te quedas ${n === 1 ? '1 turno' : '2 turnos'} en ${I.ciudad} estudiando ${I.idioma}: no puedes salir y tu acción principal se va en las clases.`);
      log(e, `${j.nombre} se inscribe a clases de ${I.idioma} en ${I.ciudad}: ${n === 1 ? '1 turno' : '2 turnos'}.`, { pid });
    } };
}
export function turnoEstudio(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, s = j?.extra?.estudio;
  if (!s || !t) return;
  if (j.ciudad !== s.ciudad) { j.extra.estudio = null; return; }   // si un evento lo sacó de la ciudad, pierde las clases
  t.principal = true; t.estudiando = true;
  log(e, `${j.nombre} pasa este turno en clases de ${s.idioma} (${j.turnos - s.desde} de ${s.hasta - s.desde}).`, { pid });
}
export function finEstudio(data, e, pid) {
  const j = e.jugadores[pid], s = j?.extra?.estudio;
  if (!s || j.turnos < s.hasta) return;
  j.extra.estudio = null; (j.extra.idiomas ||= []).push(s.idioma);
  publicarCarta(e, { id: 'habla:' + s.idioma, deck: 'reto', titulo: `Habla ${s.idioma}`, sub: 'Habilidad', texto: `Terminaste tus clases en ${s.ciudad}: ya hablas ${s.idioma}. Puedes enseñarlo ${s.idioma === 'persa' ? 'en Estambul y en Bagdad' : 'en Andalucía'} por 4 dinares cada noche.`, arte: 're' }, pid, [pid]);
  log(e, `${j.nombre} termina sus clases: ya habla ${s.idioma}.`, { pid, aviso: true });
}
const ENSENAR = { R48: { idioma: 'persa', ciudades: ['Estambul', 'Bagdad'] }, R49: { idioma: 'árabe', ciudades: ['Andalucía'] } };
for (const [id, I] of Object.entries(ENSENAR)) {
  T[id] = { ciudades: I.ciudades, req: (d, e, pid) => (hablaIdioma(e.jugadores[pid], I.idioma) ? null : `Necesitas hablar ${I.idioma} (reto ${id === 'R48' ? 'R46, en Isfahán' : 'R47, en Yemen'}).`),
    run(data, e, pid, ctx) { const j = e.jugadores[pid]; j.dinares += 4; ctx.say(`Enseñas ${I.idioma} esta noche: te pagan 4 dinares.`); log(e, `${j.nombre} enseña ${I.idioma} en ${j.ciudad} y cobra 4 dinares.`, { pid }); } };   // no queda hecho: se repite cada turno
}
T.R44 = { ciudad: 'Magreb', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'La caravana a Timbuktú cuesta 10 dinares.'),
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; j.dinares -= 10; j.noches += 30; hacer(e, pid, 'R44');
    ctx.say(`${j.nombre} cruza el Sahara con la caravana de la sal y visita Timbuktú: gana 30 noches.`);
    if (e.mansaGenerosa && e.ronda <= e.mansaGenerosa.hasta && !j.npc) {          // Jorge (punto 3): Mansa Musa no beneficia a Yafar
      const [x] = ctx.t(`${j.nombre}: la generosidad de Mansa Musa (6: 50 dinares y 60 noches; 4 o 5: 35 y 40; 1 a 3: 30 noches)`, 1);
      const p = x === 6 ? { d: 50, n: 60 } : x >= 4 ? { d: 35, n: 40 } : { d: 0, n: 30 };
      j.dinares += p.d; j.noches += p.n;
      ctx.say(`Mansa Musa lo recibe: ${p.d ? p.d + ' dinares y ' : ''}${p.n} noches más.`);
    }
  } };
T.R40 = { ciudad: 'Yemen', req: (d, e, pid) => { const j = e.jugadores[pid]; if (j.herido) return 'Herido no puedes embarcarte.'; return j.dinares >= 15 ? null : 'El pasaje cuesta 15 dinares.'; },
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; j.dinares -= 15;
    const [x] = ctx.t(`${j.nombre}: el cruce del estrecho de Bab el-Mandeb`, 1);
    const b = (j.destreza ? 1 : 0) + (tieneItem(j, 'camello') ? 1 : 0), r = x + b;
    if (b) ctx.say(`Bonos: ${[j.destreza && 'destreza +1', tieneItem(j, 'camello') && 'camello +1'].filter(Boolean).join(', ')} → ${r}.`);
    if (r >= 6) {
      hacer(e, pid, 'R40');
      const id = robar(e, 'ifrit');
      if (id) { j.mano.push({ uid: uid(e), tipo: 'ifrit', ref: id }); publicarCarta(e, cartaDatos(data, 'ifrit', id), pid, [pid]); ctx.say('Llegas a Abisinia y en sus montañas encuentras una lámpara: ganas una carta de Ifrit. Vuelves a Yemen.'); }
      else { j.dinares += 40; ctx.say('Llegas a Abisinia, pero los genios ya se fueron: te llevas 40 dinares. Vuelves a Yemen.'); }
    } else if (r >= 4) ctx.say('Las corrientes te regresan a Moca: pierdes el pasaje.');
    else { j.herido = true; ctx.say('Tormenta en el estrecho: pierdes el pasaje y quedas herido.'); }
  } };
// R41 (regla de la casa): el ídolo de Toledo, uno solo por partida. 1 dado +1 destreza: 5+ lo robas; 3–4 nada; 1–2 herido y 20 de rescate.
T.R41 = { ciudad: 'Andalucía', req: (d, e) => (e.idolo ? 'El ídolo de Toledo ya no está en su iglesia.' : null),
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid];
    const [x] = ctx.t(`${j.nombre}: cruzar de noche hasta la iglesia de Toledo`, 1);
    // +1 «duas del sheij» (una sola vez) si tienes algo de Abu Madyan, Ibn Arabi o Ibn Hazm: su Mensaje en curso o cumplido, la Bendición, el Dado o un libro de Ibn Hazm.
    const SHEIJS = ['Abu Madyan', 'Ibn Arabi', 'Ibn Hazm'], deActivos = j.mensajes.map((m) => data.mensajes.mensajes.find((q) => q.id === m.id)?.de);
    const duas = [...deActivos.filter((d) => SHEIJS.includes(d)).map((d) => `mensaje de ${d}`), ...(j.extra.sheijsCumplidos || []).filter((d) => SHEIJS.includes(d)).map((d) => `mensaje cumplido de ${d}`),
      tieneItem(j, 'bendicionAbuMadyan') && 'Bendición de Abu Madyan', tieneItem(j, 'dadoIbnArabi') && 'Dado de Ibn Arabi', tieneItem(j, 'libroIbnHazm') && 'libro de Ibn Hazm'].filter(Boolean);
    const r = x + (j.destreza ? 1 : 0) + (duas.length ? 1 : 0);
    if (j.destreza || duas.length) ctx.say(`${[j.destreza && 'destreza +1', duas.length && `duas del sheij +1 (${duas[0]})`].filter(Boolean).join(', ')} → ${r}.`);
    if (r >= 5) { e.idolo = 'robado'; hacer(e, pid, 'R41'); darItem(e, j, 'idolo'); ctx.say('Te llevas el ídolo: ganas la carta «Ídolo de Toledo».'); log(e, `${j.nombre} roba el Ídolo de Toledo.`, { pid, aviso: true }); }
    else if (r >= 3) ctx.say('Los guardias te ven y huyes con las manos vacías.');
    else { j.herido = true; pagar(data, e, pid, 20); ctx.say('Te atrapan: quedas herido y pagas 20 dinares de rescate.'); log(e, `${j.nombre} intenta robar el ídolo de Toledo y lo atrapan: queda herido y paga 20 dinares de rescate.`, { pid, aviso: true }); }
  } };

// ---------------------------------------------------------------- Mensajes de los sheijs (R 18): se completan solos
// Obras reales de Ibn Hazm de Córdoba (Dios tenga misericordia de él) que regala al cumplir su Mensaje.
const OBRAS_IBN_HAZM = ['El collar de la paloma', 'Al-Muhalla', 'Los caracteres y las conductas', 'Al-Fisal', 'Al-Ihkam fi usul al-ahkam'];
const LIBROS_IBN_HAZM_MAX = 2;
const LIBRO_IBN_HAZM_MSG = 'M6';   // solo el Mensaje de entregar un libro, papiro o mapa: el jurista te repone un libro
const IDS_LIBRO = (c) => esLibro(c) || (c.tipo === 'objeto' && ['OB38', 'OB46', 'OB47'].includes(c.ref));   // papel de Samarcanda, manuscritos de la India y libros de Córdoba cuentan como libro
export function mensajes(data, e, pid, ev, inf) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado) return;
  for (const m of j.mensajes.slice()) revisarMensaje(data, e, pid, m.id, ev, inf);
}
function revisarMensaje(data, e, pid, id, ev, inf) {
  const j = e.jugadores[pid], t = e.turno;
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
  j.dinares += m.dinares; j.noches += m.noches; e.mazos.descarte.mensajes.push(id); j.mensajes = j.mensajes.filter((x) => x.id !== id);
  log(e, `${j.nombre} cumple un mensaje de ${m.de} y cobra ${m.dinares} dinares${m.noches ? ' y ' + m.noches + ' noches' : ''}.`, { pid });
  (j.extra.sheijsCumplidos ||= []).push(m.de);
  if (m.de === 'Ibn Arabi' && !tieneItem(j, 'dadoIbnArabi')) {                          // regla de la casa: el Dado de Ibn Arabi
    darItem(e, j, 'dadoIbnArabi'); log(e, `Ibn Arabi regala a ${j.nombre} un dado para cambiar su suerte: repetirá la próxima pelea que vaya a perder.`, { pid });
  }
  if (m.de === 'Averroes' && !e.recetaAverroesDada) {                                   // regla de la casa: una sola Receta de Averroes por partida
    e.recetaAverroesDada = true; darItem(e, j, 'recetaAverroes');
    log(e, `Averroes regala a ${j.nombre} su receta de médico: la única de la partida, cura una herida.`, { pid, aviso: true });
  }
  if (m.de === 'Abu Madyan' && !e.bendicionAbuMadyanDada) {                             // regla de la casa: una sola Bendición de Abu Madyan por partida
    e.bendicionAbuMadyanDada = true; darItem(e, j, 'bendicionAbuMadyan');
    log(e, `Abu Madyan bendice a ${j.nombre}: la única bendición de la partida, lo protege de los asaltos en el Magreb y Andalucía.`, { pid, aviso: true });
  }
  if (id === LIBRO_IBN_HAZM_MSG && j.mano.filter((c) => c.tipo === 'item' && c.ref === 'libroIbnHazm').length < LIBROS_IBN_HAZM_MAX) {   // regla de la casa: libros de Ibn Hazm
    const titulo = OBRAS_IBN_HAZM[((e.librosIbnHazm = (e.librosIbnHazm || 0) + 1) - 1) % OBRAS_IBN_HAZM.length];
    darItem(e, j, 'libroIbnHazm', { valor: 50, ronda: e.ronda, titulo });
    log(e, `Ibn Hazm regala a ${j.nombre} un ejemplar de «${titulo}»: la biblioteca de Bagdad lo compra a buen precio.`, { pid });
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
