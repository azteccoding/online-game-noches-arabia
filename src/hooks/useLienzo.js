import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Vista del juego: HORIZONTAL por defecto en cualquier pantalla. La preferencia vive en localStorage (por jugador/dispositivo).
//  - horizontal: el «lienzo» (todo el juego) es siempre más ancho que alto. Si la ventana es vertical, el lienzo se gira 90° con CSS
//    para aprovechar el largo de la pantalla; no se consulta ninguna media query ni la orientación del dispositivo.
//  - vertical (opt-in): el lienzo es más alto que ancho (columna centrada en pantallas anchas) y el tablero se gira 90° dentro de él.
// Todo el DOM del juego (modales incluidos) cuelga del lienzo; los gestos del tablero se corrigen con la rotación (ver usePanZoom).
const CLAVE = 'mun.vista';
export const leerModo = () => { try { return localStorage.getItem(CLAVE) === 'vertical' ? 'vertical' : 'horizontal'; } catch { return 'horizontal'; } };

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

export function useLienzo() {
  const [modo, setModoE] = useState(leerModo);
  const [vp, setVp] = useState(medir);
  useEffect(() => {
    const f = () => setVp((a) => { const b = medir(); return a.vw === b.vw && a.vh === b.vh ? a : b; });
    window.addEventListener('resize', f); window.addEventListener('orientationchange', f);
    window.visualViewport?.addEventListener('resize', f);
    return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); window.visualViewport?.removeEventListener('resize', f); };
  }, []);
  const setModo = useCallback((m) => { try { localStorage.setItem(CLAVE, m); } catch { /* sin almacenamiento: solo esta sesión */ } setModoE(m); }, []);
  return { ...geometria(modo, vp.vw, vp.vh), setModo };
}

export const LienzoCtx = createContext(null);
export const useVista = () => useContext(LienzoCtx);
