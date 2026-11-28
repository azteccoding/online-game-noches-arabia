import React, { useEffect, useRef, useState } from 'react';
import { enviar, useJuego } from '../game/store.js';
import { ACCIONES } from '../game/protocol.js';
import { cartaDelMotivo } from '../game/orden.js';
import { escenaActual, enCola, quietos, dadosDePelea, armaDePelea } from '../game/escena3d.js';

// Dados rojos con puntos blancos, 100 % SVG (caras) sobre un cubo CSS 3D. El servidor decide los valores; el cliente solo anima.
// Todos los clientes ven los mismos dados; cualquiera puede cerrar el resultado y entonces desaparecen para todos (estado.dados = null).
const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]] };
// Colores de dado: rojo = jugadores, amarillo = Yafar (jugador o NPC), azul = asaltantes y demás NPC. Puntos claros o, en el amarillo, oscuros.
const COLORES = {
  rojo: { g: ['#e2383f', '#b3202a', '#7c1018'], borde: '#4a0a10', brillo: '#f08a8f', pip: ['#fff', '#e8dfd0'] },
  amarillo: { g: ['#ffe27a', '#e9b62a', '#b07d0c'], borde: '#6b4a05', brillo: '#fff3c2', pip: ['#4a2e05', '#2a1802'] },
  azul: { g: ['#4f8fe0', '#2459b3', '#123571'], borde: '#0b1f45', brillo: '#9cc3f5', pip: ['#fff', '#dfe8f5'] },
  verde: { g: ['#5cc77a', '#2e8f4c', '#165a2c'], borde: '#0c3a1b', brillo: '#a8e8b8', pip: ['#fff', '#e0f2e4'] },   // Dado de Maulana
};
export const Cara = ({ v, color = 'rojo' }) => {
  const c = COLORES[color] || COLORES.rojo, id = 'dado-' + color;
  return (
    <svg viewBox="0 0 100 100" className="cara-svg" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.g[0]} /><stop offset=".55" stopColor={c.g[1]} /><stop offset="1" stopColor={c.g[2]} /></linearGradient>
        <radialGradient id={id + '-pip'} cx=".35" cy=".35" r=".8"><stop offset="0" stopColor={c.pip[0]} /><stop offset="1" stopColor={c.pip[1]} /></radialGradient>
      </defs>
      <rect x="3" y="3" width="94" height="94" rx="16" fill={`url(#${id})`} stroke={c.borde} strokeWidth="3" />
      <rect x="7" y="7" width="86" height="86" rx="13" fill="none" stroke={c.brillo} strokeOpacity=".35" strokeWidth="1.5" />
      {PIPS[v].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8.4" fill={`url(#${id}-pip)`} />)}
    </svg>
  );
};
// A quién pertenece cada grupo de dados (por la etiqueta): un jugador (rojo), Yafar (amarillo) u otro NPC (azul).
export function colorGrupo(s, d, g) {
  const etq = g.etq || '';
  if (/Maulana/.test(etq)) return 'verde';   // Dado de Maulana (Jorge, 19 de noviembre)
  const j = Object.values(s.jugadores).find((x) => x.nombre && etq.startsWith(x.nombre));
  if (j) return j.pj === 'B' ? 'amarillo' : 'rojo';
  if (/Yafar/i.test(etq) || (!etq && (d.motivo === 'npc:Yafar'))) return 'amarillo';
  if (!etq) { const por = s.jugadores[d.por]; return por?.pj === 'B' ? 'amarillo' : por && !por.npc ? 'rojo' : 'azul'; }
  return 'azul';
}
const ROT = { 1: 'rotateX(0deg) rotateY(0deg)', 2: 'rotateX(-90deg) rotateY(0deg)', 3: 'rotateX(0deg) rotateY(-90deg)', 4: 'rotateX(0deg) rotateY(90deg)', 5: 'rotateX(90deg) rotateY(0deg)', 6: 'rotateX(0deg) rotateY(180deg)' };
const FACES = [['f1', 'translateZ(var(--m))', 1], ['f2', 'rotateX(90deg) translateZ(var(--m))', 2], ['f3', 'rotateY(90deg) translateZ(var(--m))', 3], ['f4', 'rotateY(-90deg) translateZ(var(--m))', 4], ['f5', 'rotateX(-90deg) translateZ(var(--m))', 5], ['f6', 'rotateY(180deg) translateZ(var(--m))', 6]];
export const RUEDA_MS = 1700;   // lo que tarda en rodar cada fila; las filas ruedan una después de otra
export const RUEDA_3D_MS = 3000;   // en la mesa 3D cada fila rueda más (shared/engine.js, RODAR_NPC_MS)

function Cubo({ valor, rodando, idx, color }) {
  return (
    <div className={`dado-escena${rodando ? ' rueda' : ''}`} style={{ '--i': idx }}>
      <div className="dado-sombra" />
      <div className="dado-salto">
        <div className="dado-cubo" style={{ '--fin': ROT[valor] }}>
          {FACES.map(([k, t, n]) => <div key={k} className="dado-cara" style={{ transform: t }}><Cara v={n} color={color} /></div>)}
        </div>
      </div>
    </div>
  );
}

// Deja el foco en un botón y lo vuelve a intentar un rato. Tras una pelea, la ventana de resultados nace mientras la pantalla sigue
// despejada (body.viendo-pelea la tiene oculta) y un botón oculto no acepta el foco: sin esto no se podía cerrar con Enter (Jorge, 24 de noviembre).
function useFoco(activo, clave) {
  const ref = useRef(null);
  useEffect(() => {
    if (!activo) return undefined;
    let n = 0;
    const poner = () => { const el = ref.current; if (!el || !el.isConnected) return false; if (document.activeElement !== el) el.focus({ preventScroll: true }); return document.activeElement === el; };
    if (poner()) return undefined;
    const reloj = setInterval(() => { if (poner() || ++n > 80) clearInterval(reloj); }, 120);
    return () => clearInterval(reloj);
  }, [activo, clave]);
  return ref;
}

const ESPERA_YAFAR_MS = 90000;

export default function Dados({ s }) {
  const d = s.dados;
  const cartaPrevia = useJuego((x) => x.cartaEnPantalla);
  const porLeer = useJuego((x) => x.cartaPorLeer);   // primera carta de la cola, aunque todavía no esté en pantalla
  const [fila, setFila] = useState(-1);          // fila que está rodando; -1 = ninguna (todas fijas)
  const [en3d, setEn3d] = useState(false);       // juego 3D: la tirada está rodando en la bandeja de la mesa
  const idVisto = useRef(null);
  const [visto, setVisto] = useState(null);      // la tirada que ya pasó por el efecto de abajo: hasta entonces no se enseña su resultado (ni un cuadro antes de rodar)
  const nFilas = Math.max(1, d?.grupos?.length || 1);
  // Jorge (19 de noviembre): ningún dado sale ya resuelto. Si la tirada espera detrás de la carta que la explica, no rueda a escondidas:
  // empieza a rodar, desde el principio, cuando la carta se cierra (antes se veía solo el resultado, p. ej. el dado de ingreso).
  const esperaCarta = !!d && ((cartaPrevia != null && cartaPrevia < d.id) || (porLeer != null && porLeer < d.id));
  const espero = useRef(null);
  // Jorge (28 de noviembre): el aviso de que Yafar NPC va contra alguien sale hasta que su monito ya está en la ciudad de la víctima
  // (antes, con un viaje largo, la pantalla dejaba de esperar a los 20 segundos y el aviso salía con Yafar todavía en camino).
  const [llego, setLlego] = useState(null);
  // También los dados de una pelea contra un NPC que llega caminando (Rayhán, R68): esperan a que su monito llegue.
  const esperaYafar = !!d && ((!!d.alerta && d.motivo === 'npc:Yafar') || !!d.peleaNPC) && !!escenaActual() && llego !== d.id;
  useEffect(() => {
    if (!esperaYafar) return undefined;
    let vivo = true; const id = d.id, listo = () => { if (vivo) { clearTimeout(reloj); setLlego(id); } };
    const reloj = setTimeout(listo, ESPERA_YAFAR_MS);   // por si la escena no avisara (pestaña en segundo plano)
    quietos(...Object.keys(s.jugadores || {}), ...(s.e3d?.pelea?.figura ? [s.e3d.pelea.atk] : [])).then(listo, listo);
    return () => { vivo = false; clearTimeout(reloj); };
  }, [esperaYafar, d?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (d && (esperaCarta || esperaYafar)) espero.current = d.id;
  useEffect(() => {
    if (!d || !d.lanzado || esperaCarta || esperaYafar) { setFila(-1); setEn3d(false); idVisto.current = null; if (!d) enCola((e) => e.limpiarDados()); return undefined; }       // espera a que su dueño pulse «Lanzar dados» (o a que se cierre la carta)
    if (idVisto.current === d.id) return undefined;
    idVisto.current = d.id; setVisto(d.id);
    const transcurrido = espero.current === d.id ? 0 : Math.max(0, s.ahora - d.t0);   // reloj del servidor: quien se une tarde ve el final
    // Los dados que este jugador no ve (reto o ingreso ajeno) tampoco ruedan en su mesa.
    const ajeno = d.por !== s.yo && (String(d.motivo || '').startsWith('reto:') || d.motivo === 'ingreso' || d.motivo === 'tumba');
    const enMesa = !!escenaActual() && !ajeno && !document.hidden;
    const total = (enMesa ? RUEDA_3D_MS : RUEDA_MS) * nFilas;
    if (transcurrido >= total) { setFila(-1); return undefined; }
    // Juego 3D: los dados ruedan de verdad sobre la bandeja y caen en los valores que decidió el servidor; al detenerse sale el resultado.
    if (enMesa) {
      const gs = (d.grupos?.length ? d.grupos : [{ etq: '', valores: d.valores }]).map((g) => ({ etq: g.etq || '', valores: g.valores.slice(0, 6), color: colorGrupo(s, d, g), fijo: !!g.fijo }));
      let vivo = true; setFila(-1); setEn3d(true);
      // La flecha del arco (su dado y su botón van antes de la pelea): primero cae el dado y luego vuela la flecha, que da o falla según ese dado.
      const P = s.e3d?.pelea;
      const flecha = d.boton === 'Disparar flecha' && dadosDePelea(d, P) ? { de: d.por, a: d.por === P.atk ? P.def : P.atk, acierta: /^¡Le da!/.test(d.resumen?.[0] || '') } : null;
      // El choque de armas va después de la última tirada de la pelea (Jorge, 23 de noviembre), y solo entonces sale el conteo.
      const choque = !flecha && P && !P.viva && !s.enCola && ['pelea', 'categoria'].includes(d.motivo) && dadosDePelea(d, P);
      const reloj = setTimeout(() => { if (vivo) setEn3d(false); }, total + (flecha || choque ? 16000 : 9000));   // por si la animación no avisara
      enCola(async (e) => { if (!vivo) return; await e.lanzarDados({ grupos: gs });   // si estos dados ya se cerraron mientras esperaban su turno en la cola, no se animan tarde
        if (flecha) await Promise.resolve(e.dispararFlecha(flecha.de, flecha.a, { acierta: flecha.acierta })).catch(() => {});
        if (choque) { const arma = (id) => armaDePelea(s.e3d, P, id), esclavo = (id) => s.e3d.jugadores?.[id]?.esclavoArma || ''; await Promise.resolve(e.pelear(P.atk, P.def, { armaAtacante: arma(P.atk), armaDefensor: arma(P.def), esclavoAtacante: esclavo(P.atk), esclavoDefensor: esclavo(P.def) })).catch(() => {}); } })
        .then(() => { if (vivo) { clearTimeout(reloj); setEn3d(false); } });
      return () => { vivo = false; clearTimeout(reloj); };
    }
    const ts = [];
    const primera = Math.floor(transcurrido / RUEDA_MS);
    setFila(primera);
    for (let k = primera + 1; k <= nFilas; k++) ts.push(setTimeout(() => setFila(k < nFilas ? k : -1), k * RUEDA_MS - transcurrido));
    return () => ts.forEach(clearTimeout);
  }, [d?.id, d?.lanzado, esperaCarta, esperaYafar]);   // eslint-disable-line react-hooks/exhaustive-deps
  const rodando = fila >= 0;
  // Jorge (23 de noviembre): la ventana de qué salió en tu dado de ingreso solo se cierra a mano si hay carta de sheij (el 6).
  // Jorge (24 de noviembre): «el dado de sheij se cierra automáticamente (sin necesidad de dar clic en cerrar) si es que no salió 6 a
  // los 1.2 segundos. Si salió 6 es necesario dar enter (si hay foco en el botón) o clic en el botón de cerrar». Ya no espera a que
  // quites el mouse de encima; con 6 se queda aunque no llegue carta (ya salió una esta ronda o se acabaron).
  const solo = !!d && d.lanzado && visto === d.id && !en3d && !rodando && !esperaCarta && !!d.sheij && !d.valores?.includes(6) && d.por === s.yo && !d.cerrados?.includes(s.yo);
  useEffect(() => {
    if (!solo) return undefined;
    const reloj = setTimeout(() => enviar(ACCIONES.cerrarDados()), 1200);
    return () => clearTimeout(reloj);
  }, [solo, d?.id]);
  // el foco queda en el botón de la ventana (lanzar o cerrar), para Enter o espacio
  const ajeno = !!d && d.por !== s.yo && (String(d.motivo || '').startsWith('reto:') || d.motivo === 'ingreso' || d.motivo === 'tumba');
  const refLanzar = useFoco(!!d && !d.lanzado && !en3d && !esperaCarta && d.por === s.yo, d?.id);
  const refCerrar = useFoco(!!d && d.lanzado && visto === d.id && !en3d && !rodando && !esperaCarta && !esperaYafar && !ajeno && !d.cerrados?.includes(s.yo), d?.id);
  if (en3d) return null;                                                // rodando en la bandeja 3D: nada encima
  if (!d) return null;
  const por = s.jugadores[d.por];
  // Jorge (19 de noviembre): orden estricto carta → dados → decisión. Los dados ya no esperan detrás de tu decisión (en R23 elegías
  // ante los bandoleros sin haber lanzado el dado); la decisión espera a que se cierren los dados (Decision.jsx).
  if (esperaCarta) return null;                                         // primero se lee la carta que explica la tirada
  if (esperaYafar) return null;                                         // Yafar NPC todavía va en camino a la ciudad de su víctima
  if (d.por !== s.yo && (String(d.motivo || '').startsWith('reto:') || d.motivo === 'ingreso' || d.motivo === 'tumba')) return null;   // reto o dado de ingreso ajeno: los demás solo ven el registro y, si acaso, la alerta (Jorge, 19 de noviembre)
  if (!d.lanzado) {
    const mio = d.por === s.yo;
    return (
      <div className="modal-fondo dados-modal" role="dialog" aria-modal="true" aria-label="Lanzar los dados">
        <div className="dados-resultado panel">
          <p className="quien">{(d.grupos?.[0]?.etq) || (por?.nombre || 'Banco')}</p>
          {(() => {                                                       // contexto: la carta que provoca esta tirada
            // Jorge (27 de noviembre): el texto debe ser el de la carta que provoca la tirada, nunca «la última carta que salió» (la
            // emboscada en el camino mostraba la Caravana de oro del rey de Mali). Se busca por el título que manda el servidor o por el
            // motivo de la tirada (e11 → E11, ej:EJ26 → EJ26); si ninguna carta la explica, no se pone texto de carta.
            const antes = s.historial.filter((h) => h.nro < d.id);
            const idMotivo = cartaDelMotivo(d.motivo);
            const c = (d.contexto && antes.filter((h) => h.titulo === d.contexto).pop()) || (idMotivo && antes.filter((h) => h.id === idMotivo).pop()) || null;
            if (d.titulo) return <p className="dados-contexto">{d.titulo}</p>;      // peleas: no las explica ninguna carta
            return c ? <p className="dados-contexto">Por la carta «{c.titulo}»: {c.texto}</p> : d.contexto ? <p className="dados-contexto">Por «{d.contexto}».</p> : null;
          })()}
          {mio ? <button className="btn grande" onClick={() => enviar(ACCIONES.lanzarDados())} ref={(el) => { refLanzar.current = el; el?.focus({ preventScroll: true }); }}>{d.boton || `Lanzar ${d.n > 1 ? 'los dados' : 'el dado'}`}</button>
            : <><p className="it">Esperando a {por?.nombre || 'alguien'} para lanzar {d.n > 1 ? 'los dados' : 'el dado'}…</p>{por && !por.conectado && <small className="it"> {por.nombre} está desconectado: nadie lanza por él; a los 60 segundos el banco puede sacarlo.</small>}</>}
        </div>
      </div>
    );
  }
  if (visto !== d.id) return null;                                      // todavía no empieza a rodar: su resultado no se adelanta
  const total = d.valores.reduce((a2, b) => a2 + b, 0);
  const MOTIVOS = { ingreso: 'dado de ingreso', tumba: 'dado extra de la tumba', asesinos: 'Los Asesinos', ventana: 'por la ventana', lazo: 'lazo', buza: 'venta de buza', apedreo: 'apedreo', piratas: 'piratas', defensa: 'arco y escudo' };
  const motivo = d.npc || d.motivo.startsWith('npc:') ? `NPC ${d.motivo.startsWith('npc:') ? d.motivo.slice(4) : ''}`.trim() : MOTIVOS[d.motivo] || d.motivo;
  const grupos = d.grupos?.length ? d.grupos : [{ etq: '', valores: d.valores }];
  return (
    <>
      {rodando && (
        <div className="dados-mesa" aria-hidden="true">
          {grupos.slice(0, fila + 1).map((g, gi) => (
            <div key={gi} className={`dados-fila${gi < fila ? ' fija' : ''}`}>
              {g.etq && <span className="dados-fila-etq">{g.etq}</span>}
              <div className="dados-fila-cubos">{g.valores.slice(0, 6).map((v, i) => <Cubo key={d.id + '-' + gi + '-' + i} valor={v} rodando={gi === fila && !g.fijo} idx={i} color={colorGrupo(s, d, g)} />)}</div>
            </div>
          ))}
        </div>
      )}
      {!rodando && !d.cerrados?.includes(s.yo) && (d.motivo !== 'npc:Yafar' || d.alerta) && (   /* Jorge: las tiradas propias de Yafar NPC no tienen ventana (las peleas sí) */
        <div className="modal-fondo dados-modal" role="dialog" aria-modal="true" aria-label="Resultado de los dados">
          <div className="dados-resultado panel">
            {(grupos.length > 1 || !grupos[0].etq || s.enCola > 0) && <p className="quien">{por?.nombre || 'Banco'} · {motivo}{s.enCola ? ` · ${s.enCola} tirada(s) más en cola` : ''}</p>}
            {grupos.map((g, gi) => (
              <div key={gi} className="dados-grupo">
                {g.etq && <p className="etq">{g.etq}</p>}
                <div className="dados-caras">{g.valores.map((v, i) => <div key={i} className="cara-fija"><Cara v={v} color={colorGrupo(s, d, g)} /></div>)}</div>
                {g.valores.length > 1 && d.motivo !== 'pelea' && <p className="suma">Suma {g.valores.reduce((a2, b) => a2 + b, 0)}</p>}
              </div>
            ))}
            {d.sheij && <p className={`aviso-sheij ${d.sheij.ok ? 'si' : 'no'}`} role="status">{d.sheij.texto}</p>}
            {d.resumen?.length > 0 && (                                     // en las peleas el desglose aparece línea por línea
              <ul className={`dados-resumen${d.motivo === 'pelea' ? ' paso-a-paso' : ''}`} role="status">{d.resumen.map((r, i) => <li key={d.id + '-' + i} style={{ '--i': i }} className={/^Gana |vence a|muere|roba|se salva|no se lleva|pierde el duelo|gana por|ambos heridos/.test(r) ? 'final' : undefined}>{r}</li>)}</ul>
            )}
            {!d.resumen?.length && grupos.length === 1 && <p className="total" role="status">{d.valores.length > 1 ? `Suma: ${total}` : `Salió ${total}`}</p>}
            <button className="btn" onClick={() => enviar(ACCIONES.cerrarDados())} ref={(el) => { refCerrar.current = el; el?.focus({ preventScroll: true }); }}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}
