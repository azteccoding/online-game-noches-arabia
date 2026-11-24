import { useEffect, useRef, useState } from 'react';
import { escenaActual, quietos } from '../game/escena3d.js';

// Juego 3D (Jorge, 23 de noviembre): «la fuente de verdad es que el monito debe llegar a la ciudad para que cualquier otra cosa
// que dependa de eso ocurra». Cuando el servidor mueve una ficha, el tablero 3D recibe el estado nuevo al momento y anima el viaje;
// el resto de la pantalla (cartas, decisiones, dados, avisos, saldos, turno) sigue mostrando el estado anterior hasta que la ficha
// llega. Devuelve [estado que se muestra, si hay un viaje en curso que lo retiene].
const TOPE_MS = 20000;   // ningún viaje retiene la pantalla más que esto (pestaña en segundo plano, escena que no avisa…)

function viajan(antes, ahora) {
  if (!antes || !ahora || !escenaActual() || antes.fase !== 'juego' || ahora.fase !== 'juego' || antes.yo !== ahora.yo || antes.codigo !== ahora.codigo) return [];
  // también retiene la pantalla quien acaba de tocar el laúd (Jamil): su premio sale cuando termina de tocar
  const tocoLaud = (id) => (ahora.e3d?.jugadores?.[id]?.laud?.n || 0) > (antes.e3d?.jugadores?.[id]?.laud?.n || 0) && !!antes.e3d;
  return Object.keys(ahora.jugadores || {}).filter((id) => { const a = antes.jugadores?.[id], b = ahora.jugadores[id]; return a && b.pj && !b.eliminado && (a.ciudad !== b.ciudad || tocoLaud(id)); });
}

export function useTrasViajes(s) {
  const mostrado = useRef(s), ultimo = useRef(s), espera = useRef(null);
  const [, pintar] = useState(0);
  ultimo.current = s;
  if (!espera.current) {
    const ids = viajan(mostrado.current, s);
    if (ids.length) espera.current = { ids, lanzada: false }; else mostrado.current = s;
  }
  useEffect(() => {
    const w = espera.current; if (!w || w.lanzada) return;
    w.lanzada = true;                                     // el tablero (hijo) ya pidió el viaje a la escena: aquí se espera a que termine
    let reloj = 0;
    const soltar = () => { if (espera.current !== w) return; clearTimeout(reloj); espera.current = null; mostrado.current = ultimo.current; pintar((n) => n + 1); };
    reloj = setTimeout(soltar, TOPE_MS);
    quietos(...w.ids).then(soltar, soltar);
  });
  useEffect(() => () => { espera.current = null; }, []);
  return [mostrado.current, !!espera.current];
}
