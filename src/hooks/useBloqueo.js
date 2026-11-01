import { useCallback, useEffect, useRef, useState } from 'react';
import { useJuego } from '../game/store.js';

// Evita los envíos repetidos por doble clic: tras pulsar, el botón queda desactivado hasta que llega la confirmación
// o el error del servidor (o 2,5 s como máximo).
export function useBloqueo() {
  const [ocupado, setOcupado] = useState(false);
  const t = useRef(0);
  const aviso = useJuego((x) => x.aviso), error = useJuego((x) => x.error);
  useEffect(() => { if (aviso || error) setOcupado(false); }, [aviso, error]);
  useEffect(() => () => clearTimeout(t.current), []);
  const una = useCallback((f) => () => {
    if (ocupado) return;
    setOcupado(true); clearTimeout(t.current); t.current = setTimeout(() => setOcupado(false), 2500);
    f();
  }, [ocupado]);
  return [ocupado, una];
}
