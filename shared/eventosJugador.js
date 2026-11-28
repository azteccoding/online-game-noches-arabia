// Mazo de eventos de jugador (EJ), solo en el 3D (Jorge, 26 de noviembre de 2026: «Sí, reemplaza los cuentos»).
// Reemplaza a las Cartas de Cuentos. 48 cartas: 41 de ciudad y 7 del Jorasán (src/data/eventosJugador.json, textos de Jorge tal cual).
// Reglas del mazo (decisiones de Jorge del 26 de noviembre):
// - Sale al terminar tu turno, porque esa noche duermes en una ciudad (Jorge, 28 de noviembre; del 27 al 28 salía al iniciarlo), en
//   cada turno si no estás perdido en el Jorasán ni en camino; como máximo una por turno (la de R37 cuenta como la de ese turno).
// - Las del Jorasán salen cuando estás perdido ahí y no logras salir en tu turno (empezaste el turno perdido y lo terminas perdido).
// - Sale en cualquier ciudad, salvo las cartas que dicen ciudades.
// - Se lee a toda la mesa; las consecuencias se aplican cuando quien la sacó la cierra (o a los 90 segundos), como toda carta.
// - Si no te alcanza para una fianza, te toca la otra opción sin elegir, con la nota «No tienes dinares».
// - Cobro sin otra opción: se paga con lo que tengas, sin quedar en deuda.
// - Cuando el dinero va a un personaje, sale de su haber, salvo que la carta diga que sale del banco.
// Yafar NPC no saca cartas de este mazo (no puede elegir), pero sí cuenta como «Yafar en tu ciudad».
import {
  log, rnd, dado, enPartida, tieneItem, tieneObj, quitarCarta, quitarPrimero, darItem, devolverObjeto, NO_VUELVE, pedir, registrar,
  publicarCarta, mostrarDados, info, tieneDestrezaGeneral, jambiyaEscondida, recortarMano,
} from './base.js';

export const EJ_TIEMPO_MS = 90000;   // si nunca cierra la carta, se aplica igual (como el mahr y el harén)
const PJ = { nur: '1', zein: '2', anis: '3', jamil: '4', ruyan: '5', zubayda: '6', adi: '7', yafar: 'B' };
const SUB = 'Se lee a toda la mesa · al terminar tu turno';   // sale al terminar tu turno (Jorge, 28 de noviembre)
const SUB_JORASAN = 'Se lee a toda la mesa · si no logras salir del Jorasán';

const cartas = (data) => data.ej?.cartas || [];
const cartaDe = (data, id) => cartas(data).find((c) => c.id === id);
export function ejDatos(data, id) {
  const c = cartaDe(data, id); if (!c) return null;
  return { id, deck: 'ej', titulo: c.titulo, sub: c.jorasan ? SUB_JORASAN : SUB, texto: [...c.texto, ...c.regla].join('\n'),
    ciudades: c.jorasan ? 'Jorasán' : c.ciudades.length ? c.ciudades.join(', ') : null, arte: c.arte };
}

// ---------------------------------------------------------------- quién está dónde
const jug = (e, id) => e.jugadores[id];
const presentes = (e, ciudad) => enPartida(e).filter((id) => { const x = jug(e, id); return x.ciudad === ciudad && !x.transito && !x.perdido; });
// otro jugador con ese personaje en tu ciudad (Yafar NPC cuenta)
const otroEn = (e, j, pj) => presentes(e, j.ciudad).find((id) => id !== j.id && jug(e, id).pj === pj) || null;
// ese personaje en tu ciudad, tú incluido
const pjEn = (e, j, pj) => (j.pj === pj ? j.id : otroEn(e, j, pj));
const pjEnPartida = (e, pj) => enPartida(e).find((id) => jug(e, id).pj === pj) || null;

// ---------------------------------------------------------------- dinero y noches
const N = (n, s = 'noche') => `${n} ${s}${n === 1 ? '' : 's'}`;
function ganar(j, { d = 0, n = 0 }) { j.dinares += d; j.noches += n; }
// Cobro sin otra opción: con lo que tengas, sin deuda. Devuelve lo que se cobró.
function cobrar(j, monto) { const x = Math.max(0, Math.min(monto, j.dinares)); j.dinares -= x; return x; }
function quitarNoches(j, n) { const antes = j.noches; j.noches = Math.max(Math.min(antes, 0), antes - n); return antes - j.noches; }
// De un jugador a otro: solo lo que tiene.
function pasar(e, de, a, monto) { const x = cobrar(de, monto); a.dinares += x; return x; }

// ---------------------------------------------------------------- objetos
// Perder un objeto del mazo: vuelve a su mercado (el Sobre de sobornos y la Daga se esfuman, como al usarlos).
function perderObj(data, e, j, id) {
  const c = tieneObj(j, id); if (!c) return false;
  quitarCarta(j, c.uid); if (!NO_VUELVE.includes(id)) devolverObjeto(data, e, id);
  return true;
}
const ARMAS = ['alfanje', 'cimitarra', 'jambiya'];
const sinArmasNiDestreza = (j) => !ARMAS.some((r) => tieneItem(j, r)) && !tieneDestrezaGeneral(j) && !Object.keys(j.extra?.entrenado || {}).length;
const robables = (x) => x.mano.filter((c) => !jambiyaEscondida(x, c) && !(c.tipo === 'item' && c.ref === 'mapa' && c.extra?.tesoro === 'jugador'));

// ---------------------------------------------------------------- mazo
const valeEn = (c, ciudad) => !c.ciudades.length || c.ciudades.includes(ciudad);
const requisito = (c, j) => c.id !== 'EJ3' || sinArmasNiDestreza(j);   // EJ3: «Requisito no tener destreza en ningún arma ni armas»
function sacar(data, e, j, jorasan) {
  const m = e.mazos ||= {}; const k = jorasan ? 'ejVistasJor' : 'ejVistas';
  m[k] ||= [];
  const aptas = cartas(data).filter((c) => !!c.jorasan === jorasan && (jorasan || valeEn(c, j.ciudad)) && requisito(c, j));
  if (!aptas.length) return null;
  let libres = aptas.filter((c) => !m[k].includes(c.id));
  if (!libres.length) { const ids = new Set(aptas.map((c) => c.id)); m[k] = m[k].filter((x) => !ids.has(x)); libres = aptas; }   // ya salieron todas las de aquí: se barajan de nuevo
  const c = libres[Math.floor(rnd(e) * libres.length)];
  m[k].push(c.id);
  return c;
}

// Al terminar el turno (engine.ejFinTurno): aloj = lo que pagó de alojamiento esa noche (para las cartas que lo devuelven).
export function alDormir(data, e, pid, { aloj = 0 } = {}) {
  const j = jug(e, pid);
  if (!j || j.npc || j.eliminado || j.transito || j.perdido || !cartas(data).length) return null;
  return publicar(data, e, j, sacar(data, e, j, false), { aloj });
}
export function alSeguirPerdido(data, e, pid) {
  const j = jug(e, pid);
  if (!j || j.npc || j.eliminado || !j.perdido || !cartas(data).length) return null;
  return publicar(data, e, j, sacar(data, e, j, true), {});
}
function publicar(data, e, j, c, extra) {
  if (!c) return null;
  if (j.extra.ejPend) resolver(data, e, j.id);                                         // no se pierde una carta anterior sin cerrar
  const ent = publicarCarta(e, ejDatos(data, c.id), j.id);
  j.extra.ejPend = { id: c.id, nro: ent.nro, t: e.ahora, ...extra };
  log(e, `${j.nombre} saca un evento de jugador: «${c.titulo}».`, { pid: j.id });
  return ent;
}
export const pendienteVencido = (j, ahora) => !!j.extra?.ejPend && ahora - j.extra.ejPend.t > EJ_TIEMPO_MS;

// ---------------------------------------------------------------- consecuencias (al cerrar la carta)
export function resolver(data, e, pid) {
  const j = jug(e, pid), p = j?.extra?.ejPend; if (!p) return;
  j.extra.ejPend = null;
  if (j.eliminado) return;
  const c = cartaDe(data, p.id); if (!c) return;
  const f = EFECTOS[p.id];
  const dice = f ? f({ data, e, j, p, c }) : null;
  if (dice) avisar(e, j, c, dice);
}
function avisar(e, j, c, texto) {
  log(e, `«${c.titulo}»: ${texto}`, { pid: j.id, aviso: true });
}

// Fianza con dos opciones: pagar o perder tu acción principal el próximo turno. Sin los dinares, te toca perderla (nota «No tienes dinares»).
function fianza(e, j, c, monto, motivo) {
  if (j.dinares < monto) { j.extra.sinPrincipal = true; return `No tienes dinares: no alcanzas a pagar los ${monto} de fianza y pierdes tu acción principal el próximo turno ${motivo}.`; }
  pedir(e, { tipo: 'ej', para: [j.id], titulo: c.titulo, texto: `Paga ${monto} dinares de fianza o pierde tu acción principal el próximo turno.`,
    opciones: [{ id: 'pagar', texto: `Pagar ${monto} dinares` }, { id: 'perder', texto: 'Perder mi acción principal el próximo turno' }], porDefecto: 'pagar', limiteMs: 60000,
    cont: { fn: 'ej.fianza', args: { id: c.id, monto, motivo } } });
  return null;
}
registrar('ej.fianza', (data, e, args, resp) => {
  const j = jug(e, resp.pid), c = cartaDe(data, args.id); if (!j || !c) return;
  if (resp.opcion === 'pagar' && j.dinares >= args.monto) { j.dinares -= args.monto; avisar(e, j, c, `paga ${args.monto} dinares de fianza.`); }
  else { j.extra.sinPrincipal = true; avisar(e, j, c, `${j.dinares < args.monto && resp.opcion === 'pagar' ? 'No tienes dinares: ' : ''}pierde su acción principal el próximo turno ${args.motivo}.`); }
});

const SIN = null;   // la carta no cambia nada
const EFECTOS = {
  EJ1: () => 'no pasa nada.',
  EJ2: ({ e, j, c }) => (tieneObj(j, 'OB12') ? 'trae Balanza de mercader: no le pasa nada.' : fianza(e, j, c, 4, '')),
  EJ3: ({ e, j, c }) => {
    if (!sinArmasNiDestreza(j)) return 'tiene arma o destreza: no puede hacerla de carterista.';
    const vic = presentes(e, j.ciudad).filter((id) => id !== j.id && robables(jug(e, id)).length);
    if (!vic.length) return 'no hay en su ciudad nadie con algo que robarle.';
    pedir(e, { tipo: 'ej', para: [j.id], titulo: c.titulo, texto: 'Elige a quién le robas: el objeto sale al azar de su mano.',
      opciones: vic.map((id) => ({ id, texto: jug(e, id).nombre })), porDefecto: vic[0], limiteMs: 60000, cont: { fn: 'ej.carterista', args: {} } });
    return null;
  },
  EJ4: ({ e, j, c }) => {
    if (!tieneItem(j, 'vino')) return 'no trae Botella de vino: no le pasa nada.';
    if (j.dinares < 30) { quitarPrimero(j, 'item', 'vino'); alJorasan(e, j); return 'No tienes dinares: no alcanza la fianza de 30, le quitan la Botella de vino y lo envían al Jorasán.'; }
    pedir(e, { tipo: 'ej', para: [j.id], titulo: c.titulo, texto: 'Te quitan la Botella de vino. ¿Vas al Jorasán o pagas 30 dinares de fianza?',
      opciones: [{ id: 'fianza', texto: 'Pagar 30 dinares de fianza' }, { id: 'jorasan', texto: 'Ir al Jorasán' }], porDefecto: 'fianza', limiteMs: 60000, cont: { fn: 'ej.vino', args: {} } });
    return null;
  },
  EJ5: ({ e, j }) => (otroEn(e, j, PJ.jamil) ? (ganar(j, { d: 5 }), 'Jamil le lanza unas monedas: +5 dinares (del banco).') : SIN),
  EJ6: ({ data, e, j }) => {
    if (perderObj(data, e, j, 'OB13')) { const x = cobrar(j, 5); return `le quitan los Dados cargados y paga ${x} dinares de multa.`; }
    ganar(j, { d: 1 }); return 'el Zalmedina le pide disculpas: +1 dinar.';
  },
  EJ7: ({ e, j }) => {
    const adi = otroEn(e, j, PJ.adi);
    if (!tieneObj(j, 'OB42') || !adi) return SIN;
    const x = pasar(e, jug(e, adi), j, 5); return `Adí le da ${x} dinares de su haber.`;
  },
  EJ8: ({ j }) => (tieneObj(j, 'OB43') ? (ganar(j, { d: 3 }), 'la anciana le paga 3 dinares.') : SIN),
  EJ9: ({ data, e, j }) => (perderObj(data, e, j, 'OB14') ? 'pierde el Sobre de sobornos.' : SIN),
  EJ10: ({ e, j }) => (otroEn(e, j, PJ.zubayda) ? `Zubayda lo desmiente: pierde ${N(quitarNoches(j, 10))}.` : (ganar(j, { n: 15 }), 'nadie lo desmiente: +15 noches.')),
  EJ11: ({ j }) => (tieneObj(j, 'OB33') ? (ganar(j, { d: 3 }), 'el mercader le regala 3 dinares.') : `le paga ${cobrar(j, 2)} dinares al mercader.`),
  EJ12: ({ data, e, j }) => {
    if (perderObj(data, e, j, 'OB16')) return 'entrega el Regalo para Masrur y él lo ignora.';
    j.extra.sinPrincipal = true; return 'pierde su acción principal el próximo turno explicando quién es.';
  },
  EJ13: ({ data, e, j }) => (perderObj(data, e, j, 'OB21') ? (ganar(j, { n: 10 }), 'el posadero se come el Pastel de pistaches: +10 noches.') : `pierde ${N(quitarNoches(j, 5))}.`),
  EJ14: ({ data, e, j }) => (perderObj(data, e, j, 'OB40') ? (ganar(j, { d: 50 }), 'vende su Perfume de rosas al Almotacén: +50 dinares.') : `paga ${cobrar(j, 2)} dinares de multa.`),
  EJ15: ({ e, j }) => { const r = otroEn(e, j, PJ.ruyan); if (r) return `el Sabio Ruyán le da ${pasar(e, jug(e, r), j, 2)} dinares de su haber.`; ganar(j, { n: 5 }); return '+5 noches.'; },
  EJ16: ({ j, p }) => (tieneObj(j, 'OB44') ? (ganar(j, { d: p.aloj || 0 }), `le devuelven lo que pagó de alojamiento (${p.aloj || 0} dinares).`) : SIN),
  EJ17: ({ e, j, p }) => (otroEn(e, j, PJ.nur) ? (ganar(j, { d: p.aloj || 0 }), `le devuelven lo que pagó de alojamiento (${p.aloj || 0} dinares, del banco).`) : SIN),
  EJ18: ({ e, j }) => { const z = otroEn(e, j, PJ.zein); return z ? `le paga ${pasar(e, j, jug(e, z), 6)} dinares de la apuesta a Zein.` : SIN; },
  EJ19: ({ e, j }) => (otroEn(e, j, PJ.yafar) ? (ganar(j, { n: 10 }), 'se entera de un secreto de la corte: +10 noches.') : SIN),
  EJ20: ({ e, j, c }) => (tieneObj(j, 'OB45') ? 'trae Máscara del zoco: no le pasa nada.' : fianza(e, j, c, 4, 'explicando que no es él')),
  EJ21: ({ j }) => (tieneObj(j, 'OB27') ? (ganar(j, { d: 3 }), 'los marineros le pagan la cena: +3 dinares.') : `paga la cena: ${cobrar(j, 2)} dinares.`),
  EJ22: ({ data, e, j }) => {
    const papel = quitarPrimero(j, 'item', 'amate') ? 'el papel amate' : perderObj(data, e, j, 'OB38') ? 'el Papel de Samarcanda' : null;
    if (!papel) return SIN;
    ganar(j, { d: 25, n: 15 }); return `da ${papel} al poeta: +15 noches y +25 dinares.`;
  },
  EJ23: ({ j }) => (tieneObj(j, 'OB33') ? (ganar(j, { d: 3 }), 'el trovador le comparte el plato: +3 dinares.') : `le da ${cobrar(j, 1)} dinar al trovador.`),
  EJ24: ({ j }) => (tieneObj(j, 'OB09') ? (ganar(j, { d: 5, n: 30 }), '+30 noches y +5 dinares.') : SIN),
  EJ25: ({ j }) => (tieneObj(j, 'OB26') ? (ganar(j, { d: 60 }), 'el espejo le revela los ahorros del posadero: +60 dinares.') : (ganar(j, { n: 5 }), '+5 noches de autoestima.')),
  EJ26: ({ data, e, j }) => {
    if (!perderObj(data, e, j, 'OB41')) return SIN;
    if (quitarPrimero(j, 'item', 'veneno')) { ganar(j, { d: 80, n: 1 }); return 'da su Joya de granate como dote, se casa y gasta su Veneno: hereda ya 80 dinares y 1 noche.'; }
    const x = dado(e);
    mostrarDados(e, { por: j.id, motivo: 'ej:EJ26', grupos: [{ etq: `${j.nombre}: turnos que vive la viuda`, valores: [x] }], resumen: [`La viuda fallece en ${N(x, 'turno')} tuyo${x === 1 ? '' : 's'}: heredarás 80 dinares y 1 noche.`] });
    j.extra.ejViuda = { turno: j.turnos + x };
    return `da su Joya de granate como dote y se casa: hereda en ${N(x, 'turno')} suyo${x === 1 ? '' : 's'}.`;
  },
  EJ27: ({ e, j }) => (otroEn(e, j, PJ.jamil) ? `llega el músico de verdad: pierde ${N(quitarNoches(j, 10))}.` : (ganar(j, { d: 5, n: 20 }), '+20 noches y +5 dinares.')),
  EJ28: ({ e, j }) => (tieneItem(j, 'camello') ? (ganar(j, { d: 15 }), 'el posadero le paga 15 dinares.') : `pierde ${N(quitarNoches(j, 10))}.`),
  EJ29: ({ j }) => (tieneObj(j, 'OB07') || tieneObj(j, 'OB06') ? (ganar(j, { d: 8, n: 15 }), '+15 noches y +8 dinares.') : (ganar(j, { n: 5 }), '+5 noches de paciencia.')),
  EJ30: ({ data, e, j }) => (perderObj(data, e, j, 'OB34') ? (ganar(j, { d: 40 }), 'vende su Seda de Isfahán: +40 dinares.') : `compra el gato que habla: ${cobrar(j, 3)} dinares.`),
  EJ31: ({ j }) => (tieneObj(j, 'OB18') ? (ganar(j, { d: 15 }), 'gana la apuesta: +15 dinares.') : `pierde ${N(quitarNoches(j, 5))}.`),
  EJ32: ({ j }) => (tieneObj(j, 'OB23') ? (ganar(j, { d: 25 }), 'el astrólogo le devuelve los 3 dinares y le da 25 de propina.') : `le paga ${cobrar(j, 3)} dinares al astrólogo.`),
  EJ33: ({ data, e, j }) => { ganar(j, { n: 25 }); if (perderObj(data, e, j, 'OB19')) { ganar(j, { d: 25 }); return '+25 noches; regala sus Dátiles y pan de viaje al ghul: +25 dinares.'; } return '+25 noches.'; },
  EJ34: ({ j }) => { const pala = !!tieneObj(j, 'OB11'); ganar(j, { d: pala ? 60 : 30 }); return pala ? '+30 dinares y, con su Pala de zapador, 30 más.' : '+30 dinares.'; },
  EJ35: ({ data, e, j, p }) => {
    const a = p.aloj || 0; ganar(j, { d: a });
    if (perderObj(data, e, j, 'OB30')) { ganar(j, { n: 50 }); return `le devuelven el alojamiento (${a} dinares) y gana 50 noches; pierde la Carta de recomendación.`; }
    return `le devuelven el alojamiento (${a} dinares) y duerme en el corral de las cabras.`;
  },
  EJ36: ({ data, e, j }) => { ganar(j, { d: 10 }); if (perderObj(data, e, j, 'OB31')) { ganar(j, { d: 35 }); return '+10 dinares por el consejo y vende su Cuaderno de ruta por 35.'; } return '+10 dinares por el consejo.'; },
  EJ37: ({ j }) => (j.pj === PJ.anis ? (ganar(j, { d: 25, n: 25 }), '+25 dinares y +25 noches.') : (ganar(j, { n: 5 }), '+5 noches.')),
  EJ38: ({ e, j }) => {
    const a = pjEn(e, j, PJ.anis);
    if (!a) { ganar(j, { d: 5 }); return 'el pintor lo escoge a falta de opciones: +5 dinares.'; }
    const A = jug(e, a); ganar(A, { d: 15 }); darItem(e, A, 'alfombraIsfahan'); recortarMano(null, e, a);
    if (a === j.id) return 'Anís posa por 15 dinares y se roba una Alfombra de Isfahán del taller.';
    ganar(j, { d: 2 }); return `${A.nombre} (Anís) posa por 15 dinares y se roba una Alfombra de Isfahán; a ${j.nombre} le dan 2 por cargar el caballete.`;
  },
  EJ39: ({ j }) => {
    if (j.pj !== PJ.anis) { ganar(j, { n: 5 }); return '+5 noches.'; }
    ganar(j, { d: 15, n: 20 }); j.extra.ejSalida = 'Basra'; return '+15 dinares y +20 noches; en su próximo turno sale del Jorasán a Basra sin tirar.';
  },
  EJ40: ({ j }) => (j.pj === PJ.anis ? (ganar(j, { d: 30 }), '+30 dinares.') : `pierde ${N(quitarNoches(j, 5))} de esperanza.`),
  EJ41: ({ e, j }) => {
    if (j.pj === PJ.zein) { ganar(j, { d: 20, n: 10 }); return '+20 dinares de mahr y +10 noches.'; }
    const z = otroEn(e, j, PJ.zein);
    if (z) { ganar(j, { d: 10 }); ganar(jug(e, z), { d: 10 }); return `comparte los 20 dinares con ${jug(e, z).nombre} (Zein): 10 cada uno.`; }
    ganar(j, { d: 20 }); return 'cobra los 20 dinares.';
  },
  EJ42: ({ e, j }) => {
    const z = pjEnPartida(e, PJ.zein); if (!z) return SIN;
    (e.mods ||= {}).ejPoetas = { pid: z, ronda: e.ronda };
    return `esta ronda nadie puede desafiar, atacar ni robar a ${jug(e, z).nombre} (Zein).`;
  },
  EJ43: ({ j }) => (j.pj === PJ.zein ? (ganar(j, { d: 25 }), '+25 dinares del botín.') : `los bandidos le quitan ${cobrar(j, 3)} dinares.`),
  EJ44: ({ j }) => {
    if (j.pj !== PJ.zein) return `pierde ${N(quitarNoches(j, 5))}.`;
    ganar(j, { n: 10 }); j.extra.ejSalida = 'El Cairo'; return '+10 noches; en su próximo turno sale del Jorasán a El Cairo sin tirar.';
  },
  EJ45: ({ e, j }) => {
    const r = pjEn(e, j, PJ.ruyan), aqui = presentes(e, j.ciudad);
    if (!r) { for (const id of aqui) quitarNoches(jug(e, id), 1); return 'nadie duerme: los jugadores de la ciudad pierden 1 noche.'; }
    const R = jug(e, r); let total = 0;
    for (const id of aqui.filter((x) => x !== r)) { total += pasar(e, jug(e, id), R, 2); ganar(jug(e, id), { n: 15 }); }
    return `el Sabio Ruyán cobra ${total} dinares y los jugadores de la ciudad ganan 15 noches.`;
  },
  EJ46: ({ e, j }) => {
    const r = otroEn(e, j, PJ.ruyan); if (!r) return SIN;
    ganar(jug(e, r), { d: 5 }); j.extra.ejTrivia30 = true;
    return 'el Sabio Ruyán gana 5 dinares; ganará 30 noches con su próxima trivia acertada.';
  },
  EJ47: ({ e }) => {
    const r = pjEnPartida(e, PJ.ruyan), a = pjEnPartida(e, PJ.adi), y = pjEnPartida(e, PJ.yafar);
    let total = 0;
    for (const id of enPartida(e)) if (id !== r && id !== a) total += cobrar(jug(e, id), 5);
    const mitadR = Math.ceil(total / 2), mitadA = total - mitadR;
    const reparte = [[r, mitadR, 'el Sabio Ruyán'], [a, mitadA, 'Adí']].map(([q, m, quien]) => {
      const dest = q || y; if (dest) jug(e, dest).dinares += m;
      return `${m} para ${q ? jug(e, q).nombre : y ? jug(e, y).nombre + ' (Yafar, en lugar de ' + quien + ')' : 'el banco'}`;
    });
    return `la mesa paga ${total} dinares de inscripción: ${reparte.join(' y ')}.`;
  },
  EJ48: ({ e, j }) => {
    const a = pjEn(e, j, PJ.adi); if (!a) return SIN;
    for (const id of presentes(e, j.ciudad)) ganar(jug(e, id), { n: id === a ? 50 : 10 });
    return 'los jugadores de la ciudad ganan 10 noches y Adí, 50.';
  },
};

function alJorasan(e, j) {
  j.perdido = true; j.ciudad = 'Jorasán'; j.transito = null; j.extra.enRumbo = false;
  log(e, `${j.nombre} es enviado al Jorasán y queda perdido.`, { pid: j.id, aviso: true });
}
registrar('ej.vino', (data, e, args, resp) => {
  const j = jug(e, resp.pid), c = cartaDe(data, 'EJ4'); if (!j || !c) return;
  quitarPrimero(j, 'item', 'vino');
  if (resp.opcion === 'fianza' && j.dinares >= 30) { j.dinares -= 30; avisar(e, j, c, 'le quitan la Botella de vino y paga 30 dinares de fianza.'); return; }
  avisar(e, j, c, `${resp.opcion === 'fianza' ? 'No tienes dinares: ' : ''}le quitan la Botella de vino y lo envían al Jorasán.`);
  alJorasan(e, j);
});
registrar('ej.carterista', (data, e, args, resp) => {
  const j = jug(e, resp.pid), v = jug(e, resp.opcion), c = cartaDe(data, 'EJ3'); if (!j || !v || !c) return;
  const l = robables(v); if (!l.length) { avisar(e, j, c, `${v.nombre} ya no tiene nada que robarle.`); return; }
  const carta = l[Math.floor(rnd(e) * l.length)];
  quitarCarta(v, carta.uid); carta.priv = true; j.mano.push(carta); recortarMano(data, e, j.id);
  avisar(e, j, c, `le roba un objeto a ${v.nombre}, sacado a ciegas de su mano.`);
  info(e, v.id, 'Te robaron', `${j.nombre}, carterista hábil, te robó un objeto de tu mano.`);
});

// ---------------------------------------------------------------- lo que queda para después (engine.iniciarTurno y responderCC)
export function alIniciarTurno(data, e, pid, t) {
  const j = jug(e, pid); if (!j) return;
  const v = j.extra.ejViuda;
  if (v && j.turnos >= v.turno) {   // EJ26: fallece la viuda
    j.extra.ejViuda = null; ganar(j, { d: 80, n: 1 });
    log(e, `Fallece la viuda de los dátiles: ${j.nombre} hereda 80 dinares y 1 noche.`, { pid, aviso: true });
  }
  const s = j.extra.ejSalida;
  if (s) {   // EJ39 y EJ44: sales del Jorasán sin tirar
    j.extra.ejSalida = null;
    if (j.perdido) {
      j.perdido = false; j.extra.enRumbo = false; j.extra.destinoA = null; j.ciudad = s;
      if (!j.visitadas.includes(s)) j.visitadas.push(s);
      if (t) { t.ciudadInicio = s; t.movio = true; }
      log(e, `${j.nombre} sale del Jorasán a ${s} sin tirar.`, { pid, aviso: true });
    }
  }
}
export function trasTrivia(e, j, acierto) {   // EJ46: 30 noches por la próxima trivia acertada
  if (!acierto || !j.extra?.ejTrivia30) return;
  j.extra.ejTrivia30 = false; ganar(j, { n: 30 });
  log(e, `${j.nombre} acierta la trivia que le sopló el Sabio Ruyán: +30 noches.`, { pid: j.id });
}
// EJ42: los poetas de Andalucía protegen a Zein esta ronda.
export function protegidaPorPoetas(e, pid) { const m = e.mods?.ejPoetas; return !!m && m.pid === pid && m.ronda === e.ronda; }
export const MSJ_POETAS = 'Los poetas de Andalucía le escriben versos a Zein: esta ronda nadie se atreve a desafiarla, atacarla ni robarle.';
