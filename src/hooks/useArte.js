import { useEffect, useState } from 'react';

// Carga perezosa del arte de UNA categoría; al desmontar se cancela/libera (src vacío) para no acumular memoria.
export function useArte(clave) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    setUrl(null);
    if (!clave) return undefined;
    let vivo = true;
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { if (vivo) setUrl(im.src); };
    im.src = `/arte/${clave}.webp`;
    window.__arteCargando = (window.__arteCargando || 0) + 1;
    return () => { vivo = false; im.onload = null; im.src = ''; window.__arteCargando--; };
  }, [clave]);
  return url;
}
