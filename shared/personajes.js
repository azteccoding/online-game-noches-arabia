// Habilidades de los personajes (R 10): Yafar, Zein, Anís, Ruyán, Jamil, Zubayda y Adí. Nur al Din (reto de honor) y Anís (ventana) viven en pelea.js.
import {
  ok, err, dado, dados, suma, par, log, nombre, activos, enCiudad, mostrarDados, pedir, registrar, eliminar, pagar, puedePagar, puedePrincipal, vivos,
} from './base.js';
import { peleaNPC } from './pelea.js';

const jug = (e, id) => e.jugadores[id];
const zeinId = (e) => activos(e).find((x) => jug(e, x).pj === '2') || null;

// ---------------------------------------------------------------- al inicio del turno
export function inicioTurno(data, e, pid) {
  const j = jug(e, pid);
  if (j.pj === 'B') {                                                                          // R 20.2: comisión de bolsillo
    const n = enCiudad(e, j.ciudad, pid).length, eq = data.config.equilibrio || {};
    const c = Math.min(eq.yafarComisionMax ?? 15, (eq.yafarComisionPorJugador ?? 5) * n);   // equilibrio: config.json
    if (c) { j.dinares += c; log(e, `${j.nombre} cobra ${c} dinares de comisión de bolsillo.`, { pid }); }
  }
  const d = j.extra.deudaAsesinos;
  if (d) {                                                                                     // R 10.7: Zubayda debe el resto del contrato máximo 2 turnos
    if (puedePagar(data, j, d.monto)) { pagar(data, e, pid, d.monto); delete j.extra.deudaAsesinos; log(e, `${j.nombre} salda su deuda con los Asesinos.`, { pid }); }
    else if (--d.turnos < 0) { log(e, `${j.nombre} no paga a los Asesinos a tiempo y es asesinada.`, { pid }); eliminar(data, e, pid, { causa: 'deuda con los Asesinos' }); }
  }
}
export function tras() {}

// ---------------------------------------------------------------- Ruyán vende noches (R 10.5)
export function alLlegar(data, e, pid) {
  const j = jug(e, pid), t = e.turno;
  if (!t || j.pj === '5' || j.npc || j.ciudad === 'Bagdad' || j.eliminado) return;
  t.ruyan ||= [];
  if (t.ruyan.includes(j.ciudad)) return;
  const ruy = activos(e).find((x) => jug(e, x).pj === '5' && x !== pid && jug(e, x).ciudad === j.ciudad && !jug(e, x).transito);
  if (!ruy) return;
  const r = jug(e, ruy);
  if (r.noches <= 0) return;
  const noches = Math.min(50, r.noches), precio = noches >= 50 ? 5 : Math.ceil(noches / 10);
  if (j.dinares < precio) return;
  t.ruyan.push(j.ciudad);
  j.dinares -= precio; r.dinares += precio; r.noches -= noches; j.noches += noches;
  log(e, `${j.nombre} visita a ${r.nombre} y le compra ${noches} noches por ${precio} dinares.`, { pid });
}

// ---------------------------------------------------------------- Zubayda: pago en especie y apedreo (R 10.7, 12.6)
export function apedreo(data, e, pid) {
  const j = jug(e, pid), x = dado(e);
  mostrarDados(e, { por: pid, motivo: 'apedreo', grupos: [{ etq: `${j.nombre}: ¿apedreo? (par = a salvo)`, valores: [x] }], resumen: [par(x) ? `${j.nombre} está a salvo.` : `Intentan apedrear a ${j.nombre}.`] });
  marcarVergonzoso(e, pid);
  if (par(x)) return;
  castigoApedreo(data, e, pid);
}
function castigoApedreo(data, e, pid) {
  const j = jug(e, pid);
  if (j.ciudad === 'Yemen') return;
  pedir(e, { tipo: 'apedreo', para: [pid], titulo: 'La gente quiere apedrearte', texto: 'Tira 30 dinares para que los recojan en vez de lincharte, o acepta quedar herido.',
    opciones: [{ id: 'pagar', texto: 'Tirar 30 dinares', desactivada: j.dinares < 30 }, { id: 'herido', texto: 'Quedar herido' }], porDefecto: j.dinares >= 30 ? 'pagar' : 'herido', limiteMs: 30000, cont: { fn: 'pj.apedreo', args: {} } });
}
registrar('pj.apedreo', (data, e, args, resp) => {
  const j = jug(e, resp.pid);
  if (resp.opcion === 'pagar' && j.dinares >= 30) { pagar(data, e, resp.pid, 30); log(e, `${j.nombre} lanza 30 dinares y se libra del linchamiento.`, { pid: resp.pid }); }
  else { j.herido = true; log(e, `${j.nombre} queda herido por las pedradas.`, { pid: resp.pid }); }
});
function marcarVergonzoso(e, pid) { jug(e, pid).extra.vergonzoso = e.ronda; }

// ---------------------------------------------------------------- Bagdad: delitos y guardias del Califa (R 12.5)
function sobornoGuardias(data, e, pid, ctx) {
  const j = jug(e, pid), n = dado(e);
  ctx.grupos.push({ etq: `${j.nombre}: guardias del Califa`, valores: [n] });
  let costo = 5 * n; if (j.pj === 'B') costo = Math.ceil(costo / 2);
  const r = pagar(data, e, pid, costo);
  ctx.say(`${j.nombre} soborna a ${n} guardia(s) con ${costo} dinares${r.debe ? ' (no alcanza del todo)' : ''}.`);
  const jamil = activos(e).find((x) => jug(e, x).pj === '4' && jug(e, x).ciudad === 'Bagdad' && x !== pid);
  if (jamil) { jug(e, jamil).dinares += 5; ctx.say(`${jug(e, jamil).nombre} recita el crimen y cobra 5 dinares.`); }
}

const nuevoCtx = (e, pid, titulo) => ({ grupos: [], res: [], say(x) { this.res.push(x); }, fin() { if (this.grupos.length) mostrarDados(e, { por: pid, motivo: 'pj', grupos: this.grupos, resumen: [titulo, ...this.res] }); else for (const r of [titulo, ...this.res]) log(e, r, { pid }); } });

// ---------------------------------------------------------------- acciones disponibles
export function disponibles(data, e, pid) {
  const j = jug(e, pid), t = e.turno, r = [];
  if (!puedePrincipal(t) || j.transito || j.perdido) return r;
  const aqui = enCiudad(e, j.ciudad, pid).filter((x) => !jug(e, x).npc);
  if (j.pj === '6' && j.ciudad === 'Bagdad') r.push({ k: 'pj', sub: 'haren', titulo: 'Pasar la noche en el harén del Califa (+15 dinares, termina tu turno)' });
  if (['2', '6', '7'].includes(j.pj) && aqui.length) r.push({ k: 'pj', sub: 'prost', titulo: 'Rentar tu cuerpo (R 12.6)', objetivos: aqui, pidePrecio: true, texto: j.pj === '6' ? 'Entregas al cliente al menos 50 noches de tu haber.' : undefined });
  if (j.pj === '7') { const o = aqui.filter((x) => jug(e, x).pj !== '2'); if (o.length) r.push({ k: 'pj', sub: 'cuentos', titulo: 'Cuentos de noche (ambos +5 dinares, el compañero +10 noches)', objetivos: o }); }
  const zein = zeinId(e);
  if (zein && j.pj !== '7') {
    const z = jug(e, zein);
    if (zein === pid) { const o = aqui.filter((x) => jug(e, x).pj !== '7' && !(jug(e, x).pj === '5' && jug(e, x).extra.zeinRuyan)); if (o.length) r.push({ k: 'pj', sub: 'zein', titulo: 'Pasar la noche con otro jugador (R 10.3)', objetivos: o }); }
    else if (z.ciudad === j.ciudad && !z.transito && !(j.pj === '5' && j.extra.zeinRuyan)) r.push({ k: 'pj', sub: 'zein', titulo: 'Pasar la noche con Zein (R 10.3)', objetivos: [zein] });
  }
  if (j.pj === '4') {
    const o = activos(e).filter((x) => x !== pid && jug(e, x).extra.vergonzoso != null && e.ronda - jug(e, x).extra.vergonzoso <= 2 && jug(e, x).extra.difamadoRonda !== jug(e, x).extra.vergonzoso);
    if (o.length) r.push({ k: 'pj', sub: 'difamar', titulo: 'Cantar versos difamatorios (R 10.6)', objetivos: o });
  }
  return r;
}

export function accion(data, e, pid, a) {
  const t = e.turno, j = jug(e, pid);
  if (e.fase !== 'juego' || !t || t.pid !== pid) return err('No es tu turno.');
  if (t.fase === 'ingreso') return err('Primero tira el dado de ingreso.');
  if (!puedePrincipal(t)) return err('Ya usaste tu acción principal.');
  const k = jug(e, a.con);
  const valido = () => k && !k.eliminado && !k.npc && a.con !== pid && k.ciudad === j.ciudad && !k.transito;
  switch (a.sub) {
    case 'haren': {
      if (j.pj !== '6' || j.ciudad !== 'Bagdad') return err('Solo Zubayda, en Bagdad.');
      j.dinares += 15; j.extra.bajoTecho = true; j.extra.techoRonda = e.ronda;
      t.principal = true; t.sinAlojamiento = true; t.fin = true;
      log(e, `${j.nombre} pasa la noche en el harén del Califa: gana 15 dinares y queda bajo su techo.`, { pid });
      return ok();
    }
    case 'cuentos': {
      if (j.pj !== '7') return err('Solo Adí.');
      if (!valido() || k.pj === '2') return err('Compañero no válido.');
      t.principal = true;
      pedir(e, { tipo: 'trato', para: [a.con], titulo: 'Cuentos de noche', texto: `${j.nombre} te ofrece pasar la noche contando cuentos: ambos ganan 5 dinares y tú 10 noches.`, opciones: [{ id: 'si', texto: 'Aceptar' }, { id: 'no', texto: 'Rechazar' }], porDefecto: 'no', limiteMs: 45000, cont: { fn: 'pj.cuentos', args: { adi: pid } } });
      return ok();
    }
    case 'prost': {
      if (!['2', '6', '7'].includes(j.pj)) return err('Solo Zein, Zubayda o Adí pueden hacerlo.');
      if (!valido()) return err('Cliente no válido (misma ciudad).');
      const precio = Math.max(0, Math.min(200, Math.floor(a.precio || 0)));
      t.principal = true;
      pedir(e, { tipo: 'trato', para: [a.con], titulo: 'Propuesta de compañía', texto: `${j.nombre} te ofrece su compañía por ${precio} dinares${j.pj === '6' ? ' y 50 noches de su haber' : ''}.`,
        opciones: [{ id: 'si', texto: `Pagar ${precio} dinares`, desactivada: k.dinares < precio }, { id: 'no', texto: 'Rechazar' }], porDefecto: 'no', limiteMs: 45000, cont: { fn: 'pj.prost', args: { vend: pid, precio } } });
      return ok();
    }
    case 'zein': return zein(data, e, pid, a);
    case 'difamar': {
      if (j.pj !== '4') return err('Solo Jamil.');
      const v = jug(e, a.con);
      if (!v || v.eliminado || a.con === pid || v.extra.vergonzoso == null || e.ronda - v.extra.vergonzoso > 2) return err('Esa persona no ha hecho nada que cantar.');
      v.extra.difamadoRonda = v.extra.vergonzoso;
      const perdida = Math.min(v.noches, 10 * vivos(e));
      v.noches -= perdida; v.extra.sinComercioHasta = e.ronda + 1; t.principal = true;
      log(e, `${j.nombre} canta versos sobre ${v.nombre}: pierde ${perdida} noches y nadie querrá comerciar con ${v.nombre} durante 2 turnos.`, { pid });
      return ok();
    }
    default: return err('Acción de personaje desconocida.');
  }
}

registrar('pj.cuentos', (data, e, args, resp) => {
  const adi = jug(e, args.adi), c = jug(e, resp.pid);
  if (resp.opcion !== 'si' || !adi || adi.eliminado || c.eliminado || adi.ciudad !== c.ciudad) return;
  adi.dinares += 5; c.dinares += 5; c.noches += 10;
  log(e, `${adi.nombre} pasa la noche contando cuentos con ${c.nombre}: ambos ganan 5 dinares y ${c.nombre} 10 noches.`, { pid: args.adi });
});
registrar('pj.prost', (data, e, args, resp) => {
  const v = jug(e, args.vend), c = jug(e, resp.pid);
  if (resp.opcion !== 'si' || !v || v.eliminado || c.eliminado || v.ciudad !== c.ciudad || c.dinares < args.precio) return;
  const impuesto = v.ciudad === 'Yemen' ? Math.floor(args.precio / 10) : 0;
  c.dinares -= args.precio; v.dinares += args.precio - impuesto;
  if (v.pj === '6') { const n = Math.min(50, v.noches); v.noches -= n; c.noches += n; }
  log(e, `${v.nombre} y ${c.nombre} pasan la noche juntos.`, { pid: args.vend });
  marcarVergonzoso(e, args.vend);
  if (v.ciudad === 'Bagdad') { const ctx = nuevoCtx(e, args.vend, 'Guardias del Califa'); sobornoGuardias(data, e, args.vend, ctx); ctx.fin(); return; }
  const x = dado(e);
  mostrarDados(e, { por: args.vend, motivo: 'apedreo', grupos: [{ etq: `${v.nombre}: ¿apedreo? (par = a salvo)`, valores: [x] }], resumen: [par(x) ? `${v.nombre} está a salvo.` : `Intentan apedrear a ${v.nombre}.`] });
  if (!par(x)) castigoApedreo(data, e, args.vend);
});

// ---------------------------------------------------------------- Zein al Mawasif (R 10.3)
function zein(data, e, pid, a) {
  const t = e.turno, yo = jug(e, pid);
  const zid = yo.pj === '2' ? pid : zeinId(e);
  const oid = yo.pj === '2' ? a.con : pid;
  const z = jug(e, zid), o = jug(e, oid);
  if (!z || !o || z.eliminado || o.eliminado || zid === oid) return err('Participantes no válidos.');
  if (z.ciudad !== o.ciudad || z.transito || o.transito) return err('Deben estar en la misma ciudad.');
  if (o.pj === '7' || z.pj === '7') return err('Adí nunca lo haría.');
  if (o.pj === '5' && o.extra.zeinRuyan) return err('Ruyán solo puede acostarse con Zein una vez en todo el juego.');
  t.principal = true;
  const ctx = nuevoCtx(e, pid, `${z.nombre} y ${o.nombre} pasan la noche juntos.`);
  log(e, `${z.nombre} y ${o.nombre} pasan la noche juntos.`, { pid });
  if (o.pj === '5') o.extra.zeinRuyan = true;
  marcarVergonzoso(e, zid);
  const comparte = (id) => { const x = jug(e, id); if (x.ciudad === 'Bagdad') sobornoGuardias(data, e, id, ctx); };
  comparte(zid);
  const act = activos(e), v = act.map(() => dado(e));
  ctx.grupos.push({ etq: 'Todos tiran: ¿sorprende el esposo?', valores: v });
  const umbral = Math.floor(3.5 * act.length), salvo = o.pj === '5' || suma(v) > umbral;
  ctx.say(o.pj === '5' ? 'El esposo no sospecha del Sabio Ruyán.' : `Suma ${suma(v)} contra ${umbral}: ${salvo ? 'no los sorprenden' : 'los sorprende'}.`);
  const pagos = (porSalvo) => {
    const conAnis = o.pj === '3';
    z.dinares += conAnis ? 10 : 25;
    if (conAnis) o.dinares += 10 + (porSalvo ? 20 : 0);
    log(e, `${z.nombre} gana ${conAnis ? 10 : 25} dinares${conAnis ? '; Anís gana ' + (10 + (porSalvo ? 20 : 0)) : ''}.`, { pid: zid });
  };
  if (salvo) { ctx.fin(); pagos(true); return ok(); }
  if (o.pj === '3') { ctx.say('Anís se escapa por la ventana.'); ctx.fin(); pagos(false); return ok(); }
  ctx.fin();
  const gana = peleaNPC(data, e, oid, { etq: 'Esposo de Zein', dados: 2, bono: 1, jambiya: true });
  if (gana) { log(e, `${o.nombre} vence al esposo de Zein.`, { pid: oid }); pagos(false); }
  else { log(e, `${o.nombre} pierde el duelo a muerte con el esposo de Zein.`, { pid: oid }); eliminar(data, e, oid, { causa: 'duelo con el esposo de Zein' }); }
  return ok();
}

void dados; void zeinId;
