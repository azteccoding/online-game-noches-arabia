// Ronda: ciclo de luz. Al terminar la ronda atardece y cae la noche; la ronda nueva empieza amaneciendo.
// Solo es un contador visual («Ronda 2», «Ronda 3»…): el demo no decide qué pasa en una ronda.
export function crearRonda(amb, { alRotulo, sonido }) {
  const DIA = 0.345;                    // hora a la que se queda la luz durante la ronda (media mañana)
  let hora = DIA, sec = null, ronda = 1;
  function fijar(h) { hora = h; sec = null; amb.cielo.ponerHora(h); }
  function lanzar(h0, tramos, eventos, alFin) {
    sec = { t: 0, h0, tramos, eventos: eventos.map(([t, f]) => ({ t, f, hecho: false })), total: tramos.reduce((a, [d]) => a + d, 0), alFin };
    hora = h0; amb.cielo.ponerHora(h0);
  }
  function actualizar(dt) {
    if (!sec) return;
    sec.t += dt;
    let acc = 0, previo = sec.h0, obj = previo;
    for (const [dur, h1] of sec.tramos) { if (sec.t < acc + dur) { obj = previo + (h1 - previo) * ((sec.t - acc) / dur); break; } acc += dur; previo = h1; obj = h1; }
    hora += (obj - hora) * (1 - Math.exp(-dt * 7));
    amb.cielo.ponerHora(hora);
    for (const e of sec.eventos) if (!e.hecho && sec.t >= e.t) { e.hecho = true; e.f(); }
    if (sec.t >= sec.total + 0.35) { const f = sec.alFin; sec = null; hora = DIA; amb.cielo.ponerHora(DIA); f?.(); }
  }
  // Atardecer → noche (rótulo de la ronda nueva) → amanecer.
  function terminarRonda(alFin, numero = null) {
    if (sec) return false;
    // unos 6,8 s en total: la tarde cae deprisa, se detiene un momento en la hora dorada, noche breve con el aviso de ronda y amanecer
    lanzar(DIA, [[1.4, 0.7], [1.2, 0.79], [0.9, 1.0], [0.9, 1.12], [0.8, 1.25], [1.25, 1 + DIA]], [
      [0, () => sonido.tocar('anochecer')], [2.7, () => sonido.ambiente('ambiente-noche')],
      [3.3, () => { ronda = numero ?? ronda + 1; alRotulo(ronda); sonido.tocar('ronda-nueva'); }],
      [4.5, () => sonido.tocar('amanecer')], [5.6, () => sonido.ambiente('ambiente-dia')],
    ], alFin);
    return true;
  }
  // Al abrir el demo: es de noche y amanece la «Ronda 1».
  function amanecerInicial(alFin) {
    // unos 4 s
    lanzar(0.1, [[0.9, 0.14], [1.4, 0.25], [1.4, DIA]], [
      [0, () => sonido.ambiente('ambiente-noche')], [0.6, () => { alRotulo(1); sonido.tocar('ronda-nueva'); }],
      [0.9, () => sonido.tocar('amanecer')], [2.6, () => sonido.ambiente('ambiente-dia')],
    ], alFin);
  }
  // Lleva la luz de la hora actual a otra en «dur» segundos (por el camino corto hacia delante).
  function ir(h, dur, alFin) { if (sec) return false; let meta = h; while (meta < hora) meta += 1; lanzar(hora, [[Math.max(0.05, dur), meta]], [], () => { hora = h; amb.cielo.ponerHora(h); alFin?.(); }); return true; }
  return { fijar, ir, actualizar, terminarRonda, amanecerInicial, DIA, get ronda() { return ronda; }, get enCurso() { return !!sec; }, get tiempo() { return sec ? sec.t : -1; }, get hora() { return hora; } };
}
