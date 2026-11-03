// Eventos (E1-E12) y Eventos históricos (H1-H20) (R 17). Los efectos de la ronda viven en e.mods (se borra cada ronda).
// Los NPC (Yafar) no responden decisiones: sufren los efectos automáticos y eligen siempre por regla (R 20.5).
import {
  ok, err, dado, dados, suma, par, log, nombre, ciudadDe, activos, humanosVivos, enCiudad, tieneItem, tieneObj, tieneEsp, quitarPrimero, quitarCarta, uid, darItem, pagar, patrimonio, tarifa, esLibro, mostrarDados, consumirObj,
  pedir, registrar, ofrecerObjetos, HOOK, eliminar, publicarCarta, cartaDatos, ITEMS,
} from './base.js';
import { luchaLibre, peleaNPC, perfil, armasUsables, tiroDeArco, golpeAlEscudo } from './pelea.js';
import * as NPC from './npc.js';

const jug = (e, id) => e.jugadores[id];
const humanosEn = (e, ciudades) => activos(e).filter((id) => ciudades.includes(jug(e, id).ciudad) && !jug(e, id).transito && !jug(e, id).perdido);
const ordenadoPorTurno = (e, ids) => ids.slice().sort((a, b) => e.orden.indexOf(a) - e.orden.indexOf(b));
const mover = (data, e, pid, destino, costo = 0, motivo = '') => {
  const j = jug(e, pid); const p = pagar(data, e, pid, costo);
  const o = j.ciudad; j.ciudad = destino; j.extra.ciudadPrevia = o;
  log(e, `${j.nombre} ${motivo || 'viaja'} de ${o} a ${destino}${costo ? ` (paga ${costo})` : ''}.`, { pid });
  if (!j.visitadas.includes(destino)) j.visitadas.push(destino);
};
const vecinas = (data, ciudad) => Object.entries(data.rutas.tarifas).filter(([k]) => k.startsWith(ciudad + '>')).map(([k, v]) => ({ id: k.split('>')[1], tarifa: v }));
const vecinaBarata = (data, ciudad, excl = []) => vecinas(data, ciudad).filter((x) => !excl.includes(x.id)).sort((a, b) => a.tarifa - b.tarifa)[0]?.id || 'Bagdad';

// ---------------------------------------------------------------- Eventos
// Las tiradas que provoca una carta llevan su título como contexto (se muestra antes de lanzar los dados).
function conContexto(e, titulo, fn) { const antes = e.ctxCarta; e.ctxCarta = titulo; try { return fn(); } finally { e.ctxCarta = antes; } }
export function aplicarEvento(data, e, id) { return conContexto(e, data.eventos.eventos.find((x) => x.id === id)?.nombre, () => aplicarEvento0(data, e, id)); }
export function aplicarHistorico(data, e, id) { return conContexto(e, data.eventos.historicos.find((x) => x.id === id)?.nombre, () => aplicarHistorico0(data, e, id)); }
function aplicarEvento0(data, e, id) {
  const act = activos(e);
  switch (id) {
    case 'E1': NPC.eventoAsesinos(data, e); break;
    case 'E2': e.mods.ladrones = true; break;
    case 'E3': e.sinCaravanasBagdad = true; break;
    case 'E4': break;
    case 'E5': {
      e.mods.armasBagdad = true;
      const en = act.filter((x) => jug(e, x).ciudad === 'Bagdad' && !jug(e, x).transito && !jug(e, x).perdido);
      for (let i = 0; i + 1 < en.length; i += 2) {
        const g = luchaLibre(data, e, en[i], en[i + 1], 'Torneo del Califa');
        jug(e, g).noches += 30; log(e, `${jug(e, g).nombre} gana el torneo y 30 noches.`, { pid: g });
      }
      break;
    }
    case 'E6': e.mods.piratas = true; break;
    case 'E7': {
      const cand = act.slice().sort((a, b) => jug(e, b).noches - jug(e, a).noches);
      for (const c of cand) {
        if (tieneObj(jug(e, c), 'OB42')) { consumirObj(data, e, c, 'OB42'); log(e, `${jug(e, c).nombre} se libra de la cacería con su Disfraz de mendigo.`); continue; }
        e.evento.buscadoE7 = c; log(e, `El Califa declara «buscado» a ${jug(e, c).nombre}: quien lo mate esta ronda gana 200 noches y 40 dinares.`, { pid: c }); break;
      }
      break;
    }
    case 'E8': {
      const c = act.slice().sort((a, b) => jug(e, b).dinares - jug(e, a).dinares)[0];
      if (!c) break;
      if (!peleaNPC(data, e, c, { etq: 'Esposo de Zein', dados: 2, bono: 1, jambiya: true })) { const j = jug(e, c); j.noches = Math.max(0, j.noches - 30); log(e, `${j.nombre} pierde ante el esposo de Zein: -30 noches.`, { pid: c }); }
      break;
    }
    case 'E9': e.mods.sindbad = true; break;
    case 'E10': e.mods.mercaderArmas = true; break;
    case 'E11': e.mods.emboscada = true; break;
    case 'E12': e.mods.feria = true; break;
    default: break;
  }
}

// E2: se aplica cuando un jugador termina su turno sin haberse movido.
export function finTurno(data, e, pid) {
  const j = jug(e, pid), t = e.turno;
  if (e.mods.ladrones && t && !t.movio && !j.eliminado) {
    if (tieneObj(j, 'OB23')) { consumirObj(data, e, pid, 'OB23'); log(e, `${j.nombre} espanta a los ladrones con su Amuleto de turquesa.`, { pid }); return; }
    const arco = tiroDeArco(data, e, pid), esc = arco?.acierta ? null : golpeAlEscudo(data, e, pid);   // regla de la casa: arco y escudo
    if (arco || esc) mostrarDados(e, { por: pid, motivo: 'defensa', grupos: [arco && { etq: `${j.nombre} dispara su arco a los ladrones (5 o 6)`, valores: [arco.x] }, esc && { etq: `${j.nombre} levanta su escudo (5 o 6 para; 1 lo rompe)`, valores: [esc.x] }].filter(Boolean), resumen: [] });
    if (arco?.acierta || esc?.para) { log(e, `${j.nombre} ahuyenta a los ladrones de Alí Babá ${arco?.acierta ? 'con su arco' : 'con su escudo'}.`, { pid }); return; }
    const p = Math.max(0, Math.min(10, j.dinares)); j.dinares -= p; log(e, `Los ladrones de Alí Babá asaltan a ${j.nombre}: pierde ${p} dinares.`, { pid });
  }
}

// ---------------------------------------------------------------- Eventos históricos
function aplicarHistorico0(data, e, id) {
  const cola = (ids, fn) => { const ord = ordenadoPorTurno(e, ids.filter((x) => !jug(e, x).npc)); ord.forEach((x, i) => fn(x, i === ord.length - 1)); };
  switch (id) {
    case 'H1': cola(humanosEn(e, ['Bagdad', 'Basra']), (pid) => {
      const j = jug(e, pid);
      const op = vecinas(data, j.ciudad).filter((x) => !['Bagdad', 'Basra'].includes(x.id)).map((x) => ({ id: x.id, texto: `Huir a ${x.id} (${Math.min(30, x.tarifa * 3)} dinares)` }));
      op.push({ id: 'quedar', texto: 'Aguantar: -30 noches y sin ingreso este turno' });
      pedir(e, { tipo: 'historico', para: [pid], titulo: 'Rebelión de los Zanj', texto: 'Huye de Iraq o aguanta.', opciones: op, porDefecto: 'quedar', cont: { fn: 'ev.h1', args: {} } });
    }); break;
    case 'H2': cola(humanosEn(e, ['Andalucía']), (pid) => pedir(e, { tipo: 'historico', para: [pid], titulo: 'Los cristianos toman Toledo', texto: 'Paga 20 dinares a un rey cristiano para quedarte o abandona al-Ándalus.',
      opciones: [{ id: 'quedar', texto: 'Quedarme (20 dinares)' }, { id: 'Magreb', texto: `Irme al Magreb (${tarifa(data, e, jug(e, pid), 'Andalucía', 'Magreb')})` }, { id: 'El Cairo', texto: `Irme a El Cairo (${tarifa(data, e, jug(e, pid), 'Andalucía', 'El Cairo')})` }, { id: 'Bagdad', texto: `Irme a Bagdad (${tarifa(data, e, jug(e, pid), 'Andalucía', 'Bagdad')})` }], porDefecto: 'quedar', cont: { fn: 'ev.h2', args: {} } })); break;
    case 'H3': e.mods.premioDuelo = 30; break;
    case 'H4': {
      const ids = ordenadoPorTurno(e, humanosEn(e, ['Damasco', 'Bagdad']).filter((x) => !jug(e, x).npc));
      if (ids.length) pedir(e, { tipo: 'historico', modo: 'una', para: ids, titulo: 'Revolución abasí', texto: 'Puedes saquear: +40 dinares del banco (el segundo en tu ciudad, 20). Precio: -20 noches y el marcador Buscado (2 rondas).', opciones: [{ id: 'si', texto: 'Saquear' }, { id: 'no', texto: 'No' }], porDefecto: 'no', cont: { fn: 'ev.h4', args: {} } });
      break;
    }
    case 'H5': e.mods.almoravides = true; break;
    case 'H6': e.mods.francos = true; break;
    case 'H7': {
      const ids = ordenadoPorTurno(e, humanosEn(e, ['Damasco', 'Aleppo', 'El Cairo']));
      ids.forEach((pid, i) => {
        const j = jug(e, pid), puede = armasUsables(data, e, j).length > 0 && j.destreza || (j.destreza && ['arco', 'alfanje', 'cimitarra', 'jambiya'].some((r) => tieneItem(j, r)));
        const op = []; if (puede) op.push({ id: 'alistar', texto: 'Alistarme (+30 dinares; pierdo mi acción principal del siguiente turno)' });
        op.push({ id: 'pagar', texto: 'Pagar 10 dinares' }); op.push({ id: 'noches', texto: 'Perder 15 noches' });
        pedir(e, { tipo: 'historico', para: [pid], titulo: 'Leva del sultán', texto: 'El sultán recluta soldados.', opciones: op, porDefecto: 'noches', cont: { fn: 'ev.h7', args: { ultimo: i === ids.length - 1 } } });
      });
      break;
    }
    case 'H8': e.mods.sabiduria = true; break;
    case 'H9': e.mods.oroMali = true; break;
    case 'H10': e.mods.seda = true; break;
    case 'H11': cola(humanosEn(e, ['India']), (pid) => pedir(e, { tipo: 'historico', para: [pid], titulo: 'Vientos del monzón', texto: 'Debes irte de India o quedarás varado.', opciones: [{ id: 'Isfahán', texto: `Irme a Isfahán (${Math.ceil((data.rutas.tarifas['India>Isfahán'] || 0) / 2)} dinares)` }, { id: 'Basra', texto: 'Irme a Basra (barco de Sindbad, gratis)' }, { id: 'varado', texto: 'Quedarme varado (alojamiento doble)' }], porDefecto: 'Basra', cont: { fn: 'ev.h11', args: {} } })); break;
    case 'H12': {
      const ids = humanosEn(e, ['Bagdad']);
      if (ids.length === 1) {
        const pid = ids[0], x = dado(e), j = jug(e, pid);
        mostrarDados(e, { por: pid, motivo: 'h12', grupos: [{ etq: `${j.nombre} en la guerra entre hermanos`, valores: [x] }], resumen: [par(x) ? 'Par: gana 15 dinares.' : 'Impar: paga 15 dinares.'] });
        if (par(x)) j.dinares += 15; else pagar(data, e, pid, 15);
      } else if (ids.length > 1) pedir(e, { tipo: 'historico', modo: 'todos', para: ids, titulo: 'Guerra entre hermanos herederos', texto: 'Elige tu bando en secreto: puño cerrado o mano abierta.', opciones: [{ id: 'puno', texto: 'Puño cerrado' }, { id: 'mano', texto: 'Mano abierta' }], porDefecto: 'puno', cont: { fn: 'ev.h12', args: {} } });
      break;
    }
    case 'H13': e.mods.cordoba = true; break;
    case 'H14': e.mods.selyuqui = true; cola(humanosEn(e, ['Isfahán']), (pid) => preguntaBanquete(data, e, pid)); break;
    case 'H15': e.mods.nilo = true; e.mods.niloAloj = true; break;
    case 'H16': e.mods.rihla = true; break;
    case 'H17': e.mods.especias = true; cola(humanosEn(e, ['Yemen', 'Basra', 'India']), (pid) => preguntaEspecias(data, e, pid)); break;
    case 'H18': e.mods.salteadores = true; break;
    case 'H19': {
      for (const ciudad of ['Bagdad', 'Basra', 'Damasco', 'El Cairo']) {
        let ids = activos(e).filter((x) => jug(e, x).ciudad === ciudad && !jug(e, x).transito);
        ids = ids.filter((x) => { if (tieneObj(jug(e, x), 'OB42')) { consumirObj(data, e, x, 'OB42'); log(e, `${jug(e, x).nombre} pasa inadvertido con su Disfraz de mendigo.`); return false; } return true; });
        if (!ids.length) continue;
        const max = Math.max(...ids.map((x) => jug(e, x).dinares)); // los dinares escondidos no cuentan
        for (const pid of ordenadoPorTurno(e, ids.filter((x) => jug(e, x).dinares === max))) {
          const j = jug(e, pid);
          if (j.npc) { if (j.dinares >= 40) { pagar(data, e, pid, 20); log(e, 'Yafar NPC paga a los recaudadores.'); } else mover(data, e, pid, vecinaBarata(data, ciudad), 0, 'huye de los recaudadores'); continue; }
          pedir(e, { tipo: 'historico', para: [pid], titulo: 'Los recaudadores del Califa', texto: 'Tienes más dinares que nadie en esta ciudad: paga o vete.', opciones: [{ id: 'pagar', texto: 'Pagar 20 dinares' }, { id: 'ir', texto: 'Irme (tarifa normal)' }], porDefecto: 'pagar', cont: { fn: 'ev.h19', args: {} } });
        }
      }
      break;
    }
    case 'H20': {
      for (const pid of humanosEn(e, ['Yemen', 'Basra'])) {
        const j = jug(e, pid);
        for (const animal of ['caballo', 'camello', 'burro']) {
          while (tieneItem(j, animal)) {
            if (tieneObj(j, 'OB18') && !j.extra.odreH20) { j.extra.odreH20 = true; consumirObj(data, e, pid, 'OB18'); log(e, `${j.nombre} paga el agua con su Odre.`, { pid }); quitarSoloMarca(j, animal); continue; }
            if (j.dinares >= 5) { j.dinares -= 5; quitarSoloMarca(j, animal); log(e, `${j.nombre} paga 5 dinares por el agua de su ${animal}.`, { pid }); } else { quitarPrimero(j, 'item', animal); log(e, `${j.nombre} pierde su ${animal} por la sequía.`, { pid }); }
          }
        }
        for (const c of j.mano) if (c.extra?.h20) delete c.extra.h20;
        j.extra.odreH20 = false;
      }
      break;
    }
    default: break;
  }
}
// marca un animal como ya procesado en H20 para no repetir el cobro
function quitarSoloMarca(j, animal) { const c = j.mano.find((x) => x.tipo === 'item' && x.ref === animal && !x.extra?.h20); if (c) { c.extra = { ...(c.extra || {}), h20: true }; } const sig = j.mano.find((x) => x.tipo === 'item' && x.ref === animal && !x.extra?.h20); if (!sig) { /* fin: el bucle while se corta al marcar todos */ } }

function preguntaBanquete(data, e, pid) {
  pedir(e, { tipo: 'historico', para: [pid], titulo: 'La corte selyúcida en Isfahán', texto: 'Asistir al banquete del sultán cuesta 10 dinares y da 30 noches. Al final, un dado: 1 pierdes tu siguiente acción principal; 6 recibes 10 dinares de propina.', opciones: [{ id: 'si', texto: 'Asistir (10 dinares)' }, { id: 'no', texto: 'No asistir' }], porDefecto: 'no', cont: { fn: 'ev.h14', args: {} } });
}
function preguntaEspecias(data, e, pid) {
  const j = jug(e, pid);
  pedir(e, { tipo: 'historico', para: [pid], titulo: 'Temporada de especias', texto: 'Puedes comprar hasta 2 fardos a 15 dinares y venderlos en Bagdad por 30 sin impuesto.', modo: 'numero', min: 0, max: Math.min(2, Math.floor(j.dinares / 15)), porDefecto: 0, cont: { fn: 'ev.h17', args: {} } });
}

registrar('ev.h1', (data, e, args, resp) => {
  const pid = resp.pid, j = jug(e, pid);
  if (resp.opcion === 'quedar') { j.noches = Math.max(0, j.noches - 30); (e.mods.sinIngreso ||= {})[pid] = true; log(e, `${j.nombre} aguanta la rebelión: -30 noches.`, { pid }); return; }
  const t = Math.min(30, tarifa(data, e, j, j.ciudad, resp.opcion) * 3 * (j.pj === 'B' ? 1 : 1));
  mover(data, e, pid, resp.opcion, t, 'huye de la rebelión');
});
registrar('ev.h2', (data, e, args, resp) => {
  const pid = resp.pid, j = jug(e, pid);
  if (resp.opcion === 'quedar') { if (j.dinares < 20) { mover(data, e, pid, 'Magreb', 0, 'no tiene los 20 dinares y es escoltado por un rey cristiano'); return; } pagar(data, e, pid, 20); log(e, `${j.nombre} paga 20 dinares y se queda en Andalucía.`, { pid }); return; }
  const t = tarifa(data, e, j, 'Andalucía', resp.opcion);
  if (patrimonio(j) < t * 1) mover(data, e, pid, 'Magreb', 0, 'es escoltado al Magreb'); else mover(data, e, pid, resp.opcion, t, 'abandona al-Ándalus');
});
registrar('ev.h4', (data, e, args, resp) => {
  const ord = ordenadoPorTurno(e, Object.keys(resp).filter((k) => resp[k].opcion === 'si')), vistos = {};
  for (const pid of ord) {
    const j = jug(e, pid), c = j.ciudad; vistos[c] = (vistos[c] || 0) + 1;
    j.dinares += vistos[c] === 1 ? 40 : 20; j.noches = Math.max(0, j.noches - 20); j.buscado = data.config.buscadoRondas;
    log(e, `${j.nombre} saquea durante la revolución: +${vistos[c] === 1 ? 40 : 20} dinares, -20 noches y es Buscado.`, { pid });
  }
});
registrar('ev.h7', (data, e, args, resp) => {
  const pid = resp.pid, j = jug(e, pid);
  if (resp.opcion === 'alistar') { j.dinares += 30; j.extra.sinPrincipal = true; (e.mods.alistados ||= []).push(pid); log(e, `${j.nombre} se alista en la leva del sultán.`, { pid }); }
  else if (resp.opcion === 'pagar' && j.dinares >= 10) { j.dinares -= 10; } else { j.noches = Math.max(0, j.noches - 15); }
  if (args.ultimo) {
    const por = {}; for (const x of e.mods.alistados || []) (por[jug(e, x).ciudad] ||= []).push(x);
    for (const [c, ids] of Object.entries(por)) for (let i = 0; i + 1 < ids.length; i += 2) { const g = luchaLibre(data, e, ids[i], ids[i + 1], 'Duelo de entrenamiento (sin heridas ni muertes)'); jug(e, g).dinares += 20; log(e, `${jug(e, g).nombre} gana el duelo de entrenamiento y 20 dinares.`, { pid: g }); }
    e.mods.alistados = [];
  }
});
registrar('ev.h11', (data, e, args, resp) => {
  const pid = resp.pid, j = jug(e, pid);
  if (resp.opcion === 'varado') { (e.mods.varado ||= {})[pid] = true; (e.mods.alojDoble ||= []).push('India'); log(e, `${j.nombre} queda varado en India.`, { pid }); return; }
  if (resp.opcion === 'Basra') mover(data, e, pid, 'Basra', 0, 'embarca con Sindbad'); else mover(data, e, pid, 'Isfahán', Math.ceil(tarifa(data, e, j, 'India', 'Isfahán') / 2), 'se va de India');
});
registrar('ev.h12', (data, e, args, resp) => {
  const lados = { puno: [], mano: [] }; for (const [k, v] of Object.entries(resp)) lados[v.opcion].push(k);
  log(e, `Guerra entre hermanos: puño (${lados.puno.map((x) => nombre(e, x)).join(', ') || '—'}) frente a mano (${lados.mano.map((x) => nombre(e, x)).join(', ') || '—'}).`);
  if (lados.puno.length === lados.mano.length) return;
  const perd = lados.puno.length < lados.mano.length ? lados.puno : lados.mano, gan = perd === lados.puno ? lados.mano : lados.puno;
  for (const p of perd) {
    const j = jug(e, p);
    if (j.dinares >= 15 * gan.length) { for (const g of gan) { j.dinares -= 15; jug(e, g).dinares += 15; } log(e, `${j.nombre} paga 15 dinares a cada ganador.`, { pid: p }); }
    else mover(data, e, p, 'Damasco', 0, 'huye a Damasco');
  }
});
registrar('ev.h14', (data, e, args, resp) => {
  const pid = resp.pid, j = jug(e, pid);
  if (resp.opcion !== 'si' || j.dinares < 10) return;
  j.dinares -= 10; j.noches += 30; const x = dado(e);
  mostrarDados(e, { por: pid, motivo: 'h14', grupos: [{ etq: `${j.nombre} en el banquete`, valores: [x] }], resumen: [x === 1 ? 'Pierde su acción principal del siguiente turno.' : x === 6 ? 'Propina de 10 dinares.' : 'Sin novedad.'] });
  if (x === 1) j.extra.sinPrincipal = true; if (x === 6) j.dinares += 10;
});
registrar('ev.h17', (data, e, args, resp) => {
  const pid = resp.pid, j = jug(e, pid), n = Math.min(resp.numero || 0, Math.floor(j.dinares / 15));
  if (!n) return; j.dinares -= 15 * n; for (let i = 0; i < n; i++) darItem(e, j, 'especias', { ronda: e.ronda }); log(e, `${j.nombre} compra ${n} fardo(s) de especias.`, { pid });
});
registrar('ev.h19', (data, e, args, resp) => {
  const pid = resp.pid, j = jug(e, pid);
  if (resp.opcion === 'pagar' && j.dinares >= 20) { pagar(data, e, pid, 20); log(e, `${j.nombre} paga 20 dinares a los recaudadores.`, { pid }); return; }   // sin los 20 dinares completos, huye
  const dest = vecinaBarata(data, j.ciudad); mover(data, e, pid, dest, tarifa(data, e, j, j.ciudad, dest) ?? 0, 'huye de los recaudadores');
});
registrar('ev.h13', (data, e, args, resp) => { const pid = resp.pid, j = jug(e, pid); if (resp.opcion === 'si' && j.dinares >= 10) { j.dinares -= 10; j.noches += 25; log(e, `${j.nombre} disfruta de los baños y el banquete de Córdoba: +25 noches.`, { pid }); } });

// ---------------------------------------------------------------- al salir: patrullas, emboscadas (E11, H6, H18)
export function salida(data, e, pid, args, paso = 0) {
  const j = jug(e, pid), origen = j.ciudad, dest = args.destino;
  const pasos = [];
  if (e.mods.emboscada) pasos.push('E11');
  if (e.mods.francos && ['Damasco', 'Aleppo'].includes(origen)) pasos.push('H6');
  if (e.mods.salteadores && ((origen === 'Bagdad' && dest === 'Isfahán') || (origen === 'Isfahán' && dest === 'Bagdad'))) pasos.push('H18');
  for (let i = paso; i < pasos.length; i++) {
    const p = pasos[i];
    if (p === 'E11') {
      const x = dado(e);
      mostrarDados(e, { por: pid, motivo: 'e11', grupos: [{ etq: `${j.nombre}: emboscada en el camino`, valores: [x] }], resumen: [x === 1 ? 'Bandidos: pierdes la mitad de tus dinares.' : 'Pasas sin problemas.'] });
      if (x === 1) { if (tieneObj(j, 'OB29')) { consumirObj(data, e, pid, 'OB29'); log(e, 'El Salvoconducto del Califa te libra de los bandidos.'); } else j.dinares = Math.ceil(j.dinares / 2); }
      continue;
    }
    if (tieneObj(j, 'OB29')) { consumirObj(data, e, pid, 'OB29'); log(e, `${j.nombre} muestra su Salvoconducto del Califa: nadie le cobra peaje.`, { pid }); continue; }
    const op = [];
    if (j.dinares >= 10) op.push({ id: 'pagar', texto: p === 'H6' ? 'Pagar la escolta (10 dinares)' : 'Pagar a los salteadores (10 dinares)' });
    op.push({ id: 'pelear', texto: 'Pelear contra la Patrulla (gana +20 dinares, pierde −20 y queda herido)' });
    pedir(e, { tipo: 'historico', para: [pid], titulo: p === 'H6' ? 'Los francos en el camino' : 'Salteadores de la ruta de Persia', texto: 'Paga o pelea.', opciones: op, porDefecto: op[0].id, cont: { fn: 'ev.salida', args: { pid, args, paso: i + 1 } } });
    return true;
  }
  return false;
}
registrar('ev.salida', (data, e, args, resp) => {
  const pid = args.pid, j = jug(e, pid);
  if (resp.opcion === 'pagar') { j.dinares -= 10; }
  else if (peleaNPC(data, e, pid, { etq: 'Patrulla', dados: 2, bono: 0 })) { j.dinares += 20; log(e, `${j.nombre} vence a la Patrulla: +20 dinares.`, { pid }); }
  else { pagar(data, e, pid, 20); j.herido = true; log(e, `${j.nombre} pierde ante la Patrulla: −20 dinares y herido.`, { pid }); }
  if (j.eliminado) return;
  if (salida(data, e, pid, args.args, args.paso)) return;
  HOOK.partir(data, e, pid, args.args);
});

// ---------------------------------------------------------------- al llegar a una ciudad
export function alLlegar(data, e, pid, origen, primera) {
  const j = jug(e, pid), t = e.turno, c = j.ciudad, m = e.mods;
  if (m.almoravides && ((origen === 'Magreb' && c === 'Andalucía') || (origen === 'Andalucía' && c === 'Magreb'))) {
    j.noches += 15; const x = dado(e);
    mostrarDados(e, { por: pid, motivo: 'h5', grupos: [{ etq: `${j.nombre}: el ejército almorávide`, valores: [x] }], resumen: [x === 1 ? 'El ejército requisa 10 dinares.' : 'Sin requisas.'] });
    if (x === 1) j.dinares = Math.max(0, j.dinares - 10);
  }
  if (m.sabiduria && c === 'Bagdad' && j.mano.some(esLibro)) { j.dinares += 20; log(e, `${j.nombre} llega a la Casa de la Sabiduría con un libro: +20 dinares.`, { pid }); }
  if (m.oroMali && c === 'El Cairo') { j.dinares += 20; log(e, `${j.nombre} recibe una propina de oro en El Cairo: +20 dinares.`, { pid }); }
  if (m.seda && c === 'Samarcanda') { j.noches += 20; log(e, `${j.nombre} llega a Samarcanda por la Ruta de la Seda: +20 noches.`, { pid }); }
  if (m.rihla && t && t.tramos === 2 && !t.rihlaPagada) { t.rihlaPagada = true; j.noches += 20; log(e, `${j.nombre} completa un viaje de estudio: +20 noches.`, { pid }); }
  if (j.npc) return;
  if (m.cordoba && c === 'Andalucía') pedir(e, { tipo: 'historico', para: [pid], titulo: 'Esplendor de Córdoba', texto: 'Baños y banquete: paga 10 dinares y gana 25 noches.', opciones: [{ id: 'si', texto: 'Pagar 10 dinares' }, { id: 'no', texto: 'No' }], porDefecto: 'no', cont: { fn: 'ev.h13', args: {} } });
  if (m.selyuqui && c === 'Isfahán') preguntaBanquete(data, e, pid);
  if (m.especias && ['Yemen', 'Basra', 'India'].includes(c)) preguntaEspecias(data, e, pid);
}
export function finRonda(data, e) {}
