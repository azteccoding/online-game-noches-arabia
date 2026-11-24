// Habilidades de los personajes (R 10): Yafar, Zein, Anís, Ruyán, Jamil, Zubayda y Adí. Nur al Din (reto de honor) y Anís (ventana) viven en pelea.js.
import {
  ok, err, dado, dados, suma, par, log, nombre, activos, enCiudad, mostrarDados, pedir, registrar, eliminar, pagar, puedePagar, devolverPrincipal, puedePrincipal, vivos, info,
enPartida, marcarBuscado, publicarCarta, tieneItem, darItem, } from './base.js';
import { peleaNPC } from './pelea.js';

const jug = (e, id) => e.jugadores[id];
const zeinId = (e) => activos(e).find((x) => jug(e, x).pj === '2') || null;

// ---------------------------------------------------------------- al inicio del turno
export function inicioTurno(data, e, pid) {
  const j = jug(e, pid);
  if (j.pj === 'B') {                                                                          // R 20.2: comisión de bolsillo
    const n = enCiudad(e, j.ciudad, pid).length, eq = data.config.equilibrio || {};
    const c = Math.min(eq.yafarComisionMax ?? 15, (eq.yafarComisionPorJugador ?? 5) * n);   // equilibrio: config.json
    if (c) { j.dinares += c; log(e, `${j.nombre} cobra ${c} dinares de comisión de bolsillo.`, { pid }); }
  }
  const d = j.extra.deudaAsesinos;
  if (d) {                                                                                     // R 10.7: Zubayda debe el resto del contrato máximo 2 turnos
    if (puedePagar(data, j, d.monto)) { pagar(data, e, pid, d.monto); delete j.extra.deudaAsesinos; log(e, `${j.nombre} salda su deuda con los Asesinos.`, { pid }); }
    else if (--d.turnos < 0) { log(e, `${j.nombre} no paga a los Asesinos a tiempo y es asesinada.`, { pid }); eliminar(data, e, pid, { causa: 'deuda con los Asesinos' }); }
  }
}
export function tras() {}

// ---------------------------------------------------------------- Ruyán vende noches (R 10.5)
export function alLlegar(data, e, pid) {
  const j = jug(e, pid), t = e.turno;
  if (!t || j.pj === '5' || j.npc || j.ciudad === 'Bagdad' || j.eliminado) return;
  t.ruyan ||= [];
  if (t.ruyan.includes(j.ciudad)) return;
  const ruy = enPartida(e).find((x) => jug(e, x).pj === '5' && x !== pid && jug(e, x).ciudad === j.ciudad && !jug(e, x).transito);
  if (!ruy) return;
  const r = jug(e, ruy);
  // Jorge (10 de noviembre): comprarle a Ruyán no es obligatorio; se le OFRECE a quien llega (20 noches por 10 dinares) y, si acepta,
  // Ruyán tiene que vender. Sin 10 dinares no hay oferta.
  if (r.noches <= 0 || j.dinares < RUYAN.dinares) return;
  t.ruyan.push(j.ciudad);
  const noches = Math.min(RUYAN.noches, r.noches);
  pedir(e, { tipo: 'trato', para: [pid], titulo: 'El Sabio Ruyán', texto: `${r.nombre} está en ${j.ciudad}: le puedes comprar ${noches} noches por ${RUYAN.dinares} dinares.`,
    opciones: [{ id: 'si', texto: `Comprar (${RUYAN.dinares} dinares)` }, { id: 'no', texto: 'No, gracias' }], porDefecto: 'no', limiteMs: 45000, cont: { fn: 'pj.ruyan', args: { ruyan: ruy } } });
}
export const RUYAN = { noches: 20, dinares: 10 };
registrar('pj.ruyan', (data, e, args, resp) => {
  const j = jug(e, resp.pid), r = jug(e, args.ruyan);
  if (resp.opcion !== 'si' || !r || r.eliminado || r.ciudad !== j.ciudad || j.dinares < RUYAN.dinares || r.noches <= 0) return;
  const noches = Math.min(RUYAN.noches, r.noches);
  j.dinares -= RUYAN.dinares; r.dinares += RUYAN.dinares; r.noches -= noches; j.noches += noches;
  const txt = `${j.nombre} le compra a ${r.nombre} ${noches} noches por ${RUYAN.dinares} dinares.`;
  log(e, txt, { pid: resp.pid }); info(e, args.ruyan, 'El Sabio Ruyán', txt);
});

// ---------------------------------------------------------------- Zubayda: pago en especie y apedreo (R 10.7, 12.6)
export const PRECIO_ZUBAYDA = 7;
export const HAREN_DINARES = 12;   // Jorge (20 de noviembre): 12 dinares por pasar la noche en el harén (antes 16; con el viaje a los palacios)
// Jorge (20 de noviembre): en sus dos primeros turnos Zubayda tiene un viaje gratis (un solo tramo) a Yemen, El Cairo o Damasco, donde el
// Califa tiene palacios para sus primos y la manda como entretenimiento nocturno. Si no lo usa en esos dos turnos, se pierde.
export const PALACIOS = { ciudades: ['Yemen', 'El Cairo', 'Damasco'], turnos: 2 };
// Jorge (19 de noviembre): más riesgo de apedreo: a salvo solo con 4 o 6 (con 1, 2, 3 o 5 intentan apedrearla).
export const salvoApedreo = (x) => x === 4 || x === 6;
export function apedreo(data, e, pid) {
  const j = jug(e, pid), x = dado(e);
  mostrarDados(e, { por: pid, motivo: 'apedreo', grupos: [{ etq: `${j.nombre}: ¿apedreo? (4 o 6 = a salvo)`, valores: [x] }], resumen: [salvoApedreo(x) ? `${j.nombre} está a salvo.` : `Intentan apedrear a ${j.nombre}.`] });
  marcarVergonzoso(e, pid);
  if (salvoApedreo(x)) return;
  castigoApedreo(data, e, pid);
}
// Jorge (19 de noviembre): el apedreo es igual en todas las ciudades (ya no hay excepción en Yemen ni guardias en Bagdad).
function castigoApedreo(data, e, pid) {
  const j = jug(e, pid);
  pedir(e, { tipo: 'apedreo', para: [pid], titulo: 'La gente quiere apedrearte', texto: 'Tira 30 dinares para que los recojan en vez de lincharte, o acepta quedar herido.',
    opciones: [{ id: 'pagar', texto: 'Tirar 30 dinares', desactivada: j.dinares < 30 }, { id: 'herido', texto: 'Quedar herido' }], porDefecto: j.dinares >= 30 ? 'pagar' : 'herido', limiteMs: 30000, cont: { fn: 'pj.apedreo', args: {} } });
}
registrar('pj.apedreo', (data, e, args, resp) => {
  const j = jug(e, resp.pid);
  if (resp.opcion === 'pagar' && j.dinares >= 30) { pagar(data, e, resp.pid, 30); log(e, `${j.nombre} lanza 30 dinares y se libra del linchamiento.`, { pid: resp.pid }); }
  else { j.herido = true; marcarBuscado(data, e, j, { tipo: 'apedreo' }); log(e, `${j.nombre} queda herido por las pedradas y además Buscado (${data.config.buscadoRondas} rondas).`, { pid: resp.pid }); }   // Jorge (19 de noviembre): apedreada, también Buscada
});
function marcarVergonzoso(e, pid) { jug(e, pid).extra.vergonzoso = e.ronda; }

// ---------------------------------------------------------------- Bagdad: delitos y guardias del Califa (R 12.5)
function sobornoGuardias(data, e, pid, ctx) {
  const j = jug(e, pid), n = dado(e);
  ctx.grupos.push({ etq: `${j.nombre}: guardias del Califa`, valores: [n] });
  let costo = 5 * n; if (j.pj === 'B') costo = Math.ceil(costo / 2);
  const r = pagar(data, e, pid, costo);
  ctx.say(`${j.nombre} soborna a ${n} guardia(s) con ${costo} dinares${r.debe ? ' (no alcanza del todo)' : ''}.`);
}

const nuevoCtx = (e, pid, titulo) => ({ grupos: [], res: [], say(x) { this.res.push(x); }, fin() { if (this.grupos.length) mostrarDados(e, { por: pid, motivo: 'pj', grupos: this.grupos, resumen: [titulo, ...this.res] }); else for (const r of [titulo, ...this.res]) log(e, r, { pid }); } });

// ---------------------------------------------------------------- acciones disponibles
export function disponibles(data, e, pid) {
  const j = jug(e, pid), t = e.turno, r = [];
  if (!puedePrincipal(t) || j.transito || j.perdido) return r;
  const aqui = enCiudad(e, j.ciudad, pid).filter((x) => !jug(e, x).npc);
  if (j.pj === '6' && j.ciudad === 'Bagdad') r.push({ k: 'pj', sub: 'haren', titulo: `Pasar la noche en el harén del Califa (+${HAREN_DINARES} dinares, termina tu turno)` });
  if (j.pj === '6' && aqui.length) r.push({ k: 'pj', sub: 'prost', titulo: 'Rentar tu cuerpo (R 12.6)', objetivos: aqui, pidePrecio: j.pj !== '6', texto: j.pj === '6' ? `Entregas al cliente 50 noches de tu haber (o las que tengas) y te paga ${PRECIO_ZUBAYDA} dinares.` : undefined });
  // Jorge (19 de noviembre): Adí ya no tiene «Cuentos de noche».
  // Jamil (Jorge, 8 de noviembre): versos en honra (propuesta: el otro gana 30 noches y le paga 5) o de sátira (el otro pierde 10
  // noches o le paga 7). Con alguien de su misma ciudad; gasta la acción principal.
  // Jorge (24 de noviembre, solo en el 3D): Jamil toca el laúd en cualquier ciudad, cada turno; no necesita público.
  // Su laúd es una carta: si lo vendió, no toca hasta recuperarlo (nadie más sabe tocarlo, aunque lo compre).
  if (j.pj === '4') r.push({ k: 'pj', sub: 'laud', titulo: `Tocar el laúd (+${LAUD.noches} noche y +${LAUD.dinares} dinar)`, texto: 'Te sientas con el laúd y tocas. Gasta tu acción principal.', bloqueado: tieneItem(j, 'laud') ? undefined : SIN_LAUD });
  if (j.pj === '4' && aqui.length) {
    r.push({ k: 'pj', sub: 'honra', titulo: `Proponer versos en su honra (el otro gana ${HONRA.noches} noches y te paga ${HONRA.dinares} dinares)`, objetivos: aqui });
    r.push({ k: 'pj', sub: 'satira', titulo: `Cantar versos de sátira (el otro pierde ${SATIRA.noches} noches o te paga ${SATIRA.dinares} dinares)`, objetivos: aqui });
  }
  return r;
}

export function accion(data, e, pid, a) {
  const t = e.turno, j = jug(e, pid);
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (!puedePrincipal(t)) return err('Ya usaste tu acción principal.');
  const k = jug(e, a.con);
  const valido = () => k && !k.eliminado && !k.npc && a.con !== pid && k.ciudad === j.ciudad && !k.transito;
  switch (a.sub) {
    case 'haren': {
      if (j.pj !== '6' || j.ciudad !== 'Bagdad') return err('Solo Zubayda, en Bagdad.');
      cobrarHaren(e, j);   // por si quedó una noche anterior sin cobrar
      j.extra.bajoTecho = true; j.extra.techoRonda = e.ronda;
      t.principal = true; t.sinAlojamiento = true; t.fin = true;
      // Jorge (23 de noviembre): sale la carta pintada de Zubayda en el harén; los dinares llegan al cerrarla (la carta va primero)
      const ent = publicarCarta(e, { id: 'zubayda-haren', deck: 'especial', titulo: 'El harén del Califa', sub: 'Zubayda', texto: `Pasas la noche en el harén del Califa: ganas ${HAREN_DINARES} dinares y quedas bajo su techo. Allí nadie puede robarte ni asesinarte.`, arte: 'es' }, pid, [pid]);
      j.extra.harenPend = { monto: HAREN_DINARES, nro: ent.nro, t: e.ahora };
      return ok();
    }
    case 'prost': {
      if (j.pj !== '6') return err('Solo Zubayda puede hacerlo.');   // Jorge (19 de noviembre): ni Zein ni Adí rentan su cuerpo
      if (!valido()) return err('Cliente no válido (misma ciudad).');
      // Jorge (8 de noviembre): con Zubayda el precio es fijo, 7 dinares, y el otro solo recibe sus 50 noches (o las que tenga).
      const precio = j.pj === '6' ? PRECIO_ZUBAYDA : Math.max(0, Math.min(200, Math.floor(a.precio || 0)));
      t.principal = true;
      pedir(e, { tipo: 'trato', para: [a.con], titulo: 'Propuesta de compañía', texto: `${j.nombre} te ofrece su compañía. Recibes: una noche de compañía${j.pj === '6' ? (j.noches > 0 ? ` y ${Math.min(50, j.noches)} noches de su haber` : ' (no tiene noches que darte)') : ''}. Entregas: ${precio} dinares.`,
        opciones: [{ id: 'si', texto: `Pagar ${precio} dinares`, desactivada: k.dinares < precio }, { id: 'no', texto: 'Rechazar' }], porDefecto: 'no', limiteMs: 45000, cont: { fn: 'pj.prost', args: { vend: pid, precio } } });
      return ok();
    }
    case 'laud': {
      if (j.pj !== '4') return err('Solo Jamil.');
      if (j.transito || j.perdido) return err('Aquí no puedes tocar el laúd.');
      if (!tieneItem(j, 'laud')) return err(SIN_LAUD);
      t.principal = true;
      j.noches += LAUD.noches; j.dinares += LAUD.dinares;
      // la capa 3D reconoce esta línea para animarlo y poner la música (shared/vista3d.js, RE_LAUD): si cambia la frase, cambiar allá
      log(e, `${j.nombre} toca el laúd en ${j.ciudad}: gana ${LAUD.noches} noche y ${LAUD.dinares} dinar.`, { pid });
      // «Que se calle Jamil»: mientras toca, los demás votan (engine.js lo cierra con el reloj o cuando ya hay mayoría)
      if (votantesLaud(e, pid).length) e.votoLaud = { pid, t0: e.ahora, limiteMs: LAUD.votoMs, callan: {} };
      return ok();
    }
    case 'honra': {
      if (j.pj !== '4') return err('Solo Jamil.');
      if (!valido()) return err('Tiene que estar en tu misma ciudad.');
      if (k.dinares < HONRA.dinares) return err(`${k.nombre} no tiene ${HONRA.dinares} dinares para pagarte los versos.`);
      t.principal = true;
      pedir(e, { tipo: 'trato', para: [a.con], titulo: 'Versos en tu honra', texto: `${j.nombre} te propone cantarte versos en tu honra: ganas ${HONRA.noches} noches y le pagas ${HONRA.dinares} dinares.`,
        opciones: [{ id: 'si', texto: `Aceptar (pagar ${HONRA.dinares} dinares)`, desactivada: k.dinares < HONRA.dinares }, { id: 'no', texto: 'Rechazar' }], porDefecto: 'no', limiteMs: 45000, cont: { fn: 'pj.honra', args: { jamil: pid } } });
      return ok();
    }
    case 'satira': {
      if (j.pj !== '4') return err('Solo Jamil.');
      if (!valido()) return err('Tiene que estar en tu misma ciudad.');
      t.principal = true;
      log(e, `${j.nombre} le canta versos de sátira a ${k.nombre}.`, { pid });
      pedir(e, { tipo: 'trato', para: [a.con], titulo: 'Versos de sátira', texto: `${j.nombre} te canta versos de sátira. Elige: pierdes ${SATIRA.noches} noches o le pagas ${SATIRA.dinares} dinares para que se calle.`,
        opciones: [{ id: 'noches', texto: `Perder ${SATIRA.noches} noches` }, { id: 'pagar', texto: `Pagarle ${SATIRA.dinares} dinares`, desactivada: k.dinares < SATIRA.dinares }], porDefecto: 'noches', limiteMs: 45000, cont: { fn: 'pj.satira', args: { jamil: pid } } });
      return ok();
    }
    default: return err('Acción de personaje desconocida.');
  }
}

export const HONRA = { noches: 30, dinares: 5 }, SATIRA = { noches: 10, dinares: 7 };
// Votación «Que se calle Jamil» (Jorge, 24 de noviembre): mientras Jamil toca, a los demás jugadores les sale un botón chico.
// Si más de la mitad lo oprime, Jamil deja de tocar y termina su turno. Si no, cuando se acaba el tiempo gana el premio «sigue».
// No oprimir cuenta como querer que siga. Sin nadie más en la mesa no hay votación ni premio.
export const votantesLaud = (e, pid) => Object.keys(e.jugadores).filter((id) => { const x = e.jugadores[id]; return id !== pid && x.pj && !x.npc && !x.eliminado && !x.sacado && !x.tarde && x.conectado !== false && e.orden.includes(id); });
export function votarCallar(e, pid) {
  const v = e.votoLaud;
  if (!v) return err('Jamil ya no está tocando.');
  if (!votantesLaud(e, v.pid).includes(pid)) return err('No participas en esta votación.');
  if (v.callan[pid]) return err('Ya votaste.');
  v.callan[pid] = true;
  return ok();
}
// Cierra la votación si ya hay mayoría para callarlo o si se acabó el tiempo (vencido). Devuelve 'callado', 'sigue' o null.
export function revisarVotoLaud(e, vencido = false) {
  const v = e.votoLaud; if (!v) return null;
  const j = e.jugadores[v.pid];
  if (!j || j.eliminado || e.fase !== 'juego' || e.turno?.pid !== v.pid) { e.votoLaud = null; return null; }
  const vs = votantesLaud(e, v.pid), callan = vs.filter((id) => v.callan[id]).length;
  if (vs.length && callan * 2 > vs.length) {
    e.votoLaud = null;
    log(e, `Callaron a ${j.nombre} (${callan} de ${vs.length} lo ${callan === 1 ? 'pidió' : 'pidieron'}): deja de tocar y termina su turno.`, { pid: v.pid, aviso: true });
    return 'callado';
  }
  if (!vencido && vs.length) return null;
  e.votoLaud = null;
  if (!vs.length) return null;                                   // se quedó sin público: ni castigo ni premio
  j.noches += LAUD.sigue.noches; j.dinares += LAUD.sigue.dinares;
  log(e, `Dejaron tocar a ${j.nombre} (${callan ? `${callan} de ${vs.length} ${callan === 1 ? 'quiso' : 'quisieron'}` : 'nadie quiso'} callarlo): gana ${LAUD.sigue.noches} noches y ${LAUD.sigue.dinares} dinares.`, { pid: v.pid, aviso: true });
  return 'sigue';
}
export function vistaVotoLaud(e, pid) {
  const v = e.votoLaud; if (!v) return null;
  const vs = votantesLaud(e, v.pid);
  return { pid: v.pid, t0: v.t0, limiteMs: v.limiteMs, total: vs.length, callan: vs.filter((id) => v.callan[id]).length, votas: vs.includes(pid), yaVote: !!v.callan[pid], premio: LAUD.sigue };
}
export const LAUD = { noches: 1, dinares: 1, sigue: { noches: 5, dinares: 5 }, votoMs: 40000 };   // votoMs: lo que dura su canción, 40 segundos (Jorge, 24 de noviembre)  ·   // Jorge (24 de noviembre): tocar el laúd da 1 noche y 1 dinar y gasta la acción principal
const SIN_LAUD = 'No tienes tu laúd: recupéralo para volver a tocar';
// Partidas que empezaron antes de que el laúd fuera una carta: Jamil lo recibe al empezar su siguiente turno (una sola vez por partida).
export function asegurarLaud(e) {
  if (e.laudDado) return; e.laudDado = true;
  const hay = Object.values(e.jugadores).some((x) => x.mano?.some((c) => c.tipo === 'item' && c.ref === 'laud')) || e.mercadoDados?.laud;
  const jm = Object.values(e.jugadores).find((x) => x.pj === '4' && !x.eliminado && !x.npc);
  if (!hay && jm) darItem(e, jm, 'laud');
}
registrar('pj.honra', (data, e, args, resp) => {
  const jm = jug(e, args.jamil), c = jug(e, resp.pid);
  if (resp.opcion !== 'si') { log(e, `${c.nombre} rechaza los versos en su honra de ${jm?.nombre}.`, { pid: args.jamil }); return devolverPrincipal(e, args.jamil, 'no aceptaron tus versos'); }
  if (!jm || jm.eliminado || c.eliminado || jm.ciudad !== c.ciudad || c.dinares < HONRA.dinares) return devolverPrincipal(e, args.jamil, 'los versos no se cantaron');
  c.dinares -= HONRA.dinares; jm.dinares += HONRA.dinares; c.noches += HONRA.noches;
  const txt = `${jm.nombre} canta versos en honra de ${c.nombre}: ${c.nombre} gana ${HONRA.noches} noches y le paga ${HONRA.dinares} dinares.`;
  log(e, txt, { pid: args.jamil }); info(e, args.jamil, 'Versos en su honra', txt); info(e, resp.pid, 'Versos en tu honra', txt);
});
registrar('pj.satira', (data, e, args, resp) => {
  const jm = jug(e, args.jamil), c = jug(e, resp.pid);
  if (!jm || !c || c.eliminado) return;
  let txt;
  if (resp.opcion === 'pagar' && c.dinares >= SATIRA.dinares) { c.dinares -= SATIRA.dinares; jm.dinares += SATIRA.dinares; txt = `${c.nombre} le paga ${SATIRA.dinares} dinares a ${jm.nombre} para que deje de cantar su sátira.`; }
  else { const n = SATIRA.noches; c.noches -= n; txt = `La sátira de ${jm.nombre} corre por la ciudad: ${c.nombre} pierde ${n} noches.`; }
  log(e, txt, { pid: args.jamil }); info(e, args.jamil, 'Versos de sátira', txt); info(e, resp.pid, 'Versos de sátira', txt);
});
registrar('pj.prost', (data, e, args, resp) => {
  const v = jug(e, args.vend), c = jug(e, resp.pid);
  if (resp.opcion !== 'si') { log(e, `${c.nombre} rechaza la propuesta de compañía de ${v?.nombre}.`, { pid: args.vend }); return devolverPrincipal(e, args.vend, 'su propuesta no fue aceptada'); }
  if (!v || v.eliminado || c.eliminado || v.ciudad !== c.ciudad || c.dinares < args.precio) return devolverPrincipal(e, args.vend, 'la propuesta no se llevó a cabo');
  log(e, `${c.nombre} acepta la propuesta de compañía de ${v.nombre}.`, { pid: args.vend });
  // Jorge (23 de noviembre): si Zubayda le renta a Adí, a Anís o a Jamil, sale la carta con su pintura, solo para los dos. La carta va primero:
  // el cobro, las noches y el dado de apedreo se ven al cerrarla (el cliente del juego congela saldo, registro y dados mientras tanto).
  const pintura = v.pj === '6' ? { 7: 'zubayda-adi', 3: 'zubayda-anis', 4: 'zubayda-jamil' }[c.pj] : null;
  if (pintura) { const n = Math.min(50, v.noches);
    publicarCarta(e, { id: pintura, deck: 'especial', titulo: 'Una noche de compañía', sub: `${v.nombre} y ${c.nombre}`, texto: `${c.nombre} paga ${args.precio} dinares por una noche de compañía con ${v.nombre}${n > 0 ? ` y recibe ${n} noches de su haber` : ''}.`, arte: 'es' }, args.vend, [args.vend, resp.pid]); }
  const impuesto = v.ciudad === 'Yemen' ? Math.floor(args.precio / 10) : 0;
  c.dinares -= args.precio; v.dinares += args.precio - impuesto;
  if (v.pj === '6') { const n = Math.min(50, v.noches); v.noches -= n; c.noches += n; }
  log(e, `${v.nombre} y ${c.nombre} pasan la noche juntos.`, { pid: args.vend });
  marcarVergonzoso(e, args.vend);
  // Jorge (19 de noviembre): en Bagdad ya no salen los guardias del Califa: el dado de apedreo, como en cualquier ciudad.
  const x = dado(e);
  mostrarDados(e, { por: args.vend, motivo: 'apedreo', grupos: [{ etq: `${v.nombre}: ¿apedreo? (4 o 6 = a salvo)`, valores: [x] }], resumen: [salvoApedreo(x) ? `${v.nombre} está a salvo.` : `Intentan apedrear a ${v.nombre}.`] });
  if (!salvoApedreo(x)) castigoApedreo(data, e, args.vend);
});

// Zein ya no tiene «Noche discreta» (Jorge, 8 de noviembre): se quitó junto con el esposo y su pelea.

void dados; void zeinId; void sobornoGuardias; void nuevoCtx;   // los guardias del Califa (R 12.5) ya no salen al rentar el cuerpo en Bagdad

// La noche en el harén se cobra al cerrar su carta (o a los 90 s, como el mahr de Zein).
export function cobrarHaren(e, j) {
  const m = j.extra?.harenPend; if (!m) return; j.extra.harenPend = null;
  j.dinares += m.monto; log(e, `${j.nombre} pasa la noche en el harén del Califa: gana ${m.monto} dinares y queda bajo su techo.`, { pid: j.id });
}
