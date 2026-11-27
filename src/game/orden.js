// Orden general de las ventanas (Jorge, 19 de noviembre): carta → dados → decisión. Funciones puras para poder probarlas sin navegador.
// ¿La carta de la cola espera? Solo detrás de unos dados anteriores a ella o del voto de reinicio; nunca detrás de una decisión.
export function cartaEspera({ cola0, dados, votoPendiente }) {
  if (cola0 == null) return false;
  return (!!dados && dados.id < cola0) || !!votoPendiente;
}
// ¿Se ven ya los botones de la decisión? Solo sin ninguna carta por leer (ni anterior ni posterior) y con los dados cerrados.
// El genio en el juego 3D (Jorge, 27 de noviembre): mientras sale de la lámpara no se ve ninguna carta ni ventana ('genio'); después
// sale su carta, que se cierra, y luego el botón amarillo «Pedir un deseo» ('boton'); solo al tocarlo se abre la ventana de los
// deseos ('ventana'), a la izquierda en pantallas grandes para que se vea el genio. En el 2D (sin escena) la decisión sale como siempre.
export function estadoDeseo({ pend, en3d, ifritFuera, deseoAbierto }) {
  if (!pend || pend.tipo !== 'ifrit' || !en3d) return null;
  if (!ifritFuera) return 'genio';
  if (!pend.mia || pend.respondiste) return null;
  return deseoAbierto ? 'ventana' : 'boton';
}
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
// Carta que explica una tirada según su motivo: los eventos y las históricas usan su id en minúsculas ('e11', 'h12'); las EJ, 'ej:EJ26'; los retos, 'reto:R3'.
export function cartaDelMotivo(motivo) {
  const m = String(motivo || '');
  if (/^[eh]\d+$/i.test(m)) return m.toUpperCase();
  const k = m.match(/^(?:ej|reto):([A-Z]+\d+)$/);
  return k ? k[1] : null;
}
