// Datos públicos que la capa 3D necesita para animar lo que YA decidió el motor: qué arma se le ve a cada jugador, qué animal
// lleva, con qué viajó la última vez y quiénes pelean. No decide nada ni revela nada que no fuera público ya.
import { tieneItem, tieneObj, jambiyaALaMano, ITEMS, nEsclavos } from './base.js';
import { armasUsables, ARMAS_ATAQUE } from './pelea.js';

const ORDEN_ARMAS = ['cimitarra', 'alfanje', 'jambiya'];
const ANIMALES = ['caballoMongol', 'caballo', 'camello', 'burro'];
// «X viaja de A a B en burro[ y termina su turno].» lo escribe viajarPropio (engine.js); el medio es el nombre de la carta en minúsculas.
const MEDIOS = Object.fromEntries(['burro', 'caballo', 'camello', 'alfombra', 'caballoMongol'].map((ref) => [String(ITEMS[ref]?.nombre || ref).toLowerCase(), ref]));
const RE_VIAJE = /^.+ viaja de .+ a .+ en (.+?)(?: y termina su turno)?\.$/;
export const medioDeViaje = (texto) => { const m = RE_VIAJE.exec(texto || ''); return m ? MEDIOS[m[1]] || null : null; };

// Arma que se le ve: la jambiya escondida no cuenta (igual que en las peleas); el arco no es arma de cuerpo a cuerpo.
const armaVisible = (j) => ORDEN_ARMAS.find((r) => tieneItem(j, r) && !(r === 'jambiya' && !jambiyaALaMano(j))) || '';
// La última pelea entre fichas, leída de la línea del registro que escribe atacar() (shared/pelea.js).
const RE_PELEA = /^(.+?) (grita «¡Esto es un asalto!» contra|ataca a muerte a|desafía a duelo a) (.+)\.$/;
const TIPO_PELEA = { 'grita «¡Esto es un asalto!» contra': 'robo', 'ataca a muerte a': 'matar', 'desafía a duelo a': 'duelo' };
export function peleaDeLinea(e, l) {
  if (!l?.pid || !e.jugadores?.[l.pid]) return null;
  if (l.peleaNPC) return { n: l.n, tipo: 'npc', atk: 'npc:' + l.peleaNPC, def: l.pid, figura: l.peleaNPC, armaNPC: l.armaNPC || (l.peleaNPC === 'CO' ? 'jambiya' : ''), nombre: l.etq || '', ciudad: e.jugadores[l.pid].ciudad, desde: l.desde || null };   // peleaNPC (pelea.js)
  const m = RE_PELEA.exec(l.texto || ''); if (!m) return null;
  const def = Object.values(e.jugadores).find((x) => x.id !== l.pid && x.nombre === m[3]); if (!def) return null;
  return { n: l.n, tipo: TIPO_PELEA[m[2]], atk: l.pid, def: def.id, ...(l.peleaId ? { id: l.peleaId } : {}) };
}

// «X toca el laúd en C: gana…» lo escribe la acción de Jamil (shared/personajes.js, case 'laud'). Con su número de línea, la capa 3D
// sabe que tocó otra vez: lo anima y pone la música.
const RE_LAUD = /^.+ toca el laúd en .+: gana /;
export const laudDeLinea = (l) => (l?.pid && RE_LAUD.test(l.texto || '') ? { n: l.n, texto: l.texto, pieza: l.pieza === 2 ? 2 : 1 } : null);
// «Callaron a X (…)» lo escribe la votación «Que se calle Jamil» (revisarVotoLaud) cuando la mayoría lo pide: ahí deja de tocar.
const RE_CALLARON = /^Callaron a .+: deja de tocar/;

export function vista3d(data, e) {
  const jugadores = {};
  const viajes = {}, lauds = {}, callados = {};
  let pelea = null;
  for (const l of e.log || []) {
    if (!l.pid) continue;
    const medio = medioDeViaje(l.texto); if (medio) viajes[l.pid] = { n: l.n, medio };
    pelea = peleaDeLinea(e, l) || pelea;
    const laud = laudDeLinea(l); if (laud) lauds[l.pid] = laud; else if (RE_CALLARON.test(l.texto || '')) callados[l.pid] = l.n;
  }
  for (const id of Object.keys(e.jugadores || {})) {
    const j = e.jugadores[id]; if (!j?.mano) continue;
    const u = armasUsables(data, e, j, j.ciudad);                                // en Bagdad, sin Firmán, se pelea sin armas
    // Esclavo peleador (Jorge, 27 de noviembre): quien lleva al menos un esclavo de pelea tiene su monito al lado (los esclavos van a
    // la vista: son cartas públicas). esclavoArma: el arma con la que ese esclavo pelea en lugar de su amo en esta ciudad (11.3);
    // '' si no tiene ninguna. Es solo para animar: la pelea la resuelve pelea.js.
    // cargador: quien lleva al menos un esclavo de carga tiene también el monito del cargador (el de la cesta); ese nunca pelea.
    const deAtaque = ORDEN_ARMAS.filter((r) => u.includes(r) && ARMAS_ATAQUE.includes(r)), esclavo = nEsclavos(j, 'esclavoPelea') > 0;
    jugadores[id] = { arma: armaVisible(j), armaPelea: deAtaque[0] || '', arco: u.includes('arco'),
      esclavo, esclavoArma: esclavo && deAtaque.includes('alfanje') ? 'alfanje' : '',   // 11.3 (Jorge, 28 de noviembre): el esclavo lleva alfanje o nada
      cargador: nEsclavos(j, 'esclavoCarga') > 0,
      escudo: !!tieneObj(j, 'OB04'),      // el escudo de cuero va a la vista (Jorge, 12 de noviembre: lo ven su dueño y los demás)
      transporte: ANIMALES.find((r) => tieneItem(j, r)) || null, viaje: viajes[id] || null,
      // la última vez que tocó el laúd (solo Jamil); callado: esa vez lo callaron en la votación «Que se calle Jamil» (deja de tocar ya)
      laud: lauds[id] ? { ...lauds[id], callado: (callados[id] || 0) > lauds[id].n } : null };
  }
  // viva: la pelea sigue abierta (falta que el retado decida, o faltan dados). La animación empieza con los primeros dados de la pelea.
  if (pelea) pelea.viva = !!e.pelea && e.pelea.atk === pelea.atk && e.pelea.def === pelea.def;
  // Pelea contra un NPC con monito (el esposo de Zein): activa mientras queden sus dados en la mesa; mientras tanto su monito está en el tablero.
  if (pelea?.figura) pelea.activa = [e.dados, ...(e.colaDados || [])].some((d) => d && d.peleaNPC === pelea.n);
  return { jugadores, pelea };
}
