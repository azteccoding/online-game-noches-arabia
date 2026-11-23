// Banco de pruebas de la escena 3D: una página suelta (/banco3d.html) que usa SOLO la API pública de crearEscena.
// No tiene reglas, turnos ni red: cada botón pide a la escena una animación, como lo haría el juego con lo que decide el servidor.
import './banco.css';
import { crearEscena, ARMAS, NOMBRE_ARMA, TRANSPORTES, NOMBRE_TRANSPORTE } from '../index.js';
import { SONIDOS } from './sonidos.js';
import tablero from '../../data/tablero.json';
import datosCiudades from '../../data/ciudades.json';
import datosRutas from '../../data/rutas.json';
import datosPersonajes from '../../data/personajes.json';

const $ = (id) => document.getElementById(id);
// Opciones de desarrollo en la dirección: #calidad=media, #densidad=2, #hora=noche, #mapa=4096, #quieto (sin amanecer de entrada), #sinpaneles (solo la escena)
const opciones = new URLSearchParams(location.hash.slice(1));
const PERSONAJES = Object.fromEntries(datosPersonajes.personajes.map((p) => [p.id, p]));
const JORASAN = datosCiudades.jorasan;
const CIUDADES = Object.fromEntries(datosCiudades.ciudades.map((c) => [c.id, c]));
// Jugadores de muestra (se puede cambiar el personaje de cada uno para verlos todos).
const JUGADORES = [
  { id: 'j1', nombre: 'Jorge', personaje: '1', color: '#b3202a', ciudad: 'Bagdad' },
  { id: 'j2', nombre: 'Carolina', personaje: '2', color: '#2a8a8a', ciudad: 'Bagdad' },
  { id: 'j3', nombre: 'Papá Jorge', personaje: '7', color: '#22407f', ciudad: 'Bagdad' },
  { id: 'j4', nombre: 'Mamá Isabel', personaje: '5', color: '#b9803a', ciudad: 'Bagdad' },
];
const COLOR_DADO = { rojo: '#e2383f', amarillo: '#e9b62a', azul: '#4f8fe0', verde: '#5cc77a' };
const azar = () => 1 + Math.floor(Math.random() * 6);

async function iniciar() {
  const escena = await crearEscena($('escena'), {
    tablero, ciudades: datosCiudades.ciudades, jorasan: JORASAN, rutas: datosRutas.rutas, personajes: datosPersonajes.personajes, sonidos: SONIDOS,
    opciones: {
      calidad: opciones.get('calidad') || undefined, calidadAuto: !opciones.has('calidad'), densidad: +opciones.get('densidad') || undefined, anchoMapa: +opciones.get('mapa') || undefined,
      dadosEnMapa: !opciones.has('bandeja'),      // #bandeja: los dados ruedan en su bandeja en vez de caer sobre el mapa
      hora: opciones.get('hora') || (opciones.has('quieto') ? 'dia' : 'noche'), alProgreso: (txt) => { $('velo-texto').textContent = txt; },
    },
  });
  if (!escena) return;
  const estado = { elegida: null, rival: null, rotulo: null, apuntada: null, ronda: 1 };
  const J = Object.fromEntries(JUGADORES.map((j) => [j.id, { ...j, arma: PERSONAJES[j.personaje].arma[0] || '', transporte: null }]));

  // --- Jugadores: retrato, nombre y selectores de personaje, arma y transporte
  const filas = {};
  const opcion = (sel, valor, texto) => { const o = document.createElement('option'); o.value = valor; o.textContent = texto; sel.appendChild(o); };
  for (const j of JUGADORES) {
    const caja = document.createElement('div'); caja.className = 'jug';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'jugador'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span class="retrato"><img alt="" draggable="false"></span><span class="txt"><span class="nombre"></span><span class="pj"></span><span class="lugar"></span></span>';
    b.querySelector('.nombre').textContent = j.nombre;
    b.addEventListener('click', () => { escena.activarSonido(); clicFicha(j.id, true); });
    const sels = document.createElement('div'); sels.className = 'selectores';
    const sPj = document.createElement('select'); sPj.setAttribute('aria-label', `Personaje de ${j.nombre}`); sPj.title = 'Personaje';
    for (const p of datosPersonajes.personajes) opcion(sPj, p.id, p.nombre);
    const sArma = document.createElement('select'); sArma.setAttribute('aria-label', `Arma de ${j.nombre}`); sArma.title = 'Arma para la animación de pelea';
    for (const a of [...ARMAS, '']) opcion(sArma, a, NOMBRE_ARMA[a]);
    const sTr = document.createElement('select'); sTr.setAttribute('aria-label', `Transporte de ${j.nombre}`); sTr.title = 'Transporte con el que viaja';
    opcion(sTr, '', 'A pie'); for (const t of TRANSPORTES) opcion(sTr, t, NOMBRE_TRANSPORTE[t]);
    sPj.value = j.personaje; sArma.value = J[j.id].arma; sTr.value = '';
    sPj.addEventListener('change', () => { J[j.id].personaje = sPj.value; escena.actualizarJugador(j.id, { personaje: sPj.value }); pintar(j.id); });
    sArma.addEventListener('change', () => { J[j.id].arma = sArma.value; escena.actualizarJugador(j.id, { arma: sArma.value }); });
    sTr.addEventListener('change', () => { J[j.id].transporte = sTr.value || null; escena.actualizarJugador(j.id, { transporte: sTr.value || null }); });
    sels.append(sPj, sArma, sTr); caja.append(b, sels); $('jugadores').appendChild(caja);
    filas[j.id] = { b, sPj, sArma, sTr };
  }
  const datosDe = (id) => escena.jugadores().find((x) => x.id === id);
  function pintar(id) {
    const f = filas[id], pj = PERSONAJES[J[id].personaje], d = datosDe(id);
    f.b.querySelector('img').src = `/arte3d/busto-${pj.id}.webp`;
    f.b.querySelector('.pj').innerHTML = `${pj.nombre} · <i>${pj.titulo}</i>`;
    f.b.title = `${J[id].nombre} — ${pj.nombre}`;
    if (d) { f.b.querySelector('.lugar').textContent = d.viajando ? `hacia ${d.ciudad}` : `en ${d.ciudad}`; f.b.classList.toggle('viajando', d.viajando); }
    f.b.classList.toggle('elegida', estado.elegida === id); f.b.classList.toggle('rival', estado.rival === id); f.b.setAttribute('aria-pressed', estado.elegida === id ? 'true' : 'false');
  }
  const pintarTodos = () => { for (const id in filas) pintar(id); };
  await escena.ponerJugadores(Object.values(J).map((j, i) => ({ ...j, turno: i === 0 })));
  pintarTodos();

  // --- Pista: una línea que cuenta qué está pasando
  let relojPista = 0;
  function pista(html, ms = 0) { const p = $('pista'); clearTimeout(relojPista); if (!html) { p.classList.remove('visible'); return; } p.innerHTML = html; p.classList.add('visible'); if (ms) relojPista = setTimeout(() => p.classList.remove('visible'), ms); }
  const fallo = (e) => { console.error(e); pista(String(e?.message || e), 3500); };

  // --- Elegir fichas y ciudades (lo que en el juego haría la interfaz real con los avisos de la escena)
  function marcar() {
    escena.seleccionarFicha(estado.elegida); escena.marcarRival(estado.rival);
    const d = estado.elegida ? datosDe(estado.elegida) : null;
    if (d && !d.viajando) escena.resaltarCiudades(escena.vecinas(d.ciudad), { desde: d.ciudad }); else escena.resaltarCiudades(null);
    $('pelear').disabled = !(estado.elegida && estado.rival) || escena.ocupada.pelea; $('flecha-si').disabled = $('flecha-no').disabled = $('pelear').disabled;
    pintarTodos();
  }
  function elegir(id) {
    if (id && id !== estado.elegida) escena.tocar('ficha-elegir');
    estado.elegida = id; estado.rival = null; marcar();
    const d = id ? datosDe(id) : null;
    if (d && !d.viajando) pista(`<b>${J[id].nombre}</b> está en ${d.ciudad}: elige una ciudad`); else if (!id) pista('');
  }
  function clicFicha(id, desdeLista = false) {
    if (escena.ocupada.pelea) return;
    const e = estado.elegida;
    if (!e || estado.rival === id) { elegir(id); if (desdeLista && !escena.estaEnPantalla(id)) escena.enfocar(id); return; }
    if (e === id) return elegir(null);
    const A = datosDe(e), B = datosDe(id);
    if (!A.viajando && !B.viajando && A.ciudad === B.ciudad) { estado.rival = id; marcar(); pista(`<b>${J[e].nombre}</b> y <b>${J[id].nombre}</b> están en ${A.ciudad}: ya pueden pelear`); return; }
    elegir(id); if (desdeLista && !escena.estaEnPantalla(id)) escena.enfocar(id);
  }
  function mostrarRotulo(id) {
    estado.rotulo = id; const r = $('rotulo');
    if (!id) { r.hidden = true; return; }
    const c = CIUDADES[id] || JORASAN;
    r.querySelector('.nom').textContent = c.id; r.querySelector('.ar').textContent = c.ar || '';
    r.hidden = false; r.classList.remove('entra'); void r.offsetWidth; r.classList.add('entra');
  }
  function clicCiudad(id) {
    if (escena.ocupada.pelea) return;
    const e = estado.elegida, d = e ? datosDe(e) : null;
    if (d && !d.viajando && d.ciudad !== id) {
      const camino = escena.camino(d.ciudad, id);
      if (!camino) { pista(`No hay ruta entre ${d.ciudad} y ${id}`, 2600); return; }
      const origen = d.ciudad;
      escena.viajar(e, id, $('llevar').checked && J[e].transporte && J[e].transporte !== 'alfombra' ? { llevar: true } : { transporte: J[e].transporte }).then(() => { pintar(e); if (estado.elegida === e) marcar(); pista(`<b>${J[e].nombre}</b> llegó a ${id}`, 2200); }, fallo);
      mostrarRotulo(null); estado.rival = null; marcar(); escena.resaltarCiudades(null);
      pista(`<b>${J[e].nombre}</b> viaja de ${origen} a ${id}${camino.length > 1 ? ` (por ${camino.slice(0, -1).join(', ')})` : ''}…`);
      return;
    }
    mostrarRotulo(estado.rotulo === id ? null : id);
  }
  escena.alHacerClicFicha = (id) => clicFicha(id);
  escena.alHacerClicCiudad = (id) => clicCiudad(id);
  escena.alHacerClicVacio = () => { if (estado.rotulo) mostrarRotulo(null); else if (estado.elegida) elegir(null); };
  escena.alApuntar = (u) => { estado.apuntada = u?.tipo === 'ficha' ? u.id : null; const tip = $('tip'); if (estado.apuntada) { const j = J[estado.apuntada]; tip.textContent = `${j.nombre} — ${PERSONAJES[j.personaje].nombre}`; tip.hidden = false; } else tip.hidden = true; };
  escena.alCuadro = () => {
    if (estado.rotulo) { const p = escena.posicionEnPantalla(estado.rotulo); $('rotulo').style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y - 12).toFixed(1)}px) translate(-50%, -100%)`; }
    if (estado.apuntada) { const p = escena.posicionEnPantalla(estado.apuntada); $('tip').style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, calc(-100% - 10px))`; }
  };
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !escena.ocupada.pelea) { mostrarRotulo(null); elegir(null); } });

  // --- Dados: SOLO ruedan al pulsar un botón; los valores los pone el banco (en el juego, el servidor)
  const res = $('resultado');
  const escribir = (grupos) => { res.innerHTML = grupos.map((g) => `${g.etq ? `${g.etq}: ` : ''}<b style="color:${COLOR_DADO[g.color] || ''}">${g.valores.join(' · ')}</b>`).join(' &nbsp;|&nbsp; '); };
  async function tirar(pedido, grupos) {
    escena.activarSonido(); res.textContent = 'Los dados ruedan…';
    try { const sale = await escena.lanzarDados(pedido); escribir(grupos.map((g, i) => ({ ...g, valores: pedido.grupos ? sale[i] : sale }))); } catch (e) { res.textContent = ''; fallo(e); }
  }
  $('lanzar').addEventListener('click', () => {
    const texto = $('dados-valores').value.trim(), color = $('dados-color').value;
    const valores = texto ? texto.split(/[\s,;]+/).map(Number).filter((n) => n >= 1 && n <= 6).slice(0, 6) : [azar(), azar()];
    if (!valores.length) return pista('Escribe valores del 1 al 6 separados por comas, o deja el campo vacío', 3000);
    tirar({ valores, color }, [{ valores, color }]);
  });
  $('lanzar-grupos').addEventListener('click', () => {
    const n = () => 1 + Math.floor(Math.random() * 4);
    const grupos = [
      { etq: 'Ataque', color: 'rojo', valores: Array.from({ length: n() }, azar) },
      { etq: 'Defensa', color: 'azul', valores: Array.from({ length: n() }, azar) },
      { etq: 'Destreza', color: 'amarillo', valores: Array.from({ length: n() }, azar) },
      { etq: 'Guardado', color: 'verde', valores: [azar()], fijo: true },
    ];
    tirar({ grupos }, grupos);
  });
  $('limpiar-dados').addEventListener('click', () => { escena.limpiarDados(); res.textContent = ''; });

  // --- Ronda y luz
  let relojCartel = 0;
  escena.alCambiarRonda = (n) => {
    const c = $('cartel'); c.querySelector('.txt').textContent = `Ronda ${n}`; $('ronda-num').textContent = `Ronda ${n}`;
    c.hidden = false; c.classList.remove('entra'); void c.offsetWidth; c.classList.add('entra');
    clearTimeout(relojCartel); relojCartel = setTimeout(() => { c.hidden = true; }, 3300);
  };
  $('fin-ronda').addEventListener('click', () => {
    escena.activarSonido(); $('fin-ronda').disabled = true; estado.ronda++;
    escena.transicionRonda(estado.ronda).catch(fallo).finally(() => { $('fin-ronda').disabled = false; $('hora').value = 'dia'; });
  });
  $('hora').addEventListener('change', () => { escena.ponerHora($('hora').value, { duracion: 2.5 }).catch(fallo); });

  // --- Pelea (solo animación) e Ifrit
  const bloquear = (v) => { for (const id in filas) for (const s of [filas[id].sPj, filas[id].sArma, filas[id].sTr]) s.disabled = v; $('fin-ronda').disabled = v; $('ifrit').disabled = v; $('jorasan').disabled = v; };
  $('pelear').addEventListener('click', () => {
    const a = estado.elegida, b = estado.rival; if (!a || !b) return;
    escena.activarSonido(); bloquear(true); $('pelear').disabled = true;
    pista(`<b>${J[a].nombre}</b> y <b>${J[b].nombre}</b>, frente a frente`);
    estado.elegida = null; estado.rival = null; mostrarRotulo(null); marcar();
    escena.pelear(a, b, { armaAtacante: J[a].arma, armaDefensor: J[b].arma, disparoArco: $('con-arco').checked }).catch(fallo).finally(() => { bloquear(false); pista(''); });
  });
  for (const [boton, acierta] of [['flecha-si', true], ['flecha-no', false]]) $(boton).addEventListener('click', () => {
    const a = estado.elegida, b = estado.rival; if (!a || !b) return;
    escena.activarSonido(); bloquear(true); $('pelear').disabled = $('flecha-si').disabled = $('flecha-no').disabled = true;
    pista(`<b>${J[a].nombre}</b> dispara a <b>${J[b].nombre}</b>`);
    estado.elegida = null; estado.rival = null; mostrarRotulo(null); marcar();
    escena.dispararFlecha(a, b, { acierta }).then((r) => pista(r.acierta ? 'La flecha dio en el blanco' : 'La flecha no dio', 2200), fallo).finally(() => bloquear(false));
  });
  $('atenuar').addEventListener('change', (e) => escena.atenuar(e.target.checked));
  $('ifrit').addEventListener('click', () => {
    escena.activarSonido(); $('ifrit').disabled = true;
    escena.aparecerIfrit(estado.elegida || 'Bagdad').then(() => { $('carta-ifrit').hidden = false; }, (e) => { $('ifrit').disabled = false; fallo(e); });
  });
  $('elegir-ifrit').addEventListener('click', () => {
    $('carta-ifrit').hidden = true;
    escena.esconderIfrit().catch(fallo).finally(() => { $('ifrit').disabled = false; });
  });

  // --- Ciudades: Cruzada (ciudades en llamas) y Jorasán
  $('quemadas').addEventListener('change', () => escena.ponerCiudadesQuemadas($('quemadas').checked ? ['Damasco', 'Aleppo', 'Estambul'] : []));
  $('jorasan').addEventListener('click', () => {
    const id = estado.elegida; if (!id) return pista('Elige primero una ficha', 2500);
    const d = datosDe(id); if (d.viajando) return;
    const destino = d.ciudad === JORASAN.id ? 'Bagdad' : JORASAN.id;
    escena.actualizarJugador(id, { ciudad: destino }).then(() => { marcar(); escena.enfocar(id); pista(destino === JORASAN.id ? `<b>${J[id].nombre}</b> se perdió en el Jorasán` : `<b>${J[id].nombre}</b> volvió a Bagdad`, 2600); }, fallo);
  });

  // --- Calidad
  const pintarCalidad = () => { $('calidad-actual').textContent = $('calidad').value === 'auto' ? `ahora: ${escena.calidad}` : ''; };
  if (opciones.has('calidad')) $('calidad').value = opciones.get('calidad');
  $('calidad').addEventListener('change', () => { const v = $('calidad').value; if (v === 'auto') escena.ponerCalidad('alta', { auto: true }); else escena.ponerCalidad(v); pintarCalidad(); });
  escena.alCambiarCalidad = pintarCalidad; pintarCalidad();

  // --- Cámara, sonido y panel
  $('vista').addEventListener('click', () => escena.vistaGeneral());
  $('girar-izq').addEventListener('click', () => escena.girar(-1));
  $('girar-der').addEventListener('click', () => escena.girar(1));
  let conSonido = true;
  $('sonido').addEventListener('click', (e) => { escena.activarSonido(); conSonido = !conSonido; escena.silenciar(!conSonido); e.currentTarget.setAttribute('aria-pressed', conSonido ? 'true' : 'false'); });
  const angosta = () => window.innerWidth <= 760;
  const verBanco = (v) => { $('banco').classList.toggle('oculto', !v); $('abrir-banco').setAttribute('aria-expanded', v ? 'true' : 'false'); };
  $('abrir-banco').addEventListener('click', () => verBanco($('banco').classList.contains('oculto')));
  function margenes() {
    const rj = $('jugadores').getBoundingClientRect(), rb = $('banco').getBoundingClientRect();
    document.documentElement.style.setProperty('--bajo-jug', `${Math.round(rj.bottom)}px`);
    escena.ponerMargenes(angosta() ? { izq: 4, der: 4, arr: rj.bottom + 4, aba: 70 } : { izq: rj.right + 6, der: window.innerWidth - rb.left + 6, arr: 6, aba: 70 });
  }
  if (opciones.has('sinpaneles')) document.body.classList.add('sin-paneles'); else { verBanco(!angosta()); margenes(); window.addEventListener('resize', margenes); }

  // --- Entrada: amanece sobre el tablero
  $('velo').classList.add('fuera');
  if (!opciones.has('hora') && !opciones.has('quieto')) escena.amanecer();
  pista('Elige una ficha y luego una ciudad', 7000);
  // Asidero para pruebas automáticas.
  window.__banco = { escena, estado, jugadores: J, elegir, clicCiudad, clicFicha, listo: true };
}

iniciar().catch((err) => {
  console.error(err);
  const t = $('velo-texto'); $('velo').classList.remove('fuera');
  if (t) t.textContent = 'No se pudo iniciar la vista 3D en este navegador. Prueba con una versión reciente de Chrome, Edge, Firefox o Safari, con la aceleración gráfica activada.';
});
