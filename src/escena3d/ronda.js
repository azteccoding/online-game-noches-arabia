// Ronda: ciclo de luz. Al terminar la ronda atardece y cae la noche; la ronda nueva empieza amaneciendo.
// Solo es un contador visual («Ronda 2», «Ronda 3»…): el demo no decide qué pasa en una ronda.
// Luz por turnos (Jorge, 23 de noviembre): en la partida el día dura la ronda entera y se reparte entre los jugadores. Con 3, en el
// turno del primero aclara, en el del segundo es pleno día y en el del tercero atardece y anochece. Con 4 o más, el sol se reparte
// entre todos menos el último, que juega de noche, con las lámparas de la mesa. La luz avanza despacio dentro de cada turno.
export const ALBA = 0.2, OCASO = 0.8, NOCHE = 0.95;      // horas: aún de noche antes de aclarar, noche recién caída y noche cerrada
const CRUZAR_TRAMO = 45;                                  // segundos que tarda la luz en recorrer el tramo de un turno
export function tramoDeTurno(indice, total) {             // [hora al empezar el turno, hora a la que llega]
  const n = Math.max(1, total | 0), i = Math.min(n - 1, Math.max(0, indice | 0)), conSol = n >= 4 ? n - 1 : n;
  if (i >= conSol) return [OCASO, NOCHE];
  return [ALBA + (OCASO - ALBA) * i / conSol, ALBA + (OCASO - ALBA) * (i + 1) / conSol];
}
export function crearRonda(amb, { alRotulo, sonido }) {
  const DIA = 0.345;                    // hora a la que se queda la luz durante la ronda (media mañana) cuando no hay luz por turnos
  let hora = DIA, sec = null, ronda = 1, tramo = null;      // tramo: [h0, h1] del turno en curso (luz por turnos) o null
  const reposo = () => (tramo ? ALBA : DIA);                // dónde queda la luz al acabar un cambio de ronda
  function fijar(h) { hora = h; sec = null; amb.cielo.ponerHora(h); }
  // Turno nuevo: la luz irá hacia el final de su tramo. La primera vez (al entrar a una partida ya empezada) se coloca a medio tramo.
  function luzTurno(indice, total) {
    const nuevo = tramoDeTurno(indice, total), primera = !tramo; tramo = nuevo;
    if (primera && !sec && !(hora >= nuevo[0] && hora <= nuevo[1])) fijar((nuevo[0] + nuevo[1]) / 2);
  }
  function sinTurnos() { tramo = null; }
  function lanzar(h0, tramos, eventos, alFin) {
    sec = { t: 0, h0, tramos, eventos: eventos.map(([t, f]) => ({ t, f, hecho: false })), total: tramos.reduce((a, [d]) => a + d, 0), alFin };
    hora = h0; amb.cielo.ponerHora(h0); sec.hFin = reposo();
  }
  let pintada = -1;      // última hora que se le pasó al cielo durante la deriva (se repinta por pasos, para no rehacer las sombras en cada cuadro)
  function derivar(dt) {
    // dentro del turno: paso parejo (el tramo entero en CRUZAR_TRAMO s) y, si viene atrasada de un turno corto, se pone al día sin correr
    const [h0, h1] = tramo; if (hora >= h1) return;
    const atraso = Math.max(0, h0 - hora), v = (h1 - h0) / CRUZAR_TRAMO + Math.min(0.012, atraso / 8), antes = hora;
    hora = Math.min(h1, hora + v * dt);
    if (antes < 0.24 && hora >= 0.24) { sonido.tocar('amanecer'); sonido.ambiente('ambiente-dia'); }
    if (antes < 0.76 && hora >= 0.76) { sonido.tocar('anochecer'); sonido.ambiente('ambiente-noche'); }
    if (Math.abs(hora - pintada) >= 0.0006 || hora === h1) { pintada = hora; amb.cielo.ponerHora(hora); }
  }
  function actualizar(dt) {
    if (!sec) { if (tramo) derivar(dt); return; }
    sec.t += dt;
    let acc = 0, previo = sec.h0, obj = previo;
    for (const [dur, h1] of sec.tramos) { if (sec.t < acc + dur) { obj = previo + (h1 - previo) * ((sec.t - acc) / dur); break; } acc += dur; previo = h1; obj = h1; }
    hora += (obj - hora) * (1 - Math.exp(-dt * 7));
    amb.cielo.ponerHora(hora);
    for (const e of sec.eventos) if (!e.hecho && sec.t >= e.t) { e.hecho = true; e.f(); }
    if (sec.t >= sec.total + 0.35) { const f = sec.alFin, h = sec.hFin ?? DIA; sec = null; hora = h; amb.cielo.ponerHora(h); f?.(); }
  }
  // Atardecer → noche (rótulo de la ronda nueva) → amanecer.
  function terminarRonda(alFin, numero = null) {
    if (sec) return false;
    if (tramo) {
      // luz por turnos: lo que falte de atardecer termina de caer (sin correr: 4 s como mucho), el rótulo sale ya de noche y la luz
      // queda justo antes del alba; el amanecer llega despacio durante el turno del primer jugador
      const h = Math.min(hora, NOCHE), cae = h < 0.86 ? Math.min(4, Math.max(0.6, (0.86 - h) / 0.04)) : 0.3, yaNoche = h >= 0.78;
      lanzar(h, [[cae, Math.max(h, 0.86)], [1.7, 1.0], [1.3, 1 + ALBA]], [
        [0, () => { if (!yaNoche) { sonido.tocar('anochecer'); sonido.ambiente('ambiente-noche'); } }],
        [cae + 0.2, () => { ronda = numero ?? ronda + 1; alRotulo(ronda); sonido.tocar('ronda-nueva'); }],
      ], alFin);
      return true;
    }
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
    if (tramo) {      // luz por turnos: «Ronda 1» sale de noche y el amanecer llega despacio en el turno del primer jugador
      lanzar(0.1, [[1.6, 0.15], [1.2, ALBA]], [[0, () => sonido.ambiente('ambiente-noche')], [0.6, () => { alRotulo(1); sonido.tocar('ronda-nueva'); }]], alFin);
      return;
    }
    // unos 4 s
    lanzar(0.1, [[0.9, 0.14], [1.4, 0.25], [1.4, DIA]], [
      [0, () => sonido.ambiente('ambiente-noche')], [0.6, () => { alRotulo(1); sonido.tocar('ronda-nueva'); }],
      [0.9, () => sonido.tocar('amanecer')], [2.6, () => sonido.ambiente('ambiente-dia')],
    ], alFin);
  }
  // Lleva la luz de la hora actual a otra en «dur» segundos (por el camino corto hacia delante).
  function ir(h, dur, alFin) { if (sec) return false; let meta = h; while (meta < hora) meta += 1; lanzar(hora, [[Math.max(0.05, dur), meta]], [], () => { hora = h; amb.cielo.ponerHora(h); alFin?.(); }); return true; }
  return { fijar, ir, luzTurno, sinTurnos, actualizar, terminarRonda, amanecerInicial, DIA, get porTurnos() { return !!tramo; }, get ronda() { return ronda; }, get enCurso() { return !!sec; }, get tiempo() { return sec ? sec.t : -1; }, get hora() { return hora; } };
}
