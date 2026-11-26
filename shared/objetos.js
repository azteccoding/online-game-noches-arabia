// Objetos (R 15): tienda y mercado, venta, reventa y uso de los objetos del mazo, objetos originales (R 15.1), transporte y cartas de Ifrit.
import {
  ok, err, dado, dados, suma, log, nombre, ciudadDe, objDe, activos, enCiudad, tieneItem, tieneObj, tieneEsp, quitarCarta, quitarPrimero, uid, darItem, darObjeto, recortarMano, pagar, devolverObjeto,
  publicarCarta, cartaDatos, robar, robarBotin, ITEMS, TESOROS, HOOK, esLibro, valorLibro, valorVino, mostrarDados, consumirObj, info, puedePrincipal, nObjetos, pedir, registrar, eliminar, tarifa, vivos,
motivoNoSalir, pesoFlechas, ALFORJA, LAMPARA, tramosMax, MSJ_ALFORJA_TRAMO, MSJ_HUIDA_TRAMO, ciudadCerrada, motivoCerrada, deseosIfrit, alfombraPorVelo, DESEO_VELO, TEXTO_DESEO_VELO,
ALFOMBRAS, alfombrasEn, precioAlfombraVenta, precioAlfombraCompra, moverAlfombras, apurosZein, tieneCarga, LIMITE_OBJETOS, MOTIVO_CARGA, MSJ_COMPRA_LLENO, cargaExcedida, sobrecarga, limiteCarga, CARGA_ITEMS, nCarga, existencia, sacarExistencia, POR_CIUDAD, MAPA_JORASAN, TINTA, CALAMO_MAX, DATILES, pesaCarta, BURROS, burrosEn, SHATRANJ, shatranjEnIndia , PISTACHES , VINO } from './base.js';
// Yeguas de la estepa y caballos mongoles (Jorge, 12 de noviembre). Reto R50 en Samarcanda: de 1 a 3 yeguas a 70 cada una. El mercado de
// Estambul paga 150 por yegua y cada yegua que llega pone a la venta un caballo mongol (32 dinares) en Estambul. El caballo mongol te lleva
// a cualquier ciudad, incluida India (Jorge, 21 de noviembre; antes solo entre 5 ciudades y fuera de ellas moría), no termina el turno,
// carga, vive 2 turnos y solo lo compra el mercado de Estambul,
// por 2 dinares (ahí vuelve a la venta a 32). Yafar NPC: en fácil no lo compra, en normal hasta 1, en difícil los que quiera.
// Albéitar y comida: cada yegua y cada caballo mongol pagan por turno lo mismo que el caballo normal (Jorge, 12 de noviembre).
// Jorge (23 de noviembre), solo en el 3D: cada yegua que llega a Estambul pone a la venta 2 caballos mongoles, no 1 (es regla, no fallo).
export const MONGOLES_POR_YEGUA = 2;
export const YEGUAS = { precio: 70, max: 3, venta: 150, ciudadVenta: 'Estambul' };
export const MONGOL = { precio: 32, ciudad: 'Estambul', venta: 2, ciudadesVenta: ['Estambul'] };   // solo lo compra el mercado de Estambul
const limiteMongolNPC = (e) => ({ facil: 0, normal: 1, dificil: Infinity }[e.opciones?.dificultad] ?? 1);
const nMongoles = (j) => j.mano.filter((c) => c.tipo === 'item' && c.ref === 'caballoMongol').length;
export function motivoNoMongol(e, j) {
  if (!e.mongoles?.habilitado) return 'Todavía no se venden: llegan cuando alguien trae yeguas de la estepa (reto R50) al mercado de Estambul.';
  if (!(e.mongoles.stock > 0)) return 'Agotado: no quedan caballos mongoles en Estambul.';
  if (j.pj === 'B' && j.npc && nMongoles(j) >= limiteMongolNPC(e)) return limiteMongolNPC(e) ? 'Yafar NPC solo puede tener 1 caballo mongol en dificultad normal.' : 'Yafar NPC no compra caballos mongoles en dificultad fácil.';
  if (j.dinares < MONGOL.precio) return 'No te alcanza';
  return null;
}
// Armas que vende hoy cada ciudad, para su ficha (Jorge, 12 de noviembre): las mismas existencias que usa el mercado.
export function armasEnCiudad(data, e, ciudad) {
  const r = [];
  for (const ref of ['cimitarra', 'alfanje', 'arco', 'jambiya']) {
    const n = existenciaArma(e, ref, ciudad); if (!(n > 0)) continue;
    const base = ref === 'cimitarra' ? (data.config.armas?.cimitarra?.precio ?? ITEMS.cimitarra.precio) : ITEMS[ref].precio;
    r.push({ ref, nombre: ITEMS[ref].nombre, precio: base + (RECARGO_ARMA[ref]?.[ciudad] || 0), quedan: Number.isFinite(n) ? n : null });
  }
  return r;
}
export const REPARA_ESCUDO = { ciudad: 'Isfahán', costo: 5 };   // Jorge (12 de noviembre): reparar el escudo de cuero, sin gastar la acción principal
export const mapasJorasanVenta = (e) => e.mapasJorasan ?? MAPA_JORASAN.stock;
// Los escribas de Bagdad hacen otro mapa del Jorasán: vuelve a la venta 2 rondas después de venderse a un mercado o de gastarse.
export function reponerMapaJorasanLuego(e) { (e.mapasRepone ||= []).push(e.ronda + MAPA_JORASAN.reponeRondas); }
export function reponerMapasJorasan(e) {   // al empezar cada ronda
  if (!e.mapasRepone?.length) return;
  const ya = e.mapasRepone.filter((r) => r <= e.ronda); if (!ya.length) return;
  e.mapasRepone = e.mapasRepone.filter((r) => r > e.ronda); e.mapasJorasan = mapasJorasanVenta(e) + ya.length;
  log(e, `Los escribas de Bagdad terminaron ${ya.length === 1 ? 'un mapa del Jorasán: ya está' : ya.length + ' mapas del Jorasán: ya están'} a la venta en Bagdad.`, { aviso: true });
}
const nMapasJ = (j) => j.mano.filter((c) => c.tipo === 'item' && c.ref === 'mapaJorasan').length;
const motivoNPCMapa = (e, j) => { if (!(j.pj === 'B' && j.npc)) return null; const lim = MAPA_JORASAN.npc[e.opciones?.dificultad] ?? 1; return nMapasJ(j) >= lim ? (lim ? `Yafar NPC solo puede tener ${lim} mapa${lim > 1 ? 's' : ''} del Jorasán en esta dificultad.` : 'Yafar NPC no compra mapas del Jorasán en dificultad fácil.') : null; };

// Mercancías de comercio: solo se compran en su ciudad y se venden caras, sin impuesto, en las ciudades de «reventa» (objetos.json).
export const reventaDe = (data, id, ciudad) => objDe(data, id)?.reventa?.[ciudad] ?? null;
const VENTA_ORIGINAL = { costalPistaches: PISTACHES.compra, almudDatiles: DATILES.compra, arco: 15, alfanje: 25, cimitarra: 35, jambiya: 15, flechas: 5, vino: 20, buza: 1, amate: 2, cesta: 5, burro: 25 /* VENTA_BURRO_MERCADO */, citricos: 5, mapaJorasan: 20 };   // Jorge (19 de noviembre): el burro vale 25 y vive 2 turnos; cítricos a 5 en cualquier mercado
const CIUDAD_ORIGINAL = { costalPistaches: [PISTACHES.ciudadCompra], almudDatiles: DATILES.ciudades, vino: Object.keys(VINO.stock), buza: ['Damasco', 'Basra'], cesta: ['Basra', 'Bagdad'], burro: ['Basra', 'Aleppo', 'Damasco'] };   // el burro: Basra, y Aleppo y Damasco cuando se acaban los de Basra (25 dinares y 20 noches de regalo)
const ARMAS_ORIG = ['arco', 'alfanje', 'cimitarra', 'jambiya'];
// Jorge (10 de noviembre): el alfanje solo en Yemen, Estambul, Isfahán y Samarcanda, y la cimitarra solo en Andalucía y El Cairo, con
// 1 en cada mercado (la jambiya, en todas las ciudades, sin límite). Venderlas se puede en cualquier ciudad; la vendida queda a la
// venta en el mercado de esa ciudad, al momento.
export const ARMAS_CIUDAD = { alfanje: ['Yemen', 'Estambul', 'Isfahán', 'Samarcanda'], cimitarra: ['Andalucía', 'El Cairo', 'Estambul', 'Samarcanda'] };   // Jorge (10 de noviembre): también 1 en Samarcanda
export const RECARGO_ARMA = { cimitarra: { Estambul: 5 } };   // en Estambul la cimitarra cuesta 5 dinares más
for (const [r, cs] of Object.entries(ARMAS_CIUDAD)) CIUDAD_ORIGINAL[r] = cs;
CIUDAD_ORIGINAL.mapaJorasan = ['Bagdad'];   // Jorge (12 de noviembre)
CIUDAD_ORIGINAL.arco = ['Aleppo', 'Damasco', 'Isfahán', 'El Cairo', 'Yemen', 'Magreb'];   // Jorge (10 de noviembre): el arco solo ahí, sin límite; las flechas, en cualquier ciudad
const stockArmas = (e) => (e.stockArmas ||= Object.fromEntries(Object.entries(ARMAS_CIUDAD).map(([r, cs]) => [r, Object.fromEntries(cs.map((c) => [c, 1]))])));
// Cálamos de Kufa (Jorge, 17 de noviembre): 12 en toda la partida, 6 en Basra y 6 en Damasco. Los que se venden en El Cairo o Bagdad
// NO vuelven de inmediato: cuando ya se vendieron los 12 (no queda ninguno en los mercados ni en manos de nadie), se regeneran 6 y 6.
export const CALAMOS_CIUDAD = { Damasco: 6, Basra: 6 };
const stockCalamos = (e) => (e.stockCalamos ||= { ...CALAMOS_CIUDAD });
function regenerarCalamos(e) {
  const s = stockCalamos(e);
  const enMercado = Object.values(s).reduce((a, b) => a + b, 0);
  const enManos = Object.values(e.jugadores || {}).reduce((a, j) => a + (j.mano || []).filter((x) => x.tipo === 'item' && x.ref === 'buza').length, 0);
  if (enMercado + enManos > 0) return false;
  e.stockCalamos = { ...CALAMOS_CIUDAD };
  log(e, 'Ya se vendieron los 12 cálamos de Kufa: vuelve a haber 6 en Damasco y 6 en Basra.');
  return true;
}
// Jorge (17 de noviembre): no hay cimitarras en ningún mercado hasta que alguien forja acero de Damasco (R52)
export const cimitarrasBloqueadas = (e, ref) => ref === 'cimitarra' && !e.forjaDamasco;
export const MSJ_SIN_FORJA = 'Aún no hay cimitarras: se venden cuando alguien forje acero de Damasco (reto R52, en Damasco)';
// Vino (Jorge, 19 de noviembre): 2 botellas en Basra y 4 en Andalucía; la que se vende al mercado se esfuma y no se repone.
const stockVino = (e) => (e.stockVino ||= { ...VINO.stock });
export const existenciaArma = (e, ref, ciudad) => (cimitarrasBloqueadas(e, ref) ? 0 : ref === 'vino' ? (stockVino(e)[ciudad] || 0) : ref === 'buza' ? (stockCalamos(e)[ciudad] || 0) : ARMAS_CIUDAD[ref] ? (stockArmas(e)[ref][ciudad] || 0) : CIUDAD_ORIGINAL[ref] && !CIUDAD_ORIGINAL[ref].includes(ciudad) ? 0 : Infinity);
export const quitarArma = (e, ref, ciudad) => { if (ref === 'vino') { stockVino(e)[ciudad] = Math.max(0, (stockVino(e)[ciudad] || 0) - 1); return; } if (ARMAS_CIUDAD[ref]) stockArmas(e)[ref][ciudad] = Math.max(0, (stockArmas(e)[ref][ciudad] || 0) - 1); };
function devolverArma(e, ref, ciudad) {   // Jorge (10 de noviembre): queda a la venta en la ciudad donde la vendiste, sea cual sea
  if (!ARMAS_CIUDAD[ref]) return null;
  const m = stockArmas(e); m[ref][ciudad] = (m[ref][ciudad] || 0) + 1; return ciudad;
}

// Bazar del genio (regla de la casa): en Samarcanda e India se vende una carta de Ifrit por ronda (en toda la partida, no por ciudad).
// Jorge (10 de noviembre): se quitó el bazar del genio (comprar una carta de Ifrit en Samarcanda o India): era demasiado fácil.
// Regla de la casa: el mercado de la ciudad (objetos, mercancías y armas) solo vende FUERA de tu turno, mientras juegan los demás.
// Excepción: Yafar NPC compra en su turno. El Firmán y el bazar de Ifrit siguen comprándose en tu turno.
export function puedeMercado(e, pid) {
  const j = e.jugadores[pid];
  if (!j || e.fase !== 'juego' || !e.turno || j.eliminado || !j.pj || j.transito || j.perdido) return 'Ahora no puedes comprar.';
  if (j.npc) return e.turno.pid === pid ? null : 'Yafar NPC compra en su turno.';
  // en solitario no hay turnos ajenos: se compra también en el propio. Jorge (26 de noviembre): quien fue sacado de la partida no cuenta
  // (sacó a un jugador desconectado, quedó solo contra Yafar NPC y ya no le dejaba comprar)
  const solo = Object.values(e.jugadores).filter((x) => x.pj && !x.npc && !x.eliminado && !x.sacado).length <= 1;
  return e.turno.pid === pid && !solo ? 'Compra mientras juegan los demás: en tu turno el mercado no te vende.' : null;
}
const puedeTienda = (e, pid) => e.fase === 'juego' && e.turno && e.turno.pid === pid && !e.jugadores[pid].transito && !e.jugadores[pid].perdido && !e.turno.fin;

function ciudadesDe(o) {
  const s = String(o.seConsigueEn || '').trim();
  if (/^(todas|cualquier ciudad)/i.test(s)) return null;                                                // en cualquier ciudad
  if (/^solo bot/i.test(s)) return [];
  return s.split(/,| y /).map((x) => x.trim()).filter((x) => x && !/bot[ií]n/i.test(x) && !/^R\d+/.test(x) && !/^\(/.test(x));
}
export function precioArma(data, e, ref, j) {
  let p = ref === 'cimitarra' ? (data.config.armas?.cimitarra?.precio ?? ITEMS.cimitarra.precio) : ITEMS[ref].precio;
  const d = j.extra?.descuentos?.[ref];
  if (d != null) p = Math.min(p, d);
  p += RECARGO_ARMA[ref]?.[j.ciudad] || 0;
  if (e.mods.mercaderArmas && (ARMAS_ORIG.includes(ref) || ref === 'flechas')) p = Math.ceil(p / 2);       // E10
  return p;
}
const dobleCairo = (e, ciudad) => (e.mods.oroMali && ciudad === 'El Cairo' ? 2 : 1);                    // H9

// Regla de la casa (7 de noviembre): el Firmán cuesta 55 dinares (45 con la joya del visir); Yafar no lo compra.
export const precioFirman = (j) => (j.extra.joyaVisir ? 45 : 55);
// Establo de Bagdad (Jorge, punto 13): caballo, burro y camello se venden en Bagdad por 60, 20 y 50 dinares; quien esté en Bagdad
// los compra después por 10 dinares más. El animal conserva su edad. Yafar no compra burros.
// Jorge (10 de noviembre): caballo, burro o camello se venden en el mercado de cualquier ciudad a 10 dinares y ahí se revenden a 10 (Jorge, 19 de noviembre: caballo y camello a 45);
// quien lo compra lo recibe con todos sus turnos de vida (como recién comprado).
// Jorge (10 de noviembre): el burro se vende al mercado por 15 («por desnutrido») y otro lo compra por 35 con su vida completa; (Jorge, 19 de noviembre: ahora 25 y 2 turnos)
// caballo y camello se venden a 10 y se revenden a 45 (Jorge, 19 de noviembre; no tienen precio de compra: son premios de reto).
export const VENTA_ANIMAL_BAGDAD = { caballo: 10, burro: 15, camello: 10 }, REVENTA_ANIMAL = { caballo: 45, burro: 25, camello: 45 };   // Jorge (19 de noviembre): el burro se revende a 25 con sus 2 turnos; caballo y camello, a 45
// Jorge (10 de noviembre): la alfombra mágica solo se vende en Samarcanda o Isfahán (precio por confirmar con Jorge).
export const ALFOMBRA_VENTA = { ciudades: ['Samarcanda', 'Isfahán'], precio: 20 };   // Jorge (10 de noviembre): 20 dinares y se deshace (nadie la revende)
// Dados del Cairo y Dados de Persia (Jorge, 8 de noviembre): una sola carta de cada uno; el mercado de la ciudad la compra y la
// revende (Cairo 35 → 75, Persia 30 → 60) y a todos les sale el aviso de dónde está. Entre jugadores, en un trato, al precio que quieran.
// Laúd de Jamil (Jorge, 24 de noviembre, solo en el 3D): igual que los dados, una sola carta; el mercado la compra en 30 y la revende en 45.
export const DADOS_VENTA = { dadosCairo: { nombre: 'Dados del Cairo', venta: 35, reventa: 75 }, dadosPersia: { nombre: 'Dados de Persia', venta: 30, reventa: 60 },
  laud: { nombre: 'Laúd de Jamil', venta: 30, reventa: 45, uno: true } };
// «los Dados del Cairo» / «el Laúd de Jamil», y su verbo en singular o plural
const elDe = (D) => (D.uno ? 'el ' : 'los ') + D.nombre, ElDe = (D) => (D.uno ? 'El ' : 'Los ') + D.nombre;
export const MSJ_SIN_PISTACHES = 'Todavía no se vende: llega cuando alguien lleve pistaches de Isfahán a Bagdad (reto R56)';
export const MSJ_SIN_DATILES = 'Todavía no se vende: llega cuando alguien lleve dátiles de Basra o Yemen al mercado de Bagdad (reto R53)';
export function comprar(data, e, pid, a) {
  const j = e.jugadores[pid];
  const enTurno = a.ref === 'firman';
  if (enTurno) { if (!puedeTienda(e, pid)) return err('El Firmán se compra en tu turno.'); if (e.turno.fase === 'ingreso') return err('Primero tira el dado de ingreso.'); }
  else { const no = puedeMercado(e, pid); if (no) return err(no); }
  if (a.ref === 'lampara') {                                                                             // Jorge (20 de noviembre)
    const n = lamparasEn(e, j.ciudad);
    if (n <= 0) return err('No hay lámpara de aceite a la venta aquí.');
    if (j.dinares < LAMPARA.precio) return err(`La lámpara cuesta ${LAMPARA.precio} dinares.`);
    if (!tieneCarga(j) && nCarga(j) >= limiteCarga(e, j)) return err(MSJ_COMPRA_LLENO + '.');
    j.dinares -= LAMPARA.precio; e.lamparas[j.ciudad] = n - 1; darItem(e, j, 'lampara');
    log(e, `${j.nombre} compra una lámpara de aceite en ${j.ciudad} por ${LAMPARA.precio} dinares.`, { pid }); return ok();
  }
  if (a.ref === 'alforja') {                                                                             // Jorge (19 de noviembre)
    const n = alforjasEn(e, j.ciudad), p = precioAlforja(j.ciudad);
    if (n <= 0) return err('No hay alforjas a la venta aquí.');
    if (j.dinares < p) return err(`Cuesta ${p} dinares.`);
    const tiene = j.mano.filter((c) => c.tipo === 'item' && c.ref === 'alforja').length, max = tieneCarga(j) ? ALFORJA.maxCon : ALFORJA.maxSin;
    if (tiene >= max) return err(tieneCarga(j) ? `Con animal llevas hasta ${ALFORJA.maxCon} alforjas.` : 'Sin caballo, burro o camello solo puedes llevar una alforja.');
    j.dinares -= p; e.alforjas[j.ciudad] = n - 1;
    darItem(e, j, 'alforja', { turnos: ALFORJA.turnos });
    log(e, `${j.nombre} compra una alforja en ${j.ciudad} por ${p} dinares.`, { pid }); return ok();
  }
  if (a.ref === 'firman') {                                                                              // R 15.3
    if (j.ciudad !== 'Bagdad') return err('El visir vende el Firmán en Bagdad.');
    if (e.firmanes <= 0) return err('No quedan Firmanes.');
    if (j.pj === 'B') return err('Yafar no puede comprar Firmanes: solo tiene el suyo.');
    if (tieneEsp(j, 'F1')) return err('Ya tienes un Firmán.');
    const p = precioFirman(j);
    if (j.dinares < p) return err(`Cuesta ${p} dinares.`);
    j.dinares -= p; e.firmanes--; j.extra.joyaVisir = false; j.mano.push({ uid: uid(e), tipo: 'especial', ref: 'F1', pub: true });
    log(e, `${j.nombre} compra un Firmán del Califa.`, { pid }); return ok();
  }
  if (a.ref === 'shatranj') {                                                                           // Shatranj (Jorge, 19 de noviembre)
    if (j.ciudad !== SHATRANJ.ciudad) return err('El Shatranj solo lo vende el mercado de India.');
    if (shatranjEnIndia(e) <= 0) return err(`Ya no quedan Shatranj en India: solo hay ${SHATRANJ.stock} en todo el juego.`);
    if (j.dinares < SHATRANJ.precio) return err(`Cuesta ${SHATRANJ.precio} dinares.`);
    if (!tieneCarga(j) && nCarga(j) >= limiteCarga(e, j)) return err(MSJ_COMPRA_LLENO);
    j.dinares -= SHATRANJ.precio; e.shatranj = shatranjEnIndia(e) - 1; darItem(e, j, 'shatranj');
    log(e, `${j.nombre} compra un Shatranj (ajedrez) en el mercado de India por ${SHATRANJ.precio} dinares.`, { pid }); return ok();
  }
  if (a.ref === 'alfombraIsfahan') {                                                                    // Alfombras de Isfahán (Jorge, 18 de noviembre)
    const n = alfombrasEn(e, j.ciudad), p = precioAlfombraCompra(j.ciudad);
    if (n <= 0) return err(j.ciudad === ALFOMBRAS.origen ? 'Ya no quedan alfombras en Isfahán: se vendieron todas.' : 'Este mercado no tiene alfombras de Isfahán.');
    if (j.dinares < p) return err(`Cuestan ${p} dinares.`);
    if (!tieneCarga(j) && nCarga(j) >= limiteCarga(e, j)) return err(MSJ_COMPRA_LLENO);
    j.dinares -= p; moverAlfombras(e, j.ciudad, -1); darItem(e, j, 'alfombraIsfahan');
    log(e, `${j.nombre} compra una alfombra de Isfahán en el mercado de ${j.ciudad} por ${p} dinares.`, { pid }); return ok();
  }
  if (DADOS_VENTA[a.ref]) {                                                                              // dados revendidos por el mercado
    const D = DADOS_VENTA[a.ref], m = e.mercadoDados?.[a.ref];
    if (!m || m.ciudad !== j.ciudad) return err(`${ElDe(D)} no ${D.uno ? 'está' : 'están'} a la venta aquí.`);
    if (j.dinares < D.reventa) return err(`${D.uno ? 'Cuesta' : 'Cuestan'} ${D.reventa} dinares.`);
    if (a.ref === 'laud' && j.pj !== '4' && !tieneCarga(j) && nCarga(j) >= limiteCarga(e, j)) return err(MSJ_COMPRA_LLENO);      // a quien no es Jamil, el laúd le pesa
    j.dinares -= D.reventa; delete e.mercadoDados[a.ref]; m.carta.pub = true; j.mano.push(m.carta);
    log(e, `${j.nombre} compra ${elDe(D)} en el mercado de ${j.ciudad} por ${D.reventa} dinares.`, { pid, ...(a.ref === 'laud' ? { aviso: true } : {}) });
    return ok();
  }
  if (typeof a.ref === 'string' && a.ref.startsWith('amarrado:')) return comprarAmarrado(e, pid, a.ref.slice(9));
  if (typeof a.ref === 'string' && a.ref.startsWith('establo:')) {
    { const x0 = (e.establo || []).find((x) => x.carta.uid === a.ref.slice(8)); if (x0 && (x0.ciudad || 'Bagdad') !== j.ciudad) return err(`Ese animal está a la venta en ${x0.ciudad || 'Bagdad'}.`); }
    const k = (e.establo || []).findIndex((x) => x.carta.uid === a.ref.slice(8));
    if (k < 0) return err('Ese animal ya se vendió.');
    const x = e.establo[k];
    if (x.carta.ref === 'burro' && yafarSinBurro(e, j)) return err('Yafar no compra burros: dice que es indigno de su posición.');
    // Jorge (10 de noviembre): se pueden tener varios animales, también del mismo tipo (cada uno con su vida y su costo)
    if (j.dinares < x.precio) return err(`Cuesta ${x.precio} dinares.`);
    j.dinares -= x.precio; e.establo.splice(k, 1); x.carta.priv = false; x.carta.pub = true; x.carta.extra = { ...(x.carta.extra || {}), usados: 0 }; j.mano.push(x.carta);   // con toda su vida
    log(e, `${j.nombre} compra un ${ITEMS[x.carta.ref].nombre.toLowerCase()} en el mercado de ${j.ciudad} por ${x.precio} dinares (con todos sus turnos de vida).`, { pid });
    return ok();
  }
  if (a.ref === 'caballoMongol') {
    if (j.ciudad !== MONGOL.ciudad) return err('Los caballos mongoles solo se venden en Estambul.');
    const no = motivoNoMongol(e, j); if (no) return err(no === 'No te alcanza' ? `Cuesta ${MONGOL.precio} dinares.` : no);
    j.dinares -= MONGOL.precio; e.mongoles.stock--; darItem(e, j, 'caballoMongol');
    log(e, `${j.nombre} compra un caballo mongol en Estambul por ${MONGOL.precio} dinares.`, { pid }); return ok();
  }
  if (a.ref === 'ifrit') return err('El bazar del genio ya no existe: las cartas de Ifrit salen del Jorasán, de la lámpara mágica y de R40.');   // Jorge (10 de noviembre)
  if (a.ref === 'tintaPulpo') {                                                                         // Jorge (17 de noviembre)
    const pt = precioTinta(e, j.ciudad); if (!pt) return err(motivoTinta(e, j.ciudad));
    const n = Math.max(1, Math.min(10, Math.floor(a.n || 1)));
    if (pt.stock < n) return err(`Solo ${pt.stock === 1 ? 'queda 1 frasco' : `quedan ${pt.stock} frascos`} en ${j.ciudad}.`);
    const p = pt.precio * n;
    if (j.dinares < p) return err(`Cuesta ${p} dinares.`);
    if (!tieneCarga(j) && nCarga(j) + n > limiteCarga(e, j)) return err(MSJ_COMPRA_LLENO);   // el frasco pesa
    j.dinares -= p; if (pt.reventa) e.tintaReventa[j.ciudad] -= n;
    for (let i = 0; i < n; i++) darItem(e, j, 'tintaPulpo');
    log(e, `${j.nombre} compra ${n > 1 ? n + ' frascos' : 'un frasco'} con tinta de pulpo en ${j.ciudad} por ${p} dinares.`, { pid }); return ok();
  }
  if (a.ref) {                                                                                           // objetos originales
    const base = VENTA_ORIGINAL[a.ref];
    if (base === undefined) return err('Eso no se vende.');
    const cs = CIUDAD_ORIGINAL[a.ref]; if (cs && !cs.includes(j.ciudad) && !(existenciaArma(e, a.ref, j.ciudad) > 0)) return err(`Solo se vende en ${cs.join(' o ')}.`);
    const n = Math.max(1, Math.min(10, Math.floor(a.n || 1)));
    if (a.ref === 'buza' && nCalamos(j) + n > CALAMO_MAX) return err(`Máximo ${CALAMO_MAX} cálamos de Kufa en tu mano${nCalamos(j) ? ` (ya tienes ${nCalamos(j)})` : ''}.`);   // Jorge (17 de noviembre)
    if (cimitarrasBloqueadas(e, a.ref)) return err(MSJ_SIN_FORJA + '.');
    if (a.ref === 'buza' && existenciaArma(e, 'buza', j.ciudad) < n) return err(existenciaArma(e, 'buza', j.ciudad) ? `Solo quedan ${existenciaArma(e, 'buza', j.ciudad)} cálamos de Kufa en ${j.ciudad}.` : `Agotado: ya no quedan cálamos de Kufa en ${j.ciudad}.`);
    if (existenciaArma(e, a.ref, j.ciudad) < n) return err(`Agotado: ya no hay ${ITEMS[a.ref].nombre.toLowerCase()} en ${j.ciudad}.`);
    let p = ARMAS_ORIG.includes(a.ref) || a.ref === 'flechas' ? precioArma(data, e, a.ref, j) : base;
    p *= dobleCairo(e, j.ciudad); p *= n;
    if (j.dinares < p) return err(`Cuesta ${p} dinares.`);
    if (ARMAS_ORIG.includes(a.ref) && tieneItem(j, a.ref)) return err('Ya tienes esa arma.');
    if (a.ref === 'burro' && yafarSinBurro(e, j)) return err('Yafar no compra burros: dice que es indigno de su posición.');
    if (a.ref === 'burro' && n > 1) return err('Solo un burro.');
    if (a.ref === 'costalPistaches' && costales(j) + n > PISTACHES.max) return err(`Puedes llevar hasta ${PISTACHES.max} costales de pistaches a la vez${costales(j) ? ` (ya llevas ${costales(j)})` : ''}.`);
    if (a.ref === 'burro' && !(burrosEn(e, j.ciudad) > 0)) return err(`No quedan burros en ${j.ciudad}.`);
    if (a.ref === 'mapaJorasan' && n > mapasJorasanVenta(e)) return err('Agotado: no quedan mapas del Jorasán en Bagdad (los escribas tardan 2 rondas en hacer otro).');
    if (a.ref === 'mapaJorasan' && motivoNPCMapa(e, j)) return err(motivoNPCMapa(e, j));
    if (a.ref === 'mapaJorasan' && n > 1) return err('De uno en uno.');
    const nf = j.mano.filter((c) => c.tipo === 'item' && c.ref === 'flechas').length;
    const pesoNuevo = a.ref === 'flechas' ? pesoFlechas(nf + n) - pesoFlechas(nf) : n;   // las flechas pesan en pares (Jorge, 19 de noviembre)
    if (CARGA_ITEMS.includes(a.ref) && pesoNuevo && !tieneCarga(j) && nCarga(j) + pesoNuevo > limiteCarga(e, j)) return err(MSJ_COMPRA_LLENO);   // alfanje, cimitarra y vino también cargan
    j.dinares -= p;
    if (a.ref === 'burro') { j.dinares += p; burroDelMercado(e, pid, p); return ok(); }
    quitarArma(e, a.ref, j.ciudad);
    if (a.ref === 'buza') stockCalamos(e)[j.ciudad] -= n;
    if (a.ref === 'mapaJorasan') e.mapasJorasan = mapasJorasanVenta(e) - n;
    for (let i = 0; i < n; i++) darItem(e, j, a.ref, a.ref === 'vino' ? { ronda: e.ronda } : undefined);
    log(e, `${j.nombre} compra ${n > 1 ? n + ' ' : ''}${ITEMS[a.ref].nombre}.`, { pid });
    if (a.ref === 'vino') { /* el vino gana 2 dinares por ronda */ }
    return ok();
  }
  const o = objDe(data, a.id);
  if (!o) return err('Objeto inexistente.');
  const cs = ciudadesDe(o);
  if (cs && !cs.includes(j.ciudad)) return err(`Aquí no se vende (${o.seConsigueEn}).`);
  if (a.id === DATILES.obj && !e.datilesBagdad) return err(MSJ_SIN_DATILES + '.');
  if (a.id === PISTACHES.obj && !e.pistachesBagdad) return err(MSJ_SIN_PISTACHES + '.');
  if (existencia(e, a.id, j.ciudad) <= 0) return err('Agotado.');
  const p = o.valor * dobleCairo(e, j.ciudad);
  if (j.dinares < p) return err('No te alcanzan los dinares.');
  if (!tieneCarga(j) && nCarga(j) >= limiteCarga(e, j)) return err(MSJ_COMPRA_LLENO);   // Jorge (10 de noviembre)
  j.dinares -= p; sacarExistencia(e, a.id, j.ciudad);
  const c = { uid: uid(e), tipo: 'objeto', ref: a.id, pub: true }; j.mano.push(c);
  publicarCarta(e, cartaDatos(data, 'objeto', a.id), pid, [pid]);
  log(e, `${j.nombre} compra un objeto.`, { pid });
  return ok();
}

// Impuesto de venta al mercado (R 8.4): Bagdad 0, Samarcanda 50 %, E12 sin impuesto; lo paga el vendedor.
export function impuesto(data, e, ciudad, monto) {
  if (e.mods.feria || ciudad === 'Bagdad') return 0;
  const pct = ciudad === 'Samarcanda' ? 50 : (ciudadDe(data, ciudad)?.impuestoVenta ?? data.config.impuestoVentaPct);
  return Math.floor(monto * pct / 100);
}

export const LIBROS_SUBASTA = ['OB46', 'OB47'];
// Libros de los retos de transcribir (R60 a R65; Jorge, 19 de noviembre): además de Bagdad (sin impuesto), los compran los mercados de
// Samarcanda, Andalucía y Estambul, a la mitad de su valor menos el impuesto de la ciudad. La Casa de la Sabiduría solo paga completo en Bagdad.
export const CIUDADES_TRANSCRITOS = ['Samarcanda', 'Andalucía', 'Estambul'];
export const MSJ_TRANSCRITOS = 'Libro transcrito: lo compran la biblioteca de Bagdad (mitad de su valor, sin impuesto; completo con «Casa de la Sabiduría») y los mercados de Samarcanda, Andalucía y Estambul (mitad de su valor, menos el impuesto).';
const libroTranscritoAqui = (c, ciudad) => !!c.extra?.transcrito && CIUDADES_TRANSCRITOS.includes(ciudad);
function precioLibro(data, e, c, ciudad) {
  const v = valorLibro(data, e, c);
  if (ciudad === 'Bagdad') return e.mods.sabiduria ? v : Math.floor(v / 2);
  const p = Math.floor(v / 2); return p - impuesto(data, e, ciudad, p);
}
// Costales de pistaches (Jorge, 19 de noviembre): al llegar a Bagdad se entregan solos (R56).
const costales = (j) => j.mano.filter((c) => c.tipo === 'item' && c.ref === 'costalPistaches').length;
export function entregarPistaches(e, pid) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado || j.ciudad !== PISTACHES.ciudadVenta) return;
  const n = costales(j); if (!n) return;
  j.mano = j.mano.filter((c) => !(c.tipo === 'item' && c.ref === 'costalPistaches'));
  const pago = n * PISTACHES.venta; j.dinares += pago;
  const primero = !e.pistachesBagdad;
  log(e, `${j.nombre} entrega ${n} ${n === 1 ? 'costal' : 'costales'} de pistaches en ${j.ciudad} y cobra ${pago} dinares.`, { pid });
  if (!j.retosHechos.includes(PISTACHES.reto)) j.retosHechos.push(PISTACHES.reto);
  if (primero) {
    e.pistachesBagdad = true; j.noches += PISTACHES.noches;
    log(e, `${j.nombre} es el primero en traer la cosecha de pistaches de Isfahán (reto ${PISTACHES.reto}): +${PISTACHES.noches} noches.`, { pid });
    log(e, `Llegaron pistaches a ${j.ciudad}: desde ahora se venden Pasteles de pistaches en El Cairo, Bagdad y Damasco.`, { aviso: true });
  }
  info(e, pid, 'Cosecha de pistaches', `Entregas ${n} ${n === 1 ? 'costal' : 'costales'} de pistaches y cobras ${pago} dinares${primero ? `. ¡Eres el primero! Ganas ${PISTACHES.noches} noches` : ''}.`);
}
export const MITAD_VENTA = ['OB05'];   // se venden al mercado a la mitad de su precio (redondeo hacia abajo)

// ---------------------------------------------------------------- camello amarrado (Jorge, 19 de noviembre)
// Con el Lazo de camellero puedes dejar tu camello amarrado en el mercado de la ciudad donde estás (acción libre, en tu turno).
// Mientras está amarrado no envejece ni paga albéitar y comida. Cualquier otro jugador lo puede comprar ahí al precio de reventa del
// mercado (45) y lo recibe con las vidas que tenía; tú cobras ese precio cuando llegas a esa ciudad. Si nadie lo compró, al volver lo
// recuperas pagando 5 dinares por cada turno tuyo que estuvo amarrado; sin el dinero, no te lo llevas. Un camello amarrado por jugador.
export const AMARRE = { porTurno: 5, ciudadesNo: ['Jorasán'] };
const precioAmarrado = () => REVENTA_ANIMAL.camello;
export const amarradoDe = (e, pid) => (e.amarrados || []).find((x) => x.dueno === pid && !x.vendido);
export const costoRecuperar = (j, x) => AMARRE.porTurno * Math.max(0, j.turnos - x.desde);
export function opcionesLazo(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, r = [];
  if (!t || t.pid !== pid || t.fase === 'ingreso' || j.transito || j.perdido || j.npc) return r;
  const mio = amarradoDe(e, pid);
  if (tieneObj(j, 'OB05') && !AMARRE.ciudadesNo.includes(j.ciudad)) {
    for (const c of j.mano.filter((x) => x.tipo === 'item' && x.ref === 'camello'))
      r.push({ k: 'lazo', sub: 'amarrar', uid: c.uid, titulo: `Amarrar tu camello en el mercado de ${j.ciudad}`,
        texto: `No envejece ni paga albéitar mientras está amarrado. Otro lo puede comprar por ${precioAmarrado()} dinares (te los dan al volver aquí); si nadie lo compra, lo recuperas pagando ${AMARRE.porTurno} dinares por cada turno tuyo. No gasta tu acción principal y el lazo no se gasta.`,
        bloqueado: mio ? `Ya tienes un camello amarrado en ${mio.ciudad}.` : undefined });
  }
  if (mio && mio.ciudad === j.ciudad) {
    const p = costoRecuperar(j, mio);
    r.push({ k: 'lazo', sub: 'recuperar', titulo: `Recuperar tu camello amarrado (${p} dinares)`, texto: `${AMARRE.porTurno} dinares por cada turno tuyo que estuvo amarrado; conserva sus vidas.`,
      bloqueado: j.dinares < p ? `Te faltan ${p - j.dinares} dinares: sin el dinero no te lo llevas.` : undefined });
  }
  return r;
}
export function accionLazo(data, e, pid, a) {
  const j = e.jugadores[pid], t = e.turno;
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('En tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (a.sub === 'amarrar') {
    if (!tieneObj(j, 'OB05')) return err('Necesitas el Lazo de camellero.');
    if (AMARRE.ciudadesNo.includes(j.ciudad) || j.transito || j.perdido) return err('Aquí no hay mercado donde amarrarlo.');
    if (amarradoDe(e, pid)) return err(`Ya tienes un camello amarrado en ${amarradoDe(e, pid).ciudad}.`);
    const c = j.mano.find((x) => x.uid === a.uid && x.tipo === 'item' && x.ref === 'camello'); if (!c) return err('No tienes ese camello.');
    quitarCarta(j, c.uid); (e.amarrados ||= []).push({ carta: c, dueno: pid, ciudad: j.ciudad, desde: j.turnos, vendido: null });
    log(e, `${j.nombre} deja su camello amarrado en el mercado de ${j.ciudad} con su Lazo de camellero.`, { pid });
    return ok();
  }
  if (a.sub === 'recuperar') {
    const x = amarradoDe(e, pid); if (!x || x.ciudad !== j.ciudad) return err('No tienes un camello amarrado aquí.');
    const p = costoRecuperar(j, x); if (j.dinares < p) return err(`Te faltan ${p - j.dinares} dinares: sin el dinero no te lo llevas.`);
    j.dinares -= p; e.amarrados.splice(e.amarrados.indexOf(x), 1); j.mano.push(x.carta);
    log(e, `${j.nombre} recupera su camello amarrado en ${j.ciudad}${p ? ` y paga ${p} dinares` : ''}.`, { pid });
    return ok();
  }
  return err('Acción desconocida.');
}
function comprarAmarrado(e, pid, uidC) {
  const j = e.jugadores[pid], x = (e.amarrados || []).find((q) => q.carta.uid === uidC && !q.vendido);
  if (!x) return err('Ese camello ya no está amarrado aquí.');
  if (x.ciudad !== j.ciudad) return err(`Ese camello está amarrado en ${x.ciudad}.`);
  if (x.dueno === pid) return err('Es tu camello: recupéralo desde Acciones en tu turno.');
  const p = precioAmarrado(); if (j.dinares < p) return err(`Cuesta ${p} dinares.`);
  j.dinares -= p; x.vendido = p; x.comprador = pid; j.mano.push(x.carta);
  const d = e.jugadores[x.dueno];
  log(e, `${j.nombre} compra el camello amarrado de ${d?.nombre || 'otro jugador'} en ${j.ciudad} por ${p} dinares (con las vidas que tenía).`, { pid });
  cobrarAmarrados(e, x.dueno);   // si el dueño está ahí, cobra en el acto
  return ok();
}
// El dueño cobra cuando llega a la ciudad (o si ya está ahí).
export function cobrarAmarrados(e, pid) {
  const j = e.jugadores[pid]; if (!j || j.eliminado || j.transito) return;
  for (const x of (e.amarrados || []).filter((q) => q.dueno === pid && q.vendido && q.ciudad === j.ciudad)) {
    e.amarrados.splice(e.amarrados.indexOf(x), 1); j.dinares += x.vendido;
    const txt = `${e.jugadores[x.comprador]?.nombre || 'Alguien'} compró tu camello amarrado en ${x.ciudad}: recibes ${x.vendido} dinares.`;
    log(e, `${j.nombre} cobra ${x.vendido} dinares por su camello amarrado en ${x.ciudad}, que compró ${e.jugadores[x.comprador]?.nombre || 'alguien'}.`, { pid });
    info(e, pid, 'Tu camello amarrado', txt);
  }
}
export const MSJ_JOYA_VISIR = 'Solo se usa en Bagdad, ante el visir.';
export const MSJ_PERDIDO_VENDER = 'Estás perdido en el Jorasán: aquí no puedes vender nada.';
// Tirar una carta (Jorge, 19 de noviembre): sale del juego y no cobras nada; no gasta tu acción. Sirve, sobre todo, para aligerar la
// carga cuando vas sobrecargado y no puedes vender lo que llevas (p. ej. libros lejos de los mercados que los compran).
export const NO_SE_TIRA = ['especial'];
export function tirar(data, e, pid, a) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado) return err('No estás en la partida.');
  const c = j.mano.find((x) => x.uid === a.uid);
  if (!c) return err('No tienes esa carta.');
  if (NO_SE_TIRA.includes(c.tipo)) return err('Las cartas especiales no se tiran.');
  { const m = (j.misiones || []).find((x) => (x.carga || []).some((k) => k.uid === c.uid)); if (m) return err(`No se tira: es la carga del reto ${m.id}.`); }
  quitarCarta(j, c.uid);
  const nom = c.tipo === 'objeto' ? objDe(data, c.ref)?.nombre : c.tipo === 'ifrit' ? 'una carta de Ifrit' : ITEMS[c.ref]?.nombre || c.ref;
  log(e, `${j.nombre} tira ${nom}: sale del juego.`, { pid });
  return ok();
}
export function vender(data, e, pid, a) {
  const j = e.jugadores[pid];
  if (j?.perdido) return err(MSJ_PERDIDO_VENDER);   // Jorge (19 de noviembre): en el Jorasán no se vende nada
  if (!puedeTienda(e, pid)) return err('Solo puedes vender en tu turno.');
  const c = j.mano.find((x) => x.uid === a.uid);
  if (!c) return err('No tienes esa carta.');
  const ciudad = j.ciudad;
  { const m = (j.misiones || []).find((x) => (x.carga || []).some((k) => k.uid === c.uid)); if (m) return err(`No se vende: es la carga del reto ${m.id}.`); }   // como ya decía dondeVender
  let precio = 0, sinImp = false, texto = 'objeto';
  if (c.tipo === 'objeto' && LIBROS_SUBASTA.includes(c.ref) && ciudad === 'Bagdad') {      // regla de la casa: subasta en la biblioteca
    const todas = j.mano.filter((x) => x.tipo === 'objeto' && x.ref === c.ref), x = dado(e), p = x % 2 === 0 ? 150 : 100;
    for (const k of todas) { quitarCarta(j, k.uid); devolverObjeto(data, e, c.ref); }
    j.dinares += p * todas.length;
    mostrarDados(e, { por: pid, motivo: 'subasta', titulo: 'Subasta en la biblioteca de Bagdad: par 150 c/u, impar 100 c/u', grupos: [{ etq: `${j.nombre}: subasta de ${todas.length} × ${objDe(data, c.ref).nombre}`, valores: [x] }],
      resumen: [`${x % 2 === 0 ? 'Par' : 'Impar'}: se venden a ${p} cada uno, ${p * todas.length} dinares.`] });
    log(e, `${j.nombre} vende ${todas.length} × «${objDe(data, c.ref).nombre}» en la subasta de la biblioteca de Bagdad por ${p * todas.length} dinares.`, { pid });
    return ok();
  }
  if (c.tipo === 'objeto') {
    const o = objDe(data, c.ref);
    texto = o.nombre;
    if (c.ref === 'OB12' && ciudad !== 'Bagdad') return err('La Balanza de mercader solo se vende en Bagdad (o a otro jugador en un trato).');   // Jorge (18 de noviembre)
    if (reventaDe(data, c.ref, ciudad) != null) { precio = reventaDe(data, c.ref, ciudad); sinImp = true; }
    else if (c.ref === 'OB41') { precio = 20; sinImp = true; }                                            // banco: 20
    else if (c.ref === 'OB24' ) { precio = 40; sinImp = true; }                                           // Botella de genio: 40 al banco (R 15.2)
    else if (MITAD_VENTA.includes(c.ref)) precio = Math.floor(o.valor / 2);                            // Lazo de camellero: a la mitad (Jorge, 19 de noviembre)
    else precio = o.valor;
    if (o.tipo === 'Lujo/Comercio' && tieneObj(j, 'OB12') && (e.turno.gastos.balanza || 0) < 3) { precio += 2; e.turno.gastos.balanza = (e.turno.gastos.balanza || 0) + 1; }
    if (precio <= 0) {   // Jorge (10 de noviembre): un objeto siempre se puede dar al mercado; si no tiene precio, se regala
      // si este mercado no maneja ese objeto, se disuelve (no vuelve a ningún mercado); si lo maneja, vuelve a su existencia como al venderlo
      const cs = ciudadesDe(o), loManeja = cs === null || cs.includes(ciudad);
      quitarCarta(j, c.uid); if (loManeja) devolverObjeto(data, e, c.ref);
      log(e, `${j.nombre} regala «${texto}» al mercado${loManeja ? '' : ', que no lo maneja: el objeto se disuelve'}.`, { pid }); return ok();
    }
    const imp = sinImp ? 0 : impuesto(data, e, ciudad, precio);
    j.dinares += precio - imp; quitarCarta(j, c.uid); devolverObjeto(data, e, c.ref);
    log(e, `${j.nombre} vende «${texto}» por ${precio - imp} dinares.`, { pid });
    return ok();
  }
  if (c.tipo === 'especial') return err('Esa carta no se vende al banco.');
  if (c.tipo !== 'item') return err('No se puede vender.');
  if (esLibro(c)) {
    if (ciudad !== 'Bagdad' && !libroTranscritoAqui(c, ciudad)) return err(c.extra?.transcrito ? MSJ_TRANSCRITOS : 'Solo la biblioteca de Bagdad compra libros y papiros.');
    const v = valorLibro(data, e, c); precio = precioLibro(data, e, c, ciudad);                  // H8: precio completo (solo en Bagdad)
    quitarCarta(j, c.uid); j.dinares += precio; log(e, `${j.nombre} vende ${c.ref === 'libroIbnHazm' ? `«${c.extra?.titulo || 'un libro de Ibn Hazm'}»` : 'un ' + c.ref} ${ciudad === 'Bagdad' ? 'a la biblioteca' : 'en el mercado de ' + ciudad} por ${precio} dinares.`, { pid });
    return ok();
  }
  if (c.ref === 'vino') {
    // Jorge (19 de noviembre): cualquier mercado la compra a su valor actual (menos el impuesto) y la botella se esfuma.
    precio = valorVino(c, e); const imp = impuesto(data, e, ciudad, precio);
    quitarCarta(j, c.uid); j.dinares += precio - imp; log(e, `${j.nombre} vende una botella de vino en ${ciudad} por ${precio - imp} dinares; la botella se esfuma.`, { pid }); return ok();
  }
  if (c.ref === 'buza') {
    const p = ciudad === 'El Cairo' ? 4 : ciudad === 'Bagdad' ? 3 : 0;
    if (!p) return err('El cálamo de Kufa se vende en El Cairo (4) o en Bagdad (3).');
    // Jorge (17 de noviembre): tiras un dado y te compran tantos como salga; los demás se venden en otro turno
    const todas = j.mano.filter((x) => x.tipo === 'item' && x.ref === 'buza');
    const x = dado(e), k = Math.min(x, todas.length), quedan = todas.length - k;
    mostrarDados(e, { por: pid, motivo: 'buza', grupos: [{ etq: `${j.nombre}: venta de cálamos de Kufa (te compran tantos como salga)`, valores: [x] }],
      resumen: [`Sale ${x}: te compran ${k} cálamo${k === 1 ? '' : 's'} de Kufa a ${p} dinares, ${p * k} en total.${quedan ? ` Te ${quedan === 1 ? 'queda 1' : `quedan ${quedan}`} para otro turno.` : ''}`] });
    for (const c2 of todas.slice(0, k)) quitarCarta(j, c2.uid); j.dinares += p * k; regenerarCalamos(e);
    return ok();
  }
  if (c.ref === 'tintaPulpo') {                                                                          // Jorge (17 de noviembre)
    if (!TINTA.ciudadesVenta.includes(ciudad)) return err('El frasco con tinta de pulpo solo lo compran en Andalucía o Samarcanda (9 dinares).');
    quitarCarta(j, c.uid); j.dinares += TINTA.venta; (e.tintaReventa ||= {})[ciudad] = (e.tintaReventa[ciudad] || 0) + 1;
    log(e, `${j.nombre} vende un frasco con tinta de pulpo en ${ciudad === 'Andalucía' ? 'Andalucía' : ciudad} por ${TINTA.venta} dinares; queda a la venta ahí en ${TINTA.reventa}.`, { pid }); return ok();
  }
  if (c.ref === 'mapa' && c.extra?.tesoro === 'jugador') return err('El papel del escondite no lo compra el banco: véndelo a otro jugador en un trato.');
  if (c.ref === 'mapa') { const t = TESOROS[c.extra?.tesoro]; precio = t ? Math.floor(t.valor / 2) : 5; const imp = impuesto(data, e, ciudad, precio); quitarCarta(j, c.uid); j.dinares += precio - imp; log(e, `${j.nombre} vende un mapa.`, { pid }); return ok(); }
  if (c.ref === 'yegua') {
    if (ciudad !== YEGUAS.ciudadVenta) return err('Las yeguas solo las compra el mercado de Estambul (150 dinares cada una). También puedes vendérselas a otro jugador en un trato.');
    quitarCarta(j, c.uid); j.dinares += YEGUAS.venta;
    const nuevo = !e.mongoles?.habilitado; e.mongoles = { habilitado: true, stock: (e.mongoles?.stock || 0) + MONGOLES_POR_YEGUA };
    log(e, `${j.nombre} vende una yegua de la estepa al mercado de Estambul por ${YEGUAS.venta} dinares.`, { pid });
    log(e, nuevo ? `Ya se venden caballos mongoles en Estambul: llegan ${MONGOLES_POR_YEGUA} con la yegua.` : `Llegan otros ${MONGOLES_POR_YEGUA} caballos mongoles al mercado de Estambul (hay ${e.mongoles.stock}).`, { aviso: true });
    return ok();
  }
  if (c.ref === 'caballoMongol') {
    if (!MONGOL.ciudadesVenta.includes(ciudad)) return err('Aquí nadie quiere caballos mongoles; solo en Estambul (2 dinares).');
    quitarCarta(j, c.uid); j.dinares += MONGOL.venta; e.mongoles = { habilitado: true, stock: (e.mongoles?.stock || 0) + 1 };
    log(e, `${j.nombre} vende su caballo mongol en Estambul por ${MONGOL.venta} dinares: vuelve a la venta ahí.`, { pid }); return ok();
  }
  if (VENTA_ANIMAL_BAGDAD[c.ref] != null) {
    const v = VENTA_ANIMAL_BAGDAD[c.ref]; quitarCarta(j, c.uid); j.dinares += v;
    (e.establo ||= []).push({ carta: c, precio: REVENTA_ANIMAL[c.ref], ciudad });
    log(e, `${j.nombre} vende su ${ITEMS[c.ref].nombre.toLowerCase()} en el mercado de ${ciudad} por ${v} dinares${c.ref === 'burro' ? ' (por desnutrido)' : ''}.`, { pid }); return ok();
  }
  if (DADOS_VENTA[c.ref]) {
    const D = DADOS_VENTA[c.ref];
    quitarCarta(j, c.uid); j.dinares += D.venta; (e.mercadoDados ||= {})[c.ref] = { ciudad, carta: c }; apurosZein(e, j, c.ref);
    log(e, `${j.nombre} vende ${elDe(D)} al mercado de ${ciudad} por ${D.venta} dinares.`, { pid });
    // el laúd (Jorge, 24 de noviembre): «cuando lo vende todos se enteran»
    if (c.ref === 'laud') log(e, `${j.nombre} vendió el laúd: está a la venta en el mercado de ${ciudad} por ${D.reventa} dinares. Solo Jamil sabe tocarlo.`, { aviso: true });
    else log(e, `Los ${D.nombre} están a la venta en el mercado de ${ciudad} por ${D.reventa} dinares.`, { aviso: true });
    return ok();
  }
  if (ITEMS[c.ref]?.msg) return err('El mercado no compra cartas de sheij: véndela a otro jugador en un trato.');   // Jorge (10 de noviembre)
  if (c.ref === 'pergamino') { if (ciudad !== 'Damasco') return err('El pergamino se cobra en Damasco.'); quitarCarta(j, c.uid); j.dinares += 30; return ok(); }
  if (c.ref === 'especias') {                                                                             // H17: en Bagdad por 30, sin impuesto
    if (ciudad !== 'Bagdad') return err('Las especias se venden en Bagdad (30 dinares, sin impuesto).');
    quitarCarta(j, c.uid); j.dinares += 30; log(e, `${j.nombre} vende un fardo de especias en Bagdad por 30 dinares.`, { pid }); return ok();
  }
  if (c.ref === 'shatranj') {                                                                           // Jorge (19 de noviembre): al venderlo deja de existir
    const p = SHATRANJ.venta[ciudad];
    if (!p) return err('El Shatranj solo lo compran en Isfahán (25), Bagdad (30) o Andalucía (35).');
    quitarCarta(j, c.uid); j.dinares += p;
    log(e, `${j.nombre} vende un Shatranj (ajedrez) en ${ciudad} por ${p} dinares; ese tablero ya no vuelve a la venta.`, { pid }); return ok();
  }
  if (c.ref === 'alfombraIsfahan') {                                                                    // vuelve a la venta en ese mercado (Jorge, 18 de noviembre)
    const p = precioAlfombraVenta(ciudad); quitarCarta(j, c.uid); j.dinares += p; moverAlfombras(e, ciudad, 1);
    log(e, `${j.nombre} vende una alfombra de Isfahán al mercado de ${ciudad} por ${p} dinares.`, { pid }); return ok();
  }
  if (c.ref === 'alforja') {                                                                            // Jorge (19 de noviembre): 1 dinar; el mercado la revende
    quitarCarta(j, c.uid); j.dinares += ALFORJA.venta; alforjasEn(e, ciudad); e.alforjas[ciudad] = (e.alforjas[ciudad] || 0) + 1;
    log(e, `${j.nombre} vende una alforja en ${ciudad} por ${ALFORJA.venta} dinar; queda a la venta ahí por ${precioAlforja(ciudad)}.`, { pid }); return ok();
  }
  if (c.ref === 'pescado') {                                                                            // se esfuma al venderlo (Jorge, 19 de noviembre)
    const p = precioPescado(ciudad); quitarCarta(j, c.uid); j.dinares += p;
    log(e, `${j.nombre} vende un pescado en ${ciudad} por ${p} dinares.`, { pid }); return ok();
  }
  if (c.ref === 'almudDatiles') {                                                                       // Dátiles (Jorge, 19 de noviembre)
    if (ciudad !== DATILES.ciudadVenta) return err(`Los dátiles se venden en ${DATILES.ciudadVenta} (${DATILES.venta} dinares el almud).`);
    quitarCarta(j, c.uid); j.dinares += DATILES.venta; log(e, `${j.nombre} vende un almud de dátiles en ${ciudad} por ${DATILES.venta} dinares.`, { pid });
    if (!j.retosHechos.includes(DATILES.reto)) { j.retosHechos.push(DATILES.reto); j.noches += DATILES.noches; log(e, `${j.nombre} cumple el reto ${DATILES.reto} (llevar dátiles a ${ciudad}): +${DATILES.noches} noches.`, { pid }); }
    if (!e.datilesBagdad) { e.datilesBagdad = true; log(e, `Llegaron dátiles a ${ciudad}: desde ahora todos los mercados venden «Dátiles y pan de viaje».`, { aviso: true }); }
    return ok();
  }
  if (c.ref === 'esclava' || c.ref === 'sal' || c.ref === 'cesta') {
    const p = { esclava: 20, sal: 5, cesta: 2 }[c.ref]; quitarCarta(j, c.uid); j.dinares += Math.floor(p / 2); log(e, `${j.nombre} vende ${ITEMS[c.ref].nombre}.`, { pid }); return ok();
  }
  if (c.ref === 'alfombra') {                                                                           // Jorge (10 de noviembre)
    if (!ALFOMBRA_VENTA.ciudades.includes(ciudad)) return err('La alfombra mágica solo se vende en Samarcanda o Isfahán.');
    quitarCarta(j, c.uid); j.dinares += ALFOMBRA_VENTA.precio; log(e, `${j.nombre} vende su alfombra mágica en ${ciudad} por ${ALFOMBRA_VENTA.precio} dinares; la alfombra se deshace y nadie la puede comprar.`, { pid }); return ok();
  }
  if (c.ref === 'mapaJorasan') {   // como cualquier objeto original: la mitad de su precio; desaparece y los escribas hacen otro
    precio = Math.floor(MAPA_JORASAN.precio / 2); quitarCarta(j, c.uid); j.dinares += precio;
    if (ciudad === MAPA_JORASAN.ciudad) { e.mapasJorasan = mapasJorasanVenta(e) + 1; log(e, `${j.nombre} vende un mapa del Jorasán por ${precio} dinares; queda a la venta en Bagdad.`, { pid }); return ok(); }   // Jorge: en Bagdad, de inmediato
    reponerMapaJorasanLuego(e);
    log(e, `${j.nombre} vende un mapa del Jorasán por ${precio} dinares; el mapa desaparece y los escribas de Bagdad hacen otro (en 2 rondas).`, { pid }); return ok();
  }
  const base = ITEMS[c.ref]?.precio ?? (c.ref === 'veneno' ? 30 : c.ref === 'velo' ? 30 : 0);
  if (!base) return err('Eso no se puede vender al mercado.');
  precio = Math.floor(base / 2); quitarCarta(j, c.uid); j.dinares += precio; log(e, `${j.nombre} vende ${ITEMS[c.ref]?.nombre || c.ref} por ${precio} dinares.`, { pid });
  if (ARMAS_ORIG.includes(c.ref)) log(e, `${j.nombre} vendió su ${ITEMS[c.ref].nombre.toLowerCase()} en ${ciudad === 'Magreb' ? 'el Magreb' : ciudad}.`, { aviso: true });   // anuncio para todos (Jorge, 10 de noviembre)
  { const c2 = devolverArma(e, c.ref, ciudad); if (c2) log(e, `Un${c.ref === 'cimitarra' ? 'a' : ''} ${ITEMS[c.ref].nombre.toLowerCase()} queda a la venta en ${c2}.`); }
  return ok();
}

// Catálogo de la ciudad del jugador (lo que podría comprar ahora) y estimación de lo que cobraría al vender cada carta. Solo lectura: lo usa la vista.
const nCalamos = (j) => j.mano.filter((c) => c.tipo === 'item' && c.ref === 'buza').length;
// Dónde y a cuánto se vende el frasco con tinta de pulpo (Jorge, 17 de noviembre). null: aquí no se vende ahora.
export function precioTinta(e, ciudad) {
  if (ciudad === 'India') return { precio: TINTA.india, stock: Infinity };
  if (ciudad === 'Bagdad' && e.indiaVisitada) return { precio: TINTA.bagdad, stock: Infinity };
  const n = TINTA.ciudadesVenta.includes(ciudad) ? (e.tintaReventa?.[ciudad] || 0) : 0;
  return n > 0 ? { precio: TINTA.reventa, stock: n, reventa: true } : null;
}
const motivoTinta = (e, ciudad) => (ciudad === 'Bagdad' ? 'En Bagdad se vende cuando alguien ya visitó India' : 'El frasco con tinta de pulpo se vende en India (y en Bagdad cuando alguien ya visitó India).');
// Dónde se vende cada producto que no está en todos los mercados, leído de las mismas existencias que usa el mercado (Jorge, 19 de noviembre).
const lista = (cs) => (cs.length > 1 ? cs.slice(0, -1).join(', ') + ' y ' + cs[cs.length - 1] : cs[0]);
export function dondeSeVende(data, x) {
  const ref = x.ref;
  if (x.id) { const o = objDe(data, x.id); const cs = POR_CIUDAD[x.id] || (o ? ciudadesDe(o) : null); return cs?.length && cs.length < data.ciudades.ciudades.length ? lista(cs) : null; }
  if (typeof ref !== 'string' || /^(amarrado|establo):/.test(ref) || DADOS_VENTA[ref]) return null;
  if (ref === 'burro') return 'Basra (y en Aleppo y Damasco cuando se acaban los de Basra)';
  if (ref === 'tintaPulpo') return `India (y en Bagdad cuando alguien ya visitó India; ${lista(TINTA.ciudadesVenta)} revenden los que les venden)`;
  if (ref === 'shatranj') return SHATRANJ.ciudad;
  if (ref === 'alfombraIsfahan') return `${ALFOMBRAS.origen} (y donde alguien las revendió)`;
  if (ref === 'caballoMongol') return MONGOL.ciudad;
  if (ref === 'firman') return 'Bagdad';
  const cs = CIUDAD_ORIGINAL[ref] || ARMAS_CIUDAD[ref];
  return cs ? lista(cs) : null;
}
export const lamparasEn = (e, ciudad) => { e.lamparas ||= Object.fromEntries(LAMPARA.ciudades.map((c) => [c, 1])); return e.lamparas[ciudad] || 0; };
export const alforjasEn = (e, ciudad) => { e.alforjas ||= { [ALFORJA.ciudad]: ALFORJA.inicial }; return e.alforjas[ciudad] || 0; };
export const precioAlforja = (ciudad) => (ciudad === ALFORJA.ciudad ? ALFORJA.precio : ALFORJA.reventa);
// Al terminar cada turno de su dueño, la alforja pierde un turno; al llegar a 0 se deshilacha y vuelve al mercado de Basra.
export function caducarAlforjas(data, e, pid) {
  const j = e.jugadores[pid]; if (!j) return;
  for (const c of j.mano.filter((x) => x.tipo === 'item' && x.ref === 'alforja')) {
    c.extra = { ...(c.extra || {}), turnos: (c.extra?.turnos ?? ALFORJA.turnos) - 1 };
    if (c.extra.turnos > 0) continue;
    quitarCarta(j, c.uid); alforjasEn(e, ALFORJA.ciudad); e.alforjas[ALFORJA.ciudad] += 1;
    log(e, `La alforja de ${j.nombre} se deshilacha y se esfuma: vuelve a la venta en ${ALFORJA.ciudad}.`, { pid });
    if (!j.npc) info(e, pid, 'Tu alforja se deshilachó', 'Se esfumó y vuelve a la venta en Basra.' + (cargaExcedida(j, e) ? ' ' + sobrecarga(j, e) : ''));
  }
}
export function tienda(data, e, pid) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado || !j.pj) return [];
  const cai = dobleCairo(e, j.ciudad), lleno = !tieneCarga(j) && nCarga(j) >= limiteCarga(e, j);   // Jorge (10 de noviembre): 7 sin animal de carga
  const r = [];
  const orig = (ref, desde) => {
    if (ref === 'burro' && j.ciudad !== 'Basra' && !e.burrosNorte) return;   // los de Aleppo y Damasco aparecen al venderse los de Basra
    if (CIUDAD_ORIGINAL[ref] && !CIUDAD_ORIGINAL[ref].includes(j.ciudad) && !(ARMAS_CIUDAD[ref] && existenciaArma(e, ref, j.ciudad) > 0)) return;   // una vendida queda a la venta ahí
    const precio = (ARMAS_ORIG.includes(ref) || ref === 'flechas' ? precioArma(data, e, ref, j) : VENTA_ORIGINAL[ref]) * cai;
    r.push({ ref, nombre: ITEMS[ref].nombre + (ITEMS[ref].ventaja ? ' · ' + ITEMS[ref].ventaja : ''), tipo: ARMAS_ORIG.includes(ref) ? 'Arma' : ref === 'burro' ? 'Transporte' : 'Objeto original', texto: ITEMS[ref].texto, precio, stock: ref === 'burro' ? burrosEn(e, j.ciudad) : ref === 'mapaJorasan' ? mapasJorasanVenta(e) : ARMAS_CIUDAD[ref] || ref === 'buza' ? existenciaArma(e, ref, j.ciudad) : undefined, puede: j.dinares >= precio && existenciaArma(e, ref, j.ciudad) > 0 && !(CARGA_ITEMS.includes(ref) && lleno && !(ref === 'flechas' && tieneItem(j, 'flechas'))) && !(ARMAS_ORIG.includes(ref) && tieneItem(j, ref)) && !(ref === 'burro' && !(burrosEn(e, j.ciudad) > 0)) && !(ref === 'mapaJorasan' && (!(mapasJorasanVenta(e) > 0) || motivoNPCMapa(e, j))),
      motivo: cimitarrasBloqueadas(e, ref) ? MSJ_SIN_FORJA : !(existenciaArma(e, ref, j.ciudad) > 0) ? 'Agotado' : ARMAS_ORIG.includes(ref) && tieneItem(j, ref) ? 'Ya la tienes' : CARGA_ITEMS.includes(ref) && lleno && !(ref === 'flechas' && j.mano.filter((c) => c.tipo === 'item' && c.ref === 'flechas').length % 2 === 0) ? MSJ_COMPRA_LLENO : ref === 'burro' && !(burrosEn(e, j.ciudad) > 0) ? 'No quedan burros' : ref === 'mapaJorasan' && !(mapasJorasanVenta(e) > 0) ? 'Agotado: los escribas tardan 2 rondas en hacer otro' : ref === 'mapaJorasan' && motivoNPCMapa(e, j) ? motivoNPCMapa(e, j) : j.dinares < precio ? 'No te alcanza' : undefined, cantidad: ['flechas', 'buza', 'amate', 'cesta'].includes(ref) });
  };
  ['arco', 'alfanje', 'cimitarra', 'jambiya', 'flechas', 'vino', 'buza', 'amate', 'cesta', 'almudDatiles', 'costalPistaches', 'citricos', 'burro', 'mapaJorasan'].forEach(orig);
  { const b = r.find((x) => x.ref === 'buza'), nc = nCalamos(j);   // máximo 6 cálamos en la mano (Jorge, 17 de noviembre)
    if (b) { b.max = Math.max(1, CALAMO_MAX - nc); if (nc >= CALAMO_MAX) { b.puede = false; b.motivo = `Ya tienes ${CALAMO_MAX} cálamos de Kufa: es el máximo`; } } }
  { const pt = precioTinta(e, j.ciudad);                            // Frasco con tinta de pulpo (Jorge, 17 de noviembre)
    if (pt || j.ciudad === 'Bagdad') r.push({ ref: 'tintaPulpo', nombre: ITEMS.tintaPulpo.nombre, tipo: 'Objeto original', texto: ITEMS.tintaPulpo.texto, precio: pt ? pt.precio : TINTA.bagdad, stock: pt && pt.stock !== Infinity ? pt.stock : undefined,
      puede: !!pt && j.dinares >= pt.precio && !lleno, motivo: !pt ? motivoTinta(e, j.ciudad) : lleno ? MSJ_COMPRA_LLENO : j.dinares < pt.precio ? 'No te alcanza' : undefined }); }
  if (LAMPARA.ciudades.includes(j.ciudad)) { const n = lamparasEn(e, j.ciudad), p = LAMPARA.precio;   // Lámpara de aceite (Jorge, 20 de noviembre)
    r.push({ ref: 'lampara', nombre: ITEMS.lampara.nombre, tipo: 'Objeto original', texto: ITEMS.lampara.texto, precio: p, stock: n, puede: n > 0 && j.dinares >= p && !lleno, motivo: n <= 0 ? 'Agotada: solo había una y no se repone' : lleno ? MSJ_COMPRA_LLENO : j.dinares < p ? 'No te alcanza' : undefined }); }
  { const n = alforjasEn(e, j.ciudad), p = precioAlforja(j.ciudad);   // Alforja (Jorge, 19 de noviembre)
    if (n > 0) { const tiene = j.mano.filter((c) => c.tipo === 'item' && c.ref === 'alforja').length, max = tieneCarga(j) ? ALFORJA.maxCon : ALFORJA.maxSin;
      r.push({ ref: 'alforja', nombre: ITEMS.alforja.nombre, tipo: 'Objeto original', texto: ITEMS.alforja.texto, precio: p, stock: n, puede: j.dinares >= p && tiene < max, motivo: tiene >= max ? (tieneCarga(j) ? `Con animal llevas hasta ${ALFORJA.maxCon}` : 'Sin animal solo puedes llevar una') : j.dinares < p ? 'No te alcanza' : undefined }); } }
  if (j.ciudad === SHATRANJ.ciudad) { const n = shatranjEnIndia(e), p = SHATRANJ.precio;   // Shatranj (Jorge, 19 de noviembre)
    r.push({ ref: 'shatranj', nombre: ITEMS.shatranj.nombre, tipo: 'Objeto original', texto: ITEMS.shatranj.texto, precio: p, stock: n, puede: n > 0 && j.dinares >= p && !lleno, motivo: n <= 0 ? `Agotado: solo hay ${SHATRANJ.stock} en todo el juego` : lleno ? MSJ_COMPRA_LLENO : j.dinares < p ? 'No te alcanza' : undefined }); }
  { const n = alfombrasEn(e, j.ciudad), p = precioAlfombraCompra(j.ciudad);   // Alfombras de Isfahán (Jorge, 18 de noviembre)
    if (n > 0) r.push({ ref: 'alfombraIsfahan', nombre: ITEMS.alfombraIsfahan.nombre, tipo: 'Objeto original', texto: ITEMS.alfombraIsfahan.texto, precio: p, stock: n, puede: j.dinares >= p && !lleno, motivo: lleno ? MSJ_COMPRA_LLENO : j.dinares < p ? 'No te alcanza' : undefined }); }
  for (const [ref, D] of Object.entries(DADOS_VENTA)) if (e.mercadoDados?.[ref]?.ciudad === j.ciudad) {
    const llenoLaud = ref === 'laud' && j.pj !== '4' && lleno;      // a quien no es Jamil, el laúd le pesa
    r.push({ ref, nombre: D.nombre, tipo: 'Objeto original', texto: ITEMS[ref].texto, precio: D.reventa, stock: 1, puede: j.dinares >= D.reventa && !llenoLaud, motivo: llenoLaud ? MSJ_COMPRA_LLENO : j.dinares < D.reventa ? 'No te alcanza' : undefined }); }
  for (const x of (e.amarrados || []).filter((q) => q.ciudad === j.ciudad && !q.vendido)) {   // camellos amarrados con lazo (Jorge, 19 de noviembre)
    const p = REVENTA_ANIMAL.camello, mio = x.dueno === pid;
    r.push({ ref: 'amarrado:' + x.carta.uid, nombre: `Camello amarrado de ${e.jugadores[x.dueno]?.nombre || 'otro jugador'}`, tipo: 'Transporte', texto: `Con las vidas que le quedan. ${ITEMS.camello.texto || ''}`, precio: p, stock: 1,
      puede: !mio && j.dinares >= p, motivo: mio ? 'Es tu camello: recupéralo desde Acciones en tu turno' : j.dinares < p ? 'No te alcanza' : undefined });
  }
  for (const x of (e.establo || []).filter((q) => (q.ciudad || 'Bagdad') === j.ciudad)) {
    r.push({ ref: 'establo:' + x.carta.uid, nombre: `${ITEMS[x.carta.ref].nombre} (de segunda mano)`, tipo: 'Transporte', texto: `De segunda mano. ${ITEMS[x.carta.ref].texto || ''}`, precio: x.precio, stock: 1, puede: j.dinares >= x.precio && !(x.carta.ref === 'burro' && j.pj === 'B' && j.npc), motivo: j.dinares < x.precio ? 'No te alcanza' : undefined });
  }
  if (j.ciudad === MONGOL.ciudad && e.mongoles?.habilitado) {
    const no = motivoNoMongol(e, j);
    r.push({ ref: 'caballoMongol', nombre: ITEMS.caballoMongol.nombre, tipo: 'Transporte', texto: ITEMS.caballoMongol.texto, precio: MONGOL.precio, stock: e.mongoles.stock, puede: !no, motivo: no || undefined });
  }
  if (j.ciudad === 'Bagdad') {
    const p = precioFirman(j);
    if (j.pj !== 'B') r.push({ ref: 'firman', nombre: 'Firmán del Califa', tipo: 'Especial', texto: 'Permite portar arco y jambiya en Bagdad, desafiar y robar allí.', precio: p, stock: e.firmanes, puede: e.firmanes > 0 && !tieneEsp(j, 'F1') && j.dinares >= p });
  }
  for (const o of data.objetos.mazo) {
    const cs = ciudadesDe(o);
    if (cs && !cs.includes(j.ciudad)) continue;
    const precio = o.valor * cai;
    if (o.id === PISTACHES.obj && !e.pistachesBagdad) { r.push({ id: o.id, nombre: o.nombre, tipo: o.tipo, texto: o.efecto, precio, puede: false, motivo: MSJ_SIN_PISTACHES }); continue; }
    if (o.id === DATILES.obj && !e.datilesBagdad) { r.push({ id: o.id, nombre: o.nombre, tipo: o.tipo, texto: o.efecto, precio, puede: false, motivo: MSJ_SIN_DATILES }); continue; }
    r.push({ id: o.id, nombre: o.nombre, tipo: o.tipo, texto: o.efecto, precio, stock: Number.isFinite(existencia(e, o.id, j.ciudad)) ? existencia(e, o.id, j.ciudad) : undefined, puede: existencia(e, o.id, j.ciudad) > 0 && j.dinares >= precio && !lleno,
      // Jorge (10 de noviembre): si no se puede comprar, el botón dice por qué
      motivo: !(existencia(e, o.id, j.ciudad) > 0) ? 'Agotado' : lleno ? MSJ_COMPRA_LLENO : j.dinares < precio ? 'No te alcanza' : undefined });
  }
  for (const x of r) { const d = dondeSeVende(data, x); if (d) x.donde = d; }   // Jorge (19 de noviembre): dónde se vende lo que no hay en todos los mercados
  return r;
}
export function estimarVenta(data, e, pid, c) {
  const j = e.jugadores[pid], ciudad = j?.ciudad;
  if (!j || j.perdido) return null;   // perdido en el Jorasán: no hay botón de vender
  try {
    if (c.tipo === 'objeto' && LIBROS_SUBASTA.includes(c.ref) && ciudad === 'Bagdad') return 100;   // subasta: 100 o 150
    if (c.tipo === 'objeto') {
      const o = objDe(data, c.ref); let p = o.valor, sin = false;
      if (c.ref === 'OB12' && ciudad !== 'Bagdad') return null;   // la Balanza solo se vende en Bagdad
      if (reventaDe(data, c.ref, ciudad) != null) { p = reventaDe(data, c.ref, ciudad); sin = true; } else if (c.ref === 'OB41') { p = 20; sin = true; } else if (c.ref === 'OB24') { p = 40; sin = true; } else if (MITAD_VENTA.includes(c.ref)) p = Math.floor(o.valor / 2);
      return p > 0 ? p - (sin ? 0 : impuesto(data, e, ciudad, p)) : 0;   // 0: sin precio, se regala
    }
    if (c.tipo !== 'item') return null;
    if (esLibro(c)) return ciudad === 'Bagdad' || libroTranscritoAqui(c, ciudad) ? precioLibro(data, e, c, ciudad) : null;
    if (c.ref === 'vino') { const p = valorVino(c, e); return p - impuesto(data, e, ciudad, p); }
    if (c.ref === 'buza') return ciudad === 'El Cairo' ? 4 : ciudad === 'Bagdad' ? 3 : null;
    if (c.ref === 'tintaPulpo') return TINTA.ciudadesVenta.includes(ciudad) ? TINTA.venta : null;
    if (c.ref === 'mapa' && c.extra?.tesoro === 'jugador') return null;
    if (c.ref === 'mapa') { const t = TESOROS[c.extra?.tesoro]; const p = t ? Math.floor(t.valor / 2) : 5; return p - impuesto(data, e, ciudad, p); }
    if (c.ref === 'yegua') return ciudad === YEGUAS.ciudadVenta ? YEGUAS.venta : null;
    if (c.ref === 'caballoMongol') return MONGOL.ciudadesVenta.includes(ciudad) ? MONGOL.venta : null;
    if (VENTA_ANIMAL_BAGDAD[c.ref] != null) return VENTA_ANIMAL_BAGDAD[c.ref];
    if (c.ref === 'alfombra') return ALFOMBRA_VENTA.ciudades.includes(ciudad) ? ALFOMBRA_VENTA.precio : null;
    if (c.ref === 'pergamino') return ciudad === 'Damasco' ? 30 : null;
    if (c.ref === 'especias') return ciudad === 'Bagdad' ? 30 : null;
    if (c.ref === 'alfombraIsfahan') return precioAlfombraVenta(ciudad);
    if (c.ref === 'shatranj') return SHATRANJ.venta[ciudad] ?? null;
    if (c.ref === 'almudDatiles') return ciudad === DATILES.ciudadVenta ? DATILES.venta : null;
    if (c.ref === 'pescado') return precioPescado(ciudad);
    if (c.ref === 'alforja') return ALFORJA.venta;
    if (['esclava', 'sal', 'cesta'].includes(c.ref)) return Math.floor({ esclava: 20, sal: 5, cesta: 2 }[c.ref] / 2);
    const base = ITEMS[c.ref]?.precio ?? (c.ref === 'veneno' || c.ref === 'velo' ? 30 : 0);
    return base ? Math.floor(base / 2) : null;
  } catch { return null; }
}

// Dónde se vende cada carta y a cuánto (o para qué sirve si no se vende), para que «no se vende aquí» nunca quede sin explicación.
const MITAD = { esclava: 10, sal: 2, cesta: 1 };
const USO = {
  idolo: 'Destrúyelo en cualquier ciudad (100 noches) o véndelo en Estambul a los mercaderes venecianos (100 dinares, con riesgo de herejía). Sirve para: reto R41 (Andalucía).',
  caballo: 'Es tu transporte: úsalo para viajar.', camello: 'Es tu transporte: úsalo para viajar.', burro: 'Es tu transporte: úsalo para viajar.', alfombra: 'Es tu transporte: úsala para viajar.',
  brujula: 'Sirve para buscar tesoros (1 intento extra).', astrolabio: 'Sirve para buscar tesoros (2 intentos extra).',
  recetaAverroes: 'Úsala para curarte una herida.', bendicionAbuMadyan: 'Te protege una vez de los asaltos en Andalucía y el Magreb.', dadoIbnArabi: 'Repite una pelea que vayas a perder.',
  dadivaEmir: 'Paga tu pasaje a una ciudad conectada: se usa sola en tu siguiente viaje de caravana.',
  pergaminoSellado: 'Es la carga del reto R30.', cartaUrgente: 'Es la carga del reto R39: llévala a El Cairo.',
};
export function dondeVender(data, e, pid, c) {
  const j = e.jugadores[pid]; if (!j) return null;
  const m = (j.misiones || []).find((x) => (x.carga || []).some((k) => k.uid === c.uid));
  if (m) return `No se vende: es la carga del reto ${m.id}${m.destino ? `; entrégala en ${m.destino}` : ''}.`;
  const lista = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ');
  if (c.tipo === 'objeto') {
    const o = objDe(data, c.ref);
    if (c.ref === 'OB41') return 'El banco la compra por 20 dinares en cualquier ciudad.';
    if (LIBROS_SUBASTA.includes(c.ref)) return `Mejor venta: Bagdad, en subasta (dado par 150, impar 100 cada uno; una sola tirada para todas tus copias). También: ${Object.entries(o.reventa).filter(([k]) => k !== 'Bagdad').map(([k, v]) => `${k} ${v}`).join(', ')}.`;
    if (c.ref === 'OB24') return 'El banco la compra por 40 dinares en cualquier ciudad.';
    if (c.ref === 'OB12') return `Solo en Bagdad: te pagan lo mismo que te costó (${o.valor} dinares). O a otro jugador en un trato. Pesa como cualquier objeto.`;
    if (!o?.valor) return 'Nadie la compra: solo sirve para usarla.';
    if (o.reventa) { const [mc, mp] = Object.entries(o.reventa).sort((x, y) => y[1] - x[1])[0]; return `Mejor venta: ${mc} (${mp} dinares, sin impuesto). También: ${lista(o.reventa)}; en las demás ciudades, ${o.valor} menos el impuesto.`; }
    return `En cualquier ciudad por ${o.valor} dinares, menos el impuesto (mejor en Bagdad, sin impuesto).`;
  }
  if (c.tipo === 'especial') return c.ref === 'F1' ? 'El Firmán no se vende: se queda contigo (vuelve al banco si mueres).' : 'Carta especial: no se vende.';
  if (c.tipo !== 'item') return null;
  if (esLibro(c) && c.extra?.transcrito) return MSJ_TRANSCRITOS;
  if (esLibro(c)) return 'Solo la biblioteca de Bagdad compra libros y papiros (mitad de su valor; precio completo con «Casa de la Sabiduría»).';
  if (c.ref === 'vino') return 'En cualquier mercado, a su valor actual menos el impuesto; la botella se esfuma.';
  if (c.ref === 'buza') return 'En El Cairo por 4 o en Bagdad por 3: tiras un dado y te compran tantos como salga (los demás, en otro turno).';
  if (c.ref === 'shatranj') return `Solo en Isfahán (${SHATRANJ.venta['Isfahán']}), Bagdad (${SHATRANJ.venta.Bagdad}) o Andalucía (${SHATRANJ.venta['Andalucía']} dinares); al venderlo deja de existir. La tinta de pulpo lo estropea.`;
  if (c.ref === 'tintaPulpo') return `Solo en Andalucía o Samarcanda, por ${TINTA.venta} dinares (ahí se revende en ${TINTA.reventa}). Si te roban, se rompe y destruye tus papeles.`;
  if (c.ref === 'yegua') return 'Solo el mercado de Estambul: 150 dinares por yegua. O a otro jugador en un trato, en cualquier ciudad, al precio que acuerden.';
  if (c.ref === 'caballoMongol') return 'Solo en Estambul, por 2 dinares (ahí vuelve a la venta): en las demás ciudades nadie lo quiere.';
  if (VENTA_ANIMAL_BAGDAD[c.ref] != null) return `En el mercado de cualquier ciudad: ${VENTA_ANIMAL_BAGDAD[c.ref]} dinares ${c.ref === 'burro' ? ', por desnutrido' : ''} (ahí se revende a ${REVENTA_ANIMAL[c.ref]}, con todos sus turnos de vida).`;
  if (DADOS_VENTA[c.ref]) return `Al mercado de cualquier ciudad por ${DADOS_VENTA[c.ref].venta} dinares (ahí se ${DADOS_VENTA[c.ref].uno ? 'revende' : 'revenden'} en ${DADOS_VENTA[c.ref].reventa}), o a otro jugador en un trato al precio que quieran.`;
  if (c.ref === 'mapaJorasan') return `Al mercado de cualquier ciudad por ${Math.floor(MAPA_JORASAN.precio / 2)} dinares (en Bagdad queda a la venta de inmediato; en otra ciudad desaparece y los escribas de Bagdad hacen otro en 2 rondas), o a otro jugador en un trato. Sirve para salir del Jorasán.`;
  if (c.ref === 'pergamino') return 'Solo se cobra en Damasco: 30 dinares.';
  if (c.ref === 'lampara') return 'No se vende al mercado: sirve para estudiar con mecenas (R46, R47 y R55).';
  if (c.ref === 'especias') return 'Solo en Bagdad: 30 dinares, sin impuesto.';
  if (c.ref === 'mapa' && c.extra?.tesoro === 'jugador') return 'El banco no lo compra: véndelo o regálalo a otro jugador en un trato, o ve a esa ciudad a sacar los dinares.';
  if (c.ref === 'mapa') return 'En cualquier ciudad, a la mitad del valor del tesoro menos el impuesto; o ve a buscar el tesoro.';
  if (c.ref === 'alfombraIsfahan') return `En cualquier mercado por ${ALFOMBRAS.venta} dinares (Andalucía ${ALFOMBRAS.ventaCiudad['Andalucía']}; Isfahán solo ${ALFOMBRAS.recompraOrigen}); ahí queda a la venta ${ALFOMBRAS.margen} dinares más cara. O a otro jugador en un trato.`;
  if (c.ref === 'alforja') return `En cualquier mercado por ${ALFORJA.venta} dinar; ese mercado la revende a ${ALFORJA.reventa} (en Basra, a ${ALFORJA.precio}). Le quedan ${c.extra?.turnos ?? ALFORJA.turnos} turno(s).`;
  if (c.ref === 'pescado') return `En cualquier mercado: Basra ${PESCA.venta.Basra}, Bagdad ${PESCA.venta.Bagdad} y en las demás ciudades ${PESCA.otra} dinares, sin impuesto; al venderlo se esfuma.`;
  if (c.ref === 'almudDatiles') return `Solo en ${DATILES.ciudadVenta}, por ${DATILES.venta} dinares el almud (la primera vez cumples el reto ${DATILES.reto}: +${DATILES.noches} noches).`;
  if (MITAD[c.ref] != null) return `En cualquier ciudad por ${MITAD[c.ref]} dinares.`;
  if (c.ref === 'alfombra') return `Solo en Samarcanda o Isfahán, por ${ALFOMBRA_VENTA.precio} dinares (se deshace: el mercado no la revende). También te saca del Jorasán.`;
  if (USO[c.ref]) return `No se vende. ${USO[c.ref]}`;
  const base = ITEMS[c.ref]?.precio ?? (c.ref === 'veneno' || c.ref === 'velo' ? 30 : 0);
  return base ? `En cualquier ciudad por ${Math.floor(base / 2)} dinares (la mitad de su precio).` : `No se vende.${ITEMS[c.ref]?.texto ? ' ' + ITEMS[c.ref].texto : ''}`;
}

export const robarBotinPublico = (data, e, pid) => robarBotin(data, e, pid);
export const hiloDe = (j) => tieneObj(j, 'OB28');
export function gastarHilo(data, e, pid) { consumirObj(data, e, pid, 'OB28'); }

// OB22 Sopa del mesón: si pagas alojamiento, solo la mitad (redondeo hacia arriba). Se usa sola porque siempre conviene.
export function sopa(data, e, pid, costo) {
  const j = e.jugadores[pid];
  if (costo > 0 && tieneObj(j, 'OB22')) { consumirObj(data, e, pid, 'OB22'); log(e, `${j.nombre} toma la Sopa del mesón: paga la mitad del alojamiento.`, { pid }); return Math.ceil(costo / 2); }
  return costo;
}

// ---------------------------------------------------------------- uso de objetos y cartas durante el turno
const USOS = {
  OB05: { titulo: 'Lazo de camellero', obj: true }, OB15: { titulo: 'Joya para el visir' }, OB16: { titulo: 'Regalo para Masrur' }, OB19: { titulo: 'Dátiles y pan de viaje', si: (j) => j.herido || false },
  OB24: { titulo: 'Botella de genio' }, OB27: { titulo: 'Pluma de roc' }, OB31: { titulo: 'Cuaderno de ruta' }, OB33: { titulo: 'Cuaderno de refranes' }, OB42: { titulo: 'Disfraz de mendigo', si: (j) => j.buscado > 0 },
};
const TRANSPORTE = { caballo: 1, camello: 2, burro: 3, alfombra: 1, caballoMongol: 1 };
// Yafar NPC y los burros (Jorge, 19 de noviembre): en fácil ni los compra ni los usa; en normal los compra para que no los compre ningún
// jugador; en difícil los compra todos y deja que se mueran, para que nadie los aproveche. Nunca los monta (Jorge, 19 de noviembre).
const dificultad = (e) => (['facil', 'normal', 'dificil'].includes(e.opciones?.dificultad) ? e.opciones.dificultad : 'normal');
export const VENTA_BURRO_MERCADO = 25;
export const yafarSinBurro = (e, j) => j.pj === 'B' && j.npc && dificultad(e) === 'facil';
export const yafarNoMonta = (e, j) => j.pj === 'B' && j.npc;   // Yafar NPC nunca monta burros
export function burroDelMercado(e, pid, p) {   // compra un burro del mercado de su ciudad (ya validado)
  const j = e.jugadores[pid];
  j.dinares -= p; if (j.ciudad === 'Basra') e.burros--; else e.burrosNorte[j.ciudad]--;
  j.noches += 20; log(e, `${j.nombre} compra un burro en ${j.ciudad} y recibe 20 noches de regalo.`, { pid }); darItem(e, j, 'burro', { origen: j.ciudad });
  if (j.ciudad === 'Basra' && !(e.burros > 0) && !e.burrosNorte) { e.burrosNorte = { ...BURROS.norte }; log(e, 'Se vendieron los burros de Basra: ya hay un burro a la venta en Aleppo y otro en Damasco.', { aviso: true }); }
}
export const BURRO_CANSADO = 'Tu burro está cansado: solo lo puedes usar una vez por turno.';   // Jorge (19 de noviembre)

// Pesca (Jorge, 19 de noviembre): en Basra, con la Red de pescador, gastas tu acción principal pescando y obtienes pescado. Se vende en
// Basra por 5, en Bagdad por 10 y en cualquier otra ciudad por 8 (precio fijo, sin impuesto); al venderlo se esfuma. La red no se gasta.
export const PESCA = { ciudad: 'Basra', porPesca: 1, venta: { Basra: 5, Bagdad: 10 }, otra: 8 };
export const precioPescado = (ciudad) => PESCA.venta[ciudad] ?? PESCA.otra;
function pescar(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno;
  if (j.ciudad !== PESCA.ciudad) return err('Solo se pesca en Basra.');
  if (!tieneObj(j, 'OB10')) return err('Necesitas una Red de pescador.');
  if (j.npc) return err('Yafar NPC no pesca.');
  if (!puedePrincipal(t)) return err('Ya usaste tu acción principal este turno.');
  t.principal = true;
  for (let i = 0; i < PESCA.porPesca; i++) darItem(e, j, 'pescado');
  log(e, `${j.nombre} pesca en Basra con su Red de pescador y obtiene ${PESCA.porPesca === 1 ? 'un pescado' : PESCA.porPesca + ' pescados'}.`, { pid });
  info(e, pid, 'Pescas en Basra', `Obtienes ${PESCA.porPesca === 1 ? 'un pescado' : PESCA.porPesca + ' pescados'}: en Basra te dan ${PESCA.venta.Basra} dinares, en Bagdad ${PESCA.venta.Bagdad} y en cualquier otra ciudad ${PESCA.otra}. Al venderlo se esfuma.`);
  recortarMano(data, e, pid);
  return ok();
}
export function disponibles(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, r = [];
  if (!t || t.pid !== pid || t.fase === 'ingreso' || t.fin) return r;
  { const red = tieneObj(j, 'OB10');
    if (red && j.ciudad === PESCA.ciudad && !j.npc && !t.ccActual) r.push({ k: 'usar', uid: red.uid, via: 'pescar', titulo: 'Pescar con tu Red de pescador (gasta tu acción principal)', bloqueado: puedePrincipal(t) ? null : 'Ya usaste tu acción principal este turno.' }); }
  for (const c of j.mano) {
    if (c.tipo === 'objeto' && USOS[c.ref]) {
      const u = USOS[c.ref];
      if (c.ref === 'OB19') continue;   // los dátiles tienen su propio botón en la mano y se usan en cualquier momento (comerDatiles)
      if (c.ref === 'OB42' && !(j.buscado > 0)) continue;
      if (c.ref === 'OB27' && t.maxTramos >= 3) continue;
      if (c.ref === 'OB33' && !(t.ccActual && t.ccActual.tipo === 'trivia' && t.ccActual.descartada == null)) continue;
      if (c.ref === 'OB31' && !(j.misiones.length || j.mensajes.length)) continue;
      const x = { k: 'usar', uid: c.uid, titulo: 'Usar ' + u.titulo };
      if (c.ref === 'OB15' && j.ciudad !== 'Bagdad') x.bloqueado = MSJ_JOYA_VISIR;   // Jorge (19 de noviembre): solo ante el visir, en Bagdad
      if (u.obj) { const ob = enCiudad(e, j.ciudad, pid).filter((q) => !e.jugadores[q].npc); if (!ob.length) continue; x.objetivos = ob; }
      r.push(x);
    }
    if (c.tipo === 'item' && c.ref === 'idolo') {                                                     // R41: destruirlo o venderlo a los venecianos
      r.push({ k: 'usar', uid: c.uid, titulo: 'Destruir el Ídolo de Toledo (100 noches, acción libre)', via: 'destruir' });
      if (j.ciudad === 'Estambul') r.push({ k: 'usar', uid: c.uid, titulo: 'Vender el ídolo a los venecianos (100 dinares; con 1–2 te acusan de herejía)', via: 'venecianos' });
    }
    if (c.tipo === 'objeto' && c.ref === 'OB04' && j.ciudad === REPARA_ESCUDO.ciudad) {   // Jorge (12 de noviembre): reparar el escudo en Isfahán
      const sano = !(c.extra?.flechazos > 0);
      r.push({ k: 'usar', uid: c.uid, via: 'reparar', titulo: `Reparar el escudo (${REPARA_ESCUDO.costo} dinares, no gasta tu acción principal)`, bloqueado: sano ? 'Tu escudo no necesita reparación.' : j.dinares < REPARA_ESCUDO.costo ? `Te faltan ${REPARA_ESCUDO.costo - j.dinares} dinares.` : undefined });
    }
    if (c.tipo === 'item' && c.ref === 'recetaAverroes' && (j.herido || t.heridoAhora)) r.push({ k: 'usar', uid: c.uid, titulo: 'Usar la Receta de Averroes (cura tu herida)' });
    if (c.tipo === 'item' && c.ref === 'veneno') {
      const vic = activos(e).filter((q) => q !== pid && !e.jugadores[q].npc);
      if (vic.length) r.push({ k: 'usar', uid: c.uid, titulo: 'Usar veneno (Anciana Devota, 20 dinares + transporte)', objetivos: vic, via: 'anciana' });
      // Jorge (19 de noviembre): envenenar a otro jugador de tu ciudad (acción principal; secreto; lo deja herido salvo con Antídoto)
      const aqui = activos(e).filter((q) => q !== pid && e.jugadores[q].ciudad === j.ciudad && !e.jugadores[q].npc && !e.jugadores[q].transito);
      if (aqui.length) r.push({ k: 'usar', uid: c.uid, titulo: 'Envenenar a un jugador de tu ciudad (gasta tu acción principal; lo deja herido)', objetivos: aqui, via: 'ciudad', bloqueado: puedePrincipal(t) ? null : 'Ya usaste tu acción principal este turno.' });
      else if (activos(e).some((q) => e.jugadores[q].npc && e.jugadores[q].ciudad === j.ciudad)) r.push({ k: 'usar', uid: c.uid, titulo: 'Envenenar a un jugador de tu ciudad', via: 'ciudad', bloqueado: MSJ_VENENO_YAFAR });
      if (j.ciudad === 'Bagdad') r.push({ k: 'usar', uid: c.uid, titulo: `Envenenar un abrevadero (Masrur, ${5 * vivos(e)} dinares)`, destinos: data.ciudades.ciudades.map((q) => q.id), via: 'abrevadero' });
    }
    if (c.tipo === 'item' && TRANSPORTE[c.ref] && !t.ccActual && !j.perdido && !motivoNoSalir(e, j, false) && t.tramos < tramosMax(data, t, j)) {
      const dest = destinosTransporte(data, c.ref, j.ciudad).filter((q) => !(j.pj === 'B' && j.npc && q === 'India') && !ciudadCerrada(e, q));
      if (c.ref === 'burro' && yafarNoMonta(e, j)) continue;                       // Yafar NPC nunca monta burro (Jorge, 19 de noviembre)
      const vida = ANIMAL_DEF[c.ref] ? ` · le quedan ${turnosAnimal(data, c)} turno(s)` : '';   // con dos del mismo tipo, se distinguen por su vida
      if (c.ref === 'burro' && t.burroUsado && dest.length) { r.push({ k: 'usar', uid: c.uid, titulo: 'Viajar con Burro' + vida, bloqueado: BURRO_CANSADO }); continue; }
      if (dest.length) r.push({ k: 'usar', uid: c.uid, titulo: 'Viajar con ' + ITEMS[c.ref].nombre + (data.objetos.transportes?.[c.ref]?.terminaTurno ? ' (termina tu turno)' : '') + vida, destinos: dest });
      else if (c.ref === 'burro' && destinosTransporte(data, 'burro', j.ciudad).length) {   // Jorge (26 de noviembre): durante la Cruzada, desde El Cairo solo quedaba el Jorasán y no se decía por qué
        const cer = destinosTransporte(data, 'burro', j.ciudad).filter((q) => ciudadCerrada(e, q));
        r.push({ k: 'usar', uid: c.uid, titulo: 'Viajar con Burro' + vida, bloqueado: `Desde ${j.ciudad} el burro solo va a ${cer.join(' y ')}, y ahora no se puede ir: ${motivoCerrada(e, cer[0])}` });
      } else if (c.ref === 'burro') r.push({ k: 'usar', uid: c.uid, titulo: 'Viajar con Burro' + vida, bloqueado: 'El burro solo viaja por tierra entre Estambul y Aleppo, El Cairo y Damasco, Damasco y Aleppo, Isfahán y Bagdad, y Basra y Bagdad. Aquí no te mueve, pero lo puedes vender.' });
      else if ((data.objetos.transportes?.[c.ref]?.noSaleDe || []).includes(j.ciudad)) r.push({ k: 'usar', uid: c.uid, titulo: 'Viajar con ' + ITEMS[c.ref].nombre, bloqueado: `Ni el caballo ni el camello van a ${j.ciudad} ni salen de allí: viaja en caravana o en alfombra.` });
    }
  }
  return r;
}

const ANIMALES = ['caballo', 'camello', 'burro', 'caballoMongol', 'yegua'];   // el abrevadero envenenado también mata yeguas y caballos mongoles (Jorge, 12 de noviembre)

// Destinos de cada transporte propio (objetos.json, «transportes»). India solo se alcanza en caravana o en alfombra.
export function destinosTransporte(data, ref, desde) {
  const r = data.objetos.transportes?.[ref], todas = data.ciudades.ciudades.map((q) => q.id).filter((q) => q !== desde);
  if (!r) return todas;
  if ((r.noSaleDe || []).includes(desde)) return [];                                             // caballo y camello no salen de India
  if (r.cercanas || r.rutas) {                                                                   // burro: solo por sus rutas, ida y vuelta (Jorge, 19 de noviembre)
    const cer = r.cercanas || [], extra = (r.rutas || []).filter((p) => p.includes(desde)).map((p) => p.find((q) => q !== desde));
    return [...new Set([...(desde === 'Bagdad' ? cer : cer.includes(desde) ? ['Bagdad'] : []), ...extra])];
  }
  if (r.solo) return todas.filter((q) => r.solo.includes(q));
  return todas.filter((q) => !(r.excepto || []).includes(q));
}
const textoTransporte = (ref) => ({ burro: 'el burro solo hace viajes cortos por tierra: Estambul–Aleppo, El Cairo–Damasco, Damasco–Aleppo, Isfahán–Bagdad y Basra–Bagdad (ida y vuelta).', caballo: 'el caballo no va a Samarcanda, al Magreb, a India ni a Bagdad, y no sale de India.', camello: 'el camello solo va al Magreb, a Samarcanda y a Yemen, y no sale de India.', alfombra: 'la alfombra no sirve para ir a Bagdad.' })[ref] || '';

// Veneno (R 15.1): por la Anciana Devota (20 dinares + transporte desde Bagdad) o sobornando a Masrur para envenenar un abrevadero (5 dinares por jugador vivo).
export const MSJ_VENENO_YAFAR = 'Los espías corruptos de Yafar lo protegen del veneno.';
function usarVeneno(data, e, pid, c, a) {
  const j = e.jugadores[pid];
  if (a.via === 'ciudad') {
    const v = e.jugadores[a.objetivo], t = e.turno;
    if (v?.npc) return err(MSJ_VENENO_YAFAR);
    if (!v || v.eliminado || a.objetivo === pid || v.ciudad !== j.ciudad) return err('Elige a otro jugador de tu ciudad.');
    if (!puedePrincipal(t)) return err('Ya usaste tu acción principal este turno.');
    t.principal = true; quitarCarta(j, c.uid);
    if (tieneObj(v, 'OB20')) { consumirObj(data, e, a.objetivo, 'OB20'); log(e, `Alguien envenena a ${v.nombre}, pero toma su antídoto y se salva.`); info(e, a.objetivo, '¡Te envenenaron!', 'Alguien te envenenó, pero tu Antídoto te salvó (se gastó).'); return ok(); }
    v.herido = true;
    log(e, `Alguien envenena a ${v.nombre}: queda herido.`);
    info(e, a.objetivo, '¡Te envenenaron!', 'Alguien te envenenó en secreto: quedas herido.');
    return ok();
  }
  if (a.via === 'abrevadero') {
    if (j.ciudad !== 'Bagdad') return err('Masrur está en Bagdad.');
    if (!ciudadDe(data, a.destino)) return err('Elige la ciudad del abrevadero.');
    const precio = 5 * vivos(e);
    if (j.dinares < precio) return err(`Masrur pide ${precio} dinares.`);
    j.dinares -= precio; quitarCarta(j, c.uid);
    let muertos = 0;
    for (const q of enCiudad(e, a.destino)) { const x = e.jugadores[q]; const n = x.mano.length; x.mano = x.mano.filter((k) => !(k.tipo === 'item' && ANIMALES.includes(k.ref))); muertos += n - x.mano.length; }
    log(e, `Alguien envenena el abrevadero de ${a.destino}: mueren ${muertos} animal(es).`);
    return ok();
  }
  const v = e.jugadores[a.objetivo];
  if (!v || v.eliminado || v.npc || a.objetivo === pid) return err('Elige a un jugador vivo.');
  const fare = v.ciudad === 'Bagdad' ? 0 : (tarifa(data, e, j, 'Bagdad', v.ciudad) ?? 0);
  const precio = 20 + fare;
  if (j.dinares < precio) return err(`Cuesta ${precio} dinares (20 y el transporte desde Bagdad).`);
  j.dinares -= precio; quitarCarta(j, c.uid);
  log(e, `Alguien ha enviado veneno a ${v.nombre}.`);
  envenenar(data, e, a.objetivo, pid);
  return ok();
}
function envenenar(data, e, victima, por) {
  const v = e.jugadores[victima];
  if (tieneObj(v, 'OB20')) { consumirObj(data, e, victima, 'OB20'); log(e, `${v.nombre} toma su antídoto y se salva del veneno.`, { pid: victima }); return; }
  pedir(e, { tipo: 'veneno', para: [victima], titulo: '¡Te han envenenado!', texto: 'Puedes pagar todas tus noches al Sabio Ruyán a cambio de no morir.', privado: true,
    opciones: [{ id: 'pagar', texto: `Pagar mis ${v.noches} noches y vivir` }, { id: 'morir', texto: 'Aceptar mi destino' }], porDefecto: 'pagar', limiteMs: 60000, cont: { fn: 'obj.veneno', args: { victima, por } } });
}
registrar('obj.veneno', (data, e, args, resp) => {
  const v = e.jugadores[args.victima];
  if (!v || v.eliminado) return;
  if (resp.opcion === 'pagar') {
    const ruyan = activos(e).find((q) => e.jugadores[q].pj === '5' && q !== args.victima);
    if (ruyan) e.jugadores[ruyan].noches += v.noches;
    log(e, `${v.nombre} paga todas sus noches ${ruyan ? 'al Sabio Ruyán' : 'a Ruyán (que no juega: vuelven al banco)'} y sobrevive al veneno.`, { pid: args.victima });
    v.noches = 0;
    return;
  }
  eliminar(data, e, args.victima, { por: args.por, causa: 'veneno', secreto: true });
});

export function usar(data, e, pid, a) {
  const j = e.jugadores[pid], t = e.turno;
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('Solo en tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  const c = j.mano.find((x) => x.uid === a.uid);
  if (!c) return err('No tienes esa carta.');
  if (c.tipo === 'ifrit') return err('Las cartas de Ifrit ya no se guardan: el deseo se pide cuando sale la carta.');   // Jorge (21 de noviembre)
  if (c.tipo === 'item' && TRANSPORTE[c.ref]) {
    if (t.ccActual) return err('Resuelve primero la Carta de Trivias.');
    if (t.tramos >= tramosMax(data, t, j)) return err(tieneItem(j, 'alforja') ? MSJ_ALFORJA_TRAMO : t.huidas ? MSJ_HUIDA_TRAMO : 'Ya no te quedan tramos de viaje este turno.');
    if (j.perdido) return err('Estás perdido.');
    const dest = a.destino;
    if (!ciudadDe(data, dest) || dest === j.ciudad) return err('Destino inválido.');
    if (c.ref === 'burro' && yafarNoMonta(e, j)) return err('Yafar no monta en burro: dice que es indigno de su posición.');
    if (c.ref === 'burro' && t.burroUsado) return err(BURRO_CANSADO);   // Jorge (19 de noviembre): una vez por turno
    if (j.pj === 'B' && j.npc && dest === 'India') return err('Yafar no tiene contactos en India: no puede ir.');
    if (!destinosTransporte(data, c.ref, j.ciudad).includes(dest)) return err(`Ahí no te lleva: ${textoTransporte(c.ref)}`);
    if (ciudadCerrada(e, dest)) return err(motivoCerrada(e, dest));
    { const m = motivoNoSalir(e, j, false); if (m) return err(m); }
    if (c.ref === 'burro') t.burroUsado = true;
    return HOOK.viajarPropio(data, e, pid, { destino: dest, motivo: ITEMS[c.ref].nombre.toLowerCase(), termina: !!data.objetos.transportes?.[c.ref]?.terminaTurno, consumeUid: null });   // la alfombra ya no se gasta (regla de la casa)
  }
  if (c.tipo === 'objeto' && c.ref === 'OB10' && a.via === 'pescar') return pescar(data, e, pid);
  if (c.tipo === 'item' && c.ref === 'veneno') return usarVeneno(data, e, pid, c, a);
  if (c.tipo === 'item' && c.ref === 'idolo') {
    if (a.via === 'destruir') { quitarCarta(j, c.uid); e.idolo = 'destruido'; j.noches += 100; log(e, `${j.nombre} destruye el Ídolo de Toledo y gana 100 noches.`, { pid, aviso: true }); return ok(); }
    if (a.via !== 'venecianos') return err('¿Qué quieres hacer con el ídolo?');
    if (j.ciudad !== 'Estambul') return err('Los mercaderes venecianos están en Estambul.');
    quitarCarta(j, c.uid); e.idolo = 'vendido'; j.dinares += 100;
    const x = dado(e), pillado = x <= 2;
    mostrarDados(e, { por: pid, motivo: 'idolo', grupos: [{ etq: `${j.nombre}: ¿te descubren vendiendo el ídolo? (1 o 2: herejía)`, valores: [x] }],
      resumen: [pillado ? `Te acusan de herejía: acabas herido en el Jorasán y sin dinares.` : 'Nadie se entera: te quedas con los 100 dinares.'] });
    if (pillado) { j.dinares = 0; j.herido = true; j.perdido = true; j.ciudad = 'Jorasán'; j.extra.enRumbo = false; if (t) { t.movio = true; t.fin = true; } }
    log(e, pillado ? `${j.nombre} vende el Ídolo de Toledo a los venecianos, pero lo acusan de herejía: acaba herido en el Jorasán y sin dinares.` : `${j.nombre} vende el Ídolo de Toledo a los venecianos por 100 dinares.`, { pid, aviso: true });
    return ok();
  }
  if (c.tipo === 'item' && c.ref === 'recetaAverroes') {
    if (!(j.herido || t.heridoAhora)) return err('No estás herido.');
    quitarCarta(j, c.uid); j.herido = false;
    if (t.heridoAhora) { t.heridoAhora = false; t.principal = false; }
    log(e, `${j.nombre} sigue la receta de Averroes y se cura de su herida.`, { pid }); return ok();
  }
  if (c.tipo !== 'objeto') return err('Eso no se usa así.');
  if (c.ref === 'OB04' && a.via === 'reparar') {
    if (j.ciudad !== REPARA_ESCUDO.ciudad) return err('Los escudos se reparan en Isfahán.');
    if (!(c.extra?.flechazos > 0)) return err('Tu escudo no necesita reparación.');
    if (j.dinares < REPARA_ESCUDO.costo) return err(`Te faltan ${REPARA_ESCUDO.costo - j.dinares} dinares.`);
    j.dinares -= REPARA_ESCUDO.costo; c.extra = { ...(c.extra || {}), flechazos: 0 };
    log(e, `${j.nombre} repara su escudo en Isfahán por ${REPARA_ESCUDO.costo} dinares: vuelve a aguantar 3 flechazos.`, { pid }); return ok();
  }
  switch (c.ref) {
    case 'OB05': {
      const o = e.jugadores[a.objetivo];
      if (!o || o.eliminado || o.ciudad !== j.ciudad || a.objetivo === pid || o.transito) return err('Objetivo inválido.');
      // Jorge (19 de noviembre): el lazo no se gasta; para que no se lance sin fin, una vez por turno.
      if (j.extra.lazoTurno === j.turnos) return err('Ya lanzaste tu lazo este turno.');
      j.extra.lazoTurno = j.turnos;
      const x = dado(e);
      const inmune = tieneObj(o, 'OB23') || tieneObj(o, 'OB25');
      mostrarDados(e, { por: pid, motivo: 'lazo', grupos: [{ etq: `${j.nombre} lanza el lazo`, valores: [x] }], resumen: [x >= 4 && !inmune ? `${o.nombre} no podrá viajar en su siguiente turno.` : `El lazo no atrapa a ${o.nombre}.`] });
      if (x >= 4 && !inmune) o.extra.lazoTurno = (o.turnos || 0) + 1;
      return ok();
    }
    case 'OB15':   // Joya para el visir (Jorge, 19 de noviembre): solo en Bagdad; el descuento del Firmán queda guardado
      if (j.ciudad !== 'Bagdad') return err(MSJ_JOYA_VISIR);
      consumirObj(data, e, pid, 'OB15'); j.extra.joyaVisir = true;
      log(e, `${j.nombre} le entrega una Joya al visir en Bagdad: consulta gratuita y el Firmán a 45 dinares.`, { pid });
      info(e, pid, 'El visir te recibe', 'Yafar te presta una consulta gratuita: los Asesinos ' + (e.asesinos.actuaron ? 'ya actuaron.' : 'todavía no han actuado.') + ' Tu descuento queda guardado: el Firmán te costará 45 dinares (en vez de 55) cuando lo compres en Bagdad, mientras queden.'); return ok();
    case 'OB16': {
      if (j.ciudad !== 'Bagdad') return err('Masrur está en Bagdad.');
      consumirObj(data, e, pid, 'OB16');
      j.extra.masrur = true;                                                  // regla de la casa: Masrur te avisará en secreto si contratan a los Asesinos contra ti
      if (e.asesinos.pendiente?.victima === pid) HOOK.avisoMasrur(e, pid);
      else info(e, pid, 'Masrur te protege', 'Masrur acepta tu regalo: si alguien contrata a los Asesinos contra ti, te avisará en secreto para que puedas huir al Jorasán.');
      return ok();
    }
    case 'OB19': consumirObj(data, e, pid, 'OB19'); j.herido = false; t.bloqueoPrincipal = t.bloqueoPrincipal && !t.heridoAhora ? t.bloqueoPrincipal : false; t.heridoAhora = false; log(e, `${j.nombre} come dátiles y se recupera.`, { pid }); return ok();
    case 'OB24': consumirObj(data, e, pid, 'OB24'); j.dinares += 30; j.noches += 15; log(e, `${j.nombre} libera un genio menor: +30 dinares y +15 noches.`, { pid }); return ok();
    case 'OB27': if (t.maxTramos >= 3) return err('Ya la usaste.'); consumirObj(data, e, pid, 'OB27'); t.maxTramos = 3; log(e, `${j.nombre} usa una Pluma de roc: un tramo extra este turno.`, { pid }); return ok();
    case 'OB31': {
      if (j.extra.cuadernoRuta) return err('Solo una vez por partida.');
      const msg = typeof a.mision === 'string' && j.mensajes.find((m) => a.mision === 'mensaje:' + m.id && m.turnoLimite != null);
      if (msg) msg.turnoLimite++;
      else if (j.misiones[a.mision] && j.misiones[a.mision].limite != null) j.misiones[a.mision].limite++;
      else return err('Elige un mensaje o una misión con plazo.');
      j.extra.cuadernoRuta = true; log(e, `${j.nombre} gana un turno de plazo con su Cuaderno de ruta.`, { pid }); return ok();
    }
    case 'OB33': {
      if (!t.ccActual || t.ccActual.tipo !== 'trivia') return err('Necesitas una trivia abierta.');
      const tr = data.trivias.trivias.find((x) => x.id === t.ccActual.id);
      const malas = tr.opciones.map((_, i) => i).filter((i) => i !== tr.correcta);
      t.ccActual.descartada = malas[Math.floor(dado(e) % malas.length)];
      consumirObj(data, e, pid, 'OB33'); return ok();
    }
    case 'OB42': consumirObj(data, e, pid, 'OB42'); j.buscado = 0; log(e, `${j.nombre} se disfraza de mendigo: ya no es Buscado.`, { pid }); return ok();
    default: return err('Ese objeto se usa en el momento que dice su carta (en un reto, una pelea o un evento).');
  }
}

// Regla de la casa (noviembre de 2026): los animales comen y envejecen. En cada turno de su dueño se paga el albéitar y la comida
// (pago obligatorio: si no alcanza, queda como deuda) y, cumplidos sus turnos, el animal muere al cerrar el turno. El burro se
// repone en el mercado de Basra (siguen siendo N − 1); al morir el camello se reactiva R5 (el caballo ya no reactiva R1: Jorge, 20 de noviembre).
const ANIMAL_DEF = { burro: { vida: 2, costo: 1 }, caballo: { vida: 5, costo: 3 } /* Jorge (20 de noviembre): R1 ya no se reactiva al morir su animal */, camello: { vida: 5, costo: 3, reto: 'R5' },
  caballoMongol: { vida: 2, costoComo: 'caballo' }, yegua: { vida: Infinity, costoComo: 'caballo' } };   // la yegua no muere de vieja; pagan como el caballo
export const animalDe = (data, ref) => { const d = ANIMAL_DEF[ref]; if (!d) return null; const a = { ...d, ...(data.config.animales?.[ref] || {}) }; if (d.costoComo) a.costo = animalDe(data, d.costoComo).costo; return a; };
export const turnosAnimal = (data, c) => Math.max(0, animalDe(data, c.ref).vida - (c.extra?.usados || 0));   // turnos que le quedan después del actual
const animalesDe = (j) => j.mano.filter((c) => c.tipo === 'item' && ANIMAL_DEF[c.ref]);
export function animalesInicioTurno(data, e, pid) {
  const j = e.jugadores[pid];
  for (const c of animalesDe(j)) {
    const a = animalDe(data, c.ref);
    c.extra = { ...(c.extra || {}), usados: (c.extra?.usados || 0) + 1 };
    pagar(data, e, pid, a.costo);
    const n = turnosAnimal(data, c);
    log(e, `${j.nombre} paga ${a.costo} dinar${a.costo === 1 ? '' : 'es'} de albéitar y comida para su ${ITEMS[c.ref].nombre.toLowerCase()}${!Number.isFinite(n) ? '' : n ? ` (le quedan ${n} turno${n === 1 ? '' : 's'} más)` : ': es su último turno'}.`, { pid });
  }
}
export function animalesFinTurno(data, e, pid) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado) return;
  for (const c of animalesDe(j)) if (turnosAnimal(data, c) <= 0) morirAnimal(data, e, pid, c);
}
function morirAnimal(data, e, pid, c) {
  const j = e.jugadores[pid], a = animalDe(data, c.ref);
  quitarCarta(j, c.uid);
  let mas = '';
  if (c.ref === 'burro') { mas = ' Ya no llega otro: los burros que mueren no se reponen.'; }   // Jorge (19 de noviembre)
  else if (a.reto && j.retosHechos.includes(a.reto)) { j.retosHechos = j.retosHechos.filter((r) => r !== a.reto); mas = ` Puede volver a hacer el reto ${a.reto} para conseguir otro.`; }
  log(e, `Muere de viejo el ${ITEMS[c.ref].nombre.toLowerCase()} de ${j.nombre}.${mas}`, { pid, aviso: true });
  if (!j.npc && cargaExcedida(j, e)) { log(e, `${j.nombre}: ${sobrecarga(j, e)}`, { pid }); info(e, pid, 'Vas muy cargado', sobrecarga(j, e)); }   // Jorge (10 de noviembre)
}

// ---------------------------------------------------------------- caducidades (Jorge, 10 de noviembre)
// Dados del Cairo y Dados de Persia: duran 5 turnos de su dueño actual (Jorge, 19 de noviembre; antes 3 rondas), contando el turno en
// que los recibe si es el suyo, o si no el siguiente (si cambian de dueño, el contador vuelve a empezar); al terminar el 5.º, caducan: «Un ifrit se robó tus dados» y salen de la partida. Ejército de Kanmakán: dura 2 turnos de su dueño; pasar por
// Isfahán lo renueva por otros 2; si no, se disuelve al acabarse (además de disolverse al pelear, como antes).
export const DADOS_CADUCAN = ['dadosCairo', 'dadosPersia'], TURNOS_DADOS = 5, TURNOS_KANMAKAN = 2;
// Zein y sus Dados del Cairo (Jorge, 19 de noviembre): «a partir del comienzo de la partida, si Zein llega a El Cairo, en vez de
// que sus dados caduquen a los 5 turnos caducan a los 7. Si nunca visita El Cairo, le duran 5 turnos y ya». Es el total contado
// desde que los tiene (no se renueva el contador): una sola vez, solo Zein y solo con los dados con que empezó (si cambiaron de
// dueño, ya no). Si ya caducaron, llegar a El Cairo no los devuelve.
export const ZEIN_CAIRO = { turnos: 7 };
const durDados = (c) => c.extra?.dur ?? TURNOS_DADOS;
function marcarDueno(c, j, ahora) { if (c.extra?.dueno !== j.id) { const { dur, ...resto } = c.extra || {}; void dur; c.extra = { ...resto, dueno: j.id, desde: ahora, ...(c.extra?.dueno ? { cambio: true } : {}) }; } }   // nuevo dueño: duración normal
const primerTurnoDados = (e, j) => j.turnos + (e.turno?.pid === j.id ? 0 : 1);   // el turno actual si es el suyo; si no, el siguiente
export const turnosDados = (e, j, c) => Math.max(0, (c.extra?.dueno === j.id ? c.extra.desde : primerTurnoDados(e, j)) + (c.extra?.dueno === j.id ? durDados(c) : TURNOS_DADOS) - primerTurnoDados(e, j));
export const duracionDados = (c) => durDados(c);
export function renovarDadosZein(e, pid) {   // al llegar a El Cairo
  const j = e.jugadores[pid];
  if (!j || j.pj !== '2' || j.ciudad !== 'El Cairo') return;
  anotarDuenos(e);
  const c = j.mano.find((x) => x.tipo === 'item' && x.ref === 'dadosCairo');
  if (!c || c.extra?.dueno !== j.id || c.extra?.cambio || c.extra?.dur) return;   // solo los suyos de inicio y una sola vez
  c.extra = { ...c.extra, dur: ZEIN_CAIRO.turnos };
  log(e, `${j.nombre} llega a El Cairo con sus Dados del Cairo: en vez de ${TURNOS_DADOS} turnos le duran ${ZEIN_CAIRO.turnos} (contados desde el inicio).`, { pid });
}   // turnos suyos que le quedan, contando el actual (o el próximo)
export const turnosKanmakan = (j, c) => {
  const desde = c.extra?.dueno === j.id ? c.extra.desde : j.turnos;
  const base = Math.max(desde, j.extra?.isfahanTurno ?? -Infinity);
  return Math.max(0, base + TURNOS_KANMAKAN - j.turnos);   // turnos suyos que le quedan después del actual
};
// Anota quién tiene cada carta con caducidad (al cambiar de dueño por venta, trato, robo o herencia, el contador reinicia).
export function anotarDuenos(e) {
  for (const j of Object.values(e.jugadores)) {
    if (!j?.mano) continue;
    for (const c of j.mano) {
      if (c.tipo === 'item' && DADOS_CADUCAN.includes(c.ref)) marcarDueno(c, j, primerTurnoDados(e, j));
      else if (c.tipo === 'especial' && c.ref === 'K1') marcarDueno(c, j, j.turnos);
    }
  }
}
export function caducarDados(data, e, pid) {   // al terminar cada turno de su dueño
  anotarDuenos(e);
  for (const j of [e.jugadores[pid]]) {
    if (!j?.mano || j.eliminado) continue;
    for (const c of j.mano.filter((x) => x.tipo === 'item' && DADOS_CADUCAN.includes(x.ref))) {
      if (turnosDados(e, j, c) > 1) continue;   // este era su último turno
      quitarCarta(j, c.uid);
      const nom = ITEMS[c.ref].nombre;
      publicarCarta(e, { id: 'caduca:' + c.ref, deck: 'objeto', titulo: 'Un ifrit se robó tus dados', sub: nom, texto: `Un ifrit se robó tus ${nom}: pasaron ${durDados(c)} turnos tuyos desde que los recibiste y desaparecen de la partida.`, arte: 'ob-magico' }, j.id, [j.id]);
      log(e, `Un ifrit se robó los ${nom} de ${j.nombre}: desaparecen de la partida.`, { pid: j.id, aviso: true });
    }
  }
}
export function caducarKanmakan(data, e, pid) {   // al terminar cada turno de su dueño
  anotarDuenos(e);
  const j = e.jugadores[pid]; if (!j?.mano) return;
  const c = j.mano.find((x) => x.tipo === 'especial' && x.ref === 'K1');
  if (!c || turnosKanmakan(j, c) > 0) return;
  quitarCarta(j, c.uid); e.kanmakan = { dueno: null, usada: true };
  publicarCarta(e, { id: 'caduca:K1', deck: 'especial', titulo: 'Se disuelve el Ejército de Kanmakán', sub: 'Carta especial', texto: `Pasaron ${TURNOS_KANMAKAN} turnos sin que volvieras a Isfahán: el Ejército de Kanmakán se disuelve.`, arte: 'es' }, j.id, [j.id]);
  log(e, `El Ejército de Kanmakán de ${j.nombre} se disuelve: pasaron ${TURNOS_KANMAKAN} turnos sin que volviera a Isfahán.`, { pid: j.id, aviso: true });
}

// ---------------------------------------------------------------- burro fuera de sus rutas (Jorge, 19 de noviembre)
// Antes (10 de noviembre) el burro moría fuera de su zona. Ahora ya no muere: si lo llevas a otra ciudad (o al Jorasán) va contigo,
// pero ahí no te mueve (solo viaja por sus rutas); lo puedes vender con sus reglas de siempre. Igual que el caballo y el camello.
// El caballo mongol tampoco muere ya por viajar (Jorge, 21 de noviembre): va a cualquier ciudad y solo muere de viejo, a los 2 turnos.
export const ZONA_BURRO = ['Bagdad', 'Damasco', 'Aleppo', 'Basra', 'El Cairo'];
const conBurro = (mano) => (mano || []).some((c) => c.tipo === 'item' && c.ref === 'burro');
export function avisoBurro() { return null; }   // ya ningún animal muere por el viaje (burro, 19 de noviembre; caballo mongol, 21 de noviembre)
export function burroFueraDeZona() {}
// En las decisiones que te mueven (huir por un evento, deseo de ifrit): aviso en cada opción y, si tu burro llega, «Huir en tu burro».
export const etiquetaBurro = () => '';   // el burro ya no muere fuera de sus rutas (Jorge, 19 de noviembre)
export const destinosBurro = (data, j) => (conBurro(j?.mano) ? destinosTransporte(data, 'burro', j.ciudad) : []);

// Dátiles y pan de viaje (Jorge, 11 de noviembre): en cualquier momento, también fuera de tu turno y en cuanto te los venden en un trato,
// te quitan el marcador «herido»; si ya estás en el turno en que te recuperas, recuperas tu acción principal. O los guardas para otra vez.
export const puedeComerDatiles = (e, j) => !!tieneObj(j, 'OB19') && (j.herido || (e.turno?.pid === j.id && e.turno.heridoAhora && e.turno.principal && !e.turno.fin));
export function comerDatiles(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno;
  if (!j || e.fase !== 'juego' || j.eliminado) return err('Ahora no.');
  if (!tieneObj(j, 'OB19')) return err('No tienes dátiles.');
  if (!puedeComerDatiles(e, j)) return err('No estás herido.');
  consumirObj(data, e, pid, 'OB19');
  if (j.herido) j.herido = false;
  else { t.principal = false; t.heridoAhora = false; }
  log(e, `${j.nombre} come dátiles y pan de viaje: ya no está herido.`, { pid });
  return ok();
}

// Objetos raros de cada ciudad para su ficha (Jorge, 11 de noviembre): lo que vende ese mercado y no se consigue en casi ninguna otra
// parte. Sale de los mismos datos que usa el mercado (ciudades donde se vende cada objeto, armas por ciudad, sopa, pala, linterna…).
// Raro = se vende en RAROS_MAX ciudades o menos; «solo aquí» si es la única. Precio de compra en esa ciudad (cimitarra en Estambul, +5).
export const RAROS_MAX = 4;
export function objetosRaros(data, ciudad) {
  const todas = data.ciudades.ciudades.map((c) => c.id), r = [];
  const agrega = (nombre, cs, precio) => { const n = cs ? cs.length : todas.length; if (cs && cs.includes(ciudad) && n <= RAROS_MAX) r.push({ nombre, precio, soloAqui: n === 1, n }); };
  for (const o of data.objetos.mazo) if (!o.sinVenta) agrega(o.nombre, POR_CIUDAD[o.id] || ciudadesDe(o), o.valor);
  for (const ref of ['arco', 'alfanje', 'cimitarra', 'jambiya', 'flechas', 'vino', 'buza', 'amate', 'cesta', 'burro', 'mapaJorasan']) {
    const base = ARMAS_ORIG.includes(ref) || ref === 'flechas' ? (ref === 'cimitarra' ? (data.config.armas?.cimitarra?.precio ?? ITEMS.cimitarra.precio) : ITEMS[ref].precio) : VENTA_ORIGINAL[ref];
    const k = r.length;
    agrega(ITEMS[ref].nombre, CIUDAD_ORIGINAL[ref] || null, base + (RECARGO_ARMA[ref]?.[ciudad] || 0));
    if (ref === 'burro' && ciudad !== 'Basra' && r.length > k) Object.assign(r[k], { nombre: 'Burro (cuando se venden los de Basra)', condicional: true });
  }
  if (ciudad === 'Bagdad') r.push({ nombre: 'Firmán del Califa', precio: null, soloAqui: true, n: 1 });
  if (ciudad === MONGOL.ciudad) r.push({ nombre: 'Caballo mongol (cuando llegan yeguas de la estepa)', precio: MONGOL.precio, soloAqui: true, n: 1, condicional: true });   // solo después de R50
  return r.sort((a, b) => a.n - b.n || a.nombre.localeCompare(b.nombre, 'es'));
}
