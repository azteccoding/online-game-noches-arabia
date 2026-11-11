// Yafar el Bermekí NPC (R 20.4, 21), entrada del NPC al quedar un solo jugador (R 22.4) y Los Asesinos (R 13).
import {
  ok, err, rnd, dado, dados, suma, log, nombre, ciudadDe, pjDe, activos, humanosVivos, enCiudad, mostrarDados, pedir, registrar, eliminar, pagar, puedePagar, tarifa, HOOK,
  puedePrincipal, tieneItem, tieneObj, consumirObj, uid, vivos, patrimonio, info, quitarPrimero,
marcarBuscado,
enPartida, cargaExcedida, objDe, CARGA_ITEMS, ITEMS, } from './base.js';
import { atacar, validarAtaque, bonosCombate, conArco } from './pelea.js';
import { vender } from './objetos.js';

const npcDe = (e) => e.orden.find((id) => e.jugadores[id].npc && !e.jugadores[id].eliminado) || null;

// ---------------------------------------------------------------- rutas
function dijkstra(data, e, j, desde) {
  const dist = { [desde]: 0 }, prev = {}, cola = [desde], hecho = new Set();
  while (cola.length) {
    cola.sort((a, b) => dist[a] - dist[b]);
    const u = cola.shift();
    if (hecho.has(u)) continue;
    hecho.add(u);
    for (const k of Object.keys(data.rutas.tarifas)) {
      if (!k.startsWith(u + '>')) continue;
      const v = k.split('>')[1];
      if (u === 'Bagdad' && e.sinCaravanasBagdad) continue;
      const c = tarifa(data, e, j, u, v);
      if (c === null) continue;
      if (dist[v] === undefined || dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; cola.push(v); }
    }
  }
  return { dist, prev };
}
function camino(prev, desde, hasta) {
  const r = [hasta];
  while (r[0] !== desde) { const p = prev[r[0]]; if (!p) return null; r.unshift(p); }
  return r;
}

// ---------------------------------------------------------------- turno automático (R 20.4)
// Yafar NPC no empieza su turno (ni asalta) mientras algún jugador conectado tenga cartas sin cerrar.
// El cliente avisa con la acción «leido» hasta qué carta cerró; si no avisa, la carta deja de contar al minuto.
export const ESPERA_LECTURA_MS = 60000;
export function cartasSinCerrar(e, pid) {
  const j = e.jugadores[pid], hasta = j?.extra?.leidoHasta || 0;
  return e.historial.filter((h) => h.nro > hasta && (!h.para || h.para.includes(pid)) && e.ahora - h.t < ESPERA_LECTURA_MS).length;
}
export function esperaLectura(e) {
  return humanosVivos(e).some((x) => { const j = e.jugadores[x]; return j.conectado === true && j.extra?.leidoHasta != null && cartasSinCerrar(e, x) > 0; });   // solo clientes que avisan lo leído
}

export function turnoNPC(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno;
  if (!j || j.eliminado) { if (t) t.fin = true; return; }
  if (t.omitido || j.perdido) { t.fin = true; return; }
  aligerar(data, e, pid);
  movimiento(data, e, pid);
  if (j.eliminado) { t.fin = true; return; }
  accionPrincipal(data, e, pid);
}

// Jorge (10 de noviembre): en fácil y normal Yafar NPC carga hasta 10 objetos sin animal; si lleva más, antes de moverse vende al mercado
// (o regala, si no tienen precio) los de menos valor hasta quedar en 10. Así nunca se queda atorado en una ciudad.
export function aligerar(data, e, pid) {
  const j = e.jugadores[pid];
  const valor = (c) => (c.tipo === 'objeto' ? objDe(data, c.ref)?.valor : ITEMS[c.ref]?.precio) || 0;
  const intentados = new Set();
  for (let k = 0; k < 60 && cargaExcedida(j, e); k++) {
    const c = j.mano.filter((x) => !intentados.has(x.uid) && (x.tipo === 'objeto' || (x.tipo === 'item' && CARGA_ITEMS.includes(x.ref)))).sort((a, b) => valor(a) - valor(b))[0];
    if (!c) break;
    intentados.add(c.uid); vender(data, e, pid, { uid: c.uid });
  }
}

function elegirDestino(data, e, pid) {
  const j = e.jugadores[pid];
  const otros = enPartida(e).filter((x) => x !== pid && !e.jugadores[x].transito);
  const primero = (f) => { let mejor = null; for (const x of otros) if (mejor === null || f(e.jugadores[x]) > f(e.jugadores[mejor])) mejor = x; return mejor; };   // empate: primero en orden
  const d = dado(e);
  const { dist, prev } = dijkstra(data, e, j, j.ciudad);
  const alcanzables = Object.keys(dist).filter((c) => c !== j.ciudad);
  let destino = null, motivo = '';
  const porJugador = (x, txt) => { if (!x) return null; const c = e.jugadores[x].ciudad; return c !== j.ciudad && dist[c] !== undefined ? c : null; };
  if (d <= 2) { destino = porJugador(primero((q) => q.dinares)); motivo = 'va tras el jugador con más dinares'; }
  else if (d >= 5) { destino = porJugador(primero((q) => q.noches)); motivo = 'va tras el jugador con más noches'; }
  if (!destino) {
    motivo = 'busca la ciudad que da más noches';
    let mejor = null;
    for (const c of alcanzables) {
      const p = camino(prev, j.ciudad, c);
      if (!p || p.length > 3 || c === j.ciudadPrevia) continue;
      const ci = ciudadDe(data, c), conGente = enCiudad(e, c, pid).some((x) => !e.jugadores[x].npc);
      const noches = (j.visitadas.includes(c) ? ci.nochesLuego : ci.nochesLlegada) / (conGente ? 1 : 2);   // solo cobra completo donde hay jugadores
      if (!mejor || noches > mejor.noches || (noches === mejor.noches && dist[c] < dist[mejor.c])) mejor = { c, noches };
    }
    destino = mejor?.c || null;
  }
  return { d, destino, motivo, prev };
}

function movimiento(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno;
  const { d, destino, motivo, prev } = elegirDestino(data, e, pid);
  mostrarDados(e, { por: pid, motivo: 'npc:Yafar', npc: true, grupos: [{ etq: 'Yafar NPC: dado de movimiento', valores: [d] }], resumen: [] });
  if (!destino) { log(e, 'Yafar NPC no encuentra caravana y se queda donde está.'); return; }
  const ruta = camino(prev, j.ciudad, destino);
  if (!ruta) return;
  log(e, `Yafar NPC (dado ${d}) ${motivo}: rumbo a ${destino}.`, { pid });
  for (const paso of ruta.slice(1, 3)) {
    if (j.eliminado) return;
    HOOK.partir(data, e, pid, { destino: paso, precio: 0, servicios: false, hilo: false });
  }
  void t;
}

function accionPrincipal(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno;
  const cont = { fn: 'npc.cierre', args: { pid } };
  if (!t.principal && !t.bloqueoPrincipal) {
    // (a) ataque
    if (e.ronda > data.config.primerosTurnosSinMatar) {
      const objetivos = enCiudad(e, j.ciudad, pid).filter((x) => !e.jugadores[x].npc);
      objetivos.sort((a, b) => e.jugadores[b].dinares - e.jugadores[a].dinares || e.orden.indexOf(a) - e.orden.indexOf(b));
      if (objetivos.length) {
        const x = dado(e);
        // Jorge (8 de noviembre): cuando Yafar NPC va contra alguien, sí hay alerta que se cierra (4 s mínimo) y dice qué le hace y a quién
        const aviso = mostrarDados(e, { por: pid, motivo: 'npc:Yafar', npc: true, alerta: true, grupos: [{ etq: 'Yafar NPC: 1-3 asalto, 4-6 duelo', valores: [x] }], resumen: [] });
        const orden = x <= 3 ? ['robo', 'duelo'] : ['duelo', 'robo'];
        for (const obj of objetivos) for (const tipo of orden) {
          if (validarAtaque(data, e, pid, { tipo, objetivo: obj }, { npc: true }).ok) {
            const r = atacar(data, e, pid, { tipo, objetivo: obj, noRechazable: true }, { npc: true, cont });
            if (r.ok) { aviso?.resumen?.push(`${j.nombre} va contra ${e.jugadores[obj].nombre}: ${tipo === 'robo' ? 'lo asalta para robarle' : 'lo reta a duelo'}.`); return; }
          }
        }
      }
    }
    // (b) Yafar NPC ya no contrata a los Asesinos (regla de la casa del juego en línea)
    // (c) una carta de Cuentos respondida con un dado
    const x = dado(e);
    const premio = data.config.premioTrivia;
    mostrarDados(e, { por: pid, motivo: 'npc:Yafar', npc: true, grupos: [{ etq: 'Yafar NPC responde una CC (4-6 acierta)', valores: [x] }], resumen: [x >= 4 ? `Yafar NPC acierta y cobra ${premio} dinares.` : 'Yafar NPC falla la pregunta.'] });
    if (x >= 4) j.dinares += premio;
    t.principal = true;
  }
  cierre(data, e, pid);
}

function cierre(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno;
  if (!j || j.eliminado) { if (t) t.fin = true; return; }
  const precio = (ref) => data.config.armas?.[ref]?.precio ?? { cimitarra: 35, alfanje: 25, arco: 15 }[ref];
  if (j.dinares > 60) {
    for (const ref of ['cimitarra', 'alfanje', 'arco']) {
      if (tieneItem(j, ref)) break;
      if (j.dinares >= precio(ref) + (ref === 'arco' ? 5 : 0)) {
        j.dinares -= precio(ref); j.mano.push({ uid: uid(e), tipo: 'item', ref });
        if (ref === 'arco' && !tieneItem(j, 'flechas')) { j.dinares -= 5; j.mano.push({ uid: uid(e), tipo: 'item', ref: 'flechas' }); }
        log(e, `Yafar NPC compra ${ref}.`, { pid });
        break;
      }
    }
  }
  if (!t.movio) { const c = ciudadDe(data, j.ciudad); pagar(data, e, pid, c.alojamiento * 2); log(e, 'Yafar NPC paga el doble de alojamiento.', { pid }); }
  j.ciudadPrevia = t.movio ? t.ciudadInicio : j.ciudadPrevia;
  t.fin = true;
}
registrar('npc.cierre', (data, e, args) => { if (e.turno && e.turno.pid === args.pid) cierre(data, e, args.pid); });

// ---------------------------------------------------------------- bolsa de parientes y entrada del NPC
export function finRonda(data, e) {
  const id = npcDe(e);
  if (!id) return;
  const n = { facil: 0, normal: 5, dificil: 10 }[e.opciones?.dificultad || 'normal'] ?? 5;
  if (n) { e.jugadores[id].dinares += n; log(e, `Yafar NPC cobra ${n} dinares de la bolsa de sus parientes.`, { pid: id }); }
}

export function entraNPC(data, e) {
  const hv = humanosVivos(e);
  if (hv.length !== 1 || e.jugadores[hv[0]].pj === 'B' || e.jugadores.npc) return;
  const p = pjDe(data, 'B');
  const j = HOOK.nuevoJugador(e, 'npc', 'Yafar el Bermekí (NPC)', null);
  Object.assign(j, { pj: 'B', listo: true, npc: true, dinares: p.inicio.dinares, ciudad: 'Bagdad', visitadas: ['Bagdad'], destreza: true, mano: [{ uid: uid(e), tipo: 'item', ref: 'jambiya' }] });
  e.jugadores.npc = j;
  const iAdi = e.orden.findIndex((i) => e.jugadores[i].pj === '7' && !e.jugadores[i].eliminado);
  if (iAdi >= 0) e.orden.splice(iAdi, 0, 'npc'); else e.orden.push('npc');
  log(e, 'Solo queda un jugador con vida: entra Yafar NPC en Bagdad y la partida sigue como en el modo solitario.');
}

// ---------------------------------------------------------------- Los Asesinos (R 13)
const objetivosValidos = (e, pid) => enPartida(e).filter((x) => x !== pid);

// Regla de la casa (contratar en Samarcanda): hace falta tener 500 noches; quien contrata lanza un dado y el precio es
// dado × rondas jugadas × 35 dinares (Zubayda, la mitad). Si le alcanza, paga y firma; si no, los Asesinos lo dejan herido
// en el Jorasán por hacerles perder el tiempo y queda Buscado.
export const NOCHES_ASESINOS = 500, PRECIO_ASESINOS = 35;
const rangoPrecio = (e, j) => { const f = (d) => Math.ceil(d * Math.max(1, e.ronda) * PRECIO_ASESINOS / (j.pj === '6' ? 2 : 1)); return [f(1), f(6)]; };
const textoPrecio = (e, j) => { const [a, b] = rangoPrecio(e, j); return `Precio: tu dado × rondas jugadas × ${PRECIO_ASESINOS} dinares${j.pj === '6' ? ' (Zubayda paga la mitad)' : ''}; en la ronda ${e.ronda}: entre ${a.toLocaleString('es-MX')} y ${b.toLocaleString('es-MX')} dinares.`; };
export function disponibles(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno;
  if (!puedePrincipal(t) || j.transito || j.perdido || j.ciudad !== 'Samarcanda' || e.asesinos.actuaron || vivos(e) <= 2) return [];
  const falta = j.noches < NOCHES_ASESINOS;
  return [{ k: 'asesinos', bloqueado: falta ? `Necesitas al menos ${NOCHES_ASESINOS} noches.` : undefined, titulo: 'Contratar a los Asesinos', texto: `${textoPrecio(e, j)} Lanzas tú el dado. Si te alcanza, pagas y firmas; si no, te dejan herido en el Jorasán y quedas Buscado. Atacan al final del siguiente turno de la víctima. Contratar termina tu turno.` }];
}

export function contratar(data, e, pid, a) {
  const t = e.turno, j = e.jugadores[pid];
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (!puedePrincipal(t)) return err('Ya usaste tu acción principal.');
  if (j.ciudad !== 'Samarcanda') return err('Los Asesinos se contratan en Samarcanda.');
  if (j.noches < NOCHES_ASESINOS) return err(`Los Asesinos solo tratan con quien tiene al menos ${NOCHES_ASESINOS} noches.`);
  return iniciarContrato(data, e, pid, { accion: true });
}
function iniciarContrato(data, e, pid, args) {
  if (e.jugadores[pid]?.npc) return err('Yafar NPC no contrata a los Asesinos.');
  if (e.asesinos.actuaron) return err('Los Asesinos ya actuaron.');
  if (vivos(e) <= 2) return err('Si solo quedan dos jugadores vivos, los Asesinos hacen caso omiso.');
  const op = objetivosValidos(e, pid).map((x) => ({ id: x, texto: nombre(e, x) }));
  op.push({ id: 'cancelar', texto: 'No contratar' });
  pedir(e, { tipo: 'asesinos', para: [pid], titulo: 'Los Asesinos', texto: `Elige a la víctima. ${textoPrecio(e, e.jugadores[pid])} Después lanzas el dado: si no te alcanza, te dejan herido en el Jorasán y quedas Buscado.`, opciones: op, porDefecto: 'cancelar', limiteMs: 60000, cont: { fn: 'npc.victima', args } });
  return ok();
}
HOOK.contratarAsesinos = (data, e, pid, args) => { iniciarContrato(data, e, pid, args || {}); };
HOOK.avisoMasrur = (e, pid) => avisoMasrur(e, pid);

registrar('npc.victima', (data, e, args, resp) => {
  const pid = resp.pid;
  if (resp.opcion === 'cancelar' || !e.jugadores[resp.opcion] || e.jugadores[resp.opcion].eliminado || e.asesinos.actuaron) return;
  const v = resp.opcion, d = dado(e), j = e.jugadores[pid];
  const precio = Math.ceil(d * Math.max(1, e.ronda) * PRECIO_ASESINOS / (j.pj === '6' ? 2 : 1));
  const alcanza = j.dinares >= precio;
  mostrarDados(e, { por: pid, motivo: 'asesinos', titulo: 'Contrato con los Asesinos', grupos: [{ etq: `${j.nombre}: dado del precio (dado × ${Math.max(1, e.ronda)} rondas × ${PRECIO_ASESINOS}${j.pj === '6' ? ' ÷ 2' : ''})`, valores: [d] }],
    resumen: [`Precio: ${precio.toLocaleString('es-MX')} dinares.`, alcanza ? `${j.nombre} paga y firma el contrato.` : `${j.nombre} no tiene ${precio.toLocaleString('es-MX')} dinares: los Asesinos lo dejan herido en el Jorasán por hacerles perder el tiempo.`] });
  if (alcanza) return firmar(data, e, pid, v, precio, args);
  castigoPorTiempo(data, e, pid);
});
// Única excepción a «si no te alcanza, no pasa nada»: a los Asesinos no se les hace perder el tiempo.
function castigoPorTiempo(data, e, pid) {
  const j = e.jugadores[pid];
  j.herido = true; j.perdido = true; j.ciudad = 'Jorasán'; j.transito = null; j.extra.enRumbo = false; marcarBuscado(data, e, j, { tipo: 'asesinosSinPago' });
  if (e.turno && e.turno.pid === pid) { e.turno.principal = true; e.turno.fin = true; }
  log(e, `${j.nombre} intentó contratar a los Asesinos y no pudo pagar: lo dejan herido en el Jorasán por hacerles perder el tiempo y queda Buscado ${data.config.buscadoRondas} rondas (quien lo mate gana ${data.config.recompensaBuscadoDinares ?? 100} dinares y ${data.config.recompensaBuscado} noches).`, { pid, aviso: true });
}
registrar('npc.firma', (data, e, args, resp) => {
  if (resp.opcion !== 'si' || e.jugadores[resp.pid].dinares < args.precio) return;
  firmar(data, e, resp.pid, args.victima, args.precio, args);
});
// Regla de la casa: al firmar, los Asesinos no matan al instante sino al final del siguiente turno de la víctima. Quien
// sobornó a Masrur recibe un aviso privado y puede huir al Jorasán, donde no la encuentran. Todo se hace público cuando actúan.
export const AVISO_HUIDA = 'Huye al Jorasán antes de que termine tu próximo turno: con caballo, camello o burro (acción principal, desde cualquier ciudad; desde India, solo en burro) o pagando a los piratas en Yemen. Allí los Asesinos no te encontrarán.';
function firmar(data, e, pid, v, precio, args = {}) {
  if (e.asesinos.actuaron || e.jugadores[v]?.eliminado) return;
  const j = e.jugadores[pid], vic = e.jugadores[v];
  j.dinares -= precio;                                                   // siempre en dinares (se comprobó antes de firmar)
  e.asesinos.actuaron = true; e.asesinos.contrato = { por: pid, victima: v, ronda: e.ronda };
  e.asesinos.pendiente = { por: pid, victima: v, precio, turnoVictima: vic.turnos };
  if (e.turno && e.turno.pid === pid) { e.turno.principal = true; e.turno.fin = true; }   // contratar termina el turno
  marcarBuscado(data, e, j, { tipo: 'asesinos' });                       // regla de la casa: se sabe QUIÉN los contrató, nunca contra quién
  log(e, `${j.nombre} contrató a los Asesinos y queda Buscado ${data.config.buscadoRondas} rondas (quien lo mate gana ${data.config.recompensaBuscadoDinares ?? 100} dinares y ${data.config.recompensaBuscado} noches). La víctima es secreta.`, { pid, aviso: true });
  if (!j.npc) pedirEncargo(data, e, pid);
  info(e, pid, 'Contrato firmado', `Los Asesinos irán por ${vic.nombre} al final de su próximo turno. Nadie más sabe contra quién.`);
  if (vic.extra?.masrur) avisoMasrur(e, v);
}
// Regla de la casa: el contratante gana las 200 noches solo si cumple el encargo que elige de los Asesinos (plazo: 3 rondas).
export const ENCARGO_RONDAS = 3, LEJANAS = ['Andalucía', 'Magreb', 'Yemen', 'India'];
const ARMAS_ORDEN = ['cimitarra', 'alfanje', 'jambiya', 'arco'];
function pedirEncargo(data, e, pid) {
  const j = e.jugadores[pid], arma = ARMAS_ORDEN.find((r) => tieneItem(j, r));
  const ciudad = LEJANAS.filter((c) => c !== j.ciudad)[Math.floor(rnd(e) * 3)];
  pedir(e, { tipo: 'asesinos', para: [pid], titulo: 'El encargo de los Asesinos', texto: `Los Asesinos te pagarán 200 noches si les haces un favor en ${ENCARGO_RONDAS} rondas. Elige uno:`,
    opciones: [{ id: 'arma', texto: arma ? `Entregarles tu mejor arma ahora (${arma})` : 'Entregarles tu mejor arma (no tienes ninguna)', desactivada: !arma },
      { id: 'reto', texto: 'Cumplir un reto en Samarcanda o Isfahán' }, { id: 'mensaje', texto: `Llevar su mensaje a ${ciudad}` }, { id: 'nada', texto: 'Ningún encargo (sin las 200 noches)' }],
    porDefecto: 'nada', limiteMs: 60000, cont: { fn: 'npc.encargo', args: { ciudad, arma } } });
}
registrar('npc.encargo', (data, e, args, resp) => {
  const j = e.jugadores[resp.pid]; if (!j) return;
  if (resp.opcion === 'nada') return;
  if (resp.opcion === 'arma') { if (args.arma && tieneItem(j, args.arma)) { quitarPrimero(j, 'item', args.arma); cumplirEncargo(e, resp.pid, `entregaste tu ${args.arma}`); } return; }
  j.extra.encargoAsesinos = { tipo: resp.opcion, ciudad: args.ciudad, hasta: e.ronda + ENCARGO_RONDAS, retos: j.retosHechos.slice() };
  info(e, resp.pid, 'Encargo aceptado', resp.opcion === 'reto' ? `Cumple un reto en Samarcanda o Isfahán antes de que acabe la ronda ${e.ronda + ENCARGO_RONDAS}.` : `Lleva el mensaje de los Asesinos a ${args.ciudad} antes de que acabe la ronda ${e.ronda + ENCARGO_RONDAS}.`);
});
function cumplirEncargo(e, pid, como) {
  const j = e.jugadores[pid]; j.noches += 200; delete j.extra.encargoAsesinos;
  info(e, pid, 'Encargo cumplido', `Los Asesinos cumplen su palabra: ${como}. Ganas 200 noches.`);
}
// Se revisa al llegar a una ciudad, al cerrar cada turno y al final de cada ronda (plazo).
export function revisarEncargo(data, e, pid) {
  const j = e.jugadores[pid], enc = j?.extra?.encargoAsesinos; if (!enc || j.eliminado) return;
  if (enc.tipo === 'mensaje' && j.ciudad === enc.ciudad) return cumplirEncargo(e, pid, `llevaste su mensaje a ${enc.ciudad}`);
  if (enc.tipo === 'reto') {
    const nuevo = j.retosHechos.find((r) => !enc.retos.includes(r) && ['Samarcanda', 'Isfahán'].includes((data.retos.retos || data.retos).find((x) => x.id === r)?.ciudad));
    if (nuevo) return cumplirEncargo(e, pid, `cumpliste el reto ${nuevo}`);
  }
  if (e.ronda > enc.hasta) { delete j.extra.encargoAsesinos; info(e, pid, 'Encargo vencido', 'No cumpliste a tiempo el encargo de los Asesinos: no ganas las 200 noches.'); }
}
export function avisoMasrur(e, v) {
  info(e, v, 'Masrur te avisa en secreto', `Alguien contrató a los Asesinos contra ti. Actuarán al final de tu próximo turno. ${AVISO_HUIDA}`);
}
// Al cerrar el turno siguiente de la víctima: la matan, salvo que esté en el Jorasán (o de camino), y todo se anuncia.
export function actuanAsesinos(data, e) {
  const p = e.asesinos?.pendiente; if (!p) return;
  const vic = e.jugadores[p.victima], j = e.jugadores[p.por];
  if (!vic || vic.eliminado || vic.turnos <= p.turnoVictima) { if (vic?.eliminado) { e.asesinos.pendiente = null; log(e, 'Los Asesinos llegan tarde: su víctima ya no está. Se retiran para siempre.'); } return; }
  e.asesinos.pendiente = null;
  if (vic.perdido || vic.transito?.jorasan) {
    log(e, `Los Asesinos buscan a ${vic.nombre}, pero no la encuentran: se escondió en el Jorasán. Se retiran para siempre.`, { pid: p.victima, aviso: true });
    return;
  }
  // La víctima se defiende con el sistema de 2 dados, pero sus bonos cuentan a la mitad y los Asesinos suman +4 en «normal» (empate: ganan ellos).
  // Sin nada se salva ~10 %; con +6 (armas +4, destreza y escudo) ~34 %. Si gana, queda herida y despierta en el Jorasán sin dinares ni noches.
  const titulo = `Los Asesinos atacan a ${vic.nombre}`, v = p.victima;
  let K = bonoAsesinos(e); const extra = [];
  if (conArco(data, e, v, vic.ciudad)) {
    quitarPrimero(vic, 'item', 'flechas'); const x = dado(e);
    const efecto = x >= 3 ? 1 : 0; K -= efecto;
    mostrarDados(e, { por: v, npc: !!vic.npc, motivo: 'pelea', titulo, boton: 'Disparar flecha', grupos: [{ etq: `${vic.nombre} dispara una flecha a los Asesinos (3 a 6 los frena)`, valores: [x] }], resumen: [efecto ? 'La flecha frena a los Asesinos: −1.' : 'La flecha falla.'] });
    if (efecto) extra.push('flecha −1');
  }
  const b = bonosCombate(data, e, v, 'def', vic.ciudad), mitad = Math.floor(Math.max(0, b.total) / 2) + Math.min(0, b.total);
  const rv = dados(e, 2), ra = dados(e, 2), tv = suma(rv) + mitad, ta = suma(ra) + K;
  mostrarDados(e, { por: v, npc: !!vic.npc, motivo: 'pelea', titulo, grupos: [{ etq: `${vic.nombre} se defiende de los Asesinos`, valores: rv }], resumen: [`${vic.nombre} saca ${rv.join(' + ')}.`] });
  const salva = tv > ta;
  mostrarDados(e, { por: v, npc: true, motivo: 'pelea', titulo, grupos: [{ etq: 'Los Asesinos', valores: ra }], resumen: [
    `${vic.nombre}: dados ${rv.join(' + ')} = ${suma(rv)} · bonos ${b.partes.join(' · ') || 'ninguno'} (cuentan a la mitad: ${mitad >= 0 ? '+' : ''}${mitad}) → total ${tv}.`,
    `Los Asesinos: dados ${ra.join(' + ')} = ${suma(ra)} · maestría +${bonoAsesinos(e)}${extra.length ? ' · ' + extra.join(' · ') : ''} → total ${ta}.`,
    salva ? `${vic.nombre} sobrevive: queda herido y despierta en el Jorasán sin dinares ni noches.` : `${vic.nombre} muere a manos de los Asesinos, que se retiran para siempre.`] });
  if (salva) {
    vic.herido = true; vic.dinares = 0; vic.noches = 0; vic.transito = null; vic.perdido = true; vic.ciudad = 'Jorasán'; vic.extra.enRumbo = false;
    log(e, `${vic.nombre} sobrevive a los Asesinos: queda herido y despierta en el Jorasán sin dinares ni noches (conserva sus cartas).`, { pid: v, aviso: true });
    return;
  }
  log(e, `${vic.nombre} muere a manos de los Asesinos, que se retiran para siempre.`, { pid: v, aviso: true });
  eliminar(data, e, v, { por: j && !j.eliminado ? p.por : null, soloNoches: true, causa: 'Asesinos' });
}
export const ASESINOS_BONO = 4;
// Dificultad de los Asesinos (aparte de la de Yafar NPC; en línea empieza en fácil): fácil +3, normal +4, difícil +5. Una víctima sin bonos se salva
// en el 16 %, el 10 % o el 5 % de los casos; con +2 a la mitad (armas, destreza o escudo), en el 34 %, el 24 % o el 16 %.
export const bonoAsesinos = (e) => ({ facil: 3, normal: ASESINOS_BONO, dificil: 5 })[e.opciones?.dificultadAsesinos || 'facil'] ?? ASESINOS_BONO;   // en línea, fácil si el banco no la cambia

// ---------------------------------------------------------------- carta E1: los Asesinos aparecen (R 13.4)
export function eventoAsesinos(data, e) {
  const viv = activos(e);
  if (viv.length <= 2 || e.asesinos.actuaron) { log(e, 'Los Asesinos pasan de largo: quedan muy pocos jugadores.'); return; }
  // Sorteo con dado y botón (nunca automático), solo entre los jugadores vivos: lo lanza el primer jugador humano de la ronda
  // (si está desconectado, el banco). Con más de 6 jugadores se cuenta en círculo; si sale un número sin jugador, se repite.
  const lanza = e.orden.find((x) => viv.includes(x) && !e.jugadores[x].npc) || viv[0];
  const sortear = (extra = []) => {
    const tabla = viv.map((x, k) => `${k + 1} = ${nombre(e, x)}`).join(', ');
    const tiradas = []; let d;
    for (let g = 0; g < 30; g++) { d = dado(e); tiradas.push(d); if (viv.length >= 6 || d <= viv.length) break; }
    const v = viv[(d - 1) % viv.length];
    mostrarDados(e, { por: lanza, npc: !!e.jugadores[lanza].npc, motivo: 'asesinos', titulo: 'Los Asesinos llegan a la ciudad', grupos: [{ etq: `${nombre(e, lanza)}: sorteo de a quién irán a buscar si nadie compra el contrato`, valores: tiradas }],
      resumen: [...extra, `Números: ${tabla}.${tiradas.length > 1 ? ' Los números sin jugador se repiten.' : ''}`, `Sale ${d}: si nadie compra el contrato, irán a buscar a ${nombre(e, v)}.`] });
    return v;
  };
  let probable = sortear();
  if (tieneObj(e.jugadores[probable], 'OB44')) {
    consumirObj(data, e, probable, 'OB44');
    probable = sortear([`${nombre(e, probable)} se cubre con su Velo de viajero y los Asesinos vuelven a elegir.`]);
  }
  const min = 20 * viv.length;
  const hum = humanosVivos(e);
  const para = hum.filter((x) => e.jugadores[x].dinares >= min);
  e.asesinos.evento = { probable };
  if (!para.length) return sinPuja(data, e, probable);
  pedir(e, { tipo: 'subasta', para, modo: 'todos', titulo: 'Los Asesinos ofrecen sus servicios', texto: `¿Quieres pagar para mandarlos contra alguien? Gana la puja más alta (mínimo ${min} dinares), elige a la víctima y paga su puja + 30 por cada punto del dado de la víctima (si no le alcanza, paga todo lo que tenga). Los Asesinos no fallan; quien gane queda Buscado y toda la mesa lo sabrá. Si nadie puja, irán a buscar a ${nombre(e, probable)}, que podrá escapar herido con 3 a 6.`,
    opciones: [{ id: '0', texto: 'No pujar' }, ...Array.from({ length: 6 }, (_, k) => ({ id: String(min + 20 * k), texto: `Pujar ${min + 20 * k} dinares` }))], porDefecto: '0', limiteMs: 60000, cont: { fn: 'npc.subasta', args: { probable, min } } });
}
registrar('npc.subasta', (data, e, args, resp) => {
  let ganador = null, mejor = 0;
  for (const x of e.orden) {
    const o = resp[x]; if (!o) continue;
    const b = Number(o.opcion || 0), j = e.jugadores[x];
    if (b >= args.min && b > mejor && j && !j.eliminado && j.dinares >= b) { ganador = x; mejor = b; }
  }
  if (!ganador) return sinPuja(data, e, args.probable);
  log(e, `${nombre(e, ganador)} ha comprado el contrato de los Asesinos.`, { pid: ganador, aviso: true });
  const op = objetivosValidos(e, ganador).map((x) => ({ id: x, texto: nombre(e, x) }));
  pedir(e, { tipo: 'asesinos', para: [ganador], titulo: 'Has ganado la subasta', texto: `Pagarás ${mejor} dinares más 30 por cada punto del dado de la víctima. Elige a la víctima (no puedes ser tú).`, opciones: op, porDefecto: op[0].id, limiteMs: 60000, cont: { fn: 'npc.victimaE1', args: { puja: mejor, probable: args.probable } } });
});
registrar('npc.victimaE1', (data, e, args, resp) => {
  const v = resp.opcion;
  if (!e.jugadores[v] || e.jugadores[v].eliminado || e.asesinos.actuaron) return;
  const d = dado(e);
  mostrarDados(e, { por: resp.pid, motivo: 'asesinos', titulo: 'Contrato con los Asesinos', grupos: [{ etq: `${nombre(e, resp.pid)}: dado del precio (su puja + 30 por punto)`, valores: [d] }], resumen: [`Precio final: ${args.puja} + ${d} × 30 = ${args.puja + 30 * d} dinares.`] });   // la víctima es secreta: lanza quien contrata
  // Regla de la casa: si no le alcanza el precio final no hay trato ni pago; los Asesinos lo dejan herido en el Jorasán y
  // queda Buscado, y vuelven a ir por la víctima sorteada.
  const total = args.puja + 30 * d, j = e.jugadores[resp.pid];
  if (j.dinares < total) { castigoPorTiempo(data, e, resp.pid); return sinPuja(data, e, args.probable && !e.jugadores[args.probable]?.eliminado ? args.probable : v); }
  firmar(data, e, resp.pid, v, total, {});
});
function sinPuja(data, e, probable) {
  const x = dado(e), j = e.jugadores[probable];
  mostrarDados(e, { por: probable, motivo: 'asesinos', grupos: [{ etq: `${j.nombre}: ¿escapas de los Asesinos? Con 3 a 6 te salvas herido; con 1 o 2 mueres`, valores: [x] }], resumen: [x >= 3 ? `${j.nombre} escapa de los Asesinos y queda herido.` : `${j.nombre} muere a manos de los Asesinos.`] });
  e.asesinos.actuaron = true;
  log(e, 'Los Asesinos (Hashashín) se retiran para siempre.');
  if (x >= 3) { j.herido = true; return; }
  eliminar(data, e, probable, { causa: 'Asesinos' });
}

void suma; void patrimonio;
