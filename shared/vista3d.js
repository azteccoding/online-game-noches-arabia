// Datos públicos que la capa 3D necesita para animar lo que YA decidió el motor: qué arma se le ve a cada jugador, qué animal
// lleva, con qué viajó la última vez y quiénes pelean. No decide nada ni revela nada que no fuera público ya.
import { tieneItem, jambiyaALaMano, ITEMS } from './base.js';
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
  const m = RE_PELEA.exec(l.texto || ''); if (!m) return null;
  const def = Object.values(e.jugadores).find((x) => x.id !== l.pid && x.nombre === m[3]); if (!def) return null;
  return { n: l.n, tipo: TIPO_PELEA[m[2]], atk: l.pid, def: def.id };
}

export function vista3d(data, e) {
  const jugadores = {};
  const viajes = {};
  let pelea = null;
  for (const l of e.log || []) {
    if (!l.pid) continue;
    const medio = medioDeViaje(l.texto); if (medio) viajes[l.pid] = { n: l.n, medio };
    pelea = peleaDeLinea(e, l) || pelea;
  }
  for (const id of Object.keys(e.jugadores || {})) {
    const j = e.jugadores[id]; if (!j?.mano) continue;
    const u = armasUsables(data, e, j, j.ciudad);                                // en Bagdad, sin Firmán, se pelea sin armas
    jugadores[id] = { arma: armaVisible(j), armaPelea: ORDEN_ARMAS.find((r) => u.includes(r) && ARMAS_ATAQUE.includes(r)) || '', arco: u.includes('arco'),
      transporte: ANIMALES.find((r) => tieneItem(j, r)) || null, viaje: viajes[id] || null };
  }
  // viva: la pelea sigue abierta (falta que el retado decida, o faltan dados). La animación empieza con los primeros dados de la pelea.
  if (pelea) pelea.viva = !!e.pelea && e.pelea.atk === pelea.atk && e.pelea.def === pelea.def;
  return { jugadores, pelea };
}
