// Sonido: una sola puerta, tocar(clave), para todos los eventos de la escena. La tabla de ranuras se recibe por parámetro:
// si una ranura tiene archivo, suena ese archivo; si no, suena el provisional sintetizado (cuando lo hay) o nada.
// Nada suena antes de un gesto del usuario.
// Los archivos se bajan una vez y se decodifican con Web Audio (fetch + decodeAudioData): así suenan al instante, los bucles no
// cortan y todo pasa por un volumen general (volumen(0..1)) y por el silencio (silenciar). Mientras un archivo no ha terminado de
// cargar, en su lugar suena el provisional (si lo hay).
// Una ranura puede ser:  '/sonidos/x.mp3'   |   { archivo: '/sonidos/x.mp3', volumen: 0.6 }   |   { archivos: ['/a.mp3', '/b.mp3'], volumen: 0.6 }
// (con varios archivos se elige uno al azar cada vez, para que los pasos o los choques no suenen idénticos).
// Una ranura de música es  { musica: '/sonidos/x.mp3', volumen: 0.9 } : una pieza larga que no se decodifica entera en memoria;
// suena por tramos con musica(clave, true | false) y cada tramo sigue donde se quedó el anterior.
export function crearSonido(TABLA = {}, { volumen: volumenInicial = 1, silencio: silencioInicial = false } = {}) {
  let ctx = null, master = null, ruido = null, activo = !silencioInicial, gesto = false, ambienteActual = null, pistaAmbiente = null;
  let vol = Math.max(0, Math.min(1, +volumenInicial || 0));
  const ultimo = {};
  const ranura = (clave) => {
    const r = TABLA[clave]; if (!r) return null;
    if (typeof r === 'string') return { archivos: [r], volumen: 1 };
    if (Array.isArray(r)) return r.length ? { archivos: r, volumen: 1 } : null;
    const archivos = r.archivos || (r.archivo ? [r.archivo] : []);
    return archivos.length ? { archivos, volumen: r.volumen ?? 1 } : null;
  };

  // --- Archivos: se piden al activar el sonido (después del primer gesto) y quedan en memoria
  const buffers = {};   // url -> AudioBuffer | Promise (cargando) | null (falló)
  function cargar(url) {
    if (url in buffers || !ctx) return buffers[url];
    buffers[url] = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((ab) => new Promise((ok, mal) => ctx.decodeAudioData(ab, ok, mal)))
      .then((b) => (buffers[url] = b)).catch(() => { buffers[url] = null; return null; });
    return buffers[url];
  }
  const cargarTodo = () => { for (const k in TABLA) for (const u of ranura(k)?.archivos || []) cargar(u); };
  const listoArchivo = (u) => { const b = buffers[u]; return b && typeof b.then !== 'function' ? b : null; };
  // Un archivo de la ranura ya decodificado (al azar si hay varios), o null si todavía no hay ninguno.
  function bufferDe(r) {
    const listos = r.archivos.map(listoArchivo).filter(Boolean);
    return listos.length ? listos[Math.floor(Math.random() * listos.length)] : null;
  }
  function reproducir(buffer, ganancia, { bucle = false, rate = 1, entrada = 0 } = {}) {
    const src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
    src.buffer = buffer; src.loop = bucle; src.playbackRate.value = rate;
    if (entrada > 0) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(0.0001, ganancia), t + entrada); } else g.gain.value = ganancia;
    src.connect(g); g.connect(master); src.start(t, bucle ? Math.random() * buffer.duration : 0);
    return { src, g };
  }
  function soltar(n, salida = 0.35) {
    if (!n || !ctx) return;
    try { const t = ctx.currentTime; n.g.gain.cancelScheduledValues(t); n.g.gain.setValueAtTime(n.g.gain.value, t); n.g.gain.linearRampToValueAtTime(0.0001, t + salida); n.src.stop(t + salida + 0.05); } catch { /* ya parado */ }
  }
  const aplicarVolumen = () => { if (master) master.gain.setTargetAtTime(activo ? vol : 0, ctx.currentTime, 0.05); };

  function activar() {
    gesto = true;
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = activo ? vol : 0; master.connect(ctx.destination);
      ruido = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; return; }
    cargarTodo(); for (const k of porPreparar) prepararMusica(k);
    if (ambienteActual) ambiente(ambienteActual);
    for (const k in bucles) if (bucles[k].n > 0) encenderBucle(k);
  }

  // --- Provisionales sintetizados (se pueden borrar cuando haya archivos)
  const listo = () => ctx && ctx.state === 'running';
  function chasquido(vol, frec, q, dur, frecFin = frec) {
    const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = ruido; f.type = 'bandpass'; f.frequency.setValueAtTime(frec, t); if (frecFin !== frec) f.frequency.exponentialRampToValueAtTime(frecFin, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.1); src.stop(t + dur + 0.02);
  }
  function tono(vol, f0, f1, dur, tipo = 'sine') {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
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
    'dados-agua': (f) => { chasquido(0.3 * f + 0.04, 1400, 0.9, 0.22, 380); chasquido(0.12 * f, 3200, 1.2, 0.08); },
    'carta-voltear': () => chasquido(0.07, 1800, 0.7, 0.16, 5200),      // roce de papel al girar la carta
    'golpe-suelo': (f) => { tono(0.4 * f, 110, 42, 0.26); chasquido(0.2 * f, 500, 0.8, 0.16); },
  };

  // Incendio (Jorge, 23 de noviembre): suena mientras haya ciudades en llamas y crece cuanto más cerca está la cámara (nivel de 0 a 1).
  // Con archivo en la ranura 'fuego-ardiendo' suena ese bucle (su volumen sigue al nivel); si no, uno sintetizado: el rugido grave de la llama, un siseo de
  // aire por encima y chasquidos de madera que revientan al azar, más seguidos y más fuertes de cerca.
  // Se llama en cada cuadro; con nivel 0 se apaga del todo (no queda nada sonando ni consumiendo).
  let fuegoNivel = 0, fuegoNodos = null, fuegoPrev = 0, fuegoAjuste = 0;
  function crearRugido() {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 4), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), grave = ctx.createBiquadFilter(), siseo = ctx.createBiquadFilter(), gGrave = ctx.createGain(), gSiseo = ctx.createGain();
    src.buffer = b; src.loop = true; grave.type = 'lowpass'; grave.frequency.value = 240; grave.Q.value = 0.8; siseo.type = 'bandpass'; siseo.frequency.value = 1500; siseo.Q.value = 0.5;
    gGrave.gain.value = 0.0001; gSiseo.gain.value = 0.0001;
    src.connect(grave); grave.connect(gGrave); gGrave.connect(master); src.connect(siseo); siseo.connect(gSiseo); gSiseo.connect(master); src.start();
    return { src, grave, gGrave, gSiseo };
  }
  function apagarRugido() {
    const n = fuegoNodos; if (!n) return; fuegoNodos = null;
    try { const t = ctx.currentTime; n.gGrave.gain.cancelScheduledValues(t); n.gSiseo.gain.cancelScheduledValues(t); n.gGrave.gain.setTargetAtTime(0.0001, t, 0.08); n.gSiseo.gain.setTargetAtTime(0.0001, t, 0.08); n.src.stop(t + 0.6); } catch { /* el contexto ya se cerró */ }
  }
  let fuegoPista = null;
  function fuego(nivel) {
    fuegoNivel = !activo || !gesto || enFondo ? 0 : Math.max(0, Math.min(1, nivel || 0));
    const r = ranura('fuego-ardiendo'), buf = r && ctx ? bufferDe(r) : null;
    if (buf || fuegoPista) {
      if (fuegoNivel > 0.01 && !fuegoPista && buf) fuegoPista = reproducir(buf, 0.0001, { bucle: true });
      if (fuegoPista) {
        if (fuegoNivel <= 0.01) { soltar(fuegoPista, 0.5); fuegoPista = null; }
        else fuegoPista.g.gain.setTargetAtTime(Math.max(0.0001, (r?.volumen ?? 1) * fuegoNivel), ctx.currentTime, 0.15);
      }
      return;
    }
    if (fuegoNivel <= 0.01 || !listo()) { apagarRugido(); fuegoPrev = 0; return; }
    if (!fuegoNodos) fuegoNodos = crearRugido();
    const t = ctx.currentTime, ahora = performance.now(), dt = Math.min(0.25, (ahora - (fuegoPrev || ahora)) / 1000), k = fuegoNivel ** 1.3; fuegoPrev = ahora;
    if (ahora - fuegoAjuste > 90) {      // el volumen sigue al nivel y aletea un poco, como la llama
      fuegoAjuste = ahora; const aleteo = 0.78 + 0.4 * Math.random();
      fuegoNodos.gGrave.gain.setTargetAtTime(Math.max(0.0001, 1.7 * k * aleteo), t, 0.12); fuegoNodos.gSiseo.gain.setTargetAtTime(Math.max(0.0001, 0.2 * k * (1.6 - aleteo)), t, 0.12);
      fuegoNodos.grave.frequency.setTargetAtTime(170 + 150 * fuegoNivel + 90 * Math.random(), t, 0.1);
    }
    if (Math.random() < (2 + 20 * fuegoNivel) * dt) chasquido((0.03 + 0.18 * Math.random()) * k, 1800 + Math.random() * 4200, 2.5 + Math.random() * 3, 0.012 + Math.random() * 0.035);      // crepitar
    if (Math.random() < 0.9 * fuegoNivel * dt) { chasquido(0.22 * k, 600 + Math.random() * 500, 1.2, 0.09); tono(0.08 * k, 120, 55, 0.12); }      // un leño que revienta
  }
  // Con la escena en segundo plano (pestaña oculta, en pausa) los eventos sueltos no suenan.
  let enFondo = false; const fondo = (v) => { enFondo = !!v; if (enFondo) fuego(0); };
  // --- Puerta única
  function tocar(clave, fuerza = 1, variante) {
    if (!activo || !gesto || enFondo || !ctx) return;
    const ahora = performance.now(); if (ahora - (ultimo[clave] || 0) < 22) return; ultimo[clave] = ahora;
    const r = ranura(clave), buf = r ? bufferDe(r) : null;
    if (buf) {
      if (ctx.state !== 'running') return;
      const g = Math.min(1.5, Math.max(0, r.volumen * Math.min(1, 0.35 + 0.65 * fuerza)));
      try { reproducir(buf, g, { rate: 0.94 + Math.random() * 0.12 }); } catch { /* sin audio */ }
      return;
    }
    if (listo() && PROVISIONAL[clave]) PROVISIONAL[clave](Math.min(1.5, fuerza), variante);
  }
  // Bucle de fondo (solo si su ranura tiene archivo): 'ambiente-dia' o 'ambiente-noche'. Cambia con un fundido.
  function ambiente(clave) {
    ambienteActual = clave;
    if (pistaAmbiente) { soltar(pistaAmbiente, 2.5); pistaAmbiente = null; }
    const r = ranura(clave); if (!r || !gesto || !ctx) return;
    const poner = (b) => { if (b && ambienteActual === clave && !pistaAmbiente) pistaAmbiente = reproducir(b, r.volumen * 0.6, { bucle: true, entrada: 2.5 }); };
    const b = bufferDe(r); if (b) poner(b); else Promise.resolve(cargar(r.archivos[0])).then(poner);
  }
  // Bucles que acompañan a algo que dura (el dhow navegando, la alfombra en vuelo, el genio fuera): solo suenan si su ranura tiene
  // archivo. Llevan cuenta: varios pueden pedir el mismo a la vez y se calla cuando el último lo suelta.
  const bucles = {};
  function encenderBucle(clave) {
    const b = bucles[clave]; if (!b || b.pista || !ctx || !gesto) return;
    const r = ranura(clave); if (!r) return;
    const poner = (buf) => { if (buf && b.n > 0 && !b.pista) b.pista = reproducir(buf, r.volumen, { bucle: true, entrada: 0.4 }); };
    const buf = bufferDe(r); if (buf) poner(buf); else Promise.resolve(cargar(r.archivos[0])).then(poner);
  }
  function bucle(clave, encendido) {
    const b = (bucles[clave] ||= { n: 0, pista: null }); b.n = Math.max(0, b.n + (encendido ? 1 : -1));
    if (b.n > 0) encenderBucle(clave);
    else if (b.pista) { soltar(b.pista, 0.6); b.pista = null; }
  }
  // Música de una acción que dura (Jamil toca el laúd): una pieza larga, en su propio <audio> (el navegador la va bajando y no hay
  // que decodificarla entera), que pasa por el volumen general como todo lo demás. musica(clave, true) la hace sonar desde donde
  // se quedó la vez anterior, con una entrada breve; musica(clave, false) la apaga con un fundido y la deja en pausa ahí. Cuando
  // ya no queda pieza para otro tramo, vuelve a empezar. Con «entera» suena siempre desde el principio (la canción de Jamil, que es
  // un tramo ya cortado de 20 s). No se adelanta a un punto de la pieza: eso pide que el servidor entregue el audio por partes.
  const musicas = {}, porPreparar = new Set();
  const urlMusica = (clave) => { const r = TABLA[clave]; return r && typeof r === 'object' && !Array.isArray(r) && r.musica ? { url: r.musica, volumen: r.volumen ?? 1 } : null; };
  function prepararMusica(clave) {
    const r = urlMusica(clave); if (!r) return null;
    if (!ctx) { porPreparar.add(clave); return null; }
    if (musicas[clave]) return musicas[clave];
    try {
      const el = new Audio(); el.preload = 'auto'; el.src = r.url;
      const src = ctx.createMediaElementSource(el), g = ctx.createGain(); g.gain.value = 0.0001; src.connect(g); g.connect(master);
      return (musicas[clave] = { el, g, volumen: r.volumen, sonando: false, reloj: 0 });
    } catch { return null; }
  }
  function musica(clave, encendido, { entrada = 0.35, salida = 1.3, tramo = 8, entera = false } = {}) {
    let m = musicas[clave];
    if (!encendido) {
      if (!m || !m.sonando) return; m.sonando = false;
      try { const t = ctx.currentTime; m.g.gain.cancelScheduledValues(t); m.g.gain.setValueAtTime(Math.max(0.0001, m.g.gain.value), t); m.g.gain.linearRampToValueAtTime(0.0001, t + salida); } catch { /* el contexto ya se cerró */ }
      clearTimeout(m.reloj); m.reloj = setTimeout(() => { if (!m.sonando) m.el.pause(); }, salida * 1000 + 80);
      return;
    }
    if (!gesto || enFondo || !ctx) return;
    m ||= prepararMusica(clave); if (!m) return;
    clearTimeout(m.reloj); m.sonando = true;
    const dur = m.el.duration; if (m.el.ended || (entera && m.el.currentTime > 0) || (Number.isFinite(dur) && dur - m.el.currentTime < tramo + 2)) m.el.currentTime = 0;
    const t = ctx.currentTime; m.g.gain.cancelScheduledValues(t); m.g.gain.setValueAtTime(0.0001, t); m.g.gain.linearRampToValueAtTime(Math.max(0.0001, m.volumen), t + entrada);
    if (ctx.state === 'suspended') ctx.resume();
    m.el.play().catch(() => { m.sonando = false; });
  }
  const callarMusicas = () => { for (const k in musicas) { const m = musicas[k]; clearTimeout(m.reloj); m.sonando = false; try { m.el.pause(); m.el.removeAttribute('src'); m.el.load(); } catch { /* */ } delete musicas[k]; } };
  const callarBucles = () => { for (const k in bucles) { bucles[k].n = 0; if (bucles[k].pista) { soltar(bucles[k].pista, 0.2); bucles[k].pista = null; } } };
  // Silencio y volumen: todo pasa por el volumen general, así que silenciar no corta los bucles (siguen, mudos) y al volver suenan donde iban.
  function alternar() { activo = !activo; if (!activo) fuego(0); aplicarVolumen(); return activo; }
  function silenciar(v) { if (activo === !v) return activo; return alternar(); }
  function volumen(v) { if (v != null) { vol = Math.max(0, Math.min(1, +v || 0)); aplicarVolumen(); } return vol; }
  function destruir() { activo = false; fuego(0); callarBucles(); callarMusicas(); if (pistaAmbiente) { soltar(pistaAmbiente, 0.1); pistaAmbiente = null; } if (ctx) { ctx.close().catch(() => {}); ctx = null; master = null; } }
  return { activar, tocar, ambiente, bucle, musica, prepararMusica, fuego, get nivelFuego() { return fuegoNivel; }, fondo, alternar, silenciar, volumen, destruir, tabla: TABLA, claves: Object.keys(TABLA), get activo() { return activo; }, get volumenActual() { return vol; } };
}
