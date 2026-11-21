import { useSyncExternalStore } from 'react';

// Almacén mínimo: el estado del juego llega ya filtrado desde el adaptador. Los componentes se suscriben con useJuego(selector).
let S = { estado: null, conexion: 'inicio', error: null, aviso: null, rechazo: null, demo: false, pids: null, reacciones: [] };
const oyentes = new Set();
let adaptador = null;
const emitir = () => oyentes.forEach((f) => f());
const poner = (p) => { S = { ...S, ...p }; emitir(); };

export function useJuego(sel = (s) => s) {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => oyentes.delete(f); }, () => sel(S), () => sel(S));
}
export const leer = () => S;
// Carta que se está leyendo (nro del historial): los dados lanzados después de ella esperan a que se cierre.
export function marcarCartaEnPantalla(nro) { if (S.cartaEnPantalla !== nro) poner({ cartaEnPantalla: nro }); }
// Primera carta de la cola de lectura, se esté mostrando o no (Jorge, 19 de noviembre): ningún dado ni decisión posterior sale antes que ella.
export function marcarCartaPorLeer(nro) { if (S.cartaPorLeer !== nro) poner({ cartaPorLeer: nro }); }
// Jorge (21 de noviembre): todas las alertas duran 5 segundos (y se cierran antes al tocarlas o deslizarlas: components/Alerta.jsx).
const DURA_MS = 5000;
// Aviso verde local (premios, nueva ronda…). Como mucho dos avisos juntos.
// Aviso rojo local (pagos y pérdidas propias).
export function avisarPerdida(msg) { poner({ error: msg }); setTimeout(() => { if (S.error === msg) poner({ error: null }); }, DURA_MS); }
export function avisar(msg) { const aviso = S.aviso && S.aviso !== msg && !S.aviso.includes(' · ') ? S.aviso + ' · ' + msg : msg; poner({ aviso }); setTimeout(() => { if (S.aviso === aviso) poner({ aviso: null }); }, DURA_MS); }

export async function iniciarJuego(params) {
  const { crearAdaptador } = await import('./adapters/index.js');
  adaptador = await crearAdaptador(params);
  adaptador.onEstado((estado) => poner({ estado, error: null }));
  adaptador.onConexion((conexion) => poner({ conexion }));
  // 5 segundos todas (Jorge, 21 de noviembre); se cierran antes al tocarlas o deslizarlas (cerrarAviso)
  adaptador.onError((error) => { poner({ error }); setTimeout(() => { if (S.error === error) poner({ error: null }); }, DURA_MS); });
  adaptador.onHecho?.((aviso) => { poner({ aviso }); setTimeout(() => { if (S.aviso === aviso) poner({ aviso: null }); }, DURA_MS); });   // confirmación de entregas y tesoro
  adaptador.onReaccion?.((r) => {                                       // burbujas de reacción: como mucho 3 a la vez, 4.5 s cada una
    const k = `${r.de}-${r.ts}`; poner({ reacciones: [...S.reacciones, { ...r, k }].slice(-3) });
    setTimeout(() => poner({ reacciones: S.reacciones.filter((x) => x.k !== k) }), 4500);
  });
  adaptador.onRechazo?.((rechazo, pideClave) => poner({ rechazo, pideClave: !!pideClave, conexion: 'inicio' }));   // de vuelta a la pantalla de entrada con el motivo
  poner({ demo: adaptador.modo === 'demo', pids: adaptador.pids?.() || null });
  adaptador.conectar(params);
}
export const enviar = (a) => adaptador?.enviar(a);
// Cerrar un anuncio al tocarlo: solo lo oculta en este navegador; no cambia nada del juego (Jorge, 10 de noviembre).
export const cerrarAviso = (k) => poner({ [k]: null });
export const reaccionar = (id) => adaptador?.reaccionar?.(id);
export const verComo = (pid) => adaptador?.verComo?.(pid);
export const adaptadorActual = () => adaptador;
