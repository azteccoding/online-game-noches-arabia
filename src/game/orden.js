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
// ¿Sale ya la alerta con el desenlace de tu reto? (Jorge, 21 de noviembre) Nunca encima de la carta del reto ni de otra carta anterior a ella:
// primero se lee y se cierra la carta, y solo entonces el desenlace (que dura 5 s desde que se ve).
export function alertaVisible({ leyendo, porLeer, id }) {
  return !((leyendo != null && leyendo < id) || (porLeer != null && porLeer < id));
}
