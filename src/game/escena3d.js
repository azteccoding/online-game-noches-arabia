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
export const quietos = (...ids) => Promise.all(ids.map((id) => viajes[id] || Promise.resolve()));
