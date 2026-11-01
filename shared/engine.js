// Motor de reglas AUTORITATIVO de «Mil y una Noches». Código puro (sin DOM, sin APIs de Node):
// lo usan el servidor (server/index.js) y el adaptador demo del navegador (src/game/adapters/localAdapter.js).
// Los datos (JSON de src/data) se INYECTAN: nuevoJuego(data, ...), reducir(data, ...), vista(data, ...).
// Referencias al reglamento: «R 7.3» = sección 7.3 del reglamento extendido.
// Módulos: base (utilidades, decisiones, dados), pelea (R 11-12), objetos (R 15), retos (R 14), tesoros (R 16), eventos (R 17),
// npc (R 13, 20, 21), personajes (R 10).
import {
  VERSION_ESTADO, MIN_LECTURA_MS, MIN_DADOS_MS, AUTOCIERRE_DADOS_MS, rnd, dado, dados, suma, barajar, clone, ok, err, ciudadDe, pjDe, objDe, activos, humanosVivos, nombre, log,
  cartaDatos, itemDatos, publicarCarta, robar, siguienteDados, bloqueado, responderPend, vencerPend, tieneItem, tieneEsp, uid, darItem, quitarCarta, recortarMano, pagar, patrimonio,
  eliminar, HOOK, tarifa, mostrarDados, esLibro, valorLibro, valorVino, mostrarDados as _md, CONT, registrar,
} from './base.js';
import { atacar, perfil, validarAtaque } from './pelea.js';
import * as OBJ from './objetos.js';
import * as RET from './retos.js';
import * as TES from './tesoros.js';
import * as EVE from './eventos.js';
import * as NPC from './npc.js';
import * as PJ from './personajes.js';

export { VERSION_ESTADO, MIN_LECTURA_MS, MIN_DADOS_MS, cartaDatos, clone };

export function multiplicadorRonda(data, ronda, nJugadores) {
  const tabla = nJugadores >= 7 ? data.config.multiplicador7a8Jugadores : data.config.multiplicadorNoches;   // R 6.5
  for (const [a, b, m] of tabla) if (ronda >= a && ronda <= b) return m;
  return 1;
}

// ---------------------------------------------------------------- creación
export function nuevoJuego(data, { codigo = 'MIL1', semilla = Date.now() & 0x7fffffff, ahora = Date.now(), opciones = {} } = {}) {
  return {
    v: VERSION_ESTADO, codigo, semilla, ahora, creado: ahora, fase: 'lobby', ronda: 0, host: null, pinHost: String(1000 + (semilla % 9000)),
    jugadores: {}, orden: [], turno: null, dados: null, colaDados: [], pend: null, colaPend: [], pelea: null, ultimaCarta: null, historial: [], log: [], tratos: {}, seq: 0,
    mazos: null, stock: {}, caravanas: [], ganadores: null, derrota: null, evento: { actual: null, historico: null }, mods: {}, sinCaravanasBagdad: false,
    opciones: { dificultad: 'normal', rapido: false, ...opciones }, solitario: false, asesinos: { actuaron: false, contrato: null }, firmanes: 3,
    kanmakan: { dueno: null, usada: false }, tesoros: {}, hayEliminados: false, cuentosSacados: [],
  };
}

function nuevoJugador(e, id, nombreJ, token) {
  return { id, nombre: String(nombreJ || 'Jugador').slice(0, 24), token, pj: null, listo: false, conectado: true, dinares: 0, noches: 0, ciudad: 'Bagdad', ciudadPrevia: null,
    visitadas: [], mano: [], herido: false, perdido: false, buscado: 0, eliminado: false, escondido: 0, mensaje: null, retosHechos: [], misiones: [], destreza: false, turnos: 0,
    transito: null, ventajaCombate: 0, extra: {} };
}
export function unir(e, { nombre: nom, token }) {
  const id = 'j' + (++e.seq);
  e.jugadores[id] = nuevoJugador(e, id, nom, token);
  e.orden.push(id);
  if (!e.host) e.host = id;
  return id;
}
export function conexion(e, pid, conectado) { if (e.jugadores[pid]) e.jugadores[pid].conectado = conectado; }

// ---------------------------------------------------------------- mazos
function prepararMazos(data, e) {
  const cc = {};
  for (const t of data.trivias.trivias) (cc[t.ciudad] ||= []).push({ k: 't', id: t.id });
  for (const t of data.trivias.deMesa) (cc[t.ciudad] ||= []).push({ k: 'm', id: t.id });
  for (const c of Object.keys(cc)) barajar(e, cc[c]);
  const botin = [];
  e.stock = {};
  for (const o of data.objetos.mazo) {                                                                       // R 15.2: Botín 47 cartas, Mercado 89
    if (o.sinVenta) for (let i = 0; i < o.copias; i++) botin.push(o.id); else { botin.push(o.id); e.stock[o.id] = o.copias - 1; }
  }
  e.mazos = {
    eventos: barajar(e, data.eventos.eventos.map((x) => x.id)), historicos: barajar(e, data.eventos.historicos.map((x) => x.id)),
    mensajes: barajar(e, data.mensajes.mensajes.map((x) => x.id)), cc, botin: barajar(e, botin), ifrit: barajar(e, data.objetos.ifrit.cartas.map((c) => c.id)),
    descarte: { eventos: [], historicos: [], mensajes: [] /* Mensajes fuera de juego: registro, nunca se barajan de nuevo */, botin: [], ifrit: [], cc: {} },
  };
  e.cuentosSacados = [];
}

// ---------------------------------------------------------------- partida
function iniciar(data, e) {
  const ids = e.orden.filter((id) => e.jugadores[id].pj);
  if (ids.length < 1) return err('Nadie ha elegido personaje.');
  if (ids.length > 8) return err('Máximo 8 jugadores.');
  if (ids.some((id) => !e.jugadores[id].listo)) return err('Faltan jugadores por marcar «listo».');
  const conB = ids.some((id) => e.jugadores[id].pj === 'B');
  if (ids.length >= 4 && !conB) return err('Con 4 o más jugadores alguien debe jugar con Yafar el Bermekí (R 4.3).');
  for (const id of Object.keys(e.jugadores)) if (!e.jugadores[id].pj) e.jugadores[id].eliminado = true;
  prepararMazos(data, e);
  let orden = barajar(e, ids.slice());
  const pos = (pj) => orden.findIndex((i) => e.jugadores[i].pj === pj);
  if (pos('7') >= 0) { const [a] = orden.splice(pos('7'), 1); orden.push(a); }                       // R 4.4: Adí siempre último
  if (orden.length > 1 && e.jugadores[orden[orden.length - 1]].pj === '5') {                           // Ruyán nunca el último
    const n = orden.length; [orden[n - 1], orden[n - 2]] = [orden[n - 2], orden[n - 1]];
  }
  const sinNPC = orden.slice();
  if (!conB) {                                                                                         // Yafar NPC (R 20.4, 21): juega justo antes de Adí
    const id = 'npc'; e.jugadores[id] = { ...nuevoJugador(e, id, 'Yafar el Bermekí (NPC)', null), pj: 'B', listo: true, npc: true };
    const iAdi = orden.findIndex((i) => e.jugadores[i].pj === '7');
    if (iAdi >= 0) orden.splice(iAdi, 0, id); else orden.push(id);
  }
  e.solitario = ids.length === 1;
  e.orden = orden.concat(Object.keys(e.jugadores).filter((i) => !orden.includes(i)));
  for (const id of orden) {
    const j = e.jugadores[id], p = pjDe(data, j.pj);
    j.dinares = p.inicio.dinares; j.noches = p.inicio.noches || 0; j.ciudad = 'Bagdad'; j.visitadas = ['Bagdad']; j.ciudadPrevia = null; j.destreza = !!p.destreza;
    if (e.solitario && !j.npc && e.opciones.dificultad === 'facil') j.dinares = 30;                                   // R 21.5
    for (const arma of p.arma || []) { j.mano.push({ uid: uid(e), tipo: 'item', ref: arma }); }
    if (p.inicio.firman) { j.mano.push({ uid: uid(e), tipo: 'especial', ref: 'F1' }); e.firmanes--; }
  }
  e.caravanas = ['Bagdad>Damasco', 'Damasco>Bagdad', 'Bagdad>Samarcanda'];
  e.fase = 'juego'; e.ronda = 0;
  log(e, e.solitario ? 'Empieza el modo solitario contra Yafar NPC.' : 'Empieza la partida.');
  return empezarRonda(data, e);
}

function empezarRonda(data, e) {
  e.ronda++;
  e.mods = {}; e.sinCaravanasBagdad = false;
  e.evento = { actual: null, historico: null, buscadoE7: e.evento?.buscadoE7 && e.evento.rondaE7 === e.ronda - 1 ? null : null };
  const act = activos(e);
  let evId = robar(e, 'eventos');
  if (evId === 'E1' && (e.ronda < 3 || e.asesinos.actuaron)) {                                           // R 13.4: E1 no sale antes de la ronda 3
    e.mazos.eventos.push(evId); barajar(e, e.mazos.eventos); evId = robar(e, 'eventos'); if (evId === 'E1') { e.mazos.eventos.push(evId); evId = robar(e, 'eventos'); if (evId === 'E1') evId = null; }
  }
  e.paso = 'eventos';
  if (evId) {
    if (evId !== 'E1') e.mazos.descarte.eventos.push(evId);
    e.evento.actual = evId;
    publicarCarta(e, cartaDatos(data, 'evento', evId), null);
    log(e, `Ronda ${e.ronda}: evento «${cartaDatos(data, 'evento', evId).titulo}».`);
  }
  const conHist = act.length <= 3 || e.ronda % 2 === 0;                                                   // R 6.1 (los NPC cuentan como jugadores)
  let hId = null;
  if (conHist) {
    hId = robar(e, 'historicos');
    if (hId) { e.mazos.descarte.historicos.push(hId); e.evento.historico = hId; publicarCarta(e, cartaDatos(data, 'historico', hId), null); }
  }
  e.turno = null;
  if (evId) EVE.aplicarEvento(data, e, evId);
  if (hId) EVE.aplicarHistorico(data, e, hId);
  return ok();
}

function siguienteTurno(data, e, desde) {
  let idx = desde;
  for (;;) {
    idx++;
    if (idx >= e.orden.length) { e.turno = null; return cierreRonda(data, e); }
    const id = e.orden[idx];
    if (!e.jugadores[id].eliminado) { iniciarTurno(data, e, id, idx); return ok(); }
  }
}

function cierreRonda(data, e) {
  EVE.finRonda(data, e);
  NPC.finRonda(data, e);
  for (const id of activos(e)) { const j = e.jugadores[id]; if (j.buscado > 0) j.buscado--; if (j.extra.bajoTecho && j.extra.techoRonda !== e.ronda) j.extra.bajoTecho = false; }
  const ganan = activos(e).filter((id) => patrimonio(e.jugadores[id]) >= data.config.meta);                   // R 2.3, 2.4, 20.6
  if (ganan.length) {
    const npcId = ganan.find((id) => e.jugadores[id].npc);
    const hum = ganan.filter((id) => !e.jugadores[id].npc);
    if (npcId && !hum.length) { e.fase = 'fin'; e.ganadores = []; e.derrota = 'npc'; e.turno = null; log(e, 'Yafar NPC llega a 1,001 noches primero: los jugadores pierden.'); return ok(); }
    if (npcId && Math.max(...hum.map((id) => e.jugadores[id].noches)) < e.jugadores[npcId].noches) {                  // R 2.4: si ambos llegan, gana quien tenga más noches; empate: ganan los jugadores
      e.fase = 'fin'; e.ganadores = []; e.derrota = 'npc'; e.turno = null; log(e, 'Yafar NPC llega a 1,001 con más noches que los jugadores: los jugadores pierden.'); return ok();
    }
    const g = hum;
    e.fase = 'fin'; e.ganadores = g; e.turno = null;
    log(e, 'Fin de la partida: ' + g.map((i) => e.jugadores[i].nombre).join(', ') + ' alcanza(n) 1,001 noches.');
    return ok();
  }
  const hv = humanosVivos(e);                                                                                // R 22.4: último jugador en pie
  if (!hv.length) { e.fase = 'fin'; e.ganadores = []; e.derrota = 'muerte'; log(e, 'No queda ningún jugador con vida.'); return ok(); }
  if (hv.length === 1 && !e.jugadores.npc && !e.solitario) NPC.entraNPC(data, e);
  if (hv.length === 1 && e.jugadores.npc && !e.solitario && activos(e).length === 2) e.solitario = true;
  return empezarRonda(data, e);
}

function iniciarTurno(data, e, id, idx) {
  const j = e.jugadores[id], p = pjDe(data, j.pj);
  const t = e.turno = { pid: id, idx, fase: 'ingreso', tramos: 0, ciudadInicio: j.ciudad, movio: false, llegadas: [], cc: 0, ccBien: 0, ccActual: null, principal: false, primerTurnoBagdad: !j.extra.jugoTurno, npc: !!j.npc, gastos: {} };
  j.extra.jugoTurno = true; j.turnos++;
  if (j.extra.bajoTecho) j.extra.bajoTecho = false;
  if (j.herido) { t.heridoAhora = true; t.principal = true; j.herido = false; }
  if (j.extra.sinPrincipal) { t.principal = true; j.extra.sinPrincipal = false; t.sinPrincipalMotivo = true; }
  if (j.pierdeTurno > 0) { j.pierdeTurno--; t.fase = 'mov'; t.principal = true; t.omitido = true; }
  let ing = p.inicio.ingreso;
  if (e.mods.sinIngreso?.[id]) ing = 0;
  j.dinares += ing;
  if (j.pj === '4') j.noches += 5;                                                                       // Jamil: +5 noches por turno (R 10.6)
  const esclavas = j.mano.filter((c) => c.tipo === 'item' && c.ref === 'esclava');
  for (const c of esclavas) { if (j.dinares >= 1) j.dinares -= 1; j.noches += 5; }
  log(e, `Turno de ${j.nombre}: cobra ${ing} dinares.`, { pid: id });
  PJ.inicioTurno(data, e, id);
  if (j.eliminado) return;
  RET.inicioTurno(data, e, id);
  if (j.eliminado) return;
  if (j.transito) {                                                                                       // viaje con transporte propio (R 7.1)
    j.transito.faltan--;
    if (j.transito.faltan > 0) { t.fase = 'mov'; t.principal = true; t.enTransito = true; t.fin = true; log(e, `${j.nombre} sigue de camino hacia ${j.transito.destino}.`, { pid: id }); return; }
    const tr = j.transito; j.transito = null; j.ciudad = tr.destino; t.movio = true;
    log(e, `${j.nombre} llega a ${tr.destino}.`, { pid: id });
    if (tr.jorasan) { j.perdido = true; j.ciudad = 'Jorasán'; log(e, `${j.nombre} está perdido en el Jorasán.`, { pid: id }); }
    else llegada(data, e, id, tr.desde);
  }
  if (j.npc) t.fase = 'mov';
}

// ---------------------------------------------------------------- avance automático (turnos de NPC, cierre de turno, eliminados)
export function avanzar(data, e) {
  for (let g = 0; g < 200; g++) {
    if (e.fase !== 'juego') return;
    if (e.pend) {
      const falta = e.pend.para.filter((x) => !e.pend.resp[x]);
      if (falta.every((x) => !e.jugadores[x] || e.jugadores[x].eliminado || e.jugadores[x].npc)) { vencerPend(data, e, Infinity); continue; }
      return;
    }
    if (e.solitario && !humanosVivos(e).length) { e.fase = 'fin'; e.ganadores = []; e.derrota = 'muerte'; e.turno = null; log(e, 'Has muerto: Yafar NPC gana la partida.'); return; }
    if (!humanosVivos(e).length) { e.fase = 'fin'; e.ganadores = []; e.derrota = 'muerte'; e.turno = null; return; }
    const t = e.turno;
    if (e.pelea) return;
    if (!t) { if (e.paso === 'eventos') { e.paso = null; siguienteTurno(data, e, -1); continue; } return; }
    const j = e.jugadores[t.pid];
    if (j.eliminado || t.fin) { siguienteTurno(data, e, t.idx); continue; }
    if (t.npc && !t.npcIniciado) { t.npcIniciado = true; NPC.turnoNPC(data, e, t.pid); continue; }
    return;
  }
}

// ---------------------------------------------------------------- acciones
const esHost = (e, pid) => e.host === pid;
const hostAusente = (e) => !e.jugadores[e.host] || !e.jugadores[e.host].conectado;
const puedeNPC = (e, pid) => esHost(e, pid) || hostAusente(e);
const LIBRES = ['decidir', 'cerrarDados', 'reclamarAnfitrion', 'cancelarTrato', 'elegirPj', 'listo', 'iniciar', 'opciones'];

export function reducir(data, e, pid, a, ahora = Date.now()) {
  e.ahora = ahora;
  const j = e.jugadores[pid];
  if (!j) return err('Jugador desconocido.');
  if (e.fase === 'fin' && !String(a.t).startsWith('host.')) return err('La partida terminó.');
  if (e.pend && !LIBRES.includes(a.t) && !String(a.t).startsWith('host.')) return err('Hay una decisión pendiente: respóndela primero.');
  let r;
  try { r = despachar(data, e, pid, j, a, ahora); } catch (x) { if (x?.message?.startsWith('pend')) throw x; throw x; }
  if (r && r.ok) { postAccion(data, e); avanzar(data, e); }
  return r;
}

function postAccion(data, e) {
  const t = e.turno;
  if (t && !t.npc) { const j = e.jugadores[t.pid]; if (j && !j.eliminado) RET.revisarKanmakan(data, e, t.pid); }
  for (const id of activos(e)) RET.revisarKanmakan(data, e, id);
}

function despachar(data, e, pid, j, a, ahora) {
  const t = e.turno;
  switch (a.t) {
    // ---- lobby
    case 'elegirPj': {
      if (e.fase !== 'lobby') return err('La partida ya empezó.');
      if (!pjDe(data, a.pj)) return err('Personaje inexistente.');
      if (Object.values(e.jugadores).some((x) => x.pj === a.pj && x.id !== pid)) return err('Ese personaje ya está tomado.');
      j.pj = a.pj; j.listo = false; return ok();
    }
    case 'listo': if (e.fase !== 'lobby' || !j.pj) return err('Elige personaje primero.'); j.listo = !!a.v; return ok();
    case 'opciones': {
      if (e.fase !== 'lobby') return err('La partida ya empezó.'); if (!esHost(e, pid)) return err('Solo el anfitrión.');
      if (['facil', 'normal', 'dificil'].includes(a.dificultad)) e.opciones.dificultad = a.dificultad;
      return ok();
    }
    case 'iniciar': if (e.fase !== 'lobby') return err('Ya empezó.'); if (!esHost(e, pid)) return err('Solo el anfitrión (banco) inicia la partida.'); return iniciar(data, e);
    case 'reclamarAnfitrion': if (String(a.pin) !== e.pinHost) return err('PIN incorrecto.'); e.host = pid; log(e, `${j.nombre} es ahora el banco/anfitrión.`); return ok();
    // ---- decisiones y dados
    case 'decidir': return responderPend(data, e, pid, a);
    case 'tirarDados': return tirarDados(data, e, pid, a);
    case 'cerrarDados': {
      if (!e.dados) return ok();
      if (ahora - e.dados.t0 < MIN_DADOS_MS) return err('Los dados siguen rodando.');
      siguienteDados(e); return ok();
    }
    // ---- turno
    case 'viajar': return viajar(data, e, pid, a);
    case 'terminarTurno': return terminarTurno(data, e, pid);
    case 'responderCC': return responderCC(data, e, pid, a);
    case 'omitirCC': if (!t || t.pid !== pid || !t.ccActual) return err('No hay CC pendiente.'); t.ccActual = null; return ok();
    case 'resolverMesa': return resolverMesa(data, e, pid, a);
    case 'atacar': { const r = atacar(data, e, pid, a); if (r.ok) PJ.tras(data, e, pid, 'ataque'); return r; }
    case 'comprar': return OBJ.comprar(data, e, pid, a);
    case 'vender': return OBJ.vender(data, e, pid, a);
    case 'usar': return OBJ.usar(data, e, pid, a);
    case 'proponerTrato': return proponerTrato(data, e, pid, a);
    case 'responderTrato': return responderTrato(data, e, pid, a);
    case 'cancelarTrato': { const tr = e.tratos[a.id]; if (tr && tr.de === pid) delete e.tratos[a.id]; return ok(); }
    case 'ofrecer5': return RET.ofrecer5(data, e, pid, a);
    case 'reto': return RET.iniciarReto(data, e, pid, a);
    case 'tesoro': return TES.accion(data, e, pid, a);
    case 'esconder': return TES.esconder(data, e, pid, a);
    case 'recuperar': return TES.recuperar(data, e, pid, a);
    case 'asesinos': return NPC.contratar(data, e, pid, a);
    case 'pj': return PJ.accion(data, e, pid, a);
    // ---- anfitrión / banco (R 22): reparte, baraja y corrige errores; no decide por nadie
    case 'host.dar': if (!esHost(e, pid)) return err('Solo el anfitrión.'); return hostDar(e, a);
    case 'host.corregir': if (!esHost(e, pid)) return err('Solo el anfitrión.'); return hostCorregir(e, a);
    case 'host.repartir': if (!esHost(e, pid)) return err('Solo el anfitrión.'); return hostRepartir(data, e, a);
    case 'host.barajar': if (!esHost(e, pid)) return err('Solo el anfitrión.'); return hostBarajar(e, a);
    case 'host.tirarNPC': if (!puedeNPC(e, pid)) return err('Solo el anfitrión (o cualquiera si el banco está desconectado).'); return tirarDadosLibres(e, pid, a);
    case 'host.pasarTurno': if (!esHost(e, pid)) return err('Solo el anfitrión.'); if (!t) return err('No hay turno.'); e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.pelea = null; t.fin = true; return ok();
    case 'host.revelarCarta': if (!esHost(e, pid)) return err('Solo el anfitrión.'); return hostRevelar(data, e, a);
    case 'host.ceder': if (!esHost(e, pid)) return err('Solo el anfitrión.'); if (!e.jugadores[a.pid] || e.jugadores[a.pid].npc) return err('Jugador inexistente.'); e.host = a.pid; return ok();
    case 'host.eliminar': {
      if (!esHost(e, pid)) return err('Solo el anfitrión.');
      const je = e.jugadores[a.pid]; if (!je || je.eliminado) return err('Jugador inexistente.');
      eliminar(data, e, a.pid, { causa: 'decisión del banco' }); return ok();
    }
    default: return err('Acción desconocida: ' + a.t);
  }
}

// ---------------------------------------------------------------- dados del turno
function tirarDados(data, e, pid, a) {
  const t = e.turno;
  if (e.fase !== 'juego') return err('La partida no está en curso.');
  if (!t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase !== 'ingreso') return err('Ya tiraste el dado de ingreso.');
  const j = e.jugadores[pid];
  const v = dado(e);
  mostrarDados(e, { por: pid, motivo: 'ingreso', grupos: [{ etq: `${j.nombre}: dado de ingreso`, valores: [v] }], resumen: [] });
  log(e, `${j.nombre} tira el dado de ingreso: ${v}.`, { pid });
  t.fase = 'mov';
  if (v === data.config.minimoMensajeDado) darMensaje(data, e, pid);                                                // R 6.2 y 18.2
  return ok();
}
function tirarDadosLibres(e, pid, a) {
  const n = Math.min(Math.max(a.n || 2, 1), 4);
  const valores = dados(e, n);
  mostrarDados(e, { por: pid, motivo: 'npc:' + (a.quien || 'NPC'), npc: true, grupos: [{ etq: a.quien || 'Dados de NPC', valores }], resumen: [`${e.jugadores[pid].nombre} tira ${n} dado(s) por ${a.quien || 'un NPC'}: ${valores.join(' + ')}.`] });
  return ok();
}
function darMensaje(data, e, pid) {
  const j = e.jugadores[pid];
  if (j.npc) return;
  const yaEstaRonda = e.log.some((l) => l.msgRonda === e.ronda);                                                      // máx. 1 jugador por ronda
  if (yaEstaRonda || j.mensaje) return;
  const id = robar(e, 'mensajes');
  if (!id) return;
  j.mensaje = { id, turnoLimite: e.ronda + data.mensajes.mensajes.find((m) => m.id === id).plazoTurnos };
  publicarCarta(e, cartaDatos(data, 'mensaje', id), pid, [pid]);
  log(e, `${j.nombre} recibe un mensaje de un sheij.`, { msgRonda: e.ronda });
}

// ---------------------------------------------------------------- viajes
export function viajar(data, e, pid, a) {
  const t = e.turno, j = e.jugadores[pid];
  const destino = a.destino;
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (j.perdido) return err('Estás perdido en el Jorasán.');
  if (j.transito) return err('Vas de camino.');
  if (t.omitido || t.fin) return err('Este turno está cerrado.');
  if (t.tramos >= (t.maxTramos || data.config.maxTramosPorTurno)) return err('Máximo 2 tramos por turno (R 7.3).');
  if (t.ccActual) return err('Resuelve primero la carta de Cuentos.');
  if (j.extra.sinViajar === e.ronda) return err('Un lazo te impide viajar esta ronda.');
  const origen = j.ciudad;
  if (e.sinCaravanasBagdad && origen === 'Bagdad') return err('Tormenta de arena: esta ronda no salen caravanas desde Bagdad (E3).');
  if (e.mods.varado?.[pid]) return err('Estás varado por los vientos del monzón.');
  let precio = tarifa(data, e, j, origen, destino);
  if (precio === null) return err('No hay ruta directa o está cortada: usa un transbordo (R 7.3).');
  let gratis = false;
  if ((j.pj === '4' && origen === 'El Cairo' && destino === 'Bagdad') || (j.pj === '5' && origen === 'Bagdad' && destino === 'El Cairo')) { precio = 0; gratis = true; }   // R 10.5, 10.6
  if (a.gratisPrimerVisitante && j.extra.viajeGratisBagdad) precio = 0;
  const args = { destino, precio, servicios: false, hilo: false };
  if (a.servicios && j.pj === '6') { args.servicios = true; args.precio = 0; }                                  // Zubayda paga con servicios (R 10.7)
  else {
    if (a.hilo) { const c = OBJ.hiloDe(j); if (!c || precio > 15) return err('Necesitas un Hilo de alfombra y un tramo de tarifa 15 o menos.'); args.hilo = true; args.precio = 0; }
    else if (a.califa) { if (!j.extra.viajeCalifa) return err('No tienes viaje gratis del Califa.'); if (destino === 'Samarcanda') return err('No a Samarcanda.'); args.precio = 0; args.califa = true; }
    if (!args.hilo && !args.califa && precio > 0 && !puedeDinares(j, precio)) return err(`No te alcanzan los dinares (${precio}).`);
  }
  if (a.califa && !j.extra.viajeCalifa) return err('No tienes viaje gratis del Califa.');
  if (e.mods.huir?.[pid]) { /* la huida se resuelve en eventos: aquí no */ }
  if (EVE.salida(data, e, pid, args, 0)) return ok();
  return partir(data, e, pid, args);
}
const puedeDinares = (j, p) => j.dinares >= p;

export function partir(data, e, pid, args) {
  const t = e.turno, j = e.jugadores[pid];
  const origen = j.ciudad, destino = args.destino;
  if (args.precio > 0) { if (j.dinares < args.precio) { log(e, `${j.nombre} ya no puede pagar el viaje.`); return err('No te alcanzan los dinares.'); } j.dinares -= args.precio; }
  if (args.hilo) OBJ.gastarHilo(data, e, pid);
  if (args.califa) { j.extra.viajeCalifa = false; }
  t.tramos++; t.movio = true;
  const key = origen + '>' + destino;
  if (!e.caravanas.includes(key)) e.caravanas.push(key);                                                    // regla de la casa: primer viaje paga y crea la caravana (R 7.2)
  if (!e.caravanas.includes(destino + '>' + origen) && data.rutas.tarifas[destino + '>' + origen] !== undefined) e.caravanas.push(destino + '>' + origen);
  j.ciudad = destino;
  log(e, `${j.nombre} viaja de ${origen} a ${destino}${args.precio ? ` (${args.precio} dinares)` : ''}.`, { pid });
  if (args.servicios) PJ.apedreo(data, e, pid);
  return llegada(data, e, pid, origen);
}

export function viajarTransporte(data, e, pid, { destino, motivo = 'transporte', turnos = 1, consumeUid = null, jorasan = false }) {
  const t = e.turno, j = e.jugadores[pid];
  if (consumeUid) quitarCarta(j, consumeUid);
  j.transito = { destino, faltan: turnos, desde: j.ciudad, jorasan };
  t.movio = true; t.principal = true; t.fin = true;
  log(e, `${j.nombre} parte hacia ${jorasan ? 'el Jorasán' : destino} (${motivo}).`, { pid });
  return ok();
}

export function llegada(data, e, pid, origen) {
  const t = e.turno, j = e.jugadores[pid], c = ciudadDe(data, j.ciudad);
  const primera = !j.visitadas.includes(j.ciudad);
  const nadieAntes = !Object.values(e.jugadores).some((x) => x.visitadas.includes(j.ciudad));
  if (primera) j.visitadas.push(j.ciudad);
  if (nadieAntes && t) {
    for (const k of e.caravanas.slice()) { /* las caravanas de ida y vuelta ya existen por el primer viaje */ }
    const bagdad = data.rutas.tarifas[j.ciudad + '>Bagdad'] !== undefined;
    if (bagdad && !e.caravanas.includes(j.ciudad + '>Bagdad')) e.caravanas.push(j.ciudad + '>Bagdad');
    j.extra.viajeGratisBagdad = true;                                                                       // R 7.2: primer visitante, un viaje gratis a Bagdad
  }
  if (e.evento.actual === 'E4' && nadieAntes) j.extra.e4 = true;
  if (!t.llegadas.includes(j.ciudad) && j.ciudad !== j.ciudadPrevia) {                                      // R 8.2: no se ganan al volver a la ciudad que dejaste
    t.llegadas.push(j.ciudad);
    const mult = multiplicadorRonda(data, e.ronda, activos(e).length);
    let base = c.nochesLuego, bono = 0;
    if (c.nochesLlegada !== c.nochesLuego) { if (primera) bono = c.nochesLlegada - c.nochesLuego; } else base = c.nochesLlegada;   // Magreb 50/5, Andalucía 30/5
    let n = base * mult + bono;
    if (e.mods.cordoba && j.ciudad === 'Andalucía') n *= 2;
    j.noches += n;
    log(e, `${j.nombre} gana ${n} noches en ${j.ciudad} (x${mult}).`, { pid });
    if (e.evento.actual === 'E4' && nadieAntes) { j.noches += 20; log(e, `Peregrinación: ${j.nombre} gana 20 noches extra.`); }
  }
  PJ.alLlegar(data, e, pid, origen);
  RET.alLlegar(data, e, pid, origen);
  RET.mensajes(data, e, pid, 'llegada', { primera, origen });
  EVE.alLlegar(data, e, pid, origen, primera);
  const mazo = ['Bagdad', 'Isfahán', 'Aleppo', 'Damasco', 'Basra', 'El Cairo'].includes(j.ciudad) ? j.ciudad : c.mazoCC;
  if (!j.npc && t.cc < data.config.maxCCPorTurno && !j.eliminado) robarCC(data, e, pid, mazo);
  return ok();
}

// ---------------------------------------------------------------- cartas de cuentos
export function robarCC(data, e, pid, ciudad) {
  const t = e.turno, m = e.mazos;
  if (!m.cc[ciudad] || !m.cc[ciudad].length) { m.cc[ciudad] = barajar(e, (m.descarte.cc[ciudad] || []).splice(0)); }
  const c = m.cc[ciudad].shift();
  if (!c) return null;
  (m.descarte.cc[ciudad] ||= []).push(c);
  t.cc++;
  sacarCuento(data, e, pid, ciudad);                                                                          // R 19.7
  const tipo = c.k === 't' ? 'trivia' : 'mesa';
  const datos = cartaDatos(data, tipo, c.id);
  const ent = publicarCarta(e, datos, pid);
  t.ccActual = { tipo, id: c.id, nro: ent.nro };
  return t.ccActual;
}

// R 19.7: cada cuento de ambiente se saca una sola vez por partida; quien lo saca lo lee y cobra 2 dinares del banco. Ni NPC ni eliminados cobran.
export function sacarCuento(data, e, pid, clave) {
  const j = e.jugadores[pid];
  e.cuentosSacados ||= [];
  if (!j || j.eliminado || j.npc || e.cuentosSacados.includes(clave)) return null;
  const c = data.cuentos.cuentos.find((x) => x.clave === clave);
  if (!c) return null;
  e.cuentosSacados.push(clave);
  j.dinares += c.premio;
  const ent = publicarCarta(e, cartaDatos(data, 'cuento', c.id), pid);
  log(e, `${j.nombre} lee en voz alta «${c.titulo}» y recibe ${c.premio} dinares del banco.`, { pid });
  return ent;
}

function responderCC(data, e, pid, a) {
  const t = e.turno;
  if (!t || t.pid !== pid || !t.ccActual || t.ccActual.tipo !== 'trivia') return err('No hay trivia pendiente.');
  const tr = data.trivias.trivias.find((x) => x.id === t.ccActual.id);
  if (!(a.opcion >= 0 && a.opcion < tr.opciones.length)) return err('Opción inválida.');
  const acierto = a.opcion === tr.correcta;
  const ent = e.historial.find((h) => h.nro === t.ccActual.nro);
  if (ent) ent.resuelto = { elegida: a.opcion, correcta: tr.correcta, acierto, nota: tr.nota };      // CRP: la respuesta se publica SOLO ahora
  const j = e.jugadores[pid];
  if (acierto) { j.dinares += tr.premio; t.ccBien++; }
  log(e, `${j.nombre} ${acierto ? 'acierta la trivia (+' + tr.premio + ' dinares)' : 'falla la trivia'}.`, { pid });
  t.ccActual = null; if (ent) e.ultimaCarta = ent.nro;
  sacarCuento(data, e, pid, 'Respuestas');                                                                   // R 19.7
  if (acierto) RET.mensajes(data, e, pid, 'cc', { n: t.ccBien });
  RET.tras(data, e, pid, 'cc', { acierto });
  return ok();
}
function resolverMesa(data, e, pid, a) {
  const t = e.turno;
  if (!t || !t.ccActual || t.ccActual.tipo !== 'mesa') return err('No hay carta de mesa pendiente.');
  if (!esHost(e, pid) && t.pid !== pid) return err('Solo el jugador en turno o el anfitrión.');
  const j = e.jugadores[t.pid];
  if (a.ok) { j.dinares += data.config.premioTrivia; log(e, `${j.nombre} cumple la carta de mesa: +${data.config.premioTrivia} dinares.`); t.ccBien++; RET.mensajes(data, e, t.pid, 'cc', { n: t.ccBien }); }
  t.ccActual = null; return ok();
}

// ---------------------------------------------------------------- fin de turno
function terminarTurno(data, e, pid) {
  const t = e.turno, j = e.jugadores[pid];
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (t.ccActual) return err('Resuelve primero la carta de Cuentos (o sáltala).');
  RET.mensajes(data, e, pid, 'finTurno', {});
  if (!t.movio && !j.perdido && !t.omitido && !t.sinAlojamiento) {                                           // R 6.2 fase 5 / 8.2: alojamiento
    if (!t.primerTurnoBagdad || j.ciudad !== 'Bagdad') {
      const c = ciudadDe(data, j.ciudad); let costo = c.alojamiento * (j.pj === 'B' ? 2 : 1);
      if (e.mods.alojDoble?.includes(j.ciudad)) costo = c.alojamiento * 2 * (j.pj === 'B' ? 2 : 1);
      if (j.ciudad === 'El Cairo' && e.mods.niloAloj) costo = 10 * (j.pj === 'B' ? 2 : 1);
      costo = OBJ.sopa(data, e, pid, costo);
      const p = pagar(data, e, pid, costo);
      log(e, `${j.nombre} paga el alojamiento en ${j.ciudad}.`, { pid });
    }
  }
  if (j.mensaje && e.ronda > j.mensaje.turnoLimite) { e.mazos.descarte.mensajes.push(j.mensaje.id); j.mensaje = null; log(e, `${j.nombre} deja caducar su mensaje.`); }
  j.ciudadPrevia = t.movio ? t.ciudadInicio : j.ciudadPrevia;
  RET.finTurno(data, e, pid);
  t.fin = true;
  return ok();
}

// ---------------------------------------------------------------- tratos entre jugadores (R 8.6, 15.2)
function proponerTrato(data, e, pid, a) {
  const j = e.jugadores[pid], k = e.jugadores[a.con];
  if (!k || k.id === pid || k.eliminado || k.npc) return err('Destinatario inválido.');
  if (j.ciudad !== k.ciudad || j.transito || k.transito) return err('Deben estar en la misma ciudad (R 8.6).');
  if (e.mods.sinComercio?.[pid] || e.mods.sinComercio?.[a.con] || j.extra.sinComercioHasta >= e.ronda || k.extra.sinComercioHasta >= e.ronda) return err('Nadie quiere comerciar con esa persona (difamación).');
  const val = (x, de) => ({ dinares: Math.max(0, Math.floor(x?.dinares || 0)), objetos: (x?.objetos || []).filter((u) => de.mano.some((c) => c.uid === u && c.tipo !== 'especial' || c.uid === u && c.ref === 'F1')) });
  const id = 'tr' + (++e.seq);
  e.tratos[id] = { id, de: pid, con: a.con, ofrece: val(a.ofrece, j), pide: val(a.pide, k), t: e.ahora };
  return ok();
}
function responderTrato(data, e, pid, a) {
  const tr = e.tratos[a.id];
  if (!tr || tr.con !== pid) return err('Trato inexistente.');
  delete e.tratos[a.id];
  if (!a.ok) { log(e, `${e.jugadores[pid].nombre} rechaza un trato.`); return ok(); }
  const A = e.jugadores[tr.de], B = e.jugadores[tr.con];
  if (A.eliminado || B.eliminado) return err('El trato ya no es posible.');
  if (A.ciudad !== B.ciudad) return err('Ya no están en la misma ciudad.');
  if (A.dinares < tr.ofrece.dinares || B.dinares < tr.pide.dinares) return err('Faltan dinares para el trato.');
  if (!tr.ofrece.objetos.every((u) => A.mano.some((c) => c.uid === u)) || !tr.pide.objetos.every((u) => B.mano.some((c) => c.uid === u))) return err('Faltan objetos.');
  const sinImp = e.mods.feria || A.ciudad === 'Bagdad';
  const tasa = A.ciudad === 'Samarcanda' ? 50 : data.config.impuestoVentaPct;
  // casa (R 8.4): quien vende paga al banco el impuesto sobre el precio en dinares que cobra
  const imp = (de, din) => (sinImp || din <= 0 ? 0 : Math.floor(din * tasa / 100));
  const impA = tr.pide.objetos.length || tr.ofrece.objetos.length ? imp(A, tr.pide.dinares) : 0, impB = tr.ofrece.objetos.length || tr.pide.objetos.length ? imp(B, tr.ofrece.dinares) : 0;
  A.dinares += tr.pide.dinares - impA - tr.ofrece.dinares; B.dinares += tr.ofrece.dinares - impB - tr.pide.dinares;
  const mover = (de, a2, uids) => { for (const u of uids) { const c = quitarCarta(de, u); if (c) { a2.mano.push(c); } } };
  const movA = tr.ofrece.objetos.map((u) => A.mano.find((c) => c.uid === u)).filter(Boolean), movB = tr.pide.objetos.map((u) => B.mano.find((c) => c.uid === u)).filter(Boolean);
  mover(A, B, tr.ofrece.objetos); mover(B, A, tr.pide.objetos);
  recortarMano(data, e, A.id); recortarMano(data, e, B.id);
  if (e.mods.feria && e.mods.feriaVentas !== false) { if (movA.length) A.dinares += 5; if (movB.length) B.dinares += 5; }     // E12: +5 del banco a quien vende un objeto
  log(e, `${A.nombre} y ${B.nombre} cierran un trato.`);
  RET.mensajes(data, e, A.id, 'trato', { dio: movA, recibio: movB, con: B.id });
  RET.mensajes(data, e, B.id, 'trato', { dio: movB, recibio: movA, con: A.id });
  RET.tras(data, e, A.id, 'trato', { movA, movB, con: B.id });
  return ok();
}

// ---------------------------------------------------------------- anfitrión / banco
function hostDar(e, a) {
  const j = e.jugadores[a.pid]; if (!j) return err('Jugador inexistente.');
  j.dinares += Math.floor(a.dinares || 0); j.noches += Math.floor(a.noches || 0);
  log(e, `Banco: ${j.nombre} recibe ${a.dinares || 0} dinares y ${a.noches || 0} noches.`); return ok();
}
function hostCorregir(e, a) {
  const j = e.jugadores[a.pid]; if (!j) return err('Jugador inexistente.');
  if (['dinares', 'noches', 'escondido', 'buscado'].includes(a.campo)) j[a.campo] = Math.max(0, Math.floor(a.valor));
  else if (['herido', 'perdido', 'destreza'].includes(a.campo)) j[a.campo] = !!a.valor;
  else if (a.campo === 'ciudad') { if (!ciudadDe({ ciudades: { ciudades: [] } }, 'x') && false) return err('x'); j.ciudad = String(a.valor); }
  else return err('Campo no corregible.');
  log(e, `Banco corrige ${a.campo} de ${j.nombre}.`); return ok();
}
function hostRepartir(data, e, a) {
  const j = e.jugadores[a.pid]; if (!j) return err('Jugador inexistente.');
  if (a.mazo === 'objeto') {
    if (!(e.stock[a.id] > 0)) return err('Sin existencias.');
    e.stock[a.id]--; j.mano.push({ uid: uid(e), tipo: 'objeto', ref: a.id });
    publicarCarta(e, cartaDatos(data, 'objeto', a.id), a.pid, [a.pid]); recortarMano(data, e, a.pid);
  } else if (a.mazo === 'botin') {
    const c = OBJ.robarBotinPublico(data, e, a.pid); if (!c) return err('El Botín está vacío.');
  } else if (a.mazo === 'mensaje') {
    if (j.mensaje) return err('Ese jugador ya tiene un mensaje activo (solo uno a la vez).');
    const id = robar(e, 'mensajes'); if (!id) return err('No quedan mensajes: cada uno sale una sola vez por partida.');
    j.mensaje = { id, turnoLimite: e.ronda + 3 }; publicarCarta(e, cartaDatos(data, 'mensaje', id), a.pid, [a.pid]);
  } else return err('Mazo no repartible.');
  log(e, `Banco reparte una carta a ${j.nombre}.`); return ok();
}
function hostBarajar(e, a) {
  if (!e.mazos) return err('No hay mazos.');
  const m = a.mazo;
  if (['eventos', 'historicos', 'botin', 'ifrit'].includes(m)) { e.mazos[m] = barajar(e, e.mazos[m].concat(e.mazos.descarte[m] ? e.mazos.descarte[m].splice(0) : [])); }
  else if (m === 'mensajes') { barajar(e, e.mazos.mensajes); }
  else return err('Mazo inválido.');
  log(e, `Banco baraja el mazo ${m}.`); return ok();
}
function hostRevelar(data, e, a) {
  const tipo = a.mazo; if (!['evento', 'historico'].includes(tipo)) return err('Mazo inválido.');
  const id = robar(e, tipo === 'evento' ? 'eventos' : 'historicos'); if (!id) return err('Mazo vacío.');
  e.mazos.descarte[tipo === 'evento' ? 'eventos' : 'historicos'].push(id);
  publicarCarta(e, cartaDatos(data, tipo, id), null); return ok();
}

// ---------------------------------------------------------------- acciones disponibles para el jugador (guía para la interfaz y para los bots)
export function acciones(data, e, pid) {
  const t = e.turno, j = e.jugadores[pid];
  if (!j || e.fase !== 'juego' || !t || t.pid !== pid || e.pend || j.eliminado) return [];
  if (t.fase === 'ingreso') return [{ k: 'tirarDados', titulo: 'Tirar el dado de ingreso' }];
  const r = [];
  if (t.ccActual) r.push({ k: 'cc', titulo: 'Resolver la carta de Cuentos' });
  if (t.fin || t.omitido) { r.push({ k: 'terminarTurno', titulo: 'Terminar el turno' }); return r; }
  if (j.perdido) { r.push({ k: 'tesoro', sub: 'salir', titulo: 'Intentar salir del Jorasán' }); r.push({ k: 'terminarTurno', titulo: 'Terminar el turno' }); return r; }
  if (!t.ccActual && t.tramos < data.config.maxTramosPorTurno && !j.transito) {
    const destinos = Object.keys(data.rutas.tarifas).filter((k) => k.startsWith(j.ciudad + '>')).map((k) => k.split('>')[1])
      .filter((d) => tarifa(data, e, j, j.ciudad, d) !== null && !(e.sinCaravanasBagdad && j.ciudad === 'Bagdad'));
    for (const d of destinos) r.push({ k: 'viajar', destino: d, precio: tarifa(data, e, j, j.ciudad, d) });
  }
  if (!t.principal && !t.ccActual) {
    const objetivos = activos(e).filter((x) => x !== pid && e.jugadores[x].ciudad === j.ciudad && !e.jugadores[x].transito);
    for (const tipo of ['robo', 'matar', 'duelo']) {
      const ob = objetivos.filter((x) => validarAtaque(data, e, pid, { tipo, objetivo: x }).ok);
      if (ob.length) r.push({ k: 'atacar', tipo, objetivos: ob });
    }
    for (const x of RET.disponibles(data, e, pid)) r.push(x);
    for (const x of TES.disponibles(data, e, pid)) r.push(x);
    for (const x of NPC.disponibles(data, e, pid)) r.push(x);
    for (const x of PJ.disponibles(data, e, pid)) r.push(x);
  }
  for (const x of OBJ.disponibles(data, e, pid)) r.push(x);
  r.push({ k: 'terminarTurno', titulo: 'Terminar el turno' });
  return r;
}

// ---------------------------------------------------------------- vista filtrada por jugador (PRIVACIDAD en el servidor)
const manoPublica = (j) => j.mano.reduce((m, c) => { m[c.tipo] = (m[c.tipo] || 0) + 1; return m; }, {});   // casa: el NÚMERO de cartas por tipo es público

function datosMano(data, e, c) {
  if (c.tipo === 'especial') { const s = data.objetos.especiales.find((x) => x.id === c.ref); return { id: c.ref, deck: 'especial', titulo: s.nombre, sub: 'Carta especial', texto: c.ref === 'F1' ? 'Permite portar y usar arco y jambiya en Bagdad, desafiar y robar allí (R 15.3).' : c.ref === 'K1' ? '+2 a tus dados en cualquier pelea y no te pueden desafiar a duelo (R 15.5).' : s.nombre, arte: s.arte, ref: s.refReglamento }; }
  if (c.tipo === 'item') {
    const d = itemDatos(data, c.ref, c.extra || {});
    if (d && esLibro(c)) { d.valor = valorLibro(data, e, c); d.texto += ` Valor actual: ${d.valor} dinares.`; }
    if (d && c.ref === 'vino') { d.valor = valorVino(c, e); d.texto += ` Valor actual: ${d.valor} dinares.`; }
    return d;
  }
  if (c.tipo === 'ifrit') return cartaDatos(data, 'ifrit', c.ref);
  return cartaDatos(data, c.tipo, c.ref);
}

export function vista(data, e, pid) {
  const yo = e.jugadores[pid];
  const jugadores = {};
  for (const id of Object.keys(e.jugadores)) {
    const j = e.jugadores[id];
    jugadores[id] = { id, nombre: j.nombre, pj: j.pj, listo: j.listo, conectado: j.conectado, dinares: j.dinares, noches: j.noches, ciudad: j.ciudad, herido: j.herido, perdido: j.perdido, npc: !!j.npc,
      buscado: j.buscado, eliminado: j.eliminado, destreza: j.destreza, nMano: manoPublica(j), tieneMensaje: !!j.mensaje, transito: j.transito ? { faltan: j.transito.faltan } : null,
      kanmakan: !!tieneEsp(j, 'K1'), retosHechos: j.retosHechos.length, bajoTecho: !!j.extra.bajoTecho, escondido: id === pid ? j.escondido : undefined };
  }
  const t = e.turno && { pid: e.turno.pid, fase: e.turno.fase, tramos: e.turno.tramos, movio: e.turno.movio, cc: e.turno.cc, ciudadInicio: e.turno.ciudadInicio, principal: e.turno.principal, heridoAhora: !!e.turno.heridoAhora, fin: !!e.turno.fin,
    ccActual: e.turno.ccActual ? { tipo: e.turno.ccActual.tipo, nro: e.turno.ccActual.nro, descartada: e.turno.ccActual.descartada ?? null } : null };
  const historial = e.historial.filter((h) => !h.para || h.para.includes(pid)).slice(-120).map((h) => {
    const { resuelto, ...resto } = h;
    return h.deck === 'trivia' && !resuelto ? resto : h;                      // sin 'resuelto' = sin respuesta
  });
  const esAnf = e.host === pid;
  const p = e.pend;
  const pend = p && { id: p.id, tipo: p.tipo, titulo: p.titulo, texto: p.texto, modo: p.modo, para: p.para, min: p.min, max: p.max, t0: p.t0, limiteMs: p.limiteMs ?? e.opciones?.limitePendMs ?? 90000,
    opciones: p.para.includes(pid) ? p.opciones : [], respondiste: !!p.resp[pid], faltan: p.para.filter((x) => !p.resp[x]), mia: p.para.includes(pid) };
  return {
    v: e.v, codigo: e.codigo, yo: pid, fase: e.fase, ronda: e.ronda, ahora: e.ahora, host: e.host, soyHost: esAnf, hostConectado: e.jugadores[e.host]?.conectado ?? false,
    orden: e.orden, mult: e.ronda ? multiplicadorRonda(data, e.ronda, e.orden.length) : 1, jugadores, turno: t, dados: e.dados, enCola: (e.colaDados || []).length, ultimaCarta: e.ultimaCarta, historial, log: e.log.slice(-80).map(({ t: tt, texto, pid: p2 }) => ({ t: tt, texto, pid: p2 })),
    caravanas: e.caravanas, ganadores: e.ganadores, derrota: e.derrota, sinCaravanasBagdad: e.sinCaravanasBagdad, evento: e.evento, mods: publicMods(e), solitario: e.solitario, opciones: { dificultad: e.opciones.dificultad },
    pend, acciones: acciones(data, e, pid),
    mano: yo ? yo.mano.map((c) => ({ ...c, datos: datosMano(data, e, c), venta: OBJ.estimarVenta(data, e, pid, c) })) : [],
    tienda: OBJ.tienda(data, e, pid),
    misiones: yo ? RET.misionesVista(data, e, pid) : [], retosHechos: yo ? yo.retosHechos : [],
    mensaje: yo?.mensaje || null,
    tratos: Object.values(e.tratos).filter((x) => x.de === pid || x.con === pid),
    asesinos: { actuaron: e.asesinos.actuaron }, kanmakan: { dueno: e.kanmakan.dueno, usada: e.kanmakan.usada }, firmanesLibres: e.firmanes,
    host_info: esAnf ? { pinHost: e.pinHost, stock: e.stock, mazos: { eventos: e.mazos?.eventos.length, historicos: e.mazos?.historicos.length, mensajes: e.mazos?.mensajes.length, botin: e.mazos?.botin.length, ifrit: e.mazos?.ifrit.length } } : undefined,
    stockPublico: e.stock,
  };
}
const publicMods = (e) => { const { sinIngreso, varado, huir, ...r } = e.mods || {}; return r; };

// ---------------------------------------------------------------- reloj del servidor (cada segundo)
export function tick(data, e, ahora = Date.now()) {
  e.ahora = ahora;
  let cambio = false;
  if (e.dados && ahora - e.dados.t0 > AUTOCIERRE_DADOS_MS) { siguienteDados(e); cambio = true; }
  if (e.fase === 'juego') {
    if (e.pend && vencerPend(data, e, ahora)) cambio = true;
    const antes = e.turno?.pid + ':' + e.ronda + ':' + (e.pend?.id || '');
    avanzar(data, e);
    if (antes !== e.turno?.pid + ':' + e.ronda + ':' + (e.pend?.id || '')) cambio = true;
  }
  return cambio;
}

// ---------------------------------------------------------------- persistencia (R guardado automático)
export function serializar(e) { return JSON.stringify(e); }
export function restaurar(txt) { return migrar(JSON.parse(txt)); }
export function migrar(e) {
  if ((e.v || 1) >= VERSION_ESTADO) return e;
  e.v = VERSION_ESTADO;
  e.colaDados ||= []; e.colaPend ||= []; e.pend ||= null; e.pelea ||= null; e.mods ||= {}; e.opciones ||= { dificultad: 'normal', rapido: false };
  e.asesinos ||= { actuaron: false, contrato: null }; e.firmanes ??= 3; e.kanmakan ||= { dueno: null, usada: false }; e.tesoros ||= {}; e.derrota ||= null;
  if (e.mazos) { e.mazos.botin ||= []; e.mazos.ifrit ||= []; e.mazos.descarte.botin ||= []; e.mazos.descarte.ifrit ||= []; }
  for (const j of Object.values(e.jugadores)) { j.misiones ||= []; j.destreza ??= false; j.turnos ??= 0; j.transito ??= null; j.ventajaCombate ??= 0; j.extra ||= {}; j.retosHechos ||= []; }
  return e;
}

// ---------------------------------------------------------------- enlaces para los demás módulos
HOOK.nuevoJugador = nuevoJugador; HOOK.partir = partir; HOOK.llegada = llegada; HOOK.siguienteTurno = (data, e) => siguienteTurno(data, e, e.turno ? e.turno.idx : -1); HOOK.viajarTransporte = viajarTransporte; HOOK.robarCC = robarCC;
HOOK.darMensaje = darMensaje; HOOK.avanzar = avanzar; HOOK.multiplicador = multiplicadorRonda; HOOK.sacarCuento = sacarCuento;
