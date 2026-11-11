// Contador de las carreras «Dos noches» para la barra de abajo (Jorge, 10 de noviembre): sale mientras la carrera esté activa y
// lleves al menos una noche, o si estás en su ciudad (0 de 2, para que sepas que puedes empezar). Cada noche cuenta al terminar tu
// turno en esa ciudad; se quita al completarla (la carrera se retira) o al reiniciarse (terminas un turno en otra ciudad).
export function contadoresCarrera(s) {
  const yo = s?.jugadores?.[s.yo];
  if (!yo) return [];
  return (s.carreras || []).map((c) => ({ id: c.id, ciudad: c.ciudad, n: c.prog?.[s.yo] || 0 }))
    .filter((c) => c.n > 0 || yo.ciudad === c.ciudad)
    .map((c) => ({ ...c, texto: `Carrera en ${c.ciudad}: ${c.n} de 2 noches` }));
}
