// Contador de las carreras «Dos noches» para la barra de abajo (Jorge, 10 de noviembre): sale mientras la carrera esté activa y
// lleves al menos una noche, o si estás en su ciudad (0 de 2, para que sepas que puedes empezar). Cada noche cuenta al terminar tu
// turno en esa ciudad; se quita al completarla (la carrera se retira) o al reiniciarse (terminas un turno en otra ciudad).
// Vida de cada animal para la barra de abajo (Jorge, 10 de noviembre): «🐎 Caballo: 3 turnos · 🫏 Burro: 2 turnos».
export const ICONO = { caballo: '🐎', burro: '🫏', camello: '🐪', caballoMongol: '🐴', alfombra: '🪄' }, NOMBRE = { caballo: 'Caballo', burro: 'Burro', camello: 'Camello', caballoMongol: 'Caballo mongol', alfombra: 'Alfombra mágica' };   // un emoji único por transporte (Jorge, 12 de noviembre)
export function vidaAnimales(s) {
  return (s?.mano || []).filter((c) => c.tipo === 'item' && ICONO[c.ref] && c.datos?.vida != null)
    .map((c) => ({ uid: c.uid, texto: `${ICONO[c.ref]} ${NOMBRE[c.ref]}: ${c.datos.vida ? `${c.datos.vida} turno${c.datos.vida === 1 ? '' : 's'}` : 'último turno'}` }));
}
export function contadoresCarrera(s) {
  const yo = s?.jugadores?.[s.yo];
  if (!yo) return [];
  return (s.carreras || []).map((c) => ({ id: c.id, ciudad: c.ciudad, n: c.prog?.[s.yo] || 0 }))
    .filter((c) => c.n > 0 || yo.ciudad === c.ciudad)
    .map((c) => ({ ...c, texto: `Carrera en ${c.ciudad}: ${c.n} de 2 noches` }));
}
