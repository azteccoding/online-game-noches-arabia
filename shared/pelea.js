// Combate, duelos, robos y asesinato entre jugadores (R 11, R 12) y peleas contra NPC (retos, Patrulla, esposo de Zein).
// Reglas de la casa oficiales (config.reglasCasa): bonos de arma para AMBOS bandos y defensor que mata sin quedar Buscado.
// Todo se resuelve en el servidor; las decisiones del defensor se piden con «pend» y las tiradas se muestran con la cola de dados.
import {
  ok, err, dado, dados, suma, par, log, nombre, pedir, registrar, CONT, mostrarDados, eliminar, ciudadDe, pjDe, objDe, enCiudad,
  tieneItem, tieneObj, tieneEsp, quitarPrimero, devolverObjeto, recortarMano, activos, darObjeto,
} from './base.js';

const ARMAS = ['arco', 'alfanje', 'cimitarra', 'jambiya'];
const BONO = { arco: 1, alfanje: 1, cimitarra: 2 };
const bonoArma = (data, ref) => data.config.armas?.[ref]?.bono ?? BONO[ref];

// ---------------------------------------------------------------- perfil de combate (R 11.1 y 11.2)
export function armasUsables(data, e, j, ciudad = j.ciudad) {
  const libre = e.mods?.armasBagdad;
  const firman = !!tieneEsp(j, 'F1');
  const r = [];
  for (const ref of ARMAS) {
    if (!tieneItem(j, ref)) continue;
    if (ciudad === 'Bagdad' && !libre) { if (!(firman && (ref === 'arco' || ref === 'jambiya'))) continue; }
    if (ref === 'arco' && !tieneItem(j, 'flechas')) continue;
    r.push(ref);
  }
  return r;
}
export function perfil(data, e, pid, ciudad) {
  const j = e.jugadores[pid];
  const armas = armasUsables(data, e, j, ciudad || j.ciudad);
  const destreza = !!j.destreza;
  const cat = armas.length && destreza ? 'D' : armas.length ? 'C' : destreza ? 'B' : 'A';
  return { pid, armas, destreza, cat };
}

// Objeto de tipo Arma del mazo: máximo 1 por bando en cada pelea (R 15.2). Elige el mejor para ese bando.
function objetoDeCombate(data, e, pid, rol, { contraNPC = false } = {}) {
  const j = e.jugadores[pid];
  const opciones = [];
  if (rol === 'def' && tieneObj(j, 'OB04')) opciones.push({ id: 'OB04', bono: 2, texto: 'Escudo de cuero +2', gasta: false });
  if (tieneObj(j, 'OB01')) opciones.push({ id: 'OB01', bono: 1, texto: 'Daga de manga +1', gasta: false });
  if (contraNPC && tieneObj(j, 'OB02')) opciones.push({ id: 'OB02', bono: 2, texto: 'Honda de pastor +2', gasta: true });
  if (rol === 'def' && tieneObj(j, 'OB03') && !j.extra.usaPolvo) opciones.push({ id: 'OB03', bono: 2, texto: 'Polvo de pimienta (el atacante resta 2)', gasta: true });
  opciones.sort((a, b) => b.bono - a.bono || (a.gasta ? 1 : 0) - (b.gasta ? 1 : 0));
  return opciones[0] || null;
}
export function consumir(data, e, pid, id) {
  const j = e.jugadores[pid], c = tieneObj(j, id);
  if (!c) return;
  const o = objDe(data, id);
  if (o.duracion === 'Permanente') return;
  if (o.duracion === '2 usos') { c.usos = (c.usos || 0) + 1; if (c.usos < 2) return; }
  j.mano.splice(j.mano.indexOf(c), 1); devolverObjeto(data, e, id);
}

// Suma de bonos de un bando. Lanza el dado de sorpresa de la jambiya UNA vez al empezar la pelea (R 11.1). Registra las líneas del desglose.
export function bonos(data, e, pid, perf, rol, lineas, { contraNPC = false } = {}) {
  const j = e.jugadores[pid];
  let total = 0; const partes = [];
  for (const ref of perf.armas) {
    if (ref === 'jambiya') {
      const d = dado(e);
      if (par(d)) { total += 3; partes.push(`jambiya +3 (dado de sorpresa ${d})`); } else partes.push(`jambiya +0 (dado de sorpresa ${d})`);
    } else { const b = bonoArma(data, ref); total += b; partes.push(`${ITEM_NOMBRE[ref]} +${b}`); }
    if (ref === 'cimitarra' && rol === 'atk' && data.config.reglasCasa?.cimitarraExtraAlAtacar) {
      const x = data.config.armas?.cimitarra?.extraAtacante ?? 2; total += x; partes.push(`cimitarra al atacar +${x}`);
    }
  }
  if (tieneEsp(j, 'K1')) { total += 2; partes.push('Ejército de Kanmakán +2'); }
  if (j.ventajaCombate > 0) { total += 3; j.ventajaCombate--; partes.push('deseo de ifrit +3'); }
  const ob = objetoDeCombate(data, e, pid, rol, { contraNPC });
  let resta = 0;
  if (ob) {
    if (ob.id === 'OB03') { resta = 2; partes.push('Polvo de pimienta (rival −2)'); } else { total += ob.bono; partes.push(ob.texto); }
    if (ob.gasta) consumir(data, e, pid, ob.id);
  }
  if (lineas) lineas.push(`${nombre(e, pid)}: ${partes.length ? partes.join(', ') : 'sin bonos de arma'}.`);
  return { total, resta, partes };
}
const ITEM_NOMBRE = { arco: 'arco', alfanje: 'alfanje', cimitarra: 'cimitarra', jambiya: 'jambiya' };

// ---------------------------------------------------------------- tiradas
// Categoría D (R 11.2): dado de ventaja, luego 2 dados cada uno + bonos + ventaja; empate = se repite.
function luchaD(data, e, A, B, bA, bB, lineas, extra = { A: 0, B: 0 }) {
  let grupos;
  for (let guard = 0; guard < 50; guard++) {
    const v = [dado(e), dado(e)];
    if (v[0] === v[1]) { lineas.push(`Dado de ventaja empatado (${v[0]}): se repite.`); continue; }
    const ventA = v[0] > v[1] ? 1 : 0, ventB = 1 - ventA;
    const rA = dados(e, 2), rB = dados(e, 2);
    const tA = suma(rA) + bA.total + ventA + extra.A - bB.resta, tB = suma(rB) + bB.total + ventB + extra.B - bA.resta;
    grupos = [{ etq: `${nombre(e, A)} (ventaja ${v[0]})`, valores: [v[0], ...rA] }, { etq: `${nombre(e, B)} (ventaja ${v[1]})`, valores: [v[1], ...rB] }];
    lineas.push(`Ventaja: ${nombre(e, A)} ${v[0]} / ${nombre(e, B)} ${v[1]} → ${ventA ? nombre(e, A) : nombre(e, B)} suma 1.`);
    lineas.push(`${nombre(e, A)}: ${rA.join('+')}=${suma(rA)} +${bA.total} bonos +${ventA} ventaja${extra.A ? ' +' + extra.A : ''}${bB.resta ? ' −' + bB.resta : ''} = ${tA}.`);
    lineas.push(`${nombre(e, B)}: ${rB.join('+')}=${suma(rB)} +${bB.total} bonos +${ventB} ventaja${extra.B ? ' +' + extra.B : ''}${bA.resta ? ' −' + bA.resta : ''} = ${tB}.`);
    if (tA === tB) { lineas.push('Empate: se repite la jugada.'); continue; }
    return { ganaA: tA > tB, grupos };
  }
  return { ganaA: true, grupos: grupos || [] };
}
// Un dado cada uno + ventaja del agresor (categoría B, R 11.2).
function luchaB(data, e, A, B, bA, bB, ventajaAgresor, lineas) {
  let grupos;
  for (let guard = 0; guard < 50; guard++) {
    const dA = dado(e), dB = dado(e);
    const tA = dA + ventajaAgresor + bA.total - bB.resta, tB = dB + bB.total - bA.resta;
    grupos = [{ etq: nombre(e, A), valores: [dA] }, { etq: nombre(e, B), valores: [dB] }];
    lineas.push(`${nombre(e, A)}: ${dA} +${ventajaAgresor} de ventaja +${bA.total} bonos = ${tA}. ${nombre(e, B)}: ${dB} +${bB.total} bonos = ${tB}.`);
    if (tA === tB) { lineas.push('Empate: se repite la jugada.'); continue; }
    return { ganaA: tA > tB, grupos };
  }
  return { ganaA: true, grupos: grupos || [] };
}

// Zein «Dados del Cairo» (habilidad oficial): una vez por ronda repite sus dados si iba a perder.
function zeinRepite(e, pid) {
  const j = e.jugadores[pid];
  if (j.pj !== '2' || j.extra.cairoRonda === e.ronda) return false;
  j.extra.cairoRonda = e.ronda; return true;
}
// Dado de Ibn Arabi (regla de la casa): si vas a perder una pelea, se repite la tirada una vez y el dado se gasta.
function dadoIbnArabi(e, pid) {
  const j = e.jugadores[pid];
  if (!j || !tieneItem(j, 'dadoIbnArabi')) return false;
  quitarPrimero(j, 'item', 'dadoIbnArabi'); return true;
}

// ---------------------------------------------------------------- iniciar un ataque (acción principal)
const AVISO_ATAQUE = { robo: 'te intenta robar', matar: 'te ataca a muerte', duelo: 'te desafía a duelo' };

export function validarAtaque(data, e, pid, a, { npc = false } = {}) {
  const t = e.turno, j = e.jugadores[pid], d = e.jugadores[a.objetivo];
  if (!d || d.eliminado || pid === a.objetivo) return err('Objetivo no válido.');
  if (!['robo', 'matar', 'duelo'].includes(a.tipo)) return err('Tipo de ataque desconocido.');
  if (j.ciudad !== d.ciudad) return err('Deben estar en la misma ciudad.');
  if (d.transito || j.transito) return err('Quien viaja con transporte propio no puede ser atacado.');
  if (d.extra.bajoTecho) return err('Zubayda está bajo el techo del Califa: no se la puede atacar.');
  if (j.perdido || d.perdido) return err('Alguien está perdido en el Jorasán.');
  if (!npc) {
    if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
    if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
    if (t.principal || t.bloqueoPrincipal) return err(t.bloqueoPrincipal ? 'Estás herido o inhabilitado: sin acción principal este turno.' : 'Ya usaste tu acción principal.');
  }
  const libre = e.mods?.armasBagdad;
  if (j.ciudad === 'Bagdad' && !libre && !tieneEsp(j, 'F1')) return err('En Bagdad solo se ataca con un Firmán del Califa.');
  const pa = perfil(data, e, pid);
  if (a.tipo === 'robo') {
    if (data.config.sinRobarPrimerasRondas && e.ronda <= data.config.primerosTurnosSinMatar && !libre) return err('Nadie puede robar en las 2 primeras rondas.');
    if (j.pj === '1') return err('Nur al Din no puede robar.');
    if (d.pj === '1') return err('Nur al Din es inmune a los robos.');
    if (!pa.armas.length && !npc) return err('Para robar necesitas un arma que puedas usar aquí.');
  }
  if (a.tipo === 'matar') {
    if (e.ronda <= data.config.primerosTurnosSinMatar && !libre) return err('Nadie puede matar en las 2 primeras rondas.');
    if (!npc && !(pa.armas.length && pa.destreza)) return err('Para matar necesitas un arma y destreza con armas: sin ellas solo puedes robar.');
  }
  if (a.tipo === 'duelo' && tieneEsp(d, 'K1')) return err('Quien porta el Ejército de Kanmakán no puede ser desafiado a duelo.');
  return ok();
}

export function atacar(data, e, pid, a, { npc = false, cont = null } = {}) {
  const v = validarAtaque(data, e, pid, a, { npc });
  if (!v.ok) return v;
  const t = e.turno, j = e.jugadores[pid], d = e.jugadores[a.objetivo];
  if (t) t.principal = true;
  const nurHonor = (j.pj === '1' || d.pj === '1') && ['El Cairo', 'Damasco', 'Aleppo'].includes(j.ciudad) && a.tipo === 'duelo';
  const pedirNur = j.pj === '1' && nurHonor ? { dinares: Math.max(0, Math.floor(a.pedirDinares || 0)), noches: Math.max(0, Math.floor(a.pedirNoches || 0)) } : null;
  const P = e.pelea = { id: ++e.seq, tipo: a.tipo, atk: pid, def: a.objetivo, ciudad: j.ciudad, nur: nurHonor, pedirNur, cont, rondaAnis: false, usa: {}, ayudante: null, cat: null, numeros: [], noRechazable: !!a.noRechazable };
  log(e, `${j.nombre} ${a.tipo === 'robo' ? 'grita «¡Esto es un asalto!» contra' : a.tipo === 'matar' ? 'ataca a muerte a' : 'desafía a duelo a'} ${d.nombre}.`, { pid });
  // Anís: «Por la ventana» (una vez por ronda; solo si el agresor es un jugador con acción principal)
  if (d.pj === '3' && d.extra.ventanaRonda !== e.ronda && a.tipo !== 'duelo') {
    d.extra.ventanaRonda = e.ronda;
    const x = dado(e), min = data.config.equilibrio?.anisVentanaMin ?? 5;   // equilibrio: config.json
    mostrarDados(e, { por: a.objetivo, motivo: 'ventana', grupos: [{ etq: `${d.nombre} escapa por la ventana (${min <= 4 ? `${min} a 6` : '5 o 6'})`, valores: [x] }], resumen: [x >= min ? `${d.nombre} escapa por el tejado: el agresor pierde su acción principal.` : `${d.nombre} no consigue escapar.`] });
    if (x >= min) { log(e, `${d.nombre} escapa por la ventana.`); return terminarPelea(data, e, { cancelada: true }); }
  }
  if (d.pj === 'B' && d.herido && d.dinares >= 50) return ofertaYafar(data, e);   // regla de la casa: Yafar herido puede pagar 50 para huir
  return seguirAtaque(data, e);
}

// Yafar herido (jugador o NPC) puede ofrecer 50 dinares al retador para huir. Si no hay oferta, no hay fondos o el
// retador no acepta, la pelea sigue exactamente igual que si la oferta no hubiera existido.
function ofertaYafar(data, e) {
  const P = e.pelea, j = e.jugadores[P.atk], d = e.jugadores[P.def];
  if (d.npc) return preguntarRetador(data, e);
  pedir(e, { tipo: 'defensa', para: [P.def], titulo: 'Estás herido', texto: `${j.nombre} ${AVISO_ATAQUE[P.tipo]} en ${P.ciudad}. Como estás herido, puedes ofrecerle 50 dinares para huir sin pelear; puede no aceptar.`,
    opciones: [{ id: 'ofrecer', texto: 'Ofrecer 50 dinares para huir' }, { id: 'no', texto: 'No ofrecer: pelear' }], porDefecto: 'no', cont: { fn: 'pelea.yafarOfrece', args: {} } });
  return ok();
}
registrar('pelea.yafarOfrece', (data, e, args, resp) => { if (resp.opcion === 'ofrecer') preguntarRetador(data, e); else seguirAtaque(data, e); });
function preguntarRetador(data, e) {
  const P = e.pelea, j = e.jugadores[P.atk], d = e.jugadores[P.def];
  if (j.npc) return seguirAtaque(data, e);
  pedir(e, { tipo: 'reto', para: [P.atk], titulo: 'Yafar ofrece 50 dinares', texto: `${d.nombre} está herido y te ofrece 50 dinares para huir sin pelear. Si aceptas, cobras y no hay pelea; si no, la pelea sigue normal.`,
    opciones: [{ id: 'acepto', texto: 'Aceptar los 50 dinares' }, { id: 'no', texto: 'Rechazar y pelear' }], porDefecto: 'no', cont: { fn: 'pelea.retadorDecide', args: {} } });
  return ok();
}
registrar('pelea.retadorDecide', (data, e, args, resp) => {
  const P = e.pelea; if (!P) return;
  const j = e.jugadores[P.atk], d = e.jugadores[P.def];
  if (resp.opcion === 'acepto' && d.dinares >= 50) {
    d.dinares -= 50; j.dinares += 50; log(e, `${d.nombre} paga 50 dinares a ${j.nombre} y huye herido, sin pelear.`, { pid: P.def });
    return terminarPelea(data, e, { cancelada: true });
  }
  seguirAtaque(data, e);
});

// Regla de la casa (arco y escudo): antes de un asalto o un ataque a muerte, el defensor dispara su arco (gasta 1 flecha;
// con 5 o 6 el atacante queda herido y huye) y, si sigue, levanta su Escudo de cuero (con 5 o 6 para el golpe; con 1 se rompe).
// Se aplica sola, sin preguntar; en los duelos no, porque son una pelea limpia. Devuelve true si el ataque se frustró.
export const ARCO_ACIERTA = 5, ESCUDO_PARA = 5;
export function tiroDeArco(data, e, pid, ciudad) {
  const j = e.jugadores[pid];
  if (!armasUsables(data, e, j, ciudad || j.ciudad).includes('arco')) return null;
  quitarPrimero(j, 'item', 'flechas');
  const x = dado(e);
  return { x, acierta: x >= ARCO_ACIERTA, quedan: j.mano.filter((c) => c.tipo === 'item' && c.ref === 'flechas').length };
}
export function golpeAlEscudo(data, e, pid) {
  const j = e.jugadores[pid];
  if (!tieneObj(j, 'OB04')) return null;
  const x = dado(e), rompe = x === 1;
  if (rompe) { quitarPrimero(j, 'objeto', 'OB04'); devolverObjeto(data, e, 'OB04'); }
  return { x, para: x >= ESCUDO_PARA, rompe };
}
function defensaPrevia(data, e) {
  const P = e.pelea, A = e.jugadores[P.atk], D = e.jugadores[P.def];
  if (P.tipo === 'duelo') return false;
  const grupos = [], resumen = [];
  const arco = tiroDeArco(data, e, P.def, P.ciudad);
  if (arco) {
    grupos.push({ etq: `${D.nombre} dispara su arco (5 o 6 acierta)`, valores: [arco.x] });
    resumen.push(arco.acierta ? `La flecha de ${D.nombre} hiere a ${A.nombre}, que huye sin atacar.` : `La flecha de ${D.nombre} no acierta (le quedan ${arco.quedan} flecha${arco.quedan === 1 ? '' : 's'}).`);
  }
  let frustrado = !!arco?.acierta;
  if (!frustrado) {
    const esc = golpeAlEscudo(data, e, P.def);
    if (esc) {
      grupos.push({ etq: `${D.nombre} levanta su Escudo de cuero (5 o 6 para el golpe; 1 lo rompe)`, valores: [esc.x] });
      resumen.push(esc.para ? `El escudo de ${D.nombre} para el golpe: ${A.nombre} no consigue nada.` : esc.rompe ? `El escudo de ${D.nombre} se rompe y la pelea sigue.` : `El golpe pasa el escudo; la pelea sigue (el escudo aún da +2 al defenderse).`);
      frustrado = esc.para;
    }
  }
  if (!grupos.length) return false;
  mostrarDados(e, { por: P.def, motivo: 'defensa', grupos, resumen });
  if (arco?.acierta) A.herido = true;
  return frustrado;
}

function seguirAtaque(data, e) {
  const P = e.pelea, j = e.jugadores[P.atk], d = e.jugadores[P.def];
  if (!P.previa) { P.previa = true; if (defensaPrevia(data, e)) return terminarPelea(data, e, { cancelada: true, frustrado: true }); }
  const a = { tipo: P.tipo, objetivo: P.def, noRechazable: P.noRechazable }, pedirNur = P.pedirNur;
  if (d.npc) { elegirDefensa(data, e, { opcion: 'luchar' }); return ok(); }
  const op = [{ id: 'luchar', texto: 'Defenderme' }];
  if (a.tipo === 'robo' && tieneObj(d, 'OB23')) op.push({ id: 'amuleto', texto: 'Usar Amuleto de turquesa (cancela el robo)' });
  if (a.tipo !== 'robo' && tieneObj(d, 'OB25')) op.push({ id: 'cortina', texto: 'Usar Cortina de humo (huyes sin pelear)' });
  if (tieneObj(d, 'OB03')) op.push({ id: 'polvo', texto: 'Defenderme con Polvo de pimienta (el atacante resta 2)' });
  if (a.tipo === 'duelo' && d.pj !== 'B' && !a.noRechazable) {
    const costo = pedirNur ? `${pedirNur.dinares} dinares y ${pedirNur.noches} noches` : `${data.config.duelo.rechazo} dinares`;
    op.push({ id: 'rechazar', texto: `Rechazar el duelo pagando ${costo}` });
  }
  pedir(e, { tipo: 'defensa', para: [a.objetivo], titulo: a.tipo === 'robo' ? '¡Te asaltan!' : a.tipo === 'matar' ? '¡Intentan matarte!' : '¡Te desafían a duelo!',
    texto: `${j.nombre} ${AVISO_ATAQUE[a.tipo]} en ${j.ciudad}. ¿Qué haces?`, opciones: op, porDefecto: 'luchar', cont: { fn: 'pelea.defensa', args: {} } });
  return ok();
}
registrar('pelea.defensa', (data, e, args, resp) => elegirDefensa(data, e, resp));

function elegirDefensa(data, e, resp) {
  const P = e.pelea; if (!P) return;
  const j = e.jugadores[P.atk], d = e.jugadores[P.def];
  const o = resp.opcion;
  if (o === 'amuleto') { quitarPrimero(d, 'objeto', 'OB23'); devolverObjeto(data, e, 'OB23'); log(e, `${d.nombre} rompe un Amuleto de turquesa: el robo queda cancelado.`, { pid: P.def }); return terminarPelea(data, e, { cancelada: true }); }
  if (o === 'cortina') {
    quitarPrimero(d, 'objeto', 'OB25'); devolverObjeto(data, e, 'OB25');
    if (tieneObj(j, 'OB10')) { quitarPrimero(j, 'objeto', 'OB10'); devolverObjeto(data, e, 'OB10'); log(e, `${j.nombre} lanza su Red de pescador y anula la huida de ${d.nombre}.`, { pid: P.atk }); }
    else {
      const destino = vecinaBarata(data, d.ciudad);
      log(e, `${d.nombre} huye entre una cortina de humo hacia ${destino}.`, { pid: P.def });
      d.ciudad = destino; return terminarPelea(data, e, { cancelada: true });
    }
  }
  if (o === 'rechazar') {
    if (P.pedirNur) { const p = pagarNur(data, e, P.def, P.atk, P.pedirNur); log(e, `${d.nombre} rechaza el duelo y paga ${p}.`, { pid: P.def }); }
    else { const r = Math.min(data.config.duelo.rechazo, d.dinares); d.dinares -= r; j.dinares += r; log(e, `${d.nombre} rechaza el duelo y paga ${r} dinares a ${j.nombre}.`, { pid: P.def }); }
    return terminarPelea(data, e, { cancelada: true });
  }
  if (o === 'polvo') d.extra.usaPolvo = false;
  P.polvo = o === 'polvo';
  return pasoAyuda(data, e);
}
function pagarNur(data, e, de, a, pide) {
  const J = e.jugadores[de], N = e.jugadores[a];
  const din = Math.min(pide.dinares, J.dinares), noc = Math.min(pide.noches, J.noches);
  J.dinares -= din; J.noches -= noc; N.dinares += din; N.noches += noc;
  return `${din} dinares y ${noc} noches`;
}
export function vecinaBarata(data, ciudad) {
  const opts = Object.entries(data.rutas.tarifas).filter(([k]) => k.startsWith(ciudad + '>')).sort((a, b) => a[1] - b[1]);
  return opts.length ? opts[0][0].split('>')[1] : 'Bagdad';
}

// Ayuda de otro jugador de la ciudad con armas (R 11.2, categorías A y B)
function pasoAyuda(data, e) {
  const P = e.pelea, pd = perfil(data, e, P.def);
  if (pd.cat === 'A' || pd.cat === 'B') {
    const cand = enCiudad(e, P.ciudad).filter((x) => x !== P.atk && x !== P.def && !e.jugadores[x].npc && perfil(data, e, x).armas.length);
    if (cand.length) return preguntarAyuda(data, e, cand);
  }
  return pasoCategoria(data, e);
}
function preguntarAyuda(data, e, cand) {
  const x = cand[0], P = e.pelea;
  pedir(e, { tipo: 'ayuda', para: [x], titulo: 'Ayuda en una pelea', texto: `${nombre(e, P.def)} es atacado por ${nombre(e, P.atk)} y no puede defenderse bien. ¿Peleas en su nombre?`,
    opciones: [{ id: 'si', texto: 'Sí, pelear en su nombre' }, { id: 'no', texto: 'No' }], porDefecto: 'no', limiteMs: 30000, cont: { fn: 'pelea.ayuda', args: { resto: cand.slice(1) } } });
}
registrar('pelea.ayuda', (data, e, args, resp) => {
  const P = e.pelea; if (!P) return;
  if (resp.opcion === 'si') { P.ayudante = resp.pid; log(e, `${nombre(e, resp.pid)} pelea en nombre de ${nombre(e, P.def)}.`, { pid: resp.pid }); return pasoCategoria(data, e); }
  if (args.resto.length) return preguntarAyuda(data, e, args.resto);
  return pasoCategoria(data, e);
});

// Categoría efectiva del defensor y números que debe decir (A y B en robos y A en el resto)
function pasoCategoria(data, e) {
  const P = e.pelea;
  const quien = P.ayudante || P.def;
  let pd = perfil(data, e, quien);
  const lineas = [];
  let cat = pd.cat;
  if (cat === 'C') {                                                          // con armas sin destreza: dado, par = como D, impar = como A
    const x = dado(e);
    cat = par(x) ? 'D' : 'A';
    mostrarDados(e, { por: quien, motivo: 'categoria', grupos: [{ etq: `${nombre(e, quien)} (armas sin destreza)`, valores: [x] }], resumen: [par(x) ? `${nombre(e, quien)} tiene arma, pero no destreza. Dado ${x} (par): acierta a usarla y pelea como si tuviera destreza.` : `${nombre(e, quien)} tiene arma, pero no destreza. Dado ${x} (impar): con los nervios no acierta a usarla y pelea como si no tuviera armas. No la pierde; solo no le sirvió en esta pelea.`] });
  }
  if (cat === 'B' && (P.tipo !== 'robo')) {                                   // B en matar/duelo: dado par = piedras (+1 agresor), impar (+2)
    const x = dado(e); P.ventajaB = par(x) ? 1 : 2;
    mostrarDados(e, { por: quien, motivo: 'categoria', grupos: [{ etq: `${nombre(e, quien)} (sin armas, con destreza)`, valores: [x] }], resumen: [`${nombre(e, quien)} tiene destreza, pero ningún arma que pueda usar aquí. Dado ${x}: el agresor suma ${P.ventajaB} punto${P.ventajaB > 1 ? 's' : ''} de ventaja.`] });
  }
  P.cat = cat;
  const defHumano = !e.jugadores[P.def].npc;
  const hayNumeros = (cat === 'A') || (cat === 'B' && P.tipo === 'robo');
  if (hayNumeros && !P.ayudante) {
    const k = cat === 'B' ? 2 : 1;
    if (defHumano) {
      pedir(e, { tipo: 'numeros', para: [P.def], titulo: 'Di tu número', texto: k === 1 ? 'Sin armas ni destreza tu suerte depende del dado: elige un número del 1 al 6.' : 'Con destreza pero sin armas dices dos números diferentes.',
        modo: 'multi', min: k, max: k, opciones: [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), texto: String(n) })), porDefecto: k === 1 ? ['3'] : ['2', '5'], cont: { fn: 'pelea.numeros', args: {} } });
      return;
    }
  }
  return resolver(data, e, { numeros: [] });
}
registrar('pelea.numeros', (data, e, args, resp) => resolver(data, e, { numeros: (resp.valores || []).map(Number) }));

// ---------------------------------------------------------------- resolución
function resolver(data, e, { numeros }) {
  const P = e.pelea; if (!P) return;
  const atk = P.atk, def = P.ayudante || P.def, lineas = [];
  const pA = perfil(data, e, atk), pD = perfil(data, e, def);
  const cat = P.cat || pD.cat;
  let ganaAtk, grupos = [], numeroOk = null;
  const nA = e.jugadores[atk].nombre, nD = e.jugadores[P.def].nombre;
  if (cat === 'A' || (cat === 'B' && P.tipo === 'robo')) {
    // juego de números: el atacante (robo) o el defensor (matar / duelo) tira un dado
    if (P.tipo === 'robo') {
      const x = dado(e), dicho = numeros.length ? numeros : [3];
      numeroOk = dicho.includes(x);
      ganaAtk = !numeroOk;
      grupos = [{ etq: `${nA} tira`, valores: [x] }];
      lineas.push(`${nD} dijo ${dicho.join(' y ')}; ${nA} saca ${x}: ${ganaAtk ? 'el asalto tiene éxito' : 'el asalto fracasa'}.`);
    } else {
      const x = dado(e), dicho = numeros[0] ?? 3;
      numeroOk = x === dicho;
      ganaAtk = !numeroOk;
      grupos = [{ etq: `${nD} tira (dijo ${dicho})`, valores: [x] }];
      lineas.push(`${nD} dijo ${dicho} y saca ${x}: ${numeroOk ? 'se salva' : 'no cae su número'}.`);
    }
  } else {
    const bA = bonos(data, e, atk, pA, 'atk', lineas), bD = bonos(data, e, def, pD, 'def', lineas);
    if (P.polvo && !P.ayudante) { bD.resta = Math.max(bD.resta, 2); const dj = e.jugadores[P.def]; quitarPrimero(dj, 'objeto', 'OB03'); devolverObjeto(data, e, 'OB03'); lineas.push(`${nD} usa Polvo de pimienta: el atacante resta 2.`); }
    let r = cat === 'B' ? luchaB(data, e, atk, def, bA, bD, P.ventajaB || 1, lineas) : luchaD(data, e, atk, def, bA, bD, lineas);
    const otraVez = () => (cat === 'B' ? luchaB(data, e, atk, def, bA, bD, P.ventajaB || 1, lineas) : luchaD(data, e, atk, def, bA, bD, lineas));
    const perdedor = r.ganaA ? def : atk;                                    // quien iba a perder puede repetir (Zein o Dado de Ibn Arabi)
    if (zeinRepite(e, perdedor)) { lineas.push(`${nombre(e, perdedor)} usa «Dados del Cairo» y repite la jugada.`); r = otraVez(); }
    else if (dadoIbnArabi(e, perdedor)) { lineas.push(`${nombre(e, perdedor)} usa el Dado de Ibn Arabi y repite la jugada.`); r = otraVez(); }
    ganaAtk = r.ganaA; grupos = r.grupos;
    lineas.push(`Gana ${ganaAtk ? nA : (P.ayudante ? nombre(e, P.ayudante) : nD)}.`);
  }
  mostrarDados(e, { por: atk, motivo: 'pelea', grupos, resumen: lineas });
  aplicar(data, e, { ganaAtk, numeroOk, cat });
}

function aplicar(data, e, { ganaAtk, numeroOk, cat }) {
  const P = e.pelea, A = e.jugadores[P.atk], D = e.jugadores[P.def];
  const sinArmasDef = cat === 'A' || cat === 'B';
  if (P.tipo === 'robo') {
    if (ganaAtk) robar(data, e, P.atk, P.def);
    else { log(e, `${A.nombre} no se lleva nada de ${D.nombre}.`, { pid: P.atk }); if (sinArmasDef && numeroOk) { A.herido = true; log(e, `${A.nombre} queda herido.`, { pid: P.atk }); } }
  } else if (P.tipo === 'matar') {
    if (ganaAtk) {
      const enmascarado = tieneObj(A, 'OB45');
      eliminar(data, e, P.def, { por: P.atk, causa: 'asesinado por ' + A.nombre });
      if (enmascarado) { quitarPrimero(A, 'objeto', 'OB45'); devolverObjeto(data, e, 'OB45'); log(e, `${A.nombre} usa la Máscara del zoco: nadie sabe quién fue; no queda Buscado.`, { pid: P.atk }); }
      else { A.buscado = data.config.buscadoRondas; log(e, `${A.nombre} queda Buscado durante 2 rondas.`, { pid: P.atk }); }
      if (A.pj === '3' && D.pj === '4') for (const id of activos(e)) if (id !== P.atk) { const p = Math.min(5, e.jugadores[id].dinares); e.jugadores[id].dinares -= p; A.dinares += p; }   // Anís: 5 dinares de cada uno si mata a Jamil
    } else if (numeroOk) {
      A.herido = true; log(e, `${D.nombre} se salva a pedradas; ${A.nombre} queda herido.`, { pid: P.def });
    } else {
      // R 11.5 y regla de la casa: el atacante muere; el defensor se queda con su botín y NO queda Buscado
      eliminar(data, e, P.atk, { por: P.def, causa: 'murió atacando a ' + D.nombre });
    }
  } else {
    duelo(data, e, ganaAtk ? P.atk : P.def, ganaAtk ? P.def : P.atk, P);
  }
  terminarPelea(data, e, { ganaAtk });
}

// R 11.6: el perdedor entrega la mitad de sus dinares (hacia abajo) y 30 noches (o todas) y queda herido.
export function duelo(data, e, ganador, perdedor, P = {}) {
  const G = e.jugadores[ganador], L = e.jugadores[perdedor];
  const nur = P.nur || (['1'].includes(G.pj) || L.pj === '1') && ['El Cairo', 'Damasco', 'Aleppo'].includes(G.ciudad);
  let din, noc;
  if (nur && G.pj === '1') { din = Math.floor(L.dinares / 2); noc = L.noches; }
  else if (nur && L.pj === '1') { din = L.dinares; noc = 0; }
  else { din = Math.floor(L.dinares / 2); noc = Math.min(data.config.duelo.nochesPerdedor, L.noches); }
  L.dinares -= din; L.noches -= noc; G.dinares += din; G.noches += noc;
  L.herido = true;
  if (e.mods?.premioDuelo && ['Andalucía', 'Magreb'].includes(G.ciudad)) { G.dinares += e.mods.premioDuelo; log(e, `${G.nombre} cobra ${e.mods.premioDuelo} dinares del banco (Mercenarios de la frontera).`, { pid: ganador }); }
  log(e, `${G.nombre} gana el duelo: ${L.nombre} entrega ${din} dinares y ${noc} noches y queda herido.`, { pid: ganador });
}

// R 12.1: el ladrón toma dinares, objetos, mapas y cartas poseídas (no noches, ni Mensajes, ni dinares escondidos).
function robar(data, e, atk, def) {
  const A = e.jugadores[atk], D = e.jugadores[def];
  const din = D.dinares; D.dinares = 0; A.dinares += din;
  const cartas = D.mano.splice(0);
  for (const c of cartas) A.mano.push(c);
  recortarMano(data, e, atk);
  log(e, `${A.nombre} roba ${din} dinares${cartas.length ? ' y ' + cartas.length + ' carta(s)' : ''} a ${D.nombre}.`, { pid: atk });
}

function terminarPelea(data, e, res) {
  const P = e.pelea;
  e.pelea = null;
  if (res.cancelada && P) { /* la acción principal ya se consumió */ }
  if (P?.cont) { const f = CONT[P.cont.fn]; if (f) f(data, e, P.cont.args || {}, { res, pelea: P }); }
  return ok();
}

// ---------------------------------------------------------------- pelea entre dos jugadores sin números (torneo E5, entrenamiento H7): siempre por dados
export function luchaLibre(data, e, a, b, titulo = 'Pelea') {
  const lineas = [];
  const pA = perfil(data, e, a), pB = perfil(data, e, b);
  const bA = bonos(data, e, a, pA, 'atk', lineas), bB = bonos(data, e, b, pB, 'def', lineas);
  const r = luchaD(data, e, a, b, bA, bB, lineas);
  lineas.push(`Gana ${nombre(e, r.ganaA ? a : b)}.`);
  mostrarDados(e, { por: a, motivo: 'pelea', grupos: r.grupos, resumen: [titulo, ...lineas] });
  return r.ganaA ? a : b;
}

// ---------------------------------------------------------------- pelea contra un NPC (retos, Patrulla, esposo de Zein, bandoleros)
// npc: {etq, dados=2, bono=0, jambiya=false}. El jugador tira 2 dados + bonos de arma (+1 por destreza, como en la Patrulla R 17.2). Empate: se repite.
export function peleaNPC(data, e, pid, npc, { tituloExtra = '' } = {}) {
  const lineas = [];
  const p = perfil(data, e, pid);
  const b = bonos(data, e, pid, p, 'def', lineas, { contraNPC: true });
  let gana = false, grupos = [], usoDado = false;
  const arco = tiroDeArco(data, e, pid);                                       // regla de la casa: el arco dispara antes de la pelea
  if (arco) lineas.push(arco.acierta ? `${nombre(e, pid)} dispara su arco (${arco.x}) y pone en fuga a ${npc.etq}.` : `${nombre(e, pid)} dispara su arco (${arco.x}) y falla.`);
  if (arco?.acierta) {
    mostrarDados(e, { por: pid, motivo: 'pelea', grupos: [{ etq: `${nombre(e, pid)} dispara su arco (5 o 6 acierta)`, valores: [arco.x] }], resumen: [tituloExtra, ...lineas].filter(Boolean) });
    return true;
  }
  for (let g = 0; g < 50; g++) {
    const r = dados(e, 2), n = dados(e, npc.dados || 2);
    let bn = npc.bono || 0, jd = null;
    if (npc.jambiya) { jd = dado(e); if (par(jd)) bn += 3; }
    const dest = p.destreza ? 1 : 0;
    const tj = suma(r) + b.total + dest - 0, tn = suma(n) + bn - b.resta;
    grupos = [{ etq: nombre(e, pid), valores: r }, { etq: npc.etq, valores: [...n, ...(jd ? [jd] : [])] }];
    lineas.push(`${nombre(e, pid)}: ${r.join('+')}=${suma(r)} +${b.total} bonos${dest ? ' +1 destreza' : ''} = ${tj}. ${npc.etq}: ${n.join('+')}=${suma(n)} +${bn}${b.resta ? ' −' + b.resta : ''} = ${tn}.`);
    if (tj === tn) { lineas.push('Empate: se repite.'); continue; }
    gana = tj > tn;
    if (!gana && !usoDado && dadoIbnArabi(e, pid)) { usoDado = true; lineas.push(`${nombre(e, pid)} usa el Dado de Ibn Arabi y repite la pelea.`); continue; }
    break;
  }
  lineas.push(gana ? `${nombre(e, pid)} vence a ${npc.etq}.` : `${npc.etq} vence a ${nombre(e, pid)}.`);
  mostrarDados(e, { por: pid, motivo: 'pelea', grupos, resumen: [tituloExtra, ...lineas].filter(Boolean) });
  return gana;
}
