// Capa 3D de «Mil y Una Noches»: tablero con relieve y mar vivo, figuras, dhows, dados, peleas y ciclo de luz.
// crearEscena(contenedor, { … }) monta todo dentro del contenedor y devuelve una API imperativa (ver API.md).
// No guarda estado global, no depende de ninguna interfaz concreta y no decide nada del juego: solo anima lo que se le pide.
import * as THREE from 'three';
import { ANCHO, ALTO, U } from './medidas.js';
import { crearMateriales, crearEntorno, crearAmbiente } from './ambiente.js';
import { crearTablero } from './tablero.js';
import { crearFichas, ALTO_FICHA } from './fichas.js';
import { crearDados } from './dados.js';
import { crearDadosMapa } from './dadosMapa.js';
import { crearCamara } from './camara.js';
import { crearSonido } from './sonido.js';
import { crearEfectos } from './efectos.js';
import { crearPelea } from './pelea.js';
import { crearRonda } from './ronda.js';
import { crearFlota } from './dhow.js';
import { ARMAS, NOMBRE_ARMA } from './armas.js';
import { TRANSPORTES, NOMBRE_TRANSPORTE } from './monturas.js';
import { crearIfrit } from './ifrit.js';
import FIGURAS from './datos/figuras.json';
import MONTES from './datos/montes.json';

export { ARMAS, NOMBRE_ARMA, TRANSPORTES, NOMBRE_TRANSPORTE };
export const CALIDADES = ['alta', 'media', 'baja'];
const HORAS = { noche: 0, amanecer: 0.27, dia: 0.345, mediodia: 0.5, atardecer: 0.735 };

// El mapa del juego trae rotulados los nombres de las 12 ciudades; aquí se quitan (la escena los dibuja aparte, nítidos y sin
// que los tapen las piezas) y se añade el rótulo «ABISINIA», igual que hace Tablero.jsx al cargarlo.
function prepararMapa(svg) {
  const ini = svg.indexOf('<g transform="translate(259.4,540.6) scale(0.4600)">'), fin = svg.indexOf('<g transform="translate(2368.3,682.4) scale(0.4200)">');
  if (ini > 0 && fin > ini) { const bloque = svg.slice(ini, fin); if ((bloque.match(/<g/g) || []).length === (bloque.match(/<\/g>/g) || []).length) svg = svg.slice(0, ini) + svg.slice(fin); }
  if (!svg.includes('ABISINIA')) svg = svg.replace(/<\/svg>\s*$/, '<text x="1662" y="1716" text-anchor="middle" font-family="Marcellus SC, serif" font-size="34" letter-spacing="18" fill="#6a4520" opacity=".5">ABISINIA</text></svg>');
  return svg;
}
const pedirTexto = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(`No se pudo cargar ${u} (${r.status}).`); return r.text(); });
const pedirDataURL = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); }).then((b) => new Promise((ok, mal) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = mal; f.readAsDataURL(b); }));

export async function crearEscena(contenedor, { tablero: medidasTablero, ciudades: ciudadesEntrada, jorasan = null, rutas: rutasEntrada, personajes, recursos: rutasRecursos = {}, sonidos = {}, opciones = {} } = {}) {
  if (!contenedor || !ciudadesEntrada || !rutasEntrada || !personajes) throw new Error('crearEscena: faltan el contenedor, las ciudades, las rutas o los personajes.');
  medidasTablero = medidasTablero && { ancho: medidasTablero.ancho ?? medidasTablero.width, alto: medidasTablero.alto ?? medidasTablero.height };
  const ciudades = ciudadesEntrada.map((c) => ({ id: c.id, ar: c.ar, x: c.x, y: c.y })); if (jorasan) ciudades.push({ id: jorasan.id || 'Jorasán', ar: jorasan.ar || '', x: jorasan.x, y: jorasan.y, lugar: true });
  const rutas = rutasEntrada.map((r) => ({ a: r.a, b: r.b, modo: r.modo || r.mode || 'tierra', d: r.d }));
  // Recursos: por defecto, los del propio juego en public/ (se pueden cambiar uno a uno, o todos con opciones.base).
  const base = (opciones.base ?? '/').replace(/\/?$/, '/');
  const DIR = { mapa: base + 'svg/tablero-mapa.svg', fuenteMapa: base + 'fonts/MarcellusSC.woff2', caras: base + 'svg/dados/cara-{n}.svg', arte3d: base + 'arte3d/', ...rutasRecursos };
  try { opciones.alProgreso?.('Desplegando el mapa…'); } catch { /* */ }
  const [svgMapa, fuenteMapa, ...caras] = await Promise.all([pedirTexto(DIR.mapa), pedirDataURL(DIR.fuenteMapa).catch(() => null), ...[1, 2, 3, 4, 5, 6].map((n) => pedirTexto(DIR.caras.replace('{n}', n)))]);
  const recursos = { mapaSVG: prepararMapa(svgMapa), fuenteMapa, relieve: DIR.arte3d + 'relieve.webp', montes: MONTES, carasSVG: Object.fromEntries(caras.map((t, i) => [i + 1, t])),
    figuras: Object.fromEntries(Object.keys(FIGURAS).map((id) => [id, { atlas: `${DIR.arte3d}fig-${id}.webp`, datos: FIGURAS[id] }])) };
  if (medidasTablero && (Math.abs(medidasTablero.ancho * U - ANCHO) > 1e-6 || Math.abs(medidasTablero.alto * U - ALTO) > 1e-6)) throw new Error('crearEscena: esta capa 3D está hecha para el tablero de 2970 × 2100.');
  const PJ = Object.fromEntries((Array.isArray(personajes) ? personajes : Object.values(personajes)).map((p) => [p.id, { ...p, arma: Array.isArray(p.arma) ? p.arma[0] || '' : p.arma || '' }]));
  const movil = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const menosMovimiento = opciones.menosMovimiento ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const avisar = (txt) => { try { opciones.alProgreso?.(txt); } catch { /* la interfaz es cosa de quien llama */ } };
  let destruida = false;

  // --- Lienzo y renderizador
  const el = document.createElement('canvas');
  el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  contenedor.appendChild(el);
  const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  const maxTex = renderer.capabilities.maxTextureSize;

  // --- Calidad: se bajan primero las sombras; la nitidez del mapa (densidad de píxeles) es lo último que se toca
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
  const NIVEL = {
    alta: () => ({ sombra: movil || maxTex < 8192 ? 2048 : 4096, pr: dpr(), detalle: true }),
    media: () => ({ sombra: 2048, pr: dpr(), detalle: true }),
    baja: () => ({ sombra: 1024, pr: Math.min(dpr(), 1.5), detalle: true }),
  };
  let calidad = CALIDADES.includes(opciones.calidad) ? opciones.calidad : 'alta', calidadAuto = opciones.calidadAuto !== false, ajuste = NIVEL[calidad](), recortePr = 0;
  const densidad = () => opciones.densidad || Math.max(1, ajuste.pr - recortePr);

  // --- Escena
  avisar('Preparando la mesa…');
  const escena = new THREE.Scene();
  const mats = crearMateriales();
  escena.environment = crearEntorno(renderer); escena.environmentIntensity = 0.8;
  const amb = crearAmbiente(escena, mats);
  function tamSombra(tam) { const sh = amb.sol.shadow; if (sh.mapSize.x === tam) return; sh.mapSize.setScalar(tam); if (sh.map) { sh.map.dispose(); sh.map = null; } renderer.shadowMap.needsUpdate = true; }
  const sombraBase = () => opciones.sombra || ajuste.sombra;
  tamSombra(sombraBase());
  const tablero = await crearTablero(escena, mats, recursos, renderer, { ciudades, rutas, movil, anchoMapa: opciones.anchoMapa || 0, alProgreso: avisar });
  if (destruida) return null;
  try { await Promise.race([Promise.all([document.fonts.load('400 40px "Marcellus SC"', 'Bagdad'), document.fonts.load('700 40px "Aref Ruqaa"', 'بغداد')]), new Promise((r) => setTimeout(r, 4000))]); } catch { /* sin esas fuentes, los rótulos salen con la de reserva */ }
  tablero.crearRotulos();
  avisar('Colocando las piezas…');
  const sonido = crearSonido(sonidos, { volumen: opciones.volumen ?? 1, silencio: !!opciones.silencio });
  const efectos = crearEfectos(escena);
  const flota = crearFlota({ escena, tablero, mats, efectos, sonido });
  const fichas = crearFichas({ escena, tablero, mats, personajes: PJ, recursos, tex: { sombra: amb.tex.sombra }, sonido, flota, efectos, aniso: renderer.capabilities.getMaxAnisotropy() });
  // Los dados caen sobre el mapa (opciones.dadosEnMapa, encendida si no se dice otra cosa); con false ruedan en su bandeja.
  const dadosMapa = opciones.dadosEnMapa !== false ? crearDadosMapa({ escena, tablero, camara: () => camara, fichas: () => fichas, sonido, menosMovimiento }) : null;
  const dados = crearDados(escena, mats, recursos, renderer, sonido, { menosMovimiento, enMapa: dadosMapa });
  const camara = crearCamara(el);
  const pelea = crearPelea({ escena, tablero, fichas, camara, efectos, sonido, mats });
  const ifrit = crearIfrit({ escena, mats, efectos, sonido, camara, tablero, figuraGenio: recursos.figuras.G });
  const ritmo = menosMovimiento ? 2.4 : 1;      // con «menos movimiento» las secuencias largas van abreviadas
  const api = {};
  const ronda = crearRonda(amb, { alRotulo: (n) => { try { api.alCambiarRonda?.(n); } catch (e) { console.error(e); } }, sonido });
  const VECINAS = {}; for (const r of rutas) { (VECINAS[r.a] ||= new Set()).add(r.b); (VECINAS[r.b] ||= new Set()).add(r.a); }
  const estado = { foco: null, congelado: false, rapidez: 1, margen: { izq: 0, der: 0, arr: 0, aba: 0 } };
  const llamar = (nombre, ...a) => { try { return api[nombre]?.(...a); } catch (e) { console.error(e); } };
  const ficha = (id) => { const f = fichas.porId(id); if (!f) throw new Error(`No hay ningún jugador con id «${id}».`); return f; };

  // --- Tamaño: sigue al contenedor
  let W = 1, H = 1;
  function medir() {
    const r = contenedor.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(densidad()); renderer.setSize(W, H, false);
    camara.redimensionar(W, H, estado.margen);
  }
  function alRedimensionar() { if (destruida) return; medir(); if (camara.enGeneral && !camara.enVuelo) camara.poner(camara.vistaGeneral()); pedirCuadro(); }
  const obsTam = typeof ResizeObserver === 'function' ? new ResizeObserver(alRedimensionar) : null; obsTam?.observe(contenedor);
  window.addEventListener('resize', alRedimensionar);

  // --- Puntero: resaltar al pasar y avisar de los clics
  const rayo = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function bajoPuntero(cx, cy) {
    const r = el.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(ndc, camara.cam);
    const h = rayo.intersectObjects([...fichas.blancos, ...tablero.blancos], false);
    return h.length ? h[0].object.userData : null;
  }
  let puntero = null, punteroSucio = false, abajo = null;
  function apuntar(u) {
    const clave = u ? u.tipo + u.id : null, previa = estado.foco ? estado.foco.tipo + estado.foco.id : null;
    if (clave === previa) return;
    estado.foco = u ? { tipo: u.tipo, id: u.id } : null;
    tablero.enfocar(u?.tipo === 'ciudad' ? u.id : null);
    for (const f of fichas.fichas) f.foco = u?.tipo === 'ficha' && u.id === f.id;
    el.style.cursor = u ? 'pointer' : '';
    llamar('alApuntar', estado.foco);
  }
  const escucha = [];
  const oir = (obj, tipo, fn, op) => { obj.addEventListener(tipo, fn, op); escucha.push(() => obj.removeEventListener(tipo, fn, op)); };
  oir(el, 'pointerdown', (e) => { abajo = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }; sonido.activar(); llamar('alTocar'); });
  oir(el, 'pointermove', (e) => { if (e.pointerType === 'mouse' && e.buttons === 0) { puntero = { x: e.clientX, y: e.clientY }; punteroSucio = true; } });
  oir(el, 'pointerleave', () => { puntero = null; punteroSucio = true; });
  const alSoltar = (e) => {
    if (!abajo || abajo.id !== e.pointerId) return;
    const mov = Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y), dt = e.timeStamp - abajo.t; abajo = null;
    if (mov > 7) llamar('alMoverCamara');
    if (e.type !== 'pointerup' || mov > 7 || dt > 650 || e.button === 2) return;
    const u = bajoPuntero(e.clientX, e.clientY);
    if (!u) llamar('alHacerClicVacio'); else if (u.tipo === 'ficha') { if (u.id === estado.propia) { const f = fichas.porId(u.id); if (f && !f.girar) f.girar = Math.PI * 2; } llamar('alHacerClicFicha', u.id); } else llamar('alHacerClicCiudad', u.id);
    if (e.pointerType !== 'mouse') apuntar(null);
  };
  oir(el, 'pointerup', alSoltar); oir(el, 'pointercancel', alSoltar);
  oir(el, 'contextmenu', (e) => e.preventDefault());
  // Si el navegador quita el contexto WebGL (pestaña en segundo plano, controlador reiniciado…), al volver se rehace lo que vivía en la tarjeta.
  let sinContexto = false;
  oir(el, 'webglcontextlost', (e) => { e.preventDefault(); sinContexto = true; cancelAnimationFrame(raf); raf = 0; pedirCuadro(); });
  oir(el, 'webglcontextrestored', async () => {
    try { escena.environment = crearEntorno(renderer); await tablero.superficie.restaurar(); } catch (e) { console.error(e); }
    sinContexto = false; renderer.shadowMap.needsUpdate = true; ultimoDibujo = 0; cuadros = 0; pedirCuadro(); llamar('alRecuperarContexto');
  });
  oir(el, 'wheel', () => llamar('alMoverCamara'), { passive: true, capture: true });

  // --- Bucle. El tiempo de la escena es el del reloj: a 10 cuadros por segundo las secuencias duran lo mismo que a 60 (la
  // simulación avanza en subpasos cortos y se dibuja una vez). Si la pestaña o el lienzo no se ven, o la escena está en pausa,
  // no se dibuja, pero las secuencias siguen su curso con un reloj de fondo: sus promesas se cumplen a tiempo y, al volver,
  // todo está donde debe (ficha en destino, dados caídos, luz de día).
  const v = new THREE.Vector3();
  const SUBPASO = 0.05, MAX_ATRASO = 90;
  let t = 0, reloj = 0, cuadros = 0, raf = 0, pausaManual = false, oculto = typeof document !== 'undefined' && document.hidden, fueraDeVista = false, medio = 0, muestras = 0, enfriar = 3;
  let atenuada = false, ultimoDibujo = 0, sombraSucia = true, conIfrit = false, relojFondo = 0;
  const corriendo = () => !destruida && !pausaManual && !oculto && !fueraDeVista && !sinContexto;
  const enMovimiento = () => ronda.enCurso || pelea.activa || ifrit.activo || dados.estado !== 'quieto' || camara.enVuelo || fichas.fichas.some((f) => f.viaje || f.laud);
  function pedirCuadro() {
    if (destruida) return;
    if (corriendo()) { if (relojFondo) { clearInterval(relojFondo); relojFondo = 0; sonido.fondo(false); } if (!raf) raf = requestAnimationFrame(cuadro); }
    else if (!relojFondo) { sonido.fondo(true); relojFondo = setInterval(deFondo, 200); }
  }
  // Pausa del genio: el mundo (fichas, barcos, tablero, ronda, pelea) no avanza mientras el ifrit está en escena. «desfase» es el
  // tiempo que el mundo lleva parado. Si la interfaz ya soltó al genio (soltarIfrit) y este aún no empieza a meterse porque hay
  // otra animación antes en la cola, el mundo corre para no dejarla atorada, y vuelve a pararse mientras el genio se mete.
  let desfase = 0, ifritSuelto = false;
  const quietoPorGenio = () => ifrit.activo && (!ifritSuelto || ifrit.fase === 'entrando' || ifrit.fase === 'cierre');
  // Avanza la simulación «dtTotal» segundos en subpasos (sin dibujar).
  function simular(dtTotal, esc) {
    const pasos = Math.min(2400, Math.max(1, Math.ceil(dtTotal / (dtTotal > 2 ? 0.1 : SUBPASO)))), dt = dtTotal / pasos;
    for (let k = 0; k < pasos; k++) {
      t += dt;
      // Jorge (24 de noviembre): mientras el genio sale, flota y vuelve a su lámpara, todo lo demás se queda como está
      const dm = quietoPorGenio() ? 1e-7 : dt; desfase += dt - dm; const tm = t - desfase;
      camara.actualizar(dt); ronda.actualizar(dm * ritmo);
      tablero.actualizar(tm, dm, esc); flota.actualizar(tm, dm); fichas.actualizar(tm, dm * (menosMovimiento ? 1.8 : 1), esc); pelea.actualizar(dm * ritmo, esc);
      if (ifrit.actualizar(t, dt * ritmo)) conIfrit = true; efectos.actualizar(dt); dados.actualizar(dt);
      if (tablero.sucio || fichas.sucio || dados.sucio || flota.sucio) sombraSucia = true;
    }
    return dtTotal;
  }
  function transcurrido() {
    const ahora = performance.now(), real = reloj ? (ahora - reloj) / 1000 : 0.016; reloj = ahora;
    return estado.congelado ? 1e-6 : Math.min(MAX_ATRASO, Math.max(0.001, real)) * estado.rapidez;
  }
  // Antes de empezar una secuencia se pone la simulación al día, para que no arranque con el tiempo del cuadro anterior a cuestas.
  let escPrevia = 1;
  function alDia() { if (!destruida && reloj && !estado.congelado) simular(transcurrido(), escPrevia); }
  function deFondo() {
    if (destruida || corriendo()) { clearInterval(relojFondo); relojFondo = 0; sonido.fondo(false); if (!destruida) pedirCuadro(); return; }
    simular(transcurrido(), 1);
  }
  function cuadro(ahora) {
    raf = 0; if (!corriendo()) { pedirCuadro(); return; }
    // atenuada (hay una carta o una ventana encima): se dibuja a unos 20 cuadros por segundo, o a 5 si no hay nada en marcha
    if (atenuada && ahora - ultimoDibujo < (enMovimiento() ? 46 : 190)) { raf = requestAnimationFrame(cuadro); return; }
    const realCuadro = ultimoDibujo ? (ahora - ultimoDibujo) / 1000 : 0.016; ultimoDibujo = ahora; cuadros++;
    const vista0 = camara.leer(), esc = Math.min(1.5, Math.max(1, (vista0.d / 22) ** 0.45));
    conIfrit = false; escPrevia = esc; fichas.mirarDesde(camara.cam.position);
    if (pelea.golpeando !== !!estado.peleaVista) { estado.peleaVista = pelea.golpeando; llamar("alPelear", estado.peleaVista); }      // golpes o flecha en marcha: la pantalla se despeja
    { const d = camara.cam.position.distanceTo(camara.ctl.target);      // acercamiento máximo y la cámara sobre tu monito
      for (const f of fichas.fichas) f.giraCerca = f.id === estado.propia && !f.viaje && !f.control && !camara.enVuelo && d <= camara.ctl.minDistance * 1.06 && Math.hypot(camara.ctl.target.x - f.nodo.position.x, camara.ctl.target.z - f.nodo.position.z) < 2.2; }
    const dt = simular(transcurrido(), esc);
    amb.actualizar(t - desfase, camara.cam); renderer.toneMappingExposure = amb.cielo.exposicion * (1 - 0.3 * ifrit.nivel);
    const vista = camara.leer();
    const agitado = ronda.enCurso || pelea.activa || ifrit.activo || fichas.fichas.some((f) => f.viaje || f.laud);
    tamSombra(agitado ? Math.min(sombraBase(), 2048) : sombraBase());
    tablero.superficie.ponerLuna(amb.dirLuna, COLOR_LUNA, 1.6 * amb.cielo.noche);
    tablero.superficie.actualizar(t, dt, camara.cam, vista, !camara.enVuelo && !abajo);
    if (cuadros < 4 || conIfrit || sombraSucia || amb.cielo.tomarSucio()) { renderer.shadowMap.needsUpdate = true; sombraSucia = false; }
    if (punteroSucio) { punteroSucio = false; apuntar(puntero ? bajoPuntero(puntero.x, puntero.y) : null); }
    renderer.render(escena, camara.cam);
    sonido.fuego(tablero.cercaniaFuego(camara.cam.position));      // el crepitar del incendio crece al acercarse a una ciudad en llamas
    llamar('alCuadro', dt);
    // Calidad automática: si el equipo va justo se bajan las sombras; solo al final, y nunca por debajo de 1, la densidad de píxeles.
    const real = realCuadro;
    if (calidadAuto && !atenuada && !opciones.densidad && cuadros > 20 && real < 0.25 && !tablero.superficie.pendiente) {
      medio += real; muestras++; enfriar -= real;
      if (muestras >= 70) {
        const m = medio / muestras; medio = 0; muestras = 0;
        if (m > 0.04 && enfriar <= 0) {
          const i = CALIDADES.indexOf(calidad);
          if (i < CALIDADES.length - 1) { fijarCalidad(CALIDADES[i + 1]); llamar('alCambiarCalidad', calidad); } else if (ajuste.pr - recortePr > 1) { recortePr = Math.min(ajuste.pr - 1, recortePr + 0.25); medir(); }
          enfriar = 4;
        }
      }
    }
    pedirCuadro();
  }
  const COLOR_LUNA = new THREE.Color(0xbcd0ff);
  function fijarCalidad(c) { calidad = c; ajuste = NIVEL[c](); recortePr = 0; tamSombra(sombraBase()); medir(); renderer.shadowMap.needsUpdate = true; }
  const alVisibilidad = () => { oculto = document.hidden; ultimoDibujo = 0; pedirCuadro(); };
  oir(document, 'visibilitychange', alVisibilidad);
  const obsVista = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => { fueraDeVista = !es[es.length - 1].isIntersecting; ultimoDibujo = 0; pedirCuadro(); }) : null; obsVista?.observe(contenedor);

  // --- Cámara
  const volar = (vista, dur, extra = {}) => new Promise((ok) => { alDia(); camara.volar(vista, menosMovimiento ? 0.01 : dur, { ...extra, alTerminar: () => { extra.alTerminar?.(); ok(true); }, alInterrumpir: () => ok(false) }); pedirCuadro(); });
  function posicionDe(objetivo) {
    if (objetivo && typeof objetivo === 'object' && 'x' in objetivo) return new THREE.Vector3(objetivo.x, 0, objetivo.z);
    const c = tablero.ciudades.get(objetivo); if (c) return c.pos.clone();
    const f = fichas.porId(objetivo); if (f) return f.nodo.position.clone();
    throw new Error(`enfocar: no conozco «${objetivo}» (ni ciudad ni jugador).`);
  }
  const aPantalla = (p) => { v.copy(p).project(camara.cam); return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, visible: v.z < 1 }; };

  // --- Dados: una tirada tras otra (si llega otra mientras ruedan, espera su turno)
  let colaDados = Promise.resolve(), previaDados = null, relojVuelta = 0, formacion = null;
  function tirar(pedido = {}) {
    const conCamara = pedido.camara !== false; alDia();
    return new Promise((ok, mal) => {
      let lanzado;
      try { lanzado = dados.lanzar(pedido, (res, err) => { if (err) return mal(err); if (conCamara) relojVuelta = setTimeout(() => { const p = previaDados; previaDados = null; if (p && !camara.tocado && !camara.enVuelo && !destruida) camara.volar(p, 1.25); }, 1900); ok(pedido.grupos ? res : res[0]); }); } catch (e) { return mal(e); }
      if (!lanzado) return mal(new Error('Los dados no están listos.'));
      if (conCamara && !pelea.golpeando) { clearTimeout(relojVuelta); if (!previaDados) previaDados = camara.leer(); camara.tocado = false; camara.volar(dados.vistaTirada?.() ?? camara.vistaDados(previaDados.az), menosMovimiento ? 0.01 : 0.85); }
      pedirCuadro();
    });
  }

  // --- Caminos de varios tramos: el más corto en número de rutas. Un lugar sin rutas (el Jorasán) se une campo a través con la
  // ciudad con rutas que tiene más cerca: desde ahí, o hasta ahí, se va por las rutas de siempre.
  const sinRutas = (id) => !(VECINAS[id] && VECINAS[id].size);
  function masCercana(id) { const p = tablero.ciudades.get(id).pos; let mejor = null, dm = Infinity; for (const [k, c] of tablero.ciudades) { if (k === id || sinRutas(k)) continue; const d = c.pos.distanceTo(p); if (d < dm) { dm = d; mejor = k; } } return mejor; }
  function porRutas(desde, hasta) {
    if (desde === hasta) return [];
    const previo2 = new Map([[desde, null]]), cola = [desde];
    while (cola.length) { const a = cola.shift(); for (const b of VECINAS[a] || []) if (!previo2.has(b)) { previo2.set(b, a); if (b === hasta) { const c = []; for (let x = hasta; x !== desde; x = previo2.get(x)) c.unshift(x); return c; } cola.push(b); } }
    return null;
  }
  function caminoA(desde, hasta) {
    if (!tablero.ciudades.has(desde) || !tablero.ciudades.has(hasta)) return null;
    if (desde === hasta) return [];
    if (sinRutas(desde)) { const c = masCercana(desde); if (!c) return null; if (c === hasta) return [hasta]; const r = caminoA(c, hasta); return r && [c, ...r]; }
    if (sinRutas(hasta)) { const c = masCercana(hasta); if (!c) return null; const r = c === desde ? [] : porRutas(desde, c); return r && [...r, hasta]; }
    return porRutas(desde, hasta);
  }

  // =====================================================================================================================
  // API
  // =====================================================================================================================
  // (con descriptores, para que los «get» sigan vivos: Object.assign los copiaría como valores fijos)
  Object.defineProperties(api, Object.getOwnPropertyDescriptors({
    // ----- Jugadores y fichas
    ponerJugadores(lista) { const p = fichas.ponerTodos(lista).then(() => { pedirCuadro(); }); pedirCuadro(); return p; },
    actualizarJugador(id, cambios) { ficha(id); const p = Promise.resolve(fichas.poner({ ...cambios, id })).then(() => { pedirCuadro(); }); pedirCuadro(); return p; },
    quitarJugador(id) { fichas.quitar(ficha(id)); pedirCuadro(); },
    jugadores() { return fichas.fichas.map((f) => ({ id: f.id, nombre: f.jugador.nombre, personaje: f.pid, color: f.jugador.color, ciudad: f.ciudad, viajando: !!f.viaje, arma: f.arma, transporte: f.transporte || null, turno: f.turno })); },
    // Jorge (23 de noviembre): solo tu monito gira, al tocarlo o con el acercamiento máximo. id: tu jugador (null = nadie).
    ponerFichaPropia(id) { estado.propia = id ?? null; },
    seleccionarFicha(id) { for (const f of fichas.fichas) f.elegida = f.id === id; },
    marcarRival(id) { for (const f of fichas.fichas) f.rival = f.id === id; },

    // ----- Viajes: por la ruta real (a pie, o en dhow si la ruta es de mar); «destino» puede estar a varias rutas de distancia,
    // o se puede dar el camino completo como lista de ciudades. Se resuelve al llegar.
    viajar(id, destino, { transporte, llevar = false, seguir = true } = {}) {
      return new Promise((ok, mal) => {
        const f = ficha(id); alDia();
        if (f.viaje) return mal(new Error(`«${id}» ya está de viaje.`));
        if (f.control) return mal(new Error(`«${id}» está en una pelea.`));
        if (!Array.isArray(destino) && !tablero.ciudades.has(destino)) return mal(new Error(`viajar: no existe «${destino}».`));
        const medio = llevar ? null : transporte !== undefined ? transporte : f.transporte;
        const camino = Array.isArray(destino) ? destino : medio === 'alfombra' ? (destino === f.ciudad ? [] : [destino]) : caminoA(f.ciudad, destino);
        if (!camino || !camino.length) return mal(new Error(`No hay ruta de ${f.ciudad} a ${destino}.`));
        const origen = f.ciudad, datos = fichas.viajar(f, camino, (ff, dest) => ok({ id, origen, ciudad: dest }), { transporte, llevar });
        if (!datos) return mal(new Error(`No hay ruta de ${origen} a ${camino.join(' → ')}.`));
        if (seguir && !menosMovimiento && !pelea.activa) camara.acompanar(datos.destino, datos.dur, camara.enPantalla(datos.destino, 0.62) ? 0.55 : 1);
        pedirCuadro();
      });
    },
    vecinas(ciudad) { return [...(VECINAS[ciudad] || [])]; },
    camino(desde, hasta) { return caminoA(desde, hasta); },

    // ----- Dados: caen exactamente en los valores que se pasan. Una fila: { valores: [..], color }; varias: { grupos: [{ etq, valores, color, fijo }] }
    // (hasta 6 dados por fila; ruedan una fila tras otra y quedan ordenadas en la bandeja hasta limpiarDados()). Se resuelve, al
    // detenerse, con los valores que quedaron arriba: un arreglo (una fila) o un arreglo por grupo.
    lanzarDados(pedido) { const p = colaDados.then(() => tirar(pedido)); colaDados = p.catch(() => {}); return p; },
    limpiarDados() { const p = colaDados.then(() => { dados.limpiar(); pedirCuadro(); }); colaDados = p.catch(() => {}); return p; },

    // ----- Pelea (solo animación; no decide nada). Se resuelve al terminar.
    // Jorge (23 de noviembre): la pelea va en tres tiempos. formarPelea: se plantan uno frente al otro y esperan (ahí se tiran los dados
    // y, si hay arcos, dispararFlecha sale desde la formación); pelear: el choque de armas, y vuelven a su sitio; deshacerPelea: vuelven
    // sin pelear. Sin formación previa, pelear y dispararFlecha hacen todo de corrido, como antes.
    formarPelea(idAtacante, idDefensor, { armaAtacante, armaDefensor } = {}) {
      return new Promise((ok, mal) => {
        const A = ficha(idAtacante), B = ficha(idDefensor);
        if (pelea.activa) return pelea.formada && pelea.quienes[0] === idAtacante && pelea.quienes[1] === idDefensor ? ok() : mal(new Error('Ya hay una pelea en curso.'));
        if (A === B || A.viaje || B.viaje || A.ciudad !== B.ciudad) return mal(new Error('Para pelear, las dos fichas deben estar quietas en la misma ciudad.'));
        Promise.all([A.lista, B.lista]).then(() => {
          alDia(); const antes = [A.arma, B.arma];
          if (armaAtacante !== undefined) A.arma = armaAtacante || ''; if (armaDefensor !== undefined) B.arma = armaDefensor || '';
          formacion = { A, B, antes };
          if (!pelea.iniciar(A.indice, B.indice, null, { formar: true })) { A.arma = antes[0]; B.arma = antes[1]; formacion = null; return mal(new Error('No se pudo formar la pelea.')); }
          clearTimeout(relojVuelta); previaDados = null; pedirCuadro(); setTimeout(ok, 950);
        }, mal);
      });
    },
    deshacerPelea() {
      return new Promise((ok) => {
        const F = formacion; if (!F || !pelea.formada) return ok();
        if (!pelea.soltar(() => { F.A.arma = F.antes[0]; F.B.arma = F.antes[1]; if (formacion === F) formacion = null; ok(); })) return ok();
        pedirCuadro();
      });
    },
    pelear(idAtacante, idDefensor, { armaAtacante, armaDefensor, disparoArco = false } = {}) {
      return new Promise((ok, mal) => {
        const A = ficha(idAtacante), B = ficha(idDefensor);
        if (pelea.formada && formacion && formacion.A === A && formacion.B === B) {      // ya están formados: solo el choque, y a su sitio
          const F = formacion;
          if (pelea.golpear(() => { A.arma = F.antes[0]; B.arma = F.antes[1]; if (formacion === F) formacion = null; ok(); }, { quien: 0, salir: true })) { clearTimeout(relojVuelta); previaDados = null; pedirCuadro(); return; }
        }
        if (pelea.activa) return mal(new Error('Ya hay una pelea en curso.'));
        if (A === B || A.viaje || B.viaje || A.ciudad !== B.ciudad) return mal(new Error('Para pelear, las dos fichas deben estar quietas en la misma ciudad.'));
        Promise.all([A.lista, B.lista]).then(() => {
          alDia(); const antes = [A.arma, B.arma];
          if (armaAtacante !== undefined) A.arma = armaAtacante || ''; if (armaDefensor !== undefined) B.arma = armaDefensor || '';
          const fin = () => { A.arma = antes[0]; B.arma = antes[1]; ok(); };
          const cuerpo = () => { if (!pelea.iniciar(A.indice, B.indice, fin)) { A.arma = antes[0]; B.arma = antes[1]; mal(new Error('No se pudo iniciar la pelea.')); } };
          // el arco no es cuerpo a cuerpo: si se pide, el atacante dispara primero y después viene el combate
          if (disparoArco && A.arma !== 'arco') { const arma = A.arma; A.arma = 'arco'; if (!pelea.iniciar(A.indice, B.indice, () => { A.arma = arma; cuerpo(); }, { replica: false })) { A.arma = arma; cuerpo(); } } else cuerpo();
          clearTimeout(relojVuelta); previaDados = null; pedirCuadro();
        }, mal);
      });
    },

    // Solo el disparo de arco de un jugador a otro (misma ciudad), sin choque de armas. acierta: true = la flecha da en el blanco,
    // que acusa el golpe; false (o sin dar) = el blanco la esquiva, o la desvía con su hoja si tiene. Se resuelve al terminar (unos 3 s).
    dispararFlecha(idTirador, idBlanco, { acierta = false } = {}) {
      return new Promise((ok, mal) => {
        const A = ficha(idTirador), B = ficha(idBlanco);
        if (pelea.formada && formacion && [formacion.A, formacion.B].includes(A) && [formacion.A, formacion.B].includes(B) && A !== B) {      // desde la formación
          if (pelea.golpear(() => ok({ acierta: !!acierta }), { quien: formacion.A === A ? 0 : 1, arco: true, replica: false, acierta: !!acierta, ritmo: 1.7, salir: false })) { clearTimeout(relojVuelta); previaDados = null; pedirCuadro(); return; }
        }
        if (pelea.activa) return mal(new Error('Ya hay una pelea en curso.'));
        if (A === B || A.viaje || B.viaje || A.ciudad !== B.ciudad) return mal(new Error('Para disparar, las dos fichas deben estar quietas en la misma ciudad.'));
        Promise.all([A.lista, B.lista]).then(() => {
          alDia(); const antes = [A.arma, B.arma], fin = () => { A.arma = antes[0]; B.arma = antes[1]; ok({ acierta: !!acierta }); };
          A.arma = 'arco'; if (acierta) B.arma = '';
          if (!pelea.iniciar(A.indice, B.indice, fin, { replica: false, acierta: !!acierta, ritmo: 1.7 })) { A.arma = antes[0]; B.arma = antes[1]; return mal(new Error('No se pudo iniciar el disparo.')); }
          clearTimeout(relojVuelta); previaDados = null; pedirCuadro();
        }, mal);
      });
    },

    // ----- Laúd (solo animación): el jugador se sienta con el laúd al frente, hace como que toca y se levanta; mientras toca suena
    // la música de la ranura 'laud-jamil'. duracion: segundos tocando (sin contar sentarse y levantarse). Se resuelve al terminar.
    // Solo puede quien tiene figura sentada (fig-<personaje>t: Jamil).
    tocarLaud(id, { duracion, seguir = false } = {}) {
      return new Promise((ok, mal) => {
        const f = ficha(id);
        if (f.viaje) return mal(new Error(`«${id}» está de viaje.`));
        if (f.control || pelea.activa) return mal(new Error('Hay una pelea en curso.'));
        if (f.laud) return mal(new Error(`«${id}» ya está tocando.`));
        Promise.resolve(f.lista).then(() => f.listaToca).then(() => {
          alDia();
          let previa = null;      // con «seguir», la cámara se acerca a verlo tocar y al terminar vuelve a donde estaba (si nadie la movió)
          const va = fichas.tocarLaud(f, { tocar: duracion, alSonar: (v) => sonido.musica('laud-jamil', v, { tramo: (duracion || 6.5) + 1 }),
            alTerminar: (completo) => { if (previa && !camara.tocado && !camara.enVuelo && !destruida) camara.volar(previa, 1.1); ok({ id, completo }); } });
          if (!va) return mal(new Error(`«${id}» no puede tocar ahora.`));
          if (seguir && !menosMovimiento) {
            const a = camara.leer(), d = Math.min(a.d, 4.8);
            if (a.d > d + 0.5 || !camara.enPantalla(f.nodo.position, 0.7)) { previa = a; camara.tocado = false; camara.volar({ ...a, x: f.nodo.position.x, z: f.nodo.position.z, d, pol: camara.polDe(d) }, 0.9); }
          }
          pedirCuadro();
        }, mal);
      });
    },

    // ----- Ifrit: la lámpara aparece junto a una ficha (id de jugador) o una ciudad; se resuelve cuando el genio ya está fuera, en reposo.
    aparecerIfrit(objetivo) {
      const f = fichas.porId(objetivo), c = f ? null : tablero.ciudades.get(objetivo); if (!f && !c) return Promise.reject(new Error(`aparecerIfrit: no conozco «${objetivo}».`));
      const p = f ? f.nodo.position : c.pos, lado = p.x > ANCHO / 2 - 3 ? -1 : 1; alDia(); pedirCuadro(); ifritSuelto = false;
      return ifrit.aparecer({ x: p.x + lado * (f ? 1.0 : 1.3), z: p.z + (f ? 0.25 : 0.9) });
    },
    esconderIfrit() { ifritSuelto = false; alDia(); pedirCuadro(); return ifrit.esconder(); },      // (sin soltar: el mundo sigue parado mientras se pone al día y el genio se mete)
    // La interfaz avisa que ya se eligió el deseo y se cerró su ventana: el genio se va a meter en cuanto le toque en la cola.
    soltarIfrit() { ifritSuelto = true; },

    // ----- Luz: hora fija o transición, y cambio de ronda (atardecer → noche → amanecer)
    ponerHora(fase, { duracion = 0 } = {}) {
      const h = typeof fase === 'number' ? ((fase % 1) + 1) % 1 : HORAS[fase];
      if (h === undefined) throw new Error(`ponerHora: fase desconocida «${fase}» (usa ${Object.keys(HORAS).join(', ')} o un número de 0 a 1).`);
      alDia(); pedirCuadro();
      if (!duracion || menosMovimiento) { ronda.fijar(h); sonido.ambiente(h < 0.22 || h > 0.8 ? 'ambiente-noche' : 'ambiente-dia'); return Promise.resolve(); }
      return new Promise((ok) => { if (!ronda.ir(h, duracion, ok)) ok(); });
    },
    // Luz por turnos (Jorge, 23 de noviembre): el día dura la ronda entera. Se llama al empezar cada turno con el lugar del jugador en el
    // orden (0 = el primero) y cuántos juegan; la luz avanza despacio por el tramo que le toca. null lo apaga (vuelve la luz fija).
    ponerLuzTurno(indice, total) { alDia(); if (indice == null) ronda.sinTurnos(); else ronda.luzTurno(indice, total); pedirCuadro(); },
    transicionRonda(numero) { alDia(); pedirCuadro(); return new Promise((ok, mal) => { if (!ronda.terminarRonda(() => ok(numero ?? ronda.ronda), numero ?? null)) mal(new Error('Ya hay un cambio de ronda en curso.')); }); },
    amanecer() { alDia(); pedirCuadro(); return new Promise((ok) => { ronda.fijar(0.1); ronda.amanecerInicial(ok); }); },

    // ----- Ciudades y cámara
    ponerCiudadesQuemadas(lista) { tablero.ponerQuemadas(lista || []); pedirCuadro(); },
    resaltarCiudades(lista, { desde = null } = {}) { tablero.marcarAlcance(desde, lista && lista.length ? new Set(lista) : null); pedirCuadro(); },
    enfocar(objetivo, { duracion = 0.9, distancia } = {}) { const p = posicionDe(objetivo), a = camara.leer(), d = distancia ?? Math.min(a.d, 13); return volar({ ...a, x: p.x, z: p.z, d, pol: camara.polDe(d) }, duracion); },
    vistaGeneral({ duracion = 1.25 } = {}) { clearTimeout(relojVuelta); previaDados = null; return volar(camara.vistaGeneral(), duracion, { alTerminar: () => { camara.enGeneral = true; } }); },
    girar(pasos = 1) { camara.girar(pasos); pedirCuadro(); },
    leerCamara() { return camara.leer(); },
    ponerCamara(vista) { camara.poner(vista === 'general' ? camara.vistaGeneral() : vista); camara.enGeneral = vista === 'general'; pedirCuadro(); },
    volarA(vista, duracion = 1.2) { return volar(vista === 'general' ? camara.vistaGeneral() : vista, duracion, vista === 'general' ? { alTerminar: () => { camara.enGeneral = true; } } : {}); },
    estaEnPantalla(objetivo, borde = 0.8) { return camara.enPantalla(posicionDe(objetivo), borde); },
    // Dónde cae en el lienzo (px) el punto que queda justo encima de una ciudad o de una ficha: para colgar rótulos o globos de la interfaz.
    posicionEnPantalla(objetivo) {
      const c = tablero.ciudades.get(objetivo); if (c) return aPantalla(v.copy(c.pos).setY(c.pos.y + c.alto * c.s + 0.12));
      const f = ficha(objetivo); return aPantalla(v.copy(f.nodo.position).setY(f.nodo.position.y + (ALTO_FICHA + 0.08) * f.cuerpo.scale.y + f.cuerpo.position.y));
    },
    ponerMargenes(m) { Object.assign(estado.margen, m); medir(); if (camara.enGeneral && !camara.enVuelo) camara.poner(camara.vistaGeneral()); pedirCuadro(); },

    // ----- Calidad, pausa y limpieza
    ponerCalidad(c, { auto } = {}) { if (!CALIDADES.includes(c)) throw new Error(`ponerCalidad: usa ${CALIDADES.join(', ')}.`); if (auto !== undefined) calidadAuto = !!auto; else calidadAuto = false; fijarCalidad(c); pedirCuadro(); },
    get calidad() { return calidad; },
    // pausar(): deja de dibujar (las secuencias en curso siguen su tiempo y sus promesas se cumplen igual). reanudar(): vuelve a dibujar.
    pausar() { pausaManual = true; cancelAnimationFrame(raf); raf = 0; pedirCuadro(); },
    reanudar() { pausaManual = false; ultimoDibujo = 0; pedirCuadro(); },
    // atenuar(true): hay una carta o una ventana encima; la escena baja a unos 20 cuadros por segundo (5 si no hay nada en marcha)
    // para no gastar batería. Las secuencias y sus promesas no se cortan ni se alargan.
    atenuar(v = true) { atenuada = !!v; pedirCuadro(); },
    get atenuada() { return atenuada; },
    // Solo para pruebas: multiplica la velocidad de todo (1 = tiempo real).
    ponerRapidez(n = 1) { estado.rapidez = Math.max(0.01, +n || 1); },
    get pausada() { return !corriendo(); },
    destruir() {
      if (destruida) return; destruida = true;
      cancelAnimationFrame(raf); clearInterval(relojFondo); clearTimeout(relojVuelta); obsTam?.disconnect(); obsVista?.disconnect(); window.removeEventListener('resize', alRedimensionar);
      for (const f of escucha) f();
      ifrit.destruir(); camara.destruir(); sonido.destruir(); fichas.destruir(); flota.destruir(); dados.destruir(); tablero.superficie.destruir();
      escena.traverse((o) => {
        o.geometry?.dispose?.();
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose?.(); }
      });
      escena.environment?.dispose?.(); renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss?.();
      el.remove();
    },

    // ----- Sonido
    tocar(clave, fuerza = 1, variante) { sonido.tocar(clave, fuerza, variante); },
    activarSonido() { sonido.activar(); },
    silenciar(v = true) { return !sonido.silenciar(v); },
    get silenciada() { return !sonido.activo; },
    volumen(v) { return sonido.volumen(v); },      // volumen general de 0 a 1; sin argumento, lo lee
    SONIDOS: sonidos,

    // ----- Estado y avisos (se asignan desde fuera: escena.alHacerClicCiudad = (id) => …)
    get hora() { return ronda.hora; },      // hora de la luz, de 0 a 1 (0 = medianoche, 0,5 = mediodía)
    get ocupada() { return { dados: dados.estado !== 'quieto', pelea: pelea.activa, ronda: ronda.enCurso, ifrit: ifrit.activo, viajes: fichas.fichas.filter((f) => f.viaje).map((f) => f.id), laud: fichas.fichas.filter((f) => f.laud).map((f) => f.id) }; },
    get ronda() { return ronda.ronda; },
    lienzo: el,
    alHacerClicCiudad: null, alHacerClicFicha: null, alHacerClicVacio: null, alApuntar: null, alCambiarRonda: null, alCambiarCalidad: null, alMoverCamara: null, alTocar: null, alPelear: null, alCuadro: null, alRecuperarContexto: null,
    // Solo para pruebas automáticas y depuración: piezas internas (pueden cambiar sin aviso).
    _interno: { THREE, renderer, escena, camara, tablero, fichas, dados, amb, ronda, pelea, efectos, sonido, flota, ifrit, estado },
  }));
  for (const k of ['alHacerClicCiudad', 'alHacerClicFicha', 'alHacerClicVacio', 'alApuntar', 'alCambiarRonda', 'alCambiarCalidad', 'alMoverCamara', 'alTocar', 'alPelear', 'alCuadro', 'alRecuperarContexto']) if (typeof opciones[k] === 'function') api[k] = opciones[k];

  // --- Arranque
  medir();
  ronda.fijar(HORAS[opciones.hora] ?? (typeof opciones.hora === 'number' ? opciones.hora : ronda.DIA));
  camara.poner(camara.vistaGeneral());
  await dados.listos;
  if (destruida) return null;
  renderer.compile(escena, camara.cam);
  pedirCuadro();
  await Promise.race([new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))), new Promise((ok) => setTimeout(ok, 400))]);
  return api;
}
