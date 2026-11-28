// Retos y misiones R1-R41 (R 14), Mensajes de los sheijs (R 18) y carta de Kanmakán (R 15.5).
// Los retos con varios pasos usan decisiones pendientes (pend) con continuaciones registradas; los plazos cuentan turnos PROPIOS (R 14.1).
import { huidaCuentaViaje } from './base.js';
import {
  ok, err, rnd, dado, dados, suma, par, log, nombre, ciudadDe, objDe, activos, humanosVivos, enCiudad, tieneItem, tieneObj, tieneEsp, quitarCarta, quitarPrimero, uid, darItem, darObjeto, pagar, patrimonio,
  publicarCarta, cartaDatos, robar, eliminar, TESOROS, HOOK, esLibro, valorLibro, mostrarDados, consumirObj, info, pedir, registrar, CONT, ofrecerObjetos, devolverObjeto, recortarMano, robarBotin, ITEMS, puedePrincipal, tarifa,
itemDatos, soloJambiya, MSJ_SOLO_JAMBIYA, puedeEntrenarArma, tieneDestrezaGeneral, darDestreza, ALFOMBRAS, alfombrasEn, moverAlfombras, tieneCarga, limiteCarga, nCarga, viajePorMar, HERIDO_BARCO, deudasDe, deudaDe, contraerDeuda, pagarDeuda, } from './base.js';
import { peleaNPC, perfil, armasUsables } from './pelea.js';

const m1 = (data, id) => data.retos.retos.find((r) => r.id === id);

// ---------------------------------------------------------------- utilidades
// Las cartas que el reto publica antes de mostrar sus dados (un caballo, un camello, una carta de Ifrit…) son consecuencias: se marcan
// con trasDados para que el servidor no las muestre hasta que el jugador tire y se cierren los dados (Jorge, 11 de noviembre).
function marcarTrasDados(e, nro0, d) { if (d) for (const h of e.historial) if (h.nro > nro0 && h.nro < d.id && !h.causa && !(d.contexto && d.contexto === h.titulo)) h.trasDados = d.id; }
// Desenlace (Jorge, 21 de noviembre): «cada reto que pierdas o ganes debe decirte qué pasó». Con dados, el desenlace va en la ventana de
// los dados (y las consecuencias se ven al cerrarla); sin dados, sale una alerta de 5 segundos (se cierra sola, al tocarla o deslizándola).
function nuevoCtx(e, pid, id) { const nro0 = e.seq; return { grupos: [], res: [], t(etq, n = 1) { const v = dados(e, n); this.grupos.push({ etq, valores: v }); return v; }, say(x) { this.res.push(x); },
  fin(des = null) {
    // des.previas ya están en el registro (las escribió el reto); des.cierre (si lo lograste y el saldo) se registra aquí
    if (this.grupos.length) marcarTrasDados(e, nro0, mostrarDados(e, { por: pid, motivo: 'reto:' + id, grupos: this.grupos, resumen: [`Reto ${id}:`, ...this.res, ...(des ? [...des.previas, ...des.cierre] : [])], sinRegistro: des ? { desde: 1 + this.res.length, n: des.previas.length } : null }));
    else { for (const r of this.res) log(e, r, { pid }); if (des) alertaPropia(e, pid, { ...des, previas: [...des.previas, ...this.res] }); else if (this.res.length) { const a = ACC.e === e && ACC.alertas[pid]; if (a) { const [t0, ...resto] = a.texto.split('\n'); a.texto = [t0, ...this.res, ...resto].join('\n'); } else info(e, pid, `Reto ${id}`, this.res.join(' ')); } }
  } }; }
const nProb = (e) => activos(e).length;
export function premio(data, e, pid, { dinares = 0, noches = 0 }, texto = '') {
  const j = e.jugadores[pid];
  j.dinares += dinares; j.noches += noches;
  if (texto) log(e, texto + `${dinares ? ' +' + dinares + ' dinares' : ''}${noches ? ' +' + noches + ' noches' : ''}.`, { pid });
}
const cobrarFijo = (data, e, pid, monto) => { const j = e.jugadores[pid]; if (j.dinares < monto) return false; j.dinares -= monto; return true; };
function hacer(e, pid, id) { const j = e.jugadores[pid]; if (!j.retosHechos.includes(id)) j.retosHechos.push(id); }
// Jorge (18 de noviembre): cada reto se hace una sola vez por jugador, salvo los que por su naturaleza se repiten: llevar mercancía o
// encargos (libros R4, papiros R10, sacos de sal R23, manzanas R24, comprar alfombras R17, pergamino R30 y posta R39). R7 ya no existe.
// R8 y R9 se repiten como siempre: cuando sales de El Cairo y vuelves. Aparte siguen igual: los Asesinos (R15), enseñar un idioma
// (R48, R49), forjar si ya no tienes cimitarra (R52) y reintentar un reto fallado.
export const REPETIBLES = ['R4', 'R23', 'R24', 'R17', 'R30', 'R39'];   // R10 ya no se repite (Jorge, 19 de noviembre)
export const REPITE_AL_VOLVER = ['R8', 'R9'];
// Jorge (19 de noviembre): Anís puede repetir R26 «Acostarse con Zein en la Giralda» (solo él).
const repitePorPj = (j, id) => id === 'R26' && j.pj === '3';
const yaNoSePuede = (j, id) => hecho(j, id) && !REPETIBLES.includes(id) && !repitePorPj(j, id) && !(REPITE_AL_VOLVER.includes(id) && !j.extra.rep?.[id]);
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
const LIBRO_IBN_HAZM_VALOR = 50;   // lo que vale al recibirlo un Libro de Ibn Hazm
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
// Jorge (19 de noviembre): el arco no cuenta como arma (R8, R32, R36 y alistarse en R54 piden otra).
const tieneArma = (data, e, j) => ['alfanje', 'cimitarra', 'jambiya'].some((r) => tieneItem(j, r));

// ---------------------------------------------------------------- catálogo (ciudad, objetos usables, requisito, ejecución)
const T = {};   // T[id] = { ciudad, objs, req(data,e,pid)->string|null, run(data,e,pid,ctx,usados) }
const OBJS = {
  R28: ['OB07', 'OB21', 'OB43', 'OB08', 'OB06', 'OB09'], R29: ['OB05', 'OB18'], R30: ['OB14', 'OB17', 'OB21'], R31: ['OB07', 'OB41', 'OB14', 'OB43', 'OB08', 'OB21', 'OB30', 'OB06'], R33: ['OB10', 'OB05', 'OB08'],
  R34: ['OB09', 'OB06', 'OB26'], R35: ['OB30'], R37: ['OB21', 'OB30'], R38: ['OB13'],
};
const hecho = (j, id) => j.retosHechos.includes(id);
// «Sirve para»: retos (y mensajes) donde se usa o se entrega cada carta, para mostrarlo en la mano y en el mercado.
const ITEM_RETO = { yegua: ['R50'], alfombraIsfahan: ['R17'], esclava: ['R3'], mapa: ['R3'], libro: ['R4'], papiro: ['R4', 'R10'], cesta: ['R24'], sal: ['R23'], pergaminoSellado: ['R30'], cartaUrgente: ['R39'], esclavoSamarra: ['R67'], camello: ['R29'], idolo: ['R41'],
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
// Jorge (26 de noviembre, solo en el 3D): si los libros que dan las transcripciones de los tres sheijs (R60 Ibn Hazm, R61 Abu Hayyan,
// R62 Ibn Arabi; y las traducciones al persa) valen distinto, en Acciones se dice cuánto valen y cuál conviene más.
function marcarCopias(e, r) {
  const valor = (id) => TRANSCRIBIR.libros * (COPIAS[id].ibnHazm ? LIBRO_IBN_HAZM_VALOR : libroNuevo(e).valor);
  const cs = r.filter((x) => x.k === 'reto' && COPIAS[x.id]);
  if (cs.length < 2 || new Set(cs.map((x) => valor(x.id))).size < 2) return;
  const max = Math.max(...cs.map((x) => valor(x.id)));
  const mejores = cs.filter((x) => valor(x.id) === max).map((x) => x.id);
  for (const x of cs) {
    const v = valor(x.id), mejor = v === max;
    x.conviene = mejor;
    if (mejor) x.titulo += ' · te conviene más';
    x.nota = `Sus ${TRANSCRIBIR.libros} libros valen hoy ${v} dinares en total (${v / TRANSCRIBIR.libros} cada uno; ganan 2 por ronda)${mejor ? ': son los que más valen.' : `; los de ${mejores.join(' y ')} valen ${max}.`}`;
  }
}
export function disponibles(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, r = [];
  const recupera = t?.heridoAhora && t.principal && !j.transito && !j.perdido ? RECUPERANDO : null;   // se ven, pero deshabilitados y con el motivo
  const sinPrincipal = t && !recupera && !puedePrincipal(t) ? 'Ya usaste tu acción principal en este turno.' : null;   // se ven, apagados y con el motivo (Jorge, 11 de noviembre)
  if (!t || j.transito || j.perdido) return r;
  for (const id of Object.keys(T)) {
    const d = m1(data, id);
    if (!d || !(T[id].ciudades || [d.ciudad]).includes(j.ciudad)) continue;
    if (yaNoSePuede(j, id)) {
      // los entrenamientos ya hechos se siguen viendo, apagados y con el motivo (Jorge, 11 de noviembre)
      if (id === 'R25' || ENTRENAMIENTOS[id]) r.push({ k: 'reto', id, titulo: id + ' · ' + d.nombre, texto: d.resolucion && d.resolucion.split(d.ciudad).join(j.ciudad), requisito: d.requisito, premio: d.premio, bloqueado: id === 'R25' ? 'Ya tienes destreza con armas.' : `Ya entrenaste con ${ENTRENAMIENTOS[id].arma}.` });
      continue;
    }
    if (esperaVolver(j, id)) continue;
    if (j.misiones.some((m) => m.id === id)) continue;
    const msg = (RETOS_MAR.includes(id) && j.herido ? HERIDO_BARCO : null) || (T[id].req ? T[id].req(data, e, pid) : null);   // herido no te embarcas (Jorge, 19 de noviembre)
    r.push({ k: 'reto', id, titulo: id + ' · ' + d.nombre, texto: d.resolucion && d.resolucion.split(d.ciudad).join(j.ciudad), requisito: d.requisito, premio: d.premio, bloqueado: recupera || sinPrincipal || msg || undefined });
  }
  marcarCopias(e, r);
  return r;
}
// Pagar una deuda con una ciudad (Jorge, 21 de noviembre): solo en esa ciudad, en cualquier momento de tu turno, sin gastar la acción
// principal y solo si te alcanzan los dinares. Ya no impide salir; al volver te la cobran sola (base.js).
export function opcionesPagoDeuda(e, j) {
  if (j.transito) return [];
  return deudasDe(j).filter((d) => d.ciudad === j.ciudad).map((d) => {
    const falta = d.monto - j.dinares;
    return { k: 'reto', id: d.reto, sub: 'pagar', titulo: `${d.reto} · Pagar tu deuda con ${d.ciudad} (${d.monto} dinares)`, texto: `Pagas ahora con dinares y no gasta tu acción principal. Puedes irte sin pagarla: te la cobran solos cuando vuelvas a ${d.ciudad} (aunque quedes en negativo).`, bloqueado: falta > 0 ? `Te faltan ${falta} dinares para pagar tu deuda.` : undefined };
  });
}

export function iniciarReto(data, e, pid, a) {
  const j = e.jugadores[pid], t = e.turno;
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (a.sub === 'comprar' && a.id === 'R67') return comprarEsclavos(data, e, pid);
  if (a.sub === 'pagar') {
    const d = deudaDe(j, a.id) || (!a.id && deudasDe(j)[0]);
    if (!d) return err('No debes nada.');
    if (d.ciudad !== j.ciudad) return err(`Tu deuda con ${d.ciudad} solo se paga en ${d.ciudad}.`);   // Jorge (21 de noviembre)
    if (j.dinares < d.monto) return err(`Te faltan ${d.monto - j.dinares} dinares para pagar tu deuda.`);   // sin dinero no hay trato
    pagarDeuda(e, pid, d); return ok();
  }
  if (!puedePrincipal(t)) return err('No tienes acción principal disponible.');
  const def = T[a.id], d = m1(data, a.id);
  if (!def) return err('Reto inexistente.');
  if (!(def.ciudades || [d.ciudad]).includes(j.ciudad)) return err(`Ese reto está en ${(def.ciudades || [d.ciudad]).join(' o ')}.`);
  if (j.transito || j.perdido) return err('No puedes ahora.');
  if (yaNoSePuede(j, a.id)) return err(REPITE_AL_VOLVER.includes(a.id) ? 'Ya lo hiciste: sal de la ciudad y vuelve para repetirlo.' : 'Ya completaste ese reto: cada reto se hace una sola vez.');
  if (esperaVolver(j, a.id)) return err('Fallaste este reto: sal de la ciudad y vuelve para intentarlo otra vez.');
  if (j.misiones.some((m) => m.id === a.id)) return err('Ya lo tienes en curso.');
  if (RETOS_MAR.includes(a.id) && j.herido) return err(HERIDO_BARCO);   // Jorge (19 de noviembre)
  const msg = def.req ? def.req(data, e, pid) : null;
  if (msg) return err(msg);
  t.principal = true;
  // Jorge (19 de noviembre): primero sale la carta del reto y la cierras; solo entonces sus objetos, dados, botones y resultado
  // (todo lo que sigue tiene un número mayor y el cliente lo pone detrás de la carta).
  if (!j.npc) publicarCarta(e, { ...cartaEnCiudad(cartaDatos(data, 'reto', a.id), d.ciudad, def.ciudades && j.ciudad), causa: true }, pid, [pid]);   // causa: no es consecuencia de los dados
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
export const ciudadesReto = (id) => (T[id] ? T[id].ciudades || [T[id].ciudad] : []);   // dónde se hace un reto (para Yafar NPC)
export const puedeRetoNPC = (data, e, pid, id) => { const j = e.jugadores[pid], def = T[id], d = m1(data, id); return !!(def && d && !hecho(j, id) && !(def.req && def.req(data, e, pid))); };
registrar('reto.obj', (data, e, args, resp) => ejecutar(data, e, resp.pid, args.id, (resp.valores || []).map((u) => e.jugadores[resp.pid].mano.find((c) => c.uid === u)?.ref).filter(Boolean)));
// Resultado de un reto para los DEMÁS jugadores (Jorge, 19 de noviembre): no ven ninguna ventana, solo una alerta que se quita al
// tocarla, verde si lo logró y gris si no (o si sigue en curso), y una línea en el registro. Se decide comparando antes y después.
const fotoReto = (j) => ({ d: j.dinares, n: j.noches, m: j.mano.length, mis: j.misiones.length, pt: j.pierdeTurno || 0, h: !!j.herido, ex: JSON.stringify([j.destreza, j.extra?.destrezaJambiya, j.extra?.entrenado, j.extra?.idiomas, j.extra?.polimata, j.extra?.arcoMaximo]), curso: !!(j.extra?.forja || j.extra?.estudio || j.extra?.emir) });
// Cada reto fija su resultado real en ctx.resultado ('logro' o 'fallo'). Jorge (19 de noviembre): si fallas pero te llevas un premio
// de consuelo, los demás ven «no logró» en gris. ctx.sinAnuncio: el resultado se anuncia después, en la continuación del reto.
function resultadoReto(e, pid, antes, ctx) {
  const j = e.jugadores[pid], a = fotoReto(j);
  if (ctx.sinAnuncio) return null;
  if (j.eliminado) return 'fallo';
  if (ctx.resultado) return ctx.resultado;
  const esperando = [e.pend, ...(e.colaPend || [])].some((p) => p && p.para?.includes(pid) && p.tipo !== 'info');
  if (esperando || a.mis > antes.mis || (a.curso && !antes.curso)) return 'curso';
  if (ctx.fallo || (a.h && !antes.h) || a.pt > antes.pt) return 'fallo';
  if (a.n > antes.n || a.d > antes.d || a.m > antes.m || a.ex !== antes.ex) return 'logro';
  return 'fallo';
}
export function anunciarReto(data, e, pid, id, res, propio = true) {
  const j = e.jugadores[pid], d = m1(data, id); if (!j || !d || !res) return;
  const verbo = res === 'logro' ? 'logró' : res === 'curso' ? 'empezó' : 'no logró';
  const texto = `${j.nombre} ${verbo} el reto ${id} (${d.nombre}).`;
  log(e, texto, { pid });
  anunciar(e, pid, texto, res === 'logro' ? 'ok' : 'gris');
  // Reto en varios pasos que termina ahora (entrega, plazo vencido, continuación): su desenlace para quien lo hizo (Jorge, 21 de noviembre).
  if (propio && res !== 'curso' && ACC.e === e && !j.npc) alertaPropia(e, pid, desenlace(data, e, pid, id, res, ACC.fotos[pid], ACC.desde[pid] ?? ACC.logN, [texto]));
}

// ---------------------------------------------------------------- desenlace de cada reto para quien lo hace (Jorge, 21 de noviembre)
// Cada acción (y cada tic del reloj) marca dónde empieza el registro y cómo estaba cada jugador; así un reto que termina en esa acción
// puede decir qué pasó y qué ganaste o perdiste. No se guarda en la partida.
const ACC = { e: null, logN: 0, fotos: {}, alertas: {}, desde: {} };
const fotoSaldo = (j) => ({ d: j.dinares, n: j.noches, h: !!j.herido, mano: j.mano.map((c) => ({ uid: c.uid, tipo: c.tipo, ref: c.ref })) });
// Al llegar a una ciudad y al iniciar el turno se vuelve a marcar al jugador: así el desenlace de una entrega no cuenta el pasaje ni las noches de la llegada.
export function marcarJugador(e, pid) { if (ACC.e !== e) marcarAccion(e); const j = e.jugadores[pid]; if (j) { ACC.fotos[pid] = fotoSaldo(j); ACC.desde[pid] = e.logN || 0; } }
export function marcarAccion(e) { ACC.e = e; ACC.logN = e.logN || 0; ACC.fotos = {}; ACC.alertas = {}; ACC.desde = {}; for (const j of Object.values(e.jugadores || {})) ACC.fotos[j.id] = fotoSaldo(j); }
function nombreCarta(data, c) {
  try {
    if (c.tipo === 'item') return itemDatos(data, c.ref)?.titulo || ITEMS[c.ref]?.nombre || c.ref;
    if (c.tipo === 'especial') return data.objetos.especiales.find((x) => x.id === c.ref)?.nombre || c.ref;
    return cartaDatos(data, c.tipo, c.ref)?.titulo || c.ref;
  } catch { return c.ref; }
}
const fmtN = (n) => Math.abs(n).toLocaleString('es-MX');
function listaCartas(data, cs) {
  const cuenta = new Map(); for (const c of cs) { const k = nombreCarta(data, c); cuenta.set(k, (cuenta.get(k) || 0) + 1); }
  return [...cuenta].map(([k, n]) => (n > 1 ? `${n} × ${k}` : k)).join(', ');
}
// Lo que cambió para el jugador desde «antes»: dinares, noches, cartas que entran y salen, herido.
function balance(data, j, antes) {
  if (!antes) return '';
  const partes = [], dd = j.dinares - antes.d, dn = j.noches - antes.n;
  if (dd) partes.push(`${dd > 0 ? '+' : '−'}${fmtN(dd)} ${Math.abs(dd) === 1 ? 'dinar' : 'dinares'}`);
  if (dn) partes.push(`${dn > 0 ? '+' : '−'}${fmtN(dn)} ${Math.abs(dn) === 1 ? 'noche' : 'noches'}`);
  const uids0 = new Set(antes.mano.map((c) => c.uid)), uids1 = new Set(j.mano.map((c) => c.uid));
  const entran = j.mano.filter((c) => !uids0.has(c.uid)), salen = antes.mano.filter((c) => !uids1.has(c.uid));
  if (entran.length) partes.push(`recibes ${listaCartas(data, entran)}`);
  if (salen.length) partes.push(`entregas ${listaCartas(data, salen)}`);
  if (j.herido && !antes.h) partes.push('quedas herido');
  return partes.length ? `En total: ${partes.join('; ')}.` : 'En total: no ganas ni pierdes nada.';
}
const TITULAR = { logro: '¡Lo lograste!', fallo: 'No lo lograste.', curso: 'El reto sigue en curso.' };
// Desenlace: lo que pasó (lo que el reto escribió en el registro durante esta acción), si lo lograste y el saldo.
function desenlace(data, e, pid, id, res, antes, logN0, omitir = []) {
  const j = e.jugadores[pid], d = m1(data, id);
  const fuera = new Set(omitir);
  const lineas = e.log.filter((l) => (l.n || 0) > logN0 && l.pid === pid && !l.saldo && !l.deDados && !fuera.has(l.texto) && !/ intenta el reto | (logró|no logró|empezó) el reto /.test(l.texto)).map((l) => l.texto);
  const cierre = [];
  if (res && TITULAR[res]) cierre.push(TITULAR[res]);
  if (res === 'logro' || res === 'fallo') { const b = balance(data, j, antes); if (b) cierre.push(b); }
  return { id, titulo: `Reto ${id}${d ? ' · ' + d.nombre : ''}`, res, previas: lineas, cierre };
}
// Alerta propia de 5 segundos (cliente): solo la ve quien hizo el reto. Si mientras tanto salen dados, espera a que se cierren.
function alertaPropia(e, pid, des) {
  const j = e.jugadores[pid];
  if (!j || j.npc || !des || !(des.previas.length + des.cierre.length)) return;
  for (const l of des.cierre) log(e, l, { pid });
  const a = { id: ++e.seq, t: e.ahora, para: [pid], texto: [des.titulo + ':', ...des.previas, ...des.cierre].join('\n'), tono: des.res === 'logro' ? 'ok' : des.res === 'fallo' ? 'rojo' : 'gris', propio: true };
  (e.anuncios ||= []).push(a); if (ACC.e === e) ACC.alertas[pid] = a;   // si el reto escribe algo más en esta acción, se agrega aquí (ctx.fin)
  if (e.anuncios.length > 30) e.anuncios.splice(0, e.anuncios.length - 30);
}
// Alerta para los demás jugadores (no para quien la causa): no bloquea y se quita al tocarla.
export function anunciar(e, pid, texto, tono = 'gris') {
  const para = Object.values(e.jugadores).filter((x) => x.id !== pid && !x.npc && x.pj).map((x) => x.id);
  if (!para.length) return;
  (e.anuncios ||= []).push({ id: ++e.seq, t: e.ahora, para, texto, tono });
  if (e.anuncios.length > 30) e.anuncios.splice(0, e.anuncios.length - 30);
}
HOOK.anunciar = anunciar;
const cerrarReto = (data, e, pid, id, ok) => anunciarReto(data, e, pid, id, ok ? 'logro' : 'fallo');   // resultado final de un reto en varios pasos
function ejecutar(data, e, pid, id, usados) {
  const antesReto = fotoReto(e.jugadores[pid]), saldo0 = fotoSaldo(e.jugadores[pid]), logN0 = e.logN || 0;
  const ctx = nuevoCtx(e, pid, id);
  { const antes = e.ctxCarta; e.ctxCarta = cartaDatos(data, 'reto', id).titulo; try { T[id].run(data, e, pid, ctx, usados); } finally { e.ctxCarta = antes; } }   // contexto de las tiradas del reto
  if (ctx.fallo && REINTENTABLES.includes(id)) {
    const j = e.jugadores[pid], ciudad = m1(data, id).ciudad;
    j.retosHechos = j.retosHechos.filter((r) => r !== id);
    if (j.ciudad === ciudad) { (j.extra.rep ||= {})[id] = true; ctx.say(`Puedes volver a intentarlo cuando salgas de ${ciudad} y regreses.`); }
    else ctx.say(`Puedes volver a intentarlo cuando regreses a ${ciudad}.`);
  }
  const res = resultadoReto(e, pid, antesReto, ctx);
  anunciarReto(data, e, pid, id, res, false);
  const j = e.jugadores[pid];
  const esperando = [e.pend, ...(e.colaPend || [])].some((p) => p && p.para?.includes(pid) && p.tipo !== 'info');
  // Si el reto sigue con una decisión tuya, el desenlace sale cuando termine (anunciarReto); si no, sale ahora.
  if (j.npc || (esperando && !ctx.grupos.length) || (ctx.sinAnuncio && !ctx.grupos.length)) { ctx.fin(); return; }
  ctx.fin(desenlace(data, e, pid, id, ctx.sinAnuncio || esperando ? null : res, saldo0, logN0, ctx.res));
}
// Lazo de camellero (Jorge, 19 de noviembre): no se gasta en ningún caso.
const NO_SE_GASTA = ['OB05'];
const usa = (data, e, pid, usados, id) => { if (!usados.includes(id)) return false; if (NO_SE_GASTA.includes(id)) return !!e.jugadores[pid].mano.find((c) => c.tipo === 'objeto' && c.ref === id); return consumirObj(data, e, pid, id); };

// ---------------------------------------------------------------- misiones con plazo
function nuevaMision(e, pid, m, turnosPlazo) {
  const j = e.jugadores[pid];
  const mis = { limite: turnosPlazo ? j.turnos + turnosPlazo - 1 : null, ...m };
  j.misiones.push(mis); return mis;
}
const quitarMision = (j, m) => { const i = j.misiones.indexOf(m); if (i >= 0) j.misiones.splice(i, 1); };
function quitarCarga(e, pid, m) { const j = e.jugadores[pid]; let n = 0; for (const c of (m.carga || [])) { const x = j.mano.find((q) => q.uid === c.uid); if (x) { quitarCarta(j, x.uid); n++; } } return n; }
const cargaCompleta = (j, m) => (m.carga || []).every((c) => j.mano.some((q) => q.uid === c.uid));
function perder(data, e, pid, m, motivo) {
  const j = e.jugadores[pid];
  const quedan = m.id === 'R17' ? 0 : quitarCarga(e, pid, m); quitarMision(j, m);   // R17: las alfombras que te queden siguen siendo tuyas (Jorge, 19 de noviembre)
  log(e, `${j.nombre} pierde el reto ${m.id}${motivo ? ' (' + motivo + ')' : ''}.`, { pid });
  const f = FALLO[m.id]; if (f) f(data, e, pid, m, quedan);
  cerrarReto(data, e, pid, m.id, false);
}
const FALLO = {
  // R10 (Jorge, 27 de noviembre, C03): si lo fallas, lo puedes volver a intentar (antes una sola vez por jugador, aunque lo perdieras).
  R10: (data, e, pid) => { const j = e.jugadores[pid]; j.retosHechos = j.retosHechos.filter((r) => r !== 'R10'); log(e, `${j.nombre} podrá volver a intentar el reto R10 cuando regrese a El Cairo.`, { pid }); },
  R4: () => {}, R24: () => {}, R23: () => {},
  R30: (data, e, pid) => { pagar(data, e, pid, 10); }, R39: (data, e, pid) => { pagar(data, e, pid, 10); },
  R3: (data, e, pid, m) => {
    const j = e.jugadores[pid];
    for (let i = 0; i < 2; i++) quitarPrimero(j, 'item', 'esclava');
    quitarPrimero(j, 'item', 'mapa');
    pagar(data, e, pid, 30); log(e, `${j.nombre} devuelve el mapa y las esclavas y paga 30 dinares a la ciudad.`, { pid });
  },
  R67: (data, e, pid) => { const j = e.jugadores[pid]; let n = 0; for (const c of j.mano.slice()) if (c.tipo === 'item' && c.ref === 'esclavoSamarra') { quitarCarta(j, c.uid); n++; } log(e, `${j.nombre} no lleva los esclavos a tiempo${n ? ': los capataces se llevan sus ' + n + ' esclavos' : ''}. Sigue debiendo a Bagdad si no ha pagado.`, { pid }); },
  R2: (data, e, pid) => { pagar(data, e, pid, 50); e.jugadores[pid].extra.noBagdad = e.jugadores[pid].turnos + 2; },
};

export function inicioTurno(data, e, pid) {
  const j = e.jugadores[pid];
  marcarJugador(e, pid);
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
  marcarJugador(e, pid);
  e.ultimaCiudadVisita ||= {};
  if (j.ciudad === 'Damasco' || j.ciudad === 'Aleppo') e.ultimoDamasco = pid;   // Jorge (10 de noviembre): el testigo es el último que visitó Damasco o Aleppo
  if (j.extra.rep) for (const id of Object.keys(j.extra.rep)) if (m1(data, id).ciudad !== j.ciudad) delete j.extra.rep[id];
  for (const m of j.misiones.slice()) {
    if (m.id === 'R3') { if (j.ciudad === 'Estambul') m.visito = true; if (j.ciudad === 'Bagdad' && m.visito) completarR3(data, e, pid, m); continue; }
    if (m.id === 'R67') { r67Llegar(data, e, pid, m); continue; }
    if (m.id === 'R29') { if (j.ciudad === 'Bagdad') { quitarMision(j, m); premio(data, e, pid, { dinares: 40, noches: 15 }, 'Cruzas el desierto con tu camello.'); hacer(e, pid, 'R29'); cerrarReto(data, e, pid, 'R29', true); } else if (!j.transito) perder(data, e, pid, m, 'te desviaste'); continue; }
    if ((m.destino && m.destino === j.ciudad) || m.destinos?.includes(j.ciudad)) entregar(data, e, pid, m);
  }
}
function entregar(data, e, pid, m) {
  const j = e.jugadores[pid];
  if (m.limite != null && j.turnos > m.limite) return perder(data, e, pid, m, 'llegaste tarde');
  if (!cargaCompleta(j, m)) return perder(data, e, pid, m, 'perdiste la carga');
  const n = (m.carga || []).length;
  let pr = { dinares: 0, noches: 0 };
  switch (m.id) {
    case 'R10': pr = { dinares: 35, noches: 15 }; break;   // Jorge (19 de noviembre): 35 (antes 70)
    case 'R17': pr = { dinares: AR.entrega[j.ciudad] * n, noches: AR.nochesFin }; moverAlfombras(e, j.ciudad, n); break;   // se venden solas al llegar y quedan a la venta en ese mercado
    case 'R30': pr = { dinares: 60 + 8, noches: 15 }; break;   // Balanza de mercader: 8 dinares más (Jorge, 18 de noviembre)
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
  cerrarReto(data, e, pid, m.id, true);
}
function completarR3(data, e, pid, m) {
  const j = e.jugadores[pid];
  if (m.limite != null && j.turnos > m.limite) return perder(data, e, pid, m, 'llegaste tarde');
  const x = dado(e);
  mostrarDados(e, { por: pid, motivo: 'reto:R3', grupos: [{ etq: `${j.nombre} informa al Califa`, valores: [x] }], resumen: [`Dado ${x}: cobra ${5 * x} dinares.`] });
  for (let i = 0; i < 2; i++) quitarPrimero(j, 'item', 'esclava'); quitarPrimero(j, 'item', 'mapa');
  quitarMision(j, m); hacer(e, pid, 'R3'); premio(data, e, pid, { dinares: 5 * x }, `${j.nombre} cumple las órdenes del Califa.`);
  cerrarReto(data, e, pid, 'R3', true);
}

export function misionesVista(data, e, pid) {
  const j = e.jugadores[pid];
  return j.misiones.map((m) => ({ id: m.id, nombre: m1(data, m.id)?.nombre, destino: m.destino || (m.destinos ? m.destinos.join(', ') : null), turnosRestantes: m.limite != null ? Math.max(0, m.limite - j.turnos + 1) : null, deuda: m.deuda || null, objetivo: m.objetivo ? nombre(e, m.objetivo) : null, texto: m.texto || null }))
    .concat(deudasDe(j).filter((d) => !j.misiones.some((m) => m.id === d.reto)).map((d) => ({ id: d.reto, nombre: `Deuda con ${d.ciudad}`, destino: null, turnosRestantes: null, deuda: d.monto, objetivo: null, texto: `Se paga solo en ${d.ciudad}; al volver te la cobran sola.` })))
    .map((m) => (deudaDe(j, m.id) && !m.deuda ? { ...m, deuda: deudaDe(j, m.id).monto } : m));
}
export const tras = () => {};

// ---------------------------------------------------------------- el alta de misiones desde la eliminación (R2)
export function alEliminar(data, e, victima, por) {
  if (!por) return;
  const j = e.jugadores[por];
  const m = j?.misiones.find((x) => x.id === 'R2' && x.objetivo === victima);
  if (m) { quitarMision(j, m); hacer(e, por, 'R2'); darItem(e, j, 'astrolabio'); darTransporte(data, e, por, 'caballo'); premio(data, e, por, { dinares: 50 }, `${j.nombre} cumple el encargo de Yafar (R2):`); cerrarReto(data, e, por, 'R2', true); }   // Jorge (10 de noviembre): astrolabio, 50 dinares y un caballo (ya no alfanje)
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
    else { quitarMision(j, m); ctx.say(`No hay cofre: abandonas la búsqueda y sigues debiendo ${deudaDe(j, 'R1')?.monto ?? 15} dinares a Bagdad. Puedes pagarla aquí o irte: si te vas, te la cobran al volver a Bagdad.`); cerrarReto(data, e, pid, 'R1', false); }
    ctx.fin();
  }
  // Jorge (21 de noviembre): ya no vence ni se paga con noches; es una deuda con Bagdad como cualquier otra (base.js, contraerDeuda).
}
function r1Exito(data, e, pid, m) {
  const j = e.jugadores[pid];
  quitarMision(j, m); hacer(e, pid, 'R1');
  // Jorge (20 de noviembre): 35 dinares y 25 noches (antes 50 y 50) y eliges caballo o camello (uno solo); ya no da pergamino ni viaje gratis del Califa.
  premio(data, e, pid, { dinares: R1_PREMIO.dinares, noches: R1_PREMIO.noches }, `${j.nombre} halla el cofre del Éufrates:`);
  { const d = deudaDe(j, 'R1'); if (d) { pagar(data, e, pid, d.monto); j.extra.deudas.splice(j.extra.deudas.indexOf(d), 1); if (!j.extra.deudas.length) delete j.extra.deudas; log(e, `${j.nombre} paga con el cofre su deuda con Bagdad (${d.monto} dinares).`, { pid }); } }
  pedir(e, { tipo: 'reto', para: [pid], titulo: 'R1 · El cofre del Éufrates', texto: `Hallaste el cofre: ${R1_PREMIO.dinares} dinares y ${R1_PREMIO.noches} noches. Elige tu animal.`,
    opciones: [{ id: 'caballo', texto: 'Un caballo' }, { id: 'camello', texto: 'Un camello' }], porDefecto: 'caballo', cont: { fn: 'r1.animal', args: {} } });
  cerrarReto(data, e, pid, 'R1', true);
}
export const R1_PREMIO = { dinares: 35, noches: 25 };
registrar('r1.animal', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid]; if (!j || j.eliminado) return;
  const ref = resp.opcion === 'camello' ? 'camello' : 'caballo';
  darTransporte(data, e, pid, ref);   // al morir no se reactiva R1 (Jorge, 20 de noviembre)
});
T.R1 = { ciudad: 'Bagdad', req: (data, e, pid) => (e.jugadores[pid].misiones.some((m) => m.id === 'R1') ? 'Ya lo tienes en curso.' : null),
  run(data, e, pid, ctx) {
    ctx.sinAnuncio = true;   // se anuncia al encontrar el cofre o al abandonar la búsqueda (si rechaza, no hay reto)
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R1 · Buscar un cofre en el Éufrates', texto: `Si aceptas, tu turno termina mientras buscas y contraes una deuda de 15 dinares con la ciudad (la pagas en Bagdad cuando quieras o te vas sin pagarla y te la cobran al volver); puedes pagar sirvientes, a ${data.config.r1?.costoAyudante ?? 12} dinares cada uno, para buscar con más dados. Si rechazas, vas en burro a Basra y no puedes volver a Bagdad en 2 turnos.`,
      opciones: [{ id: 'si', texto: 'Aceptar' }, { id: 'no', texto: 'Rechazar' }], porDefecto: 'no', cont: { fn: 'r1.acepta', args: {} } });
  } };
registrar('r1.acepta', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  if (resp.opcion !== 'si') {
    log(e, `${j.nombre} rechaza el reto y se va en burro a Basra.`, { pid });
    j.extra.noBagdad = j.turnos + 2; j.ciudad = 'Basra'; e.turno.movio = true; huidaCuentaViaje(e, pid); HOOK.llegada(data, e, pid, 'Bagdad'); return;
  }
  // Regla de la casa: cada sirviente cuesta 12 dinares (Jorge, 19 de noviembre; del 10 al 19 de noviembre costaba 17) y se pueden contratar hasta 4 (antes 3) y se paga al contratarlo; sin dinares no hay trato y se busca solo.
  const cA = data.config.r1?.costoAyudante ?? 12, mA = data.config.r1?.maxAyudantes ?? 3, alcanza = Math.min(mA, Math.floor(Math.max(0, j.dinares) / cA));
  if (!alcanza) { log(e, `${j.nombre} no tiene ${cA} dinares para contratar sirvientes: busca solo.`, { pid }); return CONT['r1.ayudantes'](data, e, {}, { pid, numero: 0 }); }
  pedir(e, { tipo: 'reto', para: [pid], titulo: 'R1 · Sirvientes', texto: `Cada sirviente añade un dado de búsqueda y cuesta ${cA} dinares, que se pagan ahora (máximo ${mA}). El cofre aparece con un 1 o un 2 en cualquier dado.`, nota: `Te alcanza para contratar hasta ${alcanza} ${alcanza === 1 ? 'sirviente' : 'sirvientes'}.`, modo: 'numero', min: 0, max: alcanza, porDefecto: 0, cont: { fn: 'r1.ayudantes', args: {} } });
});
registrar('r1.ayudantes', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid], cA = data.config.r1?.costoAyudante ?? 12;
  const n = Math.max(0, Math.min(resp.numero || 0, data.config.r1?.maxAyudantes ?? 3, Math.floor(Math.max(0, j.dinares) / cA)));
  if (n) { j.dinares -= cA * n; log(e, `${j.nombre} contrata ${n} sirviente(s) por ${cA * n} dinares.`, { pid }); }
  const m = nuevaMision(e, pid, { id: 'R1', ayudantes: n, busca: false, destino: null, texto: 'Buscas el cofre del Éufrates.' });
  contraerDeuda(e, pid, { ciudad: 'Bagdad', monto: 15, reto: 'R1', motivo: 'alojamiento del cofre del Éufrates, reto R1' });
  const ctx = nuevoCtx(e, pid, 'R1');
  const v = ctx.t(`${j.nombre} y ${n} sirviente(s)`, 1 + n);
  if (v.some((x) => x <= 2)) { ctx.say('¡Encuentras el cofre!'); r1Exito(data, e, pid, m); } else { ctx.say('Sin cofre por hoy: repetirás en tu siguiente turno. Debes 15 dinares a Bagdad: puedes pagarlos aquí o irte y te los cobran al volver.'); m.busca = true; anunciarReto(data, e, pid, 'R1', 'curso'); }
  ctx.fin(); e.turno.movio = true;
  // Con deuda, el turno queda abierto para que puedas pagarla antes de terminarlo (Jorge, 11 de noviembre); sin más viajes ni acción principal.
  if (deudaDe(j, 'R1')) { e.turno.principal = true; e.turno.maxTramos = e.turno.tramos; } else e.turno.fin = true;
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
  ctx.sinAnuncio = true;   // si acepta, empieza (r3.acepta); si rechaza, no hay reto
  pedir(e, { tipo: 'reto', para: [pid], titulo: 'R3 · Órdenes del Califa', texto: 'Recibes un mapa y dos esclavas abisinias. Debes ir a Estambul y volver a Bagdad en 3 turnos o menos. Éxito: 5 × un dado en dinares.', opciones: [{ id: 'si', texto: 'Aceptar' }, { id: 'no', texto: 'Rechazar' }], porDefecto: 'no', cont: { fn: 'r3.acepta', args: {} } });
} };
registrar('r3.acepta', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  if (resp.opcion !== 'si') { log(e, `${j.nombre} rechaza las órdenes del Califa.`, { pid }); return; }
  darItem(e, j, 'esclava'); darItem(e, j, 'esclava'); darItem(e, j, 'mapa', { tesoro: 'ruman' });
  nuevaMision(e, pid, { id: 'R3', visito: false, texto: 'Ve a Estambul y vuelve a Bagdad.' }, 3);
  anunciarReto(data, e, pid, 'R3', 'curso');
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
  else { ctx.resultado = 'fallo'; darItem(e, j, 'brujula'); premio(data, e, pid, { dinares: 10 }, 'Alquimia fallida:'); ctx.say('No sale el 6: 10 dinares y una brújula.'); }
} };
// R6 (Jorge, 27 de noviembre, decisión D15): vuelve a la versión del Word (14.3): ganas solo si el dado extra cae igual al promedio;
// si no, solo 1 dinar y 20 noches. (Del 23 al 27 de noviembre bastaba con uno más o uno menos y había segunda tirada.)
T.R6 = { ciudad: 'Bagdad', run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R6');
  const v = ctx.t(`${j.nombre}: álgebra`, 3); const prom = Math.floor(suma(v) / 3); const [x] = ctx.t('Un dado más', 1);
  if (x === prom) { premio(data, e, pid, { dinares: 50 }, 'Álgebra resuelta:'); darLibro(e, pid); ctx.say(`Promedio ${prom}, dado ${x}: ganas 50 dinares y un libro.`); }
  else { ctx.resultado = 'fallo'; premio(data, e, pid, { dinares: 1, noches: 20 }, 'Álgebra sin resolver:'); ctx.say(`Promedio ${prom}, dado ${x}: no es igual; solo ganas 1 dinar y 20 noches.`); }
} };
// ---------------------------------------------------------------- R17 (R7, entregar las alfombras al Califa, ya no existe: Jorge, 18 de noviembre)
const AR = ALFOMBRAS.reto;
const espacioCarga = (e, j) => (tieneCarga(j) ? Infinity : Math.max(0, limiteCarga(e, j) - nCarga(j)));
const maxR17 = (e, j) => Math.min(AR.max, alfombrasEn(e, ALFOMBRAS.origen), Math.floor(j.dinares / AR.precio), espacioCarga(e, j));
T.R17 = { ciudad: 'Isfahán', req: (d, e, pid) => { const j = e.jugadores[pid];
  if (alfombrasEn(e, ALFOMBRAS.origen) < AR.min) return 'Ya no quedan alfombras suficientes en Isfahán.';
  if (j.dinares < AR.min * AR.precio) return `Necesitas al menos ${AR.min * AR.precio} dinares: son ${AR.min} alfombras como mínimo, a ${AR.precio} cada una.`;
  if (espacioCarga(e, j) < AR.min) return `Las alfombras pesan: sin caballo, burro o camello no te caben ${AR.min}.`;
  return null; }, run(data, e, pid) {
  const j = e.jugadores[pid], max = maxR17(e, j);
  pedir(e, { tipo: 'reto', para: [pid], titulo: 'R17 · Alfombras de Isfahán', texto: `Cuestan ${AR.precio} dinares cada una. Llévalas en ${AR.plazo} turnos a Bagdad (${AR.entrega.Bagdad} c/u), Estambul (${AR.entrega.Estambul} c/u) o Andalucía (${AR.entrega['Andalucía']} c/u). ¿Cuántas compras (${AR.min} a ${max})?`, modo: 'numero', min: AR.min, max, porDefecto: AR.min, cont: { fn: 'r17.n', args: {} } });
} };
registrar('r17.n', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid], n = Math.min(Math.max(AR.min, resp.numero || AR.min), maxR17(e, j));
  if (n < AR.min) { log(e, `${j.nombre} no puede comprar las alfombras.`, { pid }); return; }
  j.dinares -= AR.precio * n; moverAlfombras(e, ALFOMBRAS.origen, -n);
  const carga = Array.from({ length: n }, () => ({ uid: darItem(e, j, 'alfombraIsfahan').uid }));
  const destinos = Object.keys(AR.entrega);
  nuevaMision(e, pid, { id: 'R17', destinos, carga, texto: `Lleva tus ${n} alfombras a Bagdad, Estambul o Andalucía.` }, AR.plazo);
  hacer(e, pid, 'R17'); log(e, `${j.nombre} compra ${n} alfombras de Isfahán (R17) por ${AR.precio * n} dinares.`, { pid });
  premio(data, e, pid, { noches: AR.nochesIntento }, `${j.nombre} emprende el viaje de las alfombras:`);   // por intentarlo (Jorge, 18 de noviembre)
});
// ---------------------------------------------------------------- R8 / R9 / R10
T.R8 = { ciudad: 'El Cairo', req: (data, e, pid) => (tieneArma(data, e, e.jugadores[pid]) ? null : 'Necesitas un arma.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.extra.rep ||= {}; j.extra.rep.R8 = true; hacer(e, pid, 'R8');
  const gana = peleaNPC(data, e, pid, { etq: 'Shams al Din', dados: 2, bono: 1 + bonoCim(data) + 1 });
  // Jorge (10 de noviembre): gana 50 dinares y 20 noches (antes 100 y 30); si pierde, pierde 15 noches y queda herido (ya no paga 20)
  if (gana) premio(data, e, pid, { dinares: 50, noches: 20 }, `${j.nombre} vence a Shams al Din:`);
  else { ctx.resultado = 'fallo'; j.noches -= 15; j.herido = true; log(e, `${j.nombre} pierde ante Shams al Din: pierde 15 noches y queda herido.`, { pid }); }
} };
T.R9 = { ciudad: 'El Cairo', req: (data, e, pid) => (e.jugadores[pid].dinares >= 5 ? null : 'Necesitas 5 dinares para el guía.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.dinares -= 5; j.extra.rep ||= {}; j.extra.rep.R9 = true; hacer(e, pid, 'R9');
  const [x] = ctx.t(`${j.nombre}: pirámides`, 1);
  if (x <= 2) {
    ctx.say('Saqueadores te atacan.'); ctx.sinAnuncio = true;   // se anuncia en r9.saqueo
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R9 · Saqueadores', texto: 'Pelea (2 dados cada uno) o paga 15 dinares.', opciones: [{ id: 'pelear', texto: 'Pelear' }, { id: 'pagar', texto: 'Pagar 15 dinares' }], porDefecto: 'pagar', cont: { fn: 'r9.saqueo', args: {} } });
  } else {
    ctx.resultado = 'logro'; premio(data, e, pid, { dinares: 25 }, `${j.nombre} encuentra un cofre en las pirámides:`);
    if (x === 5) { darItem(e, j, 'pergamino'); ctx.say('Además del cofre encuentras un pergamino antiguo: en Damasco te pagan 30 dinares por él.'); }   // Jorge (20 de noviembre)
    if (x === 6) pedir(e, { tipo: 'reto', para: [pid], titulo: 'R9 · Mapa de tesoro', texto: 'Hallas un mapa. ¿Qué tesoro?', opciones: [{ id: 'persia', texto: 'Persia (Isfahán)' }, { id: 'ruman', texto: 'Rumán (Estambul)' }, { id: 'mansa', texto: 'Mansa Musa (Magreb)' }], porDefecto: 'persia', cont: { fn: 'r9.mapa', args: {} } });
  }
} };
registrar('r9.saqueo', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  if (resp.opcion === 'pagar') { pagar(data, e, pid, 15); return cerrarReto(data, e, pid, 'R9', false); }
  if (!peleaNPC(data, e, pid, { etq: 'Saqueadores', dados: 2 })) { pagar(data, e, pid, 15); j.herido = true; log(e, `${j.nombre} pierde la pelea y paga 15 dinares.`, { pid }); }
  cerrarReto(data, e, pid, 'R9', false);   // aun venciendo a los saqueadores, no hay cofre
});
registrar('r9.mapa', (data, e, args, resp) => { darItem(e, e.jugadores[resp.pid], 'mapa', { tesoro: resp.opcion }); log(e, `${nombre(e, resp.pid)} halla un mapa de tesoro.`, { pid: resp.pid }); });
T.R10 = { ciudad: 'El Cairo', run(data, e, pid, ctx) {
  const j = e.jugadores[pid];
  hacer(e, pid, 'R10');   // una vez por jugador; si lo pierdes, FALLO.R10 lo vuelve a abrir (Jorge, 27 de noviembre)
  const carga = [darLibro(e, pid, 'papiro'), darLibro(e, pid, 'papiro')].map((c) => ({ uid: c.uid }));
  nuevaMision(e, pid, { id: 'R10', destino: 'Bagdad', carga, texto: 'Lleva 2 papiros a Bagdad.' }, 2);
  ctx.say('El escriba te confía 2 papiros: entrégalos en Bagdad en 2 turnos.');
} };
// ---------------------------------------------------------------- Sindbad R11-R14
// Escorbuto (Jorge, 19 de noviembre): el barco que te regresa a Basra es viaje por mar; sin cítricos llegas herido.
const RETOS_MAR = ['R11', 'R12', 'R13', 'R14', 'R40'];
function sindbadFin(data, e, pid, ctx) { const j = e.jugadores[pid]; j.ciudad = 'Basra'; viajePorMar(e, pid, 'en el barco de regreso a Basra'); HOOK.llegada(data, e, pid, 'India'); }
T.R11 = { ciudad: 'India', run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R11'); const v = ctx.t(`${j.nombre}: viaje con Sindbad`, 2);
  // Regla de la casa (noviembre de 2026): las noches de Sindbad no se multiplican por ronda; al naufragar no hay dinares pero se ganan 30 noches por la historia vivida.
  if (suma(v) >= 6) { premio(data, e, pid, { dinares: 80 }, 'El viaje sale bien:'); ctx.say('Viaje sin tropiezos: +80 dinares.'); }   // Jorge (20 de noviembre): 80 dinares, sin noches (antes 100 y 50)
  else { ctx.resultado = 'fallo'; premio(data, e, pid, { noches: 30 }, 'Naufragio, pero qué historia:'); j.pierdeTurno = (j.pierdeTurno || 0) + 1; ctx.say('Naufragio: sin dinares, pero +30 noches por la historia vivida; pierdes tu siguiente turno.'); }
  sindbadFin(data, e, pid, ctx); chequeoSindbad(data, e, pid);
} };
T.R12 = { ciudad: 'India', req: (d, e, pid) => (hecho(e.jugadores[pid], 'R11') ? null : 'Debes haber completado R11.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R12');
  // Regla de la casa (noviembre de 2026): noches por la historia, sin multiplicar por ronda.
  if (peleaNPC(data, e, pid, { etq: 'Piratas', dados: 2, bono: 0 })) premio(data, e, pid, { dinares: 120, noches: 60 }, 'Vences a los piratas:');
  else { ctx.resultado = 'fallo'; pagar(data, e, pid, 60); j.herido = true; j.noches += 20; log(e, `${j.nombre} pierde ante los piratas y queda herido, pero gana 20 noches por la historia.`, { pid }); }
  sindbadFin(data, e, pid, ctx); chequeoSindbad(data, e, pid);
} };
T.R13 = { ciudad: 'India', req: (d, e, pid) => (hecho(e.jugadores[pid], 'R12') ? null : 'Debes haber completado R12.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R13');
  if (peleaNPC(data, e, pid, { etq: 'Gigante', dados: 2, bono: 1 })) premio(data, e, pid, { dinares: 150, noches: 80 }, 'Vences al gigante:');
  else { ctx.resultado = 'fallo'; pagar(data, e, pid, 80); const arma = ['cimitarra', 'alfanje', 'jambiya'].find((r) => tieneItem(j, r)); /* el arco no cuenta como arma */ if (arma) quitarPrimero(j, 'item', arma); j.noches += 20; log(e, `${j.nombre} pierde ante el gigante y su arma, pero gana 20 noches por la historia.`, { pid }); }
  sindbadFin(data, e, pid, ctx); chequeoSindbad(data, e, pid);
} };
T.R14 = { ciudad: 'India', req: (d, e, pid) => (hecho(e.jugadores[pid], 'R13') ? null : 'Debes haber completado R13.'), run(data, e, pid, ctx) {
  const otros = humanosVivos(e).filter((x) => x !== pid);
  ctx.sinAnuncio = true;   // se anuncia en r14Fin
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
  sindbadFin(data, e, pid, ctx); ctx.fin(); chequeoSindbad(data, e, pid);
  cerrarReto(data, e, pid, 'R14', convence);   // si no convence, los 50 dinares son de consuelo
}
function chequeoSindbad(data, e, pid) {
  const j = e.jugadores[pid];
  if (['R11', 'R12', 'R13', 'R14'].every((r) => hecho(j, r))) darKanmakan(data, e, pid, 'completar los cuatro viajes de Sindbad');
}
export function darKanmakan(data, e, pid, motivo) {
  const j = e.jugadores[pid];
  if (e.kanmakan.dueno || e.kanmakan.usada || j.eliminado) return;
  e.kanmakan.dueno = pid; j.mano.push({ uid: uid(e), tipo: 'especial', ref: 'K1' });
  // Jorge (24 de noviembre): al obtenerla, la carta sale siempre en pantalla, como la de un reto o un objeto
  const s = data.objetos.especiales.find((x) => x.id === 'K1');
  const carta = publicarCarta(e, { id: 'K1', deck: 'especial', titulo: s.nombre, sub: 'Carta especial', texto: `${j.nombre} recibe el Ejército de Kanmakán por ${motivo}: +2 a sus dados en cualquier pelea y no lo pueden desafiar a duelo (R 15.5). Dura 2 turnos suyos; pasar por Isfahán lo renueva por otros 2.`, arte: s.arte, ref: s.refReglamento }, pid);
  const enMesa = [e.dados, ...(e.colaDados || [])].filter(Boolean).map((d) => d.id);      // si hay dados por tirar o a la vista, la carta espera a que se cierren (nada sale antes que los dados)
  if (enMesa.length) carta.trasDados = Math.max(...enMesa);
  log(e, `${j.nombre} recibe la carta del Ejército de Kanmakán (${motivo}).`, { pid });
}
export function revisarKanmakan(data, e, pid) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado || j.npc || e.kanmakan.dueno || e.kanmakan.usada) return;
  if (j.noches >= 500) darKanmakan(data, e, pid, 'reunir 500 noches');
}
// ---------------------------------------------------------------- R15 / R16
// Como la acción directa (npc.js, NOCHES_ASESINOS): los Asesinos solo tratan con quien tiene al menos 500 noches.
T.R15 = { ciudad: 'Samarcanda', req: (data, e, pid) => (e.asesinos.actuaron ? 'Los Asesinos ya actuaron.' : e.jugadores[pid].noches < 500 ? 'Los Asesinos solo tratan con quien tiene al menos 500 noches.' : null), run(data, e, pid) { HOOK.contratarAsesinos(data, e, pid, { reto: true }); } };
T.R16 = { ciudad: 'Isfahán', req: (data, e, pid) => { const j = e.jugadores[pid]; if (j.retosHechos.length < 2) return 'Necesitas haber completado al menos 2 retos.'; if (j.dinares < 60) return 'Necesitas 60 dinares en regalos.'; return null; },
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; j.dinares -= 60; log(e, `${j.nombre} lleva 60 dinares en regalos a Sherezada.`, { pid }); ctx.sinAnuncio = true;   // se anuncia al fallar una prueba o en r16Tira
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
  if (Number(resp.opcion) !== t.correcta) { log(e, `${j.nombre} falla la prueba de Sherezada: pierde los 60 dinares y su acción.`, { pid }); return cerrarReto(data, e, pid, 'R16', false); }
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
  cerrarReto(data, e, pid, 'R16', !muere);
  if (muere) eliminar(data, e, pid, { causa: 'muerte súbita de Shariyar' });
}
// ---------------------------------------------------------------- entrenamientos (regla de la casa, noviembre de 2026)
// La destreza (+1 en toda pelea) se aprende solo en Estambul. Cada arma tiene su maestro: hay que llevar el arma, y quien entrena suma
// +1 con ella (dentro del tope de armas); con el arco, también un 3 o 4 en la flecha deja al rival con −1.
export const DESTREZA = { costo: 50, noches: 60, turnos: 2 };   // R25, Estambul (Jorge, 10 de noviembre); 60 noches y 2 turnos (Jorge, 21 de noviembre)
export const NOCHES_ENTRENAR = 30;   // entrenar cualquier arma: R18, R19, R42, R43 (Jorge, 21 de noviembre; antes 50)
// Entrenamientos que ofrece cada ciudad, de la misma fuente que usa el motor (para la ficha de la ciudad; Jorge, 11 de noviembre).
export function entrenamientosEn(ciudad) {
  const r = [];
  if ((T.R25.ciudades || [T.R25.ciudad]).includes(ciudad)) r.push({ id: 'R25', que: 'destreza con armas', costo: DESTREZA.costo });
  for (const [id, x] of Object.entries(ENTRENAMIENTOS)) if ((T[id].ciudades || [T[id].ciudad]).includes(ciudad)) r.push({ id, que: x.arma, costo: x.costo });
  return r;
}
// Jorge (23 de noviembre): un reto que también se hace en otras ciudades (R18, R42, R43) nombra en su carta la ciudad donde lo intentas.
function cartaEnCiudad(c, base, aqui) {
  if (!aqui || aqui === base) return c;
  const cambia = (x) => (typeof x === 'string' ? x.split(base).join(aqui) : x);
  return { ...c, sub: cambia(c.sub), texto: cambia(c.texto) };
}
export const ENTRENAMIENTOS = { R18: { arma: 'cimitarra', costo: 25 }, R19: { arma: 'jambiya', costo: 20 }, R42: { arma: 'alfanje', costo: 20 }, R43: { arma: 'arco', costo: 20 } };
const ARTE_ARMA = Object.fromEntries(Object.entries(ENTRENAMIENTOS).map(([id, x]) => [x.arma, id]));   // por si la destreza pendiente no trae su carta (partidas guardadas antes)
const ENTRENO_SIG_RONDA = ['jambiya', 'cimitarra', 'alfanje'];
const entrenado = (j, arma) => !!j.extra.entrenado?.[arma] || (j.extra.destrezaPend || []).some((q) => q.arma === arma);
// Jorge (19 de noviembre, más tarde): la destreza y los entrenamientos (R25, R18, R19, R42, R43, R51 y el de R54) gastan la acción
// principal y terminan el turno. Jorge (21 de noviembre): se reciben al TERMINAR ese turno, no durante él (antes, al iniciar el
// siguiente); si mueres antes de que termine, no llega.
function aplazarDestreza(e, pid, q) {
  const j = e.jugadores[pid];
  (j.extra.destrezaPend ||= []).push(q);
  if (j.npc) return recibirDestreza(null, e, pid);   // Yafar NPC la recibe al momento, para no romper su reglas de dificultad (por confirmar con Jorge)
  if (e.turno?.pid === pid) { e.turno.principal = true; e.turno.fin = true; }
}
export function recibirDestreza(data, e, pid, { inicio = false } = {}) {
  const j = e.jugadores[pid], qs = j?.extra?.destrezaPend;
  if (!qs?.length || j.eliminado) return;
  const listas = qs.filter((q) => (q.ronda == null || e.ronda >= q.ronda) && (q.turno == null || (inicio ? j.turnos > q.turno : j.turnos >= q.turno)));   // R25: llega al terminar el segundo turno (Jorge, 21 de noviembre)
  if (!listas.length) return;
  j.extra.destrezaPend = qs.filter((q) => !listas.includes(q));
  for (const q of listas) {
    let texto;
    if (q.t === 'general') { if (q.plena) j.destreza = true; else darDestreza(j); texto = soloJambiya(j) && !q.plena ? 'Terminó tu turno de entrenamiento: ya tienes destreza, solo con la jambiya.' : 'Terminó tu turno de entrenamiento: ya tienes destreza con armas, +1 en todas tus peleas.'; }
    else if (q.t === 'arma') { (j.extra.entrenado ||= {})[q.arma] = true; texto = q.arma === 'arco' ? 'Terminó tu turno de entrenamiento: ya estás entrenado con el arco. Un 3 o 4 en tu flecha también le pega al rival: pelea con −1.' : `${q.ronda != null ? 'Empieza la ronda y terminó tu entrenamiento' : 'Terminó tu turno de entrenamiento'}: ya tienes destreza con ${q.arma === 'alfanje' ? 'el alfanje' : 'la ' + q.arma}. Cuando pelees con ${q.arma === 'alfanje' ? 'él' : 'ella'}, peleas con destreza y sumas +1.`; }
    else if (q.t === 'armasR54') {
      for (const r of q.armas) (j.extra.entrenado ||= {})[r] = true;
      const l = q.armas.map((r) => (r === 'alfanje' ? 'el alfanje' : 'la ' + r)); const t = l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l.at(-1) : l[0];
      texto = `Terminó tu turno con el ejército del sultán: ya tienes destreza con ${t}. Cuando pelees con ${q.armas.length > 1 ? 'cada una' : (q.armas[0] === 'alfanje' ? 'él' : 'ella')}, peleas con destreza y sumas +1.`;
    }
    else if (q.t === 'arcoMaximo') { j.extra.arcoMaximo = true; texto = 'Terminó tu turno: ya tienes la destreza máxima en arco, tus flechas siempre aciertan.'; }
    if (!texto) continue;
    log(e, `${j.nombre}: ${texto}`, { pid, aviso: true });
    if (!j.npc) publicarCarta(e, { id: `entreno:${q.t}:${q.arma || ''}`, deck: 'reto', titulo: 'Tu entrenamiento', sub: 'Habilidad', texto, arte: q.de || ARTE_ARMA[q.arma] || 're' }, pid, [pid]);   // como las clases de idiomas: carta al terminar el turno; con la pintura de la carta del entrenamiento (Jorge, 23 de noviembre)
  }
}
HOOK.recibirDestreza = recibirDestreza;
function entrenarArma(e, pid, id) {
  const j = e.jugadores[pid], { arma, costo } = ENTRENAMIENTOS[id];
  // Jorge (27 de noviembre): el entrenamiento con jambiya, cimitarra o alfanje se recibe al iniciar la ronda siguiente, no al terminar el turno
  const q = { t: 'arma', arma, de: id, ...(ENTRENO_SIG_RONDA.includes(arma) && !j.npc ? { ronda: e.ronda + 1 } : {}) };
  j.dinares -= costo; j.noches += NOCHES_ENTRENAR; hacer(e, pid, id); aplazarDestreza(e, pid, q);
  log(e, `${j.nombre} entrena con ${arma} y gana ${NOCHES_ENTRENAR} noches: su turno termina${arma === 'arco' ? ' y al terminar queda entrenado: un 3 o 4 en su flecha también le pega al rival (pelea con −1)' : ` y al empezar la siguiente ronda tendrá destreza con ${arma === 'alfanje' ? 'el alfanje' : 'la ' + arma} (+1 con ${arma === 'alfanje' ? 'él' : 'ella'})`}.`, { pid });
}
const reqArma = (id) => (d, e, pid) => {
  const j = e.jugadores[pid], { arma, costo } = ENTRENAMIENTOS[id];
  if (!tieneItem(j, arma)) return `Necesitas tener ${{ arco: 'un arco', jambiya: 'una jambiya', cimitarra: 'una cimitarra', alfanje: 'un alfanje' }[arma] || arma} para entrenar con ${['jambiya', 'cimitarra'].includes(arma) ? 'ella' : 'él'}.`;
  if (entrenado(j, arma)) return `Ya entrenaste con ${arma}.`;
  if (!puedeEntrenarArma(j, arma)) return MSJ_SOLO_JAMBIYA;   // Jorge (19 de noviembre)
  return j.dinares >= costo ? null : `Cuesta ${costo} dinares.`;
};
T.R18 = { ciudad: 'Isfahán', ciudades: ['Isfahán', 'Samarcanda'], req: reqArma('R18'), run(data, e, pid) { entrenarArma(e, pid, 'R18'); } };
T.R42 = { ciudad: 'Aleppo', ciudades: ['Aleppo', 'Damasco'], req: reqArma('R42'), run(data, e, pid) { entrenarArma(e, pid, 'R42'); } };
T.R19 = { ciudad: 'Yemen', req: reqArma('R19'), run(data, e, pid) { entrenarArma(e, pid, 'R19'); } };
T.R43 = { ciudad: 'Andalucía', ciudades: ['Andalucía', 'Yemen', 'Samarcanda'], req: reqArma('R43'),   // también en Yemen y Samarcanda (Jorge, 19 de noviembre)
  run(data, e, pid) { entrenarArma(e, pid, 'R43'); } };
// Jorge (26 de noviembre, solo en el 3D): «No te debe dejar intentar la destreza si eres Zein o Ruyán excepto en jambiya»: la destreza
// general de Estambul no la pueden hacer (la de la jambiya la entrenan en Yemen, R19).
T.R25 = { ciudad: 'Estambul', req: (d, e, pid) => (soloJambiya(e.jugadores[pid]) ? MSJ_SOLO_JAMBIYA : tieneDestrezaGeneral(e.jugadores[pid]) ? 'Ya tienes destreza con armas.' : e.jugadores[pid].dinares >= DESTREZA.costo ? null : `Cuesta ${DESTREZA.costo} dinares.`), run(data, e, pid, ctx) {
  // Jorge (21 de noviembre): la destreza general tarda 2 turnos (este, que termina aquí, y el siguiente, que pierdes entrenando) y llega
  // al terminar el segundo; da 60 noches al momento (el 20 de noviembre no daba; antes 50). Yafar NPC la sigue recibiendo al momento.
  const j = e.jugadores[pid]; if (ctx) ctx.resultado = 'logro'; j.dinares -= DESTREZA.costo; j.noches += DESTREZA.noches; hacer(e, pid, 'R25');   // Jorge (10 de noviembre): 50 dinares (antes 45); Zein y Ruyán: solo con jambiya
  if (j.npc) { aplazarDestreza(e, pid, { t: 'general' }); log(e, `${j.nombre} entrena en Estambul y gana ${DESTREZA.noches} noches: ya tiene destreza con armas.`, { pid }); return; }
  aplazarDestreza(e, pid, { t: 'general', turno: j.turnos + DESTREZA.turnos - 1 }); j.pierdeTurno = (j.pierdeTurno || 0) + 1;
  log(e, `${j.nombre} entrena en Estambul y gana ${DESTREZA.noches} noches: su turno termina, pasa el siguiente entrenando y, al terminarlo, tendrá destreza ${soloJambiya(j) ? 'solo con la jambiya' : 'con armas (+1 en todas las peleas)'}.`, { pid });
} };
// Jorge (19 de noviembre): en el reto el velo cuesta 10 dinares (en el mercado sigue a 30).
T.R20 = { ciudad: 'Damasco', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid) { const j = e.jugadores[pid]; j.dinares -= 10; darItem(e, j, 'velo'); hacer(e, pid, 'R20'); log(e, `${j.nombre} compra el velo quemado.`, { pid }); } };
T.R21 = { ciudad: 'Damasco', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; j.dinares -= 10; hacer(e, pid, 'R21'); const [x] = ctx.t(`${j.nombre}: casa embrujada`, 1);
  if (x <= 3) { j.noches -= 20; ctx.say('Los fantasmas te echan: pierdes 20 noches y huyes a Aleppo.'); ctx.fallo = true; j.ciudad = 'Aleppo'; e.turno.movio = true; huidaCuentaViaje(e, pid); HOOK.llegada(data, e, pid, 'Damasco'); }
  else { premio(data, e, pid, { dinares: 40 }, `${j.nombre} halla un cofre en la casa embrujada:`); if (x === 6) { darItem(e, j, 'mapa', { tesoro: 'ruman' }); ctx.say('Y un mapa de los Rumán.'); } }
} };
T.R22 = { ciudad: 'Damasco', req: (data, e, pid) => {
  const j = e.jugadores[pid]; if (!tieneObj(j, 'OB12')) return 'Necesitas una Balanza de mercader.';   // obligatoria (Jorge, 18 de noviembre)
  const l = j.mano.filter((c) => c.tipo === 'objeto' && objDe(data, c.ref).tipo === 'Lujo/Comercio');
  if (new Set(l.map((c) => c.ref)).size < 2) return 'Necesitas 2 o más objetos distintos de Lujo/Comercio.';
  return suma(l.map((c) => objDe(data, c.ref).valor + 10)) >= 60 ? null : 'Tus mercancías no suman 60 dinares de reventa.'; },
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; const l = j.mano.filter((c) => c.tipo === 'objeto' && objDe(data, c.ref).tipo === 'Lujo/Comercio');
    let tot = 0; for (const c of l) { tot += objDe(data, c.ref).valor + 10; quitarCarta(j, c.uid); devolverObjeto(data, e, c.ref); }
    // Jorge (18 de noviembre): solo recibes noches y 3 dinares. La Balanza de mercader suma 3 dinares por pieza (máximo 3 piezas).
    const bal = 3 * Math.min(3, l.length);
    hacer(e, pid, 'R22'); premio(data, e, pid, { dinares: 3 + bal, noches: 15 }, `${j.nombre} comercia en el zoco de Damasco (entrega ${tot} dinares de mercancía${bal ? '; su balanza le da ' + bal + ' dinares más' : ''}):`);
  } };
T.R23 = { ciudad: 'Magreb', req: (d, e, pid) => (!tieneObj(e.jugadores[pid], 'OB18') ? 'Necesitas un Odre de agua para cruzar el desierto con la caravana.' : e.jugadores[pid].dinares >= 15 ? null : 'Cuesta 15 dinares.'), run(data, e, pid, ctx) {
  consumirObj(data, e, pid, 'OB18');   // Jorge (18 de noviembre): el Odre de agua es necesario y se gasta en la travesía
  const j = e.jugadores[pid]; j.dinares -= 15;
  const carga = [0, 1, 2].map(() => ({ uid: darItem(e, j, 'sal').uid }));
  const [x] = ctx.t(`${j.nombre}: caravana de la sal`, 1);
  if (x <= 2 && tieneItem(j, 'bendicionAbuMadyan')) { quitarPrimero(j, 'item', 'bendicionAbuMadyan'); ctx.say('Asoman bandoleros, pero la bendición de Abu Madyan protege la caravana: pasan de largo (la bendición se gasta).'); nuevaMision(e, pid, { id: 'R23', destino: 'El Cairo', carga, texto: 'Lleva la sal a El Cairo.' }, 2); }
  else if (x <= 2) {
    ctx.say('Bandoleros asaltan la caravana.'); ctx.sinAnuncio = true;   // se anuncia en r23.banditos
    pedir(e, { tipo: 'reto', para: [pid], titulo: 'R23 · Bandoleros', texto: 'Pelea (ellos tiran 2 dados con 1 de ventaja): si ganas no pierdes nada; si pierdes, se llevan los 3 sacos pero ganas 15 noches. O entrégales un saco sin pelear.', opciones: [{ id: 'pelear', texto: 'Pelear' }, { id: 'saco', texto: 'Perder un saco' }], porDefecto: 'saco', cont: { fn: 'r23.banditos', args: { carga } } });
  } else nuevaMision(e, pid, { id: 'R23', destino: 'El Cairo', carga, texto: 'Lleva la sal a El Cairo.' }, 2);
} };
registrar('r23.banditos', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid]; let carga = args.carga;
  if (resp.opcion === 'saco') { const c = carga.pop(); quitarCarta(j, c.uid); }
  else if (!peleaNPC(data, e, pid, { etq: 'Bandoleros', dados: 2, bono: 1 })) {   // Jorge (17 de noviembre): si pierdes, pierdes los 3 sacos pero ganas 15 noches
    for (const c of carga) quitarCarta(j, c.uid); carga = [];
    premio(data, e, pid, { noches: 15 }, `${j.nombre} pierde ante los bandoleros: se llevan toda la sal, pero gana 15 noches por la historia.`);
  }
  if (carga.length) { nuevaMision(e, pid, { id: 'R23', destino: 'El Cairo', carga, texto: 'Lleva la sal a El Cairo.' }, 2); anunciarReto(data, e, pid, 'R23', 'curso'); }
  else cerrarReto(data, e, pid, 'R23', false);   // las 15 noches son de consuelo
});
// Jorge (19 de noviembre): si ya traes una cesta de manzanas (la del mercado), R24 usa esa y solo cobra 5; si no, cobra 10 y te da la suya.
// La cesta se gasta al entregarla en Bagdad (o al perder el reto).
export const R24 = { conCesta: 5, sinCesta: 10 };
const cestaLibre = (j) => j.mano.find((c) => c.tipo === 'item' && c.ref === 'cesta' && !j.misiones.some((m) => (m.carga || []).some((x) => x.uid === c.uid)));
const costoR24 = (j) => (cestaLibre(j) ? R24.conCesta : R24.sinCesta);
T.R24 = { ciudad: 'Basra', req: (d, e, pid) => { const j = e.jugadores[pid], k = costoR24(j); return j.dinares >= k ? null : `Cuesta ${k} dinares${k === R24.conCesta ? ' (con tu cesta)' : ''}.`; }, run(data, e, pid) {
  const j = e.jugadores[pid], propia = cestaLibre(j); j.dinares -= costoR24(j); const c = propia || darItem(e, j, 'cesta');
  if (propia) log(e, `${j.nombre} lleva su propia cesta de manzanas a R24 y paga ${R24.conCesta} dinares.`, { pid });
  nuevaMision(e, pid, { id: 'R24', destino: 'Bagdad', carga: [{ uid: c.uid }], texto: 'Entrega la cesta en Bagdad este turno.' }, 1);
} };
// Jorge (19 de noviembre): R26 no depende de si Zein es jugadora; solo quien juega con Zein no puede hacerlo.
T.R26 = { ciudad: 'Andalucía', req: (data, e, pid) => (e.jugadores[pid].pj === '2' ? 'Zein no puede hacer este reto, por obvias razones.' : null), run(data, e, pid, ctx) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R26');
  const r = zeinTirada(data, e, ctx, pid);
  const bendito = !r.salvo && j.pj !== '3' && tieneItem(j, 'bendicionAbuMadyan');
  if (bendito) { quitarPrimero(j, 'item', 'bendicionAbuMadyan'); ctx.say('El esposo llega a la Giralda, pero la bendición de Abu Madyan lo aparta: no los sorprende (la bendición se gasta).'); }
  if (r.salvo || j.pj === '3' || bendito) { premio(data, e, pid, { dinares: j.pj === '3' ? 10 : 25, noches: 20 }, `${j.nombre} pasa la noche con Zein:`); if (!bendito) ctx.say(r.salvo ? 'El esposo no los sorprende.' : 'Anís se escapa por la ventana.'); }
  else {
    ctx.say('El esposo los sorprende.'); ctx.fin(); ctx.grupos = []; ctx.res = [];
    if (!peleaNPC(data, e, pid, { etq: 'Esposo de Zein', dados: 2, bono: 1, jambiya: true, figura: 'CO' })) { ctx.resultado = 'fallo'; j.noches -= 30; j.herido = true; log(e, `${j.nombre} pierde ante el esposo: pierde 30 noches y queda herido.`, { pid }); }
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
  if (x === 1 && tieneObj(j, 'OB20')) { consumirObj(data, e, pid, 'OB20'); ctx.resultado = 'fallo'; ctx.say('La mezcla explota, pero tu Antídoto te salva: ni quedas herido ni pierdes noches (el antídoto se gasta).'); }   // Jorge (18 de noviembre)
  else if (x === 1) { j.noches -= 10; j.herido = true; ctx.say('La mezcla explota: -10 noches y herido.'); }
  else { darItem(e, j, 'veneno', { turnos: j.turnos }); j.noches += 10; ctx.say('Preparas un veneno y ganas 10 noches.'); }
} };
// ---------------------------------------------------------------- retos añadidos R28-R39
const aplic = (data, e, pid, usados, id) => usa(data, e, pid, usados, id);
T.R28 = { ciudad: 'Estambul', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 10; hacer(e, pid, 'R28');
  // Jorge (19 de noviembre): el Pastel de pistaches supera al guardia sin tirar (se gasta), como la Ganzúa.
  let ganz = aplic(data, e, pid, us, 'OB07'), b1 = (aplic(data, e, pid, us, 'OB43') ? 1 : 0) + (aplic(data, e, pid, us, 'OB08') ? 1 : 0);
  if (!ganz && aplic(data, e, pid, us, 'OB21')) { ganz = true; ctx.say('Le das un pastel de pistaches al guardia: te deja pasar sin tirar.'); log(e, `${j.nombre} convence al guardia con un pastel de pistaches.`, { pid }); }
  if (!ganz) { const v = ctx.t(`${j.nombre}: el guardia`, 2); if (suma(v) + b1 < 7) { j.noches -= 20; j.herido = true; ctx.say('El guardia te sorprende: -20 noches, herido.'); ctx.fallo = true; return; } ctx.say('Pasas al guardia.'); } else ctx.say('La ganzúa neutraliza al guardia.');
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
T.R30 = { ciudad: 'Andalucía', req: (d, e, pid) => (!tieneObj(e.jugadores[pid], 'OB12') ? 'Necesitas una Balanza de mercader.' : e.jugadores[pid].dinares >= 5 ? null : 'Cuesta 5 dinares.'),   // Balanza obligatoria (Jorge, 18 de noviembre)
  run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 5; const c = darItem(e, j, 'pergaminoSellado');
  const [x] = ctx.t(`${j.nombre}: el guardia del camino`, 1);
  if (x <= 3) {
    if (aplic(data, e, pid, us, 'OB21')) { ctx.say('Le das un pastel de pistaches al guardia: te deja pasar sin pagar el peaje.'); log(e, `${j.nombre} pasa al guardia del camino con un pastel de pistaches.`, { pid }); }
    else if (aplic(data, e, pid, us, 'OB14') || aplic(data, e, pid, us, 'OB17')) ctx.say('Pagas el peaje con tu objeto.');
    else if (j.dinares >= 15) { j.dinares -= 15; ctx.say('Pagas 15 dinares de peaje.'); } else { quitarCarta(j, c.uid); ctx.say('No puedes pagar el peaje: pierdes el reto.'); return; }
  }
  nuevaMision(e, pid, { id: 'R30', destino: 'Bagdad', carga: [{ uid: c.uid }], texto: 'Entrega el pergamino sellado en Bagdad.' }, 3);
} };
T.R31 = { ciudad: 'Isfahán', req: (d, e, pid) => (e.jugadores[pid].dinares >= 15 ? null : 'Cuesta 15 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 15; hacer(e, pid, 'R31');
  // Jorge (18 de noviembre): el Sobre de sobornos cambia el dado del guardia a lo que necesitas (pasas sin tirar); el Pastel de pistaches y la Carta de recomendación suman +1
  // Jorge (19 de noviembre): el Pastel de pistaches también supera al capitán de la guardia sin tirar (antes, +1).
  let ganz = aplic(data, e, pid, us, 'OB07') || aplic(data, e, pid, us, 'OB41') || aplic(data, e, pid, us, 'OB14');
  if (!ganz && aplic(data, e, pid, us, 'OB21')) { ganz = true; ctx.say('Le das un pastel de pistaches al capitán de la guardia: te deja pasar sin tirar.'); log(e, `${j.nombre} convence al capitán de la guardia con un pastel de pistaches.`, { pid }); }
  const b1 = (aplic(data, e, pid, us, 'OB43') ? 1 : 0) + (aplic(data, e, pid, us, 'OB08') ? 1 : 0) + (aplic(data, e, pid, us, 'OB30') ? 1 : 0);
  if (!ganz) { const v = ctx.t(`${j.nombre}: el capitán`, 2); if (suma(v) + b1 < 8) { j.noches -= 30; j.herido = true; ctx.say('Te sorprenden: -30 noches, herido.'); ctx.fallo = true; return; } }
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
  if (aplic(data, e, pid, us, 'OB10')) { ctx.say('Lanzas tu Red de pescador y atrapas al ladrón sin tirar (la red se gasta).'); premio(data, e, pid, { dinares: 35, noches: 10 }, `${j.nombre} atrapa al ladrón con su Red de pescador:`); return; }
  // Jorge (19 de noviembre): el Lazo de camellero también atrapa al ladrón sin tirar, como la Red de pescador; el lazo no se gasta.
  if (aplic(data, e, pid, us, 'OB05')) { ctx.say('Lanzas tu Lazo de camellero y atrapas al ladrón sin tirar (el lazo no se gasta).'); premio(data, e, pid, { dinares: 35, noches: 10 }, `${j.nombre} atrapa al ladrón con su Lazo de camellero:`); return; }
  const v = ctx.t(`${j.nombre}: persecución`, 2); const b = aplic(data, e, pid, us, 'OB08') ? 1 : 0; const s = suma(v) + b;
  if (s >= 8) premio(data, e, pid, { dinares: 35, noches: 10 }, `${j.nombre} alcanza al ladrón:`);
  else if (s >= 5) { ctx.say('El ladrón se escapa.'); ctx.fallo = true; } else { pagar(data, e, pid, 5); ctx.say('Tropiezas y pagas 5 dinares por los puestos.'); ctx.fallo = true; }
} };
T.R34 = { ciudad: 'Magreb', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; j.dinares -= 10; hacer(e, pid, 'R34');
  const b = (aplic(data, e, pid, us, 'OB09') ? 1 : 0) + (aplic(data, e, pid, us, 'OB06') ? 1 : 0); const [x] = ctx.t(`${j.nombre}: la cueva`, 1); const r = x + b;
  if (r <= 2) { ctx.fallo = true; if (aplic(data, e, pid, us, 'OB26')) ctx.say('El espejo devuelve la maldición.'); else { j.noches -= 20; j.herido = true; ctx.say('El guardián te maldice: -20 noches, herido.'); } }
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
  if (peleaNPC(data, e, pid, { etq: 'Campeón del puerto', dados: 2, bono: 2, escudo: 2 }))   // la carta: Escudo de cuero +2 como defensor (Jorge, 27 de noviembre, C04)
   { premio(data, e, pid, { dinares: 50, noches: 15 }, `${j.nombre} vence al campeón del puerto:`); robarBotin(data, e, pid); }
  else { pagar(data, e, pid, 15); j.herido = true; log(e, `${j.nombre} cae ante el campeón del puerto.`, { pid }); ctx.fallo = true; }
} };
T.R37 = { ciudad: 'El Cairo', req: (data, e, pid) => { const j = e.jugadores[pid]; return j.dinares >= 10 || tieneObj(j, 'OB30') ? null : 'Cuesta 10 dinares.'; }, run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R37');
  if (aplic(data, e, pid, us, 'OB30') || (j.dinares < 10 && consumirObj(data, e, pid, 'OB30'))) ctx.say('Entras con tu carta de recomendación.'); else j.dinares -= 10;
  const [x0] = ctx.t(`${j.nombre}: la boda`, 1); const x = x0 + (aplic(data, e, pid, us, 'OB21') ? 1 : 0);
  if (x <= 2) { j.extra.sinPrincipal = true; ctx.say('Se te sube el vino: perderás tu próxima acción principal.'); }
  else if (x <= 5) {   // Jorge (20 de noviembre): 30 dinares y una carta más. 3D (26 de noviembre): ya no hay Cartas de Cuentos; sacas un evento de jugador
    premio(data, e, pid, { dinares: 30 }, 'Contactos útiles:');
    if (HOOK.sacarEJ?.(data, e, pid)) ctx.say('Ganas 30 dinares y sacas un evento de jugador.');
    else ctx.say('Ganas 30 dinares.');
  }
  else { darTransporte(data, e, pid, 'caballo'); ctx.say('Un socio generoso te regala un caballo nuevo.'); }   // Jorge (19 de noviembre): un caballo en vez de 60 dinares
} };
T.R38 = { ciudad: 'Yemen', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Apuesta mínima: 10 dinares.'), run(data, e, pid, ctx, us) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R38');
  const cargados = aplic(data, e, pid, us, 'OB13');
  for (let g = 0; g < 30; g++) {
    let v = ctx.t(`${j.nombre} apuesta 10`, 2); let s = suma(v);
    if (cargados) { if (s === 2) { pagar(data, e, pid, 10); ctx.say('Te descubren con los dados cargados: pierdes el objeto y pagas 10 dinares.'); ctx.fallo = true; return; } s = 9; }
    const h = ctx.t('La casa', 2); const sh = suma(h);
    if (s === sh) { ctx.say('Empate: se repite.'); ctx.grupos.length = 0; continue; }
    if (s > sh) { darTransporte(data, e, pid, 'camello'); ctx.say('Ganas la apuesta: recuperas tus 10 dinares y te llevas un camello nuevo.'); log(e, `${j.nombre} gana la apuesta en la taberna y se lleva un camello.`, { pid }); } else { j.dinares -= 10; ctx.say('La casa gana: pierdes los 10 dinares.'); ctx.fallo = true; }   // Jorge (19 de noviembre): un camello en vez de 30 dinares
    return;
  }
} };
T.R39 = { ciudad: 'Aleppo', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'Cuesta 10 dinares.'), run(data, e, pid) {
  const j = e.jugadores[pid]; j.dinares -= 10; const c = darItem(e, j, 'cartaUrgente');
  nuevaMision(e, pid, { id: 'R39', destino: 'El Cairo', carga: [{ uid: c.uid }], texto: 'Lleva la carta urgente a El Cairo.' }, 2);
} };
// R40 (regla de la casa): cruzar a Abisinia desde Yemen. Pasaje de 15; 1 dado +1 destreza +1 camello: 6+ carta de Ifrit
// (o 40 dinares), 4–5 vuelves a Moca, 1–3 tormenta y quedas herido. Se gana una vez por partida; herido no se intenta.
// R44 «Visitar Timbuktú» (Jorge, 7 de noviembre): desde el Magreb, 10 dinares de caravana y 20 noches (antes 30); una vez por jugador. Mientras dure la
// carta S2 «Mansa Musa despertó generoso», además se tira 1 dado (con su botón): 6, 50 dinares y 40 noches más; 4–5, 35 y 20; 1–3, 10 noches (Jorge, 20 de noviembre).
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
T.R51 = { ciudad: 'Andalucía', req: (d, e, pid) => (soloJambiya(e.jugadores[pid]) ? MSJ_SOLO_JAMBIYA : motivoTorneo(e, e.jugadores[pid])),   // su premio es destreza en arco
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid];
    if (j.npc) { ctx.resultado = 'logro'; return torneoSoborno(e, pid); }   // Yafar NPC siempre soborna
    if (j.pj === 'B') {   // Yafar jugador decide: tirar o sobornar
      const total = TORNEO.costo + TORNEO.soborno, falta = total - j.dinares;
      pedir(e, { tipo: 'reto', para: [pid], titulo: 'R51 · Torneo de Murcia', texto: `Entrada: ${TORNEO.costo} dinares. Puedes tirar tu dado (1 o 6 ganas) o sobornar a los jueces con ${TORNEO.soborno} dinares más y ganar sin tirar.`,
        opciones: [{ id: 'tirar', texto: `Tirar el dado (${TORNEO.costo} dinares)` }, { id: 'sobornar', texto: `Sobornar a los jueces (${total} dinares en total)${falta > 0 ? ` — te faltan ${falta} dinares` : ''}`, desactivada: falta > 0 }],
        porDefecto: 'tirar', limiteMs: 60000, cont: { fn: 'reto.murcia', args: {} } });
      ctx.sinAnuncio = true;   // se anuncia en reto.murcia
      return;
    }
    torneoTirar(data, e, pid, ctx);
  } };
function torneoEntrar(e, j) { j.dinares -= TORNEO.costo; quitarPrimero(j, 'item', 'flechas'); j.extra.murciaTurno = j.turnos; }
function torneoGana(e, pid, como) {
  const j = e.jugadores[pid]; hacer(e, pid, 'R51'); aplazarDestreza(e, pid, { t: 'arcoMaximo', de: 'R51' });
  log(e, `${j.nombre} gana el Torneo de Murcia${como}: al iniciar su siguiente turno tendrá la destreza máxima en arco (sus flechas siempre aciertan).`, { pid, aviso: true });
}
function torneoSoborno(e, pid) {
  const j = e.jugadores[pid]; torneoEntrar(e, j); j.dinares -= TORNEO.soborno;
  if (!j.npc) info(e, pid, 'Torneo de Murcia', `Pagas ${TORNEO.costo} de entrada y ${TORNEO.soborno} de soborno a los jueces: ganas el torneo y la destreza máxima en arco.`);
  torneoGana(e, pid, ` sobornando a los jueces (${TORNEO.costo + TORNEO.soborno} dinares)`);
}
function torneoTirar(data, e, pid, ctx) {
  const j = e.jugadores[pid]; torneoEntrar(e, j);
  const [x] = ctx.t(`${j.nombre}: Torneo de Murcia (1 o 6 gana)`, 1);
  ctx.resultado = TORNEO.gana.includes(x) ? 'logro' : 'fallo';   // con 2 a 5, las 20 noches son de consuelo
  if (TORNEO.gana.includes(x)) { ctx.say('¡Ganas el torneo! Destreza máxima en arco: tus flechas siempre aciertan y el rival pelea con −1.'); torneoGana(e, pid, ''); }
  else { j.noches += TORNEO.noches; ctx.say(`No ganas esta vez, pero te llevas ${TORNEO.noches} noches por la historia. Podrás volver a participar dentro de ${TORNEO.cadaTurnos} turnos.`); log(e, `${j.nombre} pierde el Torneo de Murcia y gana ${TORNEO.noches} noches.`, { pid }); }
}
registrar('reto.murcia', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  if (resp.opcion === 'sobornar' && j.dinares >= TORNEO.costo + TORNEO.soborno) { torneoSoborno(e, pid); return cerrarReto(data, e, pid, 'R51', true); }
  const ctx = nuevoCtx(e, pid, 'R51'); torneoTirar(data, e, pid, ctx); ctx.fin();
  cerrarReto(data, e, pid, 'R51', ctx.resultado === 'logro');
});
T.R45 = { ciudad: 'India', req: (d, e, pid) => (e.jugadores[pid].npc ? 'Yafar NPC no trabaja para el Nizam.' : null),
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; hacer(e, pid, 'R45');
    const [x] = ctx.t(`${j.nombre}: trabajo para el Nizam (10 dinares + 5 por punto)`, 1);
    const pago = 10 + 5 * x; j.dinares += pago; j.noches += 10; ctx.resultado = 'logro';   // perder el turno es parte del trabajo, no un fracaso   // Jorge (10 de noviembre): además 10 noches
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
      if (MECENAS.retos.includes(id) && conMecenas(e, j)) { j.extra.estudio = { idioma: I.idioma, ciudad: I.ciudad, desde: j.turnos, hasta: j.turnos + 1, mecenas: true }; ctx.say(`Pagas 5 dinares de clases. ${MSJ_MECENAS} En tu siguiente turno ya hablas ${I.idioma}.`); log(e, `${j.nombre} se inscribe a clases de ${I.idioma} en ${I.ciudad} con mecenas: las termina en su siguiente turno.`, { pid }); ctx.resultado = 'curso'; return; }
      const [x] = ctx.t(`${j.nombre}: clases de ${I.idioma} (par, 1 turno; impar, 2)`, 1);
      const n = x % 2 === 0 ? 1 : 2;
      j.extra.estudio = { idioma: I.idioma, ciudad: I.ciudad, desde: j.turnos, hasta: j.turnos + n };
      ctx.say(`Pagas 5 dinares de clases. Te quedas ${n === 1 ? '1 turno' : '2 turnos'} en ${I.ciudad} estudiando ${I.idioma}: no puedes salir y tu acción principal se va en las clases.`);
      log(e, `${j.nombre} se inscribe a clases de ${I.idioma} en ${I.ciudad}: ${n === 1 ? '1 turno' : '2 turnos'}.`, { pid });
    } };
}
// Mecenas (Jorge, 20 de noviembre): si al iniciar R46, R47 o R55 llevas Lámpara de aceite, papel amate y cálamo de Kufa, se gastan y se esfuman
// (no vuelven al mercado), no tiras el dado y el estudio termina al iniciar tu siguiente turno. Pagas el costo normal.
export const MECENAS = { retos: ['R46', 'R47', 'R55'],   // R46 persa también (Jorge, 20 de noviembre)
  objetos: ['lampara', 'amate', 'buza'] };
export const MSJ_MECENAS = 'Tuviste mecenas que pagaron tus útiles y estudios: tu lámpara de aceite, tu papel amate y tu cálamo de Kufa se gastan.';
function conMecenas(e, j) {
  if (!MECENAS.objetos.every((r) => tieneItem(j, r))) return false;
  for (const r of MECENAS.objetos) quitarPrimero(j, 'item', r);
  return true;
}
// R55 «Investigar el fuego griego» (Jorge, 19 de noviembre): en Estambul, si ya hablas árabe y persa. Igual que las clases de idiomas:
// 5 dinares y 1 dado con botón (par, 1 turno; impar, 2), sin salir de Estambul y con la acción principal en el estudio. Al terminar
// ganas 35 noches (Jorge, 19 de noviembre) y eres «Polímata»: cobras 12 dinares más al iniciar tu turno en Bagdad, Estambul, El Cairo o Andalucía. Una vez por jugador; Yafar NPC no.
export const POLIMATA = { costo: 5, ciudad: 'Estambul', ingreso: 12, noches: 35, ciudades: ['Bagdad', 'Estambul', 'El Cairo', 'Andalucía'] };
T.R55 = { ciudad: POLIMATA.ciudad, req: (d, e, pid) => { const j = e.jugadores[pid];
    return j.npc ? 'Yafar NPC no toma clases.' : j.extra?.polimata ? 'Ya eres polímata.' : !(hablaIdioma(j, 'árabe') && hablaIdioma(j, 'persa')) ? 'Necesitas hablar árabe y persa (retos R47, en Yemen, y R46, en Isfahán).' : j.dinares < POLIMATA.costo ? `Las clases cuestan ${POLIMATA.costo} dinares: sin dinero no hay trato.` : null; },
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; j.dinares -= POLIMATA.costo; hacer(e, pid, 'R55');
    if (conMecenas(e, j)) { j.extra.estudio = { idioma: 'el fuego griego', ciudad: POLIMATA.ciudad, desde: j.turnos, hasta: j.turnos + 1, polimata: true, mecenas: true }; ctx.say(`Pagas ${POLIMATA.costo} dinares. ${MSJ_MECENAS} En tu siguiente turno terminas de investigar el fuego griego.`); log(e, `${j.nombre} empieza a investigar el fuego griego en Estambul con mecenas: termina en su siguiente turno.`, { pid }); ctx.resultado = 'curso'; return; }
    const [x] = ctx.t(`${j.nombre}: investigar el fuego griego (par, 1 turno; impar, 2)`, 1);
    const n = x % 2 === 0 ? 1 : 2;
    j.extra.estudio = { idioma: 'el fuego griego', ciudad: POLIMATA.ciudad, desde: j.turnos, hasta: j.turnos + n, polimata: true };
    ctx.say(`Pagas ${POLIMATA.costo} dinares. Te quedas ${n === 1 ? '1 turno' : '2 turnos'} en Estambul investigando el fuego griego: no puedes salir y tu acción principal se va en el estudio.`);
    log(e, `${j.nombre} empieza a investigar el fuego griego en Estambul: ${n === 1 ? '1 turno' : '2 turnos'}.`, { pid });
  } };
export function ingresoPolimata(e, pid) {
  const j = e.jugadores[pid];
  if (!j?.extra?.polimata || !POLIMATA.ciudades.includes(j.ciudad)) return 0;
  j.dinares += POLIMATA.ingreso;
  log(e, `${j.nombre}, polímata, cobra ${POLIMATA.ingreso} dinares más en ${j.ciudad} por su saber.`, { pid });
  return POLIMATA.ingreso;
}
export function turnoEstudio(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, s = j?.extra?.estudio;
  if (!s || !t) return;
  if (j.ciudad !== s.ciudad) { j.extra.estudio = null; return; }   // si un evento lo sacó de la ciudad, pierde las clases
  if (s.mecenas) { s.hasta = Math.min(s.hasta, j.turnos); finEstudio(data, e, pid); return; }   // con mecenas, el conocimiento llega al iniciar el siguiente turno, sin gastar su acción
  t.principal = true; t.estudiando = true;
  log(e, `${j.nombre} pasa este turno ${s.polimata ? 'investigando el fuego griego' : 'en clases de ' + s.idioma} (${j.turnos - s.desde} de ${s.hasta - s.desde}).`, { pid });
}
export function finEstudio(data, e, pid) {
  const j = e.jugadores[pid], s = j?.extra?.estudio;
  if (!s || j.turnos < s.hasta) return;
  j.extra.estudio = null;
  if (s.polimata) {   // R55
    j.extra.polimata = true; j.noches += POLIMATA.noches;   // el tope de 1,001 lo aplica topeNoches al cerrar la acción o el tick
    publicarCarta(e, { id: 'polimata', deck: 'reto', titulo: 'Polímata', sub: 'Habilidad · R55', texto: `${s.mecenas ? 'Tuviste mecenas que pagaron tus útiles y estudios. ' : ''}Terminaste de investigar el fuego griego: ganas ${POLIMATA.noches} noches y eres polímata. Desde ahora cobras ${POLIMATA.ingreso} dinares más al iniciar tu turno en Bagdad, Estambul, El Cairo o Andalucía.`, arte: 're' }, pid, [pid]);
    log(e, `${j.nombre} termina de investigar el fuego griego: gana ${POLIMATA.noches} noches y ya es polímata.`, { pid, aviso: true });
    return;
  }
  (j.extra.idiomas ||= []).push(s.idioma);
  publicarCarta(e, { id: 'habla:' + s.idioma, deck: 'reto', titulo: `Habla ${s.idioma}`, sub: 'Habilidad', texto: `${s.mecenas ? 'Tuviste mecenas que pagaron tus útiles y estudios. ' : ''}Terminaste tus clases en ${s.ciudad}: ya hablas ${s.idioma}. Puedes enseñarlo ${s.idioma === 'persa' ? 'en Estambul y en Bagdad' : 'en Andalucía'} por 4 dinares cada noche.`, arte: 're' }, pid, [pid]);
  log(e, `${j.nombre} termina sus clases: ya habla ${s.idioma}.`, { pid, aviso: true });
}
// R52 «Forjar acero de Damasco» (Jorge, 17 y 19 de noviembre): pagas 18 dinares y tiras 1 dado (con botón). Igual que estudiar un
// idioma: par, 1 turno de forja; impar, 2. En esos turnos tu acción principal se va en la forja y no puedes salir de Damasco; la
// cimitarra llega al terminar el último (turnoForja / finForja).
// Solo se forja si no tienes cimitarra; Yafar (NPC o jugador) nunca. El primero que termina gana 50 noches y abre la venta de cimitarras.
export const FORJA = { costo: 18, ciudad: 'Damasco', nochesPrimero: 50, noches: 10 };   // noches: los que no son el primero (Jorge, 20 de noviembre)
T.R52 = { ciudad: FORJA.ciudad, req: (d, e, pid) => { const j = e.jugadores[pid];
    return j.pj === 'B' ? 'Yafar no forja acero: es inepto y corrupto, y esto es conocimiento técnico especializado.' : j.extra?.forja ? 'Ya estás forjando tu acero.' : tieneItem(j, 'cimitarra') ? 'Ya tienes una cimitarra.' : j.dinares < FORJA.costo ? `Forjar cuesta ${FORJA.costo} dinares: sin dinero no hay trato.` : null; },
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; j.dinares -= FORJA.costo;
    const [x] = ctx.t(`${j.nombre}: forjar acero de Damasco (par, 1 turno; impar, 2)`, 1);
    const n = x % 2 === 0 ? 1 : 2;
    j.extra.forja = { desde: j.turnos, entrega: j.turnos + n };
    ctx.say(`Pagas ${FORJA.costo} dinares. Te quedas ${n === 1 ? '1 turno' : '2 turnos'} en Damasco forjando: no puedes salir y tu acción principal se va en el acero; al terminar ${n === 1 ? 'ese turno' : 'el segundo'} te dan la cimitarra.`);
    log(e, `${j.nombre} empieza a forjar acero de Damasco: ${n === 1 ? '1 turno' : '2 turnos'}.`, { pid });
  } };
// Jorge (19 de noviembre): la forja funciona exactamente como estudiar árabe (turnoEstudio / finEstudio): en cada turno de forja tu
// acción principal se va en el acero (no puedes salir de Damasco) y la cimitarra llega al TERMINAR el último. Par: 1 turno; impar: 2.
export function turnoForja(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, f = j?.extra?.forja;
  if (!f || !t) return;
  if (j.ciudad !== FORJA.ciudad) { j.extra.forja = null; log(e, `${j.nombre} tuvo que dejar Damasco: pierde su acero a medio forjar.`, { pid }); return; }   // si un evento lo sacó de la ciudad
  t.principal = true; t.forjando = true;
  log(e, `${j.nombre} pasa este turno en la forja de Damasco: su acción principal se va en el acero (${j.turnos - f.desde} de ${f.entrega - f.desde}).`, { pid });
}
export function finForja(data, e, pid) {
  const j = e.jugadores[pid], f = j?.extra?.forja;
  if (!f || j.turnos < f.entrega) return;
  if (j.ciudad !== FORJA.ciudad) { j.extra.forja = null; log(e, `${j.nombre} tuvo que dejar Damasco: pierde su acero a medio forjar.`, { pid }); return; }
  j.extra.forja = null; darItem(e, j, 'cimitarra');
  const primero = !e.forjaDamasco;   // Jorge (17 de noviembre): el primero que forja gana 50 noches y abre la venta de cimitarras
  if (primero) { e.forjaDamasco = true; j.noches += FORJA.nochesPrimero; } else j.noches += FORJA.noches;   // Jorge (20 de noviembre): los demás, 10
  publicarCarta(e, { id: 'forja:cimitarra', deck: 'reto', titulo: 'Acero de Damasco', sub: 'R52 · Forjar acero de Damasco', texto: `Tu acero está listo: recibes una cimitarra de acero de Damasco${primero ? ' y ganas 50 noches por ser el primero en forjarlo. Desde ahora se venden cimitarras en los mercados' : ' y ganas 10 noches'}. Ya puedes salir de la ciudad.`, arte: 'R52' }, pid, [pid]);
  log(e, `${j.nombre} termina de forjar su acero de Damasco: recibe una cimitarra${primero ? ' y gana 50 noches por ser el primero. Desde ahora se venden cimitarras en los mercados' : ' y gana 10 noches'}.`, { pid, aviso: true });
}
// R54 «Combatir a los húngaros» (Jorge, 19 de noviembre): en Estambul, con un arma (la que sea), te alistas en el ejército del sultán
// otomano. Dos dados con botón. Primero: impar, herido y 25 noches y 5 dinares por tu servicio; par, sin herida, 10 noches y destreza
// con las armas que llevas en ese momento (Jorge, 28 de noviembre: «Solo las armas que llevabas en ese momento»; del 21 al 28 era la
// destreza general en todas las armas): quedas entrenado con cada una, como en R18, R19 y R42 (+1 con ella y peleas con destreza), no
// con las que consigas después; llega al terminar el turno. Si ya estabas entrenado con todas, solo las noches. Segundo dado: 1 a 3,
// el siguiente turno estás libre; 4 a 6, sigues en batalla y pierdes ese turno. Una sola vez por jugador; gasta la acción principal;
// herido no te alistas; Yafar NPC no lo hace.
T.R54 = { ciudad: 'Estambul', req: (d, e, pid) => { const j = e.jugadores[pid];
    return j.npc ? 'Yafar NPC no se alista en el ejército del sultán.' : j.herido ? 'Herido no puedes alistarte.' : !tieneArma(d, e, j) ? 'Necesitas llevar un arma (la que sea) para alistarte.' : null; },
  run(data, e, pid, ctx) { hacer(e, pid, 'R54'); combateR54(e, pid, ctx); } };
// Jorge (26 de noviembre): «Ponle que ahí sí dan destreza»: R54 es la excepción a la regla de Zein y Ruyán: con par también ellos
// quedan entrenados con las armas que llevan, no solo con la jambiya.
export const ARMAS_R54 = ['alfanje', 'cimitarra', 'jambiya'];   // el arco no cuenta como arma
function combateR54(e, pid, ctx) {
  const j = e.jugadores[pid];
  const pend = new Set((j.extra.destrezaPend || []).filter((q) => q.t === 'arma').map((q) => q.arma));
  const nuevas = ARMAS_R54.filter((r) => tieneItem(j, r) && !j.extra.entrenado?.[r] && !pend.has(r));
  const lista = nuevas.map((r) => (r === 'alfanje' ? 'el alfanje' : 'la ' + r));
  const texto = lista.length > 1 ? lista.slice(0, -1).join(', ') + ' y ' + lista.at(-1) : lista[0];
  const [x] = ctx.t(`${j.nombre}: el combate (impar, herido y 25 noches y 5 dinares; par, ${nuevas.length ? `destreza con ${texto} y ` : ''}10 noches)`, 1);
  const [y] = ctx.t(`${j.nombre}: la batalla (1 a 3, libre el siguiente turno; 4 a 6, sigue en batalla)`, 1);
  ctx.resultado = x % 2 ? 'fallo' : 'logro';   // impar: herido (las noches y dinares son por el servicio); par: destreza
  if (x % 2) { j.herido = true; j.noches += 25; j.dinares += 5; ctx.say('Impar: quedas herido, pero ganas 25 noches y 5 dinares por tu servicio.'); }
  else {
    if (nuevas.length) aplazarDestreza(e, pid, { t: 'armasR54', armas: nuevas, de: 'R54' });   // llega al terminar el turno
    j.noches += 10; ctx.say(`Par: sales sin heridas y ganas 10 noches${nuevas.length ? `; al terminar tu turno tendrás destreza con ${texto}, las armas que llevas (+1 cuando peleas con cada una)` : ' (ya tenías destreza con las armas que llevas)'}.`);
  }
  if (y >= 4) { j.pierdeTurno = (j.pierdeTurno || 0) + 1; ctx.say(`${y}: la batalla sigue; tu siguiente turno lo pasas combatiendo y no puedes jugar.`); }
  else ctx.say(`${y}: terminas tu servicio; el siguiente turno estás libre.`);
  log(e, `${j.nombre} combate a los húngaros con el ejército del sultán otomano.`, { pid });
}
// Tumbas de los maestros (Jorge, 19 de noviembre): R57 Ibn Arabí en Damasco, R58 Ibn Hazm en Andalucía y R59 Abu Madyan en el Magreb.
// Sin requisitos, sin dado y sin costo. Visitar una gasta tu turno y solo ganas 1 noche, pero te da un dado extra al inicio del turno para
// intentar de nuevo obtener un 6 en el ingreso; el Mensaje que llegue puede ser de cualquier sheij, sin importar la tumba (engine.tirarDados).
// Jorge (19 de noviembre, más tarde): cada tumba deja UN dado extra, que se aplica solo al inicio de tu siguiente turno: si tu dado de
// ingreso saca 6, los dados extra se pierden; si no, los lanzas (cada uno con su botón) de uno en uno y, en cuanto uno saca 6, los demás
// se pierden. Después de ese ingreso no queda ninguno. Se pueden repetir, pero no la misma tumba mientras su dado siga pendiente; tumbas
// diferentes se acumulan (máximo 3, uno por tumba), aunque como cada visita termina el turno, en la práctica no se llega a tener más de uno.
export const TUMBAS = { R57: 'Damasco', R58: 'Andalucía', R59: 'Magreb' };
export const TUMBA = { noches: 1 };
export const MSJ_TUMBA_PENDIENTE = 'Aún no usas el dado extra de esta tumba.';
export const dadosTumba = (j) => Object.entries(j?.extra?.tumbas || {}).filter(([, desde]) => j.turnos > desde).map(([id]) => id);
for (const [id, ciudad] of Object.entries(TUMBAS)) {
  T[id] = { ciudad, req: (d, e, pid) => { const j = e.jugadores[pid]; return j.npc ? 'Yafar NPC no visita tumbas.' : j.extra?.tumbas?.[id] != null ? MSJ_TUMBA_PENDIENTE : null; },
    run(data, e, pid, ctx) {
      const j = e.jugadores[pid];
      j.noches += TUMBA.noches;
      (j.extra.tumbas ||= {})[id] = j.turnos;   // su dado extra, desde tu siguiente turno
      if (e.turno?.pid === pid) e.turno.fin = true;   // gasta tu turno
      ctx.resultado = 'logro';
      ctx.say(`${m1(data, id).nombre}: ganas ${TUMBA.noches} noche. Desde tu siguiente turno, si tu dado de ingreso no saca 6, tienes un dado extra para intentarlo de nuevo.`);
    } };
}
// Transcribir y traducir (Jorge, 19 de noviembre): con árabe, en cualquier ciudad, R60 la Muhallà de Ibn Hazm (5 Libros de Ibn Hazm),
// R61 el Tafsir de Abu Hayyan y R62 las Futuhat de Ibn Arabí (5 libros comunes cada uno); con persa, solo en Isfahán, Samarcanda e India,
// R63 los poemas de Rumi, R64 los de Hafez y R65 traducir al persa los de Ibn al-Farid (5 libros comunes cada uno). Una vez por jugador,
// gasta la acción principal, sin dado ni costo, y da 15 noches se vendan o no los libros. Yafar (NPC o jugador) no puede.
export const TRANSCRIBIR = { libros: 5, noches: 15 };
const CIUDADES_TODAS = ['Andalucía', 'Magreb', 'El Cairo', 'Estambul', 'Aleppo', 'Damasco', 'Yemen', 'Basra', 'Bagdad', 'Isfahán', 'Samarcanda', 'India'];
const COPIAS = {
  R60: { idioma: 'árabe', ciudades: CIUDADES_TODAS, ibnHazm: true },
  R61: { idioma: 'árabe', ciudades: CIUDADES_TODAS }, R62: { idioma: 'árabe', ciudades: CIUDADES_TODAS },
  R63: { idioma: 'persa', ciudades: ['Isfahán', 'Samarcanda', 'India'] }, R64: { idioma: 'persa', ciudades: ['Isfahán', 'Samarcanda', 'India'] },
  R65: { idioma: 'persa', ciudades: ['Isfahán', 'Samarcanda', 'India'] },
};
export const MSJ_YAFAR_COPIAS = 'Yafar no puede transcribir ni traducir: es inepto y corrupto.';
for (const [id, C] of Object.entries(COPIAS)) {
  T[id] = { ciudad: C.ciudades[0], ciudades: C.ciudades,
    req: (d, e, pid) => { const j = e.jugadores[pid]; return j.pj === 'B' ? MSJ_YAFAR_COPIAS : !hablaIdioma(j, C.idioma) ? `Necesitas hablar ${C.idioma} (reto ${C.idioma === 'árabe' ? 'R47, en Yemen' : 'R46, en Isfahán'}).`
      : espacioCarga(e, j) < TRANSCRIBIR.libros ? `Los ${TRANSCRIBIR.libros} libros pesan: sin caballo, burro o camello no te caben (como en R17).` : null; },
    run(data, e, pid, ctx) {
      const j = e.jugadores[pid]; hacer(e, pid, id);
      for (let i = 0; i < TRANSCRIBIR.libros; i++) {
        const c = C.ibnHazm ? darItem(e, j, 'libroIbnHazm', { valor: LIBRO_IBN_HAZM_VALOR, ronda: e.ronda, titulo: 'Al-Muhalla' }) : darLibro(e, pid);
        c.extra = { ...(c.extra || {}), transcrito: true };   // se venden también en Samarcanda, Andalucía y Estambul (Jorge, 19 de noviembre)
      }
      j.noches += TRANSCRIBIR.noches; ctx.resultado = 'logro';
      const nom = m1(data, id).nombre;
      ctx.say(`${nom}: obtienes ${TRANSCRIBIR.libros} ${C.ibnHazm ? 'libros de Ibn Hazm' : 'libros'} y ganas ${TRANSCRIBIR.noches} noches. Se venden en Bagdad (sin impuesto) y en Samarcanda, Andalucía y Estambul (con su impuesto).`);
      log(e, `${j.nombre} termina «${nom}»: ${TRANSCRIBIR.libros} ${C.ibnHazm ? 'libros de Ibn Hazm' : 'libros'} y ${TRANSCRIBIR.noches} noches.`, { pid });
    } };
}
// R66 «Leer manuscritos de Historia y Ciencias» (Jorge, 19 de noviembre): en Samarcanda, si sabes árabe, gastas tu acción principal y
// cobras 7 dinares. Se repite cada turno (como enseñar idiomas); no da noches. Yafar jugador sí puede si sabe árabe; Yafar NPC no.
export const MANUSCRITOS = { ciudad: 'Samarcanda', pago: 7 };
T.R66 = { ciudad: MANUSCRITOS.ciudad, req: (d, e, pid) => { const j = e.jugadores[pid]; return j.npc ? 'Yafar NPC no lee manuscritos.' : hablaIdioma(j, 'árabe') ? null : 'Necesitas hablar árabe (reto R47, en Yemen).'; },
  run(data, e, pid, ctx) { const j = e.jugadores[pid]; j.dinares += MANUSCRITOS.pago; ctx.resultado = 'logro'; ctx.say(`Lees manuscritos de Historia y Ciencias en Samarcanda: te pagan ${MANUSCRITOS.pago} dinares.`); log(e, `${j.nombre} lee manuscritos de Historia y Ciencias en Samarcanda y cobra ${MANUSCRITOS.pago} dinares.`, { pid }); } };   // no queda hecho: se repite cada turno
// R67 «Llevar esclavos a Samarra» (Jorge, 21 de noviembre): «La nueva ciudad abasí está en construcción y auge, lleva trabajadores».
// Se contrata en Basra; en Bagdad te prestan 60 dinares (deuda con Bagdad, no son tuyos); vuelves a Basra a comprar esclavos (15 cada
// uno) y los llevas a Bagdad. Plazo: el turno en que lo aceptas y uno más completo. Al llegar a Bagdad con al menos 2 esclavos, primero
// te pagan 30 por esclavo, luego se cobra tu deuda (aunque quedes en negativo: cuenta como pagada) y al final ganas 40 noches. Si no entregas a tiempo,
// pierdes el reto y los esclavos, y la deuda sigue con Bagdad. Los esclavos no pesan ni producen ni cuestan mantenimiento; sin tope.
// Una vez por jugador; Yafar NPC no lo toma. Comprar esclavos (ya con el préstamo) no gasta la acción principal.
export const SAMARRA = { ciudad: 'Basra', prestamo: 60, precio: 15, pago: 30, noches: 40, minimo: 2, turnos: 2 };
const esclavosSamarra = (j) => j.mano.filter((c) => c.tipo === 'item' && c.ref === 'esclavoSamarra');
T.R67 = { ciudad: SAMARRA.ciudad, req: (d, e, pid) => { const j = e.jugadores[pid]; return j.npc ? 'Yafar NPC no lleva esclavos a Samarra.' : deudaDe(j, 'R67') ? 'Todavía debes el préstamo de Bagdad de este reto.' : null; },
  run(data, e, pid, ctx) {
    nuevaMision(e, pid, { id: 'R67', fase: 'prestamo', destino: 'Bagdad', texto: `Ve a Bagdad: te prestan ${SAMARRA.prestamo} dinares.` }, SAMARRA.turnos);
    ctx.say(`Aceptas llevar trabajadores a Samarra. Ve a Bagdad por el préstamo de ${SAMARRA.prestamo} dinares, vuelve a Basra a comprar al menos ${SAMARRA.minimo} esclavos (${SAMARRA.precio} dinares cada uno) y llévalos a Bagdad. Tienes este turno y el siguiente.`);
  } };
export function opcionesR67(e, j) {
  const m = j.misiones.find((x) => x.id === 'R67');
  if (!m || m.fase !== 'compra' || j.ciudad !== SAMARRA.ciudad || j.transito || j.perdido) return [];
  const n = Math.floor(Math.max(0, j.dinares) / SAMARRA.precio);
  return [{ k: 'reto', id: 'R67', sub: 'comprar', boton: 'Comprar', titulo: `R67 · Comprar esclavos (${SAMARRA.precio} dinares cada uno)`, texto: `Llevas ${esclavosSamarra(j).length}. Necesitas al menos ${SAMARRA.minimo} para entregar en Bagdad. No gasta tu acción principal.`, bloqueado: n ? undefined : `Te faltan ${SAMARRA.precio - Math.max(0, j.dinares)} dinares para comprar un esclavo.` }];
}
function comprarEsclavos(data, e, pid) {
  const j = e.jugadores[pid], m = j.misiones.find((x) => x.id === 'R67');
  if (!m || m.fase !== 'compra') return err('No tienes el reto R67 en curso.');
  if (j.ciudad !== SAMARRA.ciudad) return err(`Los esclavos se compran en ${SAMARRA.ciudad}.`);
  const max = Math.floor(Math.max(0, j.dinares) / SAMARRA.precio);
  if (!max) return err(`Te faltan ${SAMARRA.precio - Math.max(0, j.dinares)} dinares para comprar un esclavo.`);   // sin dinero no hay trato
  pedir(e, { tipo: 'reto', para: [pid], titulo: 'R67 · Comprar esclavos', texto: `Cada esclavo cuesta ${SAMARRA.precio} dinares. En Bagdad te pagan ${SAMARRA.pago} por cada uno (mínimo ${SAMARRA.minimo}) y ${SAMARRA.noches} noches.`, nota: `Te alcanza para ${max}.`, modo: 'numero', min: 0, max, porDefecto: Math.min(max, SAMARRA.minimo), cont: { fn: 'r67.comprar', args: {} } });
  return ok();
}
registrar('r67.comprar', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid]; if (!j || j.eliminado) return;
  const n = Math.max(0, Math.min(resp.numero || 0, Math.floor(Math.max(0, j.dinares) / SAMARRA.precio)));
  if (!n) return;
  j.dinares -= n * SAMARRA.precio;
  for (let i = 0; i < n; i++) darItem(e, j, 'esclavoSamarra');
  log(e, `${j.nombre} compra ${n} ${n === 1 ? 'esclavo' : 'esclavos'} en Basra por ${n * SAMARRA.precio} dinares para llevarlos a Samarra.`, { pid });
});
// Préstamo al llegar a Bagdad (alLlegar, después del cobro de deudas, para que no se cobre en ese mismo momento).
function r67Llegar(data, e, pid, m) {
  const j = e.jugadores[pid];
  if (j.ciudad !== 'Bagdad' || m.fase !== 'prestamo') return;
  m.fase = 'compra'; m.destino = 'Basra'; m.texto = `Compra al menos ${SAMARRA.minimo} esclavos en Basra y llévalos a Bagdad.`;
  j.dinares += SAMARRA.prestamo;
  contraerDeuda(e, pid, { ciudad: 'Bagdad', monto: SAMARRA.prestamo, reto: 'R67', motivo: 'préstamo para los esclavos de Samarra, reto R67' });
  info(e, pid, 'R67 · El préstamo de Bagdad', `Te prestan ${SAMARRA.prestamo} dinares: no son tuyos, son una deuda con Bagdad. Vuelve a Basra, compra al menos ${SAMARRA.minimo} esclavos (${SAMARRA.precio} dinares cada uno) y tráelos a Bagdad antes de que termine tu siguiente turno. Al volver a Bagdad te pagan los esclavos y después te cobran la deuda.`);
}
// Entrega (Jorge, 21 de noviembre): ANTES del cobro automático de deudas. Primero te pagan los esclavos, luego pagas tu deuda y al
// final las 40 noches. Si al pagar quedas en negativo, la deuda cuenta como pagada: solo te queda una deuda nueva con el banco.
export function antesDeCobrar(data, e, pid) {
  const j = e.jugadores[pid], m = j.misiones.find((x) => x.id === 'R67');
  if (!m || m.fase !== 'compra' || j.ciudad !== 'Bagdad') return;
  if (m.limite != null && j.turnos > m.limite) return;
  const n = esclavosSamarra(j).length;
  if (n < SAMARRA.minimo) return;
  for (const c of esclavosSamarra(j)) quitarCarta(j, c.uid);
  quitarMision(j, m); hacer(e, pid, 'R67');
  premio(data, e, pid, { dinares: SAMARRA.pago * n }, `${j.nombre} entrega ${n} esclavos para Samarra (R67):`);
  const d = deudaDe(j, 'R67');
  let txt = '';
  if (d) {
    const neg = j.dinares < d.monto;
    pagar(data, e, pid, d.monto); j.extra.deudas.splice(j.extra.deudas.indexOf(d), 1); if (!j.extra.deudas.length) delete j.extra.deudas;
    log(e, `${j.nombre} paga su deuda con Bagdad (${d.monto} dinares, reto R67)${neg ? `; no le alcanzaba y queda en ${j.dinares} dinares (deuda con el banco)` : ''}.`, { pid });
    txt = neg ? ` Luego pagas tu deuda de ${d.monto} dinares: no te alcanzaba y quedas en ${j.dinares} dinares (deuda con el banco, que se cobra de lo próximo que recibas).` : ` Luego pagas tu deuda de ${d.monto} dinares.`;
  }
  j.noches += SAMARRA.noches;
  log(e, `${j.nombre} gana ${SAMARRA.noches} noches (R67).`, { pid });
  info(e, pid, 'R67 · Esclavos para Samarra', `Entregas ${n} esclavos: te pagan ${SAMARRA.pago * n} dinares (${SAMARRA.pago} por cada uno).${txt} Ganas ${SAMARRA.noches} noches.`);
  cerrarReto(data, e, pid, 'R67', true);
}
const ENSENAR = { R48: { idioma: 'persa', ciudades: ['Estambul', 'Bagdad'] }, R49: { idioma: 'árabe', ciudades: ['Andalucía'] } };
for (const [id, I] of Object.entries(ENSENAR)) {
  T[id] = { ciudades: I.ciudades, req: (d, e, pid) => (hablaIdioma(e.jugadores[pid], I.idioma) ? null : `Necesitas hablar ${I.idioma} (reto ${id === 'R48' ? 'R46, en Isfahán' : 'R47, en Yemen'}).`),
    run(data, e, pid, ctx) { const j = e.jugadores[pid]; j.dinares += 4; ctx.say(`Enseñas ${I.idioma} esta noche: te pagan 4 dinares.`); log(e, `${j.nombre} enseña ${I.idioma} en ${j.ciudad} y cobra 4 dinares.`, { pid }); } };   // no queda hecho: se repite cada turno
}
// Jorge (20 de noviembre): 20 noches base (antes 30); con Mansa Musa, 60 en total con 6 (+40), 40 con 4 o 5 (+20) y 30 con 1 a 3 (+10).
export const TIMBUKTU = { noches: 20, mansa: { 6: 40, 4: 20, 1: 10 } };
T.R44 = { ciudad: 'Magreb', req: (d, e, pid) => (e.jugadores[pid].dinares >= 10 ? null : 'La caravana a Timbuktú cuesta 10 dinares.'),
  run(data, e, pid, ctx) {
    const j = e.jugadores[pid]; j.dinares -= 10; j.noches += TIMBUKTU.noches; hacer(e, pid, 'R44');
    ctx.say(`${j.nombre} cruza el Sahara con la caravana de la sal y visita Timbuktú: gana ${TIMBUKTU.noches} noches.`);
    if (e.mansaGenerosa && e.ronda <= e.mansaGenerosa.hasta && !j.npc) {          // Jorge (punto 3): Mansa Musa no beneficia a Yafar
      const [x] = ctx.t(`${j.nombre}: la generosidad de Mansa Musa (6: 50 dinares y ${TIMBUKTU.mansa[6]} noches más; 4 o 5: 35 y ${TIMBUKTU.mansa[4]}; 1 a 3: ${TIMBUKTU.mansa[1]} noches)`, 1);
      const p = x === 6 ? { d: 50, n: TIMBUKTU.mansa[6] } : x >= 4 ? { d: 35, n: TIMBUKTU.mansa[4] } : { d: 0, n: TIMBUKTU.mansa[1] };
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
      // Jorge (21 de noviembre): la carta de Ifrit no se guarda: el genio te ofrece 3 deseos al azar y pides uno en ese momento.
      ctx.say('Llegas a Abisinia y en sus montañas encuentras una lámpara: el genio te concede un deseo. Vuelves a Yemen.');
      HOOK.genioFuera(data, e, pid, { titulo: 'La lámpara de Abisinia', texto: 'Frotas la lámpara que encontraste en las montañas de Abisinia y sale un genio: te concede uno de estos 3 deseos.' });
    } else if (r >= 4) ctx.say('Las corrientes te regresan a Moca: pierdes el pasaje.');
    else { j.herido = true; ctx.say('Tormenta en el estrecho: pierdes el pasaje y quedas herido.'); }
    viajePorMar(e, pid, 'en el cruce del estrecho');   // escorbuto (Jorge, 19 de noviembre); alerta roja propia (27 de noviembre)
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
    // Jorge (19 de noviembre): si te iban a atrapar y llevas un Pastel de pistaches, distraes a los guardias: huyes con las manos vacías (se gasta).
    else if (consumirObj(data, e, pid, 'OB21')) { ctx.say('El pastel de pistaches distrae a los guardias: huyes con las manos vacías.'); log(e, `${j.nombre} distrae a los guardias de Toledo con un pastel de pistaches y huye con las manos vacías.`, { pid }); }
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
  if (e.pend) return err('Espera a que se resuelva la decisión pendiente.');
  // Jorge (27 de noviembre): el otro jugador decide si acepta los 5 dinares; si los rechaza, no hay pago y el encargo del sheij no se cumple.
  log(e, `${j.nombre} ofrece 5 dinares a ${k.nombre}.`, { pid });
  pedir(e, { tipo: 'trato', para: [a.a], titulo: `${j.nombre} te ofrece 5 dinares`, texto: `${j.nombre} te ofrece 5 dinares, sin pedirte nada a cambio. ¿Los aceptas?`,
    opciones: [{ id: 'si', texto: 'Aceptar los 5 dinares' }, { id: 'no', texto: 'Rechazarlos' }], porDefecto: 'no', limiteMs: 60000, cont: { fn: 'reto.ofrecer5', args: { de: pid } } });
  return ok();
}
registrar('reto.ofrecer5', (data, e, args, resp) => {
  const j = e.jugadores[args.de], k = e.jugadores[resp.pid]; if (!j || !k) return;
  if (resp.opcion !== 'si') { log(e, `${k.nombre} rechaza los 5 dinares de ${j.nombre}.`, { pid: args.de, aviso: true }); info(e, args.de, 'Rechazó tus 5 dinares', `${k.nombre} no aceptó tus 5 dinares: no pagas nada y el encargo del sheij sigue pendiente.`); return; }
  if (j.dinares < 5) { log(e, `${j.nombre} ya no tiene 5 dinares para ${k.nombre}.`, { pid: args.de }); return; }
  j.dinares -= 5; k.dinares += 5; log(e, `${k.nombre} acepta los 5 dinares de ${j.nombre}.`, { pid: args.de, aviso: true });
  mensajes(data, e, args.de, 'ofrecer', {});
});
