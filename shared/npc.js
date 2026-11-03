// Yafar el Bermekí NPC (R 20.4, 21), entrada del NPC al quedar un solo jugador (R 22.4) y Los Asesinos (R 13).
import {
  ok, err, rnd, dado, suma, log, nombre, ciudadDe, pjDe, activos, humanosVivos, enCiudad, mostrarDados, pedir, registrar, eliminar, pagar, puedePagar, tarifa, HOOK,
  puedePrincipal, tieneItem, tieneObj, consumirObj, uid, vivos, patrimonio,
} from './base.js';
import { atacar, validarAtaque } from './pelea.js';

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
  movimiento(data, e, pid);
  if (j.eliminado) { t.fin = true; return; }
  accionPrincipal(data, e, pid);
}

function elegirDestino(data, e, pid) {
  const j = e.jugadores[pid];
  const otros = activos(e).filter((x) => x !== pid && !e.jugadores[x].transito);
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
        mostrarDados(e, { por: pid, motivo: 'npc:Yafar', npc: true, grupos: [{ etq: 'Yafar NPC: 1-3 asalto, 4-6 duelo', valores: [x] }], resumen: [] });
        const orden = x <= 3 ? ['robo', 'duelo'] : ['duelo', 'robo'];
        for (const obj of objetivos) for (const tipo of orden) {
          if (validarAtaque(data, e, pid, { tipo, objetivo: obj }, { npc: true }).ok) {
            const r = atacar(data, e, pid, { tipo, objetivo: obj, noRechazable: true }, { npc: true, cont });
            if (r.ok) return;
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
  if (e.firmanes > 0) { e.firmanes--; j.mano.push({ uid: uid(e), tipo: 'especial', ref: 'F1' }); }
  e.jugadores.npc = j;
  const iAdi = e.orden.findIndex((i) => e.jugadores[i].pj === '7' && !e.jugadores[i].eliminado);
  if (iAdi >= 0) e.orden.splice(iAdi, 0, 'npc'); else e.orden.push('npc');
  log(e, 'Solo queda un jugador con vida: entra Yafar NPC en Bagdad y la partida sigue como en el modo solitario.');
}

// ---------------------------------------------------------------- Los Asesinos (R 13)
const objetivosValidos = (e, pid) => activos(e).filter((x) => x !== pid);

export function disponibles(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno;
  if (!puedePrincipal(t) || j.transito || j.perdido || j.ciudad !== 'Samarcanda' || e.asesinos.actuaron || vivos(e) <= 2) return [];
  const min = precioContrato(e, 1) / (j.pj === '6' ? 2 : 1);
  return [{ k: 'asesinos', titulo: 'Contratar a los Asesinos (opción 4 de R 12.3)' + (j.dinares < min ? ` (necesitas al menos ${min} dinares)` : ''), texto: `Precio: 20 dinares por jugador vivo + 30 por cada punto del dado de la víctima, solo en dinares. Nunca fallan y solo actúan una vez. Al contratarlos tu turno termina, quedas Buscado ${data.config.buscadoRondas} rondas y todos sabrán a quién mandaste matar.` }];
}

export function contratar(data, e, pid, a) {
  const t = e.turno, j = e.jugadores[pid];
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (!puedePrincipal(t)) return err('Ya usaste tu acción principal.');
  if (j.ciudad !== 'Samarcanda') return err('Los Asesinos se contratan en Samarcanda.');
  const min = precioContrato(e, 1) / (j.pj === '6' ? 2 : 1);
  if (j.dinares < min) return err(`Los Asesinos cobran en dinares y como mínimo ${min}: no te alcanza.`);
  return iniciarContrato(data, e, pid, { accion: true });
}
function iniciarContrato(data, e, pid, args) {
  if (e.jugadores[pid]?.npc) return err('Yafar NPC no contrata a los Asesinos.');
  if (e.asesinos.actuaron) return err('Los Asesinos ya actuaron.');
  if (vivos(e) <= 2) return err('Si solo quedan dos jugadores vivos, los Asesinos hacen caso omiso.');
  const op = objetivosValidos(e, pid).map((x) => ({ id: x, texto: nombre(e, x) }));
  op.push({ id: 'cancelar', texto: 'No contratar' });
  pedir(e, { tipo: 'asesinos', para: [pid], titulo: 'Los Asesinos', texto: 'Elige a la víctima. Los Asesinos nunca fallan y solo actúan una vez; toda la mesa sabrá quién los contrató y contra quién.', opciones: op, porDefecto: 'cancelar', limiteMs: 60000, cont: { fn: 'npc.victima', args } });
  return ok();
}
HOOK.contratarAsesinos = (data, e, pid, args) => { iniciarContrato(data, e, pid, args || {}); };

const precioContrato = (e, d) => 20 * vivos(e) + 30 * d;
registrar('npc.victima', (data, e, args, resp) => {
  const pid = resp.pid;
  if (resp.opcion === 'cancelar' || !e.jugadores[resp.opcion] || e.jugadores[resp.opcion].eliminado || e.asesinos.actuaron) return;
  const v = resp.opcion, d = dado(e);
  let precio = precioContrato(e, d);
  const j = e.jugadores[pid];
  const zub = j.pj === '6';
  if (zub) precio = Math.ceil(precio / 2);
  mostrarDados(e, { por: v, motivo: 'asesinos', grupos: [{ etq: `${nombre(e, v)}: dado de la víctima`, valores: [d] }], resumen: [`Los Asesinos fijan su precio: ${vivos(e)} jugadores vivos × 20 + ${d} × 30.`] });
  const alcanza = j.dinares >= precio;                                    // regla de la casa: solo con los dinares completos, sin deudas
  pedir(e, { tipo: 'asesinos', para: [pid], titulo: 'Precio del contrato', texto: `Víctima: ${nombre(e, v)} (dado ${d}). Precio: ${precio} dinares${zub ? ' (con tu descuento del 50%)' : ''}.${alcanza ? '' : ' No te alcanzan los dinares: no puedes firmar.'} Si firmas, tu turno termina, quedas Buscado y todos sabrán que mandaste matar a ${nombre(e, v)}.`,
    opciones: [{ id: 'si', texto: `Pagar ${precio}`, desactivada: !alcanza }, { id: 'no', texto: 'No firmar' }], porDefecto: 'no', limiteMs: 60000, cont: { fn: 'npc.firma', args: { ...args, victima: v, precio } } });
});
registrar('npc.firma', (data, e, args, resp) => {
  if (resp.opcion !== 'si' || e.jugadores[resp.pid].dinares < args.precio) return;
  firmar(data, e, resp.pid, args.victima, args.precio, args);
});
function firmar(data, e, pid, v, precio, args = {}) {
  if (e.asesinos.actuaron || e.jugadores[v]?.eliminado) return;
  const j = e.jugadores[pid];
  j.dinares -= precio;                                                   // siempre en dinares (se comprobó antes de firmar)
  e.asesinos.actuaron = true; e.asesinos.contrato = { por: pid, victima: v, ronda: e.ronda };
  j.noches += 200;
  // Regla de la casa: el contrato es público, deja Buscado al contratante y termina su turno.
  j.buscado = data.config.buscadoRondas;
  if (e.turno && e.turno.pid === pid) { e.turno.principal = true; e.turno.fin = true; }
  const vic = e.jugadores[v];
  log(e, `${j.nombre} contrató a los Asesinos contra ${vic.nombre} y queda Buscado ${data.config.buscadoRondas} rondas (quien lo mate gana ${data.config.recompensaBuscado} noches).`, { pid, aviso: true });
  log(e, 'Los Asesinos (Hashashín) actúan y se retiran para siempre.');
  log(e, `${vic.nombre} muere a manos de los Asesinos.`, { pid: v });
  eliminar(data, e, v, { por: pid, soloNoches: true, causa: 'Asesinos' });
}

// ---------------------------------------------------------------- carta E1: los Asesinos aparecen (R 13.4)
export function eventoAsesinos(data, e) {
  const viv = activos(e);
  if (viv.length <= 2 || e.asesinos.actuaron) { log(e, 'Los Asesinos pasan de largo: quedan muy pocos jugadores.'); return; }
  let i; do { i = 1 + Math.floor(rnd(e) * 8); } while (i > viv.length);
  let probable = viv[i - 1];
  if (tieneObj(e.jugadores[probable], 'OB44')) {
    consumirObj(data, e, probable, 'OB44');
    log(e, `${nombre(e, probable)} se cubre con su Velo de viajero y los Asesinos vuelven a elegir.`, { pid: probable });
    do { i = 1 + Math.floor(rnd(e) * 8); } while (i > viv.length);
    probable = viv[i - 1];
  }
  mostrarDados(e, { por: probable, motivo: 'asesinos', npc: true, grupos: [{ etq: 'Víctima probable de los Asesinos', valores: [Math.min(6, i)] }], resumen: [`Víctima probable: ${nombre(e, probable)}.`] });
  const min = 20 * viv.length;
  const hum = humanosVivos(e);
  const para = hum.filter((x) => e.jugadores[x].dinares >= min);
  e.asesinos.evento = { probable };
  if (!para.length) return sinPuja(data, e, probable);
  pedir(e, { tipo: 'subasta', para, modo: 'todos', titulo: 'Los Asesinos llegan a la ciudad', texto: `Se subasta su contrato en secreto (mínimo ${min} dinares). El mejor postor elige a la víctima; los Asesinos no fallan. Víctima probable si nadie puja: ${nombre(e, probable)}.`,
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
  mostrarDados(e, { por: v, motivo: 'asesinos', grupos: [{ etq: `${nombre(e, v)}: dado de la víctima`, valores: [d] }], resumen: [`Precio final: ${args.puja} + ${d} × 30 dinares.`] });
  const total = args.puja + 30 * d;
  if (e.jugadores[resp.pid].dinares < total) { log(e, `${nombre(e, resp.pid)} no tiene los ${total} dinares del precio final: los Asesinos rompen el trato.`, { pid: resp.pid, aviso: true }); return sinPuja(data, e, args.probable && !e.jugadores[args.probable]?.eliminado ? args.probable : v); }
  firmar(data, e, resp.pid, v, total, {});
});
function sinPuja(data, e, probable) {
  const x = dado(e), j = e.jugadores[probable];
  mostrarDados(e, { por: probable, motivo: 'asesinos', grupos: [{ etq: `${j.nombre}: ¿escapa de los Asesinos? (3 a 6)`, valores: [x] }], resumen: [x >= 3 ? `${j.nombre} escapa de los Asesinos y queda herido.` : `${j.nombre} muere a manos de los Asesinos.`] });
  e.asesinos.actuaron = true;
  log(e, 'Los Asesinos (Hashashín) se retiran para siempre.');
  if (x >= 3) { j.herido = true; return; }
  eliminar(data, e, probable, { causa: 'Asesinos' });
}

void suma; void patrimonio;
