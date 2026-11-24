// Ajustes de sonido del juego 3D (volumen y silencio) y los sonidos que acompañan a las cartas.
// Los ajustes se recuerdan solo en este navegador; si el navegador no deja guardarlos, se usan los de siempre.
const CLAVE = 'mun3d-sonido';
export function leerAjusteSonido() {
  try { const a = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (a && typeof a.volumen === 'number') return { volumen: Math.max(0, Math.min(1, a.volumen)), silencio: !!a.silencio }; } catch { /* sin almacenamiento */ }
  return { volumen: 0.8, silencio: false };
}
export function guardarAjusteSonido(a) { try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch { /* sin almacenamiento */ } }

// Sonido que acompaña a una carta cuando su anverso aparece en pantalla (después del viaje y del giro del dorso).
// Solo ambienta lo que dice la carta: no anuncia nada que la carta no haya mostrado ya. Para cambiar o quitar uno, edita esta tabla
// (las claves son ranuras de src/escena3d/banco/sonidos.js).
export const SONIDO_CARTA = {
  E3: 'carta-tormenta',                                            // Tormenta de arena
  E1: 'carta-acero', E2: 'carta-acero', E11: 'carta-acero', H18: 'carta-acero', R32: 'carta-acero', R15: 'carta-acero',   // Asesinos, ladrones, emboscadas, bandoleros
  E5: 'carta-torneo', R51: 'carta-torneo',                         // torneos
  R18: 'carta-acero', R19: 'carta-acero', R42: 'carta-acero', R25: 'carta-acero', R54: 'carta-acero', R8: 'carta-acero',   // entrenar y combatir
  R43: 'arco-disparo',                                             // entrenar con arco
  E6: 'carta-mar', E9: 'carta-mar', H11: 'carta-mar', R11: 'carta-mar', R12: 'carta-mar', R13: 'carta-mar', R14: 'carta-mar', R40: 'carta-mar',   // mar, Sindbad, monzón
  E10: 'monedas', E12: 'monedas', H9: 'monedas', H10: 'monedas', H17: 'monedas', R22: 'monedas',   // mercaderes, ferias, caravanas de oro y seda
  R38: 'dados-lanzar',                                             // dados en la taberna
  R21: 'carta-misterio', R34: 'carta-misterio',                    // casa embrujada, lámpara de la cueva
  H21: 'carta-acero', H3: 'carta-acero', H6: 'carta-acero', H7: 'carta-acero', H12: 'carta-acero', H2: 'carta-acero', H5: 'carta-acero', H22: 'carta-acero', H23: 'carta-acero',   // guerras y ejércitos
};
export const sonidoDeCarta = (carta) => (carta ? SONIDO_CARTA[carta.id] || null : null);
