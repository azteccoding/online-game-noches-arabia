// Fichas de los jugadores: cada una es la figura de su personaje (ver figuras.js), de pie sobre el mapa, sin peana (Jorge, 23 de noviembre).
// Viajan por la ruta real caminando, o sobre su montura si tienen una (ver monturas.js); en las rutas de mar suben a un dhow
// (ver dhow.js) y cruzan navegando, con animal y todo. La alfombra mágica vuela en línea directa, sin tocar el suelo ni el agua.
import * as THREE from 'three';
import { crearMontura, esAnimal, TRANSPORTES } from './monturas.js';
import { NIVEL_MAR } from './relieve.js';
import { texAro } from './texturas.js';
import { crearArma, crearEscudo } from './armas.js';
import { crearFigura, cargarTexturaFigura, ALTO_FIGURA } from './figuras.js';

export const ALTO_FICHA = ALTO_FIGURA;
const Y_PIE = 0.004;      // los pies de la figura, apenas sobre el mapa
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const paso = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ZANCADA = 0.62;      // lo que avanza la figura en medio ciclo de paso
const VEL_ALFOMBRA = 4.0, PASO_ALFOMBRA = 0.8;      // velocidad de crucero de la alfombra y distancia de la figura a donde la despliega
const ESC_ESPERA = 0.8, ESC_MONTADO = 1.2, ESC_CABESTRO = 0.95;      // tamaño del animal mientras espera junto a la figura (pequeño, sin estorbar) y al cabalgar

// personajes: { id: { id, nombre, arma, … } } · recursos.figuras: { id: { atlas: URL, datos } } · flota: la de crearFlota (o null)
export function crearFichas({ escena, tablero, mats, personajes, recursos, tex, sonido, flota, efectos = null, aniso = 8 }) {
  const tAro = texAro();
  const gPlano = new THREE.PlaneGeometry(1, 1); gPlano.rotateX(-Math.PI / 2);
  const gBlanco = new THREE.CylinderGeometry(0.27, 0.27, ALTO_FICHA, 10); gBlanco.translate(0, ALTO_FICHA / 2, 0);
  const fichas = [], blancos = [], texturas = new Map();
  const texturaDe = (pid) => { if (!texturas.has(pid)) texturas.set(pid, cargarTexturaFigura(recursos.figuras[pid].atlas, aniso)); return texturas.get(pid); };

  function ranuraLibre(c) { for (let k = 0; k < c.ranuras.length; k++) if (!c.ocupantes.includes(k)) return k; return c.ocupantes.length % c.ranuras.length; }
  function colocar(f, idCiudad) {
    const c = tablero.ciudades.get(idCiudad); if (!c) throw new Error(`No existe la ciudad «${idCiudad}».`);
    if (f.ciudad && f.ranura >= 0) { const o = tablero.ciudades.get(f.ciudad).ocupantes, q = o.indexOf(f.ranura); if (q >= 0) o.splice(q, 1); }
    const k = ranuraLibre(c); c.ocupantes.push(k); f.ciudad = idCiudad; f.ranura = k; f.viaje = null;
    f.nodo.position.copy(c.pos).add(c.ranuras[k]);
  }
  function vestir(f, pid) {
    const pj = personajes[pid]; if (!pj || !recursos.figuras[pid]) throw new Error(`No hay figura para el personaje «${pid}».`);
    f.pj = pj; f.pid = pid;
    const promesa = texturaDe(pid).then((t) => {
      if (f.pid !== pid || f.fuera) return;
      if (f.fig) { f.cuerpo.remove(f.fig.grupo); f.fig.destruir(); f.armas = {}; }
      f.fig = crearFigura(recursos.figuras[pid].datos, t); f.cuerpo.add(f.fig.grupo); f.fig.grupo.position.y = Y_PIE; cambios = true; if (f.conEscudo) ponerEscudo(f);
    });
    f.lista = promesa; return promesa;
  }
  function crear(j) {
    const nodo = new THREE.Group(); escena.add(nodo);
    const cuerpo = new THREE.Group(); nodo.add(cuerpo);
    const sombra = new THREE.Mesh(gPlano, new THREE.MeshBasicMaterial({ map: tex.sombra, transparent: true, opacity: 0.85, depthWrite: false })); sombra.position.y = 0.011; sombra.scale.setScalar(0.8); sombra.renderOrder = 7; nodo.add(sombra);
    const aro = new THREE.Mesh(gPlano, new THREE.MeshBasicMaterial({ map: tAro, color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); aro.position.y = 0.014; aro.scale.setScalar(1.05); aro.renderOrder = 8; aro.visible = false; nodo.add(aro);
    const onda = new THREE.Mesh(gPlano, new THREE.MeshBasicMaterial({ map: tAro, color: 0xfff0c8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); onda.position.y = 0.016; onda.renderOrder = 8; onda.visible = false; nodo.add(onda);
    const blanco = new THREE.Mesh(gBlanco, new THREE.MeshBasicMaterial()); blanco.visible = false; nodo.add(blanco); blancos.push(blanco);
    const f = { id: j.id, indice: fichas.length, jugador: { ...j }, pj: null, pid: null, fig: null, lista: null, nodo, cuerpo, armas: {}, arma: '', control: null, sombra, aro, onda, tOnda: 1, blanco,
      ciudad: null, ranura: -1, viaje: null, transporte: null, montura: null, mont: 0, faseM: 0, marcha: 0, elegida: false, rival: false, foco: false, turno: false, nivel: 0, giro: 0, girar: 0, giraCerca: false, rebote: 0, fase: 0, andar: 0, vuelo: 0, empuje: 0, fuera: false,
      get brazo() { return this.fig?.brazo; }, get mano() { return this.fig?.mano; } };
    blanco.userData = { tipo: 'ficha', id: j.id, ficha: f };
    fichas.push(f); return f;
  }
  function quitar(f) {
    f.fuera = true; if (f.viaje) terminarViaje(f, false); ponerTransporte(f, null);
    const o = f.ciudad ? tablero.ciudades.get(f.ciudad).ocupantes : null; if (o) { const q = o.indexOf(f.ranura); if (q >= 0) o.splice(q, 1); }
    escena.remove(f.nodo); f.fig?.destruir(); for (const m of [f.sombra, f.aro, f.onda, f.blanco]) m.material.dispose();
    blancos.splice(blancos.indexOf(f.blanco), 1); fichas.splice(fichas.indexOf(f), 1); fichas.forEach((x, i) => { x.indice = i; });
  }
  const porId = (id) => fichas.find((f) => f.id === id) || null;
  let cambios = false;

  // --- Transporte: null | 'burro' | 'caballo' | 'camello' | 'caballoMongol' | 'alfombra'. El animal espera junto a la figura;
  // la alfombra va guardada (no se ve) hasta que se viaja con ella. Si la figura está de viaje, el cambio se aplica al llegar.
  function ponerTransporte(f, tipo) {
    tipo = tipo || null; if (tipo && !TRANSPORTES.includes(tipo)) throw new Error(`Transporte desconocido: «${tipo}».`);
    if (f.viaje && !f.fuera) { f.transportePend = tipo; return; }
    if (tipo === f.transporte) return;
    if (f.montura) { escena.remove(f.montura.grupo); f.montura.destruir(); f.montura = null; }
    f.transporte = tipo; f.mont = 0; f.marcha = 0;
    if (tipo) { f.montura = crearMontura(tipo); f.montura.grupo.visible = tipo !== 'alfombra'; escena.add(f.montura.grupo); }
    cambios = true;
  }

  // Escudo de cuero: va al brazo contrario al del arma, a media altura, un poco por delante del cuerpo.
  function ponerEscudo(f) {
    if (f.escudo && (!f.conEscudo || f.escudo.fig !== f.fig)) { f.escudo.grupo.removeFromParent(); f.escudo.destruir(); f.escudo = null; }
    if (!f.conEscudo || !f.fig || f.escudo) { cambios = true; return; }
    const e = crearEscudo(0.38 * f.fig.alto), b = f.fig.brazo.position, lado = Math.abs(b.x) > 0.06 * f.fig.alto ? -Math.sign(b.x) : 1;
    e.fig = f.fig; e.grupo.position.set(lado * Math.max(Math.abs(b.x), 0.17 * f.fig.alto), 0.56 * f.fig.alto, f.fig.fondo * 0.75 + 0.03 * f.fig.alto); e.grupo.rotation.y = lado * 0.5;
    f.fig.grupo.add(e.grupo); f.escudo = e; cambios = true;
  }
  // Pone o actualiza un jugador: { id, nombre, personaje, color, ciudad, arma, transporte, turno }. Devuelve una promesa (figura lista).
  function poner(j) {
    let f = porId(j.id); const nuevo = !f;
    if (nuevo) f = crear(j); else Object.assign(f.jugador, j);
    const pid = j.personaje ?? f.pid;
    let p = f.lista; if (pid !== f.pid) p = vestir(f, pid);
    if (j.arma !== undefined) f.arma = j.arma || ''; else if (nuevo) f.arma = f.pj.arma || '';
    if (j.escudo !== undefined) { f.conEscudo = !!j.escudo; Promise.resolve(p).then(() => ponerEscudo(f), () => {}); }
    if (j.turno !== undefined) f.turno = !!j.turno;
    if (j.transporte !== undefined) ponerTransporte(f, j.transporte);
    if (j.ciudad && (nuevo || (j.ciudad !== f.ciudad && !f.viaje))) colocar(f, j.ciudad);
    cambios = true; return p;
  }
  function ponerTodos(lista) {
    const ids = new Set(lista.map((j) => j.id));
    for (const f of fichas.slice()) if (!ids.has(f.id)) quitar(f);
    return Promise.all(lista.map(poner));
  }

  // --- Viajes. camino: ciudades consecutivas unidas por ruta (una o varias). Devuelve datos del viaje o null si no se puede.
  function tramosDe(r, desde) {
    const P = r.a === desde ? r.puntos : r.puntos.slice().reverse(), b = r.modo === 'mar' && flota ? flota.de(r.a, r.b) : null;
    const pie = (pts) => { const lon = [0]; for (let i = 1; i < pts.length; i++) lon.push(lon[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)); return { tipo: 'pie', puntos: pts, lon, largo: lon[lon.length - 1] }; };
    if (!b) return [pie(P)];
    const ext = flota.extremoDe(b, desde), n = r.puntos.length - 1, i0 = ext ? n - b.i1 : b.i0, i1 = ext ? n - b.i0 : b.i1;
    const out = [];
    if (i0 >= 2) out.push(pie(P.slice(0, i0)));
    out.push({ tipo: 'barco', barco: b, extremo: ext, fase: 'esperar', t: 0, largo: b.largo, de: new THREE.Vector3(), a: new THREE.Vector3() });
    if (P.length - 1 - i1 >= 2) out.push(pie(P.slice(i1 + 1)));
    return out;
  }
  // Sin ruta dibujada entre dos lugares (el Jorasán no tiene ninguna): se cruza a pie en línea recta.
  function campoATraves(desde, hasta) {
    const A = tablero.ciudades.get(desde).pos, B = tablero.ciudades.get(hasta).pos, n = Math.max(2, Math.ceil(A.distanceTo(B) / 0.25)), pts = [], lon = [0];
    for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3().lerpVectors(A, B, i / n));
    for (let i = 1; i < pts.length; i++) lon.push(lon[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    return { tipo: 'pie', puntos: pts, lon, largo: lon[lon.length - 1] };
  }
  // «transporte» (opcional) cambia el del jugador antes de salir, igual que actualizar su campo `transporte`.
  // «llevar»: va a pie con lo que ya tiene (no se cambia su transporte): si es un animal, camina a su lado del cabestro, sin montarlo.
  function viajar(f, camino, alLlegar, { transporte, llevar = false } = {}) {
    if (f.viaje || f.control || !camino?.length) return null;
    if (transporte !== undefined && !llevar) ponerTransporte(f, transporte);
    const enAlfombra = !llevar && f.transporte === 'alfombra', animal = !llevar && esAnimal(f.transporte) ? f.montura : null, cabestro = llevar && esAnimal(f.transporte) ? f.montura : null, origen = f.ciudad;
    let tramos = [], desde = f.ciudad;
    for (const id of camino) {
      if (!tablero.ciudades.has(id)) return null;
      const r = tablero.rutas.find((x) => (x.a === desde && x.b === id) || (x.b === desde && x.a === id));
      if (!enAlfombra) tramos.push(...(r ? tramosDe(r, desde) : [campoATraves(desde, id)])); desde = id;
    }
    const destino = camino[camino.length - 1], de = tablero.ciudades.get(f.ciudad), a = tablero.ciudades.get(destino);
    de.ocupantes.splice(de.ocupantes.indexOf(f.ranura), 1);
    const k = ranuraLibre(a); a.ocupantes.push(k);
    let dur, vel = 1;
    const enMar = tramos.filter((t) => t.tipo === 'barco').reduce((s, t) => s + t.largo, 0);
    if (enAlfombra) {
      tramos = [{ tipo: 'vuelo', ciudades: [origen, ...camino], fase: 'desplegar', t: 0, d: 0, puntos: null }];
      let recto = 0; for (let i = 0; i < camino.length; i++) recto += tablero.ciudades.get(i ? camino[i - 1] : origen).pos.distanceTo(tablero.ciudades.get(camino[i]).pos);
      dur = recto / VEL_ALFOMBRA + 3.9;
    } else {
      const aPie = tramos.filter((t) => t.tipo === 'pie').reduce((s, t) => s + t.largo, 0);
      vel = (aPie / clamp(aPie / 3.1, 1.3, 4.4 * camino.length)) * (animal ? animal.vel : 1);
      dur = aPie / Math.max(0.1, vel) + enMar / 2.6 + (enMar ? 1.4 : 0) + (animal ? 1.1 : 0);
    }
    f.viaje = { tramos, i: 0, d: 0, t: 0, vel, desde: de.ranuras[f.ranura].clone(), hasta: a.ranuras[k].clone(), origen, destino, alLlegar, pasos: 0, dur, enBarco: false,
      animal, cabestro, cuerda: null, etapa: animal ? 'montar' : null, te: 0, casa: f.nodo.position.clone(), lado0: Math.sign(de.ranuras[f.ranura].x) || 1, zumbando: false };
    if (cabestro) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3)); f.viaje.cuerda = new THREE.Line(g, matCuerda); f.viaje.cuerda.frustumCulled = false; f.viaje.cuerda.visible = false; escena.add(f.viaje.cuerda); }
    f.ciudad = destino; f.ranura = k;
    if (animal && f.transporte === 'burro') sonido?.tocar('burro-rebuzno');
    return { dur, destino: a.pos.clone().add(a.ranuras[k]), porMar: enMar > 0 };
  }
  function terminarViaje(f, avisar = true) {
    const v = f.viaje; if (!v) return;
    for (const t of v.tramos) if (t.tipo === 'barco') flota.soltar(t.barco, f);
    if (v.zumbando) { v.zumbando = false; sonido?.bucle('alfombra-vuelo', false); }
    if (v.cuerda) { escena.remove(v.cuerda); v.cuerda.geometry.dispose(); v.cuerda = null; }
    if (f.transporte === 'alfombra' && f.montura) f.montura.grupo.visible = false;
    f.viaje = null; f.rebote = 0.6; f.tOnda = 0; f.mont = 0; f.marcha = 0; f.cuerpo.rotation.set(0, f.giro, 0);
    if (f.transportePend !== undefined) { const t = f.transportePend; delete f.transportePend; if (!f.fuera) ponerTransporte(f, t); }
    if (avisar) { sonido?.tocar('ficha-llegada', 0.9); v.alLlegar?.(f, v.destino); }
  }

  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function puntoEn(tr, d, out) {
    d = clamp(d, 0, tr.largo); let i = 1; while (i < tr.lon.length - 1 && tr.lon[i] < d) i++;
    const u = (d - tr.lon[i - 1]) / Math.max(1e-6, tr.lon[i] - tr.lon[i - 1]); return out.copy(tr.puntos[i - 1]).lerp(tr.puntos[i], u);
  }
  const girarHacia = (f, rumbo, dt, k = 9) => { let dif = rumbo - f.giro; dif = Math.atan2(Math.sin(dif), Math.cos(dif)); f.giro += dif * (1 - Math.exp(-dt * k)); };
  const suave = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const suelo = (x, z) => Math.max(tablero.altura(x, z), NIVEL_MAR);
  // Vuelo en alfombra: de la ciudad de salida a la de llegada en línea directa (pasando junto a las ciudades intermedias del camino).
  function prepararVuelo(f, v, tr, s) {
    const S0 = f.nodo.position.clone(), fin = tablero.ciudades.get(v.destino), S1 = new THREE.Vector3(fin.pos.x + v.hasta.x * s, 0, fin.pos.z + v.hasta.z * s);
    const medios = tr.ciudades.slice(1, -1).map((id) => { const c = tablero.ciudades.get(id).pos; return new THREE.Vector3(c.x, 0, c.z + 0.95); });
    const sig = (medios[0] || S1), d0 = new THREE.Vector3(sig.x - S0.x, 0, sig.z - S0.z).normalize(), ant = medios[medios.length - 1] || S0, d1 = new THREE.Vector3(S1.x - ant.x, 0, S1.z - ant.z).normalize();
    const T0 = new THREE.Vector3(S0.x + d0.x * PASO_ALFOMBRA * s, 0, S0.z + d0.z * PASO_ALFOMBRA * s), L = new THREE.Vector3(S1.x - d1.x * PASO_ALFOMBRA * s, 0, S1.z - d1.z * PASO_ALFOMBRA * s);
    const pts = medios.length ? new THREE.CatmullRomCurve3([T0, ...medios, L], false, 'centripetal').getSpacedPoints(Math.max(12, medios.length * 40)) : [T0, L];
    const lon = [0]; for (let i = 1; i < pts.length; i++) lon.push(lon[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    Object.assign(tr, { puntos: pts, lon, largo: lon[lon.length - 1], S0, S1, T0, L, rumbo0: Math.atan2(d0.x, d0.z), rumbo1: Math.atan2(d1.x, d1.z), rumbo: Math.atan2(d0.x, d0.z), pos: new THREE.Vector3(), rollo: 1, esc: 0.01, h: 0.03, hs: suelo(T0.x, T0.z), ladeo: 0, tv: 0, tChispa: 0 });
  }
  function volar(f, v, tr, t, dt, s) {
    const A = f.montura, g = A.grupo; if (!tr.puntos) prepararVuelo(f, v, tr, s);
    tr.t += dt; let alto = 0, onda = 0;
    const ALTO_VUELO = 0.62, poner = (x, z) => f.nodo.position.set(x, suelo(x, z), z);
    g.visible = true; f.andar *= Math.exp(-dt * 8);
    if (tr.fase === 'desplegar') {
      const u = tr.t / 0.7, sale = suave(u / 0.4);
      tr.pos.set(tr.S0.x + (tr.T0.x - tr.S0.x) * sale, 0, tr.S0.z + (tr.T0.z - tr.S0.z) * sale); tr.pos.y = suelo(tr.pos.x, tr.pos.z) + 0.03 + 0.4 * s * (1 - sale);
      tr.esc = 0.05 + 0.95 * sale; tr.rollo = 1 - suave((u - 0.3) / 0.7); girarHacia(f, tr.rumbo0, dt, 7);
      if (u >= 1) { tr.fase = 'sentar'; tr.t = 0; tr.rollo = 0; }
    } else if (tr.fase === 'sentar') {
      const u = Math.min(1, tr.t / 0.45), e = suave(u); poner(tr.S0.x + (tr.T0.x - tr.S0.x) * e, tr.S0.z + (tr.T0.z - tr.S0.z) * e);
      alto = (Math.sin(Math.PI * u) * 0.3 + 0.03 * e); f.mont = e; tr.pos.set(tr.T0.x, suelo(tr.T0.x, tr.T0.z) + 0.03, tr.T0.z); girarHacia(f, tr.rumbo0, dt, 9);
      if (u >= 1) { tr.fase = 'despegar'; tr.t = 0; sonido?.tocar('alfombra-despegue'); v.zumbando = true; sonido?.bucle('alfombra-vuelo', true); efectos?.onda(tr.pos, 1.3, 0xffe9a8); }
    } else if (tr.fase === 'despegar' || tr.fase === 'descender') {
      const sube = tr.fase === 'despegar', u = Math.min(1, tr.t / 0.6), e = suave(u), P = sube ? tr.T0 : tr.L;
      poner(P.x, P.z); tr.h = 0.03 + (ALTO_VUELO - 0.03) * (sube ? e : 1 - e); onda = sube ? e : 1 - e; f.mont = 1;
      tr.hs += (suelo(P.x, P.z) - tr.hs) * (1 - Math.exp(-dt * 5));
      tr.pos.set(P.x, Math.max(tr.hs, f.nodo.position.y) + tr.h * s, P.z); alto = (tr.pos.y - f.nodo.position.y) / s;
      if (u >= 1) { tr.t = 0; if (sube) tr.fase = 'volar'; else { tr.fase = 'bajar'; if (v.zumbando) { v.zumbando = false; sonido?.bucle('alfombra-vuelo', false); } } }
    } else if (tr.fase === 'volar') {
      tr.tv += dt; onda = 1; f.mont = 1;
      const vel = VEL_ALFOMBRA * Math.min(1, 0.15 + tr.tv / 0.8) * clamp((tr.largo - tr.d) / 1.3, 0.16, 1); tr.d = Math.min(tr.largo, tr.d + vel * dt);
      const p = puntoEn(tr, tr.d, tmp), q = puntoEn(tr, tr.d + 0.2, tmp2); poner(p.x, p.z);
      if (tr.largo - tr.d > 0.25) { const antes = f.giro; girarHacia(f, Math.atan2(q.x - p.x, q.z - p.z), dt, 6); let dg = f.giro - antes; dg = Math.atan2(Math.sin(dg), Math.cos(dg)); tr.ladeo += (clamp(-dg / Math.max(dt, 1e-4) * 0.35, -0.4, 0.4) - tr.ladeo) * (1 - Math.exp(-dt * 4)); } else tr.ladeo *= Math.exp(-dt * 4);
      // la altura sigue al relieve con suavidad, mirando por delante: nunca roza montes, tierra ni agua
      let meta = f.nodo.position.y; for (const ad of [0.35, 0.8, 1.4]) { const a2 = puntoEn(tr, tr.d + ad, tmp2); meta = Math.max(meta, suelo(a2.x, a2.z)); }
      tr.hs += (meta - tr.hs) * (1 - Math.exp(-dt * (meta > tr.hs ? 7 : 2.2)));
      tr.pos.set(p.x, Math.max(tr.hs, f.nodo.position.y) + (ALTO_VUELO + 0.035 * Math.sin(t * 2.3)) * s, p.z); alto = (tr.pos.y - f.nodo.position.y) / s;
      tr.tChispa -= dt; if (tr.tChispa <= 0 && efectos) { tr.tChispa = 0.085; const sn = Math.sin(f.giro), cs = Math.cos(f.giro), lat = (Math.random() - 0.5) * 0.5; efectos.chispas(tmp2.set(p.x - sn * 0.55 * s + cs * lat, tr.pos.y - 0.02, p.z - cs * 0.55 * s - sn * lat), 1, 0.28, 0xffe6a0); }
      if (tr.d >= tr.largo - 0.004) { tr.fase = 'descender'; tr.t = 0; }
    } else if (tr.fase === 'bajar') {
      const u = Math.min(1, tr.t / 0.45), e = suave(u); poner(tr.L.x + (tr.S1.x - tr.L.x) * e, tr.L.z + (tr.S1.z - tr.L.z) * e);
      alto = Math.sin(Math.PI * u) * 0.3 + 0.03 * (1 - e); f.mont = 1 - e; tr.pos.set(tr.L.x, suelo(tr.L.x, tr.L.z) + 0.03, tr.L.z);
      if (u >= 1) { tr.fase = 'guardar'; tr.t = 0; sonido?.tocar('alfombra-guardar'); }
    } else {      // guardar: se enrolla sola y se mete en el equipaje
      const u = tr.t / 0.8, va = suave((u - 0.6) / 0.4); f.mont = 0; poner(tr.S1.x, tr.S1.z);
      tr.rollo = suave(u / 0.6); tr.pos.set(tr.L.x + (tr.S1.x - tr.L.x) * va, 0, tr.L.z + (tr.S1.z - tr.L.z) * va); tr.pos.y = suelo(tr.pos.x, tr.pos.z) + 0.03 + 0.42 * s * va; tr.esc = 1 - 0.97 * va;
      if (u >= 1) { g.visible = false; efectos?.chispas(tr.pos, 8, 0.5, 0xffe6a0); v.i++; }
    }
    const enAire = tr.fase === 'volar' || tr.fase === 'despegar' || tr.fase === 'descender';
    g.position.copy(tr.pos); g.scale.setScalar(s * tr.esc); g.rotation.set(0, enAire || tr.fase === 'sentar' ? f.giro : tr.fase === 'desplegar' ? tr.rumbo0 : tr.rumbo1, enAire ? tr.ladeo : 0, 'YXZ');
    A.animar(t, { rollo: tr.rollo, onda: 0.25 + 0.75 * onda });
    f.vuelo += ((enAire ? 1 : 0.2) - f.vuelo) * (1 - Math.exp(-dt * 3)); f.empuje += ((tr.fase === 'volar' ? 0.7 : 0) - f.empuje) * (1 - Math.exp(-dt * 3));
    return { alto, cabeceo: tr.fase === 'volar' ? -0.05 : 0, ladeo: enAire ? tr.ladeo : 0 };
  }
  function avanzar(f, v, t, dt, s) {
    const M = v.animal; let alto = 0, cabeceo = 0, ladeo = 0;
    if (v.etapa === 'montar' || v.etapa === 'desmontar') {      // subir a la montura antes de salir, bajar al llegar
      const sube = v.etapa === 'montar'; v.te = Math.min(1, v.te + dt / 0.55); f.mont = sube ? suave(v.te) : 1 - suave(v.te); f.marcha *= Math.exp(-dt * 9); f.andar *= Math.exp(-dt * 9);
      alto = Math.sin(Math.PI * v.te) * 0.2;
      if (sube) { const tr0 = v.tramos[0]; if (tr0.tipo === 'pie') { const q = puntoEn(tr0, 0.5, tmp); girarHacia(f, Math.atan2(q.x - f.nodo.position.x, q.z - f.nodo.position.z), dt, 7); } }
      if (v.te >= 1) { if (sube) v.etapa = null; else { v.etapa = 'hecho'; terminarViaje(f); } }
      return { alto, cabeceo, ladeo };
    }
    const tr = v.tramos[v.i]; v.t += dt;
    if (tr.tipo === 'vuelo') ({ alto, cabeceo, ladeo } = volar(f, v, tr, t, dt, s));
    else if (tr.tipo === 'pie') {
      const ultimo = v.i === v.tramos.length - 1, primero = v.i === 0;
      const freno = ultimo ? clamp((tr.largo - v.d) / 0.6, 0.22, 1) : 1, vel = v.vel * Math.min(1, 0.25 + v.t / 0.35) * freno, paso0 = vel * dt;
      v.d += paso0;
      const p = puntoEn(tr, v.d, tmp), kd = primero ? 1 - paso(0, 0.9, v.d) : 0, kh = ultimo ? paso(0.9, 0, tr.largo - v.d) : 0;
      const x = p.x + (v.desde.x * kd + v.hasta.x * kh) * s, z = p.z + (v.desde.z * kd + v.hasta.z * kh) * s;
      const q = puntoEn(tr, v.d + 0.14, tmp2), dx = q.x + (v.desde.x * kd + v.hasta.x * kh) * s - x, dz = q.z + (v.desde.z * kd + v.hasta.z * kh) * s - z;
      f.nodo.position.set(x, tablero.altura(x, z), z);
      if (dx * dx + dz * dz > 1e-7 && tr.largo - v.d > 0.12) girarHacia(f, Math.atan2(dx, dz), dt);
      if (M) {      // a lomos: el paso lo lleva el animal
        f.faseM += (paso0 / (M.zancada * ESC_MONTADO)) * Math.PI * 2; f.marcha += (Math.min(1, 0.35 + 0.65 * freno) - f.marcha) * (1 - Math.exp(-dt * 7)); f.andar *= Math.exp(-dt * 9);
        f.empuje += (0.45 - f.empuje) * (1 - Math.exp(-dt * 5));
        const n = Math.floor(f.faseM / Math.PI); if (n !== v.pasos) { v.pasos = n; sonido?.tocar(M.sonido, 0.32); }
      } else {
        f.fase += (paso0 / ZANCADA) * Math.PI; f.andar += (1 - f.andar) * (1 - Math.exp(-dt * 10));
        alto = Math.abs(Math.sin(f.fase)) * 0.045; cabeceo = 0.07 * f.andar; ladeo = 0.045 * Math.sin(f.fase) * f.andar; f.empuje += (0.5 - f.empuje) * (1 - Math.exp(-dt * 5));
        const n = Math.floor(f.fase / Math.PI); if (n !== v.pasos) { v.pasos = n; sonido?.tocar('ficha-viaje', 0.3); }
      }
      if (v.d >= tr.largo - 0.004) { v.i++; v.d = 0; v.t = 0; }
    } else {
      // por mar: esperar el dhow en la orilla, subir de un salto (con montura y todo), navegar y bajar
      const b = tr.barco; f.andar *= Math.exp(-dt * 8); f.marcha *= Math.exp(-dt * 6);
      if (tr.fase === 'esperar') {
        const o = flota.orilla(b, tr.extremo); if (v.i === 0) f.nodo.position.set(o.x, tablero.altura(o.x, o.z), o.z);
        flota.cubierta(b, tmp); girarHacia(f, Math.atan2(tmp.x - f.nodo.position.x, tmp.z - f.nodo.position.z), dt, 6);
        if (flota.pedir(b, tr.extremo, f)) { tr.fase = 'subir'; tr.t = 0; tr.de.copy(f.nodo.position); }
      } else if (tr.fase === 'subir' || tr.fase === 'bajar') {
        flota.cubierta(b, tmp);
        if (tr.t === 0) tr.dur = Math.min(0.85, Math.max(0.5, tmp.distanceTo(tr.fase === 'subir' ? tr.de : tr.a) / 2.6));      // salto más largo si el barco fondea más lejos
        tr.t = Math.min(1, tr.t + dt / tr.dur); const u = tr.t * tr.t * (3 - 2 * tr.t);
        if (tr.fase === 'subir') { f.nodo.position.lerpVectors(tr.de, tmp, u); girarHacia(f, Math.atan2(tmp.x - tr.de.x, tmp.z - tr.de.z), dt, 6); }
        else { f.nodo.position.lerpVectors(tmp, tr.a, u); girarHacia(f, Math.atan2(tr.a.x - tmp.x, tr.a.z - tmp.z), dt, 8); }
        alto = Math.sin(Math.PI * tr.t) * 0.36;
        if (tr.t >= 1) {
          if (tr.fase === 'subir') { tr.fase = 'navegar'; v.enBarco = true; flota.zarpar(b, f); }
          else { flota.soltar(b, f); v.enBarco = false; sonido?.tocar('ficha-viaje', 0.5); v.i++; v.d = 0; v.t = 0; }
        }
      } else {
        flota.cubierta(b, tmp); f.nodo.position.copy(tmp); girarHacia(f, b.rumbo, dt, 5);
        const g = b.modelo.grupo; cabeceo = g.rotation.x; ladeo = g.rotation.z; f.empuje += (0.8 - f.empuje) * (1 - Math.exp(-dt * 3)); f.vuelo += (1 - f.vuelo) * (1 - Math.exp(-dt * 3));
        if (flota.llego(b)) { tr.fase = 'bajar'; tr.t = 0; const o = flota.orilla(b, 1 - tr.extremo); tr.a.set(o.x, tablero.altura(o.x, o.z), o.z); if (v.i === v.tramos.length - 1) { tr.a.x += v.hasta.x * s; tr.a.z += v.hasta.z * s; } }
      }
    }
    if (M && tr.tipo !== 'vuelo') { alto += M.bote * ESC_MONTADO; if (tr.tipo === 'pie') { cabeceo = M.cabalga.rotation.x; ladeo = M.cabalga.rotation.z; } }
    if (v.i >= v.tramos.length) { if (M && v.etapa !== 'hecho') { v.etapa = 'desmontar'; v.te = 0; } else terminarViaje(f); }
    return { alto, cabeceo, ladeo };
  }
  // El animal: quieto junto a la figura mientras espera (más pequeño, sin estorbar), debajo de ella cuando la lleva, y un poco
  // detrás y a un lado, atado del cabestro, cuando la figura viaja a pie con él.
  const matCuerda = new THREE.LineBasicMaterial({ color: 0x4a3018 }), c1 = new THREE.Vector3(), c2 = new THREE.Vector3();
  function situarAnimal(f, t, s, dt) {
    const M = f.montura, g = M.grupo, m = f.mont, v = f.viaje, n = f.nodo.position;
    const enBarco = v && v.tramos[v.i]?.tipo === 'barco' && v.tramos[v.i].fase !== 'esperar';
    if (M.rumbo === undefined) { M.rumbo = 0; M.esc = ESC_ESPERA; M.nuevo = true; }
    const seguir = (tx, tz, y, giro, esc, ritmo) => {      // se acerca a su sitio andando (o de golpe, recién puesto)
      const k = M.nuevo ? 1 : 1 - Math.exp(-dt * ritmo), ax = g.position.x, az = g.position.z;
      g.position.x += (tx - ax) * k; g.position.z += (tz - az) * k; g.position.y = y ?? tablero.altura(g.position.x, g.position.z);
      const dx = g.position.x - ax, dz = g.position.z - az, dist = Math.hypot(dx, dz), andando = !M.nuevo && dist > 0.0015 * s;
      let dif = (andando ? Math.atan2(dx, dz) : giro) - M.rumbo; dif = Math.atan2(Math.sin(dif), Math.cos(dif)); M.rumbo += dif * (M.nuevo ? 1 : 1 - Math.exp(-dt * 8));
      M.esc += (esc - M.esc) * k;
      if (andando) f.faseM += (dist / (M.zancada * M.esc * s)) * Math.PI * 2 * 1.5;
      f.marcha += ((andando ? Math.min(0.55, (dist / Math.max(dt, 1e-4)) / (2.2 * s)) : 0) - f.marcha) * (1 - Math.exp(-dt * 8));
      g.rotation.set(0, M.rumbo, 0, 'YXZ'); g.scale.setScalar(s * M.esc); M.nuevo = false;
      return andando;
    };
    if (v && v.cabestro) {
      const sn = Math.sin(f.giro), cs = Math.cos(f.giro), lado = v.lado0;
      if (enBarco) { seguir(n.x - sn * 0.46 * s, n.z - cs * 0.46 * s, n.y + f.cuerpo.position.y, f.giro, ESC_CABESTRO, 16); if (v.enBarco) { const b = v.tramos[v.i].barco.modelo.grupo.rotation; g.rotation.x = b.x; g.rotation.z = b.z; } }
      else seguir(n.x - sn * 0.5 * s + cs * 0.4 * s * lado, n.z - cs * 0.5 * s - sn * 0.4 * s * lado, null, f.giro, ESC_CABESTRO, 6.5);
      // el cabestro: de la mano de la figura al hocico del animal, con algo de comba
      if (v.cuerda && f.fig) {
        g.updateMatrixWorld(true); f.nodo.updateMatrixWorld(true); f.fig.brazo.getWorldPosition(c1); c2.copy(M.cabestro).applyMatrix4(g.matrixWorld);
        const P = v.cuerda.geometry.attributes.position, comba = Math.min(0.16 * s, 0.05 * s + c1.distanceTo(c2) * 0.12);
        for (let i = 0; i < 9; i++) { const u = i / 8; P.setXYZ(i, c1.x + (c2.x - c1.x) * u, c1.y + (c2.y - c1.y) * u - comba * 4 * u * (1 - u), c1.z + (c2.z - c1.z) * u); }
        P.needsUpdate = true; v.cuerda.visible = true;
      }
      M.animar(t, f.faseM, f.marcha); return;
    }
    let hx, hz, lado;
    if (v && v.etapa === 'montar') { hx = v.casa.x; hz = v.casa.z; lado = v.lado0; }
    else { const c = tablero.ciudades.get(f.ciudad), r = c.ranuras[f.ranura]; hx = c.pos.x + r.x * s; hz = c.pos.z + r.z * s; lado = Math.sign(r.x) || 1; }
    const px = hx + lado * 0.5 * s, pz = hz - 0.26 * s;
    if (!(v && v.animal)) { const moviendose = seguir(px, pz, null, -lado * 0.55, ESC_ESPERA, 5); M.animar(t, f.faseM, f.marcha); if (moviendose) cambios = true; return; }      // esperando (o yendo a su sitio)
    if (enBarco) g.position.set(n.x, n.y + f.cuerpo.position.y, n.z);
    else { const x = px + (n.x - px) * m, z = pz + (n.z - pz) * m; g.position.set(x, tablero.altura(x, z), z); }
    let giroP = -lado * 0.55 - f.giro; giroP = Math.atan2(Math.sin(giroP), Math.cos(giroP));
    const b = enBarco && v.enBarco ? v.tramos[v.i].barco.modelo.grupo.rotation : null;
    M.rumbo = f.giro + giroP * (1 - m); M.esc = ESC_ESPERA + (ESC_MONTADO - ESC_ESPERA) * m;
    g.rotation.set(b ? b.x : 0, M.rumbo, b ? b.z : 0, 'YXZ'); g.scale.setScalar(s * M.esc);
    M.animar(t, f.faseM, f.marcha);
  }

  // Desde dónde se mira (posición de la cámara): las figuras vistas de perfil enseñan su costado pintado.
  const ojo = new THREE.Vector3(0, 10, 20);
  function mirarDesde(p) { ojo.copy(p); }
  let sucio = false;
  function actualizar(t, dt, s = 1) {
    sucio = cambios; cambios = false;
    const k = 1 - Math.exp(-dt * 12);
    for (const f of fichas) {
      const meta = f.elegida ? 1 : f.rival ? 0.8 : f.foco ? 0.45 : f.turno ? 0.5 : 0; const antes = f.nivel;
      f.aro.material.color.setHex(f.rival ? 0xff7a5c : 0xffe2a0);
      f.nivel += (meta - f.nivel) * k; if (Math.abs(f.nivel - meta) < 0.002) f.nivel = meta;
      if (antes !== f.nivel || f.elegida || f.rival) sucio = true;
      const mat = f.fig?.material, M = f.montura, esAlf = f.transporte === 'alfombra';
      if (f.fig) { const lat = Math.abs(Math.sin(Math.atan2(ojo.x - f.nodo.position.x, ojo.z - f.nodo.position.z) - f.giro)); f.fig.ponerLado(paso(0.42, 0.85, lat)); }
      if (f.control) {      // la pelea lleva la ficha: aquí solo se apagan los adornos de reposo y se da vuelo a las telas
        sucio = true; f.control(f, t, dt, s);
        f.aro.visible = false; f.blanco.scale.setScalar(s); f.sombra.scale.setScalar(0.8 * s); if (mat) mat.emissiveIntensity = 0;
        f.fig?.animar(t, { fase: t * 9, andar: 0.25, vuelo: 0.9, empuje: 0.25 * Math.sin(t * 5) });
        if (M && !esAlf) situarAnimal(f, t, s, dt);
        continue;
      }
      let alto = 0, cabeceo = 0, ladeo = 0, estY = 1, estX = 1;
      if (f.viaje) { sucio = true; ({ alto, cabeceo, ladeo } = avanzar(f, f.viaje, t, dt, s)); f.vuelo += (0.7 - f.vuelo) * (1 - Math.exp(-dt * 4)); }
      else {
        const c = tablero.ciudades.get(f.ciudad), r = c.ranuras[f.ranura]; f.nodo.position.set(c.pos.x + r.x * s, 0, c.pos.z + r.z * s); f.nodo.position.y = tablero.altura(f.nodo.position.x, f.nodo.position.z);
        // en reposo mira al sur (hacia la vista general)
        // Jorge (23 de noviembre): tu monito da vueltas despacio con el acercamiento máximo (giraCerca) y da una vuelta entera si lo tocas (girar)
        if (f.giraCerca || f.girar > 0) { const w = Math.min(dt, 0.05) * 1.5; f.giro += w; if (!f.giraCerca) f.girar = Math.max(0, f.girar - w); sucio = true; }
        else { let dif = -f.giro; dif = Math.atan2(Math.sin(dif), Math.cos(dif)); if (Math.abs(dif) > 0.001) { f.giro += dif * (1 - Math.exp(-dt * 5)); sucio = true; } }
        if (f.rebote > 0) { f.rebote = Math.max(0, f.rebote - dt * 2.6); const b = Math.sin(f.rebote * Math.PI * 3) * f.rebote; estY = 1 - 0.05 * b; estX = 1 + 0.03 * b; sucio = true; }
        alto = f.nivel * (0.06 + (f.elegida || f.rival ? 0.03 * Math.sin(t * 3.2 + (f.rival ? 2 : 0)) : 0));
        f.andar *= Math.exp(-dt * 9); f.vuelo *= Math.exp(-dt * 2.2); f.empuje *= Math.exp(-dt * 4);
        if (f.andar > 0.003 || f.vuelo > 0.003) sucio = true;
      }
      const m = f.mont, encoger = esAlf ? 0.3 : 0.55;
      if (f.fig) {
        f.fig.grupo.position.y = Y_PIE * (1 - m) + m * (esAlf ? 0.02 - f.fig.yAsiento * (1 - encoger) : M ? M.asiento.y * (ESC_ESPERA + (ESC_MONTADO - ESC_ESPERA) * m) - f.fig.yAsiento : 0);
        f.fig.grupo.position.z = M && !esAlf ? m * M.asiento.z * ESC_MONTADO : 0;
        f.fig.animar(t, { fase: f.fase, andar: f.andar, vuelo: f.vuelo, empuje: f.empuje, montar: m, encoger, abrir: esAlf ? 0.9 : 0.5 });
      }
      f.cuerpo.position.y = alto * s; f.blanco.scale.setScalar(s);
      if (M && !esAlf) situarAnimal(f, t, s, dt);
      f.cuerpo.rotation.set(cabeceo, f.giro, ladeo, 'YXZ');
      f.cuerpo.scale.set(estX * s, estY * s, estX * s);
      f.sombra.visible = !f.viaje?.enBarco; f.sombra.scale.setScalar(0.8 * s * (1 - Math.min(0.45, alto * 0.7)));
      f.sombra.material.opacity = 0.85 * (1 - Math.min(0.5, alto * 0.9));
      f.aro.visible = f.nivel > 0.01 && !f.viaje?.enBarco; f.aro.material.opacity = f.nivel * (0.85 + 0.15 * Math.sin(t * 3.2)); f.aro.rotation.y = -t * 0.8; f.aro.scale.setScalar((1.0 + 0.12 * f.nivel) * s);
      if (mat) mat.emissiveIntensity = 0.1 * f.nivel;
      if (f.tOnda < 1) { f.tOnda = Math.min(1, f.tOnda + dt / 0.6); const e = 1 - (1 - f.tOnda) ** 2; f.onda.visible = f.tOnda < 1; f.onda.scale.setScalar((0.7 + 1.7 * e) * s); f.onda.material.opacity = 0.75 * (1 - f.tOnda); }
    }
  }
  // Arma que la figura saca al pelear (se crea la primera vez que hace falta).
  function armaDe(f) {
    if (!f.arma || !f.fig) return null;
    return (f.armas[f.arma] ||= (() => { const a = crearArma(f.arma, mats), porta = new THREE.Group(); porta.scale.setScalar(1.22); a.grupo.visible = false; porta.add(a.grupo); f.fig.mano.add(porta); return a; })());
  }
  function destruir() { for (const f of fichas.slice()) quitar(f); tAro.dispose(); gPlano.dispose(); gBlanco.dispose(); for (const p of texturas.values()) p.then((t) => t.dispose()).catch(() => {}); }
  return { fichas, blancos, porId, poner, ponerTodos, quitar, viajar, actualizar, mirarDesde, armaDe, destruir, get sucio() { return sucio; } };
}
