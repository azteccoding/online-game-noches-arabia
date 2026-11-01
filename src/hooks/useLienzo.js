import { createContext, useEffect, useState } from 'react';

// Vista del juego. Todo el DOM del juego (modales incluidos) cuelga del «lienzo». Nunca se gira nada:
//  - pantalla vertical (teléfono o tableta derechos): interfaz VERTICAL a pantalla completa en todas las fases;
//    el tablero sigue apaisado (sin girar), ajustado al ancho, con su zoom y arrastre.
//  - pantalla ancha (PC, tableta horizontal): interfaz horizontal.
// Se decide solo por la forma de la ventana; no hay preferencia guardada ni selector.
export function geometria(vw, vh) {
  const modo = vh > vw ? 'vertical' : 'horizontal';
  const corto = Math.min(vw, vh);
  return {
    modo, rotar: false, lw: vw, lh: vh, vw, vh,
    tam: corto < 480 ? 'xs' : corto < 720 ? 's' : 'm',
    estilo: { width: vw, height: vh, '--lw': vw + 'px', '--lh': vh + 'px' },
    rotTablero: 0,
    rotUi: 0,
  };
}

const medir = () => ({ vw: window.innerWidth, vh: window.innerHeight });

export function useLienzo() {
  const [vp, setVp] = useState(medir);
  useEffect(() => {
    const f = () => setVp((a) => { const b = medir(); return a.vw === b.vw && a.vh === b.vh ? a : b; });
    window.addEventListener('resize', f); window.addEventListener('orientationchange', f);
    window.visualViewport?.addEventListener('resize', f);
    return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); window.visualViewport?.removeEventListener('resize', f); };
  }, []);
  return geometria(vp.vw, vp.vh);
}

export const LienzoCtx = createContext(null);
