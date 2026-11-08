// Avisos en los tratos entre jugadores (Jorge, 8 de noviembre): leyenda roja «Trato costoso» si se piden más de 50 dinares o más
// de 100 noches; «Trato demasiado barato» si el trato lleva dinares (pedidos u ofrecidos) entre 1 y 4. Sin dinares, no sale.
export const COSTOSO_DINARES = 50, COSTOSO_NOCHES = 100, BARATO_DINARES = 5;
const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
export function avisosTrato(ofrece = {}, pide = {}) {
  const r = [];
  if (n(pide.dinares) > COSTOSO_DINARES || n(pide.noches) > COSTOSO_NOCHES) r.push('Trato costoso');
  if ([n(pide.dinares), n(ofrece.dinares)].some((d) => d > 0 && d < BARATO_DINARES)) r.push('Trato demasiado barato');
  return r;
}
