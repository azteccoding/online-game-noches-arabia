// Objetos (R 15): tienda y mercado, venta, reventa y uso de los objetos del mazo, objetos originales (R 15.1), transporte y cartas de Ifrit.
import {
  ok, err, dado, dados, suma, log, nombre, ciudadDe, objDe, activos, enCiudad, tieneItem, tieneObj, tieneEsp, quitarCarta, quitarPrimero, uid, darItem, darObjeto, recortarMano, pagar, devolverObjeto,
  publicarCarta, cartaDatos, robar, robarBotin, ITEMS, TESOROS, HOOK, esLibro, valorLibro, valorVino, mostrarDados, consumirObj, info, puedePrincipal, nObjetos, pedir, registrar, eliminar, tarifa, vivos,
motivoNoSalir,
apurosZein, tieneCarga, LIMITE_OBJETOS, MOTIVO_CARGA, MSJ_COMPRA_LLENO, cargaExcedida, sobrecarga, limiteCarga, CARGA_ITEMS, nCarga, } from './base.js';

// Mercancías de comercio: solo se compran en su ciudad y se venden caras, sin impuesto, en las ciudades de «reventa» (objetos.json).
export const reventaDe = (data, id, ciudad) => objDe(data, id)?.reventa?.[ciudad] ?? null;
const VENTA_ORIGINAL = { arco: 15, alfanje: 25, cimitarra: 35, jambiya: 15, flechas: 5, vino: 20, buza: 1, amate: 2, cesta: 5, burro: 35 };   // Jorge (10 de noviembre): el burro vale 35 y vive 3 turnos
const CIUDAD_ORIGINAL = { vino: ['Bagdad'], buza: ['Damasco'], cesta: ['Basra', 'Bagdad'], burro: ['Basra'] };   // regla de la casa: el burro solo en Basra (35 dinares y 20 noches de regalo)
const ARMAS_ORIG = ['arco', 'alfanje', 'cimitarra', 'jambiya'];

// Bazar del genio (regla de la casa): en Samarcanda e India se vende una carta de Ifrit por ronda (en toda la partida, no por ciudad).
// Jorge (10 de noviembre): se quitó el bazar del genio (comprar una carta de Ifrit en Samarcanda o India): era demasiado fácil.
// Regla de la casa: el mercado de la ciudad (objetos, mercancías y armas) solo vende FUERA de tu turno, mientras juegan los demás.
// Excepción: Yafar NPC compra en su turno. El Firmán y el bazar de Ifrit siguen comprándose en tu turno.
export function puedeMercado(e, pid) {
  const j = e.jugadores[pid];
  if (!j || e.fase !== 'juego' || !e.turno || j.eliminado || !j.pj || j.transito || j.perdido) return 'Ahora no puedes comprar.';
  if (j.npc) return e.turno.pid === pid ? null : 'Yafar NPC compra en su turno.';
  const solo = Object.values(e.jugadores).filter((x) => x.pj && !x.npc && !x.eliminado).length <= 1;   // en solitario no hay turnos ajenos: se compra también en el propio
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
  if (e.mods.mercaderArmas && (ARMAS_ORIG.includes(ref) || ref === 'flechas')) p = Math.ceil(p / 2);       // E10
  return p;
}
const dobleCairo = (e, ciudad) => (e.mods.oroMali && ciudad === 'El Cairo' ? 2 : 1);                    // H9

// Regla de la casa (7 de noviembre): el Firmán cuesta 55 dinares (45 con la joya del visir); Yafar no lo compra.
export const precioFirman = (j) => (j.extra.joyaVisir ? 45 : 55);
// Establo de Bagdad (Jorge, punto 13): caballo, burro y camello se venden en Bagdad por 60, 20 y 50 dinares; quien esté en Bagdad
// los compra después por 10 dinares más. El animal conserva su edad. Yafar no compra burros.
// Jorge (10 de noviembre): caballo, burro o camello se venden en el mercado de cualquier ciudad a 10 dinares y ahí se revenden a 10;
// quien lo compra lo recibe con todos sus turnos de vida (como recién comprado).
// Jorge (10 de noviembre): el burro se vende al mercado por 15 («por desnutrido») y otro lo compra por 35 con su vida completa;
// caballo y camello se venden a 10 y se revenden a 10 (no tienen precio de compra: son premios de reto).
export const VENTA_ANIMAL_BAGDAD = { caballo: 10, burro: 15, camello: 10 }, REVENTA_ANIMAL = { caballo: 10, burro: 35, camello: 10 };
// Jorge (10 de noviembre): la alfombra mágica solo se vende en Samarcanda o Isfahán (precio por confirmar con Jorge).
export const ALFOMBRA_VENTA = { ciudades: ['Samarcanda', 'Isfahán'], precio: 20 };   // Jorge (10 de noviembre): 20 dinares y se deshace (nadie la revende)
// Dados del Cairo y Dados de Persia (Jorge, 8 de noviembre): una sola carta de cada uno; el mercado de la ciudad la compra y la
// revende (Cairo 35 → 75, Persia 30 → 60) y a todos les sale el aviso de dónde está. Entre jugadores, en un trato, al precio que quieran.
export const DADOS_VENTA = { dadosCairo: { nombre: 'Dados del Cairo', venta: 35, reventa: 75 }, dadosPersia: { nombre: 'Dados de Persia', venta: 30, reventa: 60 } };
export function comprar(data, e, pid, a) {
  const j = e.jugadores[pid];
  const enTurno = a.ref === 'firman';
  if (enTurno) { if (!puedeTienda(e, pid)) return err('El Firmán se compra en tu turno.'); if (e.turno.fase === 'ingreso') return err('Primero tira el dado de ingreso.'); }
  else { const no = puedeMercado(e, pid); if (no) return err(no); }
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
  if (DADOS_VENTA[a.ref]) {                                                                              // dados revendidos por el mercado
    const D = DADOS_VENTA[a.ref], m = e.mercadoDados?.[a.ref];
    if (!m || m.ciudad !== j.ciudad) return err(`Los ${D.nombre} no están a la venta aquí.`);
    if (j.dinares < D.reventa) return err(`Cuestan ${D.reventa} dinares.`);
    j.dinares -= D.reventa; delete e.mercadoDados[a.ref]; m.carta.pub = true; j.mano.push(m.carta);
    log(e, `${j.nombre} compra los ${D.nombre} en el mercado de ${j.ciudad} por ${D.reventa} dinares.`, { pid });
    return ok();
  }
  if (typeof a.ref === 'string' && a.ref.startsWith('establo:')) {
    { const x0 = (e.establo || []).find((x) => x.carta.uid === a.ref.slice(8)); if (x0 && (x0.ciudad || 'Bagdad') !== j.ciudad) return err(`Ese animal está a la venta en ${x0.ciudad || 'Bagdad'}.`); }
    const k = (e.establo || []).findIndex((x) => x.carta.uid === a.ref.slice(8));
    if (k < 0) return err('Ese animal ya se vendió.');
    const x = e.establo[k];
    if (x.carta.ref === 'burro' && j.pj === 'B' && j.npc) return err('Yafar no compra burros: dice que es indigno de su posición.');
    // Jorge (10 de noviembre): se pueden tener varios animales, también del mismo tipo (cada uno con su vida y su costo)
    if (j.dinares < x.precio) return err(`Cuesta ${x.precio} dinares.`);
    j.dinares -= x.precio; e.establo.splice(k, 1); x.carta.priv = false; x.carta.pub = true; x.carta.extra = { ...(x.carta.extra || {}), usados: 0 }; j.mano.push(x.carta);   // con toda su vida
    log(e, `${j.nombre} compra un ${ITEMS[x.carta.ref].nombre.toLowerCase()} en el mercado de ${j.ciudad} por ${x.precio} dinares (con todos sus turnos de vida).`, { pid });
    return ok();
  }
  if (a.ref === 'ifrit') return err('El bazar del genio ya no existe: las cartas de Ifrit salen del Jorasán, de la lámpara mágica y de R40.');   // Jorge (10 de noviembre)
  if (a.ref) {                                                                                           // objetos originales
    const base = VENTA_ORIGINAL[a.ref];
    if (base === undefined) return err('Eso no se vende.');
    const cs = CIUDAD_ORIGINAL[a.ref]; if (cs && !cs.includes(j.ciudad)) return err(`Solo se vende en ${cs.join(' o ')}.`);
    const n = Math.max(1, Math.min(10, Math.floor(a.n || 1)));
    let p = ARMAS_ORIG.includes(a.ref) || a.ref === 'flechas' ? precioArma(data, e, a.ref, j) : base;
    p *= dobleCairo(e, j.ciudad); p *= n;
    if (j.dinares < p) return err(`Cuesta ${p} dinares.`);
    if (ARMAS_ORIG.includes(a.ref) && tieneItem(j, a.ref)) return err('Ya tienes esa arma.');
    if (a.ref === 'burro' && j.pj === 'B' && j.npc) return err('Yafar no compra burros: dice que es indigno de su posición.');
    if (a.ref === 'burro' && n > 1) return err('Solo un burro.');
    if (a.ref === 'burro' && !(e.burros > 0)) return err('No quedan burros en Basra.');
    if (CARGA_ITEMS.includes(a.ref) && !tieneCarga(j) && nCarga(j) + n > limiteCarga(e, j)) return err(MSJ_COMPRA_LLENO);   // alfanje, cimitarra y vino también cargan
    j.dinares -= p;
    if (a.ref === 'burro') { e.burros--; j.noches += 20; log(e, `${j.nombre} compra un burro en Basra y recibe 20 noches de regalo.`, { pid }); darItem(e, j, 'burro'); return ok(); }
    for (let i = 0; i < n; i++) darItem(e, j, a.ref, a.ref === 'vino' ? { ronda: e.ronda } : undefined);
    log(e, `${j.nombre} compra ${n > 1 ? n + ' ' : ''}${ITEMS[a.ref].nombre}.`, { pid });
    if (a.ref === 'vino') { /* el vino gana 6 dinares por turno */ }
    return ok();
  }
  const o = objDe(data, a.id);
  if (!o) return err('Objeto inexistente.');
  const cs = ciudadesDe(o);
  if (cs && !cs.includes(j.ciudad)) return err(`Aquí no se vende (${o.seConsigueEn}).`);
  if ((e.stock[a.id] || 0) <= 0) return err('Agotado.');
  const p = o.valor * dobleCairo(e, j.ciudad);
  if (j.dinares < p) return err('No te alcanzan los dinares.');
  if (!tieneCarga(j) && nCarga(j) >= limiteCarga(e, j)) return err(MSJ_COMPRA_LLENO);   // Jorge (10 de noviembre)
  j.dinares -= p; e.stock[a.id]--;
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
export function vender(data, e, pid, a) {
  const j = e.jugadores[pid];
  if (!puedeTienda(e, pid)) return err('Solo puedes vender en tu turno.');
  const c = j.mano.find((x) => x.uid === a.uid);
  if (!c) return err('No tienes esa carta.');
  const ciudad = j.ciudad;
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
    if (reventaDe(data, c.ref, ciudad) != null) { precio = reventaDe(data, c.ref, ciudad); sinImp = true; }
    else if (c.ref === 'OB41') { precio = 20; sinImp = true; }                                            // banco: 20
    else if (c.ref === 'OB24' ) { precio = 40; sinImp = true; }                                           // Botella de genio: 40 al banco (R 15.2)
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
  if (c.tipo === 'ifrit') { quitarCarta(j, c.uid); j.dinares += 40; log(e, `${j.nombre} vende un deseo de ifrit al banco por 40 dinares.`, { pid }); return ok(); }
  if (c.tipo === 'especial') return err('Esa carta no se vende al banco.');
  if (c.tipo !== 'item') return err('No se puede vender.');
  if (esLibro(c)) {
    if (ciudad !== 'Bagdad') return err('Solo la biblioteca de Bagdad compra libros y papiros.');
    const v = valorLibro(data, e, c); precio = e.mods.sabiduria ? v : Math.floor(v / 2);                  // H8: precio completo
    quitarCarta(j, c.uid); j.dinares += precio; log(e, `${j.nombre} vende ${c.ref === 'libroIbnHazm' ? `«${c.extra?.titulo || 'un libro de Ibn Hazm'}»` : 'un ' + c.ref} a la biblioteca por ${precio} dinares.`, { pid });
    return ok();
  }
  if (c.ref === 'vino') {
    if (ciudad === 'Bagdad') return err('El vino se vende en cualquier otra ciudad.');
    precio = Math.floor(valorVino(c, e) / 2); const imp = impuesto(data, e, ciudad, precio);
    quitarCarta(j, c.uid); j.dinares += precio - imp; log(e, `${j.nombre} vende vino por ${precio - imp} dinares.`, { pid }); return ok();
  }
  if (c.ref === 'buza') {
    const p = ciudad === 'El Cairo' ? 4 : ciudad === 'Bagdad' ? 3 : 0;
    if (!p) return err('La buza se vende en El Cairo (4) o en Bagdad (3).');
    const todas = j.mano.filter((x) => x.tipo === 'item' && x.ref === 'buza');
    const d = dados(e, 2);
    mostrarDados(e, { por: pid, motivo: 'buza', grupos: [{ etq: `${j.nombre}: venta de buza`, valores: d }], resumen: [`Suma ${suma(d)} contra ${todas.length} buza(s): ${suma(d) >= todas.length ? 'te compran todas' : 'no te compran ninguna'}.`] });
    if (suma(d) >= todas.length) { for (const x of todas) quitarCarta(j, x.uid); j.dinares += p * todas.length; }
    return ok();
  }
  if (c.ref === 'mapa' && c.extra?.tesoro === 'jugador') return err('El papel del escondite no lo compra el banco: véndelo a otro jugador en un trato.');
  if (c.ref === 'mapa') { const t = TESOROS[c.extra?.tesoro]; precio = t ? Math.floor(t.valor / 2) : 5; const imp = impuesto(data, e, ciudad, precio); quitarCarta(j, c.uid); j.dinares += precio - imp; log(e, `${j.nombre} vende un mapa.`, { pid }); return ok(); }
  if (VENTA_ANIMAL_BAGDAD[c.ref] != null) {
    const v = VENTA_ANIMAL_BAGDAD[c.ref]; quitarCarta(j, c.uid); j.dinares += v;
    (e.establo ||= []).push({ carta: c, precio: REVENTA_ANIMAL[c.ref], ciudad });
    log(e, `${j.nombre} vende su ${ITEMS[c.ref].nombre.toLowerCase()} en el mercado de ${ciudad} por ${v} dinares${c.ref === 'burro' ? ' (por desnutrido)' : ''}.`, { pid }); return ok();
  }
  if (DADOS_VENTA[c.ref]) {
    const D = DADOS_VENTA[c.ref];
    quitarCarta(j, c.uid); j.dinares += D.venta; (e.mercadoDados ||= {})[c.ref] = { ciudad, carta: c }; apurosZein(e, j, c.ref);
    log(e, `${j.nombre} vende los ${D.nombre} al mercado de ${ciudad} por ${D.venta} dinares.`, { pid });
    log(e, `Los ${D.nombre} están a la venta en el mercado de ${ciudad} por ${D.reventa} dinares.`, { aviso: true }); return ok();
  }
  if (ITEMS[c.ref]?.msg) return err('El mercado no compra cartas de sheij: véndela a otro jugador en un trato.');   // Jorge (10 de noviembre)
  if (c.ref === 'pergamino') { if (ciudad !== 'Damasco') return err('El pergamino se cobra en Damasco.'); quitarCarta(j, c.uid); j.dinares += 30; return ok(); }
  if (c.ref === 'especias') {                                                                             // H17: en Bagdad por 30, sin impuesto
    if (ciudad !== 'Bagdad') return err('Las especias se venden en Bagdad (30 dinares, sin impuesto).');
    quitarCarta(j, c.uid); j.dinares += 30; log(e, `${j.nombre} vende un fardo de especias en Bagdad por 30 dinares.`, { pid }); return ok();
  }
  if (c.ref === 'esclava' || c.ref === 'alfombraIsfahan' || c.ref === 'sal' || c.ref === 'cesta') {
    const p = { esclava: 20, alfombraIsfahan: 40, sal: 5, cesta: 2 }[c.ref]; quitarCarta(j, c.uid); j.dinares += Math.floor(p / 2); log(e, `${j.nombre} vende ${ITEMS[c.ref].nombre}.`, { pid }); return ok();
  }
  if (c.ref === 'alfombra') {                                                                           // Jorge (10 de noviembre)
    if (!ALFOMBRA_VENTA.ciudades.includes(ciudad)) return err('La alfombra mágica solo se vende en Samarcanda o Isfahán.');
    quitarCarta(j, c.uid); j.dinares += ALFOMBRA_VENTA.precio; log(e, `${j.nombre} vende su alfombra mágica en ${ciudad} por ${ALFOMBRA_VENTA.precio} dinares; la alfombra se deshace y nadie la puede comprar.`, { pid }); return ok();
  }
  const base = ITEMS[c.ref]?.precio ?? (c.ref === 'veneno' ? 30 : c.ref === 'velo' ? 30 : 0);
  if (!base) return err('Eso no se puede vender al mercado.');
  precio = Math.floor(base / 2); quitarCarta(j, c.uid); j.dinares += precio; log(e, `${j.nombre} vende ${ITEMS[c.ref]?.nombre || c.ref} por ${precio} dinares.`, { pid }); return ok();
}

// Catálogo de la ciudad del jugador (lo que podría comprar ahora) y estimación de lo que cobraría al vender cada carta. Solo lectura: lo usa la vista.
export function tienda(data, e, pid) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado || !j.pj) return [];
  const cai = dobleCairo(e, j.ciudad), lleno = !tieneCarga(j) && nCarga(j) >= limiteCarga(e, j);   // Jorge (10 de noviembre): 7 sin animal de carga
  const r = [];
  const orig = (ref, desde) => {
    if (CIUDAD_ORIGINAL[ref] && !CIUDAD_ORIGINAL[ref].includes(j.ciudad)) return;
    const precio = (ARMAS_ORIG.includes(ref) || ref === 'flechas' ? precioArma(data, e, ref, j) : VENTA_ORIGINAL[ref]) * cai;
    r.push({ ref, nombre: ITEMS[ref].nombre + (ITEMS[ref].ventaja ? ' · ' + ITEMS[ref].ventaja : ''), tipo: ARMAS_ORIG.includes(ref) ? 'Arma' : ref === 'burro' ? 'Transporte' : 'Objeto original', texto: ITEMS[ref].texto, precio, stock: ref === 'burro' ? (e.burros || 0) : undefined, puede: j.dinares >= precio && !(CARGA_ITEMS.includes(ref) && lleno) && !(ARMAS_ORIG.includes(ref) && tieneItem(j, ref)) && !(ref === 'burro' && !(e.burros > 0)),
      motivo: ARMAS_ORIG.includes(ref) && tieneItem(j, ref) ? 'Ya la tienes' : CARGA_ITEMS.includes(ref) && lleno ? MSJ_COMPRA_LLENO : ref === 'burro' && !(e.burros > 0) ? 'No quedan burros' : j.dinares < precio ? 'No te alcanza' : undefined, cantidad: ['flechas', 'buza', 'amate', 'cesta'].includes(ref) });
  };
  ['arco', 'alfanje', 'cimitarra', 'jambiya', 'flechas', 'vino', 'buza', 'amate', 'cesta', 'burro'].forEach(orig);
  for (const [ref, D] of Object.entries(DADOS_VENTA)) if (e.mercadoDados?.[ref]?.ciudad === j.ciudad) r.push({ ref, nombre: D.nombre, tipo: 'Objeto original', texto: ITEMS[ref].texto, precio: D.reventa, stock: 1, puede: j.dinares >= D.reventa });
  for (const x of (e.establo || []).filter((q) => (q.ciudad || 'Bagdad') === j.ciudad)) {
    r.push({ ref: 'establo:' + x.carta.uid, nombre: `${ITEMS[x.carta.ref].nombre} (de segunda mano)`, tipo: 'Transporte', texto: `De segunda mano. ${ITEMS[x.carta.ref].texto || ''}`, precio: x.precio, stock: 1, puede: j.dinares >= x.precio && !(x.carta.ref === 'burro' && j.pj === 'B' && j.npc), motivo: j.dinares < x.precio ? 'No te alcanza' : undefined });
  }
  if (j.ciudad === 'Bagdad') {
    const p = precioFirman(j);
    if (j.pj !== 'B') r.push({ ref: 'firman', nombre: 'Firmán del Califa', tipo: 'Especial', texto: 'Permite portar arco y jambiya en Bagdad, desafiar y robar allí.', precio: p, stock: e.firmanes, puede: e.firmanes > 0 && !tieneEsp(j, 'F1') && j.dinares >= p });
  }
  for (const o of data.objetos.mazo) {
    const cs = ciudadesDe(o);
    if (cs && !cs.includes(j.ciudad)) continue;
    const precio = o.valor * cai;
    r.push({ id: o.id, nombre: o.nombre, tipo: o.tipo, texto: o.efecto, precio, stock: e.stock[o.id] || 0, puede: (e.stock[o.id] || 0) > 0 && j.dinares >= precio && !lleno,
      // Jorge (10 de noviembre): si no se puede comprar, el botón dice por qué
      motivo: !((e.stock[o.id] || 0) > 0) ? 'Agotado' : lleno ? MSJ_COMPRA_LLENO : j.dinares < precio ? 'No te alcanza' : undefined });
  }
  return r;
}
export function estimarVenta(data, e, pid, c) {
  const j = e.jugadores[pid], ciudad = j?.ciudad;
  if (!j) return null;
  try {
    if (c.tipo === 'objeto' && LIBROS_SUBASTA.includes(c.ref) && ciudad === 'Bagdad') return 100;   // subasta: 100 o 150
    if (c.tipo === 'objeto') {
      const o = objDe(data, c.ref); let p = o.valor, sin = false;
      if (reventaDe(data, c.ref, ciudad) != null) { p = reventaDe(data, c.ref, ciudad); sin = true; } else if (c.ref === 'OB41') { p = 20; sin = true; } else if (c.ref === 'OB24') { p = 40; sin = true; }
      return p > 0 ? p - (sin ? 0 : impuesto(data, e, ciudad, p)) : 0;   // 0: sin precio, se regala
    }
    if (c.tipo === 'ifrit') return 40;
    if (c.tipo !== 'item') return null;
    if (esLibro(c)) return ciudad === 'Bagdad' ? (e.mods.sabiduria ? valorLibro(data, e, c) : Math.floor(valorLibro(data, e, c) / 2)) : null;
    if (c.ref === 'vino') { if (ciudad === 'Bagdad') return null; const p = Math.floor(valorVino(c, e) / 2); return p - impuesto(data, e, ciudad, p); }
    if (c.ref === 'buza') return ciudad === 'El Cairo' ? 4 : ciudad === 'Bagdad' ? 3 : null;
    if (c.ref === 'mapa' && c.extra?.tesoro === 'jugador') return null;
    if (c.ref === 'mapa') { const t = TESOROS[c.extra?.tesoro]; const p = t ? Math.floor(t.valor / 2) : 5; return p - impuesto(data, e, ciudad, p); }
    if (VENTA_ANIMAL_BAGDAD[c.ref] != null) return VENTA_ANIMAL_BAGDAD[c.ref];
    if (c.ref === 'alfombra') return ALFOMBRA_VENTA.ciudades.includes(ciudad) ? ALFOMBRA_VENTA.precio : null;
    if (c.ref === 'pergamino') return ciudad === 'Damasco' ? 30 : null;
    if (c.ref === 'especias') return ciudad === 'Bagdad' ? 30 : null;
    if (['esclava', 'alfombraIsfahan', 'sal', 'cesta'].includes(c.ref)) return Math.floor({ esclava: 20, alfombraIsfahan: 40, sal: 5, cesta: 2 }[c.ref] / 2);
    const base = ITEMS[c.ref]?.precio ?? (c.ref === 'veneno' || c.ref === 'velo' ? 30 : 0);
    return base ? Math.floor(base / 2) : null;
  } catch { return null; }
}

// Dónde se vende cada carta y a cuánto (o para qué sirve si no se vende), para que «no se vende aquí» nunca quede sin explicación.
const MITAD = { esclava: 10, alfombraIsfahan: 20, sal: 2, cesta: 1 };
const USO = {
  idolo: 'Destrúyelo en cualquier ciudad (100 noches) o véndelo en Estambul a los mercaderes venecianos (100 dinares, con riesgo de herejía). Sirve para: reto R41 (Andalucía).',
  caballo: 'Es tu transporte: úsalo para viajar.', camello: 'Es tu transporte: úsalo para viajar.', burro: 'Es tu transporte: úsalo para viajar.', alfombra: 'Es tu transporte: úsala para viajar.',
  brujula: 'Sirve para buscar tesoros (1 intento extra).', astrolabio: 'Sirve para buscar tesoros (2 intentos extra).',
  recetaAverroes: 'Úsala para curarte una herida.', bendicionAbuMadyan: 'Te protege una vez de los asaltos en Andalucía y el Magreb.', dadoIbnArabi: 'Repite una pelea que vayas a perder.',
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
    if (!o?.valor) return 'Nadie la compra: solo sirve para usarla.';
    if (o.reventa) { const [mc, mp] = Object.entries(o.reventa).sort((x, y) => y[1] - x[1])[0]; return `Mejor venta: ${mc} (${mp} dinares, sin impuesto). También: ${lista(o.reventa)}; en las demás ciudades, ${o.valor} menos el impuesto.`; }
    return `En cualquier ciudad por ${o.valor} dinares, menos el impuesto (mejor en Bagdad, sin impuesto).`;
  }
  if (c.tipo === 'ifrit') return 'El banco paga 40 dinares en cualquier ciudad.';
  if (c.tipo === 'especial') return c.ref === 'F1' ? 'El Firmán no se vende: se queda contigo (vuelve al banco si mueres).' : 'Carta especial: no se vende.';
  if (c.tipo !== 'item') return null;
  if (esLibro(c)) return 'Solo la biblioteca de Bagdad compra libros y papiros (mitad de su valor; precio completo con «Casa de la Sabiduría»).';
  if (c.ref === 'vino') return 'En cualquier ciudad menos Bagdad, a la mitad de su valor menos el impuesto.';
  if (c.ref === 'buza') return 'En El Cairo por 4 o en Bagdad por 3 (si vendes varias, deciden los dados).';
  if (VENTA_ANIMAL_BAGDAD[c.ref] != null) return `En el mercado de cualquier ciudad: ${VENTA_ANIMAL_BAGDAD[c.ref]} dinares ${c.ref === 'burro' ? ', por desnutrido' : ''} (ahí se revende a ${REVENTA_ANIMAL[c.ref]}, con todos sus turnos de vida).`;
  if (DADOS_VENTA[c.ref]) return `Al mercado de cualquier ciudad por ${DADOS_VENTA[c.ref].venta} dinares (ahí se revenden en ${DADOS_VENTA[c.ref].reventa}), o a otro jugador en un trato al precio que quieran.`;
  if (c.ref === 'pergamino') return 'Solo se cobra en Damasco: 30 dinares.';
  if (c.ref === 'especias') return 'Solo en Bagdad: 30 dinares, sin impuesto.';
  if (c.ref === 'mapa' && c.extra?.tesoro === 'jugador') return 'El banco no lo compra: véndelo o regálalo a otro jugador en un trato, o ve a esa ciudad a sacar los dinares.';
  if (c.ref === 'mapa') return 'En cualquier ciudad, a la mitad del valor del tesoro menos el impuesto; o ve a buscar el tesoro.';
  if (c.ref === 'alfombraIsfahan') return `Mejor venta: el reto R7 en Bagdad paga 90 por alfombra (máximo 2) y 10 noches. En el mercado de cualquier ciudad, ${MITAD.alfombraIsfahan}.`;
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
const TRANSPORTE = { caballo: 1, camello: 2, burro: 3, alfombra: 1 };

export function disponibles(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, r = [];
  if (!t || t.pid !== pid || t.fase === 'ingreso' || t.fin) return r;
  for (const c of j.mano) {
    if (c.tipo === 'objeto' && USOS[c.ref]) {
      const u = USOS[c.ref];
      if (c.ref === 'OB19' && !(j.herido || t.bloqueoPrincipal)) continue;
      if (c.ref === 'OB42' && !(j.buscado > 0)) continue;
      if (c.ref === 'OB27' && t.maxTramos >= 3) continue;
      if (c.ref === 'OB33' && !(t.ccActual && t.ccActual.tipo === 'trivia' && t.ccActual.descartada == null)) continue;
      if (c.ref === 'OB31' && !(j.misiones.length || j.mensajes.length)) continue;
      const x = { k: 'usar', uid: c.uid, titulo: 'Usar ' + u.titulo };
      if (u.obj) { const ob = enCiudad(e, j.ciudad, pid).filter((q) => !e.jugadores[q].npc); if (!ob.length) continue; x.objetivos = ob; }
      r.push(x);
    }
    if (c.tipo === 'item' && c.ref === 'idolo') {                                                     // R41: destruirlo o venderlo a los venecianos
      r.push({ k: 'usar', uid: c.uid, titulo: 'Destruir el Ídolo de Toledo (100 noches, acción libre)', via: 'destruir' });
      if (j.ciudad === 'Estambul') r.push({ k: 'usar', uid: c.uid, titulo: 'Vender el ídolo a los venecianos (100 dinares; con 1–2 te acusan de herejía)', via: 'venecianos' });
    }
    if (c.tipo === 'item' && c.ref === 'recetaAverroes' && (j.herido || t.heridoAhora)) r.push({ k: 'usar', uid: c.uid, titulo: 'Usar la Receta de Averroes (cura tu herida)' });
    if (c.tipo === 'item' && c.ref === 'veneno') {
      const vic = activos(e).filter((q) => q !== pid && !e.jugadores[q].npc);
      if (vic.length) r.push({ k: 'usar', uid: c.uid, titulo: 'Usar veneno (Anciana Devota, 20 dinares + transporte)', objetivos: vic, via: 'anciana' });
      if (j.ciudad === 'Bagdad') r.push({ k: 'usar', uid: c.uid, titulo: `Envenenar un abrevadero (Masrur, ${5 * vivos(e)} dinares)`, destinos: data.ciudades.ciudades.map((q) => q.id), via: 'abrevadero' });
    }
    if (c.tipo === 'item' && TRANSPORTE[c.ref] && !t.ccActual && !j.perdido && !motivoNoSalir(e, j, false) && t.tramos < (t.maxTramos || data.config.maxTramosPorTurno)) {
      const dest = destinosTransporte(data, c.ref, j.ciudad).filter((q) => !(j.pj === 'B' && j.npc && q === 'India'));
      if (c.ref === 'burro' && j.pj === 'B' && j.npc) continue;                       // Jorge (punto 9): Yafar no usa burro
      const vida = ANIMAL_DEF[c.ref] ? ` · le quedan ${turnosAnimal(data, c)} turno(s)` : '';   // con dos del mismo tipo, se distinguen por su vida
      if (dest.length) r.push({ k: 'usar', uid: c.uid, titulo: 'Viajar con ' + ITEMS[c.ref].nombre + (data.objetos.transportes?.[c.ref]?.terminaTurno ? ' (termina tu turno)' : '') + vida, destinos: dest });
      else if ((data.objetos.transportes?.[c.ref]?.noSaleDe || []).includes(j.ciudad)) r.push({ k: 'usar', uid: c.uid, titulo: 'Viajar con ' + ITEMS[c.ref].nombre, bloqueado: `Ni el caballo ni el camello van a ${j.ciudad} ni salen de allí: viaja en caravana o en alfombra.` });
    }
    if (c.tipo === 'ifrit') r.push({ k: 'usar', uid: c.uid, titulo: 'Usar carta de Ifrit', ifrit: data.objetos.ifrit.cartas.find((q) => q.id === c.ref).deseos });
  }
  return r;
}

const ANIMALES = ['caballo', 'camello', 'burro'];

// Destinos de cada transporte propio (objetos.json, «transportes»). India solo se alcanza en caravana o en alfombra.
export function destinosTransporte(data, ref, desde) {
  const r = data.objetos.transportes?.[ref], todas = data.ciudades.ciudades.map((q) => q.id).filter((q) => q !== desde);
  if (!r) return todas;
  if ((r.noSaleDe || []).includes(desde)) return [];                                             // caballo y camello no salen de India
  if (r.cercanas) {
    const extra = (r.rutas || []).filter((p) => p.includes(desde)).map((p) => p.find((q) => q !== desde));
    return [...new Set([...(desde === 'Bagdad' ? r.cercanas : r.cercanas.includes(desde) ? ['Bagdad'] : []), ...extra])];
  }
  if (r.solo) return todas.filter((q) => r.solo.includes(q));
  return todas.filter((q) => !(r.excepto || []).includes(q));
}
const textoTransporte = (ref) => ({ burro: 'el burro solo hace viajes cortos entre Bagdad y las ciudades cercanas, y entre El Cairo y Damasco.', caballo: 'el caballo no va a Samarcanda, al Magreb, a India ni a Bagdad, y no sale de India.', camello: 'el camello solo va al Magreb, a Samarcanda y a Yemen, y no sale de India.', alfombra: 'la alfombra no sirve para ir a Bagdad.' })[ref] || '';

// Veneno (R 15.1): por la Anciana Devota (20 dinares + transporte desde Bagdad) o sobornando a Masrur para envenenar un abrevadero (5 dinares por jugador vivo).
function usarVeneno(data, e, pid, c, a) {
  const j = e.jugadores[pid];
  if (a.via === 'abrevadero') {
    if (j.ciudad !== 'Bagdad') return err('Masrur está en Bagdad.');
    if (!ciudadDe(data, a.destino)) return err('Elige la ciudad del abrevadero.');
    const precio = 5 * vivos(e);
    if (j.dinares < precio) return err(`Masrur pide ${precio} dinares.`);
    j.dinares -= precio; quitarCarta(j, c.uid);
    let muertos = 0;
    for (const q of enCiudad(e, a.destino)) { const x = e.jugadores[q]; const n = x.mano.length; x.mano = x.mano.filter((k) => !(k.tipo === 'item' && ANIMALES.includes(k.ref))); muertos += n - x.mano.length; }
    log(e, `Alguien envenena el abrevadero de ${a.destino}: mueren ${muertos} animal(es) de transporte.`);
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
  if (c.tipo === 'ifrit') return HOOK.usarIfrit(data, e, pid, c, a);
  if (c.tipo === 'item' && TRANSPORTE[c.ref]) {
    if (t.ccActual) return err('Resuelve primero la carta de Cuentos.');
    if (t.tramos >= (t.maxTramos || data.config.maxTramosPorTurno)) return err('Ya no te quedan tramos de viaje este turno.');
    if (j.perdido) return err('Estás perdido.');
    const dest = a.destino;
    if (!ciudadDe(data, dest) || dest === j.ciudad) return err('Destino inválido.');
    if (c.ref === 'burro' && j.pj === 'B' && j.npc) return err('Yafar no monta en burro: dice que es indigno de su posición.');
    if (j.pj === 'B' && j.npc && dest === 'India') return err('Yafar no tiene contactos en India: no puede ir.');
    if (!destinosTransporte(data, c.ref, j.ciudad).includes(dest)) return err(`Ahí no te lleva: ${textoTransporte(c.ref)}`);
    { const m = motivoNoSalir(e, j, false); if (m) return err(m); }
    return HOOK.viajarPropio(data, e, pid, { destino: dest, motivo: ITEMS[c.ref].nombre.toLowerCase(), termina: !!data.objetos.transportes?.[c.ref]?.terminaTurno, consumeUid: null });   // la alfombra ya no se gasta (regla de la casa)
  }
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
  switch (c.ref) {
    case 'OB05': {
      const o = e.jugadores[a.objetivo];
      if (!o || o.eliminado || o.ciudad !== j.ciudad || a.objetivo === pid || o.transito) return err('Objetivo inválido.');
      consumirObj(data, e, pid, 'OB05');
      const x = dado(e);
      const inmune = tieneObj(o, 'OB23') || tieneObj(o, 'OB25');
      mostrarDados(e, { por: pid, motivo: 'lazo', grupos: [{ etq: `${j.nombre} lanza el lazo`, valores: [x] }], resumen: [x >= 4 && !inmune ? `${o.nombre} no podrá viajar en su siguiente turno.` : `El lazo no atrapa a ${o.nombre}.`] });
      if (x >= 4 && !inmune) o.extra.lazoTurno = (o.turnos || 0) + 1;
      return ok();
    }
    case 'OB15': consumirObj(data, e, pid, 'OB15'); j.extra.joyaVisir = true; info(e, pid, 'El visir te recibe', 'Yafar te presta una consulta gratuita: los Asesinos ' + (e.asesinos.actuaron ? 'ya actuaron.' : 'todavía no han actuado.') + ' Además, el Firmán te sale a 45 dinares (en vez de 55) si lo compras en Bagdad mientras queden.'); return ok();
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
// repone en el mercado de Basra (siguen siendo N − 1); al morir el caballo o el camello se reactiva el reto que los da (R1 o R5).
const ANIMAL_DEF = { burro: { vida: 3, costo: 1 }, caballo: { vida: 5, costo: 3, reto: 'R1' }, camello: { vida: 5, costo: 3, reto: 'R5' } };
export const animalDe = (data, ref) => (ANIMAL_DEF[ref] ? { ...ANIMAL_DEF[ref], ...(data.config.animales?.[ref] || {}) } : null);
export const turnosAnimal = (data, c) => Math.max(0, animalDe(data, c.ref).vida - (c.extra?.usados || 0));   // turnos que le quedan después del actual
const animalesDe = (j) => j.mano.filter((c) => c.tipo === 'item' && ANIMAL_DEF[c.ref]);
export function animalesInicioTurno(data, e, pid) {
  const j = e.jugadores[pid];
  for (const c of animalesDe(j)) {
    const a = animalDe(data, c.ref);
    c.extra = { ...(c.extra || {}), usados: (c.extra?.usados || 0) + 1 };
    pagar(data, e, pid, a.costo);
    const n = turnosAnimal(data, c);
    log(e, `${j.nombre} paga ${a.costo} dinar${a.costo === 1 ? '' : 'es'} de albéitar y comida para su ${c.ref}${n ? ` (le quedan ${n} turno${n === 1 ? '' : 's'} más)` : ': es su último turno'}.`, { pid });
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
  if (c.ref === 'burro') { e.burros = (e.burros || 0) + 1; mas = ' Llega otro burro al mercado de Basra.'; }
  else if (a.reto && j.retosHechos.includes(a.reto)) { j.retosHechos = j.retosHechos.filter((r) => r !== a.reto); mas = ` Puede volver a hacer el reto ${a.reto} para conseguir otro.`; }
  log(e, `Muere de viejo el ${c.ref} de ${j.nombre}.${mas}`, { pid, aviso: true });
  if (!j.npc && cargaExcedida(j, e)) { log(e, `${j.nombre}: ${sobrecarga(j, e)}`, { pid }); info(e, pid, 'Vas muy cargado', sobrecarga(j, e)); }   // Jorge (10 de noviembre)
}

// ---------------------------------------------------------------- caducidades (Jorge, 10 de noviembre)
// Dados del Cairo y Dados de Persia: duran 3 rondas desde que su dueño actual los recibe (si cambian de dueño, el contador vuelve a
// empezar); al caducar, «Un ifrit se robó tus dados» y salen de la partida. Ejército de Kanmakán: dura 2 turnos de su dueño; pasar por
// Isfahán lo renueva por otros 2; si no, se disuelve al acabarse (además de disolverse al pelear, como antes).
export const DADOS_CADUCAN = ['dadosCairo', 'dadosPersia'], RONDAS_DADOS = 3, TURNOS_KANMAKAN = 2;
function marcarDueno(c, j, ahora) { if (c.extra?.dueno !== j.id) c.extra = { ...(c.extra || {}), dueno: j.id, desde: ahora }; }
export const rondasDados = (e, j, c) => Math.max(0, (c.extra?.dueno === j.id ? c.extra.desde : e.ronda) + RONDAS_DADOS - e.ronda);   // rondas que le quedan, contando la actual
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
      if (c.tipo === 'item' && DADOS_CADUCAN.includes(c.ref)) marcarDueno(c, j, e.ronda);
      else if (c.tipo === 'especial' && c.ref === 'K1') marcarDueno(c, j, j.turnos);
    }
  }
}
export function caducarDados(data, e) {   // al empezar cada ronda
  anotarDuenos(e);
  for (const j of Object.values(e.jugadores)) {
    if (!j?.mano || j.eliminado) continue;
    for (const c of j.mano.filter((x) => x.tipo === 'item' && DADOS_CADUCAN.includes(x.ref))) {
      if (rondasDados(e, j, c) > 0) continue;
      quitarCarta(j, c.uid);
      const nom = ITEMS[c.ref].nombre;
      publicarCarta(e, { id: 'caduca:' + c.ref, deck: 'objeto', titulo: 'Un ifrit se robó tus dados', sub: nom, texto: `Un ifrit se robó tus ${nom}: pasaron ${RONDAS_DADOS} rondas desde que los recibiste y desaparecen de la partida.`, arte: 'ob-magico' }, j.id, [j.id]);
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

// ---------------------------------------------------------------- zona del burro (Jorge, 10 de noviembre)
// El burro solo aguanta en su zona (las ciudades de sus rutas). Si viajas por cualquier medio a otra ciudad (o al Jorasán) llevándolo,
// el burro muere. Antes de viajar, la interfaz avisa con avisoBurro. Caballo y camello van contigo a donde sea: fuera de sus rutas no
// te mueven, pero no mueren y siguen cargando.
export const ZONA_BURRO = ['Bagdad', 'Damasco', 'Aleppo', 'Basra', 'El Cairo'];
const conBurro = (mano) => (mano || []).some((c) => c.tipo === 'item' && c.ref === 'burro');
export function avisoBurro(j, destino) {
  if (!j || !conBurro(j.mano) || ZONA_BURRO.includes(destino)) return null;
  let txt = `Tu burro no aguantará este viaje: morirá si sales de su zona (${ZONA_BURRO.slice(0, -1).join(', ')} y ${ZONA_BURRO.at(-1)}). ¿Viajar de todos modos?`;
  const otro = (j.mano || []).some((c) => c.tipo === 'item' && ['caballo', 'camello'].includes(c.ref)), n = nCarga(j);
  if (!otro && n > LIMITE_OBJETOS) txt += ` Ojo: sin el burro llevarías ${n} objetos y sin animal; en ${destino} no podrás salir hasta vender lo que te sobra o conseguir otro animal.`;
  return txt;
}
export function burroFueraDeZona(data, e, pid) {
  const j = e.jugadores[pid]; if (!j || ZONA_BURRO.includes(j.ciudad)) return;
  const c = j.mano.find((x) => x.tipo === 'item' && x.ref === 'burro'); if (!c) return;
  quitarCarta(j, c.uid); e.burros = (e.burros || 0) + 1;
  log(e, `El burro de ${j.nombre} no aguantó el viaje a ${j.ciudad} y murió. Llega otro burro al mercado de Basra.`, { pid, aviso: true });
  info(e, pid, 'Tu burro murió', `Tu burro no aguantó el viaje a ${j.ciudad}: solo vive en su zona (${ZONA_BURRO.join(', ')}).${cargaExcedida(j, e) ? ' ' + sobrecarga(j, e) : ''}`);
}
// En las decisiones que te mueven (huir por un evento, deseo de ifrit): aviso en cada opción y, si tu burro llega, «Huir en tu burro».
export const etiquetaBurro = (j, ciudad) => (conBurro(j?.mano) && !ZONA_BURRO.includes(ciudad) ? ' — tu burro morirá: sale de su zona' : '');
export const destinosBurro = (data, j) => (conBurro(j?.mano) ? destinosTransporte(data, 'burro', j.ciudad) : []);
