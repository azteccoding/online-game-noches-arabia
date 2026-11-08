// Cartas por leer (Jorge, 8 de noviembre): primero se cierra la carta y luego se ven sus consecuencias. Mientras tengas una carta
// sin cerrar, la barra muestra tu saldo de antes y el registro no enseña lo que pasó desde esa carta. Sin React para probarlo con node.
export const MIN_LECTURA_MS = 4000;                         // todas las cartas se pueden cerrar a los 4 s
export const LECTURA_ESPECIAL_MS = { S4: 7000 };            // Traición en Jerusalén: a los 7 s
export const lecturaMs = (carta) => LECTURA_ESPECIAL_MS[carta?.id] ?? MIN_LECTURA_MS;
const VIGENCIA_MS = 120000;                                 // una carta vieja que nadie marcó como leída ya no congela nada

// La primera carta que me toca leer y que todavía no cerré (según el servidor: s.leidoHasta). Las de ambiente no cuentan.
export function cartaSinCerrar(s) {
  if (!s || s.fase !== 'juego' || s.leidoHasta == null) return null;
  return (s.historial || []).find((h) => h.nro > s.leidoHasta && h.deck !== 'cuento' && (!h.para || h.para.includes(s.yo)) && (s.ahora - h.t) < VIGENCIA_MS) || null;
}

// Saldo que enseña la barra: el último que se vio sin cartas pendientes.
export function saldoVisible(mem, real, congelado) {
  if (!congelado || !mem.ultimo) mem.ultimo = { dinares: real.dinares, noches: real.noches };
  return mem.ultimo;
}

// Registro: mientras haya una carta sin cerrar, se esconden las líneas desde que salió.
export const logVisible = (s) => { const c = cartaSinCerrar(s); return c ? (s.log || []).filter((l) => l.t < c.t) : (s.log || []); };
