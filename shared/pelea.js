// Combate, duelos, robos y asesinato entre jugadores (R 11, R 12) y peleas contra NPC (retos, Patrulla, esposo de Zein).
// Reglas de la casa oficiales (config.reglasCasa): bonos de arma para AMBOS bandos y defensor que mata sin quedar Buscado.
// Todo se resuelve en el servidor; las decisiones del defensor se piden con «pend» y las tiradas se muestran con la cola de dados.
import { protegidaPorPoetas, MSJ_POETAS } from './eventosJugador.js';
import {
  ok, err, dado, dados, suma, par, log, nombre, pedir, registrar, CONT, mostrarDados, eliminar, ciudadDe, pjDe, objDe, enCiudad,
  tieneItem, tieneObj, tieneEsp, quitarPrimero, devolverObjeto, recortarMano, activos, darObjeto, devolverPrincipal,
marcarBuscado, PAPELES_ITEM, PAPELES_OBJ, destrezaCon, publicarCarta, info, jambiyaEscondida, jambiyaALaMano, NO_VUELVE, huidaCuentaViaje, nEsclavos, alertaRoja, ITEMS } from './base.js';

const ARMAS = ['arco', 'alfanje', 'cimitarra', 'jambiya'];
// Jorge (19 de noviembre): el arco no cuenta como arma para los ataques (robo, ataque a muerte, duelo) ni para «llevar armas»;
// solo cuentan las demás. El arco conserva su uso propio: la flecha antes de la pelea (tiroDeArco), R43 y el Torneo de Murcia.
export const ARMAS_ATAQUE = ARMAS.filter((r) => r !== 'arco');
// Jorge (19 de noviembre): si llevas arco pero ya no tienes flechas, se te avisa antes de los dados de la pelea (solo a ti; no a Yafar NPC).
export const MSJ_SIN_FLECHAS = 'Llevas arco pero no te quedan flechas: no puedes dispararlo.', MSJ_ULTIMA_FLECHA = 'Usaste tu última flecha.';
function avisoSinFlechas(data, e, pid, ciudad) {
  const j = e.jugadores[pid]; if (!j || j.npc || !tieneItem(j, 'arco') || tieneItem(j, 'flechas')) return;
  if ((ciudad || j.ciudad) === 'Bagdad' && !e.mods?.armasBagdad && !tieneEsp(j, 'F1')) return;   // ahí tampoco podría usarlo con flechas
  alertaRoja(e, pid, MSJ_SIN_FLECHAS);   // Jorge (28 de noviembre): «solo avísalo en rojo, no es necesario poner una carta»
}
// Jorge (28 de noviembre, solo en el 3D): en Bagdad, sin Firmán del Califa, quien pelea contra Yafar (lo rete o Yafar lo rete) recibe
// una alerta antes de la pelea: él no usa armas y Yafar sí usa las suyas. Solo si Yafar de verdad puede usar alguna ahí.
export const textoBagdadYafar = (Y, armasY, llevaArmas) => `En Bagdad, sin el Firmán del Califa, ${llevaArmas ? 'no puedes usar tus armas en esta pelea' : 'peleas sin armas'}. ${Y.nombre} sí pelea con ${armasY.length > 1 ? 'sus armas' : 'su arma'} (${armasY.join(' y ')}), porque tiene el Firmán.`;
function avisoBagdadYafar(data, e, P) {
  if (P.ciudad !== 'Bagdad' || e.mods?.armasBagdad) return;
  const y = [P.atk, P.def].find((x) => e.jugadores[x]?.pj === 'B'); if (!y) return;
  const otro = y === P.atk ? P.def : P.atk, o = e.jugadores[otro], Y = e.jugadores[y];
  if (o.npc || o.pj === 'B' || tieneEsp(o, 'F1')) return;
  const armasY = armasUsables(data, e, Y, 'Bagdad'); if (!armasY.length) return;
  publicarCarta(e, { id: 'sinArmasBagdad', deck: 'especial', titulo: 'Sin Firmán en Bagdad', sub: 'Pelea', texto: textoBagdadYafar(Y, armasY, ARMAS.some((r) => tieneItem(o, r))), arte: 'es', causa: true }, otro, [otro]);
}
function avisoUltimaFlecha(e, pid) { const j = e.jugadores[pid]; if (j && !j.npc && tieneItem(j, 'arco') && !tieneItem(j, 'flechas')) alertaRoja(e, pid, MSJ_ULTIMA_FLECHA); }   // aviso rojo, sin ventana (Jorge, 28 de noviembre)
const BONO = { arco: 1, alfanje: 1, cimitarra: 2 };
const bonoArma = (data, ref) => data.config.armas?.[ref]?.bono ?? BONO[ref];

// ---------------------------------------------------------------- perfil de combate (R 11.1 y 11.2)
export function armasUsables(data, e, j, ciudad = j.ciudad) {
  const libre = e.mods?.armasBagdad;
  const firman = !!tieneEsp(j, 'F1');
  const r = [];
  for (const ref of ARMAS) {
    if (!tieneItem(j, ref)) continue;
    if (ref === 'jambiya' && !jambiyaALaMano(j)) continue;          // escondida no cuenta en las peleas (si tienes otra a la mano, esa sí)
    if (ciudad === 'Bagdad' && !libre) { if (!(firman && (ref === 'arco' || ref === 'jambiya'))) continue; }
    if (ref === 'arco' && !tieneItem(j, 'flechas')) continue;
    r.push(ref);
  }
  return r;
}
// Jorge (punto 7): el Ejército de Kanmakán se extingue al usarlo en una pelea, salvo que su dueño haya estado en Isfahán en sus últimos 2 turnos.
export const kanmakanVigente = (j) => j.extra?.isfahanTurno != null && j.turnos - j.extra.isfahanTurno <= 2;
function usarKanmakan(e, j) {
  if (kanmakanVigente(j)) return;
  const c = j.mano.find((x) => x.tipo === 'especial' && x.ref === 'K1'); if (!c) return;
  j.mano.splice(j.mano.indexOf(c), 1); e.kanmakan = { dueno: null, usada: true };
  log(e, `El Ejército de Kanmakán peleó por ${j.nombre} y se disolvió: hacía más de dos turnos que no pasaba por Isfahán.`, { pid: j.id, aviso: true });
}
export function perfil(data, e, pid, ciudad) {
  const j = e.jugadores[pid];
  const armas = armasUsables(data, e, j, ciudad || j.ciudad).filter((r) => ARMAS_ATAQUE.includes(r));   // el arco no cuenta como arma
  const general = destrezaCon(j, armas);   // Zein y Ruyán: solo con la jambiya (Jorge, 19 de noviembre)
  // Jorge (21 de noviembre): entrenar un arma (R18, R19, R42, R54, deseo f) es tener destreza en ella: si peleas con un arma
  // entrenada, peleas con destreza (categoría D, y puedes atacar a muerte). El +1 de la destreza general (R25) es aparte.
  const esc = esclavosPelea(j, armas);
  const destreza = general || armas.some((r) => !!j.extra?.entrenado?.[r]) || esc.alfanje;
  const cat = armas.length && destreza ? 'D' : armas.length ? 'C' : destreza ? 'B' : 'A';
  return { pid, armas, destreza, general, cat, esclavos: esc };
}
// Esclavos de pelea en combate (Jorge, 28 de noviembre, 11.3): «simplemente son como tú, pero ya vienen con destreza en alfanje».
// Si llevas uno, pelea él en tu lugar con tus armas: con alfanje pelea con destreza (D); sin alfanje, como pelearías tú (C, B o A).
// Pelea uno solo (los demás ya no suman) y muere siempre que pierde; tú no mueres ni quedas herido, pero pagas lo demás.
export function esclavosPelea(j, armas) {
  const n = nEsclavos(j, 'esclavoPelea');
  return { armados: n > 0 ? 1 : 0, pelea: n > 0, alfanje: n > 0 && armas.includes('alfanje'), bono: 0, texto: '' };
}

// Objetos de tipo Arma del mazo. Jorge (27 de noviembre, decisión D04: «no hay límite excepto en duelos»): en los duelos, máximo 1 por
// bando (el mejor); en las demás peleas se suman todos los que sirvan.
function objetoDeCombate(data, e, pid, rol, { contraNPC = false, duelo = false } = {}) {
  const j = e.jugadores[pid];
  const opciones = [];
  if (tieneObj(j, 'OB01') && !duelo) opciones.push({ id: 'OB01', bono: 1, texto: 'Daga de manga +1 (se gasta)', gasta: true });   // no cuenta en duelos (12 de noviembre); se gasta y se esfuma al usarla (19 de noviembre)
  if (contraNPC && tieneObj(j, 'OB02')) opciones.push({ id: 'OB02', bono: 2, texto: 'Honda de pastor +2', gasta: true });
  if (rol === 'def' && tieneObj(j, 'OB03') && !j.extra.usaPolvo) opciones.push({ id: 'OB03', bono: 2, texto: 'Polvo de pimienta (el atacante resta 2)', gasta: true });
  opciones.sort((a, b) => b.bono - a.bono || (a.gasta ? 1 : 0) - (b.gasta ? 1 : 0));
  return duelo ? opciones.slice(0, 1) : opciones;
}
export function consumir(data, e, pid, id) {
  const j = e.jugadores[pid], c = tieneObj(j, id);
  if (!c) return;
  const o = objDe(data, id);
  if (o.duracion === 'Permanente') return;
  if (o.duracion === '2 usos') { c.usos = (c.usos || 0) + 1; if (c.usos < 2) return; }
  j.mano.splice(j.mano.indexOf(c), 1); if (!NO_VUELVE.includes(id)) devolverObjeto(data, e, id);
}

// Suma de bonos de un bando. Lanza el dado de sorpresa de la jambiya UNA vez al empezar la pelea (R 11.1). Registra las líneas del desglose.
export function bonos(data, e, pid, perf, rol, lineas, { contraNPC = false, duelo = false, conDestreza = false, sinDestreza = false } = {}) {
  const j = e.jugadores[pid];
  let total = 0; const partes = [];
  // Jorge (28 de noviembre): «la destreza aplica también en duelos»: la destreza general (R25, o la jambiya de Zein y Ruyán) suma +1,
  // como en robos y ataques a muerte; una flecha de 5 o 6 se la quita en esa pelea.
  if (conDestreza && perf.general) { if (sinDestreza) partes.push('destreza perdida por la flecha'); else { total += 1; partes.push('destreza +1'); } }
  for (const ref of perf.armas) {
    if (ref === 'arco') continue;                                            // el arco no suma fijo: dispara una flecha antes de la pelea
    if (ref === 'jambiya') {
      const d = dado(e);
      const ej = j.extra?.entrenado?.jambiya ? 1 : 0;
      if (par(d)) { total += 3 + ej; partes.push(`jambiya +${3 + ej} (dado de sorpresa ${d}${ej ? ', entrenado' : ''})`); } else { total += ej; partes.push(`jambiya +${ej} (dado de sorpresa ${d}${ej ? ', entrenado' : ''})`); }
    } else { const b = bonoArma(data, ref) + (j.extra?.entrenado?.[ref] ? 1 : 0); total += b; partes.push(`${ITEM_NOMBRE[ref]} +${b}${j.extra?.entrenado?.[ref] ? ' (entrenado)' : ''}`); }
    if (ref === 'cimitarra' && rol === 'atk' && data.config.reglasCasa?.cimitarraExtraAlAtacar) {
      const x = data.config.armas?.cimitarra?.extraAtacante ?? 2; total += x; partes.push(`cimitarra al atacar +${x}`);
    }
  }
  if (tieneEsp(j, 'K1')) { total += 2; partes.push('Ejército de Kanmakán +2'); usarKanmakan(e, j); }
  if (j.ventajaCombate > 0) { total += 4; j.ventajaCombate--; partes.push('deseo de ifrit +4'); }   // deseo e: +4 en la próxima pelea (Jorge, 21 de noviembre)
  let resta = 0;
  for (const ob of objetoDeCombate(data, e, pid, rol, { contraNPC, duelo })) {
    if (ob.id === 'OB03') { resta = 2; partes.push('Polvo de pimienta (rival −2)'); } else { total += ob.bono; partes.push(ob.texto); }
    if (ob.gasta) consumir(data, e, pid, ob.id);
  }
  if (lineas) lineas.push(`${nombre(e, pid)}: ${partes.length ? partes.join(', ') : 'sin bonos de arma'}.`);
  return { total, resta, partes };
}
const ITEM_NOMBRE = { arco: 'arco', alfanje: 'alfanje', cimitarra: 'cimitarra', jambiya: 'jambiya' };

// ---------------------------------------------------------------- tiradas
// Categoría D (R 11.2): dado de ventaja (uno cada bando; si empatan, la ventaja es de quien se defiende, B), luego 2 dados cada uno
// + bonos + ventaja. Una sola tirada: el empate lo resuelve quien llama (Jorge, 28 de noviembre). mostrarPelea la presenta paso a paso.
function luchaD(data, e, A, B, bA, bB, extra = { A: 0, B: 0 }) {
  const vA = dado(e), vB = dado(e), ventA = vA > vB ? 1 : 0, ventB = 1 - ventA;
  const rA = dados(e, 2), rB = dados(e, 2);
  const tA = suma(rA) + bA.total + ventA + extra.A - bB.resta, tB = suma(rB) + bB.total + ventB + extra.B - bA.resta;
  return { vA, vB, rA, rB, ventA, ventB, extraA: extra.A, extraB: extra.B, tA, tB, ganaA: tA > tB, empate: tA === tB, margen: Math.abs(tA - tB) };
}
const esNPC = (e, pid) => !!e.jugadores[pid]?.npc;
// Nombre de quien pelea por un bando: si lleva esclavo de pelea, pelea él (11.3).
const nPel = (e, P, pid) => nombre(e, pid) + (P?.conEsclavo?.[pid] ? ' (pelea su esclavo)' : '');
// Desglose de un bando: dados, cada bono por separado, ventaja y total.
function partesBando(r, b, rival, vent, extra, agresor) {
  const partes = [`dados ${r.join(' + ')} = ${suma(r)}`, ...b.partes.filter((x) => !/^Polvo/.test(x))];
  if (vent) partes.push(`${agresor ? 'ventaja del agresor' : 'dado de ventaja'} +${vent}`);
  if (extra) partes.push(`+${extra}`);
  if (rival.resta) partes.push(`polvo de pimienta del rival −${rival.resta}`);
  return partes;
}
const listaBonos = (b) => (b.partes.length ? b.partes.join(', ') : 'sin bonos');
// Categoría D, paso a paso (Jorge, 28 de noviembre: «son dos tiradas, una con un dado, y explicarás qué pasó, y luego otra con dos»):
// 1) cada uno tira su dado de ventaja (primero el atacante, luego el defensor) y se dice quién se lleva el +1; 2) cada uno tira sus
// 2 dados y sale el desglose. Cada ventana dice antes por qué se tira y después qué pasó. rondas: una por tirada (más si alguien repite).
function mostrarPelea(data, e, { atk, def, bA, bD, rondas, inicio = [], cierre = [], titulo = null, final = null }) {
  const P = e.pelea, nA = nPel(e, P, atk), nD = nPel(e, P, def);
  rondas.forEach((x, k) => {
    const ultimo = k === rondas.length - 1;
    const pre = [...(k === 0 ? inicio : []), ...(x.previa ? [x.previa] : [])];
    mostrarDados(e, { por: atk, npc: esNPC(e, atk), motivo: 'pelea', titulo, grupos: [{ etq: `${nA}: dado de ventaja. Quien saque más suma +1 al final; si empatan, es de quien se defiende`, valores: [x.vA] }], resumen: [...pre, `${nA} saca ${x.vA} en su dado de ventaja.`] });
    mostrarDados(e, { por: def, npc: esNPC(e, def), motivo: 'pelea', titulo, grupos: [{ etq: `${nD}: dado de ventaja (${nA} sacó ${x.vA})`, valores: [x.vB] }], resumen: [x.vA === x.vB ? `${nD} saca ${x.vB}: empatan, y la ventaja (+1) es de quien se defiende, ${nD}.` : `${nD} saca ${x.vB}: la ventaja (+1) es para ${x.ventA ? nA : nD}.`] });
    mostrarDados(e, { por: atk, npc: esNPC(e, atk), motivo: 'pelea', titulo, grupos: [{ etq: `${nA}: 2 dados, más sus bonos (${listaBonos(bA)})`, valores: x.rA }], resumen: [`${nA}: ${partesBando(x.rA, bA, bD, x.ventA, x.extraA, false).join(' · ')} → total ${x.tA}.`] });
    const res = [`${nD}: ${partesBando(x.rB, bD, bA, x.ventB, x.extraB, false).join(' · ')} → total ${x.tB}.`];
    if (final) res.push(...final(x)); else if (x.tA !== x.tB) res.push(`Gana ${x.tA > x.tB ? nA : nD}, ${Math.max(x.tA, x.tB)} a ${Math.min(x.tA, x.tB)}.`); else res.push(`Empate a ${x.tA}: gana quien se defiende, ${nD}.`);
    if (ultimo) res.push(...cierre);
    mostrarDados(e, { por: def, npc: esNPC(e, def), motivo: 'pelea', titulo, grupos: [{ etq: `${nD}: 2 dados, más sus bonos (${listaBonos(bD)}). ${nA} lleva ${x.tA}`, valores: x.rB }], resumen: res });
  });
}

// «Dados del Cairo» (Jorge, 8 de noviembre): ya es una carta (Zein empieza con ella, regalo de Zacaría al Ansari); quien la tenga,
// una vez por ronda, repite sus dados si iba a perder.
function zeinRepite(e, pid) {
  const j = e.jugadores[pid];
  if (!j || !tieneItem(j, 'dadosCairo') || j.extra.cairoRonda === e.ronda) return false;
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
  if (d.sacado) return err('Ese jugador ya no está en la partida: el banco lo sacó.');
  if (!['robo', 'matar', 'duelo'].includes(a.tipo)) return err('Tipo de ataque desconocido.');
  if (j.ciudad !== d.ciudad) return err('Deben estar en la misma ciudad.');
  if (d.transito || j.transito) return err('Quien viaja con transporte propio no puede ser atacado.');
  if (d.extra.bajoTecho) return err('Zubayda está bajo el techo del Califa: no se la puede atacar.');
  if (protegidaPorPoetas(e, d.id)) return err(MSJ_POETAS);   // EJ42, solo 3D (Jorge, 26 de noviembre)
  if (j.perdido || d.perdido) return err('Alguien está perdido en el Jorasán.');
  if (!npc) {
    if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
    if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
    if (t.principal || t.bloqueoPrincipal) return err(t.bloqueoPrincipal ? 'Estás herido o inhabilitado: sin acción principal este turno.' : 'Ya usaste tu acción principal.');
  }
  const libre = e.mods?.armasBagdad;
  // Jorge (19 de noviembre): en Bagdad, sin Firmán, solo se reta a duelo; robar y atacar a muerte, solo con el Firmán del Califa.
  if (a.tipo !== 'duelo' && j.ciudad === 'Bagdad' && !libre && !tieneEsp(j, 'F1')) return err('En Bagdad, sin Firmán del Califa, solo puedes retar a duelo: robar y atacar a muerte, no.');
  const pa = perfil(data, e, pid);
  if (a.tipo === 'robo') {
    if (data.config.sinRobarPrimerasRondas && e.ronda <= data.config.primerosTurnosSinMatar && !libre) return err('Nadie puede robar en las 2 primeras rondas.');
    if (j.pj === '1') return err('Nur al Din no puede robar.');
    // Jorge (8 de noviembre): a Nur al Din sí le pueden robar como a cualquiera (se defiende con su cimitarra entrenada).
    if (!pa.armas.length) return err('Para robar necesitas un arma que puedas usar aquí.');   // Jorge (28 de noviembre): también Yafar NPC
  }
  if (a.tipo === 'matar') {
    if (e.ronda <= data.config.primerosTurnosSinMatar && !libre) return err('Nadie puede matar en las 2 primeras rondas.');
    if (j.ciudad === 'Bagdad') return err('En Bagdad no se puede atacar a muerte, ni con el Firmán del Califa.');   // Jorge (28 de noviembre)
    if (npc && !pa.armas.length) return err('Para matar necesitas un arma que puedas usar aquí.');   // Jorge (28 de noviembre): todos necesitan arma, también Yafar NPC
    if (!npc && !(pa.armas.length && (pa.destreza || j.pj === '1'))) return err(j.pj === '1' ? 'Para matar necesitas un arma que puedas usar aquí.' : 'Para matar necesitas un arma y destreza (la general de Estambul o un arma entrenada): sin ella solo puedes robar.');   // Nur al Din, guerrero: ataca a muerte sin destreza
  }
  if (a.tipo === 'duelo' && tieneEsp(d, 'K1')) return err('Quien porta el Ejército de Kanmakán no puede ser desafiado a duelo.');
  return ok();
}

export function atacaMujer(j, d) {
  if (!d || d.id === j.id) return false;
  if (d.pj === '2') return j.pj !== '2';
  if (d.pj === '6') return j.pj !== '2' && !ARMAS_ATAQUE.some((r) => r !== 'jambiya' && tieneItem(d, r));   // con solo un arco va «sin armas»
  return false;
}
export function atacar(data, e, pid, a, { npc = false, cont = null } = {}) {
  const v = validarAtaque(data, e, pid, a, { npc });
  if (!v.ok) return v;
  const t = e.turno, j = e.jugadores[pid], d = e.jugadores[a.objetivo];
  if (t) t.principal = true;
  const nurHonor = (j.pj === '1' || d.pj === '1') && ['El Cairo', 'Damasco', 'Aleppo'].includes(j.ciudad) && a.tipo === 'duelo';
  const pedirNur = j.pj === '1' && nurHonor ? { dinares: Math.max(0, Math.floor(a.pedirDinares || 0)), noches: Math.max(0, Math.floor(a.pedirNoches || 0)) } : null;
  const P = e.pelea = { id: ++e.seq, tipo: a.tipo, atk: pid, def: a.objetivo, ciudad: j.ciudad, nur: nurHonor, pedirNur, cont, rondaAnis: false, usa: {}, ayudante: null, cat: null, numeros: [], noRechazable: !!a.noRechazable };
  log(e, `${j.nombre} ${a.tipo === 'robo' ? 'grita «¡Esto es un asalto!» contra' : a.tipo === 'matar' ? 'ataca a muerte a' : 'desafía a duelo a'} ${d.nombre}.`, { pid, peleaId: P.id });
  avisoBagdadYafar(data, e, P);
  // Jorge (8 de noviembre): si Yafar (NPC o jugador) asalta o ataca a muerte a Zein o a Zubayda y ella no lleva armas a la vista
  // (un arma escondida no cuenta), Yafar queda Buscado, gane o pierda.
  // Jorge (19 de noviembre): quien ataque a Zein o a Zubayda (robo, ataque a muerte o duelo) queda Buscado, gane o pierda. A Zein,
  // siempre, lleve las armas que lleve; a Zubayda, solo si ella no lleva armas (la jambiya no cuenta). Si Zubayda ataca a Zein, sí;
  // si Zein ataca a Zubayda, no.
  if (a.tipo === 'robo' && P.ciudad === 'Bagdad') {   // Jorge (28 de noviembre): quien roba en Bagdad queda Buscado, gane o pierda
    P.buscadoBagdad = true;
    marcarBuscado(data, e, j, { tipo: 'robo', victima: d.nombre });
    log(e, `${j.nombre} asaltó a ${d.nombre} en Bagdad: queda Buscado durante ${data.config.buscadoRondas} rondas, gane o pierda.`, { pid, aviso: true });
  }
  if (atacaMujer(j, d)) {
    marcarBuscado(data, e, j, { tipo: 'mujer', victima: d.nombre });
    log(e, `${j.nombre} atacó a ${d.nombre} (${d.pj === '2' ? 'Zein' : 'Zubayda'}): queda Buscado durante ${data.config.buscadoRondas} rondas.`, { pid, aviso: true });
  } else if (j.pj === 'B' && ['2', '6'].includes(d.pj) && a.tipo !== 'duelo' && !ARMAS_ATAQUE.some((r) => tieneItem(d, r) && !(r === 'jambiya' && !jambiyaALaMano(d)))) {
    marcarBuscado(data, e, j, { tipo: 'mujer', victima: d.nombre });
    log(e, `${j.nombre} atacó a ${d.nombre}, que iba sin armas: queda Buscado durante ${data.config.buscadoRondas} rondas.`, { pid, aviso: true });
  }
  // «Dados de Persia» (Jorge, 8 de noviembre): antes «Por la ventana» de Anís; ahora la usa quien tenga la carta (una vez por ronda)
  if (tieneItem(d, 'dadosPersia') && d.extra.ventanaRonda !== e.ronda && a.tipo !== 'duelo') {
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

// El arco (Jorge, 28 de noviembre, 10:11: «voy a reescribir por completo como funciona el arco»): sin flechas no sirve; si el rival
// tiene escudo, tampoco (el escudo la para). Con 5 o 6 acierta y el rival pelea con −2 en su conteo final; con destreza en el arco
// (R43 o deseo f), de 4 a 6; si no, falla. Campeón de Murcia (R51): siempre acierta, −2, sin dado. Ya no quita la destreza.
export const ARCO_ACIERTA = 5, ARCO_ACIERTA_DESTREZA = 4, ARCO_MENOS = 2;
export const umbralArco = (j) => (j?.extra?.entrenado?.arco ? ARCO_ACIERTA_DESTREZA : ARCO_ACIERTA);
export function tiroDeArco(data, e, pid, ciudad, { ladrones = false } = {}) {   // ladrones de Alí Babá: como siempre, se tira y 5 o 6 los ahuyenta
  const j = e.jugadores[pid];
  if (!armasUsables(data, e, j, ciudad || j.ciudad).includes('arco')) return null;
  quitarPrimero(j, 'item', 'flechas'); avisoUltimaFlecha(e, pid);
  if (j.extra?.arcoMaximo && !ladrones) return { x: null, murcia: true, acierta: true, cubre: false, quedan: j.mano.filter((c) => c.tipo === 'item' && c.ref === 'flechas').length };   // Campeón de Murcia: sin dado
  const x = dado(e);
  return { x, acierta: x >= (ladrones ? ARCO_ACIERTA : umbralArco(j)), cubre: false, quedan: j.mano.filter((c) => c.tipo === 'item' && c.ref === 'flechas').length };
}

function seguirAtaque(data, e) {
  const P = e.pelea, j = e.jugadores[P.atk], d = e.jugadores[P.def];
  const a = { tipo: P.tipo, objetivo: P.def, noRechazable: P.noRechazable }, pedirNur = P.pedirNur;
  if (d.npc) { elegirDefensa(data, e, { opcion: a.tipo === 'duelo' && yafarNPCRechaza(data, e, P.def, P.atk) ? 'rechazar' : 'luchar' }); return ok(); }
  const op = [{ id: 'luchar', texto: 'Defenderme' }];
  if (a.tipo === 'robo' && tieneObj(d, 'OB23')) op.push({ id: 'amuleto', texto: 'Usar Amuleto de turquesa (cancela el robo)' });
  if (a.tipo !== 'robo' && tieneObj(d, 'OB25')) op.push({ id: 'cortina', texto: 'Usar Cortina de humo (huyes sin pelear)' });
  if (tieneObj(d, 'OB03')) op.push({ id: 'polvo', texto: 'Defenderme con Polvo de pimienta (el atacante resta 2)' });
  if (a.tipo === 'duelo' && d.pj !== 'B' && !a.noRechazable) {
    const costo = pedirNur ? `${pedirNur.dinares} dinares y ${pedirNur.noches} noches` : `${data.config.duelo.rechazo} dinares`;
    const alcanza = puedePagarRechazo(data, d, pedirNur);   // Jorge (19 de noviembre): «si no tienes 20 no puedes pagar»
    op.push({ id: 'rechazar', texto: `Rechazar el duelo pagando ${costo}${alcanza ? '' : ` — No tienes ${costo}`}`, desactivada: !alcanza });
  }
  pedir(e, { tipo: 'defensa', para: [a.objetivo], titulo: a.tipo === 'robo' ? '¡Te asaltan!' : a.tipo === 'matar' ? '¡Intentan matarte!' : '¡Te desafían a duelo!',
    texto: `${j.nombre} ${AVISO_ATAQUE[a.tipo]} en ${j.ciudad}. ${enJuego(data, e, a.tipo, j, d, pedirNur)}¿Qué haces?`, opciones: op, porDefecto: 'luchar', cont: { fn: 'pelea.defensa', args: {} } });
  return ok();
}
// Jorge (19 de noviembre): Yafar NPC en difícil sí puede rechazar un duelo, pagando 20 dinares al retador (en fácil y normal, y Yafar
// jugador, nunca). Criterio (provisional, fácil de cambiar aquí): rechaza solo si tiene los 20 dinares y la pelea no le conviene: está
// herido (si pierde, muere) o el retador tiene más bonos de pelea visibles que él (armas, entrenamiento, destreza, escudo).
export function fuerzaVisible(data, e, pid, rol) {
  const j = e.jugadores[pid], p = perfil(data, e, pid);
  let f = p.general ? 1 : 0;   // el entrenado ya suma abajo con su arma
  for (const r of p.armas) {
    f += (r === 'jambiya' ? 1.5 : bonoArma(data, r)) + (j.extra?.entrenado?.[r] ? 1 : 0);   // jambiya: +3 con el dado de sorpresa par (media 1.5)
    if (r === 'cimitarra' && rol === 'atk' && data.config.reglasCasa?.cimitarraExtraAlAtacar) f += data.config.armas?.cimitarra?.extraAtacante ?? 2;
  }
  if (rol === 'def' && tieneObj(j, 'OB04')) f += 1;   // el escudo le resta 1 al atacante, siempre (Jorge, 28 nov, 10:16)
  return f;
}
// Rechazar un duelo exige pagar completo: 20 dinares (o lo que pida Nur al Din); sin eso solo queda aceptar.
export const puedePagarRechazo = (data, d, pedirNur) => (pedirNur ? d.dinares >= pedirNur.dinares && d.noches >= pedirNur.noches : d.dinares >= data.config.duelo.rechazo);
export function yafarNPCRechaza(data, e, yafar, retador) {
  const Y = e.jugadores[yafar];
  if (!Y?.npc || (e.opciones?.dificultad || 'normal') !== 'dificil' || !puedePagarRechazo(data, Y, null)) return false;
  return !!Y.herido || fuerzaVisible(data, e, retador, 'atk') > fuerzaVisible(data, e, yafar, 'def');
}
// Qué se gana y qué se pierde en cada pelea, para que quien la recibe lo vea claro antes de decidir. Jorge (28 de noviembre): todas
// las peleas se pelean igual; solo cambian las consecuencias, seas atacante o defensor.
function enJuego(data, e, tipo, A, D, pedirNur) {
  const mitad = (x) => Math.max(0, Math.floor(x.dinares / 2)), n = data.config.duelo.nochesPerdedor;
  const esc = nEsclavos(D, 'esclavoPelea') ? ' Tu esclavo de pelea pelea en tu lugar: si pierde, muere él, no tú (ni quedas herido), pero pagas lo demás.' : '';
  if (tipo === 'duelo') {
    const rechazo = pedirNur ? `${pedirNur.dinares} dinares y ${pedirNur.noches} noches` : `${data.config.duelo.rechazo} dinares`;
    return `Si ganas recibes ${mitad(A)} dinares y ${Math.min(n, A.noches)} noches de ${A.nombre}; si pierdes entregas ${mitad(D)} dinares y ${Math.min(n, D.noches)} noches. Nadie queda herido; si empatan, nadie gana. Rechazar cuesta ${rechazo}.${esc} `;
  }
  if (tipo === 'robo') return `Si pierdes, ${A.nombre} se lleva tus ${Math.max(0, D.dinares)} dinares y tus cartas y quedas ${D.herido ? 'muerto (ya estabas herido)' : 'herido'}; si ganas tú, te quedas con sus ${Math.max(0, A.dinares)} dinares y sus cartas y queda ${A.herido ? 'muerto' : 'herido'} él. Si empatan, ganas tú.${esc} `;
  return `Quien pierda por ${GOLPE_DE_GRACIA} o más muere y el otro se queda con todo lo suyo; por menos, queda mal herido. Si empatan, los dos quedan heridos. Quien ya estaba herido antes de la pelea y pierde o empata, muere${D.herido ? ' (tú estás herido)' : A.herido ? ` (${A.nombre} está herido)` : ''}.${esc} `;
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
      d.ciudad = destino; huidaCuentaViaje(e, P.def);   // la huida cuenta como viaje de su siguiente turno (Jorge, 21 de noviembre)
      return terminarPelea(data, e, { cancelada: true });
    }
  }
  if (o === 'rechazar' && P.tipo === 'duelo' && puedePagarRechazo(data, d, P.pedirNur)) {
    if (P.pedirNur) { const p = pagarNur(data, e, P.def, P.atk, P.pedirNur); log(e, `${d.nombre} rechaza el duelo y paga ${p}.`, { pid: P.def }); }
    else {
      const r = data.config.duelo.rechazo; d.dinares -= r; j.dinares += r; log(e, `${d.nombre} rechaza el duelo y paga ${r} dinares a ${j.nombre}.`, { pid: P.def });
      if (d.npc && !j.npc) info(e, P.atk, 'Duelo rechazado', `${d.nombre} rechaza el duelo y te paga ${r} dinares.`);
    }
    if (!j.npc) devolverPrincipal(e, P.atk, `${d.nombre} rechazó el duelo`);
    else if ((e.opciones?.dificultad || 'normal') !== 'facil' && e.turno?.pid === P.atk) {
      // Jorge (19 de noviembre): en normal y difícil, a Yafar NPC no le gasta la acción; hace otra, pero no vuelve a retar a quien rechazó.
      const t = e.turno; t.principal = false; (t.rechazaronNPC ||= []).push(P.def); t.otraAccionNPC = true;
      log(e, `${j.nombre} no gasta su acción principal: ${d.nombre} rechazó el duelo.`, { pid: P.atk });
    }
    return terminarPelea(data, e, { cancelada: true });
  }
  if (o === 'polvo') d.extra.usaPolvo = false;
  P.polvo = o === 'polvo';
  return pasoAyuda(data, e);
}
function pagarNur(data, e, de, a, pide) {
  const J = e.jugadores[de], N = e.jugadores[a];
  const din = Math.max(0, Math.min(pide.dinares, J.dinares)), noc = Math.min(pide.noches, J.noches);
  J.dinares -= din; J.noches -= noc; N.dinares += din; N.noches += noc;
  return `${din} dinares y ${noc} noches`;
}
export function vecinaBarata(data, ciudad) {
  const opts = Object.entries(data.rutas.tarifas).filter(([k]) => k.startsWith(ciudad + '>')).sort((a, b) => a[1] - b[1]);
  return opts.length ? opts[0][0].split('>')[1] : 'Bagdad';
}

// ---------------------------------------------------------------- la pelea (Jorge, 28 de noviembre: 11.2 y 11.4)
// «Todas las peleas (sean robo, duelo o ataque a muerte) funcionan de la MISMA FORMA; la única diferencia son las consecuencias.»
// La categoría la pone lo que tenga quien se defiende (A, B, C o D). Los dados se tiran por categoría, uno por uno, nunca todos juntos:
// cada ventana dice antes por qué se tira y después qué pasó. Ya nadie presta armas ni pelea por otro (se quitó la ayuda).
// Orden: 1) las flechas (solo al principio, quien tenga arco y flechas); 2) el dado de categoría si hace falta (C o B); 3) los dados
// de la pelea. Empate: gana quien se defiende; en un duelo nadie gana (el agresor ya gastó su acción) y en un ataque a muerte los dos
// quedan heridos (Jorge, 28 de noviembre, 08:55).
const TITULO_PELEA = { robo: 'Asalto', matar: 'Ataque a muerte', duelo: 'Duelo' };
const QUE_SE_JUEGA = {
  robo: 'quien pierda entrega todo lo que lleva y queda herido (si ya lo estaba, muere); si empatan, gana quien se defiende',
  duelo: 'quien pierda entrega la mitad de sus dinares y 30 noches; si empatan, nadie gana',
  matar: 'quien pierda por 3 o más muere y el otro se queda con todo; por menos, queda mal herido; si empatan, los dos quedan heridos; quien ya estaba herido y pierde o empata, muere',
};
export const GOLPE_DE_GRACIA = 3;
function pasoAyuda(data, e) { return pasoCategoria(data, e); }
registrar('pelea.ayuda', (data, e) => { if (e.pelea) pasoCategoria(data, e); });   // partidas guardadas a media pregunta de ayuda
// El esclavo de pelea (11.3) pelea como tú, pero ya viene con destreza en alfanje: solo puede llevar alfanje (el de su amo) o nada.
// Con alfanje pelea con armas y destreza (D); sin él, con destreza y sin armas (B). Pelea uno solo, por más esclavos que tengas.
export function perfilPelea(data, e, P, pid) {
  if (!P?.conEsclavo?.[pid]) return perfil(data, e, pid, P?.ciudad);
  const alf = armasUsables(data, e, e.jugadores[pid], P.ciudad).includes('alfanje');
  return { pid, armas: alf ? ['alfanje'] : [], destreza: true, general: false, cat: alf ? 'D' : 'B', esclavo: true };
}
// Escudo de cuero (Jorge, 28 de noviembre: «borra todo sobre escudo»): 1) siempre para las flechas, pero aguanta 3 y al tercero se
// destruye y vuelve al Bazar; 2) al atacante le resta 1, siempre (Jorge, 28 nov, 10:16: «resta 1 al atacante siempre en todo caso y ya»). Si por el defensor
// pelea su esclavo, el esclavo lleva el escudo (−1, como siempre: Jorge, 28 nov, 10:16).
export function penaEscudo(data, e, P) {
  if (!tieneObj(e.jugadores[P.def], 'OB04')) return 0;
  return 1;   // Jorge (28 nov, 10:16): «resta 1 al atacante siempre en todo caso y ya»
}
// Dado de destreza por arma (Jorge, 28 de noviembre, 10:00: «el dado de destreza es por arma: tiras un dado de destreza por cimitarra,
// por alfanje y por jambiya si es que no tienes destreza en ellos»; eligió «Par: esa arma cuenta»). Cada arma sin destreza tira su
// dado: par, esa arma cuenta en la pelea; impar, no le sirve en esta pelea (no la pierde). Vale para quien se defiende sin destreza
// (antes era un solo dado: par = D, impar = A) y, en una pelea D, para los dos bandos. La destreza general (R25, o la jambiya de Zein
// y Ruyán) cubre todas las armas; un arma entrenada tiene destreza; el esclavo de pelea ya trae destreza en alfanje.
export function armasSinDestreza(data, e, P, pid) {
  if (!pid || P?.conEsclavo?.[pid]) return [];
  const j = e.jugadores[pid], todas = armasUsables(data, e, j, P?.ciudad || j.ciudad);
  if (destrezaCon(j, todas)) return [];
  return todas.filter((r) => BONO_MELEE[r] && !j.extra?.entrenado?.[r]);
}
const NOMBRE_ARMA = { alfanje: 'alfanje', cimitarra: 'cimitarra', jambiya: 'jambiya' };
const listaY = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
// Tira los dados de destreza por arma de pid, los muestra y guarda en P.armasFuera[pid] las que salieron impares. Devuelve las que cuentan.
function dadosPorArma(data, e, P, pid, md, resumenAntes = [], conCategoria = false) {
  const sin = armasSinDestreza(data, e, P, pid); if (!sin.length) return null;
  const n = pid === P.def || pid === P.atk ? nPel(e, P, pid) : nombre(e, pid);
  const xs = sin.map(() => dado(e)), cuentan = sin.filter((r, i) => par(xs[i])), fuera = sin.filter((r, i) => !par(xs[i]));
  (P.armasFuera ||= {})[pid] = fuera;
  const una = sin.length === 1;
  md({ por: pid, npc: esNPC(e, pid), motivo: 'categoria', grupos: [{ etq: `${n} no tiene destreza en ${una ? 'su' : 'sus armas:'} ${listaY(sin.map((r) => NOMBRE_ARMA[r]))}: tira un dado de destreza por ${una ? 'ella' : 'cada una'}. Par, esa arma cuenta en la pelea; impar, no le sirve en esta pelea`, valores: xs }],
    resumen: [...resumenAntes, ...sin.map((r, i) => `${NOMBRE_ARMA[r][0].toUpperCase()}${NOMBRE_ARMA[r].slice(1)}: sale ${xs[i]} (${par(xs[i]) ? 'par): cuenta' : 'impar): con los nervios no acierta a usarla; no la pierde'}.`),
      ...(conCategoria ? [cuentan.length ? `${n} pelea con ${listaY(cuentan.map((r) => NOMBRE_ARMA[r]))} y destreza (D).` : `${n} no acierta a usar ninguna de sus armas y pelea sin armas ni destreza (A).`] : [])] });
  return cuentan;
}
// Flechas, al principio de cualquier pelea (Jorge, 28 de noviembre: «el arco solo cuenta al principio, cuando se dispara, si hay
// flechas»). Dispara quien pelea en persona (el esclavo no lleva arco). Lo que hace la flecha se guarda en P.mods.
function pasoFlechas(data, e, P) {
  P.mods = { [P.atk]: {}, [P.def]: {} };
  for (const [t, b] of [[P.atk, P.def], [P.def, P.atk]]) {
    if (P.conEsclavo?.[t]) continue;
    avisoSinFlechas(data, e, t, P.ciudad);
    if (conArco(data, e, t, P.ciudad)) Object.assign(P.mods[b], disparo(data, e, t, b, P.titulo));
  }
}
function pasoCategoria(data, e) {
  const P = e.pelea; if (!P) return ok();
  marcarEsclavos(data, e, P);
  const def = P.def, nD = nPel(e, P, def);
  P.titulo = `${TITULO_PELEA[P.tipo] || 'Pelea'}: ${nombre(e, P.atk)} contra ${nombre(e, def)}`;
  P.foto = fotoPelea(e, P);
  pasoFlechas(data, e, P);
  const pd = perfilPelea(data, e, P, def);
  let cat = pd.cat;
  P.inicio = [`La categoría de la pelea la pone quien se defiende; ${QUE_SE_JUEGA[P.tipo]}.`];
  const mdP = (o) => mostrarDados(e, { titulo: P.titulo, ...o });
  if (cat === 'C') {                                                          // con armas sin destreza: un dado por arma (par cuenta); si ninguna cuenta, A
    const cuentan = dadosPorArma(data, e, P, def, mdP, P.inicio, true) || [];
    cat = cuentan.length ? 'D' : 'A';
    P.inicio = [];
  } else if (cat === 'D') (P.armasFuera ||= {});
  if (cat === 'D') {                                                          // en D, también el agresor (y quien se defiende, si no tiró ya) tira por cada arma sin destreza
    for (const pid of [def, P.atk]) if (!P.armasFuera?.[pid]) { const c = dadosPorArma(data, e, P, pid, mdP, P.inicio); if (c) P.inicio = []; }
  }
  if (cat === 'B') {                                                          // sin armas, con destreza: par = +1 al agresor, impar = +2
    const x = dado(e); P.ventajaB = par(x) ? 1 : 2;
    mostrarDados(e, { por: def, npc: esNPC(e, def), motivo: 'categoria', titulo: P.titulo, grupos: [{ etq: `${nD} tiene destreza pero ningún arma: tira un dado. Par, toma piedras y vidrios y el agresor suma 1 punto de ventaja; impar, el agresor suma 2`, valores: [x] }],
      resumen: [...P.inicio, `Sale ${x} (${par(x) ? 'par' : 'impar'}): ${par(x) ? `${nD} toma piedras y vidrios; ` : ''}${nPel(e, P, P.atk)} sumará ${P.ventajaB} punto${P.ventajaB > 1 ? 's' : ''} de ventaja. Ahora cada uno tira su dado.`] });
    P.inicio = [];
  }
  P.cat = cat;
  if (cat === 'A') {
    if (!esNPC(e, def)) {
      pedir(e, { tipo: 'numeros', para: [def], titulo: 'Di tu número', texto: 'No tienes armas ni destreza: tomas piedras, vidrios y palos del suelo. Elige un número del 1 al 6 y luego tira un dado: si sale tu número, ganas la pelea; si no, la gana tu rival. En un ataque a muerte, el golpe de gracia es que el dado caiga a 3 o más de tu número.',
        modo: 'multi', min: 1, max: 1, opciones: [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), texto: String(n) })), porDefecto: ['3'], cont: { fn: 'pelea.numeros', args: {} } });
      return ok();
    }
    return resolverA(data, e, 3);   // Yafar NPC dice siempre el 3
  }
  return cat === 'B' ? resolverB(data, e) : resolverD(data, e);
}
registrar('pelea.numeros', (data, e, args, resp) => resolverA(data, e, Number((resp.valores || [])[0]) || 3));

// Quién gana con dos totales. Empate: gana quien se defiende, salvo en el duelo (nadie gana) y en el ataque a muerte (los dos heridos).
function resultado(P, tA, tB) {
  if (tA !== tB) return { ganaAtk: tA > tB, empate: false, margen: Math.abs(tA - tB) };
  if (P.tipo === 'robo') return { ganaAtk: false, empate: false, margen: 0, empateDefensor: true };
  return { ganaAtk: false, empate: true, margen: 0 };
}
const perdedorDe = (P, r) => (r.empate ? null : r.ganaAtk ? P.def : P.atk);
function textoGana(e, P, r, tA, tB) {
  const nA = nPel(e, P, P.atk), nD = nPel(e, P, P.def);
  if (r.empate) return `Empate a ${tA}: ${P.tipo === 'duelo' ? 'nadie gana el duelo' : 'los dos quedan heridos'}.`;
  if (r.empateDefensor) return `Empate a ${tA}: en un empate gana quien se defiende, ${nD}.`;
  return `Gana ${r.ganaAtk ? nA : nD}, ${Math.max(tA, tB)} a ${Math.min(tA, tB)}.`;
}

// Categoría A (sin armas ni destreza): quien se defiende dice un número y tira un dado; si sale, gana la pelea; si no, gana el agresor.
// En un ataque a muerte, quien pierda muere (también el agresor), sin golpe de gracia.
function resolverA(data, e, numero) {
  const P = e.pelea; if (!P) return ok();
  const atk = P.atk, def = P.def, nA = nPel(e, P, atk), nD = nPel(e, P, def);
  // Golpe de gracia en A (Jorge, 09:20: «sí aplica también a esas víctimas»): la diferencia entre el dado y el número dicho; si cae el número, 0.
  const x = dado(e), ganaDef = x === numero, r = { ganaAtk: !ganaDef, empate: false, margen: Math.abs(x - numero) };
  const pre = [...(P.inicio || [])];
  if (P.mods?.[atk]?.flecha || P.mods?.[def]?.flecha) pre.push('En una pelea sin armas ni destreza (A) la flecha ya no cambia nada: solo cuenta el número.');
  mostrarDados(e, { por: def, npc: esNPC(e, def), motivo: 'pelea', titulo: P.titulo, grupos: [{ etq: `${nD} no tiene armas ni destreza: toma piedras y palos, dijo el ${numero} y tira un dado. Si sale el ${numero}, gana la pelea; si no, gana ${nA}`, valores: [x] }],
    resumen: [...pre, `${nD} dijo ${numero} y sale ${x}: ${ganaDef ? `¡cae su número! Gana ${nD}.` : `no cae su número. Gana ${nA}.`}`, textoConsecuencia(e, P, r)] });
  return aplicar(data, e, r);
}

// Lo que pierde cada uno en B y D por la flecha y por el escudo del rival (los únicos ajustes fuera de las armas).
function ajustesBando(data, e, P, pid) {
  const partes = []; let total = 0;
  const m = P.mods?.[pid] || {};
  if (m.flecha) { partes.push(`flecha −${m.flecha}`); total -= m.flecha; }
  if (pid === P.atk) { const pe = penaEscudo(data, e, P); if (pe) { partes.push(`escudo de ${nPel(e, P, P.def)} −${pe}`); total -= pe; } }
  return { partes, total };
}

// Categoría B (sin armas, con destreza): ya se tiró el dado de categoría (ventaja de 1 o 2 para el agresor); ahora cada uno tira su dado,
// primero el agresor y luego quien se defiende. Aquí no cuentan armas ni bonos; solo la flecha y el escudo.
function resolverB(data, e) {
  const P = e.pelea; if (!P) return ok();
  const atk = P.atk, def = P.def, nA = nPel(e, P, atk), nD = nPel(e, P, def), v = P.ventajaB || 1;
  const aA = ajustesBando(data, e, P, atk), aD = ajustesBando(data, e, P, def);
  const tirar = () => { const dA = dado(e), dB = dado(e), tA = dA + v + aA.total, tB = dB + aD.total; return { dA, dB, tA, tB, r: resultado(P, tA, tB) }; };
  const rondas = [tirar()];
  const pierde = perdedorDe(P, rondas[0].r);
  if (pierde && zeinRepite(e, pierde)) rondas.push({ ...tirar(), previa: `${nombre(e, pierde)} usa «Dados del Cairo» y repite la pelea.` });
  else if (pierde && dadoIbnArabi(e, pierde)) rondas.push({ ...tirar(), previa: `${nombre(e, pierde)} usa el Dado de Ibn Arabi y repite la pelea.` });
  const fin = rondas[rondas.length - 1];
  rondas.forEach((x, k) => {
    const ultimo = k === rondas.length - 1;
    const det = (d, ex, a) => [`dado ${d}`, ...(ex ? [`ventaja del agresor +${ex}`] : []), ...a.partes].join(' · ');
    mostrarDados(e, { por: atk, npc: esNPC(e, atk), motivo: 'pelea', titulo: P.titulo, grupos: [{ etq: `${nA} tira su dado y suma ${v} de ventaja por ser el agresor${aA.partes.length ? ` (${aA.partes.join(', ')})` : ''}`, valores: [x.dA] }], resumen: [...(x.previa ? [x.previa] : []), `${nA}: ${det(x.dA, v, aA)} → ${x.tA}.`] });
    const res = [`${nD}: ${det(x.dB, 0, aD)} → ${x.tB}.`, textoGana(e, P, x.r, x.tA, x.tB)];
    if (ultimo) res.push(textoConsecuencia(e, P, x.r));
    mostrarDados(e, { por: def, npc: esNPC(e, def), motivo: 'pelea', titulo: P.titulo, grupos: [{ etq: `${nD} tira su dado: ${nA} lleva ${x.tA}; si empatan, ${P.tipo === 'robo' ? `gana ${nD}` : P.tipo === 'duelo' ? 'nadie gana' : 'los dos quedan heridos'}`, valores: [x.dB] }], resumen: res });
  });
  return aplicar(data, e, fin.r);
}

// Categoría D (armas y destreza, o C con par): dos tiradas. 1) Cada uno tira un dado de ventaja: quien saque más suma +1; si empatan,
// la ventaja es de quien se defiende. 2) Cada uno tira 2 dados y suma sus armas (todas, hasta +4), su destreza (+1) y demás bonos,
// menos la flecha y el escudo del rival.
function resolverD(data, e) {
  const P = e.pelea; if (!P) return ok();
  const atk = P.atk, def = P.def, titulo = P.titulo;
  const bA = bonosCombate(data, e, atk, 'atk', P.ciudad, P.mods?.[atk], P), bD = bonosCombate(data, e, def, 'def', P.ciudad, P.mods?.[def], P);
  const pe = penaEscudo(data, e, P); if (pe) { bA.partes.push(`escudo de ${nPel(e, P, def)} −${pe}`); bA.total -= pe; }
  const inicio = [...(P.inicio || []), 'Pelea con armas y destreza (D): primero cada uno tira un dado de ventaja (quien saque más suma +1; si empatan, es de quien se defiende); luego cada uno tira 2 dados y suma sus armas (las que cuentan, hasta +4), su destreza (+1) y demás bonos.'];
  if (P.polvo) { bD.resta = 2; const dj = e.jugadores[def]; quitarPrimero(dj, 'objeto', 'OB03'); devolverObjeto(data, e, 'OB03'); inicio.push(`${nombre(e, def)} usa Polvo de pimienta: ${nombre(e, atk)} resta 2.`); }
  const tirar = () => { const x = luchaD(data, e, atk, def, bA, bD); x.r = resultado(P, x.tA, x.tB); return x; };
  const rondas = [tirar()];
  const pierde = perdedorDe(P, rondas[0].r);                                // quien iba a perder puede repetir (Dados del Cairo o Dado de Ibn Arabi)
  if (pierde && zeinRepite(e, pierde)) rondas.push({ ...tirar(), previa: `${nombre(e, pierde)} usa «Dados del Cairo» y repite la pelea.` });
  else if (pierde && dadoIbnArabi(e, pierde)) rondas.push({ ...tirar(), previa: `${nombre(e, pierde)} usa el Dado de Ibn Arabi y repite la pelea.` });
  const fin = rondas[rondas.length - 1];
  mostrarPelea(data, e, { atk, def, bA, bD, rondas, inicio, titulo, final: (x) => [textoGana(e, P, x.r, x.tA, x.tB)], cierre: [textoConsecuencia(e, P, fin.r)] });
  return aplicar(data, e, fin.r);
}

// ---------------------------------------------------------------- bonos de la categoría D (regla de la casa, sistema de 2 dados)
// Cada bando lanza 2 dados con su botón y suma: armas de cuerpo a cuerpo sumadas (alfanje +1, cimitarra +2, jambiya +1; entrenada +1;
// tope +4), destreza +1, herido −1 y los objetos de combate. El arco no suma en el choque: antes se dispara una flecha (5–6 el rival
// queda tocado: −1 y pierde su destreza; 3–4 con el arco entrenado, −1; 1–2 falla; un escudo la para).
export const BONO_MELEE = { alfanje: 1, cimitarra: 2, jambiya: 1 }, TOPE_ARMAS = 4;
export const conArco = (data, e, pid, ciudad) => armasUsables(data, e, e.jugadores[pid], ciudad).includes('arco');
export function bonosCombate(data, e, pid, rol, ciudad, mods = {}, P = null) {
  mods = mods || {};
  const j = e.jugadores[pid];
  if (P?.conEsclavo?.[pid]) {                                                  // pelea su esclavo: solo su alfanje (con destreza) o nada
    const pf = perfilPelea(data, e, P, pid), partes = []; let total = 0;
    if (pf.armas.length) { partes.push('alfanje +2 (el esclavo trae destreza en alfanje)'); total += 2; }
    if (mods.flecha) { partes.push(`flecha −${mods.flecha}`); total -= mods.flecha; }
    return { total, resta: 0, partes };
  }
  const fuera = P?.armasFuera?.[pid] || [];                                    // armas que sacaron impar en su dado de destreza
  const armas = armasUsables(data, e, j, ciudad).filter((r) => BONO_MELEE[r] && !fuera.includes(r));
  const partes = []; let total = 0, resta = 0;
  if (fuera.length) partes.push(`sin ${listaY(fuera)} (impar en su dado de destreza)`);
  const ent = (r) => (j.extra?.entrenado?.[r] ? 1 : 0);                        // entrenado con esa arma: +1 (regla de la casa)
  const sumaArmas = armas.reduce((n, r) => n + BONO_MELEE[r] + ent(r), 0), deArmas = Math.min(TOPE_ARMAS, sumaArmas);
  if (armas.length) { partes.push(armas.map((r) => `${r} +${BONO_MELEE[r] + ent(r)}${ent(r) ? ' (entrenado)' : ''}`).join(' · ') + (sumaArmas > TOPE_ARMAS ? ` (tope de armas +${TOPE_ARMAS})` : '')); total += deArmas; }
  const dz = destrezaCon(j, armasUsables(data, e, j, ciudad));   // Zein y Ruyán: solo con la jambiya
  if (dz && !mods.sinDestreza) { partes.push('destreza +1'); total += 1; }
  if (dz && mods.sinDestreza) partes.push('destreza perdida por la flecha');
  if (j.herido) { partes.push('herido −1'); total -= 1; }
  if (mods.flecha) { partes.push(`flecha −${mods.flecha}`); total -= mods.flecha; }
  if (tieneEsp(j, 'K1')) { partes.push('Ejército de Kanmakán +2'); total += 2; usarKanmakan(e, j); }
  if (j.ventajaCombate > 0) { total += 4; j.ventajaCombate--; partes.push('deseo de ifrit +4'); }   // deseo e: +4 en la próxima pelea (Jorge, 21 de noviembre)
  // Daga de manga: se gasta y se esfuma al usarla en cualquier pelea (Jorge, 27 de noviembre, decisión D03; antes no se gastaba en robos ni ataques a muerte).
  if (tieneObj(j, 'OB01')) { partes.push('Daga de manga +1 (se gasta)'); total += 1; consumir(data, e, pid, 'OB01'); }
  return { total, resta, partes };
}
export const textoFlecha = (en) => `con ${en ? '4, 5 o 6 (tienes destreza en el arco)' : '5 o 6'} le da y pelea con −${ARCO_MENOS}; si no, falla; si lleva escudo, el escudo la para`;
// El escudo para las flechas: aguanta 3; al tercero se destruye al terminar la pelea y vuelve al Bazar (Jorge, 28 de noviembre).
export const ESCUDO_FLECHAZOS = 3;
export const flechazosEscudo = (c) => Math.max(0, ESCUDO_FLECHAZOS - (c?.extra?.flechazos || 0));   // los que aguanta todavía
function flechazoAlEscudo(data, e, B) {
  const c = B.mano.find((x) => x.tipo === 'objeto' && x.ref === 'OB04'); if (!c) return '';
  c.extra = { ...(c.extra || {}), flechazos: (c.extra?.flechazos || 0) + 1 };
  log(e, `El escudo de ${B.nombre} para un flechazo (${c.extra.flechazos} de ${ESCUDO_FLECHAZOS}).`, { pid: B.id, aviso: true });
  if (flechazosEscudo(c) > 0) return ` Al escudo le quedan ${flechazosEscudo(c)} flechazo${flechazosEscudo(c) === 1 ? '' : 's'}.`;
  if (e.pelea) (e.pelea.escudosRotos ||= []).push({ pid: B.id, uid: c.uid }); else romperEscudo(data, e, B.id, c.uid);
  return ' Era su tercer flechazo: el escudo se destruye al terminar la pelea y vuelve al Bazar.';
}
function romperEscudo(data, e, pid, u) {
  const B = e.jugadores[pid]; if (!B || !B.mano.some((x) => x.uid === u)) return;
  B.mano = B.mano.filter((x) => x.uid !== u); devolverObjeto(data, e, 'OB04');
  log(e, `El escudo de ${B.nombre} se destruyó y vuelve al Bazar.`, { pid, aviso: true });
}
// Disparo a distancia (antes del choque): devuelve los efectos sobre el blanco; se muestra con su dado y botón.
function disparo(data, e, tirador, blanco, titulo) {
  const T = e.jugadores[tirador], B = e.jugadores[blanco];
  quitarPrimero(T, 'item', 'flechas'); avisoUltimaFlecha(e, tirador);
  if (T.extra?.arcoMaximo) {   // R51 Campeón de Murcia: siempre acierta, el rival pelea con −2, sin dado (un escudo la sigue parando)
    const escudo = !!tieneObj(B, 'OB04');
    log(e, escudo ? `${T.nombre}, Campeón de Murcia, dispara, pero la flecha se clava en el escudo de ${B.nombre}.${flechazoAlEscudo(data, e, B)}` : `${T.nombre}, Campeón de Murcia, dispara sin fallar: la flecha acierta y ${B.nombre} pelea con −${ARCO_MENOS}.`, { pid: tirador });
    return escudo ? {} : { flecha: ARCO_MENOS };
  }
  const x = dado(e), escudo = !!tieneObj(B, 'OB04'), en = !!T.extra?.entrenado?.arco, le = x >= umbralArco(T);
  const efecto = escudo || !le ? {} : { flecha: ARCO_MENOS };
  const texto = escudo ? `La flecha se clava en el escudo de ${B.nombre}: no le hace nada.${flechazoAlEscudo(data, e, B)}` : le ? `¡Le da! ${B.nombre} pelea con −${ARCO_MENOS} en su conteo final.` : 'La flecha falla.';
  mostrarDados(e, { por: tirador, npc: esNPC(e, tirador), motivo: 'pelea', titulo, boton: 'Disparar flecha', grupos: [{ etq: `${T.nombre} dispara una flecha a ${B.nombre}: ${textoFlecha(en)}${escudo ? ` (su escudo lleva ${ESCUDO_FLECHAZOS - flechazosEscudo(B.mano.find((q) => q.tipo === 'objeto' && q.ref === 'OB04'))} de ${ESCUDO_FLECHAZOS} flechazos)` : ''}`, valores: [x] }], resumen: [texto] });
  return efecto;
}
// ---------------------------------------------------------------- consecuencias (Jorge, 28 de noviembre), seas atacante o defensor
// Duelo: quien pierde entrega la mitad de sus dinares y 30 noches (nadie queda herido); empate, nadie gana.
// Robo: quien pierde entrega todo lo que lleva (menos la jambiya escondida, el papel amate de su escondite y las cartas de sheij) y queda
// herido; si ya estaba herido, muere. Empate: gana quien se defiende.
// Ataque a muerte: golpe de gracia. Si se gana por 3 o más, quien pierde muere y entrega todo; si no, queda MAL HERIDO (pierde su acción
// principal en su siguiente turno y queda herido el turno que sigue). En la categoría A no hay golpe de gracia: quien pierde muere.
// Empate: los dos quedan heridos.
// Si por quien pierde peleaba su esclavo de pelea, muere el esclavo; el amo no muere ni queda herido, pero paga lo demás.
const marcarEsclavos = (data, e, P) => { P.conEsclavo = Object.fromEntries([P.atk, P.def].filter(Boolean).map((x) => [x, nEsclavos(e.jugadores[x], 'esclavoPelea') > 0])); };
const mata = (P, r) => r.margen >= GOLPE_DE_GRACIA;   // también en la categoría A (Jorge, 09:20)
function textoConsecuencia(e, P, r) {
  if (r.empate) {
    if (P.tipo === 'duelo') return `Nadie gana el duelo: no se paga nada y ${nombre(e, P.atk)} ya gastó su acción principal.`;
    const yo = [P.atk, P.def].filter((x) => !P.conEsclavo?.[x]);
    if (!yo.length) return 'Los dos esclavos salen con vida; nadie más queda herido.';
    const her = yo.filter((x) => !e.jugadores[x]?.herido).map((x) => nombre(e, x)), mue = yo.filter((x) => e.jugadores[x]?.herido).map((x) => nombre(e, x));
    const t = [her.length && `${her.join(' y ')} ${her.length > 1 ? 'quedan heridos' : 'queda herido'}`, mue.length && `${mue.join(' y ')}, que ya ${mue.length > 1 ? 'estaban heridos, mueren' : 'estaba herido, muere'}`].filter(Boolean).join('; ');
    return `${t}${yo.length < 2 ? ' (el esclavo que peleaba por el otro sale con vida)' : ''}.`;
  }
  const G = r.ganaAtk ? P.atk : P.def, L = r.ganaAtk ? P.def : P.atk, nG = nombre(e, G), nL = nombre(e, L), Lj = e.jugadores[L];
  const esc = P.conEsclavo?.[L];
  const pre = esc ? `Muere el esclavo de pelea de ${nL}, que peleaba en su lugar; ${nL} sigue con vida y sin herida, pero ` : `${nL} `;
  if (P.tipo === 'duelo') return `${pre}entrega a ${nG} la mitad de sus dinares y ${P.nur && e.jugadores[G]?.pj === '1' ? 'todas sus noches' : '30 noches'}.`;
  if (P.tipo === 'robo') return `${pre}entrega a ${nG} todo lo que lleva${esc ? '' : Lj?.herido ? ' y, como ya estaba herido, muere' : ' y queda herido'}.`;
  if (!mata(P, r) && !esc && Lj?.herido) return `${nG} gana sin golpe de gracia, pero ${nL} ya estaba herido: muere y ${nG} se queda con todo lo suyo.`;
  const pocos = P.cat === 'A' ? (r.margen ? `el dado cayó a ${r.margen} del número` : 'cayó el número') : `ganó por ${r.margen}`;
  if (!mata(P, r)) return esc ? `Muere el esclavo de pelea de ${nL}, que peleaba en su lugar; ${nL} no pierde nada más (${pocos}: sin golpe de gracia).` : `${nG} gana (${pocos}): no basta para el golpe de gracia (hacen falta ${GOLPE_DE_GRACIA}). ${nL} queda MAL HERIDO: pierde su acción principal en su siguiente turno y queda herido el turno que sigue.`;
  const porque = P.cat === 'A' ? ` (golpe de gracia: el dado cayó a ${r.margen} del número)` : ` (golpe de gracia: ganó por ${r.margen})`;
  return esc ? `${pre}entrega a ${nG} todo lo que tiene${porque}.` : `${nL} muere y ${nG} se queda con todo lo suyo${porque}.`;
}
function muereEsclavo(data, e, pid, por) {
  const j = e.jugadores[pid]; if (!j || !quitarPrimero(j, 'item', 'esclavoPelea')) return;
  log(e, `Muere el esclavo de pelea de ${j.nombre} a manos de ${nombre(e, por)}: peleaba en su lugar.`, { pid, aviso: true });
  alertaRoja(e, pid, 'Tu esclavo de pelea perdió y murió en tu lugar. Tú sigues con vida y sin herida, pero pagas lo que se perdía en esa pelea.');
}
function buscadoPor(data, e, A, D, tipo, mascara) {
  if (mascara && tieneObj(A, 'OB45')) { quitarPrimero(A, 'objeto', 'OB45'); devolverObjeto(data, e, 'OB45'); log(e, `${A.nombre} usa la Máscara del zoco: nadie sabe quién fue; no queda Buscado.`, { pid: A.id }); return; }
  marcarBuscado(data, e, A, { tipo, victima: D.nombre });
  log(e, `${A.nombre} queda Buscado durante ${data.config.buscadoRondas} rondas: quien lo mate gana ${data.config.recompensaBuscadoDinares ?? 100} dinares y ${data.config.recompensaBuscado} noches.`, { pid: A.id, aviso: true });
}
function herir(e, pid, mal = false) {
  const j = e.jugadores[pid]; if (!j || j.eliminado) return;
  j.herido = true; if (mal) j.malHerido = true;
}
function aplicar(data, e, r) {
  const P = e.pelea, A = e.jugadores[P.atk], D = e.jugadores[P.def];
  if (r.empate) {
    if (P.tipo === 'duelo') log(e, `${A.nombre} y ${D.nombre} empatan el duelo: nadie gana ni paga nada.`, { pid: P.atk, aviso: true });
    else {
      log(e, `${A.nombre} y ${D.nombre} empatan el ataque a muerte: ${textoConsecuencia(e, P, r)}`, { pid: P.atk, aviso: true });
      // Jorge (28 de noviembre, 09:05): si ya estabas herido antes de esta pelea, mueres
      const ya = Object.fromEntries([P.atk, P.def].map((x) => [x, !!e.jugadores[x]?.herido]));
      for (const x of [P.atk, P.def]) if (!P.conEsclavo?.[x]) {
        const otro = x === P.atk ? P.def : P.atk;
        if (ya[x]) eliminar(data, e, x, { por: otro, causa: 'murió herido en un ataque a muerte contra ' + nombre(e, otro) }); else herir(e, x);
      }
    }
    return terminarPelea(data, e, { empate: true });
  }
  const ganaAtk = r.ganaAtk;
  const G = ganaAtk ? P.atk : P.def, L = ganaAtk ? P.def : P.atk, Lj = e.jugadores[L];
  const esclavo = !!P.conEsclavo?.[L];
  // la Máscara del zoco tiene que ser del atacante desde antes, no la que acaba de quitarle a su víctima
  const mascara = ganaAtk && P.tipo !== 'duelo' ? tieneObj(A, 'OB45') : null;
  if (esclavo) muereEsclavo(data, e, L, G);
  if (P.tipo === 'robo') {
    const yaHerido = !!Lj.herido;
    robar(data, e, G, L, { ladron: ganaAtk });
    if (ganaAtk) { if (!P.buscadoBagdad) buscadoPor(data, e, A, D, 'robo', mascara); }   // Jorge (12 de noviembre): quien roba con éxito queda Buscado
    else log(e, `${A.nombre} perdió su asalto: ${D.nombre} se queda con todo lo que llevaba.`, { pid: P.def, aviso: true });
    if (!esclavo) {
      if (yaHerido) eliminar(data, e, L, { por: G, causa: ganaAtk ? 'murió herido en el asalto de ' + A.nombre : 'murió herido asaltando a ' + D.nombre });
      else { herir(e, L); log(e, `${Lj.nombre} perdió el asalto y queda herido.`, { pid: L, aviso: true }); }
    }
  } else if (P.tipo === 'matar') {
    const muere = mata(P, r) || (!esclavo && !!Lj.herido);   // Jorge (09:05): si ya estabas herido, mueres aunque no haya golpe de gracia
    if (!muere) { if (!esclavo) { herir(e, L, true); log(e, `${Lj.nombre} queda MAL HERIDO: ${nombre(e, G)} ganó por ${r.margen} y no alcanzó el golpe de gracia.`, { pid: L, aviso: true }); } }
    else if (esclavo) entregarTodo(data, e, G, L);
    else {
      eliminar(data, e, L, { por: G, causa: ganaAtk ? 'asesinado por ' + A.nombre : 'murió atacando a ' + D.nombre });
      if (ganaAtk) {
        buscadoPor(data, e, A, D, 'matar', mascara);   // el defensor que mata al agresor no queda Buscado (11.5)
        if (A.pj === '3' && D.pj === '4') {   // Jorge (8 de noviembre): si Anís mata a Jamil, cada uno de los demás le paga 8 dinares y gana 60 noches
          for (const id of activos(e)) if (id !== P.atk) { e.jugadores[id].dinares -= 8; A.dinares += 8; }
          A.noches += 60; log(e, `${A.nombre} mató a Jamil: cada jugador le paga 8 dinares y gana 60 noches.`, { pid: P.atk, aviso: true });
        }
      }
    }
  } else duelo(data, e, G, L, P);
  return terminarPelea(data, e, { ganaAtk });
}
// Muere el esclavo en un ataque a muerte: su amo vive, pero entrega todo lo que tendría que entregar al morir (dinares, cartas y noches).
function entregarTodo(data, e, gan, per) {
  const G = e.jugadores[gan], L = e.jugadores[per];
  robar(data, e, gan, per, { ladron: false, sinRegistro: true });
  const n = Math.max(0, L.noches); L.noches -= n; G.noches += n;
  log(e, `${L.nombre} entrega a ${G.nombre} todo lo que tenía: sus dinares, sus cartas y ${n} noches.`, { pid: per, aviso: true });
}

// R 11.6 y Jorge (28 de noviembre): quien pierde un duelo entrega la mitad de sus dinares (hacia abajo) y 30 noches (o todas); ya no queda herido.
export function duelo(data, e, ganador, perdedor, P = {}) {
  const G = e.jugadores[ganador], L = e.jugadores[perdedor];
  const nur = P.nur || (['1'].includes(G.pj) || L.pj === '1') && ['El Cairo', 'Damasco', 'Aleppo'].includes(G.ciudad);
  let din, noc;
  if (nur && G.pj === '1') { din = Math.max(0, Math.floor(L.dinares / 2)); noc = L.noches; }
  else if (nur && L.pj === '1') { din = L.dinares; noc = 0; }
  else { din = Math.max(0, Math.floor(L.dinares / 2)); noc = Math.min(data.config.duelo.nochesPerdedor, L.noches); }
  din = Math.max(0, din); noc = Math.max(0, noc);
  L.dinares -= din; L.noches -= noc; G.dinares += din; G.noches += noc;
  if (e.mods?.premioDuelo && ['Andalucía', 'Magreb'].includes(G.ciudad)) { G.dinares += e.mods.premioDuelo; log(e, `${G.nombre} cobra ${e.mods.premioDuelo} dinares del banco (Mercenarios de la frontera).`, { pid: ganador }); }
  log(e, `${G.nombre} gana el duelo: ${L.nombre} entrega ${din} dinares y ${noc} noches.`, { pid: ganador });
  if (G.pj === 'B' && G.npc && P.atk === ganador) { L.noches += 50; log(e, `${L.nombre} perdió el duelo que le impuso Yafar, pero gana 50 noches por la historia que va a contar.`, { pid: perdedor }); }   // Jorge (punto 12)
}

// R 12.1: quien gana un robo toma dinares, objetos, mapas y cartas poseídas de quien pierde (no noches, ni Mensajes, ni dinares escondidos,
// ni la jambiya escondida, ni el papel amate de su escondite, ni las cartas de sheij). Jorge (28 de noviembre): vale igual si pierde el ladrón.
function robar(data, e, atk, def, { ladron = true, sinRegistro = false } = {}) {
  const A = e.jugadores[atk], D = e.jugadores[def];
  const din = Math.max(0, D.dinares); D.dinares -= din; A.dinares += din;   // a quien tiene deudas no se le roban dinares
  // Frasco con tinta de pulpo (Jorge, 17 de noviembre): se rompe y destruye los papeles de quien pierde; el otro no se los lleva y el frasco se gasta
  if (tieneItem(D, 'tintaPulpo')) {
    const papel = (c) => (c.tipo === 'item' && PAPELES_ITEM.includes(c.ref) && !(c.ref === 'mapa' && c.extra?.tesoro === 'jugador')) || (c.tipo === 'objeto' && PAPELES_OBJ.includes(c.ref)) || (c.tipo === 'especial' && c.ref === 'F1');   // también el Firmán (Jorge, 17 de noviembre): se destruye, no vuelve al banco
    const rotos = D.mano.filter(papel);
    quitarPrimero(D, 'item', 'tintaPulpo'); D.mano = D.mano.filter((c) => !papel(c));
    log(e, `El frasco con tinta de pulpo de ${D.nombre} se rompe en la pelea: ${rotos.length ? `la tinta destruye ${rotos.length} papel${rotos.length === 1 ? '' : 'es'} (libros, mapas, papel amate, alfombras, el Shatranj o el Firmán) y ${A.nombre} no se los lleva` : 'no tenía papeles que proteger'}.`, { pid: def, aviso: true });
  }
  const oculta = (c) => jambiyaEscondida(D, c)   // la jambiya escondida no se la llevan (cada una por su cuenta)
    || (c.tipo === 'item' && c.ref === 'mapa' && c.extra?.tesoro === 'jugador')                    // ni el mapa del escondite de dinares (regla de Jorge)
    || (c.tipo === 'item' && !!ITEMS[c.ref]?.msg);                                                   // ni las cartas de sheij (Jorge, 28 de noviembre)
  const cartas = D.mano.filter((c) => !oculta(c)); D.mano = D.mano.filter(oculta);
  for (const c of cartas) { c.priv = true; A.mano.push(c); }                // nadie ve qué se llevó: deja de ser público
  recortarMano(data, e, atk);
  if (!sinRegistro) log(e, ladron ? `${A.nombre} roba ${din} dinares${cartas.length ? ' y ' + cartas.length + ' carta(s)' : ''} a ${D.nombre}.` : `${A.nombre} se queda con ${din} dinares${cartas.length ? ' y ' + cartas.length + ' carta(s)' : ''} de ${D.nombre}.`, { pid: atk });
  if (ladron && A.pj === 'B' && A.npc && D.pj !== 'B') { D.noches += 20; log(e, `${D.nombre} al menos gana 20 noches para contar la historia del robo de Yafar.`, { pid: def }); }   // Jorge (punto 12)
}

function terminarPelea(data, e, res) {
  const P = e.pelea;
  e.pelea = null;
  for (const x of P?.escudosRotos || []) romperEscudo(data, e, x.pid, x.uid);   // el tercer flechazo rompe el escudo
  if (P?.foto) {                                                               // lo que cambió la pelea, por si hay que deshacerla
    const L = (e.deshacer ||= {}); L[P.id] = { antes: P.foto, despues: fotoPelea(e, P) };
    for (const k of Object.keys(L).map(Number).sort((a, b) => a - b).slice(0, -4)) delete L[k];   // solo las últimas
  }
  if (res.cancelada && P) { /* la acción principal ya se consumió */ }
  if (P?.cont) { const f = CONT[P.cont.fn]; if (f) f(data, e, P.cont.args || {}, { res, pelea: P }); }
  return ok();
}

// ---------------------------------------------------------------- sacar a un jugador a media pelea (Jorge, 28 de noviembre)
// «Yafar cobró como si hubiese peleado»: al sacado de la partida no le cuenta la pelea que tenía a medias. Antes de resolverla se toma
// una foto de los que pelean y otra al terminar; si el banco saca a uno cuando faltaban sus dados, se deshace la diferencia.
const copia = (x) => JSON.parse(JSON.stringify(x ?? null));
function fotoPelea(e, P) {
  const jug = Object.fromEntries([P.atk, P.def, P.ayudante].filter((x) => x && e.jugadores[x]).map((x) => {
    const j = e.jugadores[x];
    return [x, { dinares: j.dinares, noches: j.noches, herido: !!j.herido, malHerido: !!j.malHerido, buscado: j.buscado || 0, motivo: copia(j.extra?.buscadoMotivo), eliminado: !!j.eliminado, mensajes: copia(j.mensajes || []), mano: copia(j.mano) }];
  }));
  return { jug, firmanes: e.firmanes || 0 };
}
// Pelea que aún no se resolvía (falta una decisión o un disparo): se cancela sin consecuencias y sigue quien atacaba.
export function anularPelea(data, e, motivo) {
  const P = e.pelea; if (!P) return false;
  const dePelea = (p) => p && String(p.cont?.fn || '').startsWith('pelea.');
  if (dePelea(e.pend)) e.pend = (e.colaPend || []).shift() || null;
  e.colaPend = (e.colaPend || []).filter((p) => !dePelea(p));
  log(e, `Se anula la pelea de ${nombre(e, P.atk)} contra ${nombre(e, P.def)}: ${motivo}. Nadie gana ni pierde nada en ella.`, { aviso: true });
  delete P.foto; terminarPelea(data, e, { cancelada: true });
  return true;
}
// Pelea ya resuelta cuyos dados no se habían visto: se devuelve lo que cambió (dinares, noches, heridas, Buscado, muerte y cartas).
export function deshacerPelea(e, id) {
  const L = e.deshacer?.[id]; if (!L) return false;
  delete e.deshacer[id];
  const ids = Object.keys(L.antes.jug);
  for (const x of ids) {
    const X = e.jugadores[x], a = L.antes.jug[x], d = L.despues.jug[x]; if (!X || !d) continue;
    X.dinares += a.dinares - d.dinares; X.noches += a.noches - d.noches;
    if (a.herido !== d.herido) X.herido = a.herido;
    if (!!a.malHerido !== !!d.malHerido) X.malHerido = !!a.malHerido;
    if (a.buscado !== d.buscado) { X.buscado = a.buscado; X.extra.buscadoMotivo = a.motivo || undefined; }
    if (a.eliminado !== d.eliminado) { X.eliminado = a.eliminado; if (!a.eliminado) X.mensajes = copia(a.mensajes); }
  }
  for (const x of ids) {                                                       // cada carta que tenía antes vuelve a su mano
    const X = e.jugadores[x], d = L.despues.jug[x]; if (!X || !d) continue;
    const seguia = new Set(d.mano.map((c) => c.uid));
    for (const c of L.antes.jug[x].mano) {
      if (seguia.has(c.uid) || X.mano.some((m) => m.uid === c.uid)) continue;
      for (const y of ids) { const Y = e.jugadores[y]; const i = y === x || !Y ? -1 : Y.mano.findIndex((m) => m.uid === c.uid); if (i >= 0) { Y.mano.splice(i, 1); break; } }
      X.mano.push(copia(c));
    }
  }
  e.firmanes = (e.firmanes || 0) - ((L.despues.firmanes || 0) - (L.antes.firmanes || 0));
  return true;
}

// ---------------------------------------------------------------- pelea entre dos jugadores sin números (torneo E5, entrenamiento H7): siempre por dados
export function luchaLibre(data, e, a, b, titulo = 'Pelea') {
  const pA = perfil(data, e, a), pB = perfil(data, e, b);
  const bA = bonos(data, e, a, pA, 'atk', null, { conDestreza: true }), bB = bonos(data, e, b, pB, 'def', null, { conDestreza: true });
  const r = luchaD(data, e, a, b, bA, bB);   // empate: gana el segundo, que se defiende
  mostrarPelea(data, e, { atk: a, def: b, bA, bD: bB, rondas: [r], inicio: [titulo], titulo });
  return r.ganaA ? a : b;
}

// ---------------------------------------------------------------- pelea contra un NPC (retos, Patrulla, esposo de Zein, bandoleros)
// npc: {etq, dados=2, bono=0, jambiya=false}. El jugador tira 2 dados + bonos de arma (+1 por destreza, como en la Patrulla R 17.2). Empate: se repite.
// npc.figura: el monito que pelea en el 3D (Jorge, 28 de noviembre, BUG5: «no salió el monito del cornudo»); 'CO' = el esposo de Zein.
// La línea del registro con peleaNPC le dice a la capa 3D quién pelea con quién, y sus dados llevan el mismo número (peleaNPC).
export function peleaNPC(data, e, pid, npc, { tituloExtra = '' } = {}) {
  const p = perfil(data, e, pid);
  const b = bonos(data, e, pid, p, 'def', null, { contraNPC: true });
  const esc = tieneObj(e.jugadores[pid], 'OB04') ? 1 : 0;   // escudo de cuero: al rival −1, siempre (Jorge, 28 nov, 10:16)
  const n0 = nombre(e, pid);
  if (npc.figura) log(e, `${npc.etq} se planta frente a ${n0} para pelear.`, { pid, peleaNPC: npc.figura, etq: npc.etq, ...(npc.arma ? { armaNPC: npc.arma } : {}), ...(npc.desde ? { desde: npc.desde } : {}) });
  const nPelea = npc.figura ? e.logN : null, marca = (d) => { if (d && nPelea) d.peleaNPC = nPelea; return d; };
  avisoSinFlechas(data, e, pid);
  // Arco (Jorge, 28 nov, 10:11): con 5 o 6 (4 a 6 con destreza en el arco) el rival pelea con −2; Campeón de Murcia (R51), siempre, sin dado.
  const maxArco = !!e.jugadores[pid].extra?.arcoMaximo && armasUsables(data, e, e.jugadores[pid], e.jugadores[pid].ciudad).includes('arco');
  if (maxArco) { quitarPrimero(e.jugadores[pid], 'item', 'flechas'); log(e, `${n0}, Campeón de Murcia, dispara sin fallar: la flecha acierta y ${npc.etq} pelea con −${ARCO_MENOS}.`, { pid }); }
  const arco = maxArco ? { acierta: true } : tiroDeArco(data, e, pid);   // el arco dispara antes de la pelea
  if (arco && !maxArco) marca(mostrarDados(e, { por: pid, motivo: 'pelea', boton: 'Disparar flecha', grupos: [{ etq: `${n0} dispara una flecha a ${npc.etq}: ${textoFlecha(!!e.jugadores[pid].extra?.entrenado?.arco).replace(/; si lleva escudo.*$/, '')}`, valores: [arco.x] }], resumen: [tituloExtra, arco.acierta ? `${n0} dispara su flecha (${arco.x}) y le da: ${npc.etq} pelea con −${ARCO_MENOS}.` : `${n0} dispara su flecha (${arco.x}) y falla.`].filter(Boolean) }));
  // El jugador lanza sus 2 dados con su botón; el NPC lanza solo, a la vista, y entonces sale el desglose.
  let gana = false, usoDado = false, primero = !arco || maxArco;
  for (let g = 0; g < 50; g++) {
    const r = dados(e, 2), n = dados(e, npc.dados || 2);
    let bn = (npc.bono || 0) - (arco?.acierta ? ARCO_MENOS : 0) - esc, jd = null;
    if (npc.jambiya) { jd = dado(e); if (par(jd)) bn += 3; }
    const dest = p.general ? 1 : 0;   // destreza general; el +1 del arma entrenada ya viene en los bonos
    const tj = suma(r) + b.total + dest, tn = suma(n) + bn - b.resta;
    marca(mostrarDados(e, { por: pid, motivo: 'pelea', grupos: [{ etq: `${n0} lanza 2 dados`, valores: r }], resumen: [...(primero && tituloExtra ? [tituloExtra] : []), `${n0} saca ${r.join(' + ')}.`] }));
    primero = false;
    const pj = [`dados ${r.join(' + ')} = ${suma(r)}`, ...b.partes.filter((x) => !/^Polvo/.test(x)), ...(dest ? ['destreza +1'] : [])];
    const pn = [`dados ${n.join(' + ')} = ${suma(n)}`, ...(npc.bono ? [`bono +${npc.bono}`] : []), ...(arco?.acierta ? [`flecha −${ARCO_MENOS}`] : []), ...(esc ? [`tu escudo −${esc}`] : []), ...(jd ? [`jambiya ${par(jd) ? '+3' : '+0'} (dado ${jd})`] : []), ...(b.resta ? [`polvo de pimienta −${b.resta}`] : [])];
    const res = [`${n0}: ${pj.join(' · ')} → total ${tj}.`, `${npc.etq}: ${pn.join(' · ')} → total ${tn}.`];
    let sigue = false;
    if (tj === tn) { res.push('Empate: se repite.'); sigue = true; }
    else {
      gana = tj > tn;
      if (!gana && !usoDado && dadoIbnArabi(e, pid)) { usoDado = true; res.push(`${n0} usa el Dado de Ibn Arabi y repite la pelea.`); sigue = true; }
      else res.push(gana ? `${n0} vence a ${npc.etq}.` : `${npc.etq} vence a ${n0}.`);
    }
    marca(mostrarDados(e, { por: pid, npc: true, motivo: 'pelea', grupos: [{ etq: npc.etq, valores: [...n, ...(jd ? [jd] : [])] }], resumen: res }));
    if (!sigue) break;
  }
  return gana;
}

// ---------------------------------------------------------------- R68: Rayhán, sicario (Jorge, 28 de noviembre, 09:08)
// «Es una pelea de tipo ataque a muerte; Rayhán, como esclavo, tiene alfanje y destreza en alfanje (no tiene arco ni escudo).»
// Rayhán ataca y la víctima se defiende con la mecánica de siempre: la categoría la pone la víctima; si lleva esclavo de pelea, pelea
// él. Por Rayhán lanza quien lo contrató (o nadie, si viene a cobrar). Golpe de gracia, mal herido, empate y herido previo como en
// cualquier ataque a muerte. Si Rayhán pierde, muere (es un esclavo). Al terminar se llama a cont con { gana, dado }: gana = 'rayhan',
// 'victima' o 'empate'; dado = el primer dado que tiró la víctima (el que se cobra).
export const RAYHAN_PELEA = { nombre: 'Rayhán', bono: 2 };
export function peleaRayhan(data, e, { por = null, victima, cont, nLog = null }) {
  const V = e.jugadores[victima];
  const P = e.peleaRayhan = { tipo: 'matar', rayhan: true, por, atk: null, def: victima, ciudad: V.ciudad, nLog, cont, mods: { [victima]: {} }, rayhanMenos: 0,
    titulo: `Ataque a muerte: Rayhán contra ${V.nombre}`, conEsclavo: { [victima]: nEsclavos(V, 'esclavoPelea') > 0 } };
  const nD = nPel(e, P, victima), npcR = !por || esNPC(e, por), npcV = esNPC(e, victima);
  const md = (o) => { const d = mostrarDados(e, { titulo: P.titulo, ...o }); if (d && nLog) d.peleaNPC = nLog; return d; };
  const inicio = [`Rayhán, esclavo de pelea con alfanje y destreza en alfanje, ataca a muerte a ${nD}. ${QUE_SE_JUEGA.matar[0].toUpperCase()}${QUE_SE_JUEGA.matar.slice(1)}.`];
  // 1) la flecha de la víctima, si pelea ella y lleva arco con flechas (Rayhán no tiene escudo)
  if (!P.conEsclavo[victima]) {
    avisoSinFlechas(data, e, victima, P.ciudad);
    const a = tiroDeArco(data, e, victima, P.ciudad);
    if (a) {
      if (a.acierta) P.rayhanMenos = ARCO_MENOS;
      if (a.murcia) log(e, `${V.nombre}, Campeón de Murcia, dispara sin fallar: Rayhán pelea con −${ARCO_MENOS}.`, { pid: victima });
      else md({ por: victima, npc: npcV, motivo: 'pelea', boton: 'Disparar flecha', grupos: [{ etq: `${V.nombre} dispara una flecha a Rayhán: ${textoFlecha(!!V.extra?.entrenado?.arco)}`, valores: [a.x] }], resumen: [...inicio.splice(0), a.acierta ? `¡Le da! Rayhán pelea con −${ARCO_MENOS}.` : 'La flecha falla.'] });
    }
  }
  // 2) la categoría de la víctima
  let cat = perfilPelea(data, e, P, victima).cat;
  if (cat === 'C') {                                                         // un dado de destreza por arma (Jorge, 28 nov, 10:00)
    const cuentan = dadosPorArma(data, e, P, victima, md, inicio.splice(0), true) || [];
    cat = cuentan.length ? 'D' : 'A';
  } else if (cat === 'D') dadosPorArma(data, e, P, victima, md, inicio.splice(0));
  if (cat === 'B') {
    const x = dado(e); P.ventajaB = par(x) ? 1 : 2;
    md({ por: victima, npc: npcV, motivo: 'categoria', grupos: [{ etq: `${nD} tiene destreza pero ningún arma: tira un dado. Par, toma piedras y vidrios y Rayhán suma 1 punto de ventaja; impar, Rayhán suma 2`, valores: [x] }], resumen: [...inicio.splice(0), `Sale ${x}: Rayhán sumará ${P.ventajaB} de ventaja.`] });
  }
  P.cat = cat; P.inicio = inicio; P.npcR = npcR; P.npcV = npcV;
  if (cat === 'A' && !npcV) {
    pedir(e, { tipo: 'numeros', para: [victima], titulo: 'Di tu número', texto: 'Rayhán te ataca a muerte y no tienes armas ni destreza: tomas piedras y palos. Elige un número del 1 al 6 y luego tira un dado: si sale tu número, ganas; si no, gana Rayhán, y si el dado cae a 3 o más de tu número, mueres (si no, quedas mal herido).',
      modo: 'multi', min: 1, max: 1, opciones: [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), texto: String(n) })), porDefecto: ['3'], cont: { fn: 'rayhan.numero', args: {} } });
    return;
  }
  return rayhanDados(data, e, 3);
}
registrar('rayhan.numero', (data, e, args, resp) => rayhanDados(data, e, Number((resp.valores || [])[0]) || 3));
function rayhanDados(data, e, numero) {
  const P = e.peleaRayhan; if (!P) return;
  const victima = P.def, nD = nPel(e, P, victima), md = (o) => { const d = mostrarDados(e, { titulo: P.titulo, ...o }); if (d && P.nLog) d.peleaNPC = P.nLog; return d; };
  const pe = penaEscudo(data, e, P), menos = P.rayhanMenos + pe;
  const partesR = [`alfanje +${RAYHAN_PELEA.bono} (con destreza)`, ...(P.rayhanMenos ? [`flecha −${P.rayhanMenos}`] : []), ...(pe ? [`escudo de ${nD} −${pe}`] : [])];
  let r, dadoV;
  if (P.cat === 'A') {
    const x = dado(e); dadoV = x; r = { ganaAtk: x !== numero, empate: false, margen: Math.abs(x - numero) };
    md({ por: victima, npc: P.npcV, motivo: 'pelea', grupos: [{ etq: `${nD} dijo el ${numero} y tira un dado: si sale, gana; si no, gana Rayhán`, valores: [x] }], resumen: [...P.inicio, x === numero ? `¡Sale ${x}! Gana ${nD}.` : `Sale ${x}: gana Rayhán.`] });
  } else if (P.cat === 'B') {
    const v = P.ventajaB || 1, dA = dado(e), dB = dado(e), tA = dA + v - P.rayhanMenos - pe, tB = dB; dadoV = dB;
    r = resultado(P, tA, tB);
    md({ por: P.por || victima, npc: P.npcR, motivo: 'pelea', grupos: [{ etq: `${P.por ? nombre(e, P.por) + ' lanza por Rayhán' : 'Rayhán lanza'}: un dado, más ${v} de ventaja`, valores: [dA] }], resumen: [...P.inicio, `Rayhán: dado ${dA} · ventaja +${v}${menos ? ` · ${partesR.slice(1).join(' · ')}` : ''} → ${tA}.`] });
    md({ por: victima, npc: P.npcV, motivo: 'pelea', grupos: [{ etq: `${nD} tira su dado: Rayhán lleva ${tA}`, valores: [dB] }], resumen: [`${nD}: dado ${dB} → ${tB}.`, textoGanaR(r, nD, tA, tB)] });
  } else {
    const bR = { total: RAYHAN_PELEA.bono - menos, resta: 0, partes: partesR }, bV = bonosCombate(data, e, victima, 'def', P.ciudad, P.mods[victima], P);
    const x = luchaD(data, e, null, victima, bR, bV); dadoV = x.vB; r = resultado(P, x.tA, x.tB);
    const nR = P.por ? `${nombre(e, P.por)} (por Rayhán)` : 'Rayhán';
    md({ por: P.por || victima, npc: P.npcR, motivo: 'pelea', grupos: [{ etq: `${nR}: dado de ventaja. Quien saque más suma +1; si empatan, es de ${nD}`, valores: [x.vA] }], resumen: [...P.inicio, `Rayhán saca ${x.vA} en su dado de ventaja.`] });
    md({ por: victima, npc: P.npcV, motivo: 'pelea', grupos: [{ etq: `${nD}: dado de ventaja (Rayhán sacó ${x.vA})`, valores: [x.vB] }], resumen: [`${nD} saca ${x.vB}: la ventaja (+1) es para ${x.ventA ? 'Rayhán' : nD}.`] });
    md({ por: P.por || victima, npc: P.npcR, motivo: 'pelea', grupos: [{ etq: `${nR}: 2 dados, más ${partesR.join(', ')}`, valores: x.rA }], resumen: [`Rayhán: ${partesBando(x.rA, bR, bV, x.ventA, 0, false).join(' · ')} → total ${x.tA}.`] });
    md({ por: victima, npc: P.npcV, motivo: 'pelea', grupos: [{ etq: `${nD}: 2 dados, más sus bonos (${listaBonos(bV)}). Rayhán lleva ${x.tA}`, valores: x.rB }], resumen: [`${nD}: ${partesBando(x.rB, bV, bR, x.ventB, 0, false).join(' · ')} → total ${x.tB}.`, textoGanaR(r, nD, x.tA, x.tB)] });
  }
  P.r = r; P.dado = dadoV;
  return aplicarRayhan(data, e);
}
const textoGanaR = (r, nD, tA, tB) => (r.empate ? `Empate a ${tA}.` : `Gana ${r.ganaAtk ? 'Rayhán' : nD}, ${Math.max(tA, tB)} a ${Math.min(tA, tB)}.`);
function aplicarRayhan(data, e) {
  const P = e.peleaRayhan; e.peleaRayhan = null;
  const r = P.r, V = e.jugadores[P.def], esc = !!P.conEsclavo[P.def], killer = P.por || undefined;
  let gana;
  if (r.empate) {
    gana = 'empate';
    if (esc) log(e, `Rayhán y el esclavo de pelea de ${V.nombre} empatan: los dos salen heridos y con vida.`, { pid: V.id, aviso: true });
    else if (V.herido) { log(e, `Empatan, pero ${V.nombre} ya estaba herido: muere.`, { pid: V.id, aviso: true }); eliminar(data, e, V.id, { por: killer, causa: 'Rayhán' }); }
    else { herir(e, V.id); log(e, `Rayhán y ${V.nombre} empatan: ${V.nombre} queda herido.`, { pid: V.id, aviso: true }); }
  } else if (r.ganaAtk) {
    gana = 'rayhan';
    const golpe = r.margen >= GOLPE_DE_GRACIA;
    if (esc) {
      muereEsclavo(data, e, V.id, P.por || V.id);
      if (golpe && P.por) entregarTodo(data, e, P.por, V.id);
    } else if (golpe || V.herido) { log(e, `${V.nombre} muere a manos de Rayhán${golpe && P.cat !== 'A' ? ` (golpe de gracia: ${P.cat === 'A' ? 'el dado cayó a ' + r.margen + ' del número' : 'ganó por ' + r.margen})` : V.herido && !golpe ? ' (ya estaba herido)' : ''}.`, { pid: V.id, aviso: true }); eliminar(data, e, V.id, { por: killer, causa: 'Rayhán' }); }
    else { herir(e, V.id, true); log(e, `Rayhán gana${P.cat === 'A' ? ` (el dado cayó a ${r.margen} del número)` : ` por ${r.margen}`}: no alcanza el golpe de gracia. ${V.nombre} queda MAL HERIDO.`, { pid: V.id, aviso: true }); }
  } else {
    gana = 'victima';
    e.rayhanMuerto = true;
    log(e, `${V.nombre} vence a Rayhán, que muere: era un esclavo y ya nadie podrá contratarlo.`, { pid: V.id, aviso: true });
  }
  const f = P.cont && CONT[P.cont.fn]; if (f) f(data, e, P.cont.args || {}, { gana, dado: P.dado || 1 });
}
