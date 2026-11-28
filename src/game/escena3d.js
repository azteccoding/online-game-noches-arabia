// Puente entre la interfaz (React) y la capa 3D (src/escena3d): guarda la escena viva y una cola para las secuencias que no
// deben pisarse (dados, peleas, cambio de ronda, ifrit). La escena solo anima lo que el servidor ya decidió.
let escena = null;
let cola = Promise.resolve();
const viajes = {};   // por jugador: promesa de su viaje en curso (los viajes de varios jugadores van a la vez)

export const escenaActual = () => escena;
export function ponerEscena(e) { escena = e; cola = Promise.resolve(); for (const k of Object.keys(viajes)) delete viajes[k]; }

// Una secuencia tras otra; un fallo de animación nunca traba el juego (se registra y se sigue).
// Ninguna secuencia retiene la cola más de MAX_MS: si la pestaña queda en segundo plano (la escena se pausa) el juego sigue.
const MAX_MS = 30000;
const conTope = (p) => new Promise((ok, mal) => { const r = setTimeout(ok, MAX_MS); Promise.resolve(p).then((v) => { clearTimeout(r); ok(v); }, (e) => { clearTimeout(r); mal(e); }); });
export function enCola(fn) {
  const p = cola.then(() => (escena ? conTope(fn(escena)) : undefined));
  cola = p.catch((err) => { console.warn('[3D]', err?.message || err); });
  return cola;
}
// Viaje de un jugador: espera al suyo anterior (dos tramos seguidos) y no bloquea a los demás.
export function viajeDe(id, fn) {
  const p = (viajes[id] || Promise.resolve()).then(() => (escena ? fn(escena) : undefined)).catch((err) => { console.warn('[3D]', err?.message || err); });
  viajes[id] = p;
  return p;
}
// De quién se muestra el turno. El servidor pasa el turno en cuanto el anterior termina, pero sus últimos dados pueden seguir
// rodando (Yafar NPC tira varios seguidos): hasta que se cierren, la mesa sigue mostrando que juega él y no «Es tu turno»
// con el botón de tirar apagado (Jorge, 23 de noviembre).
export function turnoVisible(s) {
  const t = s?.turno, d = s?.dados;
  if (t && d && t.fase === 'ingreso' && d.por !== t.pid && s.jugadores?.[d.por]) return d.por;
  return t?.pid ?? null;
}
// Los dados son de esta pelea (Jorge, 28 de noviembre, BUG5: con la Ira del cornudo se animaba la pelea anterior, con Yafar).
// Las peleas contra un NPC con monito marcan sus dados con peleaNPC (el número de su línea en el registro); las de fichas, con pelea.
export const dadosDePelea = (d, P) => !!d && !!P && (P.figura ? d.peleaNPC === P.n : !d.peleaNPC && (!d.pelea || !P.id || d.pelea === P.id)) && (d.por === P.atk || d.por === P.def);
// Arma con la que se planta cada uno: la del NPC viene con la pelea; la de un jugador, de la capa 3D.
export const armaDePelea = (e3d, P, id) => (P?.figura && id === P.atk ? P.armaNPC || '' : e3d?.jugadores?.[id]?.armaPelea || '');
export const quietos = (...ids) => Promise.all(ids.map((id) => viajes[id] || Promise.resolve()));
