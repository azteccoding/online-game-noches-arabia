// Motor de reglas AUTORITATIVO de «Mil y una Noches». Código puro (sin DOM, sin APIs de Node):
// lo usan el servidor (server/index.js) y el adaptador demo del navegador (src/game/adapters/localAdapter.js).
// Los datos (JSON de src/data) se INYECTAN: nuevoJuego(data, ...), reducir(data, ...), vista(data, ...).
// Referencias al reglamento: «R 7.3» = sección 7.3 del reglamento extendido.
// Módulos: base (utilidades, decisiones, dados), pelea (R 11-12), objetos (R 15), retos (R 14), tesoros (R 16), eventos (R 17),
// npc (R 13, 20, 21), personajes (R 10).
import {
  VERSION_ESTADO, MIN_LECTURA_MS, MIN_DADOS_MS, AUTOCIERRE_DADOS_MS, rnd, dado, dados, suma, barajar, clone, ok, err, ciudadDe, pjDe, objDe, activos, humanosVivos, enCiudad, nombre, log,
  cartaDatos, itemDatos, publicarCarta, robar, siguienteDados, bloqueado, responderPend, vencerPend, tieneItem, tieneEsp, uid, darItem, quitarCarta, recortarMano, pagar, patrimonio,
  eliminar, HOOK, tarifa, mostrarDados, esLibro, valorLibro, valorVino, mostrarDados as _md, CONT, registrar,
textoBuscado,
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
    visitadas: [], mano: [], herido: false, perdido: false, buscado: 0, eliminado: false, escondido: 0, mensajes: [], retosHechos: [], misiones: [], destreza: false, turnos: 0,
    transito: null, ventajaCombate: 0, extra: {} };
}
export function unir(e, { nombre: nom, token }) {
  const id = 'j' + (++e.seq);
  e.jugadores[id] = nuevoJugador(e, id, nom, token);
  e.orden.push(id);
  if (!e.host) e.host = id;
  return id;
}
// Regla de la casa: en la sala, el banco es el primero que eligió personaje, está conectado y marcó «listo». Hasta entonces lo es, de manera
// provisional, quien entró primero. Si alguien cede el banco o lo reclama con el PIN, esa decisión se respeta.
function bancoDeSala(e) {
  if (e.fase !== 'lobby' || e.bancoFijo) return;
  const c = Object.values(e.jugadores).filter((j) => j.pj && j.listo && j.conectado !== false).sort((a, b) => (a.listoEn || 0) - (b.listoEn || 0))[0];
  if (c) e.host = c.id;
}
// Regla de la casa: con todos conectados y listos arranca una cuenta regresiva; el banco también puede iniciar antes, a mano.
const CUENTA_INICIO_MS = 10000;
function salaLista(e) {
  const js = Object.values(e.jugadores).filter((j) => !j.npc && j.conectado !== false);
  if (!js.length || !js.every((j) => j.pj && j.listo)) return false;
  const conPj = Object.values(e.jugadores).filter((j) => j.pj);
  if (!conPj.every((j) => j.listo && j.conectado !== false) || conPj.length > 8) return false;
  return conPj.length < 4 || conPj.some((j) => j.pj === 'B');
}
// Qué falta para que arranque la cuenta regresiva (se muestra en la sala).
function faltaParaIniciar(e) {
  const r = [];
  for (const j of Object.values(e.jugadores)) {
    if (j.npc) continue;
    if (j.conectado === false) { if (j.pj) r.push(`${j.nombre} (desconectado)`); continue; }
    if (!j.pj) r.push(`${j.nombre} (sin personaje)`); else if (!j.listo) r.push(`${j.nombre} (no está listo)`);
  }
  const conPj = Object.values(e.jugadores).filter((j) => j.pj);
  if (conPj.length >= 4 && !conPj.some((j) => j.pj === 'B')) r.push('alguien que juegue con Yafar el Bermekí (con 4 o más jugadores)');
  return r;
}
// Regla de la casa: se puede entrar tarde mientras no termine la primera ronda.
export const puedeUnirse = (e) => e.fase === 'juego' && e.ronda === 1 && Object.values(e.jugadores).filter((j) => j.pj).length < 8;
export function unirTarde(e, { nombre: nom, token }) {
  const id = 'j' + (++e.seq);
  e.jugadores[id] = { ...nuevoJugador(e, id, nom, token), tarde: true };           // aún no está en el orden: entra cuando elige personaje
  return id;
}
function incorporarTarde(data, e, pid) {
  const j = e.jugadores[pid], p = pjDe(data, j.pj);
  if (!puedeUnirse(e)) return err('La primera ronda ya terminó: ya no se puede entrar a esta partida.');
  j.dinares = p.inicio.dinares; j.noches = p.inicio.noches || 0; j.ciudad = 'Bagdad'; j.visitadas = ['Bagdad']; j.ciudadPrevia = null; j.destreza = !!p.destreza;
  for (const arma of p.arma || []) j.mano.push({ uid: uid(e), tipo: 'item', ref: arma });
  if (p.inicio.firman) { j.mano.push({ uid: uid(e), tipo: 'especial', ref: 'F1' }); e.firmanes--; }
  j.tarde = false; j.listo = true;
  e.orden = yafarAlFinal(e, [...e.orden.filter((x) => x !== pid), pid]);
  if (e.turno) e.turno.idx = e.orden.indexOf(e.turno.pid);
  e.participantes = (e.participantes || 0) + 1; e.solitario = false;
  if (j.pj !== 'B') e.burros = (e.burros || 0) + 1;
  log(e, `${j.nombre} se une a la partida con ${p.nombre}: jugará al final de esta ronda.`, { pid, aviso: true });
  return ok();
}
export function conexion(e, pid, conectado) {
  const j = e.jugadores[pid];
  if (j && e.fase === 'juego' && !j.npc && !j.eliminado && j.conectado !== conectado) {   // aviso a todos: se desconectó / volvió
    const esperando = !conectado && e.turno?.pid === pid;
    log(e, conectado ? `${j.nombre} volvió a la partida.` : `⚠ ${j.nombre} se desconectó${esperando ? ': es su turno y la partida lo está esperando' : ''}.`, { aviso: true, pid });
  }
  if (j) j.conectado = conectado;
  if (j && conectado) volver(e, pid);
  bancoDeSala(e);
  if (!conectado && e.host === pid && e.cajaAbierta) { e.cajaAbierta = false; log(e, `Se cerró la caja del banco (${e.jugadores[pid].nombre} se desconectó).`, { caja: true }); }
}

// ---------------------------------------------------------------- mazos
function prepararMazos(data, e) {
  const cc = {};
  for (const t of data.trivias.trivias) (cc[t.ciudad] ||= []).push({ k: 't', id: t.id });
  if (data.config.cartasDeMesa !== false) for (const t of data.trivias.deMesa) (cc[t.ciudad] ||= []).push({ k: 'm', id: t.id });
  for (const c of Object.keys(cc)) barajar(e, cc[c]);
  const botin = [], guardadas = [];
  e.stock = {};
  for (const o of data.objetos.mazo) {                                                                       // R 15.2: Botín 47 cartas, Mercado 89
    if (o.sinVenta) for (let i = 0; i < o.copias; i++) botin.push(o.id); else { botin.push(o.id); e.stock[o.id] = Math.max(1, o.copias - 2); for (let i = e.stock[o.id]; i < o.copias - 1; i++) guardadas.push(o.id); }
  }
  // Escasez (regla de la casa): el mercado empieza con copias − 2 de cada objeto; las demás copias siguen en el juego y van saliendo, con lo vendido, al empezar cada ronda.
  e.reposicion = barajar(e, guardadas);
  e.mazos = {
    eventos: barajar(e, data.eventos.eventos.filter((x) => !x.carrera).map((x) => x.id)), historicos: barajar(e, data.eventos.historicos.map((x) => x.id)),
    mensajes: barajar(e, data.mensajes.mensajes.map((x) => x.id)), cc, botin: barajar(e, botin), ifrit: barajar(e, data.objetos.ifrit.cartas.map((c) => c.id)),
    descarte: { eventos: [], historicos: [], mensajes: [] /* Mensajes fuera de juego: registro, nunca se barajan de nuevo */, botin: [], ifrit: [], cc: {} },
  };
  e.cuentosSacados = [];
}

// Escasez (regla de la casa): lo vendido o gastado no vuelve al mercado al instante; al empezar cada ronda regresan unos pocos objetos.
function reponerMercado(data, e) {
  const n = data.objetos.escasez?.reposicionPorRonda ?? 2;
  const vuelven = (e.reposicion ||= []).splice(0, n);
  for (const id of vuelven) e.stock[id] = (e.stock[id] || 0) + 1;
  if (vuelven.length) log(e, `Vuelven al mercado: ${vuelven.map((id) => objDe(data, id)?.nombre || id).join(', ')}.`);
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
  if (pos('7') >= 0) { const [a] = orden.splice(pos('7'), 1); orden.push(a); }                       // R 4.4: Adí siempre último (solo Yafar va después)
  if (orden.length > 1 && e.jugadores[orden[orden.length - 1]].pj === '5') {                           // Ruyán nunca el último
    const n = orden.length; [orden[n - 1], orden[n - 2]] = [orden[n - 2], orden[n - 1]];
  }
  const sinNPC = orden.slice();
  const conNPC = !conB && !(e.opciones.sinYafar && ids.length < 4);
  if (conNPC) {                                                                                      // Yafar NPC (R 20.4, 21)
    const id = 'npc'; e.jugadores[id] = { ...nuevoJugador(e, id, 'Yafar el Bermekí (NPC)', null), pj: 'B', listo: true, npc: true };
    orden.push(id);
  }
  orden = yafarAlFinal(e, orden);
  e.solitario = ids.length === 1 && conNPC;
  e.participantes = ids.length + (conNPC ? 1 : 0);
  e.burros = Math.max(0, ids.filter((id) => e.jugadores[id].pj !== 'B').length - 1);          // regla de la casa: N − 1 burros (Yafar no cuenta)
  // Regla de la casa: cada carrera de «dos noches» sale una sola vez, en una ronda al azar entre la 3 y la 12 (sin coincidir).
  const rondas = barajar(e, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  e.carreras = Object.fromEntries(data.eventos.eventos.filter((x) => x.carrera).map((x, k) => [x.id, rondas[k]])); e.carrerasActivas = [];                                                     // para la regla del último en pie
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
  log(e, e.solitario ? 'Empieza el modo solitario contra Yafar NPC.' : !conB && !conNPC ? 'Empieza la partida sin Yafar NPC.' : 'Empieza la partida.');
  return empezarRonda(data, e);
}

// Regla de la casa: Yafar (jugador o NPC) siempre juega el último de cada ronda; Adí, justo antes que él.
function yafarAlFinal(e, orden) {
  const esB = (i) => e.jugadores[i]?.pj === 'B';
  return orden.filter((i) => !esB(i)).concat(orden.filter(esB));
}

function empezarRonda(data, e) {
  e.orden = yafarAlFinal(e, e.orden);                                                             // también en partidas guardadas con el orden viejo
  e.ronda++;
  reponerMercado(data, e);
  e.mods = {}; e.sinCaravanasBagdad = false;
  e.evento = { actual: null, historico: null, buscadoE7: e.evento?.buscadoE7 && e.evento.rondaE7 === e.ronda - 1 ? null : null };
  const act = activos(e);
  let evId = robar(e, 'eventos');
  // R 13.4: E1 no sale antes de la ronda 3. Regla de la casa: tampoco antes de que algún jugador (que no sea Yafar) haya ido a Samarcanda.
  const conocen = (x) => Object.values(e.jugadores).some((j) => j.pj && j.pj !== 'B' && !j.npc && (j.visitadas || []).includes('Samarcanda'));
  if (evId === 'E1' && e.ronda >= 3 && !e.asesinos.actuaron && !conocen()) log(e, 'Los Asesinos aún no conocen a nadie: hasta que un jugador vaya a Samarcanda no ofrecerán sus servicios. La carta vuelve al mazo.', { aviso: true });
  if (evId === 'E1' && (e.ronda < 3 || e.asesinos.actuaron || !conocen())) {
    e.mazos.eventos.push(evId); barajar(e, e.mazos.eventos); evId = robar(e, 'eventos'); if (evId === 'E1') { e.mazos.eventos.push(evId); evId = robar(e, 'eventos'); if (evId === 'E1') evId = null; }
  }
  e.paso = 'eventos';
  for (const [id, r] of Object.entries(e.carreras || {})) if (r === e.ronda) {                           // carrera de «dos noches» de esta ronda
    const def = data.eventos.eventos.find((x) => x.id === id);
    (e.carrerasActivas ||= []).push({ id, ciudad: def.carrera, prog: {} });
    publicarCarta(e, cartaDatos(data, 'evento', id), null);
    log(e, `Carrera en la mesa: el primero que pase dos noches seguidas en ${def.carrera} gana 60 dinares y 50 noches.`, { aviso: true });
  }
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

// Regla de la casa: si un jugador no tira su dado en 60 segundos, el banco decide sacarlo o esperarlo; nunca se tira por él.
// Sacado, pierde ese turno y no juega hasta que vuelva; entonces su turno pasa al final del orden.
const ESPERA_SACAR_MS = 60000;
export function esperaDado(e) {
  if (e.fase !== 'juego' || e.pend) return null;
  const d = e.dados, t = e.turno;
  if (d) return !d.lanzado && !d.npc && e.jugadores[d.por] && !e.jugadores[d.por].npc ? { pid: d.por, desde: d.t0 } : null;
  return t && t.fase === 'ingreso' && !e.jugadores[t.pid]?.npc ? { pid: t.pid, desde: t.t0 ?? e.ahora } : null;
}
const sacable = (e, x = esperaDado(e)) => !!x && e.ahora - x.desde >= ESPERA_SACAR_MS;
const pierdeSuTurno = (e, id) => {
  const j = e.jugadores[id];
  if (j.npc || !(j.sacado || j.extra.turnoPerdido === e.ronda)) return false;
  return humanosVivos(e).some((x) => !e.jugadores[x].sacado);                    // si no queda nadie más, la partida no da vueltas sola
};
function alFinalDelOrden(e, pid) {
  const t = e.turno, i = e.orden.indexOf(pid);
  e.orden = yafarAlFinal(e, [...e.orden.filter((x) => x !== pid), pid]);
  if (t) t.idx = t.pid === pid ? i - 1 : e.orden.indexOf(t.pid);                 // quien sigue es quien venía después de él
}
function sacarDelTurno(e, pid) {
  const j = e.jugadores[pid], t = e.turno;
  j.sacado = true; j.extra.turnoPerdido = e.ronda;
  log(e, `El banco saca a ${j.nombre} por no tirar su dado: pierde este turno y, cuando vuelva, jugará al final del orden.`, { pid, aviso: true });
  if (t?.pid === pid) { e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.pelea = null; t.fin = true; }
  else for (const d of [e.dados, ...(e.colaDados || [])]) if (d?.por === pid && !d.lanzado) { d.lanzado = true; d.t0 = e.ahora; }   // estos dados ya estaban decididos: solo se destapan para que la pelea termine
  alFinalDelOrden(e, pid);
  return ok();
}
function volver(e, pid) {
  const j = e.jugadores[pid];
  if (!j?.sacado) return ok();
  j.sacado = false; alFinalDelOrden(e, pid);
  log(e, `${j.nombre} vuelve a la partida: su turno pasa al final del orden.`, { pid, aviso: true });
  return ok();
}

function siguienteTurno(data, e, desde) {
  if (e.turno) { NPC.revisarEncargo(data, e, e.turno.pid); carreraFinTurno(data, e); OBJ.animalesFinTurno(data, e, e.turno.pid); hazanasFinTurno(data, e); }
  if (e.turno && e.asesinos?.pendiente?.victima === e.turno.pid) { NPC.actuanAsesinos(data, e); if (e.fase !== 'juego') return ok(); }   // los Asesinos actúan al cerrar el turno de su víctima
  let idx = desde;
  for (;;) {
    idx++;
    if (idx >= e.orden.length) { e.turno = null; return cierreRonda(data, e); }
    const id = e.orden[idx];
    if (!e.jugadores[id].eliminado && !pierdeSuTurno(e, id)) { iniciarTurno(data, e, id, idx); return ok(); }
  }
}

function cierreRonda(data, e) {
  for (const id of activos(e)) NPC.revisarEncargo(data, e, id);
  EVE.finRonda(data, e);
  NPC.finRonda(data, e);
  for (const id of activos(e)) { const j = e.jugadores[id]; if (j.buscado > 0) j.buscado--; if (j.extra.bajoTecho && j.extra.techoRonda !== e.ronda) j.extra.bajoTecho = false; }
  topeNoches(e, data.config.meta);
  const ganan = activos(e).filter((id) => e.jugadores[id].noches >= data.config.meta);                         // R 2.3, 2.4, 20.6 (regla de la casa: solo cuentan las noches)
  if (ganan.length) {
    const npcId = ganan.find((id) => e.jugadores[id].npc);
    const hum = ganan.filter((id) => !e.jugadores[id].npc);
    if (npcId && !hum.length) { e.fase = 'fin'; e.ganadores = []; e.derrota = 'npc'; e.turno = null; log(e, 'Yafar NPC llega primero a las 1,001 noches: los jugadores pierden.'); return ok(); }
    if (npcId && Math.max(...hum.map((id) => e.jugadores[id].noches)) < e.jugadores[npcId].noches) {                  // R 2.4: si ambos llegan, gana quien tenga más noches; empate: ganan los jugadores
      e.fase = 'fin'; e.ganadores = []; e.derrota = 'npc'; e.turno = null; log(e, 'Yafar NPC llega a las 1,001 noches con más noches que los jugadores: los jugadores pierden.'); return ok();
    }
    const g = hum;
    e.fase = 'fin'; e.ganadores = g; e.turno = null;
    log(e, 'Fin de la partida: ' + g.map((i) => e.jugadores[i].nombre).join(', ') + (g.length > 1 ? ' alcanzan' : ' alcanza') + ' las 1,001 noches.');
    return ok();
  }
  const hv = humanosVivos(e);                                                                                // R 22.4: último jugador en pie
  if (!hv.length) { e.fase = 'fin'; e.ganadores = []; e.derrota = 'muerte'; log(e, 'No queda ningún jugador con vida.'); return ok(); }
  if (hv.length === 1 && e.jugadores.npc && !e.solitario && activos(e).length === 2) e.solitario = true;
  return empezarRonda(data, e);
}

function iniciarTurno(data, e, id, idx) {
  const j = e.jugadores[id], p = pjDe(data, j.pj);
  j.extra.descuentos = null;                                                // los descuentos de entrenar duran hasta tu siguiente turno
  const t = e.turno = { pid: id, idx, t0: e.ahora, fase: 'ingreso', tramos: 0, ciudadInicio: j.ciudad, movio: false, llegadas: [], cc: 0, ccBien: 0, ccActual: null, principal: false, primerTurnoBagdad: !j.extra.jugoTurno, npc: !!j.npc, gastos: {} };
  j.extra.jugoTurno = true; j.turnos++;
  if (j.extra.bajoTecho) j.extra.bajoTecho = false;
  if (j.herido) { t.heridoAhora = true; t.principal = true; j.herido = false; log(e, `${j.nombre} se recupera de su herida: este turno no tiene acción principal (no puede iniciar retos, robar, desafiar ni buscar tesoros).`, { pid: id }); }
  if (j.extra.sinPrincipal) { t.principal = true; j.extra.sinPrincipal = false; t.sinPrincipalMotivo = true; }
  if (j.pierdeTurno > 0) { j.pierdeTurno--; t.fase = 'mov'; t.principal = true; t.omitido = true; }
  let ing = p.inicio.ingreso + (data.config.equilibrio?.ingresoExtra?.[j.pj] || 0);   // equilibrio: config.json
  if (e.mods.sinIngreso?.[id]) ing = 0;
  j.dinares += ing;
  if (j.pj === '4') j.noches += 5;                                                                       // Jamil: +5 noches por turno (R 10.6)
  const esclavas = j.mano.filter((c) => c.tipo === 'item' && c.ref === 'esclava');
  for (const c of esclavas) { if (j.dinares >= 1) j.dinares -= 1; j.noches += 5; }
  OBJ.animalesInicioTurno(data, e, id);                                                                   // albéitar y comida de los animales
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
    if (tr.jorasan) { j.perdido = true; j.ciudad = 'Jorasán'; j.noches += NOCHES_JORASAN; log(e, `${j.nombre} llega al Jorasán (+${NOCHES_JORASAN} noches) y está perdido.`, { pid: id }); }
    else llegada(data, e, id, tr.desde);
  }
  if (j.npc) t.fase = 'mov';
}

// Carreras de «dos noches»: cuenta los turnos seguidos que cada jugador cierra hospedado (sin moverse) en la ciudad de la carrera.
// Noches extra (regla de la casa, no se multiplican por ronda). Las hazañas valen hasta 2 veces en cada turno del jugador
// (config.equilibrio.hazanas) y, con el freno, tras cobrar una no vuelve a valer hasta que termine un turno fuera de su par de ciudades.
const NOCHES_JORASAN = 50;
export const HAZANAS = { quds: { nombre: 'Visitar al-Quds', noches: 40, par: ['El Cairo', 'Damasco'] }, tariq: { nombre: 'Hazaña de Tariq ibn Ziyad', noches: 60, par: ['Magreb', 'Andalucía'] } };
const confHazanas = (data) => ({ max: 2, por: 'turno', freno: true, ...(data.config.equilibrio?.hazanas || {}) });
const cuentaHazanas = (data, e, j) => (confHazanas(data).por === 'turno' ? (e.turno?.pid === j.id ? e.turno.hazanas || {} : {}) : j.extra.hazanas || {});
// Para la vista: cuántas le quedan este turno y si está bloqueada por el freno.
export function hazanasEstado(data, e, j) {
  const c = confHazanas(data), cuenta = cuentaHazanas(data, e, j);
  return Object.fromEntries(Object.entries(HAZANAS).map(([k, h]) => [k, { nombre: h.nombre, noches: h.noches, par: h.par, quedan: Math.max(0, c.max - (cuenta[k] || 0)), bloqueada: !!(c.freno && j.extra.hazanaBloq?.[k]) }]));
}
function hazana(data, e, pid, k) {
  const j = e.jugadores[pid], h = HAZANAS[k], c = confHazanas(data), st = hazanasEstado(data, e, j)[k];
  if (st.bloqueada) { log(e, `«${h.nombre}» no vale todavía para ${j.nombre}. Para volver a ganar estas noches, muévete a otra ciudad (fuera de ${h.par.join(' y ')}).`, { pid }); return; }
  if (st.quedan <= 0) { log(e, `${j.nombre} ya cobró ${c.max} veces «${h.nombre}»${c.por === 'turno' ? ' este turno' : ''}: no recibe más noches.`, { pid }); return; }
  const cuenta = c.por === 'turno' ? (e.turno.hazanas ||= {}) : (j.extra.hazanas ||= {});
  cuenta[k] = (cuenta[k] || 0) + 1; j.noches += h.noches;
  log(e, `${j.nombre}: «${h.nombre}», +${h.noches} noches.`, { pid });
}
// Al cerrar el turno: la hazaña cobrada queda bloqueada; un turno posterior que termine fuera del par la libera.
export function hazanasFinTurno(data, e) {
  const t = e.turno, j = e.jugadores[t.pid];
  if (!j || !confHazanas(data).freno) return;
  for (const [k, h] of Object.entries(HAZANAS)) {
    if (t.hazanas?.[k]) (j.extra.hazanaBloq ||= {})[k] = true;                                            // cobrada: en tu siguiente turno ya no vale
    else if (j.extra.hazanaBloq?.[k] && !h.par.includes(j.ciudad) && !j.transito) delete j.extra.hazanaBloq[k];   // un turno entero terminado fuera del par la libera
  }
}
// Carta especial S1, «Te presentan ante Saladino» (regla de la casa): una vez por partida, en cuanto Aleppo y Damasco ya fueron
// visitadas por jugadores humanos (las visitas de Yafar NPC no cuentan; las de Yafar jugador, sí). Se muestra a toda la mesa y cada jugador vivo recibe 10 dinares y 50 noches; Yafar NPC no.
function saladino(data, e) {
  if (e.saladino) return;
  if (!['Aleppo', 'Damasco'].every((c) => Object.values(e.jugadores).some((x) => !x.npc && x.visitadas.includes(c)))) return;
  const s = data.objetos.especiales.find((x) => x.id === 'S1');
  if (!s) return;
  e.saladino = { ronda: e.ronda };
  publicarCarta(e, { id: 'S1', deck: 'especial', titulo: s.nombre, sub: 'Carta especial', texto: s.texto + ' ' + s.efecto, arte: s.arte, ref: s.refReglamento }, null);
  const quienes = activos(e).filter((id) => !e.jugadores[id].npc);
  for (const id of quienes) { e.jugadores[id].dinares += 10; e.jugadores[id].noches += 50; }
  log(e, `Te presentan ante Saladino: ${quienes.map((id) => e.jugadores[id].nombre).join(', ')} ${quienes.length === 1 ? 'recibe' : 'reciben'} 10 dinares y 50 noches.`, { aviso: true });
}
export function carreraFinTurno(data, e) {
  const t = e.turno, j = e.jugadores[t.pid];
  if (!e.carrerasActivas?.length || t.carreraContada || !j || j.npc || j.eliminado) return;
  t.carreraContada = true;
  const hospedado = !t.movio && !j.perdido && !t.omitido && !j.transito;
  for (const c of e.carrerasActivas.slice()) {
    if (hospedado && j.ciudad === c.ciudad) c.prog[j.id] = (c.prog[j.id] || 0) + 1; else delete c.prog[j.id];
    if ((c.prog[j.id] || 0) >= 2) {
      j.dinares += 60; j.noches += 50;
      e.carrerasActivas.splice(e.carrerasActivas.indexOf(c), 1);
      log(e, `${j.nombre} es el primero en pasar dos noches seguidas en ${c.ciudad}: gana 60 dinares y 50 noches.`, { pid: j.id, aviso: true });
    } else if (c.prog[j.id] === 1) log(e, `${j.nombre} lleva una noche en ${c.ciudad} (carrera: 1 de 2).`, { pid: j.id });
  }
}

// Regla de la casa: si solo queda un participante vivo (Yafar NPC cuenta), gana al instante, sin esperar al cierre de ronda.
function ultimoEnPie(e) {
  if (e.fase !== 'juego' || !e.ronda || (e.participantes || 0) < 2) return false;
  if (e.dados || (e.colaDados || []).length) return false;                 // primero se ven los dados y el desglose; el final, después
  const viv = activos(e);
  if (viv.length !== 1) return false;
  const j = e.jugadores[viv[0]];
  // Excepción (solitario): si el único humano derrota a Yafar NPC, gana, pero puede seguir jugando hasta las 1,001 noches.
  const humanos = Object.values(e.jugadores).filter((x) => x.pj && !x.npc).length;
  if (!j.npc && humanos === 1 && e.jugadores.npc?.eliminado) {
    if (!e.victoriaYafar) { e.victoriaYafar = { pid: j.id, ronda: e.ronda }; log(e, `¡${j.nombre} gana: derrotó a Yafar! Puede seguir jugando hasta las 1,001 noches.`, { pid: j.id, aviso: true }); }
    return false;
  }
  e.fase = 'fin'; e.turno = null; e.pend = null; e.colaPend = []; e.pelea = null; e.finUltimo = true;
  if (j.npc) { e.ganadores = []; e.derrota = 'npc'; log(e, 'Yafar NPC es el último en pie: gana la partida.', { aviso: true }); }
  else { e.ganadores = [j.id]; log(e, `${j.nombre} es el último en pie y gana la partida.`, { pid: j.id, aviso: true }); }
  return true;
}

// ---------------------------------------------------------------- avance automático (turnos de NPC, cierre de turno, eliminados)
export function avanzar(data, e) {
  for (let g = 0; g < 200; g++) {
    if (e.fase !== 'juego') return;
    if (e.pend) {
      const falta = e.pend.para.filter((x) => !e.pend.resp[x]);
      const ausente = (x) => !e.jugadores[x] || e.jugadores[x].eliminado || e.jugadores[x].npc || (e.pend.tipo === 'subasta' && e.jugadores[x].conectado === false);   // en la subasta, quien está desconectado no puja
      if (falta.every(ausente)) { vencerPend(data, e, Infinity); continue; }
      return;
    }
    if (ultimoEnPie(e)) return;
    const conDados = !!e.dados || (e.colaDados || []).length > 0;        // el final de la partida espera a que se cierren los dados
    if (!conDados && e.solitario && !humanosVivos(e).length) { e.fase = 'fin'; e.ganadores = []; e.derrota = 'muerte'; e.turno = null; log(e, 'Has muerto: Yafar NPC gana la partida.'); return; }
    if (!conDados && !humanosVivos(e).length) { e.fase = 'fin'; e.ganadores = []; e.derrota = 'muerte'; e.turno = null; return; }
    const t = e.turno;
    if (e.pelea) return;
    if (!t) { if (e.paso === 'eventos') { e.paso = null; siguienteTurno(data, e, -1); continue; } return; }
    const j = e.jugadores[t.pid];
    if (j.eliminado || t.fin) { siguienteTurno(data, e, t.idx); continue; }
    if (t.npc && !t.npcIniciado) { if (NPC.esperaLectura(e)) return; t.npcIniciado = true; NPC.turnoNPC(data, e, t.pid); continue; }
    return;
  }
}

// ---------------------------------------------------------------- acciones
const esHost = (e, pid) => e.host === pid;
const CAJA_CERRADA = 'La caja del banco está cerrada: ábrela en el panel del banco.';
const hostAusente = (e) => !e.jugadores[e.host] || !e.jugadores[e.host].conectado;
const puedeNPC = (e, pid) => esHost(e, pid) || hostAusente(e);
const LIBRES = ['volver', 'decidir', 'cerrarDados', 'lanzarDados', 'reclamarAnfitrion', 'cancelarTrato', 'proponerTrato', 'responderTrato', 'elegirPj', 'listo', 'iniciar', 'opciones', 'leido', 'votarReinicio'];

// Libro de saldos: tras cada acción o tic del reloj, cada cambio de dinares o noches de un jugador queda en el registro con
// el importe y el saldo nuevo (las líneas anteriores dicen el motivo).
const saldos = (e) => Object.fromEntries(Object.values(e.jugadores).map((j) => [j.id, [j.dinares, j.noches]]));
const fmt = (n) => n.toLocaleString('es-MX');
// Regla de la casa: nadie tiene más de 1,001 noches (la meta). Se aplica al cerrar cada acción o tick, antes del libro de saldos,
// y antes de comprobar la victoria al cierre de la ronda.
function topeNoches(e, meta) {
  for (const j of Object.values(e.jugadores)) if (j.pj && j.noches > meta) { j.noches = meta; log(e, `${j.nombre} llega al tope de ${fmt(meta)} noches: lo que pase de ahí no cuenta.`, { pid: j.id }); }
}
// Un trato pide estar en la misma ciudad: si alguno de los dos se fue, se cancela y se avisa a los dos.
function tratosSinCiudad(e) {
  for (const [id, tr] of Object.entries(e.tratos || {})) {
    const A = e.jugadores[tr.de], B = e.jugadores[tr.con];
    if (A && B && (A.ciudad !== B.ciudad || A.transito || B.transito)) { delete e.tratos[id]; log(e, `El trato entre ${A.nombre} y ${B.nombre} se cancela: ya no están en la misma ciudad.`, { pid: tr.de }); }
  }
}
function anotarSaldos(e, antes, data) {
  if (!antes || e.fase === 'lobby') return;
  tratosSinCiudad(e);
  if (data) topeNoches(e, data.config.meta);
  for (const j of Object.values(e.jugadores)) {
    const a = antes[j.id]; if (!a || !j.pj) continue;
    const dd = j.dinares - a[0], dn = j.noches - a[1];
    if (!dd && !dn) continue;
    const partes = [dd && `${dd > 0 ? '+' : '−'}${fmt(Math.abs(dd))} dinares`, dn && `${dn > 0 ? '+' : '−'}${fmt(Math.abs(dn))} noches`].filter(Boolean).join(' y ');
    log(e, `Saldo de ${j.nombre}: ${partes} (ahora ${fmt(j.dinares)} dinares y ${fmt(j.noches)} noches).`, { pid: j.id, saldo: { dd, dn } });
    if (a[0] < 0 && j.dinares >= 0) log(e, `${j.nombre} salda su deuda con el banco.`, { pid: j.id });
  }
}
export function reducir(data, e, pid, a, ahora = Date.now()) {
  const antes = saldos(e);
  try { return reducir0(data, e, pid, a, ahora); } finally { anotarSaldos(e, antes, data); }
}
function reducir0(data, e, pid, a, ahora) {
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
      if (e.fase !== 'lobby' && !(j.tarde && puedeUnirse(e))) return err('La partida ya empezó.');
      if (!pjDe(data, a.pj)) return err('Personaje inexistente.');
      if (Object.values(e.jugadores).some((x) => x.pj === a.pj && x.id !== pid)) return err('Ese personaje ya está tomado.');
      j.pj = a.pj; j.listo = false; j.listoEn = null; bancoDeSala(e); return ok();
    }
    case 'listo':
      if (j.tarde && j.pj && a.v) return incorporarTarde(data, e, pid);
      if (e.fase !== 'lobby' || !j.pj) return err('Elige personaje primero.');
      j.listo = !!a.v; j.listoEn = a.v ? ++e.seq : null; bancoDeSala(e); return ok();
    case 'opciones': {
      if (e.fase !== 'lobby') return err('La partida ya empezó.'); if (!esHost(e, pid)) return err('Solo el anfitrión.');
      if (['facil', 'normal', 'dificil'].includes(a.dificultad)) e.opciones.dificultad = a.dificultad;
      if (['facil', 'normal', 'dificil'].includes(a.dificultadAsesinos)) e.opciones.dificultadAsesinos = a.dificultadAsesinos;   // aparte de la de Yafar NPC
      if (typeof a.sinYafar === 'boolean') e.opciones.sinYafar = a.sinYafar;                       // jugar sin Yafar NPC (1 a 3 jugadores)
      return ok();
    }
    case 'iniciar': if (e.fase !== 'lobby') return err('Ya empezó.'); if (!esHost(e, pid)) return err('Solo el anfitrión (banco) inicia la partida.'); e.cuentaInicio = null; return iniciar(data, e);
    case 'reclamarAnfitrion': if (String(a.pin) !== e.pinHost) return err('PIN incorrecto.'); e.host = pid; e.bancoFijo = true; log(e, `${j.nombre} es ahora el banco/anfitrión.`); return ok();
    // ---- decisiones y dados
    case 'decidir': return responderPend(data, e, pid, a);
    case 'tirarDados': return tirarDados(data, e, pid, a);
    case 'lanzarDados': {
      if (!e.dados || e.dados.lanzado) return ok();
      if (pid !== e.dados.por) return err('Solo quien tira puede lanzar estos dados.');
      e.dados.lanzado = true; e.dados.t0 = ahora; return ok();
    }
    case 'cerrarDados': {
      if (!e.dados) return ok();
      if (!e.dados.lanzado) { if (pid !== e.dados.por) return err(`Esperando a que ${nombre(e, e.dados.por)} lance los dados.`); e.dados.lanzado = true; e.dados.t0 = ahora; return ok(); }
      if (ahora - e.dados.t0 < MIN_DADOS_MS) return err('Los dados siguen rodando.');
      siguienteDados(e); return ok();
    }
    // ---- turno
    case 'viajar': return viajar(data, e, pid, a);
    case 'terminarTurno': return terminarTurno(data, e, pid);
    case 'responderCC': return responderCC(data, e, pid, a);
    case 'leido': if (Number(a.nro) > (j.extra.leidoHasta || 0)) j.extra.leidoHasta = Math.min(Number(a.nro), e.seq); return ok();
    case 'omitirCC': if (!t || t.pid !== pid || !t.ccActual) return err('No hay CC pendiente.'); t.ccActual = null; if (t.finTrasCC) t.fin = true; return ok();
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
    // Caja del banco: las acciones que mueven recursos solo funcionan con la caja abierta, y abrirla o cerrarla se anuncia a todos.
    case 'host.caja': {
      if (!esHost(e, pid)) return err('Solo el anfitrión.');
      const abrir = !!a.abrir; if (!!e.cajaAbierta === abrir) return ok();
      e.cajaAbierta = abrir; log(e, abrir ? `${j.nombre} abrió la caja del banco.` : `${j.nombre} cerró la caja del banco.`, { caja: true }); return ok();
    }
    case 'host.dar': if (!esHost(e, pid)) return err('Solo el anfitrión.'); if (!e.cajaAbierta) return err(CAJA_CERRADA); return hostDar(e, a);
    case 'host.corregir': if (!esHost(e, pid)) return err('Solo el anfitrión.'); if (!e.cajaAbierta) return err(CAJA_CERRADA); return hostCorregir(e, a);
    case 'host.repartir': if (!esHost(e, pid)) return err('Solo el anfitrión.'); if (!e.cajaAbierta) return err(CAJA_CERRADA); return hostRepartir(data, e, a);
    case 'host.barajar': if (!esHost(e, pid)) return err('Solo el anfitrión.'); return hostBarajar(e, a);
    case 'host.tirarNPC': if (!puedeNPC(e, pid)) return err('Solo el anfitrión (o cualquiera si el banco está desconectado).'); return tirarDadosLibres(e, pid, a);
    case 'host.pasarTurno': if (!esHost(e, pid)) return err('Solo el anfitrión.'); if (!t) return err('No hay turno.'); e.dados = null; e.colaDados = []; e.pend = null; e.colaPend = []; e.pelea = null; t.fin = true; return ok();
    case 'host.sacarEspera': {
      if (!puedeNPC(e, pid)) return err('Solo el banco.');
      const x = esperaDado(e);
      if (!x || x.pid !== a.pid || x.pid === pid) return err('Ese jugador ya no está esperando dados.');
      if (!sacable(e, x)) return err('Todavía no pasan 60 segundos.');
      return sacarDelTurno(e, x.pid);
    }
    case 'volver': return volver(e, pid);
    case 'host.reiniciar': if (!esHost(e, pid)) return err('Solo el anfitrión (banco) propone una partida nueva.'); return proponerReinicio(data, e, pid);
    case 'votarReinicio': return votarReinicio(data, e, pid, a);
    case 'host.revelarCarta': if (!esHost(e, pid)) return err('Solo el anfitrión.'); return hostRevelar(data, e, a);
    case 'host.ceder': if (!esHost(e, pid)) return err('Solo el anfitrión.'); if (!e.jugadores[a.pid] || e.jugadores[a.pid].npc) return err('Jugador inexistente.'); e.bancoFijo = true; if (e.cajaAbierta) { e.cajaAbierta = false; log(e, `${j.nombre} cerró la caja del banco.`, { caja: true }); } e.host = a.pid; return ok();
    case 'host.eliminar': {
      if (!esHost(e, pid)) return err('Solo el anfitrión.');
      if (!e.cajaAbierta && e.jugadores[a.pid]?.conectado !== false) return err(CAJA_CERRADA);   // a un desconectado se le puede sacar sin abrir la caja
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
  const d = mostrarDados(e, { por: pid, motivo: 'ingreso', grupos: [{ etq: `${j.nombre}: dado de ingreso`, valores: [v] }], resumen: [] });
  log(e, `${j.nombre} tira el dado de ingreso: ${v}.`, { pid });
  t.fase = 'mov';
  const tenia = j.mensajes.length;
  if (v === data.config.minimoMensajeDado) darMensaje(data, e, pid);                                                // R 6.2 y 18.2
  // Aviso en el resultado del dado: verde si llega una carta de sheij, rojo si no (y por qué, cuando salió el 6).
  const recibe = j.mensajes.length > tenia;
  d.sheij = { ok: recibe, texto: recibe ? '¡Hay carta de sheij! Recibes un Mensaje.'
    : v !== data.config.minimoMensajeDado ? `No hay carta de sheij (hace falta un ${data.config.minimoMensajeDado}).`
      : !e.mazos.mensajes.length ? 'No hay carta de sheij: ya salieron todos los Mensajes.' : 'No hay carta de sheij: ya salió uno esta ronda.' };
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
  if (yaEstaRonda) return;
  const id = robar(e, 'mensajes');
  if (!id) return;
  j.mensajes.push({ id, turnoLimite: e.ronda + data.mensajes.mensajes.find((m) => m.id === id).plazoTurnos });   // regla de la casa: se pueden tener varios a la vez
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
  if (j.ciudad === 'Bagdad' && j.misiones.some((m) => m.id === 'R1' && m.deuda > 0)) return err('Tienes una deuda con Bagdad (reto R1): págala antes de salir de la ciudad.');
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

// Transporte propio (regla de la casa): llega en el mismo turno, sin tarifa ni caravana nueva. El caballo, el camello y la
// alfombra terminan el turno (en cuanto se resuelve la carta de Cuentos de la llegada); el burro no.
export function viajarPropio(data, e, pid, { destino, motivo, termina, consumeUid = null }) {
  const t = e.turno, j = e.jugadores[pid], origen = j.ciudad;
  if (consumeUid) quitarCarta(j, consumeUid);
  t.tramos++; t.movio = true; j.ciudad = destino;
  log(e, `${j.nombre} viaja de ${origen} a ${destino} en ${motivo}${termina ? ' y termina su turno' : ''}.`, { pid });
  if (motivo === 'burro' && [origen, destino].sort().join() === 'Damasco,El Cairo') hazana(data, e, pid, 'quds');
  if (termina) { t.principal = true; t.maxTramos = t.tramos; t.finTrasCC = true; }
  const r = llegada(data, e, pid, origen);
  if (termina && !t.ccActual) t.fin = true;
  return r;
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
  if (primera) saladino(data, e);
  if (t && [origen, j.ciudad].sort().join() === 'Andalucía,Magreb') hazana(data, e, pid, 'tariq');                 // cruzar el estrecho, con cualquier medio
  if (!t.llegadas.includes(j.ciudad) && j.ciudad !== j.ciudadPrevia) {                                      // R 8.2: no se ganan al volver a la ciudad que dejaste
    t.llegadas.push(j.ciudad);
    const mult = multiplicadorRonda(data, e.ronda, activos(e).length);
    let base = c.nochesLuego, bono = 0;
    if (c.nochesLlegada !== c.nochesLuego) { if (primera) bono = c.nochesLlegada - c.nochesLuego; } else base = c.nochesLlegada;   // Magreb 50/5, Andalucía 30/5
    let n = base * mult + bono;
    if (e.mods.cordoba && j.ciudad === 'Andalucía') n *= 2;
    const npcSolo = j.npc && !enCiudad(e, j.ciudad, pid).some((x) => !e.jugadores[x].npc);   // regla de la casa: Yafar NPC solo cobra completo si alcanza a alguien
    if (npcSolo) n = Math.floor(n / 2);
    j.noches += n;
    log(e, `${j.nombre} gana ${n} noches en ${j.ciudad} (x${mult})${npcSolo ? ': la mitad, porque no hay ningún jugador en la ciudad' : ''}.`, { pid });
    if (e.evento.actual === 'E4' && nadieAntes) { j.noches += 20; log(e, `Peregrinación: ${j.nombre} gana 20 noches extra.`); }
  }
  PJ.alLlegar(data, e, pid, origen);
  NPC.revisarEncargo(data, e, pid);
  TES.quizaLampara(data, e, pid);
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
  // Regla de la casa: ninguna CC se repite en la partida hasta que hayan salido todas. Se saca del mazo de la ciudad;
  // si ya no le quedan sin salir, de cualquier otro mazo; cuando salieron todas, se rebarajan todas con las ya salidas.
  m.ccVistas ||= [];
  const nueva = (x) => !m.ccVistas.includes(x.k + x.id);
  let origen = ciudad;
  if (!(m.cc[ciudad] || []).some(nueva)) origen = Object.keys(m.cc).find((k) => m.cc[k].some(nueva));
  if (!origen) {                                                                                             // salieron todas: mazo nuevo
    m.ccVistas = [];
    for (const k of Object.keys(m.cc)) m.cc[k] = barajar(e, m.cc[k].concat((m.descarte.cc[k] || []).splice(0)));
    origen = (m.cc[ciudad] || []).length ? ciudad : Object.keys(m.cc).find((k) => m.cc[k].length);
    if (!origen) return null;
    log(e, 'Ya salieron todas las cartas de cuentos: se barajan de nuevo.');
  }
  const i = m.cc[origen].findIndex(nueva);
  const [c] = m.cc[origen].splice(i, 1);
  m.ccVistas.push(c.k + c.id);
  (m.descarte.cc[origen] ||= []).push(c);
  t.cc++;
  sacarCuento(data, e, pid, ciudad);                                                                          // R 19.7
  const tipo = c.k === 't' ? 'trivia' : 'mesa';
  const datos = cartaDatos(data, tipo, c.id);
  const ent = publicarCarta(e, datos, pid);
  t.ccActual = { tipo, id: c.id, nro: ent.nro };
  return t.ccActual;
}

// R 19.7: cada mazo da su cuento de ambiente una sola vez por partida (si el mazo tiene varios, se elige uno al azar); quien lo saca lo lee y cobra 2 dinares del banco. Ni NPC ni eliminados cobran.
export function sacarCuento(data, e, pid, clave) {
  const j = e.jugadores[pid];
  e.cuentosSacados ||= [];
  if (!j || j.eliminado || j.npc || e.cuentosSacados.includes(clave)) return null;
  const grupo = data.cuentos.cuentos.filter((x) => x.clave === clave);               // varios cuentos por mazo: uno al azar por partida
  if (!grupo.length) return null;
  const c = grupo.length > 1 ? grupo[Math.floor(rnd(e) * grupo.length)] : grupo[0];
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
  if (t.finTrasCC) t.fin = true;                                                                             // llegó en caballo, camello o alfombra
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
  t.ccActual = null; if (t.finTrasCC) t.fin = true; return ok();
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
      pagar(data, e, pid, costo);
      log(e, `${j.nombre} paga ${costo} dinares de alojamiento en ${j.ciudad} (no se movió este turno).`, { pid });
    }
  }
  for (const m of j.mensajes.filter((x) => e.ronda > x.turnoLimite)) { e.mazos.descarte.mensajes.push(m.id); j.mensajes = j.mensajes.filter((x) => x !== m); log(e, `${j.nombre} deja caducar un mensaje.`); }
  j.ciudadPrevia = t.movio ? t.ciudadInicio : j.ciudadPrevia;
  RET.finTurno(data, e, pid);
  t.fin = true;
  return ok();
}

// ---------------------------------------------------------------- tratos entre jugadores (R 8.6, 15.2)
// Cartas que cada jugador de tu ciudad puede intercambiar (para pedírselas en un trato). El libro de Ibn Hazm no se intercambia.
function comerciables(data, e, pid) {
  const j = e.jugadores[pid], r = {};
  if (!j || j.transito) return r;
  for (const k of Object.values(e.jugadores)) {
    if (k.id === pid || k.npc || k.eliminado || !k.pj || k.transito || k.ciudad !== j.ciudad) continue;
    r[k.id] = listaComerciable(k).map((c, i) => ({ i, titulo: datosMano(data, e, c)?.titulo || 'carta' }));   // por posición: los uid ajenos no viajan
  }
  return r;
}
const listaComerciable = (k) => k.mano.filter((c) => (c.tipo !== 'especial' || c.ref === 'F1') && c.ref !== 'libroIbnHazm');
// Un lado del trato tal como lo ve pid: sus propias cartas por uid; las ajenas, por posición en la lista de comerciables.
function ladoVisto(e, pid, duenoId, x) {
  if (duenoId === pid) return x;
  const lista = listaComerciable(e.jugadores[duenoId]);
  const { objetos, ...resto } = x;
  return { ...resto, objetos: [], idx: (objetos || []).map((u) => lista.findIndex((c) => c.uid === u)).filter((i) => i >= 0) };
}
const nombreRef = (data, ref) => objDe(data, ref)?.nombre || itemDatos(data, ref)?.titulo || ref;
// Regla de la casa: los tratos se proponen y responden en cualquier momento (sea o no tu turno), salvo en medio de una pelea
// o de una decisión propia; solo entre jugadores de la misma ciudad.
function tratoOcupado(e, ids) {
  const P = e.pelea; if (P && ids.some((x) => [P.atk, P.def, P.ayudante].includes(x))) return 'Esperen a que termine la pelea.';
  if (e.pend && ids.some((x) => e.pend.para.includes(x) && !e.pend.resp[x])) return 'Primero hay que responder la decisión pendiente.';
  return null;
}
function proponerTrato(data, e, pid, a) {
  const j = e.jugadores[pid], k = e.jugadores[a.con];
  if (!k || k.id === pid || k.eliminado || k.npc) return err('Destinatario inválido.');
  if (e.fase !== 'juego') return err('La partida no está en juego.');
  { const o = tratoOcupado(e, [pid, a.con]); if (o) return err(o); }
  if (j.ciudad !== k.ciudad || j.transito || k.transito) return err('Deben estar en la misma ciudad (R 8.6).');
  if (e.mods.sinComercio?.[pid] || e.mods.sinComercio?.[a.con] || j.extra.sinComercioHasta >= e.ronda || k.extra.sinComercioHasta >= e.ronda) return err('Nadie quiere comerciar con esa persona (difamación).');
  const esHazm = (de, us) => (us || []).some((u) => de.mano.some((c) => c.uid === u && c.ref === 'libroIbnHazm'));
  if (esHazm(j, a.ofrece?.objetos) || esHazm(k, a.pide?.objetos)) return err('El libro de Ibn Hazm solo se vende en la biblioteca de Bagdad: no se puede regalar ni vender a otro jugador.');
  // Cada lado puede combinar dinares, noches y cartas. Lo que se pide se nombra por tipo (la mano ajena es secreta).
  const val = (x, de) => {
    const lista = listaComerciable(de);
    const porIdx = (x?.idx || []).map((i) => lista[Math.floor(i)]?.uid).filter(Boolean);
    const objetos = [...new Set([...(x?.objetos || []), ...porIdx])].filter((u) => de.mano.some((c) => c.uid === u && c.tipo !== 'especial' || c.uid === u && c.ref === 'F1'));
    const refs = (x?.refs || []).filter((r) => typeof r === 'string' && r !== 'libroIbnHazm').slice(0, 6);
    const nombres = [...objetos.map((u) => datosMano(data, e, de.mano.find((c) => c.uid === u))?.titulo || 'carta'), ...refs.map((r) => nombreRef(data, r))];
    return { dinares: Math.max(0, Math.floor(x?.dinares || 0)), noches: Math.max(0, Math.floor(x?.noches || 0)), objetos, refs, nombres };
  };
  const ofrece = val(a.ofrece, j), pide = val(a.pide, k);
  if (ofrece.dinares > j.dinares || ofrece.noches > j.noches) return err('No tienes todo lo que ofreces.');
  if (!ofrece.dinares && !ofrece.noches && !ofrece.nombres.length && !pide.dinares && !pide.noches && !pide.nombres.length) return err('El trato está vacío.');
  const id = 'tr' + (++e.seq);
  e.tratos[id] = { id, de: pid, con: a.con, ofrece, pide, t: e.ahora, contra: !!a.contra };
  return ok();
}
function responderTrato(data, e, pid, a) {
  const tr = e.tratos[a.id];
  if (!tr || tr.con !== pid) return err('Trato inexistente.');
  delete e.tratos[a.id];
  if (!a.ok) { log(e, `${e.jugadores[pid].nombre} rechaza el trato de ${e.jugadores[tr.de]?.nombre}${a.contra ? ' y le hace una contraoferta' : ''}.`, { pid: tr.de }); return ok(); }
  const A = e.jugadores[tr.de], B = e.jugadores[tr.con];
  if (A.eliminado || B.eliminado) return err('El trato ya no es posible.');
  { const o = tratoOcupado(e, [A.id, B.id]); if (o) { e.tratos[a.id] = tr; return err(o); } }
  if (A.ciudad !== B.ciudad) return err('Ya no están en la misma ciudad.');
  tr.ofrece.noches ||= 0; tr.pide.noches ||= 0; tr.ofrece.refs ||= []; tr.pide.refs ||= [];
  if (A.dinares < tr.ofrece.dinares || B.dinares < tr.pide.dinares) return err('Faltan dinares para el trato.');
  if (A.noches < tr.ofrece.noches || B.noches < tr.pide.noches) return err('Faltan noches para el trato.');
  // lo pedido por tipo: la primera carta de ese tipo de cada mano
  const elegir = (de, refs, ya) => { const r = []; for (const ref of refs) { const c = de.mano.find((x) => x.ref === ref && x.tipo !== 'especial' && !ya.includes(x.uid) && !r.includes(x.uid)); if (!c) return { falta: ref }; r.push(c.uid); } return { uids: r }; };
  const eA = elegir(A, tr.ofrece.refs, tr.ofrece.objetos), eB = elegir(B, tr.pide.refs, tr.pide.objetos);
  if (eA.falta) return err(`${A.nombre} no tiene «${nombreRef(data, eA.falta)}».`);
  if (eB.falta) return err(`${B.nombre} no tiene «${nombreRef(data, eB.falta)}»: no puede aceptar este trato.`);
  tr.ofrece.objetos = [...tr.ofrece.objetos, ...eA.uids]; tr.pide.objetos = [...tr.pide.objetos, ...eB.uids];
  if (!tr.ofrece.objetos.every((u) => A.mano.some((c) => c.uid === u)) || !tr.pide.objetos.every((u) => B.mano.some((c) => c.uid === u))) return err('Faltan objetos.');
  A.noches += tr.pide.noches - tr.ofrece.noches; B.noches += tr.ofrece.noches - tr.pide.noches;
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
  log(e, `El banco da a ${j.nombre} ${a.dinares || 0} dinares y ${a.noches || 0} noches.`); return ok();
}
function hostCorregir(e, a) {
  const j = e.jugadores[a.pid]; if (!j) return err('Jugador inexistente.');
  if (['dinares', 'noches', 'escondido', 'buscado'].includes(a.campo)) j[a.campo] = Math.max(0, Math.floor(a.valor));
  else if (['herido', 'perdido', 'destreza'].includes(a.campo)) j[a.campo] = !!a.valor;
  else if (a.campo === 'ciudad') { if (!ciudadDe({ ciudades: { ciudades: [] } }, 'x') && false) return err('x'); j.ciudad = String(a.valor); }
  else return err('Campo no corregible.');
  log(e, `El banco corrige ${a.campo} de ${j.nombre}.`); return ok();
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
    const id = robar(e, 'mensajes'); if (!id) return err('No quedan mensajes: cada uno sale una sola vez por partida.');
    j.mensajes.push({ id, turnoLimite: e.ronda + 3 }); publicarCarta(e, cartaDatos(data, 'mensaje', id), a.pid, [a.pid]);
  } else return err('Mazo no repartible.');
  log(e, `El banco reparte una carta a ${j.nombre}.`); return ok();
}
function hostBarajar(e, a) {
  if (!e.mazos) return err('No hay mazos.');
  const m = a.mazo;
  // Regla de la casa: barajar reordena solo las cartas que quedan; las ya salidas no vuelven (al agotarse, el mazo se rebaraja solo).
  if (['eventos', 'historicos', 'botin', 'ifrit'].includes(m)) { barajar(e, e.mazos[m]); }
  else if (m === 'mensajes') { barajar(e, e.mazos.mensajes); }
  else if (m === 'cc') { for (const k of Object.keys(e.mazos.cc)) barajar(e, e.mazos.cc[k]); }   // reordena las que quedan; las ya salidas no vuelven
  else return err('Mazo inválido.');
  log(e, `El banco baraja el mazo ${m}.`); return ok();
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
    if (d && OBJ.animalDe(data, c.ref)) { const n = OBJ.turnosAnimal(data, c); d.vida = n; d.texto += n ? ` Le quedan ${n} turno${n === 1 ? '' : 's'} de vida.` : ' Es su último turno: muere al terminar.'; }
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
      buscado: j.buscado, eliminado: j.eliminado, destreza: j.destreza, nMano: manoPublica(j), tieneMensaje: j.mensajes.length > 0, nMensajes: j.mensajes.length, transito: j.transito ? { faltan: j.transito.faltan } : null,
      kanmakan: !!tieneEsp(j, 'K1'), retosHechos: j.retosHechos.length, bajoTecho: !!j.extra.bajoTecho, escondido: id === pid ? j.escondido : undefined, hazanas: hazanasEstado(data, e, j), buscadoE7: e.evento?.buscadoE7 === id, sacado: !!j.sacado, tarde: !!j.tarde, buscadoInfo: textoBuscado(data, e, j) || null,
      buscadoClave: j.buscado > 0 || e.evento?.buscadoE7 === id ? `${j.extra.buscadoMotivo?.ronda ?? ''}-${j.extra.buscadoMotivo?.tipo ?? ''}-${e.evento?.buscadoE7 === id ? 'E7' + e.ronda : ''}` : null };
  }
  const t = e.turno && { pid: e.turno.pid, fase: e.turno.fase, tramos: e.turno.tramos, movio: e.turno.movio, cc: e.turno.cc, ciudadInicio: e.turno.ciudadInicio, principal: e.turno.principal, heridoAhora: !!e.turno.heridoAhora, fin: !!e.turno.fin,
    ccActual: e.turno.ccActual ? { tipo: e.turno.ccActual.tipo, nro: e.turno.ccActual.nro, descartada: e.turno.ccActual.descartada ?? null } : null };
  const historial = e.historial.filter((h) => !h.para || h.para.includes(pid)).slice(-120).map((h) => {
    const { resuelto, ...resto } = h;
    return h.deck === 'trivia' && !resuelto ? resto : h;                      // sin 'resuelto' = sin respuesta
  });
  const esAnf = e.host === pid;
  const p = e.pend;
  const ver = p && (!p.privado || p.para.includes(pid));                     // los avisos privados (Masrur, contratos) no viajan a los demás
  const pend = p && { id: p.id, tipo: p.tipo, titulo: ver ? p.titulo : 'Decisión privada', texto: ver ? p.texto : '', modo: p.modo, para: p.para, min: p.min, max: p.max, t0: p.t0, limiteMs: p.limiteMs ?? e.opciones?.limitePendMs ?? 90000,
    opciones: p.para.includes(pid) ? p.opciones : [], respondiste: !!p.resp[pid], faltan: p.para.filter((x) => !p.resp[x]), mia: p.para.includes(pid),
    subasta: p.tipo === 'subasta' ? { mejor: Math.max(0, ...Object.values(p.resp).map((r) => Number(r.opcion || 0))), pujas: Object.values(p.resp).filter((r) => Number(r.opcion) > 0).length, minimo: p.cont?.args?.min } : undefined };
  return {
    v: e.v, codigo: e.codigo, yo: pid, fase: e.fase, ronda: e.ronda, ahora: e.ahora, host: e.host, soyHost: esAnf, hostConectado: e.jugadores[e.host]?.conectado ?? false,
    orden: e.orden, mult: e.ronda ? multiplicadorRonda(data, e.ronda, e.orden.length) : 1, jugadores, turno: t, dados: e.dados, enCola: (e.colaDados || []).length, ultimaCarta: e.ultimaCarta, historial, log: e.log.slice(-80).map(({ t: tt, texto, pid: p2, n, saldo }) => ({ t: tt, texto, pid: p2, n, saldo: saldo ? 1 : undefined })),
    votoReinicio: vistaVoto(e, pid), partidaN: e.partidaN || 1, puedeUnirse: puedeUnirse(e), cuenta: e.cuentaInicio ? Math.max(0, Math.ceil((e.cuentaInicio - e.ahora) / 1000)) : null, faltaInicio: e.fase === 'lobby' ? faltaParaIniciar(e) : [],
    espera: (() => { const x = esperaDado(e); return x ? { ...x, sacable: sacable(e, x) } : null; })(), puedoSacar: puedeNPC(e, pid) && sacable(e) && esperaDado(e)?.pid !== pid,
    caravanas: e.caravanas, ganadores: e.ganadores, derrota: e.derrota, finUltimo: !!e.finUltimo, victoriaYafar: e.victoriaYafar || null, carreras: (e.carrerasActivas || []).map((c) => ({ id: c.id, ciudad: c.ciudad, prog: c.prog })), sinCaravanasBagdad: e.sinCaravanasBagdad, evento: e.evento, mods: publicMods(e), solitario: e.solitario, cajaAbierta: !!e.cajaAbierta, opciones: { dificultad: e.opciones.dificultad, dificultadAsesinos: e.opciones.dificultadAsesinos || 'normal', sinYafar: !!e.opciones.sinYafar },
    pend, acciones: acciones(data, e, pid),
    mano: yo ? yo.mano.map((c) => ({ ...c, datos: datosMano(data, e, c), venta: OBJ.estimarVenta(data, e, pid, c), donde: [OBJ.dondeVender(data, e, pid, c), RET.sirvePara(data, c)].filter(Boolean).join(' ') })) : [],
    tienda: OBJ.tienda(data, e, pid),
    misiones: yo ? RET.misionesVista(data, e, pid) : [], retosHechos: yo ? yo.retosHechos : [], encargo: yo?.extra?.encargoAsesinos ? { tipo: yo.extra.encargoAsesinos.tipo, ciudad: yo.extra.encargoAsesinos.ciudad, hasta: yo.extra.encargoAsesinos.hasta } : null,
    mensajes: yo ? yo.mensajes.map((m) => ({ ...m, carta: cartaDatos(data, 'mensaje', m.id) })) : [],
    tratos: Object.values(e.tratos).filter((x) => x.de === pid || x.con === pid).map((x) => ({ ...x, ofrece: ladoVisto(e, pid, x.de, x.ofrece), pide: ladoVisto(e, pid, x.con, x.pide) })),
    comerciables: yo ? comerciables(data, e, pid) : {},
    asesinos: { actuaron: e.asesinos.actuaron }, kanmakan: { dueno: e.kanmakan.dueno, usada: e.kanmakan.usada }, firmanesLibres: e.firmanes,
    host_info: esAnf ? { pinHost: e.pinHost, stock: e.stock, mazos: { eventos: e.mazos?.eventos.length, historicos: e.mazos?.historicos.length, mensajes: e.mazos?.mensajes.length, botin: e.mazos?.botin.length, ifrit: e.mazos?.ifrit.length } } : undefined,
    stockPublico: e.stock,
  };
}
const publicMods = (e) => { const { sinIngreso, varado, huir, ...r } = e.mods || {}; return r; };

// ---------------------------------------------------------------- terminar y empezar otra partida (regla de la casa del juego en línea)
// El banco lo propone en cualquier momento; votan los jugadores humanos conectados y basta la mayoría (más de la mitad).
// Al terminar la partida de forma normal, el banco empieza la nueva sin votación. La partida anterior se guarda en datos/.
export const VOTO_REINICIO_MS = 60000;
const votantes = (e) => e.orden.filter((id) => { const j = e.jugadores[id]; return j && !j.npc && j.pj && j.conectado !== false; });
function proponerReinicio(data, e, pid) {
  if (e.fase === 'lobby') return err('La partida todavía no empieza.');
  if (e.fase === 'fin') return reiniciar(data, e);
  if (e.votoReinicio) return err('Ya hay una votación en curso.');
  e.votoReinicio = { por: pid, t0: e.ahora, limiteMs: VOTO_REINICIO_MS, votos: { [pid]: true } };
  log(e, `${e.jugadores[pid].nombre} (banco) propone terminar esta partida y empezar otra desde cero: voten sí o no.`, { aviso: true });
  return revisarVoto(data, e);
}
function votarReinicio(data, e, pid, a) {
  const v = e.votoReinicio;
  if (!v) return err('No hay ninguna votación en curso.');
  if (!votantes(e).includes(pid)) return err('No participas en esta votación.');
  v.votos[pid] = !!a.si;
  return revisarVoto(data, e);
}
function revisarVoto(data, e, vencido = false) {
  const v = e.votoReinicio; if (!v) return ok();
  const vs = votantes(e), si = vs.filter((id) => v.votos[id] === true).length, no = vs.filter((id) => v.votos[id] === false).length;
  if (si * 2 > vs.length) { e.votoReinicio = null; log(e, `La mayoría aceptó (${si} de ${vs.length}): termina la partida y empieza otra desde cero.`, { aviso: true }); return reiniciar(data, e); }
  if (no * 2 >= vs.length || vencido) { e.votoReinicio = null; log(e, `No hubo mayoría para empezar de nuevo (${si} sí, ${no} no): la partida sigue.`, { aviso: true }); }
  return ok();
}
function vistaVoto(e, pid) {
  const v = e.votoReinicio; if (!v) return null;
  const vs = votantes(e);
  return { por: v.por, t0: v.t0, limiteMs: v.limiteMs, total: vs.length, si: vs.filter((id) => v.votos[id] === true).length, no: vs.filter((id) => v.votos[id] === false).length, votas: vs.includes(pid), miVoto: v.votos[pid] ?? null };
}
// Sala nueva con los mismos jugadores humanos (personaje elegido y «listo»), el mismo banco y las mismas opciones; los nuevos pueden unirse.
function reiniciar(data, e) {
  const archivo = serializar(e);
  const viejo = e.jugadores, humanos = e.orden.filter((id) => viejo[id] && !viejo[id].npc);
  const n = nuevoJuego(data, { codigo: e.codigo, semilla: (e.semilla ^ e.ahora) & 0x7fffffff, ahora: e.ahora, opciones: { ...e.opciones } });
  Object.assign(n, { seq: e.seq, logN: e.logN, host: e.host, bancoFijo: true, pinHost: e.pinHost, partidaN: (e.partidaN || 1) + 1, archivoPendiente: archivo });
  for (const id of humanos) {
    const o = viejo[id], j = nuevoJugador(n, id, o.nombre, o.token);
    Object.assign(j, { pj: o.pj, listo: !!o.pj, conectado: o.conectado, extra: o.extra?.clienteWeb ? { clienteWeb: true } : {} });
    n.jugadores[id] = j; n.orden.push(id);
  }
  for (const k of Object.keys(e)) delete e[k];
  Object.assign(e, n);
  log(e, `Partida nueva (${e.partidaN}): pueden cambiar de personaje y entrar jugadores nuevos; el banco la inicia cuando todos estén listos.`, { aviso: true });
  return ok();
}

// ---------------------------------------------------------------- reloj del servidor (cada segundo)
export function tick(data, e, ahora = Date.now()) {
  const antes = saldos(e);
  try { return tick0(data, e, ahora); } finally { anotarSaldos(e, antes, data); }
}
function tick0(data, e, ahora) {
  e.ahora = ahora;
  let cambio = false;
  if (e.turno?.fase === 'ingreso' && (e.pend || e.dados)) e.turno.t0 = ahora;   // los 60 segundos cuentan desde que puede tirar
  const sac = sacable(e); if (sac !== !!e.avisoSacar) { e.avisoSacar = sac; cambio = true; }
  if (e.fase === 'lobby') {
    const antes = e.cuentaInicio ? Math.ceil((e.cuentaInicio - ahora) / 1000) : null;
    if (!salaLista(e)) { if (e.cuentaInicio) { e.cuentaInicio = null; cambio = true; } }
    else if (!e.cuentaInicio) { e.cuentaInicio = ahora + CUENTA_INICIO_MS; cambio = true; }
    else if (ahora >= e.cuentaInicio) { e.cuentaInicio = null; iniciar(data, e); cambio = true; }
    else if (antes !== e.ultimaCuenta) { e.ultimaCuenta = antes; cambio = true; }
  }
  if (e.dados && e.dados.lanzado && ahora - e.dados.t0 > AUTOCIERRE_DADOS_MS) { siguienteDados(e); cambio = true; }
  if (e.votoReinicio && ahora - e.votoReinicio.t0 > e.votoReinicio.limiteMs) { revisarVoto(data, e, true); cambio = true; }
  if (e.fase === 'juego') {
    if (e.pend && e.dados) e.pend.t0 = ahora;                     // el plazo de una decisión empieza cuando se cierran los dados
    else if (e.pend && vencerPend(data, e, ahora)) cambio = true;
    const antes = e.turno?.pid + ':' + e.ronda + ':' + (e.pend?.id || '') + ':' + e.fase;
    avanzar(data, e);
    if (antes !== e.turno?.pid + ':' + e.ronda + ':' + (e.pend?.id || '') + ':' + e.fase) cambio = true;
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
  e.participantes ??= Object.values(e.jugadores).filter((j) => j.pj).length; e.carreras ||= {}; e.carrerasActivas ||= [];
  e.asesinos ||= { actuaron: false, contrato: null }; e.firmanes ??= 3; e.kanmakan ||= { dueno: null, usada: false }; e.tesoros ||= {}; e.derrota ||= null;
  if (e.mazos) { e.mazos.botin ||= []; e.mazos.ifrit ||= []; e.mazos.descarte.botin ||= []; e.mazos.descarte.ifrit ||= []; }
  for (const j of Object.values(e.jugadores)) { j.misiones ||= []; j.destreza ??= false; j.turnos ??= 0; j.transito ??= null; j.ventajaCombate ??= 0; j.extra ||= {}; j.retosHechos ||= []; j.mensajes ||= j.mensaje ? [j.mensaje] : []; delete j.mensaje; }
  return e;
}

// ---------------------------------------------------------------- enlaces para los demás módulos
HOOK.nuevoJugador = nuevoJugador; HOOK.partir = partir; HOOK.llegada = llegada; HOOK.siguienteTurno = (data, e) => siguienteTurno(data, e, e.turno ? e.turno.idx : -1); HOOK.viajarTransporte = viajarTransporte; HOOK.viajarPropio = viajarPropio; HOOK.robarCC = robarCC;
HOOK.darMensaje = darMensaje; HOOK.avanzar = avanzar; HOOK.multiplicador = multiplicadorRonda; HOOK.sacarCuento = sacarCuento;
