// Orden general de las ventanas (Jorge, 19 de noviembre): carta → dados → decisión. Funciones puras para poder probarlas sin navegador.
// ¿La carta de la cola espera? Solo detrás de unos dados anteriores a ella o del voto de reinicio; nunca detrás de una decisión.
export function cartaEspera({ cola0, dados, votoPendiente }) {
  if (cola0 == null) return false;
  return (!!dados && dados.id < cola0) || !!votoPendiente;
}
// ¿Se ven ya los botones de la decisión? Solo sin ninguna carta por leer (ni anterior ni posterior) y con los dados cerrados.
export function decisionVisible({ leyendo, porLeer, dados, yo }) {
  if (leyendo != null || porLeer != null) return false;
  if (dados && !dados.cerrados?.includes(yo)) return false;
  return true;
}
