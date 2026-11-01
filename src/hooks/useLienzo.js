import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Vista del juego. Todo el DOM del juego (modales incluidos) cuelga del «lienzo»; los gestos del tablero se corrigen con la rotación (ver usePanZoom).
//  - horizontal: el lienzo es siempre más ancho que alto. Si la ventana es vertical, el lienzo se gira 90° con CSS.
//  - vertical: el lienzo es más alto que ancho (columna centrada en pantallas anchas) y el tablero se gira 90° dentro de él.
// Modo según la fase:
//  - antes de la partida (entrada, sala, elegir personaje): VERTICAL si la pantalla está en vertical; en pantallas anchas, horizontal (sin cambios).
//  - al empezar la partida: HORIZONTAL. Si el jugador eligió otra vista durante ESTA partida (mismo código de sala), se respeta al recargar o reconectar.
// El selector cambia la vista al instante dentro de la fase; solo se guarda (localStorage, por dispositivo) la elección hecha en partida.
const CLAVE = 'mun.vista', CLAVE_SALA = 'mun.vista.sala';
const leerGuardado = (sala) => {
  try { return sala && localStorage.getItem(CLAVE_SALA) === sala ? (localStorage.getItem(CLAVE) === 'vertical' ? 'vertical' : 'horizontal') : null; } catch { return null; }
};

export function geometria(modo, vw, vh) {
  const rotar = modo === 'horizontal' && vh > vw;
  let lw, lh, x = 0;
  if (modo === 'horizontal') { lw = rotar ? vh : vw; lh = rotar ? vw : vh; }
  else { lw = Math.min(vw, Math.max(340, Math.round(vh * 0.66))); lh = vh; x = Math.round((vw - lw) / 2); }
  const corto = Math.min(lw, lh);
  return {
    modo, rotar, lw, lh, vw, vh,
    tam: corto < 480 ? 'xs' : corto < 720 ? 's' : 'm',
    estilo: { width: lw, height: lh, transformOrigin: '0 0', transform: rotar ? `translate(${vw}px, 0px) rotate(90deg)` : `translate(${x}px, 0px)`, '--lw': lw + 'px', '--lh': lh + 'px' },
    rotTablero: modo === 'vertical' ? 90 : 0,
    rotUi: rotar ? 90 : 0,
  };
}

const medir = () => ({ vw: window.innerWidth, vh: window.innerHeight });

export function useLienzo({ enPartida = false, sala = null } = {}) {
  const [eleccion, setEleccion] = useState(null);             // { fase, modo }: elección manual con el selector, válida solo en su fase
  const [vp, setVp] = useState(medir);
  const fase = enPartida ? 'partida:' + sala : 'previa';
  useEffect(() => {
    const f = () => setVp((a) => { const b = medir(); return a.vw === b.vw && a.vh === b.vh ? a : b; });
    window.addEventListener('resize', f); window.addEventListener('orientationchange', f);
    window.visualViewport?.addEventListener('resize', f);
    return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); window.visualViewport?.removeEventListener('resize', f); };
  }, []);
  const auto = enPartida ? (leerGuardado(sala) || 'horizontal') : (vp.vh > vp.vw ? 'vertical' : 'horizontal');
  const modo = eleccion?.fase === fase ? eleccion.modo : auto;
  const setModo = useCallback((m) => {
    if (enPartida) { try { localStorage.setItem(CLAVE, m); localStorage.setItem(CLAVE_SALA, sala); } catch { /* sin almacenamiento: solo esta sesión */ } }
    setEleccion({ fase, modo: m });
  }, [enPartida, sala, fase]);
  return { ...geometria(modo, vp.vw, vp.vh), setModo };
}

export const LienzoCtx = createContext(null);
export const useVista = () => useContext(LienzoCtx);
