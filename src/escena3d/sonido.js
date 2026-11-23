// Sonido: una sola puerta, tocar(clave), para todos los eventos de la escena. La tabla de ranuras se recibe por parámetro:
// si una ranura tiene archivo, suena ese archivo; si no, suena el provisional sintetizado (cuando lo hay) o nada.
// Nada suena antes de un gesto del usuario.
export function crearSonido(TABLA = {}) {
  let ctx = null, ruido = null, activo = true, gesto = false, ambienteActual = null, pistaAmbiente = null;
  const ultimo = {}, bases = {};
  const ranura = (clave) => { const r = TABLA[clave]; return !r ? null : typeof r === 'string' ? { archivo: r, volumen: 1 } : { archivo: r.archivo, volumen: r.volumen ?? 1 }; };

  function activar() {
    gesto = true;
    if (ambienteActual && !pistaAmbiente) ambiente(ambienteActual);
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      ctx = new AC();
      ruido = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; }
  }

  // --- Provisionales sintetizados (se pueden borrar cuando haya archivos)
  const listo = () => ctx && ctx.state === 'running';
  function chasquido(vol, frec, q, dur, frecFin = frec) {
    const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = ruido; f.type = 'bandpass'; f.frequency.setValueAtTime(frec, t); if (frecFin !== frec) f.frequency.exponentialRampToValueAtTime(frecFin, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t, Math.random() * 0.1); src.stop(t + dur + 0.02);
  }
  function tono(vol, f0, f1, dur, tipo = 'sine') {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const PROVISIONAL = {
    'dados-golpe': (f, tipo) => (tipo === 'madera' ? chasquido(0.5 * f + 0.03, 2300 + Math.random() * 900, 3.2, 0.05 + 0.04 * f) : chasquido(0.34 * f + 0.02, 1100 + Math.random() * 500, 1.3, 0.06 + 0.05 * f)),
    'ficha-viaje': (f) => { tono(0.16 * f, 210, 95, 0.11); chasquido(0.1 * f, 1700, 2, 0.035); },
    'ficha-llegada': (f) => { tono(0.2 * f, 190, 80, 0.14); chasquido(0.12 * f, 1500, 2, 0.04); },
    'pelea-cimitarra': (f) => chasquido(0.22 * f, 900, 1.1, 0.22, 3400),
    'pelea-jambiya': (f) => chasquido(0.16 * f, 2200, 1.6, 0.1, 4200),
    'pelea-alfanje': (f) => chasquido(0.28 * f, 380, 0.9, 0.3, 1500),
    'pelea-punos': (f) => { tono(0.3 * f, 150, 60, 0.12); chasquido(0.18 * f, 700, 1, 0.06); },
    'arco-disparo': () => { tono(0.14, 420, 140, 0.16, 'triangle'); chasquido(0.12, 2600, 2, 0.12, 5200); },
    'flecha-impacto': () => { tono(0.22, 170, 70, 0.1); chasquido(0.16, 1900, 3, 0.05); },
    'choque-metal': (f) => { for (const [fr, v] of [[1870, 0.1], [2950, 0.07], [4410, 0.05]]) tono(v * f, fr * (0.97 + Math.random() * 0.06), fr * 0.985, 0.32, 'triangle'); chasquido(0.2 * f, 5200, 2.5, 0.05); },
    'mar-olas': (f) => chasquido(0.07 * f, 420, 0.5, 0.9, 900),
    'barco-zarpar': () => { chasquido(0.12, 300, 0.6, 0.7, 1200); tono(0.08, 140, 90, 0.3); },
    'barco-llegar': () => { tono(0.14, 120, 70, 0.22); chasquido(0.1, 600, 0.7, 0.5, 300); },
    'caballo-galope': (f) => { tono(0.2 * f, 170, 70, 0.07); chasquido(0.12 * f, 900, 1.5, 0.04); },
    'caballo-mongol': (f) => { tono(0.2 * f, 150, 65, 0.06); chasquido(0.12 * f, 800, 1.5, 0.035); },
    'camello-paso': (f) => { tono(0.16 * f, 110, 55, 0.12); chasquido(0.07 * f, 500, 1, 0.08); },
    'burro-trote': (f) => { tono(0.15 * f, 230, 110, 0.05); chasquido(0.1 * f, 1300, 2, 0.03); },
    'alfombra-despegue': () => { chasquido(0.12, 500, 0.8, 0.6, 3200); tono(0.07, 320, 880, 0.5, 'triangle'); },
    'alfombra-guardar': () => { chasquido(0.1, 2600, 0.8, 0.45, 500); tono(0.06, 700, 260, 0.35, 'triangle'); },
    'golpe-suelo': (f) => { tono(0.4 * f, 110, 42, 0.26); chasquido(0.2 * f, 500, 0.8, 0.16); },
  };

  // Con la escena en segundo plano (pestaña oculta, en pausa) los eventos sueltos no suenan.
  let enFondo = false; const fondo = (v) => { enFondo = !!v; };
  // --- Puerta única
  function tocar(clave, fuerza = 1, variante) {
    if (!activo || !gesto || enFondo) return;
    const ahora = performance.now(); if (ahora - (ultimo[clave] || 0) < 22) return; ultimo[clave] = ahora;
    const r = ranura(clave);
    if (r) {
      try { const a = (bases[clave] ||= new Audio(r.archivo)).cloneNode(); a.volume = Math.min(1, Math.max(0, r.volumen * Math.min(1, 0.35 + 0.65 * fuerza))); a.play().catch(() => {}); } catch { /* sin audio */ }
      return;
    }
    if (listo() && PROVISIONAL[clave]) PROVISIONAL[clave](Math.min(1.5, fuerza), variante);
  }
  // Bucle de fondo (solo si su ranura tiene archivo): 'ambiente-dia' o 'ambiente-noche'.
  function ambiente(clave) {
    ambienteActual = clave;
    if (pistaAmbiente) { pistaAmbiente.pause(); pistaAmbiente = null; }
    const r = ranura(clave); if (!r || !activo || !gesto) return;
    try { pistaAmbiente = new Audio(r.archivo); pistaAmbiente.loop = true; pistaAmbiente.volume = Math.min(1, r.volumen * 0.6); pistaAmbiente.play().catch(() => {}); } catch { pistaAmbiente = null; }
  }
  // Bucles que acompañan a algo que dura (el dhow navegando, la alfombra en vuelo, el genio fuera): solo suenan si su ranura tiene
  // archivo. Llevan cuenta: varios pueden pedir el mismo a la vez y se calla cuando el último lo suelta.
  const bucles = {};
  function bucle(clave, encendido) {
    const b = (bucles[clave] ||= { n: 0, pista: null }); b.n = Math.max(0, b.n + (encendido ? 1 : -1));
    if (b.n > 0 && !b.pista && activo && gesto) { const r = ranura(clave); if (r) try { b.pista = new Audio(r.archivo); b.pista.loop = true; b.pista.volume = Math.min(1, r.volumen); b.pista.play().catch(() => {}); } catch { b.pista = null; } }
    else if (b.n === 0 && b.pista) { b.pista.pause(); b.pista = null; }
  }
  const callarBucles = () => { for (const k in bucles) if (bucles[k].pista) { bucles[k].pista.pause(); bucles[k].pista = null; } };
  function alternar() { activo = !activo; if (!activo) callarBucles(); if (!activo && pistaAmbiente) { pistaAmbiente.pause(); pistaAmbiente = null; } else if (activo && ambienteActual) ambiente(ambienteActual); return activo; }
  function silenciar(v) { if (activo === !v) return activo; return alternar(); }
  function destruir() { activo = false; callarBucles(); if (pistaAmbiente) { pistaAmbiente.pause(); pistaAmbiente = null; } if (ctx) { ctx.close().catch(() => {}); ctx = null; } }
  return { activar, tocar, ambiente, bucle, fondo, alternar, silenciar, destruir, tabla: TABLA, claves: Object.keys(TABLA), get activo() { return activo; } };
}
