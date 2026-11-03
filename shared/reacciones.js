// Reacciones rápidas entre jugadores (regla de la casa): burbujas breves que no bloquean nada ni quedan en el registro.
// «turno»: para quien está jugando (no te las puedes mandar a ti); «todos»: para la mesa.
export const REACCIONES = [
  { id: 'dormir', para: 'turno', emoji: '😴', texto: '¡Apúrate, que nos estamos durmiendo!' },
  { id: 'te', para: 'turno', emoji: '🫖', texto: '¡Que se enfría el té!' },
  { id: 'camellos', para: 'turno', emoji: '🐪', texto: 'Los camellos ya bostezan…' },
  { id: 'arena', para: 'turno', emoji: '⏳', texto: 'Se acaba la arena del reloj.' },
  { id: 'pelea', para: 'todos', emoji: '⚔️', texto: '¡Pelea!' },
  { id: 'comercio', para: 'todos', emoji: '🤝', texto: '¡Comerciemos!' },
  { id: 'bien', para: 'todos', emoji: '👏', texto: '¡Bien jugado!' },
  { id: 'enojo', para: 'todos', emoji: '😠', texto: '¡Por las barbas del Califa!' },
  { id: 'fiesta', para: 'todos', emoji: '🎉', texto: '¡Que viva la fiesta!' },
];
export const ESPERA_REACCION_MS = 10000;

// Valida y arma la reacción; devuelve { error } o { r }. `ultima` = ms de la última reacción de ese jugador.
export function armarReaccion(e, pid, id, ahora, ultima = 0) {
  const def = REACCIONES.find((x) => x.id === id), j = e.jugadores[pid];
  if (!def) return { error: 'Reacción desconocida.' };
  if (!j || !j.pj || j.npc || e.fase !== 'juego') return { error: 'Las reacciones son para quien juega la partida.' };
  const falta = ESPERA_REACCION_MS - (ahora - ultima);
  if (falta > 0) return { error: `Espera ${Math.ceil(falta / 1000)} s para mandar otra reacción.` };
  const turno = e.turno?.pid && e.jugadores[e.turno.pid];
  if (def.para === 'turno') {
    if (!turno) return { error: 'Ahora no está jugando nadie.' };
    if (turno.id === pid) return { error: 'Es tu turno: esa reacción es para los demás.' };
    if (turno.npc) return { error: 'Al NPC no le hacen falta prisas.' };
  }
  return { r: { id, emoji: def.emoji, texto: def.texto, de: pid, nombre: j.nombre, a: def.para === 'turno' ? turno.id : null, aNombre: def.para === 'turno' ? turno.nombre : null, ts: ahora } };
}
