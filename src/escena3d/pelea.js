// Peleas: SOLO animación. Dos fichas de la misma ciudad se encaran y cada una se mueve según el arma que lleva.
// No hay ganador, ni dados, ni daño, ni consecuencias: al terminar, las dos vuelven a su sitio.
import * as THREE from 'three';
import { esHoja, crearFlecha } from './armas.js';
import { ANCHO, ALTO } from './medidas.js';

const paso = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const kf = (p, cl) => {      // interpolación suave entre claves [momento, valor]
  if (p <= cl[0][0]) return cl[0][1];
  for (let i = 1; i < cl.length; i++) if (p <= cl[i][0]) return mix(cl[i - 1][1], cl[i][1], paso(cl[i - 1][0], cl[i][0], p));
  return cl[cl.length - 1][1];
};
const rebote = (u) => { const c = 1.70158; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };

// Coreografía de cada arma: [inicio, duración, movimiento, lado, fuerza].
//   tajo = cimitarra (tajos amplios y curvos) · estocada = jambiya (cortas y rápidas) · mazazo = alfanje (golpes pesados)
//   tiro = arco (a distancia, con la flecha en vuelo) · puno = sin armas (puños y empujones)
const SERIE = {
  cimitarra: { ataque: [[0, 0.64, 'tajo', 1, 1], [0.6, 0.64, 'tajo', -1, 1], [1.2, 0.72, 'tajo', 1, 1.3]], replica: [[0, 0.66, 'tajo', -1, 1.1]] },
  jambiya: { ataque: [[0, 0.3, 'estocada', 1, 0.7], [0.27, 0.3, 'estocada', -1, 0.7], [0.54, 0.3, 'estocada', 1, 0.7], [0.88, 0.3, 'estocada', -1, 0.8], [1.15, 0.36, 'estocada', 1, 1.1]], replica: [[0, 0.3, 'estocada', 1, 0.8], [0.27, 0.34, 'estocada', -1, 1]] },
  alfanje: { ataque: [[0, 1.05, 'mazazo', 1, 1.3], [1.0, 1.12, 'mazazo', 1, 1.5]], replica: [[0, 1.08, 'mazazo', 1, 1.4]] },
  arco: { ataque: [[0.55, 1.5, 'tiro', 1, 1]], replica: [[0.55, 1.5, 'tiro', 1, 1]] },
  '': { ataque: [[0, 0.36, 'puno', 1, 0.8], [0.33, 0.36, 'puno', -1, 0.8], [0.66, 0.36, 'puno', 1, 0.9], [1.02, 0.44, 'puno', -1, 1.3]], replica: [[0, 0.36, 'puno', 1, 0.9], [0.33, 0.42, 'puno', -1, 1.1]] },
};
const IMPACTO = { tajo: 0.53, estocada: 0.5, mazazo: 0.6, tiro: 0.62, puno: 0.5 };       // fracción del movimiento en que llega el golpe (o sale la flecha)
const SILBIDO = { tajo: 0.38, estocada: 0.28, mazazo: 0.46 };
const VUELO = 0.3, RETROCESO = 1.75, T_ENTRA = 0.75, T_SALE = 0.85;
const GUARDIA = (tipo) => (esHoja(tipo) ? { bx: -0.75, fil: 0.5 } : tipo === 'arco' ? { bx: -0.45, fil: 0 } : { bx: -0.3, fil: 0 });

export function crearPelea({ escena, tablero, fichas, camara, efectos, sonido, mats }) {
  let P = null;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), ejeY = new THREE.Vector3(0, 1, 0), q1 = new THREE.Quaternion();
  const flechas = [0, 1].map(() => { const f = crearFlecha(mats); f.grupo.visible = false; escena.add(f.grupo); return { o: f.grupo, estela: efectos.crearEstela(0xfff0d0, 12, 0.14), vuelo: null }; });

  // replica: el segundo responde · acierta: la flecha del primero da en el blanco (solo animación) · ritmo: velocidad de la secuencia
  // formar: solo se plantan uno frente al otro, en guardia, y esperan (Jorge, 23 de noviembre: la pelea va después de los dados);
  // los golpes llegan con golpear() y la formación se deshace con soltar().
  function iniciar(iA, iB, alTerminar, { replica = true, acierta = false, ritmo = 1, formar = false } = {}) {
    if (P) return false;
    const A = fichas.fichas[iA], B = fichas.fichas[iB];
    if (!A || !B || A === B || A.viaje || B.viaje || A.ciudad !== B.ciudad) return false;
    const c = tablero.ciudades.get(A.ciudad), k = c.capital ? 1.2 : 1, sep = 0.72, cz = Math.min(c.pos.z + 1.3 * k, ALTO / 2 - 0.7);
    // el duelo se planta delante de la ciudad; si un arquero necesita tomar distancia y no hay tablero, todo se corre hacia dentro
    const margen = [A, B].map((f) => sep + (f.arma === 'arco' ? RETROCESO + 0.55 : 0.95)), tope = ANCHO / 2 - 0.75;
    const cx = Math.min(tope - margen[1], Math.max(-tope + margen[0], c.pos.x));
    const lado = [-1, 1], L = [A, B].map((f, q) => ({
      f, q, tipo: f.arma || '', arma: fichas.armaDe(f), guardia: GUARDIA(f.arma || ''), giro0: f.giro, giroDuelo: -lado[q] * Math.PI / 2, fx: -lado[q], fz: 0,
      puesto: new THREE.Vector3(cx + lado[q] * sep, 0, cz), casa: new THREE.Vector3(), estela: null,
    }));
    for (const F of L) {
      if (F.arma) { F.arma.grupo.visible = true; F.arma.grupo.scale.setScalar(0.001); if (esHoja(F.tipo)) F.estela = (F.arma.estela ||= efectos.crearEstela(F.tipo === 'alfanje' ? 0xffe0b0 : 0xf4fbff, 18, F.tipo === 'jambiya' ? 0.13 : 0.2)); }
      if (F.f.accesorio) F.f.accesorio.visible = F.tipo !== 'cimitarra';
      F.f.control = () => {}; F.f.elegida = false;
    }
    // línea de tiempo: ataque de A, réplica de B
    const golpes = []; let t = T_ENTRA + 0.2;
    const agrega = (q, serie) => {
      let fin = t;
      for (const [t0, dur, tipo, ld, fuerza] of serie) {
        golpes.push({ quien: q, t0: t + t0, dur, tipo, lado: ld, fuerza, ti: t + t0 + dur * IMPACTO[tipo] + (tipo === 'tiro' ? VUELO : 0), silbo: false, tenso: false, suelta: false, hecho: false });
        fin = Math.max(fin, t + t0 + dur + (tipo === 'tiro' ? 0.45 : 0));
      }
      t = fin + 0.22;
    };
    if (!formar) { agrega(0, SERIE[L[0].tipo].ataque); if (replica) agrega(1, SERIE[L[1].tipo].replica); }
    const x0 = cx - margen[0], x1 = cx + margen[1];
    const puntos = [[x0, 0], [x1, 0], [x0, 1.25], [x1, 1.25]].map(([x, y]) => new THREE.Vector3(x, y, cz));
    const vista = camara.encuadre(puntos, { x: (x0 + x1) / 2, z: cz - 0.85, pol: 1.17, az: 0 }, 0.9);
    P = { L, golpes, t: 0, tSale: formar ? Infinity : t, tFin: formar ? Infinity : t + T_SALE, pausa: 0, ciudad: c, alTerminar, previa: camara.leer(), fin: false, acierta, ritmo, formada: formar, tHecho: null, alHecho: null, vista };
    camara.tocado = false;
    camara.volar(vista, 0.8);      // apunta algo detrás, para centrar las fichas a media altura
    sonido?.tocar('pelea-inicio');
    return true;
  }

  // Con la formación puesta: una tanda de golpes. quien: quién ataca (0 = el primero de iniciar, 1 = el otro) · arco: dispara una flecha
  // (saca el arco solo para el tiro) · salir: al acabar vuelven a su sitio y termina la pelea; si no, siguen formados.
  function golpear(alHecho, { quien = 0, arco = false, replica = true, acierta = false, ritmo = 1, salir = true } = {}) {
    if (!P || !P.formada || P.tHecho != null || P.tSale !== Infinity) return false;
    const At = P.L[quien], Re = P.L[1 - quien];
    if (arco && At.tipo !== 'arco') cambiarArma(At, 'arco', true);
    P.acierta = acierta; P.ritmo = ritmo;
    let t = Math.max(P.t, T_ENTRA) + 0.2;
    const agrega = (q, serie) => {
      let fin = t;
      for (const [t0, dur, tipo, ld, fuerza] of serie) {
        P.golpes.push({ quien: q, t0: t + t0, dur, tipo, lado: ld, fuerza, ti: t + t0 + dur * IMPACTO[tipo] + (tipo === 'tiro' ? VUELO : 0), silbo: false, tenso: false, suelta: false, hecho: false });
        fin = Math.max(fin, t + t0 + dur + (tipo === 'tiro' ? 0.45 : 0));
      }
      t = fin + 0.22;
    };
    agrega(quien, SERIE[At.tipo].ataque); if (replica) agrega(1 - quien, SERIE[Re.tipo].replica);
    if (salir) { P.tSale = t; P.tFin = t + T_SALE; P.alTerminar = alHecho; } else { P.tHecho = t; P.alHecho = alHecho; }
    if (!camara.tocado) camara.volar(P.vista, 0.6);
    return true;
  }
  // Deshace la formación sin (más) golpes: vuelven a su sitio.
  function soltar(alTerminar) {
    if (!P || !P.formada || P.tSale !== Infinity) return false;
    P.tHecho = null; P.alHecho = null; P.tSale = Math.max(P.t, T_ENTRA); P.tFin = P.tSale + T_SALE; P.alTerminar = alTerminar;
    return true;
  }
  // Cambia el arma que un luchador lleva en la mano (el arco para el flechazo, y de vuelta la suya).
  function cambiarArma(F, tipo, temporal) {
    if (temporal) F.propia = { tipo: F.tipo, armaFicha: F.f.arma };
    if (F.arma) { F.arma.grupo.visible = false; F.arma.tensar?.(0, false); F.estela?.cortar(); }
    F.f.arma = temporal ? tipo : F.propia.armaFicha; F.tipo = temporal ? tipo : F.propia.tipo; if (!temporal) F.propia = null;
    F.arma = fichas.armaDe(F.f); F.guardia = GUARDIA(F.tipo); F.estela = null;
    if (F.arma) { F.arma.grupo.visible = true; if (esHoja(F.tipo)) F.estela = (F.arma.estela ||= efectos.crearEstela(F.tipo === 'alfanje' ? 0xffe0b0 : 0xf4fbff, 18, F.tipo === 'jambiya' ? 0.13 : 0.2)); }
    if (F.f.accesorio) F.f.accesorio.visible = F.tipo !== 'cimitarra';
  }

  // Postura de un luchador en el instante t: guardia + sus golpes + sus reacciones a los golpes del otro.
  function postura(F, t) {
    const G = F.guardia, o = { av: 0, lat: 0, y: 0.012 * Math.sin(t * 9 + F.q * 2), giro: 0, cab: 0.03 * Math.sin(t * 4.5 + F.q), lad: 0, ex: 1, ey: 1, bx: G.bx, fil: G.fil, tens: 0, flecha: false, estela: false };
    const conHoja = esHoja(F.tipo);
    for (const g of P.golpes) {
      const s = g.lado;
      if (g.quien === F.q) {
        const p = (t - g.t0) / g.dur;
        if (g.tipo === 'tiro') {      // el arquero toma distancia de un salto, dispara y vuelve
          const ida = paso(g.t0 - 0.5, g.t0 - 0.05, t), vuelta = paso(g.t0 + g.dur * 0.82, g.t0 + g.dur + 0.42, t);
          o.av -= RETROCESO * ida * (1 - vuelta); o.y += 0.26 * (Math.sin(Math.PI * ida) + Math.sin(Math.PI * vuelta));
        }
        if (p < 0 || p > 1) continue;
        if (g.tipo === 'tajo') {
          o.giro += s * kf(p, [[0, 0], [0.4, -1.25], [0.62, 1.55], [1, 0]]); o.av += kf(p, [[0, 0], [0.4, -0.1], [0.6, 0.4], [1, 0]]);
          o.cab += kf(p, [[0, 0], [0.4, -0.08], [0.6, 0.2], [1, 0]]); o.y += kf(p, [[0, 0], [0.45, 0.1], [0.62, 0], [1, 0]]); o.lad += -s * kf(p, [[0, 0], [0.5, 0.16], [1, 0]]);
          o.bx = kf(p, [[0, G.bx], [0.35, -1.5], [0.7, -1.4], [1, G.bx]]); o.fil = kf(p, [[0, G.fil], [0.35, 1.3], [0.7, 1.6], [1, G.fil]]); o.estela = p > 0.38 && p < 0.7;
        } else if (g.tipo === 'estocada') {
          o.av += kf(p, [[0, 0], [0.3, -0.12], [0.5, 0.44], [0.7, 0.3], [1, 0]]); o.cab += kf(p, [[0, 0], [0.3, -0.05], [0.5, 0.15], [1, 0]]); o.giro += -s * kf(p, [[0, 0], [0.5, 0.28], [1, 0]]);
          o.bx = kf(p, [[0, G.bx], [0.3, -0.7], [0.5, -1.52], [1, G.bx]]); o.fil = kf(p, [[0, G.fil], [0.3, 1.3], [0.5, 1.62], [1, G.fil]]); o.estela = p > 0.28 && p < 0.62;
        } else if (g.tipo === 'mazazo') {
          o.cab += kf(p, [[0, 0], [0.45, -0.34], [0.6, 0.46], [0.8, 0.4], [1, 0]]); o.y += kf(p, [[0, 0], [0.3, 0.16], [0.5, 0.22], [0.6, 0], [1, 0]]); o.av += kf(p, [[0, 0], [0.45, -0.08], [0.6, 0.34], [0.8, 0.3], [1, 0]]);
          o.ey *= kf(p, [[0, 1], [0.45, 1.07], [0.62, 0.86], [0.8, 0.97], [1, 1]]);
          o.bx = kf(p, [[0, G.bx], [0.45, -2.9], [0.6, -1.15], [0.8, -1.1], [1, G.bx]]); o.fil = kf(p, [[0, G.fil], [0.45, -0.55], [0.6, 1.95], [0.8, 1.9], [1, G.fil]]); o.estela = p > 0.46 && p < 0.68;
        } else if (g.tipo === 'tiro') {
          o.bx = kf(p, [[0, G.bx], [0.18, -1.5], [0.85, -1.5], [1, G.bx]]); o.giro += kf(p, [[0, 0], [0.2, 0.3], [0.85, 0.3], [1, 0]]);
          o.cab += kf(p, [[0, 0], [0.55, -0.1], [0.66, 0.06], [1, 0]]); o.av += kf(p, [[0.6, 0], [0.66, -0.09], [1, 0]]);
          o.tens = p < 0.62 ? kf(p, [[0.18, 0], [0.55, 1]]) : 0.1 * Math.cos((p - 0.62) * 90) * Math.exp(-(p - 0.62) * 22); o.flecha = p > 0.14 && p < 0.62;
        } else if (g.tipo === 'puno') {
          o.av += kf(p, [[0, 0], [0.25, -0.06], [0.5, 0.38], [1, 0]]); o.giro += s * kf(p, [[0, 0], [0.5, 0.55], [1, 0]]); o.lad += -s * kf(p, [[0, 0], [0.5, 0.2], [1, 0]]);
          o.cab += kf(p, [[0, 0], [0.5, 0.16], [1, 0]]); o.ex *= kf(p, [[0, 1], [0.5, 1.06], [1, 1]]);
          if (s < 0) o.bx = kf(p, [[0, G.bx], [0.25, -0.2], [0.5, -1.55], [1, G.bx]]);
        }
      } else {
        const tau = t - g.ti; if (tau < -0.32 || tau > 0.95) continue;
        const env = tau < 0 ? paso(-0.18, 0, tau) : Math.exp(-tau * 5.5), golpe = tau > 0 ? Math.exp(-tau * 7) : 0, fz = g.fuerza;
        const bulto = paso(-0.2, -0.02, tau) * (1 - paso(0.12, 0.45, tau));
        if (g.tipo === 'puno') { o.av -= 0.2 * fz * golpe; o.lad += 0.22 * fz * Math.sin(tau * 22) * golpe; o.ey -= 0.1 * golpe; o.ex += 0.06 * golpe; }
        else if (g.tipo === 'tiro') {
          if (P.acierta) { o.av -= 0.34 * golpe + 0.1 * env * (tau > 0 ? 1 : 0); o.cab -= 0.3 * golpe; o.lad += 0.16 * Math.sin(tau * 24) * golpe; o.ey -= 0.07 * golpe; }      // acusa el flechazo
          else if (conHoja) { o.bx = mix(o.bx, -1.5, env); o.fil = mix(o.fil, 1.1, env); o.giro += 0.9 * golpe; }      // desvía la flecha con la hoja
          else { o.lat += 0.52 * bulto; o.ey -= 0.14 * bulto; o.lad += 0.24 * bulto; }                          // la esquiva de un paso
        } else if (conHoja) {        // parada con la hoja
          o.bx = mix(o.bx, -1.8, env); o.fil = mix(o.fil, 0.3, env); o.av -= (g.tipo === 'mazazo' ? 0.32 : 0.14) * fz * golpe; o.cab -= 0.14 * fz * golpe; o.lad += 0.08 * Math.sin(tau * 26) * golpe;
        } else if (g.tipo === 'mazazo') {      // salta hacia atrás
          o.av -= 0.55 * paso(-0.22, 0.02, tau) * (1 - paso(0.35, 0.8, tau)); o.y += 0.3 * Math.sin(Math.PI * paso(-0.22, 0.2, tau));
        } else { o.ey -= 0.26 * bulto; o.ex += 0.1 * bulto; o.lat += 0.24 * s * bulto; o.lad -= 0.2 * s * bulto; o.cab -= 0.1 * bulto; }      // se agacha y se aparta
      }
    }
    return o;
  }

  function impacto(g) {
    const At = P.L[g.quien], Re = P.L[1 - g.quien], conHoja = esHoja(Re.tipo), fz = g.fuerza, pr = Re.f.nodo.position, pa = At.f.nodo.position;
    const choque = v1.set(pr.x + Re.fx * 0.34, pr.y + 0.58, pr.z + 0.02), pies = v2.set(pr.x, pr.y, pr.z);
    if (g.tipo === 'puno') { efectos.polvo(v3.copy(choque).setY(pr.y + 0.3), 4, 0.5, 0xe8dcc0); efectos.destello(choque, 0.5 * fz, 0xfff6e0); camara.temblor(0.035 * fz); sonido?.tocar('pelea-punos', fz); }
    else if (conHoja) {
      efectos.chispas(choque, Math.round(16 * fz), fz, 0xffd27a); efectos.destello(choque, 0.8 * fz); sonido?.tocar(g.tipo === 'mazazo' && Re.f.conEscudo ? 'escudo-bloqueo' : 'choque-metal', fz);
      if (g.tipo === 'mazazo') { efectos.polvo(pies, 6, 0.8); camara.temblor(0.13); P.pausa = 0.06; } else camara.temblor(0.05 * fz);
    } else if (g.tipo === 'mazazo') {      // el golpe pesado cae en el suelo
      const s = v3.set(pa.x + At.fx * 0.62, tablero.altura(pa.x + At.fx * 0.62, pa.z), pa.z);
      efectos.onda(s, 2.0); efectos.polvo(s, 9, 1.0); efectos.chispas(v1.copy(s).setY(s.y + 0.06), 8, 0.7, 0xffe2b0); camara.temblor(0.14); P.pausa = 0.05; sonido?.tocar('golpe-suelo', fz);
    } else { efectos.polvo(pies, 3, 0.5); sonido?.tocar('esquiva', fz); }
  }

  function soltarFlecha(g) {
    const At = P.L[g.quien], Re = P.L[1 - g.quien], fl = flechas[g.quien], arma = At.arma;
    const de = arma.grupo.localToWorld(new THREE.Vector3(0, 0, 0.12)), a = new THREE.Vector3(Re.puesto.x + Re.fx * 0.2, Re.f.nodo.position.y + 0.56, Re.puesto.z);
    const dir = a.clone().sub(de).setY(0).normalize(), suelo = new THREE.Vector3(a.x + dir.x * 1.5, 0, a.z + dir.z * 1.5); suelo.y = tablero.altura(suelo.x, suelo.z) + 0.07;
    fl.vuelo = { de, a, suelo, dir, t: 0, fase: 0, desvia: esHoja(Re.tipo), acierta: P.acierta, vel: new THREE.Vector3(), giro: 0 };
    fl.o.visible = true; fl.o.scale.setScalar(1); fl.estela.cortar();
    sonido?.tocar('arco-disparo');
  }
  function moverFlecha(fl, dt) {
    const w = fl.vuelo; if (!w) return;
    const o = fl.o, antes = v1.copy(o.position); w.t += dt;
    if (w.fase === 0) {                        // vuelo hasta el rival
      const u = Math.min(1, w.t / VUELO); o.position.lerpVectors(w.de, w.a, u); o.position.y += Math.sin(Math.PI * u) * 0.1;
      if (u >= 1) {
        w.t = 0;
        if (w.acierta) { w.fase = 3; efectos.destello(w.a, 0.9, 0xfff0d8); efectos.polvo(w.a, 5, 0.45, 0xe8dcc0); efectos.onda(v3.copy(w.a).setY(w.suelo.y - 0.05), 1.3, 0xffe6b0); camara.temblor(0.09); sonido?.tocar('flecha-acierto'); }
        else if (w.desvia) { w.fase = 2; w.vel.set(-w.dir.x * 1.6 + (Math.random() - 0.5), 4.2, -w.dir.z * 1.6 - 1.2); efectos.chispas(w.a, 14, 1, 0xffd27a); efectos.destello(w.a, 0.7); camara.temblor(0.05); sonido?.tocar('choque-metal', 0.8); }
        else w.fase = 1;
      }
    } else if (w.fase === 1) {                 // pasa de largo y se clava en el suelo
      const u = Math.min(1, w.t / 0.13); o.position.lerpVectors(w.a, w.suelo, u);
      if (u >= 1) { w.fase = 3; w.t = 0; efectos.polvo(w.suelo, 4, 0.5); camara.temblor(0.03); sonido?.tocar('flecha-impacto'); }
    } else if (w.fase === 2) {                 // desviada: sale dando vueltas
      w.vel.y -= 12 * dt; o.position.addScaledVector(w.vel, dt); w.giro += dt * 22; o.rotation.set(w.giro, 0.4, w.giro * 0.6);
      o.scale.setScalar(Math.max(0.001, 1 - w.t / 0.6)); if (w.t > 0.6) { o.visible = false; fl.vuelo = null; }
      return;
    } else {                                   // clavada: vibra un instante y se desvanece
      o.scale.setScalar(w.t < 0.7 ? 1 : Math.max(0.001, 1 - (w.t - 0.7) / 0.3)); if (w.t > 1) { o.visible = false; fl.vuelo = null; }
      return;
    }
    v2.copy(o.position).sub(antes); if (v2.lengthSq() > 1e-8) { o.quaternion.setFromUnitVectors(ejeY, v2.normalize()); }
    fl.estela.muestra(v2.copy(o.position).addScaledVector(ejeY, -0.018), v3.copy(o.position).addScaledVector(ejeY, 0.018));
  }

  // Coloca un luchador tal como está en el instante t (y, si su hoja va en pleno golpe, deja una muestra para la estela).
  function colocar(F, t, s, atraso) {
    const c = P.ciudad, f = F.f, o = postura(F, t), r = c.ranuras[f.ranura];
    const entra = paso(0, T_ENTRA, t), sale = P.tSale === Infinity ? 0 : paso(P.tSale, P.tFin, t), enDuelo = entra * (1 - sale), saca = t < P.tSale ? rebote(paso(0.3, 0.7, t)) : 1 - paso(P.tSale, P.tSale + 0.3, t);
    const salto = 0.42 * (Math.sin(Math.PI * entra) + Math.sin(Math.PI * sale));
    F.casa.set(c.pos.x + r.x * s, 0, c.pos.z + r.z * s);
    const x = mix(F.casa.x, F.puesto.x, enDuelo) + (F.fx * o.av) * enDuelo, z = mix(F.casa.z, F.puesto.z, enDuelo) + (-F.fx * o.lat) * enDuelo;
    f.nodo.position.set(x, tablero.altura(x, z), z);
    f.cuerpo.position.y = (o.y * enDuelo + salto) * s;
    let dg = F.giroDuelo - F.giro0; dg = Math.atan2(Math.sin(dg), Math.cos(dg));
    f.giro = F.giro0 + dg * enDuelo + o.giro * enDuelo;
    f.cuerpo.rotation.set(o.cab * enDuelo, f.giro, o.lad * enDuelo, 'YXZ');
    f.cuerpo.scale.set(mix(1, o.ex, enDuelo) * s, mix(1, o.ey, enDuelo) * s, mix(1, o.ex, enDuelo) * s);
    const k = Math.min(1, Math.max(0, saca)) * enDuelo;
    f.brazo.rotation.x = o.bx * k; f.mano.rotation.x = (o.fil - o.bx) * k; f.fig?.alzar(Math.min(1, Math.max(0, (-o.bx * k) / 2.4)));
    if (F.arma) {
      F.arma.grupo.scale.setScalar(Math.max(0.001, saca)); F.arma.tensar?.(o.tens, o.flecha);
      if (F.estela && o.estela) { f.nodo.updateMatrixWorld(true); F.estela.muestra(F.arma.grupo.localToWorld(v1.copy(F.arma.base).lerp(F.arma.punta, 0.5)), F.arma.grupo.localToWorld(v2.copy(F.arma.punta)), atraso); }      // solo la mitad de la punta deja estela
    }
  }

  function actualizar(dt, s = 1) {
    for (const fl of flechas) moverFlecha(fl, dt);
    if (!P) return;
    if (P.pausa > 0) { P.pausa -= dt; return; }      // un instante congelado en los golpes fuertes
    dt *= P.ritmo; P.t += dt; const t = P.t;
    // Con pocas imágenes por segundo la hoja recorre mucho entre un cuadro y el siguiente: se toman muestras intermedias para la estela.
    const pasos = Math.max(1, Math.min(6, Math.ceil(dt / 0.011)));
    for (let k = 1; k <= pasos; k++) { const tt = t - dt + (dt * k) / pasos; for (const F of P.L) if (k === pasos || F.estela) colocar(F, tt, s, t - tt); }
    for (const g of P.golpes) {
      const p = (t - g.t0) / g.dur, At = P.L[g.quien];
      if (!g.silbo && SILBIDO[g.tipo] != null && p >= SILBIDO[g.tipo]) { g.silbo = true; sonido?.tocar('pelea-' + At.tipo, g.fuerza); }
      if (g.tipo === 'tiro') {
        if (!g.tenso && p >= 0.18) { g.tenso = true; sonido?.tocar('arco-tensar'); }
        if (!g.suelta && p >= IMPACTO.tiro) { g.suelta = true; At.f.nodo.updateMatrixWorld(true); soltarFlecha(g); }
      }
      if (!g.hecho && t >= g.ti) { g.hecho = true; if (g.tipo !== 'tiro') impacto(g); }
    }
    if (P.tHecho != null && t >= P.tHecho) { const f = P.alHecho; P.tHecho = null; P.alHecho = null; for (const F of P.L) if (F.propia) cambiarArma(F, '', false); f?.(); if (!P) return; }
    if (t >= P.tFin) terminar();
  }

  function terminar() {
    const p = P; P = null;
    for (const F of p.L) {
      if (F.propia) cambiarArma(F, '', false);
      const f = F.f; f.control = null; f.brazo.rotation.set(0, 0, 0); f.mano.rotation.set(0, 0, 0); f.rebote = 0.7;
      if (F.arma) { F.arma.grupo.visible = false; F.arma.tensar?.(0, false); F.estela?.cortar(); }
      if (f.accesorio) f.accesorio.visible = true;
    }
    if (!camara.tocado) camara.volar(p.previa, 1.0);
    sonido?.tocar('pelea-fin');
    p.alTerminar?.();
  }

  return { iniciar, golpear, soltar, actualizar, get activa() { return !!P; }, get formada() { return !!P && P.formada && P.tSale === Infinity; }, get golpeando() { return !!P && !(P.formada && P.tSale === Infinity && P.tHecho == null); }, get quienes() { return P ? P.L.map((F) => F.f.id) : []; }, get tiempo() { return P ? P.t : -1; }, get golpes() { return P ? P.golpes : []; } };
}
