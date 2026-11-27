// Esclavos (Jorge, 27 de noviembre, solo en el 3D).
//  - Se compran en Estambul y El Cairo: de carga a 15 dinares (paga 1 dinar por turno) o de pelea y carga a 30 (paga 3 por turno).
//  - No pesan y cada uno carga 7 objetos más (base.limiteCarga).
//  - Si al empezar tu turno no te alcanza para su paga, el esclavo se va y desaparece, pero te deja tus cosas: puedes quedar sobrecargado.
//  - Puedes dejarlo en una ciudad: cualquiera que esté ahí lo toma gratis y desde entonces le paga él.
//  - Con el Lazo de camellero lo amarras en el mercado: 5 dinares por cada turno tuyo (en vez de su paga) y lo recuperas gratis.
//    Si no te alcanza para el amarre, también se va y desaparece. Nadie más puede tomar un esclavo amarrado.
//  - En combate, el de pelea sigue la regla 11.3 del reglamento extendido (pelea.js: esclavosArmados).
//  - No se venden al mercado; un ladrón que te gana se los lleva con lo demás (11.3: «el ladrón los captura»).
import { ok, err, log, tieneObj, quitarCarta, darItem, info, alertaRoja, ITEMS, ESCLAVOS, esEsclavo, cargaExcedida, sobrecarga } from './base.js';

const SIN_MERCADO = ['Jorasán'];
const nombreDe = (c) => ITEMS[c.ref].nombre.toLowerCase();
const sueltosEn = (e, ciudad) => (e.esclavosSueltos || []).filter((x) => x.ciudad === ciudad);
export const amarradosDe = (e, pid) => (e.esclavosAmarrados || []).filter((x) => x.dueno === pid);

// Lo que se ve en el mercado de Estambul y El Cairo (objetos.tienda).
export function enTienda(e, j, cai = 1) {
  if (!ESCLAVOS.ciudades.includes(j.ciudad) || j.npc) return [];
  return Object.entries(ESCLAVOS.tipos).map(([ref, T]) => {
    const precio = T.precio * cai;
    return { ref, nombre: ITEMS[ref].nombre, tipo: 'Esclavo', texto: ITEMS[ref].texto, precio, puede: j.dinares >= precio, motivo: j.dinares < precio ? 'No te alcanza' : undefined, donde: ESCLAVOS.ciudades.join(' y ') };
  });
}
export function comprar(e, pid, ref, cai = 1) {
  const j = e.jugadores[pid], T = ESCLAVOS.tipos[ref];
  if (!T) return err('Eso no se vende.');
  if (j.npc) return err('Yafar NPC no compra esclavos.');
  if (!ESCLAVOS.ciudades.includes(j.ciudad)) return err(`Los esclavos solo se venden en ${ESCLAVOS.ciudades.join(' y ')}.`);
  const p = T.precio * cai;
  if (j.dinares < p) return err(`Cuesta ${p} dinares.`);
  j.dinares -= p; darItem(e, j, ref);
  log(e, `${j.nombre} compra un ${nombreDe({ ref })} en ${j.ciudad} por ${p} dinares.`, { pid });
  return ok();
}

// Al empezar el turno de su dueño: la paga de cada esclavo y el amarre de los amarrados.
export function inicioTurno(data, e, pid) {
  const j = e.jugadores[pid]; if (!j) return;
  const idos = [];
  for (const c of j.mano.filter(esEsclavo)) {
    const paga = ESCLAVOS.tipos[c.ref].paga;
    if (j.dinares >= paga) { j.dinares -= paga; continue; }
    quitarCarta(j, c.uid); idos.push(nombreDe(c));
    log(e, `A ${j.nombre} no le alcanza para la paga de su ${nombreDe(c)} (${paga} dinar${paga === 1 ? '' : 'es'}): se va y desaparece, pero le deja sus cosas.`, { pid, aviso: true });
  }
  for (const x of amarradosDe(e, pid)) {
    if (j.dinares >= ESCLAVOS.amarre) { j.dinares -= ESCLAVOS.amarre; continue; }
    e.esclavosAmarrados.splice(e.esclavosAmarrados.indexOf(x), 1); idos.push(`${nombreDe(x.carta)} amarrado en ${x.ciudad}`);
    log(e, `A ${j.nombre} no le alcanza para el amarre de su ${nombreDe(x.carta)} en ${x.ciudad}: se suelta y desaparece.`, { pid, aviso: true });
  }
  if (idos.length && !j.npc) {
    const txt = `No te alcanzó para su paga: ${idos.length === 1 ? 'tu ' + idos[0] + ' se fue y desapareció' : 'se fueron y desaparecieron tu ' + idos.join(' y tu ')}. Te dejó tus cosas.`;
    alertaRoja(e, pid, txt);
    if (cargaExcedida(j, e)) info(e, pid, 'Vas sobrecargado', sobrecarga(j, e));
  }
}

// Opciones en Acciones (sección «Tus esclavos»). Son acciones libres: no gastan la acción principal.
export function opciones(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, r = [];
  if (!t || t.pid !== pid || t.fase === 'ingreso' || j.transito || j.perdido || j.npc || SIN_MERCADO.includes(j.ciudad)) return r;
  const propios = j.mano.filter(esEsclavo), lazo = !!tieneObj(j, 'OB05');
  for (const c of propios) {
    r.push({ k: 'esclavo', sub: 'dejar', uid: c.uid, titulo: `Dejar a tu ${nombreDe(c)} en ${j.ciudad}`, texto: `Cualquiera que esté en ${j.ciudad} lo puede tomar gratis, y desde entonces le paga él. Ya no te carga nada.` });
    r.push({ k: 'esclavo', sub: 'amarrar', uid: c.uid, titulo: `Amarrar a tu ${nombreDe(c)} en el mercado de ${j.ciudad}`, texto: `Con el Lazo de camellero: pagas ${ESCLAVOS.amarre} dinares por cada turno tuyo en vez de su paga y lo recuperas gratis. Nadie más lo puede tomar. El lazo no se gasta.`, bloqueado: lazo ? undefined : 'Necesitas el Lazo de camellero.' });
  }
  for (const x of sueltosEn(e, j.ciudad)) r.push({ k: 'esclavo', sub: 'tomar', uid: x.carta.uid, titulo: `Tomar al ${nombreDe(x.carta)} que ${x.de === pid ? 'dejaste' : `dejó ${e.jugadores[x.de]?.nombre || 'alguien'}`} aquí`, texto: `Gratis. Desde ahora le pagas tú: ${ESCLAVOS.tipos[x.carta.ref].paga} dinar${ESCLAVOS.tipos[x.carta.ref].paga === 1 ? '' : 'es'} por turno.` });
  for (const x of amarradosDe(e, pid).filter((q) => q.ciudad === j.ciudad)) r.push({ k: 'esclavo', sub: 'recuperar', uid: x.carta.uid, titulo: `Recuperar a tu ${nombreDe(x.carta)} amarrado`, texto: 'Gratis. Vuelve a cobrar su paga desde tu siguiente turno.' });
  return r;
}
export function accion(data, e, pid, a) {
  const j = e.jugadores[pid], t = e.turno;
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('En tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (j.npc) return err('Yafar NPC no tiene esclavos que manejar.');
  if (j.transito || j.perdido || SIN_MERCADO.includes(j.ciudad)) return err('Aquí no puedes hacerlo.');
  if (a.sub === 'dejar' || a.sub === 'amarrar') {
    const c = j.mano.find((x) => x.uid === a.uid && esEsclavo(x)); if (!c) return err('No tienes ese esclavo.');
    if (a.sub === 'amarrar' && !tieneObj(j, 'OB05')) return err('Necesitas el Lazo de camellero.');
    quitarCarta(j, c.uid);
    if (a.sub === 'dejar') { (e.esclavosSueltos ||= []).push({ carta: c, ciudad: j.ciudad, de: pid }); log(e, `${j.nombre} deja a su ${nombreDe(c)} en ${j.ciudad}: quien esté ahí lo puede tomar.`, { pid }); }
    else { (e.esclavosAmarrados ||= []).push({ carta: c, ciudad: j.ciudad, dueno: pid }); log(e, `${j.nombre} amarra a su ${nombreDe(c)} en el mercado de ${j.ciudad} con su Lazo de camellero.`, { pid }); }
    if (cargaExcedida(j, e)) info(e, pid, 'Vas sobrecargado', sobrecarga(j, e));
    return ok();
  }
  if (a.sub === 'tomar') {
    const x = sueltosEn(e, j.ciudad).find((q) => q.carta.uid === a.uid); if (!x) return err('Ese esclavo ya no está aquí.');
    e.esclavosSueltos.splice(e.esclavosSueltos.indexOf(x), 1); x.carta.pub = true; j.mano.push(x.carta);
    log(e, `${j.nombre} toma al ${nombreDe(x.carta)} que estaba en ${j.ciudad}${x.de !== pid ? ` (era de ${e.jugadores[x.de]?.nombre || 'alguien'})` : ''}.`, { pid });
    return ok();
  }
  if (a.sub === 'recuperar') {
    const x = amarradosDe(e, pid).find((q) => q.carta.uid === a.uid && q.ciudad === j.ciudad); if (!x) return err('No tienes ese esclavo amarrado aquí.');
    e.esclavosAmarrados.splice(e.esclavosAmarrados.indexOf(x), 1); j.mano.push(x.carta);
    log(e, `${j.nombre} recupera a su ${nombreDe(x.carta)} amarrado en ${j.ciudad}.`, { pid });
    return ok();
  }
  return err('Acción desconocida.');
}
