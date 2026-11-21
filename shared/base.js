// Utilidades comunes del motor de «Mil y una Noches»: azar reproducible, registro, cartas, decisiones pendientes (pend),
// cola de dados, objetos en mano, pagos y eliminación. Código puro (sin DOM ni APIs de Node). Referencias: «R 11.4» = sección 11.4 del reglamento.

export const VERSION_ESTADO = 3;
export const MIN_LECTURA_MS = 3000;   // las cartas se cierran a los 3 s (Traición en Jerusalén, 7 s: src/game/lectura.js)
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
// Jorge (10 de noviembre): quien el banco sacó de la partida (desconectado) no participa en cartas ni eventos hasta que vuelva.
export const enPartida = (e) => activos(e).filter((id) => !e.jugadores[id].sacado);
export const enCiudad = (e, ciudad, salvo = null) => enPartida(e).filter((id) => id !== salvo && e.jugadores[id].ciudad === ciudad && !e.jugadores[id].transito);
export const ordenTurno = (e, pid) => e.orden.indexOf(pid);
export const npcId = (e) => e.orden.find((id) => e.jugadores[id].npc) || null;

export function log(e, texto, extra = {}) { e.logN = (e.logN || 0) + 1; e.log.push({ t: e.ahora, texto, n: e.logN, ...extra }); if (e.log.length > 300) e.log.shift(); }

// ---------------------------------------------------------------- cartas (datos para dibujarlas en el cliente)
export const MAULANA = 'Te ayuda a escapar de los ghul.';   // Dado de Maulana (Jorge, 19 de noviembre); en renglón aparte y escueto (21 de noviembre)
export function cartaDatos(data, tipo, id, deseos = null) {   // deseos: los 3 que el genio ofrece en línea (cartas de Ifrit)
  if (tipo === 'evento') { const c = data.eventos.eventos.find((x) => x.id === id); return { id, deck: 'evento', titulo: c.nombre, texto: c.efecto, detalle: c.detalle, arte: c.arte, ref: c.refReglamento }; }
  if (tipo === 'historico') { const c = data.eventos.historicos.find((x) => x.id === id); return { id, deck: 'historico', titulo: c.nombre, texto: c.efecto, costo: c.costo, ciudades: c.ciudades, arte: c.arte, ref: c.refReglamento }; }
  if (tipo === 'mensaje') { const c = data.mensajes.mensajes.find((x) => x.id === id); if (c.permiso) return { id, deck: 'mensaje', titulo: c.titulo, sub: c.honorifico, texto: `${c.texto} ${c.efecto}`, ghul: MAULANA, efecto: c.efecto, permiso: c.permiso, premio: null, plazo: null, arte: c.arte, ref: c.refReglamento };   // cartas de permiso (Jorge, 10 de noviembre)
    return { id, deck: 'mensaje', titulo: c.de, sub: c.honorifico, texto: c.encargo, ghul: MAULANA, premio: c.premio, plazo: c.plazoTurnos, arte: c.arte, ref: c.refReglamento }; }
  if (tipo === 'objeto') { const c = objDe(data, id); return { id, deck: 'objeto', titulo: c.nombre, sub: c.tipo + ' · ' + c.momento, texto: c.efecto, valor: c.valor, duracion: c.duracion, humor: c.humor, arte: c.arte, ref: '15.2' }; }
  if (tipo === 'trivia') { const c = data.trivias.trivias.find((x) => x.id === id); return { id, deck: 'trivia', titulo: 'Trivia de ' + c.ciudad, sub: c.categoria, texto: c.pregunta, opciones: c.opciones, premio: c.premio, gancho: c.gancho, ciudad: c.ciudad, arte: null, ref: '19.3' }; }
  if (tipo === 'mesa') { const c = data.trivias.deMesa.find((x) => x.id === id); return { id, deck: 'mesa', titulo: 'Trivia de ' + c.ciudad, sub: c.votacion ? 'De mesa · votación' : 'De mesa', texto: c.pregunta, premio: c.premio, gancho: c.comoSeComprueba, ciudad: c.ciudad, arte: null, ref: '19.4' }; }
  if (tipo === 'cuento') { const c = data.cuentos.cuentos.find((x) => x.id === id); return { id, deck: 'cuento', titulo: c.titulo, sub: c.sub, texto: c.texto, premio: c.premio, premioEtiqueta: 'Quien la lea en voz alta recibe ' + c.premio + ' dinares', ciudad: c.clave === 'Respuestas' ? null : c.clave, arte: null, ref: c.refReglamento }; }
  if (tipo === 'personaje') { const c = pjDe(data, id); return { id, deck: 'personaje', titulo: c.nombre, sub: c.titulo, texto: c.habilidades.join(' '), limite: c.limite, stats: c.stats, statsEtiquetas: c.statsEtiquetas, cita: c.cita, arte: c.arte, ref: c.refReglamento }; }
  if (tipo === 'reto') { const c = data.retos.retos.find((x) => x.id === id); return { id, deck: 'reto', titulo: c.id + ' · ' + c.nombre, sub: c.ciudad + ' · ' + c.tipo, texto: c.resolucion, requisito: c.requisito, premio: c.premio, riesgo: c.riesgo, arte: c.arte, ref: c.refReglamento }; }
  if (tipo === 'ifrit') { const c = data.objetos.ifrit.cartas.find((x) => x.id === id) || { deseos: [], arte: 'if' }, ds = deseos || c.deseos; return { id, deck: 'ifrit', titulo: 'Genio de la lámpara', sub: 'Ifrit ' + String(id).slice(1), texto: ds.map((d) => data.objetos.ifrit.deseos[d]).join('\n'), deseos: ds, arte: c.arte, ref: '15.4' }; }
  if (tipo === 'item') return itemDatos(data, id);
  return null;
}

// Objetos de la tabla original (R 15.1): se dibujan con el marco de «objeto».
export const ITEMS = {
  arco: { nombre: 'Arco', arma: 1, precio: 15, ventaja: 'una flecha antes de pelear', texto: 'Antes de cualquier pelea (robo, ataque a muerte o duelo) disparas una flecha con tu botón: con 5 o 6 el rival pelea con −1 y sin su destreza; si entrenaste el arco (R43, Andalucía), con 3 o 4 pelea con −1. Contra un escudo no hace nada. Cada disparo gasta 1 flecha; sin flechas el arco no sirve. En Bagdad solo con Firmán. No cuenta como arma: solo sirve para este disparo.' },
  alfanje: { nombre: 'Alfanje', arma: 1, precio: 25, ventaja: '+1 al pelear', texto: '+1 en robos, ataques a muerte y duelos. Las armas se suman (hasta +4 en robos y ataques a muerte). No se usa en Bagdad.' },
  cimitarra: { nombre: 'Cimitarra', arma: 2, precio: 35, ventaja: '+2 al pelear', texto: '+2 en robos, ataques a muerte y duelos, y en duelo +2 más cuando eres tú quien ataca. Las armas se suman (hasta +4 en robos y ataques a muerte). No se usa en Bagdad.' },
  jambiya: { nombre: 'Jambiya', arma: 3, precio: 15, ventaja: '+1 al pelear (duelo: +3 con par)', texto: '+1 en robos y ataques a muerte (se suma a las demás armas). En duelo, +3 si el dado de sorpresa (lo tira quien la lleva) sale par. En Bagdad solo con Firmán.' },
  flechas: { nombre: 'Flechas', precio: 5, texto: 'Necesarias para usar el arco: cada disparo gasta 1 flecha. Se compran aparte, en cualquier ciudad. Pesan en pares: 1 flecha no pesa, 2 o 3 pesan 1, 4 o 5 pesan 2.' },
  caballo: { nombre: 'Caballo', transporte: 1, texto: 'Transporte propio para viajes largos: llegas en el mismo turno, sin tarifa, a cualquier ciudad menos Samarcanda, el Magreb, India y Bagdad (a Bagdad solo te lleva el burro, desde Isfahán o Basra); tampoco sirve para salir de India. Termina tu turno. Cada turno pagas 3 dinares de albéitar y comida; muere a los 5 turnos y puedes volver a hacer R1.' },
  camello: { nombre: 'Camello', transporte: 2, texto: 'Transporte propio del desierto: te lleva al Magreb, a Samarcanda o a Yemen en el mismo turno, sin tarifa (no sirve para salir de India). Termina tu turno. Cada turno pagas 3 dinares de albéitar y comida; muere a los 5 turnos y puedes volver a hacer R5.' },
  idolo: { nombre: 'Ídolo de Toledo', texto: 'Ídolo cubierto de oro y pedrería robado en Toledo. Destrúyelo en cualquier ciudad (acción libre): ganas 100 noches. O véndelo en Estambul a los mercaderes venecianos: 100 dinares, pero con 1 o 2 en el dado te acusan de herejía y acabas herido en el Jorasán sin dinares. Se puede robar e intercambiar.' },
  burro: { nombre: 'Burro', transporte: 3, texto: 'Se compra por 25 dinares y al comprarlo recibes 20 noches; vive 2 turnos. Hay 2 en el mercado de Basra; cuando se venden los dos, aparece uno en Aleppo y otro en Damasco. Transporte propio solo para viajes cortos por tierra, ida y vuelta: Estambul–Aleppo, El Cairo–Damasco (visitar al-Quds: +40 noches, máximo 2 veces), Damasco–Aleppo, Isfahán–Bagdad y Basra–Bagdad, sin tarifa. No gasta tu acción principal, pero solo lo puedes usar una vez por turno (luego está cansado). Si lo llevas a otra ciudad no muere, pero ahí no te mueve. Cada turno pagas 1 dinar de albéitar y comida; al morir ya no hay más (no se repone). Se vende al mercado de cualquier ciudad por 15 dinares (por desnutrido) y ahí se revende a 25 con sus 2 turnos de vida. Puedes tener varios animales a la vez, también del mismo tipo. Yafar NPC nunca monta burros: en fácil no los compra; en normal compra los de su ciudad para que nadie más pueda; en difícil los compra todos y los deja morir.' },
  citricos: { nombre: 'Cítricos', precio: 5, texto: 'Se venden en el mercado de cualquier ciudad a 5 dinares. Te protegen del escorbuto en un viaje por mar y se gastan en el primero que hagas: El Cairo–Andalucía, El Cairo–Yemen, Magreb–Andalucía (ida o vuelta), el cruce a Abisinia, los piratas de Yemen al Jorasán y el barco que te regresa a Basra desde India (Sindbad o el monzón). Sin cítricos, cada viaje por mar te deja herido por escorbuto, y herido no puedes embarcarte.' },
  alfombra: { nombre: 'Alfombra mágica', transporte: 1, texto: 'Viajes gratis, en el mismo turno, a cualquier ciudad menos Bagdad; con las caravanas, es la única forma de llegar a India. No se gasta ni cuesta mantenerla. Termina tu turno.' },
  libro: { nombre: 'Libro o papiro', texto: 'Gana 2 dinares de valor por turno. La biblioteca de Bagdad lo compra a la mitad de su valor actual.' },
  vino: { nombre: 'Botella de vino', precio: 20, texto: 'Se compra a 20 dinares en Basra (hay 2) y en Andalucía (hay 4). Gana 2 dinares de valor por ronda. Cualquier mercado la compra a su valor actual (menos el impuesto) y la botella se esfuma: cuando se acaban las 6, ya no hay vino. Pesa; la tinta de pulpo no le afecta.' },
  buza: { nombre: 'Cálamo de Kufa', precio: 1, texto: 'Pluma de caña cortada al estilo de Kufa, la de los copistas de la caligrafía cúfica. Hay 12 en total: 6 a la venta en Damasco y 6 en Basra (1 dinar; máximo 6 en tu mano) y se vende en El Cairo (4 cada uno) o en Bagdad (3): tiras un dado y te compran tantos como salga; los demás los puedes vender en otro turno. Cuando ya se vendieron los 12, vuelve a haber 6 en Damasco y 6 en Basra.' },   // Jorge (17 de noviembre): antes «Buza»; mismo precio
  lampara: { nombre: 'Lámpara de aceite', texto: 'Pesa. Con una Lámpara de aceite, un papel amate y un cálamo de Kufa, al iniciar el reto de aprender persa (R46), aprender árabe (R47) o investigar el fuego griego (R55) terminas el estudio en tu siguiente turno: tuviste mecenas que pagaron tus útiles y estudios. Los tres se gastan y se esfuman.' },
  alforja: { nombre: 'Alforja', texto: 'Guarda 2 objetos: sin animal cargas 9 en vez de 7 (la alforja no pesa). Sin animal solo llevas 1; con animal, hasta 3. Con alforja solo te mueves una vez por turno (una caravana). Dura 3 turnos: luego se deshilacha y vuelve al mercado de Basra. Se vende a 1 dinar en cualquier mercado.' },
  pescado: { nombre: 'Pescado', texto: 'Lo pescas en Basra con tu Red de pescador. Se vende en Basra por 5 dinares, en Bagdad por 10 y en cualquier otra ciudad por 8; al venderlo se esfuma.' },
  tintaPulpo: { nombre: 'Frasco con tinta de pulpo', precio: 3, texto: 'Frasco de tinta de pulpo, la que traen los marinos de India. Si te roban, el frasco se rompe solo y la tinta destruye tus libros, papiros, manuscritos, papel amate, mapas de tesoro, alfombras de Isfahán, el Shatranj y el Firmán: el ladrón no se los lleva. El frasco se gasta con ellos. Se compra en India (3 dinares) y, cuando alguien ya visitó India, en Bagdad (6). Pesa: cuenta para el límite de 7 objetos. Se vende en Andalucía o Samarcanda por 9 (ahí se revende en 10).' },   // Jorge (17 de noviembre)
  shatranj: { nombre: 'Shatranj (ajedrez)', precio: 12, texto: 'El juego de los reyes que llegó de India: un tablero con sus piezas de marfil. Solo lo vende el mercado de India, por 12 dinares, y solo hay 5 en todo el juego. Se vende en Isfahán por 25, en Bagdad por 30 o en Andalucía por 35, y al venderlo deja de existir. Pesa: cuenta para el límite de 7 objetos. La tinta de pulpo lo estropea.' },   // Jorge (19 de noviembre)
  amate: { nombre: 'Papel amate', precio: 2, texto: 'Hace falta para esconder dinares: en él anotas la ciudad y cuánto dejaste. Ese papel se puede vender a otro jugador.' },
  alfombraIsfahan: { nombre: 'Alfombra de Isfahán', precio: 30, texto: 'Mercancía de Isfahán: el mercado de Isfahán la vende a 30 y la recompra a 15; los demás mercados la compran a 35 (Andalucía a 40) y la revenden 3 dinares más cara. La tinta de pulpo la destruye. Pesa y ocupa las manos: no puedes huir con un objeto.' },
  costalPistaches: { nombre: 'Costal de pistaches', precio: 2, texto: 'Mercancía: se compra en Isfahán a 2 dinares (hasta 10 costales a la vez). Pesa. Al llegar a Bagdad se entregan solos y cobras 6 dinares por costal; el primero en la partida que los entrega gana además 50 noches (reto R56) y desde entonces se venden los Pasteles de pistaches.' },
  almudDatiles: { nombre: 'Almud de dátiles', precio: 2, texto: 'Mercancía: se compra en Yemen y Basra a 2 dinares y el mercado de Bagdad la compra a 4. Pesa. La primera vez que vendes dátiles en Bagdad cumples el reto R53 y ganas 20 noches.' },
  cesta: { nombre: 'Cesta de manzanas', precio: 5, texto: 'Para R24 o para contratar a Rayhán.' },
  sal: { nombre: 'Sacos de sal', precio: 15, texto: 'Carga de R23 (3 sacos).' },
  velo: { nombre: 'Velo quemado', precio: 30, texto: 'Descártalo para ignorar un genio malo o «ignorarte» en el Jorasán y volver a tirar. Además, mientras lo tengas, toda carta de Ifrit te ofrece la alfombra mágica (si la pides así, el velo se gasta).' },
  veneno: { nombre: 'Veneno', texto: 'Caduca a los 3 turnos. Con la Anciana Devota (20 dinares y el viaje desde Bagdad) envenenas a cualquiera; con tu acción principal, en secreto, dejas herido a otro jugador de tu ciudad (salvo que tenga Antídoto); y en el Jorasán envenenas a los ghul y escapas sin tirar. Se gasta al usarlo.' },
  mapaJorasan: { nombre: 'Mapa del Jorasán', precio: 20, texto: 'Se compra en el mercado de Bagdad por 20 dinares y no pesa. Si estás perdido en el Jorasán, úsalo en tu turno: tiras un dado y sales con cualquier resultado: impar, a Basra; par, a Samarcanda. Desde Yemen, los piratas se lo llevan por 5 dinares a un jugador perdido en el Jorasán: le llega en su próximo turno.' },
  yegua: { nombre: 'Yegua de la estepa', texto: 'Del reto R50 (Samarcanda). El mercado de Estambul paga 150 dinares por cada una, o véndesela a otro jugador en un trato, en cualquier ciudad, al precio que acuerden. No pesa ni carga nada y no sirve de transporte; te la pueden robar. Cada turno pagas albéitar y comida.' },
  caballoMongol: { nombre: 'Caballo mongol', transporte: 1, texto: 'Se compra en Estambul por 32 dinares (hay uno por cada yegua de la estepa que llegó a su mercado). Te lleva sin tarifa, en el mismo turno y sin terminarlo, solo entre Estambul, Bagdad, Isfahán, Aleppo y Damasco; si sales de esas ciudades, muere. Es animal de carga. Vive 2 turnos y cada turno pagas albéitar y comida. Solo lo compra el mercado de Estambul, por 2 dinares, y ahí vuelve a la venta.' },
  brujula: { nombre: 'Brújula', texto: 'Al buscar un tesoro tienes 1 intento extra en ese mismo turno.' },
  astrolabio: { nombre: 'Astrolabio', texto: 'Una brújula con esteroides: al buscar un tesoro tienes 2 intentos extra en ese mismo turno (la brújula da 1; si tienes los dos, vale el astrolabio). El botín se reparte normal con tus socios.' },
  pergamino: { nombre: 'Pergamino', texto: 'En Damasco se cobra por 30 dinares.' },
  esclavoSamarra: { nombre: 'Esclavo para Samarra', texto: 'Del reto R67: comprado en Basra para llevarlo a Bagdad (de ahí sale a construir Samarra). No pesa: camina. No produce noches ni cobra mantenimiento. Si no lo entregas a tiempo, lo pierdes.' },
  esclava: { nombre: 'Esclavas abisinias', texto: 'Dan +5 noches por turno; mantenimiento 1 dinar por turno.' },
  papiro: { nombre: 'Papiro', texto: 'Gana 2 dinares de valor por turno. La biblioteca de Bagdad lo compra a la mitad de su valor actual.' },
  pergaminoSellado: { nombre: 'Pergamino sellado', texto: 'Carga de R30: entrégalo en Bagdad.' },
  cartaUrgente: { nombre: 'Carta urgente', texto: 'Debe entregarse en la ciudad indicada antes de que venza el plazo.' },
  especias: { nombre: 'Especias', texto: 'Mercancía de comercio: se vende en la ciudad que las pida.' },
  recetaAverroes: { nombre: 'Receta de Averroes', texto: 'Regalo del cadí y médico Averroes: solo hay una en toda la partida, para el primero que cumpla uno de sus Mensajes. Úsala cuando estés herido: te cura y recuperas tu acción principal de ese turno. Se gasta al usarla.' },
  dadivaEmir: { nombre: 'Dádiva del Emir', texto: 'El Emir premia tu servicio: esta carta paga tu pasaje a una ciudad conectada con la que estás, la que elijas. Se usa sola en tu siguiente viaje de caravana y se gasta. No se vende.' },   // Jorge (18 de noviembre)
  bendicionAbuMadyan: { nombre: 'Bendición de Abu Madyan', texto: 'Regalo del sufí Abu Madyan: solo hay una en toda la partida, para el primero que cumpla uno de sus Mensajes. En el Magreb y Andalucía te protege: los bandoleros de la caravana de la sal (R23) pasan de largo y el esposo de Zein no te sorprende en la Giralda (R26). Sirve una sola vez: se gasta al protegerte.' },
  libroIbnHazm: { nombre: 'Libro de Ibn Hazm', texto: 'Regalo del sheij Ibn Hazm al cumplir su Mensaje de entregar un libro, papiro o mapa. Empieza valiendo 50 dinares y gana 2 por ronda; solo lo compra la biblioteca de Bagdad, a la mitad de su valor actual. No se puede regalar ni vender a otros jugadores.' },
  dadosCairo: { nombre: 'Dados del Cairo', texto: 'Regalo de Zacaría al Ansari a Zein. Una vez por ronda, si vas a perder una pelea, repites tus dados. Se vende a otro jugador en un trato (al precio que quieran) o al mercado de la ciudad por 35 dinares, que luego la revende en 75. Duran 5 turnos de su dueño; a Zein, si llega a El Cairo con los suyos, le duran 7 en total.' },
  dadosPersia: { nombre: 'Dados de Persia', texto: 'Los dados de Anís. Una vez por ronda, si te atacan para robarte o matarte (no en duelo), tiras un dado: con 5 o 6 escapas por la ventana y el agresor pierde su acción. Se venden a otro jugador en un trato (al precio que quieran) o al mercado de la ciudad por 30 dinares, que luego los revende en 60.' },
  dadoIbnArabi: { nombre: 'Dado de Ibn Arabi', texto: 'Regalo de Ibn Arabi. La próxima vez que vayas a perder una pelea o un duelo (contra un jugador o un NPC), se repite la tirada una vez. Se gasta al usarlo.' },
  mapa: { nombre: 'Mapa de tesoro', texto: 'Permite buscar un tesoro en su ciudad (R 16.1).' },
  // Cartas de sheij de permiso (Jorge, 10 de noviembre): salen del mazo de Mensajes y van a la mano; no cargan; se venden solo en tratos.
  cartaIbnHazm: { nombre: 'Carta de Ibn Hazm: no pierdes tu turno por montar', texto: "Te escribe el sabio de Córdoba: “Llegaste. Eso es lo evidente, y lo evidente basta. No busques en el cansancio una prohibición que nadie escribió.” Una sola vez, haz tu acción principal aunque hayas viajado en caballo, camello o burro. Luego la carta se extingue. Se puede vender a otro jugador en un trato, pero no al mercado.", msg: 'M17' },
  cartaIbnArabi: { nombre: 'Carta de Ibn Arabi: no pierdes tu turno por montar', texto: "Te escribe el Sheij al Akbar: “Quien viaja con el corazón despierto ya llegó antes de partir. Que tu montura descanse; tú, obra.” Una sola vez, haz tu acción principal aunque hayas viajado en caballo, camello o burro. Luego la carta se extingue. Se puede vender a otro jugador en un trato, pero no al mercado.", msg: 'M18' },
};
export function itemDatos(data, ref, extra = {}) {
  if (ref === 'mapa' && extra.tesoro === 'jugador') return { id: 'mapa:jugador', deck: 'objeto', titulo: `Papel amate · ${extra.monto ?? '?'} dinares en ${extra.ciudad}`, sub: 'Escondite de dinares', texto: `Aquí se anotó dónde están escondidos ${extra.monto ?? 'unos'} dinares: en ${extra.ciudad}. Quien tenga este papel puede ir a ${extra.ciudad} y sacarlos. Se puede vender o regalar a otro jugador en un trato; un robo no se lo lleva.`, valor: null, duracion: null, arte: 'ob-docum', ref: '16.3' };
  if (ref === 'mapa') {
    const t = extra.tesoro, d = TESOROS[t];
    return { id: 'mapa:' + t, deck: 'objeto', titulo: 'Mapa de tesoro' + (d ? ' · ' + d.nombre : t === 'jugador' ? ' · tesoro escondido' : ''), sub: 'Mapa · ' + (extra.ciudad || d?.ciudad || ''), texto: ITEMS.mapa.texto + (d ? ' Botín: ' + d.valor + ' dinares.' : ''), valor: null, duracion: null, arte: 'ob-lujo', ref: '16.1' };
  }
  const it = ITEMS[ref]; if (!it) return null;
  if (it.msg) return { id: 'it:' + ref, deck: 'mensaje', titulo: it.nombre, sub: ref === 'cartaIbnHazm' ? 'Sheij Ibn Hazm (Dios tenga misericordia de él)' : 'Sheij al-Akbar Ibn Arabi (Dios esté complacido con él)', texto: it.texto, valor: null, duracion: 'Un solo uso', arte: 'me', ref: '18.3' };
  if (ref === 'libroIbnHazm') return { id: 'it:' + ref, deck: 'objeto', titulo: it.nombre + (extra.titulo ? ` · «${extra.titulo}»` : ''), sub: 'Regalo de un sheij', texto: it.texto, valor: null, duracion: null, arte: 'ob-docum', ref: '18.3' };
  return { id: 'it:' + ref, deck: 'objeto', titulo: it.nombre, sub: 'Objeto original · R 15.1', texto: it.texto, valor: it.precio ?? null, duracion: null, arte: it.arma ? 'ob-arma' : ref === 'libro' ? 'ob-docum' : 'ob-herr', ref: '15.1' };
}
export const TESOROS = {
  mansa: { nombre: 'Mansa Musa', ciudad: 'Magreb', valor: 20 },   // Jorge (10 de noviembre): 20 como máximo (antes 96); se reparte con socios
  persia: { nombre: 'Persia', ciudad: 'Isfahán', valor: 30 },   // Jorge (10 de noviembre): 30 (antes 54)
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
// Jorge (19 de noviembre): Zein al Mawasif y el Sabio Ruyán nunca consiguen destreza, salvo con la jambiya. Si ganan la destreza
// general (R25, deseos, tesoros), para ellos es destreza solo con la jambiya (j.extra.destrezaJambiya); y solo entrenan la jambiya.
export const SOLO_JAMBIYA = ['2', '5'];
export const soloJambiya = (j) => SOLO_JAMBIYA.includes(j?.pj);
export const MSJ_SOLO_JAMBIYA = 'Zein y el Sabio Ruyán nunca consiguen destreza, salvo con la jambiya.';
export const puedeEntrenarArma = (j, arma) => !soloJambiya(j) || arma === 'jambiya';
export const tieneDestrezaGeneral = (j) => !!j.destreza || (soloJambiya(j) && !!j.extra?.destrezaJambiya);
export function darDestreza(j) { if (soloJambiya(j)) (j.extra ||= {}).destrezaJambiya = true; else j.destreza = true; }
// destreza que vale en una pelea con estas armas: la general, o la de jambiya si la lleva
export const destrezaCon = (j, armas) => !!j.destreza || (!!j.extra?.destrezaJambiya && armas.includes('jambiya'));
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
  if (POR_CIUDAD[id] && e.stockCiudad?.[id]) { ponerExistencia(e, id); return; }   // vuelve de inmediato al mercado que se quedó sin ella (Jorge, 11 de noviembre)
  const o = objDe(data, id);
  if (o.sinVenta) (e.mazos.descarte.botin ||= []).push(id); else (e.reposicion ||= []).push(id);   // escasez: vuelve al mercado al empezar una ronda (engine.reponerMercado)
}
// Jorge (10 de noviembre): sin animal de carga se llevan hasta 7 objetos del mazo; con caballo, burro o camello, los que quieras
// (la alfombra mágica no carga). Si ganas, robas o recibes de más sin animal, el sobrante se vende al banco (mitad del valor).
// Alforja (Jorge, 19 de noviembre): 4 a la venta en Basra a 6 dinares. Con ella cargas 9 en vez de 7 (la alforja misma no pesa). Sin animal
// solo puedes llevar 1; con animal, hasta 3 (no pesan, y con animal la carga ya no tiene límite). Si traes alforja solo te mueves una vez
// por turno (una caravana). Dura 3 turnos (contando el de la compra); al deshilacharse se esfuma y vuelve al mercado de Basra. Se vende a
// 1 dinar en cualquier mercado, recupera su estado y ese mercado la revende a 7 (en Basra, a 6).
export const tramosMax = (data, t, j) => { const m = t.maxTramos || data.config.maxTramosPorTurno; return j && tieneItem(j, 'alforja') ? Math.min(1, m) : m; };   // con alforja, una sola caravana por turno
export const MSJ_ALFORJA_TRAMO = 'Con alforja solo te mueves una vez por turno.';
// Lámpara de aceite (Jorge, 20 de noviembre): 1 en cada mercado menos India, a 8 dinares; pesa; no se repone.
export const LAMPARA = { precio: 8, ciudades: ['Bagdad', 'Basra', 'Isfahán', 'Aleppo', 'Damasco', 'El Cairo', 'Estambul', 'Samarcanda', 'Andalucía', 'Magreb', 'Yemen'] };
export const ALFORJA = { ciudad: 'Basra', inicial: 4, precio: 6, reventa: 7, venta: 1, guarda: 2, turnos: 3, maxSin: 1, maxCon: 3 };
export const LIMITE_OBJETOS = 7, ANIMALES_CARGA = ['caballo', 'burro', 'camello', 'caballoMongol'];   // el caballo mongol también carga; la yegua, no (Jorge, 12 de noviembre)
export const tieneCarga = (j) => ANIMALES_CARGA.some((r) => j.mano.some((c) => c.tipo === 'item' && c.ref === r));
// Jorge (10 de noviembre): Yafar NPC en difícil no tiene límite; en fácil y normal carga hasta 10 (y vende lo que sobre antes de moverse).
export const LIMITE_NPC = 10;
// Cartas de Ifrit (Jorge, 21 de noviembre): solo existen seis deseos, a) a f) (objetos.json → ifrit.deseos). En la mesa hay 7 cartas
// distintas con 3 deseos cada una; en línea, cada vez que sale una carta el genio ofrece 3 deseos al azar de los seis. Además, en el
// Jorasán siempre se puede huir de los ghul. La carta ya no se guarda ni se vende: el deseo se pide en ese momento.
export const DESEOS_IFRIT = ['a', 'b', 'c', 'd', 'e', 'f'];
export function deseosAlAzar(e) { return barajar(e, DESEOS_IFRIT.slice()).slice(0, 3).sort(); }
// Jorge (19 de noviembre): con el velo quemado, toda carta de Ifrit trae garantizada la alfombra mágica (deseo c), aunque la carta no la
// traiga; si la eliges por el velo, el velo se gasta solo. Si la carta ya trae la c, el velo no se gasta. El velo sigue sirviendo, además,
// para volver a tirar ante el genio malo o el que te ignora en el Jorasán (si se gastó ahí, ya no da la alfombra).
export const DESEO_VELO = 'c';
export const alfombraPorVelo = (j, card) => !!j && !!card && tieneItem(j, 'velo') && !card.deseos.includes(DESEO_VELO);
export const deseosIfrit = (j, card) => (alfombraPorVelo(j, card) ? [...card.deseos, DESEO_VELO] : card.deseos.slice());
export const TEXTO_DESEO_VELO = 'Por tu velo quemado: alfombra mágica (el velo se gasta)';
export function opcionesIfrit(data, j, card) {
  return deseosIfrit(j, card).map((d) => ({ id: d, texto: alfombraPorVelo(j, card) && d === DESEO_VELO ? TEXTO_DESEO_VELO : data.objetos.ifrit.deseos[d] }));
}
// Al pedir el deseo: si la c vino por el velo, el velo se gasta.
export function gastarVeloSiAlfombra(e, j, card, letra) {
  if (letra !== DESEO_VELO || !alfombraPorVelo(j, card)) return;
  quitarPrimero(j, 'item', 'velo');
  log(e, `${j.nombre} pide la alfombra mágica gracias a su velo quemado: el velo se gasta.`, { pid: j.id });
}
export const limiteCarga = (e, j) => (j.npc ? (e?.opciones?.dificultad === 'dificil' ? Infinity : LIMITE_NPC) : LIMITE_OBJETOS + (tieneItem(j, 'alforja') ? ALFORJA.guarda : 0));   // con alforja, 9 (Jorge, 19 de noviembre)
// Jorge (10 de noviembre): cuentan los objetos del mazo y además el alfanje, la cimitarra y cada botella de vino. No cuentan animales,
// mapas y papeles amate, arco, jambiya, flechas, dados, Firmán, Kanmakán ni premios de retos.
// Jorge (11 de noviembre): la alfombra mágica también cuenta como objeto (pesa), aunque no carga nada: no es animal de carga.
// Frasco con tinta de pulpo (Jorge, 17 de noviembre): India 3; en Bagdad 6 cuando alguien ya visitó India; el mercado de Andalucía o
// Samarcanda lo compra en 9 y lo revende en 10. Si roban a su dueño, se rompe y destruye sus papeles (no pasan al ladrón).
// Shatranj (ajedrez), Jorge (19 de noviembre): solo en el mercado de India, a 12; hay 5 en todo el juego. Se vende en Isfahán (25),
// Bagdad (30) o Andalucía (35) y al venderlo deja de existir (Jorge: no vuelve a India). Pesa. La tinta de pulpo lo destruye (como los papeles: se pierde).
export const SHATRANJ = { ciudad: 'India', precio: 12, stock: 5, venta: { 'Isfahán': 25, 'Bagdad': 30, 'Andalucía': 35 } };
export const shatranjEnIndia = (e) => e.shatranj ?? SHATRANJ.stock;
export const TINTA = { india: 3, bagdad: 6, venta: 9, reventa: 10, ciudadesVenta: ['Andalucía', 'Samarcanda'] };
export const PAPELES_ITEM = ['libro', 'papiro', 'libroIbnHazm', 'amate', 'mapa', 'alfombraIsfahan', 'shatranj'], PAPELES_OBJ = ['OB46', 'OB47', 'OB21'];   // Jorge (19 de noviembre): la tinta también destruye los Pasteles de pistaches   // libros, papiros, manuscritos, papel amate y mapas de tesoro
export const CALAMO_MAX = 6;   // Jorge (17 de noviembre): máximo 6 cálamos de Kufa en la mano
// Jorge (19 de noviembre): pesa todo lo que se carga: armas (arco, jambiya, alfanje, cimitarra; las flechas cuentan como 1 aunque tengas
// varias), libros (no los Manuscritos de la India ni los papeles), cálamos, cesta de manzanas, almudes de dátiles, dados, brújula, astrolabio,
// ídolo, velo, veneno, especias y sal. No pesan los papeles (papiro, amate, pergaminos, mapas, cartas, recetas), los animales, las
// esclavas, el Ejército de Kanmakán ni la Bendición de Abu Madyan.
export const CARGA_ITEMS = ['alfanje', 'cimitarra', 'vino', 'alfombra', 'tintaPulpo', 'alfombraIsfahan', 'shatranj',   // las alfombras de Isfahán pesan (18 de noviembre)
  'arco', 'jambiya', 'flechas', 'libro', 'libroIbnHazm', 'buza', 'cesta', 'almudDatiles', 'costalPistaches', 'dadosCairo', 'dadosPersia', 'dadoIbnArabi',
  'brujula', 'astrolabio', 'idolo', 'velo', 'veneno', 'especias', 'sal', 'citricos', 'pescado', 'lampara'];   // la lámpara de aceite pesa (Jorge, 20 de noviembre)   // el pescado pesa (Jorge, 19 de noviembre)
export const OBJ_SIN_PESO = ['OB46', 'OB05'];   // Manuscritos de la India; Lazo de camellero, que se lleva sobre la cabeza (Jorge, 19 de noviembre)
export const pesaCarta = (c) => (c.tipo === 'objeto' ? !OBJ_SIN_PESO.includes(c.ref) : c.tipo === 'item' && CARGA_ITEMS.includes(c.ref));
// Dátiles (Jorge, 19 de noviembre): almudes en Yemen y Basra a 2, sin límite (solo te frena el peso); el mercado de Bagdad los compra a 4.
// La primera vez que cada jugador los vende en Bagdad cumple R53 (20 noches). Hasta que alguien lo cumple, ningún mercado vende «Dátiles y pan de viaje» (OB19).
export const DATILES = { compra: 2, venta: 4, ciudades: ['Yemen', 'Basra'], ciudadVenta: 'Bagdad', reto: 'R53', noches: 20, obj: 'OB19' };
// Pistaches (Jorge, 19 de noviembre): reto R56 «Llevar cosecha de pistaches». En Isfahán compras costales a 2 dinares (hasta 10 a la vez;
// pesan). Al llegar a Bagdad se entregan solos y cobras 6 dinares por costal. El primero en la partida gana además 60 noches y desde
// entonces se venden los Pasteles de pistaches (3 en cada mercado de El Cairo, Bagdad y Damasco); los siguientes solo cobran los dinares.
export const PISTACHES = { compra: 2, venta: 6, ciudadCompra: 'Isfahán', ciudadVenta: 'Bagdad', reto: 'R56', noches: 50,   /* Jorge (20 de noviembre): 50 (antes 60) */ max: 10, obj: 'OB21' };
// Burros (Jorge, 19 de noviembre): 2 en el mercado de Basra desde el principio; cuando se compran los dos, aparece uno en Aleppo y otro en
// Damasco (anuncio para todos). Un burro que muere ya no vuelve («si el burro muere ya no hay más»); el de un jugador eliminado sí vuelve
// al mercado de donde salió.
export const BURROS = { Basra: 2, norte: { Aleppo: 1, Damasco: 1 } };
export const burrosEn = (e, ciudad) => (ciudad === 'Basra' ? e.burros || 0 : e.burrosNorte?.[ciudad] || 0);
export function devolverBurro(e, c) {
  const o = c?.extra?.origen;
  if (o && o !== 'Basra' && e.burrosNorte) { e.burrosNorte[o] = (e.burrosNorte[o] || 0) + 1; return o; }
  e.burros = (e.burros || 0) + 1; return 'Basra';
}
// Escorbuto (Jorge, 19 de noviembre): todo viaje por mar te deja herido salvo que lleves Cítricos (5 dinares en cualquier mercado), que
// se gastan en el primero. Por mar: El Cairo–Andalucía, El Cairo–Yemen y Magreb–Andalucía (ida y vuelta), el cruce a Abisinia (R40), los
// piratas de Yemen al Jorasán y el barco que te regresa a Basra desde India (Sindbad R11–R14, monzón H11). Se avisa antes de pagar.
// Herido no puedes embarcarte (Jorge, 19 de noviembre): ni caravana por mar, ni R11–R14, ni R40, ni los piratas, ni el barco del monzón.
export const RUTAS_MAR = [['El Cairo', 'Andalucía'], ['El Cairo', 'Yemen'], ['Magreb', 'Andalucía']];   // sin ruta Basra–India (Jorge)
export const esRutaMar = (a, b) => RUTAS_MAR.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
export const HERIDO_BARCO = 'Herido no puedes viajar en barco.';   // Jorge (19 de noviembre)
export const AVISO_ESCORBUTO = 'Es un viaje por mar y no llevas cítricos: quedarás herido por escorbuto. Los cítricos se venden en cualquier mercado a 5 dinares.';
export const avisoEscorbuto = (j) => (j && !tieneItem(j, 'citricos') ? AVISO_ESCORBUTO : '');
export function viajePorMar(e, pid, que) {
  const j = e.jugadores[pid];
  if (!j || j.eliminado) return '';
  if (quitarPrimero(j, 'item', 'citricos')) { const m = `Comes tus cítricos ${que}: no te da escorbuto.`; log(e, `${j.nombre} come sus cítricos ${que} y no le da escorbuto.`, { pid }); return m; }
  if (j.herido) { log(e, `${j.nombre} no llevaba cítricos ${que}, pero ya estaba herido.`, { pid }); return ''; }
  j.herido = true;
  log(e, `${j.nombre} no llevaba cítricos ${que} y queda herido por escorbuto.`, { pid, aviso: true });
  return 'No llevabas cítricos: quedas herido por escorbuto.';
}
// Alfombras de Isfahán (Jorge, 18 de noviembre): 20 en todo el juego, empiezan en el mercado de Isfahán. Ahí cuestan 30 (20 en el reto R17).
// Los demás mercados las compran a 35 (Andalucía a 40) y las revenden 3 dinares más caras; el de Isfahán las recompra a 15 (y las vende a 30).
// La tinta de pulpo las destruye (dejan de existir); la del banquete H14 es aparte de las 20; si fallas R17 por plazo te quedas las tuyas.
// R17: compras de 2 a 4 a 20 cada una y las llevas en 3 turnos a Bagdad (30 c/u), Estambul (40) o Andalucía (55); 15 noches por intentarlo y 25 más al completarlo.
export const ALFOMBRAS = { total: 20, origen: 'Isfahán', precioOrigen: 30, recompraOrigen: 15, margen: 3, venta: 35, ventaCiudad: { 'Andalucía': 40 },
  reto: { precio: 20, min: 2, max: 4, plazo: 3, entrega: { Bagdad: 30, Estambul: 40, 'Andalucía': 55 }, nochesIntento: 15, nochesFin: 25 } };
export const alfombrasEn = (e, ciudad) => ((e.alfombras ||= { [ALFOMBRAS.origen]: ALFOMBRAS.total })[ciudad] || 0);
export const precioAlfombraVenta = (ciudad) => (ciudad === ALFOMBRAS.origen ? ALFOMBRAS.recompraOrigen : ALFOMBRAS.ventaCiudad[ciudad] ?? ALFOMBRAS.venta);   // lo que paga ese mercado
export const precioAlfombraCompra = (ciudad) => (ciudad === ALFOMBRAS.origen ? ALFOMBRAS.precioOrigen : precioAlfombraVenta(ciudad) + ALFOMBRAS.margen);   // lo que cobra ese mercado
export function moverAlfombras(e, ciudad, n) { alfombrasEn(e, ciudad); e.alfombras[ciudad] = Math.max(0, (e.alfombras[ciudad] || 0) + n); }   // el frasco de tinta pesa (Jorge, 17 de noviembre)
// Mapa del Jorasán (Jorge, 12 de noviembre): hay 2 en toda la partida, a la venta en Bagdad por 20 dinares; no pesa. Perdido en el
// Jorasán, usarlo gasta tu acción principal: un dado, impar sales a Basra, par a Samarcanda; el mapa se desgasta y se desvanece. Los
// piratas de Yemen lo llevan por 5 dinares (sin gastar la acción principal) a un jugador perdido: le llega en su próximo turno. Se vende y
// se pasa en tratos como cualquier objeto; vendido en Bagdad queda a la venta ahí de inmediato; vendido en otro mercado (o gastado),
// desaparece y los escribas de Bagdad hacen otro: vuelve a la venta allí 2 rondas después. Yafar NPC: en fácil no lo compra, en normal hasta 1, en difícil los 2.
export const MAPA_JORASAN = { precio: 20, ciudad: 'Bagdad', envio: 5, impar: 'Basra', par: 'Samarcanda', seGasta: true, stock: 2, envioPrincipal: false, reponeRondas: 2, usadoRepone: true, npc: { facil: 0, normal: 1, dificil: 2 } };
// Jorge (19 de noviembre, más tarde): las flechas pesan en pares: 1 flecha no pesa, 2 o 3 pesan 1, 4 o 5 pesan 2, etc.
export const pesoFlechas = (n) => Math.floor(n / 2);
export const nCarga = (j) => { const p = j.mano.filter(pesaCarta), f = p.filter((c) => c.ref === 'flechas').length; return p.length - f + pesoFlechas(f); };
export const cargaExcedida = (j, e) => !tieneCarga(j) && nCarga(j) > limiteCarga(e, j);
export const MOTIVO_CARGA = `Sin caballo, burro o camello solo puedes llevar ${LIMITE_OBJETOS} objetos`;
export const MSJ_COMPRA_LLENO = 'Ya cargas 7 objetos y sin animal no puedes llevar más, así que el mercado ya no te vende. Compra un caballo, burro o camello, o vende algo para hacer espacio.';   // Jorge (10 de noviembre): decir que por eso el mercado ya no te vende
// Jorge (10 de noviembre): premios, robos, tratos y cartas del banco sí te dan los objetos aunque pases de 7; quedas sobrecargado y no
// puedes salir de la ciudad (motivoNoSalir) hasta conseguir un animal de carga o vender lo que sobra. Ya no se vende nada solo.
export const sobrecarga = (j, e) => `Vas muy cargado: llevas ${nCarga(j)} objetos y sin animal solo puedes con ${limiteCarga(e, j)}. No podrás salir de esta ciudad hasta conseguir un caballo, burro o camello, o vender lo que te sobra.`;
export function recortarMano(data, e, pid) {
  const j = e.jugadores[pid];
  if (!j || j.npc || !cargaExcedida(j, e)) return;   // Yafar NPC lo resuelve solo en su turno (npc.js, aligerar)
  log(e, `${j.nombre}: ${sobrecarga(j, e)}`, { pid });
  info(e, pid, 'Vas muy cargado', sobrecarga(j, e));
}
// Pala de zapador y Linterna de aceite (Jorge, 10 de noviembre): una copia en cada mercado que la vende, con su propia existencia.
// Disfraz de mendigo (Jorge, 19 de noviembre): uno en el mercado de cada ciudad (el Jorasán no tiene mercado).
const MERCADOS = ['Andalucía', 'Magreb', 'El Cairo', 'Estambul', 'Aleppo', 'Damasco', 'Yemen', 'Basra', 'Bagdad', 'Isfahán', 'Samarcanda', 'India'];
// Lazo de camellero (Jorge, 19 de noviembre): uno en cada mercado de Basra, Bagdad, El Cairo, Yemen y Samarcanda, nada más.
export const POR_CIUDAD = { OB21: ['El Cairo', 'Bagdad', 'Damasco'], OB05: ['Basra', 'Bagdad', 'El Cairo', 'Yemen', 'Samarcanda'], OB09: ['Damasco', 'Isfahán'], OB11: ['Damasco', 'El Cairo'], OB22: ['Bagdad', 'Andalucía', 'Damasco', 'Aleppo'], OB14: ['Aleppo', 'Bagdad', 'Damasco'], OB42: MERCADOS };   // Sopa del mesón: 1 en cada una (Jorge, 11 de noviembre)
// Sobre de sobornos (Jorge, 18 de noviembre): 2 en cada mercado de Aleppo, Bagdad y Damasco; un solo uso y el que se usa no vuelve al mercado.
export const POR_CIUDAD_N = { OB21: 3 };   // Pastel de pistaches: 3 en cada uno de sus mercados (Jorge, 19 de noviembre)
export const EN_BOTIN = ['OB42'];   // el Disfraz de mendigo, además de uno en cada mercado, sigue saliendo en el Botín como antes
export const copiasPorCiudad = (id) => POR_CIUDAD_N[id] || 1;
export const NO_VUELVE = ['OB14', 'OB01'];   // la Daga de manga se esfuma al usarla (Jorge, 19 de noviembre)
export const SIN_LIMITE = [];   // (el Pastel de pistaches ya no: desde el 19 de noviembre hay 3 en cada mercado de El Cairo, Bagdad y Damasco)
export const existencia = (e, id, ciudad) => (SIN_LIMITE.includes(id) ? Infinity : POR_CIUDAD[id] && e.stockCiudad?.[id] ? (e.stockCiudad[id][ciudad] || 0) : (e.stock[id] || 0));
export function sacarExistencia(e, id, ciudad) {
  e.stock[id] = Math.max(0, (e.stock[id] || 0) - 1);
  const m = POR_CIUDAD[id] && e.stockCiudad?.[id]; if (!m) return;
  const c = (m[ciudad] || 0) > 0 ? ciudad : POR_CIUDAD[id].find((x) => (m[x] || 0) > 0); if (c) m[c]--;
}
export function ponerExistencia(e, id) {
  e.stock[id] = (e.stock[id] || 0) + 1;
  const m = POR_CIUDAD[id] && e.stockCiudad?.[id]; if (!m) return;
  const c = POR_CIUDAD[id].find((x) => (m[x] || 0) < copiasPorCiudad(id)) || POR_CIUDAD[id][0]; m[c] = (m[c] || 0) + 1;   // vuelve al mercado que se quedó sin ella
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
// Deudas con una ciudad (Jorge, 21 de noviembre): se pagan cuando quieras, desde cualquier ciudad y sin gastar la acción principal
// (solo con los dinares completos: sin dinero no hay trato). Ya no impiden salir de la ciudad. Al volver a la ciudad de la deuda se
// cobra sola, con aviso, y si no te alcanzan los dinares quedas en negativo (deuda con el banco). Viven en j.extra.deudas.
export const deudasDe = (j) => j?.extra?.deudas || [];
export const deudaDe = (j, reto) => deudasDe(j).find((d) => d.reto === reto) || null;
export function contraerDeuda(e, pid, { ciudad, monto, reto, motivo }) {
  const j = e.jugadores[pid];
  const d = { ciudad, monto, reto, motivo: motivo || `reto ${reto}` };
  (j.extra.deudas ||= []).push(d);
  log(e, `${j.nombre} contrae una deuda de ${monto} dinares con ${ciudad} (${d.motivo}).`, { pid });
  return d;
}
function quitarDeuda(j, d) { const l = deudasDe(j), i = l.indexOf(d); if (i >= 0) l.splice(i, 1); if (!l.length) delete j.extra.deudas; }
// Pago voluntario: solo con los dinares completos.
export function pagarDeuda(e, pid, d) {
  const j = e.jugadores[pid];
  if (!d || !deudasDe(j).includes(d)) return false;
  if (j.dinares < d.monto) return false;
  j.dinares -= d.monto; quitarDeuda(j, d);
  log(e, `${j.nombre} paga su deuda con ${d.ciudad} (${d.monto} dinares, ${d.motivo}).`, { pid });
  return true;
}
// Cobro automático al llegar a la ciudad de la deuda (aunque quedes en negativo), con aviso.
export function cobrarDeudasAlLlegar(data, e, pid) {
  const j = e.jugadores[pid];
  for (const d of deudasDe(j).slice()) {
    if (d.ciudad !== j.ciudad) continue;
    const antes = j.dinares;
    j.dinares -= d.monto; quitarDeuda(j, d);
    const neg = j.dinares < 0;
    log(e, `${j.nombre} vuelve a ${d.ciudad} y le cobran su deuda: ${d.monto} dinares (${d.motivo})${neg ? `; no le alcanzaba y queda en ${j.dinares} dinares` : ''}.`, { pid });
    info(e, pid, `Cobro de tu deuda con ${d.ciudad}`, `Volviste a ${d.ciudad}: te cobran los ${d.monto} dinares que debías (${d.motivo}).${neg ? ` Tenías ${antes} y quedas en ${j.dinares} dinares: la diferencia se cobrará de lo próximo que recibas.` : ` Te quedan ${j.dinares} dinares.`}`);
  }
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
      else if (c.tipo === 'item' && c.ref === 'burro') devolverBurro(e, c);   // el burro vuelve al mercado de donde salió
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
// Ciudades cerradas (Jorge, 19 de noviembre): la Cruzada cierra Damasco, Aleppo y Estambul 2 rondas; la Reconquista, Andalucía para siempre.
export const ciudadCerrada = (e, c) => { const h = e?.cerradas?.[c]; return h != null && (h === 'siempre' || h === 'cruzada' || h === 'toledo' || (e.ronda || 0) <= h); };
export const motivoCerrada = (e, c) => (e?.cerradas?.[c] === 'siempre' ? `${c} quedó en manos cristianas (Reconquista): ya no se puede ir.` : e?.cerradas?.[c] === 'toledo' ? 'Los cristianos tomaron Toledo: no se puede ir a Andalucía hasta que Yusuf ibn Tashfín los derrote.' : `Los cruzados ocupan ${c}: no se puede ir hasta que Saladino devuelva el Levante.`);
export function tarifa(data, e, j, a, b) {
  let t = data.rutas.tarifas[a + '>' + b];
  if (t === undefined) return null;
  if (ciudadCerrada(e, b)) return null;
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
// Jambiyas escondidas, carta por carta (Jorge, 19 de noviembre): con dos jambiyas, esconder una no esconde la otra. Las partidas viejas
// guardaban un solo interruptor por jugador (extra.jambiyaOculta): vale para las cartas que aún no tienen el suyo.
export const jambiyaEscondida = (j, c) => c.tipo === 'item' && c.ref === 'jambiya' && (c.extra?.oculta ?? !!j.extra?.jambiyaOculta);
export const jambiyaALaMano = (j) => j.mano.some((c) => c.tipo === 'item' && c.ref === 'jambiya' && !jambiyaEscondida(j, c));
export const esLibro = (c) => c.tipo === 'item' && (c.ref === 'libro' || c.ref === 'papiro' || c.ref === 'libroIbnHazm');
export function valorLibro(data, e, c) { return (c.extra?.valor ?? 0) + 2 * Math.max(0, e.ronda - (c.extra?.ronda ?? e.ronda)); }
// Jorge (19 de noviembre): el vino gana 2 dinares por ronda (antes 6).
export const VINO = { precio: 20, porRonda: 2, stock: { 'Basra': 2, 'Andalucía': 4 } };
export function valorVino(c, e) { return VINO.precio + VINO.porRonda * Math.max(0, e.ronda - (c.extra?.ronda ?? e.ronda)); }
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
  j.mano.splice(j.mano.indexOf(c), 1); if (!NO_VUELVE.includes(id)) devolverObjeto(data, e, id);
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
const POR = { matar: (m) => `por matar a ${m.victima}`, robo: (m) => `por robar a ${m.victima}`, asesinos: () => 'por contratar a los Asesinos', asesinosSinPago: () => 'por hacer perder el tiempo a los Asesinos', saqueo: () => 'por saquear durante la Revolución abasí', apedreo: () => 'por escándalo: la apedrearon', mujer: (m) => `por atacar a ${m.victima}, que iba sin armas` };
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
  // Jorge (21 de noviembre): una deuda con la ciudad ya no impide salir de ella; se cobra sola al volver.
  if (j.extra?.sinViajar === e.ronda) return 'Un lazo de camellero te impide viajar esta ronda.';
  if (j.extra?.estudio && j.ciudad === j.extra.estudio.ciudad) return `Estás estudiando ${j.extra.estudio.idioma} en ${j.extra.estudio.ciudad}: no puedes salir hasta terminar las clases.`;   // Jorge (10 de noviembre)
  if (j.extra?.forja && j.ciudad === 'Damasco') return 'Estás forjando acero de Damasco: no puedes salir hasta que te den tu cimitarra.';   // R52 (Jorge, 17 de noviembre)
  if (cargaExcedida(j, e)) return sobrecarga(j, e);
  if (e.mods?.varado?.[j.id]) return 'Estás varado en India por los vientos del monzón: esta ronda no puedes moverte.';
  if (enCaravana && e.sinCaravanasBagdad && j.ciudad === 'Bagdad') return 'Tormenta de arena: esta ronda no salen caravanas desde Bagdad (E3).';
  return null;
}
