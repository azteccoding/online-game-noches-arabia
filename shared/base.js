// Utilidades comunes del motor de «Mil y una Noches»: azar reproducible, registro, cartas, decisiones pendientes (pend),
// cola de dados, objetos en mano, pagos y eliminación. Código puro (sin DOM ni APIs de Node). Referencias: «R 11.4» = sección 11.4 del reglamento.

export const VERSION_ESTADO = 2;
export const MIN_LECTURA_MS = 5000;
export const MIN_DADOS_MS = 1900;
export const LIMITE_PEND_MS = 90000;           // una decisión sin respuesta se resuelve sola con su opción por defecto
export const AUTOCIERRE_DADOS_MS = 30000;   // tras lanzarlos, los dados se cierran solos a los 30 s

// ---------------------------------------------------------------- azar
export function rnd(e) {                                   // mulberry32 con estado en e.semilla (partidas reproducibles y restaurables)
  if (e.opciones?.azar === 'cripto' && globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;   // servidor: azar real
  e.semilla = (e.semilla + 0x6D2B79F5) | 0;
  let t = Math.imul(e.semilla ^ (e.semilla >>> 15), 1 | e.semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const dado = (e) => 1 + Math.floor(rnd(e) * 6);
export const dados = (e, n) => Array.from({ length: n }, () => dado(e));
export const suma = (a) => a.reduce((x, y) => x + y, 0);
export function barajar(e, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(e) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const ok = (eventos = []) => ({ ok: true, eventos });
export const err = (error) => ({ ok: false, error });
export const par = (n) => n % 2 === 0;

// ---------------------------------------------------------------- consultas
export const ciudadDe = (data, id) => data.ciudades.ciudades.find((c) => c.id === id);
export const pjDe = (data, id) => data.personajes.personajes.find((p) => p.id === id);
export const objDe = (data, id) => data.objetos.mazo.find((o) => o.id === id);
export const activos = (e) => e.orden.filter((id) => !e.jugadores[id].eliminado);
export const humanosVivos = (e) => activos(e).filter((id) => !e.jugadores[id].npc);
export const nombre = (e, pid) => e.jugadores[pid]?.nombre || '—';
export const enCiudad = (e, ciudad, salvo = null) => activos(e).filter((id) => id !== salvo && e.jugadores[id].ciudad === ciudad && !e.jugadores[id].transito);
export const ordenTurno = (e, pid) => e.orden.indexOf(pid);
export const npcId = (e) => e.orden.find((id) => e.jugadores[id].npc) || null;

export function log(e, texto, extra = {}) { e.logN = (e.logN || 0) + 1; e.log.push({ t: e.ahora, texto, n: e.logN, ...extra }); if (e.log.length > 300) e.log.shift(); }

// ---------------------------------------------------------------- cartas (datos para dibujarlas en el cliente)
export function cartaDatos(data, tipo, id) {
  if (tipo === 'evento') { const c = data.eventos.eventos.find((x) => x.id === id); return { id, deck: 'evento', titulo: c.nombre, texto: c.efecto, detalle: c.detalle, arte: c.arte, ref: c.refReglamento }; }
  if (tipo === 'historico') { const c = data.eventos.historicos.find((x) => x.id === id); return { id, deck: 'historico', titulo: c.nombre, texto: c.efecto, costo: c.costo, ciudades: c.ciudades, arte: c.arte, ref: c.refReglamento }; }
  if (tipo === 'mensaje') { const c = data.mensajes.mensajes.find((x) => x.id === id); return { id, deck: 'mensaje', titulo: c.de, sub: c.honorifico, texto: c.encargo, premio: c.premio, plazo: c.plazoTurnos, arte: c.arte, ref: c.refReglamento }; }
  if (tipo === 'objeto') { const c = objDe(data, id); return { id, deck: 'objeto', titulo: c.nombre, sub: c.tipo + ' · ' + c.momento, texto: c.efecto, valor: c.valor, duracion: c.duracion, humor: c.humor, arte: c.arte, ref: '15.2' }; }
  if (tipo === 'trivia') { const c = data.trivias.trivias.find((x) => x.id === id); return { id, deck: 'trivia', titulo: 'Cuento de ' + c.ciudad, sub: c.categoria, texto: c.pregunta, opciones: c.opciones, premio: c.premio, gancho: c.gancho, ciudad: c.ciudad, arte: null, ref: '19.3' }; }
  if (tipo === 'mesa') { const c = data.trivias.deMesa.find((x) => x.id === id); return { id, deck: 'mesa', titulo: 'Cuento de ' + c.ciudad, sub: c.votacion ? 'De mesa · votación' : 'De mesa', texto: c.pregunta, premio: c.premio, gancho: c.comoSeComprueba, ciudad: c.ciudad, arte: null, ref: '19.4' }; }
  if (tipo === 'cuento') { const c = data.cuentos.cuentos.find((x) => x.id === id); return { id, deck: 'cuento', titulo: c.titulo, sub: c.sub, texto: c.texto, premio: c.premio, premioEtiqueta: 'Quien la lea en voz alta recibe ' + c.premio + ' dinares', ciudad: c.clave === 'Respuestas' ? null : c.clave, arte: null, ref: c.refReglamento }; }
  if (tipo === 'personaje') { const c = pjDe(data, id); return { id, deck: 'personaje', titulo: c.nombre, sub: c.titulo, texto: c.habilidades.join(' '), limite: c.limite, stats: c.stats, statsEtiquetas: c.statsEtiquetas, cita: c.cita, arte: c.arte, ref: c.refReglamento }; }
  if (tipo === 'reto') { const c = data.retos.retos.find((x) => x.id === id); return { id, deck: 'reto', titulo: c.id + ' · ' + c.nombre, sub: c.ciudad + ' · ' + c.tipo, texto: c.resolucion, requisito: c.requisito, premio: c.premio, riesgo: c.riesgo, arte: c.arte, ref: c.refReglamento }; }
  if (tipo === 'ifrit') { const c = data.objetos.ifrit.cartas.find((x) => x.id === id); return { id, deck: 'ifrit', titulo: 'Genio de la lámpara', sub: 'Ifrit ' + id.slice(1), texto: c.deseos.map((d) => d + '. ' + data.objetos.ifrit.deseos[d]).join('\n'), deseos: c.deseos, arte: c.arte, ref: '15.4' }; }
  if (tipo === 'item') return itemDatos(data, id);
  return null;
}

// Objetos de la tabla original (R 15.1): se dibujan con el marco de «objeto».
export const ITEMS = {
  arco: { nombre: 'Arco', arma: 1, precio: 15, texto: '+1 a tu puntaje final en cualquier pelea o duelo. Además, cuando te asaltan o te atacan a muerte (jugadores, Yafar, bandoleros o los ladrones de Alí Babá) disparas primero, gastando 1 flecha: con 5 o 6 el atacante queda herido y huye. Necesita flechas. En Bagdad solo con Firmán.' },
  alfanje: { nombre: 'Alfanje', arma: 1, precio: 25, texto: '+1 a tu puntaje final en cualquier pelea o duelo. No se usa en Bagdad.' },
  cimitarra: { nombre: 'Cimitarra', arma: 2, precio: 35, texto: '+2 a tu puntaje final en cualquier pelea o duelo, y +2 más cuando eres tú quien ataca. No se usa en Bagdad.' },
  jambiya: { nombre: 'Jambiya', arma: 3, precio: 15, texto: '+3 si el dado de sorpresa (lo tira quien la lleva) cae par; si no, nada. En Bagdad solo con Firmán.' },
  flechas: { nombre: 'Flechas', precio: 5, texto: 'Necesarias para usar el arco. Cada disparo de defensa gasta 1 flecha.' },
  caballo: { nombre: 'Caballo', transporte: 1, texto: 'Transporte propio para viajes largos: llegas en el mismo turno, sin tarifa, a cualquier ciudad menos Samarcanda, el Magreb e India. Termina tu turno.' },
  camello: { nombre: 'Camello', transporte: 2, texto: 'Transporte propio del desierto: te lleva al Magreb, a Samarcanda o a Yemen en el mismo turno, sin tarifa. Termina tu turno.' },
  burro: { nombre: 'Burro', transporte: 3, texto: 'Transporte propio para viajes cortos entre Bagdad y las ciudades cercanas (Damasco, Aleppo y Basra), sin tarifa. No termina tu turno.' },
  alfombra: { nombre: 'Alfombra mágica', transporte: 1, consume: true, texto: 'Un viaje gratis, en el mismo turno, a cualquier ciudad menos Bagdad; con las caravanas, es la única forma de llegar a India. Se gasta y termina tu turno.' },
  libro: { nombre: 'Libro o papiro', texto: 'Gana 2 dinares de valor por turno. La biblioteca de Bagdad lo compra a la mitad de su valor actual.' },
  vino: { nombre: 'Botella de vino', precio: 20, texto: 'Gana 6 dinares de valor por turno; otras ciudades la compran a la mitad.' },
  buza: { nombre: 'Buza', precio: 1, texto: 'Se compra en Damasco y se vende en El Cairo (4) o en Bagdad (3).' },
  amate: { nombre: 'Papel amate', precio: 2, texto: 'Para esconder tu tesoro o rehacer un mapa.' },
  alfombraIsfahan: { nombre: 'Alfombra de Isfahán', precio: 40, texto: 'Carga para R7. Ocupa las manos: no puedes huir con un objeto.' },
  cesta: { nombre: 'Cesta de manzanas', precio: 5, texto: 'Para R24 o para contratar a Rayhán.' },
  sal: { nombre: 'Sacos de sal', precio: 15, texto: 'Carga de R23 (3 sacos).' },
  velo: { nombre: 'Velo quemado', precio: 30, texto: 'Descártalo para ignorar un genio malo o «ignorarte» en el Jorasán y volver a tirar.' },
  veneno: { nombre: 'Veneno', texto: 'Caduca a los 3 turnos. Cuesta 20 dinares y el viaje desde Bagdad usarlo.' },
  brujula: { nombre: 'Brújula', texto: 'Permite repetir la tirada al buscar un tesoro.' },
  astrolabio: { nombre: 'Astrolabio', texto: 'Ayuda al buscar un tesoro: aplicas la regla de un cazarrecompensas más sin repartir el botín.' },
  pergamino: { nombre: 'Pergamino', texto: 'En Damasco se cobra por 30 dinares.' },
  esclava: { nombre: 'Esclavas abisinias', texto: 'Dan +5 noches por turno; mantenimiento 1 dinar por turno.' },
  papiro: { nombre: 'Papiro', texto: 'Gana 2 dinares de valor por turno. La biblioteca de Bagdad lo compra a la mitad de su valor actual.' },
  pergaminoSellado: { nombre: 'Pergamino sellado', texto: 'Carga de R30: entrégalo en Bagdad.' },
  cartaUrgente: { nombre: 'Carta urgente', texto: 'Debe entregarse en la ciudad indicada antes de que venza el plazo.' },
  especias: { nombre: 'Especias', texto: 'Mercancía de comercio: se vende en la ciudad que las pida.' },
  recetaAverroes: { nombre: 'Receta de Averroes', texto: 'Regalo del cadí y médico Averroes: solo hay una en toda la partida, para el primero que cumpla uno de sus Mensajes. Úsala cuando estés herido: te cura y recuperas tu acción principal de ese turno. Se gasta al usarla.' },
  bendicionAbuMadyan: { nombre: 'Bendición de Abu Madyan', texto: 'Regalo del sufí Abu Madyan: solo hay una en toda la partida, para el primero que cumpla uno de sus Mensajes. En el Magreb y Andalucía te protege: los bandoleros de la caravana de la sal (R23) pasan de largo y el esposo de Zein no te sorprende en la Giralda (R26). Sirve una sola vez: se gasta al protegerte.' },
  libroIbnHazm: { nombre: 'Libro de Ibn Hazm', texto: 'Regalo del sheij Ibn Hazm al cumplir su Mensaje de entregar un libro, papiro o mapa. Empieza valiendo 50 dinares y gana 2 por ronda; solo lo compra la biblioteca de Bagdad, a la mitad de su valor actual. No se puede regalar ni vender a otros jugadores.' },
  dadoIbnArabi: { nombre: 'Dado de Ibn Arabi', texto: 'Regalo de Ibn Arabi. La próxima vez que vayas a perder una pelea o un duelo (contra un jugador o un NPC), se repite la tirada una vez. Se gasta al usarlo.' },
  mapa: { nombre: 'Mapa de tesoro', texto: 'Permite buscar un tesoro en su ciudad (R 16.1).' },
};
export function itemDatos(data, ref, extra = {}) {
  if (ref === 'mapa') {
    const t = extra.tesoro, d = TESOROS[t];
    return { id: 'mapa:' + t, deck: 'objeto', titulo: 'Mapa de tesoro' + (d ? ' · ' + d.nombre : t === 'jugador' ? ' · tesoro escondido' : ''), sub: 'Mapa · ' + (extra.ciudad || d?.ciudad || ''), texto: ITEMS.mapa.texto + (d ? ' Botín: ' + d.valor + ' dinares.' : ''), valor: null, duracion: null, arte: 'ob-lujo', ref: '16.1' };
  }
  const it = ITEMS[ref]; if (!it) return null;
  if (ref === 'libroIbnHazm') return { id: 'it:' + ref, deck: 'objeto', titulo: it.nombre + (extra.titulo ? ` · «${extra.titulo}»` : ''), sub: 'Regalo de un sheij', texto: it.texto, valor: null, duracion: null, arte: 'ob-docum', ref: '18.3' };
  return { id: 'it:' + ref, deck: 'objeto', titulo: it.nombre, sub: 'Objeto original · R 15.1', texto: it.texto, valor: it.precio ?? null, duracion: null, arte: it.arma ? 'ob-arma' : ref === 'libro' ? 'ob-docum' : 'ob-herr', ref: '15.1' };
}
export const TESOROS = {
  mansa: { nombre: 'Mansa Musa', ciudad: 'Magreb', valor: 96 },
  persia: { nombre: 'Persia', ciudad: 'Isfahán', valor: 54 },
  ruman: { nombre: 'Rumán', ciudad: 'Estambul', valor: 16 },
};

export function publicarCarta(e, carta, quien, privadaPara = null) {
  const entrada = { ...carta, quien, t: e.ahora, ronda: e.ronda, nro: ++e.seq, para: privadaPara };
  e.historial.push(entrada);
  if (e.historial.length > 400) e.historial.shift();
  if (!privadaPara) e.ultimaCarta = entrada.nro;
  return entrada;
}

// R 9.4: se barajan los descartes. Los Mensajes (R 18.2) son la excepción: cada uno sale una sola vez por partida.
export function robar(e, mazo) {
  const m = e.mazos;
  if (!m[mazo]) return null;
  if (!m[mazo].length && mazo !== 'mensajes') { m[mazo] = barajar(e, (m.descarte[mazo] || []).splice(0)); }
  return m[mazo].shift() || null;
}

// ---------------------------------------------------------------- dados sobre la mesa (cola)
// Los resultados se calculan y APLICAN al instante en el servidor; los dados son la vista pública del resultado (modal sincronizado).
export function mostrarDados(e, { por, motivo = 'libre', grupos, resumen = [], npc = false }) {
  const valores = grupos.flatMap((g) => g.valores);
  // Los dados de un jugador con cliente web nunca se lanzan solos: espera a que pulse «Lanzar dados» (el de ingreso ya lo pulsó).
  // Si se desconecta, el banco puede lanzarlos por él. (Bots y pruebas, sin cliente web, siguen como antes.)
  const lanzar = !npc && motivo !== 'ingreso' && !!e.jugadores?.[por]?.extra?.clienteWeb && !e.jugadores[por].npc;
  const d = { id: ++e.seq, n: valores.length, valores, grupos, resumen, por, motivo, t0: e.ahora, npc, lanzado: !lanzar, contexto: e.ctxCarta || null };
  for (const r of resumen) if (r) log(e, r, { pid: por });
  if (e.opciones?.rapido) return d;
  if (!e.dados) e.dados = d; else (e.colaDados ||= []).push(d);
  return d;
}
export function siguienteDados(e) {
  const sig = (e.colaDados || []).shift() || null;
  if (sig) sig.t0 = e.ahora;
  e.dados = sig;
}
export const bloqueado = (e) => !!e.dados || !!e.pend;

// ---------------------------------------------------------------- decisiones pendientes (pend) y continuaciones serializables
export const CONT = {};
export const registrar = (nombre, fn) => { CONT[nombre] = fn; };

// p: {tipo, para:[pid], titulo, texto, modo:'una'|'multi'|'numero'|'todos', opciones:[{id,texto,desactivada?}], min,max, porDefecto, cont:{fn,args}, ayuda?, limiteMs?}
export function pedir(e, p) {
  const entrada = { modo: 'una', opciones: [], ...p, id: ++e.seq, t0: e.ahora, resp: {} };
  if (!entrada.para?.length) throw new Error('pend sin destinatario');
  if (!e.pend) e.pend = entrada; else (e.colaPend ||= []).push(entrada);
  return entrada;
}
function valorPorDefecto(p) {
  if (p.modo === 'multi') return { valores: p.porDefecto ?? [] };
  if (p.modo === 'numero') return { numero: p.porDefecto ?? p.min ?? 0 };
  return { opcion: p.porDefecto ?? p.opciones[p.opciones.length - 1]?.id ?? null };
}
function completar(data, e, p) {
  const resp = p.modo === 'todos' || p.para.length > 1 ? p.resp : { pid: Object.keys(p.resp)[0], ...p.resp[Object.keys(p.resp)[0]] };
  e.pend = (e.colaPend || []).shift() || null;
  if (e.pend) e.pend.t0 = e.ahora;
  const fn = CONT[p.cont?.fn];
  if (fn) fn(data, e, p.cont.args || {}, resp, p);
}
export function responderPend(data, e, pid, a) {
  const p = e.pend;
  if (!p || p.id !== a.id) return err('Esa decisión ya no está pendiente.');
  if (!p.para.includes(pid)) return err('Esta decisión no es tuya.');
  if (p.resp[pid]) return err('Ya respondiste.');
  let r;
  if (p.modo === 'multi') {
    const v = [...new Set((a.valores || []).map(String))].filter((x) => p.opciones.some((o) => o.id === x && !o.desactivada));
    if (p.max != null && v.length > p.max) return err(`Elige como máximo ${p.max}.`);
    if (p.min != null && v.length < p.min) return err(`Elige al menos ${p.min}.`);
    r = { valores: v };
  } else if (p.modo === 'numero') {
    const n = Math.floor(Number(a.numero));
    if (!(n >= (p.min ?? 0) && n <= (p.max ?? 6))) return err('Número fuera de rango.');
    r = { numero: n };
  } else {
    const o = p.opciones.find((x) => x.id === String(a.opcion));
    if (!o || o.desactivada) return err('Opción no válida.');
    r = { opcion: o.id };
  }
  p.resp[pid] = r;
  const faltan = p.para.filter((x) => !p.resp[x]);
  if ((p.modo === 'todos' || p.para.length > 1) && faltan.length) return ok();
  completar(data, e, p);
  return ok();
}
// Tiempo agotado: el servidor responde por quien tarda con la opción por defecto.
export function vencerPend(data, e, ahora) {
  const p = e.pend;
  if (!p) return false;
  const todosFuera = p.para.every((x) => !e.jugadores[x] || e.jugadores[x].conectado === false || e.jugadores[x].npc);
  const limite = p.limiteMs ?? e.opciones?.limitePendMs ?? LIMITE_PEND_MS;
  if (ahora - p.t0 < (todosFuera ? Math.min(limite, 4000) : limite)) return false;
  for (const x of p.para) if (!p.resp[x]) p.resp[x] = valorPorDefecto(p);
  completar(data, e, p);
  return true;
}

// ---------------------------------------------------------------- manos y objetos
export const uid = (e) => 'u' + (++e.seq);
export const tieneItem = (j, ref) => j.mano.find((c) => c.tipo === 'item' && c.ref === ref);
export const tieneObj = (j, id) => j.mano.find((c) => c.tipo === 'objeto' && c.ref === id);
export const tieneEsp = (j, id) => j.mano.find((c) => c.tipo === 'especial' && c.ref === id);
export const nObjetos = (j) => j.mano.filter((c) => c.tipo === 'objeto').length;
export function darItem(e, j, ref, extra = undefined) { const c = { uid: uid(e), tipo: 'item', ref }; if (extra) c.extra = extra; j.mano.push(c); return c; }
export function quitarCarta(j, uidc) { const i = j.mano.findIndex((c) => c.uid === uidc); return i < 0 ? null : j.mano.splice(i, 1)[0]; }
export function quitarPrimero(j, tipo, ref) { const c = j.mano.find((x) => x.tipo === tipo && x.ref === ref); return c ? quitarCarta(j, c.uid) : null; }

// Devuelve un objeto de mazo a su pila (mercado) o al descarte del botín.
export function devolverObjeto(data, e, id) {
  const o = objDe(data, id);
  if (o.sinVenta) (e.mazos.descarte.botin ||= []).push(id); else (e.reposicion ||= []).push(id);   // escasez: vuelve al mercado al empezar una ronda (engine.reponerMercado)
}
// R 15.2: más de 5 objetos del mazo => el sobrante se vende al banco de inmediato (mitad del valor, hacia abajo).
export function recortarMano(data, e, pid) {
  const j = e.jugadores[pid], lim = data.objetos.limiteManoObjetos;
  while (nObjetos(j) > lim) {
    const peor = j.mano.filter((c) => c.tipo === 'objeto').sort((a, b) => objDe(data, a.ref).valor - objDe(data, b.ref).valor)[0];
    quitarCarta(j, peor.uid);
    const o = objDe(data, peor.ref);
    j.dinares += Math.floor(o.valor / 2); devolverObjeto(data, e, peor.ref);
    log(e, `${j.nombre} supera el límite de objetos y vende «${o.nombre}» al banco por ${Math.floor(o.valor / 2)} dinares.`, { pid });
  }
}
export function darObjeto(data, e, pid, id) {
  const j = e.jugadores[pid];
  const c = { uid: uid(e), tipo: 'objeto', ref: id }; j.mano.push(c);
  recortarMano(data, e, pid);
  return c;
}
// Botín: carta superior del mazo, boca abajo (R 15.2).
export function robarBotin(data, e, pid) {
  const id = robar(e, 'botin');
  if (!id) return null;
  const c = darObjeto(data, e, pid, id);
  publicarCarta(e, cartaDatos(data, 'objeto', id), pid, [pid]);
  log(e, `${nombre(e, pid)} recibe un objeto del Botín.`, { pid });
  return c;
}

// ---------------------------------------------------------------- dinero
export const patrimonio = (j) => j.noches + j.dinares + (j.escondido || 0);
// R 8.3: sin dinares, se paga con noches a 5 por dinar; si no alcanza, se paga lo que haya y se cancela (regla de la casa).
export function pagar(data, e, pid, monto, { aBanco = true, aJugador = null } = {}) {
  const j = e.jugadores[pid];
  monto = Math.max(0, Math.ceil(monto));
  const din = Math.min(monto, j.dinares); j.dinares -= din;
  let resto = monto - din, nch = 0;
  if (resto > 0) { nch = Math.min(resto * data.config.cinco_noches_por_dinar, j.noches); j.noches -= nch; resto -= Math.floor(nch / data.config.cinco_noches_por_dinar); }
  const pagado = din + Math.floor(nch / data.config.cinco_noches_por_dinar);
  if (aJugador && e.jugadores[aJugador]) { e.jugadores[aJugador].dinares += din; e.jugadores[aJugador].noches += nch; }
  return { dinares: din, noches: nch, pagado, debe: Math.max(0, monto - pagado) };
}
export const puedePagar = (data, j, monto) => j.dinares + Math.floor(j.noches / data.config.cinco_noches_por_dinar) >= monto;
export const puedePagarDinares = (j, monto) => j.dinares >= monto;

// ---------------------------------------------------------------- eliminación (R 11.8)
// por: pid del asesino/vencedor que hereda el botín (o null); soloNoches: opción 4 de R 12.3 (Asesinos).
export function eliminar(data, e, pid, { por = null, soloNoches = false, causa = '', secreto = false } = {}) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado) return;
  j.eliminado = true;
  const k = por && e.jugadores[por] && !e.jugadores[por].eliminado ? e.jugadores[por] : null;
  if (j.mensaje) { e.mazos.descarte.mensajes.push(j.mensaje.id); j.mensaje = null; }
  const cartas = j.mano.splice(0);
  if (k) {
    k.noches += j.noches; if (!soloNoches) k.dinares += j.dinares;
    if (j.buscado > 0) { k.noches += data.config.recompensaBuscado; log(e, `${k.nombre} cobra 20 noches por matar a un Buscado.`, { pid: por }); }
    if (e.evento?.buscadoE7 === pid) { k.noches += 50; log(e, `${k.nombre} cobra 50 noches de la cacería del Califa.`, { pid: por }); }
    if (j.pj === 'B') { k.noches += 30; log(e, `${k.nombre} cobra 30 noches por matar a Yafar.`, { pid: por }); }
    for (const c of cartas) k.mano.push(c);
    recortarMano(data, e, por);
  } else {
    for (const c of cartas) {
      if (c.tipo === 'objeto') devolverObjeto(data, e, c.ref);
      else if (c.tipo === 'especial' && c.ref === 'F1') e.firmanes = (e.firmanes || 0) + 1;
      else if (c.tipo === 'especial' && c.ref === 'K1') e.kanmakan = { dueno: null, usada: false };
    }
  }
  j.noches = 0; j.dinares = 0; j.buscado = 0; j.herido = false; j.transito = null;
  for (const id of Object.keys(e.tratos)) if (e.tratos[id].de === pid || e.tratos[id].con === pid) delete e.tratos[id];
  if (e.evento?.buscadoE7 === pid) e.evento.buscadoE7 = null;
  log(e, `${j.nombre} queda eliminado${causa ? ' (' + causa + ')' : ''}${k && !secreto ? '; ' + k.nombre + ' se queda con su botín' : ''}.`, { pid });
  e.hayEliminados = true;
  HOOK.alEliminar?.(data, e, pid, por);
}

// ---------------------------------------------------------------- enlaces entre módulos (los rellena engine.js)
export const HOOK = {};

// ---------------------------------------------------------------- tarifas de caravana con los modificadores de la ronda (R 5.3, E6, E9, H5, H10, H15, Yafar R 20.2)
export function tarifa(data, e, j, a, b) {
  let t = data.rutas.tarifas[a + '>' + b];
  if (t === undefined) return null;
  const m = e.mods || {};
  const par2 = (x, y) => (a === x && b === y) || (a === y && b === x);
  if (m.nilo && par2('El Cairo', 'Yemen')) return null;
  if (m.piratas && (a === 'Basra' || a === 'Yemen' || b === 'Basra' || b === 'Yemen')) t += 5;
  if (m.sindbad && (b === 'India' || (a === 'India' && b === 'Isfahán'))) t = 0;
  if (m.almoravides && par2('Magreb', 'Andalucía')) t = 0;
  if (m.seda && ['Samarcanda', 'Isfahán', 'India'].includes(a) && ['Samarcanda', 'Isfahán', 'India'].includes(b)) t = Math.ceil(t / 2);
  if (j.pj === 'B') t = Math.ceil(t / 2);
  return t;
}
export const esLibro = (c) => c.tipo === 'item' && (c.ref === 'libro' || c.ref === 'papiro' || c.ref === 'libroIbnHazm');
export function valorLibro(data, e, c) { return (c.extra?.valor ?? 0) + 2 * Math.max(0, e.ronda - (c.extra?.ronda ?? e.ronda)); }
export function valorVino(c, e) { return 20 + 6 * Math.max(0, e.ronda - (c.extra?.ronda ?? e.ronda)); }
export const vivos = (e) => activos(e).length;

export const puedePrincipal = (t) => !!t && !t.principal && !t.bloqueoPrincipal;

// Modal informativo privado (solo lo ve su destinatario): el resto solo ve «esperando».
registrar('base.nada', () => {});
export function info(e, pid, titulo, texto) {
  if (e.jugadores[pid]?.npc) return;
  pedir(e, { tipo: 'info', para: [pid], titulo, texto, privado: true, opciones: [{ id: 'ok', texto: 'Entendido' }], porDefecto: 'ok', limiteMs: 30000, cont: { fn: 'base.nada', args: {} } });
}

// Gasta un uso de un objeto del mazo (1 vez, 2 usos, permanente) y lo devuelve al mercado o al descarte.
export function consumirObj(data, e, pid, id) {
  const j = e.jugadores[pid], c = tieneObj(j, id);
  if (!c) return false;
  const o = objDe(data, id);
  if (o.duracion === 'Permanente') return true;
  if (o.duracion === '2 usos') { c.usos = (c.usos || 0) + 1; if (c.usos < 2) return true; }
  j.mano.splice(j.mano.indexOf(c), 1); devolverObjeto(data, e, id);
  return true;
}

// Ofrece al jugador usar objetos del mazo en un reto, tirada o pago (máx. 2 por reto, R 15.2). Sin objetos aplicables continúa al instante.
export function ofrecerObjetos(data, e, pid, { ids, max = 2, titulo, texto, cont }) {
  const j = e.jugadores[pid];
  const own = j.mano.filter((c) => c.tipo === 'objeto' && ids.includes(c.ref));
  const op = own.map((c) => ({ id: c.uid, texto: objDe(data, c.ref).nombre + ' (' + objDe(data, c.ref).efecto.split('.')[0] + ')' }));
  if (!op.length || j.npc) { CONT[cont.fn](data, e, cont.args || {}, { pid, valores: [] }, null); return false; }
  pedir(e, { tipo: 'objetos', para: [pid], modo: 'multi', min: 0, max, titulo, texto, opciones: op, porDefecto: [], cont });
  return true;
}
export const refDeUid = (j, u) => j.mano.find((c) => c.uid === u)?.ref;
