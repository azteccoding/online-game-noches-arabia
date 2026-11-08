// Utilidades comunes del motor de «Mil y una Noches»: azar reproducible, registro, cartas, decisiones pendientes (pend),
// cola de dados, objetos en mano, pagos y eliminación. Código puro (sin DOM ni APIs de Node). Referencias: «R 11.4» = sección 11.4 del reglamento.

export const VERSION_ESTADO = 3;
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
  arco: { nombre: 'Arco', arma: 1, precio: 15, ventaja: 'una flecha antes de pelear', texto: 'Antes de cualquier pelea (robo, ataque a muerte o duelo) disparas una flecha con tu botón: con 5 o 6 el rival pelea con −1 y sin su destreza; si entrenaste el arco (R43, Andalucía), con 3 o 4 pelea con −1. Contra un escudo no hace nada. Cada disparo gasta 1 flecha; sin flechas el arco no sirve. En Bagdad solo con Firmán.' },
  alfanje: { nombre: 'Alfanje', arma: 1, precio: 25, ventaja: '+1 al pelear', texto: '+1 en robos, ataques a muerte y duelos. Las armas se suman (hasta +4 en robos y ataques a muerte). No se usa en Bagdad.' },
  cimitarra: { nombre: 'Cimitarra', arma: 2, precio: 35, ventaja: '+2 al pelear', texto: '+2 en robos, ataques a muerte y duelos, y en duelo +2 más cuando eres tú quien ataca. Las armas se suman (hasta +4 en robos y ataques a muerte). No se usa en Bagdad.' },
  jambiya: { nombre: 'Jambiya', arma: 3, precio: 15, ventaja: '+1 al pelear (duelo: +3 con par)', texto: '+1 en robos y ataques a muerte (se suma a las demás armas). En duelo, +3 si el dado de sorpresa (lo tira quien la lleva) sale par. En Bagdad solo con Firmán.' },
  flechas: { nombre: 'Flechas', precio: 5, texto: 'Necesarias para usar el arco: cada disparo gasta 1 flecha. Se compran aparte, en cualquier ciudad.' },
  caballo: { nombre: 'Caballo', transporte: 1, texto: 'Transporte propio para viajes largos: llegas en el mismo turno, sin tarifa, a cualquier ciudad menos Samarcanda, el Magreb, India y Bagdad (a Bagdad solo te lleva el burro, desde las ciudades cercanas); tampoco sirve para salir de India. Termina tu turno. Cada turno pagas 3 dinares de albéitar y comida; muere a los 5 turnos y puedes volver a hacer R1.' },
  camello: { nombre: 'Camello', transporte: 2, texto: 'Transporte propio del desierto: te lleva al Magreb, a Samarcanda o a Yemen en el mismo turno, sin tarifa (no sirve para salir de India). Termina tu turno. Cada turno pagas 3 dinares de albéitar y comida; muere a los 5 turnos y puedes volver a hacer R5.' },
  idolo: { nombre: 'Ídolo de Toledo', texto: 'Ídolo cubierto de oro y pedrería robado en Toledo. Destrúyelo en cualquier ciudad (acción libre): ganas 150 noches. O véndelo en Estambul a los mercaderes venecianos: 150 dinares, pero con 1 o 2 en el dado te acusan de herejía y acabas herido en el Jorasán sin dinares. Se puede robar e intercambiar.' },
  burro: { nombre: 'Burro', transporte: 3, texto: 'Se compra en el mercado de Basra por 70 dinares y al comprarlo recibes 20 noches. Transporte propio para viajes cortos entre Bagdad y las ciudades cercanas (Damasco, Aleppo y Basra) y entre El Cairo y Damasco (visitar al-Quds: +40 noches, máximo 2 veces), sin tarifa. No termina tu turno. Cada turno pagas 1 dinar de albéitar y comida; muere a los 4 turnos y llega otro a Basra. Solo puedes llevar un animal a la vez.' },
  alfombra: { nombre: 'Alfombra mágica', transporte: 1, texto: 'Viajes gratis, en el mismo turno, a cualquier ciudad menos Bagdad; con las caravanas, es la única forma de llegar a India. No se gasta ni cuesta mantenerla. Termina tu turno.' },
  libro: { nombre: 'Libro o papiro', texto: 'Gana 2 dinares de valor por turno. La biblioteca de Bagdad lo compra a la mitad de su valor actual.' },
  vino: { nombre: 'Botella de vino', precio: 20, texto: 'Gana 6 dinares de valor por turno; otras ciudades la compran a la mitad.' },
  buza: { nombre: 'Buza', precio: 1, texto: 'Se compra en Damasco y se vende en El Cairo (4) o en Bagdad (3).' },
  amate: { nombre: 'Papel amate', precio: 2, texto: 'Hace falta para esconder dinares: en él anotas la ciudad y cuánto dejaste. Ese papel se puede vender a otro jugador.' },
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
  dadosCairo: { nombre: 'Dados del Cairo', texto: 'Regalo de Zacaría al Ansari a Zein. Una vez por ronda, si vas a perder una pelea, repites tus dados. Se vende a otro jugador en un trato (al precio que quieran) o al mercado de la ciudad por 35 dinares, que luego la revende en 75.' },
  dadosPersia: { nombre: 'Dados de Persia', texto: 'Los dados de Anís. Una vez por ronda, si te atacan para robarte o matarte (no en duelo), tiras un dado: con 5 o 6 escapas por la ventana y el agresor pierde su acción. Se venden a otro jugador en un trato (al precio que quieran) o al mercado de la ciudad por 30 dinares, que luego los revende en 60.' },
  dadoIbnArabi: { nombre: 'Dado de Ibn Arabi', texto: 'Regalo de Ibn Arabi. La próxima vez que vayas a perder una pelea o un duelo (contra un jugador o un NPC), se repite la tirada una vez. Se gasta al usarlo.' },
  mapa: { nombre: 'Mapa de tesoro', texto: 'Permite buscar un tesoro en su ciudad (R 16.1).' },
};
export function itemDatos(data, ref, extra = {}) {
  if (ref === 'mapa' && extra.tesoro === 'jugador') return { id: 'mapa:jugador', deck: 'objeto', titulo: `Papel amate · ${extra.monto ?? '?'} dinares en ${extra.ciudad}`, sub: 'Escondite de dinares', texto: `Aquí se anotó dónde están escondidos ${extra.monto ?? 'unos'} dinares: en ${extra.ciudad}. Quien tenga este papel puede ir a ${extra.ciudad} y sacarlos. Se puede vender o regalar a otro jugador en un trato; un robo no se lo lleva.`, valor: null, duracion: null, arte: 'ob-docum', ref: '16.3' };
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
export function mostrarDados(e, { por, motivo = 'libre', grupos, resumen = [], npc = false, titulo = null, boton = null, alerta = false }) {
  const valores = grupos.flatMap((g) => g.valores);
  // Los dados de un jugador con cliente web nunca se lanzan solos: espera a que pulse «Lanzar dados» (el de ingreso ya lo pulsó).
  // Nadie los lanza por él: a los 60 segundos el banco puede sacarlo. (Bots y pruebas, sin cliente web, siguen como antes.)
  const lanzar = !npc && motivo !== 'ingreso' && !!e.jugadores?.[por]?.extra?.clienteWeb && !e.jugadores[por].npc;
  const d = { id: ++e.seq, n: valores.length, valores, grupos, resumen, por, motivo, t0: e.ahora, npc, lanzado: !lanzar, contexto: e.ctxCarta || null, titulo, ...(boton ? { boton } : {}), ...(alerta ? { alerta: true } : {}) };
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
export function darItem(e, j, ref, extra = undefined) { const c = { uid: uid(e), tipo: 'item', ref, pub: true }; if (extra) c.extra = extra; j.mano.push(c); return c; }
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
// Escondites de dinares (Jorge, 8 de noviembre): tantos como papeles amate. Cada uno {id, ciudad, monto} tiene su carta
// «Papel amate · N dinares en Ciudad»; j.escondido es la suma. Las partidas viejas (un solo tesoroEsc) se convierten solas.
export function escondites(j) {
  if (!j.escondites) { j.escondites = j.tesoroEsc ? [{ ...j.tesoroEsc, monto: j.escondido || 0 }] : []; delete j.tesoroEsc; }
  return j.escondites;
}
export function sincronizarEscondites(e, j) {
  const l = escondites(j); j.escondido = l.reduce((a, x) => a + x.monto, 0);
  const porId = new Map(l.map((x) => [x.id, x]));
  for (const x of Object.values(e.jugadores)) for (const q of x.mano) if (q.tipo === 'item' && q.ref === 'mapa' && q.extra?.tesoro === 'jugador' && q.extra.dueno === j.id && porId.has(q.extra.id)) q.extra.monto = porId.get(q.extra.id).monto;
}
// Zein (Jorge, 8 de noviembre): si vende sus Dados del Cairo (al mercado o en un trato) está en apuros financieros: vende sus
// alhajas y así se costea un viaje gratis de un solo tramo a una ciudad con ruta directa. Una sola vez por partida.
export function apurosZein(e, j, ref) {
  if (ref !== 'dadosCairo' || j.pj !== '2' || j.extra.apurosZein) return;
  j.extra.apurosZein = true; j.extra.viajeZein = true;
  log(e, `${j.nombre} está en apuros financieros: vende sus alhajas y se costea un viaje gratis.`, { pid: j.id });
  info(e, j.id, 'Apuros financieros', 'Vendiste tus Dados del Cairo y estás en apuros financieros: vendes tus alhajas y así te costeas un viaje gratis (un solo tramo, a una ciudad con ruta directa desde donde estés).');
}
export const patrimonio = (j) => j.noches + j.dinares + (j.escondido || 0);
// Pagos obligatorios al banco o a una ciudad (alojamiento, multas, castigos…). Regla de la casa: si no alcanzan los dinares,
// quedan en negativo (deuda con el banco) y se cobran solos en cuanto entren dinares; ya no se paga con noches ni se perdona.
export function pagar(data, e, pid, monto, { aJugador = null } = {}) {
  const j = e.jugadores[pid];
  monto = Math.max(0, Math.ceil(monto));
  if (aJugador && e.jugadores[aJugador]) {                                 // a otro jugador solo se le da lo que hay
    const din = Math.max(0, Math.min(monto, j.dinares)); j.dinares -= din; e.jugadores[aJugador].dinares += din;
    return { dinares: din, noches: 0, pagado: din, debe: monto - din };
  }
  // Regla de la casa: la deuda no tiene tope; se cobra sola con lo próximo que entre.
  const antes = j.dinares;
  j.dinares -= monto;
  const debe = Math.max(0, -j.dinares) - Math.max(0, -antes);
  if (debe > 0) log(e, `${j.nombre} no tiene dinares suficientes y queda en deuda con el banco: ${j.dinares} dinares. Se cobrará de lo próximo que reciba.`, { pid });
  return { dinares: monto, noches: 0, pagado: monto, debe };
}
export const puedePagar = (data, j, monto) => j.dinares >= monto;   // regla de la casa: solo con los dinares completos (las noches no cuentan)
export const puedePagarDinares = (j, monto) => j.dinares >= monto;
// Regla de la casa: una propuesta a otro jugador que no se acepta (duelo rechazado, compañía o cuentos rechazados) no gasta la acción principal.
export function devolverPrincipal(e, pid, motivo) {
  const t = e.turno;
  if (!t || t.pid !== pid || t.fin || !t.principal) return;
  t.principal = false;
  log(e, `${e.jugadores[pid].nombre} no gasta su acción principal: ${motivo}.`, { pid });
}

// ---------------------------------------------------------------- eliminación (R 11.8)
// por: pid del asesino/vencedor que hereda el botín (o null); soloNoches: opción 4 de R 12.3 (Asesinos).
export function eliminar(data, e, pid, { por = null, soloNoches = false, causa = '', secreto = false } = {}) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado) return;
  j.eliminado = true;
  const k = por && e.jugadores[por] && !e.jugadores[por].eliminado ? e.jugadores[por] : null;
  for (const m of j.mensajes || []) e.mazos.descarte.mensajes.push(m.id);
  j.mensajes = [];
  // Regla de la casa (Jorge, 7 de noviembre): el Firmán vuelve al Califa aunque alguien mate a su dueño; el mapa de los dinares
  // escondidos se pierde con su dueño (esos dinares ya no los recupera nadie).
  const cartas = j.mano.splice(0).filter((c) => {
    if (c.tipo === 'especial' && c.ref === 'F1') { if (!c.extra?.deIfrit) e.firmanes = (e.firmanes || 0) + 1; return false; }   // el Firmán extra del deseo F se pierde
    if (c.tipo === 'item' && c.ref === 'mapa' && c.extra?.tesoro === 'jugador') return false;
    return true;
  });
  { const ajenos = new Set(Object.values(e.jugadores).filter((x) => x.id !== pid).flatMap((x) => x.mano.filter((m) => m.tipo === 'item' && m.ref === 'mapa' && m.extra?.tesoro === 'jugador' && m.extra?.dueno === pid).map((m) => m.extra.id)));
    j.escondites = escondites(j).filter((x) => ajenos.has(x.id)); sincronizarEscondites(e, j); }   // los papeles vendidos conservan su escondite
  if (k) {
    k.noches += j.noches; if (!soloNoches) k.dinares += Math.max(0, j.dinares);   // las deudas no se heredan
    if (j.buscado > 0) { const n = data.config.recompensaBuscado ?? 200, d = data.config.recompensaBuscadoDinares ?? 100; k.noches += n; k.dinares += d; log(e, `${k.nombre} cobra la recompensa por ${j.nombre}, que estaba Buscado: ${d} dinares y ${n} noches.`, { pid: por, aviso: true }); }   // regla de la casa: no se multiplica por ronda
    if (e.evento?.buscadoE7 === pid) { k.noches += 200; k.dinares += 40; log(e, `${k.nombre} cobra la recompensa de la cacería del Califa: 200 noches y 40 dinares.`, { pid: por, aviso: true }); }   // regla de la casa (antes 50 noches); no se multiplica por ronda
    if (j.pj === 'B') { k.noches += 30; log(e, `${k.nombre} cobra 30 noches por matar a Yafar.`, { pid: por }); }
    for (const c of cartas) { c.priv = true; k.mano.push(c); }
    recortarMano(data, e, por);
  } else {
    for (const c of cartas) {
      if (c.tipo === 'objeto') devolverObjeto(data, e, c.ref);
      else if (c.tipo === 'especial' && c.ref === 'K1') e.kanmakan = { dueno: null, usada: false };
      else if (c.tipo === 'item' && c.ref === 'burro') e.burros = (e.burros || 0) + 1;   // el burro vuelve al mercado de Basra
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
  if (j.pj === 'B') {
    if (j.npc && b === 'India') return null;                                         // Jorge (punto 2, solo Yafar NPC): no tiene contactos en India
    t = Math.ceil(t / 2);
    if (j.npc && (b === 'Magreb' || b === 'Andalucía')) t += 20;                                 // su familia tuvo problemas con las tribus de Occidente
  }
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

// Buscado: además de las rondas, se guarda el motivo para explicarlo en pantalla a todos.
export function marcarBuscado(data, e, j, motivo) {
  j.buscado = data.config.buscadoRondas; j.extra.buscadoMotivo = { ...motivo, ronda: e.ronda };
}
const POR = { matar: (m) => `por matar a ${m.victima}`, asesinos: () => 'por contratar a los Asesinos', asesinosSinPago: () => 'por hacer perder el tiempo a los Asesinos', saqueo: () => 'por saquear durante la Revolución abasí', mujer: (m) => `por atacar a ${m.victima}, que iba sin armas` };
export function textoBuscado(data, e, j) {
  const r = [];
  if (j.buscado > 0) {
    const m = j.extra?.buscadoMotivo, por = m && POR[m.tipo] ? POR[m.tipo](m) : '';
    r.push(`Buscado${por ? ' ' + por : ''}: quien lo mate gana ${data.config.recompensaBuscadoDinares ?? 100} dinares y ${data.config.recompensaBuscado ?? 200} noches, además de su botín. Sigue jugando normal (no pierde acciones), y cualquiera puede robarle o atacarlo con las reglas de siempre. Deja de estarlo al terminar la ronda ${e.ronda + j.buscado - 1}, o antes con un Disfraz de mendigo.`);
  }
  if (e.evento?.buscadoE7 === j.id) r.push(`Buscado por la cacería del Califa (carta E7): quien lo mate en esta ronda gana 200 noches y 40 dinares, además de su botín. Deja de estarlo al terminar la ronda ${e.ronda}.`);
  return r.join(' ');
}

// Por qué un jugador no puede salir de su ciudad ahora (o null). Lo usan el viaje, las acciones y los transportes propios.
export function motivoNoSalir(e, j, enCaravana = true) {
  if (j.ciudad === 'Bagdad' && j.misiones.some((m) => m.id === 'R1' && m.deuda > 0)) return 'Tienes una deuda con Bagdad (reto R1, el cofre del Éufrates): págala antes de salir de la ciudad.';
  if (j.extra?.sinViajar === e.ronda) return 'Un lazo de camellero te impide viajar esta ronda.';
  if (e.mods?.varado?.[j.id]) return 'Estás varado en India por los vientos del monzón: esta ronda no puedes moverte.';
  if (enCaravana && e.sinCaravanasBagdad && j.ciudad === 'Bagdad') return 'Tormenta de arena: esta ronda no salen caravanas desde Bagdad (E3).';
  return null;
}
