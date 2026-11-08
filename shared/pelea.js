// Combate, duelos, robos y asesinato entre jugadores (R 11, R 12) y peleas contra NPC (retos, Patrulla, esposo de Zein).
// Reglas de la casa oficiales (config.reglasCasa): bonos de arma para AMBOS bandos y defensor que mata sin quedar Buscado.
// Todo se resuelve en el servidor; las decisiones del defensor se piden con «pend» y las tiradas se muestran con la cola de dados.
import {
  ok, err, dado, dados, suma, par, log, nombre, pedir, registrar, CONT, mostrarDados, eliminar, ciudadDe, pjDe, objDe, enCiudad,
  tieneItem, tieneObj, tieneEsp, quitarPrimero, devolverObjeto, recortarMano, activos, darObjeto, devolverPrincipal,
marcarBuscado,
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
    if (ref === 'jambiya' && j.extra?.jambiyaOculta) continue;          // escondida no cuenta en las peleas
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
// Categoría D (R 11.2): dado de ventaja (uno cada bando), luego 2 dados cada uno + bonos + ventaja; empate = se repite.
// Solo genera los intentos; mostrarPelea los presenta paso a paso (cada bando lanza sus propios dados).
function luchaD(data, e, A, B, bA, bB, extra = { A: 0, B: 0 }, { empateTermina = false } = {}) {
  const intentos = [];
  for (let guard = 0; guard < 50; guard++) {
    const v = [dado(e), dado(e)];
    if (v[0] === v[1]) { intentos.push({ vA: v[0], vB: v[1], rA: [], rB: [], ventajaEmpatada: true }); continue; }
    const ventA = v[0] > v[1] ? 1 : 0, ventB = 1 - ventA;
    const rA = dados(e, 2), rB = dados(e, 2);
    const tA = suma(rA) + bA.total + ventA + extra.A - bB.resta, tB = suma(rB) + bB.total + ventB + extra.B - bA.resta;
    intentos.push({ vA: v[0], vB: v[1], rA, rB, ventA, ventB, extraA: extra.A, extraB: extra.B, tA, tB });
    if (tA !== tB || empateTermina) return { ganaA: tA > tB, empate: tA === tB, margen: Math.abs(tA - tB), intentos };
  }
  return { ganaA: true, intentos };
}
// Un dado cada uno + ventaja del agresor (categoría B, R 11.2).
function luchaB(data, e, A, B, bA, bB, ventajaAgresor, { empateTermina = false } = {}) {
  const intentos = [];
  for (let guard = 0; guard < 50; guard++) {
    const dA = dado(e), dB = dado(e);
    const tA = dA + ventajaAgresor + bA.total - bB.resta, tB = dB + bB.total - bA.resta;
    intentos.push({ rA: [dA], rB: [dB], ventA: ventajaAgresor, ventB: 0, tA, tB, agresor: true });
    if (tA !== tB || empateTermina) return { ganaA: tA > tB, empate: tA === tB, margen: Math.abs(tA - tB), intentos };
  }
  return { ganaA: true, intentos };
}
const esNPC = (e, pid) => !!e.jugadores[pid]?.npc;
// Desglose de un bando: dados, cada bono por separado, ventaja y total.
function partesBando(r, b, rival, vent, extra, agresor) {
  const partes = [`dados ${r.join(' + ')} = ${suma(r)}`, ...b.partes.filter((x) => !/^Polvo/.test(x))];
  if (vent) partes.push(`${agresor ? 'ventaja del agresor' : 'dado de ventaja'} +${vent}`);
  if (extra) partes.push(`+${extra}`);
  if (rival.resta) partes.push(`polvo de pimienta del rival −${rival.resta}`);
  return partes;
}
// Presenta una pelea entre dos bandos: en cada intento lanza primero el atacante, luego el defensor (cada uno con su botón;
// los NPC lanzan solos a la vista) y al final sale el desglose línea por línea. rondas: [{ intentos, previa? }].
function mostrarPelea(data, e, { atk, def, bA, bD, rondas, inicio = [], cierre = [], titulo = null }) {
  const nA = nombre(e, atk), nD = nombre(e, def);
  let primero = true;
  rondas.forEach((ronda, ri) => ronda.intentos.forEach((x, k) => {
    const ultimo = ri === rondas.length - 1 && k === ronda.intentos.length - 1;
    const pre = [...(primero ? inicio : []), ...(k === 0 && ronda.previa ? [ronda.previa] : [])]; primero = false;
    if (x.ventajaEmpatada) {
      mostrarDados(e, { por: atk, npc: esNPC(e, atk), motivo: 'pelea', titulo, grupos: [{ etq: `${nA}: dado de ventaja`, valores: [x.vA] }], resumen: [...pre, `${nA} saca ${x.vA} de ventaja.`] });
      mostrarDados(e, { por: def, npc: esNPC(e, def), motivo: 'pelea', titulo, grupos: [{ etq: `${nD}: dado de ventaja`, valores: [x.vB] }], resumen: [`Ventaja empatada (${x.vA} y ${x.vB}): se repite.`] });
      return;
    }
    const conVent = x.vA != null;
    mostrarDados(e, { por: atk, npc: esNPC(e, atk), motivo: 'pelea', titulo, grupos: [{ etq: conVent ? `${nA}: dado de ventaja y 2 dados` : `${nA} lanza`, valores: [...(conVent ? [x.vA] : []), ...x.rA] }],
      resumen: [...pre, `${nA} saca ${x.rA.join(' + ')}${conVent ? ` (ventaja ${x.vA})` : ''}.`] });
    const res = [];
    if (conVent) res.push(`Ventaja: ${nA} ${x.vA} contra ${nD} ${x.vB} → +1 para ${x.ventA ? nA : nD}.`);
    res.push(`${nA}: ${partesBando(x.rA, bA, bD, x.ventA, x.extraA, x.agresor).join(' · ')} → total ${x.tA}.`);
    res.push(`${nD}: ${partesBando(x.rB, bD, bA, x.ventB, x.extraB, false).join(' · ')} → total ${x.tB}.`);
    if (x.tA === x.tB && !ultimo) res.push(`Empate a ${x.tA}: se repite la jugada.`);
    else if (!ultimo) res.push(`${x.tA > x.tB ? nA : nD} iba ganando ${Math.max(x.tA, x.tB)} a ${Math.min(x.tA, x.tB)}…`);
    if (ultimo) res.push(...cierre);
    mostrarDados(e, { por: def, npc: esNPC(e, def), motivo: 'pelea', titulo, grupos: [{ etq: conVent ? `${nD}: dado de ventaja y 2 dados` : `${nD} lanza`, valores: [...(conVent ? [x.vB] : []), ...x.rB] }], resumen: res });
  }));
}
// Cómo pelea cada bando: lo que pesan armas y destreza.
function textoCategoria(e, pid, pf, cat, esDef) {
  const n = nombre(e, pid), armas = pf.armas.length ? pf.armas.join(' y ') : '';
  if (!esDef) return `${n} ataca ${armas ? `con ${armas}` : 'sin armas'}${pf.destreza ? ' y con destreza' : ''}.`;
  if (cat === 'D' && pf.cat === 'C') return `${n} se defiende con ${armas} sin destreza, pero esta vez acertó a usarla.`;
  if (cat === 'A' && pf.cat === 'C') return `${n} tiene ${armas} pero no destreza: esta vez no acertó a usarla y pelea como sin armas.`;
  return `${n} se defiende ${cat === 'D' ? `con ${armas} y destreza` : cat === 'B' ? 'con destreza pero sin armas' : 'sin armas ni destreza'}.`;
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
    // Jorge (8 de noviembre): a Nur al Din sí le pueden robar como a cualquiera (se defiende con su cimitarra entrenada).
    if (!pa.armas.length && !npc) return err('Para robar necesitas un arma que puedas usar aquí.');
  }
  if (a.tipo === 'matar') {
    if (e.ronda <= data.config.primerosTurnosSinMatar && !libre) return err('Nadie puede matar en las 2 primeras rondas.');
    if (!npc && !(pa.armas.length && (pa.destreza || j.pj === '1'))) return err(j.pj === '1' ? 'Para matar necesitas un arma que puedas usar aquí.' : 'Para matar necesitas un arma y destreza con armas: sin ellas solo puedes robar.');   // Nur al Din, guerrero: ataca a muerte sin destreza
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

// Regla de la casa (arco y escudo): antes de un asalto o un ataque a muerte, el defensor dispara su arco (gasta 1 flecha;
// con 5 o 6 el atacante queda herido y huye) y, si sigue, levanta su Escudo de cuero (con 5 o 6 para el golpe; con 1 se rompe).
// Se aplica sola, sin preguntar; en los duelos no, porque son una pelea limpia. Devuelve true si el ataque se frustró.
export const ARCO_ACIERTA = 5, ESCUDO_PARA = 5;
export function tiroDeArco(data, e, pid, ciudad) {
  const j = e.jugadores[pid];
  if (!armasUsables(data, e, j, ciudad || j.ciudad).includes('arco')) return null;
  quitarPrimero(j, 'item', 'flechas');
  const x = dado(e);
  return { x, acierta: x >= ARCO_ACIERTA, cubre: !!j.extra?.entrenado?.arco && x >= 3 && x < ARCO_ACIERTA, quedan: j.mano.filter((c) => c.tipo === 'item' && c.ref === 'flechas').length };
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
  if (P) return false;                                                       // regla de la casa: el arco ahora dispara dentro de la pelea y el escudo suma +1
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
    texto: `${j.nombre} ${AVISO_ATAQUE[a.tipo]} en ${j.ciudad}. ${enJuego(data, e, a.tipo, j, d, pedirNur)}¿Qué haces?`, opciones: op, porDefecto: 'luchar', cont: { fn: 'pelea.defensa', args: {} } });
  return ok();
}
// Qué se gana y qué se pierde en cada pelea, para que quien la recibe lo vea claro antes de decidir.
function enJuego(data, e, tipo, A, D, pedirNur) {
  const mitad = (x) => Math.max(0, Math.floor(x.dinares / 2)), n = data.config.duelo.nochesPerdedor;
  if (tipo === 'duelo') {
    const rechazo = pedirNur ? `${pedirNur.dinares} dinares y ${pedirNur.noches} noches` : `${data.config.duelo.rechazo} dinares`;
    const gana = A.herido ? `${A.nombre} está herido: si ganas tú, muere y recibes su botín` : `Si ganas recibes ${mitad(A)} dinares y ${Math.min(n, A.noches)} noches de ${A.nombre}`;
    const pierde = D.herido ? 'estás herido: si pierdes este duelo, mueres' : `si pierdes entregas ${mitad(D)} dinares y ${Math.min(n, D.noches)} noches y quedas herido`;
    return `${gana}; ${pierde}. Rechazar cuesta ${rechazo}. `;
  }
  if (tipo === 'robo') return `Si el asalto sale bien te quita tus ${Math.max(0, D.dinares)} dinares y tus cartas; si fracasa no pierdes nada. `;
  return `Golpe de gracia: si gana por 3 o más mueres; por 1 o 2 quedas herido; empate, heridos los dos. Si ganas tú por 3 o más, muere ${A.nombre} y recibes su botín. `;
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
    else { const r = Math.max(0, Math.min(data.config.duelo.rechazo, d.dinares)); d.dinares -= r; j.dinares += r; log(e, `${d.nombre} rechaza el duelo y paga ${r} dinares a ${j.nombre}.`, { pid: P.def }); }
    devolverPrincipal(e, P.atk, `${d.nombre} rechazó el duelo`);
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
  if (P.tipo !== 'duelo') return resolverNuevo(data, e);                     // robo y ataque a muerte: sistema de 2 dados (los duelos siguen igual)
  const quien = P.ayudante || P.def;
  // Duelo: quien tenga arco y flechas dispara antes (con su botón), igual que en robos y ataques a muerte.
  if (!P.mods) {
    const tit = `Duelo: ${nombre(e, P.atk)} contra ${nombre(e, P.def)}`;
    P.mods = { atk: {}, def: {} };
    if (conArco(data, e, P.atk, P.ciudad)) P.mods.def = disparo(data, e, P.atk, quien, tit);
    if (conArco(data, e, quien, P.ciudad)) P.mods.atk = disparo(data, e, quien, P.atk, tit);
  }
  let pd = perfil(data, e, quien);
  if (P.mods.def.sinDestreza && pd.destreza) { pd = { ...pd, destreza: false, cat: pd.armas.length ? 'C' : 'A' }; }
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

// ---------------------------------------------------------------- robo y ataque a muerte (regla de la casa, sistema de 2 dados)
// Cada bando lanza 2 dados con su botón y suma: armas de cuerpo a cuerpo sumadas (alfanje +1, cimitarra +2, jambiya +1; tope +4),
// destreza +1, escudo +1 (solo al defender), herido −1 y los objetos de combate. El arco no suma en el choque: antes se dispara
// una flecha (5–6 el rival queda tocado: −1 y pierde su destreza; 3–4 se cubre: −1; 1–2 falla; contra un escudo no hace nada).
// Robo: el empate lo gana el defensor. A muerte: golpe de gracia (3 o más mata; 1–2 hiere; empate hiere a los dos).
export const BONO_MELEE = { alfanje: 1, cimitarra: 2, jambiya: 1 }, TOPE_ARMAS = 4;
export const conArco = (data, e, pid, ciudad) => armasUsables(data, e, e.jugadores[pid], ciudad).includes('arco');
export function bonosCombate(data, e, pid, rol, ciudad, mods = {}) {
  const j = e.jugadores[pid], armas = armasUsables(data, e, j, ciudad).filter((r) => BONO_MELEE[r]);
  const partes = []; let total = 0, resta = 0;
  const ent = (r) => (j.extra?.entrenado?.[r] ? 1 : 0);                       // entrenado con esa arma: +1 (regla de la casa)
  const sumaArmas = armas.reduce((n, r) => n + BONO_MELEE[r] + ent(r), 0), deArmas = Math.min(TOPE_ARMAS, sumaArmas);
  if (armas.length) { partes.push(armas.map((r) => `${r} +${BONO_MELEE[r] + ent(r)}${ent(r) ? ' (entrenado)' : ''}`).join(' · ') + (sumaArmas > TOPE_ARMAS ? ` (tope de armas +${TOPE_ARMAS})` : '')); total += deArmas; }
  if (j.destreza && !mods.sinDestreza) { partes.push('destreza +1'); total += 1; }
  if (j.destreza && mods.sinDestreza) partes.push('destreza perdida por la flecha');
  if (rol === 'def' && tieneObj(j, 'OB04')) { partes.push('escudo +1'); total += 1; }
  if (j.herido) { partes.push('herido −1'); total -= 1; }
  if (mods.flecha) { partes.push(`flecha −${mods.flecha}`); total -= mods.flecha; }
  if (tieneEsp(j, 'K1')) { partes.push('Ejército de Kanmakán +2'); total += 2; usarKanmakan(e, j); }
  if (j.ventajaCombate > 0) { total += 3; j.ventajaCombate--; partes.push('deseo de ifrit +3'); }
  if (tieneObj(j, 'OB01')) { partes.push('Daga de manga +1'); total += 1; }
  return { total, resta, partes };
}
export const textoFlecha = (en) => `con 5 o 6 pelea con −1 y sin destreza${en ? '; con 3 o 4 (arco entrenado), con −1' : ''}; si lleva escudo, no le hace nada`;
// Disparo a distancia (antes del choque): devuelve los efectos sobre el blanco; se muestra con su dado y botón.
function disparo(data, e, tirador, blanco, titulo) {
  const T = e.jugadores[tirador], B = e.jugadores[blanco];
  quitarPrimero(T, 'item', 'flechas');
  const x = dado(e), escudo = !!tieneObj(B, 'OB04'), en = !!T.extra?.entrenado?.arco;   // regla de Jorge: 5–6 le da; entrenado (R43), además 3–4 lo obliga a cubrirse
  const efecto = escudo ? {} : x >= 5 ? { flecha: 1, sinDestreza: true } : en && x >= 3 ? { flecha: 1 } : {};
  const texto = escudo ? `La flecha se clava en el escudo de ${B.nombre}: no le hace nada.` : x >= 5 ? `¡Le da! ${B.nombre} pelea con −1 y sin su destreza en esta pelea.` : en && x >= 3 ? `${B.nombre} tiene que cubrirse: −1 en esta pelea.` : 'La flecha falla.';
  mostrarDados(e, { por: tirador, npc: esNPC(e, tirador), motivo: 'pelea', titulo, boton: 'Disparar flecha', grupos: [{ etq: `${T.nombre} dispara una flecha a ${B.nombre}: ${textoFlecha(en)}`, valores: [x] }], resumen: [texto] });
  return efecto;
}
function resolverNuevo(data, e) {
  const P = e.pelea; if (!P) return;
  const atk = P.atk, def = P.ayudante || P.def, nA = nombre(e, atk), nD = nombre(e, def);
  const titulo = `${P.tipo === 'robo' ? 'Asalto' : 'Ataque a muerte'}: ${nA} contra ${nombre(e, P.def)}`;
  const modA = {}, modD = {};
  if (conArco(data, e, atk, P.ciudad)) Object.assign(modD, disparo(data, e, atk, def, titulo));
  if (conArco(data, e, def, P.ciudad)) Object.assign(modA, disparo(data, e, def, atk, titulo));
  const bA = bonosCombate(data, e, atk, 'atk', P.ciudad, modA), bD = bonosCombate(data, e, def, 'def', P.ciudad, modD);
  const inicio = [`Cada uno lanza 2 dados y suma sus bonos.${P.tipo === 'robo' ? ' Si empatan, gana el defensor.' : ' Golpe de gracia: 3 o más mata, 1 o 2 hiere, empate hiere a los dos.'}`];
  if (P.ayudante) inicio.push(`${nD} pelea en nombre de ${nombre(e, P.def)}.`);
  if (P.polvo && !P.ayudante) { bD.resta = 2; const dj = e.jugadores[P.def]; quitarPrimero(dj, 'objeto', 'OB03'); devolverObjeto(data, e, 'OB03'); inicio.push(`${nombre(e, P.def)} usa Polvo de pimienta: el atacante resta 2.`); }
  const tirar = () => { const rA = dados(e, 2), rB = dados(e, 2); const tA = suma(rA) + bA.total - bD.resta, tB = suma(rB) + bD.total - bA.resta; return { intentos: [{ rA, rB, ventA: 0, ventB: 0, tA, tB }], ganaA: tA > tB, empate: tA === tB, margen: Math.abs(tA - tB) }; };
  let r = tirar();
  const rondas = [{ intentos: r.intentos }];
  const pierde = r.ganaA ? def : atk;
  if (!r.empate || P.tipo === 'robo') {
    if (zeinRepite(e, pierde)) { r = tirar(); rondas.push({ intentos: r.intentos, previa: `${nombre(e, pierde)} usa «Dados del Cairo» y repite la jugada.` }); }
    else if (dadoIbnArabi(e, pierde)) { r = tirar(); rondas.push({ intentos: r.intentos, previa: `${nombre(e, pierde)} usa el Dado de Ibn Arabi y repite la jugada.` }); }
  }
  const ganaAtk = r.ganaA;                                                     // en el robo, el empate es del defensor
  let cierre;
  if (P.tipo === 'matar') { P.golpe = golpe(r.ganaA, r.margen, r.empate); cierre = [textoGolpe(e, P, P.golpe)]; }
  else cierre = [r.empate ? `Empate: gana ${nombre(e, P.def)}, que se defiende.` : `Gana ${ganaAtk ? nA : nD}.`, ganaAtk ? `${nA} le roba a ${nombre(e, P.def)} sus dinares y sus cartas.` : `${nA} no se lleva nada.`];
  mostrarPelea(data, e, { atk, def, bA, bD, rondas, inicio, titulo, cierre });
  aplicar(data, e, { ganaAtk, numeroOk: false, cat: 'D' });
}

// ---------------------------------------------------------------- resolución
// Regla de la casa «Golpe de gracia» (ataques a muerte): matas solo si ganas por 3 o más; por 1 o 2 el perdedor queda herido;
// el empate deja heridos a los dos. Sin armas, si el defensor falla su número, el atacante lanza: 4 a 6 mata, 1 a 3 solo hiere.
export const GOLPE_DE_GRACIA = 3;
function textoGolpe(e, P, g) {
  const nA = nombre(e, P.atk), nD = nombre(e, P.def);
  if (g.r === 'ambos') return `Empate: ambos heridos. ${nA} y ${nD} quedan heridos.`;
  const gan = g.r === 'mata' || g.r === 'hiereDef' ? nA : nD, per = gan === nA ? nD : nA;
  const por = g.margen != null ? `${gan} gana por ${g.margen}: ` : '';
  return g.r === 'mata' || g.r === 'muereAtk' ? `${por}golpe de gracia. ${per} muere${g.r === 'muereAtk' ? ' en el intento' : ` a manos de ${nA}`}.` : `${por}solo herido. ${per} queda herido.`;
}
function golpe(ganaAtk, margen, empate) {
  if (empate) return { r: 'ambos', margen: 0 };
  const mata = margen >= GOLPE_DE_GRACIA;
  return { r: ganaAtk ? (mata ? 'mata' : 'hiereDef') : (mata ? 'muereAtk' : 'hiereAtk'), margen };
}
function consecuencia(e, P, ganaAtk, numeroOk, cat) {
  const nA = nombre(e, P.atk), nD = nombre(e, P.def), sinArmas = cat === 'A' || cat === 'B';
  if (P.tipo === 'robo') return ganaAtk ? `${nA} le roba a ${nD} sus dinares y sus cartas.` : `${nA} no se lleva nada${sinArmas && numeroOk ? ' y queda herido' : ''}.`;
  if (P.tipo === 'matar') return ganaAtk ? `${nD} muere a manos de ${nA}.` : numeroOk ? `${nD} se salva a pedradas y ${nA} queda herido.` : `${nA} muere en el intento.`;
  const perd = e.jugadores[ganaAtk ? P.def : P.atk];
  return perd.herido ? `${perd.nombre} pierde el duelo estando herido: muere.` : `${perd.nombre} pierde el duelo: entrega la mitad de sus dinares y 30 noches y queda herido.`;
}
function resolver(data, e, { numeros }) {
  const P = e.pelea; if (!P) return;
  const atk = P.atk, def = P.ayudante || P.def;
  const pA = perfil(data, e, atk), pD = perfil(data, e, def);
  const cat = P.cat || pD.cat;
  let ganaAtk, numeroOk = null;
  const nA = e.jugadores[atk].nombre, nD = e.jugadores[P.def].nombre;
  const inicio = [textoCategoria(e, atk, pA, cat, false), textoCategoria(e, def, pD, cat, true)];
  const titulo = `${{ robo: 'Asalto', matar: 'Ataque a muerte', duelo: 'Duelo' }[P.tipo] || 'Pelea'}: ${nA} contra ${nD}`;
  if (P.ayudante) inicio.push(`${nombre(e, P.ayudante)} pelea en nombre de ${nD}.`);
  if (cat === 'A' || (cat === 'B' && P.tipo === 'robo')) {
    // juego de números: en un robo lanza el atacante; a muerte o en duelo, el defensor lanza su propio dado
    if (P.tipo === 'robo') {
      const x = dado(e), dicho = numeros.length ? numeros : [3];
      numeroOk = dicho.includes(x); ganaAtk = !numeroOk;
      const regla = `Sin armas, ${nD} se defiende diciendo ${dicho.length > 1 ? 'dos números' : 'un número'}: si ${nA} saca uno de ellos, el asalto fracasa.`;
      const tirada = `${nD} dijo ${dicho.join(' y ')}; ${nA} saca ${x}: ${ganaAtk ? 'el asalto tiene éxito' : 'el asalto fracasa'}.`;
      mostrarDados(e, { por: atk, npc: esNPC(e, atk), motivo: 'pelea', titulo, grupos: [{ etq: `${nA} lanza (${nD} dijo ${dicho.join(' y ')})`, valores: [x] }], resumen: [...inicio, regla, tirada, consecuencia(e, P, ganaAtk, numeroOk, cat)] });
    } else {
      const x = dado(e), dicho = numeros[0] ?? 3;
      numeroOk = x === dicho; ganaAtk = !numeroOk;
      const regla = `Sin armas, ${nD} solo se salva si saca el número que dijo.`;
      const tirada = `${nD} dijo ${dicho} y saca ${x}: ${numeroOk ? 'se salva' : 'no cae su número'}.`;
      if (P.tipo === 'matar' && !numeroOk) {                                   // golpe de gracia: ahora lanza el atacante (4 a 6 mata, 1 a 3 solo hiere)
        mostrarDados(e, { por: P.def, npc: esNPC(e, P.def), motivo: 'pelea', titulo, grupos: [{ etq: `${nD} lanza (dijo ${dicho})`, valores: [x] }], resumen: [...inicio, regla, tirada, `Ahora ${nA} lanza el golpe: con 4 a 6 lo mata; con 1 a 3 solo lo hiere.`] });
        const y = dado(e); P.golpe = { r: y >= 4 ? 'mata' : 'hiereDef' };
        mostrarDados(e, { por: atk, npc: esNPC(e, atk), motivo: 'pelea', titulo, grupos: [{ etq: `${nA}: golpe de gracia (4 a 6)`, valores: [y] }], resumen: [`${nA} saca ${y}: ${y >= 4 ? 'golpe de gracia' : 'solo herido'}.`, textoGolpe(e, P, P.golpe)] });
      } else mostrarDados(e, { por: P.def, npc: esNPC(e, P.def), motivo: 'pelea', titulo, grupos: [{ etq: `${nD} lanza (dijo ${dicho})`, valores: [x] }], resumen: [...inicio, regla, tirada, consecuencia(e, P, ganaAtk, numeroOk, cat)] });
    }
  } else {
    const bA = bonos(data, e, atk, pA, 'atk', null), bD = bonos(data, e, def, pD, 'def', null);
    for (const [b, m] of [[bA, P.mods?.atk], [bD, P.mods?.def]]) if (m?.flecha) { b.total -= m.flecha; b.partes.push(`flecha −${m.flecha}`); }
    if (P.polvo && !P.ayudante) { bD.resta = Math.max(bD.resta, 2); const dj = e.jugadores[P.def]; quitarPrimero(dj, 'objeto', 'OB03'); devolverObjeto(data, e, 'OB03'); inicio.push(`${nD} usa Polvo de pimienta: el atacante resta 2.`); }
    const matar = P.tipo === 'matar', op = { empateTermina: matar };     // a muerte, el empate no se repite: deja heridos a los dos
    const tirar = () => (cat === 'B' ? luchaB(data, e, atk, def, bA, bD, P.ventajaB || 1, op) : luchaD(data, e, atk, def, bA, bD, undefined, op));
    let r = tirar();
    const rondas = [{ intentos: r.intentos }];
    const perdedor = r.ganaA ? def : atk;                                    // quien iba a perder puede repetir (Zein o Dado de Ibn Arabi)
    if (!r.empate) {
      if (zeinRepite(e, perdedor)) { r = tirar(); rondas.push({ intentos: r.intentos, previa: `${nombre(e, perdedor)} usa «Dados del Cairo» y repite la jugada.` }); }
      else if (dadoIbnArabi(e, perdedor)) { r = tirar(); rondas.push({ intentos: r.intentos, previa: `${nombre(e, perdedor)} usa el Dado de Ibn Arabi y repite la jugada.` }); }
    }
    ganaAtk = r.ganaA;
    if (matar) P.golpe = golpe(r.ganaA, r.margen, r.empate);
    const cierre = matar ? [textoGolpe(e, P, P.golpe)] : [`Gana ${ganaAtk ? nA : nombre(e, def)}.`, consecuencia(e, P, ganaAtk, numeroOk, cat)];
    mostrarPelea(data, e, { atk, def, bA, bD, rondas, inicio, titulo, cierre });
  }
  aplicar(data, e, { ganaAtk, numeroOk, cat });
}

function aplicar(data, e, { ganaAtk, numeroOk, cat }) {
  const P = e.pelea, A = e.jugadores[P.atk], D = e.jugadores[P.def];
  const sinArmasDef = cat === 'A' || cat === 'B';
  if (P.tipo === 'robo') {
    if (ganaAtk) robar(data, e, P.atk, P.def);
    else { log(e, `${A.nombre} no se lleva nada de ${D.nombre}.`, { pid: P.atk }); if (sinArmasDef && numeroOk) { A.herido = true; log(e, `${A.nombre} queda herido.`, { pid: P.atk }); } }
  } else if (P.tipo === 'matar' && P.golpe && P.golpe.r !== 'mata' && P.golpe.r !== 'muereAtk') {   // golpe de gracia: solo heridas
    if (P.golpe.r !== 'hiereAtk') { D.herido = true; log(e, `${D.nombre} queda herido.`, { pid: P.def }); }
    if (P.golpe.r !== 'hiereDef') { A.herido = true; log(e, `${A.nombre} queda herido.`, { pid: P.atk }); }
  } else if (P.tipo === 'matar') {
    if (ganaAtk) {
      const enmascarado = tieneObj(A, 'OB45');
      eliminar(data, e, P.def, { por: P.atk, causa: 'asesinado por ' + A.nombre });
      if (enmascarado) { quitarPrimero(A, 'objeto', 'OB45'); devolverObjeto(data, e, 'OB45'); log(e, `${A.nombre} usa la Máscara del zoco: nadie sabe quién fue; no queda Buscado.`, { pid: P.atk }); }
      else { marcarBuscado(data, e, A, { tipo: 'matar', victima: D.nombre }); log(e, `${A.nombre} queda Buscado durante ${data.config.buscadoRondas} rondas: quien lo mate gana ${data.config.recompensaBuscadoDinares ?? 100} dinares y ${data.config.recompensaBuscado} noches.`, { pid: P.atk, aviso: true }); }
      if (A.pj === '3' && D.pj === '4') {   // Jorge (8 de noviembre): si Anís mata a Jamil, cada uno de los demás le paga 8 dinares (quien no los tenga queda endeudado con el banco) y gana 60 noches
        for (const id of activos(e)) if (id !== P.atk) { e.jugadores[id].dinares -= 8; A.dinares += 8; }   // quien no tenga 8 queda endeudado con el banco
        A.noches += 60; log(e, `${A.nombre} mató a Jamil: cada jugador le paga 8 dinares y gana 60 noches.`, { pid: P.atk, aviso: true });
      }
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
  if (L.herido) {                                                             // regla de la casa: quien pierde un duelo estando herido, muere
    log(e, `${L.nombre} ya estaba herido y pierde el duelo: muere a manos de ${G.nombre}.`, { pid: ganador, aviso: true });
    eliminar(data, e, perdedor, { por: ganador, causa: 'murió en duelo estando herido' });
    return;
  }
  const nur = P.nur || (['1'].includes(G.pj) || L.pj === '1') && ['El Cairo', 'Damasco', 'Aleppo'].includes(G.ciudad);
  let din, noc;
  if (nur && G.pj === '1') { din = Math.max(0, Math.floor(L.dinares / 2)); noc = L.noches; }
  else if (nur && L.pj === '1') { din = L.dinares; noc = 0; }
  else { din = Math.max(0, Math.floor(L.dinares / 2)); noc = Math.min(data.config.duelo.nochesPerdedor, L.noches); }
  L.dinares -= din; L.noches -= noc; G.dinares += din; G.noches += noc;
  L.herido = true;
  if (e.mods?.premioDuelo && ['Andalucía', 'Magreb'].includes(G.ciudad)) { G.dinares += e.mods.premioDuelo; log(e, `${G.nombre} cobra ${e.mods.premioDuelo} dinares del banco (Mercenarios de la frontera).`, { pid: ganador }); }
  log(e, `${G.nombre} gana el duelo: ${L.nombre} entrega ${din} dinares y ${noc} noches y queda herido.`, { pid: ganador });
  if (G.pj === 'B' && G.npc && P.atk === ganador) { L.noches += 50; log(e, `${L.nombre} perdió el duelo que le impuso Yafar, pero gana 50 noches por la historia que va a contar.`, { pid: perdedor }); }   // Jorge (punto 12)
}

// R 12.1: el ladrón toma dinares, objetos, mapas y cartas poseídas (no noches, ni Mensajes, ni dinares escondidos).
function robar(data, e, atk, def) {
  const A = e.jugadores[atk], D = e.jugadores[def];
  const din = Math.max(0, D.dinares); D.dinares -= din; A.dinares += din;   // a quien tiene deudas no se le roban dinares
  const oculta = (c) => (c.tipo === 'item' && c.ref === 'jambiya' && D.extra?.jambiyaOculta)   // la jambiya escondida no se la llevan
    || (c.tipo === 'item' && c.ref === 'mapa' && c.extra?.tesoro === 'jugador');                   // ni el mapa del escondite de dinares (regla de Jorge)
  const cartas = D.mano.filter((c) => !oculta(c)); D.mano = D.mano.filter(oculta);
  for (const c of cartas) { c.priv = true; A.mano.push(c); }                // nadie ve qué se llevó: deja de ser público
  recortarMano(data, e, atk);
  log(e, `${A.nombre} roba ${din} dinares${cartas.length ? ' y ' + cartas.length + ' carta(s)' : ''} a ${D.nombre}.`, { pid: atk });
  if (A.pj === 'B' && A.npc && D.pj !== 'B') { D.noches += 20; log(e, `${D.nombre} al menos gana 20 noches para contar la historia del robo de Yafar.`, { pid: def }); }   // Jorge (punto 12)
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
  const pA = perfil(data, e, a), pB = perfil(data, e, b);
  const bA = bonos(data, e, a, pA, 'atk', null), bB = bonos(data, e, b, pB, 'def', null);
  const r = luchaD(data, e, a, b, bA, bB);
  mostrarPelea(data, e, { atk: a, def: b, bA, bD: bB, rondas: [{ intentos: r.intentos }], inicio: [titulo], titulo, cierre: [`Gana ${nombre(e, r.ganaA ? a : b)}.`] });
  return r.ganaA ? a : b;
}

// ---------------------------------------------------------------- pelea contra un NPC (retos, Patrulla, esposo de Zein, bandoleros)
// npc: {etq, dados=2, bono=0, jambiya=false}. El jugador tira 2 dados + bonos de arma (+1 por destreza, como en la Patrulla R 17.2). Empate: se repite.
export function peleaNPC(data, e, pid, npc, { tituloExtra = '' } = {}) {
  const p = perfil(data, e, pid);
  const b = bonos(data, e, pid, p, 'def', null, { contraNPC: true });
  const n0 = nombre(e, pid);
  const arco = tiroDeArco(data, e, pid);                                       // regla de la casa: el arco dispara antes de la pelea
  if (arco) mostrarDados(e, { por: pid, motivo: 'pelea', boton: 'Disparar flecha', grupos: [{ etq: `${n0} dispara una flecha a ${npc.etq}: con 5 o 6 lo pone en fuga${e.jugadores[pid].extra?.entrenado?.arco ? '; con 3 o 4 (arco entrenado), pelea con −1' : ''}`, valores: [arco.x] }], resumen: [tituloExtra, arco.acierta ? `${n0} dispara su flecha (${arco.x}) y pone en fuga a ${npc.etq}.` : arco.cubre ? `${n0} dispara su flecha (${arco.x}): ${npc.etq} tiene que cubrirse y pelea con −1.` : `${n0} dispara su flecha (${arco.x}) y falla.`].filter(Boolean) });
  if (arco?.acierta) return true;
  // El jugador lanza sus 2 dados con su botón; el NPC lanza solo, a la vista, y entonces sale el desglose.
  let gana = false, usoDado = false, primero = !arco;
  for (let g = 0; g < 50; g++) {
    const r = dados(e, 2), n = dados(e, npc.dados || 2);
    let bn = (npc.bono || 0) - (arco?.cubre ? 1 : 0), jd = null;
    if (npc.jambiya) { jd = dado(e); if (par(jd)) bn += 3; }
    const dest = p.destreza ? 1 : 0;
    const tj = suma(r) + b.total + dest, tn = suma(n) + bn - b.resta;
    mostrarDados(e, { por: pid, motivo: 'pelea', grupos: [{ etq: `${n0} lanza 2 dados`, valores: r }], resumen: [...(primero && tituloExtra ? [tituloExtra] : []), `${n0} saca ${r.join(' + ')}.`] });
    primero = false;
    const pj = [`dados ${r.join(' + ')} = ${suma(r)}`, ...b.partes.filter((x) => !/^Polvo/.test(x)), ...(dest ? ['destreza +1'] : [])];
    const pn = [`dados ${n.join(' + ')} = ${suma(n)}`, ...(npc.bono ? [`bono +${npc.bono}`] : []), ...(arco?.cubre ? ['flecha −1'] : []), ...(jd ? [`jambiya ${par(jd) ? '+3' : '+0'} (dado ${jd})`] : []), ...(b.resta ? [`polvo de pimienta −${b.resta}`] : [])];
    const res = [`${n0}: ${pj.join(' · ')} → total ${tj}.`, `${npc.etq}: ${pn.join(' · ')} → total ${tn}.`];
    let sigue = false;
    if (tj === tn) { res.push('Empate: se repite.'); sigue = true; }
    else {
      gana = tj > tn;
      if (!gana && !usoDado && dadoIbnArabi(e, pid)) { usoDado = true; res.push(`${n0} usa el Dado de Ibn Arabi y repite la pelea.`); sigue = true; }
      else res.push(gana ? `${n0} vence a ${npc.etq}.` : `${npc.etq} vence a ${n0}.`);
    }
    mostrarDados(e, { por: pid, npc: true, motivo: 'pelea', grupos: [{ etq: npc.etq, valores: [...n, ...(jd ? [jd] : [])] }], resumen: res });
    if (!sigue) break;
  }
  return gana;
}
