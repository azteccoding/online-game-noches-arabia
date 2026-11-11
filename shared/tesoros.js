// Tesoros, mapas, tesoro propio escondido, el Jorasán, genios y cartas de Ifrit (R 16, R 15.4).
import {
  ok, err, dado, dados, suma, par, log, nombre, ciudadDe, activos, enCiudad, tieneItem, tieneObj, tieneEsp, quitarCarta, quitarPrimero, uid, darItem, pagar, puedePrincipal, publicarCarta, cartaDatos,
  eliminar, TESOROS, HOOK, escondites, sincronizarEscondites, mostrarDados, consumirObj, info, pedir, registrar, robar, humanosVivos, ITEMS, rnd,
} from './base.js';
import { etiquetaBurro } from './objetos.js';

const mapasDe = (j) => j.mano.filter((c) => c.tipo === 'item' && c.ref === 'mapa');
function ciudadMapa(e, c) {
  if (c.extra?.tesoro === 'jugador') { const d = e.jugadores[c.extra.dueno]; return d && escondites(d).some((x) => x.id === c.extra.id) ? c.extra.ciudad : null; }
  return TESOROS[c.extra?.tesoro]?.ciudad || null;
}
export function libres(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno, r = [];
  if (!t || t.pid !== pid || t.fase === 'ingreso' || j.transito || j.perdido) return r;
  if (j.pj !== 'B' && j.dinares > 0) r.push({ k: 'esconder', titulo: 'Esconder dinares en esta ciudad' });
  for (const c of j.mano) if (c.tipo === 'item' && c.ref === 'mapa' && c.extra?.tesoro === 'jugador' && c.extra.ciudad === j.ciudad) r.push({ k: 'recuperar', uid: c.uid, titulo: `Sacar los ${c.extra.monto ?? ''} dinares escondidos` });
  return r;
}
export function disponibles(data, e, pid) {
  const j = e.jugadores[pid], r = [];
  if (!puedePrincipal(e.turno) || j.transito || j.perdido) return r;
  for (const c of mapasDe(j)) {
    const ciu = ciudadMapa(e, c);
    if (c.extra?.tesoro !== 'jugador' && ciu && ciu === j.ciudad && !(c.extra.tesoro in e.tesoros && e.tesoros[c.extra.tesoro].encontrado)) r.push({ k: 'tesoro', sub: 'buscar', uid: c.uid, titulo: 'Buscar el tesoro' + (TESOROS[c.extra.tesoro] ? ' de ' + TESOROS[c.extra.tesoro].nombre : ' escondido') });
  }
  const transp = ['caballo', 'camello', 'burro'].find((x) => tieneItem(j, x) && !(j.ciudad === 'India' && x !== 'burro') && !(x === 'burro' && j.pj === 'B' && j.npc));   // caballo y camello no salen de India
  if (transp) r.push({ k: 'tesoro', sub: 'jorasan', via: 'transporte', titulo: 'Viajar al Jorasán con ' + ITEMS[transp].nombre });
  if (j.ciudad === 'Yemen') r.push({ k: 'tesoro', sub: 'jorasan', via: 'piratas', titulo: 'Pagar a los piratas de Yemen para ir al Jorasán' });
  return r;
}

export function accion(data, e, pid, a) {
  const j = e.jugadores[pid], t = e.turno;
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (!puedePrincipal(t)) return err('No tienes acción principal disponible.');
  if (a.sub === 'salir') { if (!j.perdido) return err('No estás perdido.'); t.principal = true; return salirJorasan(data, e, pid); }
  // Jorge (10 de noviembre): la alfombra mágica te saca del Jorasán sin tirar dados: eliges a qué ciudad vuela (no a Bagdad).
  if (a.sub === 'alfombra') {
    if (!j.perdido) return err('No estás perdido.');
    if (!tieneItem(j, 'alfombra')) return err('No tienes alfombra mágica.');
    t.principal = true;
    const dests = data.ciudades.ciudades.map((q) => q.id).filter((q) => q !== 'Bagdad' && q !== j.ciudad);
    pedir(e, { tipo: 'tesoro', para: [pid], titulo: 'La alfombra mágica', texto: 'Tu alfombra te saca del Jorasán. ¿A qué ciudad vuelas?', opciones: dests.map((q) => ({ id: q, texto: q })), porDefecto: dests[0], limiteMs: 60000, cont: { fn: 'tes.alfombra', args: {} } });
    return ok();
  }
  if (j.perdido || j.transito) return err('Estás perdido o de camino.');
  if (a.sub === 'jorasan') {
    if (a.via === 'transporte') {
      if (!['caballo', 'camello', 'burro'].some((x) => tieneItem(j, x))) return err('Necesitas un caballo, camello o burro.');
      if (j.ciudad === 'India' && !tieneItem(j, 'burro')) return err('Ni el caballo ni el camello salen de India: viaja en caravana o en alfombra.');
      t.principal = true;
      return HOOK.viajarTransporte(data, e, pid, { destino: 'Jorasán', motivo: 'rumbo al Jorasán', turnos: 2, jorasan: true });
    }
    if (a.via === 'piratas') {
      if (j.ciudad !== 'Yemen') return err('Los piratas salen de Yemen.');
      const v = dados(e, 2), costo = suma(v);
      mostrarDados(e, { por: pid, motivo: 'piratas', grupos: [{ etq: `${j.nombre}: precio de los piratas`, valores: v }], resumen: [`Los piratas piden ${costo} dinares.`, ...(j.dinares < costo ? ['No te alcanzan: no hay viaje ni noches, y no gastas tu acción (puedes volver a preguntar).'] : [])] });   // Jorge (8 de noviembre): sin los dinares, no hay trato
      if (j.dinares < costo) return err(`Los piratas piden ${costo} dinares y no los tienes.`);
      j.dinares -= costo; t.principal = true;
      return HOOK.viajarTransporte(data, e, pid, { destino: 'Jorasán', motivo: 'piratas de Yemen', turnos: 1, jorasan: true });
    }
    return err('Vía inválida.');
  }
  if (a.sub === 'buscar') {
    const c = j.mano.find((x) => x.uid === a.uid && x.ref === 'mapa');
    if (!c) return err('No tienes ese mapa.');
    if (ciudadMapa(e, c) !== j.ciudad) return err('El tesoro no está en esta ciudad.');
    if (c.extra.tesoro !== 'jugador' && e.tesoros[c.extra.tesoro]?.encontrado) return err('Ese tesoro ya fue encontrado.');
    t.principal = true;
    const otros = enCiudad(e, j.ciudad, pid).filter((x) => !e.jugadores[x].npc);
    if (!otros.length) return busqueda(data, e, pid, c.uid, []);
    pedir(e, { tipo: 'tesoro', para: otros, modo: 'una', titulo: `${j.nombre} busca un tesoro`, texto: '¿Te unes como cazarrecompensas? El botín se reparte a partes iguales (máximo 3 buscadores).', opciones: [{ id: 'si', texto: 'Unirme' }, { id: 'no', texto: 'No' }], porDefecto: 'no', limiteMs: 40000, cont: { fn: 'tes.union', args: { pid, uid: c.uid } } });
    return ok();
  }
  return err('Acción de tesoro desconocida.');
}
registrar('tes.alfombra', (data, e, args, resp) => {
  const j = e.jugadores[resp.pid];
  if (!j || !j.perdido || !tieneItem(j, 'alfombra')) return;
  const origen = j.ciudad; j.perdido = false; j.extra.enRumbo = false; j.extra.destinoA = null; j.ciudad = resp.opcion;
  log(e, `${j.nombre} sale del Jorasán volando en su alfombra mágica hasta ${resp.opcion}.`, { pid: resp.pid, aviso: true });
  if (e.turno?.pid === resp.pid) { e.turno.movio = true; e.turno.fin = true; }
  HOOK.llegada(data, e, resp.pid, origen);
});
registrar('tes.union', (data, e, args, resp) => {
  const votos = resp.opcion !== undefined && resp.pid ? { [resp.pid]: resp } : resp;
  const aliados = Object.entries(votos).filter(([, v]) => v.opcion === 'si').map(([k]) => k).slice(0, 2);
  busqueda(data, e, args.pid, args.uid, aliados);
});
function busqueda(data, e, pid, uidMapa, aliados) {
  const j = e.jugadores[pid];
  const c = j.mano.find((x) => x.uid === uidMapa); if (!c) return ok();
  const n = 1 + aliados.length;
  // Jorge (10 de noviembre): la brújula da 1 intento extra en ese mismo turno y el astrolabio («una brújula con esteroides») 2;
  // si tienes los dos, vale el astrolabio (no se suman). El reparto con socios es el normal. Cada intento se tira con su botón.
  const astro = !!tieneItem(j, 'astrolabio'), bruj = !!tieneItem(j, 'brujula');
  const extra = astro ? 2 : bruj ? 1 : 0, quien0 = astro ? 'astrolabio' : 'brújula';
  const regla = n;                                                                                                // R 16.2: regla según cuántos buscan
  const bono = (tieneObj(j, 'OB11') ? 1 : 0) + (tieneObj(j, 'OB09') ? 1 : 0);
  let exito = false;
  for (let intento = 0; intento <= extra && !exito; intento++) {
    const v = regla === 3 ? [dado(e)] : [dado(e), dado(e)];
    if (regla === 1) exito = v[0] + bono > 3 && v[1] > 3;
    else if (regla === 2) exito = v[0] + bono > 2 && v[1] > 3;
    else exito = par(v[0] + bono);
    mostrarDados(e, { por: pid, motivo: 'tesoro', grupos: [{ etq: `${j.nombre}: búsqueda${intento ? ` (${quien0}, intento extra ${intento} de ${extra})` : ''}`, valores: v }], resumen: [exito ? 'El tesoro aparece.' : intento < extra ? `No hay suerte: con tu ${quien0} vuelves a intentarlo.` : 'No hay suerte.'] });
  }
  if (!exito) { log(e, `${j.nombre} no encuentra el tesoro.`, { pid }); return ok(); }
  let valor, quien = [pid, ...aliados];
  if (c.extra.tesoro === 'jugador') {
    const dueno = e.jugadores[c.extra.dueno], esc = escondites(dueno).find((x) => x.id === c.extra.id); valor = esc?.monto || 0;
    dueno.escondites = escondites(dueno).filter((x) => x !== esc); sincronizarEscondites(e, dueno);
    log(e, `${j.nombre} halla el tesoro escondido de ${dueno.nombre}.`, { pid });
  } else {
    valor = TESOROS[c.extra.tesoro].valor; e.tesoros[c.extra.tesoro] = { encontrado: true, por: pid };
    log(e, `${j.nombre} halla el tesoro de ${TESOROS[c.extra.tesoro].nombre}.`, { pid });
    for (const x of Object.values(e.jugadores)) for (const q of x.mano.filter((m) => m.tipo === 'item' && m.ref === 'mapa' && m.extra?.tesoro === c.extra.tesoro)) quitarCarta(x, q.uid);
  }
  quitarCarta(j, uidMapa);
  const parte = Math.floor(valor / n);
  for (const x of quien) e.jugadores[x].dinares += parte;
  log(e, `Reparto del botín: ${parte} dinares a ${quien.map((x) => nombre(e, x)).join(', ')}.`, { pid });
  return ok();
}

// Esconder (Jorge, 8 de noviembre): cada papel amate es un escondite propio; puedes tener tantos como papeles. Si ya tienes en esta
// ciudad un escondite cuyo papel está en tu mano, puedes agregarle dinares sin papel nuevo; con a.nuevo (o sin escondite aquí) se
// gasta un papel amate y nace otro escondite con su carta.
export const esconditeAqui = (e, j) => escondites(j).find((x) => x.ciudad === j.ciudad && j.mano.some((q) => q.tipo === 'item' && q.ref === 'mapa' && q.extra?.tesoro === 'jugador' && q.extra.id === x.id));
export function esconder(data, e, pid, a) {
  const j = e.jugadores[pid], t = e.turno;
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (j.pj === 'B') return err('Yafar no puede esconder tesoro.');
  if (!j.visitadas.includes(j.ciudad)) return err('Primero debes visitar la ciudad.');
  const m = Math.floor(a.monto || 0);
  if (!(m > 0 && m <= j.dinares)) return err('Cantidad inválida.');
  let esc = a.nuevo ? null : esconditeAqui(e, j);
  if (!esc && !tieneItem(j, 'amate')) return err('Necesitas un papel amate para anotar dónde escondes tus dinares (se compra en el mercado de cualquier ciudad).');
  j.dinares -= m;
  if (!esc) {
    quitarPrimero(j, 'item', 'amate'); esc = { id: uid(e), ciudad: j.ciudad, monto: 0 }; escondites(j).push(esc);
    darItem(e, j, 'mapa', { tesoro: 'jugador', dueno: pid, ciudad: j.ciudad, id: esc.id, monto: 0 });
  }
  esc.monto += m; sincronizarEscondites(e, j);
  log(e, `${j.nombre} esconde dinares en ${j.ciudad}.`, { pid });
  return ok();
}
export function recuperar(data, e, pid, a = {}) {
  const j = e.jugadores[pid], t = e.turno;
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  const mapa = j.mano.find((c) => c.tipo === 'item' && c.ref === 'mapa' && c.extra?.tesoro === 'jugador' && (!a.uid || c.uid === a.uid) && c.extra.ciudad === j.ciudad);
  if (!mapa) return err('Aquí no tienes ningún papel amate con dinares escondidos.');
  const dueno = e.jugadores[mapa.extra.dueno], esc = dueno && escondites(dueno).find((x) => x.id === mapa.extra.id);
  if (!esc || !(esc.monto > 0)) { quitarCarta(j, mapa.uid); if (dueno && esc) { dueno.escondites = dueno.escondites.filter((x) => x !== esc); sincronizarEscondites(e, dueno); } return err('Ese escondite ya está vacío.'); }
  const m = esc.monto; j.dinares += m; dueno.escondites = dueno.escondites.filter((x) => x !== esc); sincronizarEscondites(e, dueno); quitarCarta(j, mapa.uid);
  log(e, dueno === j ? `${j.nombre} recupera ${m} dinares escondidos en ${j.ciudad}.` : `${j.nombre} saca los ${m} dinares que ${dueno.nombre} escondió en ${j.ciudad}.`, { pid });
  return ok();
}

// ---------------------------------------------------------------- Jorasán (R 16.4)
function salirJorasan(data, e, pid) {
  const j = e.jugadores[pid], t = e.turno;
  const ctx = { grupos: [], res: [] };
  if (!j.extra.enRumbo) {
    const [x] = [dado(e)]; ctx.grupos.push({ etq: `${j.nombre}: buscando el rumbo`, valores: [x] });
    if (!par(x)) { ctx.res.push('Impar: sigues perdido. Repites en tu siguiente turno.'); mostrarDados(e, { por: pid, motivo: 'jorasan', grupos: ctx.grupos, resumen: ctx.res }); t.fin = true; return ok(); }
    ctx.res.push('Par: estás en el rumbo correcto.'); j.extra.enRumbo = true;
  }
  let veces = 0, genio;
  for (;;) {
    const v = [dado(e), dado(e)]; ctx.grupos.push({ etq: `${j.nombre} ante el genio`, valores: v });
    const impares = v.filter((q) => q % 2).length;
    genio = impares === 2 ? 'malo' : impares === 0 ? 'ignora' : 'lampara';
    if ((genio === 'malo' || genio === 'ignora') && veces === 0 && tieneItem(j, 'velo')) { quitarPrimero(j, 'item', 'velo'); ctx.res.push('Descartas el velo quemado y vuelves a tirar.'); veces++; continue; }
    break;
  }
  if (genio === 'ignora') { ctx.res.push('El genio decide ignorarte: pierdes el turno.'); mostrarDados(e, { por: pid, motivo: 'jorasan', grupos: ctx.grupos, resumen: ctx.res }); t.fin = true; return ok(); }
  if (genio === 'malo') {
    ctx.res.push(`Genio malo: te quita todos tus dinares (${j.dinares}).`); j.dinares = 0;
    mostrarDados(e, { por: pid, motivo: 'jorasan', grupos: ctx.grupos, resumen: ctx.res });
    return ghul(data, e, pid);
  }
  ctx.res.push('Genio de lámpara: robas una carta de Ifrit.');
  mostrarDados(e, { por: pid, motivo: 'jorasan', grupos: ctx.grupos, resumen: ctx.res });
  const id = robar(e, 'ifrit');
  if (!id) { j.dinares += 60; log(e, 'No quedan cartas de Ifrit: el genio entrega 60 dinares.'); return ghul(data, e, pid); }
  const card = data.objetos.ifrit.cartas.find((x) => x.id === id);
  pedir(e, { tipo: 'ifrit', para: [pid], titulo: 'Genio de la lámpara', texto: 'Elige un deseo (se usa ya) o conserva la carta para usarla más tarde o venderla (40 dinares).',
    opciones: [...card.deseos.map((d) => ({ id: d, texto: d + '. ' + data.objetos.ifrit.deseos[d] })), { id: 'guardar', texto: 'Conservar la carta para después' }], porDefecto: 'guardar', limiteMs: 120000, cont: { fn: 'tes.eligeDeseo', args: { carta: id } } });
  return ok();
}
registrar('tes.eligeDeseo', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  if (resp.opcion === 'guardar') { j.mano.push({ uid: uid(e), tipo: 'ifrit', ref: args.carta }); log(e, `${j.nombre} conserva una carta de Ifrit.`, { pid }); return ghul(data, e, pid); }
  e.mazos.descarte.ifrit.push(args.carta);
  deseo(data, e, pid, resp.opcion, { alTerminar: 'ghul' });
});
HOOK.usarIfrit = (data, e, pid, c, a) => {
  const j = e.jugadores[pid], card = data.objetos.ifrit.cartas.find((x) => x.id === c.ref);
  if (!card.deseos.includes(a.deseo)) return err('Elige uno de los deseos de la carta.');
  quitarCarta(j, c.uid); e.mazos.descarte.ifrit.push(c.ref);
  const r = deseoValido(data, e, pid, a.deseo);
  if (r) { j.mano.push(c); e.mazos.descarte.ifrit.pop(); return err(r); }
  deseo(data, e, pid, a.deseo, {});
  return ok();
};
// Lámpara mágica (regla de la casa): una vez por partida, desde la ronda 4, quien llega de viaje a Isfahán, Samarcanda, Yemen o
// India puede encontrarla en el camino (Jorge, 10 de noviembre: solo en esas cuatro ciudades).
// El genio le concede 1 deseo a elegir entre los 4 de una carta de Ifrit; toda la mesa sabe quién, dónde y qué pidió.
export const LAMPARA = { desdeRonda: 4, prob: 0.055, ciudades: ['Isfahán', 'Samarcanda', 'Yemen', 'India'] };   // por llegada a esas ciudades
export function quizaLampara(data, e, pid) {
  const j = e.jugadores[pid];
  if (e.lampara || j.npc || j.eliminado || !LAMPARA.ciudades.includes(j.ciudad) || (e.ronda || 0) < LAMPARA.desdeRonda) return;
  if (rnd(e) >= (data.config.lampara?.prob ?? LAMPARA.prob)) return;
  const id = robar(e, 'ifrit') || data.objetos.ifrit.cartas[0].id;
  const card = data.objetos.ifrit.cartas.find((x) => x.id === id);
  e.lampara = { pid, ciudad: j.ciudad, ronda: e.ronda, carta: id };
  log(e, `¡${j.nombre} encuentra una lámpara mágica en el camino a ${j.ciudad}! El genio le concederá un deseo.`, { pid, aviso: true });
  const op = card.deseos.map((d) => ({ id: d, texto: d + '. ' + data.objetos.ifrit.deseos[d], desactivada: !!deseoValido(data, e, pid, d) }));
  pedir(e, { tipo: 'ifrit', para: [pid], titulo: 'La lámpara mágica', texto: `Frotas la lámpara que encontraste camino de ${j.ciudad} y sale un genio: te concede un deseo. Elige uno (toda la mesa sabrá cuál pediste).`,
    opciones: op, porDefecto: (op.find((o) => !o.desactivada) || op[0]).id, limiteMs: 120000, cont: { fn: 'tes.lampara', args: { carta: id } } });
}
registrar('tes.lampara', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid];
  e.mazos.descarte.ifrit.push(args.carta);
  if (deseoValido(data, e, pid, resp.opcion)) return;
  log(e, `${j.nombre} pide al genio de la lámpara: ${data.objetos.ifrit.deseos[resp.opcion]}`, { pid, aviso: true });
  deseo(data, e, pid, resp.opcion, {});
});

function deseoValido(data, e, pid, d) {
  if (d === 'B' && e.asesinos.actuaron) return 'Los Asesinos ya actuaron.';
  if (d === 'J' && activos(e).filter((x) => x !== pid).length === 0) return 'No hay a quién maldecir.';
  return null;
}

function ghul(data, e, pid) {
  const j = e.jugadores[pid];
  const act = activos(e);
  const v = act.map(() => dado(e));
  const prom = Math.round(suma(v) / act.length);
  act.forEach((x, i) => mostrarDados(e, { por: x, npc: !!e.jugadores[x].npc, motivo: 'ghul', grupos: [{ etq: `${e.jugadores[x].nombre}: los ghul buscan a ${j.nombre}`, valores: [v[i]] }],   // cada jugador lanza el suyo
    resumen: i < act.length - 1 ? [] : [`Dados: ${v.join(', ')}. Promedio ${prom}: ${prom >= 3 ? `los ghul no encuentran a ${j.nombre}` : `los ghul encuentran a ${j.nombre}`}.`] }));
  if (prom < 3) { log(e, `Los ghul encuentran a ${j.nombre} en el Jorasán.`, { pid }); eliminar(data, e, pid, { causa: 'devorado por los ghul' }); return ok(); }
  const dest = j.extra.destinoA || 'Bagdad';
  j.extra.destinoA = null; j.extra.enRumbo = false; j.perdido = false; j.ciudad = dest;
  if (e.turno) { e.turno.movio = true; e.turno.fin = true; }
  log(e, `${j.nombre} escapa del Jorasán hacia ${dest}.`, { pid });
  return ok();
}

// ---------------------------------------------------------------- deseos de ifrit (R 15.4)
export function deseo(data, e, pid, letra, { alTerminar = null }) {
  const j = e.jugadores[pid];
  const fin = () => { if (alTerminar === 'ghul') ghul(data, e, pid); };
  log(e, `${j.nombre} pide el deseo ${letra}: ${data.objetos.ifrit.deseos[letra]}.`, { pid });
  switch (letra) {
    case 'C': j.dinares += 60; break;
    case 'D': j.noches += 60; break;
    // Regla de Jorge: el deseo da un Firmán extra aunque ya no quede ninguno a la venta (no sale de esos); a Yafar o a quien ya tiene uno, 30 dinares
    case 'F': if (j.pj !== 'B' && !tieneEsp(j, 'F1')) j.mano.push({ uid: uid(e), tipo: 'especial', ref: 'F1', extra: { deIfrit: true } }); else j.dinares += 30; break;
    case 'G': j.ventajaCombate = (j.ventajaCombate || 0) + 2; break;
    case 'H': darItem(e, j, 'alfombra'); break;
    case 'A': {
      const op = data.ciudades.ciudades.map((c) => ({ id: c.id, texto: c.id + etiquetaBurro(j, c.id) })).filter((c) => c.id !== j.ciudad || j.perdido);   // aviso del burro (Jorge, 10 de noviembre)
      pedir(e, { tipo: 'ifrit', para: [pid], titulo: 'Viaje instantáneo', texto: '¿A qué ciudad quieres ir?', opciones: op, porDefecto: 'Bagdad', limiteMs: 60000, cont: { fn: 'tes.A', args: { alTerminar } } });
      return;
    }
    case 'B': { if (e.asesinos.actuaron) { log(e, 'Los Asesinos ya actuaron: el deseo se pierde.'); break; } fin(); HOOK.contratarAsesinos(data, e, pid, { comodin: true }); return; }
    case 'E': pedir(e, { tipo: 'ifrit', para: [pid], titulo: 'Entrenamiento instantáneo', texto: 'Obtienes destreza con armas y un arma de hasta 35 dinares.', opciones: ['arco', 'alfanje', 'cimitarra', 'jambiya'].map((x) => ({ id: x, texto: ITEMS[x].nombre })), porDefecto: 'cimitarra', cont: { fn: 'tes.E', args: { alTerminar } } }); return;
    case 'I': pedir(e, { tipo: 'ifrit', para: [pid], titulo: 'Mapa de tesoro', texto: '¿Qué tesoro?', opciones: [{ id: 'persia', texto: 'Persia (Isfahán)' }, { id: 'ruman', texto: 'Rumán (Estambul)' }, { id: 'mansa', texto: 'Mansa Musa (Magreb)' }], porDefecto: 'persia', cont: { fn: 'tes.I', args: { alTerminar } } }); return;
    case 'J': {
      const op = activos(e).filter((x) => x !== pid).map((x) => ({ id: x, texto: nombre(e, x) }));
      if (!op.length) { log(e, 'No hay a quién maldecir: el deseo se pierde.'); break; }
      pedir(e, { tipo: 'ifrit', para: [pid], titulo: 'Maldición', texto: '¿A quién maldices? Pierde 50 noches y pasan a ti.', opciones: op, porDefecto: op[0]?.id, cont: { fn: 'tes.J', args: { alTerminar } } }); return;
    }
    default: break;
  }
  fin();
}
const retoma = (data, e, pid, args) => { if (args.alTerminar === 'ghul') ghul(data, e, pid); };
registrar('tes.A', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid], t = e.turno;
  if (args.alTerminar === 'ghul') { j.extra.destinoA = resp.opcion; return ghul(data, e, pid); }
  if (j.ciudad === resp.opcion) return;
  const origen = j.ciudad; j.ciudad = resp.opcion; if (t && t.pid === pid) { t.movio = true; HOOK.llegada(data, e, pid, origen); }
});
registrar('tes.E', (data, e, args, resp) => { const j = e.jugadores[resp.pid]; j.destreza = true; if (!tieneItem(j, resp.opcion)) darItem(e, j, resp.opcion); retoma(data, e, resp.pid, args); });
registrar('tes.I', (data, e, args, resp) => { darItem(e, e.jugadores[resp.pid], 'mapa', { tesoro: resp.opcion }); retoma(data, e, resp.pid, args); });
registrar('tes.J', (data, e, args, resp) => {
  const pid = resp.pid, j = e.jugadores[pid], o = e.jugadores[resp.opcion];
  if (!o || o.eliminado) return retoma(data, e, pid, args);
  const n = Math.min(50, o.noches);
  if (tieneObj(o, 'OB26')) { consumirObj(data, e, resp.opcion, 'OB26'); const r = Math.min(50, j.noches); j.noches -= r; o.noches += r; log(e, `${o.nombre} devuelve la maldición con su Espejo encantado.`); }
  else { o.noches -= n; j.noches += n; log(e, `${j.nombre} maldice a ${o.nombre}: le quita ${n} noches.`, { pid }); }
  retoma(data, e, pid, args);
});
