import { useSyncExternalStore } from 'react';

// Sprites de personajes (/svg/sprites.svg) incrustados UNA vez en la página. Safari/WebKit no resuelve los degradados
// (fill="url(#…)") de un <use> que apunta a un archivo externo y pinta las fichas sin relleno; con los símbolos en el
// propio documento se usa <use href="#p1"> y se ven igual en todos los navegadores.
let listo = false, pedido = false;
const oyentes = new Set();

function cargar() {
  if (pedido || typeof document === 'undefined') return;
  pedido = true;
  fetch('/svg/sprites.svg').then((r) => r.text()).then((svg) => {
    const caja = document.createElement('div');
    caja.setAttribute('aria-hidden', 'true');
    caja.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';      // no display:none: rompería los degradados
    caja.innerHTML = svg;
    document.body.prepend(caja);
    listo = true; oyentes.forEach((f) => f());
  }).catch(() => { pedido = false; });
}

// Devuelve el href para <use>: el símbolo incrustado en cuanto está cargado (mientras tanto, el archivo externo).
export function useSprite(id) {
  cargar();
  const ok = useSyncExternalStore((f) => { oyentes.add(f); return () => oyentes.delete(f); }, () => listo, () => false);
  return ok ? `#${id}` : `/svg/sprites.svg#${id}`;
}
