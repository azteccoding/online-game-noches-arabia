// REGLA de Jorge (11 de noviembre): nunca salen las consecuencias antes de tirar los dados y de mostrar la alerta de lo que sucedió.
// Mientras haya dados por tirar o en pantalla, cada jugador sigue viendo la vista de antes de la tirada: solo cambian los dados, el
// turno y lo que hace falta para tirar. Las cartas que son consecuencia de esos dados (marcadas con trasDados) esperan a que se cierren.
export const dadosPendientes = (e) => new Set([e.dados, ...(e.colaDados || [])].filter(Boolean).map((d) => d.id));
export function vistaCongelada(antes, v, pendientes) {
  if (pendientes?.size) v = { ...v, historial: (v.historial || []).filter((h) => !pendientes.has(h.trasDados)) };
  if (!antes || antes.fase !== v.fase) return v;
  return { ...antes, turno: v.turno, acciones: v.acciones, dados: v.dados, enCola: v.enCola, espera: v.espera, puedoSacar: v.puedoSacar, ahora: v.ahora, historial: v.historial, ultimaCarta: v.ultimaCarta, pend: null, congelada: true };   // las decisiones esperan
}
