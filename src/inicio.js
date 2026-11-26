// Pantalla de inicio «Mil y una Noches / by Jorge Montes C.» (Jorge, 25 de noviembre); su estilo vive en index.html.
// - Al cargar la página sale desde index.html, antes que el programa, y no tiene duración mínima: se quita en cuanto el juego
//   carga (quitarInicioCarga, desde App.jsx).
// - Al comenzar la partida vuelve a salir y dura 1.5 segundos, «para ganar tiempo mientras carga el mapa y el tablero»; si el tablero
//   todavía no termina, después siguen los avisos de carga del propio tablero (Jorge: «no es necesario» esperarlo).
const DURA_MS = 1500, FUNDIDO_MS = 250;

function quitar(el) {
  if (!el || el.dataset.saliendo) return;
  el.dataset.saliendo = '1'; el.className = 'fuera';
  setTimeout(() => el.remove(), FUNDIDO_MS);
}
export function quitarInicioCarga() {
  const el = typeof document !== 'undefined' && document.getElementById('inicio');
  if (el && !el.dataset.partida) quitar(el);
}
export function mostrarInicio() {
  if (typeof document === 'undefined' || document.getElementById('inicio')) return;   // ya está en pantalla: no se encima otra
  const el = document.createElement('div');
  el.id = 'inicio'; el.dataset.partida = '1'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<h1>Mil y una Noches</h1><p>by Jorge Montes C.</p>';
  document.body.appendChild(el);
  setTimeout(() => quitar(el), DURA_MS - FUNDIDO_MS);
}
